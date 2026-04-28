import { Queue } from 'bullmq';
import { getRedisClient } from './redis';
import { logger } from '../utils/logger';

export const SYNC_QUEUE_NAME = 'atlas-sync';

export const SyncJobName = {
  CalendarFullSync: 'calendar-full-sync',
  CalendarIncrementalSync: 'calendar-incremental-sync',
} as const;
export type SyncJobName = (typeof SyncJobName)[keyof typeof SyncJobName];

/**
 * `userId` is set when `triggeredBy === 'user'` (manual sync via API) and
 * omitted when `triggeredBy === 'system'` (e.g. repeatable scheduled jobs).
 * The worker only consumes `accountId`; `userId` is for logging/audit.
 */
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

/**
 * Returns the singleton sync queue, or null if Redis is not configured.
 * The queue is built lazily on first call and caches the Redis connection
 * captured at that time. If `closeRedis()` is ever called, also call
 * `closeSyncQueue()` first — otherwise the next `getSyncQueue()` call will
 * return a queue bound to a closed connection.
 */
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

/**
 * Closes the singleton queue and clears the cached reference. Must be
 * called before `closeRedis()` during shutdown, or before any code path
 * that tears down the Redis connection.
 */
export async function closeSyncQueue() {
  if (syncQueue) {
    await syncQueue.close();
    syncQueue = null;
  }
}
