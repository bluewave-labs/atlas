/**
 * Global setup for integration tests — runs ONCE before all test files.
 * Creates the test database and runs migrations.
 */
import pg from 'pg';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/atlas_test';

export async function setup() {
  // Set env vars for the test run
  process.env.DATABASE_URL = TEST_DB_URL;
  process.env.JWT_SECRET = 'integration-test-jwt-secret-32chars!!';
  process.env.JWT_REFRESH_SECRET = 'integration-test-refresh-secret-32ch!!';
  process.env.TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  process.env.NODE_ENV = 'test';

  // Run migrations
  const client = new pg.Client({ connectionString: TEST_DB_URL });
  await client.connect();
  try {
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  } finally {
    await client.end();
  }

  // Import and run the app's migrations
  const { runMigrations } = await import('../../src/db/migrate');
  await runMigrations();

  // Drop legacy `account_id` columns from CRM tables that predate the
  // tenant-only model. The current schema (schema.ts + migrate.ts) only
  // tracks `tenant_id`, but test databases created from older snapshots
  // still carry a NOT NULL `account_id`, which causes inserts to fail.
  const cleanupClient = new pg.Client({ connectionString: TEST_DB_URL });
  await cleanupClient.connect();
  try {
    const legacyTables = [
      'crm_companies',
      'crm_contacts',
      'crm_deal_stages',
      'crm_deals',
      'crm_activities',
      'crm_workflows',
      'crm_permissions',
      'crm_leads',
      'crm_notes',
      'tasks',
      'drive_items',
    ];
    for (const table of legacyTables) {
      await cleanupClient.query(`ALTER TABLE IF EXISTS ${table} DROP COLUMN IF EXISTS account_id`);
    }
  } finally {
    await cleanupClient.end();
  }
}

export async function teardown() {
  // Cleanup: drop all tables (optional — CI creates fresh DB each run)
}
