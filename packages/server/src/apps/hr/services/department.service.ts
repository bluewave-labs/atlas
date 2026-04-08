import { db } from '../../../config/database';
import { departments, employees } from '../../../db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import { logger } from '../../../utils/logger';

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

// ─── Departments ────────────────────────────────────────────────────

export async function listDepartments(userId: string, tenantId: string, includeArchived = false) {
  const conditions = [eq(departments.userId, userId), eq(departments.tenantId, tenantId)];
  if (!includeArchived) {
    conditions.push(eq(departments.isArchived, false));
  }

  const rows = await db
    .select({
      id: departments.id,
      tenantId: departments.tenantId,
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

export async function getDepartment(userId: string, tenantId: string, id: string) {
  const [department] = await db
    .select({
      id: departments.id,
      tenantId: departments.tenantId,
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
    .where(and(eq(departments.id, id), eq(departments.userId, userId), eq(departments.tenantId, tenantId)))
    .limit(1);

  return department || null;
}

export async function createDepartment(userId: string, tenantId: string, input: CreateDepartmentInput) {
  const now = new Date();

  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${departments.sortOrder}), -1)` })
    .from(departments)
    .where(eq(departments.userId, userId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(departments)
    .values({
      tenantId,
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

export async function updateDepartment(userId: string, tenantId: string, id: string, input: UpdateDepartmentInput) {
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
    .where(and(eq(departments.id, id), eq(departments.userId, userId), eq(departments.tenantId, tenantId)));

  const [updated] = await db
    .select()
    .from(departments)
    .where(and(eq(departments.id, id), eq(departments.userId, userId), eq(departments.tenantId, tenantId)))
    .limit(1);

  return updated || null;
}

export async function deleteDepartment(userId: string, tenantId: string, id: string) {
  await updateDepartment(userId, tenantId, id, { isArchived: true });
}
