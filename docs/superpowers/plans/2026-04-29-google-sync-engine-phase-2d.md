# Google Sync Engine — Phase 2d: Visibility, Retention, Blocklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four remaining gaps from the Phase 2 spec — broaden message-read visibility from owner-only to channel-visibility-aware; soft/hard-delete old messages on a daily cron driven by per-tenant retention; seed the blocklist on first boot; let users block a sender from the timeline.

**Architecture:** Visibility moves from a separate `getChannelById` round-trip into a single JOIN on the message-read query. Retention is a new BullMQ repeatable job (`gmail-message-cleaner`) scheduled daily by `workers/index.ts`. Blocklist seed is one idempotent insert per tenant in `bootstrap.ts` (the existing migration runner). "Block sender" is one new endpoint (`POST /crm/blocklist`) consumed by a new client mutation hook + a button in the timeline's email-activity row.

**Tech Stack:** Drizzle ORM, BullMQ ^5.25, vitest, React + TanStack Query + react-i18next.

**Out of scope (per spec):** Tenant-level retention UI (Phase 3). Backfill activities for new contact matches (deferred). Functional index on `crm_contacts.email` (deferred — premature without production scale). Batch `/messages?ids=` endpoint (deferred — N+1 acceptable at current volume). Orphan scheduler reconcile (Phase 2b TODO; not in 2d's spec scope). Visibility controls in Settings UI (already shipped in 2a).

---

## Phase 2c baseline

The Phase 2c commits already on `origin/main` (`f1cd1fb2..81acfa45`) define the foundation:
- `messages.controller.ts:getMessage` does owner-only visibility via a separate `getChannelById` call.
- `tenants` table has no `gmail_retention_days` column today.
- `message_blocklist` schema exists (added in 2a) with unique `(tenantId, pattern)` — no rows seeded.
- `participant-match.service:loadBlocklist` already reads from this table; the seed will start populating it.
- BullMQ scheduler in `workers/index.ts` already runs `scheduleGmailIncrementalSyncForAllChannels()` on boot. We add `scheduleDailyMessageCleaner()` next to it.

---

## File structure

**New files (server):**
- `packages/server/src/apps/crm/services/gmail-message-cleaner.service.ts` — `performGmailMessageCleaner()`. Soft-deletes messages older than per-tenant retention; hard-deletes 30 days after soft-delete.
- `packages/server/src/apps/crm/services/blocklist-seed.service.ts` — `seedBlocklistForTenant(tenantId)`. Idempotent insert of the four default patterns.
- `packages/server/src/apps/crm/controllers/blocklist.controller.ts` — `addBlocklistEntry`. Single REST handler.
- `packages/server/test/gmail-message-cleaner-service.test.ts`
- `packages/server/test/blocklist-seed-service.test.ts`
- `packages/server/test/blocklist-controller.test.ts`

**Modified files (server):**
- `packages/server/src/db/schema.ts` — add `gmailRetentionDays integer` to `tenants` table.
- `packages/server/src/db/bootstrap.ts` — `addColumnIfMissing('tenants', 'gmail_retention_days', 'INTEGER')` + invoke blocklist seed for every tenant on boot.
- `packages/server/src/config/queue.ts` — add `SyncJobName.GmailMessageCleaner` + extend `SyncJobData` union (no payload — cleaner walks all tenants).
- `packages/server/src/workers/sync.worker.ts` — add `case SyncJobName.GmailMessageCleaner`.
- `packages/server/src/workers/index.ts` — `scheduleDailyMessageCleaner()` repeatable job.
- `packages/server/src/apps/crm/controllers/messages.controller.ts` — `getMessage` becomes a single JOIN through `messageChannels` with the visibility filter; the separate `getChannelById` call goes away.
- `packages/server/src/apps/crm/routes.ts` — register `POST /crm/blocklist`.
- `packages/server/test/messages-controller.test.ts` — update `getMessage` tests for the new JOIN-based visibility shape.
- `packages/server/test/sync-worker.test.ts` — add one dispatch test.

**New files (client):**
- `packages/client/src/apps/crm/hooks/use-block-sender.ts` — `useBlockSender` mutation.

**Modified files (client):**
- `packages/client/src/apps/crm/components/activity-list/email-activity-row.tsx` — add a "Block sender" link/button on inbound messages.
- `packages/client/src/i18n/locales/{en,tr,de,fr,it}.json` — translation keys for the block-sender button + toast.

**Why this layout:** Same boundary as 2b/2c — domain logic in `apps/crm/services/`, controllers thin, repeatable scheduling in `workers/index.ts`. No new tables, no new schema beyond the one column on `tenants`.

---

## Conventions you must follow

These come from `CLAUDE.md` and the project's auto-memory:

- **Branch policy:** Commit and push to `main`. Do NOT create a feature branch.
- **No PR.** Do NOT run `gh pr create`.
- **Don't push automatically.** This plan ends with all commits on `main` but **not pushed**. The user pushes when ready.
- **Tests live in `packages/server/test/`** (NOT colocated). Run `cd packages/server && npm test`. Vitest config at `packages/server/vitest.config.ts`. Global setup at `packages/server/test/setup.ts` mocks `../src/config/database` and `../src/utils/logger` for every test.
- **Test-driven:** every task that adds logic writes a failing vitest first, sees it fail, then implements.
- **Schema source of truth:** `packages/server/src/db/schema.ts`. Schema changes are paired with `addColumnIfMissing` in `bootstrap.ts` (per the project memory note — `db:push` is NOT used post-launch).
- **Logger:** `import { logger } from '../utils/logger'`. Pino-style structured logs.
- **i18n:** every new user-facing string MUST use `t()`. New keys in ALL 5 locale files (`en`, `tr`, `de`, `fr`, `it`).
- **UI components:** use shared components from `packages/client/src/components/ui/`. Never raw `<button>` / `<input>`.
- **Error envelope:** controllers return `{ success: true, data: ... }` or `{ success: false, error: '...' }`.

---

## Task 1: Schema — `tenants.gmailRetentionDays` + bootstrap migration

**Why:** The cleaner needs a per-tenant knob. The spec calls this `tenant_settings.gmail_retention_days`; we don't have a `tenant_settings` table, so the smallest scope-respecting choice is one column on `tenants`. Default `null` = retain forever (matches the spec).

**Files:**
- Modify: `packages/server/src/db/schema.ts`
- Modify: `packages/server/src/db/bootstrap.ts`

- [ ] **Step 1: Add the column to the Drizzle schema**

In `packages/server/src/db/schema.ts`, find the `tenants = pgTable('tenants', { ... })` block (around line 667). Inside the column list, after `storageQuotaBytes`, add:

```ts
  gmailRetentionDays: integer('gmail_retention_days'),
```

Nullable, no default. `null` means "retain forever".

- [ ] **Step 2: Add the bootstrap migration**

In `packages/server/src/db/bootstrap.ts`, find the section where other `addColumnIfMissing('tenants', ...)` calls live (or, if none exist, add it next to the existing `addColumnIfMissing('users', 'is_super_admin', ...)` block — they're all in the same migration runner).

Add:

```ts
  await addColumnIfMissing('tenants', 'gmail_retention_days', 'INTEGER');
```

- [ ] **Step 3: Run typecheck**

```bash
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: clean.

- [ ] **Step 4: Run full suite**

```bash
cd packages/server && npm test 2>&1 | tail -5
```

Expected: 558 passing (no behavior change yet — column exists in schema and migration runs idempotently).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/db/schema.ts packages/server/src/db/bootstrap.ts
git commit -m "feat(server): add tenants.gmail_retention_days column + bootstrap migration"
```

---

## Task 2: Blocklist seed service

**Why:** The spec requires four default patterns inserted per tenant on first boot. The unique index `(tenantId, pattern)` makes the insert idempotent.

**Files:**
- Create: `packages/server/src/apps/crm/services/blocklist-seed.service.ts`
- Test: `packages/server/test/blocklist-seed-service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/blocklist-seed-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { dbInsertMock } = vi.hoisted(() => ({
  dbInsertMock: vi.fn(),
}));

vi.mock('../src/config/database', () => ({
  db: {
    insert: () => dbInsertMock(),
  },
}));

import { seedBlocklistForTenant, DEFAULT_BLOCKLIST_PATTERNS } from '../src/apps/crm/services/blocklist-seed.service';

beforeEach(() => {
  dbInsertMock.mockReset();
});

describe('seedBlocklistForTenant', () => {
  it('exports the four default patterns from the spec', () => {
    expect(DEFAULT_BLOCKLIST_PATTERNS).toEqual([
      '*@noreply.*',
      '*@mailer-daemon.*',
      '*@no-reply.*',
      'notifications@github.com',
    ]);
  });

  it('inserts one row per default pattern with onConflictDoNothing', async () => {
    let inserted: any = null;
    let onConflictCalled = false;
    dbInsertMock.mockReturnValue({
      values: (rows: any) => {
        inserted = rows;
        return {
          onConflictDoNothing: () => {
            onConflictCalled = true;
            return Promise.resolve();
          },
        };
      },
    });

    await seedBlocklistForTenant('t-1');

    expect(Array.isArray(inserted)).toBe(true);
    expect(inserted).toHaveLength(4);
    expect(onConflictCalled).toBe(true);
    const patterns = inserted.map((r: any) => r.pattern);
    expect(patterns).toEqual(DEFAULT_BLOCKLIST_PATTERNS);
    for (const row of inserted) {
      expect(row.tenantId).toBe('t-1');
      expect(row.createdByUserId).toBeNull();
    }
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
cd packages/server && npm test -- blocklist-seed-service
```

Expected: module-not-found.

- [ ] **Step 3: Implement the seed service**

Create `packages/server/src/apps/crm/services/blocklist-seed.service.ts`:

```typescript
import { db } from '../../../config/database';
import { messageBlocklist } from '../../../db/schema';

export const DEFAULT_BLOCKLIST_PATTERNS = [
  '*@noreply.*',
  '*@mailer-daemon.*',
  '*@no-reply.*',
  'notifications@github.com',
] as const;

/**
 * Seed the per-tenant blocklist with the four default patterns from the
 * Phase 2 spec. Safe to call on every boot: the unique `(tenantId, pattern)`
 * index + `ON CONFLICT DO NOTHING` makes it idempotent.
 */
export async function seedBlocklistForTenant(tenantId: string): Promise<void> {
  await db
    .insert(messageBlocklist)
    .values(
      DEFAULT_BLOCKLIST_PATTERNS.map((pattern) => ({
        tenantId,
        pattern,
        createdByUserId: null,
      })),
    )
    .onConflictDoNothing();
}
```

- [ ] **Step 4: Run, expect pass**

```bash
cd packages/server && npm test -- blocklist-seed-service
```

Expected: 2 passing.

- [ ] **Step 5: Run full suite + typecheck**

```bash
cd packages/server && npm test 2>&1 | tail -5
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: 560 passing (was 558 + 2). Typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/apps/crm/services/blocklist-seed.service.ts packages/server/test/blocklist-seed-service.test.ts
git commit -m "feat(crm): blocklist seed service with default patterns"
```

---

## Task 3: Wire blocklist seed into bootstrap

**Why:** The seed needs to fire on boot, once per tenant.

**Files:**
- Modify: `packages/server/src/db/bootstrap.ts`

- [ ] **Step 1: Find the bootstrap entry point**

Look at the end of `bootstrap.ts` (the function that runs all the migrations). It's likely a `bootstrapDatabase()` or similar, called from `index.ts`/`server.ts`. Read the function to see where post-migration work runs.

- [ ] **Step 2: Add the seed call**

After all `addColumnIfMissing` calls complete (the schema is in its final state), iterate every tenant and call the seed:

```ts
import { tenants } from './schema';
import { seedBlocklistForTenant } from '../apps/crm/services/blocklist-seed.service';
import { logger } from '../utils/logger';

// ... after addColumnIfMissing calls ...

const allTenants = await db.select({ id: tenants.id }).from(tenants);
for (const tenant of allTenants) {
  try {
    await seedBlocklistForTenant(tenant.id);
  } catch (err) {
    logger.error({ err, tenantId: tenant.id }, 'Failed to seed blocklist for tenant');
  }
}
logger.info({ tenants: allTenants.length }, 'Seeded blocklist for all tenants');
```

Place this AFTER the schema migrations and BEFORE bootstrap returns. If the file already imports `db` and `logger`, don't double-import.

- [ ] **Step 3: Run typecheck**

```bash
cd packages/server && npm run typecheck 2>&1 | tail -3
```

- [ ] **Step 4: Run full suite**

```bash
cd packages/server && npm test 2>&1 | tail -5
```

Expected: 560 passing (the bootstrap path isn't unit-tested at the integration level here — added the seed loop should not affect any existing test).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/db/bootstrap.ts
git commit -m "feat(server): seed blocklist on bootstrap for every tenant"
```

---

## Task 4: Cleaner service — soft-delete + hard-delete

**Why:** The spec specifies a daily job that:
1. For tenants with `gmailRetentionDays` set, soft-deletes messages where `sentAt < now() - retentionDays` (sets `deletedAt = now()`).
2. Hard-deletes (drops the message + its participants via cascade) any rows soft-deleted more than 30 days ago.

`crm_activities` rows survive — the timeline is preserved even when the message body is cleaned.

**Files:**
- Create: `packages/server/src/apps/crm/services/gmail-message-cleaner.service.ts`
- Test: `packages/server/test/gmail-message-cleaner-service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/gmail-message-cleaner-service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { dbSelectMock, dbUpdateMock, dbDeleteMock } = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  dbUpdateMock: vi.fn(),
  dbDeleteMock: vi.fn(),
}));

vi.mock('../src/config/database', () => ({
  db: {
    select: () => dbSelectMock(),
    update: () => dbUpdateMock(),
    delete: () => dbDeleteMock(),
  },
}));

import { performGmailMessageCleaner, HARD_DELETE_GRACE_DAYS } from '../src/apps/crm/services/gmail-message-cleaner.service';

beforeEach(() => {
  dbSelectMock.mockReset();
  dbUpdateMock.mockReset();
  dbDeleteMock.mockReset();
  dbUpdateMock.mockReturnValue({ set: () => ({ where: () => Promise.resolve({ rowCount: 0 }) }) });
  dbDeleteMock.mockReturnValue({ where: () => Promise.resolve({ rowCount: 0 }) });
});

describe('performGmailMessageCleaner', () => {
  it('exports a 30-day hard-delete grace window', () => {
    expect(HARD_DELETE_GRACE_DAYS).toBe(30);
  });

  it('skips tenants with null gmailRetentionDays', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve([
        { id: 't-1', gmailRetentionDays: null },
        { id: 't-2', gmailRetentionDays: null },
      ]) }),
    });

    await performGmailMessageCleaner();

    // No update or delete called — both tenants have null retention
    expect(dbUpdateMock).not.toHaveBeenCalled();
    expect(dbDeleteMock).not.toHaveBeenCalled();
  });

  it('soft-deletes messages older than retention for each tenant', async () => {
    let updateWhereCalledFor: string[] = [];
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve([
        { id: 't-1', gmailRetentionDays: 7 },
      ]) }),
    });
    dbUpdateMock.mockReturnValue({
      set: (vals: any) => ({
        where: () => {
          updateWhereCalledFor.push(JSON.stringify(vals));
          return Promise.resolve({ rowCount: 3 });
        },
      }),
    });
    dbDeleteMock.mockReturnValue({ where: () => Promise.resolve({ rowCount: 0 }) });

    await performGmailMessageCleaner();

    // One update (soft-delete) was issued with a deletedAt timestamp
    expect(updateWhereCalledFor.length).toBeGreaterThan(0);
    expect(updateWhereCalledFor[0]).toContain('deletedAt');
  });

  it('hard-deletes messages soft-deleted more than HARD_DELETE_GRACE_DAYS ago', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve([
        { id: 't-1', gmailRetentionDays: null }, // skip soft-delete
      ]) }),
    });
    let deleteCalled = false;
    dbDeleteMock.mockReturnValue({
      where: () => {
        deleteCalled = true;
        return Promise.resolve({ rowCount: 5 });
      },
    });

    await performGmailMessageCleaner();

    // Hard-delete runs regardless of retention setting (any soft-deleted
    // rows past the grace window are removed)
    expect(deleteCalled).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
cd packages/server && npm test -- gmail-message-cleaner-service
```

Expected: module-not-found.

- [ ] **Step 3: Implement the service**

Create `packages/server/src/apps/crm/services/gmail-message-cleaner.service.ts`:

```typescript
import { and, eq, isNull, isNotNull, lt } from 'drizzle-orm';
import { db } from '../../../config/database';
import { messages, tenants } from '../../../db/schema';
import { logger } from '../../../utils/logger';

/** Grace window between soft-delete and hard-delete. */
export const HARD_DELETE_GRACE_DAYS = 30;

/**
 * Daily cleaner. Two passes:
 *   1. Soft-delete: for each tenant with `gmailRetentionDays` set, mark
 *      messages where `sentAt < now() - retentionDays` as `deletedAt = now()`.
 *      `crm_activities` rows are preserved (timeline survives body cleanup).
 *   2. Hard-delete: drop any messages with `deletedAt < now() - HARD_DELETE_GRACE_DAYS`.
 *      The schema's cascade on `messageParticipants` cleans those up automatically.
 *
 * Idempotent — safe to run on every boot and on the daily repeatable schedule.
 */
export async function performGmailMessageCleaner(): Promise<void> {
  const tenantRows = await db
    .select({ id: tenants.id, gmailRetentionDays: tenants.gmailRetentionDays })
    .from(tenants)
    .where(isNotNull(tenants.id));

  let softDeleted = 0;
  for (const tenant of tenantRows) {
    if (tenant.gmailRetentionDays == null) continue;
    const cutoff = new Date(Date.now() - tenant.gmailRetentionDays * 24 * 60 * 60 * 1000);
    const result = await db
      .update(messages)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(messages.tenantId, tenant.id),
          isNull(messages.deletedAt),
          lt(messages.sentAt, cutoff),
        ),
      );
    softDeleted += (result as any)?.rowCount ?? 0;
  }

  const hardCutoff = new Date(Date.now() - HARD_DELETE_GRACE_DAYS * 24 * 60 * 60 * 1000);
  const hardResult = await db
    .delete(messages)
    .where(and(isNotNull(messages.deletedAt), lt(messages.deletedAt, hardCutoff)));
  const hardDeleted = (hardResult as any)?.rowCount ?? 0;

  logger.info(
    { tenants: tenantRows.length, softDeleted, hardDeleted },
    'Gmail message cleaner completed',
  );
}
```

- [ ] **Step 4: Run, expect pass**

```bash
cd packages/server && npm test -- gmail-message-cleaner-service
```

Expected: 4 passing.

- [ ] **Step 5: Run full suite + typecheck**

```bash
cd packages/server && npm test 2>&1 | tail -5
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: 564 passing (was 560 + 4). Typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/apps/crm/services/gmail-message-cleaner.service.ts packages/server/test/gmail-message-cleaner-service.test.ts
git commit -m "feat(crm): gmail message cleaner — soft-delete by retention + hard-delete after grace"
```

---

## Task 5: Wire cleaner into queue + worker dispatch

**Why:** The job needs a stable name and the worker dispatch needs a case for it.

**Files:**
- Modify: `packages/server/src/config/queue.ts`
- Modify: `packages/server/src/workers/sync.worker.ts`
- Modify: `packages/server/test/sync-worker.test.ts`

- [ ] **Step 1: Add job name + (empty) data type**

In `packages/server/src/config/queue.ts`, extend `SyncJobName`:

```ts
export const SyncJobName = {
  CalendarFullSync: 'calendar-full-sync',
  CalendarIncrementalSync: 'calendar-incremental-sync',
  GmailFullSync: 'gmail-full-sync',
  GmailIncrementalSync: 'gmail-incremental-sync',
  GmailSend: 'gmail-send',
  GmailMessageCleaner: 'gmail-message-cleaner',
} as const;
```

The cleaner walks all tenants — no per-job payload. Add an empty interface for type-discrimination consistency:

```ts
/** Daily cleaner — walks all tenants, no per-job payload. */
export type GmailMessageCleanerJobData = Record<string, never>;
```

Extend `SyncJobData`:

```ts
  | { name: typeof SyncJobName.GmailSend; data: GmailSendJobData }
  | { name: typeof SyncJobName.GmailMessageCleaner; data: GmailMessageCleanerJobData };
```

- [ ] **Step 2: Add the dispatch case**

In `packages/server/src/workers/sync.worker.ts`, add to the imports from `../config/queue`:

```ts
  type GmailMessageCleanerJobData,
```

Add the new service import:

```ts
import { performGmailMessageCleaner } from '../apps/crm/services/gmail-message-cleaner.service';
```

In `processSyncJob`, before `default:`, add:

```ts
    case SyncJobName.GmailMessageCleaner: {
      logger.info({ jobId: job.id }, 'Running Gmail message cleaner');
      await performGmailMessageCleaner();
      return;
    }
```

(`GmailMessageCleanerJobData` is unused at the call site since there's no payload to extract — that's fine; the type still helps the union.)

- [ ] **Step 3: Extend the worker test**

In `packages/server/test/sync-worker.test.ts`, after the existing `vi.mock('../src/apps/crm/services/gmail-send.service', ...)` block, add a sibling:

```ts
vi.mock('../src/apps/crm/services/gmail-message-cleaner.service', () => ({
  performGmailMessageCleaner: vi.fn(async () => undefined),
}));
```

Add the import:

```ts
import * as cleaner from '../src/apps/crm/services/gmail-message-cleaner.service';
```

In the existing `describe('sync.worker: processSyncJob', ...)` block, add a new test:

```ts
  it('dispatches gmail-message-cleaner to performGmailMessageCleaner', async () => {
    await processSyncJob({
      name: 'gmail-message-cleaner',
      data: {},
    } as any);
    expect(cleaner.performGmailMessageCleaner).toHaveBeenCalled();
  });
```

- [ ] **Step 4: Run worker tests**

```bash
cd packages/server && npm test -- sync-worker
```

Expected: 7 passing (was 6 + 1).

- [ ] **Step 5: Run full suite + typecheck**

```bash
cd packages/server && npm test 2>&1 | tail -5
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: 565 passing (was 564 + 1).

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/config/queue.ts packages/server/src/workers/sync.worker.ts packages/server/test/sync-worker.test.ts
git commit -m "feat(server): wire gmail-message-cleaner into worker dispatch"
```

---

## Task 6: Schedule the cleaner daily

**Why:** The job needs a daily repeatable schedule on boot.

**Files:**
- Modify: `packages/server/src/workers/index.ts`

- [ ] **Step 1: Read the existing scheduler shape**

In `packages/server/src/workers/index.ts`, look at `scheduleIncrementalSyncForAllAccounts()` (around line 35) and the Gmail equivalent (around line 77). They use `queue.upsertJobScheduler(id, { every: ms }, { name, data })`. Mirror that pattern.

- [ ] **Step 2: Add the cleaner scheduler**

Add a constant and a new exported function near the top of the file (alongside `INCREMENTAL_INTERVAL_MS`):

```ts
const CLEANER_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
```

Add the function (place it after the Gmail incremental scheduler):

```ts
/**
 * Schedule the daily Gmail message cleaner. Idempotent — `upsertJobScheduler`
 * de-dupes by id.
 */
export async function scheduleDailyMessageCleaner(): Promise<void> {
  const queue = getSyncQueue();
  if (!queue) return;

  await queue.upsertJobScheduler(
    'gmail-message-cleaner',
    { every: CLEANER_INTERVAL_MS },
    {
      name: SyncJobName.GmailMessageCleaner,
      data: {},
    },
  );

  logger.info({ intervalMs: CLEANER_INTERVAL_MS }, 'Scheduled daily Gmail message cleaner');
}
```

- [ ] **Step 3: Call it on boot**

Find the existing function that runs all schedulers on boot (it calls `scheduleIncrementalSyncForAllAccounts()` and the Gmail equivalent — likely a `bootstrapWorkers()` or in `server.ts`'s startup chain). Add a call to `scheduleDailyMessageCleaner()` alongside the others.

If you can't find a single coordinator, the call belongs wherever `scheduleGmailIncrementalSyncForAllChannels` is invoked. They should fire in the same place.

- [ ] **Step 4: Run typecheck + suite**

```bash
cd packages/server && npm run typecheck 2>&1 | tail -3
cd packages/server && npm test 2>&1 | tail -5
```

Expected: typecheck clean, suite still 565 (no test exercises the boot scheduler directly — the existing `workers-index.test.ts` covers idempotency for other schedulers; if it has test coverage gaps for this new one, that's fine for 2d).

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/workers/index.ts
git commit -m "feat(server): schedule daily Gmail message cleaner"
```

---

## Task 7: Visibility filter on `getMessage` (single JOIN)

**Why:** Today `getMessage` does owner-only checks via a separate `getChannelById` round-trip. The spec requires broadening to `visibility = 'shared-with-tenant' OR ownerUserId = req.auth.userId`. Folding the check into the message-read query as a JOIN both satisfies the spec AND removes the second DB round-trip flagged in the Phase 2c simplify pass.

**Files:**
- Modify: `packages/server/src/apps/crm/controllers/messages.controller.ts`
- Modify: `packages/server/test/messages-controller.test.ts`

- [ ] **Step 1: Update the test for the new shape**

Today the test does `getChannelByIdMock.mockResolvedValue({...})` after the message select. After this task, `getMessage` no longer calls `getChannelById` — visibility is in the JOIN. The test mocks need to reflect that.

In `packages/server/test/messages-controller.test.ts`, find the `describe('messages.controller: getMessage', ...)` block. The two existing tests are: (a) 404 when message does not exist; (b) returns the message when visible to the user.

Replace the `getMessage` describe block with:

```ts
describe('messages.controller: getMessage', () => {
  it('returns 404 when message does not exist or is not visible', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ innerJoin: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }) }),
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'msg-missing' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await getMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns the message when visibility filter passes', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ innerJoin: () => ({ where: () => ({ limit: () => Promise.resolve([{
        id: 'msg-1',
        channelId: 'ch-1',
        subject: 'Hi',
        snippet: 'preview',
        bodyText: 'body',
        status: 'sent',
        threadId: 'thr-1',
        headerMessageId: '<abc@mail.com>',
        direction: 'outbound',
        sentAt: new Date('2026-04-29T10:00:00Z'),
      }]) }) }) }),
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'msg-1' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await getMessage(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 'msg-1', status: 'sent' }),
      }),
    );
  });
});
```

The mock chain is now `select -> from -> innerJoin -> where -> limit`. `getChannelById` is no longer called from this path.

- [ ] **Step 2: Run, expect failure**

```bash
cd packages/server && npm test -- messages-controller
```

The two `getMessage` tests should fail (mock shape no longer matches) until Step 3.

- [ ] **Step 3: Rewrite `getMessage`**

In `packages/server/src/apps/crm/controllers/messages.controller.ts`, find `getMessage` (around line 245). Replace the entire body with a single JOIN-based query.

Add `messageChannels` and `or` to the imports:

```ts
import { and, eq, or } from 'drizzle-orm';
import {
  messages,
  messageParticipants,
  messageThreads,
  messageChannels,
} from '../../../db/schema';
```

Replace `getMessage` with:

```ts
export async function getMessage(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const messageId = req.params.id as string;

    const [message] = await db
      .select({
        id: messages.id,
        channelId: messages.channelId,
        subject: messages.subject,
        snippet: messages.snippet,
        bodyText: messages.bodyText,
        status: messages.status,
        threadId: messages.threadId,
        headerMessageId: messages.headerMessageId,
        direction: messages.direction,
        sentAt: messages.sentAt,
      })
      .from(messages)
      .innerJoin(messageChannels, eq(messageChannels.id, messages.channelId))
      .where(
        and(
          eq(messages.id, messageId),
          eq(messages.tenantId, tenantId),
          or(
            eq(messageChannels.visibility, 'shared-with-tenant'),
            eq(messageChannels.ownerUserId, userId),
          ),
        ),
      )
      .limit(1);

    if (!message) {
      res.status(404).json({ success: false, error: 'message not found' });
      return;
    }

    res.json({ success: true, data: message });
  } catch (error) {
    logger.error({ error }, 'Failed to load message');
    res.status(500).json({ success: false, error: 'Failed to load message' });
  }
}
```

The visibility clause is now: `(visibility = 'shared-with-tenant') OR (ownerUserId = userId)`. Same as `getChannelById` does internally — and consistent with the spec §9.

`getChannelById` is no longer used by `getMessage`. If it's not used elsewhere in this controller, remove the unused import. (`sendMessage` and `retryMessage` still use it — keep the import.)

- [ ] **Step 4: Run, expect pass**

```bash
cd packages/server && npm test -- messages-controller
```

Expected: all 13 tests passing (the two `getMessage` tests now match the JOIN-based mock).

- [ ] **Step 5: Run full suite + typecheck**

```bash
cd packages/server && npm test 2>&1 | tail -5
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: 565 passing (no count change — we replaced two tests with two tests). Typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/apps/crm/controllers/messages.controller.ts packages/server/test/messages-controller.test.ts
git commit -m "feat(crm): broaden getMessage visibility to channel-level (single JOIN)"
```

---

## Task 8: Blocklist controller — `POST /crm/blocklist`

**Why:** The spec requires a "block this sender" UI button; that requires an endpoint. Single handler, owner-of-tenant scoping (any tenant member can add a blocklist pattern).

**Files:**
- Create: `packages/server/src/apps/crm/controllers/blocklist.controller.ts`
- Modify: `packages/server/src/apps/crm/routes.ts`
- Test: `packages/server/test/blocklist-controller.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/blocklist-controller.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const { dbInsertMock } = vi.hoisted(() => ({
  dbInsertMock: vi.fn(),
}));

vi.mock('../src/config/database', () => ({
  db: {
    insert: () => dbInsertMock(),
  },
}));

import { addBlocklistEntry } from '../src/apps/crm/controllers/blocklist.controller';

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => {
  dbInsertMock.mockReset();
});

describe('blocklist.controller: addBlocklistEntry', () => {
  it('returns 400 when pattern is missing', async () => {
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await addBlocklistEntry(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('returns 400 when pattern is empty/whitespace', async () => {
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { pattern: '   ' },
    } as unknown as Request;
    const res = mockRes();
    await addBlocklistEntry(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('inserts the pattern with onConflictDoNothing and returns success', async () => {
    let captured: any = null;
    dbInsertMock.mockReturnValue({
      values: (row: any) => {
        captured = row;
        return { onConflictDoNothing: () => Promise.resolve() };
      },
    });

    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { pattern: 'spam@example.com' },
    } as unknown as Request;
    const res = mockRes();
    await addBlocklistEntry(req, res);

    expect(captured).toMatchObject({
      tenantId: 't-1',
      pattern: 'spam@example.com',
      createdByUserId: 'u-1',
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { pattern: 'spam@example.com' },
    });
  });

  it('lowercases and trims the pattern before insert', async () => {
    let captured: any = null;
    dbInsertMock.mockReturnValue({
      values: (row: any) => {
        captured = row;
        return { onConflictDoNothing: () => Promise.resolve() };
      },
    });

    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { pattern: '  Spam@Example.COM  ' },
    } as unknown as Request;
    const res = mockRes();
    await addBlocklistEntry(req, res);

    expect(captured.pattern).toBe('spam@example.com');
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
cd packages/server && npm test -- blocklist-controller
```

Expected: module-not-found.

- [ ] **Step 3: Implement the controller**

Create `packages/server/src/apps/crm/controllers/blocklist.controller.ts`:

```typescript
import type { Request, Response } from 'express';
import { db } from '../../../config/database';
import { messageBlocklist } from '../../../db/schema';
import { logger } from '../../../utils/logger';

export async function addBlocklistEntry(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const raw = (req.body?.pattern ?? '') as string;
    const pattern = raw.trim().toLowerCase();

    if (!pattern) {
      res.status(400).json({ success: false, error: 'pattern is required' });
      return;
    }

    await db
      .insert(messageBlocklist)
      .values({
        tenantId,
        pattern,
        createdByUserId: userId,
      })
      .onConflictDoNothing();

    res.json({ success: true, data: { pattern } });
  } catch (error) {
    logger.error({ error }, 'Failed to add blocklist entry');
    res.status(500).json({ success: false, error: 'Failed to add blocklist entry' });
  }
}
```

- [ ] **Step 4: Wire the route**

In `packages/server/src/apps/crm/routes.ts`, add the import alongside other controller imports:

```ts
import * as blocklistController from './controllers/blocklist.controller';
```

After the `/messages/:id` line (Phase 2c), add:

```ts
router.post('/blocklist', blocklistController.addBlocklistEntry);
```

The route inherits `authMiddleware` and `requireAppPermission('crm')` from earlier in the file.

- [ ] **Step 5: Run, expect pass**

```bash
cd packages/server && npm test -- blocklist-controller
```

Expected: 4 passing.

- [ ] **Step 6: Run full suite + typecheck**

```bash
cd packages/server && npm test 2>&1 | tail -5
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: 569 passing (was 565 + 4). Typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/apps/crm/controllers/blocklist.controller.ts packages/server/src/apps/crm/routes.ts packages/server/test/blocklist-controller.test.ts
git commit -m "feat(crm): POST /crm/blocklist endpoint to block a sender"
```

---

## Task 9: Client mutation hook + "Block sender" button

**Why:** Wire the new endpoint into the email-activity row's UI.

**Files:**
- Create: `packages/client/src/apps/crm/hooks/use-block-sender.ts`
- Modify: `packages/client/src/apps/crm/components/activity-list/email-activity-row.tsx`
- Modify: 5 locale files

- [ ] **Step 1: Create the mutation hook**

Create `packages/client/src/apps/crm/hooks/use-block-sender.ts`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { queryKeys } from '../../../config/query-keys';

export function useBlockSender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pattern: string): Promise<{ pattern: string }> => {
      const { data } = await api.post('/crm/blocklist', { pattern });
      return data.data as { pattern: string };
    },
    onSuccess: () => {
      // Invalidating activities forces re-fetch — future inbound from this
      // sender won't auto-create contacts.
      qc.invalidateQueries({ queryKey: queryKeys.crm.activities.all });
    },
  });
}
```

- [ ] **Step 2: Add translation keys**

For each of `packages/client/src/i18n/locales/{en,tr,de,fr,it}.json`, add the following keys inside `crm.composer` (alongside the existing keys from Task 10 of Phase 2c). Use Node.js to round-trip safely:

```bash
for L in en tr de fr it; do
  node -e "
    const fs = require('fs');
    const path = '/Users/gorkemcetin/atlasmail/packages/client/src/i18n/locales/${L}.json';
    const j = JSON.parse(fs.readFileSync(path, 'utf-8'));
    j.crm.composer.blockSender = 'Block sender';
    j.crm.composer.blockSenderToast = 'Sender blocked — future emails won\\'t auto-create contacts';
    j.crm.composer.blockSenderError = 'Failed to block sender';
    fs.writeFileSync(path, JSON.stringify(j, null, 2) + String.fromCharCode(10));
  "
done
for f in /Users/gorkemcetin/atlasmail/packages/client/src/i18n/locales/*.json; do
  node -e "require('$f')" || echo "BROKEN: $f"
done
```

Same English values across all 5 locales (per the project's keys-first policy).

- [ ] **Step 3: Add the button to email-activity-row**

In `packages/client/src/apps/crm/components/activity-list/email-activity-row.tsx`, the row currently shows a `Retry` button for failed outbound messages and a `Reply` popover for messages with `headerMessageId`. The block button is for **inbound** messages — its semantic is "stop auto-creating contacts from this sender."

We need access to the sender's handle. The current `useMessage` hook returns the message but not its participants. The simplest spec-respecting option: extract the sender from a participant fetch. But adding a participant API is out-of-scope.

**Pragmatic alternative:** the block button needs the sender's email. The plain reading is that for inbound messages we already render the activity, and the activity's `body` (set by `message-activity.service`) typically contains the sender. But that's fragile.

The cleanest in-scope path is to extend `GET /crm/messages/:id` to return the `from` participant alongside the message. That's a one-field addition, not a new endpoint.

Defer this decision: in Step 3a, extend the server. In Step 3b, render the button.

- [ ] **Step 3a: Extend `GET /crm/messages/:id` response with `fromHandle`**

In `packages/server/src/apps/crm/controllers/messages.controller.ts:getMessage`, after the existing `db.select(...).from(messages).innerJoin(...).where(...).limit(1)` query (Task 7 just rewrote this), add a follow-up `from` lookup:

```ts
    if (!message) {
      res.status(404).json({ success: false, error: 'message not found' });
      return;
    }

    const [fromRow] = await db
      .select({ handle: messageParticipants.handle })
      .from(messageParticipants)
      .where(
        and(
          eq(messageParticipants.messageId, message.id),
          eq(messageParticipants.role, 'from'),
        ),
      )
      .limit(1);

    res.json({
      success: true,
      data: { ...message, fromHandle: fromRow?.handle ?? null },
    });
```

Add `messageParticipants` to the imports from `'../../../db/schema'` (it's already imported by `sendMessage` — confirm it's still in the import list).

Update the existing `messages-controller` test for `getMessage` success path to mock the second select too:

```ts
  it('returns the message when visibility filter passes', async () => {
    let selectCall = 0;
    dbSelectMock.mockImplementation(() => {
      selectCall++;
      if (selectCall === 1) {
        // First select: message + visibility JOIN
        return {
          from: () => ({ innerJoin: () => ({ where: () => ({ limit: () => Promise.resolve([{
            id: 'msg-1',
            channelId: 'ch-1',
            subject: 'Hi',
            snippet: 'preview',
            bodyText: 'body',
            status: 'sent',
            threadId: 'thr-1',
            headerMessageId: '<abc@mail.com>',
            direction: 'outbound',
            sentAt: new Date('2026-04-29T10:00:00Z'),
          }]) }) }) }),
        };
      }
      // Second select: participant 'from'
      return {
        from: () => ({ where: () => ({ limit: () => Promise.resolve([{ handle: 'sender@example.com' }]) }) }),
      };
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'msg-1' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await getMessage(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 'msg-1', fromHandle: 'sender@example.com' }),
      }),
    );
  });
```

Run server tests: `cd packages/server && npm test -- messages-controller` → all 13 still pass.

Update `MessageDTO` in `packages/client/src/apps/crm/hooks/use-send-message.ts`:

```ts
export interface MessageDTO {
  id: string;
  channelId: string;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  status: string;
  threadId: string;
  headerMessageId: string | null;
  direction: 'inbound' | 'outbound';
  sentAt: string | null;
  fromHandle: string | null;
}
```

- [ ] **Step 3b: Render the button**

In `email-activity-row.tsx`, import the new hook + toast plumbing (already imported):

```ts
import { useBlockSender } from '../../hooks/use-block-sender';
```

In the component body, alongside the existing `useRetryMessage` hook:

```ts
  const blockSender = useBlockSender();
```

Add a handler:

```ts
  const handleBlock = () => {
    if (!message.fromHandle) return;
    blockSender.mutate(message.fromHandle, {
      onSuccess: () =>
        addToast({ type: 'success', message: t('crm.composer.blockSenderToast', 'Sender blocked') }),
      onError: (err: unknown) => {
        const anyErr = err as { response?: { data?: { error?: string } } };
        addToast({
          type: 'error',
          message: anyErr?.response?.data?.error ?? t('crm.composer.blockSenderError', 'Failed to block sender'),
        });
      },
    });
  };
```

In the action-row JSX (after the `Retry` and `Reply` buttons):

```tsx
        {!isOutbound && message.fromHandle && (
          <Button size="sm" variant="ghost" onClick={handleBlock} disabled={blockSender.isPending}>
            {t('crm.composer.blockSender', 'Block sender')}
          </Button>
        )}
```

The button only renders for inbound messages with a known sender.

- [ ] **Step 4: Typecheck + build**

```bash
cd packages/client && npm run typecheck 2>&1 | tail -3
cd packages/client && npm run build 2>&1 | tail -3
cd packages/server && npm test 2>&1 | tail -5
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: client typecheck + build clean. Server suite still 569 passing. Server typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/apps/crm/hooks/use-block-sender.ts \
        packages/client/src/apps/crm/hooks/use-send-message.ts \
        packages/client/src/apps/crm/components/activity-list/email-activity-row.tsx \
        packages/server/src/apps/crm/controllers/messages.controller.ts \
        packages/server/test/messages-controller.test.ts \
        packages/client/src/i18n/locales/en.json \
        packages/client/src/i18n/locales/tr.json \
        packages/client/src/i18n/locales/de.json \
        packages/client/src/i18n/locales/fr.json \
        packages/client/src/i18n/locales/it.json
git commit -m "feat(crm): block-sender button + endpoint return fromHandle"
```

---

## Task 10: Final verification (NO PUSH)

**Why:** Confirm everything compiles, tests pass, dist artifacts present, no commits accidentally pushed.

- [ ] **Step 1: Run full server test suite**

```bash
cd packages/server && npm test 2>&1 | tail -8
```

Expected: 569 passing (558 baseline + 11 new across blocklist-seed, gmail-message-cleaner, blocklist-controller, sync-worker).

- [ ] **Step 2: Server typecheck + lint + build**

```bash
cd packages/server && npm run typecheck 2>&1 | tail -3
cd packages/server && npm run lint 2>&1 | grep -E "error|^✖" | tail -3
cd packages/server && npm run build 2>&1 | tail -3
```

Expected: typecheck clean, 0 lint errors (warnings ok), build clean.

Verify new artifacts:

```bash
ls packages/server/dist/apps/crm/services/gmail-message-cleaner.service.js
ls packages/server/dist/apps/crm/services/blocklist-seed.service.js
ls packages/server/dist/apps/crm/controllers/blocklist.controller.js
```

All three should exist.

- [ ] **Step 3: Client typecheck + build**

```bash
cd packages/client && npm run typecheck 2>&1 | tail -3
cd packages/client && npm run build 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 4: Verify nothing pushed**

```bash
git log --oneline origin/main..HEAD
```

Expected: 9 unpushed commits (one per task plus the initial plan commit, minus pre-existing ones).

- [ ] **Step 5: Report**

Per Atlas convention this plan does NOT push. Summarize:
- Tasks 1–9 completed
- New schema column: `tenants.gmail_retention_days`
- New job: `gmail-message-cleaner` daily
- New endpoint: `POST /crm/blocklist`
- `getMessage` visibility filter broadened (single JOIN, owner-only → owner-or-shared)
- Blocklist seeded for every tenant on boot
- "Block sender" button in the timeline for inbound messages

---

## Acceptance criteria

This phase is done when:

- [ ] All server tests pass (~569 expected)
- [ ] `npm run typecheck` clean in both `packages/server` and `packages/client`
- [ ] `npm run lint` 0 errors in `packages/server`
- [ ] `npm run build` clean in both packages
- [ ] Boot logs include "Seeded blocklist for all tenants"
- [ ] Boot logs include "Scheduled daily Gmail message cleaner"
- [ ] `getMessage` no longer round-trips through `getChannelById` for visibility
- [ ] No new top-level dependencies added
- [ ] All commits target `main`; no feature branch; no `git push`
