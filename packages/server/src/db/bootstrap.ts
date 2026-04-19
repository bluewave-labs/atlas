import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { migrateWorkMerge } from './migrations/2026-04-15-work-merge';

const MIGRATIONS_DIR = join(__dirname, 'migrations');

// Postgres error codes we consider "benign" when replaying migrations on
// a DB that already has most of the schema. Duplicate-object errors mean
// the statement has already been applied; undefined-object errors on ALTER
// mean the target table was never on this DB (a later CREATE will handle
// it if needed).
const BENIGN_MIGRATION_ERRORS = new Set([
  '42P07', // duplicate_table
  '42701', // duplicate_column
  '42710', // duplicate_object (index/constraint/trigger)
  '42P06', // duplicate_schema
  '42723', // duplicate_function
  '23505', // unique_violation (seed inserts)
  '42P16', // invalid_table_definition (e.g. re-adding NOT NULL)
]);

export async function bootstrapDatabase() {
  const client = await pool.connect();
  try {
    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    // Replay every .sql migration on every start. Duplicate-object errors
    // are swallowed so this is safe for both empty and existing DBs. The
    // legacy-data patches below handle column-level drift embedded in
    // CREATE TABLE statements that can't land via a re-CREATE.
    for (const file of files) {
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      const statements = sql
        .split('--> statement-breakpoint')
        .map((s) => s.trim())
        .filter(Boolean);

      let applied = 0;
      let skipped = 0;
      for (const stmt of statements) {
        try {
          await client.query(stmt);
          applied += 1;
        } catch (err) {
          const code = (err as { code?: string })?.code ?? '';
          if (BENIGN_MIGRATION_ERRORS.has(code)) {
            skipped += 1;
          } else if (code === '42P01' && /ALTER TABLE/i.test(stmt)) {
            skipped += 1;
          } else {
            logger.error({ err, file, stmt: stmt.slice(0, 200) }, 'Migration statement failed');
            throw err;
          }
        }
      }
      logger.info({ file, applied, skipped }, 'Migration replayed');
    }
  } finally {
    client.release();
  }

  // Idempotent column-level backfills for drift that lives inside a
  // CREATE TABLE statement — those columns never land via re-running the
  // snapshot because duplicate_table swallows the whole statement.
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

  // tenants.storage_quota_bytes — added to the schema after the initial
  // migration snapshot. Bootstrap only runs the snapshot on empty DBs, so
  // every existing deployment is missing this column. Idempotent backfill:
  // add the column with the schema default, then tighten to NOT NULL.
  try {
    const c = await pool.connect();
    try {
      await c.query(
        `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS storage_quota_bytes bigint NOT NULL DEFAULT 10737418240`,
      );
    } finally {
      c.release();
    }
  } catch (err) {
    logger.error({ err }, 'tenants.storage_quota_bytes backfill failed');
  }

  // drive_items.upload_source — added to the schema after the initial
  // migration snapshot; nullable so no default needed.
  try {
    const c = await pool.connect();
    try {
      await c.query(
        `ALTER TABLE drive_items ADD COLUMN IF NOT EXISTS upload_source jsonb`,
      );
    } finally {
      c.release();
    }
  } catch (err) {
    logger.error({ err }, 'drive_items.upload_source backfill failed');
  }

  // tasks.is_private — added to the schema after the initial snapshot.
  // Missing on any DB that bootstrapped before the column was added.
  try {
    const c = await pool.connect();
    try {
      await c.query(
        `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false`,
      );
    } finally {
      c.release();
    }
  } catch (err) {
    logger.error({ err }, 'tasks.is_private backfill failed');
  }

  // invoices.exclude_from_auto_reminders — lets users opt a single
  // invoice out of the hourly reminder scheduler without disabling
  // reminders tenant-wide.
  try {
    const c = await pool.connect();
    try {
      await c.query(
        `ALTER TABLE invoices ADD COLUMN IF NOT EXISTS exclude_from_auto_reminders boolean NOT NULL DEFAULT false`,
      );
    } finally {
      c.release();
    }
  } catch (err) {
    logger.error({ err }, 'invoices.exclude_from_auto_reminders backfill failed');
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
