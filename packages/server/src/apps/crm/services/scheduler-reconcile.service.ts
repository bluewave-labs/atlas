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
