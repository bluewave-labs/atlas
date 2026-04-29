import { Queue } from 'bullmq';
import { getRedisClient } from './redis';
import { logger } from '../utils/logger';

export const SYNC_QUEUE_NAME = 'atlas-sync';

export const SyncJobName = {
  CalendarFullSync: 'calendar-full-sync',
  CalendarIncrementalSync: 'calendar-incremental-sync',
  GmailFullSync: 'gmail-full-sync',
  GmailIncrementalSync: 'gmail-incremental-sync',
  GmailSend: 'gmail-send',
  GmailMessageCleaner: 'gmail-message-cleaner',
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

/**
 * Incremental gmail sync runs from the channel's syncCursor (Gmail
 * historyId). No `triggeredBy` field — incremental sync is always
 * scheduled by the system, never user-triggered (users trigger full
 * syncs via `GmailFullSync`).
 */
export interface GmailIncrementalSyncJobData {
  channelId: string;
}

/**
 * Outbound send job. The message row is already inserted with
 * `direction='outbound'`, `status='pending'` by the controller before this
 * job is enqueued — the worker just reads the row, builds the RFC 5322,
 * calls Gmail, and updates the row to `'sent'` or `'failed'`.
 */
export interface GmailSendJobData {
  messageId: string;
}

/** Daily cleaner walks all tenants — no per-job payload. */
export type GmailMessageCleanerJobData = Record<string, never>;

export type SyncJobData =
  | { name: typeof SyncJobName.CalendarFullSync; data: CalendarFullSyncJobData }
  | { name: typeof SyncJobName.CalendarIncrementalSync; data: CalendarIncrementalSyncJobData }
  | { name: typeof SyncJobName.GmailFullSync; data: GmailFullSyncJobData }
  | { name: typeof SyncJobName.GmailIncrementalSync; data: GmailIncrementalSyncJobData }
  | { name: typeof SyncJobName.GmailSend; data: GmailSendJobData }
  | { name: typeof SyncJobName.GmailMessageCleaner; data: GmailMessageCleanerJobData };

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
