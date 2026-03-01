import { db } from '../config/database';
import { notifications, pushSubscriptions } from '../db/schema';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

export async function listNotifications(userId: string, limit = 50) {
  return db.select().from(notifications).where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function getUnreadCount(userId: string) {
  const [result] = await db.select({ count: sql<number>`COUNT(*)` })
    .from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
  return result?.count ?? 0;
}

export async function markAsRead(userId: string, notificationId: string) {
  await db.update(notifications).set({ isRead: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)));
}

export async function markAllAsRead(userId: string) {
  await db.update(notifications).set({ isRead: true })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
}

export async function createNotification(userId: string, accountId: string, data: {
  type: string; title: string; body?: string; sourceType?: string; sourceId?: string;
}) {
  const [created] = await db.insert(notifications).values({
    userId, accountId,
    type: data.type, title: data.title, body: data.body ?? null,
    sourceType: data.sourceType ?? null, sourceId: data.sourceId ?? null,
    createdAt: new Date().toISOString(),
  }).returning();
  return created;
}

export async function subscribePush(userId: string, endpoint: string, p256dh: string, auth: string) {
  // Remove existing subscription for this endpoint
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
  const [sub] = await db.insert(pushSubscriptions).values({
    userId, endpoint, p256dh, auth, createdAt: new Date().toISOString(),
  }).returning();
  return sub;
}

export async function getUserPushSubscriptions(userId: string) {
  return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}
