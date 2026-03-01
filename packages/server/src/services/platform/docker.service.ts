import Docker from 'dockerode';
import { logger } from '../../utils/logger';
import type { AtlasManifest } from '@atlasmail/shared';

const docker = new Docker();

const TENANT_NETWORK_PREFIX = 'atlas-net-';
const CONTAINER_PREFIX = 'atlas-app-';

/**
 * Map private registry images to public Docker Hub images for local dev.
 * In production, the images are pre-loaded into the host's Docker daemon
 * via the platform's image provisioning pipeline.
 */
const DEV_IMAGE_MAP: Record<string, string> = {
  'registry.atlas.so/apps/calcom:5.6.19': 'calcom/cal.com:latest',
  'registry.atlas.so/apps/nocodb:0.202.10': 'nocodb/nocodb:latest',
  'registry.atlas.so/apps/gitea:1.22.3': 'gitea/gitea:latest',
};

function resolveImage(manifestImage: string): string {
  return DEV_IMAGE_MAP[manifestImage] ?? manifestImage;
}

function containerName(installationId: string): string {
  return `${CONTAINER_PREFIX}${installationId.replace(/-/g, '')}`;
}

function tenantNetworkName(tenantSlug: string): string {
  return `${TENANT_NETWORK_PREFIX}${tenantSlug}`;
}

// ---------------------------------------------------------------------------
// Tenant network management
// ---------------------------------------------------------------------------

/**
 * Ensure a per-tenant Docker network exists. Creates it if missing.
 * Also connects shared infrastructure containers (postgres, redis) so
 * tenant app containers can reach them.
 */
async function ensureTenantNetwork(tenantSlug: string): Promise<string> {
  const networkName = tenantNetworkName(tenantSlug);

  // Check if network already exists
  const networks = await docker.listNetworks({
    filters: { name: [networkName] },
  });

  const existing = networks.find((n) => n.Name === networkName);
  if (existing) {
    return networkName;
  }

  // Create isolated bridge network for this tenant
  // Wrapped in try/catch to handle concurrent creation (race condition)
  try {
    await docker.createNetwork({
      Name: networkName,
      Driver: 'bridge',
      Labels: {
        'atlas-managed': 'true',
        'atlas-tenant': tenantSlug,
      },
    });
    logger.info({ networkName, tenantSlug }, 'Tenant Docker network created');
  } catch (err: any) {
    // Ignore "already exists" error from concurrent creation
    if (err?.statusCode === 409 || err?.message?.includes('already exists')) {
      logger.debug({ networkName }, 'Tenant network already exists (concurrent creation)');
    } else {
      throw err;
    }
  }

  // Connect shared infrastructure containers so tenant apps can reach them
  await connectInfraContainers(networkName);

  return networkName;
}

/**
 * Connect shared infrastructure containers (postgres, redis, traefik) to the
 * tenant network so app containers can reach DB/cache/proxy services.
 */
async function connectInfraContainers(networkName: string) {
  const infraNames = ['postgres', 'redis', 'traefik'];
  const network = docker.getNetwork(networkName);

  for (const name of infraNames) {
    try {
      const container = docker.getContainer(name);
      const info = await container.inspect();
      // Skip if already connected
      if (info.NetworkSettings.Networks[networkName]) continue;
      await network.connect({ Container: container.id });
      logger.info({ container: name, networkName }, 'Infrastructure container connected to tenant network');
    } catch {
      // Container may not exist (e.g. no redis in some setups) — skip silently
    }
  }
}

/**
 * Remove a tenant's Docker network if no app containers are using it.
 */
async function removeTenantNetworkIfEmpty(tenantSlug: string) {
  const networkName = tenantNetworkName(tenantSlug);
  try {
    const network = docker.getNetwork(networkName);
    const info = await network.inspect();
    const containers = info.Containers ?? {};

    // Only remove if no atlas-app containers remain (infra containers don't count)
    const appContainers = Object.values(containers).filter(
      (c: any) => c.Name?.startsWith(CONTAINER_PREFIX),
    );

    if (appContainers.length === 0) {
      // Disconnect infra containers before removing the network
      for (const [id] of Object.entries(containers)) {
        try { await network.disconnect({ Container: id, Force: true }); } catch { /* ignore */ }
      }
      await network.remove();
      logger.info({ networkName, tenantSlug }, 'Empty tenant network removed');
    }
  } catch {
    // Network doesn't exist — nothing to do
  }
}

// ---------------------------------------------------------------------------
// Deploy
// ---------------------------------------------------------------------------

interface DeployContainerOpts {
  installationId: string;
  manifest: AtlasManifest;
  envVars: Record<string, string>;
  subdomain: string;
  tenantSlug: string;
}

export async function deployAppContainer(opts: DeployContainerOpts) {
  const { installationId, manifest, envVars, subdomain, tenantSlug } = opts;
  const image = resolveImage(manifest.runtime.image);
  const name = containerName(installationId);
  const hostname = `${subdomain}.${tenantSlug}.localhost`;

  // Verify the image exists locally — images must be pre-loaded on the host
  try {
    const img = docker.getImage(image);
    await img.inspect();
  } catch {
    throw new Error(
      `Docker image "${image}" not found locally. Images must be pre-loaded on the host before deploying apps.`,
    );
  }

  // Ensure tenant-isolated network exists
  const networkName = await ensureTenantNetwork(tenantSlug);

  // Build env array
  const envArray = Object.entries(envVars).map(([k, v]) => `${k}=${v}`);

  // Traefik labels for automatic routing
  const routerName = name.replace(/[^a-zA-Z0-9]/g, '-');
  const labels: Record<string, string> = {
    'traefik.enable': 'true',
    [`traefik.http.routers.${routerName}.rule`]: `Host(\`${hostname}\`)`,
    [`traefik.http.routers.${routerName}.entrypoints`]: 'web',
    [`traefik.http.services.${routerName}.loadbalancer.server.port`]: String(manifest.runtime.httpPort),
    'atlas-managed': 'true',
    'atlas-installation-id': installationId,
    'atlas-app-id': manifest.id,
    'atlas-tenant': tenantSlug,
  };

  // Remove existing container if any
  try {
    const existing = docker.getContainer(name);
    await existing.stop().catch(() => {});
    await existing.remove({ force: true });
  } catch {
    // No existing container
  }

  const container = await docker.createContainer({
    name,
    Image: image,
    Env: envArray,
    Labels: labels,
    ExposedPorts: {
      [`${manifest.runtime.httpPort}/tcp`]: {},
    },
    HostConfig: {
      NetworkMode: networkName,
      RestartPolicy: { Name: 'unless-stopped' },
      // Allow container to reach the host (for OIDC issuer)
      ExtraHosts: ['host.docker.internal:host-gateway'],
    },
  });

  await container.start();
  logger.info({ name, image, hostname, networkName }, 'Docker container started');
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export async function removeAppContainer(installationId: string, tenantSlug?: string) {
  const name = containerName(installationId);
  try {
    const container = docker.getContainer(name);
    await container.stop().catch(() => {});
    await container.remove({ force: true });
    logger.info({ name }, 'Docker container removed');
  } catch (err) {
    logger.warn({ err, name }, 'Failed to remove Docker container');
  }

  // Clean up empty tenant network
  if (tenantSlug) {
    await removeTenantNetworkIfEmpty(tenantSlug);
  }
}

export async function startAppContainer(installationId: string) {
  const name = containerName(installationId);
  const container = docker.getContainer(name);
  await container.start();
  logger.info({ name }, 'Docker container started');
}

export async function stopAppContainer(installationId: string) {
  const name = containerName(installationId);
  const container = docker.getContainer(name);
  await container.stop();
  logger.info({ name }, 'Docker container stopped');
}

export async function restartAppContainer(installationId: string) {
  const name = containerName(installationId);
  const container = docker.getContainer(name);
  await container.restart();
  logger.info({ name }, 'Docker container restarted');
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export async function getContainerHealth(installationId: string): Promise<'healthy' | 'unhealthy' | 'unknown'> {
  const name = containerName(installationId);
  try {
    const container = docker.getContainer(name);
    const info = await container.inspect();
    const state = info.State;

    if (!state.Running) return 'unhealthy';
    return 'healthy';
  } catch {
    return 'unknown';
  }
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listAtlasContainers() {
  const containers = await docker.listContainers({
    all: true,
    filters: { label: ['atlas-managed=true'] },
  });
  return containers.map((c) => ({
    id: c.Id,
    name: c.Names[0]?.replace(/^\//, ''),
    state: c.State,
    installationId: c.Labels['atlas-installation-id'],
    appId: c.Labels['atlas-app-id'],
    tenant: c.Labels['atlas-tenant'],
    image: c.Image,
  }));
}
