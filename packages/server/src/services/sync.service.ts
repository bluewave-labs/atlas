import { eq, and, inArray, sql } from 'drizzle-orm';
import { db } from '../config/database';
import {
  accounts,
  threads,
  emails,
  attachments,
  contacts,
  categoryRules,
} from '../db/schema';
import {
  listMessageIds,
  batchGetMessages,
  getHistory,
  getMessage,
  getProfile,
} from './gmail.service';
import { parseGmailMessage, extractAttachments } from '../utils/gmail-parser';
import { categorizeEmail } from '@atlasmail/shared';
import { logger } from '../utils/logger';
import type { CategoryRule } from '@atlasmail/shared';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect all email addresses from parsed message for contact tracking. */
function collectAddresses(
  parsed: ReturnType<typeof parseGmailMessage>,
): Array<{ email: string; name: string | null }> {
  const result: Array<{ email: string; name: string | null }> = [];

  if (parsed.fromAddress) {
    result.push({ email: parsed.fromAddress.toLowerCase(), name: parsed.fromName });
  }

  for (const addr of parsed.toAddresses as Array<{ address: string; name?: string }>) {
    if (addr.address) result.push({ email: addr.address.toLowerCase(), name: addr.name || null });
  }
  for (const addr of parsed.ccAddresses as Array<{ address: string; name?: string }>) {
    if (addr.address) result.push({ email: addr.address.toLowerCase(), name: addr.name || null });
  }

  return result;
}

/** Derive thread-level flags from a set of Gmail labels. */
function deriveThreadFlags(gmailLabels: string[]) {
  return {
    isStarred: gmailLabels.includes('STARRED'),
    isArchived: !gmailLabels.includes('INBOX'),
    isTrashed: gmailLabels.includes('TRASH'),
    isSpam: gmailLabels.includes('SPAM'),
  };
}

/** Small delay helper for rate-limit pacing. */
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch category rules and high-frequency contact emails for an account.
 * These are needed by the shared `categorizeEmail` function.
 */
async function loadCategorizationContext(accountId: string) {
  const rules = await db
    .select()
    .from(categoryRules)
    .where(
      and(eq(categoryRules.accountId, accountId), eq(categoryRules.isEnabled, true)),
    );

  // Cast to the shared CategoryRule type
  const typedRules: CategoryRule[] = rules.map((r) => ({
    id: r.id,
    accountId: r.accountId,
    name: r.name,
    category: r.category as CategoryRule['category'],
    priority: r.priority,
    conditions: r.conditions as CategoryRule['conditions'],
    isSystem: r.isSystem,
    isEnabled: r.isEnabled,
  }));

  // Top contacts by frequency — used for "important" classification
  const topContacts = await db
    .select({ email: contacts.email })
    .from(contacts)
    .where(eq(contacts.accountId, accountId))
    .orderBy(sql`${contacts.frequency} DESC`)
    .limit(500);

  const contactEmails = topContacts.map((c) => c.email.toLowerCase());

  return { rules: typedRules, contactEmails };
}

// ---------------------------------------------------------------------------
// Core: process a batch of raw Gmail messages into DB
// ---------------------------------------------------------------------------

async function processMessages(
  accountId: string,
  rawMessages: any[],
  rules: CategoryRule[],
  contactEmails: string[],
) {
  for (const rawMsg of rawMessages) {
    const parsed = parseGmailMessage(rawMsg);
    const attachmentsList = extractAttachments(rawMsg);

    // Build an email-shaped object the categorizer can consume.
    // We don't have the DB id yet, so use a placeholder.
    const emailForCategorizer = {
      id: '',
      accountId,
      threadId: '',
      gmailMessageId: parsed.gmailMessageId,
      messageIdHeader: parsed.messageIdHeader,
      inReplyTo: parsed.inReplyTo,
      referencesHeader: parsed.referencesHeader,
      fromAddress: parsed.fromAddress,
      fromName: parsed.fromName,
      toAddresses: parsed.toAddresses as any[],
      ccAddresses: parsed.ccAddresses as any[],
      bccAddresses: [] as any[],
      replyTo: parsed.replyTo,
      subject: parsed.subject,
      snippet: parsed.snippet,
      bodyText: parsed.bodyText,
      bodyHtml: parsed.bodyHtml,
      gmailLabels: parsed.gmailLabels,
      isUnread: parsed.isUnread,
      isStarred: parsed.isStarred,
      isDraft: parsed.isDraft,
      internalDate: parsed.internalDate,
      receivedAt: null,
      sizeEstimate: parsed.sizeEstimate,
      attachments: attachmentsList.map((a: any) => ({
        id: '',
        emailId: '',
        ...a,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const category = categorizeEmail(emailForCategorizer as any, rules, contactEmails);
    const flags = deriveThreadFlags(parsed.gmailLabels);
    const now = new Date().toISOString();
    const internalDateISO = new Date(parsed.internalDate).toISOString();

    // --- Upsert thread ---
    // On conflict we do NOT blindly increment messageCount/unreadCount because
    // processMessages is called from both the initial full sync (where each
    // message is seen exactly once) and from incremental sync (where a message
    // may have already been stored). Incrementing would double-count on
    // subsequent runs. Instead we update only the metadata fields that are safe
    // to overwrite; reconcileThreadCounts() is called after each batch to
    // compute accurate counts from the emails table.
    const [upsertedThread] = await db
      .insert(threads)
      .values({
        accountId,
        gmailThreadId: parsed.gmailThreadId,
        subject: parsed.subject,
        snippet: parsed.snippet,
        messageCount: 1,
        unreadCount: parsed.isUnread ? 1 : 0,
        hasAttachments: attachmentsList.length > 0,
        lastMessageAt: internalDateISO,
        category,
        labels: parsed.gmailLabels,
        isStarred: flags.isStarred,
        isArchived: flags.isArchived,
        isTrashed: flags.isTrashed,
        isSpam: flags.isSpam,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [threads.accountId, threads.gmailThreadId],
        set: {
          snippet: parsed.snippet,
          hasAttachments: attachmentsList.length > 0
            ? true
            : sql`${threads.hasAttachments}`,
          lastMessageAt: sql`MAX(${threads.lastMessageAt}, ${internalDateISO})`,
          category,
          labels: parsed.gmailLabels,
          isStarred: flags.isStarred,
          isArchived: flags.isArchived,
          isTrashed: flags.isTrashed,
          isSpam: flags.isSpam,
          updatedAt: now,
        },
      })
      .returning({ id: threads.id });

    const threadId = upsertedThread.id;

    // --- Upsert email ---
    const [upsertedEmail] = await db
      .insert(emails)
      .values({
        accountId,
        threadId,
        gmailMessageId: parsed.gmailMessageId,
        messageIdHeader: parsed.messageIdHeader,
        inReplyTo: parsed.inReplyTo,
        referencesHeader: parsed.referencesHeader,
        fromAddress: parsed.fromAddress,
        fromName: parsed.fromName,
        toAddresses: parsed.toAddresses,
        ccAddresses: parsed.ccAddresses,
        bccAddresses: parsed.bccAddresses || [],
        replyTo: parsed.replyTo,
        subject: parsed.subject,
        snippet: parsed.snippet,
        bodyText: parsed.bodyText,
        bodyHtml: parsed.bodyHtml,
        gmailLabels: parsed.gmailLabels,
        isUnread: parsed.isUnread,
        isStarred: parsed.isStarred,
        isDraft: parsed.isDraft,
        internalDate: internalDateISO,
        sizeEstimate: parsed.sizeEstimate,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [emails.accountId, emails.gmailMessageId],
        set: {
          gmailLabels: parsed.gmailLabels,
          isUnread: parsed.isUnread,
          isStarred: parsed.isStarred,
          isDraft: parsed.isDraft,
          updatedAt: now,
        },
      })
      .returning({ id: emails.id });

    const emailId = upsertedEmail.id;

    // --- Attachments ---
    if (attachmentsList.length > 0) {
      for (const att of attachmentsList) {
        await db
          .insert(attachments)
          .values({
            emailId,
            gmailAttachmentId: att.gmailAttachmentId,
            filename: att.filename,
            mimeType: att.mimeType,
            size: att.size,
            contentId: att.contentId,
            isInline: att.isInline,
          })
          .onConflictDoNothing();
      }
    }

    // --- Contacts frequency ---
    const addrs = collectAddresses(parsed);
    for (const addr of addrs) {
      await db
        .insert(contacts)
        .values({
          accountId,
          email: addr.email,
          name: addr.name,
          frequency: 1,
          lastContacted: internalDateISO,
        })
        .onConflictDoUpdate({
          target: [contacts.accountId, contacts.email],
          set: {
            name: sql`COALESCE(${addr.name}, ${contacts.name})`,
            frequency: sql`${contacts.frequency} + 1`,
            lastContacted: sql`MAX(${contacts.lastContacted}, ${internalDateISO})`,
          },
        });
    }
  }
}

// ---------------------------------------------------------------------------
// Full sync
// ---------------------------------------------------------------------------

export async function fullSync(accountId: string) {
  const log = logger.child({ accountId, sync: 'full' });
  log.info('Starting full sync');

  try {
    // Mark as syncing
    await db
      .update(accounts)
      .set({ syncStatus: 'syncing', syncError: null, updatedAt: new Date().toISOString() })
      .where(eq(accounts.id, accountId));

    // Load categorization context
    const { rules, contactEmails } = await loadCategorizationContext(accountId);

    // Paginate through all message IDs
    const allMessageIds: string[] = [];
    let pageToken: string | null = null;

    do {
      const page = await listMessageIds(
        accountId,
        undefined, // no query filter — get everything
        pageToken || undefined,
        500,
      );
      allMessageIds.push(...page.messageIds);
      pageToken = page.nextPageToken;

      // Pace ourselves to stay within Gmail quota (250 units/sec).
      // A messages.list costs 5 units. Batching will add more.
      if (pageToken) await delay(200);
    } while (pageToken);

    log.info({ messageCount: allMessageIds.length }, 'Fetched all message IDs');

    // Batch fetch messages 50 at a time
    const BATCH_SIZE = 50;
    for (let i = 0; i < allMessageIds.length; i += BATCH_SIZE) {
      const batchIds = allMessageIds.slice(i, i + BATCH_SIZE);
      const rawMessages = await batchGetMessages(accountId, batchIds);

      await processMessages(accountId, rawMessages, rules, contactEmails);

      log.debug(
        { processed: Math.min(i + BATCH_SIZE, allMessageIds.length), total: allMessageIds.length },
        'Batch processed',
      );

      // Rate-limit pacing: each getMessage is 5 quota units.
      // 50 messages = 250 units. Wait ~1s between batches.
      if (i + BATCH_SIZE < allMessageIds.length) await delay(1000);
    }

    // After processing all messages, recompute accurate thread counts.
    // The upsert increments can double-count on re-sync, so reconcile.
    await reconcileThreadCounts(accountId);

    // Fetch current historyId from Gmail profile for future incremental syncs
    const profile = await getProfile(accountId);
    const historyId = profile.historyId ? parseInt(profile.historyId, 10) : null;

    const syncNow = new Date().toISOString();
    await db
      .update(accounts)
      .set({
        historyId,
        lastFullSync: syncNow,
        lastSync: syncNow,
        syncStatus: 'idle',
        syncError: null,
        updatedAt: syncNow,
      })
      .where(eq(accounts.id, accountId));

    log.info({ messageCount: allMessageIds.length, historyId }, 'Full sync complete');
  } catch (err: any) {
    log.error({ err }, 'Full sync failed');

    const status = err?.code || err?.response?.status;
    const isAuthError = status === 401 || status === 403
      || err?.message?.includes('invalid_grant')
      || err?.message?.includes('Token has been expired or revoked');

    await db
      .update(accounts)
      .set({
        syncStatus: isAuthError ? 'auth_error' : 'error',
        syncError: err.message || 'Unknown error during full sync',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(accounts.id, accountId));

    throw err;
  }
}

// ---------------------------------------------------------------------------
// Incremental sync
// ---------------------------------------------------------------------------

export async function incrementalSync(accountId: string) {
  const log = logger.child({ accountId, sync: 'incremental' });

  try {
    // Load account to get current historyId
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .limit(1);

    if (!account) {
      log.warn('Account not found, skipping incremental sync');
      return;
    }

    if (!account.historyId) {
      log.info('No historyId stored, falling back to full sync');
      await fullSync(accountId);
      return;
    }

    // Mark as syncing
    await db
      .update(accounts)
      .set({ syncStatus: 'syncing', syncError: null, updatedAt: new Date().toISOString() })
      .where(eq(accounts.id, accountId));

    const historyData = await getHistory(accountId, String(account.historyId));

    // If history is empty (no changes), just update lastSync
    if (!historyData.history || historyData.history.length === 0) {
      const newHistoryId = historyData.historyId
        ? parseInt(historyData.historyId, 10)
        : account.historyId;

      await db
        .update(accounts)
        .set({
          historyId: newHistoryId,
          lastSync: new Date().toISOString(),
          syncStatus: 'idle',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(accounts.id, accountId));

      log.debug('No history changes, sync complete');
      return;
    }

    const { rules, contactEmails } = await loadCategorizationContext(accountId);

    // Collect events from history
    const addedMessageIds = new Set<string>();
    const deletedMessageIds = new Set<string>();
    const labelChangedMessageIds = new Set<string>();

    for (const record of historyData.history) {
      // Messages added
      if (record.messagesAdded) {
        for (const added of record.messagesAdded) {
          if (added.message?.id) addedMessageIds.add(added.message.id);
        }
      }

      // Messages deleted
      if (record.messagesDeleted) {
        for (const deleted of record.messagesDeleted) {
          if (deleted.message?.id) deletedMessageIds.add(deleted.message.id);
        }
      }

      // Label changes (added or removed)
      if (record.labelsAdded) {
        for (const change of record.labelsAdded) {
          if (change.message?.id) labelChangedMessageIds.add(change.message.id);
        }
      }

      if (record.labelsRemoved) {
        for (const change of record.labelsRemoved) {
          if (change.message?.id) labelChangedMessageIds.add(change.message.id);
        }
      }
    }

    // Remove from addedMessageIds anything that was also deleted
    for (const id of deletedMessageIds) {
      addedMessageIds.delete(id);
      labelChangedMessageIds.delete(id);
    }

    // Remove from labelChanged anything we'll fully process as new
    for (const id of addedMessageIds) {
      labelChangedMessageIds.delete(id);
    }

    log.info(
      {
        added: addedMessageIds.size,
        deleted: deletedMessageIds.size,
        labelChanged: labelChangedMessageIds.size,
      },
      'Processing history events',
    );

    // --- Process new messages ---
    if (addedMessageIds.size > 0) {
      const ids = Array.from(addedMessageIds);
      const BATCH_SIZE = 50;
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batchIds = ids.slice(i, i + BATCH_SIZE);
        const rawMessages = await batchGetMessages(accountId, batchIds);
        await processMessages(accountId, rawMessages, rules, contactEmails);

        if (i + BATCH_SIZE < ids.length) await delay(1000);
      }
    }

    // --- Process label changes ---
    if (labelChangedMessageIds.size > 0) {
      const ids = Array.from(labelChangedMessageIds);
      for (const msgId of ids) {
        try {
          const rawMsg = await getMessage(accountId, msgId);
          const labels: string[] = rawMsg.labelIds || [];
          const flags = deriveThreadFlags(labels);

          // Update the email record
          await db
            .update(emails)
            .set({
              gmailLabels: labels,
              isUnread: labels.includes('UNREAD'),
              isStarred: labels.includes('STARRED'),
              isDraft: labels.includes('DRAFT'),
              updatedAt: new Date().toISOString(),
            })
            .where(
              and(
                eq(emails.accountId, accountId),
                eq(emails.gmailMessageId, msgId),
              ),
            );

          // Find the thread this email belongs to
          const [emailRecord] = await db
            .select({ threadId: emails.threadId })
            .from(emails)
            .where(
              and(
                eq(emails.accountId, accountId),
                eq(emails.gmailMessageId, msgId),
              ),
            )
            .limit(1);

          if (emailRecord) {
            await db
              .update(threads)
              .set({
                isStarred: flags.isStarred,
                isArchived: flags.isArchived,
                isTrashed: flags.isTrashed,
                isSpam: flags.isSpam,
                labels,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(threads.id, emailRecord.threadId));
          }
        } catch (err: any) {
          // If message was permanently deleted, Gmail returns 404
          if (err?.code === 404 || err?.response?.status === 404) {
            deletedMessageIds.add(msgId);
          } else {
            log.warn({ err, msgId }, 'Failed to process label change');
          }
        }

        // Small delay between individual fetches
        await delay(50);
      }
    }

    // --- Process deletions ---
    if (deletedMessageIds.size > 0) {
      const ids = Array.from(deletedMessageIds);

      // Find all email records to get their thread IDs before deleting
      const emailRecords = await db
        .select({ id: emails.id, threadId: emails.threadId })
        .from(emails)
        .where(
          and(
            eq(emails.accountId, accountId),
            inArray(emails.gmailMessageId, ids),
          ),
        );

      const affectedThreadIds = [...new Set(emailRecords.map((e) => e.threadId))];

      // Delete emails (attachments cascade)
      if (emailRecords.length > 0) {
        await db
          .delete(emails)
          .where(
            inArray(
              emails.id,
              emailRecords.map((e) => e.id),
            ),
          );
      }

      // Clean up threads: delete empty threads, recompute counts for others
      for (const threadId of affectedThreadIds) {
        const remaining = await db
          .select({ count: sql<number>`count(*)` })
          .from(emails)
          .where(eq(emails.threadId, threadId));

        const count = remaining[0]?.count ?? 0;
        if (count === 0) {
          await db.delete(threads).where(eq(threads.id, threadId));
        } else {
          await recomputeThreadStats(threadId);
        }
      }
    }

    // Reconcile thread counts for threads that had new messages added
    if (addedMessageIds.size > 0) {
      await reconcileThreadCounts(accountId);
    }

    // Update historyId
    const newHistoryId = historyData.historyId
      ? parseInt(historyData.historyId, 10)
      : account.historyId;

    await db
      .update(accounts)
      .set({
        historyId: newHistoryId,
        lastSync: new Date().toISOString(),
        syncStatus: 'idle',
        syncError: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(accounts.id, accountId));

    log.info({ newHistoryId }, 'Incremental sync complete');
  } catch (err: any) {
    log.error({ err }, 'Incremental sync failed');

    // If history is too old (410 Gone), fall back to full sync
    if (err?.code === 410 || err?.response?.status === 410) {
      log.info('History expired (410 Gone), falling back to full sync');
      await fullSync(accountId);
      return;
    }

    const status = err?.code || err?.response?.status;
    const isAuthError = status === 401 || status === 403
      || err?.message?.includes('invalid_grant')
      || err?.message?.includes('Token has been expired or revoked');

    await db
      .update(accounts)
      .set({
        syncStatus: isAuthError ? 'auth_error' : 'error',
        syncError: err.message || 'Unknown error during incremental sync',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(accounts.id, accountId));

    throw err;
  }
}

// ---------------------------------------------------------------------------
// Thread count reconciliation
// ---------------------------------------------------------------------------

/**
 * Recompute stats for a single thread from its email records.
 */
async function recomputeThreadStats(threadId: string) {
  const stats = await db
    .select({
      messageCount: sql<number>`count(*)`,
      unreadCount: sql<number>`SUM(CASE WHEN ${emails.isUnread} = 1 THEN 1 ELSE 0 END)`,
      hasAttachments: sql<number>`MAX(CASE WHEN EXISTS (
        SELECT 1 FROM attachments WHERE attachments.email_id = ${emails.id}
      ) THEN 1 ELSE 0 END)`,
      lastMessageAt: sql<string>`max(${emails.internalDate})`,
      snippet: sql<string>`(
        SELECT e2.snippet FROM emails e2
        WHERE e2.thread_id = ${threadId}
        ORDER BY e2.internal_date DESC LIMIT 1
      )`,
    })
    .from(emails)
    .where(eq(emails.threadId, threadId))
    .groupBy(emails.threadId);

  if (stats.length > 0) {
    await db
      .update(threads)
      .set({
        messageCount: stats[0].messageCount,
        unreadCount: stats[0].unreadCount,
        hasAttachments: stats[0].hasAttachments === 1,
        lastMessageAt: stats[0].lastMessageAt,
        snippet: stats[0].snippet,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(threads.id, threadId));
  }
}

/**
 * Reconcile message counts for all threads in an account.
 * Called after full sync to fix any double-counting from upsert increments.
 */
async function reconcileThreadCounts(accountId: string) {
  const now = new Date().toISOString();
  db.run(sql`
    UPDATE threads SET
      message_count = (
        SELECT count(*) FROM emails e WHERE e.thread_id = threads.id
      ),
      unread_count = (
        SELECT SUM(CASE WHEN e.is_unread = 1 THEN 1 ELSE 0 END) FROM emails e WHERE e.thread_id = threads.id
      ),
      has_attachments = (
        SELECT MAX(CASE WHEN EXISTS (
          SELECT 1 FROM attachments a WHERE a.email_id = e.id
        ) THEN 1 ELSE 0 END) FROM emails e WHERE e.thread_id = threads.id
      ),
      last_message_at = (
        SELECT max(e.internal_date) FROM emails e WHERE e.thread_id = threads.id
      ),
      snippet = (
        SELECT e2.snippet FROM emails e2
        WHERE e2.thread_id = threads.id
        ORDER BY e2.internal_date DESC LIMIT 1
      ),
      updated_at = ${now}
    WHERE threads.account_id = ${accountId}
  `);
}

// ---------------------------------------------------------------------------
// Trigger initial sync (called after OAuth callback)
// ---------------------------------------------------------------------------

export async function triggerInitialSync(accountId: string) {
  // Try to enqueue via Redis/BullMQ first for proper job management.
  // Fall back to running the sync directly if Redis is not configured.
  const { addFullSyncJob } = await import('../jobs/sync-worker');
  const { env } = await import('../config/env');

  if (env.REDIS_URL) {
    await addFullSyncJob(accountId);
    logger.info({ accountId }, 'Initial full sync job enqueued');
  } else {
    logger.info({ accountId }, 'No Redis — running initial full sync directly');
    // Run in background so the auth callback response isn't delayed
    fullSync(accountId).catch((err) =>
      logger.error({ err, accountId }, 'Direct initial full sync failed'),
    );
  }
}
