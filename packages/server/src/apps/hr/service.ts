import { db } from '../../config/database';
import {
  employees, departments, timeOffRequests, leaveBalances, onboardingTasks, onboardingTemplates, employeeDocuments,
  hrLeaveTypes, hrLeavePolicies, hrLeavePolicyAssignments,
  hrHolidayCalendars, hrHolidays,
  hrLifecycleEvents, hrLeaveApplications,
} from '../../db/schema';
import { eq, and, asc, desc, sql, gte, lte } from 'drizzle-orm';
import { logger } from '../../utils/logger';

const UNASSIGNED_DEPT_COLOR = '#94a3b8';

interface CreateEmployeeInput {
  name: string;
  email: string;
  role?: string;
  departmentId?: string | null;
  startDate?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  status?: string;
  linkedUserId?: string | null;
  tags?: string[];
  dateOfBirth?: string | null;
  gender?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelation?: string | null;
  employmentType?: string;
  managerId?: string | null;
  jobTitle?: string | null;
  workLocation?: string | null;
  salary?: number | null;
  salaryCurrency?: string;
  salaryPeriod?: string;
}

interface UpdateEmployeeInput extends Partial<CreateEmployeeInput> {
  sortOrder?: number;
  isArchived?: boolean;
}

interface CreateDepartmentInput {
  name: string;
  headEmployeeId?: string | null;
  color?: string;
  description?: string | null;
}

interface UpdateDepartmentInput extends Partial<CreateDepartmentInput> {
  sortOrder?: number;
  isArchived?: boolean;
}

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

// ─── Employees ──────────────────────────────────────────────────────

export async function listEmployees(userId: string, accountId: string, filters?: {
  status?: string;
  departmentId?: string;
  includeArchived?: boolean;
}) {
  const conditions = [eq(employees.userId, userId), eq(employees.accountId, accountId)];

  if (!filters?.includeArchived) {
    conditions.push(eq(employees.isArchived, false));
  }
  if (filters?.status) {
    conditions.push(eq(employees.status, filters.status));
  }
  if (filters?.departmentId) {
    conditions.push(eq(employees.departmentId, filters.departmentId));
  }

  const employeeSelect = {
    id: employees.id,
    accountId: employees.accountId,
    userId: employees.userId,
    linkedUserId: employees.linkedUserId,
    name: employees.name,
    email: employees.email,
    role: employees.role,
    departmentId: employees.departmentId,
    startDate: employees.startDate,
    phone: employees.phone,
    avatarUrl: employees.avatarUrl,
    status: employees.status,
    tags: employees.tags,
    dateOfBirth: employees.dateOfBirth,
    gender: employees.gender,
    emergencyContactName: employees.emergencyContactName,
    emergencyContactPhone: employees.emergencyContactPhone,
    emergencyContactRelation: employees.emergencyContactRelation,
    employmentType: employees.employmentType,
    managerId: employees.managerId,
    jobTitle: employees.jobTitle,
    workLocation: employees.workLocation,
    salary: employees.salary,
    salaryCurrency: employees.salaryCurrency,
    salaryPeriod: employees.salaryPeriod,
    sortOrder: employees.sortOrder,
    isArchived: employees.isArchived,
    createdAt: employees.createdAt,
    updatedAt: employees.updatedAt,
    departmentName: departments.name,
    departmentColor: departments.color,
  };

  return db
    .select(employeeSelect)
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(and(...conditions))
    .orderBy(asc(employees.sortOrder), asc(employees.createdAt));
}

export async function getEmployee(userId: string, accountId: string, id: string) {
  const [employee] = await db
    .select({
      id: employees.id,
      accountId: employees.accountId,
      userId: employees.userId,
      linkedUserId: employees.linkedUserId,
      name: employees.name,
      email: employees.email,
      role: employees.role,
      departmentId: employees.departmentId,
      startDate: employees.startDate,
      phone: employees.phone,
      avatarUrl: employees.avatarUrl,
      status: employees.status,
      tags: employees.tags,
      dateOfBirth: employees.dateOfBirth,
      gender: employees.gender,
      emergencyContactName: employees.emergencyContactName,
      emergencyContactPhone: employees.emergencyContactPhone,
      emergencyContactRelation: employees.emergencyContactRelation,
      employmentType: employees.employmentType,
      managerId: employees.managerId,
      jobTitle: employees.jobTitle,
      workLocation: employees.workLocation,
      salary: employees.salary,
      salaryCurrency: employees.salaryCurrency,
      salaryPeriod: employees.salaryPeriod,
      sortOrder: employees.sortOrder,
      isArchived: employees.isArchived,
      createdAt: employees.createdAt,
      updatedAt: employees.updatedAt,
      departmentName: departments.name,
      departmentColor: departments.color,
    })
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(and(eq(employees.id, id), eq(employees.userId, userId), eq(employees.accountId, accountId)))
    .limit(1);

  return employee || null;
}

export async function createEmployee(userId: string, accountId: string, input: CreateEmployeeInput) {
  const now = new Date();

  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${employees.sortOrder}), -1)` })
    .from(employees)
    .where(eq(employees.userId, userId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(employees)
    .values({
      accountId,
      userId,
      name: input.name,
      email: input.email,
      role: input.role ?? '',
      departmentId: input.departmentId ?? null,
      startDate: input.startDate ?? null,
      phone: input.phone ?? null,
      avatarUrl: input.avatarUrl ?? null,
      status: input.status ?? 'active',
      linkedUserId: input.linkedUserId ?? null,
      tags: input.tags ?? [],
      dateOfBirth: input.dateOfBirth ?? null,
      gender: input.gender ?? null,
      emergencyContactName: input.emergencyContactName ?? null,
      emergencyContactPhone: input.emergencyContactPhone ?? null,
      emergencyContactRelation: input.emergencyContactRelation ?? null,
      employmentType: input.employmentType ?? 'full-time',
      managerId: input.managerId ?? null,
      jobTitle: input.jobTitle ?? null,
      workLocation: input.workLocation ?? null,
      salary: input.salary ?? null,
      salaryCurrency: input.salaryCurrency ?? 'USD',
      salaryPeriod: input.salaryPeriod ?? 'yearly',
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, employeeId: created.id }, 'Employee created');
  return created;
}

export async function updateEmployee(userId: string, id: string, input: UpdateEmployeeInput) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Fetch current employee for lifecycle event comparison
  const [current] = await db.select().from(employees)
    .where(and(eq(employees.id, id), eq(employees.userId, userId))).limit(1);

  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) updates.name = input.name;
  if (input.email !== undefined) updates.email = input.email;
  if (input.role !== undefined) updates.role = input.role;
  if (input.departmentId !== undefined) updates.departmentId = input.departmentId;
  if (input.startDate !== undefined) updates.startDate = input.startDate;
  if (input.phone !== undefined) updates.phone = input.phone;
  if (input.avatarUrl !== undefined) updates.avatarUrl = input.avatarUrl;
  if (input.status !== undefined) updates.status = input.status;
  if (input.linkedUserId !== undefined) updates.linkedUserId = input.linkedUserId;
  if (input.tags !== undefined) updates.tags = input.tags;
  if (input.dateOfBirth !== undefined) updates.dateOfBirth = input.dateOfBirth;
  if (input.gender !== undefined) updates.gender = input.gender;
  if (input.emergencyContactName !== undefined) updates.emergencyContactName = input.emergencyContactName;
  if (input.emergencyContactPhone !== undefined) updates.emergencyContactPhone = input.emergencyContactPhone;
  if (input.emergencyContactRelation !== undefined) updates.emergencyContactRelation = input.emergencyContactRelation;
  if (input.employmentType !== undefined) updates.employmentType = input.employmentType;
  if (input.managerId !== undefined) updates.managerId = input.managerId;
  if (input.jobTitle !== undefined) updates.jobTitle = input.jobTitle;
  if (input.workLocation !== undefined) updates.workLocation = input.workLocation;
  if (input.salary !== undefined) updates.salary = input.salary;
  if (input.salaryCurrency !== undefined) updates.salaryCurrency = input.salaryCurrency;
  if (input.salaryPeriod !== undefined) updates.salaryPeriod = input.salaryPeriod;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  await db
    .update(employees)
    .set(updates)
    .where(and(eq(employees.id, id), eq(employees.userId, userId)));

  const [updated] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.userId, userId)))
    .limit(1);

  // Auto-create lifecycle events for tracked field changes
  if (current && updated) {
    const accountId = current.accountId;
    try {
      if (input.departmentId !== undefined && input.departmentId !== current.departmentId) {
        await createLifecycleEvent(accountId, {
          employeeId: id, eventType: 'transferred', eventDate: today,
          fromDepartmentId: current.departmentId, toDepartmentId: input.departmentId,
          createdBy: userId,
        });
      }
      if (input.salary !== undefined && input.salary !== current.salary) {
        await createLifecycleEvent(accountId, {
          employeeId: id, eventType: 'salary-change', eventDate: today,
          fromValue: current.salary?.toString() ?? '0', toValue: input.salary?.toString() ?? '0',
          createdBy: userId,
        });
      }
      if (input.role !== undefined && input.role !== current.role) {
        await createLifecycleEvent(accountId, {
          employeeId: id, eventType: 'role-change', eventDate: today,
          fromValue: current.role, toValue: input.role,
          createdBy: userId,
        });
      }
      if (input.status === 'terminated' && current.status !== 'terminated') {
        await createLifecycleEvent(accountId, {
          employeeId: id, eventType: 'terminated', eventDate: today,
          fromValue: current.status, toValue: 'terminated',
          createdBy: userId,
        });
      }
    } catch (err) {
      logger.warn({ err, employeeId: id }, 'Failed to create lifecycle event during employee update');
    }
  }

  return updated || null;
}

export async function deleteEmployee(userId: string, id: string) {
  await updateEmployee(userId, id, { isArchived: true });
}

export async function searchEmployees(userId: string, accountId: string, query: string) {
  const searchTerm = `%${query}%`;
  return db
    .select()
    .from(employees)
    .where(
      and(
        eq(employees.userId, userId),
        eq(employees.accountId, accountId),
        eq(employees.isArchived, false),
        sql`(${employees.name} ILIKE ${searchTerm} OR ${employees.email} ILIKE ${searchTerm} OR ${employees.role} ILIKE ${searchTerm})`,
      ),
    )
    .orderBy(desc(employees.updatedAt))
    .limit(30);
}

export async function getEmployeeCounts(userId: string, accountId: string) {
  const allEmployees = await db
    .select({ status: employees.status })
    .from(employees)
    .where(and(eq(employees.userId, userId), eq(employees.accountId, accountId), eq(employees.isArchived, false)));

  const counts: Record<string, number> = { active: 0, 'on-leave': 0, terminated: 0, total: 0 };

  for (const e of allEmployees) {
    counts.total++;
    if (e.status in counts) {
      counts[e.status]++;
    }
  }

  return counts;
}

// ─── Departments ────────────────────────────────────────────────────

export async function listDepartments(userId: string, accountId: string, includeArchived = false) {
  const conditions = [eq(departments.userId, userId), eq(departments.accountId, accountId)];
  if (!includeArchived) {
    conditions.push(eq(departments.isArchived, false));
  }

  const rows = await db
    .select({
      id: departments.id,
      accountId: departments.accountId,
      userId: departments.userId,
      name: departments.name,
      headEmployeeId: departments.headEmployeeId,
      color: departments.color,
      description: departments.description,
      sortOrder: departments.sortOrder,
      isArchived: departments.isArchived,
      createdAt: departments.createdAt,
      updatedAt: departments.updatedAt,
      employeeCount: sql<number>`(SELECT COUNT(*) FROM employees WHERE department_id = ${departments.id} AND is_archived = false)`.as('employee_count'),
    })
    .from(departments)
    .where(and(...conditions))
    .orderBy(asc(departments.sortOrder), asc(departments.createdAt));

  return rows;
}

export async function getDepartment(userId: string, accountId: string, id: string) {
  const [department] = await db
    .select({
      id: departments.id,
      accountId: departments.accountId,
      userId: departments.userId,
      name: departments.name,
      headEmployeeId: departments.headEmployeeId,
      color: departments.color,
      description: departments.description,
      sortOrder: departments.sortOrder,
      isArchived: departments.isArchived,
      createdAt: departments.createdAt,
      updatedAt: departments.updatedAt,
      employeeCount: sql<number>`(SELECT COUNT(*) FROM employees WHERE department_id = ${departments.id} AND is_archived = false)`.as('employee_count'),
    })
    .from(departments)
    .where(and(eq(departments.id, id), eq(departments.userId, userId), eq(departments.accountId, accountId)))
    .limit(1);

  return department || null;
}

export async function createDepartment(userId: string, accountId: string, input: CreateDepartmentInput) {
  const now = new Date();

  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${departments.sortOrder}), -1)` })
    .from(departments)
    .where(eq(departments.userId, userId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(departments)
    .values({
      accountId,
      userId,
      name: input.name || 'Untitled department',
      headEmployeeId: input.headEmployeeId ?? null,
      color: input.color ?? '#5a7fa0',
      description: input.description ?? null,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, departmentId: created.id }, 'Department created');
  return created;
}

export async function updateDepartment(userId: string, accountId: string, id: string, input: UpdateDepartmentInput) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) updates.name = input.name;
  if (input.headEmployeeId !== undefined) updates.headEmployeeId = input.headEmployeeId;
  if (input.color !== undefined) updates.color = input.color;
  if (input.description !== undefined) updates.description = input.description;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  await db
    .update(departments)
    .set(updates)
    .where(and(eq(departments.id, id), eq(departments.userId, userId), eq(departments.accountId, accountId)));

  const [updated] = await db
    .select()
    .from(departments)
    .where(and(eq(departments.id, id), eq(departments.userId, userId), eq(departments.accountId, accountId)))
    .limit(1);

  return updated || null;
}

export async function deleteDepartment(userId: string, accountId: string, id: string) {
  await updateDepartment(userId, accountId, id, { isArchived: true });
}

// ─── Time Off Requests ──────────────────────────────────────────────

export async function listTimeOffRequests(userId: string, accountId: string, filters?: {
  employeeId?: string;
  status?: string;
  type?: string;
  includeArchived?: boolean;
}) {
  const conditions = [eq(timeOffRequests.userId, userId), eq(timeOffRequests.accountId, accountId)];

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
      accountId: timeOffRequests.accountId,
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

export async function createTimeOffRequest(userId: string, accountId: string, input: CreateTimeOffRequestInput) {
  const now = new Date();

  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${timeOffRequests.sortOrder}), -1)` })
    .from(timeOffRequests)
    .where(eq(timeOffRequests.userId, userId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(timeOffRequests)
    .values({
      accountId,
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

export async function updateTimeOffRequest(userId: string, accountId: string, id: string, input: UpdateTimeOffRequestInput) {
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
    .where(and(eq(timeOffRequests.id, id), eq(timeOffRequests.userId, userId), eq(timeOffRequests.accountId, accountId)));

  const [updated] = await db
    .select()
    .from(timeOffRequests)
    .where(and(eq(timeOffRequests.id, id), eq(timeOffRequests.userId, userId), eq(timeOffRequests.accountId, accountId)))
    .limit(1);

  return updated || null;
}

export async function deleteTimeOffRequest(userId: string, accountId: string, id: string) {
  await updateTimeOffRequest(userId, accountId, id, { isArchived: true });
}

// ─── Leave Balances ────────────────────────────────────────────────

export async function getLeaveBalances(accountId: string, employeeId: string, year: number) {
  return db
    .select()
    .from(leaveBalances)
    .where(and(
      eq(leaveBalances.accountId, accountId),
      eq(leaveBalances.employeeId, employeeId),
      eq(leaveBalances.year, year),
    ))
    .orderBy(asc(leaveBalances.leaveType));
}

export async function allocateLeave(accountId: string, employeeId: string, leaveType: string, year: number, days: number) {
  const now = new Date();
  const existing = await db
    .select()
    .from(leaveBalances)
    .where(and(
      eq(leaveBalances.accountId, accountId),
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
      accountId,
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

export async function updateUsedLeave(accountId: string, employeeId: string, leaveType: string, year: number) {
  // Calculate used days from approved time-off requests in the given year
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const approvedRequests = await db
    .select({ startDate: timeOffRequests.startDate, endDate: timeOffRequests.endDate })
    .from(timeOffRequests)
    .where(and(
      eq(timeOffRequests.accountId, accountId),
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
      eq(leaveBalances.accountId, accountId),
      eq(leaveBalances.employeeId, employeeId),
      eq(leaveBalances.leaveType, leaveType),
      eq(leaveBalances.year, year),
    ));

  return totalDays;
}

export async function getLeaveBalancesSummary(accountId: string) {
  return db
    .select()
    .from(leaveBalances)
    .where(eq(leaveBalances.accountId, accountId))
    .orderBy(asc(leaveBalances.employeeId), asc(leaveBalances.leaveType));
}

// ─── Dashboard ─────────────────────────────────────────────────────

export async function getDashboardData(userId: string, accountId: string) {
  const allEmployees = await db
    .select()
    .from(employees)
    .where(and(eq(employees.userId, userId), eq(employees.accountId, accountId), eq(employees.isArchived, false)));

  const allDepartments = await db
    .select()
    .from(departments)
    .where(and(eq(departments.userId, userId), eq(departments.accountId, accountId), eq(departments.isArchived, false)));

  const allTimeOff = await db
    .select()
    .from(timeOffRequests)
    .where(and(eq(timeOffRequests.userId, userId), eq(timeOffRequests.accountId, accountId), eq(timeOffRequests.isArchived, false)));

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Count by status
  const statusCounts: Record<string, number> = { active: 0, 'on-leave': 0, terminated: 0 };
  for (const emp of allEmployees) {
    if (emp.status in statusCounts) statusCounts[emp.status]++;
  }

  // Count by department
  const departmentCounts: { name: string; color: string; count: number }[] = [];
  for (const dept of allDepartments) {
    const count = allEmployees.filter((e) => e.departmentId === dept.id).length;
    departmentCounts.push({ name: dept.name, color: dept.color, count });
  }
  const noDeptCount = allEmployees.filter((e) => !e.departmentId).length;
  if (noDeptCount > 0) {
    departmentCounts.push({ name: 'Unassigned', color: UNASSIGNED_DEPT_COLOR, count: noDeptCount });
  }

  // Count by employment type
  const typeCounts: Record<string, number> = {};
  for (const emp of allEmployees) {
    const t = emp.employmentType || 'full-time';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }

  // Upcoming birthdays (next 30 days)
  const upcomingBirthdays: { id: string; name: string; dateOfBirth: string; avatarUrl: string | null }[] = [];
  for (const emp of allEmployees) {
    if (!emp.dateOfBirth) continue;
    const dob = new Date(emp.dateOfBirth);
    const thisYearBday = new Date(currentYear, dob.getMonth(), dob.getDate());
    if (thisYearBday < now) thisYearBday.setFullYear(currentYear + 1);
    if (thisYearBday <= thirtyDaysFromNow) {
      upcomingBirthdays.push({ id: emp.id, name: emp.name, dateOfBirth: emp.dateOfBirth, avatarUrl: emp.avatarUrl });
    }
  }

  // Leave stats
  const pendingRequests = allTimeOff.filter((t) => t.status === 'pending').length;
  let approvedDaysThisMonth = 0;
  for (const req of allTimeOff) {
    if (req.status !== 'approved') continue;
    const start = new Date(req.startDate);
    const end = new Date(req.endDate);
    if (start.getMonth() === currentMonth && start.getFullYear() === currentYear) {
      approvedDaysThisMonth += Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
  }

  // Recent hires (last 30 days)
  const recentHires = allEmployees
    .filter((e) => e.startDate && new Date(e.startDate) >= thirtyDaysAgo)
    .sort((a, b) => new Date(b.startDate!).getTime() - new Date(a.startDate!).getTime())
    .slice(0, 5)
    .map((e) => ({ id: e.id, name: e.name, startDate: e.startDate!, role: e.role, avatarUrl: e.avatarUrl }));

  // Tenure distribution
  const tenure = { '0-1yr': 0, '1-3yr': 0, '3-5yr': 0, '5yr+': 0 };
  for (const emp of allEmployees) {
    if (!emp.startDate) continue;
    const years = (now.getTime() - new Date(emp.startDate).getTime()) / (365.25 * 86400000);
    if (years < 1) tenure['0-1yr']++;
    else if (years < 3) tenure['1-3yr']++;
    else if (years < 5) tenure['3-5yr']++;
    else tenure['5yr+']++;
  }

  return {
    totalHeadcount: allEmployees.length,
    statusCounts,
    departmentCounts,
    typeCounts,
    upcomingBirthdays,
    pendingRequests,
    approvedDaysThisMonth,
    recentHires,
    tenure,
  };
}

// ─── Onboarding Tasks ──────────────────────────────────────────────

export async function listOnboardingTasks(accountId: string, employeeId: string) {
  return db
    .select()
    .from(onboardingTasks)
    .where(and(
      eq(onboardingTasks.accountId, accountId),
      eq(onboardingTasks.employeeId, employeeId),
      eq(onboardingTasks.isArchived, false),
    ))
    .orderBy(asc(onboardingTasks.sortOrder), asc(onboardingTasks.createdAt));
}

export async function createOnboardingTask(accountId: string, employeeId: string, input: {
  title: string;
  description?: string | null;
  category?: string;
  dueDate?: string | null;
}) {
  const now = new Date();
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${onboardingTasks.sortOrder}), -1)` })
    .from(onboardingTasks)
    .where(eq(onboardingTasks.employeeId, employeeId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(onboardingTasks)
    .values({
      accountId,
      employeeId,
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? 'general',
      dueDate: input.dueDate ?? null,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

export async function updateOnboardingTask(accountId: string, taskId: string, input: {
  title?: string;
  description?: string | null;
  category?: string;
  dueDate?: string | null;
  completedAt?: Date | null;
  completedBy?: string | null;
  sortOrder?: number;
  isArchived?: boolean;
}) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.category !== undefined) updates.category = input.category;
  if (input.dueDate !== undefined) updates.dueDate = input.dueDate;
  if (input.completedAt !== undefined) updates.completedAt = input.completedAt;
  if (input.completedBy !== undefined) updates.completedBy = input.completedBy;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  const [updated] = await db
    .update(onboardingTasks)
    .set(updates)
    .where(and(eq(onboardingTasks.id, taskId), eq(onboardingTasks.accountId, accountId)))
    .returning();

  return updated || null;
}

export async function deleteOnboardingTask(accountId: string, taskId: string) {
  return updateOnboardingTask(accountId, taskId, { isArchived: true });
}

export async function createTasksFromTemplate(accountId: string, employeeId: string, templateId: string) {
  const [template] = await db
    .select()
    .from(onboardingTemplates)
    .where(and(eq(onboardingTemplates.id, templateId), eq(onboardingTemplates.accountId, accountId)))
    .limit(1);

  if (!template) return [];

  const created = [];
  for (const task of template.tasks) {
    const t = await createOnboardingTask(accountId, employeeId, {
      title: task.title,
      description: task.description ?? null,
      category: task.category,
    });
    created.push(t);
  }

  return created;
}

// ─── Onboarding Templates ──────────────────────────────────────────

export async function listOnboardingTemplates(accountId: string) {
  return db
    .select()
    .from(onboardingTemplates)
    .where(eq(onboardingTemplates.accountId, accountId))
    .orderBy(asc(onboardingTemplates.name));
}

export async function createOnboardingTemplate(accountId: string, input: {
  name: string;
  tasks: Array<{ title: string; description?: string; category: string }>;
}) {
  const now = new Date();
  const [created] = await db
    .insert(onboardingTemplates)
    .values({
      accountId,
      name: input.name,
      tasks: input.tasks,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

export async function seedDefaultTemplate(accountId: string) {
  const existing = await db
    .select({ id: onboardingTemplates.id })
    .from(onboardingTemplates)
    .where(eq(onboardingTemplates.accountId, accountId))
    .limit(1);

  if (existing.length > 0) return null;

  return createOnboardingTemplate(accountId, {
    name: 'Default onboarding',
    tasks: [
      { title: 'Set up email account', description: 'Create company email and set up mail client', category: 'IT' },
      { title: 'Complete tax forms', description: 'Fill out W-4 and state tax withholding forms', category: 'HR' },
      { title: 'Review employee handbook', description: 'Read the company handbook and sign acknowledgment', category: 'HR' },
      { title: 'Set up workstation', description: 'Configure laptop, monitors, and software', category: 'IT' },
      { title: 'Meet team members', description: 'Schedule introductions with direct team', category: 'Team' },
      { title: 'Schedule orientation', description: 'Attend company orientation session', category: 'HR' },
      { title: 'Assign mentor', description: 'Get paired with a team mentor', category: 'Team' },
      { title: 'Review benefits enrollment', description: 'Review and enroll in health, dental, and vision plans', category: 'HR' },
    ],
  });
}

// ─── Employee Documents ────────────────────────────────────────────

export async function listEmployeeDocuments(accountId: string, employeeId: string) {
  return db
    .select()
    .from(employeeDocuments)
    .where(and(
      eq(employeeDocuments.accountId, accountId),
      eq(employeeDocuments.employeeId, employeeId),
      eq(employeeDocuments.isArchived, false),
    ))
    .orderBy(desc(employeeDocuments.createdAt));
}

export async function createEmployeeDocument(accountId: string, input: {
  employeeId: string;
  name: string;
  type: string;
  storagePath: string;
  mimeType?: string | null;
  size?: number | null;
  expiresAt?: string | null;
  notes?: string | null;
  uploadedBy: string;
}) {
  const now = new Date();
  const [created] = await db
    .insert(employeeDocuments)
    .values({
      accountId,
      employeeId: input.employeeId,
      name: input.name,
      type: input.type || 'other',
      storagePath: input.storagePath,
      mimeType: input.mimeType ?? null,
      size: input.size ?? null,
      expiresAt: input.expiresAt ?? null,
      notes: input.notes ?? null,
      uploadedBy: input.uploadedBy,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

export async function deleteEmployeeDocument(accountId: string, docId: string) {
  const now = new Date();
  const [updated] = await db
    .update(employeeDocuments)
    .set({ isArchived: true, updatedAt: now })
    .where(and(eq(employeeDocuments.id, docId), eq(employeeDocuments.accountId, accountId)))
    .returning();

  return updated || null;
}

export async function getEmployeeDocument(accountId: string, docId: string) {
  const [doc] = await db
    .select()
    .from(employeeDocuments)
    .where(and(eq(employeeDocuments.id, docId), eq(employeeDocuments.accountId, accountId)))
    .limit(1);

  return doc || null;
}

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
    const leaveTypes = await db.select().from(hrLeaveTypes)
      .where(and(eq(hrLeaveTypes.accountId, accountId), eq(hrLeaveTypes.isArchived, false)));

    for (const alloc of policy.allocations) {
      const lt = leaveTypes.find(t => t.id === alloc.leaveTypeId);
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

// ─── Lifecycle Events ─────────────────────────────────────────────

export async function getLifecycleTimeline(accountId: string, employeeId: string) {
  return db.select().from(hrLifecycleEvents)
    .where(and(eq(hrLifecycleEvents.accountId, accountId), eq(hrLifecycleEvents.employeeId, employeeId), eq(hrLifecycleEvents.isArchived, false)))
    .orderBy(desc(hrLifecycleEvents.eventDate), desc(hrLifecycleEvents.createdAt));
}

export async function createLifecycleEvent(accountId: string, input: {
  employeeId: string; eventType: string; eventDate: string; effectiveDate?: string | null;
  fromValue?: string | null; toValue?: string | null;
  fromDepartmentId?: string | null; toDepartmentId?: string | null;
  notes?: string | null; createdBy?: string | null;
}) {
  const now = new Date();
  const [created] = await db.insert(hrLifecycleEvents).values({
    accountId, employeeId: input.employeeId, eventType: input.eventType,
    eventDate: input.eventDate, effectiveDate: input.effectiveDate ?? null,
    fromValue: input.fromValue ?? null, toValue: input.toValue ?? null,
    fromDepartmentId: input.fromDepartmentId ?? null, toDepartmentId: input.toDepartmentId ?? null,
    notes: input.notes ?? null, createdBy: input.createdBy ?? null,
    createdAt: now, updatedAt: now,
  }).returning();
  return created;
}

export async function deleteLifecycleEvent(accountId: string, id: string) {
  const now = new Date();
  const [updated] = await db.update(hrLifecycleEvents)
    .set({ isArchived: true, updatedAt: now })
    .where(and(eq(hrLifecycleEvents.id, id), eq(hrLifecycleEvents.accountId, accountId))).returning();
  return updated || null;
}

// ─── Widget summary (lightweight) ──────────────────────────────────

export async function getWidgetData(userId: string, accountId: string) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Employee count (active, non-archived)
  const [empAgg] = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(employees)
    .where(and(
      eq(employees.accountId, accountId),
      eq(employees.isArchived, false),
      eq(employees.status, 'active'),
    ));

  // Department count
  const [deptAgg] = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(departments)
    .where(and(
      eq(departments.accountId, accountId),
      eq(departments.isArchived, false),
    ));

  // On leave today (approved leave applications where today falls within start-end)
  const [leaveAgg] = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(hrLeaveApplications)
    .where(and(
      eq(hrLeaveApplications.accountId, accountId),
      eq(hrLeaveApplications.status, 'approved'),
      lte(hrLeaveApplications.startDate, today),
      gte(hrLeaveApplications.endDate, today),
    ));

  return {
    employeeCount: Number(empAgg?.count ?? 0),
    departmentCount: Number(deptAgg?.count ?? 0),
    onLeaveToday: Number(leaveAgg?.count ?? 0),
  };
}

// ─── Seed Sample Data ───────────────────────────────────────────────

export async function seedSampleData(userId: string, accountId: string) {
  // Idempotency guard — skip if data already exists
  const existing = await db.select({ id: employees.id }).from(employees)
    .where(eq(employees.userId, userId)).limit(1);
  if (existing.length > 0) return { skipped: true };

  // ── Dates ────────────────────────────────────────────────────────
  const d = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().split('T')[0];
  const today = d(0);
  const threeMonthsAgo = d(-90);
  const sixMonthsAgo = d(-180);
  const nineMonthsAgo = d(-270);
  const oneYearAgo = d(-365);
  const eighteenMonthsAgo = d(-545);
  const twoYearsAgo = d(-730);
  const threeYearsAgo = d(-1095);
  const fourYearsAgo = d(-1460);
  const fiveYearsAgo = d(-1825);
  const nextWeek = d(7);
  const inTwoWeeks = d(14);
  const inThreeWeeks = d(21);
  const inFourWeeks = d(28);

  // ── Departments (6) ──────────────────────────────────────────────
  const engineering = await createDepartment(userId, accountId, { name: 'Engineering', color: '#3b82f6', description: 'Product development, infrastructure, and technical operations' });
  const product = await createDepartment(userId, accountId, { name: 'Product', color: '#8b5cf6', description: 'Product management, design, and user research' });
  const marketing = await createDepartment(userId, accountId, { name: 'Marketing', color: '#f59e0b', description: 'Brand, growth, content, and demand generation' });
  const sales = await createDepartment(userId, accountId, { name: 'Sales', color: '#ef4444', description: 'Business development, account management, and partnerships' });
  const operations = await createDepartment(userId, accountId, { name: 'Operations', color: '#10b981', description: 'HR, finance, legal, and office management' });
  const support = await createDepartment(userId, accountId, { name: 'Customer Success', color: '#06b6d4', description: 'Customer support, onboarding, and retention' });

  // ── Employees (20) ───────────────────────────────────────────────
  // Engineering (6)
  const alice = await createEmployee(userId, accountId, {
    name: 'Alice Johnson', email: 'alice.johnson@atlas.so', role: 'VP of Engineering',
    departmentId: engineering.id, startDate: fiveYearsAgo, phone: '+1-415-555-0101',
    jobTitle: 'VP of Engineering', employmentType: 'full-time', workLocation: 'San Francisco, CA',
    dateOfBirth: '1985-03-15', gender: 'female',
    salary: 195000, salaryCurrency: 'USD', salaryPeriod: 'yearly',
    emergencyContactName: 'Robert Johnson', emergencyContactPhone: '+1-415-555-9901', emergencyContactRelation: 'Spouse',
    tags: ['leadership', 'architecture', 'hiring-committee'],
  });
  const henry = await createEmployee(userId, accountId, {
    name: 'Henry Wilson', email: 'henry.wilson@atlas.so', role: 'Staff Backend Engineer',
    departmentId: engineering.id, startDate: fourYearsAgo, phone: '+1-415-555-0108',
    jobTitle: 'Staff Backend Engineer', employmentType: 'full-time', workLocation: 'San Francisco, CA',
    dateOfBirth: '1988-11-22', gender: 'male', managerId: alice.id,
    salary: 175000, salaryCurrency: 'USD', salaryPeriod: 'yearly',
    emergencyContactName: 'Linda Wilson', emergencyContactPhone: '+1-415-555-9908', emergencyContactRelation: 'Mother',
    tags: ['backend', 'postgresql', 'node'],
  });
  const carol = await createEmployee(userId, accountId, {
    name: 'Carol Davis', email: 'carol.davis@atlas.so', role: 'Senior Frontend Engineer',
    departmentId: engineering.id, startDate: eighteenMonthsAgo,
    jobTitle: 'Senior Frontend Engineer', employmentType: 'full-time', workLocation: 'Remote (Portland, OR)',
    dateOfBirth: '1992-07-04', gender: 'female', managerId: alice.id,
    salary: 155000, salaryCurrency: 'USD', salaryPeriod: 'yearly',
    emergencyContactName: 'James Davis', emergencyContactPhone: '+1-503-555-0203', emergencyContactRelation: 'Partner',
    tags: ['frontend', 'react', 'typescript'],
  });
  const frank = await createEmployee(userId, accountId, {
    name: 'Frank Lee', email: 'frank.lee@atlas.so', role: 'DevOps Engineer',
    departmentId: engineering.id, startDate: oneYearAgo, phone: '+1-415-555-0106',
    jobTitle: 'DevOps Engineer', employmentType: 'full-time', workLocation: 'San Francisco, CA',
    dateOfBirth: '1990-09-18', gender: 'male', managerId: alice.id, status: 'on-leave',
    salary: 145000, salaryCurrency: 'USD', salaryPeriod: 'yearly',
    emergencyContactName: 'Susan Lee', emergencyContactPhone: '+1-415-555-9906', emergencyContactRelation: 'Spouse',
    tags: ['devops', 'kubernetes', 'terraform'],
  });
  const tomasz = await createEmployee(userId, accountId, {
    name: 'Tomasz Kowalski', email: 'tomasz.kowalski@atlas.so', role: 'Backend Engineer',
    departmentId: engineering.id, startDate: sixMonthsAgo,
    jobTitle: 'Backend Engineer', employmentType: 'full-time', workLocation: 'Remote (Warsaw, Poland)',
    dateOfBirth: '1994-01-30', gender: 'male', managerId: henry.id,
    salary: 95000, salaryCurrency: 'EUR', salaryPeriod: 'yearly',
    tags: ['backend', 'go', 'grpc'],
  });
  const priya = await createEmployee(userId, accountId, {
    name: 'Priya Sharma', email: 'priya.sharma@atlas.so', role: 'QA Engineer',
    departmentId: engineering.id, startDate: threeMonthsAgo, phone: '+91-98765-43210',
    jobTitle: 'QA Engineer', employmentType: 'full-time', workLocation: 'Remote (Bangalore, India)',
    dateOfBirth: '1996-05-12', gender: 'female', managerId: alice.id,
    salary: 4200000, salaryCurrency: 'INR', salaryPeriod: 'yearly',
    tags: ['qa', 'automation', 'playwright'],
  });

  // Product (3)
  const mia = await createEmployee(userId, accountId, {
    name: 'Mia Chen', email: 'mia.chen@atlas.so', role: 'Head of Product',
    departmentId: product.id, startDate: threeYearsAgo, phone: '+1-415-555-0120',
    jobTitle: 'Head of Product', employmentType: 'full-time', workLocation: 'San Francisco, CA',
    dateOfBirth: '1987-12-03', gender: 'female',
    salary: 185000, salaryCurrency: 'USD', salaryPeriod: 'yearly',
    emergencyContactName: 'Wei Chen', emergencyContactPhone: '+1-415-555-9920', emergencyContactRelation: 'Father',
    tags: ['product', 'strategy', 'roadmap'],
  });
  const liam = await createEmployee(userId, accountId, {
    name: 'Liam O\'Brien', email: 'liam.obrien@atlas.so', role: 'Product Designer',
    departmentId: product.id, startDate: oneYearAgo,
    jobTitle: 'Senior Product Designer', employmentType: 'full-time', workLocation: 'Remote (Dublin, Ireland)',
    dateOfBirth: '1991-06-21', gender: 'male', managerId: mia.id,
    salary: 85000, salaryCurrency: 'EUR', salaryPeriod: 'yearly',
    tags: ['design', 'figma', 'ux-research'],
  });
  const yuki = await createEmployee(userId, accountId, {
    name: 'Yuki Tanaka', email: 'yuki.tanaka@atlas.so', role: 'Product Manager',
    departmentId: product.id, startDate: nineMonthsAgo,
    jobTitle: 'Product Manager', employmentType: 'full-time', workLocation: 'Remote (Tokyo, Japan)',
    dateOfBirth: '1993-04-08', gender: 'female', managerId: mia.id,
    salary: 12000000, salaryCurrency: 'JPY', salaryPeriod: 'yearly',
    tags: ['product', 'analytics', 'user-research'],
  });

  // Marketing (3)
  const bob = await createEmployee(userId, accountId, {
    name: 'Bob Williams', email: 'bob.williams@atlas.so', role: 'Marketing Director',
    departmentId: marketing.id, startDate: twoYearsAgo, phone: '+1-415-555-0102',
    jobTitle: 'Marketing Director', employmentType: 'full-time', workLocation: 'San Francisco, CA',
    dateOfBirth: '1986-08-14', gender: 'male',
    salary: 165000, salaryCurrency: 'USD', salaryPeriod: 'yearly',
    emergencyContactName: 'Sarah Williams', emergencyContactPhone: '+1-415-555-9902', emergencyContactRelation: 'Spouse',
    tags: ['marketing', 'leadership', 'brand'],
  });
  const eva = await createEmployee(userId, accountId, {
    name: 'Eva Martinez', email: 'eva.martinez@atlas.so', role: 'Content Strategist',
    departmentId: marketing.id, startDate: oneYearAgo,
    jobTitle: 'Senior Content Strategist', employmentType: 'full-time', workLocation: 'Remote (Austin, TX)',
    dateOfBirth: '1993-02-28', gender: 'female', managerId: bob.id,
    salary: 110000, salaryCurrency: 'USD', salaryPeriod: 'yearly',
    tags: ['content', 'seo', 'copywriting'],
  });
  const nina = await createEmployee(userId, accountId, {
    name: 'Nina Petrova', email: 'nina.petrova@atlas.so', role: 'Growth Marketing Manager',
    departmentId: marketing.id, startDate: sixMonthsAgo, phone: '+49-30-555-0130',
    jobTitle: 'Growth Marketing Manager', employmentType: 'full-time', workLocation: 'Remote (Berlin, Germany)',
    dateOfBirth: '1995-10-05', gender: 'female', managerId: bob.id,
    salary: 78000, salaryCurrency: 'EUR', salaryPeriod: 'yearly',
    tags: ['growth', 'paid-ads', 'analytics'],
  });

  // Sales (3)
  const james = await createEmployee(userId, accountId, {
    name: 'James Carter', email: 'james.carter@atlas.so', role: 'Head of Sales',
    departmentId: sales.id, startDate: twoYearsAgo, phone: '+1-415-555-0140',
    jobTitle: 'Head of Sales', employmentType: 'full-time', workLocation: 'New York, NY',
    dateOfBirth: '1984-04-19', gender: 'male',
    salary: 160000, salaryCurrency: 'USD', salaryPeriod: 'yearly',
    emergencyContactName: 'Katherine Carter', emergencyContactPhone: '+1-212-555-9940', emergencyContactRelation: 'Spouse',
    tags: ['sales', 'enterprise', 'leadership'],
  });
  const aisha = await createEmployee(userId, accountId, {
    name: 'Aisha Okonkwo', email: 'aisha.okonkwo@atlas.so', role: 'Account Executive',
    departmentId: sales.id, startDate: nineMonthsAgo, phone: '+44-20-7946-0155',
    jobTitle: 'Senior Account Executive', employmentType: 'full-time', workLocation: 'Remote (London, UK)',
    dateOfBirth: '1991-07-23', gender: 'female', managerId: james.id,
    salary: 72000, salaryCurrency: 'GBP', salaryPeriod: 'yearly',
    tags: ['sales', 'emea', 'saas'],
  });
  const diego = await createEmployee(userId, accountId, {
    name: 'Diego Fernandez', email: 'diego.fernandez@atlas.so', role: 'SDR',
    departmentId: sales.id, startDate: threeMonthsAgo, phone: '+1-646-555-0160',
    jobTitle: 'Sales Development Representative', employmentType: 'full-time', workLocation: 'New York, NY',
    dateOfBirth: '1998-11-11', gender: 'male', managerId: james.id,
    salary: 65000, salaryCurrency: 'USD', salaryPeriod: 'yearly',
    tags: ['sales', 'outbound', 'prospecting'],
  });

  // Operations (3)
  const david = await createEmployee(userId, accountId, {
    name: 'David Brown', email: 'david.brown@atlas.so', role: 'COO',
    departmentId: operations.id, startDate: fiveYearsAgo, phone: '+1-415-555-0104',
    jobTitle: 'Chief Operating Officer', employmentType: 'full-time', workLocation: 'San Francisco, CA',
    dateOfBirth: '1982-06-30', gender: 'male',
    salary: 210000, salaryCurrency: 'USD', salaryPeriod: 'yearly',
    emergencyContactName: 'Maria Brown', emergencyContactPhone: '+1-415-555-9904', emergencyContactRelation: 'Spouse',
    tags: ['leadership', 'operations', 'finance'],
  });
  const grace = await createEmployee(userId, accountId, {
    name: 'Grace Kim', email: 'grace.kim@atlas.so', role: 'HR Manager',
    departmentId: operations.id, startDate: twoYearsAgo, phone: '+1-415-555-0107',
    jobTitle: 'HR Manager', employmentType: 'full-time', workLocation: 'San Francisco, CA',
    dateOfBirth: '1989-09-01', gender: 'female', managerId: david.id,
    salary: 120000, salaryCurrency: 'USD', salaryPeriod: 'yearly',
    emergencyContactName: 'Daniel Kim', emergencyContactPhone: '+1-415-555-9907', emergencyContactRelation: 'Brother',
    tags: ['hr', 'recruiting', 'culture'],
  });
  const lucas = await createEmployee(userId, accountId, {
    name: 'Lucas Meyer', email: 'lucas.meyer@atlas.so', role: 'Finance Analyst',
    departmentId: operations.id, startDate: oneYearAgo,
    jobTitle: 'Senior Finance Analyst', employmentType: 'full-time', workLocation: 'Remote (Zurich, Switzerland)',
    dateOfBirth: '1992-12-17', gender: 'male', managerId: david.id,
    salary: 115000, salaryCurrency: 'CHF', salaryPeriod: 'yearly',
    tags: ['finance', 'budgeting', 'reporting'],
  });

  // Customer Success (2)
  const sophie = await createEmployee(userId, accountId, {
    name: 'Sophie Laurent', email: 'sophie.laurent@atlas.so', role: 'Head of Customer Success',
    departmentId: support.id, startDate: eighteenMonthsAgo, phone: '+33-1-55-55-0170',
    jobTitle: 'Head of Customer Success', employmentType: 'full-time', workLocation: 'Remote (Paris, France)',
    dateOfBirth: '1990-03-22', gender: 'female',
    salary: 82000, salaryCurrency: 'EUR', salaryPeriod: 'yearly',
    emergencyContactName: 'Pierre Laurent', emergencyContactPhone: '+33-1-55-55-9970', emergencyContactRelation: 'Father',
    tags: ['customer-success', 'onboarding', 'retention'],
  });
  const omar = await createEmployee(userId, accountId, {
    name: 'Omar Hassan', email: 'omar.hassan@atlas.so', role: 'Support Engineer',
    departmentId: support.id, startDate: sixMonthsAgo,
    jobTitle: 'Technical Support Engineer', employmentType: 'contract', workLocation: 'Remote (Cairo, Egypt)',
    dateOfBirth: '1997-08-09', gender: 'male', managerId: sophie.id,
    salary: 3500, salaryCurrency: 'USD', salaryPeriod: 'monthly',
    tags: ['support', 'technical', 'troubleshooting'],
  });

  // ── Department heads ─────────────────────────────────────────────
  await updateDepartment(userId, accountId, engineering.id, { headEmployeeId: alice.id });
  await updateDepartment(userId, accountId, product.id, { headEmployeeId: mia.id });
  await updateDepartment(userId, accountId, marketing.id, { headEmployeeId: bob.id });
  await updateDepartment(userId, accountId, sales.id, { headEmployeeId: james.id });
  await updateDepartment(userId, accountId, operations.id, { headEmployeeId: david.id });
  await updateDepartment(userId, accountId, support.id, { headEmployeeId: sophie.id });

  // ── Time-off requests (10) ──────────────────────────────────────
  const t1 = await createTimeOffRequest(userId, accountId, { employeeId: alice.id, type: 'vacation', startDate: nextWeek, endDate: inTwoWeeks, notes: 'Family vacation to Hawaii' });
  await createTimeOffRequest(userId, accountId, { employeeId: carol.id, type: 'sick', startDate: today, endDate: today, notes: 'Migraine' });
  const t3 = await createTimeOffRequest(userId, accountId, { employeeId: eva.id, type: 'personal', startDate: inTwoWeeks, endDate: inTwoWeeks, notes: 'Moving to new apartment' });
  await createTimeOffRequest(userId, accountId, { employeeId: frank.id, type: 'sick', startDate: d(-3), endDate: nextWeek, notes: 'Surgery recovery — doctor note on file' });
  await createTimeOffRequest(userId, accountId, { employeeId: henry.id, type: 'vacation', startDate: inThreeWeeks, endDate: inFourWeeks, notes: 'Trip to Japan' });
  await createTimeOffRequest(userId, accountId, { employeeId: liam.id, type: 'vacation', startDate: inTwoWeeks, endDate: d(18), notes: 'Visiting family in Cork' });
  const t7 = await createTimeOffRequest(userId, accountId, { employeeId: nina.id, type: 'personal', startDate: d(10), endDate: d(10) });
  await createTimeOffRequest(userId, accountId, { employeeId: sophie.id, type: 'vacation', startDate: inFourWeeks, endDate: d(35), notes: 'Summer break — Provence' });
  await createTimeOffRequest(userId, accountId, { employeeId: tomasz.id, type: 'sick', startDate: d(-1), endDate: today, notes: 'Cold / flu' });
  await createTimeOffRequest(userId, accountId, { employeeId: diego.id, type: 'personal', startDate: d(5), endDate: d(5), notes: 'DMV appointment' });

  // Approve some requests
  await updateTimeOffRequest(userId, accountId, t1.id, { status: 'approved', approverId: david.id });
  await updateTimeOffRequest(userId, accountId, t3.id, { status: 'approved', approverId: bob.id });
  await updateTimeOffRequest(userId, accountId, t7.id, { status: 'rejected', approverId: bob.id });

  // ── Leave balances (for all 20 employees) ───────────────────────
  const currentYear = new Date().getFullYear();
  const allEmps = [alice, henry, carol, frank, tomasz, priya, mia, liam, yuki, bob, eva, nina, james, aisha, diego, david, grace, lucas, sophie, omar];
  for (const emp of allEmps) {
    // Vacation: 20 days for FT, 10 for contract
    const vacDays = emp.employmentType === 'contract' ? 10 : 20;
    await allocateLeave(accountId, emp.id, 'vacation', currentYear, vacDays);
    // Sick: 10 days
    await allocateLeave(accountId, emp.id, 'sick', currentYear, 10);
    // Personal: 5 days
    await allocateLeave(accountId, emp.id, 'personal', currentYear, 5);
  }

  // ── Onboarding tasks for recent hires ───────────────────────────
  await seedDefaultTemplate(accountId);

  // Priya (3 months ago) — partially complete onboarding
  await createOnboardingTask(accountId, priya.id, { title: 'Set up email account', category: 'IT', description: 'Create company email and configure mail client' });
  await createOnboardingTask(accountId, priya.id, { title: 'Complete tax forms', category: 'HR', description: 'Submit W-8BEN for international employees' });
  await createOnboardingTask(accountId, priya.id, { title: 'Set up development environment', category: 'IT', description: 'Install IDE, clone repos, configure local dev' });
  await createOnboardingTask(accountId, priya.id, { title: 'Meet the QA team', category: 'Team', description: 'Schedule 1:1 with each QA team member' });
  await createOnboardingTask(accountId, priya.id, { title: 'Review testing playbook', category: 'HR', description: 'Read test strategy docs and automation guidelines' });
  await createOnboardingTask(accountId, priya.id, { title: 'Write first test suite', category: 'Team', description: 'Pick a module and write end-to-end tests' });

  // Diego (3 months ago) — mostly complete
  await createOnboardingTask(accountId, diego.id, { title: 'Set up email and Slack', category: 'IT' });
  await createOnboardingTask(accountId, diego.id, { title: 'CRM training session', category: 'Team', description: 'Learn the sales pipeline and CRM workflows' });
  await createOnboardingTask(accountId, diego.id, { title: 'Shadow senior AE calls', category: 'Team', description: 'Sit in on 5 calls with Aisha' });
  await createOnboardingTask(accountId, diego.id, { title: 'Complete sales certification', category: 'HR', description: 'Pass the internal sales methodology exam' });
  await createOnboardingTask(accountId, diego.id, { title: 'Build first prospect list', category: 'Team', description: 'Research and build a 50-prospect target list' });

  // Mark some onboarding tasks as completed
  const priyaTasks = await listOnboardingTasks(accountId, priya.id);
  for (const t of priyaTasks.slice(0, 4)) {
    await updateOnboardingTask(accountId, t.id, { completedAt: new Date(), completedBy: priya.id });
  }
  const diegoTasks = await listOnboardingTasks(accountId, diego.id);
  for (const t of diegoTasks.slice(0, 4)) {
    await updateOnboardingTask(accountId, t.id, { completedAt: new Date(), completedBy: diego.id });
  }

  // ── Leave types, policies, holiday calendar, lifecycle events ─────
  const leaveTypeResult = await seedDefaultLeaveTypes(accountId);

  // Holiday calendar with 10 US holidays for current year
  const cal = await createHolidayCalendar(accountId, { name: 'US 2026', year: currentYear, description: 'US federal holidays', isDefault: true });
  if (cal) {
    const usHolidays = [
      { name: "New Year's Day", date: `${currentYear}-01-01`, type: 'public' },
      { name: 'Martin Luther King Jr. Day', date: `${currentYear}-01-19`, type: 'public' },
      { name: "Presidents' Day", date: `${currentYear}-02-16`, type: 'public' },
      { name: 'Memorial Day', date: `${currentYear}-05-25`, type: 'public' },
      { name: 'Independence Day', date: `${currentYear}-07-04`, type: 'public' },
      { name: 'Labor Day', date: `${currentYear}-09-07`, type: 'public' },
      { name: 'Columbus Day', date: `${currentYear}-10-12`, type: 'optional' },
      { name: 'Veterans Day', date: `${currentYear}-11-11`, type: 'public' },
      { name: 'Thanksgiving Day', date: `${currentYear}-11-26`, type: 'public' },
      { name: 'Christmas Day', date: `${currentYear}-12-25`, type: 'public' },
    ];
    for (const h of usHolidays) {
      await createHoliday(accountId, { calendarId: cal.id, name: h.name, date: h.date, type: h.type });
    }
  }

  // Lifecycle events (hired events for all employees)
  for (const emp of allEmps) {
    try {
      await createLifecycleEvent(accountId, {
        employeeId: emp.id, eventType: 'hired', eventDate: emp.startDate || today,
        toValue: emp.role, notes: `Joined as ${emp.role}`, createdBy: userId,
      });
    } catch (_) { /* ignore duplicates */ }
  }

  // Sample lifecycle events for some employees
  await createLifecycleEvent(accountId, {
    employeeId: henry.id, eventType: 'promoted', eventDate: d(-365),
    fromValue: 'Senior Backend Engineer', toValue: 'Staff Backend Engineer',
    notes: 'Promoted for exceptional performance', createdBy: userId,
  });
  await createLifecycleEvent(accountId, {
    employeeId: carol.id, eventType: 'salary-change', eventDate: d(-180),
    fromValue: '140000', toValue: '155000',
    notes: 'Annual performance review adjustment', createdBy: userId,
  });

  logger.info({ userId, accountId }, 'Seeded rich HR sample data');
  return {
    departments: 6,
    employees: 20,
    timeOffRequests: 10,
    leaveBalances: 60,
    onboardingTasks: 11,
    onboardingTemplates: 1,
    leaveTypes: 3,
    leavePolicies: 1,
    holidays: 10,
    lifecycleEvents: 22,
  };
}
