import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database, { type Database as DatabaseType } from 'better-sqlite3';
import crypto from 'node:crypto';
import { env } from './env';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// Ensure the directory exists for the database file
const dbPath = env.DATABASE_URL;
mkdirSync(dirname(dbPath), { recursive: true });

const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
sqlite.pragma('journal_mode = WAL');
// Enforce foreign key constraints (off by default in SQLite)
sqlite.pragma('foreign_keys = ON');

// ---- Users table (multi-account grouping) -----------------------------------

sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`).run();

// Add user_id column to accounts. For existing rows, create a user per account.
try {
  sqlite.prepare(`ALTER TABLE accounts ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE`).run();

  // Backfill: create a user for each existing account that doesn't have one
  const orphanAccounts = sqlite.prepare(`SELECT id FROM accounts WHERE user_id IS NULL`).all() as { id: string }[];
  const insertUser = sqlite.prepare(`INSERT INTO users (id, createdAt, updatedAt) VALUES (?, ?, ?)`);
  const updateAccount = sqlite.prepare(`UPDATE accounts SET user_id = ? WHERE id = ?`);
  const now = new Date().toISOString();
  for (const acct of orphanAccounts) {
    const userId = crypto.randomUUID();
    insertUser.run(userId, now, now);
    updateAccount.run(userId, acct.id);
  }
} catch { /* column already exists */ }

try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id)`).run(); } catch { /* */ }

// Add user_id to documents. Backfill from the account's user_id.
try {
  sqlite.prepare(`ALTER TABLE documents ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE`).run();

  // Backfill user_id from the owning account
  sqlite.prepare(`
    UPDATE documents SET user_id = (
      SELECT a.user_id FROM accounts a WHERE a.id = documents.account_id
    ) WHERE user_id IS NULL
  `).run();
} catch { /* column already exists */ }

try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id, is_archived)`).run(); } catch { /* */ }
try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_documents_user_parent ON documents(user_id, parent_id, sort_order)`).run(); } catch { /* */ }

// Add user_id to document_versions. Backfill from the owning account.
try {
  sqlite.prepare(`ALTER TABLE document_versions ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE`).run();

  sqlite.prepare(`
    UPDATE document_versions SET user_id = (
      SELECT a.user_id FROM accounts a WHERE a.id = document_versions.account_id
    ) WHERE user_id IS NULL
  `).run();
} catch { /* column already exists */ }

// ---- Auto-migration for new columns & FTS5 --------------------------------

// Add watch_expiration column to accounts (no-op if already exists)
try {
  sqlite.prepare(`ALTER TABLE accounts ADD COLUMN watch_expiration INTEGER`).run();
} catch { /* column already exists */ }

// Add body_html_compressed column to emails (no-op if already exists)
try {
  sqlite.prepare(`ALTER TABLE emails ADD COLUMN body_html_compressed TEXT`).run();
} catch { /* column already exists */ }

// Add new columns to contacts table for Google People API enrichment
for (const col of [
  `emails TEXT NOT NULL DEFAULT '[]'`,
  `given_name TEXT`,
  `family_name TEXT`,
  `photo_url TEXT`,
  `phone_numbers TEXT NOT NULL DEFAULT '[]'`,
  `organization TEXT`,
  `job_title TEXT`,
  `notes TEXT`,
  `google_resource_name TEXT`,
  `createdAt TEXT`,
  `updatedAt TEXT`,
]) {
  try {
    sqlite.prepare(`ALTER TABLE contacts ADD COLUMN ${col}`).run();
  } catch { /* column already exists */ }
}

// ---- Calendar tables --------------------------------------------------------

sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS calendars (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    google_calendar_id TEXT NOT NULL,
    summary TEXT,
    description TEXT,
    background_color TEXT,
    foreground_color TEXT,
    time_zone TEXT,
    access_role TEXT,
    is_primary INTEGER NOT NULL DEFAULT 0,
    is_selected INTEGER NOT NULL DEFAULT 1,
    sync_token TEXT,
    last_sync_at TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`).run();

sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    calendar_id TEXT NOT NULL REFERENCES calendars(id) ON DELETE CASCADE,
    google_event_id TEXT NOT NULL,
    summary TEXT,
    description TEXT,
    location TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    is_all_day INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'confirmed',
    self_response_status TEXT,
    html_link TEXT,
    hangout_link TEXT,
    organizer TEXT,
    attendees TEXT,
    recurrence TEXT,
    recurring_event_id TEXT,
    color_id TEXT,
    reminders TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`).run();

// Calendar indexes
try { sqlite.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_calendars_account_google ON calendars(account_id, google_calendar_id)`).run(); } catch { /* */ }
try { sqlite.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_cal_events_account_google ON calendar_events(account_id, google_event_id)`).run(); } catch { /* */ }
try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_cal_events_calendar ON calendar_events(calendar_id)`).run(); } catch { /* */ }
try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_cal_events_time_range ON calendar_events(account_id, start_time, end_time)`).run(); } catch { /* */ }

// ---- Documents table --------------------------------------------------------

sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES documents(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT 'Untitled',
    content TEXT,
    icon TEXT,
    cover_image TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`).run();

try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_documents_account ON documents(account_id, is_archived)`).run(); } catch { /* */ }
try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_documents_parent ON documents(parent_id, sort_order)`).run(); } catch { /* */ }
try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_documents_account_parent ON documents(account_id, parent_id, sort_order)`).run(); } catch { /* */ }

// ---- Document versions table ------------------------------------------------

sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS document_versions (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT,
    createdAt TEXT NOT NULL
  )
`).run();

try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_document_versions_doc ON document_versions(document_id, createdAt)`).run(); } catch { /* */ }

// ---- Drawings table (Excalidraw whiteboards) --------------------------------

sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS drawings (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled drawing',
    content TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`).run();

try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_drawings_account ON drawings(account_id, is_archived)`).run(); } catch { /* */ }
try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_drawings_user ON drawings(user_id, is_archived)`).run(); } catch { /* */ }

// Add thumbnail_url column to drawings (no-op if already exists)
try { sqlite.prepare(`ALTER TABLE drawings ADD COLUMN thumbnail_url TEXT`).run(); } catch { /* column already exists */ }

// ---- Task Projects table ----------------------------------------------------

sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS task_projects (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled project',
    color TEXT NOT NULL DEFAULT '#5a7fa0',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`).run();

try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_task_projects_user ON task_projects(user_id, is_archived)`).run(); } catch { /* */ }

// ---- Tasks table ------------------------------------------------------------

sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES task_projects(id) ON DELETE SET NULL,
    title TEXT NOT NULL DEFAULT '',
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'todo',
    "when" TEXT NOT NULL DEFAULT 'inbox',
    priority TEXT NOT NULL DEFAULT 'none',
    due_date TEXT,
    completed_at TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`).run();

try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks(user_id, status, is_archived)`).run(); } catch { /* */ }
try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_tasks_user_when ON tasks(user_id, "when", status)`).run(); } catch { /* */ }
try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id, sort_order)`).run(); } catch { /* */ }
try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(user_id, due_date)`).run(); } catch { /* */ }

// Tasks feature expansion: type, heading_id, description
try { sqlite.prepare(`ALTER TABLE tasks ADD COLUMN type TEXT NOT NULL DEFAULT 'task'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE tasks ADD COLUMN heading_id TEXT REFERENCES tasks(id) ON DELETE SET NULL`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE tasks ADD COLUMN description TEXT`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE tasks ADD COLUMN icon TEXT`).run(); } catch { /* column already exists */ }

// Task projects feature expansion: description, icon
try { sqlite.prepare(`ALTER TABLE task_projects ADD COLUMN description TEXT`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE task_projects ADD COLUMN icon TEXT`).run(); } catch { /* column already exists */ }

// ---- Recurring tasks columns -------------------------------------------------
try { sqlite.prepare(`ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE tasks ADD COLUMN recurrence_parent_id TEXT REFERENCES tasks(id) ON DELETE SET NULL`).run(); } catch { /* column already exists */ }

// ---- Tasks settings columns on user_settings --------------------------------
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN tasks_default_view TEXT NOT NULL DEFAULT 'inbox'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN tasks_confirm_delete INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN tasks_show_calendar INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN tasks_show_evening INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN tasks_show_when_badges INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN tasks_show_project INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN tasks_show_notes_indicator INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN tasks_compact_mode INTEGER NOT NULL DEFAULT 0`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN tasks_completed_behavior TEXT NOT NULL DEFAULT 'fade'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN tasks_default_sort TEXT NOT NULL DEFAULT 'manual'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN tasks_view_mode TEXT NOT NULL DEFAULT 'list'`).run(); } catch { /* column already exists */ }

// Create FTS5 virtual table for full-text search across emails.
// content='' means we manage the index manually (external content table).
sqlite.prepare(`
  CREATE VIRTUAL TABLE IF NOT EXISTS email_fts USING fts5(
    subject, body_text, from_address, from_name,
    content='',
    contentless_delete=1,
    tokenize='porter unicode61'
  )
`).run();

export const db = drizzle(sqlite);

// Export raw sqlite handle for FTS and push-notification operations
export const rawDb: DatabaseType = sqlite;
