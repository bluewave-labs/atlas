/**
 * Integration test setup — uses a real PostgreSQL database.
 *
 * Requires: DATABASE_URL pointing to a test database (e.g. atlas_test).
 * The database is migrated before tests and cleaned between tests.
 */
import pg from 'pg';
import { beforeAll, afterAll, afterEach } from 'vitest';

const TEST_DB_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/atlas_test';

// Shared pool for cleanup queries
let cleanupPool: pg.Pool;

// Tables to truncate between tests (order matters for FK constraints)
const TRUNCATE_TABLES = [
  'notifications',
  'calendar_events',
  'emails',
  'record_links',
  'custom_field_definitions',
  'project_invoice_line_items',
  'project_invoices',
  'project_time_entries',
  'project_members',
  'projects',
  'project_clients',
  'project_settings',
  'sign_fields',
  'sign_recipients',
  'sign_documents',
  'drawings',
  'documents',
  'spreadsheet_rows',
  'spreadsheets',
  'drive_items',
  'drive_share_links',
  'drive_versions',
  'tasks',
  'task_projects',
  'hr_leave_applications',
  'hr_leave_policy_allocations',
  'hr_leave_policies',
  'hr_leave_types',
  'hr_holiday_entries',
  'hr_holiday_calendars',
  'hr_attendance_records',
  'hr_onboarding_tasks',
  'hr_employee_documents',
  'hr_employees',
  'hr_departments',
  'crm_activities',
  'crm_deals',
  'crm_contacts',
  'crm_companies',
  'crm_pipeline_stages',
  'system_settings',
  'user_settings',
  'tenant_apps',
  'tenant_invitations',
  'tenant_members',
  'tenants',
  'password_reset_tokens',
  'accounts',
  'users',
];

beforeAll(async () => {
  cleanupPool = new pg.Pool({ connectionString: TEST_DB_URL });
});

beforeEach(async () => {
  // Clean all tables BEFORE each test for full isolation
  const client = await cleanupPool.connect();
  try {
    const result = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    );
    const tables = result.rows.map((r: any) => `"${r.tablename}"`).join(', ');
    if (tables) {
      await client.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
    }
  } finally {
    client.release();
  }
});

afterAll(async () => {
  await cleanupPool.end();
});

// ─── Test helpers ─────────────────────────────────────────────────

export interface TestAuth {
  accessToken: string;
  refreshToken: string;
  accountId: string;
  userId: string;
  tenantId: string;
}

/**
 * Run initial setup (create admin user + tenant) and return auth tokens.
 * Cleans the DB first to ensure a fresh state.
 */
export async function setupTestAdmin(
  app: import('express').Express,
  supertest: typeof import('supertest').default,
): Promise<TestAuth> {
  // Clean DB before setup
  const client = await cleanupPool.connect();
  try {
    const result = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
    );
    const tables = result.rows.map((r: any) => `"${r.tablename}"`).join(', ');
    if (tables) {
      await client.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
    }
  } finally {
    client.release();
  }

  const res = await supertest(app)
    .post('/api/v1/auth/setup')
    .send({
      adminName: 'Test Admin',
      adminEmail: 'admin@test.local',
      adminPassword: 'TestPassword123!',
      companyName: 'Test Company',
    })
    .expect(201);

  return {
    accessToken: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
    accountId: res.body.data.account.id,
    userId: res.body.data.account.userId,
    tenantId: res.body.data.tenant.id,
  };
}

/**
 * Login with email/password and return tokens.
 */
export async function loginTestUser(
  app: import('express').Express,
  supertest: typeof import('supertest').default,
  email: string,
  password: string,
): Promise<TestAuth> {
  const res = await supertest(app)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);

  return {
    accessToken: res.body.data.accessToken,
    refreshToken: res.body.data.refreshToken,
    accountId: res.body.data.account.id,
    userId: res.body.data.account.userId,
    tenantId: res.body.data.tenant?.id ?? '',
  };
}
