import { db } from '../../config/database';
import { tasks, taskProjects, subtasks, taskActivities, taskTemplates, taskComments, taskAttachments, taskDependencies, users } from '../../db/schema';
import { eq, and, asc, desc, sql, isNull, gte, lte, or, ne } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';
import type {
  CreateTaskInput, UpdateTaskInput,
  CreateProjectInput, UpdateProjectInput,
  RecurrenceRule,
} from '@atlasmail/shared';

// ─── Recurrence helpers ──────────────────────────────────────────────

function calculateNextDueDate(currentDueDate: string | null, rule: RecurrenceRule): string {
  const base = currentDueDate ? new Date(currentDueDate + 'T00:00:00') : new Date();
  // Use local date parts to avoid timezone issues
  let y = base.getFullYear();
  let m = base.getMonth();
  let d = base.getDate();

  switch (rule) {
    case 'daily': {
      const next = new Date(y, m, d + 1);
      return fmt(next);
    }
    case 'weekdays': {
      const next = new Date(y, m, d + 1);
      // Skip Saturday (6) and Sunday (0)
      while (next.getDay() === 0 || next.getDay() === 6) {
        next.setDate(next.getDate() + 1);
      }
      return fmt(next);
    }
    case 'weekly':
      return fmt(new Date(y, m, d + 7));
    case 'biweekly':
      return fmt(new Date(y, m, d + 14));
    case 'monthly': {
      // Same date next month, clamped to month end
      const next = new Date(y, m + 1, 1); // first of next month
      const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
      next.setDate(Math.min(d, lastDay));
      return fmt(next);
    }
    case 'yearly': {
      const next = new Date(y + 1, m, 1);
      const lastDay = new Date(y + 1, m + 1, 0).getDate();
      next.setDate(Math.min(d, lastDay));
      return fmt(next);
    }
  }
}

function fmt(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// ─── Tasks ──────────────────────────────────────────────────────────

export async function listTasks(userId: string, filters?: {
  status?: string;
  when?: string;
  projectId?: string | null;
  assigneeId?: string;
  includeArchived?: boolean;
  tenantId?: string | null;
}) {
  const ownerCondition = filters?.tenantId
    ? or(eq(tasks.userId, userId), and(eq(tasks.visibility, 'team'), eq(tasks.tenantId, filters.tenantId)))
    : eq(tasks.userId, userId);
  const conditions = [ownerCondition!];

  if (!filters?.includeArchived) {
    conditions.push(eq(tasks.isArchived, false));
  }
  if (filters?.status) {
    conditions.push(eq(tasks.status, filters.status));
  }
  if (filters?.when) {
    if (filters.when === 'today') {
      // Include both 'today' and 'evening' tasks in the Today view
      conditions.push(sql`${tasks.when} IN ('today', 'evening')`);
    } else {
      conditions.push(eq(tasks.when, filters.when));
    }
  }
  if (filters?.projectId !== undefined) {
    if (filters.projectId === null) {
      conditions.push(isNull(tasks.projectId));
    } else {
      conditions.push(eq(tasks.projectId, filters.projectId));
    }
  }
  if (filters?.assigneeId) {
    conditions.push(eq(tasks.assigneeId, filters.assigneeId));
  }

  return db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt));
}

export async function getTask(userId: string, taskId: string, tenantId?: string | null) {
  const ownerCondition = tenantId
    ? or(eq(tasks.userId, userId), and(eq(tasks.visibility, 'team'), eq(tasks.tenantId, tenantId)))
    : eq(tasks.userId, userId);
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), ownerCondition!))
    .limit(1);

  return task || null;
}

export async function createTask(userId: string, accountId: string, input: CreateTaskInput, tenantId?: string | null) {
  const now = new Date();

  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${tasks.sortOrder}), -1)` })
    .from(tasks)
    .where(eq(tasks.userId, userId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(tasks)
    .values({
      accountId,
      userId,
      title: input.title || '',
      notes: input.notes ?? null,
      description: input.description ?? null,
      icon: input.icon ?? null,
      type: input.type ?? 'task',
      headingId: input.headingId ?? null,
      projectId: input.projectId ?? null,
      when: input.when ?? 'inbox',
      priority: input.priority ?? 'none',
      dueDate: input.dueDate ?? null,
      tags: input.tags ?? [],
      recurrenceRule: input.recurrenceRule ?? null,
      assigneeId: input.assigneeId || null,
      sourceEmailId: (input as any).sourceEmailId ?? null,
      sourceEmailSubject: (input as any).sourceEmailSubject ?? null,
      tenantId: tenantId ?? null,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, taskId: created.id }, 'Task created');
  return created;
}

export async function updateTask(userId: string, taskId: string, input: UpdateTaskInput) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.title !== undefined) updates.title = input.title;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.description !== undefined) updates.description = input.description;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.type !== undefined) updates.type = input.type;
  if (input.headingId !== undefined) updates.headingId = input.headingId;
  if (input.projectId !== undefined) updates.projectId = input.projectId;
  if (input.status !== undefined) {
    updates.status = input.status;
    if (input.status === 'completed' || input.status === 'cancelled') {
      updates.completedAt = now;
    } else {
      updates.completedAt = null;
    }
  }
  if (input.when !== undefined) updates.when = input.when;
  if (input.priority !== undefined) updates.priority = input.priority;
  if (input.dueDate !== undefined) updates.dueDate = input.dueDate;
  if (input.tags !== undefined) updates.tags = input.tags;
  if (input.recurrenceRule !== undefined) updates.recurrenceRule = input.recurrenceRule;
  if (input.assigneeId !== undefined) {
    if (input.assigneeId) {
      const [assignee] = await db.select({ id: users.id }).from(users)
        .where(eq(users.id, input.assigneeId))
        .limit(1);
      if (!assignee) { throw new Error('Assignee user not found'); }
    }
    updates.assigneeId = input.assigneeId;
  }
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;
  if ((input as any).sourceEmailId !== undefined) updates.sourceEmailId = (input as any).sourceEmailId;
  if ((input as any).sourceEmailSubject !== undefined) updates.sourceEmailSubject = (input as any).sourceEmailSubject;

  await db
    .update(tasks)
    .set(updates)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

  const [updated] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  if (!updated) return null;

  // Auto-create next recurring instance when completed/cancelled
  if (
    input.status &&
    (input.status === 'completed' || input.status === 'cancelled') &&
    updated.recurrenceRule
  ) {
    const nextDueDate = calculateNextDueDate(updated.dueDate, updated.recurrenceRule as RecurrenceRule);
    const parentId = updated.recurrenceParentId || updated.id;

    const [maxSort] = await db
      .select({ max: sql<number>`COALESCE(MAX(${tasks.sortOrder}), -1)` })
      .from(tasks)
      .where(eq(tasks.userId, userId));

    const nextSortOrder = (maxSort?.max ?? -1) + 1;

    const [nextTask] = await db
      .insert(tasks)
      .values({
        accountId: updated.accountId,
        userId: updated.userId,
        title: updated.title,
        notes: updated.notes,
        description: updated.description,
        icon: updated.icon,
        type: updated.type,
        headingId: updated.headingId,
        projectId: updated.projectId,
        when: updated.when,
        priority: updated.priority,
        dueDate: nextDueDate,
        tags: updated.tags as string[],
        recurrenceRule: updated.recurrenceRule,
        recurrenceParentId: parentId,
        sortOrder: nextSortOrder,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    logger.info({ userId, taskId: updated.id, nextTaskId: nextTask.id, nextDueDate }, 'Created next recurring task');
  }

  return updated;
}

export async function deleteTask(userId: string, taskId: string) {
  await updateTask(userId, taskId, { isArchived: true });
}

export async function restoreTask(userId: string, taskId: string) {
  const now = new Date();
  await db
    .update(tasks)
    .set({ isArchived: false, updatedAt: now })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));

  const [restored] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  return restored || null;
}

export async function searchTasks(userId: string, query: string) {
  const searchTerm = `%${query}%`;
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.isArchived, false),
        sql`${tasks.title} LIKE ${searchTerm}`,
      ),
    )
    .orderBy(desc(tasks.updatedAt))
    .limit(30);
}

export async function reorderTasks(userId: string, taskIds: string[]) {
  const now = new Date();
  for (let i = 0; i < taskIds.length; i++) {
    await db
      .update(tasks)
      .set({ sortOrder: i, updatedAt: now })
      .where(and(eq(tasks.id, taskIds[i]), eq(tasks.userId, userId)));
  }
}

// ─── Projects ───────────────────────────────────────────────────────

export async function listProjects(userId: string, includeArchived = false, tenantId?: string | null) {
  const ownerCondition = tenantId
    ? or(eq(taskProjects.userId, userId), and(eq(taskProjects.visibility, 'team'), eq(taskProjects.tenantId, tenantId)))
    : eq(taskProjects.userId, userId);
  const conditions = [ownerCondition!];
  if (!includeArchived) {
    conditions.push(eq(taskProjects.isArchived, false));
  }

  return db
    .select()
    .from(taskProjects)
    .where(and(...conditions))
    .orderBy(asc(taskProjects.sortOrder), asc(taskProjects.createdAt));
}

export async function getProject(userId: string, projectId: string, tenantId?: string | null) {
  const ownerCondition = tenantId
    ? or(eq(taskProjects.userId, userId), and(eq(taskProjects.visibility, 'team'), eq(taskProjects.tenantId, tenantId)))
    : eq(taskProjects.userId, userId);
  const [project] = await db
    .select()
    .from(taskProjects)
    .where(and(eq(taskProjects.id, projectId), ownerCondition!))
    .limit(1);

  return project || null;
}

export async function createProject(userId: string, accountId: string, input: CreateProjectInput, tenantId?: string | null) {
  const now = new Date();

  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${taskProjects.sortOrder}), -1)` })
    .from(taskProjects)
    .where(eq(taskProjects.userId, userId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(taskProjects)
    .values({
      accountId,
      userId,
      title: input.title || 'Untitled project',
      description: input.description ?? null,
      icon: input.icon ?? null,
      color: input.color ?? '#5a7fa0',
      tenantId: tenantId ?? null,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, projectId: created.id }, 'Task project created');
  return created;
}

export async function updateProject(userId: string, projectId: string, input: UpdateProjectInput) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.title !== undefined) updates.title = input.title;
  if (input.color !== undefined) updates.color = input.color;
  if (input.description !== undefined) updates.description = input.description;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  await db
    .update(taskProjects)
    .set(updates)
    .where(and(eq(taskProjects.id, projectId), eq(taskProjects.userId, userId)));

  const [updated] = await db
    .select()
    .from(taskProjects)
    .where(and(eq(taskProjects.id, projectId), eq(taskProjects.userId, userId)))
    .limit(1);

  return updated || null;
}

export async function deleteProject(userId: string, projectId: string) {
  await updateProject(userId, projectId, { isArchived: true });
}

// ─── Stats ──────────────────────────────────────────────────────────

export async function getTaskCounts(userId: string) {
  const allTasks = await db
    .select({
      status: tasks.status,
      when: tasks.when,
    })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.isArchived, false)));

  const counts = {
    inbox: 0,
    today: 0,
    upcoming: 0,
    anytime: 0,
    someday: 0,
    logbook: 0,
    total: 0,
  };

  for (const t of allTasks) {
    if (t.status === 'completed' || t.status === 'cancelled') {
      counts.logbook++;
    } else {
      counts.total++;
      if (t.when === 'inbox') counts.inbox++;
      else if (t.when === 'today' || t.when === 'evening') counts.today++;
      else if (t.when === 'anytime') counts.anytime++;
      else if (t.when === 'someday') counts.someday++;
    }
  }

  // Upcoming = tasks with a due date that aren't today
  const tasksWithDueDate = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.isArchived, false),
        eq(tasks.status, 'todo'),
        sql`${tasks.dueDate} IS NOT NULL`,
      ),
    );
  counts.upcoming = tasksWithDueDate.length;

  // Assigned to me
  const assignedToMe = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        eq(tasks.isArchived, false),
        eq(tasks.status, 'todo'),
        eq(tasks.assigneeId, userId),
      ),
    );
  (counts as any).assignedToMe = assignedToMe.length;

  return counts;
}

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

export async function createTemplate(userId: string, accountId: string, input: {
  title: string; description?: string | null; icon?: string | null;
  defaultWhen?: string; defaultPriority?: string; defaultTags?: string[]; subtaskTitles?: string[];
}) {
  const now = new Date();
  const [maxSort] = await db.select({ max: sql<number>`COALESCE(MAX(${taskTemplates.sortOrder}), -1)` })
    .from(taskTemplates).where(eq(taskTemplates.userId, userId));
  const [created] = await db.insert(taskTemplates).values({
    userId, accountId,
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

export async function deleteTemplate(userId: string, templateId: string) {
  await db.delete(taskTemplates).where(and(eq(taskTemplates.id, templateId), eq(taskTemplates.userId, userId)));
}

export async function createTaskFromTemplate(userId: string, accountId: string, templateId: string) {
  const [template] = await db.select().from(taskTemplates)
    .where(and(eq(taskTemplates.id, templateId), eq(taskTemplates.userId, userId))).limit(1);
  if (!template) return null;

  const task = await createTask(userId, accountId, {
    title: template.title,
    when: template.defaultWhen as any,
    priority: template.defaultPriority as any,
    tags: template.defaultTags as string[],
    icon: template.icon,
  });

  // Create subtasks from template
  for (let i = 0; i < (template.subtaskTitles as string[]).length; i++) {
    await createSubtask(userId, task.id, (template.subtaskTitles as string[])[i]);
  }

  return task;
}

// ─── Widget summary (lightweight) ──────────────────────────────────

export async function getWidgetData(userId: string) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Due today
  const [dueTodayAgg] = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(tasks)
    .where(and(
      eq(tasks.userId, userId),
      eq(tasks.isArchived, false),
      eq(tasks.status, 'todo'),
      eq(tasks.dueDate, today),
    ));

  // Overdue (due before today, still todo)
  const [overdueAgg] = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(tasks)
    .where(and(
      eq(tasks.userId, userId),
      eq(tasks.isArchived, false),
      eq(tasks.status, 'todo'),
      sql`${tasks.dueDate} IS NOT NULL`,
      sql`${tasks.dueDate} < ${today}`,
    ));

  // Completed this week (Mon-Sun)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);

  const [completedAgg] = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(tasks)
    .where(and(
      eq(tasks.userId, userId),
      eq(tasks.isArchived, false),
      eq(tasks.status, 'completed'),
      gte(tasks.completedAt, weekStart),
    ));

  // Total active
  const [totalAgg] = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(tasks)
    .where(and(
      eq(tasks.userId, userId),
      eq(tasks.isArchived, false),
      eq(tasks.status, 'todo'),
    ));

  return {
    dueToday: Number(dueTodayAgg?.count ?? 0),
    overdue: Number(overdueAgg?.count ?? 0),
    completedThisWeek: Number(completedAgg?.count ?? 0),
    total: Number(totalAgg?.count ?? 0),
  };
}

// ─── Task Comments ──────────────────────────────────────────────────

export async function listComments(taskId: string) {
  return db
    .select({
      id: taskComments.id,
      taskId: taskComments.taskId,
      accountId: taskComments.accountId,
      userId: taskComments.userId,
      body: taskComments.body,
      userName: users.name,
      userEmail: users.email,
      createdAt: taskComments.createdAt,
      updatedAt: taskComments.updatedAt,
    })
    .from(taskComments)
    .leftJoin(users, eq(taskComments.userId, users.id))
    .where(eq(taskComments.taskId, taskId))
    .orderBy(asc(taskComments.createdAt));
}

export async function createComment(userId: string, accountId: string, taskId: string, body: string) {
  const now = new Date();
  const [created] = await db
    .insert(taskComments)
    .values({
      taskId,
      accountId,
      userId,
      body,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Return with user info joined
  const [result] = await db
    .select({
      id: taskComments.id,
      taskId: taskComments.taskId,
      accountId: taskComments.accountId,
      userId: taskComments.userId,
      body: taskComments.body,
      userName: users.name,
      userEmail: users.email,
      createdAt: taskComments.createdAt,
      updatedAt: taskComments.updatedAt,
    })
    .from(taskComments)
    .leftJoin(users, eq(taskComments.userId, users.id))
    .where(eq(taskComments.id, created.id))
    .limit(1);

  return result;
}

export async function deleteComment(userId: string, commentId: string) {
  // Only the author can delete
  const [comment] = await db
    .select()
    .from(taskComments)
    .where(eq(taskComments.id, commentId))
    .limit(1);

  if (!comment) return false;
  if (comment.userId !== userId) return false;

  await db.delete(taskComments).where(eq(taskComments.id, commentId));
  return true;
}

// ─── Visibility ────────────────────────────────────────────────────

export async function updateTaskVisibility(userId: string, taskId: string, visibility: 'private' | 'team', tenantId: string | null) {
  if (visibility === 'team' && !tenantId) throw new Error('Tenant required for team visibility');
  await db.update(tasks).set({ visibility, tenantId: visibility === 'team' ? tenantId : null, updatedAt: new Date() })
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
}

export async function updateProjectVisibility(userId: string, projectId: string, visibility: 'private' | 'team', tenantId: string | null) {
  if (visibility === 'team' && !tenantId) throw new Error('Tenant required for team visibility');
  await db.update(taskProjects).set({ visibility, tenantId: visibility === 'team' ? tenantId : null, updatedAt: new Date() })
    .where(and(eq(taskProjects.id, projectId), eq(taskProjects.userId, userId)));
}

// ─── Task Attachments ──────────────────────────────────────────────

export async function listAttachments(taskId: string) {
  return db.select().from(taskAttachments)
    .where(eq(taskAttachments.taskId, taskId))
    .orderBy(asc(taskAttachments.createdAt));
}

export async function addAttachment(
  userId: string,
  accountId: string,
  taskId: string,
  file: { originalname: string; path: string; mimetype: string; size: number; filename: string },
) {
  const [created] = await db.insert(taskAttachments).values({
    taskId,
    accountId,
    userId,
    fileName: file.originalname,
    storagePath: file.filename,
    mimeType: file.mimetype || null,
    size: file.size,
    createdAt: new Date(),
  }).returning();

  logger.info({ userId, taskId, attachmentId: created.id }, 'Task attachment added');
  return created;
}

export async function deleteAttachment(userId: string, attachmentId: string) {
  const [attachment] = await db.select().from(taskAttachments)
    .where(eq(taskAttachments.id, attachmentId)).limit(1);

  if (!attachment) return false;
  if (attachment.userId !== userId) return false;

  // Delete DB record first, then clean up file (orphaned file is better than orphaned record)
  await db.delete(taskAttachments).where(eq(taskAttachments.id, attachmentId));

  const uploadsDir = path.join(__dirname, '../../../uploads');
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
  const deps = await db
    .select({
      id: taskDependencies.id,
      taskId: taskDependencies.taskId,
      blockedByTaskId: taskDependencies.blockedByTaskId,
      blockerTitle: tasks.title,
      blockerStatus: tasks.status,
      createdAt: taskDependencies.createdAt,
    })
    .from(taskDependencies)
    .innerJoin(tasks, eq(taskDependencies.blockedByTaskId, tasks.id))
    .where(eq(taskDependencies.taskId, taskId))
    .orderBy(asc(taskDependencies.createdAt));

  return deps;
}

export async function addDependency(taskId: string, blockedByTaskId: string) {
  // Prevent self-dependency
  if (taskId === blockedByTaskId) {
    throw new Error('A task cannot block itself');
  }

  // Prevent circular dependency (A blocks B blocks A)
  const reverse = await db.select().from(taskDependencies)
    .where(and(
      eq(taskDependencies.taskId, blockedByTaskId),
      eq(taskDependencies.blockedByTaskId, taskId),
    )).limit(1);

  if (reverse.length > 0) {
    throw new Error('Circular dependency: the blocker task is already blocked by this task');
  }

  // Also check transitive circular deps (A -> B -> C -> A)
  // We do a simple BFS from blockedByTaskId to see if we can reach taskId
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
    taskId,
    blockedByTaskId,
    createdAt: new Date(),
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
  // Returns task IDs that have at least one incomplete blocker
  const allDeps = await db
    .select({
      taskId: taskDependencies.taskId,
      blockerStatus: tasks.status,
    })
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
