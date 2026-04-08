import type { Request, Response } from 'express';
import { logger } from '../../utils/logger';
import * as service from './service';
import * as dockerService from './docker.service';
import { generateComposeFile, getHostPlatform } from './compose.generator';
import { checkForUpdates } from './update-checker';

// ─── Helpers ──────────────────────────────────────────────────────

function isAdmin(req: Request): boolean {
  return !!(req.auth?.isSuperAdmin || req.auth?.tenantRole === 'owner' || req.auth?.tenantRole === 'admin');
}

function requireAdmin(req: Request, res: Response): boolean {
  if (!isAdmin(req)) {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return false;
  }
  return true;
}

// ─── 1. GET /catalog ──────────────────────────────────────────────

export async function getCatalog(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const catalog = service.getCatalog();
    const [installed, dockerAvailable, systemResources] = await Promise.all([
      service.getInstalledApps(tenantId),
      dockerService.isDockerAvailable(),
      dockerService.getSystemResources(),
    ]);

    const installedMap = new Map(installed.map(app => [app.appId, app]));

    const hostPlatform = getHostPlatform();

    const items = catalog.map(manifest => {
      const record = installedMap.get(manifest.id);
      // Check if the app supports this platform
      const hasPlatformOverride = Object.values(manifest.services).some(
        s => s.platformImages?.[hostPlatform],
      );
      const platformCompatible = !manifest.supportedPlatforms
        || manifest.supportedPlatforms.includes(hostPlatform)
        || hasPlatformOverride;

      return {
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        icon: manifest.icon,
        category: manifest.category,
        color: manifest.color,
        website: manifest.website,
        license: manifest.license,
        resources: manifest.resources,
        defaultCredentials: manifest.defaultCredentials,
        userEnv: manifest.userEnv,
        installed: !!record,
        status: record?.status ?? null,
        assignedPort: record?.assignedPort ?? null,
        updateAvailable: record ? (record.latestDigest != null && record.imageDigest !== record.latestDigest) : false,
        platformCompatible,
      };
    });

    res.json({ success: true, data: { items, dockerAvailable, hostPlatform, systemResources } });
  } catch (error) {
    logger.error({ error }, 'Failed to get marketplace catalog');
    res.status(500).json({ success: false, error: 'Failed to get marketplace catalog' });
  }
}

// ─── 2. GET /installed ────────────────────────────────────────────

export async function getInstalled(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const installed = await service.getInstalledApps(tenantId);

    // Enrich with live container status
    const enriched = await Promise.all(
      installed.map(async (app) => {
        let liveStatus = app.status;
        if (app.containerIds && app.containerIds.length > 0) {
          const statuses = await dockerService.getContainerStatus(app.containerIds);
          const running = statuses.some(s => s.state === 'running');
          const exited = statuses.every(s => s.state === 'exited' || s.state === 'not_found');
          if (running) liveStatus = 'running';
          else if (exited) liveStatus = 'stopped';
        }
        return {
          id: app.id,
          appId: app.appId,
          status: liveStatus,
          assignedPort: app.assignedPort,
          installedAt: app.installedAt,
          updatedAt: app.updatedAt,
          updateAvailable: app.latestDigest != null && app.imageDigest !== app.latestDigest,
        };
      }),
    );

    res.json({ success: true, data: enriched });
  } catch (error) {
    logger.error({ error }, 'Failed to get installed apps');
    res.status(500).json({ success: false, error: 'Failed to get installed apps' });
  }
}

// ─── 3. POST /:appId/deploy ──────────────────────────────────────

export async function deploy(req: Request, res: Response) {
  if (!requireAdmin(req, res)) return;

  const appId = req.params.appId as string;
  const tenantId = req.auth!.tenantId;
  const envOverrides = req.body?.envOverrides as Record<string, string> | undefined;

  try {
    // Check Docker availability
    const dockerAvailable = await dockerService.isDockerAvailable();
    if (!dockerAvailable) {
      res.status(503).json({ success: false, error: 'Docker is not available on this server' });
      return;
    }

    // Check if already installed
    const existing = await service.getAppInstallation(tenantId, appId);
    if (existing) {
      res.status(409).json({ success: false, error: 'App is already installed' });
      return;
    }

    // Get manifest
    const manifest = service.getManifest(appId);
    if (!manifest) {
      res.status(404).json({ success: false, error: 'App not found in catalog' });
      return;
    }

    // Check system resources and warn if low (non-blocking)
    const sysResources = await dockerService.getSystemResources();
    const resourceWarnings = dockerService.checkResources(manifest.resources, sysResources);
    if (resourceWarnings.length > 0) {
      logger.warn({ appId, warnings: resourceWarnings, resources: sysResources }, 'Low system resources for app deployment');
    }

    // Allocate port and generate secrets
    const port = await service.allocatePort(tenantId);
    const secrets = service.generateSecrets(manifest);

    // Save installation record FIRST with "installing" status
    await service.saveInstallation(tenantId, appId, port, secrets, []);
    await service.updateStatus(tenantId, appId, 'installing');

    // Generate compose file
    const composeContent = generateComposeFile(manifest, port, secrets);

    // Get app directory
    const appDir = service.getAppDir(appId);

    // Deploy via docker compose
    await dockerService.deploy(appId, composeContent, appDir);

    // Get container IDs and update record
    const containerIds = await dockerService.listAppContainers(appId);
    await service.updateContainerIds(tenantId, appId, containerIds);
    await service.updateStatus(tenantId, appId, 'running');

    // Store env overrides if provided
    if (envOverrides && Object.keys(envOverrides).length > 0) {
      // We could extend the DB record — for now we just log
      logger.info({ appId, envOverrides: Object.keys(envOverrides) }, 'Env overrides provided');
    }

    res.json({
      success: true,
      data: {
        appId,
        status: 'running',
        assignedPort: port,
        containerIds,
      },
    });
  } catch (error) {
    logger.error({ error, appId }, 'Failed to deploy app');

    // Try to update status to failed
    try {
      await service.updateStatus(tenantId, appId, 'failed');
    } catch {
      // Non-critical
    }

    const msg = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: `Failed to deploy app: ${msg}` });
  }
}

// ─── 4. POST /:appId/start ──────────────────────────────────────

export async function start(req: Request, res: Response) {
  if (!requireAdmin(req, res)) return;

  const appId = req.params.appId as string;
  const tenantId = req.auth!.tenantId;

  try {
    const installation = await service.getAppInstallation(tenantId, appId);
    if (!installation) {
      res.status(404).json({ success: false, error: 'App is not installed' });
      return;
    }

    const appDir = service.getAppDir(appId);
    await dockerService.start(appId, appDir);

    // Update container IDs and status
    const containerIds = await dockerService.listAppContainers(appId);
    await service.updateContainerIds(tenantId, appId, containerIds);
    await service.updateStatus(tenantId, appId, 'running');

    res.json({ success: true, data: { appId, status: 'running' } });
  } catch (error) {
    logger.error({ error, appId }, 'Failed to start app');
    res.status(500).json({ success: false, error: 'Failed to start app' });
  }
}

// ─── 5. POST /:appId/stop ───────────────────────────────────────

export async function stop(req: Request, res: Response) {
  if (!requireAdmin(req, res)) return;

  const appId = req.params.appId as string;
  const tenantId = req.auth!.tenantId;

  try {
    const installation = await service.getAppInstallation(tenantId, appId);
    if (!installation) {
      res.status(404).json({ success: false, error: 'App is not installed' });
      return;
    }

    const appDir = service.getAppDir(appId);
    await dockerService.stop(appId, appDir);
    await service.updateStatus(tenantId, appId, 'stopped');

    res.json({ success: true, data: { appId, status: 'stopped' } });
  } catch (error) {
    logger.error({ error, appId }, 'Failed to stop app');
    res.status(500).json({ success: false, error: 'Failed to stop app' });
  }
}

// ─── 6. POST /:appId/update ─────────────────────────────────────

export async function update(req: Request, res: Response) {
  if (!requireAdmin(req, res)) return;

  const appId = req.params.appId as string;
  const tenantId = req.auth!.tenantId;

  try {
    const installation = await service.getAppInstallation(tenantId, appId);
    if (!installation) {
      res.status(404).json({ success: false, error: 'App is not installed' });
      return;
    }

    const appDir = service.getAppDir(appId);
    await dockerService.update(appId, appDir);

    // Update container IDs
    const containerIds = await dockerService.listAppContainers(appId);
    await service.updateContainerIds(tenantId, appId, containerIds);
    await service.updateStatus(tenantId, appId, 'running');

    // Clear digest info so it gets re-checked
    await service.updateDigests(tenantId, appId, undefined, undefined);

    res.json({ success: true, data: { appId, status: 'running' } });
  } catch (error) {
    logger.error({ error, appId }, 'Failed to update app');
    res.status(500).json({ success: false, error: 'Failed to update app' });
  }
}

// ─── 7. DELETE /:appId ──────────────────────────────────────────

export async function remove(req: Request, res: Response) {
  if (!requireAdmin(req, res)) return;

  const appId = req.params.appId as string;
  const tenantId = req.auth!.tenantId;

  try {
    const installation = await service.getAppInstallation(tenantId, appId);
    if (!installation) {
      res.status(404).json({ success: false, error: 'App is not installed' });
      return;
    }

    // Try Docker cleanup — don't fail if containers don't exist
    try {
      const appDir = service.getAppDir(appId);
      await dockerService.remove(appId, appDir);
    } catch (dockerErr) {
      logger.warn({ error: dockerErr, appId }, 'Docker cleanup failed during remove (non-critical)');
    }
    await service.removeInstallation(tenantId, appId);

    res.json({ success: true, data: { appId, removed: true } });
  } catch (error) {
    logger.error({ error, appId }, 'Failed to remove app');
    res.status(500).json({ success: false, error: 'Failed to remove app' });
  }
}

// ─── 8. GET /:appId/status ──────────────────────────────────────

export async function getStatus(req: Request, res: Response) {
  try {
    const appId = req.params.appId as string;
    const tenantId = req.auth!.tenantId;

    const installation = await service.getAppInstallation(tenantId, appId);
    if (!installation) {
      res.status(404).json({ success: false, error: 'App is not installed' });
      return;
    }

    // Get live container statuses
    const containerStatuses = installation.containerIds
      ? await dockerService.getContainerStatus(installation.containerIds)
      : [];

    // Get manifest for health check path
    const manifest = service.getManifest(appId);
    let health: { ok: boolean; status?: number; error?: string } | null = null;

    if (manifest) {
      const appService = manifest.services['app'];
      if (appService?.healthCheck?.startsWith('/')) {
        health = await dockerService.checkHealth(installation.assignedPort, appService.healthCheck);
      }
    }

    res.json({
      success: true,
      data: {
        appId,
        status: installation.status,
        assignedPort: installation.assignedPort,
        containers: containerStatuses,
        health,
        installedAt: installation.installedAt,
        updatedAt: installation.updatedAt,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get app status');
    res.status(500).json({ success: false, error: 'Failed to get app status' });
  }
}

// ─── 9. GET /:appId/logs ────────────────────────────────────────

export async function getLogs(req: Request, res: Response) {
  try {
    const appId = req.params.appId as string;
    const tenantId = req.auth!.tenantId;

    const installation = await service.getAppInstallation(tenantId, appId);
    if (!installation) {
      res.status(404).json({ success: false, error: 'App is not installed' });
      return;
    }

    if (!installation.containerIds || installation.containerIds.length === 0) {
      res.json({ success: true, data: { appId, logs: '' } });
      return;
    }

    // Get logs from the primary (first) container
    const logs = await dockerService.getContainerLogs(installation.containerIds[0], 100);

    res.json({ success: true, data: { appId, logs } });
  } catch (error) {
    logger.error({ error }, 'Failed to get app logs');
    res.status(500).json({ success: false, error: 'Failed to get app logs' });
  }
}

// ─── 10. POST /check-updates ───────────────────────────────────────

export async function triggerUpdateCheck(req: Request, res: Response) {
  if (!requireAdmin(req, res)) return;

  try {
    const results = await checkForUpdates();

    const updatesAvailable = results.filter(r => r.updateAvailable);

    res.json({
      success: true,
      data: {
        checked: results.length,
        updatesAvailable: updatesAvailable.length,
        results,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to check for updates');
    res.status(500).json({ success: false, error: 'Failed to check for updates' });
  }
}
