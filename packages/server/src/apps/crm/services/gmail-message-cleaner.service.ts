import { and, eq, isNull, isNotNull, lt } from 'drizzle-orm';
import { db } from '../../../config/database';
import { messages, tenants } from '../../../db/schema';
import { logger } from '../../../utils/logger';

/** Grace window between soft-delete (deletedAt set) and hard-delete (row dropped). */
export const HARD_DELETE_GRACE_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Daily cleaner. Two passes per run:
 *   1. Soft-delete messages older than each tenant's retention window
 *      (tenants with null `gmailRetentionDays` are skipped — they retain
 *      forever). `crm_activities` rows are preserved (timeline survives
 *      message body cleanup).
 *   2. Hard-delete rows soft-deleted more than HARD_DELETE_GRACE_DAYS ago.
 *      Cascade FK on messageParticipants.messageId cleans participants.
 *
 * Idempotent — safe to run on every boot AND on the daily schedule.
 */
export async function performGmailMessageCleaner(): Promise<void> {
  const tenantRows = await db
    .select({ id: tenants.id, gmailRetentionDays: tenants.gmailRetentionDays })
    .from(tenants);

  let softDeleted = 0;
  for (const tenant of tenantRows) {
    if (tenant.gmailRetentionDays == null) continue;
    const cutoff = new Date(Date.now() - tenant.gmailRetentionDays * MS_PER_DAY);
    const result = await db
      .update(messages)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(messages.tenantId, tenant.id),
          isNull(messages.deletedAt),
          lt(messages.sentAt, cutoff),
        ),
      );
    softDeleted += (result as { rowCount?: number })?.rowCount ?? 0;
  }

  const hardCutoff = new Date(Date.now() - HARD_DELETE_GRACE_DAYS * MS_PER_DAY);
  const hardResult = await db
    .delete(messages)
    .where(and(isNotNull(messages.deletedAt), lt(messages.deletedAt, hardCutoff)));
  const hardDeleted = (hardResult as { rowCount?: number })?.rowCount ?? 0;

  logger.info(
    { tenants: tenantRows.length, softDeleted, hardDeleted },
    'Gmail message cleaner completed',
  );
}
