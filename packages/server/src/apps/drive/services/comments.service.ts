import { db } from '../../../config/database';
import { driveActivityLog, driveComments, users } from '../../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../../../utils/logger';

// ─── Activity log (Feature 1) ──────────────────────────────────────

export async function logDriveActivity(data: {
  driveItemId: string;
  accountId: string;
  userId: string;
  action: string;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(driveActivityLog).values({
    driveItemId: data.driveItemId,
    accountId: data.accountId,
    userId: data.userId,
    action: data.action,
    metadata: data.metadata || {},
    createdAt: new Date(),
  });
}

export async function getActivityLog(itemId: string) {
  const rows = await db.select({
    activity: driveActivityLog,
    userName: users.name,
    userEmail: users.email,
  }).from(driveActivityLog)
    .leftJoin(users, eq(users.id, driveActivityLog.userId))
    .where(eq(driveActivityLog.driveItemId, itemId))
    .orderBy(desc(driveActivityLog.createdAt))
    .limit(50);

  return rows.map(r => ({
    id: r.activity.id,
    action: r.activity.action,
    metadata: r.activity.metadata,
    userId: r.activity.userId,
    userName: r.userName || r.userEmail || 'Unknown',
    createdAt: r.activity.createdAt,
  }));
}

// ─── Comments (Feature 2) ──────────────────────────────────────────

export async function listComments(itemId: string) {
  const rows = await db.select({
    comment: driveComments,
    userName: users.name,
    userEmail: users.email,
  }).from(driveComments)
    .leftJoin(users, eq(users.id, driveComments.userId))
    .where(eq(driveComments.driveItemId, itemId))
    .orderBy(desc(driveComments.createdAt));

  return rows.map(r => ({
    id: r.comment.id,
    body: r.comment.body,
    userId: r.comment.userId,
    userName: r.userName || r.userEmail || 'Unknown',
    createdAt: r.comment.createdAt,
    updatedAt: r.comment.updatedAt,
  }));
}

export async function createComment(userId: string, accountId: string, itemId: string, body: string) {
  const now = new Date();
  const [comment] = await db.insert(driveComments).values({
    driveItemId: itemId,
    accountId,
    userId,
    body,
    createdAt: now,
    updatedAt: now,
  }).returning();
  return comment;
}

export async function deleteComment(userId: string, commentId: string) {
  // Author-only delete
  const [comment] = await db.select().from(driveComments)
    .where(and(eq(driveComments.id, commentId), eq(driveComments.userId, userId)))
    .limit(1);
  if (!comment) return null;

  await db.delete(driveComments)
    .where(and(eq(driveComments.id, commentId), eq(driveComments.userId, userId)));
  return comment;
}
