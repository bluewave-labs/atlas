import type { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../config/database';
import {
  messages,
  messageParticipants,
  messageThreads,
} from '../../../db/schema';
import { getChannelById } from '../services/channel.service';
import { getSyncQueue, SyncJobName } from '../../../config/queue';
import { logger } from '../../../utils/logger';

/** Placeholder prefix for `messages.gmailMessageId` until the send job populates the real Gmail id. */
export const PENDING_GMAIL_MESSAGE_ID_PREFIX = 'pending-';
/** Placeholder prefix for `message_threads.gmailThreadId` until the send job populates the canonical thread id. */
export const LOCAL_THREAD_ID_PREFIX = 'local-';

interface SendBody {
  channelId?: string;
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  body?: string;
  /** When replying: the headerMessageId of the message being replied to. */
  inReplyTo?: string;
  /** When replying: existing local thread id to attach to. If omitted, a new thread is created. */
  threadId?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Parse "Display Name <email@x>" or bare "email@x" into { handle, displayName }.
 * Returns null if the address is not a valid single-@ email.
 */
function parseAddress(s: string): { handle: string; displayName: string | null } | null {
  const angleMatch = s.match(/<([^>]+)>/);
  if (angleMatch) {
    const handle = angleMatch[1].trim().toLowerCase();
    if (!EMAIL_RE.test(handle)) return null;
    const displayName = s.slice(0, angleMatch.index).trim().replace(/^"|"$/g, '') || null;
    return { handle, displayName };
  }
  const trimmed = s.trim().toLowerCase();
  if (!EMAIL_RE.test(trimmed)) return null;
  return { handle: trimmed, displayName: null };
}

export async function sendMessage(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const body = (req.body ?? {}) as SendBody;

    if (!body.channelId) {
      res.status(400).json({ success: false, error: 'channelId is required' });
      return;
    }
    const to = body.to ?? [];
    const cc = body.cc ?? [];
    const bcc = body.bcc ?? [];
    if (to.length === 0 && cc.length === 0 && bcc.length === 0) {
      res.status(400).json({ success: false, error: 'at least one recipient (to, cc, or bcc) is required' });
      return;
    }

    const channel = await getChannelById({ channelId: body.channelId, userId, tenantId });
    if (!channel) {
      res.status(404).json({ success: false, error: 'channel not found' });
      return;
    }
    if (channel.ownerUserId !== userId) {
      res.status(403).json({ success: false, error: 'only the channel owner can send from this channel' });
      return;
    }

    const queue = getSyncQueue();
    if (!queue) {
      res.status(503).json({
        success: false,
        error: 'Sync queue unavailable — Redis is not configured',
      });
      return;
    }

    // New thread vs existing. New: insert a message_threads row with a placeholder
    // gmailThreadId; the send service will overwrite it with the canonical Gmail
    // value when Gmail returns one.
    let threadId = body.threadId ?? null;
    if (!threadId) {
      const placeholder = `${LOCAL_THREAD_ID_PREFIX}${randomUUID()}`;
      const [thread] = await db
        .insert(messageThreads)
        .values({
          channelId: channel.id,
          tenantId,
          gmailThreadId: placeholder,
          subject: body.subject ?? null,
          messageCount: 1,
          lastMessageAt: new Date(),
        })
        .returning({ id: messageThreads.id });
      threadId = thread.id;
    }

    // messages.gmailMessageId is NOT NULL — use a placeholder until the send
    // service overwrites it with the actual Gmail message id on success.
    const gmailMessageIdPlaceholder = `${PENDING_GMAIL_MESSAGE_ID_PREFIX}${randomUUID()}`;

    const [insertedMsg] = await db
      .insert(messages)
      .values({
        channelId: channel.id,
        threadId,
        tenantId,
        gmailMessageId: gmailMessageIdPlaceholder,
        headerMessageId: null,
        inReplyTo: body.inReplyTo ?? null,
        subject: body.subject ?? null,
        snippet: (body.body ?? '').slice(0, 200),
        bodyText: body.body ?? '',
        bodyHtml: null,
        direction: 'outbound',
        status: 'pending',
        sentAt: null,
        receivedAt: null,
        labels: [],
        hasAttachments: false,
      })
      .returning({ id: messages.id });

    const messageId = insertedMsg.id;

    const participantRows: Array<{
      messageId: string;
      tenantId: string;
      role: string;
      handle: string;
      displayName: string | null;
    }> = [];

    participantRows.push({
      messageId,
      tenantId,
      role: 'from',
      handle: (channel.handle ?? '').toLowerCase(),
      displayName: null,
    });

    for (const role of ['to', 'cc', 'bcc'] as const) {
      const list = role === 'to' ? to : role === 'cc' ? cc : bcc;
      for (const raw of list) {
        const parsed = parseAddress(raw);
        if (!parsed) continue;
        participantRows.push({
          messageId,
          tenantId,
          role,
          handle: parsed.handle,
          displayName: parsed.displayName,
        });
      }
    }

    if (participantRows.length > 0) {
      await db.insert(messageParticipants).values(participantRows);
    }

    // If the enqueue fails after the rows are committed, the message stays at
    // status='pending' indefinitely. We accept this trade-off rather than wrap
    // the inserts + enqueue in a DB transaction (which would deadlock against
    // the worker that reads the row). A future Phase 2d/3 sweeper can re-queue
    // stale pending rows.
    await queue.add(SyncJobName.GmailSend, { messageId });

    res.json({
      success: true,
      data: { messageId, status: 'pending' },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to send message');
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
}

export async function retryMessage(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const messageId = req.params.id as string;

    const [message] = await db
      .select({
        id: messages.id,
        tenantId: messages.tenantId,
        channelId: messages.channelId,
        direction: messages.direction,
        status: messages.status,
      })
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.tenantId, tenantId)))
      .limit(1);

    if (!message) {
      res.status(404).json({ success: false, error: 'message not found' });
      return;
    }

    if (message.direction !== 'outbound') {
      res.status(400).json({ success: false, error: 'only outbound messages can be retried' });
      return;
    }

    const channel = await getChannelById({ channelId: message.channelId, userId, tenantId });
    if (!channel || channel.ownerUserId !== userId) {
      res.status(403).json({ success: false, error: 'only the channel owner can retry sends from this channel' });
      return;
    }

    if (message.status !== 'failed') {
      res.status(400).json({
        success: false,
        error: `cannot retry a message with status '${message.status}' (only 'failed' is retryable)`,
      });
      return;
    }

    const queue = getSyncQueue();
    if (!queue) {
      res.status(503).json({
        success: false,
        error: 'Sync queue unavailable — Redis is not configured',
      });
      return;
    }

    await db
      .update(messages)
      .set({ status: 'pending', updatedAt: new Date() })
      .where(eq(messages.id, messageId));

    await queue.add(SyncJobName.GmailSend, { messageId });

    res.json({
      success: true,
      data: { messageId, queued: true },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to retry message');
    res.status(500).json({ success: false, error: 'Failed to retry message' });
  }
}

export async function getMessage(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const messageId = req.params.id as string;

    const [message] = await db
      .select({
        id: messages.id,
        channelId: messages.channelId,
        subject: messages.subject,
        snippet: messages.snippet,
        bodyText: messages.bodyText,
        status: messages.status,
        threadId: messages.threadId,
        headerMessageId: messages.headerMessageId,
        direction: messages.direction,
        sentAt: messages.sentAt,
      })
      .from(messages)
      .where(and(eq(messages.id, messageId), eq(messages.tenantId, tenantId)))
      .limit(1);

    if (!message) {
      res.status(404).json({ success: false, error: 'message not found' });
      return;
    }

    // Owner-only visibility for Phase 2c (Phase 2d will broaden via channel.visibility).
    const channel = await getChannelById({ channelId: message.channelId, userId, tenantId });
    if (!channel) {
      res.status(404).json({ success: false, error: 'message not found' });
      return;
    }

    res.json({ success: true, data: message });
  } catch (error) {
    logger.error({ error }, 'Failed to load message');
    res.status(500).json({ success: false, error: 'Failed to load message' });
  }
}
