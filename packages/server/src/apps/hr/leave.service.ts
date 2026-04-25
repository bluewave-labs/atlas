import { db } from '../../config/database';
import { hrLeaveApplications, hrLeaveTypes, leaveBalances, employees, hrHolidays, hrHolidayCalendars } from '../../db/schema';
import { eq, and, asc, desc, sql, gte, lte } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { calculateWorkingDays } from './services/leave-config.service';

// ─── Helpers ──────────────────────────────────────────────────────

function remainingBalance(b: { allocated: number; used: number; carried: number } | undefined): number {
  return b ? b.allocated - b.used + b.carried : 0;
}

// ─── Leave Applications ───────────────────────────────────────────

/** Fetch a single leave application by id — used by the controller to
 * check ownership before allowing a mutation from a non-privileged role. */
export async function getLeaveApplication(tenantId: string, id: string) {
  const [row] = await db.select({
    id: hrLeaveApplications.id,
    employeeId: hrLeaveApplications.employeeId,
    status: hrLeaveApplications.status,
  })
    .from(hrLeaveApplications)
    .where(and(
      eq(hrLeaveApplications.id, id),
      eq(hrLeaveApplications.tenantId, tenantId),
    ))
    .limit(1);
  return row ?? null;
}

export async function listLeaveApplications(tenantId: string, filters?: {
  employeeId?: string; status?: string; startDate?: string; endDate?: string;
}) {
  const conditions = [eq(hrLeaveApplications.tenantId, tenantId), eq(hrLeaveApplications.isArchived, false)];

  if (filters?.employeeId) conditions.push(eq(hrLeaveApplications.employeeId, filters.employeeId));
  if (filters?.status) conditions.push(eq(hrLeaveApplications.status, filters.status));
  if (filters?.startDate) conditions.push(gte(hrLeaveApplications.startDate, filters.startDate));
  if (filters?.endDate) conditions.push(lte(hrLeaveApplications.endDate, filters.endDate));

  return db.select({
    id: hrLeaveApplications.id,
    tenantId: hrLeaveApplications.tenantId,
    employeeId: hrLeaveApplications.employeeId,
    leaveTypeId: hrLeaveApplications.leaveTypeId,
    startDate: hrLeaveApplications.startDate,
    endDate: hrLeaveApplications.endDate,
    halfDay: hrLeaveApplications.halfDay,
    halfDayDate: hrLeaveApplications.halfDayDate,
    totalDays: hrLeaveApplications.totalDays,
    reason: hrLeaveApplications.reason,
    status: hrLeaveApplications.status,
    approverId: hrLeaveApplications.approverId,
    approverComment: hrLeaveApplications.approverComment,
    approvedAt: hrLeaveApplications.approvedAt,
    rejectedAt: hrLeaveApplications.rejectedAt,
    balanceBefore: hrLeaveApplications.balanceBefore,
    createdAt: hrLeaveApplications.createdAt,
    updatedAt: hrLeaveApplications.updatedAt,
    employeeName: employees.name,
    leaveTypeName: hrLeaveTypes.name,
    leaveTypeColor: hrLeaveTypes.color,
  })
    .from(hrLeaveApplications)
    .leftJoin(employees, eq(hrLeaveApplications.employeeId, employees.id))
    .leftJoin(hrLeaveTypes, eq(hrLeaveApplications.leaveTypeId, hrLeaveTypes.id))
    .where(and(...conditions))
    .orderBy(desc(hrLeaveApplications.createdAt));
}

export async function createLeaveApplication(tenantId: string, input: {
  employeeId: string; leaveTypeId: string; startDate: string; endDate: string;
  halfDay?: boolean; halfDayDate?: string; reason?: string;
}) {
  const now = new Date();

  // Validate date range
  if (new Date(input.endDate) < new Date(input.startDate)) {
    throw new Error('End date must be on or after start date');
  }
  if (input.halfDay && input.halfDayDate) {
    const hd = new Date(input.halfDayDate);
    if (hd < new Date(input.startDate) || hd > new Date(input.endDate)) {
      throw new Error('Half-day date must fall within the leave range');
    }
  }

  // Get leave type
  const [leaveType] = await db.select().from(hrLeaveTypes)
    .where(and(eq(hrLeaveTypes.id, input.leaveTypeId), eq(hrLeaveTypes.tenantId, tenantId))).limit(1);
  if (!leaveType) throw new Error('Leave type not found');

  // Look up the employee's holidayCalendarId; fall back to tenant default calendar if unset.
  const [emp] = await db.select({ holidayCalendarId: employees.holidayCalendarId })
    .from(employees).where(eq(employees.id, input.employeeId)).limit(1);
  let calendarId: string | undefined = emp?.holidayCalendarId ?? undefined;
  if (!calendarId) {
    const [defaultCal] = await db.select({ id: hrHolidayCalendars.id })
      .from(hrHolidayCalendars)
      .where(and(eq(hrHolidayCalendars.tenantId, tenantId), eq(hrHolidayCalendars.isDefault, true), eq(hrHolidayCalendars.isArchived, false)))
      .limit(1);
    calendarId = defaultCal?.id;
  }
  let totalDays = await calculateWorkingDays(tenantId, input.startDate, input.endDate, calendarId);

  // Half-day adjustment
  if (input.halfDay && totalDays >= 1) {
    totalDays -= 0.5;
  }

  // Get current balance
  const currentYear = new Date(input.startDate).getFullYear();
  const [balance] = await db.select().from(leaveBalances)
    .where(and(
      eq(leaveBalances.tenantId, tenantId), eq(leaveBalances.employeeId, input.employeeId),
      eq(leaveBalances.leaveType, leaveType.slug), eq(leaveBalances.year, currentYear),
    )).limit(1);

  const balanceBefore = remainingBalance(balance);

  const [created] = await db.insert(hrLeaveApplications).values({
    tenantId, employeeId: input.employeeId, leaveTypeId: input.leaveTypeId,
    startDate: input.startDate, endDate: input.endDate,
    halfDay: input.halfDay ?? false, halfDayDate: input.halfDayDate ?? null,
    totalDays, reason: input.reason ?? null, status: 'draft',
    balanceBefore, createdAt: now, updatedAt: now,
  }).returning();

  return created;
}

export async function updateLeaveApplication(tenantId: string, id: string, input: Partial<{
  startDate: string; endDate: string; halfDay: boolean; halfDayDate: string;
  reason: string; leaveTypeId: string;
}>) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };
  for (const [k, v] of Object.entries(input)) { if (v !== undefined) updates[k] = v; }

  const [updated] = await db.update(hrLeaveApplications).set(updates)
    .where(and(eq(hrLeaveApplications.id, id), eq(hrLeaveApplications.tenantId, tenantId), eq(hrLeaveApplications.status, 'draft')))
    .returning();
  return updated || null;
}

export async function submitLeaveApplication(tenantId: string, id: string) {
  const now = new Date();

  const [app] = await db.select().from(hrLeaveApplications)
    .where(and(eq(hrLeaveApplications.id, id), eq(hrLeaveApplications.tenantId, tenantId))).limit(1);
  if (!app || app.status !== 'draft') return null;

  // Get leave type to check balance
  const [leaveType] = await db.select().from(hrLeaveTypes).where(eq(hrLeaveTypes.id, app.leaveTypeId)).limit(1);
  if (!leaveType) return null;

  const currentYear = new Date(app.startDate).getFullYear();
  const [balance] = await db.select().from(leaveBalances)
    .where(and(
      eq(leaveBalances.tenantId, tenantId), eq(leaveBalances.employeeId, app.employeeId),
      eq(leaveBalances.leaveType, leaveType.slug), eq(leaveBalances.year, currentYear),
    )).limit(1);

  const remaining = remainingBalance(balance);
  if (remaining < app.totalDays) {
    throw new Error(`Insufficient leave balance. Available: ${remaining}, Required: ${app.totalDays}`);
  }

  // Auto-set approver from employee's manager
  const [emp] = await db.select().from(employees).where(eq(employees.id, app.employeeId)).limit(1);
  const approverId = emp?.managerId ?? null;

  const [updated] = await db.update(hrLeaveApplications).set({
    status: 'pending', approverId, balanceBefore: remaining, updatedAt: now,
  }).where(eq(hrLeaveApplications.id, id)).returning();

  return updated;
}

export async function approveLeaveApplication(tenantId: string, id: string, approverId: string, comment?: string) {
  const now = new Date();

  const [app] = await db.select().from(hrLeaveApplications)
    .where(and(eq(hrLeaveApplications.id, id), eq(hrLeaveApplications.tenantId, tenantId))).limit(1);
  if (!app || app.status !== 'pending') return null;

  // Get leave type slug
  const [leaveType] = await db.select().from(hrLeaveTypes).where(eq(hrLeaveTypes.id, app.leaveTypeId)).limit(1);
  if (!leaveType) return null;

  // Deduct from balance
  const currentYear = new Date(app.startDate).getFullYear();
  await db.update(leaveBalances).set({
    used: sql`${leaveBalances.used} + ${app.totalDays}`,
    updatedAt: now,
  }).where(and(
    eq(leaveBalances.tenantId, tenantId), eq(leaveBalances.employeeId, app.employeeId),
    eq(leaveBalances.leaveType, leaveType.slug), eq(leaveBalances.year, currentYear),
  ));

  const [updated] = await db.update(hrLeaveApplications).set({
    status: 'approved', approverId, approverComment: comment ?? null, approvedAt: now, updatedAt: now,
  }).where(eq(hrLeaveApplications.id, id)).returning();

  return updated;
}

export async function rejectLeaveApplication(tenantId: string, id: string, approverId: string, comment?: string) {
  const now = new Date();

  const [app] = await db.select().from(hrLeaveApplications)
    .where(and(eq(hrLeaveApplications.id, id), eq(hrLeaveApplications.tenantId, tenantId))).limit(1);
  if (!app || app.status !== 'pending') return null;

  const [updated] = await db.update(hrLeaveApplications).set({
    status: 'rejected', approverId, approverComment: comment ?? null, rejectedAt: now, updatedAt: now,
  }).where(eq(hrLeaveApplications.id, id)).returning();

  return updated;
}

export async function cancelLeaveApplication(tenantId: string, id: string) {
  const now = new Date();

  const [app] = await db.select().from(hrLeaveApplications)
    .where(and(eq(hrLeaveApplications.id, id), eq(hrLeaveApplications.tenantId, tenantId))).limit(1);
  if (!app || !['approved', 'pending'].includes(app.status)) return null;

  // Restore balance only if approved (pending leaves never had balance deducted)
  if (app.status === 'approved') {
    const [leaveType] = await db.select().from(hrLeaveTypes).where(eq(hrLeaveTypes.id, app.leaveTypeId)).limit(1);
    if (leaveType) {
      const currentYear = new Date(app.startDate).getFullYear();
      await db.update(leaveBalances).set({
        used: sql`GREATEST(${leaveBalances.used} - ${app.totalDays}, 0)`,
        updatedAt: now,
      }).where(and(
        eq(leaveBalances.tenantId, tenantId), eq(leaveBalances.employeeId, app.employeeId),
        eq(leaveBalances.leaveType, leaveType.slug), eq(leaveBalances.year, currentYear),
      ));
    }
  }

  const [updated] = await db.update(hrLeaveApplications).set({
    status: 'cancelled', updatedAt: now,
  }).where(eq(hrLeaveApplications.id, id)).returning();

  return updated;
}

export async function getLeaveCalendar(tenantId: string, month: string) {
  // month format: "2026-03"
  const startDate = `${month}-01`;
  const [yearStr, monStr] = month.split('-');
  const lastDay = new Date(Number(yearStr), Number(monStr), 0).getDate();
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

  return db.select({
    id: hrLeaveApplications.id,
    employeeId: hrLeaveApplications.employeeId,
    leaveTypeId: hrLeaveApplications.leaveTypeId,
    startDate: hrLeaveApplications.startDate,
    endDate: hrLeaveApplications.endDate,
    totalDays: hrLeaveApplications.totalDays,
    halfDay: hrLeaveApplications.halfDay,
    employeeName: employees.name,
    leaveTypeName: hrLeaveTypes.name,
    leaveTypeColor: hrLeaveTypes.color,
  })
    .from(hrLeaveApplications)
    .leftJoin(employees, eq(hrLeaveApplications.employeeId, employees.id))
    .leftJoin(hrLeaveTypes, eq(hrLeaveApplications.leaveTypeId, hrLeaveTypes.id))
    .where(and(
      eq(hrLeaveApplications.tenantId, tenantId),
      eq(hrLeaveApplications.status, 'approved'),
      eq(hrLeaveApplications.isArchived, false),
      lte(hrLeaveApplications.startDate, endDate),
      gte(hrLeaveApplications.endDate, startDate),
    ))
    .orderBy(asc(hrLeaveApplications.startDate));
}

export async function getPendingApprovals(tenantId: string, approverId: string) {
  return db.select({
    id: hrLeaveApplications.id,
    employeeId: hrLeaveApplications.employeeId,
    leaveTypeId: hrLeaveApplications.leaveTypeId,
    startDate: hrLeaveApplications.startDate,
    endDate: hrLeaveApplications.endDate,
    totalDays: hrLeaveApplications.totalDays,
    reason: hrLeaveApplications.reason,
    createdAt: hrLeaveApplications.createdAt,
    employeeName: employees.name,
    leaveTypeName: hrLeaveTypes.name,
    leaveTypeColor: hrLeaveTypes.color,
  })
    .from(hrLeaveApplications)
    .leftJoin(employees, eq(hrLeaveApplications.employeeId, employees.id))
    .leftJoin(hrLeaveTypes, eq(hrLeaveApplications.leaveTypeId, hrLeaveTypes.id))
    .where(and(
      eq(hrLeaveApplications.tenantId, tenantId),
      eq(hrLeaveApplications.approverId, approverId),
      eq(hrLeaveApplications.status, 'pending'),
      eq(hrLeaveApplications.isArchived, false),
    ))
    .orderBy(asc(hrLeaveApplications.createdAt));
}
