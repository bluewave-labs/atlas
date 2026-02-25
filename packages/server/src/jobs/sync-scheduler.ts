import { eq, and, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { accounts } from '../db/schema';
import { addIncrementalSyncJob } from './sync-worker';
import { logger } from '../utils/logger';

const SYNC_INTERVAL_MS = 60_000; // 60 seconds
const STAGGER_DELAY_MS = 2_000; // 2 seconds between accounts
const ERROR_RETRY_COOLDOWN_MS = 5 * 60_000; // 5 minutes before retrying errored accounts

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the periodic sync scheduler.
 *
 * Every SYNC_INTERVAL_MS, finds all accounts with syncStatus='idle' that have
 * completed at least one full sync (historyId is set), and enqueues incremental
 * sync jobs staggered to avoid overwhelming the Gmail API.
 */
export function startSyncScheduler() {
  if (schedulerTimer) {
    logger.warn('Sync scheduler already running, skipping duplicate start');
    return;
  }

  logger.info(
    { intervalMs: SYNC_INTERVAL_MS, staggerMs: STAGGER_DELAY_MS },
    'Starting sync scheduler',
  );

  schedulerTimer = setInterval(async () => {
    try {
      await scheduleIncrementalSyncs();
    } catch (err) {
      logger.error({ err }, 'Sync scheduler tick failed');
    }
  }, SYNC_INTERVAL_MS);

  // Run once immediately on startup (after a short delay for the worker to be ready)
  setTimeout(async () => {
    try {
      await scheduleIncrementalSyncs();
    } catch (err) {
      logger.error({ err }, 'Initial sync scheduler tick failed');
    }
  }, 5000);
}

export function stopSyncScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info('Sync scheduler stopped');
  }
}

async function scheduleIncrementalSyncs() {
  // Find all accounts that:
  // 1. Have syncStatus = 'idle' (not currently syncing)
  // 2. Have a historyId (have completed at least one full sync)
  const idleAccounts = await db
    .select({ id: accounts.id, email: accounts.email })
    .from(accounts)
    .where(
      and(
        eq(accounts.syncStatus, 'idle'),
        isNotNull(accounts.historyId),
      ),
    );

  // Also recover accounts stuck in 'error' state (transient failures) after
  // a cooldown period.  'auth_error' accounts are NOT retried — they need
  // the user to re-authenticate.
  const cooldownThreshold = new Date(Date.now() - ERROR_RETRY_COOLDOWN_MS).toISOString();
  const erroredAccounts = await db
    .select({ id: accounts.id, email: accounts.email })
    .from(accounts)
    .where(
      and(
        eq(accounts.syncStatus, 'error'),
        isNotNull(accounts.historyId),
        lte(accounts.updatedAt, cooldownThreshold),
      ),
    );

  if (erroredAccounts.length > 0) {
    logger.info(
      { count: erroredAccounts.length },
      'Resetting errored accounts for retry',
    );
    await db
      .update(accounts)
      .set({ syncStatus: 'idle', syncError: null, updatedAt: new Date().toISOString() })
      .where(
        inArray(accounts.id, erroredAccounts.map((a) => a.id)),
      );
  }

  const allAccounts = [...idleAccounts, ...erroredAccounts];

  if (allAccounts.length === 0) {
    return;
  }

  logger.debug(
    { accountCount: allAccounts.length },
    'Scheduling incremental syncs',
  );

  // Stagger job additions to spread API load across time
  for (let i = 0; i < allAccounts.length; i++) {
    const account = allAccounts[i];

    // Add a staggered delay so jobs don't all fire at the same instant
    if (i > 0) {
      await delay(STAGGER_DELAY_MS);
    }

    try {
      await addIncrementalSyncJob(account.id);
    } catch (err) {
      logger.warn(
        { err, accountId: account.id, email: account.email },
        'Failed to enqueue incremental sync job',
      );
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
