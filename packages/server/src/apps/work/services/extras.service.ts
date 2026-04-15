import { db } from '../../../config/database';
import { subtasks, taskActivities, taskTemplates, taskComments, taskAttachments, taskDependencies, tasks, users } from '../../../db/schema';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { logger } from '../../../utils/logger';
import { createTask } from './task.service';

// ─── Subtasks ────────────────────────────────────────────────────────

export async function listSubtasks(taskId: string) {
  return db.select().from(subtasks).where(eq(subtasks.taskId, taskId))
    .orderBy(asc(subtasks.sortOrder));
}

export async function createSubtask(userId: string, taskId: string, title: string) {
  const now = new Date();
  const [maxSort] = await db.select({ max: sql<number>`COALESCE(MAX(${subtasks.sortOrder}), -1)` })
    .from(subtasks).where(eq(subtasks.taskId, taskId));
  const sortOrder = (maxSort?.max ?? -1) + 1;
  const [created] = await db.insert(subtasks).values({
    taskId, userId, title, sortOrder, createdAt: now,
  }).returning();
  await logActivity(userId, taskId, 'subtask_added', null, null, title);
  return created;
}

export async function updateSubtask(userId: string, subtaskId: string, data: { title?: string; isCompleted?: boolean }) {
  const updates: Record<string, unknown> = {};
  if (data.title !== undefined) updates.title = data.title;
  if (data.isCompleted !== undefined) updates.isCompleted = data.isCompleted;
  await db.update(subtasks).set(updates).where(eq(subtasks.id, subtaskId));
  const [updated] = await db.select().from(subtasks).where(eq(subtasks.id, subtaskId)).limit(1);
  if (updated && data.isCompleted !== undefined) {
    await logActivity(userId, updated.taskId, 'subtask_completed', null, null, updated.title);
  }
  return updated || null;
}

export async function getSubtaskById(subtaskId: string) {
  const [row] = await db.select().from(subtasks).where(eq(subtasks.id, subtaskId)).limit(1);
  return row || null;
}

export async function deleteSubtask(subtaskId: string) {
  await db.delete(subtasks).where(eq(subtasks.id, subtaskId));
}

export async function reorderSubtasks(taskId: string, subtaskIds: string[]) {
  for (let i = 0; i < subtaskIds.length; i++) {
    await db.update(subtasks).set({ sortOrder: i }).where(and(eq(subtasks.id, subtaskIds[i]), eq(subtasks.taskId, taskId)));
  }
}

// ─── Task Activities ─────────────────────────────────────────────────

export async function logActivity(userId: string, taskId: string, action: string, field: string | null, oldValue: string | null, newValue: string | null) {
  await db.insert(taskActivities).values({
    taskId, userId, action, field, oldValue, newValue, createdAt: new Date(),
  });
}

export async function listActivities(taskId: string, limit = 50) {
  return db.select().from(taskActivities).where(eq(taskActivities.taskId, taskId))
    .orderBy(desc(taskActivities.createdAt)).limit(limit);
}

// ─── Task Templates ─────────────────────────────────────────────────

export async function listTemplates(userId: string) {
  return db.select().from(taskTemplates).where(eq(taskTemplates.userId, userId))
    .orderBy(asc(taskTemplates.sortOrder));
}

export async function createTemplate(userId: string, tenantId: string, input: {
  title: string; description?: string | null; icon?: string | null;
  defaultWhen?: string; defaultPriority?: string; defaultTags?: string[]; subtaskTitles?: string[];
}) {
  const now = new Date();
  const [maxSort] = await db.select({ max: sql<number>`COALESCE(MAX(${taskTemplates.sortOrder}), -1)` })
    .from(taskTemplates).where(eq(taskTemplates.userId, userId));
  const [created] = await db.insert(taskTemplates).values({
    userId, tenantId,
    title: input.title, description: input.description ?? null, icon: input.icon ?? null,
    defaultWhen: input.defaultWhen ?? 'inbox', defaultPriority: input.defaultPriority ?? 'none',
    defaultTags: input.defaultTags ?? [], subtaskTitles: input.subtaskTitles ?? [],
    sortOrder: (maxSort?.max ?? -1) + 1, createdAt: now,
  }).returning();
  return created;
}

export async function updateTemplate(userId: string, templateId: string, input: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.defaultWhen !== undefined) updates.defaultWhen = input.defaultWhen;
  if (input.defaultPriority !== undefined) updates.defaultPriority = input.defaultPriority;
  if (input.defaultTags !== undefined) updates.defaultTags = input.defaultTags;
  if (input.subtaskTitles !== undefined) updates.subtaskTitles = input.subtaskTitles;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  await db.update(taskTemplates).set(updates).where(and(eq(taskTemplates.id, templateId), eq(taskTemplates.userId, userId)));
  const [updated] = await db.select().from(taskTemplates).where(and(eq(taskTemplates.id, templateId), eq(taskTemplates.userId, userId))).limit(1);
  return updated || null;
}

export async function getTemplateById(templateId: string) {
  const [row] = await db.select().from(taskTemplates).where(eq(taskTemplates.id, templateId)).limit(1);
  return row || null;
}

export async function deleteTemplateById(templateId: string) {
  await db.delete(taskTemplates).where(eq(taskTemplates.id, templateId));
}

export async function deleteTemplate(userId: string, templateId: string) {
  await db.delete(taskTemplates).where(and(eq(taskTemplates.id, templateId), eq(taskTemplates.userId, userId)));
}

export async function createTaskFromTemplate(userId: string, tenantId: string, templateId: string) {
  const [template] = await db.select().from(taskTemplates)
    .where(and(eq(taskTemplates.id, templateId), eq(taskTemplates.userId, userId))).limit(1);
  if (!template) return null;

  const task = await createTask(userId, tenantId, {
    title: template.title,
    when: template.defaultWhen as any,
    priority: template.defaultPriority as any,
    tags: template.defaultTags as string[],
    icon: template.icon,
  });

  for (let i = 0; i < (template.subtaskTitles as string[]).length; i++) {
    await createSubtask(userId, task.id, (template.subtaskTitles as string[])[i]);
  }

  return task;
}

// ─── Task Comments ──────────────────────────────────────────────────

export async function listComments(taskId: string) {
  return db
    .select({
      id: taskComments.id, taskId: taskComments.taskId,
      tenantId: taskComments.tenantId, userId: taskComments.userId,
      body: taskComments.body, userName: users.name, userEmail: users.email,
      createdAt: taskComments.createdAt, updatedAt: taskComments.updatedAt,
    })
    .from(taskComments)
    .leftJoin(users, eq(taskComments.userId, users.id))
    .where(eq(taskComments.taskId, taskId))
    .orderBy(asc(taskComments.createdAt));
}

export async function createComment(userId: string, tenantId: string, taskId: string, body: string) {
  const now = new Date();
  const [created] = await db
    .insert(taskComments)
    .values({ taskId, tenantId, userId, body, createdAt: now, updatedAt: now })
    .returning();

  const [result] = await db
    .select({
      id: taskComments.id, taskId: taskComments.taskId,
      tenantId: taskComments.tenantId, userId: taskComments.userId,
      body: taskComments.body, userName: users.name, userEmail: users.email,
      createdAt: taskComments.createdAt, updatedAt: taskComments.updatedAt,
    })
    .from(taskComments)
    .leftJoin(users, eq(taskComments.userId, users.id))
    .where(eq(taskComments.id, created.id))
    .limit(1);

  return result;
}

export async function deleteComment(userId: string, commentId: string) {
  const [comment] = await db.select().from(taskComments)
    .where(eq(taskComments.id, commentId)).limit(1);

  if (!comment) return false;
  if (comment.userId !== userId) return false;

  await db.delete(taskComments).where(eq(taskComments.id, commentId));
  return true;
}

// ─── Task Attachments ──────────────────────────────────────────────

export async function listAttachments(taskId: string) {
  return db.select().from(taskAttachments)
    .where(eq(taskAttachments.taskId, taskId))
    .orderBy(asc(taskAttachments.createdAt));
}

export async function addAttachment(
  userId: string, tenantId: string, taskId: string,
  file: { originalname: string; path: string; mimetype: string; size: number; filename: string },
) {
  const [created] = await db.insert(taskAttachments).values({
    taskId, tenantId, userId,
    fileName: file.originalname,
    storagePath: file.filename,
    mimeType: file.mimetype || null,
    size: file.size,
    createdAt: new Date(),
  }).returning();

  logger.info({ userId, taskId, attachmentId: created.id }, 'Work task attachment added');
  return created;
}

export async function deleteAttachment(userId: string, attachmentId: string) {
  const [attachment] = await db.select().from(taskAttachments)
    .where(eq(taskAttachments.id, attachmentId)).limit(1);

  if (!attachment) return false;
  if (attachment.userId !== userId) return false;

  await db.delete(taskAttachments).where(eq(taskAttachments.id, attachmentId));

  const uploadsDir = path.join(__dirname, '../../../../../uploads');
  const filePath = path.join(uploadsDir, attachment.storagePath);
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    logger.warn({ err, filePath }, 'Failed to delete attachment file from disk');
  }
  return true;
}

export async function getAttachment(attachmentId: string) {
  const [attachment] = await db.select().from(taskAttachments)
    .where(eq(taskAttachments.id, attachmentId)).limit(1);
  return attachment || null;
}

// ─── Task Dependencies ─────────────────────────────────────────────

export async function listDependencies(taskId: string) {
  return db
    .select({
      id: taskDependencies.id, taskId: taskDependencies.taskId,
      blockedByTaskId: taskDependencies.blockedByTaskId,
      blockerTitle: tasks.title, blockerStatus: tasks.status,
      createdAt: taskDependencies.createdAt,
    })
    .from(taskDependencies)
    .innerJoin(tasks, eq(taskDependencies.blockedByTaskId, tasks.id))
    .where(eq(taskDependencies.taskId, taskId))
    .orderBy(asc(taskDependencies.createdAt));
}

export async function addDependency(taskId: string, blockedByTaskId: string) {
  if (taskId === blockedByTaskId) {
    throw new Error('A task cannot block itself');
  }

  const reverse = await db.select().from(taskDependencies)
    .where(and(
      eq(taskDependencies.taskId, blockedByTaskId),
      eq(taskDependencies.blockedByTaskId, taskId),
    )).limit(1);

  if (reverse.length > 0) {
    throw new Error('Circular dependency: the blocker task is already blocked by this task');
  }

  const visited = new Set<string>();
  const queue = [blockedByTaskId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const blockers = await db.select({ blockedBy: taskDependencies.blockedByTaskId })
      .from(taskDependencies)
      .where(eq(taskDependencies.taskId, current));

    for (const b of blockers) {
      if (b.blockedBy === taskId) {
        throw new Error('Circular dependency detected');
      }
      queue.push(b.blockedBy);
    }
  }

  const [created] = await db.insert(taskDependencies).values({
    taskId, blockedByTaskId, createdAt: new Date(),
  }).returning();

  return created;
}

export async function removeDependency(taskId: string, blockedByTaskId: string) {
  await db.delete(taskDependencies).where(
    and(
      eq(taskDependencies.taskId, taskId),
      eq(taskDependencies.blockedByTaskId, blockedByTaskId),
    ),
  );
}

export async function getBlockedTaskIds(userId: string): Promise<string[]> {
  const allDeps = await db
    .select({ taskId: taskDependencies.taskId, blockerStatus: tasks.status })
    .from(taskDependencies)
    .innerJoin(tasks, eq(taskDependencies.blockedByTaskId, tasks.id));

  const blocked = new Set<string>();
  for (const dep of allDeps) {
    if (dep.blockerStatus !== 'completed') {
      blocked.add(dep.taskId);
    }
  }
  return Array.from(blocked);
}
