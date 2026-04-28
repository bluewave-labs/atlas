import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../../config/database';
import {
  crmActivities,
  crmContacts,
  crmDeals,
  messageParticipants,
} from '../../../db/schema';

export type MessageDirection = 'inbound' | 'outbound';

interface ActivityRow {
  tenantId: string;
  userId: string;
  type: 'email-received' | 'email-sent';
  body: string;
  messageId: string;
  externalProvider: string;
  externalId: string | null;
  contactId?: string;
  dealId?: string;
  companyId?: string;
}

/**
 * Create one CRM activity per linked entity for a message:
 *   - one per matched contact
 *   - one per matched contact's company (if any)
 *   - one per matched contact's open deals (isArchived = false)
 *
 * If a message has no matched contacts (every participant.personId is null),
 * inserts nothing — orphan messages live only in the messages table until
 * a future participant-match re-run picks them up.
 *
 * Idempotent: deletes any pre-existing activities for this message before
 * inserting fresh ones, so a BullMQ retry of the parent ingest job won't
 * double-create rows on the timeline.
 */
export async function upsertActivitiesForMessage(args: {
  messageId: string;
  tenantId: string;
  userId: string;
  direction: MessageDirection;
}): Promise<void> {
  const participantRows = await db
    .select({ personId: messageParticipants.personId })
    .from(messageParticipants)
    .where(
      and(
        eq(messageParticipants.messageId, args.messageId),
        eq(messageParticipants.tenantId, args.tenantId),
      ),
    );

  const contactIds = Array.from(
    new Set(participantRows.map((r) => r.personId).filter((id): id is string => !!id)),
  );

  if (contactIds.length === 0) return;

  const contacts = await db
    .select({ id: crmContacts.id, companyId: crmContacts.companyId })
    .from(crmContacts)
    .where(
      and(
        eq(crmContacts.tenantId, args.tenantId),
        inArray(crmContacts.id, contactIds),
      ),
    );

  const openDeals = await db
    .select({ id: crmDeals.id })
    .from(crmDeals)
    .where(
      and(
        eq(crmDeals.tenantId, args.tenantId),
        inArray(crmDeals.contactId, contactIds),
        // For Phase 2b "open" = `isArchived = false`. Stage-based won/lost detection is Phase 2c.
        eq(crmDeals.isArchived, false),
      ),
    );

  const type: ActivityRow['type'] = args.direction === 'inbound' ? 'email-received' : 'email-sent';
  const baseRow = {
    tenantId: args.tenantId,
    userId: args.userId,
    type,
    body: '', // body is rendered from the linked message; the activity row is just a pointer
    messageId: args.messageId,
    externalProvider: 'gmail',
    externalId: null as string | null,
  };

  const rows: ActivityRow[] = [];

  for (const c of contacts) {
    rows.push({ ...baseRow, contactId: c.id });
  }

  const companyIds = Array.from(new Set(contacts.map((c) => c.companyId).filter((id): id is string => !!id)));
  for (const companyId of companyIds) {
    rows.push({ ...baseRow, companyId });
  }

  for (const d of openDeals) {
    rows.push({ ...baseRow, dealId: d.id });
  }

  if (rows.length > 0) {
    // Idempotency: delete any existing activities for this message before
    // inserting fresh ones. Safe to call after a BullMQ retry — the upstream
    // (channelId, gmailMessageId) unique constraint prevents the message
    // itself from being re-ingested, but this guards the activity fan-out
    // against being run twice.
    await db
      .delete(crmActivities)
      .where(
        and(
          eq(crmActivities.tenantId, args.tenantId),
          eq(crmActivities.messageId, args.messageId),
        ),
      );
    await db.insert(crmActivities).values(rows);
  }
}
