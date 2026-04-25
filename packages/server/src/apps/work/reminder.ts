import { db } from '../../config/database';
import { tasks, users } from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { sendEmail } from '../../services/email.service';
import { env } from '../../config/env';

/**
 * Send reminders for tasks with due dates of today.
 *
 * Criteria:
 * - Task status is 'todo'
 * - Task is not archived
 * - dueDate equals today's date (YYYY-MM-DD)
 * - Either no reminder was sent yet, or last reminder was sent before today
 */
export async function sendDueTaskReminders(): Promise<number> {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let reminderCount = 0;

  try {
    // Find all tasks due today that haven't been reminded today
    const dueTasks = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        userId: tasks.userId,
        dueDate: tasks.dueDate,
        lastReminderAt: tasks.lastReminderAt,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.status, 'todo'),
          eq(tasks.isArchived, false),
          eq(tasks.dueDate, todayStr),
          sql`(
            ${tasks.lastReminderAt} IS NULL
            OR ${tasks.lastReminderAt} < ${todayStart}
          )`,
        ),
      );

    if (dueTasks.length === 0) {
      logger.debug('No tasks due today need reminders');
      return 0;
    }

    logger.info({ count: dueTasks.length }, 'Found tasks due today for reminders');

    for (const task of dueTasks) {
      try {
        // Get the task owner's email
        const [user] = await db
          .select({ name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, task.userId))
          .limit(1);

        if (!user?.email) continue;

        const clientUrl = env.CLIENT_PUBLIC_URL || 'http://localhost:5180';
        const rawTitle = task.title || 'Untitled task';
        const taskTitle = rawTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        await sendEmail({
          to: user.email,
          subject: `Task due today: ${taskTitle}`,
          text: `Task "${taskTitle}" is due today. Open Atlas to view your tasks: ${clientUrl}/work`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 500px;">
              <h2 style="margin: 0 0 12px; font-size: 18px;">Task due today</h2>
              <p style="margin: 0 0 16px; color: #555;">
                Your task <strong>"${taskTitle}"</strong> is due today.
              </p>
              <a href="${clientUrl}/work" style="display: inline-block; padding: 10px 20px; background: #13715B; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 500;">
                Open work
              </a>
            </div>
          `,
        });

        // Update lastReminderAt
        await db
          .update(tasks)
          .set({ lastReminderAt: now })
          .where(eq(tasks.id, task.id));

        reminderCount++;
        logger.info({ taskId: task.id, userId: task.userId }, 'Task due-date reminder sent');
      } catch (err) {
        logger.warn({ err, taskId: task.id }, 'Failed to send task reminder');
      }
    }

    logger.info({ reminderCount }, 'Task reminder batch complete');
    return reminderCount;
  } catch (error) {
    logger.error({ error }, 'Failed to run task due-date reminders');
    return 0;
  }
}

// ─── Reminder scheduler ─────────────────────────────────────────────

const REMINDER_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
let reminderTimer: ReturnType<typeof setInterval> | null = null;

export function startTaskReminderScheduler() {
  if (reminderTimer) return;

  // Hourly tick. No on-boot run — boot triggers caused the email to
  // arrive seconds after a deploy regardless of time of day. The SQL
  // guard (lastReminderAt < todayStart) prevents same-day double-send
  // on its own, so the boot trigger was only adding off-schedule noise.
  reminderTimer = setInterval(async () => {
    try {
      await sendDueTaskReminders();
    } catch (err) {
      logger.error({ err }, 'Task reminder scheduler failed');
    }
  }, REMINDER_INTERVAL_MS);

  logger.info('Task reminder scheduler started (hourly)');
}

export function stopTaskReminderScheduler() {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
    logger.info('Task reminder scheduler stopped');
  }
}
