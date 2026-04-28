import { and, eq } from 'drizzle-orm';
import { db } from '../config/database';
import { accounts, messageChannels } from '../db/schema';
import {
  getSyncQueue,
  closeSyncQueue,
  SyncJobName,
  type CalendarIncrementalSyncJobData,
  type GmailIncrementalSyncJobData,
} from '../config/queue';
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

  const results = await Promise.allSettled(
    rows.map((row) =>
      queue.upsertJobScheduler(
        `calendar-incremental-${row.id}`,
        { every: INCREMENTAL_INTERVAL_MS },
        {
          name: SyncJobName.CalendarIncrementalSync,
          data: { accountId: row.id } satisfies CalendarIncrementalSyncJobData,
        },
      ),
    ),
  );

  const failures = results
    .map((r, i) => (r.status === 'rejected' ? { accountId: rows[i].id, reason: r.reason } : null))
    .filter((x): x is { accountId: string; reason: unknown } => x !== null);

  for (const f of failures) {
    logger.error({ accountId: f.accountId, err: f.reason }, 'Failed to schedule incremental sync for account');
  }

  logger.info(
    {
      total: rows.length,
      scheduled: rows.length - failures.length,
      failed: failures.length,
      intervalMs: INCREMENTAL_INTERVAL_MS,
    },
    'Scheduled incremental calendar sync',
  );
}

/**
 * Idempotently schedule a repeatable Gmail incremental-sync job for every
 * channel where sync is enabled. Mirrors the calendar scheduler.
 *
 * TODO (Phase 2c/2d): orphan reconcile. When a channel is deleted or
 * `isSyncEnabled` flips to false, the BullMQ scheduler key persists in
 * Redis and keeps firing every 5 min — `performGmailIncrementalSync`
 * returns early on `!isSyncEnabled` or throws "channel not found", but
 * a worker slot is still consumed. Add a reconcile pass here that calls
 * `queue.getJobSchedulers()` to enumerate existing `gmail-incremental-*`
 * keys and `queue.removeJobScheduler(key)` for any whose channel is
 * gone or disabled. Out of scope for 2b — orphans only matter once
 * channels start being toggled at non-trivial volume.
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
