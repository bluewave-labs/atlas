import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../../config/database';
import { appInstallations, provisioningLog, users } from '../../db/schema';
import { getCatalogAppById } from './catalog.service';
import { getTenantById } from './tenant.service';
import { encrypt, decrypt } from '../../utils/crypto';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import type { AtlasManifest, ProvisioningAction } from '@atlasmail/shared';
import type { AppProvisioningAdapter, ProvisioningContext, AdapterSetupContext } from './adapters/base.adapter';
import { GiteaAdapter } from './adapters/gitea.adapter';
import { NocoDBAdapter } from './adapters/nocodb.adapter';
import { CalcomAdapter } from './adapters/calcom.adapter';

// ─── Adapter Registry ────────────────────────────────────────────────

const adapters: Record<string, AppProvisioningAdapter> = {
  gitea: new GiteaAdapter(),
  nocodb: new NocoDBAdapter(),
  calcom: new CalcomAdapter(),
};

function resolveAdapter(name: string): AppProvisioningAdapter {
  const adapter = adapters[name];
  if (!adapter) throw new Error(`Unknown provisioning adapter: ${name}`);
  return adapter;
}

// ─── URL Resolution ──────────────────────────────────────────────────

function getAppInternalUrl(
  installation: { id: string; k8sDeploymentName: string | null },
  tenant: { k8sNamespace: string; slug: string },
  manifest: AtlasManifest,
): string {
  if (env.PLATFORM_RUNTIME === 'docker') {
    const containerName = `atlas-app-${installation.id.replace(/-/g, '')}`;
    return `http://${containerName}:${manifest.runtime.httpPort}`;
  }
  // K8s: service name is deployment name + '-svc'
  return `http://${installation.k8sDeploymentName}-svc.${tenant.k8sNamespace}.svc.cluster.local:${manifest.runtime.httpPort}`;
}

// ─── Role Mapping ────────────────────────────────────────────────────

function mapRole(atlasRole: string, roleMapping: Record<string, string>): string {
  return roleMapping[atlasRole] || roleMapping['member'] || atlasRole;
}

// ─── Load Context ────────────────────────────────────────────────────

async function loadInstallationContext(installationId: string) {
  const [inst] = await db.select().from(appInstallations)
    .where(eq(appInstallations.id, installationId))
    .limit(1);
  if (!inst) throw new Error(`Installation ${installationId} not found`);

  const catalogApp = await getCatalogAppById(inst.catalogAppId);
  if (!catalogApp) throw new Error(`Catalog app ${inst.catalogAppId} not found`);

  const manifest = catalogApp.manifest as unknown as AtlasManifest;
  if (!manifest.provisioning) throw new Error(`App ${manifest.id} has no provisioning config`);

  const tenant = await getTenantById(inst.tenantId);
  if (!tenant) throw new Error(`Tenant ${inst.tenantId} not found`);

  return { inst, manifest, tenant };
}

async function getUserInfo(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error(`User ${userId} not found`);
  return { email: user.email || '', name: user.name || '' };
}

// ─── Core Enqueue Functions ──────────────────────────────────────────

export async function enqueueProvision(installationId: string, userId: string, appRole: string) {
  try {
    const { inst, manifest } = await loadInstallationContext(installationId);
    if (!inst.provisioningEnabled || !manifest.provisioning) {
      logger.debug({ installationId }, 'Provisioning not enabled — skipping');
      return;
    }

    const nativeRole = mapRole(appRole, manifest.provisioning.roleMapping);

    const [logEntry] = await db.insert(provisioningLog).values({
      installationId,
      userId,
      action: 'provision',
      status: 'pending',
      appRole: nativeRole,
    }).returning();

    const { addProvisioningJob } = await import('../../jobs/provisioning.worker');
    await addProvisioningJob({
      action: 'provision',
      installationId,
      userId,
      appRole: nativeRole,
      logEntryId: logEntry.id,
    });

    logger.info({ installationId, userId, appRole: nativeRole }, 'Provisioning job enqueued');
  } catch (err) {
    logger.error({ err, installationId, userId }, 'Failed to enqueue provisioning job');
  }
}

export async function enqueueRoleUpdate(installationId: string, userId: string, newRole: string) {
  try {
    const { inst, manifest } = await loadInstallationContext(installationId);
    if (!inst.provisioningEnabled || !manifest.provisioning) {
      logger.debug({ installationId }, 'Provisioning not enabled — skipping role update');
      return;
    }

    const nativeRole = mapRole(newRole, manifest.provisioning.roleMapping);

    const [logEntry] = await db.insert(provisioningLog).values({
      installationId,
      userId,
      action: 'update_role',
      status: 'pending',
      appRole: nativeRole,
    }).returning();

    const { addProvisioningJob } = await import('../../jobs/provisioning.worker');
    await addProvisioningJob({
      action: 'update_role',
      installationId,
      userId,
      appRole: nativeRole,
      logEntryId: logEntry.id,
    });

    logger.info({ installationId, userId, appRole: nativeRole }, 'Role update job enqueued');
  } catch (err) {
    logger.error({ err, installationId, userId }, 'Failed to enqueue role update job');
  }
}

export async function enqueueDeprovision(installationId: string, userId: string) {
  try {
    const { inst, manifest } = await loadInstallationContext(installationId);
    if (!inst.provisioningEnabled || !manifest.provisioning) {
      logger.debug({ installationId }, 'Provisioning not enabled — skipping deprovision');
      return;
    }

    const [logEntry] = await db.insert(provisioningLog).values({
      installationId,
      userId,
      action: 'deprovision',
      status: 'pending',
    }).returning();

    const { addProvisioningJob } = await import('../../jobs/provisioning.worker');
    await addProvisioningJob({
      action: 'deprovision',
      installationId,
      userId,
      logEntryId: logEntry.id,
    });

    logger.info({ installationId, userId }, 'Deprovision job enqueued');
  } catch (err) {
    logger.error({ err, installationId, userId }, 'Failed to enqueue deprovision job');
  }
}

export async function enqueueDeprovisionFromAllApps(tenantId: string, userId: string) {
  const installations = await db.select().from(appInstallations)
    .where(and(
      eq(appInstallations.tenantId, tenantId),
      eq(appInstallations.provisioningEnabled, true),
    ));

  for (const inst of installations) {
    await enqueueDeprovision(inst.id, userId);
  }
}

// ─── Token Setup ─────────────────────────────────────────────────────

export async function setupProvisioningToken(installationId: string) {
  try {
    const { inst, manifest, tenant } = await loadInstallationContext(installationId);
    if (!manifest.provisioning) {
      logger.debug({ installationId }, 'No provisioning config in manifest — skipping token setup');
      return;
    }

    const adapter = resolveAdapter(manifest.provisioning.adapter);
    const appBaseUrl = getAppInternalUrl(inst, tenant, manifest);

    // Get the installer's info for admin user creation
    const adminEmail = `admin@${tenant.slug}.atlas.local`;
    const adminName = 'Atlas Admin';

    const setupCtx: AdapterSetupContext = {
      installationId,
      appBaseUrl,
      adminApiBasePath: manifest.provisioning.adminApiBasePath,
      adminEmail,
      adminName,
      envVars: (inst.customEnv || {}) as Record<string, string>,
    };

    const token = await adapter.setupAdminToken(setupCtx);

    await db.update(appInstallations).set({
      provisioningApiToken: encrypt(token),
      provisioningEnabled: true,
      updatedAt: new Date(),
    }).where(eq(appInstallations.id, installationId));

    logger.info({ installationId, adapter: manifest.provisioning.adapter }, 'Provisioning token set up successfully');
  } catch (err) {
    logger.warn({ err, installationId }, 'Failed to set up provisioning token — provisioning will be unavailable for this app');
  }
}

// ─── Log & Retry ─────────────────────────────────────────────────────

export async function getProvisioningLog(installationId: string, limit = 50, offset = 0) {
  return db.select().from(provisioningLog)
    .where(eq(provisioningLog.installationId, installationId))
    .orderBy(desc(provisioningLog.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function retryFailedProvisioning(logEntryId: string, installationId?: string) {
  const [entry] = await db.select().from(provisioningLog)
    .where(eq(provisioningLog.id, logEntryId))
    .limit(1);

  if (!entry) throw new Error('Log entry not found');

  // Verify the log entry belongs to the expected installation (prevents IDOR)
  if (installationId && entry.installationId !== installationId) {
    throw new Error('Log entry not found');
  }

  if (entry.status !== 'failed') throw new Error('Can only retry failed entries');

  // Reset to pending
  await db.update(provisioningLog).set({
    status: 'pending',
    errorMessage: null,
  }).where(eq(provisioningLog.id, logEntryId));

  const { addProvisioningJob } = await import('../../jobs/provisioning.worker');
  await addProvisioningJob({
    action: entry.action as ProvisioningAction,
    installationId: entry.installationId,
    userId: entry.userId,
    appRole: entry.appRole || undefined,
    logEntryId: entry.id,
  });

  logger.info({ logEntryId, action: entry.action }, 'Retrying failed provisioning job');
}

// ─── Reconciliation ──────────────────────────────────────────────────

export async function reconcileInstallation(installationId: string) {
  const { inst, manifest, tenant } = await loadInstallationContext(installationId);
  if (!inst.provisioningEnabled || !inst.provisioningApiToken || !manifest.provisioning) {
    throw new Error('Provisioning not enabled for this installation');
  }

  const adapter = resolveAdapter(manifest.provisioning.adapter);
  const appBaseUrl = getAppInternalUrl(inst, tenant, manifest);
  const token = decrypt(inst.provisioningApiToken);

  // Get all Atlas assignments for this installation
  const { listAppAssignments } = await import('./assignment.service');
  const assignments = await listAppAssignments(installationId);

  const discrepancies: Array<{ userId: string; email: string; issue: string }> = [];

  for (const assignment of assignments) {
    const userInfo = await getUserInfo(assignment.userId);
    const nativeRole = mapRole(assignment.appRole, manifest.provisioning.roleMapping);

    const ctx: ProvisioningContext = {
      installationId,
      appBaseUrl,
      adminApiToken: token,
      adminApiBasePath: manifest.provisioning.adminApiBasePath,
      userId: assignment.userId,
      userEmail: userInfo.email,
      userName: userInfo.name,
      appRole: nativeRole,
    };

    try {
      const result = await adapter.getUser(ctx);
      if (!result.exists) {
        discrepancies.push({ userId: assignment.userId, email: userInfo.email, issue: 'not_provisioned' });
      } else if (result.currentRole !== nativeRole) {
        discrepancies.push({ userId: assignment.userId, email: userInfo.email, issue: `role_mismatch: expected=${nativeRole}, actual=${result.currentRole}` });
      }
    } catch (err) {
      discrepancies.push({ userId: assignment.userId, email: userInfo.email, issue: `check_failed: ${(err as Error).message}` });
    }
  }

  return { total: assignments.length, discrepancies };
}

// ─── Process Job (called by worker) ─────────────────────────────────

export async function processProvisioningJob(data: {
  action: ProvisioningAction;
  installationId: string;
  userId: string;
  appRole?: string;
  logEntryId: string;
}) {
  const { action, installationId, userId, appRole, logEntryId } = data;

  const { inst, manifest, tenant } = await loadInstallationContext(installationId);
  if (!inst.provisioningApiToken || !manifest.provisioning) {
    throw new Error('Provisioning not configured');
  }

  const adapter = resolveAdapter(manifest.provisioning.adapter);
  const appBaseUrl = getAppInternalUrl(inst, tenant, manifest);
  const token = decrypt(inst.provisioningApiToken);
  const userInfo = await getUserInfo(userId);

  const ctx: ProvisioningContext = {
    installationId,
    appBaseUrl,
    adminApiToken: token,
    adminApiBasePath: manifest.provisioning.adminApiBasePath,
    userId,
    userEmail: userInfo.email,
    userName: userInfo.name,
    appRole: appRole || '',
  };

  try {
    switch (action) {
      case 'provision':
        await adapter.provisionUser(ctx);
        break;
      case 'update_role':
        await adapter.updateUserRole(ctx);
        break;
      case 'deprovision':
        await adapter.deprovisionUser(ctx);
        break;
      default:
        throw new Error(`Unknown provisioning action: ${action}`);
    }

    // Mark success
    await db.update(provisioningLog).set({
      status: 'success',
      completedAt: new Date(),
      attempts: sql`${provisioningLog.attempts} + 1`,
    }).where(eq(provisioningLog.id, logEntryId));

    logger.info({ logEntryId, action, installationId, userId }, 'Provisioning job completed successfully');
  } catch (err) {
    const errorMessage = (err as Error).message;

    // Special cases: 401 likely means token is invalid
    if (errorMessage.includes('401')) {
      logger.warn({ installationId }, 'Provisioning API returned 401 — token may be expired or invalid');
    }

    // Update log with error
    await db.update(provisioningLog).set({
      status: 'failed',
      errorMessage,
      attempts: sql`${provisioningLog.attempts} + 1`,
    }).where(eq(provisioningLog.id, logEntryId));

    throw err; // Re-throw so BullMQ can retry
  }
}
