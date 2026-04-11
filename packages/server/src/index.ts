import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { purgeOldArchivedDrawings } from './apps/draw/service';
import { runScheduledBackup } from './services/backup.service';
import { runMigrations } from './db/migrate';
import { closeDb } from './config/database';
import { startSyncWorker, stopSyncWorker } from './workers';
import { closeRedis } from './config/redis';
import { startReminderScheduler, stopReminderScheduler } from './apps/sign/reminder';
import { startTaskReminderScheduler, stopTaskReminderScheduler } from './apps/tasks/reminder';
import { startCrmReminderScheduler, stopCrmReminderScheduler } from './apps/crm/activity-reminder';
import { startLeaveBalanceScheduler, stopLeaveBalanceScheduler } from './apps/hr/services/leave-balance-scheduler';
import { startRecurringInvoiceScheduler, stopRecurringInvoiceScheduler } from './apps/invoices/recurring-scheduler';
import { startInvoiceReminderScheduler, stopInvoiceReminderScheduler } from './apps/invoices/reminder-scheduler';

const PURGE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
let purgeTimer: ReturnType<typeof setInterval> | null = null;
let backupTimer: ReturnType<typeof setInterval> | null = null;

const app = createApp();

app.listen(env.PORT, async () => {
  logger.info(`Atlas server running on port ${env.PORT} in ${env.NODE_ENV} mode`);

  // Run database migrations
  try {
    await runMigrations();
  } catch (err) {
    logger.error({ err }, 'Database migration failed');
    process.exit(1);
  }

  // Auto-purge archived drawings older than 30 days (runs every hour)
  purgeTimer = setInterval(async () => {
    try { await purgeOldArchivedDrawings(); } catch (err) {
      logger.error({ err }, 'Drawing auto-purge failed');
    }
  }, PURGE_INTERVAL_MS);
  setTimeout(() => purgeOldArchivedDrawings().catch(() => {}), 5000);

  // Automated database backups — daily
  backupTimer = setInterval(() => {
    runScheduledBackup().catch((err) => {
      logger.error({ err }, 'Scheduled backup failed');
    });
  }, BACKUP_INTERVAL_MS);
  setTimeout(() => runScheduledBackup().catch(() => {}), 30000);
  logger.info('Automated daily backups enabled');

  // Start Google sync worker (requires Redis)
  startSyncWorker().catch((err) => logger.warn({ err }, 'Failed to start sync worker'));

  // Sign: automated reminders for pending signing tokens — runs hourly
  startReminderScheduler();

  // Tasks: due-date reminders — runs hourly
  startTaskReminderScheduler();

  // CRM: activity reminders + deal close-date alerts — runs hourly
  startCrmReminderScheduler();

  // CRM: daily digest emails to CRM users
  const { startDigestScheduler } = await import('./apps/crm/digest');
  startDigestScheduler();

  // Leave balance allocation — runs daily, checks if current year balances exist
  startLeaveBalanceScheduler();

  // Invoices: recurring invoice generation — runs daily
  startRecurringInvoiceScheduler();

  // Invoices: overdue invoice reminders — runs hourly
  startInvoiceReminderScheduler();
});

// Graceful shutdown
function handleShutdown(signal: string) {
  logger.info({ signal }, 'Received shutdown signal, cleaning up');

  if (purgeTimer) { clearInterval(purgeTimer); purgeTimer = null; }
  if (backupTimer) { clearInterval(backupTimer); backupTimer = null; }
  stopLeaveBalanceScheduler();
  stopRecurringInvoiceScheduler();
  stopInvoiceReminderScheduler();
  stopReminderScheduler();
  stopTaskReminderScheduler();
  stopCrmReminderScheduler();

  stopSyncWorker()
    .catch((err) => logger.warn({ err }, 'Error stopping sync worker'));

  closeRedis()
    .catch((err) => logger.warn({ err }, 'Error closing Redis'));

  closeDb()
    .then(() => {
      logger.info('Cleanup complete');
      process.exit(0);
    })
    .catch((err) => {
      logger.error({ err }, 'Error during cleanup');
      process.exit(1);
    });

  setTimeout(() => {
    logger.error('Forced exit after shutdown timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
