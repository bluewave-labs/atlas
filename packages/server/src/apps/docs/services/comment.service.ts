import { db } from '../../../config/database';
import { documentComments } from '../../../db/schema';
import { eq, and, asc } from 'drizzle-orm';

// ─── Document Comments ───────────────────────────────────────────────

export async function listComments(userId: string, documentId: string) {
  return db.select().from(documentComments)
    .where(eq(documentComments.documentId, documentId))
    .orderBy(asc(documentComments.createdAt));
}

export async function createComment(userId: string, accountId: string, documentId: string, input: {
  content: string; selectionFrom?: number; selectionTo?: number; selectionText?: string; parentId?: string;
}) {
  const now = new Date();
  const [created] = await db.insert(documentComments).values({
    documentId, userId, accountId,
    content: input.content,
    selectionFrom: input.selectionFrom ?? null, selectionTo: input.selectionTo ?? null,
    selectionText: input.selectionText ?? null,
    parentId: input.parentId ?? null,
    createdAt: now, updatedAt: now,
  }).returning();
  return created;
}

export async function updateComment(userId: string, commentId: string, data: { content?: string; isResolved?: boolean }) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (data.content !== undefined) updates.content = data.content;
  if (data.isResolved !== undefined) updates.isResolved = data.isResolved;
  await db.update(documentComments).set(updates)
    .where(and(eq(documentComments.id, commentId), eq(documentComments.userId, userId)));
  const [updated] = await db.select().from(documentComments)
    .where(and(eq(documentComments.id, commentId), eq(documentComments.userId, userId))).limit(1);
  return updated || null;
}

export async function deleteComment(userId: string, commentId: string) {
  await db.delete(documentComments)
    .where(and(eq(documentComments.id, commentId), eq(documentComments.userId, userId)));
}

export async function resolveComment(userId: string, commentId: string) {
  return updateComment(userId, commentId, { isResolved: true });
}
