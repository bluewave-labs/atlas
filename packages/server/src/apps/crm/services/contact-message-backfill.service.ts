import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../../../config/database';
import { crmContacts, messageParticipants, messages } from '../../../db/schema';
import { upsertActivitiesForMessage } from './message-activity.service';
import { logger } from '../../../utils/logger';
import type { MessageDirection } from './participant-match.service';

/**
 * Retroactively link existing messages to a newly-created contact.
 *
 * Walks `messageParticipants` for rows whose lowercased handle matches the
 * contact's email AND `personId IS NULL` AND share the tenant. Sets
 * `personId` on each, then re-runs `upsertActivitiesForMessage` so the
 * timeline picks up activities for the messages that were ingested before
 * the contact existed.
 *
 * Returns the number of participant rows linked. Idempotent — calling
 * twice on the same contact is a no-op (the second call finds nothing
 * with `personId IS NULL` left to update).
 */
export async function backfillContactMessages(
  tenantId: string,
  contactId: string,
  userId: string,
): Promise<number> {
  const [contact] = await db
    .select({ email: crmContacts.email })
    .from(crmContacts)
    .where(and(eq(crmContacts.id, contactId), eq(crmContacts.tenantId, tenantId)))
    .limit(1);

  if (!contact || !contact.email) return 0;
  const handle = contact.email.toLowerCase();

  // Find participants matching this handle that haven't been linked yet.
  // Join through messages so we can capture each affected message's direction
  // for the activity upsert call.
  const rows = await db
    .select({
      messageId: messageParticipants.messageId,
      direction: messages.direction,
    })
    .from(messageParticipants)
    .innerJoin(messages, eq(messages.id, messageParticipants.messageId))
    .where(
      and(
        eq(messageParticipants.tenantId, tenantId),
        eq(messageParticipants.handle, handle),
        isNull(messageParticipants.personId),
      ),
    );

  if (rows.length === 0) return 0;

  await db
    .update(messageParticipants)
    .set({ personId: contactId, updatedAt: new Date() })
    .where(
      and(
        eq(messageParticipants.tenantId, tenantId),
        eq(messageParticipants.handle, handle),
        isNull(messageParticipants.personId),
      ),
    );

  // Per affected message, re-run the activity upsert so the timeline picks
  // up the new contact link. Distinct messageIds — one message can have
  // multiple participants (cc, bcc) for the same handle is rare but possible.
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.messageId)) continue;
    seen.add(row.messageId);
    try {
      await upsertActivitiesForMessage({
        messageId: row.messageId,
        tenantId,
        userId,
        direction: row.direction as MessageDirection,
      });
    } catch (err) {
      logger.error({ err, messageId: row.messageId, contactId }, 'Backfill activity upsert failed');
    }
  }

  logger.info(
    { tenantId, contactId, linked: rows.length, messages: seen.size },
    'Contact message backfill completed',
  );

  return rows.length;
}
