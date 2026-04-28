# Google Sync Engine — Phase 1: Job Queue Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a real BullMQ job queue, wire `POST /crm/google/sync/start` to enqueue a real `calendar-full-sync` job that runs the existing `performCalendarFullSync` service, and add a repeatable `calendar-incremental-sync` job that fires every 5 min. No Gmail work in this phase — this is the rails Gmail will ride on later.

**Architecture:** Single-process for now (`WORKER_MODE=both` default). One BullMQ Queue + one Worker, both backed by the existing `getRedisClient()` singleton. Worker is started in `index.ts` alongside the existing `setInterval` schedulers. Jobs only enqueue when `REDIS_URL` is set; without Redis the start endpoint returns a clear "Redis required" error. No new container, no Pub/Sub, no Gmail.

**Tech Stack:** BullMQ ^5.25.0 (already installed), ioredis ^5.4.0 (already in use), TypeScript, Express 5, Drizzle, vitest.

**Out of scope for Phase 1:** Gmail API calls, Gmail-related schema, push notifications / Pub/Sub, separate worker container, retry-on-401 wrapper for `google-auth.ts` (those are Phase 2/3). The `WORKER_MODE` env var is introduced but defaults to `both` — splitting api from worker happens later if/when load demands it.

---

## File Structure

**New files:**
- `packages/server/src/config/queue.ts` — BullMQ Queue + connection factory, queue name constants, job-data types
- `packages/server/src/workers/sync.worker.ts` — BullMQ Worker that dispatches `calendar-full-sync` and `calendar-incremental-sync` jobs to the existing calendar-sync service
- `packages/server/src/workers/index.ts` — `startSyncWorker()` / `stopSyncWorker()` lifecycle helpers + repeatable-job scheduler
- `packages/server/test/queue.test.ts` — unit test covering queue factory + job-data types
- `packages/server/test/sync-worker.test.ts` — unit test covering the worker's job-dispatch switch (calendar service is mocked)

**Modified files:**
- `packages/server/src/config/env.ts` — add `WORKER_MODE` enum env var
- `packages/server/src/index.ts` — call `startSyncWorker` / `stopSyncWorker`, schedule the repeatable incremental job, gated on `WORKER_MODE`
- `packages/server/src/apps/crm/controllers/dashboard.controller.ts` — replace stub `startGoogleSync` with real enqueue; add `queueDepth` to `getGoogleSyncStatus`
- `.env.example` (at the repo root — there is no `packages/server/.env.example` in this repo) — document `WORKER_MODE`

**Stale artifacts to delete:**
- `packages/server/dist/workers/sync.worker.{js,js.map,d.ts,d.ts.map}` and `packages/server/dist/workers/index.{js,js.map,d.ts,d.ts.map}` — ghost compiled files from a previous attempt with no `.ts` source. They get regenerated correctly once Task 3 lands.

**Why this layout:** `config/queue.ts` mirrors the existing `config/redis.ts` pattern (singleton factory, lazy init, null-safe). `workers/` is a new top-level dir under `src/` — same level as `services/`, `routes/`, etc. — because workers are processes, not services. Keeping the worker bootstrap in `workers/index.ts` (separate from the dispatch logic in `sync.worker.ts`) lets us add more workers later without touching dispatch code.

---

## Conventions you must follow

These come from `CLAUDE.md` and the project's auto-memory — read before starting:

- **Branch policy:** Commit and push to `main`. Do NOT create a feature branch. Every `git push` targets `origin main`. (Overrides the global "always feature branch" rule — Atlas-specific.)
- **No PR.** Do NOT run `gh pr create` at any point in this plan. Atlas convention is direct-to-main; PRs require explicit user permission.
- **Tests live in `packages/server/test/`** (NOT colocated `__tests__/`). Run with `npm test` from `packages/server`. Vitest config is at `packages/server/vitest.config.ts`; the global setup file is `packages/server/test/setup.ts` and it **already mocks `../src/config/database` and `../src/utils/logger` for every test**. Per-file `vi.mock(...)` calls override these globals, but be aware the defaults are always present — your tests inherit them unless you re-mock.
- **Test-driven:** every task that adds logic writes the failing vitest first, sees it fail, then implements.
- **Logger:** import from `../utils/logger` and use `logger.info({ ... }, 'message')` — pino style, structured fields first arg.
- **Env var loading:** add to `packages/server/src/config/env.ts` Zod schema. The `env` export is the single source of truth; never read `process.env` directly elsewhere.
- **Don't break dev without Redis:** Atlas runs without Redis today (it's optional). Phase 1 must keep that true. If `REDIS_URL` is unset: worker doesn't start, queue factory returns null, start-sync endpoint returns a clean 503-style error.
- **No Gmail code in this phase.** If you find yourself writing `google.gmail(...)`, stop — that's Phase 2.
- **`docker compose` runs from the repo root** (`/Users/gorkemcetin/atlasmail`), not from `packages/server/`. The compose file there defines `postgres` and `redis` services for dev.

---

## Task 1: Delete stale compiled worker artifacts

**Why:** `packages/server/dist/workers/sync.worker.js` exists with no `.ts` source — leftover from a deleted skeleton. It confuses anyone grepping for "worker" and will collide with the real file we're about to create. Delete now.

**Files:**
- Delete: `packages/server/dist/workers/index.{js,js.map,d.ts,d.ts.map}`
- Delete: `packages/server/dist/workers/sync.worker.{js,js.map,d.ts,d.ts.map}`

- [ ] **Step 1: Delete the stale dist artifacts**

```bash
rm -f packages/server/dist/workers/index.js packages/server/dist/workers/index.js.map packages/server/dist/workers/index.d.ts packages/server/dist/workers/index.d.ts.map
rm -f packages/server/dist/workers/sync.worker.js packages/server/dist/workers/sync.worker.js.map packages/server/dist/workers/sync.worker.d.ts packages/server/dist/workers/sync.worker.d.ts.map
rmdir packages/server/dist/workers 2>/dev/null || true
```

- [ ] **Step 2: Verify no references to the stale path remain**

```bash
grep -rn "dist/workers" packages/server/src/ packages/server/package.json packages/server/tsconfig.json 2>/dev/null
```

Expected: no output (no source file references that path).

- [ ] **Step 3: No commit needed**

`dist/` is gitignored in this repo (verified: `.gitignore` includes `dist/`). Nothing to stage or commit. Proceed directly to Task 2.

---

## Task 2: Add `WORKER_MODE` env var

**Why:** Single switch that lets us run api-only, worker-only, or both in one process. Default `both` preserves current behavior. Future deploys can split into two containers without touching code.

**Files:**
- Modify: `packages/server/src/config/env.ts` (add `WORKER_MODE` to schema)
- Modify: `.env.example` at the repo root (document it)
- Test: `packages/server/test/env.test.ts` (create if absent — verify default)

- [ ] **Step 1: Read the env file to find the right insertion point**

```bash
grep -n "REDIS_URL\|NODE_ENV\|z.enum\|export const env" packages/server/src/config/env.ts
```

Look at the existing schema shape and pick a sensible spot (next to `NODE_ENV` or near the top of the schema).

- [ ] **Step 2: Write the failing test**

Create `packages/server/test/env.test.ts`:

```typescript
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

describe('env: WORKER_MODE', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset module cache so env.ts re-evaluates with mutated process.env
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('defaults to "both" when WORKER_MODE is unset', async () => {
    delete process.env.WORKER_MODE;
    const { env } = await import('../src/config/env');
    expect(env.WORKER_MODE).toBe('both');
  });

  it('accepts "api"', async () => {
    process.env.WORKER_MODE = 'api';
    const { env } = await import('../src/config/env');
    expect(env.WORKER_MODE).toBe('api');
  });

  it('accepts "worker"', async () => {
    process.env.WORKER_MODE = 'worker';
    const { env } = await import('../src/config/env');
    expect(env.WORKER_MODE).toBe('worker');
  });

  it('rejects an unknown value', async () => {
    process.env.WORKER_MODE = 'banana';
    await expect(import('../src/config/env')).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run the test, expect failure**

From `packages/server/`:

```bash
npm test -- env.test
```

Expected: all four tests fail because `env.WORKER_MODE` is undefined / not in the schema.

- [ ] **Step 4: Add the field to the env schema**

In `packages/server/src/config/env.ts`, add inside the Zod schema (next to other enum-style fields):

```typescript
WORKER_MODE: z.enum(['api', 'worker', 'both']).default('both'),
```

- [ ] **Step 5: Document in `.env.example`**

Append to `.env.example` at the repo root (this repo only has one `.env.example`, at `/Users/gorkemcetin/atlasmail/.env.example`):

```
# Sync worker mode. Default "both" runs API + sync worker in one process.
# Set to "api" to disable the worker (e.g. when running a separate worker container),
# or "worker" to run only the worker (no Express listener — not used in Phase 1).
# WORKER_MODE=both
```

- [ ] **Step 6: Re-run the test, expect pass**

```bash
npm test -- env.test
```

Expected: all four pass.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/config/env.ts .env.example packages/server/test/env.test.ts
git commit -m "feat(server): add WORKER_MODE env var"
```

---

## Task 3: Build the queue factory

**Why:** A single place that owns the BullMQ Queue, the connection it uses, the queue name constant, and the typed job-data shapes. Mirrors the `config/redis.ts` pattern (lazy singleton, null-safe when Redis is absent).

**Files:**
- Create: `packages/server/src/config/queue.ts`
- Test: `packages/server/test/queue.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/queue.test.ts`:

```typescript
import { describe, it, expect, afterEach, vi } from 'vitest';

describe('config/queue', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('exports the SYNC_QUEUE_NAME constant', async () => {
    const mod = await import('../src/config/queue');
    expect(mod.SYNC_QUEUE_NAME).toBe('atlas-sync');
  });

  it('exports SyncJobName values for both calendar jobs', async () => {
    const mod = await import('../src/config/queue');
    expect(mod.SyncJobName.CalendarFullSync).toBe('calendar-full-sync');
    expect(mod.SyncJobName.CalendarIncrementalSync).toBe('calendar-incremental-sync');
  });

  it('getSyncQueue() returns null when REDIS_URL is unset', async () => {
    const original = process.env.REDIS_URL;
    delete process.env.REDIS_URL;
    vi.resetModules();
    const mod = await import('../src/config/queue');
    expect(mod.getSyncQueue()).toBeNull();
    if (original !== undefined) process.env.REDIS_URL = original;
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

```bash
npm test -- queue.test
```

Expected: all three fail with module-not-found.

- [ ] **Step 3: Implement the queue factory**

Create `packages/server/src/config/queue.ts`:

```typescript
import { Queue } from 'bullmq';
import { getRedisClient } from './redis';
import { logger } from '../utils/logger';

export const SYNC_QUEUE_NAME = 'atlas-sync';

export const SyncJobName = {
  CalendarFullSync: 'calendar-full-sync',
  CalendarIncrementalSync: 'calendar-incremental-sync',
} as const;
export type SyncJobName = (typeof SyncJobName)[keyof typeof SyncJobName];

export interface CalendarFullSyncJobData {
  accountId: string;
  triggeredBy: 'user' | 'system';
  userId?: string;
}

export interface CalendarIncrementalSyncJobData {
  accountId: string;
}

export type SyncJobData =
  | { name: typeof SyncJobName.CalendarFullSync; data: CalendarFullSyncJobData }
  | { name: typeof SyncJobName.CalendarIncrementalSync; data: CalendarIncrementalSyncJobData };

let syncQueue: Queue | null = null;

export function getSyncQueue(): Queue | null {
  if (syncQueue) return syncQueue;
  const connection = getRedisClient();
  if (!connection) return null;

  try {
    syncQueue = new Queue(SYNC_QUEUE_NAME, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    });
    logger.info({ queue: SYNC_QUEUE_NAME }, 'Sync queue initialized');
    return syncQueue;
  } catch (err) {
    logger.warn({ err }, 'Failed to initialize sync queue');
    return null;
  }
}

export async function closeSyncQueue() {
  if (syncQueue) {
    await syncQueue.close();
    syncQueue = null;
  }
}
```

- [ ] **Step 4: Run the test, expect pass**

```bash
npm test -- queue.test
```

Expected: all three pass.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/config/queue.ts packages/server/test/queue.test.ts
git commit -m "feat(server): add BullMQ sync queue factory"
```

---

## Task 4: Build the sync worker dispatch

**Why:** A single Worker process that consumes the `atlas-sync` queue and dispatches each job name to the right service function. Calendar logic already lives in `services/calendar-sync.service.ts` — the worker just calls it. Designed so adding `gmail-full-sync` later is a one-case addition.

**Files:**
- Create: `packages/server/src/workers/sync.worker.ts`
- Test: `packages/server/test/sync-worker.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/sync-worker.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/services/calendar-sync.service', () => ({
  performCalendarFullSync: vi.fn(async () => undefined),
  performCalendarIncrementalSync: vi.fn(async () => undefined),
}));

import { processSyncJob } from '../src/workers/sync.worker';
import * as calendarSync from '../src/services/calendar-sync.service';

describe('sync.worker: processSyncJob', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dispatches calendar-full-sync to performCalendarFullSync', async () => {
    await processSyncJob({
      name: 'calendar-full-sync',
      data: { accountId: 'acc-1', triggeredBy: 'user', userId: 'u-1' },
    } as any);
    expect(calendarSync.performCalendarFullSync).toHaveBeenCalledWith('acc-1');
    expect(calendarSync.performCalendarIncrementalSync).not.toHaveBeenCalled();
  });

  it('dispatches calendar-incremental-sync to performCalendarIncrementalSync', async () => {
    await processSyncJob({
      name: 'calendar-incremental-sync',
      data: { accountId: 'acc-2' },
    } as any);
    expect(calendarSync.performCalendarIncrementalSync).toHaveBeenCalledWith('acc-2');
    expect(calendarSync.performCalendarFullSync).not.toHaveBeenCalled();
  });

  it('throws on unknown job name', async () => {
    await expect(
      processSyncJob({ name: 'totally-fake-job', data: {} } as any),
    ).rejects.toThrow(/unknown sync job/i);
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

```bash
npm test -- sync-worker.test
```

Expected: all three fail with module-not-found.

- [ ] **Step 3: Implement the worker**

Create `packages/server/src/workers/sync.worker.ts`:

```typescript
import { Worker, type Job } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { SYNC_QUEUE_NAME, SyncJobName } from '../config/queue';
import {
  performCalendarFullSync,
  performCalendarIncrementalSync,
} from '../services/calendar-sync.service';
import { logger } from '../utils/logger';

export async function processSyncJob(job: Job): Promise<void> {
  switch (job.name) {
    case SyncJobName.CalendarFullSync: {
      const { accountId } = job.data as { accountId: string };
      logger.info({ jobId: job.id, accountId }, 'Running calendar full sync');
      await performCalendarFullSync(accountId);
      return;
    }
    case SyncJobName.CalendarIncrementalSync: {
      const { accountId } = job.data as { accountId: string };
      logger.info({ jobId: job.id, accountId }, 'Running calendar incremental sync');
      await performCalendarIncrementalSync(accountId);
      return;
    }
    default:
      throw new Error(`Unknown sync job: ${job.name}`);
  }
}

let worker: Worker | null = null;

export function startWorker(): Worker | null {
  if (worker) return worker;
  const connection = getRedisClient();
  if (!connection) {
    logger.warn('Sync worker not started: REDIS_URL is not set');
    return null;
  }

  worker = new Worker(SYNC_QUEUE_NAME, processSyncJob, {
    connection,
    concurrency: 2,
  });

  worker.on('completed', (job) => {
    logger.info({ jobId: job.id, name: job.name }, 'Sync job completed');
  });
  worker.on('failed', (job, err) => {
    logger.error(
      { jobId: job?.id, name: job?.name, err, attemptsMade: job?.attemptsMade },
      'Sync job failed',
    );
  });

  logger.info({ queue: SYNC_QUEUE_NAME, concurrency: 2 }, 'Sync worker started');
  return worker;
}

export async function stopWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
}
```

- [ ] **Step 4: Run the test, expect pass**

```bash
npm test -- sync-worker.test
```

Expected: all three pass.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/workers/sync.worker.ts packages/server/test/sync-worker.test.ts
git commit -m "feat(server): add sync worker dispatching calendar jobs"
```

---

## Task 5: Worker lifecycle + repeatable scheduler

**Why:** The worker needs to be started at server boot and stopped at SIGTERM. Also, we want incremental calendar sync to run every 5 min for any account with `provider='google'` — that's one repeatable BullMQ job per account, scheduled idempotently at startup.

**Files:**
- Create: `packages/server/src/workers/index.ts`
- Test: existing `sync-worker.test.ts` extended (or a new `workers-index.test.ts` if you prefer — same structure)

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/workers-index.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const addMock = vi.fn(async () => ({}));
const upsertJobSchedulerMock = vi.fn(async () => ({}));

vi.mock('../src/config/queue', async () => {
  const actual = await vi.importActual<typeof import('../src/config/queue')>(
    '../src/config/queue',
  );
  return {
    ...actual,
    getSyncQueue: () => ({
      add: addMock,
      upsertJobScheduler: upsertJobSchedulerMock,
      close: vi.fn(async () => undefined),
    }),
  };
});

vi.mock('../src/config/database', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([{ id: 'acc-1' }, { id: 'acc-2' }]),
      }),
    }),
  },
}));

import { scheduleIncrementalSyncForAllAccounts } from '../src/workers/index';

describe('workers/index: scheduleIncrementalSyncForAllAccounts', () => {
  beforeEach(() => {
    addMock.mockClear();
    upsertJobSchedulerMock.mockClear();
  });

  it('upserts one repeatable job per Google-connected account', async () => {
    await scheduleIncrementalSyncForAllAccounts();
    expect(upsertJobSchedulerMock).toHaveBeenCalledTimes(2);
    expect(upsertJobSchedulerMock).toHaveBeenCalledWith(
      'calendar-incremental-acc-1',
      expect.objectContaining({ every: 5 * 60 * 1000 }),
      expect.objectContaining({
        name: 'calendar-incremental-sync',
        data: { accountId: 'acc-1' },
      }),
    );
  });

  it('is a no-op when the queue is unavailable', async () => {
    vi.doMock('../src/config/queue', async () => {
      const actual = await vi.importActual<typeof import('../src/config/queue')>(
        '../src/config/queue',
      );
      return { ...actual, getSyncQueue: () => null };
    });
    vi.resetModules();
    const { scheduleIncrementalSyncForAllAccounts: fn } = await import(
      '../src/workers/index'
    );
    await expect(fn()).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

```bash
npm test -- workers-index.test
```

Expected: fails with module-not-found.

- [ ] **Step 3: Implement the lifecycle module**

Create `packages/server/src/workers/index.ts`:

```typescript
import { eq } from 'drizzle-orm';
import { db } from '../config/database';
import { accounts } from '../db/schema';
import { getSyncQueue, closeSyncQueue, SyncJobName } from '../config/queue';
import { startWorker, stopWorker } from './sync.worker';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const INCREMENTAL_INTERVAL_MS = 5 * 60 * 1000;

export function startSyncWorker(): void {
  if (env.WORKER_MODE === 'api') {
    logger.info('WORKER_MODE=api — sync worker disabled');
    return;
  }
  startWorker();
}

export async function stopSyncWorker(): Promise<void> {
  await stopWorker();
  await closeSyncQueue();
}

/**
 * Idempotently schedule a repeatable incremental-sync job for every
 * Google-connected account. Safe to call on every boot — BullMQ's
 * upsertJobScheduler de-dupes by id.
 */
export async function scheduleIncrementalSyncForAllAccounts(): Promise<void> {
  const queue = getSyncQueue();
  if (!queue) return;

  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.provider, 'google'));

  for (const row of rows) {
    await queue.upsertJobScheduler(
      `calendar-incremental-${row.id}`,
      { every: INCREMENTAL_INTERVAL_MS },
      {
        name: SyncJobName.CalendarIncrementalSync,
        data: { accountId: row.id },
      },
    );
  }
  logger.info(
    { count: rows.length, intervalMs: INCREMENTAL_INTERVAL_MS },
    'Scheduled incremental calendar sync',
  );
}
```

- [ ] **Step 4: Run the test, expect pass**

```bash
npm test -- workers-index.test
```

Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/workers/index.ts packages/server/test/workers-index.test.ts
git commit -m "feat(server): worker lifecycle + repeatable incremental sync scheduler"
```

---

## Task 6: Wire worker into the server bootstrap

**Why:** The worker now exists but nothing starts it. Add to `index.ts` alongside the other schedulers. Gate on `WORKER_MODE`.

**Files:**
- Modify: `packages/server/src/index.ts`

- [ ] **Step 1: Read the current bootstrap**

Already read above. The pattern: each scheduler is started inside the `app.listen` callback after `bootstrapDatabase`, and stopped in `handleShutdown`.

- [ ] **Step 2: Add imports**

At the top of `packages/server/src/index.ts`, alongside the other scheduler imports:

```typescript
import { startSyncWorker, stopSyncWorker, scheduleIncrementalSyncForAllAccounts } from './workers';
```

- [ ] **Step 3: Start the worker after bootstrap**

Inside `app.listen(...)`, after the existing `startInvoiceReminderScheduler();` line, add:

```typescript
  // Sync worker: BullMQ consumer for calendar (Phase 1) and Gmail (Phase 2+) jobs.
  startSyncWorker();
  scheduleIncrementalSyncForAllAccounts().catch((err) =>
    logger.error({ err }, 'Failed to schedule incremental sync jobs'),
  );
```

- [ ] **Step 4: Stop the worker on shutdown**

Inside `handleShutdown`, before the `closeRedis()` call, add:

```typescript
  stopSyncWorker().catch((err) => logger.warn({ err }, 'Error stopping sync worker'));
```

- [ ] **Step 5: Typecheck**

From `packages/server/`:

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Smoke-boot the dev server (with Redis available)**

From the repo root (`/Users/gorkemcetin/atlasmail`): `docker compose up -d` — starts the dev `postgres` and `redis` services from the root `docker-compose.yml`.

In another terminal, from `packages/server/`: `npm run dev`

(The user has a `/run-atlas` skill that does both — feel free to use it instead.)

Expected logs (in order, after the existing scheduler logs):
- `Sync queue initialized`
- `Sync worker started`
- `Scheduled incremental calendar sync` with `count: 0` (if no Google-connected accounts in your dev DB) or `count: N`

Then Ctrl-C and confirm clean shutdown logs (no unhandled rejections from worker — you should see `Sync worker started` followed by a clean exit, no orphan promises).

- [ ] **Step 7: Smoke-boot WITHOUT Redis**

From the repo root: `docker compose stop redis` (leave postgres up).
Also temporarily unset `REDIS_URL`: in the shell where you'll run `npm run dev`, do `unset REDIS_URL` (the env var loader reads from `.env` at the repo root, so if `.env` defines `REDIS_URL`, you'll need to comment that line out for this test).
Restart `npm run dev` from `packages/server/`.

Expected: server boots normally; logs include `Sync worker not started: REDIS_URL is not set` and no crashes.

Restore when done: `docker compose start redis` from repo root, and re-add `REDIS_URL` to `.env` if you commented it out.

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "feat(server): start sync worker + schedule repeatable jobs on boot"
```

---

## Task 7: Replace stub `startGoogleSync` with real enqueue + expose `queueDepth`

**Why:** This is the user-visible payoff. `POST /crm/google/sync/start` currently returns `{ message: 'Calendar sync is handled automatically' }` — a lie. Make it enqueue a real `calendar-full-sync` job, looking up the user's `accountId` from the `accounts` table. Also extend `getGoogleSyncStatus` to include `queueDepth` so the UI can show pending work.

**Files:**
- Modify: `packages/server/src/apps/crm/controllers/dashboard.controller.ts:103` (and `:73`)
- Test: `packages/server/test/crm-google-sync-controller.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/server/test/crm-google-sync-controller.test.ts`. Two important points before you read the code:

1. The global `test/setup.ts` already mocks `../src/config/database` and `../src/utils/logger` for every test. We override `../src/config/database` here with a richer chain that returns a Google-connected account.
2. We use a `getSyncQueueMock` variable that each test reassigns — instead of `vi.doMock` + `vi.resetModules` (which pollutes other tests in the same file). The factory closure reads `getSyncQueueMock` at call time, so changing it changes the controller's view of the queue.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const addMock = vi.fn(async () => ({ id: 'job-1' }));
const getJobCountsMock = vi.fn(async () => ({ waiting: 2, active: 1, delayed: 0, failed: 0 }));

let getSyncQueueMock: () => any = () => ({ add: addMock, getJobCounts: getJobCountsMock });

vi.mock('../src/config/queue', () => ({
  // Closure reads the let-binding at call time so individual tests can swap behavior.
  getSyncQueue: () => getSyncQueueMock(),
  SyncJobName: { CalendarFullSync: 'calendar-full-sync', CalendarIncrementalSync: 'calendar-incremental-sync' },
  SYNC_QUEUE_NAME: 'atlas-sync',
}));

vi.mock('../src/config/database', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{
            id: 'acc-1',
            provider: 'google',
            syncStatus: 'idle',
            syncError: null,
            lastSync: null,
            lastFullSync: null,
          }]),
        }),
      }),
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  },
}));

vi.mock('../src/services/google-auth', () => ({ isGoogleConfigured: () => true }));
vi.mock('../src/config/redis', () => ({ getRedisClient: () => ({}) }));

import { startGoogleSync, getGoogleSyncStatus } from '../src/apps/crm/controllers/dashboard.controller';

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

const fakeReq = { auth: { userId: 'u-1', tenantId: 't-1' } } as unknown as Request;

describe('CRM startGoogleSync controller', () => {
  beforeEach(() => {
    addMock.mockClear();
    getJobCountsMock.mockClear();
    // Reset to the happy-path queue for each test
    getSyncQueueMock = () => ({ add: addMock, getJobCounts: getJobCountsMock });
  });

  it('enqueues a calendar-full-sync job with the user\'s accountId', async () => {
    const res = mockRes();

    await startGoogleSync(fakeReq, res);

    expect(addMock).toHaveBeenCalledWith(
      'calendar-full-sync',
      { accountId: 'acc-1', triggeredBy: 'user', userId: 'u-1' },
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { jobId: 'job-1', queued: true },
    });
  });

  it('returns 503 when queue is unavailable', async () => {
    getSyncQueueMock = () => null;
    const res = mockRes();

    await startGoogleSync(fakeReq, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringMatching(/redis/i) }),
    );
    expect(addMock).not.toHaveBeenCalled();
  });
});

describe('CRM getGoogleSyncStatus controller', () => {
  beforeEach(() => {
    getJobCountsMock.mockClear();
    getSyncQueueMock = () => ({ add: addMock, getJobCounts: getJobCountsMock });
  });

  it('includes queueDepth from getJobCounts', async () => {
    const res = mockRes();

    await getGoogleSyncStatus(fakeReq, res);

    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.queueDepth).toEqual({ waiting: 2, active: 1, delayed: 0, failed: 0 });
  });

  it('returns null queueDepth when queue is unavailable', async () => {
    getSyncQueueMock = () => null;
    const res = mockRes();

    await getGoogleSyncStatus(fakeReq, res);

    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.data.queueDepth).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

```bash
npm test -- crm-google-sync-controller
```

Expected: failures — `addMock` never called, `queueDepth` undefined.

- [ ] **Step 3: Replace `startGoogleSync` and extend `getGoogleSyncStatus`**

Edit `packages/server/src/apps/crm/controllers/dashboard.controller.ts`. Add to the imports at the top:

```typescript
import { getSyncQueue, SyncJobName } from '../../../config/queue';
```

Replace the entire `startGoogleSync` function (currently lines 103–110) with:

```typescript
export async function startGoogleSync(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;

    const queue = getSyncQueue();
    if (!queue) {
      res.status(503).json({
        success: false,
        error: 'Sync queue unavailable — Redis is not configured',
      });
      return;
    }

    const [account] = await db
      .select({ id: accounts.id, provider: accounts.provider })
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .limit(1);

    if (!account || account.provider !== 'google') {
      res.status(400).json({ success: false, error: 'No connected Google account' });
      return;
    }

    const job = await queue.add(SyncJobName.CalendarFullSync, {
      accountId: account.id,
      triggeredBy: 'user',
      userId,
    });

    await db
      .update(accounts)
      .set({ syncStatus: 'pending', syncError: null, updatedAt: new Date() })
      .where(eq(accounts.id, account.id));

    res.json({ success: true, data: { jobId: job.id, queued: true } });
  } catch (error) {
    logger.error({ error }, 'Failed to start Google sync');
    res.status(500).json({ success: false, error: 'Failed to start sync' });
  }
}
```

In `getGoogleSyncStatus` (currently lines 73–101), extend the response payload. Find:

```typescript
        redisAvailable: !!getRedisClient(),
      },
    });
```

Replace with:

```typescript
        redisAvailable: !!getRedisClient(),
        queueDepth: await (async () => {
          const q = getSyncQueue();
          if (!q) return null;
          try {
            return await q.getJobCounts('waiting', 'active', 'delayed', 'failed');
          } catch {
            return null;
          }
        })(),
      },
    });
```

- [ ] **Step 4: Run the test, expect pass**

```bash
npm test -- crm-google-sync-controller
```

Expected: all pass.

- [ ] **Step 5: Run the full server test suite to catch regressions**

```bash
cd packages/server && npm test
```

Expected: every existing test still passes. If `crm-service.test.ts` or another test mocks the controller, fix the mock to include the new `queueDepth` field.

- [ ] **Step 6: Manual end-to-end smoke (optional but strongly encouraged)**

With `docker compose up -d` running and a dev account that has `provider='google'` (one in your dev DB, or fake one with a SQL update on `accounts`):

1. From `packages/server/`: `npm run dev`
2. Get a JWT for that user (login via the client at :5180, copy `atlasmail_token` from localStorage).
3. `curl -H "Authorization: Bearer <token>" -X POST http://localhost:3001/api/v1/crm/google/sync/start`
4. Expect `{ "success": true, "data": { "jobId": "...", "queued": true } }`.
5. Server logs show `Running calendar full sync` followed by `Sync job completed`.
6. `curl -H "Authorization: Bearer <token>" http://localhost:3001/api/v1/crm/google/status` — confirm `queueDepth` field is present.

If the user has no real Google tokens, the calendar service will throw inside the worker and you'll see a `Sync job failed` log with `attemptsMade`. That's expected — the queue rails are working; Phase 2 is where we fix mid-call 401 handling.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/apps/crm/controllers/dashboard.controller.ts packages/server/test/crm-google-sync-controller.test.ts
git commit -m "feat(crm): enqueue real calendar-full-sync job on /google/sync/start"
```

---

## Task 8: Final verification & push

- [ ] **Step 1: Run full server test suite**

```bash
cd packages/server && npm test
```

Expected: all green. Note any pre-existing failures unrelated to this work (and if found, leave a comment in the commit message — do not fix unrelated tests in this branch).

- [ ] **Step 2: Typecheck the server package**

```bash
cd packages/server && npm run typecheck
```

Expected: no errors. (Client and shared aren't touched by this phase; if you want extra safety, run their typechecks too, but they're not required gates for Phase 1.)

- [ ] **Step 3: Lint**

```bash
cd packages/server && npm run lint
```

Expected: no new errors introduced. Pre-existing warnings in unrelated files are fine — don't fix them in this branch.

- [ ] **Step 4: Run server build to confirm it compiles**

```bash
cd packages/server && npm run build
```

Expected: clean build. Confirm `dist/workers/sync.worker.js` and `dist/workers/index.js` are now regenerated from real source (not the ghost artifacts deleted in Task 1):

```bash
ls -la packages/server/dist/workers/
```

You should see `index.js`, `sync.worker.js` (and their `.d.ts` / `.map` siblings) all with timestamps from this build run.

- [ ] **Step 5: Push to main**

Per Atlas convention (`MEMORY.md` line "always commit and push to `main` directly"), push to main without opening a PR. **Do NOT run `gh pr create` at any point** — the user must explicitly authorize PR creation, and they have not.

If you are running this plan via the Claude Code tool harness, push using the Bash tool with `run_in_background: true` (a tool flag, not a shell flag — do NOT append `&` to the command). If you are a human running this manually, just:

```bash
git push origin main
```

- [ ] **Step 6: Report back**

Summarize for the user:
- Tasks 1–7 completed
- New endpoint behavior: `POST /crm/google/sync/start` now enqueues a real `calendar-full-sync` BullMQ job; `GET /crm/google/status` now includes `queueDepth`
- Repeatable `calendar-incremental-sync` job runs every 5 min per Google-connected account
- Behavior unchanged when `REDIS_URL` is unset (worker doesn't start, start endpoint returns 503)
- No Gmail code added — Phase 2 territory
- Suggest the user manually test by clicking the existing "Sync now" UI (if any) or via curl, with a real Google-connected account

---

## Acceptance criteria

This phase is done when:

- [ ] `npm test` in `packages/server` is green
- [ ] `npm run typecheck` in `packages/server` is clean
- [ ] `npm run build` in `packages/server` is clean and produces `dist/workers/sync.worker.js` from real source
- [ ] Booting `npm run dev` with Redis available logs `Sync worker started`
- [ ] Booting `npm run dev` without Redis logs the no-Redis warning and does NOT crash
- [ ] `POST /crm/google/sync/start` for a Google-connected user returns `{ success: true, data: { jobId, queued: true } }` and a `Running calendar full sync` log appears
- [ ] `GET /crm/google/status` includes a `queueDepth` field with `{ waiting, active, delayed, failed }` counts
- [ ] No Gmail-related code, scopes, schema, or routes were added in this phase
- [ ] No new top-level dependency was added (BullMQ + ioredis were already in `package.json`)
- [ ] All commits target `main`; no feature branch created

---

## What this unblocks for Phase 2

With the rails in place, Phase 2 becomes purely additive:

1. Add `gmail_messages` + `gmail_threads` tables, plus `crm_activities.external_id` / `crm_activities.gmail_message_id` columns
2. Write `services/gmail-sync.service.ts` mirroring `calendar-sync.service.ts` (full + incremental via `users.history.list`)
3. Add `SyncJobName.GmailFullSync` / `SyncJobName.GmailIncrementalSync` to `config/queue.ts`
4. Add cases for those jobs in `workers/sync.worker.ts:processSyncJob` — single-line additions
5. Wire `startGoogleSync` (or a sibling endpoint) to enqueue Gmail jobs
6. Schedule a repeatable Gmail incremental job in `workers/index.ts` next to the calendar one

No infrastructure changes — same queue, same worker, same single container.
