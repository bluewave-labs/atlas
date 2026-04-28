import { eq } from 'drizzle-orm';
import { db } from '../config/database';
import { accounts } from '../db/schema';
import {
  getSyncQueue,
  closeSyncQueue,
  SyncJobName,
  type CalendarIncrementalSyncJobData,
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
