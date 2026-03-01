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

// ---- Global settings columns on user_settings --------------------------------
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN date_format TEXT NOT NULL DEFAULT 'MM/DD/YYYY'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN currency_symbol TEXT NOT NULL DEFAULT '$'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN timezone TEXT NOT NULL DEFAULT ''`).run(); } catch { /* column already exists */ }

// ---- Tables settings columns on user_settings --------------------------------
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN tables_default_view TEXT NOT NULL DEFAULT 'grid'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN tables_default_sort TEXT NOT NULL DEFAULT 'none'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN tables_show_field_type_icons INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN tables_default_row_count INTEGER NOT NULL DEFAULT 3`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN tables_include_row_ids_in_export INTEGER NOT NULL DEFAULT 0`).run(); } catch { /* column already exists */ }

// ---- Calendar settings columns on user_settings ------------------------------
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN cal_default_view TEXT NOT NULL DEFAULT 'week'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN cal_week_starts_on_monday INTEGER NOT NULL DEFAULT 0`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN cal_show_week_numbers INTEGER NOT NULL DEFAULT 0`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN cal_density TEXT NOT NULL DEFAULT 'default'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN cal_work_start_hour INTEGER NOT NULL DEFAULT 9`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN cal_work_end_hour INTEGER NOT NULL DEFAULT 17`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN cal_secondary_timezone TEXT`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN cal_event_reminder_minutes INTEGER NOT NULL DEFAULT 10`).run(); } catch { /* column already exists */ }

// ---- General app settings columns on user_settings ---------------------------
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN language TEXT NOT NULL DEFAULT 'en'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN font_family TEXT NOT NULL DEFAULT 'inter'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN color_theme TEXT NOT NULL DEFAULT 'default'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN show_badge_count INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN notification_level TEXT NOT NULL DEFAULT 'smart'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN compose_mode TEXT NOT NULL DEFAULT 'rich'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN signature TEXT NOT NULL DEFAULT ''`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN include_signature_in_replies INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN undo_send_delay INTEGER NOT NULL DEFAULT 5`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN send_animation INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN theme_transition INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN shortcuts_preset TEXT NOT NULL DEFAULT 'superhuman'`).run(); } catch { /* column already exists */ }
// AI settings
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN ai_enabled INTEGER NOT NULL DEFAULT 0`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN ai_provider TEXT NOT NULL DEFAULT 'openai'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN ai_api_keys TEXT NOT NULL DEFAULT '{}'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN ai_custom_provider TEXT NOT NULL DEFAULT '{}'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN ai_writing_assistant INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN ai_quick_replies INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN ai_thread_summary INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN ai_translation INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }

// ---- Docs settings columns on user_settings ----------------------------------
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN docs_font_style TEXT NOT NULL DEFAULT 'default'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN docs_small_text INTEGER NOT NULL DEFAULT 0`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN docs_full_width INTEGER NOT NULL DEFAULT 0`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN docs_spell_check INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN docs_open_last_visited INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN docs_sidebar_default TEXT NOT NULL DEFAULT 'tree'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN doc_favorites TEXT NOT NULL DEFAULT '[]'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN doc_recent TEXT NOT NULL DEFAULT '[]'`).run(); } catch { /* column already exists */ }

// ---- Draw settings columns on user_settings ----------------------------------
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN draw_grid_mode INTEGER NOT NULL DEFAULT 0`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN draw_snap_to_grid INTEGER NOT NULL DEFAULT 0`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN draw_default_background TEXT NOT NULL DEFAULT 'white'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN draw_export_quality INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN draw_export_with_background INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN draw_auto_save_interval INTEGER NOT NULL DEFAULT 2000`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN draw_sort_order TEXT NOT NULL DEFAULT 'modified'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN draw_library TEXT NOT NULL DEFAULT '[]'`).run(); } catch { /* column already exists */ }

// ---- Drive settings columns on user_settings ----------------------------------
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN drive_default_view TEXT NOT NULL DEFAULT 'list'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN drive_default_sort TEXT NOT NULL DEFAULT 'default'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN drive_sidebar_default TEXT NOT NULL DEFAULT 'files'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN drive_show_preview_panel INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN drive_compact_mode INTEGER NOT NULL DEFAULT 0`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN drive_confirm_delete INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN drive_auto_version_on_replace INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN drive_max_versions INTEGER NOT NULL DEFAULT 20`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN drive_share_default_expiry TEXT NOT NULL DEFAULT 'never'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN drive_duplicate_handling TEXT NOT NULL DEFAULT 'rename'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN drive_show_thumbnails INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN drive_show_file_extensions INTEGER NOT NULL DEFAULT 1`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN drive_sort_order TEXT NOT NULL DEFAULT 'asc'`).run(); } catch { /* column already exists */ }

// ---- Drive linked resource columns -------------------------------------------
try { sqlite.prepare(`ALTER TABLE drive_items ADD COLUMN linked_resource_type TEXT`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE drive_items ADD COLUMN linked_resource_id TEXT`).run(); } catch { /* column already exists */ }

// ---- Search settings columns on user_settings --------------------------------
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN recent_searches TEXT NOT NULL DEFAULT '[]'`).run(); } catch { /* column already exists */ }

// ---- Spreadsheets table (Tables / Airtable-like) ----------------------------

sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS spreadsheets (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled table',
    columns TEXT NOT NULL DEFAULT '[]',
    rows TEXT NOT NULL DEFAULT '[]',
    view_config TEXT NOT NULL DEFAULT '{"activeView":"grid"}',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`).run();

try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_spreadsheets_user ON spreadsheets(user_id, is_archived)`).run(); } catch { /* */ }
try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_spreadsheets_account ON spreadsheets(account_id, is_archived)`).run(); } catch { /* */ }

// Spreadsheet appearance + guide columns
try { sqlite.prepare(`ALTER TABLE spreadsheets ADD COLUMN color TEXT`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE spreadsheets ADD COLUMN icon TEXT`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE spreadsheets ADD COLUMN guide TEXT`).run(); } catch { /* column already exists */ }

// ---- Drive items table (file storage) ----------------------------------------

sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS drive_items (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'file',
    mime_type TEXT,
    size INTEGER,
    parent_id TEXT REFERENCES drive_items(id) ON DELETE SET NULL,
    storage_path TEXT,
    is_favourite INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`).run();

try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_drive_items_user_parent ON drive_items(user_id, parent_id, is_archived)`).run(); } catch { /* */ }
try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_drive_items_user_archived ON drive_items(user_id, is_archived)`).run(); } catch { /* */ }
try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_drive_items_user_favourite ON drive_items(user_id, is_favourite)`).run(); } catch { /* */ }

// Drive items: tags column
try { sqlite.prepare(`ALTER TABLE drive_items ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'`).run(); } catch { /* column already exists */ }
// Drive items: icon column
try { sqlite.prepare(`ALTER TABLE drive_items ADD COLUMN icon TEXT`).run(); } catch { /* column already exists */ }
// Drive linked resource columns
try { sqlite.prepare(`ALTER TABLE drive_items ADD COLUMN linked_resource_type TEXT`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE drive_items ADD COLUMN linked_resource_id TEXT`).run(); } catch { /* column already exists */ }

// ---- Drive item versions table -----------------------------------------------

sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS drive_item_versions (
    id TEXT PRIMARY KEY,
    drive_item_id TEXT NOT NULL REFERENCES drive_items(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER,
    storage_path TEXT,
    createdAt TEXT NOT NULL
  )
`).run();

try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_drive_versions_item ON drive_item_versions(drive_item_id, createdAt)`).run(); } catch { /* */ }

// ---- Drive share links table -------------------------------------------------

sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS drive_share_links (
    id TEXT PRIMARY KEY,
    drive_item_id TEXT NOT NULL REFERENCES drive_items(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    share_token TEXT NOT NULL UNIQUE,
    expires_at TEXT,
    createdAt TEXT NOT NULL
  )
`).run();

try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_share_links_token ON drive_share_links(share_token)`).run(); } catch { /* */ }
try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_share_links_item ON drive_share_links(drive_item_id)`).run(); } catch { /* */ }

// ---- Notifications table -----------------------------------------------------

sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'reminder',
    title TEXT NOT NULL,
    body TEXT,
    source_type TEXT,
    source_id TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  )
`).run();

try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read)`).run(); } catch { /* */ }
try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, createdAt)`).run(); } catch { /* */ }

// ---- Push subscriptions table ------------------------------------------------

sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    createdAt TEXT NOT NULL
  )
`).run();

try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id)`).run(); } catch { /* */ }

// ---- Subtasks table ----------------------------------------------------------

sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS subtasks (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '',
    is_completed INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  )
`).run();

try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id, sort_order)`).run(); } catch { /* */ }

// ---- Task activities table ---------------------------------------------------

sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS task_activities (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    field TEXT,
    old_value TEXT,
    new_value TEXT,
    createdAt TEXT NOT NULL
  )
`).run();

try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_task_activities_task ON task_activities(task_id, createdAt)`).run(); } catch { /* */ }

// ---- Task templates table ----------------------------------------------------

sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS task_templates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled template',
    description TEXT,
    icon TEXT,
    default_when TEXT NOT NULL DEFAULT 'inbox',
    default_priority TEXT NOT NULL DEFAULT 'none',
    default_tags TEXT NOT NULL DEFAULT '[]',
    subtask_titles TEXT NOT NULL DEFAULT '[]',
    sort_order INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL
  )
`).run();

try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_task_templates_user ON task_templates(user_id)`).run(); } catch { /* */ }

// ---- Document comments table -------------------------------------------------

sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS document_comments (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    selection_from INTEGER,
    selection_to INTEGER,
    selection_text TEXT,
    is_resolved INTEGER NOT NULL DEFAULT 0,
    parent_id TEXT REFERENCES document_comments(id) ON DELETE CASCADE,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`).run();

try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_document_comments_doc ON document_comments(document_id)`).run(); } catch { /* */ }
try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_document_comments_parent ON document_comments(parent_id)`).run(); } catch { /* */ }

// ---- Document links table ----------------------------------------------------

sqlite.prepare(`
  CREATE TABLE IF NOT EXISTS document_links (
    id TEXT PRIMARY KEY,
    source_doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    target_doc_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    createdAt TEXT NOT NULL
  )
`).run();

try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_document_links_source ON document_links(source_doc_id)`).run(); } catch { /* */ }
try { sqlite.prepare(`CREATE INDEX IF NOT EXISTS idx_document_links_target ON document_links(target_doc_id)`).run(); } catch { /* */ }
try { sqlite.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_document_links_unique ON document_links(source_doc_id, target_doc_id)`).run(); } catch { /* */ }

// ---- ALTER TABLE migrations for existing tables ------------------------------

// Tasks: source email columns
try { sqlite.prepare(`ALTER TABLE tasks ADD COLUMN source_email_id TEXT`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE tasks ADD COLUMN source_email_subject TEXT`).run(); } catch { /* column already exists */ }

// User settings: home background & recent items
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN home_bg_type TEXT NOT NULL DEFAULT 'unsplash'`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN home_bg_value TEXT`).run(); } catch { /* column already exists */ }
try { sqlite.prepare(`ALTER TABLE user_settings ADD COLUMN recent_items TEXT NOT NULL DEFAULT '[]'`).run(); } catch { /* column already exists */ }

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
