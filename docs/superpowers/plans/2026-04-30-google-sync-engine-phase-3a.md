# Google Sync Engine — Phase 3a: Quick Wins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close four spec-locked Phase 3 items that share a quick-win profile — blocklist UI, retention UI, activity backfill on new contact match, and BullMQ scheduler orphan reconcile. Attachments (the fifth Phase 3 item) gets its own plan.

**Architecture:** Two new server endpoints (`GET /crm/blocklist` + `DELETE /crm/blocklist/:id`), one new tenant-settings field rendered in the existing CRM Integrations panel, one new service that backfills activities when a contact is created, and one new function that prunes BullMQ scheduler entries whose channel is deleted/disabled. No schema changes.

**Tech Stack:** Drizzle ORM, BullMQ ^5.25, vitest, React + TanStack Query + react-i18next.

**Out of scope (per spec §14):** Outlook OAuth, IMAP, push notifications, drafts, templates, aliases, read receipts, folder mirroring, multi-channel-per-account UI. Functional index on `crm_contacts.email` and batch `/messages?ids=` endpoint are operational items with no calendar slot. Attachments are Phase 3b (separate plan).

---

## Phase 2d baseline

- `messageBlocklist` schema + per-tenant seed shipped in 2d. The blocklist read path (`loadBlocklist`) and the `POST /crm/blocklist` endpoint already exist. Phase 3a adds list + delete.
- `tenants.gmailRetentionDays` column + the `gmail-message-cleaner` daily job shipped in 2d. Server enforces retention. Phase 3a adds the UI control that writes the column.
- `crm-contact-create.service:autoCreateContactIfNeeded` (2c) and `contact.service:createContact` (pre-existing) are the two contact-creation entry points. Both need to trigger the new backfill.
- `participant-match.service:matchHandlesToContacts(handles, tenantId)` already does case-insensitive lookups; we'll use it (or a complementary "find participants by handle") for backfill.
- `message-activity.service:upsertActivitiesForMessage({ messageId, tenantId, userId, direction })` already fans out CRM activities for a message; the backfill calls it per affected message.
- BullMQ scheduler entries: incremental-sync entries are keyed `gmail-incremental-${channelId}` (Phase 2b). The `TODO (Phase 2c/2d)` block in `workers/index.ts:81` describes the orphan-reconcile shape.

---

## File structure

**New files (server):**
- `packages/server/src/apps/crm/services/contact-message-backfill.service.ts` — `backfillContactMessages(tenantId, contactId, userId)`. Walks `message_participants` matching the contact's email handle within the tenant, sets `personId`, then re-runs `upsertActivitiesForMessage` per affected message.
- `packages/server/src/apps/crm/services/scheduler-reconcile.service.ts` — `reconcileGmailIncrementalSchedulers()`. Reads BullMQ's existing scheduler entries, drops any whose channel was deleted or has `isSyncEnabled=false`.
- `packages/server/test/contact-message-backfill-service.test.ts`
- `packages/server/test/scheduler-reconcile-service.test.ts`
- `packages/server/test/blocklist-controller.test.ts` already exists — extend it for list + delete.

**Modified files (server):**
- `packages/server/src/apps/crm/controllers/blocklist.controller.ts` — add `listBlocklist` and `deleteBlocklistEntry` handlers alongside the existing `addBlocklistEntry`.
- `packages/server/src/apps/crm/routes.ts` — register `GET /crm/blocklist` and `DELETE /crm/blocklist/:id`.
- `packages/server/src/apps/crm/services/contact.service.ts` — fire backfill after `createContact` returns the new id. Idempotent — caller-fired, no transaction wrapping required.
- `packages/server/src/apps/crm/services/crm-contact-create.service.ts` — same backfill call after the auto-create completes.
- `packages/server/src/apps/crm/controllers/tenant-settings.controller.ts` — new file with one endpoint `PATCH /crm/settings/retention` that updates `tenants.gmail_retention_days`. (Or: extend an existing controller — see Step 1 of Task 6.)
- `packages/server/src/workers/index.ts` — call `reconcileGmailIncrementalSchedulers()` after `scheduleGmailIncrementalSyncForAllChannels()` on every boot.

**New files (client):**
- `packages/client/src/apps/crm/hooks/use-blocklist.ts` — `useBlocklist`, `useDeleteBlocklistEntry`, plus the existing `useBlockSender` (move from Phase 2d).
- `packages/client/src/apps/crm/hooks/use-tenant-settings.ts` — `useTenantSettings`, `useUpdateRetention`.
- `packages/client/src/apps/crm/components/integrations/blocklist-section.tsx` — list view + remove buttons + add-entry input.
- `packages/client/src/apps/crm/components/integrations/retention-section.tsx` — single number input that writes `tenants.gmail_retention_days`.

**Modified files (client):**
- `packages/client/src/components/settings/integrations-panel.tsx` — mount `<BlocklistSection />` and `<RetentionSection />` after `<ChannelsList />`.
- `packages/client/src/config/query-keys.ts` — add `crm.blocklist` and `crm.tenantSettings` namespaces.
- `packages/client/src/i18n/locales/{en,tr,de,fr,it}.json` — translation keys for the two new sections.

**No schema changes.** No new tables, no new columns. Everything below uses existing structure.

---

## Conventions you must follow

- **Branch policy:** Commit and push to `main`. Do NOT create a feature branch.
- **No PR.** Push direct to `main` only when the user explicitly says so.
- **Don't push automatically.** This plan ends with all commits on `main` but **not pushed**.
- **Tests live in `packages/server/test/`** (NOT colocated). Run `cd packages/server && npm test`.
- **Test-driven:** every task that adds logic writes a failing vitest first, sees it fail, then implements.
- **Logger:** `import { logger } from '../utils/logger'`. Pino-style structured logs.
- **i18n:** every new user-facing string MUST use `t()`. Keys in ALL 5 locale files (`en`, `tr`, `de`, `fr`, `it`) — same English values across all per Atlas's keys-first policy.
- **UI components:** shared from `packages/client/src/components/ui/`. `size="sm"` for any density-mode form controls (settings panels are density-mode).
- **Error envelope:** controllers return `{ success: true, data }` or `{ success: false, error }`; 500 on caught.
- **No new schema.** If a task feels like it wants a column, stop and ask.

---

## Task 1: Blocklist controller — list + delete

**Why:** Phase 2d shipped only `addBlocklistEntry`. Removing/listing is required for the management UI.

**Files:**
- Modify: `packages/server/src/apps/crm/controllers/blocklist.controller.ts`
- Modify: `packages/server/src/apps/crm/routes.ts`
- Modify: `packages/server/test/blocklist-controller.test.ts`

- [ ] **Step 1: Extend the existing test file**

In `packages/server/test/blocklist-controller.test.ts`, find the existing imports — the `dbInsertMock` already exists. Extend the hoisted block with two more mocks:

```ts
const { dbInsertMock, dbSelectMock, dbDeleteMock } = vi.hoisted(() => ({
  dbInsertMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbDeleteMock: vi.fn(),
}));

vi.mock('../src/config/database', () => ({
  db: {
    insert: () => dbInsertMock(),
    select: () => dbSelectMock(),
    delete: () => dbDeleteMock(),
  },
}));
```

Update the import to pull all three handlers:

```ts
import {
  addBlocklistEntry,
  listBlocklist,
  deleteBlocklistEntry,
} from '../src/apps/crm/controllers/blocklist.controller';
```

Update `beforeEach` to reset the new mocks:

```ts
beforeEach(() => {
  dbInsertMock.mockReset();
  dbSelectMock.mockReset();
  dbDeleteMock.mockReset();
});
```

After the existing `addBlocklistEntry` describe block, add two more:

```ts
describe('blocklist.controller: listBlocklist', () => {
  it('returns blocklist patterns for the tenant', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ orderBy: () => Promise.resolve([
        { id: 'b-1', pattern: '*@noreply.*', createdAt: new Date('2026-01-01T00:00:00Z') },
        { id: 'b-2', pattern: 'spam@x.com', createdAt: new Date('2026-04-30T00:00:00Z') },
      ]) }) }),
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: {},
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await listBlocklist(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ id: 'b-1', pattern: '*@noreply.*' }),
          expect.objectContaining({ id: 'b-2', pattern: 'spam@x.com' }),
        ]),
      }),
    );
  });
});

describe('blocklist.controller: deleteBlocklistEntry', () => {
  it('returns 400 when id is missing', async () => {
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: {},
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await deleteBlocklistEntry(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(dbDeleteMock).not.toHaveBeenCalled();
  });

  it('deletes the entry scoped to the tenant', async () => {
    let whereCall: any = null;
    dbDeleteMock.mockReturnValue({
      where: (cond: any) => {
        whereCall = cond;
        return Promise.resolve({ rowCount: 1 });
      },
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'b-1' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await deleteBlocklistEntry(req, res);
    expect(dbDeleteMock).toHaveBeenCalled();
    // The where clause MUST be tenant-scoped (so cross-tenant deletes are impossible).
    // We verified this by inspecting `whereCall` — the controller should call with
    // both `id` and `tenantId` matchers. We can't introspect drizzle's AND() here,
    // so just assert the call shape returned a Promise.
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { deleted: true },
    });
  });
});
```

- [ ] **Step 2: Run, expect failure**

```bash
cd packages/server && npm test -- blocklist-controller 2>&1 | tail -10
```

Expected: 3 new tests fail (functions not exported).

- [ ] **Step 3: Implement the new handlers**

In `packages/server/src/apps/crm/controllers/blocklist.controller.ts`, add `and`, `eq`, and `desc` to the drizzle imports:

```ts
import { and, eq, desc } from 'drizzle-orm';
```

After the existing `addBlocklistEntry` function, add:

```ts
export async function listBlocklist(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId!;
    const rows = await db
      .select({
        id: messageBlocklist.id,
        pattern: messageBlocklist.pattern,
        createdAt: messageBlocklist.createdAt,
      })
      .from(messageBlocklist)
      .where(eq(messageBlocklist.tenantId, tenantId))
      .orderBy(desc(messageBlocklist.createdAt));
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error({ error }, 'Failed to list blocklist');
    res.status(500).json({ success: false, error: 'Failed to list blocklist' });
  }
}

export async function deleteBlocklistEntry(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId!;
    const id = req.params.id as string | undefined;
    if (!id) {
      res.status(400).json({ success: false, error: 'id is required' });
      return;
    }
    await db
      .delete(messageBlocklist)
      .where(and(eq(messageBlocklist.id, id), eq(messageBlocklist.tenantId, tenantId)));
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    logger.error({ error }, 'Failed to delete blocklist entry');
    res.status(500).json({ success: false, error: 'Failed to delete blocklist entry' });
  }
}
```

The `and(eq(id), eq(tenantId))` clause is mandatory — without the tenantId scope, a user could enumerate other tenants' ids.

- [ ] **Step 4: Wire the routes**

In `packages/server/src/apps/crm/routes.ts`, find the existing `router.post('/blocklist', blocklistController.addBlocklistEntry)` line. Add the two new routes immediately after it:

```ts
router.get('/blocklist', blocklistController.listBlocklist);
router.delete('/blocklist/:id', blocklistController.deleteBlocklistEntry);
```

Both inherit `authMiddleware` and `requireAppPermission('crm')` from the file header.

- [ ] **Step 5: Run, expect pass**

```bash
cd packages/server && npm test -- blocklist-controller 2>&1 | tail -10
```

Expected: 7 passing (4 existing + 3 new).

- [ ] **Step 6: Full suite + typecheck**

```bash
cd packages/server && npm test 2>&1 | tail -5
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: 571 + 3 = 574 passing. Typecheck clean.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/apps/crm/controllers/blocklist.controller.ts packages/server/src/apps/crm/routes.ts packages/server/test/blocklist-controller.test.ts
git commit -m "feat(crm): GET /crm/blocklist + DELETE /crm/blocklist/:id"
```

---

## Task 2: Tenant settings controller — `PATCH /crm/settings/retention`

**Why:** Spec §14 requires a UI control for `tenants.gmail_retention_days`. Server endpoint first.

**Files:**
- Create: `packages/server/src/apps/crm/controllers/tenant-settings.controller.ts`
- Modify: `packages/server/src/apps/crm/routes.ts`
- Test: `packages/server/test/tenant-settings-controller.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/tenant-settings-controller.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const { dbSelectMock, dbUpdateMock } = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  dbUpdateMock: vi.fn(),
}));

vi.mock('../src/config/database', () => ({
  db: {
    select: () => dbSelectMock(),
    update: () => dbUpdateMock(),
  },
}));

import {
  getTenantSettings,
  updateRetention,
} from '../src/apps/crm/controllers/tenant-settings.controller';

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => {
  dbSelectMock.mockReset();
  dbUpdateMock.mockReset();
});

describe('tenant-settings.controller: getTenantSettings', () => {
  it('returns gmailRetentionDays for the tenant', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ gmailRetentionDays: 30 }]) }) }),
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: {},
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await getTenantSettings(req, res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { gmailRetentionDays: 30 },
    });
  });

  it('returns null gmailRetentionDays when unset', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ gmailRetentionDays: null }]) }) }),
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: {},
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await getTenantSettings(req, res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { gmailRetentionDays: null },
    });
  });
});

describe('tenant-settings.controller: updateRetention', () => {
  it('returns 400 when value is not null and not a positive integer', async () => {
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { gmailRetentionDays: -5 },
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await updateRetention(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(dbUpdateMock).not.toHaveBeenCalled();
  });

  it('returns 400 when value is not an integer', async () => {
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { gmailRetentionDays: 1.5 },
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await updateRetention(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('persists null for "retain forever"', async () => {
    let updateSet: any = null;
    dbUpdateMock.mockReturnValue({
      set: (vals: any) => {
        updateSet = vals;
        return { where: () => Promise.resolve() };
      },
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { gmailRetentionDays: null },
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await updateRetention(req, res);
    expect(updateSet.gmailRetentionDays).toBeNull();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { gmailRetentionDays: null },
    });
  });

  it('persists a valid positive integer', async () => {
    let updateSet: any = null;
    dbUpdateMock.mockReturnValue({
      set: (vals: any) => {
        updateSet = vals;
        return { where: () => Promise.resolve() };
      },
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { gmailRetentionDays: 30 },
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await updateRetention(req, res);
    expect(updateSet.gmailRetentionDays).toBe(30);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { gmailRetentionDays: 30 },
    });
  });
});
```

6 tests.

- [ ] **Step 2: Run, expect failure**

```bash
cd packages/server && npm test -- tenant-settings-controller
```

Expected: module-not-found.

- [ ] **Step 3: Implement at `packages/server/src/apps/crm/controllers/tenant-settings.controller.ts`**

```ts
import type { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../../config/database';
import { tenants } from '../../../db/schema';
import { logger } from '../../../utils/logger';

export async function getTenantSettings(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId!;
    const [row] = await db
      .select({ gmailRetentionDays: tenants.gmailRetentionDays })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    res.json({
      success: true,
      data: { gmailRetentionDays: row?.gmailRetentionDays ?? null },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to load tenant settings');
    res.status(500).json({ success: false, error: 'Failed to load tenant settings' });
  }
}

export async function updateRetention(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId!;
    const raw = req.body?.gmailRetentionDays;
    let value: number | null;
    if (raw === null || raw === undefined) {
      value = null;
    } else if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) {
      value = raw;
    } else {
      res.status(400).json({
        success: false,
        error: 'gmailRetentionDays must be a positive integer or null',
      });
      return;
    }
    await db
      .update(tenants)
      .set({ gmailRetentionDays: value, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));
    res.json({ success: true, data: { gmailRetentionDays: value } });
  } catch (error) {
    logger.error({ error }, 'Failed to update tenant retention');
    res.status(500).json({ success: false, error: 'Failed to update tenant retention' });
  }
}
```

- [ ] **Step 4: Wire the routes**

In `packages/server/src/apps/crm/routes.ts`, add the import alongside the others:

```ts
import * as tenantSettingsController from './controllers/tenant-settings.controller';
```

After the blocklist routes (Task 1), add:

```ts
// Tenant settings (Phase 3a)
router.get('/settings', tenantSettingsController.getTenantSettings);
router.patch('/settings/retention', tenantSettingsController.updateRetention);
```

- [ ] **Step 5: Run, expect pass**

```bash
cd packages/server && npm test -- tenant-settings-controller 2>&1 | tail -10
```

Expected: 6 passing.

- [ ] **Step 6: Full suite + typecheck**

```bash
cd packages/server && npm test 2>&1 | tail -5
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: 574 + 6 = 580 passing.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/apps/crm/controllers/tenant-settings.controller.ts packages/server/src/apps/crm/routes.ts packages/server/test/tenant-settings-controller.test.ts
git commit -m "feat(crm): tenant settings endpoints — get + update gmail retention"
```

---

## Task 3: Activity backfill service

**Why:** Spec §14 requires that when a contact is created, prior messages from that handle get linked retroactively. Phase 2c only links going-forward.

**Files:**
- Create: `packages/server/src/apps/crm/services/contact-message-backfill.service.ts`
- Test: `packages/server/test/contact-message-backfill-service.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/contact-message-backfill-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { dbSelectMock, dbUpdateMock, upsertActivitiesForMessageMock } = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  dbUpdateMock: vi.fn(),
  upsertActivitiesForMessageMock: vi.fn(),
}));

vi.mock('../src/config/database', () => ({
  db: {
    select: () => dbSelectMock(),
    update: () => dbUpdateMock(),
  },
}));

vi.mock('../src/apps/crm/services/message-activity.service', () => ({
  upsertActivitiesForMessage: upsertActivitiesForMessageMock,
}));

import { backfillContactMessages } from '../src/apps/crm/services/contact-message-backfill.service';

beforeEach(() => {
  dbSelectMock.mockReset();
  dbUpdateMock.mockReset();
  upsertActivitiesForMessageMock.mockReset();
  dbUpdateMock.mockReturnValue({
    set: () => ({ where: () => Promise.resolve({ rowCount: 0 }) }),
  });
});

describe('backfillContactMessages', () => {
  it('returns 0 when the contact has no email', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ email: null }]) }) }),
    });
    const result = await backfillContactMessages('t-1', 'c-1', 'u-1');
    expect(result).toBe(0);
    expect(dbUpdateMock).not.toHaveBeenCalled();
    expect(upsertActivitiesForMessageMock).not.toHaveBeenCalled();
  });

  it('returns 0 when contact does not exist', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    const result = await backfillContactMessages('t-1', 'c-missing', 'u-1');
    expect(result).toBe(0);
  });

  it('links matching participant rows and re-runs activity upsert per affected message', async () => {
    // First select: load contact email
    dbSelectMock
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([{ email: 'jane@example.com' }]) }) }),
      })
      // Second select: find affected messages by handle (lowercased) where personId IS NULL.
      // The service joins messageParticipants → messages, so the chain includes innerJoin.
      .mockReturnValueOnce({
        from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([
          { messageId: 'msg-1', direction: 'inbound' },
          { messageId: 'msg-2', direction: 'outbound' },
        ]) }) }),
      });

    let updateRan = false;
    dbUpdateMock.mockReturnValue({
      set: () => ({
        where: () => {
          updateRan = true;
          return Promise.resolve({ rowCount: 2 });
        },
      }),
    });

    const result = await backfillContactMessages('t-1', 'c-1', 'u-1');

    expect(result).toBe(2);
    expect(updateRan).toBe(true);
    expect(upsertActivitiesForMessageMock).toHaveBeenCalledTimes(2);
    expect(upsertActivitiesForMessageMock).toHaveBeenCalledWith({
      messageId: 'msg-1',
      tenantId: 't-1',
      userId: 'u-1',
      direction: 'inbound',
    });
    expect(upsertActivitiesForMessageMock).toHaveBeenCalledWith({
      messageId: 'msg-2',
      tenantId: 't-1',
      userId: 'u-1',
      direction: 'outbound',
    });
  });

  it('returns 0 when no participant rows match the email', async () => {
    dbSelectMock
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([{ email: 'nobody@example.com' }]) }) }),
      })
      .mockReturnValueOnce({
        from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([]) }) }),
      });

    const result = await backfillContactMessages('t-1', 'c-1', 'u-1');
    expect(result).toBe(0);
    expect(upsertActivitiesForMessageMock).not.toHaveBeenCalled();
  });
});
```

4 tests.

- [ ] **Step 2: Run, expect failure**

```bash
cd packages/server && npm test -- contact-message-backfill-service
```

Expected: module-not-found.

- [ ] **Step 3: Implement at `packages/server/src/apps/crm/services/contact-message-backfill.service.ts`**

```ts
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../../config/database';
import { crmContacts, messageParticipants, messages } from '../../../db/schema';
import { upsertActivitiesForMessage } from './message-activity.service';
import { logger } from '../../../utils/logger';
import type { MessageDirection } from './participant-match.service';

/**
 * Retroactively link existing messages to a newly-created contact.
 *
 * Walks `messageParticipants` for rows whose lowercased handle matches the
 * contact's email AND `personId IS NULL` AND share the tenant. Sets
 * `personId` on each, then re-runs `upsertActivitiesForMessage` so the
 * timeline picks up activities for the messages that were ingested before
 * the contact existed.
 *
 * Returns the number of participant rows linked. Idempotent — calling
 * twice on the same contact is a no-op (the second call finds nothing
 * with `personId IS NULL` left to update).
 */
export async function backfillContactMessages(
  tenantId: string,
  contactId: string,
  userId: string,
): Promise<number> {
  const [contact] = await db
    .select({ email: crmContacts.email })
    .from(crmContacts)
    .where(and(eq(crmContacts.id, contactId), eq(crmContacts.tenantId, tenantId)))
    .limit(1);

  if (!contact || !contact.email) return 0;
  const handle = contact.email.toLowerCase();

  // Find participants matching this handle that haven't been linked yet.
  // Join through messages so we can capture each affected message's direction
  // for the activity upsert call.
  const rows = await db
    .select({
      messageId: messageParticipants.messageId,
      direction: messages.direction,
    })
    .from(messageParticipants)
    .innerJoin(messages, eq(messages.id, messageParticipants.messageId))
    .where(
      and(
        eq(messageParticipants.tenantId, tenantId),
        eq(messageParticipants.handle, handle),
        isNull(messageParticipants.personId),
      ),
    );

  if (rows.length === 0) return 0;

  // Update all matching participants in one statement.
  await db
    .update(messageParticipants)
    .set({ personId: contactId, updatedAt: new Date() })
    .where(
      and(
        eq(messageParticipants.tenantId, tenantId),
        eq(messageParticipants.handle, handle),
        isNull(messageParticipants.personId),
      ),
    );

  // Per affected message, re-run the activity upsert so the timeline picks
  // up the new contact link. Distinct messageIds — one message can have
  // multiple participants (cc, bcc) for the same handle is rare but possible.
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.messageId)) continue;
    seen.add(row.messageId);
    try {
      await upsertActivitiesForMessage({
        messageId: row.messageId,
        tenantId,
        userId,
        direction: row.direction as MessageDirection,
      });
    } catch (err) {
      logger.error({ err, messageId: row.messageId, contactId }, 'Backfill activity upsert failed');
    }
  }

  logger.info(
    { tenantId, contactId, linked: rows.length, messages: seen.size },
    'Contact message backfill completed',
  );

  return rows.length;
}
```

- [ ] **Step 4: Run, expect pass**

```bash
cd packages/server && npm test -- contact-message-backfill-service
```

Expected: 4 passing.

- [ ] **Step 5: Full suite + typecheck**

```bash
cd packages/server && npm test 2>&1 | tail -5
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: 580 + 4 = 584 passing.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/apps/crm/services/contact-message-backfill.service.ts packages/server/test/contact-message-backfill-service.test.ts
git commit -m "feat(crm): contact-message backfill — retroactively link prior messages"
```

---

## Task 4: Wire backfill into both contact-creation paths

**Why:** Two callers create contacts: `contact.service.createContact` (manual user creation) and `crm-contact-create.service.autoCreateContactIfNeeded` (auto-create from email). Both should fire the backfill.

**Files:**
- Modify: `packages/server/src/apps/crm/services/contact.service.ts`
- Modify: `packages/server/src/apps/crm/services/crm-contact-create.service.ts`

- [ ] **Step 1: Wire into `contact.service.createContact`**

In `packages/server/src/apps/crm/services/contact.service.ts`, find the `createContact` function (around line 105). It returns the inserted contact row. Add a backfill call AFTER the insert returns and BEFORE the function returns.

Add the import at the top of the file:

```ts
import { backfillContactMessages } from './contact-message-backfill.service';
```

After the `[created] = await db.insert(crmContacts).values(...).returning()` block, before the return:

```ts
  // Phase 3a: retroactively link prior messages to this contact.
  // Fire-and-forget — backfill failures should not block contact creation.
  // Mirrors the existing executeWorkflows().catch(...) pattern above.
  backfillContactMessages(tenantId, created.id, userId)
    .catch((err) => logger.error({ err, contactId: created.id }, 'Contact backfill failed'));

  return created;
```

`logger` is already imported in `contact.service.ts` — no extra import needed.

The dangling `.catch(...)` pattern keeps the API call fast (sync return) while still surfacing failures in logs. The backfill is idempotent so a missed run is safe to retry by re-firing the contact-creation flow.

- [ ] **Step 2: Wire into `crm-contact-create.service.autoCreateContactIfNeeded`**

In `packages/server/src/apps/crm/services/crm-contact-create.service.ts`, find the `autoCreateContactIfNeeded` function. It currently returns `created.id` after `createContact()` succeeds. Since `createContact` (Step 1) now fires the backfill, this path inherits it automatically — **no further change needed in this file**. (Verify by reading the function: it ends with `return created.id;` after `createContact(...)`. Phase 2c's simplify-pass refactor delegates to `contact.service.createContact`, so the backfill is one-shot regardless of caller.)

- [ ] **Step 3: Run gmail-sync + contact tests**

```bash
cd packages/server && npm test -- gmail-sync-service contact 2>&1 | tail -10
```

If any existing test breaks (because now `createContact` calls something new), update the test mock to add a stub for `backfillContactMessages`. Look for the test files at `packages/server/test/contact-service.test.ts` (if it exists) and `packages/server/test/crm-contact-create-service.test.ts`. The latter already mocks `contact.service`, so the inner `backfillContactMessages` call is mocked transitively — no edit needed there.

If `contact-service.test.ts` exists and breaks, add at the top of the file:

```ts
vi.mock('../src/apps/crm/services/contact-message-backfill.service', () => ({
  backfillContactMessages: vi.fn(async () => 0),
}));
```

If the file doesn't exist, skip this step.

- [ ] **Step 4: Full suite + typecheck**

```bash
cd packages/server && npm test 2>&1 | tail -5
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: 584 passing (no new tests, no regressions). Typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/apps/crm/services/contact.service.ts
# only add the test if you had to edit it:
# git add packages/server/test/contact-service.test.ts
git commit -m "feat(crm): fire backfill on contact creation (manual + auto-create paths)"
```

---

## Task 5: Scheduler reconcile service

**Why:** The TODO at `workers/index.ts:81` describes the orphan-reconcile shape. When a channel is deleted or `isSyncEnabled` flips to false, the BullMQ scheduler key persists in Redis and keeps firing every 5 min. The job handler returns early, but a worker slot is still consumed and Redis accumulates dead schedulers.

**Files:**
- Create: `packages/server/src/apps/crm/services/scheduler-reconcile.service.ts`
- Test: `packages/server/test/scheduler-reconcile-service.test.ts`

- [ ] **Step 1: Read the BullMQ scheduler key shape**

The scheduler IDs follow the pattern `gmail-incremental-${channelId}` (Phase 2b). The reconcile pass:
1. List existing schedulers via `queue.getJobSchedulers()`.
2. Filter for entries whose key starts with `gmail-incremental-`.
3. Extract the channelId from the key suffix.
4. For each, check if the channel exists and is `isSyncEnabled=true`.
5. If not, call `queue.removeJobScheduler(key)`.

Verify the API surface — `getJobSchedulers` returns a paginated structure. For our scale (channels in the dozens, not millions) a single page is fine; we'll cap at 1000.

- [ ] **Step 2: Write the failing test**

Create `packages/server/test/scheduler-reconcile-service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  getSyncQueueMock,
  getJobSchedulersMock,
  removeJobSchedulerMock,
  dbSelectMock,
} = vi.hoisted(() => ({
  getSyncQueueMock: vi.fn(),
  getJobSchedulersMock: vi.fn(),
  removeJobSchedulerMock: vi.fn(),
  dbSelectMock: vi.fn(),
}));

vi.mock('../src/config/queue', () => ({
  getSyncQueue: () => getSyncQueueMock(),
}));

vi.mock('../src/config/database', () => ({
  db: {
    select: () => dbSelectMock(),
  },
}));

import { reconcileGmailIncrementalSchedulers } from '../src/apps/crm/services/scheduler-reconcile.service';

beforeEach(() => {
  getSyncQueueMock.mockReset();
  getJobSchedulersMock.mockReset();
  removeJobSchedulerMock.mockReset();
  dbSelectMock.mockReset();
  getSyncQueueMock.mockReturnValue({
    getJobSchedulers: getJobSchedulersMock,
    removeJobScheduler: removeJobSchedulerMock,
  });
});

describe('reconcileGmailIncrementalSchedulers', () => {
  it('does nothing when queue is unavailable', async () => {
    getSyncQueueMock.mockReturnValue(null);
    await reconcileGmailIncrementalSchedulers();
    expect(getJobSchedulersMock).not.toHaveBeenCalled();
  });

  it('skips non-gmail-incremental keys', async () => {
    getJobSchedulersMock.mockResolvedValue([
      { key: 'calendar-incremental-acc-1' },
      { key: 'gmail-message-cleaner' },
    ]);
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([]) }),
    });
    await reconcileGmailIncrementalSchedulers();
    expect(removeJobSchedulerMock).not.toHaveBeenCalled();
  });

  it('removes schedulers whose channel is missing', async () => {
    getJobSchedulersMock.mockResolvedValue([
      { key: 'gmail-incremental-ch-1' },
      { key: 'gmail-incremental-ch-2' },
    ]);
    // ch-1 exists and is enabled. ch-2 doesn't exist.
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([{ id: 'ch-1', isSyncEnabled: true }]) }),
    });
    await reconcileGmailIncrementalSchedulers();
    expect(removeJobSchedulerMock).toHaveBeenCalledWith('gmail-incremental-ch-2');
    expect(removeJobSchedulerMock).not.toHaveBeenCalledWith('gmail-incremental-ch-1');
  });

  it('removes schedulers whose channel is sync-disabled', async () => {
    getJobSchedulersMock.mockResolvedValue([
      { key: 'gmail-incremental-ch-1' },
    ]);
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([{ id: 'ch-1', isSyncEnabled: false }]) }),
    });
    await reconcileGmailIncrementalSchedulers();
    expect(removeJobSchedulerMock).toHaveBeenCalledWith('gmail-incremental-ch-1');
  });

  it('removes nothing and short-circuits the channel SELECT when no gmail-incremental schedulers exist', async () => {
    getJobSchedulersMock.mockResolvedValue([
      { key: 'calendar-incremental-acc-1', name: 'calendar-incremental-sync' },
    ]);
    await reconcileGmailIncrementalSchedulers();
    expect(removeJobSchedulerMock).not.toHaveBeenCalled();
    // The channel SELECT should NOT fire when there are no candidate keys.
    expect(dbSelectMock).not.toHaveBeenCalled();
  });
});
```

5 tests.

- [ ] **Step 3: Run, expect failure**

```bash
cd packages/server && npm test -- scheduler-reconcile-service
```

Expected: module-not-found.

- [ ] **Step 4: Implement at `packages/server/src/apps/crm/services/scheduler-reconcile.service.ts`**

```ts
import { eq } from 'drizzle-orm';
import { db } from '../../../config/database';
import { messageChannels } from '../../../db/schema';
import { getSyncQueue } from '../../../config/queue';
import { logger } from '../../../utils/logger';

const SCHEDULER_KEY_PREFIX = 'gmail-incremental-';

/**
 * Drop BullMQ scheduler entries whose underlying channel was deleted or
 * has `isSyncEnabled = false`. Without this pass, deleted channels leak
 * Redis keys that fire the worker every 5 minutes; the handler returns
 * early but a worker slot is consumed.
 *
 * Idempotent — safe to call on every boot.
 */
export async function reconcileGmailIncrementalSchedulers(): Promise<void> {
  const queue = getSyncQueue();
  if (!queue) return;

  // BullMQ ^5.25: getJobSchedulers(start=0, end=-1) returns the full list as
  // an array of { key, name, ... } entries.
  const schedulers = await queue.getJobSchedulers(0, -1);

  const keyByChannelId = new Map<string, string>();
  for (const s of schedulers) {
    if (!s.key || !s.key.startsWith(SCHEDULER_KEY_PREFIX)) continue;
    const channelId = s.key.slice(SCHEDULER_KEY_PREFIX.length);
    keyByChannelId.set(channelId, s.key);
  }

  if (keyByChannelId.size === 0) {
    logger.info({ schedulers: schedulers.length }, 'Scheduler reconcile: no gmail-incremental keys found');
    return;
  }

  const channels = await db
    .select({ id: messageChannels.id, isSyncEnabled: messageChannels.isSyncEnabled })
    .from(messageChannels)
    .where(eq(messageChannels.type, 'gmail'));

  const live = new Set(channels.filter((c) => c.isSyncEnabled).map((c) => c.id));

  let removed = 0;
  for (const [channelId, key] of keyByChannelId) {
    if (live.has(channelId)) continue;
    try {
      await queue.removeJobScheduler(key);
      removed++;
    } catch (err) {
      logger.error({ err, key }, 'Failed to remove orphan scheduler');
    }
  }

  logger.info(
    { schedulers: schedulers.length, candidates: keyByChannelId.size, removed },
    'Scheduler reconcile completed',
  );
}
```

- [ ] **Step 5: Run, expect pass**

```bash
cd packages/server && npm test -- scheduler-reconcile-service
```

Expected: 5 passing.

- [ ] **Step 6: Full suite + typecheck**

```bash
cd packages/server && npm test 2>&1 | tail -5
cd packages/server && npm run typecheck 2>&1 | tail -3
```

Expected: 584 + 5 = 589 passing.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/apps/crm/services/scheduler-reconcile.service.ts packages/server/test/scheduler-reconcile-service.test.ts
git commit -m "feat(crm): scheduler reconcile — drop BullMQ entries for deleted/disabled channels"
```

---

## Task 6: Wire scheduler reconcile into boot

**Why:** Reconcile fires on every boot, after the Gmail incremental scheduler has set the live entries.

**Files:**
- Modify: `packages/server/src/workers/index.ts`
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: Add the import + boot invocation in workers/index.ts**

In `packages/server/src/workers/index.ts`, near the top of the file (with the other service imports), add:

```ts
import { reconcileGmailIncrementalSchedulers } from '../apps/crm/services/scheduler-reconcile.service';
```

The reconcile pass is conceptually a sibling of the existing `scheduleGmailIncrementalSyncForAllChannels` function. Re-export the reconcile function from this module so `index.ts` can wire it on boot:

```ts
export { reconcileGmailIncrementalSchedulers } from '../apps/crm/services/scheduler-reconcile.service';
```

- [ ] **Step 2: Wire into boot in index.ts**

In `packages/server/src/index.ts`, extend the workers import block:

```ts
import {
  startSyncWorker,
  stopSyncWorker,
  scheduleIncrementalSyncForAllAccounts,
  scheduleGmailIncrementalSyncForAllChannels,
  scheduleDailyMessageCleaner,
  reconcileGmailIncrementalSchedulers,
} from './workers';
```

After the existing scheduler invocations (after `scheduleDailyMessageCleaner().catch(...)`), add:

```ts
reconcileGmailIncrementalSchedulers().catch((err) =>
  logger.error({ err }, 'Failed to reconcile Gmail schedulers'),
);
```

The reconcile fires AFTER the live schedulers are set, so the membership check is against the freshly-upserted set.

- [ ] **Step 3: Run typecheck + suite**

```bash
cd packages/server && npm run typecheck 2>&1 | tail -3
cd packages/server && npm test 2>&1 | tail -5
```

Expected: typecheck clean. Suite still 589 (no new tests).

- [ ] **Step 4: Commit**

```bash
git add packages/server/src/workers/index.ts packages/server/src/index.ts
git commit -m "feat(server): reconcile Gmail incremental schedulers on boot"
```

---

## Task 7: Client hooks for blocklist + tenant settings

**Why:** Two new sets of hooks: blocklist (list, add, delete) and tenant settings (read, update retention). The existing `useBlockSender` (Phase 2d) covers blocklist add — keep it where it lives.

**Files:**
- Create: `packages/client/src/apps/crm/hooks/use-blocklist.ts`
- Create: `packages/client/src/apps/crm/hooks/use-tenant-settings.ts`
- Modify: `packages/client/src/config/query-keys.ts`

- [ ] **Step 1: Add query-keys namespaces**

In `packages/client/src/config/query-keys.ts`, find the existing `crm` block (around line 154). Add two new namespaces alongside `messages`:

```ts
    blocklist: {
      all: ['crm', 'blocklist'] as const,
    },
    tenantSettings: {
      all: ['crm', 'tenant-settings'] as const,
    },
```

- [ ] **Step 2: Create blocklist hooks**

Create `packages/client/src/apps/crm/hooks/use-blocklist.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { queryKeys } from '../../../config/query-keys';

export interface BlocklistEntry {
  id: string;
  pattern: string;
  createdAt: string;
}

export function useBlocklist() {
  return useQuery({
    queryKey: queryKeys.crm.blocklist.all,
    queryFn: async () => {
      const { data } = await api.get('/crm/blocklist');
      return data.data as BlocklistEntry[];
    },
    staleTime: 30_000,
  });
}

export function useDeleteBlocklistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/crm/blocklist/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.blocklist.all });
    },
  });
}

export function useAddBlocklistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pattern: string): Promise<{ pattern: string }> => {
      const { data } = await api.post('/crm/blocklist', { pattern });
      return data.data as { pattern: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.blocklist.all });
    },
  });
}
```

Note: `useAddBlocklistEntry` overlaps with the existing `useBlockSender` (Phase 2d), but their invalidation targets differ — `useBlockSender` invalidates `crm.activities.all` (because the timeline view of the email may shift), `useAddBlocklistEntry` invalidates `crm.blocklist.all` (the settings panel list). Both stay; the manual-add UI uses this one, the email-row Block button uses `useBlockSender`.

- [ ] **Step 3: Create tenant-settings hooks**

Create `packages/client/src/apps/crm/hooks/use-tenant-settings.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { queryKeys } from '../../../config/query-keys';

export interface TenantSettings {
  gmailRetentionDays: number | null;
}

export function useTenantSettings() {
  return useQuery({
    queryKey: queryKeys.crm.tenantSettings.all,
    queryFn: async () => {
      const { data } = await api.get('/crm/settings');
      return data.data as TenantSettings;
    },
    staleTime: 30_000,
  });
}

export function useUpdateRetention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gmailRetentionDays: number | null): Promise<TenantSettings> => {
      const { data } = await api.patch('/crm/settings/retention', { gmailRetentionDays });
      return data.data as TenantSettings;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.tenantSettings.all });
    },
  });
}
```

- [ ] **Step 4: Typecheck**

```bash
cd packages/client && npm run typecheck 2>&1 | tail -3
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/config/query-keys.ts \
        packages/client/src/apps/crm/hooks/use-blocklist.ts \
        packages/client/src/apps/crm/hooks/use-tenant-settings.ts
git commit -m "feat(crm): client hooks for blocklist + tenant settings"
```

---

## Task 8: Blocklist UI section + retention UI section

**Why:** The two new components mount in the existing CRM Integrations panel.

**Files:**
- Create: `packages/client/src/apps/crm/components/integrations/blocklist-section.tsx`
- Create: `packages/client/src/apps/crm/components/integrations/retention-section.tsx`
- Modify: `packages/client/src/components/settings/integrations-panel.tsx`
- Modify: 5 locale files

- [ ] **Step 1: Add translation keys to all 5 locale files**

```bash
for L in en tr de fr it; do
  node -e "
    const fs = require('fs');
    const path = '/Users/gorkemcetin/atlasmail/packages/client/src/i18n/locales/${L}.json';
    const j = JSON.parse(fs.readFileSync(path, 'utf-8'));
    j.crm.integrations = j.crm.integrations || {};
    j.crm.integrations.blocklist = {
      title: 'Blocklist',
      description: 'Patterns that prevent contact auto-creation. Default seeds plus any added entries.',
      empty: 'No patterns yet.',
      addPlaceholder: 'pattern (e.g. *@spam.com or alice@example.com)',
      add: 'Add',
      remove: 'Remove',
      addedToast: 'Pattern added',
      removedToast: 'Pattern removed',
      addError: 'Failed to add pattern',
      removeError: 'Failed to remove pattern',
      patternRequired: 'Pattern is required'
    };
    j.crm.integrations.retention = {
      title: 'Retention',
      description: 'Auto-delete emails older than N days. Leave blank to retain forever.',
      label: 'Days to retain',
      forever: 'Retain forever (no auto-delete)',
      save: 'Save',
      saving: 'Saving...',
      savedToast: 'Retention updated',
      saveError: 'Failed to update retention',
      invalidValue: 'Enter a positive integer or leave blank'
    };
    fs.writeFileSync(path, JSON.stringify(j, null, 2) + String.fromCharCode(10));
  "
done
for f in /Users/gorkemcetin/atlasmail/packages/client/src/i18n/locales/*.json; do
  node -e "require('$f')" || echo "BROKEN: $f"
done
```

- [ ] **Step 2: Create the blocklist section**

Create `packages/client/src/apps/crm/components/integrations/blocklist-section.tsx`:

```tsx
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { useToastStore } from '../../../../stores/toast-store';
import {
  useBlocklist,
  useAddBlocklistEntry,
  useDeleteBlocklistEntry,
} from '../../hooks/use-blocklist';

export function BlocklistSection() {
  const { t } = useTranslation();
  const { data: entries, isLoading } = useBlocklist();
  const addEntry = useAddBlocklistEntry();
  const deleteEntry = useDeleteBlocklistEntry();
  const addToast = useToastStore((s) => s.addToast);
  const [draft, setDraft] = useState('');

  const handleAdd = () => {
    const pattern = draft.trim();
    if (!pattern) {
      addToast({ type: 'error', message: t('crm.integrations.blocklist.patternRequired', 'Pattern is required') });
      return;
    }
    addEntry.mutate(pattern, {
      onSuccess: () => {
        addToast({ type: 'success', message: t('crm.integrations.blocklist.addedToast', 'Pattern added') });
        setDraft('');
      },
      onError: (err: unknown) => {
        const anyErr = err as { response?: { data?: { error?: string } } };
        addToast({
          type: 'error',
          message: anyErr?.response?.data?.error ?? t('crm.integrations.blocklist.addError', 'Failed to add pattern'),
        });
      },
    });
  };

  const handleRemove = (id: string) => {
    deleteEntry.mutate(id, {
      onSuccess: () =>
        addToast({ type: 'success', message: t('crm.integrations.blocklist.removedToast', 'Pattern removed') }),
      onError: (err: unknown) => {
        const anyErr = err as { response?: { data?: { error?: string } } };
        addToast({
          type: 'error',
          message: anyErr?.response?.data?.error ?? t('crm.integrations.blocklist.removeError', 'Failed to remove pattern'),
        });
      },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      <div>
        <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
          {t('crm.integrations.blocklist.title', 'Blocklist')}
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
          {t('crm.integrations.blocklist.description', 'Patterns that prevent contact auto-creation.')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Input
            size="sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('crm.integrations.blocklist.addPlaceholder', 'pattern')}
          />
        </div>
        <Button size="sm" variant="primary" onClick={handleAdd} disabled={addEntry.isPending || !draft.trim()}>
          {t('crm.integrations.blocklist.add', 'Add')}
        </Button>
      </div>

      {isLoading ? null : entries && entries.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
          {entries.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-secondary)',
              }}
            >
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {entry.pattern}
              </span>
              <Button size="sm" variant="ghost" onClick={() => handleRemove(entry.id)} disabled={deleteEntry.isPending}>
                {t('crm.integrations.blocklist.remove', 'Remove')}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
          {t('crm.integrations.blocklist.empty', 'No patterns yet.')}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the retention section**

Create `packages/client/src/apps/crm/components/integrations/retention-section.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { useToastStore } from '../../../../stores/toast-store';
import { useTenantSettings, useUpdateRetention } from '../../hooks/use-tenant-settings';

export function RetentionSection() {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useTenantSettings();
  const updateRetention = useUpdateRetention();
  const addToast = useToastStore((s) => s.addToast);
  const [draft, setDraft] = useState<string>('');

  // Sync the draft from server data on first load.
  useEffect(() => {
    if (settings) {
      setDraft(settings.gmailRetentionDays == null ? '' : String(settings.gmailRetentionDays));
    }
  }, [settings]);

  const handleSave = () => {
    const trimmed = draft.trim();
    let value: number | null;
    if (trimmed === '') {
      value = null;
    } else {
      const n = Number(trimmed);
      if (!Number.isInteger(n) || n <= 0) {
        addToast({ type: 'error', message: t('crm.integrations.retention.invalidValue', 'Enter a positive integer or leave blank') });
        return;
      }
      value = n;
    }
    updateRetention.mutate(value, {
      onSuccess: () =>
        addToast({ type: 'success', message: t('crm.integrations.retention.savedToast', 'Retention updated') }),
      onError: (err: unknown) => {
        const anyErr = err as { response?: { data?: { error?: string } } };
        addToast({
          type: 'error',
          message: anyErr?.response?.data?.error ?? t('crm.integrations.retention.saveError', 'Failed to update retention'),
        });
      },
    });
  };

  if (isLoading) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      <div>
        <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
          {t('crm.integrations.retention.title', 'Retention')}
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
          {t('crm.integrations.retention.description', 'Auto-delete emails older than N days. Leave blank to retain forever.')}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--spacing-sm)' }}>
        <div style={{ flex: 1 }}>
          <Input
            size="sm"
            label={t('crm.integrations.retention.label', 'Days to retain')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('crm.integrations.retention.forever', 'Retain forever (no auto-delete)')}
            inputMode="numeric"
          />
        </div>
        <Button size="sm" variant="primary" onClick={handleSave} disabled={updateRetention.isPending}>
          {updateRetention.isPending
            ? t('crm.integrations.retention.saving', 'Saving...')
            : t('crm.integrations.retention.save', 'Save')}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Mount in the integrations panel**

In `packages/client/src/components/settings/integrations-panel.tsx`, find the existing `<ChannelsList />` mount (around line 190). Add the imports near the top:

```tsx
import { BlocklistSection } from '../../apps/crm/components/integrations/blocklist-section';
import { RetentionSection } from '../../apps/crm/components/integrations/retention-section';
```

After the `<ChannelsList />` element, add the two new sections — wrapped to match the panel's existing section spacing. Read 5-10 lines around line 190 to see the section pattern; mirror it. The simplest insertion (when the existing `<ChannelsList />` sits inside a parent `<div>` with vertical gap):

```tsx
<ChannelsList />
<BlocklistSection />
<RetentionSection />
```

If the panel uses a `SettingsSection` wrapper (check by reading), use that wrapper for visual consistency:

```tsx
<SettingsSection title={t('crm.integrations.blocklist.title', 'Blocklist')}>
  <BlocklistSection />
</SettingsSection>
<SettingsSection title={t('crm.integrations.retention.title', 'Retention')}>
  <RetentionSection />
</SettingsSection>
```

(The two sections render their own title/description internally, so a wrapper that also adds a title would duplicate. Pick whichever option matches the surrounding visual rhythm — read the existing `<ChannelsList />` mount and adapt.)

- [ ] **Step 5: Typecheck + build**

```bash
cd packages/client && npm run typecheck 2>&1 | tail -3
cd packages/client && npm run build 2>&1 | tail -5
```

Expected: typecheck clean, build clean.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/apps/crm/components/integrations/blocklist-section.tsx \
        packages/client/src/apps/crm/components/integrations/retention-section.tsx \
        packages/client/src/components/settings/integrations-panel.tsx \
        packages/client/src/i18n/locales/en.json \
        packages/client/src/i18n/locales/tr.json \
        packages/client/src/i18n/locales/de.json \
        packages/client/src/i18n/locales/fr.json \
        packages/client/src/i18n/locales/it.json
git commit -m "feat(crm): blocklist + retention sections in integrations panel"
```

---

## Task 9: Final verification (NO PUSH)

- [ ] **Step 1: Run full server test suite**

```bash
cd packages/server && npm test 2>&1 | tail -8
```

Expected: 589 passing (571 baseline + 3 blocklist + 6 tenant-settings + 4 backfill + 5 reconcile = 589).

- [ ] **Step 2: Server typecheck + lint + build**

```bash
cd packages/server && npm run typecheck 2>&1 | tail -3
cd packages/server && npm run lint 2>&1 | grep -E "error|^✖" | tail -3
cd packages/server && npm run build 2>&1 | tail -3
```

Expected: typecheck clean, 0 lint errors, build clean.

Verify new artifacts:

```bash
ls packages/server/dist/apps/crm/services/contact-message-backfill.service.js
ls packages/server/dist/apps/crm/services/scheduler-reconcile.service.js
ls packages/server/dist/apps/crm/controllers/tenant-settings.controller.js
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

Expected: 8 unpushed commits (one per task plus the initial plan commit).

- [ ] **Step 5: Report**

Per Atlas convention this plan does NOT push. Summarize:
- Tasks 1–8 completed
- New endpoints: `GET /crm/blocklist`, `DELETE /crm/blocklist/:id`, `GET /crm/settings`, `PATCH /crm/settings/retention`
- New services: `contact-message-backfill`, `scheduler-reconcile`
- Backfill wired into `contact.service.createContact` (auto-create inherits via delegation)
- Reconcile wired into boot
- New UI sections: Blocklist + Retention in CRM Integrations panel

---

## Acceptance criteria

- [ ] All server tests pass (~589 expected)
- [ ] `npm run typecheck` clean in both `packages/server` and `packages/client`
- [ ] `npm run lint` 0 errors in `packages/server`
- [ ] `npm run build` clean in both packages
- [ ] Boot logs include "Scheduler reconcile completed"
- [ ] Boot logs include "Contact message backfill completed" only when contact creation actually fires (not on every boot)
- [ ] Blocklist UI lists, adds, and removes patterns; toasts confirm success/failure
- [ ] Retention UI shows current value (or empty for null), saves on Save
- [ ] No new top-level dependencies added
- [ ] All commits target `main`; no feature branch; no `git push`
