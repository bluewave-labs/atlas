import { db } from '../../config/database';
import { marketplaceApps } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { MarketplaceManifest, MarketplaceAppRecord } from './types';

// ─── Catalog ───────────────────────────────────────────────────────

const CATALOG_DIR = path.join(__dirname, 'catalog');

// In-memory catalog cache — files only change on server restart
let catalogCache: MarketplaceManifest[] | null = null;

/**
 * Read all JSON manifests from the catalog directory.
 * Cached in memory since catalog files only change between deploys.
 */
export function getCatalog(): MarketplaceManifest[] {
  if (catalogCache) return catalogCache;

  const files = fs.readdirSync(CATALOG_DIR).filter(f => f.endsWith('.json'));
  const manifests: MarketplaceManifest[] = [];

  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(CATALOG_DIR, file), 'utf-8');
      manifests.push(JSON.parse(raw) as MarketplaceManifest);
    } catch (err) {
      logger.error({ err, file }, 'Failed to read catalog manifest');
    }
  }

  catalogCache = manifests;
  return manifests;
}

/**
 * Get a single manifest by ID from the catalog.
 */
export function getManifest(appId: string): MarketplaceManifest | undefined {
  return getCatalog().find(m => m.id === appId);
}

// ─── Installed Apps (DB) ───────────────────────────────────────────

/**
 * Get all installed marketplace apps for an account.
 */
export async function getInstalledApps(accountId: string): Promise<MarketplaceAppRecord[]> {
  const rows = await db
    .select()
    .from(marketplaceApps)
    .where(eq(marketplaceApps.accountId, accountId));

  return rows as MarketplaceAppRecord[];
}

/**
 * Get a single installation record.
 */
export async function getAppInstallation(
  accountId: string,
  appId: string,
): Promise<MarketplaceAppRecord | undefined> {
  const rows = await db
    .select()
    .from(marketplaceApps)
    .where(
      and(
        eq(marketplaceApps.accountId, accountId),
        eq(marketplaceApps.appId, appId),
      ),
    );

  return rows[0] as MarketplaceAppRecord | undefined;
}

// ─── Port Allocation ───────────────────────────────────────────────

const PORT_MIN = 10000;
const PORT_MAX = 65000;

/**
 * Allocate a random port in the 10000-65000 range, ensuring it is not
 * already assigned to another marketplace app in the database.
 */
export async function allocatePort(_accountId: string): Promise<number> {
  // Get all ports already in use across all accounts
  const rows = await db
    .select({ port: marketplaceApps.assignedPort })
    .from(marketplaceApps);

  const usedPorts = new Set(rows.map(r => r.port));

  // Try up to 100 random ports
  for (let i = 0; i < 100; i++) {
    const port = PORT_MIN + Math.floor(Math.random() * (PORT_MAX - PORT_MIN + 1));
    if (!usedPorts.has(port)) {
      return port;
    }
  }

  throw new Error('Could not allocate a free port after 100 attempts');
}

// ─── Secret Generation ──────────────────────────────��──────────────

const SECRET_PATTERN = /\$SECRET_([A-Z0-9_]+)_(\d+)/g;

/**
 * Scan all service env vars in a manifest for $SECRET_<name>_<length> patterns.
 * Generate random hex strings for each unique secret name.
 * Returns a map like { "SECRET_JWT_64": "a1b2c3...", "SECRET_DB_PASS_32": "d4e5f6..." }
 */
export function generateSecrets(manifest: MarketplaceManifest): Record<string, string> {
  const secrets: Record<string, string> = {};

  for (const service of Object.values(manifest.services)) {
    if (!service.env) continue;
    for (const value of Object.values(service.env)) {
      let match: RegExpExecArray | null;
      // Reset regex state for each value
      SECRET_PATTERN.lastIndex = 0;
      while ((match = SECRET_PATTERN.exec(value)) !== null) {
        const name = match[1];
        const length = parseInt(match[2], 10);
        const key = `SECRET_${name}_${length}`;
        if (!secrets[key]) {
          // Generate random hex string of the specified length
          secrets[key] = crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
        }
      }
    }
  }

  return secrets;
}

// ─── Secret Encryption / Decryption ────────────────────────────────

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  return Buffer.from(env.TOKEN_ENCRYPTION_KEY, 'hex');
}

/**
 * Encrypt a secrets map to a single opaque string for DB storage.
 * Format: base64(iv + authTag + ciphertext)
 */
export function encryptSecrets(secrets: Record<string, string>): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const plaintext = JSON.stringify(secrets);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Concatenate: iv (16) + authTag (16) + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypt an encrypted secrets string back to the secrets map.
 */
export function decryptSecrets(encrypted: string): Record<string, string> {
  const key = getEncryptionKey();
  const combined = Buffer.from(encrypted, 'base64');

  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return JSON.parse(decrypted.toString('utf8'));
}

// ─── DB Mutations ──────────────────────────────────────────────────

/**
 * Save (insert or update) an installation record.
 */
export async function saveInstallation(
  accountId: string,
  appId: string,
  port: number,
  secrets: Record<string, string>,
  containerIds: string[],
): Promise<void> {
  const encryptedSecrets = encryptSecrets(secrets);
  const now = new Date();

  // Try to find existing
  const existing = await getAppInstallation(accountId, appId);

  if (existing) {
    await db
      .update(marketplaceApps)
      .set({
        status: 'running',
        assignedPort: port,
        containerIds,
        generatedSecrets: encryptedSecrets,
        updatedAt: now,
      })
      .where(
        and(
          eq(marketplaceApps.accountId, accountId),
          eq(marketplaceApps.appId, appId),
        ),
      );
  } else {
    await db.insert(marketplaceApps).values({
      accountId,
      appId,
      status: 'running',
      assignedPort: port,
      containerIds,
      generatedSecrets: encryptedSecrets,
      installedAt: now,
      updatedAt: now,
    });
  }
}

/**
 * Update the status of an installed app.
 */
export async function updateStatus(
  accountId: string,
  appId: string,
  status: string,
): Promise<void> {
  await db
    .update(marketplaceApps)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(marketplaceApps.accountId, accountId),
        eq(marketplaceApps.appId, appId),
      ),
    );
}

/**
 * Update container IDs after a deploy/update operation.
 */
export async function updateContainerIds(
  accountId: string,
  appId: string,
  containerIds: string[],
): Promise<void> {
  await db
    .update(marketplaceApps)
    .set({ containerIds, updatedAt: new Date() })
    .where(
      and(
        eq(marketplaceApps.accountId, accountId),
        eq(marketplaceApps.appId, appId),
      ),
    );
}

/**
 * Update image digest info (for update checking).
 */
export async function updateDigests(
  accountId: string,
  appId: string,
  imageDigest?: string,
  latestDigest?: string,
): Promise<void> {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (imageDigest !== undefined) updates.imageDigest = imageDigest;
  if (latestDigest !== undefined) updates.latestDigest = latestDigest;

  await db
    .update(marketplaceApps)
    .set(updates)
    .where(
      and(
        eq(marketplaceApps.accountId, accountId),
        eq(marketplaceApps.appId, appId),
      ),
    );
}

/**
 * Remove an installation record from the database.
 */
export async function removeInstallation(
  accountId: string,
  appId: string,
): Promise<void> {
  await db
    .delete(marketplaceApps)
    .where(
      and(
        eq(marketplaceApps.accountId, accountId),
        eq(marketplaceApps.appId, appId),
      ),
    );
}

/**
 * Get the app data directory where compose files are stored.
 * Creates the directory if it doesn't exist.
 */
export function getAppDir(appId: string): string {
  const dir = path.join(process.cwd(), 'data', 'marketplace', appId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
