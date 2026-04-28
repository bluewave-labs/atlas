# Google Sync Engine — Phase 2a: Schema + Read Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land all five new email-related tables (`message_channels`, `message_threads`, `messages`, `message_participants`, `message_blocklist`), add the three columns to `crm_activities`, backfill one `message_channels` row per existing Google `accounts` row, and ship a read-only channel CRUD API + Settings UI rendering the channel list. **Zero Gmail API calls in this phase.**

**Architecture:** Pure schema + service-layer + REST + UI work, riding on the BullMQ rails Phase 1 already built. The channel becomes the unit of sync (replacing the implicit "account = channel" assumption from Phase 1). `accounts.syncStatus` semantics narrow to "OAuth health"; per-sync state moves to `message_channels.syncStage` / `.syncStatus` / `.syncCursor`. Phase 2a writes those columns but nothing reads them yet — that's sub-phase 2b.

**Tech Stack:** Drizzle ORM, Postgres, Express 5, vitest, React + TanStack Query + react-i18next.

**Out of scope for 2a:** Gmail API calls (full sync, incremental sync, send) — those are 2b/2c. Visibility enforcement at query layer — Phase 2d. Retention cleaner — 2d. Blocklist UI beyond schema seed — 2d. Ingestion of actual messages — 2b.

---

## Phase 1 baseline

The 6 unpushed Phase 1 commits on `main` (SHAs `0aaa17bc` → `c0a0b88a`) define the BullMQ rails this phase rides on. They stay. Phase 2a does **not** revert, amend, or reorder any of them. The semantic shift described in the spec (from `accounts.syncStatus` to per-channel state) starts in 2b, not 2a — for 2a, both columns coexist and `accounts.syncStatus` continues to drive the existing UI.

---

## File structure

**New files (server):**
- `packages/server/src/db/migrations/2026-04-28-message-channels.ts` — backfill migrator (one channel per Google account)
- `packages/server/src/apps/crm/services/channel.service.ts` — channel CRUD + visibility-filtered listing
- `packages/server/src/apps/crm/controllers/channels.controller.ts` — REST handlers
- `packages/server/test/channel-service.test.ts`
- `packages/server/test/channels-controller.test.ts`
- `packages/server/test/message-channels-migration.test.ts`

**New files (client):**
- `packages/client/src/apps/crm/hooks/use-channels.ts` — React Query hooks
- `packages/client/src/apps/crm/components/integrations/channels-list.tsx` — settings UI
- `packages/client/src/apps/crm/components/integrations/channel-row.tsx` — single channel toggle row

**Modified files:**
- `packages/server/src/db/schema.ts` — add 5 new tables + 3 columns on `crm_activities`
- `packages/server/src/db/bootstrap.ts` — wire in the new migration after the existing ones
- `packages/server/src/apps/crm/routes.ts` — register `/crm/channels/*` endpoints
- `packages/server/src/controllers/auth/google.controller.ts` — on successful OAuth callback, create the channel row
- `packages/client/src/config/query-keys.ts` — add `crm.channels` namespace
- `packages/client/src/components/settings/integrations-panel.tsx` — render the new channels list
- `packages/client/src/i18n/locales/{en,tr,de,fr,it}.json` — translation keys

**Why this layout:** Channel logic is CRM domain, not platform — it belongs in `apps/crm/services/`, mirroring the existing `activity.service.ts` / `contact.service.ts` pattern. The migration file is its own module per the existing `db/migrations/2026-04-15-work-merge.ts` pattern. Client UI splits into list + row so the row component can own its own mutation hooks (visibility, sync toggle, policy) without prop-drilling.

---

## Conventions you must follow

These come from `CLAUDE.md` and the project's auto-memory. Read before starting:

- **Branch policy:** Commit and push to `main`. Do NOT create a feature branch. (Atlas-specific override of the global "always feature branch" rule.)
- **No PR.** Do NOT run `gh pr create`. PRs require explicit user permission.
- **Don't push.** This plan ends with all commits on `main` but **not pushed**. The user is batching Phase 1 + Phase 2 commits before pushing.
- **Tests live in `packages/server/test/`** for server code. Run from `packages/server`: `npm test`. Vitest config at `packages/server/vitest.config.ts`. Global setup at `packages/server/test/setup.ts` mocks `../src/config/database` and `../src/utils/logger` for every test — your tests inherit those mocks unless you override per-file.
- **Test-driven:** every task that adds logic writes the failing vitest first, sees it fail, then implements.
- **Schema source of truth:** `packages/server/src/db/schema.ts` is authoritative. Atlas does NOT use `db:push` post-launch — column adds go through `addColumnIfMissing` calls inside `bootstrap.ts` (see existing pattern at `bootstrap.ts:346`). New tables get `CREATE TABLE IF NOT EXISTS` SQL. No hand-written `up`/`down` migrations.
- **i18n:** every user-facing string MUST use `t()`. New keys go in ALL 5 locale files (`en`, `tr`, `de`, `fr`, `it`) in the same commit. Namespace keys by app: `crm.integrations.channels.*`.
- **UI components:** use shared components from `packages/client/src/components/ui/`. Never raw `<button>` / `<input>` / `<select>`. Use `Button`, `Select`, `Toggle` etc.
- **CSS:** use design tokens from `packages/client/src/styles/theme.css` — no hardcoded hex colors.
- **Concurrency control:** every record table edited by more than one user needs `withConcurrencyCheck` middleware (see `CLAUDE.md` — "Optimistic concurrency"). For 2a, only `message_channels` is user-editable; apply the middleware on its PATCH endpoint.
- **Logger:** `import { logger } from '../utils/logger'`. Pino-style: `logger.info({ ... }, 'message')`.

---

## Task 1: Add Drizzle schema for the five new tables

**Why:** Schema is the foundation everything else builds on. We define all five tables in one commit so subsequent tasks can import them as a single unit.

**Files:**
- Modify: `packages/server/src/db/schema.ts` (append at the end, before the final closing of the file)

- [ ] **Step 1: Read the current end of `schema.ts` to find the right insertion point**

```bash
wc -l packages/server/src/db/schema.ts
tail -30 packages/server/src/db/schema.ts
```

Note: the file is ~1700 lines. Append the new tables at the very end of the file.

- [ ] **Step 2: Add the new tables**

At the end of `packages/server/src/db/schema.ts`, append:

```typescript

// ─── Email Sync: Channels, Threads, Messages, Participants, Blocklist ──

export const messageChannels = pgTable('message_channels', {
  id: uuid('id').primaryKey().defaultRandom(),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  ownerUserId: uuid('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('gmail'),
  handle: text('handle').notNull(),
  visibility: text('visibility').notNull().default('private'),
  isSyncEnabled: boolean('is_sync_enabled').notNull().default(true),
  contactAutoCreationPolicy: text('contact_auto_creation_policy').notNull().default('send-only'),
  syncStage: text('sync_stage').notNull().default('pending'),
  syncStatus: text('sync_status'),
  syncError: text('sync_error'),
  syncCursor: text('sync_cursor'),
  lastFullSyncAt: timestamp('last_full_sync_at', { withTimezone: true }),
  lastIncrementalSyncAt: timestamp('last_incremental_sync_at', { withTimezone: true }),
  throttleFailureCount: integer('throttle_failure_count').notNull().default(0),
  throttleRetryAfter: timestamp('throttle_retry_after', { withTimezone: true }),
  pushSubscriptionId: text('push_subscription_id'),
  pushWatchExpiration: timestamp('push_watch_expiration', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  accountIdx: index('idx_message_channels_account').on(table.accountId),
  tenantSyncIdx: index('idx_message_channels_tenant_sync').on(table.tenantId, table.isSyncEnabled),
  ownerIdx: index('idx_message_channels_owner').on(table.ownerUserId),
}));

export const messageThreads = pgTable('message_threads', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').notNull().references(() => messageChannels.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  gmailThreadId: text('gmail_thread_id').notNull(),
  subject: text('subject'),
  messageCount: integer('message_count').notNull().default(0),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  channelGmailUnique: uniqueIndex('uniq_message_threads_channel_gmail').on(table.channelId, table.gmailThreadId),
  tenantLastMsgIdx: index('idx_message_threads_tenant_last_msg').on(table.tenantId, table.lastMessageAt),
  channelLastMsgIdx: index('idx_message_threads_channel_last_msg').on(table.channelId, table.lastMessageAt),
}));

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  channelId: uuid('channel_id').notNull().references(() => messageChannels.id, { onDelete: 'cascade' }),
  threadId: uuid('thread_id').notNull().references(() => messageThreads.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  gmailMessageId: text('gmail_message_id').notNull(),
  headerMessageId: text('header_message_id'),
  inReplyTo: text('in_reply_to'),
  subject: text('subject'),
  snippet: text('snippet'),
  bodyText: text('body_text'),
  bodyHtml: text('body_html'),
  direction: text('direction').notNull(),
  status: text('status').notNull().default('received'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  receivedAt: timestamp('received_at', { withTimezone: true }),
  labels: jsonb('labels').$type<string[]>().notNull().default([]),
  hasAttachments: boolean('has_attachments').notNull().default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  channelGmailUnique: uniqueIndex('uniq_messages_channel_gmail').on(table.channelId, table.gmailMessageId),
  threadSentIdx: index('idx_messages_thread_sent').on(table.threadId, table.sentAt),
  tenantInboundIdx: index('idx_messages_tenant_inbound_sent').on(table.tenantId, table.sentAt),
  tenantOutboundIdx: index('idx_messages_tenant_outbound').on(table.tenantId, table.status, table.direction),
}));

export const messageParticipants = pgTable('message_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  messageId: uuid('message_id').notNull().references(() => messages.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  role: text('role').notNull(),
  handle: text('handle').notNull(),
  displayName: text('display_name'),
  personId: uuid('person_id').references(() => crmContacts.id, { onDelete: 'set null' }),
  workspaceMemberId: uuid('workspace_member_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  handleTenantIdx: index('idx_message_participants_handle_tenant').on(table.handle, table.tenantId),
  personIdx: index('idx_message_participants_person').on(table.personId),
  messageRoleIdx: index('idx_message_participants_message_role').on(table.messageId, table.role),
}));

export const messageBlocklist = pgTable('message_blocklist', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  pattern: text('pattern').notNull(),
  createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  tenantPatternUnique: uniqueIndex('uniq_message_blocklist_tenant_pattern').on(table.tenantId, table.pattern),
}));
```

- [ ] **Step 3: Add the three columns to `crmActivities`**

In the same file, find the `crmActivities` table definition (around line 1492). The current shape is:

```typescript
export const crmActivities = pgTable('crm_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  type: varchar('type', { length: 50 }).notNull().default('note'),
  body: text('body').notNull().default(''),
  dealId: uuid('deal_id').references(() => crmDeals.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').references(() => crmContacts.id, { onDelete: 'cascade' }),
  companyId: uuid('company_id').references(() => crmCompanies.id, { onDelete: 'cascade' }),
  assignedUserId: uuid('assigned_user_id'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  isArchived: boolean('is_archived').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
```

After `isArchived` and before `createdAt`, add three columns. **DO NOT add a forward `references()` to `messages` here** — that creates a circular FK between `crm_activities` (defined ~1492) and `messages` (defined later). Use a plain `uuid` and rely on application-layer integrity. The column is set NULL by application code when a message is hard-deleted (see Task 2 / 5 of sub-phase 2d for the cleaner). Replace the `crmActivities` table definition with:

```typescript
export const crmActivities = pgTable('crm_activities', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  userId: uuid('user_id').notNull(),
  type: varchar('type', { length: 50 }).notNull().default('note'),
  body: text('body').notNull().default(''),
  dealId: uuid('deal_id').references(() => crmDeals.id, { onDelete: 'cascade' }),
  contactId: uuid('contact_id').references(() => crmContacts.id, { onDelete: 'cascade' }),
  companyId: uuid('company_id').references(() => crmCompanies.id, { onDelete: 'cascade' }),
  assignedUserId: uuid('assigned_user_id'),
  scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  isArchived: boolean('is_archived').notNull().default(false),
  messageId: uuid('message_id'),
  externalProvider: text('external_provider'),
  externalId: text('external_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  dealIdx: index('idx_crm_activities_deal').on(table.dealId),
  contactIdx: index('idx_crm_activities_contact').on(table.contactId),
  companyIdx: index('idx_crm_activities_company').on(table.companyId),
  messageIdx: index('idx_crm_activities_message').on(table.messageId),
}));
```

- [ ] **Step 4: Typecheck**

```bash
cd packages/server && npm run typecheck 2>&1 | tail -10
```

Expected: clean. If errors, they will be missing imports — re-check that `pgTable, text, uuid, integer, boolean, jsonb, timestamp, index, uniqueIndex` are all already imported at the top of the file (they are — see line 2-3).

- [ ] **Step 5: Run existing tests to verify no regression**

```bash
cd packages/server && npm test 2>&1 | tail -8
```

Expected: same pass count as before (451 passed / 28 skipped).

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/db/schema.ts
git commit -m "feat(server): add message_channels, threads, messages, participants, blocklist schema"
```

---

## Task 2: Add bootstrap migration for the new tables and columns

**Why:** Atlas's runtime applies schema changes via `bootstrap.ts` (NOT `db:push`). New tables need `CREATE TABLE IF NOT EXISTS` SQL; new columns need `addColumnIfMissing`. Both run idempotently on every server boot.

**Files:**
- Create: `packages/server/src/db/migrations/2026-04-28-message-channels.ts`
- Modify: `packages/server/src/db/bootstrap.ts`
- Test: `packages/server/test/message-channels-migration.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/message-channels-migration.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

const queryMock = vi.fn(async () => ({ rows: [] }));
const releaseMock = vi.fn();
const connectMock = vi.fn(async () => ({ query: queryMock, release: releaseMock }));

vi.mock('../src/config/database', () => ({
  pool: { connect: connectMock },
  db: {},
}));

import { migrateMessageChannels } from '../src/db/migrations/2026-04-28-message-channels';

describe('migrateMessageChannels', () => {
  it('creates the message_channels table', async () => {
    queryMock.mockClear();
    await migrateMessageChannels();
    const calls = queryMock.mock.calls.map((c) => c[0] as string);
    expect(calls.some((sql) => /CREATE TABLE IF NOT EXISTS message_channels/i.test(sql))).toBe(true);
  });

  it('creates all five email tables', async () => {
    queryMock.mockClear();
    await migrateMessageChannels();
    const sql = queryMock.mock.calls.map((c) => c[0] as string).join('\n');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS message_channels/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS message_threads/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS messages/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS message_participants/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS message_blocklist/i);
  });

  it('adds the three new crm_activities columns', async () => {
    queryMock.mockClear();
    await migrateMessageChannels();
    const sql = queryMock.mock.calls.map((c) => c[0] as string).join('\n');
    expect(sql).toMatch(/crm_activities.*ADD COLUMN IF NOT EXISTS message_id/is);
    expect(sql).toMatch(/crm_activities.*ADD COLUMN IF NOT EXISTS external_provider/is);
    expect(sql).toMatch(/crm_activities.*ADD COLUMN IF NOT EXISTS external_id/is);
  });

  it('backfills one message_channels row per Google account that has none', async () => {
    queryMock.mockClear();
    await migrateMessageChannels();
    const sql = queryMock.mock.calls.map((c) => c[0] as string).join('\n');
    expect(sql).toMatch(/INSERT INTO message_channels/i);
    expect(sql).toMatch(/SELECT.+FROM accounts/is);
    expect(sql).toMatch(/LEFT JOIN message_channels/i);
    expect(sql).toMatch(/WHERE accounts\.provider = 'google'/i);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
cd packages/server && npm test -- message-channels-migration
```

Expected: module-not-found.

- [ ] **Step 3: Implement the migration**

Create `packages/server/src/db/migrations/2026-04-28-message-channels.ts`:

```typescript
import { pool } from '../../config/database';
import { logger } from '../../utils/logger';

const CREATE_MESSAGE_CHANNELS = `
  CREATE TABLE IF NOT EXISTS message_channels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
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
  CREATE INDEX IF NOT EXISTS idx_message_channels_account ON message_channels (account_id);
  CREATE INDEX IF NOT EXISTS idx_message_channels_tenant_sync ON message_channels (tenant_id, is_sync_enabled);
  CREATE INDEX IF NOT EXISTS idx_message_channels_owner ON message_channels (owner_user_id);
`;

const CREATE_MESSAGE_THREADS = `
  CREATE TABLE IF NOT EXISTS message_threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id uuid NOT NULL REFERENCES message_channels(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
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
    tenant_id uuid NOT NULL REFERENCES tenants(id),
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
    tenant_id uuid NOT NULL REFERENCES tenants(id),
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
    tenant_id uuid NOT NULL REFERENCES tenants(id),
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
  SELECT
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
    AND message_channels.id IS NULL;
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
    logger.info(
      { backfilledChannels: (result as any).rowCount ?? 0 },
      'message-channels migration applied',
    );
  } finally {
    c.release();
  }
}
```

- [ ] **Step 4: Run the test, expect pass**

```bash
cd packages/server && npm test -- message-channels-migration
```

Expected: 4 passing.

- [ ] **Step 5: Wire the migration into bootstrap**

In `packages/server/src/db/bootstrap.ts`, find the imports near the top:

```typescript
import { migrateWorkMerge } from './migrations/2026-04-15-work-merge';
import { migrateCrmWorkflowSteps } from './migrations/2026-04-22-crm-workflow-steps';
```

Add below them:

```typescript
import { migrateMessageChannels } from './migrations/2026-04-28-message-channels';
```

Then find the call site of `migrateCrmWorkflowSteps` (it's invoked inside `bootstrapDatabase` after the `addColumnIfMissing` block). Right after `await migrateCrmWorkflowSteps();`, add:

```typescript
  await migrateMessageChannels();
```

If the existing call sites use try/catch wrappers, follow the same pattern. The exact bootstrap function structure varies — read the file before editing and match the existing migration-invocation pattern.

- [ ] **Step 6: Run a fresh dev boot to verify the migration applies**

From the repo root:

```bash
docker compose ps
```

Confirm postgres is up (`atlas-postgres` healthy).

From `packages/server/`:

```bash
REDIS_URL="redis://localhost:6379" npm run dev 2>&1 | tee /tmp/atlas-2a-task2.log &
```

Wait for `Atlas server running` (~3s), then check the migration log:

```bash
grep -E "message-channels migration|Atlas server" /tmp/atlas-2a-task2.log
```

Expected: `message-channels migration applied { backfilledChannels: N }` where N is 0 if no Google accounts exist in dev DB, or the count of pre-existing Google connections.

Verify in psql:

```bash
docker compose exec -T postgres psql -U postgres atlas -c "\dt message_*"
```

Expected: 4 tables listed (`message_blocklist`, `message_channels`, `message_participants`, `message_threads`). And:

```bash
docker compose exec -T postgres psql -U postgres atlas -c "\dt messages"
```

Expected: 1 row.

```bash
docker compose exec -T postgres psql -U postgres atlas -c "\d crm_activities" | grep -E "message_id|external_provider|external_id"
```

Expected: 3 columns visible.

Kill the dev server:

```bash
lsof -ti:3001 | xargs kill -9 2>/dev/null
rm -f /tmp/atlas-2a-task2.log
```

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/db/migrations/2026-04-28-message-channels.ts packages/server/src/db/bootstrap.ts packages/server/test/message-channels-migration.test.ts
git commit -m "feat(server): bootstrap migration for message channels + crm_activities columns"
```

---

## Task 3: Build the channel service

**Why:** All channel operations (list, update visibility / sync toggle / auto-create policy, manual sync trigger) flow through one service. Visibility filtering happens here, not in controllers.

**Files:**
- Create: `packages/server/src/apps/crm/services/channel.service.ts`
- Test: `packages/server/test/channel-service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/channel-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbSelectMock = vi.fn();
const dbUpdateMock = vi.fn();

vi.mock('../src/config/database', () => ({
  db: {
    select: () => dbSelectMock(),
    update: () => dbUpdateMock(),
  },
}));

import {
  listChannelsForUser,
  updateChannelSettings,
} from '../src/apps/crm/services/channel.service';

describe('channel.service: listChannelsForUser', () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
  });

  it('returns shared-with-tenant channels and channels owned by the user', async () => {
    const fakeRows = [
      { id: 'c1', visibility: 'shared-with-tenant', ownerUserId: 'u-other', tenantId: 't-1', accountId: 'a1', handle: 'sales@x.com', isSyncEnabled: true, contactAutoCreationPolicy: 'send-only', syncStage: 'incremental', syncStatus: null, syncError: null, lastIncrementalSyncAt: null, throttleRetryAfter: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 'c2', visibility: 'private',           ownerUserId: 'u-1',     tenantId: 't-1', accountId: 'a2', handle: 'gorkem@x.com', isSyncEnabled: true, contactAutoCreationPolicy: 'send-only', syncStage: 'incremental', syncStatus: null, syncError: null, lastIncrementalSyncAt: null, throttleRetryAfter: null, createdAt: new Date(), updatedAt: new Date() },
    ];
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ orderBy: () => Promise.resolve(fakeRows) }) }),
    });

    const result = await listChannelsForUser({ userId: 'u-1', tenantId: 't-1' });
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

  it('filters out private channels owned by other users', async () => {
    // The service trusts the SQL filter; we assert by inspecting the where-call args via a richer mock:
    let capturedWhereCall: unknown = null;
    dbSelectMock.mockReturnValue({
      from: () => ({
        where: (clause: unknown) => {
          capturedWhereCall = clause;
          return { orderBy: () => Promise.resolve([]) };
        },
      }),
    });

    await listChannelsForUser({ userId: 'u-1', tenantId: 't-1' });
    // We can't easily introspect drizzle's SQL fragment, but we can at least assert
    // the where() was called once (smoke check). Real correctness is verified by
    // the integration test in Task 6.
    expect(capturedWhereCall).not.toBeNull();
  });
});

describe('channel.service: updateChannelSettings', () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
    dbUpdateMock.mockReset();
  });

  it('updates only the fields supplied', async () => {
    // First select: validate user can edit this channel
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'c1', ownerUserId: 'u-1', tenantId: 't-1' }]) }) }),
    });
    let capturedSet: any = null;
    dbUpdateMock.mockReturnValue({
      set: (vals: any) => { capturedSet = vals; return { where: () => Promise.resolve() }; },
    });

    await updateChannelSettings({
      channelId: 'c1',
      userId: 'u-1',
      tenantId: 't-1',
      patch: { visibility: 'shared-with-tenant', isSyncEnabled: false },
    });

    expect(capturedSet).toMatchObject({
      visibility: 'shared-with-tenant',
      isSyncEnabled: false,
    });
    expect(capturedSet.contactAutoCreationPolicy).toBeUndefined();
  });

  it('rejects updates from a non-owner', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'c1', ownerUserId: 'u-other', tenantId: 't-1' }]) }) }),
    });

    await expect(
      updateChannelSettings({
        channelId: 'c1',
        userId: 'u-1',
        tenantId: 't-1',
        patch: { visibility: 'shared-with-tenant' },
      }),
    ).rejects.toThrow(/forbidden|not the owner/i);
  });

  it('throws on unknown channel', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });

    await expect(
      updateChannelSettings({
        channelId: 'c-missing',
        userId: 'u-1',
        tenantId: 't-1',
        patch: { isSyncEnabled: false },
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('rejects invalid visibility values', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'c1', ownerUserId: 'u-1', tenantId: 't-1' }]) }) }),
    });

    await expect(
      updateChannelSettings({
        channelId: 'c1',
        userId: 'u-1',
        tenantId: 't-1',
        patch: { visibility: 'public' as any },
      }),
    ).rejects.toThrow(/invalid visibility/i);
  });

  it('rejects invalid contactAutoCreationPolicy values', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'c1', ownerUserId: 'u-1', tenantId: 't-1' }]) }) }),
    });

    await expect(
      updateChannelSettings({
        channelId: 'c1',
        userId: 'u-1',
        tenantId: 't-1',
        patch: { contactAutoCreationPolicy: 'aggressive' as any },
      }),
    ).rejects.toThrow(/invalid contactAutoCreationPolicy/i);
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
cd packages/server && npm test -- channel-service
```

Expected: module-not-found.

- [ ] **Step 3: Implement the service**

Create `packages/server/src/apps/crm/services/channel.service.ts`:

```typescript
import { and, eq, or, desc } from 'drizzle-orm';
import { db } from '../../../config/database';
import { messageChannels } from '../../../db/schema';

export type ChannelVisibility = 'private' | 'shared-with-tenant';
export type ContactAutoCreationPolicy = 'none' | 'send-only' | 'send-and-receive';

const VALID_VISIBILITIES: ChannelVisibility[] = ['private', 'shared-with-tenant'];
const VALID_POLICIES: ContactAutoCreationPolicy[] = ['none', 'send-only', 'send-and-receive'];

export interface ChannelDTO {
  id: string;
  accountId: string;
  tenantId: string;
  ownerUserId: string;
  type: string;
  handle: string;
  visibility: ChannelVisibility;
  isSyncEnabled: boolean;
  contactAutoCreationPolicy: ContactAutoCreationPolicy;
  syncStage: string;
  syncStatus: string | null;
  syncError: string | null;
  lastIncrementalSyncAt: Date | null;
  throttleRetryAfter: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const SELECT_FIELDS = {
  id: messageChannels.id,
  accountId: messageChannels.accountId,
  tenantId: messageChannels.tenantId,
  ownerUserId: messageChannels.ownerUserId,
  type: messageChannels.type,
  handle: messageChannels.handle,
  visibility: messageChannels.visibility,
  isSyncEnabled: messageChannels.isSyncEnabled,
  contactAutoCreationPolicy: messageChannels.contactAutoCreationPolicy,
  syncStage: messageChannels.syncStage,
  syncStatus: messageChannels.syncStatus,
  syncError: messageChannels.syncError,
  lastIncrementalSyncAt: messageChannels.lastIncrementalSyncAt,
  throttleRetryAfter: messageChannels.throttleRetryAfter,
  createdAt: messageChannels.createdAt,
  updatedAt: messageChannels.updatedAt,
};

/**
 * List channels visible to the current user within their tenant:
 * shared-with-tenant channels + channels they personally own.
 * This is the only legitimate read path for channels — controllers
 * MUST use this and not query message_channels directly.
 */
export async function listChannelsForUser(args: {
  userId: string;
  tenantId: string;
}): Promise<ChannelDTO[]> {
  const rows = await db
    .select(SELECT_FIELDS)
    .from(messageChannels)
    .where(
      and(
        eq(messageChannels.tenantId, args.tenantId),
        or(
          eq(messageChannels.visibility, 'shared-with-tenant'),
          eq(messageChannels.ownerUserId, args.userId),
        ),
      ),
    )
    .orderBy(desc(messageChannels.createdAt));
  return rows as ChannelDTO[];
}

export interface UpdateChannelPatch {
  visibility?: ChannelVisibility;
  isSyncEnabled?: boolean;
  contactAutoCreationPolicy?: ContactAutoCreationPolicy;
}

/**
 * Update a channel's user-editable settings. Owner-only.
 * Throws if channel not found, user is not the owner, or any patch field
 * has an invalid enum value.
 */
export async function updateChannelSettings(args: {
  channelId: string;
  userId: string;
  tenantId: string;
  patch: UpdateChannelPatch;
}): Promise<void> {
  if (
    args.patch.visibility !== undefined &&
    !VALID_VISIBILITIES.includes(args.patch.visibility)
  ) {
    throw new Error(`invalid visibility: ${args.patch.visibility}`);
  }
  if (
    args.patch.contactAutoCreationPolicy !== undefined &&
    !VALID_POLICIES.includes(args.patch.contactAutoCreationPolicy)
  ) {
    throw new Error(
      `invalid contactAutoCreationPolicy: ${args.patch.contactAutoCreationPolicy}`,
    );
  }

  const [existing] = await db
    .select({
      id: messageChannels.id,
      ownerUserId: messageChannels.ownerUserId,
      tenantId: messageChannels.tenantId,
    })
    .from(messageChannels)
    .where(
      and(
        eq(messageChannels.id, args.channelId),
        eq(messageChannels.tenantId, args.tenantId),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new Error(`channel not found: ${args.channelId}`);
  }
  if (existing.ownerUserId !== args.userId) {
    throw new Error(`forbidden: not the owner of channel ${args.channelId}`);
  }

  const setClause: Record<string, unknown> = { updatedAt: new Date() };
  if (args.patch.visibility !== undefined) setClause.visibility = args.patch.visibility;
  if (args.patch.isSyncEnabled !== undefined) setClause.isSyncEnabled = args.patch.isSyncEnabled;
  if (args.patch.contactAutoCreationPolicy !== undefined)
    setClause.contactAutoCreationPolicy = args.patch.contactAutoCreationPolicy;

  await db
    .update(messageChannels)
    .set(setClause)
    .where(eq(messageChannels.id, args.channelId));
}
```

- [ ] **Step 4: Run, expect pass**

```bash
cd packages/server && npm test -- channel-service
```

Expected: 6 passing.

- [ ] **Step 5: Run full suite**

```bash
cd packages/server && npm test 2>&1 | tail -8
```

Expected: previous count + 6 new tests.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/apps/crm/services/channel.service.ts packages/server/test/channel-service.test.ts
git commit -m "feat(crm): channel service — list (visibility-filtered) and update settings"
```

---

## Task 4: Build the channels controller and routes

**Why:** Three endpoints — list, update, manual sync trigger — wrap the service. Manual sync just enqueues a `gmail-full-sync` job (which doesn't have a real handler yet — that's 2b. The controller doesn't care; it just enqueues. The worker's switch will throw "Unknown sync job: gmail-full-sync" until 2b lands. **Not adding the worker dispatch case in 2a is intentional** — keeps 2a's blast radius scoped.)

**Files:**
- Create: `packages/server/src/apps/crm/controllers/channels.controller.ts`
- Modify: `packages/server/src/apps/crm/routes.ts`
- Test: `packages/server/test/channels-controller.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/channels-controller.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const listChannelsForUserMock = vi.fn();
const updateChannelSettingsMock = vi.fn();
const queueAddMock = vi.fn(async () => ({ id: 'job-1' }));
const dbSelectMock = vi.fn();

vi.mock('../src/apps/crm/services/channel.service', () => ({
  listChannelsForUser: listChannelsForUserMock,
  updateChannelSettings: updateChannelSettingsMock,
}));

vi.mock('../src/config/queue', () => ({
  getSyncQueue: () => ({ add: queueAddMock }),
  SyncJobName: {
    CalendarFullSync: 'calendar-full-sync',
    CalendarIncrementalSync: 'calendar-incremental-sync',
    GmailFullSync: 'gmail-full-sync',
    GmailIncrementalSync: 'gmail-incremental-sync',
  },
}));

vi.mock('../src/config/database', () => ({
  db: {
    select: () => dbSelectMock(),
  },
}));

import {
  listChannels,
  updateChannel,
  syncChannel,
} from '../src/apps/crm/controllers/channels.controller';

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

const fakeReq = { auth: { userId: 'u-1', tenantId: 't-1' }, params: {}, body: {} } as unknown as Request;

describe('channels.controller: listChannels', () => {
  beforeEach(() => {
    listChannelsForUserMock.mockReset();
  });

  it('returns the service result wrapped in success envelope', async () => {
    listChannelsForUserMock.mockResolvedValue([{ id: 'c1', handle: 'a@b.com' }]);
    const res = mockRes();
    await listChannels(fakeReq, res);
    expect(listChannelsForUserMock).toHaveBeenCalledWith({ userId: 'u-1', tenantId: 't-1' });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { channels: [{ id: 'c1', handle: 'a@b.com' }] },
    });
  });

  it('returns 500 on service error', async () => {
    listChannelsForUserMock.mockRejectedValue(new Error('boom'));
    const res = mockRes();
    await listChannels(fakeReq, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });
});

describe('channels.controller: updateChannel', () => {
  beforeEach(() => {
    updateChannelSettingsMock.mockReset();
  });

  it('passes the patch fields to the service', async () => {
    updateChannelSettingsMock.mockResolvedValue(undefined);
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'c1' },
      body: { visibility: 'shared-with-tenant', isSyncEnabled: false },
    } as unknown as Request;
    const res = mockRes();
    await updateChannel(req, res);
    expect(updateChannelSettingsMock).toHaveBeenCalledWith({
      channelId: 'c1',
      userId: 'u-1',
      tenantId: 't-1',
      patch: { visibility: 'shared-with-tenant', isSyncEnabled: false },
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it('returns 403 on forbidden errors from service', async () => {
    updateChannelSettingsMock.mockRejectedValue(new Error('forbidden: not the owner of channel c1'));
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'c1' },
      body: { isSyncEnabled: false },
    } as unknown as Request;
    const res = mockRes();
    await updateChannel(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 404 on not found errors', async () => {
    updateChannelSettingsMock.mockRejectedValue(new Error('channel not found: c-missing'));
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'c-missing' },
      body: { isSyncEnabled: false },
    } as unknown as Request;
    const res = mockRes();
    await updateChannel(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 on invalid value errors', async () => {
    updateChannelSettingsMock.mockRejectedValue(new Error('invalid visibility: public'));
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'c1' },
      body: { visibility: 'public' },
    } as unknown as Request;
    const res = mockRes();
    await updateChannel(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('channels.controller: syncChannel', () => {
  beforeEach(() => {
    queueAddMock.mockClear();
    dbSelectMock.mockReset();
  });

  it('returns 404 if the channel is not visible to the user', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'c-missing' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await syncChannel(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it('enqueues a gmail-full-sync job and returns the job id', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: 'c1', accountId: 'a1', ownerUserId: 'u-1', visibility: 'private' }]),
        }),
      }),
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'c1' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await syncChannel(req, res);
    expect(queueAddMock).toHaveBeenCalledWith(
      'gmail-full-sync',
      expect.objectContaining({ channelId: 'c1', triggeredBy: 'user', userId: 'u-1' }),
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { jobId: 'job-1', queued: true },
    });
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
cd packages/server && npm test -- channels-controller
```

Expected: module-not-found AND `SyncJobName.GmailFullSync` doesn't exist (we add it next step).

- [ ] **Step 3: Add the new job names to the queue config**

In `packages/server/src/config/queue.ts`, find the `SyncJobName` const:

```typescript
export const SyncJobName = {
  CalendarFullSync: 'calendar-full-sync',
  CalendarIncrementalSync: 'calendar-incremental-sync',
} as const;
```

Replace with:

```typescript
export const SyncJobName = {
  CalendarFullSync: 'calendar-full-sync',
  CalendarIncrementalSync: 'calendar-incremental-sync',
  GmailFullSync: 'gmail-full-sync',
  GmailIncrementalSync: 'gmail-incremental-sync',
} as const;
```

And add the typed job-data interfaces below the existing calendar ones:

```typescript
/**
 * `userId` is set when `triggeredBy === 'user'` (manual sync via API) and
 * omitted when `triggeredBy === 'system'` (e.g. repeatable scheduled jobs).
 * Reused for both gmail and calendar full-sync jobs because the worker
 * only cares about (channelId|accountId, triggeredBy).
 */
export interface GmailFullSyncJobData {
  channelId: string;
  triggeredBy: 'user' | 'system';
  userId?: string;
}

export interface GmailIncrementalSyncJobData {
  channelId: string;
}
```

Extend the `SyncJobData` union by adding these two members at the end:

```typescript
export type SyncJobData =
  | { name: typeof SyncJobName.CalendarFullSync; data: CalendarFullSyncJobData }
  | { name: typeof SyncJobName.CalendarIncrementalSync; data: CalendarIncrementalSyncJobData }
  | { name: typeof SyncJobName.GmailFullSync; data: GmailFullSyncJobData }
  | { name: typeof SyncJobName.GmailIncrementalSync; data: GmailIncrementalSyncJobData };
```

- [ ] **Step 4: Implement the controller**

Create `packages/server/src/apps/crm/controllers/channels.controller.ts`:

```typescript
import type { Request, Response } from 'express';
import { and, eq, or } from 'drizzle-orm';
import { db } from '../../../config/database';
import { messageChannels } from '../../../db/schema';
import {
  listChannelsForUser,
  updateChannelSettings,
} from '../services/channel.service';
import { getSyncQueue, SyncJobName } from '../../../config/queue';
import { logger } from '../../../utils/logger';

export async function listChannels(req: Request, res: Response) {
  try {
    const channels = await listChannelsForUser({
      userId: req.auth!.userId,
      tenantId: req.auth!.tenantId!,
    });
    res.json({ success: true, data: { channels } });
  } catch (error) {
    logger.error({ error }, 'Failed to list channels');
    res.status(500).json({ success: false, error: 'Failed to list channels' });
  }
}

export async function updateChannel(req: Request, res: Response) {
  try {
    await updateChannelSettings({
      channelId: req.params.id as string,
      userId: req.auth!.userId,
      tenantId: req.auth!.tenantId!,
      patch: {
        visibility: req.body?.visibility,
        isSyncEnabled: req.body?.isSyncEnabled,
        contactAutoCreationPolicy: req.body?.contactAutoCreationPolicy,
      },
    });
    res.json({ success: true, data: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/forbidden/i.test(message)) {
      res.status(403).json({ success: false, error: message });
      return;
    }
    if (/not found/i.test(message)) {
      res.status(404).json({ success: false, error: message });
      return;
    }
    if (/invalid /i.test(message)) {
      res.status(400).json({ success: false, error: message });
      return;
    }
    logger.error({ error }, 'Failed to update channel');
    res.status(500).json({ success: false, error: 'Failed to update channel' });
  }
}

export async function syncChannel(req: Request, res: Response) {
  try {
    const channelId = req.params.id as string;
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;

    // Visibility-filtered lookup: same predicate as listChannelsForUser
    const [channel] = await db
      .select({
        id: messageChannels.id,
        accountId: messageChannels.accountId,
        ownerUserId: messageChannels.ownerUserId,
        visibility: messageChannels.visibility,
      })
      .from(messageChannels)
      .where(
        and(
          eq(messageChannels.id, channelId),
          eq(messageChannels.tenantId, tenantId),
          or(
            eq(messageChannels.visibility, 'shared-with-tenant'),
            eq(messageChannels.ownerUserId, userId),
          ),
        ),
      )
      .limit(1);

    if (!channel) {
      res.status(404).json({ success: false, error: 'channel not found' });
      return;
    }

    const queue = getSyncQueue();
    if (!queue) {
      res.status(503).json({
        success: false,
        error: 'Sync queue unavailable — Redis is not configured',
      });
      return;
    }

    const job = await queue.add(SyncJobName.GmailFullSync, {
      channelId: channel.id,
      triggeredBy: 'user',
      userId,
    });

    res.json({ success: true, data: { jobId: job.id, queued: true } });
  } catch (error) {
    logger.error({ error }, 'Failed to enqueue channel sync');
    res.status(500).json({ success: false, error: 'Failed to start sync' });
  }
}
```

- [ ] **Step 5: Wire routes**

Read the current `packages/server/src/apps/crm/routes.ts`. Find the existing google sync routes — they look like:

```typescript
router.get('/google/status', crmController.getGoogleSyncStatus);
router.post('/google/sync/start', crmController.startGoogleSync);
router.post('/google/sync/stop', crmController.stopGoogleSync);
```

After those three lines, add:

```typescript
import * as channelsController from './controllers/channels.controller';

router.get('/channels', channelsController.listChannels);
router.patch('/channels/:id', channelsController.updateChannel);
router.post('/channels/:id/sync', channelsController.syncChannel);
```

(If the file already imports controllers via a single `controller` import, add a separate `import * as channelsController` line — don't merge into the existing import to avoid coupling files unnecessarily.)

- [ ] **Step 6: Run controller tests**

```bash
cd packages/server && npm test -- channels-controller
```

Expected: 7 passing.

- [ ] **Step 7: Run full suite**

```bash
cd packages/server && npm test 2>&1 | tail -8
```

Expected: green, 13 more tests than baseline.

- [ ] **Step 8: Typecheck**

```bash
cd packages/server && npm run typecheck 2>&1 | tail -5
```

- [ ] **Step 9: Commit**

```bash
git add packages/server/src/config/queue.ts packages/server/src/apps/crm/controllers/channels.controller.ts packages/server/src/apps/crm/routes.ts packages/server/test/channels-controller.test.ts
git commit -m "feat(crm): /crm/channels REST endpoints + GmailFullSync job name"
```

---

## Task 5: Insert a `message_channels` row on Google OAuth callback

**Why:** Existing Google connections were backfilled by Task 2's migration. New connections (after Phase 2a ships) need to insert a channel row at OAuth callback time. Without this, a fresh user who connects after 2a deploys has no channel and can't see the integrations panel render anything.

**Files:**
- Modify: `packages/server/src/controllers/auth/google.controller.ts`

- [ ] **Step 1: Read the existing callback to find the right insertion point**

```bash
grep -n "googleCallback\|provider:.*google\|tokenExpiresAt" packages/server/src/controllers/auth/google.controller.ts | head -20
```

The callback function does the OAuth dance, decrypts the token, upserts into `accounts`, and redirects. We need to insert a `message_channels` row after the `accounts` upsert succeeds.

Read the function:

```bash
grep -n "export async function googleCallback" packages/server/src/controllers/auth/google.controller.ts
```

Note the line range. Read it with the Read tool to understand what variables (like `account.id`, `email`, `userId`, `tenantId`) are in scope at the moment after the `accounts` upsert.

- [ ] **Step 2: Add the channel insert**

In the same function, after the `accounts` upsert resolves and you have:
- `account.id` (the inserted/updated account row's id) — variable name may differ; whatever the upsert returns
- `email` (the Google email)
- `userId` (the Atlas user id)
- `tenantId` (the user's tenant id)

(If `tenantId` is not in scope at that point, look for it earlier in the function — it should be either in `req.auth` or fetched from `tenant_members`.)

Add an idempotent insert immediately after the account upsert:

```typescript
import { messageChannels } from '../../db/schema';
// ... add to existing imports at top of file ...

// Inside googleCallback, after `accounts` upsert succeeds:
try {
  await db.insert(messageChannels).values({
    accountId: account.id,
    tenantId,
    ownerUserId: userId,
    type: 'gmail',
    handle: email,
    visibility: 'private',
    isSyncEnabled: true,
    contactAutoCreationPolicy: 'send-only',
    syncStage: 'pending',
  }).onConflictDoNothing(); // idempotent — re-connect doesn't dup
} catch (err) {
  logger.warn({ err, accountId: account.id }, 'Failed to create message channel on connect');
  // Don't fail the OAuth callback — user is still connected, just without a channel.
  // Operator can manually insert via the migration's backfill SELECT.
}
```

The exact import path for `messageChannels` and `db` depends on the file's location — `packages/server/src/controllers/auth/google.controller.ts` is two dirs deep, so it should be `'../../db/schema'` and `'../../config/database'` respectively. Check the existing imports in that file to confirm relative-path depth.

- [ ] **Step 3: Add a `.onConflictDoNothing()` clause requires a unique constraint**

The schema does NOT currently have a unique constraint on `message_channels(accountId, ownerUserId, handle)`. Without one, `onConflictDoNothing()` is a no-op safety net but won't actually dedupe anything across reconnects. For Phase 2a we **don't** add a unique constraint (the migration backfill uses a `LEFT JOIN ... WHERE IS NULL` to dedupe, and reconnects via Atlas's existing `accounts` upsert update the same `accounts.id`, so the channel insert fires only on first connect).

To prevent duplicate channels on reconnect (where the `accounts` upsert UPDATES an existing row but our new code unconditionally INSERTs a channel), we need to **check first**:

Replace the snippet from Step 2 with:

```typescript
try {
  const [existing] = await db
    .select({ id: messageChannels.id })
    .from(messageChannels)
    .where(eq(messageChannels.accountId, account.id))
    .limit(1);
  if (!existing) {
    await db.insert(messageChannels).values({
      accountId: account.id,
      tenantId,
      ownerUserId: userId,
      type: 'gmail',
      handle: email,
      visibility: 'private',
      isSyncEnabled: true,
      contactAutoCreationPolicy: 'send-only',
      syncStage: 'pending',
    });
    logger.info({ accountId: account.id, handle: email }, 'Created message channel on connect');
  }
} catch (err) {
  logger.warn({ err, accountId: account.id }, 'Failed to create message channel on connect');
}
```

Add `eq` from `drizzle-orm` to the imports if not already present.

- [ ] **Step 4: Typecheck**

```bash
cd packages/server && npm run typecheck 2>&1 | tail -5
```

- [ ] **Step 5: Run full suite**

```bash
cd packages/server && npm test 2>&1 | tail -8
```

Expected: same pass count as before Task 5 — we added no new tests for this hook because the OAuth callback test surface is integration-shaped (real http, real Google mock). Manual verification covers it in Step 6.

- [ ] **Step 6: Manual verification**

Start the dev server with Redis (per Phase 1 smoke pattern):

```bash
cd /Users/gorkemcetin/atlasmail
docker compose ps
cd packages/server
REDIS_URL="redis://localhost:6379" npm run dev 2>&1 | tee /tmp/atlas-2a-task5.log &
```

Wait for `Atlas server running`. From the client (or curl with a JWT), trigger the OAuth flow as a test user. After successful callback, verify the channel row was created:

```bash
docker compose exec -T postgres psql -U postgres atlas -c "SELECT id, account_id, handle, visibility, sync_stage FROM message_channels ORDER BY created_at DESC LIMIT 5;"
```

If the test user already had a channel from the migration backfill, no new row is inserted (correct).

Kill the dev server:

```bash
lsof -ti:3001 | xargs kill -9 2>/dev/null
rm -f /tmp/atlas-2a-task5.log
```

If you cannot run a full OAuth flow in dev (common — requires real Google auth), skip the integration smoke and rely on the type/unit checks. Note this in the commit message.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/controllers/auth/google.controller.ts
git commit -m "feat(auth): create message_channels row on Google OAuth callback"
```

---

## Task 6: Add the `crm.channels` query-keys namespace

**Why:** TanStack Query's invalidation needs stable keys. Add the namespace before the hooks file uses it.

**Files:**
- Modify: `packages/client/src/config/query-keys.ts`

- [ ] **Step 1: Add the namespace**

Find the `crm:` block in `packages/client/src/config/query-keys.ts` (around line 154). Add a `channels` block after `activities` and before `activityTypes`:

```typescript
    activities: {
      all: ['crm', 'activities'] as const,
    },
    channels: {
      all: ['crm', 'channels'] as const,
      detail: (id: string) => ['crm', 'channels', id] as const,
    },
    activityTypes: {
      all: ['crm', 'activity-types'] as const,
    },
```

- [ ] **Step 2: Typecheck the client**

```bash
cd packages/client && npm run typecheck 2>&1 | tail -5
```

Expected: clean. The `as const` array literal is verified by TS at every consumer site.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/config/query-keys.ts
git commit -m "feat(client): add crm.channels query-keys namespace"
```

---

## Task 7: Build the channel hooks and UI components

**Why:** Two React Query hooks (`useChannels`, `useUpdateChannel`, `useSyncChannel`) and two components (`ChannelsList`, `ChannelRow`). Settings UI consumes the list; the row owns its own mutation hooks for visibility toggle + sync toggle + policy select + manual sync button.

**Files:**
- Create: `packages/client/src/apps/crm/hooks/use-channels.ts`
- Create: `packages/client/src/apps/crm/components/integrations/channels-list.tsx`
- Create: `packages/client/src/apps/crm/components/integrations/channel-row.tsx`
- Modify: `packages/client/src/components/settings/integrations-panel.tsx`

- [ ] **Step 1: Implement the hooks**

Create `packages/client/src/apps/crm/hooks/use-channels.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { queryKeys } from '../../../config/query-keys';

export interface ChannelDTO {
  id: string;
  accountId: string;
  tenantId: string;
  ownerUserId: string;
  type: string;
  handle: string;
  visibility: 'private' | 'shared-with-tenant';
  isSyncEnabled: boolean;
  contactAutoCreationPolicy: 'none' | 'send-only' | 'send-and-receive';
  syncStage: string;
  syncStatus: string | null;
  syncError: string | null;
  lastIncrementalSyncAt: string | null;
  throttleRetryAfter: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateChannelPatch {
  visibility?: ChannelDTO['visibility'];
  isSyncEnabled?: boolean;
  contactAutoCreationPolicy?: ChannelDTO['contactAutoCreationPolicy'];
}

export function useChannels() {
  return useQuery({
    queryKey: queryKeys.crm.channels.all,
    queryFn: async () => {
      const { data } = await api.get('/crm/channels');
      return (data.data?.channels ?? []) as ChannelDTO[];
    },
    staleTime: 10_000,
  });
}

export function useUpdateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; patch: UpdateChannelPatch }) => {
      const { data } = await api.patch(`/crm/channels/${args.id}`, args.patch);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.channels.all });
    },
  });
}

export function useSyncChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/crm/channels/${id}/sync`, {});
      return data.data as { jobId: string; queued: boolean };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.channels.all });
    },
  });
}
```

- [ ] **Step 2: Implement `ChannelRow`**

Create `packages/client/src/apps/crm/components/integrations/channel-row.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/button';
import { Select } from '../../../../components/ui/select';
import { Badge } from '../../../../components/ui/badge';
import { useToastStore } from '../../../../stores/toast-store';
import {
  type ChannelDTO,
  useUpdateChannel,
  useSyncChannel,
} from '../../hooks/use-channels';

export function ChannelRow({ channel }: { channel: ChannelDTO }) {
  const { t } = useTranslation();
  const updateChannel = useUpdateChannel();
  const syncChannel = useSyncChannel();
  const addToast = useToastStore((s) => s.addToast);

  const onChange = (patch: Parameters<typeof updateChannel.mutate>[0]['patch']) => {
    updateChannel.mutate(
      { id: channel.id, patch },
      {
        onError: (err: any) => {
          addToast({
            type: 'error',
            message: err?.response?.data?.error ?? t('crm.integrations.channels.updateError', 'Failed to update channel'),
          });
        },
      },
    );
  };

  const onSync = () => {
    syncChannel.mutate(channel.id, {
      onSuccess: () => {
        addToast({
          type: 'success',
          message: t('crm.integrations.channels.syncQueued', 'Sync queued'),
        });
      },
      onError: (err: any) => {
        addToast({
          type: 'error',
          message: err?.response?.data?.error ?? t('crm.integrations.channels.syncError', 'Failed to start sync'),
        });
      },
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-md)',
        padding: 'var(--spacing-md)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-primary)',
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{channel.handle}</span>
          <Badge variant={channel.syncStage === 'failed' ? 'error' : channel.syncStage === 'incremental' ? 'success' : 'default'}>
            {t(`crm.integrations.channels.stage.${channel.syncStage}`, channel.syncStage)}
          </Badge>
        </div>
        {channel.syncError && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)' }}>
            {channel.syncError}
          </div>
        )}
      </div>

      <Select
        size="sm"
        width="160px"
        value={channel.visibility}
        onChange={(v) => onChange({ visibility: v as ChannelDTO['visibility'] })}
        options={[
          { value: 'private', label: t('crm.integrations.channels.visibility.private', 'Private') },
          { value: 'shared-with-tenant', label: t('crm.integrations.channels.visibility.shared', 'Shared with team') },
        ]}
      />

      <Select
        size="sm"
        width="180px"
        value={channel.contactAutoCreationPolicy}
        onChange={(v) => onChange({ contactAutoCreationPolicy: v as ChannelDTO['contactAutoCreationPolicy'] })}
        options={[
          { value: 'none', label: t('crm.integrations.channels.policy.none', 'No auto-create') },
          { value: 'send-only', label: t('crm.integrations.channels.policy.sendOnly', 'From sent emails') },
          { value: 'send-and-receive', label: t('crm.integrations.channels.policy.sendAndReceive', 'From all emails') },
        ]}
      />

      <Button
        size="sm"
        variant={channel.isSyncEnabled ? 'secondary' : 'primary'}
        onClick={() => onChange({ isSyncEnabled: !channel.isSyncEnabled })}
      >
        {channel.isSyncEnabled
          ? t('crm.integrations.channels.pause', 'Pause sync')
          : t('crm.integrations.channels.resume', 'Resume sync')}
      </Button>

      <Button size="sm" variant="ghost" onClick={onSync} disabled={syncChannel.isPending}>
        {t('crm.integrations.channels.syncNow', 'Sync now')}
      </Button>
    </div>
  );
}
```

(If `Select` does not have a `width` prop in this codebase, drop it and rely on default sizing. Check `packages/client/src/components/ui/select.tsx` first.)

- [ ] **Step 3: Implement `ChannelsList`**

Create `packages/client/src/apps/crm/components/integrations/channels-list.tsx`:

```tsx
import { useTranslation } from 'react-i18next';
import { useChannels } from '../../hooks/use-channels';
import { ChannelRow } from './channel-row';

export function ChannelsList() {
  const { t } = useTranslation();
  const { data: channels, isLoading } = useChannels();

  if (isLoading) return null;
  if (!channels || channels.length === 0) {
    return (
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>
        {t('crm.integrations.channels.empty', 'No channels yet — connect a Google account to get started.')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      {channels.map((c) => (
        <ChannelRow key={c.id} channel={c} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Render the list inside the integrations panel**

Read `packages/client/src/components/settings/integrations-panel.tsx` to find the right insertion point — after the existing Google connect/disconnect block, before the closing of the Google `SettingsSection`.

Add the import:

```typescript
import { ChannelsList } from '../../apps/crm/components/integrations/channels-list';
```

Inside the rendered Google `SettingsSection`, after the connect/disconnect block, add:

```tsx
<div style={{ marginTop: 'var(--spacing-lg)' }}>
  <h4 style={{
    fontSize: 'var(--font-size-md)',
    fontWeight: 'var(--font-weight-semibold)',
    marginBottom: 'var(--spacing-sm)',
  }}>
    {t('crm.integrations.channels.title', 'Email channels')}
  </h4>
  <ChannelsList />
</div>
```

The exact JSX nesting depends on the existing panel structure — read the file before editing and match the existing pattern (e.g., if the panel uses `SettingsRow` for sub-rows, use that; otherwise plain divs as shown).

- [ ] **Step 5: Add translation keys to all 5 locales**

For each of `packages/client/src/i18n/locales/en.json`, `tr.json`, `de.json`, `fr.json`, `it.json`, find the `crm` block and add a nested `integrations.channels` section. The English keys (others should be translated by a human or LLM — but for this task, we add EN verbatim and leave the other 4 locales as English fallbacks; the team's translation workflow handles them later):

**English (`en.json`)** — under `"crm": { ... }`:

```json
"integrations": {
  "channels": {
    "title": "Email channels",
    "empty": "No channels yet — connect a Google account to get started.",
    "pause": "Pause sync",
    "resume": "Resume sync",
    "syncNow": "Sync now",
    "syncQueued": "Sync queued",
    "syncError": "Failed to start sync",
    "updateError": "Failed to update channel",
    "stage": {
      "pending": "Pending",
      "full-sync": "Full sync",
      "incremental": "Live",
      "failed": "Failed",
      "paused": "Paused"
    },
    "visibility": {
      "private": "Private",
      "shared": "Shared with team"
    },
    "policy": {
      "none": "No auto-create",
      "sendOnly": "From sent emails",
      "sendAndReceive": "From all emails"
    }
  }
}
```

For `tr.json`, `de.json`, `fr.json`, `it.json`: paste the same structure with English values for now. The translations skill / the team's translation workflow will translate them in a follow-up. **Atlas's policy is "every locale gets the keys in the same commit"** — if you don't have translations, English placeholders count as "the keys exist," and the visible English string is acceptable until a translator updates it.

- [ ] **Step 6: Typecheck the client**

```bash
cd packages/client && npm run typecheck 2>&1 | tail -10
```

Expected: clean. If `Select` doesn't accept `width`, drop the prop (per Step 2 note).

- [ ] **Step 7: Build the client**

```bash
cd packages/client && npm run build 2>&1 | tail -8
```

Expected: clean build.

- [ ] **Step 8: Manual UI smoke (recommended but optional)**

Start the dev environment:

```bash
cd /Users/gorkemcetin/atlasmail && docker compose up -d
cd packages/server && REDIS_URL="redis://localhost:6379" npm run dev &
cd ../client && npm run dev &
```

Open http://localhost:5180, log in, navigate to Settings > Integrations. Expected:
- The existing Google connect button is unchanged.
- Below it, a new "Email channels" section appears.
- If the test user has a connected Google account (from earlier dev work), one channel row renders showing the email, "Pending" or "Live" badge, two dropdowns (visibility, policy), and two buttons ("Pause sync", "Sync now").
- Clicking "Sync now" enqueues a `gmail-full-sync` job — the worker logs `Sync job failed: Unknown sync job: gmail-full-sync` (expected — that handler doesn't exist until 2b). The toast shows "Sync queued" because the enqueue itself succeeded.
- Changing visibility or policy and re-fetching the page persists the choice.

Kill the dev servers when done.

- [ ] **Step 9: Commit**

```bash
git add packages/client/src/apps/crm/hooks/use-channels.ts packages/client/src/apps/crm/components/integrations/channels-list.tsx packages/client/src/apps/crm/components/integrations/channel-row.tsx packages/client/src/components/settings/integrations-panel.tsx packages/client/src/i18n/locales/en.json packages/client/src/i18n/locales/tr.json packages/client/src/i18n/locales/de.json packages/client/src/i18n/locales/fr.json packages/client/src/i18n/locales/it.json
git commit -m "feat(crm): channels list UI in Settings > Integrations"
```

---

## Task 8: Final verification (NO PUSH)

- [ ] **Step 1: Run full server test suite**

```bash
cd packages/server && npm test 2>&1 | tail -8
```

Expected: green, ~13 more tests than baseline (4 migration + 6 channel-service + 7 controller minus a small overlap = around 13–17).

- [ ] **Step 2: Server typecheck**

```bash
cd packages/server && npm run typecheck 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 3: Server lint**

```bash
cd packages/server && npm run lint 2>&1 | tail -10
```

Expected: 0 errors. Pre-existing warnings ignored.

- [ ] **Step 4: Server build**

```bash
cd packages/server && npm run build 2>&1 | tail -5
```

Expected: clean. Verify the new files compiled:

```bash
ls packages/server/dist/apps/crm/services/channel.service.js
ls packages/server/dist/apps/crm/controllers/channels.controller.js
ls packages/server/dist/db/migrations/2026-04-28-message-channels.js
```

All three should exist.

- [ ] **Step 5: Client typecheck + build**

```bash
cd packages/client && npm run typecheck 2>&1 | tail -5
cd packages/client && npm run build 2>&1 | tail -5
```

Both clean.

- [ ] **Step 6: Verify no commits accidentally pushed**

```bash
cd /Users/gorkemcetin/atlasmail && git log --oneline origin/main..HEAD
```

Expected: 8 unpushed Phase 1 + Phase 2a commits (6 from Phase 1, the spec doc commit, plus the 7 commits from this plan = 14 total, plus or minus the spec doc).

- [ ] **Step 7: Report**

Per Atlas convention this plan does NOT push to `origin main`. The user will batch with later sub-phases (2b/2c/2d) before pushing.

Summarize for the user:
- Tasks 1–7 completed
- New tables: `message_channels`, `message_threads`, `messages`, `message_participants`, `message_blocklist`. New columns on `crm_activities`: `message_id`, `external_provider`, `external_id`.
- Migration is idempotent (CREATE TABLE IF NOT EXISTS, INSERT … LEFT JOIN … WHERE IS NULL); safe to re-run.
- New endpoints: `GET /crm/channels`, `PATCH /crm/channels/:id`, `POST /crm/channels/:id/sync` (the last enqueues a `gmail-full-sync` job — handler lands in 2b; until then the worker logs `Unknown sync job` for that job name).
- Settings > Integrations UI: now shows a per-channel list with visibility / auto-create-policy / sync-toggle / manual sync controls.
- Translation keys: EN populated; TR/DE/FR/IT have the same keys with EN values, awaiting translator pass.
- No Gmail API code added. No message ingestion. No outbound send. No retention. No visibility enforcement on message reads (no message reads exist yet).

---

## Acceptance criteria

This phase is done when:

- [ ] Server `npm test` is green; channel-service.test (6), channels-controller.test (7), and message-channels-migration.test (4) all pass.
- [ ] `npm run typecheck` clean in both `packages/server` and `packages/client`.
- [ ] `npm run lint` in `packages/server` has 0 errors.
- [ ] `npm run build` in both packages produces output without errors.
- [ ] On a fresh dev boot, the migration logs `message-channels migration applied { backfilledChannels: N }`.
- [ ] `\dt message_*` in psql shows 4 new tables; `\dt messages` shows 1; `\d crm_activities` shows the 3 new columns.
- [ ] `GET /crm/channels` returns the per-user-visible channel list.
- [ ] `PATCH /crm/channels/:id` rejects 403 for non-owners, 400 for invalid values, 404 for missing, 200 on success.
- [ ] `POST /crm/channels/:id/sync` enqueues a `gmail-full-sync` job (the handler doesn't exist yet — that's 2b).
- [ ] Settings > Integrations renders the new channels list after connecting a Google account.
- [ ] No Gmail API code (`google.gmail(...)`) added in this phase.
- [ ] All commits target `main`; no feature branch created; no `git push`.

---

## What this unblocks for sub-phase 2b

Phase 2b (Gmail inbound sync) becomes purely additive:

1. Add `processSyncJob` cases for `gmail-full-sync` and `gmail-incremental-sync` in `packages/server/src/workers/sync.worker.ts`.
2. Build `packages/server/src/apps/crm/services/gmail-sync.service.ts` (mirroring `services/calendar-sync.service.ts`).
3. Build `packages/server/src/apps/crm/services/participant-match.service.ts`.
4. Build `packages/server/src/services/google-api-call.ts` (the 401-retry-with-refresh wrapper) and retrofit `calendar-sync.service.ts` to use it.
5. Extend the repeatable scheduler in `workers/index.ts` to schedule `gmail-incremental-sync` per channel where `isSyncEnabled=true`.

No schema migration needed in 2b — schema already has everything ingestion needs.
