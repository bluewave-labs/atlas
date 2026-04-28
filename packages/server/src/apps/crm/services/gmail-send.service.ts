import { google } from 'googleapis';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../../config/database';
import { messageChannels, messageParticipants, messages } from '../../../db/schema';
import { callGoogleApi } from '../../../services/google-api-call';
import { logger } from '../../../utils/logger';
import { withRetry } from '../../../utils/retry';
import { buildRfc5322Message, encodeForGmailApi, type ReplyContext } from './rfc5322';
import {
  loadBlocklist,
  matchHandlesToContacts,
} from './participant-match.service';
import { autoCreateContactIfNeeded } from './crm-contact-create.service';
import { upsertActivitiesForMessage } from './message-activity.service';

interface MessageRow {
  id: string;
  channelId: string;
  tenantId: string;
  threadId: string;
  direction: string;
  status: string;
  subject: string | null;
  bodyText: string | null;
  inReplyTo: string | null;
}

interface ChannelRow {
  id: string;
  accountId: string;
  tenantId: string;
  ownerUserId: string;
  handle: string;
  contactAutoCreationPolicy: 'none' | 'send-only' | 'send-and-receive';
}

interface ParticipantRow {
  role: string;
  handle: string;
  displayName: string | null;
}

/**
 * Phase 2c outbound send. The controller has already inserted a pending
 * outbound `messages` row + participants. This function:
 *   1. Loads the row, channel, and participant list.
 *   2. Builds an RFC 5322 raw message (with threading headers when reply).
 *   3. Calls `users.messages.send` (with `threadId` for replies).
 *   4. Updates the message row to `status='sent'` + actual `gmailMessageId`.
 *   5. Runs post-send participant matching (auto-create per channel policy)
 *      + activity fan-out.
 *
 * Idempotent: if the message is already `'sent'` or otherwise non-pending,
 * returns early. BullMQ retries on already-sent messages are no-ops.
 *
 * On Gmail API error (including 429): marks the row `'failed'` and rethrows.
 * BullMQ's existing 3-attempt exponential backoff handles transient errors.
 */
export async function performGmailSend(messageId: string): Promise<void> {
  const message = await loadMessage(messageId);
  if (!message) throw new Error(`message not found: ${messageId}`);

  if (message.status !== 'pending') {
    logger.info({ messageId, status: message.status }, 'Gmail send skipped: message not pending');
    return;
  }

  if (message.direction !== 'outbound') {
    throw new Error(`message ${messageId} is not outbound`);
  }

  const channel = await loadChannel(message.channelId);
  if (!channel) throw new Error(`channel not found for message ${messageId}`);

  const participants = await loadParticipants(messageId);
  const replyContext = await buildReplyContext(message);

  const recipientsByRole = groupByRole(participants);

  try {
    const raw = buildRfc5322Message({
      from: channel.handle,
      to: recipientsByRole.to,
      cc: recipientsByRole.cc,
      bcc: recipientsByRole.bcc,
      subject: message.subject ?? '',
      body: message.bodyText ?? '',
      replyTo: replyContext,
    });

    const sendRes = await callGoogleApi(channel.accountId, async (auth) => {
      const gmail = google.gmail({ version: 'v1', auth });
      return withRetry(
        () =>
          gmail.users.messages.send({
            userId: 'me',
            requestBody: {
              raw: encodeForGmailApi(raw),
              threadId: replyContext ? message.threadId : undefined,
            },
          }),
        'Gmail API messages.send',
      );
    });

    const gmailMessageId = sendRes.data.id ?? null;
    const gmailThreadId = sendRes.data.threadId ?? null;

    await db
      .update(messages)
      .set({
        status: 'sent',
        sentAt: new Date(),
        ...(gmailMessageId ? { gmailMessageId } : {}),
        updatedAt: new Date(),
      })
      .where(eq(messages.id, messageId));

    logger.info({ messageId, gmailMessageId, gmailThreadId }, 'Gmail send completed');

    await runPostSendMatching(message, channel, participants);
    await upsertActivitiesForMessage({
      messageId: message.id,
      tenantId: message.tenantId,
      userId: channel.ownerUserId,
      direction: 'outbound',
    });
  } catch (err: any) {
    logger.error({ err, messageId }, 'Gmail send failed');
    await db
      .update(messages)
      .set({
        status: 'failed',
        updatedAt: new Date(),
      })
      .where(eq(messages.id, messageId));
    throw err;
  }
}

async function loadMessage(messageId: string): Promise<MessageRow | null> {
  const [row] = await db
    .select({
      id: messages.id,
      channelId: messages.channelId,
      tenantId: messages.tenantId,
      threadId: messages.threadId,
      direction: messages.direction,
      status: messages.status,
      subject: messages.subject,
      bodyText: messages.bodyText,
      inReplyTo: messages.inReplyTo,
    })
    .from(messages)
    .where(eq(messages.id, messageId))
    .limit(1);
  return (row as MessageRow | undefined) ?? null;
}

async function loadChannel(channelId: string): Promise<ChannelRow | null> {
  const [row] = await db
    .select({
      id: messageChannels.id,
      accountId: messageChannels.accountId,
      tenantId: messageChannels.tenantId,
      ownerUserId: messageChannels.ownerUserId,
      handle: messageChannels.handle,
      contactAutoCreationPolicy: messageChannels.contactAutoCreationPolicy,
    })
    .from(messageChannels)
    .where(eq(messageChannels.id, channelId))
    .limit(1);
  return (row as ChannelRow | undefined) ?? null;
}

async function loadParticipants(messageId: string): Promise<ParticipantRow[]> {
  const rows = await db
    .select({
      role: messageParticipants.role,
      handle: messageParticipants.handle,
      displayName: messageParticipants.displayName,
    })
    .from(messageParticipants)
    .where(eq(messageParticipants.messageId, messageId));
  return rows as ParticipantRow[];
}

/**
 * If the outbound message is a reply (has `inReplyTo`), build the References
 * chain by walking the thread's prior messages and appending `inReplyTo` last.
 */
async function buildReplyContext(message: MessageRow): Promise<ReplyContext | undefined> {
  if (!message.inReplyTo) return undefined;

  const priorMessages = await db
    .select({ headerMessageId: messages.headerMessageId })
    .from(messages)
    .where(
      and(
        eq(messages.threadId, message.threadId),
        eq(messages.tenantId, message.tenantId),
      ),
    )
    .orderBy(asc(messages.sentAt))
    .limit(50);

  const ids: string[] = [];
  for (const m of priorMessages) {
    if (m.headerMessageId && m.headerMessageId !== message.inReplyTo) {
      ids.push(m.headerMessageId);
    }
  }
  // The message being replied to MUST be the last entry in References.
  ids.push(message.inReplyTo);

  return { inReplyTo: message.inReplyTo, references: ids };
}

function groupByRole(participants: ParticipantRow[]): {
  to: string[];
  cc: string[];
  bcc: string[];
} {
  const out: { to: string[]; cc: string[]; bcc: string[] } = { to: [], cc: [], bcc: [] };
  for (const p of participants) {
    if (p.role === 'to') out.to.push(p.handle);
    else if (p.role === 'cc') out.cc.push(p.handle);
    else if (p.role === 'bcc') out.bcc.push(p.handle);
  }
  return out;
}

async function runPostSendMatching(
  message: MessageRow,
  channel: ChannelRow,
  participants: ParticipantRow[],
): Promise<void> {
  const handles = participants.map((p) => p.handle);
  const isBlocked = await loadBlocklist(channel.tenantId);
  const contactMap = await matchHandlesToContacts(handles, channel.tenantId);

  for (const p of participants) {
    if (isBlocked(p.handle)) continue;
    const matched = contactMap.get(p.handle.toLowerCase());
    if (matched) continue;
    const created = await autoCreateContactIfNeeded({
      handle: p.handle,
      displayName: p.displayName,
      role: p.role as 'from' | 'to' | 'cc' | 'bcc',
      direction: 'outbound',
      policy: channel.contactAutoCreationPolicy,
      tenantId: channel.tenantId,
      userId: channel.ownerUserId,
      isBlocked: false,
    });
    if (created) {
      await db
        .update(messageParticipants)
        .set({ personId: created, updatedAt: new Date() })
        .where(
          and(
            eq(messageParticipants.messageId, message.id),
            eq(messageParticipants.handle, p.handle),
            eq(messageParticipants.role, p.role),
          ),
        );
    }
  }
}
