import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { migrateWorkMerge } from './migrations/2026-04-15-work-merge';

const MIGRATIONS_DIR = join(__dirname, 'migrations');

export async function bootstrapDatabase() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') AS exists`,
    );
    if (rows[0]?.exists) {
      logger.info('Database already initialized — skipping bootstrap');
      return;
    }

    logger.info('Empty database detected — running initial schema');

    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      const statements = sql
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const stmt of statements) {
        await client.query(stmt);
      }
      logger.info({ file }, 'Applied migration');
    }

    logger.info('Database bootstrap complete');
  } finally {
    client.release();
  }

  await migrateLegacyData();
}

// One-off data cleanups that can run against a live DB without schema changes.
// Safe to re-run — each step is idempotent.
async function migrateLegacyData() {
  const client = await pool.connect();
  try {
    // Collapse the removed 'team' recordAccess into 'all'. The value was
    // accepted by an early version of the platform invite flow but never
    // enforced in any service, so treating it as 'all' matches the actual
    // server behavior that users have been observing.
    const res = await client.query(
      `UPDATE app_permissions SET record_access = 'all' WHERE record_access = 'team'`,
    );
    if (res.rowCount && res.rowCount > 0) {
      logger.info({ rowsUpdated: res.rowCount }, 'Migrated legacy recordAccess=team to all');
    }
  } catch (err) {
    // Table might not exist on a brand-new install before bootstrap ran —
    // that's fine, nothing to migrate.
    logger.debug({ err }, 'Legacy data migration skipped');
  } finally {
    client.release();
  }

  // Work-app merge: invoices.project_id was added in the schema but the
  // column never landed on environments that bootstrapped before the change.
  // Apply idempotently so dev DBs catch up without a full reset.
  try {
    const c = await pool.connect();
    try {
      await c.query(
        `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES project_projects(id) ON DELETE SET NULL`,
      );
      await c.query(
        `CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id)`,
      );
    } finally {
      c.release();
    }
  } catch (err) {
    logger.error({ err }, 'invoices.project_id backfill failed');
  }

  // CRM proposal revisions table — idempotent create for existing dev DBs.
  try {
    const c = await pool.connect();
    try {
      await c.query(`
        CREATE TABLE IF NOT EXISTS crm_proposal_revisions (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          proposal_id uuid NOT NULL REFERENCES crm_proposals(id) ON DELETE CASCADE,
          tenant_id uuid NOT NULL,
          revision_number integer NOT NULL,
          snapshot_json jsonb NOT NULL,
          changed_by uuid NOT NULL,
          change_reason varchar(200),
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await c.query(`
        CREATE INDEX IF NOT EXISTS idx_crm_proposal_revisions_proposal ON crm_proposal_revisions(proposal_id)
      `);
    } finally {
      c.release();
    }
  } catch (err) {
    logger.error({ err }, 'crm_proposal_revisions create failed');
  }

  // Work-app merge: copy task_projects → project_projects, seed isPrivate,
  // collapse tenant_apps. Guard: only run while task_projects still exists.
  try {
    const checkClient = await pool.connect();
    let hasTaskProjects = false;
    try {
      const res = await checkClient.query(
        `SELECT to_regclass('public.task_projects') AS t`,
      );
      hasTaskProjects = (res.rows as any[])[0]?.t !== null;
    } finally {
      checkClient.release();
    }
    if (hasTaskProjects) {
      await migrateWorkMerge();
    }
  } catch (e) {
    logger.error({ err: e }, 'work-merge migration failed');
  }
}
