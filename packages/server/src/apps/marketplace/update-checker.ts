import { db } from '../../config/database';
import { marketplaceApps } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { getManifest } from './service';
import type { MarketplaceAppRecord, MarketplaceManifest } from './types';

// ─── Image Parsing ──────────────────────────────────────────────────

export interface ParsedImage {
  registry: string;
  repo: string;
  tag: string;
}

/**
 * Parse a Docker image string into registry, repo, and tag.
 *
 * Examples:
 *   "mongo:7"                                → { registry: 'docker.io', repo: 'library/mongo', tag: '7' }
 *   "ghcr.io/umami-software/umami:latest"    → { registry: 'ghcr.io', repo: 'umami-software/umami', tag: 'latest' }
 *   "bluewave-labs/checkmate:latest"          → { registry: 'docker.io', repo: 'bluewave-labs/checkmate', tag: 'latest' }
 *   "metabase/metabase:latest"               → { registry: 'docker.io', repo: 'metabase/metabase', tag: 'latest' }
 *   "postgres:15-alpine"                     → { registry: 'docker.io', repo: 'library/postgres', tag: '15-alpine' }
 */
export function parseImage(image: string): ParsedImage {
  let tag = 'latest';
  let remainder = image;

  // Split off the tag (last colon that doesn't belong to a port/registry)
  const lastColon = remainder.lastIndexOf(':');
  if (lastColon > 0) {
    const afterColon = remainder.slice(lastColon + 1);
    // If there's no slash after the colon, it's a tag
    if (!afterColon.includes('/')) {
      tag = afterColon;
      remainder = remainder.slice(0, lastColon);
    }
  }

  // Determine if the first segment is a registry (contains a dot or colon)
  const parts = remainder.split('/');

  if (parts.length >= 2 && (parts[0].includes('.') || parts[0].includes(':'))) {
    // First segment is a registry (e.g., ghcr.io, registry.example.com)
    const registry = parts[0];
    const repo = parts.slice(1).join('/');
    return { registry, repo, tag };
  }

  // Docker Hub — no explicit registry
  if (parts.length === 1) {
    // Official image: "mongo" → "library/mongo"
    return { registry: 'docker.io', repo: `library/${parts[0]}`, tag };
  }

  // User image: "bluewave-labs/checkmate" → "bluewave-labs/checkmate"
  return { registry: 'docker.io', repo: remainder, tag };
}

// ─── Registry Digest Fetching ────────────────────────────────────────

const ACCEPT_HEADER = [
  'application/vnd.docker.distribution.manifest.v2+json',
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
].join(',');

const FETCH_TIMEOUT_MS = 15_000;

/**
 * Fetch the latest manifest digest from a container registry.
 * Supports Docker Hub and GHCR anonymous auth flows.
 * Returns the digest string (e.g. "sha256:abc123...") or null on failure.
 */
async function getRegistryDigest(
  registry: string,
  repo: string,
  tag: string,
): Promise<string | null> {
  try {
    const { tokenUrl, manifestUrl } = getRegistryUrls(registry, repo, tag);

    // Step 1: Get anonymous bearer token
    const tokenRes = await fetchWithTimeout(tokenUrl, {}, FETCH_TIMEOUT_MS);
    if (!tokenRes.ok) {
      logger.debug(
        { registry, repo, tag, status: tokenRes.status },
        'Failed to get registry auth token',
      );
      return null;
    }

    const tokenBody = (await tokenRes.json()) as { token?: string };
    const token = tokenBody.token;
    if (!token) {
      logger.debug({ registry, repo, tag }, 'No token in auth response');
      return null;
    }

    // Step 2: Fetch manifest with the token to get digest
    const manifestRes = await fetchWithTimeout(
      manifestUrl,
      {
        method: 'HEAD',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: ACCEPT_HEADER,
        },
      },
      FETCH_TIMEOUT_MS,
    );

    if (!manifestRes.ok) {
      logger.debug(
        { registry, repo, tag, status: manifestRes.status },
        'Failed to fetch manifest',
      );
      return null;
    }

    const digest = manifestRes.headers.get('docker-content-digest');
    return digest ?? null;
  } catch (err) {
    logger.debug({ err, registry, repo, tag }, 'Error fetching registry digest');
    return null;
  }
}

/**
 * Build the token and manifest URLs for a given registry.
 */
function getRegistryUrls(
  registry: string,
  repo: string,
  tag: string,
): { tokenUrl: string; manifestUrl: string } {
  if (registry === 'ghcr.io') {
    return {
      tokenUrl: `https://ghcr.io/token?service=ghcr.io&scope=repository:${repo}:pull`,
      manifestUrl: `https://ghcr.io/v2/${repo}/manifests/${tag}`,
    };
  }

  // Default: Docker Hub
  return {
    tokenUrl: `https://auth.docker.io/token?service=registry.docker.io&scope=repository:${repo}:pull`,
    manifestUrl: `https://registry-1.docker.io/v2/${repo}/manifests/${tag}`,
  };
}

/**
 * Fetch with an AbortController timeout.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Update Checking Logic ───────────────────────────────────────────

export interface UpdateCheckResult {
  appId: string;
  service: string;
  image: string;
  currentDigest: string | null;
  latestDigest: string | null;
  updateAvailable: boolean;
}

/**
 * Check all installed marketplace apps for available image updates.
 *
 * For each installed app, checks the primary service image (the one with
 * a port exposed, i.e. the "app" service) against the registry.
 * If a newer digest is found, updates `latestDigest` in the database.
 *
 * Returns a summary of results for the manual trigger endpoint.
 */
export async function checkForUpdates(): Promise<UpdateCheckResult[]> {
  const results: UpdateCheckResult[] = [];

  try {
    // Get all installed apps across all accounts
    const allInstalled = await db
      .select()
      .from(marketplaceApps) as MarketplaceAppRecord[];

    if (allInstalled.length === 0) {
      logger.info('Update checker: no installed apps to check');
      return results;
    }

    logger.info(
      { count: allInstalled.length },
      'Update checker: starting check for installed apps',
    );

    for (const installation of allInstalled) {
      try {
        const manifest = getManifest(installation.appId);
        if (!manifest) {
          logger.warn(
            { appId: installation.appId },
            'Update checker: no manifest found for installed app',
          );
          continue;
        }

        // Check the primary service image (the one with a port = the user-facing service)
        const primaryService = findPrimaryService(manifest);
        if (!primaryService) {
          continue;
        }

        const { serviceName, image } = primaryService;
        const parsed = parseImage(image);

        const digest = await getRegistryDigest(parsed.registry, parsed.repo, parsed.tag);

        const result: UpdateCheckResult = {
          appId: installation.appId,
          service: serviceName,
          image,
          currentDigest: installation.imageDigest,
          latestDigest: digest,
          updateAvailable: false,
        };

        if (digest) {
          // If we have a current digest and it differs, an update is available
          if (installation.imageDigest && installation.imageDigest !== digest) {
            result.updateAvailable = true;
          }

          // Update the latestDigest column (and set imageDigest if not yet set)
          const updates: Record<string, unknown> = {
            latestDigest: digest,
            updatedAt: new Date(),
          };

          if (!installation.imageDigest) {
            // First time checking — set both to the same value (no update yet)
            updates.imageDigest = digest;
          }

          await db
            .update(marketplaceApps)
            .set(updates)
            .where(eq(marketplaceApps.id, installation.id));

          logger.info(
            {
              appId: installation.appId,
              service: serviceName,
              currentDigest: installation.imageDigest?.slice(0, 20),
              latestDigest: digest.slice(0, 20),
              updateAvailable: result.updateAvailable,
            },
            'Update checker: checked image',
          );
        } else {
          logger.debug(
            { appId: installation.appId, image },
            'Update checker: could not fetch digest',
          );
        }

        results.push(result);
      } catch (err) {
        // Swallow per-app errors so we continue checking others
        logger.warn(
          { err, appId: installation.appId },
          'Update checker: error checking app',
        );
      }
    }

    const updatesAvailable = results.filter(r => r.updateAvailable).length;
    logger.info(
      { checked: results.length, updatesAvailable },
      'Update checker: completed',
    );
  } catch (err) {
    // Top-level error — don't crash the server
    logger.error({ err }, 'Update checker: failed to run');
  }

  return results;
}

/**
 * Find the primary (user-facing) service in a manifest — the one with a port.
 * Falls back to the "app" key if no port is defined.
 */
function findPrimaryService(
  manifest: MarketplaceManifest,
): { serviceName: string; image: string } | null {
  // Prefer the service named "app"
  if (manifest.services['app']) {
    return { serviceName: 'app', image: manifest.services['app'].image };
  }

  // Otherwise, find the first service with a port
  for (const [name, svc] of Object.entries(manifest.services)) {
    if (svc.port) {
      return { serviceName: name, image: svc.image };
    }
  }

  // Last resort: first service
  const entries = Object.entries(manifest.services);
  if (entries.length > 0) {
    return { serviceName: entries[0][0], image: entries[0][1].image };
  }

  return null;
}

// ─── Scheduler ───────────────────────────────────────────────────────

const UPDATE_CHECK_DELAY_MS = 30_000; // 30 seconds after server start
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

let updateCheckTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the background update checker.
 * Runs once after a 30-second delay, then daily.
 */
export function startUpdateChecker(): void {
  // Initial check after delay (let server fully boot)
  setTimeout(() => {
    checkForUpdates().catch((err) => {
      logger.error({ err }, 'Initial update check failed');
    });
  }, UPDATE_CHECK_DELAY_MS);

  // Daily recurring check
  updateCheckTimer = setInterval(() => {
    checkForUpdates().catch((err) => {
      logger.error({ err }, 'Scheduled update check failed');
    });
  }, UPDATE_CHECK_INTERVAL_MS);

  logger.info('Marketplace update checker scheduled (daily)');
}

/**
 * Stop the background update checker (for graceful shutdown).
 */
export function stopUpdateChecker(): void {
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
    updateCheckTimer = null;
  }
}
