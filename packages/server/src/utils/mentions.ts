import { db } from '../config/database';
import { users, tenantMembers, notifications, accounts } from '../db/schema';
import { eq, inArray } from 'drizzle-orm';
import { logger } from './logger';

/**
 * Parse @mentions from comment text and create notifications for mentioned users.
 * Fire-and-forget — errors are logged but never thrown to callers.
 */
export async function parseMentionsAndNotify(data: {
  body: string;
  tenantId: string;
  authorUserId: string;
  authorName: string;
  sourceApp: string;
  sourceRecordId: string;
}): Promise<void> {
  try {
    // Match @Name patterns: @ followed by word characters (possibly with spaces for multi-word names)
    // Terminates at punctuation, newline, another @, or end of string
    const mentionPattern = /(?:^|\s)@([\w][\w\s]{0,30}?)(?=\s@|\s*$|[.,!?;:\n])/g;
    const mentionNames: string[] = [];
    let match;
    while ((match = mentionPattern.exec(data.body)) !== null) {
      mentionNames.push(match[1].trim());
    }

    if (mentionNames.length === 0) return;

    // Fetch all tenant members with their user info
    const members = await db
      .select({ userId: tenantMembers.userId, name: users.name, email: users.email })
      .from(tenantMembers)
      .innerJoin(users, eq(users.id, tenantMembers.userId))
      .where(eq(tenantMembers.tenantId, data.tenantId));

    // Resolve mentions to user IDs (skip the author)
    const targetUserIds: string[] = [];
    for (const mentionName of mentionNames) {
      const lowerName = mentionName.toLowerCase();
      const matchedUser = members.find(
        (m) =>
          (m.name && m.name.toLowerCase() === lowerName) ||
          (m.email && m.email.split('@')[0].toLowerCase() === lowerName),
      );
      if (matchedUser && matchedUser.userId !== data.authorUserId && !targetUserIds.includes(matchedUser.userId)) {
        targetUserIds.push(matchedUser.userId);
      }
    }

    if (targetUserIds.length === 0) return;

    // Batch-lookup accountIds for the target users (same pattern as emitAppEvent)
    const accountRows = await db
      .select({ userId: accounts.userId, id: accounts.id })
      .from(accounts)
      .where(inArray(accounts.userId, targetUserIds));

    const accountMap = new Map(accountRows.map((r) => [r.userId, r.id]));

    const rows = targetUserIds
      .filter((uid) => accountMap.has(uid))
      .map((uid) => ({
        userId: uid,
        accountId: accountMap.get(uid)!,
        type: 'mention' as const,
        title: `${data.authorName} mentioned you`,
        body: data.body.substring(0, 200),
        sourceType: data.sourceApp,
        sourceId: data.sourceRecordId,
        isRead: false,
      }));

    if (rows.length > 0) {
      await db.insert(notifications).values(rows);
      logger.info({ mentionCount: rows.length, sourceApp: data.sourceApp }, 'Created mention notifications');
    }
  } catch (err) {
    logger.error({ err }, 'Failed to create mention notifications');
  }
}
