import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from './env';
import { logger } from '../utils/logger';
import * as schema from '../db/schema-platform';

let platformDb: ReturnType<typeof drizzle<typeof schema>> | null = null;
let pool: pg.Pool | null = null;

export function getPlatformDb() {
  if (!env.DATABASE_PLATFORM_URL) {
    throw new Error('DATABASE_PLATFORM_URL not configured — platform features unavailable');
  }

  if (!platformDb) {
    pool = new pg.Pool({
      connectionString: env.DATABASE_PLATFORM_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
    });

    pool.on('error', (err) => {
      logger.error({ err }, 'Platform PostgreSQL pool error');
    });

    platformDb = drizzle(pool, { schema });
    logger.info('Platform PostgreSQL connection established');
  }

  return platformDb;
}

export async function closePlatformDb() {
  if (pool) {
    await pool.end();
    pool = null;
    platformDb = null;
    logger.info('Platform PostgreSQL connection closed');
  }
}

/**
 * Run platform schema migrations via raw SQL.
 * Uses CREATE TABLE IF NOT EXISTS for idempotency (same pattern as SQLite database.ts).
 */
export async function migratePlatformSchema() {
  if (!env.DATABASE_PLATFORM_URL) return;

  const client = new pg.Client({ connectionString: env.DATABASE_PLATFORM_URL });
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug VARCHAR(63) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        plan VARCHAR(50) NOT NULL DEFAULT 'starter',
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        owner_id UUID NOT NULL,
        k8s_namespace VARCHAR(63) UNIQUE NOT NULL,
        quota_cpu INTEGER NOT NULL DEFAULT 2000,
        quota_memory_mb INTEGER NOT NULL DEFAULT 4096,
        quota_storage_mb INTEGER NOT NULL DEFAULT 20480,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS tenant_members (
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS tenant_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'member',
        invited_by UUID NOT NULL,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        accepted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, email)
      );

      CREATE TABLE IF NOT EXISTS app_catalog (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        manifest_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        tags JSONB NOT NULL DEFAULT '[]',
        icon_url TEXT,
        color VARCHAR(20),
        description TEXT,
        current_version VARCHAR(100) NOT NULL,
        manifest JSONB NOT NULL,
        min_plan VARCHAR(50) NOT NULL DEFAULT 'starter',
        is_published BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS app_installations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        catalog_app_id UUID NOT NULL REFERENCES app_catalog(id),
        installed_version VARCHAR(100) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'installing',
        subdomain VARCHAR(63) NOT NULL,
        k8s_deployment_name VARCHAR(253),
        oidc_client_id VARCHAR(255),
        oidc_client_secret TEXT,
        addon_refs JSONB NOT NULL DEFAULT '{}',
        last_health_status VARCHAR(50),
        custom_env JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(tenant_id, subdomain)
      );

      CREATE TABLE IF NOT EXISTS app_addons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        installation_id UUID NOT NULL REFERENCES app_installations(id) ON DELETE CASCADE,
        addon_type VARCHAR(50) NOT NULL,
        host VARCHAR(255) NOT NULL,
        port INTEGER NOT NULL,
        database VARCHAR(255),
        username VARCHAR(255),
        password_encrypted TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS app_user_assignments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        installation_id UUID NOT NULL REFERENCES app_installations(id) ON DELETE CASCADE,
        user_id UUID NOT NULL,
        app_role VARCHAR(50) NOT NULL DEFAULT 'member',
        assigned_by UUID NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(installation_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS app_backups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        installation_id UUID NOT NULL REFERENCES app_installations(id) ON DELETE CASCADE,
        triggered_by VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'pending',
        storage_key TEXT,
        size_bytes BIGINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      );
    `);

    // Create indexes idempotently
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_tenants_owner ON tenants(owner_id)',
      'CREATE INDEX IF NOT EXISTS idx_tenant_invitations_token ON tenant_invitations(token)',
      'CREATE INDEX IF NOT EXISTS idx_app_catalog_category ON app_catalog(category)',
      'CREATE INDEX IF NOT EXISTS idx_installations_tenant ON app_installations(tenant_id)',
      'CREATE INDEX IF NOT EXISTS idx_addons_installation ON app_addons(installation_id)',
      'CREATE INDEX IF NOT EXISTS idx_app_assignments_installation ON app_user_assignments(installation_id)',
      'CREATE INDEX IF NOT EXISTS idx_app_assignments_user ON app_user_assignments(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_backups_installation ON app_backups(installation_id)',
    ];

    for (const idx of indexes) {
      await client.query(idx);
    }

    logger.info('Platform schema migration completed');
  } finally {
    await client.end();
  }
}
