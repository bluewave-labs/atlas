import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { threads, emails, accounts, userSettings, attachments } from '../db/schema';
import * as gmailService from './gmail.service';
import * as trackingService from './tracking.service';
import { fetchEmailBodiesOnDemand } from './sync.service';
import { parseGmailMessage } from '../utils/gmail-parser';
import { logger } from '../utils/logger';

/** Augment a plain thread query result with sender info from the latest email. */
async function attachSenderInfo(threadRows: any[]) {
  if (threadRows.length === 0) return threadRows;
  const threadIds = threadRows.map((t) => t.id);
  const senders = await db.select({
    threadId: emails.threadId,
    fromName: emails.fromName,
    fromAddress: emails.fromAddress,
  })
    .from(emails)
    .where(
      and(
        sql`${emails.threadId} IN (${sql.join(threadIds.map(id => sql`${id}`), sql`, `)})`,
        sql`${emails.internalDate} = (
          SELECT MAX(e2."internalDate") FROM emails e2 WHERE e2.thread_id = ${emails.threadId}
        )`,
      ),
    );

  const senderMap = new Map(senders.map((s) => [s.threadId, s]));
  return threadRows.map((t) => {
    const sender = senderMap.get(t.id);
    return { ...t, senderName: sender?.fromName ?? null, senderEmail: sender?.fromAddress ?? null };
  });
}

// ─── Counts for sidebar badges ──────────────────────────────────────

export async function getThreadCounts(accountId: string) {
  // Use a single SQL query with CASE expressions to compute all counts efficiently.
  // This avoids fetching thousands of rows into JS.
  const [row] = await db.select({
    // Mailbox counts
    allTotal:         sql<number>`sum(case when is_trashed = 0 and is_spam = 0 then 1 else 0 end)`,
    allUnread:        sql<number>`sum(case when is_trashed = 0 and is_spam = 0 and unread_count > 0 then 1 else 0 end)`,
    inboxTotal:       sql<number>`sum(case when is_archived = 0 and is_trashed = 0 and is_spam = 0 then 1 else 0 end)`,
    inboxUnread:      sql<number>`sum(case when is_archived = 0 and is_trashed = 0 and is_spam = 0 and unread_count > 0 then 1 else 0 end)`,
    archiveTotal:     sql<number>`sum(case when is_archived = 1 and is_trashed = 0 then 1 else 0 end)`,
    archiveUnread:    sql<number>`sum(case when is_archived = 1 and is_trashed = 0 and unread_count > 0 then 1 else 0 end)`,
    trashTotal:       sql<number>`sum(case when is_trashed = 1 then 1 else 0 end)`,
    trashUnread:      sql<number>`sum(case when is_trashed = 1 and unread_count > 0 then 1 else 0 end)`,
    starredTotal:     sql<number>`sum(case when is_starred = 1 and is_trashed = 0 then 1 else 0 end)`,
    starredUnread:    sql<number>`sum(case when is_starred = 1 and is_trashed = 0 and unread_count > 0 then 1 else 0 end)`,
    unreadTotal:      sql<number>`sum(case when is_trashed = 0 and is_spam = 0 and unread_count > 0 then 1 else 0 end)`,
    spamTotal:        sql<number>`sum(case when is_spam = 1 and is_trashed = 0 then 1 else 0 end)`,
    spamUnread:       sql<number>`sum(case when is_spam = 1 and is_trashed = 0 and unread_count > 0 then 1 else 0 end)`,
    // Category counts — do NOT filter by is_archived because Gmail's category
    // tabs (CATEGORY_PROMOTIONS, etc.) lack the INBOX label, which our sync
    // marks as is_archived=true.  Excluding those would show 0 for most categories.
    importantTotal:   sql<number>`sum(case when is_trashed = 0 and is_spam = 0 and category = 'important' then 1 else 0 end)`,
    importantUnread:  sql<number>`sum(case when is_trashed = 0 and is_spam = 0 and category = 'important' and unread_count > 0 then 1 else 0 end)`,
    otherTotal:       sql<number>`sum(case when is_trashed = 0 and is_spam = 0 and category = 'other' then 1 else 0 end)`,
    otherUnread:      sql<number>`sum(case when is_trashed = 0 and is_spam = 0 and category = 'other' and unread_count > 0 then 1 else 0 end)`,
    newslettersTotal: sql<number>`sum(case when is_trashed = 0 and is_spam = 0 and category = 'newsletters' then 1 else 0 end)`,
    newslettersUnread:sql<number>`sum(case when is_trashed = 0 and is_spam = 0 and category = 'newsletters' and unread_count > 0 then 1 else 0 end)`,
    notificationsTotal:  sql<number>`sum(case when is_trashed = 0 and is_spam = 0 and category = 'notifications' then 1 else 0 end)`,
    notificationsUnread: sql<number>`sum(case when is_trashed = 0 and is_spam = 0 and category = 'notifications' and unread_count > 0 then 1 else 0 end)`,
  })
    .from(threads)
    .where(eq(threads.accountId, accountId));

  const n = (v: number | null) => v ?? 0;

  return {
    categories: {
      all:           { total: n(row.allTotal),           unread: n(row.allUnread) },
      important:     { total: n(row.importantTotal),     unread: n(row.importantUnread) },
      other:         { total: n(row.otherTotal),         unread: n(row.otherUnread) },
      newsletters:   { total: n(row.newslettersTotal),   unread: n(row.newslettersUnread) },
      notifications: { total: n(row.notificationsTotal), unread: n(row.notificationsUnread) },
    },
    mailboxes: {
      inbox:   { total: n(row.inboxTotal),   unread: n(row.inboxUnread) },
      starred: { total: n(row.starredTotal), unread: n(row.starredUnread) },
      unread:  { total: n(row.unreadTotal),  unread: n(row.unreadTotal) },
      archive: { total: n(row.archiveTotal), unread: n(row.archiveUnread) },
      trash:   { total: n(row.trashTotal),   unread: n(row.trashUnread) },
      spam:    { total: n(row.spamTotal),    unread: n(row.spamUnread) },
      sent:    { total: 0, unread: 0 }, // sent count omitted — requires expensive label scan
    },
  };
}

export async function getThreads(
  accountId: string,
  options: { mailbox?: string; category?: string; limit?: number; offset?: number; gmailLabel?: string },
) {
  const mailbox = options.mailbox || 'inbox';

  // For the "sent" mailbox filter threads that contain at least one email with
  // the Gmail SENT label. Using the SENT label is more reliable than matching
  // fromAddress because Gmail normalises the address in the label regardless
  // of display-name variations.
  if (mailbox === 'sent') {
    const conditions = [
      eq(threads.accountId, accountId),
      eq(threads.isTrashed, false),
      // At least one email in the thread carries the SENT label
      sql`EXISTS (
        SELECT 1 FROM emails e, json_each(e.gmail_labels) AS lbl
        WHERE e.thread_id = ${threads.id}
          AND e.account_id = ${accountId}
          AND lbl.value = 'SENT'
      )`,
    ];
    if (options.category) {
      conditions.push(eq(threads.category, options.category));
    }
    if (options.gmailLabel) {
      conditions.push(
        sql`EXISTS (SELECT 1 FROM json_each(${threads.labels}) AS lbl WHERE lbl.value = ${options.gmailLabel})`,
      );
    }

    const result = await db.select()
      .from(threads)
      .where(and(...conditions))
      .orderBy(desc(threads.lastMessageAt))
      .limit(options.limit || 50)
      .offset(options.offset || 0);

    return attachSenderInfo(result);
  }

  // Standard mailbox filters
  const conditions = [eq(threads.accountId, accountId)];

  switch (mailbox) {
    case 'starred':
      conditions.push(eq(threads.isStarred, true));
      conditions.push(eq(threads.isTrashed, false));
      break;
    case 'unread':
      conditions.push(sql`${threads.unreadCount} > 0`);
      conditions.push(eq(threads.isTrashed, false));
      conditions.push(eq(threads.isSpam, false));
      break;
    case 'archive':
      conditions.push(eq(threads.isArchived, true));
      conditions.push(eq(threads.isTrashed, false));
      break;
    case 'trash':
      conditions.push(eq(threads.isTrashed, true));
      break;
    case 'spam':
      conditions.push(eq(threads.isSpam, true));
      conditions.push(eq(threads.isTrashed, false));
      break;
    case 'inbox':
    default:
      conditions.push(eq(threads.isTrashed, false));
      conditions.push(eq(threads.isSpam, false));
      // "All mail" (category=all) shows everything except trash/spam.
      // Specific category views don't filter isArchived because Gmail's
      // category labels often lack INBOX, which sync marks as archived.
      // Only the bare inbox (no category at all) excludes archived threads
      // so user-initiated archives disappear.
      if (!options.category) {
        conditions.push(eq(threads.isArchived, false));
      }
      break;
  }

  // Apply category filter (skip for 'all' — that means show everything)
  if (options.category && options.category !== 'all') {
    conditions.push(eq(threads.category, options.category));
  }

  if (options.gmailLabel) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM json_each(${threads.labels}) AS lbl WHERE lbl.value = ${options.gmailLabel})`,
    );
  }

  const result = await db.select()
    .from(threads)
    .where(and(...conditions))
    .orderBy(desc(threads.lastMessageAt))
    .limit(options.limit || 50)
    .offset(options.offset || 0);

  return attachSenderInfo(result);
}

export async function getGmailLabels(accountId: string) {
  const rawLabels = await gmailService.listLabels(accountId);
  // Filter out system labels that aren't useful to show (INBOX, SENT, TRASH, etc. are handled by mailbox views)
  const HIDDEN_SYSTEM_LABELS = new Set([
    'INBOX', 'SENT', 'TRASH', 'SPAM', 'DRAFT', 'UNREAD', 'STARRED',
    'IMPORTANT', 'CHAT', 'CATEGORY_PERSONAL', 'CATEGORY_SOCIAL',
    'CATEGORY_UPDATES', 'CATEGORY_FORUMS', 'CATEGORY_PROMOTIONS',
  ]);

  return rawLabels
    .filter((l: any) => !HIDDEN_SYSTEM_LABELS.has(l.id))
    .map((l: any) => ({
      id: l.id,
      name: l.name,
      type: l.type, // 'system' or 'user'
      color: l.color ? { background: l.color.backgroundColor, text: l.color.textColor } : null,
    }));
}

export async function getThreadById(accountId: string, threadId: string) {
  const [thread] = await db.select()
    .from(threads)
    .where(and(eq(threads.id, threadId), eq(threads.accountId, accountId)))
    .limit(1);

  if (!thread) return null;

  // #2 — Fetch email bodies on demand if they were synced as metadata-only
  try {
    await fetchEmailBodiesOnDemand(accountId, threadId);
  } catch (err) {
    logger.warn({ err, threadId }, 'Failed to fetch email bodies on demand — returning cached data');
  }

  const threadEmails = await db.select()
    .from(emails)
    .where(eq(emails.threadId, threadId))
    .orderBy(emails.internalDate);

  // Load attachments for all emails in the thread
  const emailIds = threadEmails.map((e) => e.id);
  const allAttachments = emailIds.length > 0
    ? await db.select()
        .from(attachments)
        .where(sql`${attachments.emailId} IN (${sql.join(emailIds.map(id => sql`${id}`), sql`, `)})`)
    : [];

  // Group attachments by emailId
  const attachmentsByEmail = new Map<string, typeof allAttachments>();
  for (const att of allAttachments) {
    const list = attachmentsByEmail.get(att.emailId) ?? [];
    list.push(att);
    attachmentsByEmail.set(att.emailId, list);
  }

  const emailsWithAttachments = threadEmails.map((e) => ({
    ...e,
    attachments: attachmentsByEmail.get(e.id) ?? [],
  }));

  return { ...thread, emails: emailsWithAttachments };
}

export async function archiveThread(accountId: string, threadId: string) {
  await db.update(threads)
    .set({ isArchived: true, updatedAt: new Date().toISOString() })
    .where(and(eq(threads.id, threadId), eq(threads.accountId, accountId)));
}

export async function trashThread(accountId: string, threadId: string) {
  await db.update(threads)
    .set({ isTrashed: true, updatedAt: new Date().toISOString() })
    .where(and(eq(threads.id, threadId), eq(threads.accountId, accountId)));
}

export async function toggleStar(accountId: string, threadId: string) {
  const [thread] = await db.select({ isStarred: threads.isStarred })
    .from(threads)
    .where(and(eq(threads.id, threadId), eq(threads.accountId, accountId)))
    .limit(1);

  if (thread) {
    await db.update(threads)
      .set({ isStarred: !thread.isStarred, updatedAt: new Date().toISOString() })
      .where(and(eq(threads.id, threadId), eq(threads.accountId, accountId)));
  }
}

// ─── Send email ──────────────────────────────────────────────────────

interface SendEmailPayload {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  threadId?: string;
  inReplyTo?: string;
  referencesHeader?: string;
  trackingEnabled?: boolean;
}

function buildRawEmail(
  from: string,
  payload: SendEmailPayload,
): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const lines: string[] = [];

  // RFC 2822 requires a Date header
  lines.push(`Date: ${new Date().toUTCString()}`);
  lines.push(`From: ${from}`);
  lines.push(`To: ${payload.to.join(', ')}`);
  if (payload.cc && payload.cc.length > 0) {
    lines.push(`Cc: ${payload.cc.join(', ')}`);
  }
  if (payload.bcc && payload.bcc.length > 0) {
    lines.push(`Bcc: ${payload.bcc.join(', ')}`);
  }
  lines.push(`Subject: ${payload.subject}`);

  if (payload.inReplyTo) {
    lines.push(`In-Reply-To: ${payload.inReplyTo}`);
    // References should include the full thread chain plus the message being replied to.
    const references = payload.referencesHeader
      ? `${payload.referencesHeader} ${payload.inReplyTo}`
      : payload.inReplyTo;
    lines.push(`References: ${references}`);
  }

  lines.push('MIME-Version: 1.0');
  lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  lines.push('');

  // Plain-text fallback must come first per RFC 2046 §5.1.4 — clients render
  // the LAST part they understand, so text/plain before text/html is correct.
  const plainText = payload.bodyHtml.replace(/<[^>]+>/g, '').trim();
  lines.push(`--${boundary}`);
  lines.push('Content-Type: text/plain; charset="UTF-8"');
  lines.push('Content-Transfer-Encoding: quoted-printable');
  lines.push('');
  lines.push(plainText);
  lines.push('');

  lines.push(`--${boundary}`);
  lines.push('Content-Type: text/html; charset="UTF-8"');
  lines.push('Content-Transfer-Encoding: quoted-printable');
  lines.push('');
  lines.push(payload.bodyHtml);
  lines.push('');
  lines.push(`--${boundary}--`);

  return lines.join('\r\n');
}

export async function sendEmail(accountId: string, payload: SendEmailPayload) {
  // Look up the sender's email address and display name
  const [account] = await db.select({ email: accounts.email, name: accounts.name })
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .limit(1);

  if (!account) throw new Error('Account not found');

  // Determine if tracking should be applied
  let shouldTrack = payload.trackingEnabled;
  if (shouldTrack === undefined) {
    // Fall back to the user's global setting
    const [settings] = await db.select({ trackingEnabled: userSettings.trackingEnabled })
      .from(userSettings)
      .where(eq(userSettings.accountId, accountId))
      .limit(1);
    shouldTrack = settings?.trackingEnabled ?? false;
  }

  // Inject tracking pixel and rewrite links if enabled
  if (shouldTrack) {
    try {
      // Create a tracking record for the primary recipient
      const primaryRecipient = payload.to[0];
      const trackingId = await trackingService.createTrackingRecord(
        accountId,
        payload.threadId,
        payload.subject,
        primaryRecipient,
      );

      // Create additional records for other recipients
      for (let i = 1; i < payload.to.length; i++) {
        await trackingService.createTrackingRecord(
          accountId,
          payload.threadId,
          payload.subject,
          payload.to[i],
        );
      }

      // Process the HTML body with the primary recipient's tracking ID
      payload.bodyHtml = trackingService.processHtmlForTracking(
        payload.bodyHtml,
        trackingId,
      );
    } catch (error) {
      // Tracking injection is best-effort — send the email regardless
      logger.error({ error, accountId }, 'Failed to inject tracking, sending without it');
    }
  }

  const fromHeader = account.name
    ? `"${account.name.replace(/"/g, '\\"')}" <${account.email}>`
    : account.email;
  const rawEmail = buildRawEmail(fromHeader, payload);
  const encodedEmail = Buffer.from(rawEmail).toString('base64url');

  // Look up the Gmail thread ID so the reply is properly threaded in Gmail
  let gmailThreadId: string | undefined;
  if (payload.threadId) {
    const [thread] = await db.select({ gmailThreadId: threads.gmailThreadId })
      .from(threads)
      .where(and(eq(threads.id, payload.threadId), eq(threads.accountId, accountId)))
      .limit(1);
    gmailThreadId = thread?.gmailThreadId;
  }

  const result = await gmailService.sendMessage(accountId, encodedEmail, gmailThreadId);

  // Fetch the sent message from Gmail and insert it into the local DB so it
  // appears immediately without waiting for the next sync cycle.
  if (result.id) {
    try {
      const fullMessage = await gmailService.getMessage(accountId, result.id);
      const parsed = parseGmailMessage(fullMessage);
      const now = new Date().toISOString();

      // Determine the local threadId — either the existing one or create from Gmail's threadId
      let localThreadId = payload.threadId;

      if (!localThreadId && parsed.gmailThreadId) {
        // New thread — check if it was already created by sync
        const [existingThread] = await db.select({ id: threads.id })
          .from(threads)
          .where(and(eq(threads.accountId, accountId), eq(threads.gmailThreadId, parsed.gmailThreadId)))
          .limit(1);

        if (existingThread) {
          localThreadId = existingThread.id;
        } else {
          // Create a new thread for this sent message
          const [newThread] = await db.insert(threads)
            .values({
              accountId,
              gmailThreadId: parsed.gmailThreadId,
              subject: parsed.subject,
              snippet: parsed.snippet,
              messageCount: 1,
              unreadCount: 0,
              hasAttachments: false,
              lastMessageAt: parsed.internalDate,
              category: 'other',
              labels: parsed.gmailLabels,
              isStarred: false,
              isArchived: true, // sent messages are not in inbox
              isTrashed: false,
              isSpam: false,
              createdAt: now,
              updatedAt: now,
            })
            .returning({ id: threads.id });
          localThreadId = newThread.id;
        }
      }

      if (localThreadId) {
        // Upsert the email
        await db.insert(emails)
          .values({
            accountId,
            threadId: localThreadId,
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
            isUnread: false,
            isStarred: false,
            isDraft: false,
            internalDate: parsed.internalDate,
            sizeEstimate: parsed.sizeEstimate,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoNothing();

        // Update thread metadata
        const [emailCount] = await db.select({
          count: sql<number>`count(*)`,
        })
          .from(emails)
          .where(eq(emails.threadId, localThreadId));

        await db.update(threads)
          .set({
            snippet: parsed.snippet,
            messageCount: emailCount.count,
            lastMessageAt: parsed.internalDate,
            updatedAt: now,
          })
          .where(eq(threads.id, localThreadId));
      }
    } catch (err) {
      // Inserting the sent email into the local DB is best-effort — the next sync
      // cycle will pick it up anyway.
      logger.warn({ err, messageId: result.id }, 'Failed to insert sent message into local DB');
    }
  }

  return result;
}

// ─── Mark as spam ────────────────────────────────────────────────────

export async function markSpam(accountId: string, threadId: string) {
  // Update local DB
  await db.update(threads)
    .set({ isSpam: true, updatedAt: new Date().toISOString() })
    .where(and(eq(threads.id, threadId), eq(threads.accountId, accountId)));

  // Sync with Gmail for all messages in this thread
  const threadEmails = await db.select({ gmailMessageId: emails.gmailMessageId })
    .from(emails)
    .where(and(eq(emails.threadId, threadId), eq(emails.accountId, accountId)));

  for (const email of threadEmails) {
    try {
      await gmailService.modifyMessage(accountId, email.gmailMessageId, ['SPAM'], ['INBOX']);
    } catch (error) {
      logger.error({ error, threadId, gmailMessageId: email.gmailMessageId }, 'Failed to mark message as spam in Gmail');
    }
  }
}

// ─── Mark read / unread ──────────────────────────────────────────────

export async function markReadUnread(accountId: string, threadId: string, isUnread: boolean) {
  // Get all emails in the thread
  const threadEmails = await db.select({
    id: emails.id,
    gmailMessageId: emails.gmailMessageId,
  })
    .from(emails)
    .where(and(eq(emails.threadId, threadId), eq(emails.accountId, accountId)));

  if (threadEmails.length === 0) return;

  // Update local DB: set isUnread on all emails in the thread
  await db.update(emails)
    .set({ isUnread, updatedAt: new Date().toISOString() })
    .where(and(eq(emails.threadId, threadId), eq(emails.accountId, accountId)));

  // Update unreadCount on the thread
  const newUnreadCount = isUnread ? threadEmails.length : 0;
  await db.update(threads)
    .set({ unreadCount: newUnreadCount, updatedAt: new Date().toISOString() })
    .where(and(eq(threads.id, threadId), eq(threads.accountId, accountId)));

  // Sync with Gmail
  const addLabels = isUnread ? ['UNREAD'] : [];
  const removeLabels = isUnread ? [] : ['UNREAD'];

  for (const email of threadEmails) {
    try {
      await gmailService.modifyMessage(accountId, email.gmailMessageId, addLabels, removeLabels);
    } catch (error) {
      logger.error({ error, threadId, gmailMessageId: email.gmailMessageId }, 'Failed to update read status in Gmail');
    }
  }
}

// ─── Snooze thread ───────────────────────────────────────────────────

export async function snoozeThread(accountId: string, threadId: string, _snoozeUntil: string) {
  // For now, snoozed threads are archived (removed from inbox).
  // A full implementation would schedule a job to un-snooze at the given time.
  await db.update(threads)
    .set({ isArchived: true, updatedAt: new Date().toISOString() })
    .where(and(eq(threads.id, threadId), eq(threads.accountId, accountId)));

  // Also remove INBOX label in Gmail
  const threadEmails = await db.select({ gmailMessageId: emails.gmailMessageId })
    .from(emails)
    .where(and(eq(emails.threadId, threadId), eq(emails.accountId, accountId)));

  for (const email of threadEmails) {
    try {
      await gmailService.modifyMessage(accountId, email.gmailMessageId, [], ['INBOX']);
    } catch (error) {
      logger.error({ error, threadId, gmailMessageId: email.gmailMessageId }, 'Failed to snooze message in Gmail');
    }
  }
}

// ─── Attachment download ────────────────────────────────────────────

export async function getAttachmentContent(accountId: string, attachmentId: string) {
  // Look up attachment metadata
  const [att] = await db.select({
    id: attachments.id,
    emailId: attachments.emailId,
    gmailAttachmentId: attachments.gmailAttachmentId,
    filename: attachments.filename,
    mimeType: attachments.mimeType,
    size: attachments.size,
  })
    .from(attachments)
    .where(eq(attachments.id, attachmentId))
    .limit(1);

  if (!att) return null;

  // Verify the attachment belongs to an email owned by this account
  const [email] = await db.select({
    gmailMessageId: emails.gmailMessageId,
    accountId: emails.accountId,
  })
    .from(emails)
    .where(and(eq(emails.id, att.emailId), eq(emails.accountId, accountId)))
    .limit(1);

  if (!email) return null;

  if (!att.gmailAttachmentId) {
    return null; // No Gmail attachment ID — can't fetch content
  }

  // Fetch from Gmail API
  const gmailData = await gmailService.getAttachment(
    accountId,
    email.gmailMessageId,
    att.gmailAttachmentId,
  );

  // Gmail returns base64url-encoded data
  if (!gmailData.data) return null;
  const buffer = Buffer.from(gmailData.data, 'base64url');

  return {
    buffer,
    filename: att.filename,
    mimeType: att.mimeType,
    size: att.size,
  };
}
