import { db } from '../../config/database';
import { crmActivities, crmDeals } from '../../db/schema';
import { eq, and, isNull, gte, lte } from 'drizzle-orm';
import { emitAppEvent, getTenantIdsForUsers } from '../../services/event.service';
import { logger } from '../../utils/logger';

// ─── Activity Reminders (hourly) ───────────────────────────────────

async function checkActivityReminders(): Promise<void> {
  const now = new Date();
  const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

  try {
    // Find activities scheduled within the next hour that are not completed
    const upcomingActivities = await db
      .select({
        id: crmActivities.id,
        type: crmActivities.type,
        body: crmActivities.body,
        userId: crmActivities.userId,
        scheduledAt: crmActivities.scheduledAt,
      })
      .from(crmActivities)
      .where(
        and(
          gte(crmActivities.scheduledAt, now),
          lte(crmActivities.scheduledAt, oneHourFromNow),
          isNull(crmActivities.completedAt),
          eq(crmActivities.isArchived, false),
        ),
      );

    if (upcomingActivities.length === 0) {
      logger.debug('No upcoming CRM activities need reminders');
      return;
    }

    logger.info({ count: upcomingActivities.length }, 'Found upcoming CRM activities for reminders');

    // Batch-resolve tenant IDs for all users (fix N+1)
    const uniqueUserIds = [...new Set(upcomingActivities.map((a) => a.userId))];
    const tenantMap = await getTenantIdsForUsers(uniqueUserIds);

    for (const activity of upcomingActivities) {
      try {
        const tenantId = tenantMap.get(activity.userId);
        if (!tenantId) continue;

        const scheduledAt = activity.scheduledAt!;
        const minutesUntil = Math.round((scheduledAt.getTime() - now.getTime()) / 60_000);
        const activityTitle = activity.body
          ? activity.body.substring(0, 80)
          : 'Untitled';

        await emitAppEvent({
          tenantId,
          userId: activity.userId,
          appId: 'crm',
          eventType: 'activity.reminder',
          title: `Reminder: ${activity.type} - ${activityTitle} scheduled in ${minutesUntil} minutes`,
          notifyUserIds: [activity.userId],
          metadata: { activityId: activity.id, scheduledAt: scheduledAt.toISOString() },
        });

        logger.info({ activityId: activity.id, userId: activity.userId }, 'CRM activity reminder sent');
      } catch (err) {
        logger.warn({ err, activityId: activity.id }, 'Failed to send CRM activity reminder');
      }
    }
  } catch (error) {
    logger.error({ error }, 'Failed to check CRM activity reminders');
  }
}

// ─── Deal Close Date Approaching (daily) ──────────────────────────

async function checkDealCloseDate(): Promise<void> {
  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  try {
    // Find deals closing within 3 days that are not won/lost/archived
    const closingDeals = await db
      .select({
        id: crmDeals.id,
        title: crmDeals.title,
        assignedUserId: crmDeals.assignedUserId,
        userId: crmDeals.userId,
        expectedCloseDate: crmDeals.expectedCloseDate,
      })
      .from(crmDeals)
      .where(
        and(
          gte(crmDeals.expectedCloseDate, now),
          lte(crmDeals.expectedCloseDate, threeDaysFromNow),
          isNull(crmDeals.wonAt),
          isNull(crmDeals.lostAt),
          eq(crmDeals.isArchived, false),
        ),
      );

    if (closingDeals.length === 0) {
      logger.debug('No CRM deals approaching close date');
      return;
    }

    logger.info({ count: closingDeals.length }, 'Found CRM deals approaching close date');

    // Batch-resolve tenant IDs for all notify targets (fix N+1)
    const uniqueUserIds = [...new Set(closingDeals.map((d) => d.assignedUserId || d.userId))];
    const tenantMap = await getTenantIdsForUsers(uniqueUserIds);

    for (const deal of closingDeals) {
      try {
        const notifyUserId = deal.assignedUserId || deal.userId;
        const tenantId = tenantMap.get(notifyUserId);
        if (!tenantId) continue;

        const closeDate = deal.expectedCloseDate!;
        const daysUntil = Math.ceil((closeDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

        await emitAppEvent({
          tenantId,
          userId: notifyUserId,
          appId: 'crm',
          eventType: 'deal.closingSoon',
          title: `${deal.title} closes in ${daysUntil} day${daysUntil === 1 ? '' : 's'}`,
          notifyUserIds: [notifyUserId],
          metadata: { dealId: deal.id, expectedCloseDate: closeDate.toISOString() },
        });

        logger.info({ dealId: deal.id, notifyUserId }, 'CRM deal close-date reminder sent');
      } catch (err) {
        logger.warn({ err, dealId: deal.id }, 'Failed to send CRM deal close-date reminder');
      }
    }
  } catch (error) {
    logger.error({ error }, 'Failed to check CRM deal close dates');
  }
}

// ─── Scheduler ─────────────────────────────────────────────────────

let timer: ReturnType<typeof setInterval> | null = null;
let startupTimer: ReturnType<typeof setTimeout> | null = null;
let lastDealCheckDate = '';
let running = false;

async function runChecks(): Promise<void> {
  if (running) return;
  running = true;
  try {
    await checkActivityReminders();

    // Run the deal close-date check once per calendar day
    const today = new Date().toISOString().slice(0, 10);
    if (today !== lastDealCheckDate) {
      await checkDealCloseDate();
      lastDealCheckDate = today;
    }
  } catch (err) {
    logger.error({ err }, 'CRM reminder check failed');
  } finally {
    running = false;
  }
}

export function startCrmReminderScheduler(): void {
  if (timer) return;

  startupTimer = setTimeout(() => {
    runChecks().catch((err) => logger.error({ err }, 'Initial CRM reminder check failed'));
    timer = setInterval(() => {
      runChecks().catch((err) => logger.error({ err }, 'CRM reminder cycle failed'));
    }, 60 * 60 * 1000); // hourly
  }, 90_000); // 90s startup delay

  logger.info('CRM activity reminder scheduler started (hourly)');
}

export function stopCrmReminderScheduler(): void {
  if (startupTimer) {
    clearTimeout(startupTimer);
    startupTimer = null;
  }
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  logger.info('CRM activity reminder scheduler stopped');
}
