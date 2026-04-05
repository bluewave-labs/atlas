import { db } from '../../../config/database';
import {
  hrLeaveTypes, hrLeavePolicies, hrLeavePolicyAssignments,
  hrHolidayCalendars, hrHolidays, leaveBalances,
} from '../../../db/schema';
import { eq, and, asc, desc, sql, gte, lte } from 'drizzle-orm';

// ─── Leave Types ──────────────────────────────────────────────────

export async function listLeaveTypes(accountId: string, includeInactive = false) {
  const conditions = [eq(hrLeaveTypes.accountId, accountId), eq(hrLeaveTypes.isArchived, false)];
  if (!includeInactive) {
    conditions.push(eq(hrLeaveTypes.isActive, true));
  }
  return db.select().from(hrLeaveTypes).where(and(...conditions)).orderBy(asc(hrLeaveTypes.sortOrder));
}

export async function createLeaveType(accountId: string, input: {
  name: string; slug: string; color?: string; defaultDaysPerYear?: number;
  maxCarryForward?: number; requiresApproval?: boolean; isPaid?: boolean;
}) {
  const now = new Date();
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${hrLeaveTypes.sortOrder}), -1)` })
    .from(hrLeaveTypes).where(eq(hrLeaveTypes.accountId, accountId));
  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db.insert(hrLeaveTypes).values({
    accountId, name: input.name, slug: input.slug, color: input.color ?? '#3b82f6',
    defaultDaysPerYear: input.defaultDaysPerYear ?? 0, maxCarryForward: input.maxCarryForward ?? 0,
    requiresApproval: input.requiresApproval ?? true, isPaid: input.isPaid ?? true,
    sortOrder, createdAt: now, updatedAt: now,
  }).returning();
  return created;
}

export async function updateLeaveType(accountId: string, id: string, input: Partial<{
  name: string; slug: string; color: string; defaultDaysPerYear: number;
  maxCarryForward: number; requiresApproval: boolean; isPaid: boolean;
  isActive: boolean; sortOrder: number; isArchived: boolean;
}>) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };
  for (const [k, v] of Object.entries(input)) { if (v !== undefined) updates[k] = v; }

  const [updated] = await db.update(hrLeaveTypes).set(updates)
    .where(and(eq(hrLeaveTypes.id, id), eq(hrLeaveTypes.accountId, accountId))).returning();
  return updated || null;
}

export async function deleteLeaveType(accountId: string, id: string) {
  return updateLeaveType(accountId, id, { isArchived: true });
}

export async function seedDefaultLeaveTypes(accountId: string) {
  const existing = await db.select({ id: hrLeaveTypes.id }).from(hrLeaveTypes)
    .where(eq(hrLeaveTypes.accountId, accountId)).limit(1);
  if (existing.length > 0) return null;

  const vacation = await createLeaveType(accountId, {
    name: 'Vacation', slug: 'vacation', color: '#3b82f6', defaultDaysPerYear: 20,
    maxCarryForward: 5, requiresApproval: true, isPaid: true,
  });
  const sick = await createLeaveType(accountId, {
    name: 'Sick leave', slug: 'sick', color: '#ef4444', defaultDaysPerYear: 10,
    maxCarryForward: 0, requiresApproval: false, isPaid: true,
  });
  const personal = await createLeaveType(accountId, {
    name: 'Personal', slug: 'personal', color: '#f59e0b', defaultDaysPerYear: 5,
    maxCarryForward: 0, requiresApproval: true, isPaid: true,
  });

  // Create default policy
  const policy = await createLeavePolicy(accountId, {
    name: 'Standard', description: 'Default leave policy for all employees',
    isDefault: true, allocations: [
      { leaveTypeId: vacation.id, daysPerYear: 20 },
      { leaveTypeId: sick.id, daysPerYear: 10 },
      { leaveTypeId: personal.id, daysPerYear: 5 },
    ],
  });

  return { leaveTypes: [vacation, sick, personal], policy };
}

// ─── Leave Policies ───────────────────────────────────────────────

export async function listLeavePolicies(accountId: string) {
  return db.select().from(hrLeavePolicies)
    .where(and(eq(hrLeavePolicies.accountId, accountId), eq(hrLeavePolicies.isArchived, false)))
    .orderBy(desc(hrLeavePolicies.isDefault), asc(hrLeavePolicies.name));
}

export async function createLeavePolicy(accountId: string, input: {
  name: string; description?: string | null; isDefault?: boolean;
  allocations: Array<{ leaveTypeId: string; daysPerYear: number }>;
}) {
  const now = new Date();
  const [created] = await db.insert(hrLeavePolicies).values({
    accountId, name: input.name, description: input.description ?? null,
    isDefault: input.isDefault ?? false, allocations: input.allocations,
    createdAt: now, updatedAt: now,
  }).returning();
  return created;
}

export async function updateLeavePolicy(accountId: string, id: string, input: Partial<{
  name: string; description: string | null; isDefault: boolean;
  allocations: Array<{ leaveTypeId: string; daysPerYear: number }>; isArchived: boolean;
}>) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };
  for (const [k, v] of Object.entries(input)) { if (v !== undefined) updates[k] = v; }

  const [updated] = await db.update(hrLeavePolicies).set(updates)
    .where(and(eq(hrLeavePolicies.id, id), eq(hrLeavePolicies.accountId, accountId))).returning();
  return updated || null;
}

export async function deleteLeavePolicy(accountId: string, id: string) {
  return updateLeavePolicy(accountId, id, { isArchived: true });
}

export async function assignPolicy(accountId: string, employeeId: string, policyId: string, effectiveFrom?: string) {
  const now = new Date();

  // Archive old assignments
  await db.update(hrLeavePolicyAssignments).set({ isArchived: true, updatedAt: now })
    .where(and(eq(hrLeavePolicyAssignments.accountId, accountId), eq(hrLeavePolicyAssignments.employeeId, employeeId), eq(hrLeavePolicyAssignments.isArchived, false)));

  // Create new assignment
  const [assignment] = await db.insert(hrLeavePolicyAssignments).values({
    accountId, employeeId, policyId, effectiveFrom: effectiveFrom ?? now.toISOString().slice(0, 10),
    createdAt: now, updatedAt: now,
  }).returning();

  // Auto-allocate leave balances from policy
  const [policy] = await db.select().from(hrLeavePolicies).where(eq(hrLeavePolicies.id, policyId)).limit(1);
  if (policy) {
    const currentYear = now.getFullYear();
    const leaveTypesData = await db.select().from(hrLeaveTypes)
      .where(and(eq(hrLeaveTypes.accountId, accountId), eq(hrLeaveTypes.isArchived, false)));

    for (const alloc of policy.allocations) {
      const lt = leaveTypesData.find(t => t.id === alloc.leaveTypeId);
      if (!lt) continue;

      // Check if balance already exists
      const existing = await db.select().from(leaveBalances)
        .where(and(
          eq(leaveBalances.accountId, accountId), eq(leaveBalances.employeeId, employeeId),
          eq(leaveBalances.leaveType, lt.slug), eq(leaveBalances.year, currentYear),
        )).limit(1);

      if (existing.length > 0) {
        await db.update(leaveBalances).set({ allocated: alloc.daysPerYear, leaveTypeId: lt.id, updatedAt: now })
          .where(eq(leaveBalances.id, existing[0].id));
      } else {
        await db.insert(leaveBalances).values({
          accountId, employeeId, leaveType: lt.slug, year: currentYear,
          allocated: alloc.daysPerYear, used: 0, carried: 0, leaveTypeId: lt.id,
          createdAt: now, updatedAt: now,
        });
      }
    }
  }

  return assignment;
}

export async function getEmployeePolicy(accountId: string, employeeId: string) {
  const [assignment] = await db.select({
    id: hrLeavePolicyAssignments.id,
    policyId: hrLeavePolicyAssignments.policyId,
    effectiveFrom: hrLeavePolicyAssignments.effectiveFrom,
    policyName: hrLeavePolicies.name,
    allocations: hrLeavePolicies.allocations,
  })
    .from(hrLeavePolicyAssignments)
    .innerJoin(hrLeavePolicies, eq(hrLeavePolicyAssignments.policyId, hrLeavePolicies.id))
    .where(and(
      eq(hrLeavePolicyAssignments.accountId, accountId),
      eq(hrLeavePolicyAssignments.employeeId, employeeId),
      eq(hrLeavePolicyAssignments.isArchived, false),
    ))
    .orderBy(desc(hrLeavePolicyAssignments.createdAt))
    .limit(1);

  return assignment || null;
}

// ─── Holiday Calendars ────────────────────────────────────────────

export async function listHolidayCalendars(accountId: string) {
  return db.select().from(hrHolidayCalendars)
    .where(and(eq(hrHolidayCalendars.accountId, accountId), eq(hrHolidayCalendars.isArchived, false)))
    .orderBy(desc(hrHolidayCalendars.year), asc(hrHolidayCalendars.name));
}

export async function createHolidayCalendar(accountId: string, input: {
  name: string; year: number; description?: string | null; isDefault?: boolean;
}) {
  const now = new Date();
  const [created] = await db.insert(hrHolidayCalendars).values({
    accountId, name: input.name, year: input.year, description: input.description ?? null,
    isDefault: input.isDefault ?? false, createdAt: now, updatedAt: now,
  }).returning();
  return created;
}

export async function updateHolidayCalendar(accountId: string, id: string, input: Partial<{
  name: string; year: number; description: string | null; isDefault: boolean; isArchived: boolean;
}>) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };
  for (const [k, v] of Object.entries(input)) { if (v !== undefined) updates[k] = v; }

  const [updated] = await db.update(hrHolidayCalendars).set(updates)
    .where(and(eq(hrHolidayCalendars.id, id), eq(hrHolidayCalendars.accountId, accountId))).returning();
  return updated || null;
}

export async function deleteHolidayCalendar(accountId: string, id: string) {
  return updateHolidayCalendar(accountId, id, { isArchived: true });
}

// ─── Holidays ─────────────────────────────────────────────────────

export async function listHolidays(accountId: string, calendarId: string) {
  return db.select().from(hrHolidays)
    .where(and(eq(hrHolidays.calendarId, calendarId), eq(hrHolidays.accountId, accountId), eq(hrHolidays.isArchived, false)))
    .orderBy(asc(hrHolidays.date));
}

export async function createHoliday(accountId: string, input: {
  calendarId: string; name: string; date: string; description?: string | null;
  type?: string; isRecurring?: boolean;
}) {
  const now = new Date();
  const [created] = await db.insert(hrHolidays).values({
    accountId, calendarId: input.calendarId, name: input.name, date: input.date,
    description: input.description ?? null, type: input.type ?? 'public',
    isRecurring: input.isRecurring ?? false, createdAt: now, updatedAt: now,
  }).returning();
  return created;
}

export async function updateHoliday(accountId: string, id: string, input: Partial<{
  name: string; date: string; description: string | null; type: string; isRecurring: boolean; isArchived: boolean;
}>) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };
  for (const [k, v] of Object.entries(input)) { if (v !== undefined) updates[k] = v; }

  const [updated] = await db.update(hrHolidays).set(updates)
    .where(and(eq(hrHolidays.id, id), eq(hrHolidays.accountId, accountId))).returning();
  return updated || null;
}

export async function deleteHoliday(accountId: string, id: string) {
  return updateHoliday(accountId, id, { isArchived: true });
}

export async function calculateWorkingDays(accountId: string, startDate: string, endDate: string, calendarId?: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Get holidays for the range
  let holidaySet = new Set<string>();
  if (calendarId) {
    const hols = await db.select({ date: hrHolidays.date }).from(hrHolidays)
      .where(and(
        eq(hrHolidays.calendarId, calendarId), eq(hrHolidays.isArchived, false),
        gte(hrHolidays.date, startDate), lte(hrHolidays.date, endDate),
      ));
    holidaySet = new Set(hols.map(h => h.date));
  }

  // Count weekdays minus holidays (Set provides O(1) lookups)
  let workingDays = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    const dateStr = current.toISOString().slice(0, 10);
    if (day !== 0 && day !== 6 && !holidaySet.has(dateStr)) {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  return workingDays;
}
