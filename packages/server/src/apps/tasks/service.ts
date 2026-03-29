import { db } from '../../config/database';
import { tasks, taskProjects, subtasks, taskActivities, taskTemplates } from '../../db/schema';
import { eq, and, asc, desc, sql, isNull } from 'drizzle-orm';
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
  includeArchived?: boolean;
}) {
  const conditions = [eq(tasks.userId, userId)];

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

  return db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt));
}

export async function getTask(userId: string, taskId: string) {
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);

  return task || null;
}

export async function createTask(userId: string, accountId: string, input: CreateTaskInput) {
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
      sourceEmailId: (input as any).sourceEmailId ?? null,
      sourceEmailSubject: (input as any).sourceEmailSubject ?? null,
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

export async function listProjects(userId: string, includeArchived = false) {
  const conditions = [eq(taskProjects.userId, userId)];
  if (!includeArchived) {
    conditions.push(eq(taskProjects.isArchived, false));
  }

  return db
    .select()
    .from(taskProjects)
    .where(and(...conditions))
    .orderBy(asc(taskProjects.sortOrder), asc(taskProjects.createdAt));
}

export async function getProject(userId: string, projectId: string) {
  const [project] = await db
    .select()
    .from(taskProjects)
    .where(and(eq(taskProjects.id, projectId), eq(taskProjects.userId, userId)))
    .limit(1);

  return project || null;
}

export async function createProject(userId: string, accountId: string, input: CreateProjectInput) {
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
