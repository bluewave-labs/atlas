import { db } from '../config/database';
import { activityFeed, notifications, users, accounts, tenantMembers } from '../db/schema';
import { eq, and, desc, lt, sql, inArray } from 'drizzle-orm';
import { logger } from '../utils/logger';

// ─── Types ──────────────────────────────────────────────────────────

interface AppEvent {
  tenantId: string;
  userId: string;
  appId: string;
  eventType: string;
  title: string;
  metadata?: Record<string, unknown>;
  /** If provided, create a notification for each user (excluding the actor). */
  notifyUserIds?: string[];
}

interface ActivityFeedItem {
  id: string;
  userId: string;
  userName: string | null;
  appId: string;
  eventType: string;
  title: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Look up the first tenantId for a user via tenant_members.
 */
export async function getTenantIdForUser(userId: string): Promise<string | null> {
  const rows = await db
    .select({ tenantId: tenantMembers.tenantId })
    .from(tenantMembers)
    .where(eq(tenantMembers.userId, userId))
    .limit(1);
  return rows[0]?.tenantId ?? null;
}

/**
 * Batch-resolve tenantIds for multiple userIds in a single query.
 * Returns a Map<userId, tenantId>.
 */
export async function getTenantIdsForUsers(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  const rows = await db
    .select({ userId: tenantMembers.userId, tenantId: tenantMembers.tenantId })
    .from(tenantMembers)
    .where(inArray(tenantMembers.userId, userIds));
  const map = new Map<string, string>();
  for (const row of rows) {
    if (!map.has(row.userId)) {
      map.set(row.userId, row.tenantId);
    }
  }
  return map;
}

export async function getTenantMemberUserIds(tenantId: string): Promise<string[]> {
  const members = await db
    .select({ userId: tenantMembers.userId })
    .from(tenantMembers)
    .where(eq(tenantMembers.tenantId, tenantId));
  return members.map((m) => m.userId);
}

/**
 * Look up the first account for a given userId so we can populate
 * accountId on notification rows.
 */
async function getAccountIdForUser(userId: string): Promise<string | null> {
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .limit(1);
  return rows[0]?.id ?? null;
}

// ─── Core: Emit Event ───────────────────────────────────────────────

export async function emitAppEvent(event: AppEvent): Promise<void> {
  const meta = event.metadata ?? {};

  // 1. Insert into activity feed
  await db.insert(activityFeed).values({
    tenantId: event.tenantId,
    userId: event.userId,
    appId: event.appId,
    eventType: event.eventType,
    title: event.title,
    metadata: meta,
  });

  // 2. Create notifications for specified users (skip the actor) — batch insert
  if (event.notifyUserIds && event.notifyUserIds.length > 0) {
    const targetUserIds = event.notifyUserIds.filter((uid) => uid !== event.userId);
    if (targetUserIds.length > 0) {
      try {
        // Batch lookup all accountIds in one query
        const accountRows = await db
          .select({ userId: accounts.userId, id: accounts.id })
          .from(accounts)
          .where(inArray(accounts.userId, targetUserIds));

        const accountMap = new Map(accountRows.map((r) => [r.userId, r.id]));
        const sourceId = (meta.dealId ?? meta.employeeId ?? meta.documentId ?? meta.itemId ?? meta.id ?? null) as string | null;

        const rows = targetUserIds
          .filter((uid) => accountMap.has(uid))
          .map((uid) => ({
            userId: uid,
            accountId: accountMap.get(uid)!,
            type: event.appId,
            title: event.title,
            body: null,
            sourceType: event.appId,
            sourceId,
            isRead: false,
          }));

        if (rows.length > 0) {
          await db.insert(notifications).values(rows);
        }
      } catch (err) {
        logger.error({ err }, 'Failed to batch-create notifications');
      }
    }
  }
}

// ─── Activity Feed Queries ──────────────────────────────────────────

export async function listActivityFeed(
  tenantId: string,
  limit = 50,
  before?: string,
): Promise<{ items: ActivityFeedItem[]; hasMore: boolean }> {
  const conditions = [eq(activityFeed.tenantId, tenantId)];

  if (before) {
    conditions.push(lt(activityFeed.createdAt, new Date(before)));
  }

  const rows = await db
    .select({
      id: activityFeed.id,
      userId: activityFeed.userId,
      userName: users.name,
      appId: activityFeed.appId,
      eventType: activityFeed.eventType,
      title: activityFeed.title,
      metadata: activityFeed.metadata,
      createdAt: activityFeed.createdAt,
    })
    .from(activityFeed)
    .leftJoin(users, eq(activityFeed.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(activityFeed.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit) as ActivityFeedItem[];

  return { items, hasMore };
}

// ─── Notification Queries ───────────────────────────────────────────

export async function listNotifications(
  userId: string,
  accountId: string,
  limit = 50,
  before?: string,
): Promise<{ items: typeof notifications.$inferSelect[]; hasMore: boolean; unreadCount: number }> {
  const conditions = [
    eq(notifications.userId, userId),
    eq(notifications.accountId, accountId),
  ];

  if (before) {
    conditions.push(lt(notifications.createdAt, new Date(before)));
  }

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(limit + 1),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.accountId, accountId),
          eq(notifications.isRead, false),
        ),
      ),
  ]);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const unreadCount = countResult[0]?.count ?? 0;

  return { items, hasMore, unreadCount };
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function markAllNotificationsRead(userId: string, accountId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.accountId, accountId),
        eq(notifications.isRead, false),
      ),
    );
}

export async function getUnreadCount(userId: string, accountId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.accountId, accountId),
        eq(notifications.isRead, false),
      ),
    );
  return result[0]?.count ?? 0;
}

export async function dismissNotification(notificationId: string, userId: string): Promise<void> {
  await db
    .delete(notifications)
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}
