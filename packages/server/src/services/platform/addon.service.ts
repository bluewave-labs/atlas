import { eq } from 'drizzle-orm';
import pg from 'pg';
import { getPlatformDb } from '../../config/platform-database';
import { appAddons } from '../../db/schema-platform';
import { env } from '../../config/env';
import { encrypt } from '../../utils/crypto';
import { logger } from '../../utils/logger';
import crypto from 'node:crypto';
import type { AtlasManifest } from '@atlasmail/shared';

interface ProvisionedAddon {
  addonType: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

/**
 * Provision all addons required by the manifest.
 * For PostgreSQL: creates a database and user on the shared cluster.
 * For Redis: creates a keyspace prefix (shared Redis, no isolation beyond prefix).
 */
export async function provisionAddons(
  installationId: string,
  manifest: AtlasManifest,
  tenantSlug: string,
): Promise<ProvisionedAddon[]> {
  const provisioned: ProvisionedAddon[] = [];

  if (manifest.addons.postgresql) {
    const addon = await provisionPostgresql(installationId, tenantSlug);
    provisioned.push(addon);
  }

  if (manifest.addons.redis) {
    const addon = await provisionRedis(installationId, tenantSlug);
    provisioned.push(addon);
  }

  // SMTP and S3 are platform-level shared services — just inject env vars, no per-app provisioning
  return provisioned;
}

async function provisionPostgresql(installationId: string, tenantSlug: string): Promise<ProvisionedAddon> {
  if (!env.ADDON_PG_ADMIN_URL) {
    throw new Error('ADDON_PG_ADMIN_URL not configured — cannot provision PostgreSQL addon');
  }

  const dbName = `app_${tenantSlug}_${installationId.slice(0, 8)}`.replace(/-/g, '_');
  const username = `user_${installationId.slice(0, 12)}`.replace(/-/g, '_');
  const password = crypto.randomBytes(24).toString('base64url');

  const adminClient = new pg.Client({ connectionString: env.ADDON_PG_ADMIN_URL });
  await adminClient.connect();

  try {
    // Create user + database (idempotent via IF NOT EXISTS)
    // Use pg.escapeIdentifier/escapeLiteral for DDL to prevent SQL injection
    const safeUser = pg.escapeIdentifier(username);
    const safePassword = pg.escapeLiteral(password);
    const safeDbName = pg.escapeIdentifier(dbName);

    await adminClient.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = ${pg.escapeLiteral(username)}) THEN
          CREATE ROLE ${safeUser} LOGIN PASSWORD ${safePassword};
        END IF;
      END $$;
    `);
    await adminClient.query(`CREATE DATABASE ${safeDbName} OWNER ${safeUser}`).catch((err) => {
      if ((err as any).code !== '42P04') throw err; // 42P04 = database already exists
    });
    await adminClient.query(`GRANT ALL PRIVILEGES ON DATABASE ${safeDbName} TO ${safeUser}`);
  } finally {
    await adminClient.end();
  }

  // Parse admin URL for host/port
  const url = new URL(env.ADDON_PG_ADMIN_URL);
  // For Docker runtime, app containers reach postgres via the Docker network
  // hostname ("postgres") rather than localhost
  const host = env.PLATFORM_RUNTIME === 'docker' ? 'postgres' : url.hostname;
  const port = parseInt(url.port || '5432', 10);

  // Store addon record
  const db = getPlatformDb();
  await db.insert(appAddons).values({
    installationId,
    addonType: 'postgresql',
    host,
    port,
    database: dbName,
    username,
    passwordEncrypted: encrypt(password),
  });

  logger.info({ installationId, dbName }, 'PostgreSQL addon provisioned');

  return { addonType: 'postgresql', host, port, database: dbName, username, password };
}

async function provisionRedis(installationId: string, tenantSlug: string): Promise<ProvisionedAddon> {
  if (!env.ADDON_REDIS_URL) {
    throw new Error('ADDON_REDIS_URL not configured — cannot provision Redis addon');
  }

  const url = new URL(env.ADDON_REDIS_URL);
  // For Docker runtime, app containers reach redis via Docker network hostname
  const host = env.PLATFORM_RUNTIME === 'docker' ? 'redis' : url.hostname;
  const port = parseInt(url.port || '6379', 10);
  const prefix = `app:${tenantSlug}:${installationId.slice(0, 8)}:`;

  const db = getPlatformDb();
  await db.insert(appAddons).values({
    installationId,
    addonType: 'redis',
    host,
    port,
    database: prefix, // use database field for key prefix
    username: '',
    passwordEncrypted: url.password ? encrypt(url.password) : null,
  });

  logger.info({ installationId, prefix }, 'Redis addon provisioned');

  return {
    addonType: 'redis',
    host,
    port,
    database: prefix,
    username: '',
    password: url.password || '',
  };
}

export async function getAddonsForInstallation(installationId: string) {
  const db = getPlatformDb();
  return db.select().from(appAddons).where(eq(appAddons.installationId, installationId));
}

/**
 * Deprovision all addons for an installation (cleanup on uninstall).
 * Drops the database and user for PostgreSQL addons.
 */
export async function deprovisionAddons(installationId: string) {
  const db = getPlatformDb();
  const addons = await getAddonsForInstallation(installationId);

  for (const addon of addons) {
    if (addon.addonType === 'postgresql' && env.ADDON_PG_ADMIN_URL && addon.database && addon.username) {
      const adminClient = new pg.Client({ connectionString: env.ADDON_PG_ADMIN_URL });
      await adminClient.connect();
      try {
        // Terminate existing connections (parameterized query for datname)
        await adminClient.query(
          'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
          [addon.database],
        );
        await adminClient.query(`DROP DATABASE IF EXISTS ${pg.escapeIdentifier(addon.database)}`);
        await adminClient.query(`DROP ROLE IF EXISTS ${pg.escapeIdentifier(addon.username)}`);
        logger.info({ installationId, database: addon.database }, 'PostgreSQL addon deprovisioned');
      } catch (err) {
        logger.error({ err, installationId }, 'Failed to deprovision PostgreSQL addon');
      } finally {
        await adminClient.end();
      }
    }
  }

  // Remove addon records
  await db.delete(appAddons).where(eq(appAddons.installationId, installationId));
}
