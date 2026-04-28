import { pool } from '../../config/database';
import { logger } from '../../utils/logger';

const CREATE_MESSAGE_CHANNELS = `
  CREATE TABLE IF NOT EXISTS message_channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type text NOT NULL DEFAULT 'gmail',
    handle text NOT NULL,
    visibility text NOT NULL DEFAULT 'private',
    is_sync_enabled boolean NOT NULL DEFAULT true,
    contact_auto_creation_policy text NOT NULL DEFAULT 'send-only',
    sync_stage text NOT NULL DEFAULT 'pending',
    sync_status text,
    sync_error text,
    sync_cursor text,
    last_full_sync_at timestamptz,
    last_incremental_sync_at timestamptz,
    throttle_failure_count integer NOT NULL DEFAULT 0,
    throttle_retry_after timestamptz,
    push_subscription_id text,
    push_watch_expiration timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_message_channels_account ON message_channels (account_id);
  CREATE INDEX IF NOT EXISTS idx_message_channels_tenant_sync ON message_channels (tenant_id, is_sync_enabled);
  CREATE INDEX IF NOT EXISTS idx_message_channels_owner ON message_channels (owner_user_id);
`;

const CREATE_MESSAGE_THREADS = `
  CREATE TABLE IF NOT EXISTS message_threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id uuid NOT NULL REFERENCES message_channels(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    gmail_thread_id text NOT NULL,
    subject text,
    message_count integer NOT NULL DEFAULT 0,
    last_message_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_message_threads_channel_gmail ON message_threads (channel_id, gmail_thread_id);
  CREATE INDEX IF NOT EXISTS idx_message_threads_tenant_last_msg ON message_threads (tenant_id, last_message_at);
  CREATE INDEX IF NOT EXISTS idx_message_threads_channel_last_msg ON message_threads (channel_id, last_message_at);
`;

const CREATE_MESSAGES = `
  CREATE TABLE IF NOT EXISTS messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id uuid NOT NULL REFERENCES message_channels(id) ON DELETE CASCADE,
    thread_id uuid NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    gmail_message_id text NOT NULL,
    header_message_id text,
    in_reply_to text,
    subject text,
    snippet text,
    body_text text,
    body_html text,
    direction text NOT NULL,
    status text NOT NULL DEFAULT 'received',
    sent_at timestamptz,
    received_at timestamptz,
    labels jsonb NOT NULL DEFAULT '[]'::jsonb,
    has_attachments boolean NOT NULL DEFAULT false,
    deleted_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_messages_channel_gmail ON messages (channel_id, gmail_message_id);
  CREATE INDEX IF NOT EXISTS idx_messages_thread_sent ON messages (thread_id, sent_at);
  CREATE INDEX IF NOT EXISTS idx_messages_tenant_inbound_sent ON messages (tenant_id, sent_at);
  CREATE INDEX IF NOT EXISTS idx_messages_tenant_outbound ON messages (tenant_id, status, direction);
`;

const CREATE_MESSAGE_PARTICIPANTS = `
  CREATE TABLE IF NOT EXISTS message_participants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role text NOT NULL,
    handle text NOT NULL,
    display_name text,
    person_id uuid REFERENCES crm_contacts(id) ON DELETE SET NULL,
    workspace_member_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS idx_message_participants_handle_tenant ON message_participants (handle, tenant_id);
  CREATE INDEX IF NOT EXISTS idx_message_participants_person ON message_participants (person_id);
  CREATE INDEX IF NOT EXISTS idx_message_participants_message_role ON message_participants (message_id, role);
`;

const CREATE_MESSAGE_BLOCKLIST = `
  CREATE TABLE IF NOT EXISTS message_blocklist (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pattern text NOT NULL,
    created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS uniq_message_blocklist_tenant_pattern ON message_blocklist (tenant_id, pattern);
`;

const ADD_CRM_ACTIVITY_COLUMNS = `
  ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS message_id uuid;
  ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS external_provider text;
  ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS external_id text;
  CREATE INDEX IF NOT EXISTS idx_crm_activities_message ON crm_activities (message_id);
`;

// Backfill: every Google-provider account that doesn't already have a
// message_channels row gets one. Tenant id is read from the user's primary
// tenant_member row; if the account's user has no tenant member the
// backfill skips that account (operator must repair manually — extremely
// rare in practice; logged below).
const BACKFILL_CHANNELS = `
  INSERT INTO message_channels (
    account_id, tenant_id, owner_user_id, type, handle, visibility,
    is_sync_enabled, contact_auto_creation_policy, sync_stage
  )
  SELECT DISTINCT ON (accounts.id)
    accounts.id,
    tenant_members.tenant_id,
    accounts.user_id,
    'gmail',
    accounts.email,
    'private',
    true,
    'send-only',
    'pending'
  FROM accounts
  INNER JOIN tenant_members ON tenant_members.user_id = accounts.user_id
  LEFT JOIN message_channels ON message_channels.account_id = accounts.id
  WHERE accounts.provider = 'google'
    AND message_channels.id IS NULL
  ORDER BY accounts.id, tenant_members.created_at ASC;
`;

export async function migrateMessageChannels(): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query(CREATE_MESSAGE_CHANNELS);
    await c.query(CREATE_MESSAGE_THREADS);
    await c.query(CREATE_MESSAGES);
    await c.query(CREATE_MESSAGE_PARTICIPANTS);
    await c.query(CREATE_MESSAGE_BLOCKLIST);
    await c.query(ADD_CRM_ACTIVITY_COLUMNS);
    const result = await c.query(BACKFILL_CHANNELS);
    const count = result.rowCount ?? 0;
    if (count > 0) {
      logger.info({ backfilledChannels: count }, 'message-channels migration applied');
    } else {
      logger.debug('message-channels migration applied (no backfill needed)');
    }
  } finally {
    c.release();
  }
}
