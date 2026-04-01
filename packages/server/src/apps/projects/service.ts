import { db } from '../../config/database';
import {
  projectClients, projectProjects, projectMembers,
  projectTimeEntries, projectInvoices, projectInvoiceLineItems,
  projectSettings, users, accounts,
} from '../../db/schema';
import { eq, and, asc, desc, sql, gte, lte, inArray } from 'drizzle-orm';
import { logger } from '../../utils/logger';

// ─── Input types ────────────────────────────────────────────────────

interface CreateClientInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  currency?: string | null;
  logo?: string | null;
  notes?: string | null;
}

interface UpdateClientInput extends Partial<CreateClientInput> {
  sortOrder?: number;
  isArchived?: boolean;
}

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

interface CreateInvoiceInput {
  clientId: string;
  invoiceNumber?: string;
  status?: string;
  amount?: number;
  tax?: number;
  taxAmount?: number;
  discount?: number;
  discountAmount?: number;
  currency?: string;
  issueDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
}

interface UpdateInvoiceInput extends Partial<CreateInvoiceInput> {
  isArchived?: boolean;
}

interface CreateLineItemInput {
  invoiceId: string;
  timeEntryId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

interface UpdateLineItemInput {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
}

// ─── Clients ────────────────────────────────────────────────────────

export async function listClients(userId: string, accountId: string, filters?: {
  search?: string;
  includeArchived?: boolean;
}) {
  const conditions = [eq(projectClients.accountId, accountId)];
  if (!filters?.includeArchived) {
    conditions.push(eq(projectClients.isArchived, false));
  }
  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(sql`(${projectClients.name} ILIKE ${searchTerm} OR ${projectClients.email} ILIKE ${searchTerm})`);
  }

  return db
    .select({
      id: projectClients.id,
      accountId: projectClients.accountId,
      userId: projectClients.userId,
      name: projectClients.name,
      email: projectClients.email,
      phone: projectClients.phone,
      address: projectClients.address,
      city: projectClients.city,
      state: projectClients.state,
      country: projectClients.country,
      postalCode: projectClients.postalCode,
      currency: projectClients.currency,
      logo: projectClients.logo,
      portalToken: projectClients.portalToken,
      notes: projectClients.notes,
      isArchived: projectClients.isArchived,
      sortOrder: projectClients.sortOrder,
      createdAt: projectClients.createdAt,
      updatedAt: projectClients.updatedAt,
      projectCount: sql<number>`(SELECT COUNT(*) FROM project_projects WHERE client_id = ${projectClients.id} AND is_archived = false)`.as('project_count'),
      totalBilled: sql<number>`COALESCE((SELECT SUM(amount) FROM project_invoices WHERE client_id = ${projectClients.id} AND status = 'paid' AND is_archived = false), 0)`.as('total_billed'),
      outstandingAmount: sql<number>`COALESCE((SELECT SUM(amount) FROM project_invoices WHERE client_id = ${projectClients.id} AND status IN ('sent', 'viewed', 'overdue') AND is_archived = false), 0)`.as('outstanding_amount'),
    })
    .from(projectClients)
    .where(and(...conditions))
    .orderBy(asc(projectClients.sortOrder), asc(projectClients.createdAt));
}

export async function getClient(userId: string, accountId: string, id: string) {
  const [client] = await db
    .select({
      id: projectClients.id,
      accountId: projectClients.accountId,
      userId: projectClients.userId,
      name: projectClients.name,
      email: projectClients.email,
      phone: projectClients.phone,
      address: projectClients.address,
      city: projectClients.city,
      state: projectClients.state,
      country: projectClients.country,
      postalCode: projectClients.postalCode,
      currency: projectClients.currency,
      logo: projectClients.logo,
      portalToken: projectClients.portalToken,
      notes: projectClients.notes,
      isArchived: projectClients.isArchived,
      sortOrder: projectClients.sortOrder,
      createdAt: projectClients.createdAt,
      updatedAt: projectClients.updatedAt,
      projectCount: sql<number>`(SELECT COUNT(*) FROM project_projects WHERE client_id = ${projectClients.id} AND is_archived = false)`.as('project_count'),
      totalBilled: sql<number>`COALESCE((SELECT SUM(amount) FROM project_invoices WHERE client_id = ${projectClients.id} AND status = 'paid' AND is_archived = false), 0)`.as('total_billed'),
      outstandingAmount: sql<number>`COALESCE((SELECT SUM(amount) FROM project_invoices WHERE client_id = ${projectClients.id} AND status IN ('sent', 'viewed', 'overdue') AND is_archived = false), 0)`.as('outstanding_amount'),
    })
    .from(projectClients)
    .where(and(eq(projectClients.id, id), eq(projectClients.accountId, accountId)))
    .limit(1);

  return client || null;
}

export async function createClient(userId: string, accountId: string, input: CreateClientInput) {
  const now = new Date();
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${projectClients.sortOrder}), -1)` })
    .from(projectClients)
    .where(eq(projectClients.accountId, accountId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(projectClients)
    .values({
      accountId,
      userId,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      country: input.country ?? null,
      postalCode: input.postalCode ?? null,
      currency: input.currency ?? 'USD',
      logo: input.logo ?? null,
      notes: input.notes ?? null,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, clientId: created.id }, 'Project client created');
  return created;
}

export async function updateClient(userId: string, accountId: string, id: string, input: UpdateClientInput) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) updates.name = input.name;
  if (input.email !== undefined) updates.email = input.email;
  if (input.phone !== undefined) updates.phone = input.phone;
  if (input.address !== undefined) updates.address = input.address;
  if (input.city !== undefined) updates.city = input.city;
  if (input.state !== undefined) updates.state = input.state;
  if (input.country !== undefined) updates.country = input.country;
  if (input.postalCode !== undefined) updates.postalCode = input.postalCode;
  if (input.currency !== undefined) updates.currency = input.currency;
  if (input.logo !== undefined) updates.logo = input.logo;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  const conditions = [eq(projectClients.id, id), eq(projectClients.accountId, accountId)];

  const [updated] = await db
    .update(projectClients)
    .set(updates)
    .where(and(...conditions))
    .returning();

  return updated ?? null;
}

export async function deleteClient(userId: string, accountId: string, id: string) {
  await updateClient(userId, accountId, id, { isArchived: true });
}

export async function regeneratePortalToken(userId: string, accountId: string, id: string) {
  const now = new Date();
  const [updated] = await db
    .update(projectClients)
    .set({ portalToken: sql`gen_random_uuid()`, updatedAt: now })
    .where(and(eq(projectClients.id, id), eq(projectClients.accountId, accountId)))
    .returning();

  return updated || null;
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

// ─── Time Entries ───────────────────────────────────────────────────

export async function listTimeEntries(userId: string, accountId: string, filters?: {
  projectId?: string;
  startDate?: string;
  endDate?: string;
  billed?: boolean;
  billable?: boolean;
  entryUserId?: string;
  includeArchived?: boolean;
}) {
  const conditions = [eq(projectTimeEntries.accountId, accountId)];
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

// ─── Invoices ───────────────────────────────────────────────────────

export async function listInvoices(userId: string, accountId: string, filters?: {
  clientId?: string;
  status?: string;
  search?: string;
  includeArchived?: boolean;
}) {
  const conditions = [eq(projectInvoices.accountId, accountId)];
  if (!filters?.includeArchived) {
    conditions.push(eq(projectInvoices.isArchived, false));
  }
  if (filters?.clientId) {
    conditions.push(eq(projectInvoices.clientId, filters.clientId));
  }
  if (filters?.status) {
    conditions.push(eq(projectInvoices.status, filters.status));
  }
  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(sql`(${projectInvoices.invoiceNumber} ILIKE ${searchTerm} OR ${projectClients.name} ILIKE ${searchTerm})`);
  }

  return db
    .select({
      id: projectInvoices.id,
      accountId: projectInvoices.accountId,
      userId: projectInvoices.userId,
      clientId: projectInvoices.clientId,
      invoiceNumber: projectInvoices.invoiceNumber,
      status: projectInvoices.status,
      amount: projectInvoices.amount,
      tax: projectInvoices.tax,
      taxAmount: projectInvoices.taxAmount,
      discount: projectInvoices.discount,
      discountAmount: projectInvoices.discountAmount,
      currency: projectInvoices.currency,
      issueDate: projectInvoices.issueDate,
      dueDate: projectInvoices.dueDate,
      notes: projectInvoices.notes,
      sentAt: projectInvoices.sentAt,
      viewedAt: projectInvoices.viewedAt,
      paidAt: projectInvoices.paidAt,
      isArchived: projectInvoices.isArchived,
      createdAt: projectInvoices.createdAt,
      updatedAt: projectInvoices.updatedAt,
      clientName: projectClients.name,
      lineItemCount: sql<number>`(SELECT COUNT(*) FROM project_invoice_line_items WHERE invoice_id = ${projectInvoices.id})`.as('line_item_count'),
    })
    .from(projectInvoices)
    .leftJoin(projectClients, eq(projectInvoices.clientId, projectClients.id))
    .where(and(...conditions))
    .orderBy(desc(projectInvoices.createdAt));
}

export async function getInvoice(userId: string, accountId: string, id: string) {
  const [invoice] = await db
    .select({
      id: projectInvoices.id,
      accountId: projectInvoices.accountId,
      userId: projectInvoices.userId,
      clientId: projectInvoices.clientId,
      invoiceNumber: projectInvoices.invoiceNumber,
      status: projectInvoices.status,
      amount: projectInvoices.amount,
      tax: projectInvoices.tax,
      taxAmount: projectInvoices.taxAmount,
      discount: projectInvoices.discount,
      discountAmount: projectInvoices.discountAmount,
      currency: projectInvoices.currency,
      issueDate: projectInvoices.issueDate,
      dueDate: projectInvoices.dueDate,
      notes: projectInvoices.notes,
      sentAt: projectInvoices.sentAt,
      viewedAt: projectInvoices.viewedAt,
      paidAt: projectInvoices.paidAt,
      isArchived: projectInvoices.isArchived,
      createdAt: projectInvoices.createdAt,
      updatedAt: projectInvoices.updatedAt,
      clientName: projectClients.name,
    })
    .from(projectInvoices)
    .leftJoin(projectClients, eq(projectInvoices.clientId, projectClients.id))
    .where(and(eq(projectInvoices.id, id), eq(projectInvoices.accountId, accountId)))
    .limit(1);

  if (!invoice) return null;

  // Fetch line items
  const lineItems = await db
    .select()
    .from(projectInvoiceLineItems)
    .where(eq(projectInvoiceLineItems.invoiceId, id))
    .orderBy(asc(projectInvoiceLineItems.createdAt));

  return { ...invoice, lineItems };
}

export async function getNextInvoiceNumber(accountId: string): Promise<string> {
  // Read the prefix first (needed for formatting)
  const settings = await getSettings(accountId);
  const prefix = settings?.invoicePrefix || 'INV';

  // Atomically increment and return the number in a single query to avoid race conditions
  const [updated] = await db
    .update(projectSettings)
    .set({ nextInvoiceNumber: sql`COALESCE(${projectSettings.nextInvoiceNumber}, 1) + 1`, updatedAt: new Date() })
    .where(eq(projectSettings.accountId, accountId))
    .returning({ num: projectSettings.nextInvoiceNumber });

  if (!updated) {
    // No settings row exists yet -- create one with nextInvoiceNumber = 2 (we use 1 now)
    await db.insert(projectSettings).values({ accountId, nextInvoiceNumber: 2 }).onConflictDoNothing();
    return `${prefix}-${String(1).padStart(3, '0')}`;
  }

  // updated.num is the value AFTER increment, so the number we use is num - 1
  const num = updated.num - 1;
  return `${prefix}-${String(num).padStart(3, '0')}`;
}

export async function createInvoice(userId: string, accountId: string, input: CreateInvoiceInput) {
  const now = new Date();
  const invoiceNumber = input.invoiceNumber || await getNextInvoiceNumber(accountId);

  const [created] = await db
    .insert(projectInvoices)
    .values({
      accountId,
      userId,
      clientId: input.clientId,
      invoiceNumber,
      status: input.status ?? 'draft',
      amount: input.amount ?? 0,
      tax: input.tax ?? 0,
      taxAmount: input.taxAmount ?? 0,
      discount: input.discount ?? 0,
      discountAmount: input.discountAmount ?? 0,
      currency: input.currency ?? 'USD',
      issueDate: input.issueDate ? new Date(input.issueDate) : null,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, invoiceId: created.id, invoiceNumber }, 'Invoice created');
  return created;
}

export async function updateInvoice(userId: string, accountId: string, id: string, input: UpdateInvoiceInput) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.clientId !== undefined) updates.clientId = input.clientId;
  if (input.invoiceNumber !== undefined) updates.invoiceNumber = input.invoiceNumber;
  if (input.status !== undefined) updates.status = input.status;
  if (input.amount !== undefined) updates.amount = input.amount;
  if (input.tax !== undefined) updates.tax = input.tax;
  if (input.taxAmount !== undefined) updates.taxAmount = input.taxAmount;
  if (input.discount !== undefined) updates.discount = input.discount;
  if (input.discountAmount !== undefined) updates.discountAmount = input.discountAmount;
  if (input.currency !== undefined) updates.currency = input.currency;
  if (input.issueDate !== undefined) updates.issueDate = input.issueDate ? new Date(input.issueDate) : null;
  if (input.dueDate !== undefined) updates.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  const conditions = [eq(projectInvoices.id, id), eq(projectInvoices.accountId, accountId)];

  const [updated] = await db
    .update(projectInvoices)
    .set(updates)
    .where(and(...conditions))
    .returning();

  return updated ?? null;
}

export async function deleteInvoice(userId: string, accountId: string, id: string) {
  // When an invoice is deleted, unmark all linked time entries
  const lineItems = await db
    .select({ timeEntryId: projectInvoiceLineItems.timeEntryId })
    .from(projectInvoiceLineItems)
    .where(eq(projectInvoiceLineItems.invoiceId, id));

  const timeEntryIds = lineItems
    .map(li => li.timeEntryId)
    .filter((id): id is string => id !== null);

  if (timeEntryIds.length > 0) {
    await db
      .update(projectTimeEntries)
      .set({ billed: false, locked: false, invoiceLineItemId: null, updatedAt: new Date() })
      .where(inArray(projectTimeEntries.id, timeEntryIds));
  }

  await updateInvoice(userId, accountId, id, { isArchived: true });
}

export async function sendInvoice(userId: string, accountId: string, id: string) {
  const now = new Date();
  const [invoice] = await db
    .update(projectInvoices)
    .set({ status: 'sent', sentAt: now, updatedAt: now })
    .where(and(eq(projectInvoices.id, id), eq(projectInvoices.accountId, accountId)))
    .returning();

  return invoice ?? null;
}

export async function markInvoiceViewed(accountId: string, id: string) {
  const now = new Date();
  await db
    .update(projectInvoices)
    .set({ status: 'viewed', viewedAt: now, updatedAt: now })
    .where(and(
      eq(projectInvoices.id, id),
      eq(projectInvoices.accountId, accountId),
      sql`${projectInvoices.viewedAt} IS NULL`,
    ));
}

export async function markInvoicePaid(userId: string, accountId: string, id: string) {
  const now = new Date();
  const [invoice] = await db
    .update(projectInvoices)
    .set({ status: 'paid', paidAt: now, updatedAt: now })
    .where(and(eq(projectInvoices.id, id), eq(projectInvoices.accountId, accountId)))
    .returning();

  return invoice ?? null;
}

export async function duplicateInvoice(userId: string, accountId: string, id: string) {
  const existing = await getInvoice(userId, accountId, id);
  if (!existing) return null;

  const invoiceNumber = await getNextInvoiceNumber(accountId);
  const now = new Date();

  const [newInvoice] = await db
    .insert(projectInvoices)
    .values({
      accountId,
      userId,
      clientId: existing.clientId,
      invoiceNumber,
      status: 'draft',
      amount: existing.amount,
      tax: existing.tax,
      taxAmount: existing.taxAmount,
      discount: existing.discount,
      discountAmount: existing.discountAmount,
      currency: existing.currency,
      notes: existing.notes,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Duplicate line items in a single batch insert (without time entry links)
  if (existing.lineItems && existing.lineItems.length > 0) {
    await db.insert(projectInvoiceLineItems).values(
      existing.lineItems.map(li => ({
        invoiceId: newInvoice.id,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        amount: li.amount,
        createdAt: now,
        updatedAt: now,
      }))
    );
  }

  return newInvoice;
}

// ─── Line Items ─────────────────────────────────────────────────────

export async function getLineItemById(id: string) {
  const [lineItem] = await db
    .select()
    .from(projectInvoiceLineItems)
    .where(eq(projectInvoiceLineItems.id, id))
    .limit(1);

  return lineItem || null;
}

export async function listInvoiceLineItems(invoiceId: string) {
  return db
    .select()
    .from(projectInvoiceLineItems)
    .where(eq(projectInvoiceLineItems.invoiceId, invoiceId))
    .orderBy(asc(projectInvoiceLineItems.createdAt));
}

export async function createLineItem(input: CreateLineItemInput) {
  const now = new Date();
  const [created] = await db
    .insert(projectInvoiceLineItems)
    .values({
      invoiceId: input.invoiceId,
      timeEntryId: input.timeEntryId ?? null,
      description: input.description,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      amount: input.amount,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

export async function updateLineItem(id: string, input: UpdateLineItemInput) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.description !== undefined) updates.description = input.description;
  if (input.quantity !== undefined) updates.quantity = input.quantity;
  if (input.unitPrice !== undefined) updates.unitPrice = input.unitPrice;
  if (input.amount !== undefined) updates.amount = input.amount;

  const [updated] = await db
    .update(projectInvoiceLineItems)
    .set(updates)
    .where(eq(projectInvoiceLineItems.id, id))
    .returning();

  return updated ?? null;
}

export async function deleteLineItem(id: string) {
  // If the line item had a time entry, unmark it
  const [lineItem] = await db
    .select()
    .from(projectInvoiceLineItems)
    .where(eq(projectInvoiceLineItems.id, id))
    .limit(1);

  if (lineItem?.timeEntryId) {
    await db
      .update(projectTimeEntries)
      .set({ billed: false, locked: false, invoiceLineItemId: null, updatedAt: new Date() })
      .where(eq(projectTimeEntries.id, lineItem.timeEntryId));
  }

  await db
    .delete(projectInvoiceLineItems)
    .where(eq(projectInvoiceLineItems.id, id));
}

export async function populateFromTimeEntries(
  accountId: string,
  invoiceId: string,
  clientId: string,
  startDate: string,
  endDate: string,
) {
  // Find all client's projects
  const clientProjects = await db
    .select({ id: projectProjects.id })
    .from(projectProjects)
    .where(and(
      eq(projectProjects.clientId, clientId),
      eq(projectProjects.accountId, accountId),
    ));

  const projectIds = clientProjects.map(p => p.id);
  if (projectIds.length === 0) return [];

  // Find unbilled billable time entries in date range
  const entries = await db
    .select({
      id: projectTimeEntries.id,
      durationMinutes: projectTimeEntries.durationMinutes,
      taskDescription: projectTimeEntries.taskDescription,
      notes: projectTimeEntries.notes,
      workDate: projectTimeEntries.workDate,
      userId: projectTimeEntries.userId,
      projectId: projectTimeEntries.projectId,
    })
    .from(projectTimeEntries)
    .where(and(
      eq(projectTimeEntries.accountId, accountId),
      eq(projectTimeEntries.billable, true),
      eq(projectTimeEntries.billed, false),
      eq(projectTimeEntries.isArchived, false),
      inArray(projectTimeEntries.projectId, projectIds),
      gte(projectTimeEntries.workDate, startDate),
      lte(projectTimeEntries.workDate, endDate),
    ));

  const now = new Date();

  // Batch: collect all unique (projectId, userId) pairs for member rate lookup
  const memberKeys = new Set<string>();
  for (const entry of entries) {
    memberKeys.add(`${entry.projectId}:${entry.userId}`);
  }
  const uniquePairs = [...memberKeys].map(k => { const [p, u] = k.split(':'); return { projectId: p, userId: u }; });

  // Batch-query all relevant project members in one query
  const allMembers = uniquePairs.length > 0
    ? await db
        .select({
          projectId: projectMembers.projectId,
          userId: projectMembers.userId,
          hourlyRate: projectMembers.hourlyRate,
        })
        .from(projectMembers)
        .where(sql`(${projectMembers.projectId}, ${projectMembers.userId}) IN (${sql.raw(
          uniquePairs.map(p => `('${p.projectId}', '${p.userId}')`).join(', ')
        )})`)
    : [];

  // Build O(1) lookup map
  const memberRateMap = new Map<string, number | null>();
  for (const m of allMembers) {
    memberRateMap.set(`${m.projectId}:${m.userId}`, m.hourlyRate);
  }

  // Load settings once for the default rate fallback
  const settings = await getSettings(accountId);
  const defaultRate = settings?.defaultHourlyRate ?? 0;

  // Prepare all line items for batch insert
  const lineItemValues = entries.map(entry => {
    const rate = memberRateMap.get(`${entry.projectId}:${entry.userId}`) ?? defaultRate;
    const hours = entry.durationMinutes / 60;
    const amount = hours * rate;
    const description = entry.taskDescription || entry.notes || `Time entry ${entry.workDate}`;

    return {
      invoiceId,
      timeEntryId: entry.id,
      description,
      quantity: hours,
      unitPrice: rate,
      amount,
      createdAt: now,
      updatedAt: now,
    };
  });

  // Batch insert all line items at once
  const createdLineItems = lineItemValues.length > 0
    ? await db.insert(projectInvoiceLineItems).values(lineItemValues).returning()
    : [];

  // Build a map from timeEntryId -> lineItemId for batch update
  const entryToLineItem = new Map<string, string>();
  for (const li of createdLineItems) {
    if (li.timeEntryId) {
      entryToLineItem.set(li.timeEntryId, li.id);
    }
  }

  // Batch update: mark all time entries as billed and locked
  const timeEntryIds = entries.map(e => e.id);
  if (timeEntryIds.length > 0) {
    // We need individual updates for invoiceLineItemId, but we can batch the billed/locked flags
    await db
      .update(projectTimeEntries)
      .set({ billed: true, locked: true, updatedAt: now })
      .where(inArray(projectTimeEntries.id, timeEntryIds));

    // Set invoiceLineItemId for each entry individually (different value per row)
    for (const [entryId, lineItemId] of entryToLineItem) {
      await db
        .update(projectTimeEntries)
        .set({ invoiceLineItemId: lineItemId })
        .where(eq(projectTimeEntries.id, entryId));
    }
  }

  // Update invoice total
  const totalAmount = createdLineItems.reduce((sum, li) => sum + li.amount, 0);
  if (totalAmount > 0) {
    const [existingInvoice] = await db
      .select({ amount: projectInvoices.amount })
      .from(projectInvoices)
      .where(eq(projectInvoices.id, invoiceId))
      .limit(1);

    const newAmount = (existingInvoice?.amount ?? 0) + totalAmount;
    await db
      .update(projectInvoices)
      .set({ amount: newAmount, updatedAt: now })
      .where(eq(projectInvoices.id, invoiceId));
  }

  return createdLineItems;
}

// ─── Reports ────────────────────────────────────────────────────────

export async function getTimeReport(userId: string, accountId: string, filters?: {
  startDate?: string;
  endDate?: string;
  projectId?: string;
}) {
  const conditions = [
    eq(projectTimeEntries.accountId, accountId),
    eq(projectTimeEntries.isArchived, false),
  ];
  if (filters?.startDate) conditions.push(gte(projectTimeEntries.workDate, filters.startDate));
  if (filters?.endDate) conditions.push(lte(projectTimeEntries.workDate, filters.endDate));
  if (filters?.projectId) conditions.push(eq(projectTimeEntries.projectId, filters.projectId));

  // Run all independent report queries in parallel
  const [totalsResult, byProject, byUser, byDay] = await Promise.all([
    // Total minutes
    db.select({
      totalMinutes: sql<number>`COALESCE(SUM(${projectTimeEntries.durationMinutes}), 0)`.as('total_minutes'),
      billableMinutes: sql<number>`COALESCE(SUM(CASE WHEN ${projectTimeEntries.billable} THEN ${projectTimeEntries.durationMinutes} ELSE 0 END), 0)`.as('billable_minutes'),
      nonBillableMinutes: sql<number>`COALESCE(SUM(CASE WHEN NOT ${projectTimeEntries.billable} THEN ${projectTimeEntries.durationMinutes} ELSE 0 END), 0)`.as('non_billable_minutes'),
    })
    .from(projectTimeEntries)
    .where(and(...conditions)),

    // By project
    db.select({
      projectId: projectTimeEntries.projectId,
      projectName: projectProjects.name,
      minutes: sql<number>`COALESCE(SUM(${projectTimeEntries.durationMinutes}), 0)`.as('minutes'),
      billableMinutes: sql<number>`COALESCE(SUM(CASE WHEN ${projectTimeEntries.billable} THEN ${projectTimeEntries.durationMinutes} ELSE 0 END), 0)`.as('billable_minutes'),
    })
    .from(projectTimeEntries)
    .innerJoin(projectProjects, eq(projectTimeEntries.projectId, projectProjects.id))
    .where(and(...conditions))
    .groupBy(projectTimeEntries.projectId, projectProjects.name),

    // By user
    db.select({
      userId: projectTimeEntries.userId,
      userName: users.name,
      minutes: sql<number>`COALESCE(SUM(${projectTimeEntries.durationMinutes}), 0)`.as('minutes'),
      billableMinutes: sql<number>`COALESCE(SUM(CASE WHEN ${projectTimeEntries.billable} THEN ${projectTimeEntries.durationMinutes} ELSE 0 END), 0)`.as('billable_minutes'),
    })
    .from(projectTimeEntries)
    .innerJoin(users, eq(projectTimeEntries.userId, users.id))
    .where(and(...conditions))
    .groupBy(projectTimeEntries.userId, users.name),

    // By day
    db.select({
      date: projectTimeEntries.workDate,
      minutes: sql<number>`COALESCE(SUM(${projectTimeEntries.durationMinutes}), 0)`.as('minutes'),
    })
    .from(projectTimeEntries)
    .where(and(...conditions))
    .groupBy(projectTimeEntries.workDate)
    .orderBy(asc(projectTimeEntries.workDate)),
  ]);

  const totals = totalsResult[0];

  return {
    totalMinutes: Number(totals?.totalMinutes ?? 0),
    billableMinutes: Number(totals?.billableMinutes ?? 0),
    nonBillableMinutes: Number(totals?.nonBillableMinutes ?? 0),
    byProject,
    byUser,
    byDay,
  };
}

export async function getRevenueReport(userId: string, accountId: string, filters?: {
  startDate?: string;
  endDate?: string;
}) {
  const conditions = [
    eq(projectInvoices.accountId, accountId),
    eq(projectInvoices.isArchived, false),
  ];
  if (filters?.startDate) conditions.push(gte(projectInvoices.issueDate, new Date(filters.startDate)));
  if (filters?.endDate) conditions.push(lte(projectInvoices.issueDate, new Date(filters.endDate)));

  // Run all independent report queries in parallel
  const [totalsResult, byMonth, byClient] = await Promise.all([
    // Totals
    db.select({
      totalInvoiced: sql<number>`COALESCE(SUM(${projectInvoices.amount}), 0)`.as('total_invoiced'),
      totalPaid: sql<number>`COALESCE(SUM(CASE WHEN ${projectInvoices.status} = 'paid' THEN ${projectInvoices.amount} ELSE 0 END), 0)`.as('total_paid'),
      totalOutstanding: sql<number>`COALESCE(SUM(CASE WHEN ${projectInvoices.status} IN ('sent', 'viewed', 'overdue') THEN ${projectInvoices.amount} ELSE 0 END), 0)`.as('total_outstanding'),
    })
    .from(projectInvoices)
    .where(and(...conditions)),

    // By month
    db.select({
      month: sql<string>`TO_CHAR(${projectInvoices.issueDate}, 'YYYY-MM')`.as('month'),
      invoiced: sql<number>`COALESCE(SUM(${projectInvoices.amount}), 0)`.as('invoiced'),
      paid: sql<number>`COALESCE(SUM(CASE WHEN ${projectInvoices.status} = 'paid' THEN ${projectInvoices.amount} ELSE 0 END), 0)`.as('paid'),
    })
    .from(projectInvoices)
    .where(and(...conditions, sql`${projectInvoices.issueDate} IS NOT NULL`))
    .groupBy(sql`TO_CHAR(${projectInvoices.issueDate}, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${projectInvoices.issueDate}, 'YYYY-MM')`),

    // By client
    db.select({
      clientId: projectInvoices.clientId,
      clientName: projectClients.name,
      invoiced: sql<number>`COALESCE(SUM(${projectInvoices.amount}), 0)`.as('invoiced'),
      paid: sql<number>`COALESCE(SUM(CASE WHEN ${projectInvoices.status} = 'paid' THEN ${projectInvoices.amount} ELSE 0 END), 0)`.as('paid'),
    })
    .from(projectInvoices)
    .leftJoin(projectClients, eq(projectInvoices.clientId, projectClients.id))
    .where(and(...conditions))
    .groupBy(projectInvoices.clientId, projectClients.name),
  ]);

  const totals = totalsResult[0];

  return {
    totalInvoiced: Number(totals?.totalInvoiced ?? 0),
    totalPaid: Number(totals?.totalPaid ?? 0),
    totalOutstanding: Number(totals?.totalOutstanding ?? 0),
    byMonth,
    byClient,
  };
}

export async function getProjectProfitability(userId: string, accountId: string) {
  const projects = await db
    .select({
      projectId: projectProjects.id,
      projectName: projectProjects.name,
      estimatedAmount: projectProjects.estimatedAmount,
      totalMinutes: sql<number>`COALESCE((SELECT SUM(duration_minutes) FROM project_time_entries WHERE project_id = ${projectProjects.id} AND is_archived = false), 0)`.as('total_minutes'),
      billableMinutes: sql<number>`COALESCE((SELECT SUM(duration_minutes) FROM project_time_entries WHERE project_id = ${projectProjects.id} AND is_archived = false AND billable = true), 0)`.as('billable_minutes'),
      billedAmount: sql<number>`COALESCE((SELECT SUM(pli.amount) FROM project_invoice_line_items pli INNER JOIN project_time_entries pte ON pte.id = pli.time_entry_id WHERE pte.project_id = ${projectProjects.id}), 0)`.as('billed_amount'),
      paidAmount: sql<number>`COALESCE((SELECT SUM(pi.amount) FROM project_invoices pi WHERE pi.status = 'paid' AND pi.is_archived = false AND pi.client_id = ${projectProjects.clientId}), 0)`.as('paid_amount'),
    })
    .from(projectProjects)
    .where(and(
      eq(projectProjects.accountId, accountId),
      eq(projectProjects.isArchived, false),
    ))
    .orderBy(asc(projectProjects.name));

  return projects.map(p => ({
    projectId: p.projectId,
    projectName: p.projectName,
    totalHours: Number(p.totalMinutes) / 60,
    billableHours: Number(p.billableMinutes) / 60,
    estimatedAmount: Number(p.estimatedAmount ?? 0),
    billedAmount: Number(p.billedAmount),
    paidAmount: Number(p.paidAmount),
  }));
}

export async function getTeamUtilization(userId: string, accountId: string, filters?: {
  startDate?: string;
  endDate?: string;
}) {
  const conditions = [
    eq(projectTimeEntries.accountId, accountId),
    eq(projectTimeEntries.isArchived, false),
  ];
  if (filters?.startDate) conditions.push(gte(projectTimeEntries.workDate, filters.startDate));
  if (filters?.endDate) conditions.push(lte(projectTimeEntries.workDate, filters.endDate));

  const utilization = await db
    .select({
      userId: projectTimeEntries.userId,
      userName: users.name,
      totalMinutes: sql<number>`COALESCE(SUM(${projectTimeEntries.durationMinutes}), 0)`.as('total_minutes'),
      billableMinutes: sql<number>`COALESCE(SUM(CASE WHEN ${projectTimeEntries.billable} THEN ${projectTimeEntries.durationMinutes} ELSE 0 END), 0)`.as('billable_minutes'),
    })
    .from(projectTimeEntries)
    .innerJoin(users, eq(projectTimeEntries.userId, users.id))
    .where(and(...conditions))
    .groupBy(projectTimeEntries.userId, users.name);

  return utilization.map(u => ({
    userId: u.userId,
    userName: u.userName,
    totalMinutes: Number(u.totalMinutes),
    billableMinutes: Number(u.billableMinutes),
    utilizationRate: Number(u.totalMinutes) > 0
      ? Number(u.billableMinutes) / Number(u.totalMinutes)
      : 0,
  }));
}

// ─── Settings ───────────────────────────────────────────────────────

export async function getSettings(accountId: string) {
  const [settings] = await db
    .select()
    .from(projectSettings)
    .where(eq(projectSettings.accountId, accountId))
    .limit(1);

  return settings || null;
}

export async function updateSettings(accountId: string, input: {
  invoicePrefix?: string;
  defaultHourlyRate?: number;
  companyName?: string | null;
  companyAddress?: string | null;
  companyLogo?: string | null;
  nextInvoiceNumber?: number;
}) {
  const now = new Date();

  // Upsert
  let [existing] = await db
    .select()
    .from(projectSettings)
    .where(eq(projectSettings.accountId, accountId))
    .limit(1);

  if (!existing) {
    const [created] = await db
      .insert(projectSettings)
      .values({
        accountId,
        ...input,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return created;
  }

  const updates: Record<string, unknown> = { updatedAt: now };
  if (input.invoicePrefix !== undefined) updates.invoicePrefix = input.invoicePrefix;
  if (input.defaultHourlyRate !== undefined) updates.defaultHourlyRate = input.defaultHourlyRate;
  if (input.companyName !== undefined) updates.companyName = input.companyName;
  if (input.companyAddress !== undefined) updates.companyAddress = input.companyAddress;
  if (input.companyLogo !== undefined) updates.companyLogo = input.companyLogo;
  if (input.nextInvoiceNumber !== undefined) updates.nextInvoiceNumber = input.nextInvoiceNumber;

  const [updated] = await db
    .update(projectSettings)
    .set(updates)
    .where(eq(projectSettings.accountId, accountId))
    .returning();

  return updated ?? null;
}

// ─── Portal (public, token-based) ───────────────────────────────────

export async function getClientByPortalToken(portalToken: string) {
  const [client] = await db
    .select({
      id: projectClients.id,
      accountId: projectClients.accountId,
      name: projectClients.name,
      email: projectClients.email,
      currency: projectClients.currency,
    })
    .from(projectClients)
    .where(and(
      eq(projectClients.portalToken, portalToken),
      eq(projectClients.isArchived, false),
    ))
    .limit(1);

  return client || null;
}

export async function listClientInvoices(portalToken: string) {
  const client = await getClientByPortalToken(portalToken);
  if (!client) return null;

  return db
    .select({
      id: projectInvoices.id,
      invoiceNumber: projectInvoices.invoiceNumber,
      status: projectInvoices.status,
      amount: projectInvoices.amount,
      currency: projectInvoices.currency,
      issueDate: projectInvoices.issueDate,
      dueDate: projectInvoices.dueDate,
      paidAt: projectInvoices.paidAt,
    })
    .from(projectInvoices)
    .where(and(
      eq(projectInvoices.clientId, client.id),
      eq(projectInvoices.isArchived, false),
      sql`${projectInvoices.status} != 'draft'`,
    ))
    .orderBy(desc(projectInvoices.createdAt));
}

export async function getClientInvoiceDetail(portalToken: string, invoiceId: string) {
  const client = await getClientByPortalToken(portalToken);
  if (!client) return null;

  const [invoice] = await db
    .select()
    .from(projectInvoices)
    .where(and(
      eq(projectInvoices.id, invoiceId),
      eq(projectInvoices.clientId, client.id),
      eq(projectInvoices.isArchived, false),
      sql`${projectInvoices.status} != 'draft'`,
    ))
    .limit(1);

  if (!invoice) return null;

  // Mark as viewed
  await markInvoiceViewed(client.accountId, invoiceId);

  const lineItems = await db
    .select()
    .from(projectInvoiceLineItems)
    .where(eq(projectInvoiceLineItems.invoiceId, invoiceId))
    .orderBy(asc(projectInvoiceLineItems.createdAt));

  // Get company settings for header
  const settings = await getSettings(client.accountId);

  return {
    invoice: { ...invoice, clientName: client.name },
    lineItems,
    company: settings ? {
      name: settings.companyName,
      address: settings.companyAddress,
      logo: settings.companyLogo,
    } : null,
  };
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

export async function previewTimeEntryLineItems(
  accountId: string,
  clientId: string,
  startDate: string,
  endDate: string,
) {
  // Find all client's projects
  const clientProjects = await db
    .select({ id: projectProjects.id })
    .from(projectProjects)
    .where(and(
      eq(projectProjects.clientId, clientId),
      eq(projectProjects.accountId, accountId),
    ));

  const projectIds = clientProjects.map(p => p.id);
  if (projectIds.length === 0) return [];

  // Find unbilled billable time entries in date range
  const entries = await db
    .select({
      id: projectTimeEntries.id,
      durationMinutes: projectTimeEntries.durationMinutes,
      taskDescription: projectTimeEntries.taskDescription,
      notes: projectTimeEntries.notes,
      workDate: projectTimeEntries.workDate,
      userId: projectTimeEntries.userId,
      projectId: projectTimeEntries.projectId,
    })
    .from(projectTimeEntries)
    .where(and(
      eq(projectTimeEntries.accountId, accountId),
      eq(projectTimeEntries.billable, true),
      eq(projectTimeEntries.billed, false),
      eq(projectTimeEntries.isArchived, false),
      inArray(projectTimeEntries.projectId, projectIds),
      gte(projectTimeEntries.workDate, startDate),
      lte(projectTimeEntries.workDate, endDate),
    ));

  // Batch: collect all unique (projectId, userId) pairs for member rate lookup
  const memberKeys = new Set<string>();
  for (const entry of entries) {
    memberKeys.add(`${entry.projectId}:${entry.userId}`);
  }
  const uniquePairs = [...memberKeys].map(k => { const [p, u] = k.split(':'); return { projectId: p, userId: u }; });

  // Batch-query all relevant project members in one query
  const allMembers = uniquePairs.length > 0
    ? await db
        .select({
          projectId: projectMembers.projectId,
          userId: projectMembers.userId,
          hourlyRate: projectMembers.hourlyRate,
        })
        .from(projectMembers)
        .where(sql`(${projectMembers.projectId}, ${projectMembers.userId}) IN (${sql.raw(
          uniquePairs.map(p => `('${p.projectId}', '${p.userId}')`).join(', ')
        )})`)
    : [];

  // Build O(1) lookup map
  const memberRateMap = new Map<string, number | null>();
  for (const m of allMembers) {
    memberRateMap.set(`${m.projectId}:${m.userId}`, m.hourlyRate);
  }

  // Load settings once for default rate fallback
  const settings = await getSettings(accountId);
  const defaultRate = settings?.defaultHourlyRate ?? 0;

  const lineItems = entries.map(entry => {
    const rate = memberRateMap.get(`${entry.projectId}:${entry.userId}`) ?? defaultRate;
    const hours = entry.durationMinutes / 60;
    const description = entry.taskDescription || entry.notes || `Time entry ${entry.workDate}`;
    return { description, quantity: hours, unitPrice: rate };
  });

  return lineItems;
}

export async function waiveInvoice(userId: string, accountId: string, id: string) {
  const [invoice] = await db
    .update(projectInvoices)
    .set({ status: 'waived', updatedAt: new Date() })
    .where(and(
      eq(projectInvoices.id, id),
      eq(projectInvoices.accountId, accountId),
      eq(projectInvoices.isArchived, false),
    ))
    .returning();

  return invoice || null;
}

// ─── Widget ─────────────────────────────────────────────────────────

export async function getWidgetData(accountId: string) {
  const now = new Date();
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  const diff = day === 0 ? 6 : day - 1; // Monday
  weekStart.setDate(weekStart.getDate() - diff);
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  // Run all independent widget queries in parallel
  const [projectCountResult, weekHoursResult, pendingInvoiceResult, overdueCountResult] = await Promise.all([
    // Active projects count
    db.select({ count: sql<number>`COUNT(*)`.as('count') })
      .from(projectProjects)
      .where(and(
        eq(projectProjects.accountId, accountId),
        eq(projectProjects.isArchived, false),
        eq(projectProjects.status, 'active'),
      )),

    // Total tracked hours this week
    db.select({
      totalMinutes: sql<number>`COALESCE(SUM(${projectTimeEntries.durationMinutes}), 0)`.as('total_minutes'),
    })
      .from(projectTimeEntries)
      .where(and(
        eq(projectTimeEntries.accountId, accountId),
        eq(projectTimeEntries.isArchived, false),
        gte(projectTimeEntries.workDate, weekStartStr),
        lte(projectTimeEntries.workDate, todayStr),
      )),

    // Pending invoice amount (sent + viewed + overdue)
    db.select({
      amount: sql<number>`COALESCE(SUM(${projectInvoices.amount}), 0)`.as('amount'),
    })
      .from(projectInvoices)
      .where(and(
        eq(projectInvoices.accountId, accountId),
        eq(projectInvoices.isArchived, false),
        sql`${projectInvoices.status} IN ('sent', 'viewed', 'overdue')`,
      )),

    // Overdue invoice count
    db.select({ count: sql<number>`COUNT(*)`.as('count') })
      .from(projectInvoices)
      .where(and(
        eq(projectInvoices.accountId, accountId),
        eq(projectInvoices.isArchived, false),
        eq(projectInvoices.status, 'overdue'),
      )),
  ]);

  const projectCount = projectCountResult[0];
  const weekHours = weekHoursResult[0];
  const pendingInvoice = pendingInvoiceResult[0];
  const overdueCount = overdueCountResult[0];

  return {
    activeProjects: Number(projectCount?.count ?? 0),
    totalTrackedHoursThisWeek: Number(weekHours?.totalMinutes ?? 0) / 60,
    pendingInvoiceAmount: Number(pendingInvoice?.amount ?? 0),
    overdueInvoiceCount: Number(overdueCount?.count ?? 0),
  };
}

// ─── Enhanced Dashboard ─────────────────────────────────────────────

export async function getDashboardData(userId: string, accountId: string) {
  const now = new Date();
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  const diff = day === 0 ? 6 : day - 1;
  weekStart.setDate(weekStart.getDate() - diff);
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  const [
    projectCountResult,
    weekHoursResult,
    pendingInvoiceResult,
    overdueResult,
    revenueResult,
    hoursByDayResult,
    recentTimeEntries,
    recentInvoiceActions,
  ] = await Promise.all([
    // Active projects count
    db.select({ count: sql<number>`COUNT(*)`.as('count') })
      .from(projectProjects)
      .where(and(
        eq(projectProjects.accountId, accountId),
        eq(projectProjects.isArchived, false),
        eq(projectProjects.status, 'active'),
      )),

    // Total tracked hours this week
    db.select({
      totalMinutes: sql<number>`COALESCE(SUM(${projectTimeEntries.durationMinutes}), 0)`.as('total_minutes'),
    })
      .from(projectTimeEntries)
      .where(and(
        eq(projectTimeEntries.accountId, accountId),
        eq(projectTimeEntries.isArchived, false),
        gte(projectTimeEntries.workDate, weekStartStr),
        lte(projectTimeEntries.workDate, todayStr),
      )),

    // Pending invoice amount (sent + viewed + overdue)
    db.select({
      count: sql<number>`COUNT(*)`.as('count'),
      amount: sql<number>`COALESCE(SUM(${projectInvoices.amount}), 0)`.as('amount'),
    })
      .from(projectInvoices)
      .where(and(
        eq(projectInvoices.accountId, accountId),
        eq(projectInvoices.isArchived, false),
        sql`${projectInvoices.status} IN ('sent', 'viewed', 'overdue')`,
      )),

    // Overdue invoice count + amount
    db.select({
      count: sql<number>`COUNT(*)`.as('count'),
      amount: sql<number>`COALESCE(SUM(${projectInvoices.amount}), 0)`.as('amount'),
    })
      .from(projectInvoices)
      .where(and(
        eq(projectInvoices.accountId, accountId),
        eq(projectInvoices.isArchived, false),
        eq(projectInvoices.status, 'overdue'),
      )),

    // Revenue breakdown: invoiced, paid, outstanding
    db.select({
      invoiced: sql<number>`COALESCE(SUM(${projectInvoices.amount}), 0)`.as('invoiced'),
      paid: sql<number>`COALESCE(SUM(CASE WHEN ${projectInvoices.status} = 'paid' THEN ${projectInvoices.amount} ELSE 0 END), 0)`.as('paid'),
      outstanding: sql<number>`COALESCE(SUM(CASE WHEN ${projectInvoices.status} IN ('sent', 'viewed', 'overdue') THEN ${projectInvoices.amount} ELSE 0 END), 0)`.as('outstanding'),
    })
      .from(projectInvoices)
      .where(and(
        eq(projectInvoices.accountId, accountId),
        eq(projectInvoices.isArchived, false),
      )),

    // Hours by day this week (Mon-Sun)
    db.select({
      date: projectTimeEntries.workDate,
      minutes: sql<number>`COALESCE(SUM(${projectTimeEntries.durationMinutes}), 0)`.as('minutes'),
    })
      .from(projectTimeEntries)
      .where(and(
        eq(projectTimeEntries.accountId, accountId),
        eq(projectTimeEntries.isArchived, false),
        gte(projectTimeEntries.workDate, weekStartStr),
        lte(projectTimeEntries.workDate, weekEndStr),
      ))
      .groupBy(projectTimeEntries.workDate)
      .orderBy(asc(projectTimeEntries.workDate)),

    // Recent time entries (last 5)
    db.select({
      id: projectTimeEntries.id,
      projectName: projectProjects.name,
      projectColor: projectProjects.color,
      durationMinutes: projectTimeEntries.durationMinutes,
      workDate: projectTimeEntries.workDate,
      taskDescription: projectTimeEntries.taskDescription,
      notes: projectTimeEntries.notes,
      createdAt: projectTimeEntries.createdAt,
    })
      .from(projectTimeEntries)
      .innerJoin(projectProjects, eq(projectTimeEntries.projectId, projectProjects.id))
      .where(and(
        eq(projectTimeEntries.accountId, accountId),
        eq(projectTimeEntries.isArchived, false),
      ))
      .orderBy(desc(projectTimeEntries.createdAt))
      .limit(5),

    // Recent invoice actions (last 5 non-draft invoices)
    db.select({
      id: projectInvoices.id,
      invoiceNumber: projectInvoices.invoiceNumber,
      clientName: projectClients.name,
      status: projectInvoices.status,
      amount: projectInvoices.amount,
      updatedAt: projectInvoices.updatedAt,
    })
      .from(projectInvoices)
      .leftJoin(projectClients, eq(projectInvoices.clientId, projectClients.id))
      .where(and(
        eq(projectInvoices.accountId, accountId),
        eq(projectInvoices.isArchived, false),
      ))
      .orderBy(desc(projectInvoices.updatedAt))
      .limit(5),
  ]);

  const projectCount = projectCountResult[0];
  const weekHours = weekHoursResult[0];
  const pendingInvoice = pendingInvoiceResult[0];
  const overdue = overdueResult[0];
  const revenue = revenueResult[0];

  // Build hours by day array (Mon-Sun)
  const dayMap = new Map<string, number>();
  for (const row of hoursByDayResult) {
    dayMap.set(String(row.date), Number(row.minutes) / 60);
  }
  const hoursByDay: Array<{ date: string; hours: number }> = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    hoursByDay.push({ date: dateStr, hours: dayMap.get(dateStr) ?? 0 });
  }

  return {
    hoursThisWeek: Number(weekHours?.totalMinutes ?? 0) / 60,
    activeProjects: Number(projectCount?.count ?? 0),
    outstandingInvoices: Number(pendingInvoice?.count ?? 0),
    totalOutstandingAmount: Number(pendingInvoice?.amount ?? 0),
    overdueInvoices: Number(overdue?.count ?? 0),
    totalOverdueAmount: Number(overdue?.amount ?? 0),
    revenue: {
      invoiced: Number(revenue?.invoiced ?? 0),
      paid: Number(revenue?.paid ?? 0),
      outstanding: Number(revenue?.outstanding ?? 0),
    },
    hoursByDay,
    recentTimeEntries: recentTimeEntries.map(e => ({
      id: e.id,
      projectName: e.projectName,
      projectColor: e.projectColor,
      hours: Number(e.durationMinutes) / 60,
      date: e.workDate,
      description: e.taskDescription || e.notes || null,
      createdAt: e.createdAt,
    })),
    recentInvoiceActions: recentInvoiceActions.map(i => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      clientName: i.clientName,
      status: i.status,
      amount: Number(i.amount),
      updatedAt: i.updatedAt,
    })),
  };
}

// ─── Seed Sample Data ───────────────────────────────────────────────

export async function seedSampleData(userId: string, accountId: string) {
  return { skipped: true };
}
