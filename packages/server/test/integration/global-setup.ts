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
}

export async function teardown() {
  // Cleanup: drop all tables (optional — CI creates fresh DB each run)
}
