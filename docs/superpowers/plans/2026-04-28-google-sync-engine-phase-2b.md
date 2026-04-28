# Google Sync Engine — Phase 2b: Gmail Inbound Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire real Gmail inbound sync into Atlas. Gmail messages from each connected channel get ingested into `messages` / `message_threads` / `message_participants` tables, matched to CRM contacts, and surfaced as `crm_activities` rows on contact/deal/company timelines. Polling at 5 min via the Phase 1 BullMQ rails.

**Architecture:** New `gmail-sync.service` (full + incremental, mirrors `calendar-sync.service` shape), new `participant-match.service` (handle→contact lookup with auto-create policy and blocklist enforcement), new `google-api-call` wrapper (401 → refresh → retry-once for both Gmail and Calendar callers). The worker's `processSyncJob` switch grows two cases (`gmail-full-sync`, `gmail-incremental-sync`). The repeatable scheduler in `workers/index.ts` adds Gmail jobs alongside Calendar.

**Tech Stack:** `googleapis@144` (Gmail v1 API), Drizzle ORM, BullMQ ^5.25, vitest. No new top-level dependencies.

**Out of scope for 2b:** Outbound send (`gmail-send` job + composer UI) — Phase 2c. Visibility enforcement at the message-read query layer — Phase 2d. Retention cleaner — Phase 2d. Blocklist UI beyond schema check — Phase 2d. HTML body sanitization — see Task 5 (we store `bodyText` only; `bodyHtml` stays nullable until 2c/2d).

---

## Phase 2a baseline

The 16 commits already on `origin/main` (`4b31f8f9..d0d2a154`) define the foundation:
- `message_channels` is the unit of sync. One row per Google-connected account today; UI exposes per-channel toggles for `isSyncEnabled`, `visibility`, `contactAutoCreationPolicy`.
- `messages`, `message_threads`, `message_participants`, `message_blocklist` tables exist (empty).
- `crm_activities.messageId`, `.externalProvider`, `.externalId` columns exist (always null).
- BullMQ queue + worker + lifecycle wiring works. `SyncJobName.GmailFullSync` and `GmailIncrementalSync` are defined; the worker's switch defaults to `Unknown sync job: gmail-full-sync` for them today.
- `POST /crm/channels/:id/sync` enqueues a `gmail-full-sync` job that the worker can't handle. After 2b lands, the same enqueue triggers a real ingestion run.

---

## File structure

**New files (server):**
- `packages/server/src/services/google-api-call.ts` — 401-retry-with-refresh wrapper (used by both gmail and calendar)
- `packages/server/src/apps/crm/services/gmail-sync.service.ts` — `performGmailFullSync(channelId)`, `performGmailIncrementalSync(channelId)`
- `packages/server/src/apps/crm/services/gmail-message-parser.ts` — pure functions: parse Gmail API message → ingestion-shaped record (headers, body, participants)
- `packages/server/src/apps/crm/services/participant-match.service.ts` — `matchParticipants(messageId, channelId, tenantId)` — handle→contact lookup, auto-create per policy, blocklist check
- `packages/server/src/apps/crm/services/message-activity.service.ts` — `upsertActivitiesForMessage(messageId)` — fans out one activity per linked entity (contact / deal / company)
- `packages/server/src/db/migrations/2026-04-29-gmail-message-partial-index.ts` — adds the partial index deferred from 2a
- `packages/server/test/google-api-call.test.ts`
- `packages/server/test/gmail-message-parser.test.ts`
- `packages/server/test/gmail-sync-service.test.ts`
- `packages/server/test/participant-match-service.test.ts`
- `packages/server/test/message-activity-service.test.ts`
- `packages/server/test/gmail-message-partial-index-migration.test.ts`

**Modified files:**
- `packages/server/src/workers/sync.worker.ts` — two new cases on the dispatch switch
- `packages/server/src/workers/index.ts` — schedule `gmail-incremental-sync` per channel (mirroring calendar)
- `packages/server/src/services/google-auth.ts` — export `forceRefreshClient(accountId)` used by the api-call wrapper
- `packages/server/src/services/calendar-sync.service.ts` — wrap its `googleapis` calls with `callGoogleApi` (the 401 retry wrapper)
- `packages/server/src/db/schema.ts` — adds the partial index to the `messages` table definition
- `packages/server/src/db/bootstrap.ts` — registers the new migration

**Why this layout:** Domain services live under `apps/crm/services/` (mirroring `activity.service.ts`, `contact.service.ts`, the 2a `channel.service.ts`). Cross-cutting concerns (`google-api-call`, `google-auth`) stay in `services/` at the server root. The parser is split from the sync service so its pure logic (header parsing, body extraction, participant role assignment) can be unit-tested against fixtures without mocking `googleapis`. The migration file follows the dated-file pattern established by 2a.

---

## Conventions you must follow

These come from `CLAUDE.md` and the project's auto-memory:

- **Branch policy:** Commit and push to `main`. Do NOT create a feature branch.
- **No PR.** Do NOT run `gh pr create`. Push goes directly to `main`.
- **Tests live in `packages/server/test/`** (NOT colocated). Run from `packages/server`: `npm test`. Vitest config at `packages/server/vitest.config.ts`. Global setup at `packages/server/test/setup.ts` mocks `../src/config/database` and `../src/utils/logger` for every test.
- **Test-driven:** every task that adds logic writes a failing vitest first, sees it fail, then implements.
- **Schema source of truth:** `packages/server/src/db/schema.ts`. Atlas does NOT use `db:push`; column/index changes go through `db/migrations/YYYY-MM-DD-name.ts` files registered in `bootstrap.ts`.
- **Logger:** `import { logger } from '../utils/logger'`. Pino-style structured logs.
- **No Gmail outbound code.** That's 2c. If you find yourself writing `users.messages.send`, stop.
- **No visibility enforcement on message reads.** That's 2d. 2b ingests; reads come later.

---

## Task 1: Add the `messages` partial index migration

**Why:** The 2a code review flagged that `idx_messages_tenant_inbound_sent` lacks `direction` / `deletedAt` predicates. Inbox-listing queries (Phase 2d) and CRM contact-timeline reads (Phase 2c) will scan all rows in a tenant's `sentAt` range before filtering. Adding the partial index now — before the first `INSERT` — keeps it cheap (no rebuild on a populated table).

**Files:**
- Create: `packages/server/src/db/migrations/2026-04-29-gmail-message-partial-index.ts`
- Modify: `packages/server/src/db/bootstrap.ts`
- Modify: `packages/server/src/db/schema.ts`
- Test: `packages/server/test/gmail-message-partial-index-migration.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/gmail-message-partial-index-migration.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

const queryMock = vi.fn(async () => ({ rows: [] }));
const releaseMock = vi.fn();
const connectMock = vi.fn(async () => ({ query: queryMock, release: releaseMock }));

vi.mock('../src/config/database', () => ({
  pool: { connect: connectMock },
  db: {},
}));

import { migrateGmailMessagePartialIndex } from '../src/db/migrations/2026-04-29-gmail-message-partial-index';

describe('migrateGmailMessagePartialIndex', () => {
  it('creates a partial index for inbound non-deleted messages', async () => {
    queryMock.mockClear();
    await migrateGmailMessagePartialIndex();
    const sql = queryMock.mock.calls.map((c) => c[0] as string).join('\n');
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_messages_tenant_inbound_active/i);
    expect(sql).toMatch(/ON messages \(tenant_id, sent_at DESC\)/i);
    expect(sql).toMatch(/WHERE direction = 'inbound' AND deleted_at IS NULL/i);
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
cd packages/server && npm test -- gmail-message-partial-index-migration
```

Expected: module-not-found.

- [ ] **Step 3: Implement the migration**

Create `packages/server/src/db/migrations/2026-04-29-gmail-message-partial-index.ts`:

```typescript
import { pool } from '../../config/database';
import { logger } from '../../utils/logger';

const CREATE_PARTIAL_INDEX = `
  CREATE INDEX IF NOT EXISTS idx_messages_tenant_inbound_active
    ON messages (tenant_id, sent_at DESC)
    WHERE direction = 'inbound' AND deleted_at IS NULL;
`;

export async function migrateGmailMessagePartialIndex(): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query(CREATE_PARTIAL_INDEX);
    logger.debug('gmail-message-partial-index migration applied');
  } finally {
    c.release();
  }
}
```

- [ ] **Step 4: Wire into bootstrap**

In `packages/server/src/db/bootstrap.ts`, find the existing import:

```typescript
import { migrateMessageChannels } from './migrations/2026-04-28-message-channels';
```

Add below it:

```typescript
import { migrateGmailMessagePartialIndex } from './migrations/2026-04-29-gmail-message-partial-index';
```

Find the call to `await migrateMessageChannels();` inside `bootstrapDatabase`. Add immediately after it:

```typescript
  await migrateGmailMessagePartialIndex();
```

- [ ] **Step 5: Mirror in Drizzle schema**

In `packages/server/src/db/schema.ts`, find the `messages` table's index block. After the existing `tenantInboundIdx` line, add a new partial index entry. Drizzle's `.where()` on `index()` takes a SQL fragment — replace the entire trailing block:

```typescript
}, (table) => ({
  channelGmailUnique: uniqueIndex('uniq_messages_channel_gmail').on(table.channelId, table.gmailMessageId),
  threadSentIdx: index('idx_messages_thread_sent').on(table.threadId, table.sentAt),
  tenantInboundIdx: index('idx_messages_tenant_inbound_sent').on(table.tenantId, table.sentAt),
  tenantOutboundIdx: index('idx_messages_tenant_outbound').on(table.tenantId, table.status, table.direction),
}));
```

with:

```typescript
}, (table) => ({
  channelGmailUnique: uniqueIndex('uniq_messages_channel_gmail').on(table.channelId, table.gmailMessageId),
  threadSentIdx: index('idx_messages_thread_sent').on(table.threadId, table.sentAt),
  tenantInboundIdx: index('idx_messages_tenant_inbound_sent').on(table.tenantId, table.sentAt),
  tenantInboundActiveIdx: index('idx_messages_tenant_inbound_active')
    .on(table.tenantId, table.sentAt)
    .where(sql`direction = 'inbound' AND deleted_at IS NULL`),
  tenantOutboundIdx: index('idx_messages_tenant_outbound').on(table.tenantId, table.status, table.direction),
}));
```

The `sql` helper needs to be imported. Verify with `grep -n "import.*sql" packages/server/src/db/schema.ts`. If `sql` is not imported, add it:

```typescript
import { sql } from 'drizzle-orm';
```

- [ ] **Step 6: Run the test, expect pass**

```bash
cd packages/server && npm test -- gmail-message-partial-index-migration
```

Expected: 1 passing.

- [ ] **Step 7: Run full suite + typecheck**

```bash
cd packages/server && npm test 2>&1 | tail -8
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: 474 passed (was 473 + 1), typecheck clean.

- [ ] **Step 8: Smoke-boot**

```bash
docker compose ps
cd packages/server && REDIS_URL="redis://localhost:6379" npm run dev 2>&1 | tee /tmp/atlas-2b-task1.log &
```

Wait until you see `Atlas server running`. Verify the index in psql:

```bash
docker compose exec -T postgres psql -U postgres atlas -c "\d messages" | grep tenant_inbound
```

Expected: two indexes listed — `idx_messages_tenant_inbound_sent` (the existing 2a one, kept for now) and `idx_messages_tenant_inbound_active` (the new partial). Both can coexist without conflict.

Kill server: `lsof -ti:3001 | xargs kill -9 2>/dev/null && rm -f /tmp/atlas-2b-task1.log`

- [ ] **Step 9: Commit**

```bash
git add packages/server/src/db/migrations/2026-04-29-gmail-message-partial-index.ts packages/server/src/db/bootstrap.ts packages/server/src/db/schema.ts packages/server/test/gmail-message-partial-index-migration.test.ts
git commit -m "feat(server): partial index for inbound non-deleted messages"
```

---

## Task 2: 401-retry-with-refresh wrapper (`google-api-call`)

**Why:** Today `getAuthenticatedClient` only refreshes proactively (60 s before expiry). If a token expires mid-API-call, the call fails with 401 and the BullMQ retry budget burns on errors that a refresh would clear. The wrapper centralizes "if first call gets 401, force a refresh and retry once." Calendar sync (Phase 1) was supposed to wrap with this; it's been deferred since. 2b adds the wrapper AND retrofits the calendar service.

**Files:**
- Modify: `packages/server/src/services/google-auth.ts` (export `forceRefreshClient`)
- Create: `packages/server/src/services/google-api-call.ts`
- Modify: `packages/server/src/services/calendar-sync.service.ts` (wrap googleapis calls)
- Test: `packages/server/test/google-api-call.test.ts`

- [ ] **Step 1: Add `forceRefreshClient` to `google-auth.ts`**

In `packages/server/src/services/google-auth.ts`, after the existing `getAuthenticatedClient` export, add:

```typescript
/**
 * Force a token refresh and return a freshly-credentialed client. Used by
 * `callGoogleApi` to recover from a 401 mid-call without depending on the
 * proactive expiry check. Persists the refreshed credentials.
 */
export async function forceRefreshClient(accountId: string): Promise<OAuth2Client> {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!account) throw new Error(`Account ${accountId} not found`);
  if (account.provider !== 'google') throw new Error('Account is not connected to Google');

  const refreshToken = decrypt(account.refreshToken);

  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });

  try {
    const { credentials } = await client.refreshAccessToken();
    client.setCredentials(credentials);

    const updates: Record<string, unknown> = {
      accessToken: encrypt(credentials.access_token!),
      tokenExpiresAt: new Date(credentials.expiry_date!),
      updatedAt: new Date(),
    };
    if (credentials.refresh_token) {
      updates.refreshToken = encrypt(credentials.refresh_token);
    }
    await db.update(accounts).set(updates).where(eq(accounts.id, accountId));
    logger.info({ accountId }, 'Force-refreshed Google access token');

    return client;
  } catch (err) {
    logger.error({ err, accountId }, 'Failed to force-refresh Google token');
    await db.update(accounts).set({
      syncStatus: 'error',
      syncError: 'Token refresh failed',
      updatedAt: new Date(),
    }).where(eq(accounts.id, accountId));
    throw err;
  }
}
```

- [ ] **Step 2: Write the failing test for the wrapper**

Create `packages/server/test/google-api-call.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OAuth2Client } from 'google-auth-library';

const getAuthenticatedClientMock = vi.fn();
const forceRefreshClientMock = vi.fn();

vi.mock('../src/services/google-auth', () => ({
  getAuthenticatedClient: getAuthenticatedClientMock,
  forceRefreshClient: forceRefreshClientMock,
}));

import { callGoogleApi } from '../src/services/google-api-call';

const fakeClient = { fake: 'first' } as unknown as OAuth2Client;
const refreshedClient = { fake: 'refreshed' } as unknown as OAuth2Client;

describe('callGoogleApi', () => {
  beforeEach(() => {
    getAuthenticatedClientMock.mockReset();
    forceRefreshClientMock.mockReset();
  });

  it('returns the result on first try when no error', async () => {
    getAuthenticatedClientMock.mockResolvedValue(fakeClient);
    const fn = vi.fn(async () => 'ok');
    const result = await callGoogleApi('acc-1', fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(fakeClient);
    expect(forceRefreshClientMock).not.toHaveBeenCalled();
  });

  it('refreshes and retries once on 401 (err.code === 401)', async () => {
    getAuthenticatedClientMock.mockResolvedValue(fakeClient);
    forceRefreshClientMock.mockResolvedValue(refreshedClient);
    const fn = vi.fn()
      .mockImplementationOnce(async () => { const e: any = new Error('unauth'); e.code = 401; throw e; })
      .mockImplementationOnce(async () => 'ok-after-refresh');

    const result = await callGoogleApi('acc-1', fn);
    expect(result).toBe('ok-after-refresh');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, fakeClient);
    expect(fn).toHaveBeenNthCalledWith(2, refreshedClient);
    expect(forceRefreshClientMock).toHaveBeenCalledWith('acc-1');
  });

  it('refreshes and retries once on 401 (err.response.status === 401)', async () => {
    getAuthenticatedClientMock.mockResolvedValue(fakeClient);
    forceRefreshClientMock.mockResolvedValue(refreshedClient);
    const fn = vi.fn()
      .mockImplementationOnce(async () => { const e: any = new Error('unauth'); e.response = { status: 401 }; throw e; })
      .mockImplementationOnce(async () => 'ok-after-refresh');

    const result = await callGoogleApi('acc-1', fn);
    expect(result).toBe('ok-after-refresh');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not retry on non-401 errors', async () => {
    getAuthenticatedClientMock.mockResolvedValue(fakeClient);
    const fn = vi.fn(async () => { const e: any = new Error('rate'); e.code = 429; throw e; });
    await expect(callGoogleApi('acc-1', fn)).rejects.toMatchObject({ code: 429 });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(forceRefreshClientMock).not.toHaveBeenCalled();
  });

  it('propagates the second error if the retry also fails', async () => {
    getAuthenticatedClientMock.mockResolvedValue(fakeClient);
    forceRefreshClientMock.mockResolvedValue(refreshedClient);
    const fn = vi.fn()
      .mockImplementationOnce(async () => { const e: any = new Error('unauth1'); e.code = 401; throw e; })
      .mockImplementationOnce(async () => { const e: any = new Error('still-bad'); e.code = 401; throw e; });

    await expect(callGoogleApi('acc-1', fn)).rejects.toThrow(/still-bad/);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Run, expect failure**

```bash
cd packages/server && npm test -- google-api-call
```

Expected: module-not-found.

- [ ] **Step 4: Implement the wrapper**

Create `packages/server/src/services/google-api-call.ts`:

```typescript
import type { OAuth2Client } from 'google-auth-library';
import { getAuthenticatedClient, forceRefreshClient } from './google-auth';

/**
 * Run a Google API call with automatic 401 recovery: if the first attempt
 * fails with 401 (either `err.code === 401` or `err.response?.status === 401`),
 * force a refresh and retry exactly once. Non-401 errors and the second-try
 * error propagate to the caller.
 *
 * Use this for every Gmail / Calendar API call where the token may expire
 * mid-flight (long syncs, large pages, slow networks).
 */
export async function callGoogleApi<T>(
  accountId: string,
  fn: (auth: OAuth2Client) => Promise<T>,
): Promise<T> {
  const auth = await getAuthenticatedClient(accountId);
  try {
    return await fn(auth);
  } catch (err: any) {
    if (err?.code === 401 || err?.response?.status === 401) {
      const refreshed = await forceRefreshClient(accountId);
      return await fn(refreshed);
    }
    throw err;
  }
}
```

- [ ] **Step 5: Run, expect pass**

```bash
cd packages/server && npm test -- google-api-call
```

Expected: 5 passing.

- [ ] **Step 6: Retrofit the calendar sync service**

The Phase 1 calendar sync calls `getAuthenticatedClient` directly. Wrap each `googleapis` call so 2b's wrapper covers calendar too. In `packages/server/src/services/calendar-sync.service.ts`:

Add to imports:

```typescript
import { callGoogleApi } from './google-api-call';
```

Find every place that has the pattern: `const client = await getAuthenticatedClient(accountId);` followed by `const calendar = google.calendar({ version: 'v3', auth: client });` and refactor each to use `callGoogleApi`. Example: in `performCalendarFullSync`, the existing block is:

```typescript
  try {
    const client = await getAuthenticatedClient(accountId);
    const calendar = google.calendar({ version: 'v3', auth: client });

    let calPageToken: string | undefined;
    do {
      const calListRes = await withRetry(() =>
        calendar.calendarList.list({ pageToken: calPageToken }),
        'Calendar API',
      );
      // ...
```

Change to:

```typescript
  try {
    let calPageToken: string | undefined;
    do {
      const calListRes = await callGoogleApi(accountId, async (auth) => {
        const calendar = google.calendar({ version: 'v3', auth });
        return withRetry(() => calendar.calendarList.list({ pageToken: calPageToken }), 'Calendar API');
      });
      // ...
```

Apply the same pattern to every `calendar.events.list(...)` invocation in the file (search for `await withRetry`). The local `client`/`calendar` variables outside the wrapper go away because each API call now sets up its own client inside the wrapper closure.

If a function has many calls in tight loops, the wrapper-per-call adds DB lookups (`getAuthenticatedClient` re-reads the account). For Phase 2b that's acceptable — calendar sync runs every 5 min per account, the read is cached at the OS level. We'll optimize if it shows up in profiling.

- [ ] **Step 7: Run the calendar sync tests**

The existing calendar sync has no unit tests (verified — `find packages/server/test -name 'calendar*'` returns empty). The `withRetry` helper has its own behavior. Manual smoke is the gate: if `npm test` still passes (no other test depends on `getAuthenticatedClient` being called from inside calendar-sync) and the worker still runs after retrofit, we're good.

```bash
cd packages/server && npm test 2>&1 | tail -8
```

Expected: 479 passed (was 474 + 5 from `google-api-call`).

- [ ] **Step 8: Typecheck**

```bash
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: clean.

- [ ] **Step 9: Smoke-boot — verify calendar sync still works**

The calendar service is touched but its behavior is unchanged. Boot the dev server, confirm `Sync queue initialized`, `Sync worker started`, and `Scheduled incremental calendar sync` all log. Then trigger a sync via the existing UI ("Sync now" button on the integrations panel — Phase 1 endpoint) and watch the logs for `Running calendar full sync` followed by `Sync job completed`.

If you don't have a real Google-connected account in dev, the worker will throw inside the first API call (token decrypt fails on the placeholder). That's expected and proves nothing about the wrapper. The unit tests in Step 5 prove the wrapper is correct; the smoke just confirms no regression in the boot path.

```bash
docker compose ps
cd packages/server && REDIS_URL="redis://localhost:6379" npm run dev 2>&1 | tee /tmp/atlas-2b-task2.log &
```

Wait for `Atlas server running`. Then:

```bash
grep -E "Sync queue initialized|Sync worker started|Scheduled incremental calendar sync" /tmp/atlas-2b-task2.log
```

Expected: all 3 lines present.

Kill: `lsof -ti:3001 | xargs kill -9 2>/dev/null && rm -f /tmp/atlas-2b-task2.log`

- [ ] **Step 10: Commit**

```bash
git add packages/server/src/services/google-auth.ts packages/server/src/services/google-api-call.ts packages/server/src/services/calendar-sync.service.ts packages/server/test/google-api-call.test.ts
git commit -m "feat(server): 401-retry wrapper for Google API calls + calendar retrofit"
```

---

## Task 3: Gmail message parser (pure)

**Why:** Parsing a `gmail.users.messages.get` response into ingestion-shaped records is the most error-prone part of email ingestion. By extracting it into pure functions with rich fixture-based tests, we make ingestion correctness testable without needing to mock `googleapis`.

**Files:**
- Create: `packages/server/src/apps/crm/services/gmail-message-parser.ts`
- Test: `packages/server/test/gmail-message-parser.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/gmail-message-parser.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  parseHeaders,
  extractParticipants,
  extractBodyText,
  parseGmailMessage,
} from '../src/apps/crm/services/gmail-message-parser';

describe('parseHeaders', () => {
  it('builds a lowercase-keyed map from a Gmail headers array', () => {
    const headers = [
      { name: 'From', value: 'Alice <alice@example.com>' },
      { name: 'To', value: 'bob@example.com, Carol <carol@example.com>' },
      { name: 'Subject', value: 'Hello' },
      { name: 'Message-ID', value: '<abc123@mail.example.com>' },
    ];
    const result = parseHeaders(headers as any);
    expect(result.from).toBe('Alice <alice@example.com>');
    expect(result.to).toBe('bob@example.com, Carol <carol@example.com>');
    expect(result.subject).toBe('Hello');
    expect(result['message-id']).toBe('<abc123@mail.example.com>');
  });

  it('handles missing headers gracefully', () => {
    const result = parseHeaders([{ name: 'From', value: 'a@b' }] as any);
    expect(result.from).toBe('a@b');
    expect(result.to).toBeUndefined();
  });
});

describe('extractParticipants', () => {
  it('parses single addresses', () => {
    const result = extractParticipants({
      from: 'Alice <alice@Example.com>',
      to: 'bob@example.com',
      cc: undefined,
      bcc: undefined,
    });
    expect(result).toEqual([
      { role: 'from', handle: 'alice@example.com', displayName: 'Alice' },
      { role: 'to', handle: 'bob@example.com', displayName: null },
    ]);
  });

  it('parses comma-separated multi-address fields', () => {
    const result = extractParticipants({
      from: 'a@x.com',
      to: 'Bob <bob@x.com>, carol@x.com',
      cc: 'Dave <dave@x.com>',
      bcc: undefined,
    });
    expect(result).toHaveLength(4);
    expect(result.map((p) => p.role)).toEqual(['from', 'to', 'to', 'cc']);
    expect(result.map((p) => p.handle)).toEqual(['a@x.com', 'bob@x.com', 'carol@x.com', 'dave@x.com']);
  });

  it('lowercases all handles', () => {
    const result = extractParticipants({
      from: 'A@B.COM',
      to: 'C@D.com',
      cc: undefined,
      bcc: undefined,
    });
    expect(result.map((p) => p.handle)).toEqual(['a@b.com', 'c@d.com']);
  });

  it('skips empty/whitespace fields', () => {
    const result = extractParticipants({
      from: '',
      to: '   ',
      cc: undefined,
      bcc: undefined,
    });
    expect(result).toEqual([]);
  });

  it('handles malformed addresses without crashing', () => {
    const result = extractParticipants({
      from: 'Not An Email',
      to: 'valid@example.com',
      cc: undefined,
      bcc: undefined,
    });
    // 'Not An Email' yields no @ and gets dropped; 'valid@example.com' survives
    expect(result).toEqual([
      { role: 'to', handle: 'valid@example.com', displayName: null },
    ]);
  });
});

describe('extractBodyText', () => {
  it('reads a top-level text/plain body', () => {
    const payload = {
      mimeType: 'text/plain',
      body: { data: Buffer.from('Hello world').toString('base64url') },
    };
    expect(extractBodyText(payload as any)).toBe('Hello world');
  });

  it('walks multipart/alternative to find text/plain', () => {
    const payload = {
      mimeType: 'multipart/alternative',
      parts: [
        { mimeType: 'text/plain', body: { data: Buffer.from('plain text').toString('base64url') } },
        { mimeType: 'text/html', body: { data: Buffer.from('<p>html</p>').toString('base64url') } },
      ],
    };
    expect(extractBodyText(payload as any)).toBe('plain text');
  });

  it('returns null when no text/plain part exists', () => {
    const payload = {
      mimeType: 'text/html',
      body: { data: Buffer.from('<p>only html</p>').toString('base64url') },
    };
    expect(extractBodyText(payload as any)).toBeNull();
  });

  it('truncates body to 1MB', () => {
    const big = 'x'.repeat(1_500_000);
    const payload = {
      mimeType: 'text/plain',
      body: { data: Buffer.from(big).toString('base64url') },
    };
    const result = extractBodyText(payload as any);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(1_000_000);
  });

  it('returns null on missing body data', () => {
    expect(extractBodyText({ mimeType: 'text/plain' } as any)).toBeNull();
    expect(extractBodyText({ mimeType: 'text/plain', body: {} } as any)).toBeNull();
  });
});

describe('parseGmailMessage', () => {
  it('extracts a structured ingestion record from a full message', () => {
    const fakeMessage = {
      id: 'gm-123',
      threadId: 'gt-1',
      labelIds: ['INBOX', 'IMPORTANT'],
      snippet: 'preview text',
      internalDate: '1714000000000',
      payload: {
        headers: [
          { name: 'From', value: 'Alice <alice@example.com>' },
          { name: 'To', value: 'me@example.com' },
          { name: 'Subject', value: 'Hello' },
          { name: 'Message-ID', value: '<abc@mail.example.com>' },
          { name: 'In-Reply-To', value: '<prev@mail.example.com>' },
        ],
        mimeType: 'text/plain',
        body: { data: Buffer.from('Hi there').toString('base64url') },
      },
    };

    const result = parseGmailMessage(fakeMessage as any);

    expect(result).toMatchObject({
      gmailMessageId: 'gm-123',
      gmailThreadId: 'gt-1',
      headerMessageId: '<abc@mail.example.com>',
      inReplyTo: '<prev@mail.example.com>',
      subject: 'Hello',
      snippet: 'preview text',
      bodyText: 'Hi there',
      labels: ['INBOX', 'IMPORTANT'],
      hasAttachments: false,
    });
    expect(result.receivedAt).toEqual(new Date(1_714_000_000_000));
    expect(result.participants.map((p) => `${p.role}:${p.handle}`)).toEqual([
      'from:alice@example.com',
      'to:me@example.com',
    ]);
  });

  it('detects attachments via filename in part', () => {
    const fakeMessage = {
      id: 'gm-att',
      threadId: 'gt-1',
      labelIds: [],
      snippet: '',
      internalDate: '1714000000000',
      payload: {
        headers: [
          { name: 'From', value: 'a@b.com' },
          { name: 'To', value: 'c@d.com' },
        ],
        mimeType: 'multipart/mixed',
        parts: [
          { mimeType: 'text/plain', body: { data: Buffer.from('see attached').toString('base64url') } },
          { mimeType: 'application/pdf', filename: 'report.pdf', body: { attachmentId: 'att-1' } },
        ],
      },
    };
    const result = parseGmailMessage(fakeMessage as any);
    expect(result.hasAttachments).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
cd packages/server && npm test -- gmail-message-parser
```

Expected: module-not-found.

- [ ] **Step 3: Implement the parser**

Create `packages/server/src/apps/crm/services/gmail-message-parser.ts`:

```typescript
import type { gmail_v1 } from 'googleapis';

const BODY_MAX_BYTES = 1_000_000;
const ANGLE_BRACKET_PATTERN = /<([^>]+)>/;

export interface GmailHeaderMap {
  [lowercaseName: string]: string;
}

export interface ParsedParticipant {
  role: 'from' | 'to' | 'cc' | 'bcc';
  handle: string; // lowercased
  displayName: string | null;
}

export interface ParsedGmailMessage {
  gmailMessageId: string;
  gmailThreadId: string;
  headerMessageId: string | null;
  inReplyTo: string | null;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  receivedAt: Date | null;
  labels: string[];
  hasAttachments: boolean;
  participants: ParsedParticipant[];
}

/** Build a lowercase-keyed header map from Gmail's header array. */
export function parseHeaders(headers: gmail_v1.Schema$MessagePartHeader[]): GmailHeaderMap {
  const map: GmailHeaderMap = {};
  for (const h of headers ?? []) {
    if (h.name && h.value !== undefined && h.value !== null) {
      map[h.name.toLowerCase()] = h.value;
    }
  }
  return map;
}

interface AddressFields {
  from: string | undefined;
  to: string | undefined;
  cc: string | undefined;
  bcc: string | undefined;
}

const ROLE_ORDER: Array<'from' | 'to' | 'cc' | 'bcc'> = ['from', 'to', 'cc', 'bcc'];

/** Parse from/to/cc/bcc strings into a flat list of participants. */
export function extractParticipants(fields: AddressFields): ParsedParticipant[] {
  const out: ParsedParticipant[] = [];
  for (const role of ROLE_ORDER) {
    const raw = fields[role];
    if (!raw || !raw.trim()) continue;
    for (const piece of splitAddressList(raw)) {
      const parsed = parseSingleAddress(piece);
      if (parsed) out.push({ role, handle: parsed.handle, displayName: parsed.displayName });
    }
  }
  return out;
}

/** Split "Alice <a@b>, c@d, Bob <b@c>" into individual address strings. */
function splitAddressList(s: string): string[] {
  // Naive comma-split is wrong for display names containing commas (e.g., 'Doe, Jane <jd@x>').
  // For Phase 2b we accept the imperfection — Gmail-sourced senders are extremely rarely formatted that way.
  // If false matches surface in production, swap for an RFC 5322 parser later.
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

/** Parse one address. Returns null if malformed (no @ found). */
function parseSingleAddress(s: string): { handle: string; displayName: string | null } | null {
  const angle = ANGLE_BRACKET_PATTERN.exec(s);
  if (angle) {
    const handle = angle[1].trim().toLowerCase();
    if (!handle.includes('@')) return null;
    const displayName = s.slice(0, angle.index).trim().replace(/^"|"$/g, '') || null;
    return { handle, displayName };
  }
  const trimmed = s.trim().toLowerCase();
  if (!trimmed.includes('@')) return null;
  return { handle: trimmed, displayName: null };
}

/**
 * Recursively walk the MIME tree to find the first text/plain part. Returns
 * the decoded UTF-8 string, truncated to BODY_MAX_BYTES bytes. Returns null
 * if no plain-text part is found.
 */
export function extractBodyText(
  payload: gmail_v1.Schema$MessagePart | undefined,
): string | null {
  if (!payload) return null;

  const decode = (data: string | undefined | null): string | null => {
    if (!data) return null;
    try {
      const buf = Buffer.from(data, 'base64url');
      const truncated = buf.length > BODY_MAX_BYTES ? buf.subarray(0, BODY_MAX_BYTES) : buf;
      return truncated.toString('utf-8');
    } catch {
      return null;
    }
  };

  if (payload.mimeType === 'text/plain') {
    return decode(payload.body?.data);
  }
  if (payload.parts && payload.parts.length > 0) {
    for (const part of payload.parts) {
      const found = extractBodyText(part);
      if (found !== null) return found;
    }
  }
  return null;
}

/** Walk parts to detect any attachment (filename present or part has attachmentId). */
function hasAttachmentInTree(payload: gmail_v1.Schema$MessagePart | undefined): boolean {
  if (!payload) return false;
  if (payload.filename && payload.filename.length > 0) return true;
  if (payload.body?.attachmentId) return true;
  if (payload.parts) {
    for (const p of payload.parts) {
      if (hasAttachmentInTree(p)) return true;
    }
  }
  return false;
}

/**
 * Parse a Gmail API message (`format=full` or `format=metadata` + body fetch)
 * into an ingestion record. The caller is responsible for upserting threads,
 * messages, and participants — this function does no I/O.
 */
export function parseGmailMessage(message: gmail_v1.Schema$Message): ParsedGmailMessage {
  const headers = parseHeaders(message.payload?.headers ?? []);
  const participants = extractParticipants({
    from: headers.from,
    to: headers.to,
    cc: headers.cc,
    bcc: headers.bcc,
  });
  const internalDate = message.internalDate ? Number(message.internalDate) : null;

  return {
    gmailMessageId: message.id ?? '',
    gmailThreadId: message.threadId ?? '',
    headerMessageId: headers['message-id'] ?? null,
    inReplyTo: headers['in-reply-to'] ?? null,
    subject: headers.subject ?? null,
    snippet: message.snippet ?? null,
    bodyText: extractBodyText(message.payload),
    receivedAt: internalDate ? new Date(internalDate) : null,
    labels: message.labelIds ?? [],
    hasAttachments: hasAttachmentInTree(message.payload),
    participants,
  };
}
```

- [ ] **Step 4: Run, expect pass**

```bash
cd packages/server && npm test -- gmail-message-parser
```

Expected: 14 passing (2 parseHeaders + 5 extractParticipants + 5 extractBodyText + 2 parseGmailMessage). Verify with the actual count from the runner.

- [ ] **Step 5: Run full suite + typecheck**

```bash
cd packages/server && npm test 2>&1 | tail -8
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/apps/crm/services/gmail-message-parser.ts packages/server/test/gmail-message-parser.test.ts
git commit -m "feat(crm): pure Gmail message parser (headers, participants, body)"
```

---

## Task 4: Participant matching service

**Why:** Once we have a parsed message, we need to link its participants to CRM contacts (or create them per channel policy, respecting the blocklist). Pure DB logic; no Gmail API. Splitting from the sync service keeps each module focused and testable.

**Files:**
- Create: `packages/server/src/apps/crm/services/participant-match.service.ts`
- Test: `packages/server/test/participant-match-service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/participant-match-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbSelectMock = vi.fn();
const dbInsertMock = vi.fn();
const dbUpdateMock = vi.fn();

vi.mock('../src/config/database', () => ({
  db: {
    select: () => dbSelectMock(),
    insert: () => dbInsertMock(),
    update: () => dbUpdateMock(),
  },
}));

import {
  insertParticipants,
  matchHandleToContact,
  isHandleBlocked,
  shouldAutoCreate,
} from '../src/apps/crm/services/participant-match.service';

describe('shouldAutoCreate', () => {
  it('returns false when policy is none', () => {
    expect(shouldAutoCreate('none', 'from', 'inbound')).toBe(false);
    expect(shouldAutoCreate('none', 'to', 'outbound')).toBe(false);
  });

  it('send-only allows auto-create only for outbound recipients', () => {
    expect(shouldAutoCreate('send-only', 'from', 'inbound')).toBe(false);
    expect(shouldAutoCreate('send-only', 'to', 'inbound')).toBe(false);
    expect(shouldAutoCreate('send-only', 'to', 'outbound')).toBe(true);
    expect(shouldAutoCreate('send-only', 'from', 'outbound')).toBe(false);
  });

  it('send-and-receive allows auto-create from any participant', () => {
    expect(shouldAutoCreate('send-and-receive', 'from', 'inbound')).toBe(true);
    expect(shouldAutoCreate('send-and-receive', 'to', 'outbound')).toBe(true);
  });
});

describe('isHandleBlocked', () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
  });

  it('matches an exact pattern', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([{ pattern: 'spam@x.com' }]) }),
    });
    expect(await isHandleBlocked('spam@x.com', 't-1')).toBe(true);
  });

  it('matches a wildcard domain pattern', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([{ pattern: '*@noreply.example.com' }]) }),
    });
    expect(await isHandleBlocked('bot@noreply.example.com', 't-1')).toBe(true);
  });

  it('returns false when no patterns match', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([{ pattern: '*@noreply.example.com' }]) }),
    });
    expect(await isHandleBlocked('alice@example.com', 't-1')).toBe(false);
  });
});

describe('matchHandleToContact', () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
  });

  it('returns the contact id when a match exists', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'contact-1' }]) }) }),
    });
    expect(await matchHandleToContact('alice@example.com', 't-1')).toBe('contact-1');
  });

  it('returns null when no contact matches', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    expect(await matchHandleToContact('alice@example.com', 't-1')).toBeNull();
  });
});

describe('insertParticipants', () => {
  beforeEach(() => {
    dbInsertMock.mockReset();
  });

  it('inserts one row per participant with personId resolved if known', async () => {
    let captured: any[] = [];
    dbInsertMock.mockReturnValue({
      values: (rows: any) => { captured = rows; return Promise.resolve(); },
    });

    await insertParticipants({
      messageId: 'msg-1',
      tenantId: 't-1',
      participants: [
        { role: 'from', handle: 'alice@x.com', displayName: 'Alice', personId: 'contact-1' },
        { role: 'to',   handle: 'me@x.com',    displayName: null,    personId: null },
      ],
    });

    expect(captured).toHaveLength(2);
    expect(captured[0]).toMatchObject({ role: 'from', handle: 'alice@x.com', personId: 'contact-1' });
    expect(captured[1]).toMatchObject({ role: 'to', handle: 'me@x.com', personId: null });
  });

  it('is a no-op when participants is empty', async () => {
    await insertParticipants({ messageId: 'msg-1', tenantId: 't-1', participants: [] });
    expect(dbInsertMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
cd packages/server && npm test -- participant-match-service
```

Expected: module-not-found.

- [ ] **Step 3: Implement the service**

Create `packages/server/src/apps/crm/services/participant-match.service.ts`:

```typescript
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../../config/database';
import { crmContacts, messageBlocklist, messageParticipants } from '../../../db/schema';

export type ContactAutoCreationPolicy = 'none' | 'send-only' | 'send-and-receive';
export type ParticipantRole = 'from' | 'to' | 'cc' | 'bcc';
export type MessageDirection = 'inbound' | 'outbound';

/**
 * Whether to auto-create a CRM contact for an unmatched participant on this
 * channel. Pure function; the caller looks up policy + direction.
 *
 * Semantics:
 * - `none`: never auto-create
 * - `send-only`: auto-create only when we sent this message AND the participant
 *   is a recipient (to/cc/bcc on an outbound message). The implicit assumption
 *   "I emailed them, they're a real lead" is the strongest weak signal.
 * - `send-and-receive`: auto-create from any participant on any direction.
 */
export function shouldAutoCreate(
  policy: ContactAutoCreationPolicy,
  role: ParticipantRole,
  direction: MessageDirection,
): boolean {
  if (policy === 'none') return false;
  if (policy === 'send-and-receive') return true;
  return direction === 'outbound' && role !== 'from';
}

/**
 * Check if a handle matches any blocklist pattern for the tenant. Patterns
 * may be exact (`alice@x.com`) or wildcard-domain (`*@noreply.example.com`).
 */
export async function isHandleBlocked(handle: string, tenantId: string): Promise<boolean> {
  const lower = handle.toLowerCase();
  const rows = await db
    .select({ pattern: messageBlocklist.pattern })
    .from(messageBlocklist)
    .where(eq(messageBlocklist.tenantId, tenantId));

  for (const row of rows) {
    const pattern = row.pattern.toLowerCase();
    if (pattern === lower) return true;
    if (pattern.startsWith('*@')) {
      const domain = pattern.slice(2);
      if (lower.endsWith(`@${domain}`)) return true;
    }
  }
  return false;
}

/**
 * Find a CRM contact by exact-match (case-insensitive) on the email column
 * within the tenant. Returns the contact id or null.
 */
export async function matchHandleToContact(handle: string, tenantId: string): Promise<string | null> {
  const lower = handle.toLowerCase();
  const [row] = await db
    .select({ id: crmContacts.id })
    .from(crmContacts)
    .where(
      and(
        eq(crmContacts.tenantId, tenantId),
        sql`LOWER(${crmContacts.email}) = ${lower}`,
      ),
    )
    .limit(1);
  return row?.id ?? null;
}

export interface ResolvedParticipant {
  role: ParticipantRole;
  handle: string;
  displayName: string | null;
  personId: string | null;
}

/**
 * Bulk-insert message_participants rows. Caller has already resolved
 * `personId` for known contacts; rows for unknown handles get `personId=null`.
 * No-op if `participants` is empty.
 */
export async function insertParticipants(args: {
  messageId: string;
  tenantId: string;
  participants: ResolvedParticipant[];
}): Promise<void> {
  if (args.participants.length === 0) return;

  const rows = args.participants.map((p) => ({
    messageId: args.messageId,
    tenantId: args.tenantId,
    role: p.role,
    handle: p.handle,
    displayName: p.displayName,
    personId: p.personId,
  }));

  await db.insert(messageParticipants).values(rows);
}
```

- [ ] **Step 4: Run, expect pass**

```bash
cd packages/server && npm test -- participant-match-service
```

Expected: 10 passing (3 shouldAutoCreate + 3 isHandleBlocked + 2 matchHandleToContact + 2 insertParticipants).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/apps/crm/services/participant-match.service.ts packages/server/test/participant-match-service.test.ts
git commit -m "feat(crm): participant matching — handle lookup, blocklist, auto-create policy"
```

---

## Task 5: Message-to-activity fan-out service

**Why:** Each ingested message creates `crm_activities` rows for every linked entity (the contact whose email matches a participant, that contact's open deals, that contact's company). Splitting from sync keeps the activity-creation logic testable and re-runnable when matching changes (e.g., a contact gets edited and now matches more messages).

**Files:**
- Create: `packages/server/src/apps/crm/services/message-activity.service.ts`
- Test: `packages/server/test/message-activity-service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/message-activity-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbSelectMock = vi.fn();
const dbInsertMock = vi.fn();

vi.mock('../src/config/database', () => ({
  db: {
    select: () => dbSelectMock(),
    insert: () => dbInsertMock(),
  },
}));

import { upsertActivitiesForMessage } from '../src/apps/crm/services/message-activity.service';

describe('upsertActivitiesForMessage', () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
    dbInsertMock.mockReset();
  });

  it('inserts no activities when message has no resolved contacts', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve([]) }),
    });

    await upsertActivitiesForMessage({
      messageId: 'msg-1',
      tenantId: 't-1',
      userId: 'u-1',
      direction: 'inbound',
    });

    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('inserts one activity per linked contact (and its company + open deals)', async () => {
    dbSelectMock
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ personId: 'contact-1' }]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ id: 'contact-1', companyId: 'company-1' }]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ id: 'deal-1' }, { id: 'deal-2' }]) }) });

    let captured: any[] = [];
    dbInsertMock.mockReturnValue({
      values: (rows: any) => { captured = rows; return Promise.resolve(); },
    });

    await upsertActivitiesForMessage({
      messageId: 'msg-1',
      tenantId: 't-1',
      userId: 'u-1',
      direction: 'inbound',
    });

    expect(captured).toHaveLength(4);
    expect(captured.every((r) => r.tenantId === 't-1')).toBe(true);
    expect(captured.every((r) => r.userId === 'u-1')).toBe(true);
    expect(captured.every((r) => r.messageId === 'msg-1')).toBe(true);
    expect(captured.every((r) => r.type === 'email-received')).toBe(true);
    expect(captured.every((r) => r.externalProvider === 'gmail')).toBe(true);

    const contactRow = captured.find((r) => r.contactId === 'contact-1' && !r.dealId && !r.companyId);
    const companyRow = captured.find((r) => r.companyId === 'company-1' && !r.contactId && !r.dealId);
    const deal1Row = captured.find((r) => r.dealId === 'deal-1');
    const deal2Row = captured.find((r) => r.dealId === 'deal-2');
    expect(contactRow).toBeDefined();
    expect(companyRow).toBeDefined();
    expect(deal1Row).toBeDefined();
    expect(deal2Row).toBeDefined();
  });

  it('uses email-sent type for outbound messages', async () => {
    dbSelectMock
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ personId: 'contact-1' }]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ id: 'contact-1', companyId: null }]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) });

    let captured: any[] = [];
    dbInsertMock.mockReturnValue({
      values: (rows: any) => { captured = rows; return Promise.resolve(); },
    });

    await upsertActivitiesForMessage({
      messageId: 'msg-1',
      tenantId: 't-1',
      userId: 'u-1',
      direction: 'outbound',
    });

    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe('email-sent');
  });

  it('skips company activity when contact has no companyId', async () => {
    dbSelectMock
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ personId: 'contact-1' }]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ id: 'contact-1', companyId: null }]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) });

    let captured: any[] = [];
    dbInsertMock.mockReturnValue({
      values: (rows: any) => { captured = rows; return Promise.resolve(); },
    });

    await upsertActivitiesForMessage({
      messageId: 'msg-1',
      tenantId: 't-1',
      userId: 'u-1',
      direction: 'inbound',
    });

    expect(captured).toHaveLength(1);
    expect(captured[0].contactId).toBe('contact-1');
    expect(captured[0].companyId).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
cd packages/server && npm test -- message-activity-service
```

Expected: module-not-found.

- [ ] **Step 3: Implement the service**

Create `packages/server/src/apps/crm/services/message-activity.service.ts`:

```typescript
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../../config/database';
import {
  crmActivities,
  crmContacts,
  crmDeals,
  messageParticipants,
} from '../../../db/schema';

export type MessageDirection = 'inbound' | 'outbound';

interface ActivityRow {
  tenantId: string;
  userId: string;
  type: 'email-received' | 'email-sent';
  body: string;
  messageId: string;
  externalProvider: string;
  externalId: string | null;
  contactId?: string;
  dealId?: string;
  companyId?: string;
}

/**
 * Create one CRM activity per linked entity for a message:
 *   - one per matched contact
 *   - one per matched contact's company (if any)
 *   - one per matched contact's open deals (isArchived = false)
 *
 * If a message has no matched contacts (every participant.personId is null),
 * inserts nothing — orphan messages live only in the messages table until
 * a future participant-match re-run picks them up.
 *
 * Safe to call only ONCE per message — no idempotency check today (Phase 2b
 * scope: ingestion runs each message exactly once via the
 * `(channelId, gmailMessageId)` unique constraint upstream).
 */
export async function upsertActivitiesForMessage(args: {
  messageId: string;
  tenantId: string;
  userId: string;
  direction: MessageDirection;
}): Promise<void> {
  const participantRows = await db
    .select({ personId: messageParticipants.personId })
    .from(messageParticipants)
    .where(eq(messageParticipants.messageId, args.messageId));

  const contactIds = Array.from(
    new Set(participantRows.map((r) => r.personId).filter((id): id is string => !!id)),
  );

  if (contactIds.length === 0) return;

  const contacts = await db
    .select({ id: crmContacts.id, companyId: crmContacts.companyId })
    .from(crmContacts)
    .where(inArray(crmContacts.id, contactIds));

  const openDeals = await db
    .select({ id: crmDeals.id })
    .from(crmDeals)
    .where(
      and(
        inArray(crmDeals.contactId, contactIds),
        // For Phase 2b "open" = `isArchived = false`. Stage-based won/lost detection is Phase 2c.
        eq(crmDeals.isArchived, false),
      ),
    );

  const type: ActivityRow['type'] = args.direction === 'inbound' ? 'email-received' : 'email-sent';
  const baseRow = {
    tenantId: args.tenantId,
    userId: args.userId,
    type,
    body: '', // body is rendered from the linked message; the activity row is just a pointer
    messageId: args.messageId,
    externalProvider: 'gmail',
    externalId: null as string | null,
  };

  const rows: ActivityRow[] = [];

  for (const c of contacts) {
    rows.push({ ...baseRow, contactId: c.id });
  }

  const companyIds = Array.from(new Set(contacts.map((c) => c.companyId).filter((id): id is string => !!id)));
  for (const companyId of companyIds) {
    rows.push({ ...baseRow, companyId });
  }

  for (const d of openDeals) {
    rows.push({ ...baseRow, dealId: d.id });
  }

  if (rows.length > 0) {
    await db.insert(crmActivities).values(rows);
  }
}
```

Note on the `participants` query: we filter null `personId` in JS, not SQL, because Drizzle's `isNull` requires extra wiring and the row count per message is tiny.

- [ ] **Step 4: Run, expect pass**

```bash
cd packages/server && npm test -- message-activity-service
```

Expected: 4 passing.

- [ ] **Step 5: Verify schema fields the service depends on actually exist**

Run a quick sanity check:

```bash
grep -nE "isArchived|companyId|stageId" packages/server/src/db/schema.ts | grep -E "crmDeals|crm_deals" | head -5
```

If `crmDeals.isArchived` doesn't exist, the implementation needs adjustment. The likely real shape can be checked with:

```bash
grep -nA20 "export const crmDeals = pgTable" packages/server/src/db/schema.ts | head -30
```

If the actual column is something other than `isArchived`, replace the `eq(crmDeals.isArchived, false)` predicate with the equivalent (e.g., a stage check, or no filter at all if "all deals" is fine for 2b). Document the deviation in the commit message.

- [ ] **Step 6: Run full suite + typecheck**

```bash
cd packages/server && npm test 2>&1 | tail -8
cd packages/server && npm run typecheck 2>&1 | tail -3
```

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/apps/crm/services/message-activity.service.ts packages/server/test/message-activity-service.test.ts
git commit -m "feat(crm): fan out one activity per linked entity for each message"
```

---

## Task 6: Gmail sync service (full + incremental)

**Why:** Now we wire the parser + participant-match + activity-fan-out together with `googleapis` calls. This is the heart of Phase 2b. Mirrors `calendar-sync.service.ts` shape: two exported async functions, channel-scoped (not account-scoped — that's the 2a refactor), each with throttling + cursor management.

**Files:**
- Create: `packages/server/src/apps/crm/services/gmail-sync.service.ts`
- Test: `packages/server/test/gmail-sync-service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/gmail-sync-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbSelectMock = vi.fn();
const dbInsertMock = vi.fn();
const dbUpdateMock = vi.fn();
const dbTransactionMock = vi.fn();

vi.mock('../src/config/database', () => ({
  db: {
    select: () => dbSelectMock(),
    insert: () => dbInsertMock(),
    update: () => dbUpdateMock(),
    transaction: (fn: any) => dbTransactionMock(fn),
  },
}));

const callGoogleApiMock = vi.fn();
vi.mock('../src/services/google-api-call', () => ({
  callGoogleApi: callGoogleApiMock,
}));

const matchHandleToContactMock = vi.fn();
const isHandleBlockedMock = vi.fn();
const insertParticipantsMock = vi.fn();
vi.mock('../src/apps/crm/services/participant-match.service', () => ({
  matchHandleToContact: matchHandleToContactMock,
  isHandleBlocked: isHandleBlockedMock,
  insertParticipants: insertParticipantsMock,
  shouldAutoCreate: () => false,
}));

const upsertActivitiesForMessageMock = vi.fn();
vi.mock('../src/apps/crm/services/message-activity.service', () => ({
  upsertActivitiesForMessage: upsertActivitiesForMessageMock,
}));

import {
  performGmailFullSync,
  performGmailIncrementalSync,
} from '../src/apps/crm/services/gmail-sync.service';

beforeEach(() => {
  dbSelectMock.mockReset();
  dbInsertMock.mockReset();
  dbUpdateMock.mockReset();
  dbTransactionMock.mockReset();
  callGoogleApiMock.mockReset();
  matchHandleToContactMock.mockReset();
  isHandleBlockedMock.mockReset();
  insertParticipantsMock.mockReset();
  upsertActivitiesForMessageMock.mockReset();
});

describe('performGmailFullSync', () => {
  it('throws "channel not found" when the channel does not exist', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    await expect(performGmailFullSync('c-missing')).rejects.toThrow(/channel not found/i);
  });

  it('returns early when the channel is throttled', async () => {
    const future = new Date(Date.now() + 60_000);
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'c1', accountId: 'a1', tenantId: 't1', ownerUserId: 'u1', isSyncEnabled: true, throttleRetryAfter: future }]) }) }),
    });
    await performGmailFullSync('c1');
    expect(callGoogleApiMock).not.toHaveBeenCalled();
  });

  it('returns early when the channel sync is disabled', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'c1', accountId: 'a1', tenantId: 't1', ownerUserId: 'u1', isSyncEnabled: false, throttleRetryAfter: null }]) }) }),
    });
    await performGmailFullSync('c1');
    expect(callGoogleApiMock).not.toHaveBeenCalled();
  });

  // Structural-contract tests only. Real Gmail API behavior is integration-tested
  // manually (Task 8 Step 3). Mocking the full page-walk + ingest loop in a unit
  // test is brittle and low-signal — fixture-based integration tests in Phase 2c
  // will cover the ingestion loop end-to-end.
});

describe('performGmailIncrementalSync', () => {
  it('throws "channel not found" when the channel does not exist', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    await expect(performGmailIncrementalSync('c-missing')).rejects.toThrow(/channel not found/i);
  });

  it('returns early when channel is throttled', async () => {
    const future = new Date(Date.now() + 60_000);
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'c1', accountId: 'a1', tenantId: 't1', ownerUserId: 'u1', isSyncEnabled: true, syncCursor: 'cursor-123', throttleRetryAfter: future }]) }) }),
    });
    await performGmailIncrementalSync('c1');
    expect(callGoogleApiMock).not.toHaveBeenCalled();
  });

  it('returns early when channel has no syncCursor (full sync needed)', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'c1', accountId: 'a1', tenantId: 't1', ownerUserId: 'u1', isSyncEnabled: true, syncCursor: null, throttleRetryAfter: null }]) }) }),
    });
    await performGmailIncrementalSync('c1');
    expect(callGoogleApiMock).not.toHaveBeenCalled();
  });
});
```

Note: this test focuses on the **gating logic** (throttle, disabled, missing). The real ingestion loop (parsing, upserting, fanning out) is exercised end-to-end in Task 8's manual smoke. Unit-testing every page-walk variant against `googleapis` mocks would be brittle and low-signal.

- [ ] **Step 2: Run, expect failure**

```bash
cd packages/server && npm test -- gmail-sync-service
```

Expected: module-not-found.

- [ ] **Step 3: Implement the service**

Create `packages/server/src/apps/crm/services/gmail-sync.service.ts`:

```typescript
import { google, type gmail_v1 } from 'googleapis';
import { eq } from 'drizzle-orm';
import { db } from '../../../config/database';
import { messageChannels, messageThreads, messages } from '../../../db/schema';
import { callGoogleApi } from '../../../services/google-api-call';
import { logger } from '../../../utils/logger';
import { withRetry } from '../../../utils/retry';
import { parseGmailMessage } from './gmail-message-parser';
import {
  matchHandleToContact,
  isHandleBlocked,
  insertParticipants,
  shouldAutoCreate,
  type ResolvedParticipant,
} from './participant-match.service';
import { upsertActivitiesForMessage } from './message-activity.service';

const FULL_SYNC_QUERY = 'newer_than:90d';
const PAGE_SIZE = 100;
const MAX_PAGES_PER_RUN = 50; // hard cap to bound runtime; large mailboxes resume on next tick

interface ChannelRow {
  id: string;
  accountId: string;
  tenantId: string;
  ownerUserId: string;
  isSyncEnabled: boolean;
  syncCursor: string | null;
  throttleRetryAfter: Date | null;
}

async function loadChannel(channelId: string): Promise<ChannelRow> {
  const [row] = await db
    .select({
      id: messageChannels.id,
      accountId: messageChannels.accountId,
      tenantId: messageChannels.tenantId,
      ownerUserId: messageChannels.ownerUserId,
      isSyncEnabled: messageChannels.isSyncEnabled,
      syncCursor: messageChannels.syncCursor,
      throttleRetryAfter: messageChannels.throttleRetryAfter,
    })
    .from(messageChannels)
    .where(eq(messageChannels.id, channelId))
    .limit(1);
  if (!row) throw new Error(`channel not found: ${channelId}`);
  return row as ChannelRow;
}

function isThrottled(channel: ChannelRow): boolean {
  return !!channel.throttleRetryAfter && channel.throttleRetryAfter.getTime() > Date.now();
}

async function setStage(
  channelId: string,
  stage: 'pending' | 'full-sync' | 'incremental' | 'failed',
  extra: Record<string, unknown> = {},
): Promise<void> {
  await db
    .update(messageChannels)
    .set({ syncStage: stage, updatedAt: new Date(), ...extra })
    .where(eq(messageChannels.id, channelId));
}

async function handleThrottle(channelId: string, retryAfterSeconds: number): Promise<void> {
  await db
    .update(messageChannels)
    .set({
      throttleRetryAfter: new Date(Date.now() + retryAfterSeconds * 1000),
      updatedAt: new Date(),
    })
    .where(eq(messageChannels.id, channelId));
}

/**
 * Phase 2b ingestion: full sync. Walks `users.messages.list` (90-day backfill),
 * fetches each message with `format=full`, parses into our schema, upserts
 * threads + messages + participants, fans out to crm_activities. Bounded by
 * MAX_PAGES_PER_RUN — large mailboxes finish on subsequent runs.
 */
export async function performGmailFullSync(channelId: string): Promise<void> {
  const channel = await loadChannel(channelId);
  if (!channel.isSyncEnabled) {
    logger.info({ channelId }, 'Gmail sync skipped: channel is disabled');
    return;
  }
  if (isThrottled(channel)) {
    logger.info({ channelId, throttleRetryAfter: channel.throttleRetryAfter }, 'Gmail sync skipped: throttled');
    return;
  }

  logger.info({ channelId, accountId: channel.accountId }, 'Starting Gmail full sync');
  await setStage(channelId, 'full-sync', { syncStatus: 'running', syncError: null });

  let pageToken: string | undefined;
  let pagesProcessed = 0;
  let messagesIngested = 0;

  try {
    do {
      const listRes = await callGoogleApi(channel.accountId, async (auth) => {
        const gmail = google.gmail({ version: 'v1', auth });
        return withRetry(
          () => gmail.users.messages.list({
            userId: 'me',
            q: FULL_SYNC_QUERY,
            maxResults: PAGE_SIZE,
            pageToken,
          }),
          'Gmail API messages.list',
        );
      });

      const ids = (listRes.data.messages ?? []).map((m) => m.id!).filter(Boolean);
      pageToken = listRes.data.nextPageToken ?? undefined;

      for (const id of ids) {
        try {
          const msgRes = await callGoogleApi(channel.accountId, async (auth) => {
            const gmail = google.gmail({ version: 'v1', auth });
            return withRetry(
              () => gmail.users.messages.get({ userId: 'me', id, format: 'full' }),
              'Gmail API messages.get',
            );
          });
          await ingestMessage(channel, msgRes.data, 'inbound');
          messagesIngested++;
        } catch (err: any) {
          if (err?.code === 429 || err?.response?.status === 429) {
            const retry = parseRetryAfter(err);
            await handleThrottle(channel.id, retry);
            logger.warn({ channelId, retry }, 'Gmail full sync throttled; will resume after backoff');
            return;
          }
          logger.error({ err, channelId, gmailId: id }, 'Failed to ingest Gmail message; continuing');
        }
      }

      pagesProcessed++;
    } while (pageToken && pagesProcessed < MAX_PAGES_PER_RUN);

    const profileRes = await callGoogleApi(channel.accountId, async (auth) => {
      const gmail = google.gmail({ version: 'v1', auth });
      return withRetry(
        () => gmail.users.getProfile({ userId: 'me' }),
        'Gmail API getProfile',
      );
    });
    const latestHistoryId = profileRes.data.historyId ?? null;

    await setStage(channelId, 'incremental', {
      syncCursor: latestHistoryId,
      lastFullSyncAt: new Date(),
      syncStatus: null,
    });

    logger.info({ channelId, messagesIngested, pagesProcessed, latestHistoryId }, 'Gmail full sync completed');
  } catch (err: any) {
    logger.error({ err, channelId }, 'Gmail full sync failed');
    await setStage(channelId, 'failed', { syncError: String(err?.message ?? err) });
    throw err;
  }
}

/**
 * Phase 2b ingestion: incremental sync via `users.history.list`. If the
 * cursor is missing, marks the channel as needing a full sync. If the
 * cursor is expired (404), also marks as pending.
 */
export async function performGmailIncrementalSync(channelId: string): Promise<void> {
  const channel = await loadChannel(channelId);
  if (!channel.isSyncEnabled) return;
  if (isThrottled(channel)) return;
  if (!channel.syncCursor) {
    logger.info({ channelId }, 'Gmail incremental sync skipped: no syncCursor (full sync needed)');
    await setStage(channelId, 'pending', {
      syncStatus: 'awaiting-full-sync',
    });
    return;
  }

  let pageToken: string | undefined;
  let messagesIngested = 0;
  let lastHistoryId: string | null = channel.syncCursor;

  try {
    do {
      let historyRes;
      try {
        historyRes = await callGoogleApi(channel.accountId, async (auth) => {
          const gmail = google.gmail({ version: 'v1', auth });
          return withRetry(
            () => gmail.users.history.list({
              userId: 'me',
              startHistoryId: channel.syncCursor!,
              pageToken,
            }),
            'Gmail API history.list',
          );
        });
      } catch (err: any) {
        if (err?.code === 404 || err?.response?.status === 404) {
          logger.warn({ channelId }, 'Gmail incremental cursor expired; flipping to pending for full sync');
          await setStage(channelId, 'pending', { syncCursor: null, syncStatus: 'cursor-expired' });
          return;
        }
        throw err;
      }

      const records = historyRes.data.history ?? [];
      pageToken = historyRes.data.nextPageToken ?? undefined;
      lastHistoryId = historyRes.data.historyId ?? lastHistoryId;

      for (const record of records) {
        for (const added of record.messagesAdded ?? []) {
          if (!added.message?.id) continue;
          try {
            const msgRes = await callGoogleApi(channel.accountId, async (auth) => {
              const gmail = google.gmail({ version: 'v1', auth });
              return withRetry(
                () => gmail.users.messages.get({ userId: 'me', id: added.message!.id!, format: 'full' }),
                'Gmail API messages.get',
              );
            });
            await ingestMessage(channel, msgRes.data, 'inbound');
            messagesIngested++;
          } catch (err) {
            logger.error({ err, channelId, gmailId: added.message.id }, 'Failed to ingest Gmail message during incremental; continuing');
          }
        }

        for (const deleted of record.messagesDeleted ?? []) {
          if (!deleted.message?.id) continue;
          try {
            await db.update(messages)
              .set({ deletedAt: new Date(), updatedAt: new Date() })
              .where(eq(messages.gmailMessageId, deleted.message.id));
          } catch (err) {
            logger.error({ err, channelId, gmailId: deleted.message.id }, 'Failed to soft-delete message');
          }
        }

        // labelsAdded / labelsRemoved: skipped in 2b. Labels are captured at full ingest;
        // re-syncing labels per history record adds complexity for a feature we don't render yet.
      }
    } while (pageToken);

    await setStage(channelId, 'incremental', {
      syncCursor: lastHistoryId,
      lastIncrementalSyncAt: new Date(),
      syncStatus: null,
    });
    logger.info({ channelId, messagesIngested, syncCursor: lastHistoryId }, 'Gmail incremental sync completed');
  } catch (err: any) {
    if (err?.code === 429 || err?.response?.status === 429) {
      const retry = parseRetryAfter(err);
      await handleThrottle(channelId, retry);
      logger.warn({ channelId, retry }, 'Gmail incremental sync throttled');
      return;
    }
    logger.error({ err, channelId }, 'Gmail incremental sync failed');
    await setStage(channelId, 'failed', { syncError: String(err?.message ?? err) });
    throw err;
  }
}

/**
 * Upsert a single Gmail message + its thread + participants + activities.
 * Idempotent on `(channelId, gmailMessageId)` via the unique constraint;
 * second call is a no-op.
 */
async function ingestMessage(
  channel: ChannelRow,
  raw: gmail_v1.Schema$Message,
  direction: 'inbound' | 'outbound',
): Promise<void> {
  const parsed = parseGmailMessage(raw);
  if (!parsed.gmailMessageId || !parsed.gmailThreadId) {
    logger.warn({ channelId: channel.id }, 'Skipping Gmail message with missing id/threadId');
    return;
  }

  const [existingThread] = await db
    .select({ id: messageThreads.id })
    .from(messageThreads)
    .where(eq(messageThreads.gmailThreadId, parsed.gmailThreadId))
    .limit(1);

  let threadId: string;
  if (existingThread) {
    threadId = existingThread.id;
    await db.update(messageThreads)
      .set({
        lastMessageAt: parsed.receivedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(messageThreads.id, existingThread.id));
  } else {
    const [inserted] = await db.insert(messageThreads).values({
      channelId: channel.id,
      tenantId: channel.tenantId,
      gmailThreadId: parsed.gmailThreadId,
      subject: parsed.subject,
      messageCount: 1,
      lastMessageAt: parsed.receivedAt ?? new Date(),
    }).returning({ id: messageThreads.id });
    threadId = inserted.id;
  }

  const [existingMsg] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.gmailMessageId, parsed.gmailMessageId))
    .limit(1);
  if (existingMsg) return;

  const [insertedMsg] = await db.insert(messages).values({
    channelId: channel.id,
    threadId,
    tenantId: channel.tenantId,
    gmailMessageId: parsed.gmailMessageId,
    headerMessageId: parsed.headerMessageId,
    inReplyTo: parsed.inReplyTo,
    subject: parsed.subject,
    snippet: parsed.snippet,
    bodyText: parsed.bodyText,
    bodyHtml: null, // Phase 2b: text only. HTML rendering is 2c/2d.
    direction,
    status: 'received',
    sentAt: parsed.receivedAt,
    receivedAt: direction === 'inbound' ? parsed.receivedAt : null,
    labels: parsed.labels,
    hasAttachments: parsed.hasAttachments,
  }).returning({ id: messages.id });

  const resolved: ResolvedParticipant[] = [];
  for (const p of parsed.participants) {
    if (await isHandleBlocked(p.handle, channel.tenantId)) {
      resolved.push({ ...p, personId: null });
      continue;
    }
    const personId = await matchHandleToContact(p.handle, channel.tenantId);
    if (personId) {
      resolved.push({ ...p, personId });
    } else if (shouldAutoCreate('send-only', p.role, direction)) {
      // Phase 2b: auto-create not yet implemented — flag for follow-up.
      // The shouldAutoCreate stub returns false in tests; in prod the policy
      // is read from channel.contactAutoCreationPolicy by 2c.
      resolved.push({ ...p, personId: null });
    } else {
      resolved.push({ ...p, personId: null });
    }
  }

  await insertParticipants({
    messageId: insertedMsg.id,
    tenantId: channel.tenantId,
    participants: resolved,
  });

  await upsertActivitiesForMessage({
    messageId: insertedMsg.id,
    tenantId: channel.tenantId,
    userId: channel.ownerUserId,
    direction,
  });
}

/** Read the Retry-After header (in seconds) from a 429 error, defaulting to 60. */
function parseRetryAfter(err: any): number {
  const header = err?.response?.headers?.['retry-after'];
  if (typeof header === 'string') {
    const n = Number(header);
    if (!isNaN(n) && n > 0 && n < 3600) return n;
  }
  return 60;
}
```

- [ ] **Step 4: Run, expect pass**

```bash
cd packages/server && npm test -- gmail-sync-service
```

Expected: 5 passing.

- [ ] **Step 5: Run full suite + typecheck**

```bash
cd packages/server && npm test 2>&1 | tail -8
cd packages/server && npm run typecheck 2>&1 | tail -3
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/apps/crm/services/gmail-sync.service.ts packages/server/test/gmail-sync-service.test.ts
git commit -m "feat(crm): Gmail full + incremental sync service"
```

---

## Task 7: Wire Gmail jobs into the worker + scheduler

**Why:** The pieces exist; now the worker actually dispatches `gmail-full-sync` / `gmail-incremental-sync` to them, and the scheduler enqueues incremental jobs every 5 min per channel.

**Files:**
- Modify: `packages/server/src/workers/sync.worker.ts`
- Modify: `packages/server/src/workers/index.ts`
- Modify: `packages/server/src/index.ts` (call the new scheduler)
- Test: extend `packages/server/test/sync-worker.test.ts` and `packages/server/test/workers-index.test.ts`

- [ ] **Step 1: Add the worker dispatch cases**

In `packages/server/src/workers/sync.worker.ts`, find the existing imports block:

```typescript
import {
  SYNC_QUEUE_NAME,
  SyncJobName,
  type CalendarFullSyncJobData,
  type CalendarIncrementalSyncJobData,
} from '../config/queue';
import {
  performCalendarFullSync,
  performCalendarIncrementalSync,
} from '../services/calendar-sync.service';
```

Add the Gmail types and the gmail-sync service import:

```typescript
import {
  SYNC_QUEUE_NAME,
  SyncJobName,
  type CalendarFullSyncJobData,
  type CalendarIncrementalSyncJobData,
  type GmailFullSyncJobData,
  type GmailIncrementalSyncJobData,
} from '../config/queue';
import {
  performCalendarFullSync,
  performCalendarIncrementalSync,
} from '../services/calendar-sync.service';
import {
  performGmailFullSync,
  performGmailIncrementalSync,
} from '../apps/crm/services/gmail-sync.service';
```

Find the `processSyncJob` switch and add the two Gmail cases before the `default:`:

```typescript
    case SyncJobName.GmailFullSync: {
      const { channelId } = job.data as GmailFullSyncJobData;
      logger.info({ jobId: job.id, channelId }, 'Running Gmail full sync');
      await performGmailFullSync(channelId);
      return;
    }
    case SyncJobName.GmailIncrementalSync: {
      const { channelId } = job.data as GmailIncrementalSyncJobData;
      logger.info({ jobId: job.id, channelId }, 'Running Gmail incremental sync');
      await performGmailIncrementalSync(channelId);
      return;
    }
```

- [ ] **Step 2: Extend the worker test**

In `packages/server/test/sync-worker.test.ts`, find the existing `vi.mock('../src/services/calendar-sync.service', ...)` block. Add a parallel mock for the gmail service:

```typescript
vi.mock('../src/apps/crm/services/gmail-sync.service', () => ({
  performGmailFullSync: vi.fn(async () => undefined),
  performGmailIncrementalSync: vi.fn(async () => undefined),
}));
```

Add an import alongside the existing one:

```typescript
import * as gmailSync from '../src/apps/crm/services/gmail-sync.service';
```

Add two new test cases inside the `describe('sync.worker: processSyncJob', ...)` block:

```typescript
  it('dispatches gmail-full-sync to performGmailFullSync', async () => {
    await processSyncJob({
      name: 'gmail-full-sync',
      data: { channelId: 'ch-1', triggeredBy: 'user', userId: 'u-1' },
    } as any);
    expect(gmailSync.performGmailFullSync).toHaveBeenCalledWith('ch-1');
    expect(gmailSync.performGmailIncrementalSync).not.toHaveBeenCalled();
  });

  it('dispatches gmail-incremental-sync to performGmailIncrementalSync', async () => {
    await processSyncJob({
      name: 'gmail-incremental-sync',
      data: { channelId: 'ch-2' },
    } as any);
    expect(gmailSync.performGmailIncrementalSync).toHaveBeenCalledWith('ch-2');
    expect(gmailSync.performGmailFullSync).not.toHaveBeenCalled();
  });
```

- [ ] **Step 3: Run worker tests**

```bash
cd packages/server && npm test -- sync-worker
```

Expected: 5 passing (was 3 + 2 new).

- [ ] **Step 4: Add the Gmail incremental scheduler**

In `packages/server/src/workers/index.ts`, find:

```typescript
import {
  getSyncQueue,
  closeSyncQueue,
  SyncJobName,
  type CalendarIncrementalSyncJobData,
} from '../config/queue';
```

Add the Gmail type:

```typescript
import {
  getSyncQueue,
  closeSyncQueue,
  SyncJobName,
  type CalendarIncrementalSyncJobData,
  type GmailIncrementalSyncJobData,
} from '../config/queue';
```

Replace the existing `import { accounts } from '../db/schema';` with:

```typescript
import { accounts, messageChannels } from '../db/schema';
```

Update the drizzle-orm import to include `and`:

```typescript
import { and, eq } from 'drizzle-orm';
```

Add a new exported function alongside `scheduleIncrementalSyncForAllAccounts`:

```typescript
/**
 * Idempotently schedule a repeatable Gmail incremental-sync job for every
 * channel where sync is enabled. Mirrors the calendar scheduler.
 */
export async function scheduleGmailIncrementalSyncForAllChannels(): Promise<void> {
  const queue = getSyncQueue();
  if (!queue) return;

  const rows = await db
    .select({ id: messageChannels.id })
    .from(messageChannels)
    .where(and(eq(messageChannels.isSyncEnabled, true), eq(messageChannels.type, 'gmail')));

  const results = await Promise.allSettled(
    rows.map((row) =>
      queue.upsertJobScheduler(
        `gmail-incremental-${row.id}`,
        { every: INCREMENTAL_INTERVAL_MS },
        {
          name: SyncJobName.GmailIncrementalSync,
          data: { channelId: row.id } satisfies GmailIncrementalSyncJobData,
        },
      ),
    ),
  );

  const failures = results
    .map((r, i) => (r.status === 'rejected' ? { channelId: rows[i].id, reason: r.reason } : null))
    .filter((x): x is { channelId: string; reason: unknown } => x !== null);

  for (const f of failures) {
    logger.error({ channelId: f.channelId, err: f.reason }, 'Failed to schedule Gmail incremental sync for channel');
  }

  logger.info(
    {
      total: rows.length,
      scheduled: rows.length - failures.length,
      failed: failures.length,
      intervalMs: INCREMENTAL_INTERVAL_MS,
    },
    'Scheduled incremental Gmail sync',
  );
}
```

- [ ] **Step 5: Wire into bootstrap**

In `packages/server/src/index.ts`, find:

```typescript
import { startSyncWorker, stopSyncWorker, scheduleIncrementalSyncForAllAccounts } from './workers';
```

Replace with:

```typescript
import {
  startSyncWorker,
  stopSyncWorker,
  scheduleIncrementalSyncForAllAccounts,
  scheduleGmailIncrementalSyncForAllChannels,
} from './workers';
```

Find the existing call site:

```typescript
  scheduleIncrementalSyncForAllAccounts().catch((err) =>
    logger.error({ err }, 'Failed to schedule incremental sync jobs'),
  );
```

Add the Gmail scheduler immediately after:

```typescript
  scheduleGmailIncrementalSyncForAllChannels().catch((err) =>
    logger.error({ err }, 'Failed to schedule Gmail incremental sync jobs'),
  );
```

- [ ] **Step 6: Extend the workers-index test**

In `packages/server/test/workers-index.test.ts`, find the existing test for `scheduleIncrementalSyncForAllAccounts`. Add a sibling describe block:

```typescript
describe('workers/index: scheduleGmailIncrementalSyncForAllChannels', () => {
  beforeEach(() => {
    addMock.mockClear();
    upsertJobSchedulerMock.mockClear();
  });

  it('upserts one repeatable job per gmail channel with sync enabled', async () => {
    vi.resetModules();
    vi.doMock('../src/config/database', () => ({
      db: {
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([{ id: 'ch-1' }, { id: 'ch-2' }]),
          }),
        }),
      },
    }));
    const { scheduleGmailIncrementalSyncForAllChannels: fn } = await import('../src/workers/index');
    await fn();
    expect(upsertJobSchedulerMock).toHaveBeenCalledTimes(2);
    expect(upsertJobSchedulerMock).toHaveBeenCalledWith(
      'gmail-incremental-ch-1',
      expect.objectContaining({ every: 5 * 60 * 1000 }),
      expect.objectContaining({
        name: 'gmail-incremental-sync',
        data: { channelId: 'ch-1' },
      }),
    );
    vi.doUnmock('../src/config/database');
  });
});
```

- [ ] **Step 7: Run the full suite**

```bash
cd packages/server && npm test 2>&1 | tail -8
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: green.

- [ ] **Step 8: Smoke-boot — verify both schedulers run**

```bash
docker compose ps
cd packages/server && REDIS_URL="redis://localhost:6379" npm run dev 2>&1 | tee /tmp/atlas-2b-task7.log &
```

Wait for `Atlas server running`. Then:

```bash
grep -E "Scheduled incremental calendar sync|Scheduled incremental Gmail sync" /tmp/atlas-2b-task7.log
```

Expected: both lines present, with `total: 0` (or N if your dev DB has Google channels).

Kill: `lsof -ti:3001 | xargs kill -9 2>/dev/null && rm -f /tmp/atlas-2b-task7.log`

- [ ] **Step 9: Commit**

```bash
git add packages/server/src/workers/sync.worker.ts packages/server/src/workers/index.ts packages/server/src/index.ts packages/server/test/sync-worker.test.ts packages/server/test/workers-index.test.ts
git commit -m "feat(server): wire Gmail jobs into worker dispatch + repeatable scheduler"
```

---

## Task 8: End-to-end manual smoke + final verification (NO PUSH)

**Why:** Unit tests cover gating + parsing + matching independently. The real integration — Gmail API → ingestion → activity — must be exercised against a real account at least once before declaring 2b done.

- [ ] **Step 1: Run full server test suite**

```bash
cd packages/server && npm test 2>&1 | tail -8
```

Expected: ~510 passed (473 baseline + ~37 new).

- [ ] **Step 2: Server typecheck + lint + build**

```bash
cd packages/server && npm run typecheck 2>&1 | tail -3
cd packages/server && npm run lint 2>&1 | grep -E "error|^✖" | tail -3
cd packages/server && npm run build 2>&1 | tail -3
```

Expected: typecheck clean, 0 lint errors, build clean.

Verify new artifacts compiled:

```bash
ls packages/server/dist/apps/crm/services/gmail-sync.service.js
ls packages/server/dist/apps/crm/services/gmail-message-parser.js
ls packages/server/dist/apps/crm/services/participant-match.service.js
ls packages/server/dist/apps/crm/services/message-activity.service.js
ls packages/server/dist/services/google-api-call.js
ls packages/server/dist/db/migrations/2026-04-29-gmail-message-partial-index.js
```

All six should exist.

- [ ] **Step 3: Manual end-to-end smoke (REQUIRED)**

This step gates "2b is done." The unit tests don't exercise the real Gmail API.

Prerequisites:
- A Google OAuth client configured (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.env`).
- A test Google account you can connect.
- Postgres + Redis containers running (`docker compose up -d`).

Procedure:

1. Start dev servers:
   ```bash
   cd packages/server && REDIS_URL="redis://localhost:6379" npm run dev &
   cd packages/client && npm run dev &
   ```
2. Open http://localhost:5180. Log in. Navigate to Settings > Integrations.
3. If already connected to Google: disconnect first to clear state. Then click "Connect Google" and complete the OAuth dance.
4. After redirect, verify the Email channels list shows one row with `Pending` badge.
5. Click "Sync now" on the channel.
6. Watch server logs for the sequence:
   - `Running Gmail full sync { channelId: ..., accountId: ... }`
   - Multiple `Gmail API messages.list` and `Gmail API messages.get` retries (visible if `withRetry` logs)
   - `Gmail full sync completed { channelId, messagesIngested, pagesProcessed, latestHistoryId }`
   - `Sync job completed`
7. Verify in psql:
   ```bash
   docker compose exec -T postgres psql -U postgres atlas -c "SELECT count(*) FROM messages;"
   docker compose exec -T postgres psql -U postgres atlas -c "SELECT count(*) FROM message_threads;"
   docker compose exec -T postgres psql -U postgres atlas -c "SELECT count(*) FROM message_participants;"
   docker compose exec -T postgres psql -U postgres atlas -c "SELECT count(*) FROM crm_activities WHERE type IN ('email-received', 'email-sent');"
   ```
   The first three should be > 0 (proportional to your test inbox's last 90 days). The fourth depends on whether any participant emails match existing CRM contacts — if your test tenant has zero contacts, the activity count may be 0, and that's correct.
8. Add a CRM contact whose email matches a sender from the synced messages. Re-run "Sync now" — note that today, the second run is a no-op (the messages are already ingested). Phase 2c adds a "re-match all" job to handle this. For 2b, **manual contact creation BEFORE first sync** is the test path — start over with a tenant that has a few contacts whose emails appear in the test inbox, then sync, then verify activities appear on those contacts' timelines.
9. Verify the channel's `syncStage` is now `incremental`:
   ```bash
   docker compose exec -T postgres psql -U postgres atlas -c "SELECT id, sync_stage, sync_cursor, last_full_sync_at FROM message_channels;"
   ```
10. Wait 5 minutes (or trigger manually by enqueueing a `gmail-incremental-sync` via psql/redis-cli). Verify a `Running Gmail incremental sync` log appears and completes cleanly.

Kill the dev servers when done.

If any step fails: file a bug, don't push. The plan's correctness gate is this manual smoke.

- [ ] **Step 4: Verify nothing accidentally pushed**

```bash
git log --oneline origin/main..HEAD
```

Expected: 7 unpushed commits (one per task).

- [ ] **Step 5: Report**

Per Atlas convention this plan does NOT push. The user batches with later sub-phases. Summarize:
- Tasks 1–7 completed
- New endpoint behavior: clicking "Sync now" in the channel UI now runs a real Gmail sync; messages appear on contact timelines (when the participant matches an existing CRM contact)
- New scheduler: every 5 minutes per channel with `isSyncEnabled=true`, an incremental sync runs
- Calendar sync now uses the 401-retry wrapper too (Phase 1 review item resolved)
- No outbound send, no auto-create, no visibility enforcement on reads (those are 2c/2d)

---

## Acceptance criteria

This phase is done when:

- [ ] All server tests pass (~510 expected)
- [ ] `npm run typecheck` clean in `packages/server`
- [ ] `npm run lint` 0 errors in `packages/server`
- [ ] `npm run build` clean in `packages/server`
- [ ] Manual end-to-end smoke (Task 8 Step 3) succeeds: connect Google → click "Sync now" → see messages, threads, participants in psql, and activities for matched contacts
- [ ] Repeatable `gmail-incremental-sync` job runs every 5 min per enabled channel
- [ ] Calendar sync still works (no regression from the wrapper retrofit)
- [ ] No outbound send code added
- [ ] No new top-level dependencies added
- [ ] All commits target `main`; no feature branch; no `git push`

---

## What this unblocks for sub-phase 2c

Phase 2c (Outbound send) becomes purely additive:

1. Add `gmail-send` job dispatch case to `sync.worker.ts`
2. Build `gmail-send.service.ts` (RFC 5322 message construction with threading headers, base64url encoding, `users.messages.send` with `threadId`)
3. Add `POST /crm/messages/send` and `POST /crm/messages/:id/retry` endpoints
4. Build the composer UI (reply-in-thread + new-to-contact) using the existing 2a UI patterns
5. Wire the contact auto-creation path (the `shouldAutoCreate('send-only', ...)` branch in `gmail-sync.service.ts:ingestMessage` is currently a no-op; 2c implements the create call)

No schema changes needed in 2c. Read-path visibility filtering and retention come in 2d.
