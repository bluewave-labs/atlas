import { db } from '../../../config/database';
import {
  hrLeaveTypes, hrLeavePolicies, hrLeavePolicyAssignments,
  hrHolidayCalendars, hrHolidays, leaveBalances,
} from '../../../db/schema';
import { eq, and, asc, desc, sql, gte, lte, ne, inArray } from 'drizzle-orm';
import { logger } from '../../../utils/logger';

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

const DEFAULT_LEAVE_TYPES = [
  { name: 'Annual leave', slug: 'annual-leave', color: '#3b82f6', defaultDaysPerYear: 20, maxCarryForward: 5, requiresApproval: true, isPaid: true },
  { name: 'Sick leave', slug: 'sick-leave', color: '#ef4444', defaultDaysPerYear: 10, maxCarryForward: 0, requiresApproval: true, isPaid: true },
  { name: 'Personal leave', slug: 'personal', color: '#8b5cf6', defaultDaysPerYear: 3, maxCarryForward: 0, requiresApproval: true, isPaid: true },
  { name: 'Maternity leave', slug: 'maternity', color: '#ec4899', defaultDaysPerYear: 90, maxCarryForward: 0, requiresApproval: true, isPaid: true },
  { name: 'Paternity leave', slug: 'paternity', color: '#06b6d4', defaultDaysPerYear: 10, maxCarryForward: 0, requiresApproval: true, isPaid: true },
  { name: 'Bereavement', slug: 'bereavement', color: '#6b7280', defaultDaysPerYear: 5, maxCarryForward: 0, requiresApproval: false, isPaid: true },
  { name: 'Jury duty', slug: 'jury-duty', color: '#f59e0b', defaultDaysPerYear: 5, maxCarryForward: 0, requiresApproval: false, isPaid: true },
  { name: 'Unpaid leave', slug: 'unpaid', color: '#94a3b8', defaultDaysPerYear: 30, maxCarryForward: 0, requiresApproval: true, isPaid: false },
  { name: 'Study leave', slug: 'study', color: '#10b981', defaultDaysPerYear: 5, maxCarryForward: 0, requiresApproval: true, isPaid: true },
  { name: 'Work from home', slug: 'wfh', color: '#6366f1', defaultDaysPerYear: 52, maxCarryForward: 0, requiresApproval: false, isPaid: true },
];

export async function seedDefaultLeaveTypes(accountId: string) {
  // Check which slugs already exist to avoid duplicates
  const existing = await db.select({ slug: hrLeaveTypes.slug }).from(hrLeaveTypes)
    .where(and(eq(hrLeaveTypes.accountId, accountId), eq(hrLeaveTypes.isArchived, false)));
  const existingSlugs = new Set(existing.map(e => e.slug));

  const toCreate = DEFAULT_LEAVE_TYPES.filter(lt => !existingSlugs.has(lt.slug));
  if (toCreate.length === 0) return null;

  // Get current max sortOrder to pre-compute values
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${hrLeaveTypes.sortOrder}), -1)` })
    .from(hrLeaveTypes).where(eq(hrLeaveTypes.accountId, accountId));
  const baseSort = (maxSort?.max ?? -1) + 1;

  const now = new Date();
  const rows = toCreate.map((lt, i) => ({
    accountId,
    name: lt.name,
    slug: lt.slug,
    color: lt.color,
    defaultDaysPerYear: lt.defaultDaysPerYear,
    maxCarryForward: lt.maxCarryForward,
    requiresApproval: lt.requiresApproval,
    isPaid: lt.isPaid,
    sortOrder: baseSort + i,
    createdAt: now,
    updatedAt: now,
  }));

  const created = await db.insert(hrLeaveTypes).values(rows).returning();
  return { leaveTypes: created };
}

const DEFAULT_POLICY_TEMPLATES: Array<{
  name: string; description: string; isDefault: boolean;
  slugAllocations: Array<{ slug: string; daysPerYear: number }>;
}> = [
  {
    name: 'Full-time', description: 'Standard allocation for full-time employees', isDefault: true,
    slugAllocations: [
      { slug: 'annual-leave', daysPerYear: 20 }, { slug: 'sick-leave', daysPerYear: 10 },
      { slug: 'personal', daysPerYear: 3 }, { slug: 'maternity', daysPerYear: 90 },
      { slug: 'paternity', daysPerYear: 10 }, { slug: 'bereavement', daysPerYear: 5 },
      { slug: 'jury-duty', daysPerYear: 5 }, { slug: 'unpaid', daysPerYear: 30 },
      { slug: 'study', daysPerYear: 5 }, { slug: 'wfh', daysPerYear: 52 },
    ],
  },
  {
    name: 'Part-time', description: 'Prorated allocation for part-time employees', isDefault: false,
    slugAllocations: [
      { slug: 'annual-leave', daysPerYear: 10 }, { slug: 'sick-leave', daysPerYear: 5 },
      { slug: 'personal', daysPerYear: 2 }, { slug: 'maternity', daysPerYear: 90 },
      { slug: 'paternity', daysPerYear: 10 }, { slug: 'bereavement', daysPerYear: 3 },
      { slug: 'jury-duty', daysPerYear: 5 }, { slug: 'unpaid', daysPerYear: 15 },
      { slug: 'study', daysPerYear: 3 }, { slug: 'wfh', daysPerYear: 26 },
    ],
  },
  {
    name: 'Contractor', description: 'Minimal allocation for contractors', isDefault: false,
    slugAllocations: [
      { slug: 'annual-leave', daysPerYear: 0 }, { slug: 'sick-leave', daysPerYear: 5 },
      { slug: 'personal', daysPerYear: 0 }, { slug: 'unpaid', daysPerYear: 30 },
    ],
  },
];

export async function seedDefaultPolicies(accountId: string) {
  // Only seed if no policies exist
  const existing = await db.select({ id: hrLeavePolicies.id }).from(hrLeavePolicies)
    .where(and(eq(hrLeavePolicies.accountId, accountId), eq(hrLeavePolicies.isArchived, false))).limit(1);
  if (existing.length > 0) return null;

  // Get leave types to resolve slug → id
  const leaveTypes = await db.select().from(hrLeaveTypes)
    .where(and(eq(hrLeaveTypes.accountId, accountId), eq(hrLeaveTypes.isArchived, false)));
  const slugToId = new Map(leaveTypes.map(lt => [lt.slug, lt.id]));

  const created = [];
  for (const template of DEFAULT_POLICY_TEMPLATES) {
    const allocations = template.slugAllocations
      .filter(a => slugToId.has(a.slug))
      .map(a => ({ leaveTypeId: slugToId.get(a.slug)!, daysPerYear: a.daysPerYear }));

    const policy = await createLeavePolicy(accountId, {
      name: template.name, description: template.description,
      isDefault: template.isDefault, allocations,
    });
    created.push(policy);
  }

  return { policies: created };
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

    // Prorate allocation if assigning mid-year
    const currentMonth = now.getMonth() + 1; // 1-12

    // Pre-fetch all existing balances for this employee+year to avoid N+1
    const existingBalances = await db.select().from(leaveBalances)
      .where(and(
        eq(leaveBalances.accountId, accountId), eq(leaveBalances.employeeId, employeeId),
        eq(leaveBalances.year, currentYear),
      ));
    const existingBySlug = new Map(existingBalances.map(b => [b.leaveType, b]));

    for (const alloc of policy.allocations) {
      const lt = leaveTypesData.find(t => t.id === alloc.leaveTypeId);
      if (!lt) continue;

      // Prorate: if we're past January, allocate proportionally for remaining months
      let allocatedDays = alloc.daysPerYear;
      if (currentMonth > 1) {
        const monthsRemaining = 13 - currentMonth; // includes current month
        allocatedDays = Math.ceil(alloc.daysPerYear * monthsRemaining / 12);
      }

      const existing = existingBySlug.get(lt.slug);

      if (existing) {
        await db.update(leaveBalances).set({ allocated: allocatedDays, leaveTypeId: lt.id, updatedAt: now })
          .where(eq(leaveBalances.id, existing.id));
      } else {
        await db.insert(leaveBalances).values({
          accountId, employeeId, leaveType: lt.slug, year: currentYear,
          allocated: allocatedDays, used: 0, carried: 0, leaveTypeId: lt.id,
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

// ─── Leave Balance Allocation (Accrual Engine) ──────────────────

export async function allocateBalancesForYear(accountId: string, year: number) {
  const now = new Date();

  // 1. Get all active policy assignments for this account
  const assignments = await db.select({
    employeeId: hrLeavePolicyAssignments.employeeId,
    policyId: hrLeavePolicyAssignments.policyId,
  })
    .from(hrLeavePolicyAssignments)
    .where(and(
      eq(hrLeavePolicyAssignments.accountId, accountId),
      eq(hrLeavePolicyAssignments.isArchived, false),
    ));

  if (assignments.length === 0) return { allocated: 0, skipped: 0 };

  // 2. Get all active leave types for this account
  const leaveTypesData = await db.select().from(hrLeaveTypes)
    .where(and(eq(hrLeaveTypes.accountId, accountId), eq(hrLeaveTypes.isArchived, false)));
  const leaveTypeById = new Map(leaveTypesData.map(lt => [lt.id, lt]));

  // 3. Get all policies referenced by assignments
  const policyIds = [...new Set(assignments.map(a => a.policyId))];
  const policies = await db.select().from(hrLeavePolicies)
    .where(and(eq(hrLeavePolicies.accountId, accountId), eq(hrLeavePolicies.isArchived, false), inArray(hrLeavePolicies.id, policyIds)));
  const policyById = new Map(policies.map(p => [p.id, p]));

  // 4. Get existing balances for this year to check idempotency
  const existingBalances = await db.select({
    employeeId: leaveBalances.employeeId,
    leaveType: leaveBalances.leaveType,
  })
    .from(leaveBalances)
    .where(and(eq(leaveBalances.accountId, accountId), eq(leaveBalances.year, year)));
  const existingSet = new Set(existingBalances.map(b => `${b.employeeId}::${b.leaveType}`));

  // 5. Get previous year balances for carryover calculation
  const previousYear = year - 1;
  const prevBalances = await db.select().from(leaveBalances)
    .where(and(eq(leaveBalances.accountId, accountId), eq(leaveBalances.year, previousYear)));
  const prevBalanceMap = new Map(prevBalances.map(b => [`${b.employeeId}::${b.leaveType}`, b]));

  let allocated = 0;
  let skipped = 0;
  const allNewRows: Array<typeof leaveBalances.$inferInsert> = [];

  for (const assignment of assignments) {
    const policy = policyById.get(assignment.policyId);
    if (!policy) continue;

    for (const alloc of policy.allocations) {
      const lt = leaveTypeById.get(alloc.leaveTypeId);
      if (!lt) continue;

      const key = `${assignment.employeeId}::${lt.slug}`;

      // Skip if balance already exists for this employee + type + year
      if (existingSet.has(key)) {
        skipped++;
        continue;
      }

      // Calculate carryover from previous year
      let carried = 0;
      const prevBalance = prevBalanceMap.get(key);
      if (prevBalance && lt.maxCarryForward > 0) {
        const unused = prevBalance.allocated + prevBalance.carried - prevBalance.used;
        carried = Math.min(Math.max(unused, 0), lt.maxCarryForward);
      }

      allNewRows.push({
        accountId,
        employeeId: assignment.employeeId,
        leaveType: lt.slug,
        year,
        allocated: alloc.daysPerYear,
        used: 0,
        carried,
        leaveTypeId: lt.id,
        createdAt: now,
        updatedAt: now,
      });

      existingSet.add(key); // prevent duplicates within this run
      allocated++;
    }
  }

  // Batch insert all new balance rows at once
  if (allNewRows.length > 0) {
    await db.insert(leaveBalances).values(allNewRows);
  }

  logger.info({ accountId, year, allocated, skipped }, 'Leave balance allocation completed');
  return { allocated, skipped };
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

export async function bulkCreateHolidays(accountId: string, calendarId: string, holidays: Array<{ name: string; date: string; type: string }>) {
  const now = new Date();
  const rows = holidays.map(h => ({
    accountId,
    calendarId,
    name: h.name,
    date: h.date,
    type: h.type || 'public',
    createdAt: now,
    updatedAt: now,
  }));
  return db.insert(hrHolidays).values(rows).returning();
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
