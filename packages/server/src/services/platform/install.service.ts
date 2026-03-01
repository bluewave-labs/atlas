import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';
import { getPlatformDb } from '../../config/platform-database';
import { appInstallations, appBackups } from '../../db/schema-platform';
import { getCatalogAppById } from './catalog.service';
import { getTenantById } from './tenant.service';
import { provisionAddons, deprovisionAddons } from './addon.service';
import { deployApp, createIngressRoute, deleteAppResources, scaleDeployment, restartDeployment, checkDeploymentHealth } from './k8s.service';
import { deployAppContainer, removeAppContainer, startAppContainer, stopAppContainer, restartAppContainer, getContainerHealth } from './docker.service';
import { encrypt } from '../../utils/crypto';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import type { AtlasManifest, InstallAppInput } from '@atlasmail/shared';

/**
 * Install an app for a tenant. Called from the BullMQ worker (async).
 * Steps: provision DB → create K8s resources → register OIDC → poll health.
 */
export async function installApp(tenantId: string, input: InstallAppInput) {
  const db = getPlatformDb();
  const catalogApp = await getCatalogAppById(input.catalogAppId);
  if (!catalogApp) throw new Error(`Catalog app ${input.catalogAppId} not found`);

  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

  const manifest = catalogApp.manifest as unknown as AtlasManifest;
  const installationId = crypto.randomUUID();
  const deploymentName = `${manifest.id.replace(/\./g, '-')}-${installationId.slice(0, 8)}`;

  // Create installation record (status: installing)
  const [installation] = await db.insert(appInstallations).values({
    id: installationId,
    tenantId,
    catalogAppId: input.catalogAppId,
    installedVersion: catalogApp.currentVersion,
    status: 'installing',
    subdomain: input.subdomain,
    k8sDeploymentName: deploymentName,
    customEnv: input.customEnv ?? {},
  }).returning();

  try {
    // 1. Provision addons
    const addons = await provisionAddons(installationId, manifest, tenant.slug);
    const addonRefs: Record<string, string> = {};
    for (const addon of addons) {
      addonRefs[addon.addonType] = addon.database;
    }

    // 2. Build env vars for container
    const isDocker = env.PLATFORM_RUNTIME === 'docker';
    const hostname = isDocker
      ? `${input.subdomain}.${tenant.slug}.localhost`
      : `${input.subdomain}.${tenant.slug}.atlas.so`;
    const oidcClientId = `atlas-${manifest.id}-${installationId.slice(0, 8)}`;
    const oidcClientSecret = crypto.randomBytes(32).toString('base64url');

    // For Docker containers, OIDC issuer must use host.docker.internal so the
    // container can reach the Atlas server running on the host machine.
    const oidcIssuer = isDocker
      ? `http://host.docker.internal:${env.PORT}/oidc/tenants/${tenant.slug}`
      : `${env.PLATFORM_PUBLIC_URL || env.SERVER_PUBLIC_URL}/oidc/tenants/${tenant.slug}`;

    const containerEnv: Record<string, string> = {
      ATLAS_TENANT_ID: tenantId,
      ATLAS_INSTALLATION_ID: installationId,
      OIDC_ISSUER: oidcIssuer,
      OIDC_CLIENT_ID: oidcClientId,
      OIDC_CLIENT_SECRET: oidcClientSecret,
      ...(input.customEnv ?? {}),
    };

    // Add addon connection strings
    for (const addon of addons) {
      if (addon.addonType === 'postgresql') {
        containerEnv.DATABASE_URL = `postgresql://${addon.username}:${addon.password}@${addon.host}:${addon.port}/${addon.database}`;
      }
      if (addon.addonType === 'redis') {
        containerEnv.REDIS_URL = `redis://${addon.host}:${addon.port}`;
        containerEnv.REDIS_PREFIX = addon.database; // key prefix
      }
    }

    // Inject OIDC callback path from manifest so the OIDC provider uses the correct redirect_uri
    if (manifest.sso?.oidcCallbackPath) {
      containerEnv.OIDC_CALLBACK_PATH = manifest.sso.oidcCallbackPath;
    }

    // App-specific env vars (some apps need extra configuration beyond generic OIDC/DB)
    applyAppSpecificEnv(manifest.id, containerEnv, hostname, oidcClientId, oidcClientSecret);

    // 3. Deploy app
    if (isDocker) {
      await deployAppContainer({
        installationId,
        manifest,
        envVars: containerEnv,
        subdomain: input.subdomain,
        tenantSlug: tenant.slug,
      });
    } else {
      await deployApp({
        namespace: tenant.k8sNamespace,
        deploymentName,
        manifest,
        envVars: containerEnv,
        installationId,
      });

      // 4. Create IngressRoute (K8s only — Docker uses Traefik labels)
      const serviceName = `${deploymentName}-svc`;
      await createIngressRoute({
        namespace: tenant.k8sNamespace,
        installationId,
        hostname,
        serviceName,
        servicePort: manifest.runtime.httpPort,
        tlsSecretName: `${tenant.k8sNamespace}-tls`,
      });
    }

    // 5. Update installation with OIDC + addon refs
    const [updated] = await db.update(appInstallations).set({
      oidcClientId,
      oidcClientSecret: encrypt(oidcClientSecret),
      addonRefs,
      status: 'running',
      updatedAt: new Date(),
    }).where(eq(appInstallations.id, installationId)).returning();

    logger.info({ installationId, tenantId, app: manifest.id }, 'App installed successfully');
    return updated;
  } catch (err) {
    // Mark as error
    await db.update(appInstallations).set({
      status: 'error',
      updatedAt: new Date(),
    }).where(eq(appInstallations.id, installationId));

    logger.error({ err, installationId }, 'App installation failed');
    throw err;
  }
}

export async function getInstallation(installationId: string) {
  const db = getPlatformDb();
  const [inst] = await db.select().from(appInstallations).where(eq(appInstallations.id, installationId)).limit(1);
  return inst ?? null;
}

export async function listRunningInstallationIds(): Promise<string[]> {
  const db = getPlatformDb();
  const rows = await db.select({ id: appInstallations.id }).from(appInstallations).where(eq(appInstallations.status, 'running'));
  return rows.map((r) => r.id);
}

export async function listInstallations(tenantId: string) {
  const db = getPlatformDb();
  return db.select().from(appInstallations).where(eq(appInstallations.tenantId, tenantId));
}

export async function startApp(installationId: string) {
  const inst = await getInstallation(installationId);
  if (!inst || !inst.k8sDeploymentName) throw new Error('Installation not found');

  if (env.PLATFORM_RUNTIME === 'docker') {
    await startAppContainer(installationId);
  } else {
    const tenant = await getTenantById(inst.tenantId);
    if (!tenant) throw new Error('Tenant not found');
    await scaleDeployment(tenant.k8sNamespace, inst.k8sDeploymentName, 1);
  }

  const db = getPlatformDb();
  await db.update(appInstallations).set({ status: 'running', updatedAt: new Date() }).where(eq(appInstallations.id, installationId));
}

export async function stopApp(installationId: string) {
  const inst = await getInstallation(installationId);
  if (!inst || !inst.k8sDeploymentName) throw new Error('Installation not found');

  if (env.PLATFORM_RUNTIME === 'docker') {
    await stopAppContainer(installationId);
  } else {
    const tenant = await getTenantById(inst.tenantId);
    if (!tenant) throw new Error('Tenant not found');
    await scaleDeployment(tenant.k8sNamespace, inst.k8sDeploymentName, 0);
  }

  const db = getPlatformDb();
  await db.update(appInstallations).set({ status: 'stopped', updatedAt: new Date() }).where(eq(appInstallations.id, installationId));
}

export async function restartApp(installationId: string) {
  const inst = await getInstallation(installationId);
  if (!inst || !inst.k8sDeploymentName) throw new Error('Installation not found');

  if (env.PLATFORM_RUNTIME === 'docker') {
    await restartAppContainer(installationId);
  } else {
    const tenant = await getTenantById(inst.tenantId);
    if (!tenant) throw new Error('Tenant not found');
    await restartDeployment(tenant.k8sNamespace, inst.k8sDeploymentName);
  }
}

export async function uninstallApp(installationId: string) {
  const db = getPlatformDb();
  const inst = await getInstallation(installationId);
  if (!inst) throw new Error('Installation not found');

  const tenant = await getTenantById(inst.tenantId);
  if (!tenant) throw new Error('Tenant not found');

  // 1. Delete runtime resources
  if (env.PLATFORM_RUNTIME === 'docker') {
    await removeAppContainer(installationId);
  } else if (inst.k8sDeploymentName) {
    await deleteAppResources(tenant.k8sNamespace, inst.k8sDeploymentName, installationId);
  }

  // 2. Deprovision addons
  await deprovisionAddons(installationId);

  // 3. Delete installation record (cascades to addons and backups)
  await db.delete(appInstallations).where(eq(appInstallations.id, installationId));

  logger.info({ installationId, tenantId: inst.tenantId }, 'App uninstalled');
}

export async function updateHealthStatus(installationId: string) {
  const db = getPlatformDb();
  const inst = await getInstallation(installationId);
  if (!inst || !inst.k8sDeploymentName || inst.status !== 'running') return;

  let health: 'healthy' | 'unhealthy' | 'unknown';

  if (env.PLATFORM_RUNTIME === 'docker') {
    health = await getContainerHealth(installationId);
  } else {
    const tenant = await getTenantById(inst.tenantId);
    if (!tenant) return;
    health = await checkDeploymentHealth(tenant.k8sNamespace, inst.k8sDeploymentName);
  }

  await db.update(appInstallations).set({
    lastHealthStatus: health,
    updatedAt: new Date(),
  }).where(eq(appInstallations.id, installationId));
}

export async function createBackupRecord(installationId: string, triggeredBy: string) {
  const db = getPlatformDb();
  const [backup] = await db.insert(appBackups).values({
    installationId,
    triggeredBy,
    status: 'pending',
  }).returning();
  return backup;
}

export async function listBackups(installationId: string) {
  const db = getPlatformDb();
  return db.select().from(appBackups).where(eq(appBackups.installationId, installationId));
}

// ---------------------------------------------------------------------------
// App-specific env var overrides
// ---------------------------------------------------------------------------

function applyAppSpecificEnv(
  manifestId: string,
  envVars: Record<string, string>,
  hostname: string,
  oidcClientId: string,
  oidcClientSecret: string,
) {
  const protocol = env.PLATFORM_RUNTIME === 'docker' ? 'http' : 'https';
  const appUrl = `${protocol}://${hostname}`;

  switch (manifestId) {
    case 'com.atlas.calcom': {
      // Cal.com uses NextAuth and needs specific env var names
      envVars.NEXTAUTH_SECRET = crypto.randomBytes(32).toString('base64url');
      envVars.NEXTAUTH_URL = appUrl;
      envVars.NEXT_PUBLIC_WEBAPP_URL = appUrl;
      envVars.CALENDSO_ENCRYPTION_KEY = crypto.randomBytes(24).toString('base64url');
      // Cal.com OIDC/SAML SSO uses these env vars
      envVars.SAML_DATABASE_URL = envVars.DATABASE_URL;
      envVars.SAML_CLIENT_SECRET_VERIFIER = crypto.randomBytes(24).toString('base64url');
      envVars.SAML_ADMINS = ''; // managed via Atlas tenant roles
      break;
    }
    case 'com.atlas.nocodb': {
      envVars.NC_PUBLIC_URL = appUrl;
      break;
    }
    case 'com.atlas.gitea': {
      envVars.GITEA__server__ROOT_URL = appUrl;
      envVars.GITEA__server__DOMAIN = hostname;
      break;
    }
    default:
      break;
  }
}
