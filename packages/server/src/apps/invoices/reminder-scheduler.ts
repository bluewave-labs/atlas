/**
 * Invoice reminder scheduler.
 *
 * Hourly cron that sends overdue-invoice reminder emails using the 4-stage
 * dunning cadence configured per-tenant in invoice_settings:
 *   Stage 1 → reminder_1_days after due date
 *   Stage 2 → reminder_2_days after due date
 *   Stage 3 → reminder_3_days after due date
 *   Stage 4+ → "endless" cadence, every endless_reminder_days after the
 *              previous reminder (stage stays pinned at 4).
 *
 * On successful send we bump invoices.last_reminder_stage + last_reminder_at;
 * on failure we leave them alone so the next cron cycle retries.
 */

import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../../config/database';
import { invoices, invoicePayments, invoiceSettings } from '../../db/schema';
import { logger } from '../../utils/logger';
import { sendInvoiceEmail } from './services/invoice-email.service';

interface ReminderRunResult {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysSince(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY);
}

/**
 * Determine the next reminder stage to send for an overdue invoice, or
 * null if the invoice is not yet eligible for its next reminder.
 */
export function computeEligibleStage(params: {
  dueDate: Date;
  lastReminderStage: number;
  lastReminderAt: Date | null;
  reminder1Days: number;
  reminder2Days: number;
  reminder3Days: number;
  endlessReminderDays: number;
  now: Date;
}): 1 | 2 | 3 | 4 | null {
  const {
    dueDate,
    lastReminderStage,
    lastReminderAt,
    reminder1Days,
    reminder2Days,
    reminder3Days,
    endlessReminderDays,
    now,
  } = params;

  const daysSinceDue = daysSince(dueDate, now);
  if (daysSinceDue < 0) return null;

  if (lastReminderStage === 0) {
    return daysSinceDue >= reminder1Days ? 1 : null;
  }
  if (lastReminderStage === 1) {
    return daysSinceDue >= reminder2Days ? 2 : null;
  }
  if (lastReminderStage === 2) {
    return daysSinceDue >= reminder3Days ? 3 : null;
  }
  // Stage 3+ → endless cadence, capped at stage 4 template.
  if (lastReminderStage >= 3) {
    if (!lastReminderAt) {
      // Defensive: if we've somehow recorded a stage without a timestamp,
      // fire a stage-4 reminder now rather than getting stuck.
      return 4;
    }
    const daysSinceLast = daysSince(lastReminderAt, now);
    return daysSinceLast >= endlessReminderDays ? 4 : null;
  }
  return null;
}

export async function runInvoiceReminders(): Promise<ReminderRunResult> {
  const now = new Date();
  let processed = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  try {
    // Pull all overdue, non-archived, non-terminal invoices whose tenant
    // has reminders enabled. Balance-due is computed inline (sum of
    // payments minus refunds) so we can skip invoices that have already
    // been fully paid and pass the real outstanding amount to the email
    // template.
    const rows = await db
      .select({
        id: invoices.id,
        tenantId: invoices.tenantId,
        companyId: invoices.companyId,
        invoiceNumber: invoices.invoiceNumber,
        total: invoices.total,
        dueDate: invoices.dueDate,
        lastReminderStage: invoices.lastReminderStage,
        lastReminderAt: invoices.lastReminderAt,
        reminder1Days: invoiceSettings.reminder1Days,
        reminder2Days: invoiceSettings.reminder2Days,
        reminder3Days: invoiceSettings.reminder3Days,
        endlessReminderDays: invoiceSettings.endlessReminderDays,
        balanceDue: sql<number>`(
          ${invoices.total} - COALESCE(
            (SELECT SUM(CASE WHEN ${invoicePayments.type} = 'payment' THEN ${invoicePayments.amount} ELSE -${invoicePayments.amount} END)
             FROM ${invoicePayments}
             WHERE ${invoicePayments.invoiceId} = ${invoices.id}),
            0
          )
        )`,
      })
      .from(invoices)
      .innerJoin(invoiceSettings, eq(invoiceSettings.tenantId, invoices.tenantId))
      .where(
        and(
          eq(invoices.isArchived, false),
          eq(invoices.excludeFromAutoReminders, false),
          inArray(invoices.status, ['sent', 'viewed', 'overdue']),
          lt(invoices.dueDate, sql`NOW()`),
          eq(invoiceSettings.reminderEnabled, true),
        ),
      );

    processed = rows.length;

    for (const row of rows) {
      // Skip paid/over-paid invoices — balance must be strictly positive.
      // Use a small epsilon to avoid float round-off leaving tiny balances.
      const balance = Number(row.balanceDue ?? 0);
      if (balance <= 0.0001) {
        skipped++;
        continue;
      }

      const dueDate = row.dueDate instanceof Date ? row.dueDate : new Date(row.dueDate as unknown as string);
      const lastReminderAt = row.lastReminderAt
        ? row.lastReminderAt instanceof Date
          ? row.lastReminderAt
          : new Date(row.lastReminderAt as unknown as string)
        : null;

      const stage = computeEligibleStage({
        dueDate,
        lastReminderStage: row.lastReminderStage,
        lastReminderAt,
        reminder1Days: row.reminder1Days,
        reminder2Days: row.reminder2Days,
        reminder3Days: row.reminder3Days,
        endlessReminderDays: row.endlessReminderDays,
        now,
      });

      if (stage === null) {
        skipped++;
        continue;
      }

      try {
        const result = await sendInvoiceEmail(row.id, row.tenantId, {
          template: 'reminder',
          stage,
          balanceDue: Math.round(balance * 100) / 100,
        });

        if (result.sent) {
          // Pin stage at 4 once we've reached the endless phase.
          const newStage = Math.min(4, Math.max(row.lastReminderStage + 1, stage));
          try {
            await db
              .update(invoices)
              .set({
                lastReminderStage: newStage,
                lastReminderAt: new Date(),
                updatedAt: new Date(),
              })
              .where(and(eq(invoices.id, row.id), eq(invoices.tenantId, row.tenantId)));
          } catch (err) {
            logger.error(
              { err, invoiceId: row.id, tenantId: row.tenantId },
              'runInvoiceReminders: failed to update reminder progress after send',
            );
          }
          sent++;
          logger.info(
            {
              invoiceId: row.id,
              tenantId: row.tenantId,
              invoiceNumber: row.invoiceNumber,
              stage,
              newStage,
            },
            'Invoice reminder sent',
          );
        } else {
          failed++;
          logger.warn(
            {
              invoiceId: row.id,
              tenantId: row.tenantId,
              invoiceNumber: row.invoiceNumber,
              stage,
              reason: result.reason,
            },
            'Invoice reminder not sent',
          );
        }
      } catch (err) {
        failed++;
        logger.error(
          { err, invoiceId: row.id, tenantId: row.tenantId, stage },
          'runInvoiceReminders: send threw unexpectedly',
        );
      }
    }

    if (processed > 0) {
      logger.info(
        { processed, sent, skipped, failed },
        'Invoice reminder batch complete',
      );
    } else {
      logger.debug('Invoice reminder batch: no overdue invoices');
    }
  } catch (err) {
    logger.error({ err }, 'Invoice reminder scheduler failed');
  }

  return { processed, sent, skipped, failed };
}

// ─── Scheduler wiring ───────────────────────────────────────────────

const INTERVAL_MS = 60 * 60 * 1000; // hourly
const INITIAL_DELAY_MS = 30_000;

let timer: ReturnType<typeof setInterval> | null = null;
let initialTimer: ReturnType<typeof setTimeout> | null = null;

export function startInvoiceReminderScheduler() {
  if (timer) return;

  initialTimer = setTimeout(() => {
    runInvoiceReminders().catch((err) =>
      logger.error({ err }, 'Initial invoice reminder run failed'),
    );
  }, INITIAL_DELAY_MS);

  timer = setInterval(() => {
    runInvoiceReminders().catch((err) =>
      logger.error({ err }, 'Scheduled invoice reminder run failed'),
    );
  }, INTERVAL_MS);

  logger.info('Invoice reminder scheduler started (hourly)');
}

export function stopInvoiceReminderScheduler() {
  if (initialTimer) {
    clearTimeout(initialTimer);
    initialTimer = null;
  }
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info('Invoice reminder scheduler stopped');
  }
}
