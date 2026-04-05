import { db } from '../../../config/database';
import {
  projectTimeEntries, projectProjects, users,
} from '../../../db/schema';
import { eq, and, asc, desc, gte, lte, inArray, sql } from 'drizzle-orm';
import { logger } from '../../../utils/logger';

// ─── Input types ────────────────────────────────────────────────────

interface CreateTimeEntryInput {
  projectId: string;
  durationMinutes: number;
  workDate: string;
  startTime?: string | null;
  endTime?: string | null;
  billable?: boolean;
  notes?: string | null;
  taskDescription?: string | null;
}

interface UpdateTimeEntryInput extends Partial<CreateTimeEntryInput> {
  billed?: boolean;
  locked?: boolean;
  sortOrder?: number;
  isArchived?: boolean;
}

// ─── Time Entries ───────────────────────────────────────────────────

export async function listTimeEntries(userId: string, accountId: string, filters?: {
  projectId?: string;
  startDate?: string;
  endDate?: string;
  billed?: boolean;
  billable?: boolean;
  entryUserId?: string;
  includeArchived?: boolean;
  isAdmin?: boolean;
}) {
  const conditions = [eq(projectTimeEntries.accountId, accountId)];

  // Non-admin users can only see their own time entries
  if (!filters?.isAdmin) {
    conditions.push(eq(projectTimeEntries.userId, userId));
  }
  if (!filters?.includeArchived) {
    conditions.push(eq(projectTimeEntries.isArchived, false));
  }
  if (filters?.projectId) {
    conditions.push(eq(projectTimeEntries.projectId, filters.projectId));
  }
  if (filters?.startDate) {
    conditions.push(gte(projectTimeEntries.workDate, filters.startDate));
  }
  if (filters?.endDate) {
    conditions.push(lte(projectTimeEntries.workDate, filters.endDate));
  }
  if (filters?.billed !== undefined) {
    conditions.push(eq(projectTimeEntries.billed, filters.billed));
  }
  if (filters?.billable !== undefined) {
    conditions.push(eq(projectTimeEntries.billable, filters.billable));
  }
  if (filters?.entryUserId) {
    conditions.push(eq(projectTimeEntries.userId, filters.entryUserId));
  }

  return db
    .select({
      id: projectTimeEntries.id,
      accountId: projectTimeEntries.accountId,
      userId: projectTimeEntries.userId,
      projectId: projectTimeEntries.projectId,
      durationMinutes: projectTimeEntries.durationMinutes,
      workDate: projectTimeEntries.workDate,
      startTime: projectTimeEntries.startTime,
      endTime: projectTimeEntries.endTime,
      billable: projectTimeEntries.billable,
      billed: projectTimeEntries.billed,
      locked: projectTimeEntries.locked,
      invoiceLineItemId: projectTimeEntries.invoiceLineItemId,
      notes: projectTimeEntries.notes,
      taskDescription: projectTimeEntries.taskDescription,
      isArchived: projectTimeEntries.isArchived,
      sortOrder: projectTimeEntries.sortOrder,
      createdAt: projectTimeEntries.createdAt,
      updatedAt: projectTimeEntries.updatedAt,
      projectName: projectProjects.name,
      projectColor: projectProjects.color,
      userName: users.name,
    })
    .from(projectTimeEntries)
    .innerJoin(projectProjects, eq(projectTimeEntries.projectId, projectProjects.id))
    .innerJoin(users, eq(projectTimeEntries.userId, users.id))
    .where(and(...conditions))
    .orderBy(desc(projectTimeEntries.workDate), desc(projectTimeEntries.createdAt));
}

export async function getTimeEntry(userId: string, accountId: string, id: string) {
  const [entry] = await db
    .select({
      id: projectTimeEntries.id,
      accountId: projectTimeEntries.accountId,
      userId: projectTimeEntries.userId,
      projectId: projectTimeEntries.projectId,
      durationMinutes: projectTimeEntries.durationMinutes,
      workDate: projectTimeEntries.workDate,
      startTime: projectTimeEntries.startTime,
      endTime: projectTimeEntries.endTime,
      billable: projectTimeEntries.billable,
      billed: projectTimeEntries.billed,
      locked: projectTimeEntries.locked,
      invoiceLineItemId: projectTimeEntries.invoiceLineItemId,
      notes: projectTimeEntries.notes,
      taskDescription: projectTimeEntries.taskDescription,
      isArchived: projectTimeEntries.isArchived,
      sortOrder: projectTimeEntries.sortOrder,
      createdAt: projectTimeEntries.createdAt,
      updatedAt: projectTimeEntries.updatedAt,
      projectName: projectProjects.name,
      projectColor: projectProjects.color,
      userName: users.name,
    })
    .from(projectTimeEntries)
    .innerJoin(projectProjects, eq(projectTimeEntries.projectId, projectProjects.id))
    .innerJoin(users, eq(projectTimeEntries.userId, users.id))
    .where(and(eq(projectTimeEntries.id, id), eq(projectTimeEntries.accountId, accountId)))
    .limit(1);

  return entry || null;
}

export async function createTimeEntry(userId: string, accountId: string, input: CreateTimeEntryInput) {
  const now = new Date();
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${projectTimeEntries.sortOrder}), -1)` })
    .from(projectTimeEntries)
    .where(eq(projectTimeEntries.accountId, accountId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(projectTimeEntries)
    .values({
      accountId,
      userId,
      projectId: input.projectId,
      durationMinutes: input.durationMinutes,
      workDate: input.workDate,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      billable: input.billable ?? true,
      notes: input.notes ?? null,
      taskDescription: input.taskDescription ?? null,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, timeEntryId: created.id }, 'Time entry created');
  return created;
}

export async function updateTimeEntry(userId: string, accountId: string, id: string, input: UpdateTimeEntryInput) {
  // Check if the entry is locked before allowing edits
  const existing = await getTimeEntry(userId, accountId, id);
  if (!existing) return null;
  if (existing.locked) {
    throw new Error('Cannot edit a locked time entry');
  }

  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.projectId !== undefined) updates.projectId = input.projectId;
  if (input.durationMinutes !== undefined) updates.durationMinutes = input.durationMinutes;
  if (input.workDate !== undefined) updates.workDate = input.workDate;
  if (input.startTime !== undefined) updates.startTime = input.startTime;
  if (input.endTime !== undefined) updates.endTime = input.endTime;
  if (input.billable !== undefined) updates.billable = input.billable;
  if (input.billed !== undefined) updates.billed = input.billed;
  if (input.locked !== undefined) updates.locked = input.locked;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.taskDescription !== undefined) updates.taskDescription = input.taskDescription;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  const conditions = [eq(projectTimeEntries.id, id), eq(projectTimeEntries.accountId, accountId)];

  const [updated] = await db
    .update(projectTimeEntries)
    .set(updates)
    .where(and(...conditions))
    .returning();

  return updated || null;
}

export async function deleteTimeEntry(userId: string, accountId: string, id: string) {
  await updateTimeEntry(userId, accountId, id, { isArchived: true });
}

export async function bulkLockEntries(userId: string, accountId: string, entryIds: string[], locked: boolean) {
  const now = new Date();
  await db
    .update(projectTimeEntries)
    .set({ locked, updatedAt: now })
    .where(and(
      eq(projectTimeEntries.accountId, accountId),
      inArray(projectTimeEntries.id, entryIds),
    ));
}

export async function getWeeklyView(userId: string, accountId: string, weekStart: string) {
  // weekStart is a YYYY-MM-DD string for Monday of the week
  const startDate = new Date(weekStart);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  const endStr = endDate.toISOString().split('T')[0];

  return db
    .select({
      id: projectTimeEntries.id,
      userId: projectTimeEntries.userId,
      projectId: projectTimeEntries.projectId,
      durationMinutes: projectTimeEntries.durationMinutes,
      workDate: projectTimeEntries.workDate,
      startTime: projectTimeEntries.startTime,
      endTime: projectTimeEntries.endTime,
      billable: projectTimeEntries.billable,
      billed: projectTimeEntries.billed,
      locked: projectTimeEntries.locked,
      notes: projectTimeEntries.notes,
      taskDescription: projectTimeEntries.taskDescription,
      projectName: projectProjects.name,
      projectColor: projectProjects.color,
    })
    .from(projectTimeEntries)
    .innerJoin(projectProjects, eq(projectTimeEntries.projectId, projectProjects.id))
    .where(and(
      eq(projectTimeEntries.accountId, accountId),
      eq(projectTimeEntries.userId, userId),
      eq(projectTimeEntries.isArchived, false),
      gte(projectTimeEntries.workDate, weekStart),
      lte(projectTimeEntries.workDate, endStr),
    ))
    .orderBy(asc(projectTimeEntries.workDate), asc(projectTimeEntries.createdAt));
}

// ─── Bulk Time Entry Operations ─────────────────────────────────────

export async function bulkSaveTimeEntries(
  userId: string,
  accountId: string,
  entries: Array<{ projectId: string; date: string; hours: number; description?: string | null; isBillable?: boolean }>,
) {
  const now = new Date();

  // Delete existing entries for this user in the affected date range
  const dates = [...new Set(entries.map(e => e.date))];
  if (dates.length > 0) {
    for (const date of dates) {
      await db
        .delete(projectTimeEntries)
        .where(and(
          eq(projectTimeEntries.userId, userId),
          eq(projectTimeEntries.accountId, accountId),
          eq(projectTimeEntries.workDate, date),
          eq(projectTimeEntries.locked, false),
        ));
    }
  }

  // Insert new entries
  const created = [];
  for (const entry of entries) {
    if (entry.hours <= 0) continue;
    const durationMinutes = Math.round(entry.hours * 60);
    const [row] = await db
      .insert(projectTimeEntries)
      .values({
        accountId,
        userId,
        projectId: entry.projectId,
        durationMinutes,
        workDate: entry.date,
        billable: entry.isBillable ?? true,
        billed: false,
        locked: false,
        notes: entry.description || null,
        isArchived: false,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    created.push(row);
  }

  return created;
}

export async function copyLastWeek(
  userId: string,
  accountId: string,
  weekStart: string,
) {
  // Calculate previous week start
  const prevWeekStart = new Date(weekStart + 'T00:00:00');
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekEnd = new Date(prevWeekStart);
  prevWeekEnd.setDate(prevWeekEnd.getDate() + 6);

  const prevStartStr = prevWeekStart.toISOString().slice(0, 10);
  const prevEndStr = prevWeekEnd.toISOString().slice(0, 10);

  // Fetch entries from last week
  const lastWeekEntries = await db
    .select()
    .from(projectTimeEntries)
    .where(and(
      eq(projectTimeEntries.userId, userId),
      eq(projectTimeEntries.accountId, accountId),
      eq(projectTimeEntries.isArchived, false),
      gte(projectTimeEntries.workDate, prevStartStr),
      lte(projectTimeEntries.workDate, prevEndStr),
    ));

  const now = new Date();
  const created = [];

  for (const entry of lastWeekEntries) {
    // Shift date by 7 days
    const oldDate = new Date(entry.workDate + 'T00:00:00');
    oldDate.setDate(oldDate.getDate() + 7);
    const newDate = oldDate.toISOString().slice(0, 10);

    const [row] = await db
      .insert(projectTimeEntries)
      .values({
        accountId,
        userId,
        projectId: entry.projectId,
        durationMinutes: entry.durationMinutes,
        workDate: newDate,
        billable: entry.billable,
        billed: false,
        locked: false,
        notes: entry.notes,
        taskDescription: entry.taskDescription,
        isArchived: false,
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    created.push(row);
  }

  return created;
}
