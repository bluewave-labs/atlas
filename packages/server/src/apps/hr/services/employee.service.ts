import { db } from '../../../config/database';
import {
  employees, departments, users, tenantMembers, appPermissions,
} from '../../../db/schema';
import { eq, and, asc, desc, sql, type SQL } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import { setAppPermission } from '../../../services/app-permissions.service';
import { createLifecycleEvent } from './lifecycle.service';

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

// ─── Shared scope helper ────────────────────────────────────────────

function addEmployeeScopeConditions(conditions: SQL[], userId: string, isAdmin?: boolean, userEmail?: string) {
  if (!isAdmin && userEmail) {
    conditions.push(sql`LOWER(${employees.email}) = LOWER(${userEmail})`);
  } else if (!isAdmin) {
    conditions.push(eq(employees.userId, userId));
  }
}

// ─── Employees ──────────────────────────────────────────────────────

export async function listEmployees(userId: string, accountId: string, filters?: {
  status?: string;
  departmentId?: string;
  includeArchived?: boolean;
  isAdmin?: boolean;
  userEmail?: string;
}) {
  const conditions = [eq(employees.accountId, accountId)];
  addEmployeeScopeConditions(conditions, userId, filters?.isAdmin, filters?.userEmail);

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

  // Auto-link employee to user if email matches
  if (input.email && !input.linkedUserId) {
    try {
      const [matchingUser] = await db.select({ id: users.id }).from(users)
        .where(eq(users.email, input.email)).limit(1);
      if (matchingUser) {
        await db.update(employees).set({ linkedUserId: matchingUser.id })
          .where(eq(employees.id, created.id));
        created.linkedUserId = matchingUser.id;

        // Auto-grant HR viewer permission if none exists
        const [membership] = await db.select({ tenantId: tenantMembers.tenantId }).from(tenantMembers)
          .where(eq(tenantMembers.userId, matchingUser.id)).limit(1);
        if (membership) {
          const [explicitPerm] = await db.select().from(appPermissions)
            .where(and(
              eq(appPermissions.tenantId, membership.tenantId),
              eq(appPermissions.userId, matchingUser.id),
              eq(appPermissions.appId, 'hr'),
            )).limit(1);
          if (!explicitPerm) {
            await setAppPermission(membership.tenantId, matchingUser.id, 'hr', 'viewer', 'own');
          }
        }
        logger.info({ employeeId: created.id, linkedUserId: matchingUser.id }, 'Auto-linked employee to user + granted HR viewer');
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to auto-link employee to user');
    }
  }

  logger.info({ userId, employeeId: created.id }, 'Employee created');
  return created;
}

export async function updateEmployee(userId: string, id: string, input: UpdateEmployeeInput, accountId?: string) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Fetch current employee — use accountId if provided (admin editing another user's record)
  const fetchCondition = accountId
    ? and(eq(employees.id, id), eq(employees.accountId, accountId))
    : and(eq(employees.id, id), eq(employees.userId, userId));

  const [current] = await db.select().from(employees)
    .where(fetchCondition).limit(1);

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
    .where(fetchCondition);

  const [updated] = await db
    .select()
    .from(employees)
    .where(fetchCondition)
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

export async function getEmployeeCounts(userId: string, accountId: string, isAdmin = false, userEmail?: string) {
  const conditions = [eq(employees.accountId, accountId), eq(employees.isArchived, false)];
  addEmployeeScopeConditions(conditions, userId, isAdmin, userEmail);
  const allEmployees = await db
    .select({ status: employees.status })
    .from(employees)
    .where(and(...conditions));

  const counts: Record<string, number> = { active: 0, 'on-leave': 0, terminated: 0, total: 0 };

  for (const e of allEmployees) {
    counts.total++;
    if (e.status in counts) {
      counts[e.status]++;
    }
  }

  return counts;
}
