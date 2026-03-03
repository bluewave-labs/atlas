import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../../config/database';
import { appInstallations, appBackups } from '../../db/schema';
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

  const catalogApp = await getCatalogAppById(input.catalogAppId);
  if (!catalogApp) throw new Error(`Catalog app ${input.catalogAppId} not found`);

  const tenant = await getTenantById(tenantId);
  if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

  const manifest = catalogApp.manifest as unknown as AtlasManifest;
  const installationId = crypto.randomUUID();
  const deploymentName = `${manifest.id.replace(/\./g, '-')}-${installationId.slice(0, 8)}`;

  // Clean up any previous failed installation with the same subdomain (from retries)
  const [existing] = await db.select().from(appInstallations)
    .where(and(eq(appInstallations.tenantId, tenantId), eq(appInstallations.subdomain, input.subdomain)))
    .limit(1);

  if (existing) {
    if (existing.status === 'running' || existing.status === 'stopped') {
      throw new Error(`App already installed at subdomain "${input.subdomain}"`);
    }
    // Remove errored/installing installation from a previous attempt
    logger.info({ existingId: existing.id, status: existing.status }, 'Cleaning up previous failed installation');
    try { await removeAppContainer(existing.id, tenant.slug); } catch { /* no container to remove */ }
    await deprovisionAddons(existing.id);
    await db.delete(appInstallations).where(eq(appInstallations.id, existing.id));
  }

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

    // Platform-managed keys that user customEnv must never override
    const PROTECTED_ENV_KEYS = new Set([
      'ATLAS_TENANT_ID', 'ATLAS_INSTALLATION_ID',
      'OIDC_ISSUER', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET', 'OIDC_CALLBACK_PATH',
      'DATABASE_URL', 'REDIS_URL', 'REDIS_PREFIX',
    ]);

    // Apply user customEnv first, then platform keys overwrite — platform always wins
    const safeCustomEnv: Record<string, string> = {};
    for (const [k, v] of Object.entries(input.customEnv ?? {})) {
      if (!PROTECTED_ENV_KEYS.has(k)) {
        safeCustomEnv[k] = v;
      } else {
        logger.warn({ key: k, installationId }, 'Blocked customEnv key — protected by platform');
      }
    }

    const containerEnv: Record<string, string> = {
      ...safeCustomEnv,
      ATLAS_TENANT_ID: tenantId,
      ATLAS_INSTALLATION_ID: installationId,
      OIDC_ISSUER: oidcIssuer,
      OIDC_CLIENT_ID: oidcClientId,
      OIDC_CLIENT_SECRET: oidcClientSecret,
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
    logger.error({ err, installationId }, 'App installation failed — cleaning up partial resources');

    // Clean up any partially-created resources so they don't leak
    try { await removeAppContainer(installationId, tenant.slug); } catch { /* may not exist */ }
    try { await deprovisionAddons(installationId); } catch (cleanupErr) {
      logger.error({ cleanupErr, installationId }, 'Failed to clean up addons after install failure');
    }

    // Mark as error
    await db.update(appInstallations).set({
      status: 'error',
      updatedAt: new Date(),
    }).where(eq(appInstallations.id, installationId));

    throw err;
  }
}

export async function getInstallation(installationId: string) {

  const [inst] = await db.select().from(appInstallations).where(eq(appInstallations.id, installationId)).limit(1);
  return inst ?? null;
}

export async function listRunningInstallationIds(): Promise<string[]> {

  const rows = await db.select({ id: appInstallations.id }).from(appInstallations).where(eq(appInstallations.status, 'running'));
  return rows.map((r) => r.id);
}

export async function listInstallations(tenantId: string) {

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

  const inst = await getInstallation(installationId);
  if (!inst) throw new Error('Installation not found');

  const tenant = await getTenantById(inst.tenantId);
  if (!tenant) throw new Error('Tenant not found');

  // Mark as uninstalling so the UI can show progress
  await db.update(appInstallations).set({
    status: 'uninstalling',
    updatedAt: new Date(),
  }).where(eq(appInstallations.id, installationId));

  const errors: { step: string; error: Error }[] = [];

  // 1. Delete runtime resources (container / K8s deployment)
  try {
    if (env.PLATFORM_RUNTIME === 'docker') {
      await removeAppContainer(installationId, tenant.slug);
    } else if (inst.k8sDeploymentName) {
      await deleteAppResources(tenant.k8sNamespace, inst.k8sDeploymentName, installationId);
    }
  } catch (err) {
    logger.error({ err, installationId }, 'Failed to remove runtime resources during uninstall');
    errors.push({ step: 'runtime', error: err as Error });
  }

  // 2. Deprovision addons (databases, Redis keys)
  try {
    await deprovisionAddons(installationId);
  } catch (err) {
    logger.error({ err, installationId }, 'Failed to deprovision addons during uninstall');
    errors.push({ step: 'addons', error: err as Error });
  }

  // 3. Delete backup records (no cascade — we handle explicitly before deleting installation)
  try {
    await db.delete(appBackups).where(eq(appBackups.installationId, installationId));
  } catch (err) {
    logger.error({ err, installationId }, 'Failed to delete backup records during uninstall');
    errors.push({ step: 'backups', error: err as Error });
  }

  // 4. Only delete installation record if all cleanup succeeded
  //    Otherwise mark as error so admins can investigate and retry
  if (errors.length === 0) {
    await db.delete(appInstallations).where(eq(appInstallations.id, installationId));
    logger.info({ installationId, tenantId: inst.tenantId }, 'App fully uninstalled');
  } else {
    await db.update(appInstallations).set({
      status: 'error',
      updatedAt: new Date(),
    }).where(eq(appInstallations.id, installationId));
    logger.error(
      { installationId, failedSteps: errors.map((e) => e.step) },
      'Uninstall partially failed — installation record preserved for manual cleanup',
    );
    throw new Error(`Uninstall incomplete: failed steps: ${errors.map((e) => e.step).join(', ')}`);
  }
}

export async function updateHealthStatus(installationId: string) {

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

  const [backup] = await db.insert(appBackups).values({
    installationId,
    triggeredBy,
    status: 'pending',
  }).returning();
  return backup;
}

export async function listBackups(installationId: string) {

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
      // Cal.com SSO (OIDC/SAML) uses BoxyHQ Jackson and requires an enterprise
      // license. The OIDC credentials are entered via the admin UI at
      // /settings/security/sso, not via env vars. These vars enable the feature
      // infrastructure, but actual OIDC provider registration needs the UI.
      envVars.SAML_DATABASE_URL = envVars.DATABASE_URL;
      envVars.SAML_CLIENT_SECRET_VERIFIER = crypto.randomBytes(24).toString('base64url');
      envVars.SAML_ADMINS = ''; // managed via Atlas tenant roles
      break;
    }
    case 'com.atlas.nocodb': {
      envVars.NC_PUBLIC_URL = appUrl;
      // NocoDB OIDC (NC_OIDC_* env vars) requires an enterprise/paid license.
      // The community edition only supports email/password and Google OAuth.
      // OIDC SSO will only work if a commercial NocoDB license is available.
      break;
    }
    case 'com.atlas.gitea': {
      envVars.GITEA__server__ROOT_URL = appUrl;
      envVars.GITEA__server__DOMAIN = hostname;
      // Gitea uses its own env var format (GITEA__section__key), not DATABASE_URL
      if (envVars.DATABASE_URL) {
        const dbUrl = new URL(envVars.DATABASE_URL);
        envVars.GITEA__database__DB_TYPE = 'postgres';
        envVars.GITEA__database__HOST = `${dbUrl.hostname}:${dbUrl.port || '5432'}`;
        envVars.GITEA__database__NAME = dbUrl.pathname.slice(1);
        envVars.GITEA__database__USER = decodeURIComponent(dbUrl.username);
        envVars.GITEA__database__PASSWD = decodeURIComponent(dbUrl.password);
        envVars.GITEA__database__SSL_MODE = 'disable';
      }
      // Gitea Redis cache/session/queue configuration
      if (envVars.REDIS_URL) {
        const redisUrl = envVars.REDIS_URL;
        envVars.GITEA__cache__ADAPTER = 'redis';
        envVars.GITEA__cache__HOST = redisUrl;
        envVars.GITEA__session__PROVIDER = 'redis';
        envVars.GITEA__session__PROVIDER_CONFIG = redisUrl;
        envVars.GITEA__queue__TYPE = 'redis';
        envVars.GITEA__queue__CONN_STR = redisUrl;
      }
      // Gitea OIDC: auth sources are stored in DB, not app.ini, so they can't
      // be set via GITEA__* env vars. The provisioning engine must run
      // `gitea admin auth add-oauth` after the container is ready.
      // These env vars control the OAuth2 client behavior once a source exists.
      envVars.GITEA__oauth2_client__ENABLE_AUTO_REGISTRATION = 'true';
      envVars.GITEA__oauth2_client__USERNAME = 'preferred_username';
      envVars.GITEA__oauth2_client__OPENID_CONNECT_SCOPES = 'openid email profile';
      envVars.GITEA__oauth2_client__ACCOUNT_LINKING = 'auto';
      envVars.GITEA__oauth2_client__REGISTER_EMAIL_CONFIRM = 'false';
      envVars.GITEA__service__ALLOW_ONLY_EXTERNAL_REGISTRATION = 'false';
      envVars.GITEA__openid__ENABLE_OPENID_SIGNIN = 'true';
      // Pass OIDC details so the provisioning init script can register the source
      envVars.ATLAS_OIDC_PROVIDER_NAME = 'Atlas';
      envVars.ATLAS_OIDC_DISCOVERY_URL = `${envVars.OIDC_ISSUER}/.well-known/openid-configuration`;
      break;
    }
    default:
      break;
  }
}
