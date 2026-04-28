import { Worker, type Job } from 'bullmq';
import { getRedisClient } from '../config/redis';
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
import { logger } from '../utils/logger';

export async function processSyncJob(job: Job): Promise<void> {
  switch (job.name) {
    case SyncJobName.CalendarFullSync: {
      const { accountId } = job.data as CalendarFullSyncJobData;
      logger.info({ jobId: job.id, accountId }, 'Running calendar full sync');
      await performCalendarFullSync(accountId);
      return;
    }
    case SyncJobName.CalendarIncrementalSync: {
      const { accountId } = job.data as CalendarIncrementalSyncJobData;
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
  if (!worker) return;
  const w = worker;
  worker = null; // clear first so a later startWorker() can rebuild even if close() throws
  await w.close();
}
