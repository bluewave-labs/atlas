import Docker from 'dockerode';
import { logger } from '../../utils/logger';
import type { AtlasManifest } from '@atlasmail/shared';

const docker = new Docker();

const NETWORK_NAME = 'atlas-net';
const CONTAINER_PREFIX = 'atlas-app-';

/**
 * Map private registry images to public Docker Hub images for local dev.
 */
const DEV_IMAGE_MAP: Record<string, string> = {
  'registry.atlas.so/apps/calcom:5.6.19': 'calcom/cal.com:v4.8.3',
  'registry.atlas.so/apps/nocodb:0.202.10': 'nocodb/nocodb:0.202.10',
  'registry.atlas.so/apps/gitea:1.22.3': 'gitea/gitea:1.22.3',
};

function resolveImage(manifestImage: string): string {
  return DEV_IMAGE_MAP[manifestImage] ?? manifestImage;
}

function containerName(installationId: string): string {
  return `${CONTAINER_PREFIX}${installationId.slice(0, 12)}`;
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

  // Pull image first (no-op if already present)
  logger.info({ image }, 'Pulling Docker image');
  try {
    await new Promise<void>((resolve, reject) => {
      docker.pull(image, {}, (err: Error | null, stream?: NodeJS.ReadableStream) => {
        if (err) return reject(err);
        if (!stream) return reject(new Error('No stream returned from pull'));
        docker.modem.followProgress(stream, (pullErr: Error | null) => {
          if (pullErr) return reject(pullErr);
          resolve();
        });
      });
    });
  } catch (err) {
    logger.warn({ err, image }, 'Image pull failed — attempting to use local image');
  }

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
      NetworkMode: NETWORK_NAME,
      RestartPolicy: { Name: 'unless-stopped' },
      // Allow container to reach the host (for OIDC issuer)
      ExtraHosts: ['host.docker.internal:host-gateway'],
    },
  });

  await container.start();
  logger.info({ name, image, hostname }, 'Docker container started');
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export async function removeAppContainer(installationId: string) {
  const name = containerName(installationId);
  try {
    const container = docker.getContainer(name);
    await container.stop().catch(() => {});
    await container.remove({ force: true });
    logger.info({ name }, 'Docker container removed');
  } catch (err) {
    logger.warn({ err, name }, 'Failed to remove Docker container');
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
    image: c.Image,
  }));
}
