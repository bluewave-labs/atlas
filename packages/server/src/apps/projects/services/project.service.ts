import { db } from '../../../config/database';
import {
  projectProjects, projectMembers, projectClients, users, accounts,
} from '../../../db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import { logger } from '../../../utils/logger';

// ─── Input types ────────────────────────────────────────────────────

interface CreateProjectInput {
  name: string;
  clientId?: string | null;
  description?: string | null;
  billable?: boolean;
  status?: string;
  estimatedHours?: number | null;
  estimatedAmount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  color?: string | null;
}

interface UpdateProjectInput extends Partial<CreateProjectInput> {
  sortOrder?: number;
  isArchived?: boolean;
}

// ─── Projects ───────────────────────────────────────────────────────

export async function listProjects(userId: string, accountId: string, filters?: {
  search?: string;
  clientId?: string;
  status?: string;
  includeArchived?: boolean;
}) {
  const conditions = [eq(projectProjects.accountId, accountId)];
  if (!filters?.includeArchived) {
    conditions.push(eq(projectProjects.isArchived, false));
  }
  if (filters?.clientId) {
    conditions.push(eq(projectProjects.clientId, filters.clientId));
  }
  if (filters?.status) {
    conditions.push(eq(projectProjects.status, filters.status));
  }
  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(sql`${projectProjects.name} ILIKE ${searchTerm}`);
  }

  return db
    .select({
      id: projectProjects.id,
      accountId: projectProjects.accountId,
      userId: projectProjects.userId,
      clientId: projectProjects.clientId,
      name: projectProjects.name,
      description: projectProjects.description,
      billable: projectProjects.billable,
      status: projectProjects.status,
      estimatedHours: projectProjects.estimatedHours,
      estimatedAmount: projectProjects.estimatedAmount,
      startDate: projectProjects.startDate,
      endDate: projectProjects.endDate,
      color: projectProjects.color,
      isArchived: projectProjects.isArchived,
      sortOrder: projectProjects.sortOrder,
      createdAt: projectProjects.createdAt,
      updatedAt: projectProjects.updatedAt,
      clientName: projectClients.name,
      totalTrackedMinutes: sql<number>`COALESCE((SELECT SUM(duration_minutes) FROM project_time_entries WHERE project_id = ${projectProjects.id} AND is_archived = false), 0)`.as('total_tracked_minutes'),
      totalBilledAmount: sql<number>`COALESCE((SELECT SUM(pli.amount) FROM project_invoice_line_items pli INNER JOIN project_time_entries pte ON pte.id = pli.time_entry_id WHERE pte.project_id = ${projectProjects.id}), 0)`.as('total_billed_amount'),
      unbilledMinutes: sql<number>`COALESCE((SELECT SUM(pte2.duration_minutes) FROM project_time_entries pte2 WHERE pte2.project_id = ${projectProjects.id} AND pte2.is_archived = false AND pte2.billable = true AND NOT EXISTS (SELECT 1 FROM project_invoice_line_items pli2 WHERE pli2.time_entry_id = pte2.id)), 0)`.as('unbilled_minutes'),
    })
    .from(projectProjects)
    .leftJoin(projectClients, eq(projectProjects.clientId, projectClients.id))
    .where(and(...conditions))
    .orderBy(asc(projectProjects.sortOrder), asc(projectProjects.createdAt));
}

export async function getProject(userId: string, accountId: string, id: string) {
  const [project] = await db
    .select({
      id: projectProjects.id,
      accountId: projectProjects.accountId,
      userId: projectProjects.userId,
      clientId: projectProjects.clientId,
      name: projectProjects.name,
      description: projectProjects.description,
      billable: projectProjects.billable,
      status: projectProjects.status,
      estimatedHours: projectProjects.estimatedHours,
      estimatedAmount: projectProjects.estimatedAmount,
      startDate: projectProjects.startDate,
      endDate: projectProjects.endDate,
      color: projectProjects.color,
      isArchived: projectProjects.isArchived,
      sortOrder: projectProjects.sortOrder,
      createdAt: projectProjects.createdAt,
      updatedAt: projectProjects.updatedAt,
      clientName: projectClients.name,
      totalTrackedMinutes: sql<number>`COALESCE((SELECT SUM(duration_minutes) FROM project_time_entries WHERE project_id = ${projectProjects.id} AND is_archived = false), 0)`.as('total_tracked_minutes'),
      totalBilledAmount: sql<number>`COALESCE((SELECT SUM(pli.amount) FROM project_invoice_line_items pli INNER JOIN project_time_entries pte ON pte.id = pli.time_entry_id WHERE pte.project_id = ${projectProjects.id}), 0)`.as('total_billed_amount'),
    })
    .from(projectProjects)
    .leftJoin(projectClients, eq(projectProjects.clientId, projectClients.id))
    .where(and(eq(projectProjects.id, id), eq(projectProjects.accountId, accountId)))
    .limit(1);

  return project || null;
}

export async function createProject(userId: string, accountId: string, input: CreateProjectInput) {
  const now = new Date();
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${projectProjects.sortOrder}), -1)` })
    .from(projectProjects)
    .where(eq(projectProjects.accountId, accountId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(projectProjects)
    .values({
      accountId,
      userId,
      clientId: input.clientId ?? null,
      name: input.name,
      description: input.description ?? null,
      billable: input.billable ?? true,
      status: input.status ?? 'active',
      estimatedHours: input.estimatedHours ?? null,
      estimatedAmount: input.estimatedAmount ?? null,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
      color: input.color ?? null,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, projectId: created.id }, 'Project created');
  return created;
}

export async function updateProject(userId: string, accountId: string, id: string, input: UpdateProjectInput) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) updates.name = input.name;
  if (input.clientId !== undefined) updates.clientId = input.clientId;
  if (input.description !== undefined) updates.description = input.description;
  if (input.billable !== undefined) updates.billable = input.billable;
  if (input.status !== undefined) updates.status = input.status;
  if (input.estimatedHours !== undefined) updates.estimatedHours = input.estimatedHours;
  if (input.estimatedAmount !== undefined) updates.estimatedAmount = input.estimatedAmount;
  if (input.startDate !== undefined) updates.startDate = input.startDate ? new Date(input.startDate) : null;
  if (input.endDate !== undefined) updates.endDate = input.endDate ? new Date(input.endDate) : null;
  if (input.color !== undefined) updates.color = input.color;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  const conditions = [eq(projectProjects.id, id), eq(projectProjects.accountId, accountId)];

  const [updated] = await db
    .update(projectProjects)
    .set(updates)
    .where(and(...conditions))
    .returning();

  return updated ?? null;
}

export async function deleteProject(userId: string, accountId: string, id: string) {
  await updateProject(userId, accountId, id, { isArchived: true });
}

// ─── Members ────────────────────────────────────────────────────────

export async function listProjectMembers(userId: string, accountId: string, projectId: string) {
  return db
    .select({
      id: projectMembers.id,
      userId: projectMembers.userId,
      projectId: projectMembers.projectId,
      hourlyRate: projectMembers.hourlyRate,
      role: projectMembers.role,
      createdAt: projectMembers.createdAt,
      updatedAt: projectMembers.updatedAt,
      userName: users.name,
      userEmail: accounts.email,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .innerJoin(accounts, eq(accounts.userId, users.id))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(asc(projectMembers.createdAt));
}

export async function addProjectMember(projectId: string, memberUserId: string, hourlyRate: number | null, role: string) {
  const now = new Date();
  const [created] = await db
    .insert(projectMembers)
    .values({
      userId: memberUserId,
      projectId,
      hourlyRate: hourlyRate ?? null,
      role: role || 'member',
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

export async function removeProjectMember(projectId: string, memberId: string) {
  await db
    .delete(projectMembers)
    .where(and(eq(projectMembers.id, memberId), eq(projectMembers.projectId, projectId)));
}

export async function updateProjectMemberRate(projectId: string, memberId: string, hourlyRate: number | null) {
  const now = new Date();
  const [updated] = await db
    .update(projectMembers)
    .set({ hourlyRate, updatedAt: now })
    .where(and(eq(projectMembers.id, memberId), eq(projectMembers.projectId, projectId)))
    .returning();

  return updated || null;
}
