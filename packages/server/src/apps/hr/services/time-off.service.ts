import { db } from '../../../config/database';
import { timeOffRequests, leaveBalances, employees } from '../../../db/schema';
import { eq, and, asc, desc, sql, gte, lte } from 'drizzle-orm';
import { logger } from '../../../utils/logger';

interface CreateTimeOffRequestInput {
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string;
  approverId?: string | null;
  notes?: string | null;
}

interface UpdateTimeOffRequestInput extends Partial<Omit<CreateTimeOffRequestInput, 'employeeId'>> {
  status?: string;
  sortOrder?: number;
  isArchived?: boolean;
}

// ─── Time Off Requests ──────────────────────────────────────────────

export async function listTimeOffRequests(userId: string, tenantId: string, filters?: {
  employeeId?: string;
  status?: string;
  type?: string;
  includeArchived?: boolean;
}) {
  const conditions = [eq(timeOffRequests.userId, userId), eq(timeOffRequests.tenantId, tenantId)];

  if (!filters?.includeArchived) {
    conditions.push(eq(timeOffRequests.isArchived, false));
  }
  if (filters?.employeeId) {
    conditions.push(eq(timeOffRequests.employeeId, filters.employeeId));
  }
  if (filters?.status) {
    conditions.push(eq(timeOffRequests.status, filters.status));
  }
  if (filters?.type) {
    conditions.push(eq(timeOffRequests.type, filters.type));
  }

  return db
    .select({
      id: timeOffRequests.id,
      tenantId: timeOffRequests.tenantId,
      userId: timeOffRequests.userId,
      employeeId: timeOffRequests.employeeId,
      type: timeOffRequests.type,
      startDate: timeOffRequests.startDate,
      endDate: timeOffRequests.endDate,
      status: timeOffRequests.status,
      approverId: timeOffRequests.approverId,
      notes: timeOffRequests.notes,
      sortOrder: timeOffRequests.sortOrder,
      isArchived: timeOffRequests.isArchived,
      createdAt: timeOffRequests.createdAt,
      updatedAt: timeOffRequests.updatedAt,
      employeeName: employees.name,
    })
    .from(timeOffRequests)
    .leftJoin(employees, eq(timeOffRequests.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(desc(timeOffRequests.createdAt));
}

export async function createTimeOffRequest(userId: string, tenantId: string, input: CreateTimeOffRequestInput) {
  const now = new Date();

  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${timeOffRequests.sortOrder}), -1)` })
    .from(timeOffRequests)
    .where(eq(timeOffRequests.userId, userId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(timeOffRequests)
    .values({
      tenantId,
      userId,
      employeeId: input.employeeId,
      type: input.type ?? 'vacation',
      startDate: input.startDate,
      endDate: input.endDate,
      status: 'pending',
      approverId: input.approverId ?? null,
      notes: input.notes ?? null,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, timeOffRequestId: created.id }, 'Time-off request created');
  return created;
}

export async function updateTimeOffRequest(userId: string, tenantId: string, id: string, input: UpdateTimeOffRequestInput) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.type !== undefined) updates.type = input.type;
  if (input.startDate !== undefined) updates.startDate = input.startDate;
  if (input.endDate !== undefined) updates.endDate = input.endDate;
  if (input.status !== undefined) updates.status = input.status;
  if (input.approverId !== undefined) updates.approverId = input.approverId;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  await db
    .update(timeOffRequests)
    .set(updates)
    .where(and(eq(timeOffRequests.id, id), eq(timeOffRequests.userId, userId), eq(timeOffRequests.tenantId, tenantId)));

  const [updated] = await db
    .select()
    .from(timeOffRequests)
    .where(and(eq(timeOffRequests.id, id), eq(timeOffRequests.userId, userId), eq(timeOffRequests.tenantId, tenantId)))
    .limit(1);

  return updated || null;
}

export async function deleteTimeOffRequest(userId: string, tenantId: string, id: string) {
  await updateTimeOffRequest(userId, tenantId, id, { isArchived: true });
}

// ─── Leave Balances ────────────────────────────────────────────────

export async function getLeaveBalances(tenantId: string, employeeId: string, year: number) {
  return db
    .select()
    .from(leaveBalances)
    .where(and(
      eq(leaveBalances.tenantId, tenantId),
      eq(leaveBalances.employeeId, employeeId),
      eq(leaveBalances.year, year),
    ))
    .orderBy(asc(leaveBalances.leaveType));
}

export async function allocateLeave(tenantId: string, employeeId: string, leaveType: string, year: number, days: number) {
  const now = new Date();
  const existing = await db
    .select()
    .from(leaveBalances)
    .where(and(
      eq(leaveBalances.tenantId, tenantId),
      eq(leaveBalances.employeeId, employeeId),
      eq(leaveBalances.leaveType, leaveType),
      eq(leaveBalances.year, year),
    ))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db
      .update(leaveBalances)
      .set({ allocated: days, updatedAt: now })
      .where(eq(leaveBalances.id, existing[0].id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(leaveBalances)
    .values({
      tenantId,
      employeeId,
      leaveType,
      year,
      allocated: days,
      used: 0,
      carried: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

export async function updateUsedLeave(tenantId: string, employeeId: string, leaveType: string, year: number) {
  // Calculate used days from approved time-off requests in the given year
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const approvedRequests = await db
    .select({ startDate: timeOffRequests.startDate, endDate: timeOffRequests.endDate })
    .from(timeOffRequests)
    .where(and(
      eq(timeOffRequests.tenantId, tenantId),
      eq(timeOffRequests.employeeId, employeeId),
      eq(timeOffRequests.type, leaveType),
      eq(timeOffRequests.status, 'approved'),
      eq(timeOffRequests.isArchived, false),
      gte(timeOffRequests.startDate, yearStart),
      lte(timeOffRequests.endDate, yearEnd),
    ));

  let totalDays = 0;
  for (const req of approvedRequests) {
    const start = new Date(req.startDate);
    const end = new Date(req.endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    totalDays += diff;
  }

  const now = new Date();
  await db
    .update(leaveBalances)
    .set({ used: totalDays, updatedAt: now })
    .where(and(
      eq(leaveBalances.tenantId, tenantId),
      eq(leaveBalances.employeeId, employeeId),
      eq(leaveBalances.leaveType, leaveType),
      eq(leaveBalances.year, year),
    ));

  return totalDays;
}

export async function getLeaveBalancesSummary(tenantId: string) {
  return db
    .select()
    .from(leaveBalances)
    .where(eq(leaveBalances.tenantId, tenantId))
    .orderBy(asc(leaveBalances.employeeId), asc(leaveBalances.leaveType));
}
