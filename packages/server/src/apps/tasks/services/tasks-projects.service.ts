import { db } from '../../../config/database';
import { tasks, taskProjects, users } from '../../../db/schema';
import { eq, and, asc, desc, sql, isNull, gte, or } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import type {
  CreateTaskInput, UpdateTaskInput,
  CreateProjectInput, UpdateProjectInput,
  RecurrenceRule,
} from '@atlasmail/shared';

// ─── Recurrence helpers ──────────────────────────────────────────────

function calculateNextDueDate(currentDueDate: string | null, rule: RecurrenceRule): string {
  const base = currentDueDate ? new Date(currentDueDate + 'T00:00:00') : new Date();
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
      const next = new Date(y, m + 1, 1);
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
  visibility?: 'private' | 'team';
}) {
  let ownerCondition;
  if (filters?.visibility === 'team' && filters?.tenantId) {
    ownerCondition = and(eq(tasks.visibility, 'team'), eq(tasks.tenantId, filters.tenantId));
  } else if (filters?.tenantId) {
    ownerCondition = or(eq(tasks.userId, userId), and(eq(tasks.visibility, 'team'), eq(tasks.tenantId, filters.tenantId)));
  } else {
    ownerCondition = eq(tasks.userId, userId);
  }
  const conditions = [ownerCondition!];

  if (!filters?.includeArchived) {
    conditions.push(eq(tasks.isArchived, false));
  }
  if (filters?.status) {
    conditions.push(eq(tasks.status, filters.status));
  }
  if (filters?.when) {
    if (filters.when === 'today') {
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
    .select({
      id: tasks.id, accountId: tasks.accountId, userId: tasks.userId,
      projectId: tasks.projectId, title: tasks.title, notes: tasks.notes,
      description: tasks.description, icon: tasks.icon, type: tasks.type,
      headingId: tasks.headingId, status: tasks.status, when: tasks.when,
      priority: tasks.priority, dueDate: tasks.dueDate, completedAt: tasks.completedAt,
      sortOrder: tasks.sortOrder, tags: tasks.tags, recurrenceRule: tasks.recurrenceRule,
      recurrenceParentId: tasks.recurrenceParentId, isArchived: tasks.isArchived,
      assigneeId: tasks.assigneeId, sourceEmailId: tasks.sourceEmailId,
      sourceEmailSubject: tasks.sourceEmailSubject, visibility: tasks.visibility,
      tenantId: tasks.tenantId, createdAt: tasks.createdAt, updatedAt: tasks.updatedAt,
      creatorName: users.name, creatorEmail: users.email,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.userId, users.id))
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
      accountId, userId,
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
      visibility: input.visibility ?? 'team',
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
        accountId: updated.accountId, userId: updated.userId,
        title: updated.title, notes: updated.notes, description: updated.description,
        icon: updated.icon, type: updated.type, headingId: updated.headingId,
        projectId: updated.projectId, when: updated.when, priority: updated.priority,
        dueDate: nextDueDate, tags: updated.tags as string[],
        recurrenceRule: updated.recurrenceRule, recurrenceParentId: parentId,
        sortOrder: nextSortOrder, createdAt: now, updatedAt: now,
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
      accountId, userId,
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

export async function getTaskCounts(userId: string, tenantId?: string | null) {
  const allTasks = await db
    .select({ status: tasks.status, when: tasks.when })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.isArchived, false)));

  const counts = {
    inbox: 0, today: 0, upcoming: 0, anytime: 0, someday: 0, logbook: 0, total: 0, team: 0,
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

  const tasksWithDueDate = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId), eq(tasks.isArchived, false),
        eq(tasks.status, 'todo'), sql`${tasks.dueDate} IS NOT NULL`,
      ),
    );
  counts.upcoming = tasksWithDueDate.length;

  const assignedToMe = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId), eq(tasks.isArchived, false),
        eq(tasks.status, 'todo'), eq(tasks.assigneeId, userId),
      ),
    );
  (counts as any).assignedToMe = assignedToMe.length;

  if (tenantId) {
    const teamTasks = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.visibility, 'team'), eq(tasks.tenantId, tenantId),
          eq(tasks.isArchived, false), eq(tasks.status, 'todo'),
        ),
      );
    counts.team = teamTasks.length;
  }

  return counts;
}

// ─── Widget summary (lightweight) ──────────────────────────────────

export async function getWidgetData(userId: string) {
  const today = new Date().toISOString().slice(0, 10);

  const [dueTodayAgg] = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.isArchived, false), eq(tasks.status, 'todo'), eq(tasks.dueDate, today)));

  const [overdueAgg] = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.isArchived, false), eq(tasks.status, 'todo'), sql`${tasks.dueDate} IS NOT NULL`, sql`${tasks.dueDate} < ${today}`));

  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);

  const [completedAgg] = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.isArchived, false), eq(tasks.status, 'completed'), gte(tasks.completedAt, weekStart)));

  const [totalAgg] = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.isArchived, false), eq(tasks.status, 'todo')));

  return {
    dueToday: Number(dueTodayAgg?.count ?? 0),
    overdue: Number(overdueAgg?.count ?? 0),
    completedThisWeek: Number(completedAgg?.count ?? 0),
    total: Number(totalAgg?.count ?? 0),
  };
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
