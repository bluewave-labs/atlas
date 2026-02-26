import { eq, and, inArray, sql } from 'drizzle-orm';
import { gzipSync, gunzipSync } from 'node:zlib';
import { db, rawDb } from '../config/database';
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
  batchGetMessageMetadata,
  getHistory,
  getMessage,
  getProfile,
  watchMailbox,
} from './gmail.service';
import { parseGmailMessage, extractAttachments } from '../utils/gmail-parser';
import { categorizeEmail } from '@atlasmail/shared';
import { logger } from '../utils/logger';
import { env } from '../config/env';
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

// ---------------------------------------------------------------------------
// #9 — HTML body compression helpers
// ---------------------------------------------------------------------------

function compressHtml(html: string | null): string | null {
  if (!html) return null;
  return gzipSync(Buffer.from(html, 'utf8')).toString('base64');
}

export function decompressHtml(compressed: string | null): string | null {
  if (!compressed) return null;
  return gunzipSync(Buffer.from(compressed, 'base64')).toString('utf8');
}

// ---------------------------------------------------------------------------
// #3 — FTS5 index helpers (with mapping table for reliable rowid resolution)
// ---------------------------------------------------------------------------

// Create a mapping table: email UUID → integer FTS rowid
rawDb.prepare(`
  CREATE TABLE IF NOT EXISTS email_fts_map (
    fts_rowid INTEGER PRIMARY KEY AUTOINCREMENT,
    email_id TEXT NOT NULL UNIQUE
  )
`).run();

const ftsMapInsert = rawDb.prepare(
  `INSERT OR IGNORE INTO email_fts_map(email_id) VALUES (?)`,
);
const ftsMapLookup = rawDb.prepare(
  `SELECT fts_rowid FROM email_fts_map WHERE email_id = ?`,
);
const ftsMapLookupByRowids = (rowids: number[]) => {
  const placeholders = rowids.map(() => '?').join(',');
  return rawDb.prepare(
    `SELECT fts_rowid, email_id FROM email_fts_map WHERE fts_rowid IN (${placeholders})`,
  ).all(...rowids) as Array<{ fts_rowid: number; email_id: string }>;
};

const ftsInsertStmt = rawDb.prepare(
  `INSERT INTO email_fts(rowid, subject, body_text, from_address, from_name)
   VALUES (?, ?, ?, ?, ?)`,
);

const ftsDeleteStmt = rawDb.prepare(
  `INSERT INTO email_fts(email_fts, rowid, subject, body_text, from_address, from_name)
   VALUES ('delete', ?, ?, ?, ?, ?)`,
);

function ftsIndexEmail(emailId: string, subject: string | null, bodyText: string | null, fromAddress: string, fromName: string | null) {
  try {
    // Ensure a mapping row exists and get the integer rowid
    ftsMapInsert.run(emailId);
    const row = ftsMapLookup.get(emailId) as { fts_rowid: number } | undefined;
    if (!row) return;

    // Delete old entry then re-insert (handles re-indexing with updated body)
    try { ftsDeleteStmt.run(row.fts_rowid, subject || '', bodyText || '', fromAddress, fromName || ''); } catch { /* no prior entry */ }
    ftsInsertStmt.run(row.fts_rowid, subject || '', bodyText || '', fromAddress, fromName || '');
  } catch {
    // FTS index error — non-fatal
  }
}

function ftsDeleteEmail(emailId: string, subject: string | null, bodyText: string | null, fromAddress: string, fromName: string | null) {
  try {
    const row = ftsMapLookup.get(emailId) as { fts_rowid: number } | undefined;
    if (!row) return;
    ftsDeleteStmt.run(row.fts_rowid, subject || '', bodyText || '', fromAddress, fromName || '');
  } catch { /* ignore */ }
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
): Promise<Set<string>> {
  const touchedThreadIds = new Set<string>();

  for (const rawMsg of rawMessages) {
    const parsed = parseGmailMessage(rawMsg);
    const attachmentsList = extractAttachments(rawMsg);

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

    // #9 — Compress HTML body before storing
    const compressedHtml = compressHtml(parsed.bodyHtml);

    // --- Upsert thread ---
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
          // Only clear isArchived when this email has INBOX label;
          // never overwrite to true (another email in the thread may have INBOX)
          isArchived: flags.isArchived
            ? sql`${threads.isArchived}`
            : false,
          isTrashed: flags.isTrashed,
          isSpam: flags.isSpam,
          updatedAt: now,
        },
      })
      .returning({ id: threads.id });

    const threadId = upsertedThread.id;
    touchedThreadIds.add(threadId);

    // --- Upsert email (with compressed HTML) ---
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
        bodyHtmlCompressed: compressedHtml,
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
          bodyHtml: parsed.bodyHtml,
          bodyHtmlCompressed: compressedHtml,
          updatedAt: now,
        },
      })
      .returning({ id: emails.id });

    const emailId = upsertedEmail.id;

    // #3 — Index in FTS5
    ftsIndexEmail(emailId, parsed.subject, parsed.bodyText, parsed.fromAddress, parsed.fromName);

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

  return touchedThreadIds;
}

// ---------------------------------------------------------------------------
// #2 — Metadata-only processing (headers + snippet, no body)
// ---------------------------------------------------------------------------

async function processMetadataMessages(
  accountId: string,
  rawMessages: any[],
  rules: CategoryRule[],
  contactEmails: string[],
): Promise<Set<string>> {
  const touchedThreadIds = new Set<string>();

  for (const rawMsg of rawMessages) {
    const parsed = parseGmailMessage(rawMsg);

    const emailForCategorizer = {
      id: '', accountId, threadId: '',
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
      bodyText: null, bodyHtml: null, // no body in metadata mode
      gmailLabels: parsed.gmailLabels,
      isUnread: parsed.isUnread,
      isStarred: parsed.isStarred,
      isDraft: parsed.isDraft,
      internalDate: parsed.internalDate,
      receivedAt: null,
      sizeEstimate: parsed.sizeEstimate,
      attachments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const category = categorizeEmail(emailForCategorizer as any, rules, contactEmails);
    const flags = deriveThreadFlags(parsed.gmailLabels);
    const now = new Date().toISOString();
    const internalDateISO = new Date(parsed.internalDate).toISOString();

    const [upsertedThread] = await db
      .insert(threads)
      .values({
        accountId,
        gmailThreadId: parsed.gmailThreadId,
        subject: parsed.subject,
        snippet: parsed.snippet,
        messageCount: 1,
        unreadCount: parsed.isUnread ? 1 : 0,
        hasAttachments: false,
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
          lastMessageAt: sql`MAX(${threads.lastMessageAt}, ${internalDateISO})`,
          category,
          labels: parsed.gmailLabels,
          isStarred: flags.isStarred,
          // Only clear isArchived when this email has INBOX label;
          // never overwrite to true (another email in the thread may have INBOX)
          isArchived: flags.isArchived
            ? sql`${threads.isArchived}`
            : false,
          isTrashed: flags.isTrashed,
          isSpam: flags.isSpam,
          updatedAt: now,
        },
      })
      .returning({ id: threads.id });

    const threadId = upsertedThread.id;
    touchedThreadIds.add(threadId);

    // Upsert email with NULL body — body fetched on-demand when thread is opened
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
        bodyText: null,
        bodyHtml: null,
        bodyHtmlCompressed: null,
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

    // FTS index with just headers (body will be indexed when fetched on-demand)
    const emailRow = upsertedEmail;
    if (emailRow) {
      ftsIndexEmail(emailRow.id, parsed.subject, null, parsed.fromAddress, parsed.fromName);
    }

    // Contacts
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

  return touchedThreadIds;
}

// ---------------------------------------------------------------------------
// Full sync — #2 uses metadata-first for speed
// ---------------------------------------------------------------------------

export async function fullSync(accountId: string) {
  const log = logger.child({ accountId, sync: 'full' });
  log.info('Starting full sync');

  try {
    await db
      .update(accounts)
      .set({ syncStatus: 'syncing', syncError: null, updatedAt: new Date().toISOString() })
      .where(eq(accounts.id, accountId));

    const { rules, contactEmails } = await loadCategorizationContext(accountId);

    // Paginate through all message IDs
    const allMessageIds: string[] = [];
    let pageToken: string | null = null;

    do {
      const page = await listMessageIds(accountId, undefined, pageToken || undefined, 500);
      allMessageIds.push(...page.messageIds);
      pageToken = page.nextPageToken;
      if (pageToken) await delay(200);
    } while (pageToken);

    log.info({ messageCount: allMessageIds.length }, 'Fetched all message IDs');

    // #2 — Metadata-first: fetch headers only during full sync (5-10x faster)
    // Bodies are fetched on-demand when the user opens a thread.
    const BATCH_SIZE = 50;
    const allTouchedThreadIds = new Set<string>();

    for (let i = 0; i < allMessageIds.length; i += BATCH_SIZE) {
      const batchIds = allMessageIds.slice(i, i + BATCH_SIZE);
      const rawMessages = await batchGetMessageMetadata(accountId, batchIds);

      const touched = await processMetadataMessages(accountId, rawMessages, rules, contactEmails);
      for (const id of touched) allTouchedThreadIds.add(id);

      log.debug(
        { processed: Math.min(i + BATCH_SIZE, allMessageIds.length), total: allMessageIds.length },
        'Batch processed (metadata)',
      );

      if (i + BATCH_SIZE < allMessageIds.length) await delay(1000);
    }

    // #7 — Selective thread reconciliation: only recount touched threads
    await reconcileThreadCountsSelective(allTouchedThreadIds);

    // Fetch current historyId for future incremental syncs
    const profile = await getProfile(accountId);
    const historyId = profile.historyId ? parseInt(profile.historyId, 10) : null;

    const syncNow = new Date().toISOString();

    // #1 — Register Gmail push notifications if Pub/Sub topic is configured
    let watchExpiration: number | null = null;
    if (env.GOOGLE_PUBSUB_TOPIC) {
      try {
        const watchResult = await watchMailbox(accountId, env.GOOGLE_PUBSUB_TOPIC);
        watchExpiration = watchResult.expiration ? parseInt(String(watchResult.expiration), 10) : null;
        log.info({ watchExpiration }, 'Gmail push watch registered');
      } catch (err: any) {
        log.warn({ err }, 'Failed to register Gmail push watch — falling back to polling');
      }
    }

    await db
      .update(accounts)
      .set({
        historyId,
        lastFullSync: syncNow,
        lastSync: syncNow,
        syncStatus: 'idle',
        syncError: null,
        watchExpiration,
        updatedAt: syncNow,
      })
      .where(eq(accounts.id, accountId));

    log.info({ messageCount: allMessageIds.length, historyId }, 'Full sync complete');

    // Sync Google Contacts in the background (non-blocking)
    import('./contacts.service').then(({ syncGoogleContacts }) =>
      syncGoogleContacts(accountId).catch((e) =>
        log.warn({ err: e }, 'Google Contacts sync failed (non-blocking)'),
      ),
    );
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
// Incremental sync — #4 batches label changes
// ---------------------------------------------------------------------------

export async function incrementalSync(accountId: string) {
  const log = logger.child({ accountId, sync: 'incremental' });

  try {
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

    await db
      .update(accounts)
      .set({ syncStatus: 'syncing', syncError: null, updatedAt: new Date().toISOString() })
      .where(eq(accounts.id, accountId));

    const historyData = await getHistory(accountId, String(account.historyId));

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

    const addedMessageIds = new Set<string>();
    const deletedMessageIds = new Set<string>();
    const labelChangedMessageIds = new Set<string>();

    for (const record of historyData.history) {
      if (record.messagesAdded) {
        for (const added of record.messagesAdded) {
          if (added.message?.id) addedMessageIds.add(added.message.id);
        }
      }
      if (record.messagesDeleted) {
        for (const deleted of record.messagesDeleted) {
          if (deleted.message?.id) deletedMessageIds.add(deleted.message.id);
        }
      }
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

    for (const id of deletedMessageIds) {
      addedMessageIds.delete(id);
      labelChangedMessageIds.delete(id);
    }
    for (const id of addedMessageIds) {
      labelChangedMessageIds.delete(id);
    }

    log.info(
      { added: addedMessageIds.size, deleted: deletedMessageIds.size, labelChanged: labelChangedMessageIds.size },
      'Processing history events',
    );

    const touchedThreadIds = new Set<string>();

    // --- Process new messages (full fetch for new messages) ---
    if (addedMessageIds.size > 0) {
      const ids = Array.from(addedMessageIds);
      const BATCH_SIZE = 50;
      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batchIds = ids.slice(i, i + BATCH_SIZE);
        const rawMessages = await batchGetMessages(accountId, batchIds);
        const touched = await processMessages(accountId, rawMessages, rules, contactEmails);
        for (const id of touched) touchedThreadIds.add(id);

        if (i + BATCH_SIZE < ids.length) await delay(1000);
      }
    }

    // --- #4 — Process label changes in batches (not one-by-one) ---
    if (labelChangedMessageIds.size > 0) {
      const ids = Array.from(labelChangedMessageIds);
      const LABEL_BATCH_SIZE = 5; // 5 concurrent getMessage calls

      for (let i = 0; i < ids.length; i += LABEL_BATCH_SIZE) {
        const batch = ids.slice(i, i + LABEL_BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map(async (msgId) => {
            const rawMsg = await getMessage(accountId, msgId);
            return { msgId, rawMsg };
          }),
        );

        for (const result of results) {
          if (result.status === 'rejected') {
            const err = result.reason;
            if (err?.code === 404 || err?.response?.status === 404) {
              // Message was permanently deleted
              const msgId = batch[results.indexOf(result)];
              deletedMessageIds.add(msgId);
            }
            continue;
          }

          const { msgId, rawMsg } = result.value;
          const labels: string[] = rawMsg.labelIds || [];
          const flags = deriveThreadFlags(labels);

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
              and(eq(emails.accountId, accountId), eq(emails.gmailMessageId, msgId)),
            );

          const [emailRecord] = await db
            .select({ threadId: emails.threadId })
            .from(emails)
            .where(and(eq(emails.accountId, accountId), eq(emails.gmailMessageId, msgId)))
            .limit(1);

          if (emailRecord) {
            touchedThreadIds.add(emailRecord.threadId);
            // Only clear isArchived (don't set true — reconciliation handles that)
            const threadUpdate: Record<string, any> = {
              isStarred: flags.isStarred,
              isTrashed: flags.isTrashed,
              isSpam: flags.isSpam,
              labels,
              updatedAt: new Date().toISOString(),
            };
            if (!flags.isArchived) {
              threadUpdate.isArchived = false;
            }
            await db
              .update(threads)
              .set(threadUpdate)
              .where(eq(threads.id, emailRecord.threadId));
          }
        }

        // Small delay between batches to respect rate limits
        if (i + LABEL_BATCH_SIZE < ids.length) await delay(200);
      }
    }

    // --- Process deletions ---
    if (deletedMessageIds.size > 0) {
      const ids = Array.from(deletedMessageIds);

      const emailRecords = await db
        .select({
          id: emails.id,
          threadId: emails.threadId,
          subject: emails.subject,
          bodyText: emails.bodyText,
          fromAddress: emails.fromAddress,
          fromName: emails.fromName,
        })
        .from(emails)
        .where(
          and(eq(emails.accountId, accountId), inArray(emails.gmailMessageId, ids)),
        );

      const affectedThreadIds = [...new Set(emailRecords.map((e) => e.threadId))];
      for (const id of affectedThreadIds) touchedThreadIds.add(id);

      if (emailRecords.length > 0) {
        // Remove from FTS index before deleting from DB
        for (const e of emailRecords) {
          ftsDeleteEmail(e.id, e.subject, e.bodyText, e.fromAddress, e.fromName);
        }

        await db
          .delete(emails)
          .where(inArray(emails.id, emailRecords.map((e) => e.id)));
      }

      for (const threadId of affectedThreadIds) {
        const remaining = await db
          .select({ count: sql<number>`count(*)` })
          .from(emails)
          .where(eq(emails.threadId, threadId));

        const count = remaining[0]?.count ?? 0;
        if (count === 0) {
          await db.delete(threads).where(eq(threads.id, threadId));
          touchedThreadIds.delete(threadId);
        }
      }
    }

    // #7 — Selective thread reconciliation: only touched threads
    if (touchedThreadIds.size > 0) {
      await reconcileThreadCountsSelective(touchedThreadIds);
    }

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
// #7 — Selective thread count reconciliation
// ---------------------------------------------------------------------------

/**
 * Recompute stats for only the specified thread IDs.
 * Much faster than reconciling the entire account.
 */
async function reconcileThreadCountsSelective(threadIds: Set<string>) {
  if (threadIds.size === 0) return;

  const ids = Array.from(threadIds);
  const now = new Date().toISOString();

  // Process in chunks of 100 to avoid overly long IN clauses
  const CHUNK = 100;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const placeholders = chunk.map(() => '?').join(',');

    rawDb.prepare(`
      UPDATE threads SET
        message_count = (
          SELECT count(*) FROM emails e WHERE e.thread_id = threads.id
        ),
        unread_count = COALESCE((
          SELECT SUM(CASE WHEN e.is_unread = 1 THEN 1 ELSE 0 END) FROM emails e WHERE e.thread_id = threads.id
        ), 0),
        has_attachments = (
          SELECT MAX(CASE WHEN EXISTS (
            SELECT 1 FROM attachments a WHERE a.email_id = e.id
          ) THEN 1 ELSE 0 END) FROM emails e WHERE e.thread_id = threads.id
        ),
        "lastMessageAt" = (
          SELECT max(e."internalDate") FROM emails e WHERE e.thread_id = threads.id
        ),
        snippet = (
          SELECT e2.snippet FROM emails e2
          WHERE e2.thread_id = threads.id
          ORDER BY e2."internalDate" DESC LIMIT 1
        ),
        is_archived = CASE WHEN EXISTS (
          SELECT 1 FROM emails e WHERE e.thread_id = threads.id
            AND EXISTS (SELECT 1 FROM json_each(e.gmail_labels) WHERE value = 'INBOX')
        ) THEN 0 ELSE 1 END,
        "updatedAt" = ?
      WHERE threads.id IN (${placeholders})
    `).run(now, ...chunk);
  }
}

// ---------------------------------------------------------------------------
// #2 — Fetch email body on demand (called when user opens a thread)
// ---------------------------------------------------------------------------

export async function fetchEmailBodiesOnDemand(accountId: string, threadId: string) {
  // Find emails in this thread that have no body yet
  const emailsWithoutBody = await db
    .select({
      id: emails.id,
      gmailMessageId: emails.gmailMessageId,
    })
    .from(emails)
    .where(
      and(
        eq(emails.threadId, threadId),
        eq(emails.accountId, accountId),
        sql`${emails.bodyHtml} IS NULL AND ${emails.bodyText} IS NULL`,
      ),
    );

  if (emailsWithoutBody.length === 0) return;

  const log = logger.child({ accountId, threadId });
  log.debug({ count: emailsWithoutBody.length }, 'Fetching email bodies on demand');

  // Batch fetch full messages (5 concurrent)
  const CONCURRENCY = 5;
  for (let i = 0; i < emailsWithoutBody.length; i += CONCURRENCY) {
    const batch = emailsWithoutBody.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (e) => {
        const rawMsg = await getMessage(accountId, e.gmailMessageId);
        return { emailId: e.id, gmailMessageId: e.gmailMessageId, rawMsg };
      }),
    );

    for (const result of results) {
      if (result.status === 'rejected') continue;

      const { emailId, rawMsg } = result.value;
      const parsed = parseGmailMessage(rawMsg);
      const atts = extractAttachments(rawMsg);
      const compressedHtml = compressHtml(parsed.bodyHtml);

      await db
        .update(emails)
        .set({
          bodyText: parsed.bodyText,
          bodyHtml: parsed.bodyHtml,
          bodyHtmlCompressed: compressedHtml,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(emails.id, emailId));

      // Index body text in FTS
      ftsIndexEmail(emailId, parsed.subject, parsed.bodyText, parsed.fromAddress, parsed.fromName);

      // Store any attachments discovered
      if (atts.length > 0) {
        for (const att of atts) {
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

        // Update thread hasAttachments flag
        await db
          .update(threads)
          .set({ hasAttachments: true, updatedAt: new Date().toISOString() })
          .where(eq(threads.id, threadId));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// #1 — Gmail push notification handler
// ---------------------------------------------------------------------------

export async function handlePushNotification(emailAddress: string, historyId: number) {
  const log = logger.child({ emailAddress, historyId, sync: 'push' });

  // Find the account matching this email
  const [account] = await db
    .select({ id: accounts.id, syncStatus: accounts.syncStatus })
    .from(accounts)
    .where(eq(accounts.email, emailAddress))
    .limit(1);

  if (!account) {
    log.warn('No account found for push notification email');
    return;
  }

  // Skip if already syncing
  if (account.syncStatus === 'syncing') {
    log.debug('Account already syncing, skipping push-triggered sync');
    return;
  }

  log.info('Push notification received, triggering incremental sync');

  // Run sync directly (not via queue) for lowest latency
  try {
    await incrementalSync(account.id);
  } catch (err: any) {
    log.error({ err }, 'Push-triggered incremental sync failed');
  }
}

// ---------------------------------------------------------------------------
// Trigger initial sync (called after OAuth callback)
// ---------------------------------------------------------------------------

export async function triggerInitialSync(accountId: string) {
  const { addFullSyncJob } = await import('../jobs/sync-worker');

  if (env.REDIS_URL) {
    await addFullSyncJob(accountId);
    logger.info({ accountId }, 'Initial full sync job enqueued');
  } else {
    logger.info({ accountId }, 'No Redis — running initial full sync directly');
    fullSync(accountId).catch((err) =>
      logger.error({ err, accountId }, 'Direct initial full sync failed'),
    );
  }
}
