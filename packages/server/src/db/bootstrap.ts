import { readFile, readdir } from 'fs/promises';
import { join } from 'path';
import { pool } from '../config/database';
import { logger } from '../utils/logger';
import { migrateWorkMerge } from './migrations/2026-04-15-work-merge';
import { migrateCrmWorkflowSteps } from './migrations/2026-04-22-crm-workflow-steps';
import { migrateMessageChannels } from './migrations/2026-04-28-message-channels';

const MIGRATIONS_DIR = join(__dirname, 'migrations');

// Postgres error codes we consider "benign" when replaying migrations on
// a DB that already has most of the schema. Duplicate-object errors mean
// the statement has already been applied; undefined-object errors on ALTER
// mean the target table was never on this DB (a later CREATE will handle
// it if needed).
async function addColumnIfMissing(table: string, column: string, ddl: string) {
  try {
    const c = await pool.connect();
    try {
      await c.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${column} ${ddl}`);
    } finally {
      c.release();
    }
  } catch (err) {
    logger.error({ err }, `${table}.${column} backfill failed`);
  }
}

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

  // demo_data_seeds — registry of every row the demo seeder planted, so
  // the "Remove demo data" action can delete exactly those and nothing
  // the user created themselves.
  try {
    const c = await pool.connect();
    try {
      await c.query(`
        CREATE TABLE IF NOT EXISTS demo_data_seeds (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          entity_type varchar(64) NOT NULL,
          entity_id uuid NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await c.query(
        `CREATE INDEX IF NOT EXISTS idx_demo_data_seeds_tenant ON demo_data_seeds(tenant_id)`,
      );
      await c.query(
        `CREATE INDEX IF NOT EXISTS idx_demo_data_seeds_tenant_entity ON demo_data_seeds(tenant_id, entity_type)`,
      );
    } finally {
      c.release();
    }
  } catch (err) {
    logger.error({ err }, 'demo_data_seeds create failed');
  }

  // scheduler_send_log — per-(tenantId, jobName, sendDate) idempotency
  // for email schedulers. The CRM digest does INSERT ... ON CONFLICT
  // DO NOTHING here before sending so a process restart can't re-send
  // the same day's digest, and dual replicas can't double-send.
  try {
    const c = await pool.connect();
    try {
      await c.query(`
        CREATE TABLE IF NOT EXISTS scheduler_send_log (
          tenant_id uuid NOT NULL,
          job_name varchar(64) NOT NULL,
          send_date date NOT NULL,
          sent_at timestamptz NOT NULL DEFAULT now(),
          PRIMARY KEY (tenant_id, job_name, send_date)
        )
      `);
    } finally {
      c.release();
    }
  } catch (err) {
    logger.error({ err }, 'scheduler_send_log create failed');
  }

  // employees.holiday_calendar_id — added to the schema after the initial
  // migration snapshot. Bootstrap snapshots are applied to fresh installs
  // only, so every existing deployment is missing this column and the HR
  // employee form blows up on insert with 42703 (undefined column).
  // Idempotent backfill — safe to re-run.
  // (See https://github.com/gorkem-bwl/atlas/issues/6)
  try {
    const c = await pool.connect();
    try {
      await c.query(
        `ALTER TABLE employees ADD COLUMN IF NOT EXISTS holiday_calendar_id uuid`,
      );
    } finally {
      c.release();
    }
  } catch (err) {
    logger.error({ err }, 'employees.holiday_calendar_id backfill failed');
  }

  // task_statuses + tasks.task_status_id — issue #8 phase 2.
  // Per-tenant custom task statuses. Phase 2 ships the schema, seeds
  // defaults on tenant creation (in tenant.service), and backfills
  // taskStatusId on existing rows by mapping tasks.status (text) to the
  // seeded status with matching legacySlug. The text column remains the
  // source of truth until phase 5 cuts the read path; phase 6 drops it.
  try {
    const c = await pool.connect();
    try {
      await c.query(`
        CREATE TABLE IF NOT EXISTS task_statuses (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          name varchar(64) NOT NULL,
          category varchar(16) NOT NULL,
          color varchar(16) NOT NULL DEFAULT '#6B7280',
          legacy_slug varchar(32),
          is_default boolean NOT NULL DEFAULT false,
          sort_order integer NOT NULL DEFAULT 0,
          is_archived boolean NOT NULL DEFAULT false,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await c.query(
        `CREATE INDEX IF NOT EXISTS idx_task_statuses_tenant ON task_statuses(tenant_id, sort_order)`,
      );
      await c.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS idx_task_statuses_tenant_slug ON task_statuses(tenant_id, legacy_slug) WHERE legacy_slug IS NOT NULL`,
      );
      await c.query(
        `ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_status_id uuid`,
      );
      await c.query(
        `CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status_id ON tasks(tenant_id, task_status_id)`,
      );
      // Seed defaults for tenants that exist but have no statuses yet
      // (catches tenants that pre-date Phase 2 — new tenants are seeded
      // by seedDefaultTaskStatuses in tenant.service).
      // KEEP IN SYNC with DEFAULT_TASK_STATUSES in
      // packages/server/src/apps/work/services/task-status.service.ts
      await c.query(`
        INSERT INTO task_statuses (tenant_id, name, category, color, legacy_slug, is_default, sort_order)
        SELECT t.id, v.name, v.category, v.color, v.legacy_slug, v.is_default, v.sort_order
        FROM tenants t
        CROSS JOIN (VALUES
          ('To Do',       'open',      '#6B7280', 'todo',      true,  0),
          ('In Progress', 'open',      '#3B82F6', NULL,        false, 1),
          ('Done',        'done',      '#10B981', 'completed', true,  2),
          ('Cancelled',   'cancelled', '#9CA3AF', 'cancelled', false, 3)
        ) AS v(name, category, color, legacy_slug, is_default, sort_order)
        WHERE NOT EXISTS (
          SELECT 1 FROM task_statuses ts WHERE ts.tenant_id = t.id
        )
      `);
      // Backfill task_status_id on tasks that don't have it yet, using
      // the legacy_slug → status map. Idempotent.
      await c.query(`
        UPDATE tasks t
        SET task_status_id = ts.id
        FROM task_statuses ts
        WHERE t.task_status_id IS NULL
          AND ts.tenant_id = t.tenant_id
          AND ts.legacy_slug = t.status
      `);
    } finally {
      c.release();
    }
  } catch (err) {
    logger.error({ err }, 'task_statuses bootstrap failed');
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
  await addColumnIfMissing('invoices', 'exclude_from_auto_reminders',
    'boolean NOT NULL DEFAULT false');
  await addColumnIfMissing('project_settings', 'time_rounding',
    'integer NOT NULL DEFAULT 0');
  await addColumnIfMissing('users', 'is_super_admin',
    'boolean NOT NULL DEFAULT false');
  // Backfill batch — drift detected by `npm run db:check-drift`.
  await addColumnIfMissing('crm_deals', 'currency',
    "varchar(10) NOT NULL DEFAULT 'USD'");
  await addColumnIfMissing('crm_lead_forms', 'is_archived',
    'boolean NOT NULL DEFAULT false');
  // Lead-form branding columns — admins can customise the form's appearance
  // (colours, radius, font, copy) and inject scoped custom CSS that is only
  // applied on the hosted public form page.
  await addColumnIfMissing('crm_lead_forms', 'button_label',
    "varchar(120) NOT NULL DEFAULT 'Submit'");
  await addColumnIfMissing('crm_lead_forms', 'thank_you_message',
    "text NOT NULL DEFAULT 'Thanks! We''ll be in touch.'");
  await addColumnIfMissing('crm_lead_forms', 'accent_color',
    "varchar(24) NOT NULL DEFAULT '#13715B'");
  await addColumnIfMissing('crm_lead_forms', 'border_color',
    "varchar(24) NOT NULL DEFAULT '#d0d5dd'");
  await addColumnIfMissing('crm_lead_forms', 'border_radius',
    'integer NOT NULL DEFAULT 6');
  await addColumnIfMissing('crm_lead_forms', 'font_family',
    "varchar(64) NOT NULL DEFAULT 'inherit'");
  await addColumnIfMissing('crm_lead_forms', 'custom_css', 'text');
  await addColumnIfMissing('crm_saved_views', 'is_archived',
    'boolean NOT NULL DEFAULT false');
  await addColumnIfMissing('hr_expense_categories', 'is_archived',
    'boolean NOT NULL DEFAULT false');
  await addColumnIfMissing('hr_expense_categories', 'updated_at',
    'timestamp with time zone NOT NULL DEFAULT now()');
  await addColumnIfMissing('hr_expense_policies', 'is_archived',
    'boolean NOT NULL DEFAULT false');
  await addColumnIfMissing('project_time_entries', 'paid',
    'boolean NOT NULL DEFAULT false');
  await addColumnIfMissing('project_time_entries', 'tags',
    "jsonb NOT NULL DEFAULT '[]'::jsonb");
  await addColumnIfMissing('signing_tokens', 'viewed_at',
    'timestamp with time zone');
  await addColumnIfMissing('tenant_members', 'tour_completed_at',
    'timestamp with time zone');

  // Missing tables — create if absent.
  try {
    const c = await pool.connect();
    try {
      await c.query(`
        CREATE TABLE IF NOT EXISTS project_rates (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id uuid NOT NULL REFERENCES tenants(id),
          title varchar(200) NOT NULL,
          factor real NOT NULL DEFAULT 1,
          extra_per_hour real NOT NULL DEFAULT 0,
          is_archived boolean NOT NULL DEFAULT false,
          sort_order integer NOT NULL DEFAULT 0,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        )
      `);
      await c.query(`CREATE INDEX IF NOT EXISTS idx_project_rates_tenant ON project_rates(tenant_id)`);
      await c.query(`
        CREATE TABLE IF NOT EXISTS exchange_rates (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          base_currency varchar(10) NOT NULL,
          target_currency varchar(10) NOT NULL,
          rate real NOT NULL,
          provider varchar(50) NOT NULL,
          fetched_at timestamptz NOT NULL DEFAULT now()
        )
      `);
    } finally {
      c.release();
    }
  } catch (err) {
    logger.error({ err }, 'project_rates / exchange_rates CREATE failed');
  }

  await addColumnIfMissing('project_time_entries', 'rate_id',
    'uuid REFERENCES project_rates(id) ON DELETE SET NULL');

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

  // employees.notes — backfill drift column.
  await addColumnIfMissing('employees', 'notes', 'text');

  // CRM workflow multi-step migration — idempotent.
  try {
    await migrateCrmWorkflowSteps();
  } catch (err) {
    logger.error({ err }, 'crm_workflow_steps migration failed');
  }

  // Message channels (email sync) migration — idempotent.
  try {
    await migrateMessageChannels();
  } catch (err) {
    logger.error({ err }, 'message-channels migration failed');
  }

  // Drop the 5 dead user_settings.tables_* columns left over from the
  // deprecated Tables app (removed in v1.10.0). Idempotent: IF EXISTS
  // means re-running this block is a no-op once the columns are gone.
  try {
    const c = await pool.connect();
    try {
      for (const col of [
        'tables_show_field_type_icons',
        'tables_default_row_count',
        'tables_include_row_ids_in_export',
        'tables_default_view',
        'tables_default_sort',
      ]) {
        await c.query(`ALTER TABLE user_settings DROP COLUMN IF EXISTS ${col}`);
      }
    } finally {
      c.release();
    }
  } catch (err) {
    logger.error({ err }, 'Failed to drop dead user_settings.tables_* columns');
  }

  // tasks.project_id FK — after the Work app merge (v1.9.x) the old
  // task_projects table was superseded by project_projects, but the FK
  // on tasks.project_id still pointed at task_projects. Creating a task
  // against a post-merge project failed with a stale-FK violation. Swap
  // the constraint to target project_projects. Idempotent via DO block.
  try {
    const c = await pool.connect();
    try {
      await c.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'tasks_project_id_task_projects_id_fk'
          ) THEN
            ALTER TABLE tasks DROP CONSTRAINT tasks_project_id_task_projects_id_fk;
          END IF;
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'tasks_project_id_project_projects_id_fk'
          ) THEN
            ALTER TABLE tasks ADD CONSTRAINT tasks_project_id_project_projects_id_fk
              FOREIGN KEY (project_id) REFERENCES project_projects(id) ON DELETE SET NULL;
          END IF;
        END$$;
      `);
    } finally {
      c.release();
    }
  } catch (err) {
    logger.error({ err }, 'Failed to repoint tasks.project_id FK to project_projects');
  }
}
