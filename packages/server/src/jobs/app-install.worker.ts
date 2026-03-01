import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import type { InstallAppInput } from '@atlasmail/shared';

// ---------------------------------------------------------------------------
// Redis connection (lazy — reuses the same REDIS_URL as sync-worker)
// ---------------------------------------------------------------------------

let connection: IORedis | null = null;
let installQueue: Queue | null = null;
let backupQueue: Queue | null = null;

function getConnection(): IORedis | null {
  if (!env.REDIS_URL) return null;
  if (!connection) {
    connection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    connection.on('error', (err) => {
      logger.error({ err }, 'Redis connection error (app-install-worker)');
    });
  }
  return connection;
}

function getInstallQueue(): Queue | null {
  const conn = getConnection();
  if (!conn) return null;
  if (!installQueue) {
    installQueue = new Queue('app-install', {
      connection: conn,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { age: 86400, count: 500 },
        removeOnFail: { age: 604800 },
      },
    });
  }
  return installQueue;
}

function getBackupQueue(): Queue | null {
  const conn = getConnection();
  if (!conn) return null;
  if (!backupQueue) {
    backupQueue = new Queue('app-backup', {
      connection: conn,
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 30000 },
        removeOnComplete: { age: 86400, count: 200 },
        removeOnFail: { age: 604800 },
      },
    });
  }
  return backupQueue;
}

// ---------------------------------------------------------------------------
// Workers
// ---------------------------------------------------------------------------

let installWorker: Worker | null = null;
let healthWorker: Worker | null = null;
let backupWorker: Worker | null = null;

export function startAppInstallWorker() {
  const conn = getConnection();
  if (!conn) {
    logger.info('Redis not configured — app install worker disabled');
    return null;
  }

  if (installWorker) return installWorker;

  installWorker = new Worker(
    'app-install',
    async (job: Job) => {
      const { tenantId, input } = job.data as { tenantId: string; input: InstallAppInput };
      const log = logger.child({ jobId: job.id, tenantId, catalogAppId: input.catalogAppId });

      log.info('Processing app install job');

      const { installApp } = await import('../services/platform/install.service');
      await installApp(tenantId, input);

      log.info('App install job completed');
    },
    { connection: conn, concurrency: 2 },
  );

  installWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'App install job failed');
  });

  logger.info('App install worker started');
  return installWorker;
}

export function startAppHealthWorker() {
  const conn = getConnection();
  if (!conn) return null;
  if (healthWorker) return healthWorker;

  healthWorker = new Worker(
    'app-health',
    async (job: Job) => {
      const { installationId } = job.data;
      const { updateHealthStatus } = await import('../services/platform/install.service');
      await updateHealthStatus(installationId);
    },
    { connection: conn, concurrency: 5 },
  );

  healthWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'App health check failed');
  });

  logger.info('App health worker started');
  return healthWorker;
}

export function startAppBackupWorker() {
  const conn = getConnection();
  if (!conn) return null;
  if (backupWorker) return backupWorker;

  backupWorker = new Worker(
    'app-backup',
    async (job: Job) => {
      const { installationId, triggeredBy } = job.data;
      const log = logger.child({ jobId: job.id, installationId });

      log.info('Processing app backup job');

      const { createBackupRecord } = await import('../services/platform/install.service');
      await createBackupRecord(installationId, triggeredBy);

      // TODO: Execute backup command via K8s exec, upload to S3
      log.info('App backup job completed (record created — actual backup execution is post-MVP)');
    },
    { connection: conn, concurrency: 1 },
  );

  backupWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, 'App backup job failed');
  });

  logger.info('App backup worker started');
  return backupWorker;
}

// ---------------------------------------------------------------------------
// Job helpers
// ---------------------------------------------------------------------------

export async function addAppInstallJob(tenantId: string, input: InstallAppInput) {
  const queue = getInstallQueue();
  if (!queue) {
    // In development, run inline (no Redis needed). In production, Redis is required.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Redis is required for app installation in production');
    }
    logger.warn('Redis not configured — running install inline (dev mode)');
    const { installApp } = await import('../services/platform/install.service');
    await installApp(tenantId, input);
    return;
  }

  await queue.add('install', { tenantId, input }, {
    jobId: `install-${tenantId}-${input.catalogAppId}-${Date.now()}`,
  });
  logger.info({ tenantId, catalogAppId: input.catalogAppId }, 'App install job enqueued');
}

export async function addAppBackupJob(installationId: string, triggeredBy: string) {
  const queue = getBackupQueue();
  if (!queue) {
    logger.warn('Redis not configured — cannot enqueue backup job');
    return;
  }

  await queue.add('backup', { installationId, triggeredBy }, {
    jobId: `backup-${installationId}-${Date.now()}`,
  });
  logger.info({ installationId }, 'App backup job enqueued');
}

// ---------------------------------------------------------------------------
// Health check scheduler (produces jobs for the health worker)
// ---------------------------------------------------------------------------

let healthInterval: ReturnType<typeof setInterval> | null = null;

export function startHealthCheckScheduler() {
  const conn = getConnection();
  if (!conn) return;

  let healthQueue: Queue | null = null;
  if (!healthQueue) {
    healthQueue = new Queue('app-health', { connection: conn });
  }

  // Enqueue health checks for all running installations every 60 seconds
  healthInterval = setInterval(async () => {
    try {
      const { listRunningInstallationIds } = await import('../services/platform/install.service');
      const ids = await listRunningInstallationIds();
      for (const id of ids) {
        await healthQueue!.add('health', { installationId: id }, {
          jobId: `health-${id}-${Date.now()}`,
          removeOnComplete: true,
          removeOnFail: true,
        });
      }
    } catch (err) {
      logger.error({ err }, 'Failed to enqueue health check jobs');
    }
  }, 60_000);

  logger.info('Health check scheduler started (every 60s)');
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

export async function stopPlatformWorkers() {
  if (healthInterval) { clearInterval(healthInterval); healthInterval = null; }
  if (installWorker) { await installWorker.close(); installWorker = null; }
  if (healthWorker) { await healthWorker.close(); healthWorker = null; }
  if (backupWorker) { await backupWorker.close(); backupWorker = null; }
  installQueue = null;
  backupQueue = null;
  if (connection) { await connection.quit().catch(() => {}); connection = null; }
}
