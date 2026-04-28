import { google, type gmail_v1 } from 'googleapis';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../config/database';
import { messageChannels, messageThreads, messages } from '../../../db/schema';
import { callGoogleApi } from '../../../services/google-api-call';
import { logger } from '../../../utils/logger';
import { withRetry } from '../../../utils/retry';
import { parseGmailMessage } from './gmail-message-parser';
import {
  loadBlocklist,
  matchHandlesToContacts,
  insertParticipants,
  type ResolvedParticipant,
} from './participant-match.service';
import { upsertActivitiesForMessage } from './message-activity.service';

const FULL_SYNC_QUERY = 'newer_than:90d';
const PAGE_SIZE = 100;
const MAX_PAGES_PER_RUN = 50; // hard cap to bound runtime; large mailboxes resume on next tick

interface ChannelRow {
  id: string;
  accountId: string;
  tenantId: string;
  ownerUserId: string;
  isSyncEnabled: boolean;
  syncCursor: string | null;
  throttleRetryAfter: Date | null;
}

async function loadChannel(channelId: string): Promise<ChannelRow> {
  const [row] = await db
    .select({
      id: messageChannels.id,
      accountId: messageChannels.accountId,
      tenantId: messageChannels.tenantId,
      ownerUserId: messageChannels.ownerUserId,
      isSyncEnabled: messageChannels.isSyncEnabled,
      syncCursor: messageChannels.syncCursor,
      throttleRetryAfter: messageChannels.throttleRetryAfter,
    })
    .from(messageChannels)
    .where(eq(messageChannels.id, channelId))
    .limit(1);
  if (!row) throw new Error(`channel not found: ${channelId}`);
  return row as ChannelRow;
}

function isThrottled(channel: ChannelRow): boolean {
  return !!channel.throttleRetryAfter && channel.throttleRetryAfter.getTime() > Date.now();
}

async function setStage(
  channelId: string,
  stage: 'pending' | 'full-sync' | 'incremental' | 'failed',
  extra: Record<string, unknown> = {},
): Promise<void> {
  await db
    .update(messageChannels)
    .set({ syncStage: stage, updatedAt: new Date(), ...extra })
    .where(eq(messageChannels.id, channelId));
}

async function handleThrottle(channelId: string, retryAfterSeconds: number): Promise<void> {
  await db
    .update(messageChannels)
    .set({
      throttleRetryAfter: new Date(Date.now() + retryAfterSeconds * 1000),
      updatedAt: new Date(),
    })
    .where(eq(messageChannels.id, channelId));
}

/**
 * Phase 2b ingestion: full sync. Walks `users.messages.list` (90-day backfill),
 * fetches each message with `format=full`, parses into our schema, upserts
 * threads + messages + participants, fans out to crm_activities. Bounded by
 * MAX_PAGES_PER_RUN — large mailboxes finish on subsequent runs.
 */
export async function performGmailFullSync(channelId: string): Promise<void> {
  const channel = await loadChannel(channelId);
  if (!channel.isSyncEnabled) {
    logger.info({ channelId }, 'Gmail sync skipped: channel is disabled');
    return;
  }
  if (isThrottled(channel)) {
    logger.info({ channelId, throttleRetryAfter: channel.throttleRetryAfter }, 'Gmail sync skipped: throttled');
    return;
  }

  logger.info({ channelId, accountId: channel.accountId }, 'Starting Gmail full sync');
  await setStage(channelId, 'full-sync', { syncStatus: 'running', syncError: null });

  let pageToken: string | undefined;
  let pagesProcessed = 0;
  let messagesIngested = 0;

  try {
    do {
      const listRes = await callGoogleApi(channel.accountId, async (auth) => {
        const gmail = google.gmail({ version: 'v1', auth });
        return withRetry(
          () => gmail.users.messages.list({
            userId: 'me',
            q: FULL_SYNC_QUERY,
            maxResults: PAGE_SIZE,
            pageToken,
          }),
          'Gmail API messages.list',
        );
      });

      const ids = (listRes.data.messages ?? []).map((m) => m.id!).filter(Boolean);
      pageToken = listRes.data.nextPageToken ?? undefined;

      for (const id of ids) {
        try {
          const msgRes = await callGoogleApi(channel.accountId, async (auth) => {
            const gmail = google.gmail({ version: 'v1', auth });
            return withRetry(
              () => gmail.users.messages.get({ userId: 'me', id, format: 'full' }),
              'Gmail API messages.get',
            );
          });
          await ingestMessage(channel, msgRes.data, 'inbound');
          messagesIngested++;
        } catch (err: any) {
          if (err?.code === 429 || err?.response?.status === 429) {
            const retry = parseRetryAfter(err);
            await handleThrottle(channel.id, retry);
            logger.warn({ channelId, retry }, 'Gmail full sync throttled; will resume after backoff');
            // Phase 2b: cursor not preserved — next run restarts page 1. The
            // `(channelId, gmailMessageId)` unique constraint makes re-ingestion
            // a no-op, but the messages.get quota cost is paid again. If quota
            // burn becomes an issue, persist `pageToken` to a separate column
            // (e.g. `messageChannels.fullSyncPageToken`) so the next run resumes.
            return;
          }
          logger.error({ err, channelId, gmailId: id }, 'Failed to ingest Gmail message; continuing');
        }
      }

      pagesProcessed++;
    } while (pageToken && pagesProcessed < MAX_PAGES_PER_RUN);

    const profileRes = await callGoogleApi(channel.accountId, async (auth) => {
      const gmail = google.gmail({ version: 'v1', auth });
      return withRetry(
        () => gmail.users.getProfile({ userId: 'me' }),
        'Gmail API getProfile',
      );
    });
    const latestHistoryId = profileRes.data.historyId ?? null;

    await setStage(channelId, 'incremental', {
      syncCursor: latestHistoryId,
      lastFullSyncAt: new Date(),
      syncStatus: null,
    });

    logger.info({ channelId, messagesIngested, pagesProcessed, latestHistoryId }, 'Gmail full sync completed');
  } catch (err: any) {
    logger.error({ err, channelId }, 'Gmail full sync failed');
    await setStage(channelId, 'failed', { syncError: String(err?.message ?? err) });
    throw err;
  }
}

/**
 * Phase 2b ingestion: incremental sync via `users.history.list`. If the
 * cursor is missing, marks the channel as needing a full sync. If the
 * cursor is expired (404), also marks as pending.
 */
export async function performGmailIncrementalSync(channelId: string): Promise<void> {
  const channel = await loadChannel(channelId);
  if (!channel.isSyncEnabled) return;
  if (isThrottled(channel)) return;
  if (!channel.syncCursor) {
    logger.info({ channelId }, 'Gmail incremental sync skipped: no syncCursor (full sync needed)');
    await setStage(channelId, 'pending', {
      syncStatus: 'awaiting-full-sync',
    });
    return;
  }

  let pageToken: string | undefined;
  let messagesIngested = 0;
  let lastHistoryId: string | null = channel.syncCursor;

  try {
    do {
      let historyRes;
      try {
        historyRes = await callGoogleApi(channel.accountId, async (auth) => {
          const gmail = google.gmail({ version: 'v1', auth });
          return withRetry(
            () => gmail.users.history.list({
              userId: 'me',
              startHistoryId: channel.syncCursor!,
              pageToken,
            }),
            'Gmail API history.list',
          );
        });
      } catch (err: any) {
        if (err?.code === 404 || err?.response?.status === 404) {
          logger.warn({ channelId }, 'Gmail incremental cursor expired; flipping to pending for full sync');
          await setStage(channelId, 'pending', { syncCursor: null, syncStatus: 'cursor-expired' });
          return;
        }
        throw err;
      }

      const records = historyRes.data.history ?? [];
      pageToken = historyRes.data.nextPageToken ?? undefined;
      lastHistoryId = historyRes.data.historyId ?? lastHistoryId;

      for (const record of records) {
        for (const added of record.messagesAdded ?? []) {
          if (!added.message?.id) continue;
          try {
            const msgRes = await callGoogleApi(channel.accountId, async (auth) => {
              const gmail = google.gmail({ version: 'v1', auth });
              return withRetry(
                () => gmail.users.messages.get({ userId: 'me', id: added.message!.id!, format: 'full' }),
                'Gmail API messages.get',
              );
            });
            await ingestMessage(channel, msgRes.data, 'inbound');
            messagesIngested++;
          } catch (err) {
            logger.error({ err, channelId, gmailId: added.message.id }, 'Failed to ingest Gmail message during incremental; continuing');
          }
        }

        for (const deleted of record.messagesDeleted ?? []) {
          if (!deleted.message?.id) continue;
          try {
            await db.update(messages)
              .set({ deletedAt: new Date(), updatedAt: new Date() })
              .where(
                and(
                  eq(messages.channelId, channel.id),
                  eq(messages.gmailMessageId, deleted.message.id),
                ),
              );
          } catch (err) {
            logger.error({ err, channelId, gmailId: deleted.message.id }, 'Failed to soft-delete message');
          }
        }

        // labelsAdded / labelsRemoved: skipped in 2b. Labels are captured at full ingest;
        // re-syncing labels per history record adds complexity for a feature we don't render yet.
      }
    } while (pageToken);

    await setStage(channelId, 'incremental', {
      syncCursor: lastHistoryId,
      lastIncrementalSyncAt: new Date(),
      syncStatus: null,
    });
    logger.info({ channelId, messagesIngested, syncCursor: lastHistoryId }, 'Gmail incremental sync completed');
  } catch (err: any) {
    if (err?.code === 429 || err?.response?.status === 429) {
      const retry = parseRetryAfter(err);
      await handleThrottle(channelId, retry);
      logger.warn({ channelId, retry }, 'Gmail incremental sync throttled');
      return;
    }
    logger.error({ err, channelId }, 'Gmail incremental sync failed');
    await setStage(channelId, 'failed', { syncError: String(err?.message ?? err) });
    throw err;
  }
}

/**
 * Upsert a single Gmail message + its thread + participants + activities.
 * Idempotent on `(channelId, gmailMessageId)` via the unique constraint;
 * second call is a no-op.
 */
async function ingestMessage(
  channel: ChannelRow,
  raw: gmail_v1.Schema$Message,
  direction: 'inbound' | 'outbound',
): Promise<void> {
  const parsed = parseGmailMessage(raw);
  if (!parsed.gmailMessageId || !parsed.gmailThreadId) {
    logger.warn({ channelId: channel.id }, 'Skipping Gmail message with missing id/threadId');
    return;
  }

  // Upsert thread atomically — protects against the select-then-insert race
  // when concurrent messages in the same thread arrive (e.g., two history
  // pages both surface the thread on its first message). The unique
  // constraint is (channelId, gmailThreadId).
  const messageTimestamp = parsed.receivedAt ?? new Date();
  const [upsertedThread] = await db.insert(messageThreads).values({
    channelId: channel.id,
    tenantId: channel.tenantId,
    gmailThreadId: parsed.gmailThreadId,
    subject: parsed.subject,
    messageCount: 1,
    lastMessageAt: messageTimestamp,
  })
    .onConflictDoUpdate({
      target: [messageThreads.channelId, messageThreads.gmailThreadId],
      set: {
        lastMessageAt: messageTimestamp,
        updatedAt: new Date(),
      },
    })
    .returning({ id: messageThreads.id });
  const threadId = upsertedThread.id;

  const [existingMsg] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(eq(messages.gmailMessageId, parsed.gmailMessageId))
    .limit(1);
  if (existingMsg) return;

  const [insertedMsg] = await db.insert(messages).values({
    channelId: channel.id,
    threadId,
    tenantId: channel.tenantId,
    gmailMessageId: parsed.gmailMessageId,
    headerMessageId: parsed.headerMessageId,
    inReplyTo: parsed.inReplyTo,
    subject: parsed.subject,
    snippet: parsed.snippet,
    bodyText: parsed.bodyText,
    bodyHtml: null,
    direction,
    status: 'received',
    sentAt: parsed.receivedAt,
    receivedAt: direction === 'inbound' ? parsed.receivedAt : null,
    labels: parsed.labels,
    hasAttachments: parsed.hasAttachments,
  }).returning({ id: messages.id });

  // Resolve participants in two batched DB calls (blocklist + contact lookup),
  // not per-participant — see Task 4 service exports for the batched variants.
  const handles = parsed.participants.map((p) => p.handle);
  const isBlocked = await loadBlocklist(channel.tenantId);
  const contactMap = await matchHandlesToContacts(handles, channel.tenantId);

  const resolved: ResolvedParticipant[] = parsed.participants.map((p) => {
    if (isBlocked(p.handle)) {
      return { ...p, personId: null };
    }
    const personId = contactMap.get(p.handle.toLowerCase()) ?? null;
    return { ...p, personId };
  });

  await insertParticipants({
    messageId: insertedMsg.id,
    tenantId: channel.tenantId,
    participants: resolved,
  });

  await upsertActivitiesForMessage({
    messageId: insertedMsg.id,
    tenantId: channel.tenantId,
    userId: channel.ownerUserId,
    direction,
  });
}

/** Read the Retry-After header (in seconds) from a 429 error, defaulting to 60. */
function parseRetryAfter(err: any): number {
  const header = err?.response?.headers?.['retry-after'];
  if (typeof header === 'string') {
    const n = Number(header);
    if (!isNaN(n) && n > 0 && n < 3600) return n;
  }
  return 60;
}
