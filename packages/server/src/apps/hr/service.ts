import { db } from '../../config/database';
import { employees, departments, timeOffRequests } from '../../db/schema';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { logger } from '../../utils/logger';
// TODO: Replace with `import type { ... } from '@atlasmail/shared'` after merging to main

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

  return db
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
      sortOrder: employees.sortOrder,
      isArchived: employees.isArchived,
      createdAt: employees.createdAt,
      updatedAt: employees.updatedAt,
      departmentName: departments.name,
      departmentColor: departments.color,
    })
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(and(...conditions))
    .orderBy(asc(employees.sortOrder), asc(employees.createdAt));
}

export async function getEmployee(userId: string, id: string) {
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
      sortOrder: employees.sortOrder,
      isArchived: employees.isArchived,
      createdAt: employees.createdAt,
      updatedAt: employees.updatedAt,
      departmentName: departments.name,
      departmentColor: departments.color,
    })
    .from(employees)
    .leftJoin(departments, eq(employees.departmentId, departments.id))
    .where(and(eq(employees.id, id), eq(employees.userId, userId)))
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

// ─── Seed Sample Data ───────────────────────────────────────────────

export async function seedSampleData(userId: string, accountId: string) {
  // Idempotency guard — skip if data already exists
  const existing = await db.select({ id: employees.id }).from(employees)
    .where(eq(employees.userId, userId)).limit(1);
  if (existing.length > 0) return { skipped: true };

  // Create 3 departments
  const engineering = await createDepartment(userId, accountId, { name: 'Engineering', color: '#3b82f6' });
  const marketing = await createDepartment(userId, accountId, { name: 'Marketing', color: '#f59e0b' });
  const operations = await createDepartment(userId, accountId, { name: 'Operations', color: '#10b981' });

  const today = new Date().toISOString().split('T')[0];
  const sixMonthsAgo = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0];
  const oneYearAgo = new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0];
  const twoYearsAgo = new Date(Date.now() - 730 * 86400000).toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const inTwoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
  const inThreeWeeks = new Date(Date.now() + 21 * 86400000).toISOString().split('T')[0];

  // Create 8 employees
  const emp1 = await createEmployee(userId, accountId, { name: 'Alice Johnson', email: 'alice@company.com', role: 'Senior Engineer', departmentId: engineering.id, startDate: twoYearsAgo, phone: '+1-555-0101' });
  const emp2 = await createEmployee(userId, accountId, { name: 'Bob Williams', email: 'bob@company.com', role: 'Marketing Lead', departmentId: marketing.id, startDate: oneYearAgo, phone: '+1-555-0102' });
  const emp3 = await createEmployee(userId, accountId, { name: 'Carol Davis', email: 'carol@company.com', role: 'Frontend Developer', departmentId: engineering.id, startDate: sixMonthsAgo });
  const emp4 = await createEmployee(userId, accountId, { name: 'David Brown', email: 'david@company.com', role: 'Operations Manager', departmentId: operations.id, startDate: twoYearsAgo, phone: '+1-555-0104' });
  const emp5 = await createEmployee(userId, accountId, { name: 'Eva Martinez', email: 'eva@company.com', role: 'Content Strategist', departmentId: marketing.id, startDate: oneYearAgo });
  const emp6 = await createEmployee(userId, accountId, { name: 'Frank Lee', email: 'frank@company.com', role: 'DevOps Engineer', departmentId: engineering.id, startDate: sixMonthsAgo, status: 'on-leave' });
  const emp7 = await createEmployee(userId, accountId, { name: 'Grace Kim', email: 'grace@company.com', role: 'HR Coordinator', departmentId: operations.id, startDate: oneYearAgo, phone: '+1-555-0107' });
  const emp8 = await createEmployee(userId, accountId, { name: 'Henry Wilson', email: 'henry@company.com', role: 'Backend Developer', departmentId: engineering.id, startDate: twoYearsAgo });

  // Set department heads
  await updateDepartment(userId, accountId, engineering.id, { headEmployeeId: emp1.id });
  await updateDepartment(userId, accountId, marketing.id, { headEmployeeId: emp2.id });
  await updateDepartment(userId, accountId, operations.id, { headEmployeeId: emp4.id });

  // Create 5 time-off requests
  await createTimeOffRequest(userId, accountId, { employeeId: emp1.id, type: 'vacation', startDate: nextWeek, endDate: inTwoWeeks, notes: 'Family vacation' });
  await createTimeOffRequest(userId, accountId, { employeeId: emp3.id, type: 'sick', startDate: today, endDate: today, notes: 'Not feeling well' });
  await createTimeOffRequest(userId, accountId, { employeeId: emp5.id, type: 'personal', startDate: inTwoWeeks, endDate: inTwoWeeks });
  await createTimeOffRequest(userId, accountId, { employeeId: emp6.id, type: 'sick', startDate: today, endDate: nextWeek, notes: 'Medical recovery' });
  await createTimeOffRequest(userId, accountId, { employeeId: emp8.id, type: 'vacation', startDate: inTwoWeeks, endDate: inThreeWeeks, notes: 'Travel abroad' });

  logger.info({ userId, accountId }, 'Seeded HR sample data');
  return { departments: 3, employees: 8, timeOffRequests: 5 };
}
