import { db } from '../../config/database';
import { crmCompanies, crmContacts, crmDealStages, crmDeals, crmActivities, crmActivityTypes, crmWorkflows, crmLeads, crmNotes, crmSavedViews, crmLeadForms, users } from '../../db/schema';
import { tasks as tasksTable } from '../../db/schema';
import { eq, and, or, asc, desc, sql, gte, lte, isNull } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import crypto from 'crypto';
import type { CrmRecordAccess } from '@atlasmail/shared';

// ─── Input types ────────────────────────────────────────────────────

interface CreateCompanyInput {
  name: string;
  domain?: string | null;
  industry?: string | null;
  size?: string | null;
  address?: string | null;
  phone?: string | null;
  tags?: string[];
}

interface UpdateCompanyInput extends Partial<CreateCompanyInput> {
  sortOrder?: number;
  isArchived?: boolean;
}

interface CreateContactInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  companyId?: string | null;
  position?: string | null;
  source?: string | null;
  tags?: string[];
}

interface UpdateContactInput extends Partial<CreateContactInput> {
  sortOrder?: number;
  isArchived?: boolean;
}

interface CreateDealStageInput {
  name: string;
  color?: string;
  probability?: number;
  sequence?: number;
  isDefault?: boolean;
}

interface UpdateDealStageInput extends Partial<CreateDealStageInput> {
  rottingDays?: number | null;
}

interface CreateDealInput {
  title: string;
  value: number;
  stageId: string;
  contactId?: string | null;
  companyId?: string | null;
  assignedUserId?: string | null;
  probability?: number;
  expectedCloseDate?: string | null;
  tags?: string[];
}

interface UpdateDealInput extends Partial<CreateDealInput> {
  sortOrder?: number;
  isArchived?: boolean;
}

interface CreateActivityInput {
  type: string;
  body: string;
  dealId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  assignedUserId?: string | null;
  scheduledAt?: string | null;
}

interface UpdateActivityInput extends Partial<CreateActivityInput> {
  completedAt?: string | null;
  isArchived?: boolean;
}

// ─── Companies ──────────────────────────────────────────────────────

export async function listCompanies(userId: string, accountId: string, filters?: {
  search?: string;
  industry?: string;
  includeArchived?: boolean;
  recordAccess?: CrmRecordAccess;
}) {
  const conditions = [eq(crmCompanies.accountId, accountId)];
  if (!filters?.recordAccess || filters.recordAccess === 'own') {
    conditions.push(eq(crmCompanies.userId, userId));
  }

  if (!filters?.includeArchived) {
    conditions.push(eq(crmCompanies.isArchived, false));
  }
  if (filters?.industry) {
    conditions.push(eq(crmCompanies.industry, filters.industry));
  }

  let query = db
    .select({
      id: crmCompanies.id,
      accountId: crmCompanies.accountId,
      userId: crmCompanies.userId,
      name: crmCompanies.name,
      domain: crmCompanies.domain,
      industry: crmCompanies.industry,
      size: crmCompanies.size,
      address: crmCompanies.address,
      phone: crmCompanies.phone,
      tags: crmCompanies.tags,
      isArchived: crmCompanies.isArchived,
      sortOrder: crmCompanies.sortOrder,
      createdAt: crmCompanies.createdAt,
      updatedAt: crmCompanies.updatedAt,
      contactCount: sql<number>`(SELECT COUNT(*) FROM crm_contacts WHERE company_id = ${crmCompanies.id} AND is_archived = false)`.as('contact_count'),
      dealCount: sql<number>`(SELECT COUNT(*) FROM crm_deals WHERE company_id = ${crmCompanies.id} AND is_archived = false)`.as('deal_count'),
    })
    .from(crmCompanies)
    .where(and(...conditions))
    .orderBy(asc(crmCompanies.sortOrder), asc(crmCompanies.createdAt))
    .$dynamic();

  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(sql`(${crmCompanies.name} ILIKE ${searchTerm} OR ${crmCompanies.domain} ILIKE ${searchTerm})`);
    query = db
      .select({
        id: crmCompanies.id,
        accountId: crmCompanies.accountId,
        userId: crmCompanies.userId,
        name: crmCompanies.name,
        domain: crmCompanies.domain,
        industry: crmCompanies.industry,
        size: crmCompanies.size,
        address: crmCompanies.address,
        phone: crmCompanies.phone,
        tags: crmCompanies.tags,
        isArchived: crmCompanies.isArchived,
        sortOrder: crmCompanies.sortOrder,
        createdAt: crmCompanies.createdAt,
        updatedAt: crmCompanies.updatedAt,
        contactCount: sql<number>`(SELECT COUNT(*) FROM crm_contacts WHERE company_id = ${crmCompanies.id} AND is_archived = false)`.as('contact_count'),
        dealCount: sql<number>`(SELECT COUNT(*) FROM crm_deals WHERE company_id = ${crmCompanies.id} AND is_archived = false)`.as('deal_count'),
      })
      .from(crmCompanies)
      .where(and(...conditions))
      .orderBy(asc(crmCompanies.sortOrder), asc(crmCompanies.createdAt))
      .$dynamic();
  }

  return query;
}

export async function getCompany(userId: string, accountId: string, id: string, recordAccess?: CrmRecordAccess) {
  const conditions = [eq(crmCompanies.id, id), eq(crmCompanies.accountId, accountId)];
  if (!recordAccess || recordAccess === 'own') {
    conditions.push(eq(crmCompanies.userId, userId));
  }

  const [company] = await db
    .select({
      id: crmCompanies.id,
      accountId: crmCompanies.accountId,
      userId: crmCompanies.userId,
      name: crmCompanies.name,
      domain: crmCompanies.domain,
      industry: crmCompanies.industry,
      size: crmCompanies.size,
      address: crmCompanies.address,
      phone: crmCompanies.phone,
      tags: crmCompanies.tags,
      isArchived: crmCompanies.isArchived,
      sortOrder: crmCompanies.sortOrder,
      createdAt: crmCompanies.createdAt,
      updatedAt: crmCompanies.updatedAt,
      contactCount: sql<number>`(SELECT COUNT(*) FROM crm_contacts WHERE company_id = ${crmCompanies.id} AND is_archived = false)`.as('contact_count'),
      dealCount: sql<number>`(SELECT COUNT(*) FROM crm_deals WHERE company_id = ${crmCompanies.id} AND is_archived = false)`.as('deal_count'),
    })
    .from(crmCompanies)
    .where(and(...conditions))
    .limit(1);

  return company || null;
}

export async function createCompany(userId: string, accountId: string, input: CreateCompanyInput) {
  const now = new Date();

  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${crmCompanies.sortOrder}), -1)` })
    .from(crmCompanies)
    .where(eq(crmCompanies.userId, userId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(crmCompanies)
    .values({
      accountId,
      userId,
      name: input.name,
      domain: input.domain ?? null,
      industry: input.industry ?? null,
      size: input.size ?? null,
      address: input.address ?? null,
      phone: input.phone ?? null,
      tags: input.tags ?? [],
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, companyId: created.id }, 'CRM company created');
  return created;
}

export async function updateCompany(userId: string, accountId: string, id: string, input: UpdateCompanyInput, recordAccess?: CrmRecordAccess) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) updates.name = input.name;
  if (input.domain !== undefined) updates.domain = input.domain;
  if (input.industry !== undefined) updates.industry = input.industry;
  if (input.size !== undefined) updates.size = input.size;
  if (input.address !== undefined) updates.address = input.address;
  if (input.phone !== undefined) updates.phone = input.phone;
  if (input.tags !== undefined) updates.tags = input.tags;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  const updateConditions = [eq(crmCompanies.id, id), eq(crmCompanies.accountId, accountId)];
  if (!recordAccess || recordAccess === 'own') {
    updateConditions.push(eq(crmCompanies.userId, userId));
  }

  await db
    .update(crmCompanies)
    .set(updates)
    .where(and(...updateConditions));

  const [updated] = await db
    .select()
    .from(crmCompanies)
    .where(and(...updateConditions))
    .limit(1);

  return updated || null;
}

export async function deleteCompany(userId: string, accountId: string, id: string, recordAccess?: CrmRecordAccess) {
  await updateCompany(userId, accountId, id, { isArchived: true }, recordAccess);
}

// ─── Contacts ───────────────────────────────────────────────────────

export async function listContacts(userId: string, accountId: string, filters?: {
  search?: string;
  companyId?: string;
  includeArchived?: boolean;
  recordAccess?: CrmRecordAccess;
}) {
  const conditions = [eq(crmContacts.accountId, accountId)];
  if (!filters?.recordAccess || filters.recordAccess === 'own') {
    conditions.push(eq(crmContacts.userId, userId));
  }

  if (!filters?.includeArchived) {
    conditions.push(eq(crmContacts.isArchived, false));
  }
  if (filters?.companyId) {
    conditions.push(eq(crmContacts.companyId, filters.companyId));
  }
  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(sql`(${crmContacts.name} ILIKE ${searchTerm} OR ${crmContacts.email} ILIKE ${searchTerm})`);
  }

  return db
    .select({
      id: crmContacts.id,
      accountId: crmContacts.accountId,
      userId: crmContacts.userId,
      name: crmContacts.name,
      email: crmContacts.email,
      phone: crmContacts.phone,
      companyId: crmContacts.companyId,
      position: crmContacts.position,
      source: crmContacts.source,
      tags: crmContacts.tags,
      isArchived: crmContacts.isArchived,
      sortOrder: crmContacts.sortOrder,
      createdAt: crmContacts.createdAt,
      updatedAt: crmContacts.updatedAt,
      companyName: crmCompanies.name,
    })
    .from(crmContacts)
    .leftJoin(crmCompanies, eq(crmContacts.companyId, crmCompanies.id))
    .where(and(...conditions))
    .orderBy(asc(crmContacts.sortOrder), asc(crmContacts.createdAt));
}

export async function getContact(userId: string, accountId: string, id: string, recordAccess?: CrmRecordAccess) {
  const conditions = [eq(crmContacts.id, id), eq(crmContacts.accountId, accountId)];
  if (!recordAccess || recordAccess === 'own') {
    conditions.push(eq(crmContacts.userId, userId));
  }

  const [contact] = await db
    .select({
      id: crmContacts.id,
      accountId: crmContacts.accountId,
      userId: crmContacts.userId,
      name: crmContacts.name,
      email: crmContacts.email,
      phone: crmContacts.phone,
      companyId: crmContacts.companyId,
      position: crmContacts.position,
      source: crmContacts.source,
      tags: crmContacts.tags,
      isArchived: crmContacts.isArchived,
      sortOrder: crmContacts.sortOrder,
      createdAt: crmContacts.createdAt,
      updatedAt: crmContacts.updatedAt,
      companyName: crmCompanies.name,
    })
    .from(crmContacts)
    .leftJoin(crmCompanies, eq(crmContacts.companyId, crmCompanies.id))
    .where(and(...conditions))
    .limit(1);

  return contact || null;
}

export async function createContact(userId: string, accountId: string, input: CreateContactInput) {
  const now = new Date();

  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${crmContacts.sortOrder}), -1)` })
    .from(crmContacts)
    .where(eq(crmContacts.userId, userId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(crmContacts)
    .values({
      accountId,
      userId,
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      companyId: input.companyId ?? null,
      position: input.position ?? null,
      source: input.source ?? null,
      tags: input.tags ?? [],
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, contactId: created.id }, 'CRM contact created');

  // Fire workflow trigger
  executeWorkflows(accountId, userId, 'contact_created', { contactId: created.id }).catch(() => {});

  return created;
}

export async function updateContact(userId: string, accountId: string, id: string, input: UpdateContactInput, recordAccess?: CrmRecordAccess) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) updates.name = input.name;
  if (input.email !== undefined) updates.email = input.email;
  if (input.phone !== undefined) updates.phone = input.phone;
  if (input.companyId !== undefined) updates.companyId = input.companyId;
  if (input.position !== undefined) updates.position = input.position;
  if (input.source !== undefined) updates.source = input.source;
  if (input.tags !== undefined) updates.tags = input.tags;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  const updateConditions = [eq(crmContacts.id, id), eq(crmContacts.accountId, accountId)];
  if (!recordAccess || recordAccess === 'own') {
    updateConditions.push(eq(crmContacts.userId, userId));
  }

  await db
    .update(crmContacts)
    .set(updates)
    .where(and(...updateConditions));

  const [updated] = await db
    .select()
    .from(crmContacts)
    .where(and(...updateConditions))
    .limit(1);

  return updated || null;
}

export async function deleteContact(userId: string, accountId: string, id: string, recordAccess?: CrmRecordAccess) {
  await updateContact(userId, accountId, id, { isArchived: true }, recordAccess);
}

// ─── Deal Stages ────────────────────────────────────────────────────

export async function listDealStages(accountId: string) {
  return db
    .select()
    .from(crmDealStages)
    .where(eq(crmDealStages.accountId, accountId))
    .orderBy(asc(crmDealStages.sequence));
}

export async function createDealStage(accountId: string, input: CreateDealStageInput) {
  const [maxSeq] = await db
    .select({ max: sql<number>`COALESCE(MAX(${crmDealStages.sequence}), -1)` })
    .from(crmDealStages)
    .where(eq(crmDealStages.accountId, accountId));

  const sequence = input.sequence ?? ((maxSeq?.max ?? -1) + 1);

  const [created] = await db
    .insert(crmDealStages)
    .values({
      accountId,
      name: input.name,
      color: input.color ?? '#6b7280',
      probability: input.probability ?? 0,
      sequence,
      isDefault: input.isDefault ?? false,
    })
    .returning();

  logger.info({ accountId, stageId: created.id }, 'CRM deal stage created');
  return created;
}

export async function updateDealStage(accountId: string, id: string, input: UpdateDealStageInput) {
  const updates: Record<string, unknown> = {};

  if (input.name !== undefined) updates.name = input.name;
  if (input.color !== undefined) updates.color = input.color;
  if (input.probability !== undefined) updates.probability = input.probability;
  if (input.sequence !== undefined) updates.sequence = input.sequence;
  if (input.isDefault !== undefined) updates.isDefault = input.isDefault;
  if (input.rottingDays !== undefined) updates.rottingDays = input.rottingDays;

  await db
    .update(crmDealStages)
    .set(updates)
    .where(and(eq(crmDealStages.id, id), eq(crmDealStages.accountId, accountId)));

  const [updated] = await db
    .select()
    .from(crmDealStages)
    .where(and(eq(crmDealStages.id, id), eq(crmDealStages.accountId, accountId)))
    .limit(1);

  return updated || null;
}

export async function deleteDealStage(accountId: string, id: string) {
  // Check if there are deals in this stage
  const [dealCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(crmDeals)
    .where(and(eq(crmDeals.stageId, id), eq(crmDeals.isArchived, false)));

  if ((dealCount?.count ?? 0) > 0) {
    throw new Error('Cannot delete a stage that has deals');
  }

  await db
    .delete(crmDealStages)
    .where(and(eq(crmDealStages.id, id), eq(crmDealStages.accountId, accountId)));
}

export async function reorderDealStages(accountId: string, stageIds: string[]) {
  for (let i = 0; i < stageIds.length; i++) {
    await db
      .update(crmDealStages)
      .set({ sequence: i })
      .where(and(eq(crmDealStages.id, stageIds[i]), eq(crmDealStages.accountId, accountId)));
  }
}

export async function seedDefaultStages(accountId: string) {
  // Idempotency guard
  const existing = await db.select({ id: crmDealStages.id }).from(crmDealStages)
    .where(eq(crmDealStages.accountId, accountId)).limit(1);
  if (existing.length > 0) return existing;

  const defaults = [
    { name: 'Lead', color: '#6b7280', probability: 10, sequence: 0, isDefault: true },
    { name: 'Qualified', color: '#3b82f6', probability: 25, sequence: 1, isDefault: false },
    { name: 'Proposal', color: '#f59e0b', probability: 50, sequence: 2, isDefault: false },
    { name: 'Negotiation', color: '#f97316', probability: 75, sequence: 3, isDefault: false },
    { name: 'Closed Won', color: '#10b981', probability: 100, sequence: 4, isDefault: false },
    { name: 'Closed Lost', color: '#ef4444', probability: 0, sequence: 5, isDefault: false },
  ];

  const stages = [];
  for (const d of defaults) {
    const stage = await createDealStage(accountId, d);
    stages.push(stage);
  }

  logger.info({ accountId }, 'Seeded default CRM deal stages');
  return stages;
}

// ─── Deals ──────────────────────────────────────────────────────────

export async function listDeals(userId: string, accountId: string, filters?: {
  stageId?: string;
  contactId?: string;
  companyId?: string;
  includeArchived?: boolean;
  recordAccess?: CrmRecordAccess;
}) {
  const conditions = [eq(crmDeals.accountId, accountId)];
  if (!filters?.recordAccess || filters.recordAccess === 'own') {
    conditions.push(eq(crmDeals.userId, userId));
  }

  if (!filters?.includeArchived) {
    conditions.push(eq(crmDeals.isArchived, false));
  }
  if (filters?.stageId) {
    conditions.push(eq(crmDeals.stageId, filters.stageId));
  }
  if (filters?.contactId) {
    conditions.push(eq(crmDeals.contactId, filters.contactId));
  }
  if (filters?.companyId) {
    conditions.push(eq(crmDeals.companyId, filters.companyId));
  }

  return db
    .select({
      id: crmDeals.id,
      accountId: crmDeals.accountId,
      userId: crmDeals.userId,
      title: crmDeals.title,
      value: crmDeals.value,
      stageId: crmDeals.stageId,
      contactId: crmDeals.contactId,
      companyId: crmDeals.companyId,
      assignedUserId: crmDeals.assignedUserId,
      probability: crmDeals.probability,
      expectedCloseDate: crmDeals.expectedCloseDate,
      wonAt: crmDeals.wonAt,
      lostAt: crmDeals.lostAt,
      lostReason: crmDeals.lostReason,
      tags: crmDeals.tags,
      stageEnteredAt: crmDeals.stageEnteredAt,
      isArchived: crmDeals.isArchived,
      sortOrder: crmDeals.sortOrder,
      createdAt: crmDeals.createdAt,
      updatedAt: crmDeals.updatedAt,
      stageName: crmDealStages.name,
      stageColor: crmDealStages.color,
      stageRottingDays: crmDealStages.rottingDays,
      contactName: crmContacts.name,
      companyName: crmCompanies.name,
    })
    .from(crmDeals)
    .leftJoin(crmDealStages, eq(crmDeals.stageId, crmDealStages.id))
    .leftJoin(crmContacts, eq(crmDeals.contactId, crmContacts.id))
    .leftJoin(crmCompanies, eq(crmDeals.companyId, crmCompanies.id))
    .where(and(...conditions))
    .orderBy(asc(crmDeals.sortOrder), asc(crmDeals.createdAt));
}

export async function getDeal(userId: string, accountId: string, id: string, recordAccess?: CrmRecordAccess) {
  const conditions = [eq(crmDeals.id, id), eq(crmDeals.accountId, accountId)];
  if (!recordAccess || recordAccess === 'own') {
    conditions.push(eq(crmDeals.userId, userId));
  }

  const [deal] = await db
    .select({
      id: crmDeals.id,
      accountId: crmDeals.accountId,
      userId: crmDeals.userId,
      title: crmDeals.title,
      value: crmDeals.value,
      stageId: crmDeals.stageId,
      contactId: crmDeals.contactId,
      companyId: crmDeals.companyId,
      assignedUserId: crmDeals.assignedUserId,
      probability: crmDeals.probability,
      expectedCloseDate: crmDeals.expectedCloseDate,
      wonAt: crmDeals.wonAt,
      lostAt: crmDeals.lostAt,
      lostReason: crmDeals.lostReason,
      tags: crmDeals.tags,
      isArchived: crmDeals.isArchived,
      sortOrder: crmDeals.sortOrder,
      createdAt: crmDeals.createdAt,
      updatedAt: crmDeals.updatedAt,
      stageName: crmDealStages.name,
      stageColor: crmDealStages.color,
      contactName: crmContacts.name,
      companyName: crmCompanies.name,
    })
    .from(crmDeals)
    .leftJoin(crmDealStages, eq(crmDeals.stageId, crmDealStages.id))
    .leftJoin(crmContacts, eq(crmDeals.contactId, crmContacts.id))
    .leftJoin(crmCompanies, eq(crmDeals.companyId, crmCompanies.id))
    .where(and(...conditions))
    .limit(1);

  return deal || null;
}

export async function createDeal(userId: string, accountId: string, input: CreateDealInput) {
  const now = new Date();

  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${crmDeals.sortOrder}), -1)` })
    .from(crmDeals)
    .where(eq(crmDeals.userId, userId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(crmDeals)
    .values({
      accountId,
      userId,
      title: input.title,
      value: input.value,
      stageId: input.stageId,
      contactId: input.contactId ?? null,
      companyId: input.companyId ?? null,
      assignedUserId: input.assignedUserId ?? null,
      probability: input.probability ?? 0,
      expectedCloseDate: input.expectedCloseDate ? new Date(input.expectedCloseDate) : null,
      tags: input.tags ?? [],
      stageEnteredAt: now,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, dealId: created.id }, 'CRM deal created');

  // Fire workflow trigger
  executeWorkflows(accountId, userId, 'deal_created', { dealId: created.id }).catch(() => {});

  return created;
}

export async function updateDeal(userId: string, accountId: string, id: string, input: UpdateDealInput, recordAccess?: CrmRecordAccess) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  const updateConditions = [eq(crmDeals.id, id), eq(crmDeals.accountId, accountId)];
  if (!recordAccess || recordAccess === 'own') {
    updateConditions.push(eq(crmDeals.userId, userId));
  }

  // Capture old stage for workflow trigger
  let oldStageId: string | null = null;
  if (input.stageId !== undefined) {
    const [existing] = await db.select({ stageId: crmDeals.stageId }).from(crmDeals)
      .where(and(...updateConditions)).limit(1);
    if (existing) oldStageId = existing.stageId;
  }

  if (input.title !== undefined) updates.title = input.title;
  if (input.value !== undefined) updates.value = input.value;
  if (input.stageId !== undefined) {
    updates.stageId = input.stageId;
    // Track when deal enters a new stage (for rotting detection)
    if (oldStageId && oldStageId !== input.stageId) {
      updates.stageEnteredAt = now;
    }
  }
  if (input.contactId !== undefined) updates.contactId = input.contactId;
  if (input.companyId !== undefined) updates.companyId = input.companyId;
  if (input.assignedUserId !== undefined) updates.assignedUserId = input.assignedUserId;
  if (input.probability !== undefined) updates.probability = input.probability;
  if (input.expectedCloseDate !== undefined) updates.expectedCloseDate = input.expectedCloseDate ? new Date(input.expectedCloseDate) : null;
  if (input.tags !== undefined) updates.tags = input.tags;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  await db
    .update(crmDeals)
    .set(updates)
    .where(and(...updateConditions));

  // Fire workflow trigger + log activity if stage changed
  if (input.stageId !== undefined && oldStageId && oldStageId !== input.stageId) {
    executeWorkflows(accountId, userId, 'deal_stage_changed', {
      dealId: id, fromStage: oldStageId, toStage: input.stageId,
    }).catch(() => {});

    // Auto-log stage change activity
    const [oldStage, newStage] = await Promise.all([
      db.select({ name: crmDealStages.name }).from(crmDealStages).where(eq(crmDealStages.id, oldStageId)).limit(1),
      db.select({ name: crmDealStages.name }).from(crmDealStages).where(eq(crmDealStages.id, input.stageId)).limit(1),
    ]);
    const fromName = oldStage[0]?.name ?? 'Unknown';
    const toName = newStage[0]?.name ?? 'Unknown';
    createActivity(userId, accountId, {
      type: 'stage_change',
      body: `Stage changed from ${fromName} to ${toName}`,
      dealId: id,
    }).catch(() => {});
  }

  return getDeal(userId, accountId, id, recordAccess);
}

export async function deleteDeal(userId: string, accountId: string, id: string, recordAccess?: CrmRecordAccess) {
  await updateDeal(userId, accountId, id, { isArchived: true }, recordAccess);
}

export async function markDealWon(userId: string, accountId: string, id: string, recordAccess?: CrmRecordAccess) {
  const now = new Date();
  const conditions = [eq(crmDeals.id, id), eq(crmDeals.accountId, accountId)];
  if (!recordAccess || recordAccess === 'own') {
    conditions.push(eq(crmDeals.userId, userId));
  }
  await db
    .update(crmDeals)
    .set({ wonAt: now, lostAt: null, lostReason: null, probability: 100, updatedAt: now })
    .where(and(...conditions));

  // Fire workflow trigger + log activity
  executeWorkflows(accountId, userId, 'deal_won', { dealId: id }).catch(() => {});
  createActivity(userId, accountId, { type: 'deal_won', body: 'Deal marked as won', dealId: id }).catch(() => {});

  return getDeal(userId, accountId, id, recordAccess);
}

export async function markDealLost(userId: string, accountId: string, id: string, reason?: string, recordAccess?: CrmRecordAccess) {
  const now = new Date();
  const conditions = [eq(crmDeals.id, id), eq(crmDeals.accountId, accountId)];
  if (!recordAccess || recordAccess === 'own') {
    conditions.push(eq(crmDeals.userId, userId));
  }
  await db
    .update(crmDeals)
    .set({ lostAt: now, wonAt: null, lostReason: reason ?? null, probability: 0, updatedAt: now })
    .where(and(...conditions));

  // Fire workflow trigger + log activity
  executeWorkflows(accountId, userId, 'deal_lost', { dealId: id }).catch(() => {});
  createActivity(userId, accountId, { type: 'deal_lost', body: reason ? `Deal lost: ${reason}` : 'Deal marked as lost', dealId: id }).catch(() => {});

  return getDeal(userId, accountId, id, recordAccess);
}

export async function countsByStage(userId: string, accountId: string, recordAccess?: CrmRecordAccess) {
  const conditions = [eq(crmDeals.accountId, accountId), eq(crmDeals.isArchived, false)];
  if (!recordAccess || recordAccess === 'own') {
    conditions.push(eq(crmDeals.userId, userId));
  }
  return db
    .select({
      stageId: crmDeals.stageId,
      stageName: crmDealStages.name,
      stageColor: crmDealStages.color,
      count: sql<number>`COUNT(*)`.as('count'),
      totalValue: sql<number>`SUM(${crmDeals.value})`.as('total_value'),
    })
    .from(crmDeals)
    .leftJoin(crmDealStages, eq(crmDeals.stageId, crmDealStages.id))
    .where(and(...conditions))
    .groupBy(crmDeals.stageId, crmDealStages.name, crmDealStages.color);
}

export async function pipelineValue(userId: string, accountId: string, recordAccess?: CrmRecordAccess) {
  const conditions = [
    eq(crmDeals.accountId, accountId),
    eq(crmDeals.isArchived, false),
    sql`${crmDeals.wonAt} IS NULL AND ${crmDeals.lostAt} IS NULL`,
  ];
  if (!recordAccess || recordAccess === 'own') {
    conditions.push(eq(crmDeals.userId, userId));
  }
  const [result] = await db
    .select({
      totalValue: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`.as('total_value'),
      dealCount: sql<number>`COUNT(*)`.as('deal_count'),
      weightedValue: sql<number>`COALESCE(SUM(${crmDeals.value} * ${crmDeals.probability} / 100.0), 0)`.as('weighted_value'),
    })
    .from(crmDeals)
    .where(and(...conditions));

  return result || { totalValue: 0, dealCount: 0, weightedValue: 0 };
}

// ─── Activities ─────────────────────────────────────────────────────

export async function listActivities(userId: string, accountId: string, filters?: {
  dealId?: string;
  contactId?: string;
  companyId?: string;
  includeArchived?: boolean;
  recordAccess?: CrmRecordAccess;
  dueBefore?: string;
  dueAfter?: string;
  sortBy?: 'createdAt' | 'scheduledAt';
}) {
  const conditions = [eq(crmActivities.accountId, accountId)];
  if (!filters?.recordAccess || filters.recordAccess === 'own') {
    conditions.push(eq(crmActivities.userId, userId));
  }

  if (!filters?.includeArchived) {
    conditions.push(eq(crmActivities.isArchived, false));
  }
  if (filters?.dealId) {
    conditions.push(eq(crmActivities.dealId, filters.dealId));
  }
  if (filters?.contactId) {
    conditions.push(eq(crmActivities.contactId, filters.contactId));
  }
  if (filters?.companyId) {
    conditions.push(eq(crmActivities.companyId, filters.companyId));
  }
  if (filters?.dueBefore) {
    conditions.push(lte(crmActivities.scheduledAt, new Date(filters.dueBefore)));
  }
  if (filters?.dueAfter) {
    conditions.push(gte(crmActivities.scheduledAt, new Date(filters.dueAfter)));
  }

  const orderCol = filters?.sortBy === 'scheduledAt' ? crmActivities.scheduledAt : crmActivities.createdAt;

  return db
    .select({
      id: crmActivities.id,
      accountId: crmActivities.accountId,
      userId: crmActivities.userId,
      type: crmActivities.type,
      body: crmActivities.body,
      dealId: crmActivities.dealId,
      contactId: crmActivities.contactId,
      companyId: crmActivities.companyId,
      assignedUserId: crmActivities.assignedUserId,
      scheduledAt: crmActivities.scheduledAt,
      completedAt: crmActivities.completedAt,
      isArchived: crmActivities.isArchived,
      createdAt: crmActivities.createdAt,
      updatedAt: crmActivities.updatedAt,
      assignedUserName: users.name,
    })
    .from(crmActivities)
    .leftJoin(users, eq(crmActivities.assignedUserId, users.id))
    .where(and(...conditions))
    .orderBy(desc(orderCol));
}

export async function createActivity(userId: string, accountId: string, input: CreateActivityInput) {
  const now = new Date();

  const [created] = await db
    .insert(crmActivities)
    .values({
      accountId,
      userId,
      type: input.type ?? 'note',
      body: input.body,
      dealId: input.dealId ?? null,
      contactId: input.contactId ?? null,
      companyId: input.companyId ?? null,
      assignedUserId: input.assignedUserId ?? null,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, activityId: created.id }, 'CRM activity created');

  // Fire workflow trigger
  executeWorkflows(accountId, userId, 'activity_logged', {
    activityId: created.id,
    dealId: created.dealId,
    contactId: created.contactId,
    activityType: created.type,
  }).catch(() => {});

  return created;
}

export async function updateActivity(userId: string, accountId: string, id: string, input: UpdateActivityInput, recordAccess?: CrmRecordAccess) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.type !== undefined) updates.type = input.type;
  if (input.body !== undefined) updates.body = input.body;
  if (input.dealId !== undefined) updates.dealId = input.dealId;
  if (input.contactId !== undefined) updates.contactId = input.contactId;
  if (input.companyId !== undefined) updates.companyId = input.companyId;
  if (input.assignedUserId !== undefined) updates.assignedUserId = input.assignedUserId;
  if (input.scheduledAt !== undefined) updates.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  if (input.completedAt !== undefined) updates.completedAt = input.completedAt ? new Date(input.completedAt) : null;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  const updateConditions = [eq(crmActivities.id, id), eq(crmActivities.accountId, accountId)];
  if (!recordAccess || recordAccess === 'own') {
    updateConditions.push(eq(crmActivities.userId, userId));
  }

  await db
    .update(crmActivities)
    .set(updates)
    .where(and(...updateConditions));

  const [updated] = await db
    .select()
    .from(crmActivities)
    .where(and(...updateConditions))
    .limit(1);

  return updated || null;
}

export async function deleteActivity(userId: string, accountId: string, id: string, recordAccess?: CrmRecordAccess) {
  await updateActivity(userId, accountId, id, { isArchived: true }, recordAccess);
}

export async function completeAndScheduleNext(
  userId: string,
  accountId: string,
  activityId: string,
  nextInput?: { type: string; body?: string; scheduledAt: string },
  recordAccess?: CrmRecordAccess,
) {
  // Complete the current activity
  const completed = await updateActivity(userId, accountId, activityId, { completedAt: new Date().toISOString() }, recordAccess);
  if (!completed) throw new Error('Activity not found');

  let next = null;
  if (nextInput) {
    next = await createActivity(userId, accountId, {
      type: nextInput.type,
      body: nextInput.body || '',
      dealId: completed.dealId ?? undefined,
      contactId: completed.contactId ?? undefined,
      companyId: completed.companyId ?? undefined,
      scheduledAt: nextInput.scheduledAt,
    });
  }

  return { completed, next };
}

// ─── Activity Types ─────────────────────────────────────────────────

export async function listActivityTypes(accountId: string) {
  return db
    .select()
    .from(crmActivityTypes)
    .where(and(eq(crmActivityTypes.accountId, accountId), eq(crmActivityTypes.isArchived, false)))
    .orderBy(asc(crmActivityTypes.sortOrder));
}

export async function createActivityType(accountId: string, input: { name: string; icon?: string; color?: string }) {
  const now = new Date();
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${crmActivityTypes.sortOrder}), -1)` })
    .from(crmActivityTypes)
    .where(eq(crmActivityTypes.accountId, accountId));

  const [created] = await db
    .insert(crmActivityTypes)
    .values({
      accountId,
      name: input.name,
      icon: input.icon ?? 'sticky-note',
      color: input.color ?? '#6b7280',
      sortOrder: (maxSort?.max ?? -1) + 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

export async function updateActivityType(accountId: string, id: string, input: Partial<{ name: string; icon: string; color: string; sortOrder: number; isArchived: boolean }>) {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.color !== undefined) updates.color = input.color;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  await db.update(crmActivityTypes).set(updates)
    .where(and(eq(crmActivityTypes.id, id), eq(crmActivityTypes.accountId, accountId)));

  const [updated] = await db.select().from(crmActivityTypes)
    .where(and(eq(crmActivityTypes.id, id), eq(crmActivityTypes.accountId, accountId))).limit(1);
  return updated || null;
}

export async function deleteActivityType(accountId: string, id: string) {
  return updateActivityType(accountId, id, { isArchived: true });
}

export async function reorderActivityTypes(accountId: string, typeIds: string[]) {
  for (let i = 0; i < typeIds.length; i++) {
    await db.update(crmActivityTypes).set({ sortOrder: i })
      .where(and(eq(crmActivityTypes.id, typeIds[i]), eq(crmActivityTypes.accountId, accountId)));
  }
}

const DEFAULT_ACTIVITY_TYPES = [
  { name: 'note', icon: 'sticky-note', color: '#6b7280' },
  { name: 'call', icon: 'phone-call', color: '#3b82f6' },
  { name: 'email', icon: 'mail', color: '#8b5cf6' },
  { name: 'meeting', icon: 'calendar-days', color: '#f59e0b' },
];

export async function seedDefaultActivityTypes(accountId: string) {
  const existing = await listActivityTypes(accountId);
  if (existing.length > 0) return existing;

  const now = new Date();
  for (let i = 0; i < DEFAULT_ACTIVITY_TYPES.length; i++) {
    const t = DEFAULT_ACTIVITY_TYPES[i];
    await db.insert(crmActivityTypes).values({
      accountId, name: t.name, icon: t.icon, color: t.color,
      isDefault: true, sortOrder: i, createdAt: now, updatedAt: now,
    });
  }
  return listActivityTypes(accountId);
}

// ─── Dashboard ─────────────────────────────────────────────────────

export async function getDashboard(userId: string, accountId: string, recordAccess?: CrmRecordAccess) {
  // Build base ownership condition
  const ownerFilter = (!recordAccess || recordAccess === 'own')
    ? eq(crmDeals.userId, userId)
    : sql`TRUE`;

  // 1. Total pipeline value (active deals: not won, not lost, not archived)
  const [pipelineAgg] = await db
    .select({
      totalValue: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`.as('total_value'),
      dealCount: sql<number>`COUNT(*)`.as('deal_count'),
    })
    .from(crmDeals)
    .where(and(
      ownerFilter,
      eq(crmDeals.accountId, accountId),
      eq(crmDeals.isArchived, false),
      sql`${crmDeals.wonAt} IS NULL AND ${crmDeals.lostAt} IS NULL`,
    ));

  const totalPipelineValue = Number(pipelineAgg?.totalValue ?? 0);
  const dealCount = Number(pipelineAgg?.dealCount ?? 0);
  const averageDealSize = dealCount > 0 ? totalPipelineValue / dealCount : 0;

  // 2. Deals won this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [wonAgg] = await db
    .select({
      count: sql<number>`COUNT(*)`.as('count'),
      value: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`.as('value'),
    })
    .from(crmDeals)
    .where(and(
      ownerFilter,
      eq(crmDeals.accountId, accountId),
      eq(crmDeals.isArchived, false),
      sql`${crmDeals.wonAt} IS NOT NULL`,
      gte(crmDeals.wonAt, monthStart),
    ));

  const dealsWonCount = Number(wonAgg?.count ?? 0);
  const dealsWonValue = Number(wonAgg?.value ?? 0);

  // 3. Deals lost this month
  const [lostAgg] = await db
    .select({
      count: sql<number>`COUNT(*)`.as('count'),
    })
    .from(crmDeals)
    .where(and(
      ownerFilter,
      eq(crmDeals.accountId, accountId),
      eq(crmDeals.isArchived, false),
      sql`${crmDeals.lostAt} IS NOT NULL`,
      gte(crmDeals.lostAt, monthStart),
    ));

  const dealsLostCount = Number(lostAgg?.count ?? 0);
  const winRate = (dealsWonCount + dealsLostCount) > 0
    ? Math.round((dealsWonCount / (dealsWonCount + dealsLostCount)) * 100)
    : 0;

  // 4. Value by stage (active deals only)
  const valueByStage = await db
    .select({
      stageId: crmDeals.stageId,
      stageName: crmDealStages.name,
      stageColor: crmDealStages.color,
      value: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`.as('value'),
      count: sql<number>`COUNT(*)`.as('count'),
      sequence: crmDealStages.sequence,
    })
    .from(crmDeals)
    .leftJoin(crmDealStages, eq(crmDeals.stageId, crmDealStages.id))
    .where(and(
      ownerFilter,
      eq(crmDeals.accountId, accountId),
      eq(crmDeals.isArchived, false),
      sql`${crmDeals.wonAt} IS NULL AND ${crmDeals.lostAt} IS NULL`,
    ))
    .groupBy(crmDeals.stageId, crmDealStages.name, crmDealStages.color, crmDealStages.sequence)
    .orderBy(asc(crmDealStages.sequence));

  // 5. Recent activities (last 10)
  const activityOwnerFilter = (!recordAccess || recordAccess === 'own')
    ? eq(crmActivities.userId, userId)
    : sql`TRUE`;
  const recentActivities = await db
    .select()
    .from(crmActivities)
    .where(and(
      activityOwnerFilter,
      eq(crmActivities.accountId, accountId),
      eq(crmActivities.isArchived, false),
    ))
    .orderBy(desc(crmActivities.createdAt))
    .limit(10);

  // 6. Deals closing soon (next 30 days)
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);
  const dealsClosingSoon = await db
    .select({
      id: crmDeals.id,
      accountId: crmDeals.accountId,
      userId: crmDeals.userId,
      title: crmDeals.title,
      value: crmDeals.value,
      stageId: crmDeals.stageId,
      contactId: crmDeals.contactId,
      companyId: crmDeals.companyId,
      assignedUserId: crmDeals.assignedUserId,
      probability: crmDeals.probability,
      expectedCloseDate: crmDeals.expectedCloseDate,
      wonAt: crmDeals.wonAt,
      lostAt: crmDeals.lostAt,
      lostReason: crmDeals.lostReason,
      tags: crmDeals.tags,
      isArchived: crmDeals.isArchived,
      sortOrder: crmDeals.sortOrder,
      createdAt: crmDeals.createdAt,
      updatedAt: crmDeals.updatedAt,
      stageName: crmDealStages.name,
      stageColor: crmDealStages.color,
      contactName: crmContacts.name,
      companyName: crmCompanies.name,
    })
    .from(crmDeals)
    .leftJoin(crmDealStages, eq(crmDeals.stageId, crmDealStages.id))
    .leftJoin(crmContacts, eq(crmDeals.contactId, crmContacts.id))
    .leftJoin(crmCompanies, eq(crmDeals.companyId, crmCompanies.id))
    .where(and(
      ownerFilter,
      eq(crmDeals.accountId, accountId),
      eq(crmDeals.isArchived, false),
      sql`${crmDeals.wonAt} IS NULL AND ${crmDeals.lostAt} IS NULL`,
      sql`${crmDeals.expectedCloseDate} IS NOT NULL`,
      lte(crmDeals.expectedCloseDate, thirtyDaysFromNow),
      gte(crmDeals.expectedCloseDate, now),
    ))
    .orderBy(asc(crmDeals.expectedCloseDate));

  // 7. Top deals by value (top 5)
  const topDeals = await db
    .select({
      id: crmDeals.id,
      accountId: crmDeals.accountId,
      userId: crmDeals.userId,
      title: crmDeals.title,
      value: crmDeals.value,
      stageId: crmDeals.stageId,
      contactId: crmDeals.contactId,
      companyId: crmDeals.companyId,
      assignedUserId: crmDeals.assignedUserId,
      probability: crmDeals.probability,
      expectedCloseDate: crmDeals.expectedCloseDate,
      wonAt: crmDeals.wonAt,
      lostAt: crmDeals.lostAt,
      lostReason: crmDeals.lostReason,
      tags: crmDeals.tags,
      isArchived: crmDeals.isArchived,
      sortOrder: crmDeals.sortOrder,
      createdAt: crmDeals.createdAt,
      updatedAt: crmDeals.updatedAt,
      stageName: crmDealStages.name,
      stageColor: crmDealStages.color,
      contactName: crmContacts.name,
      companyName: crmCompanies.name,
    })
    .from(crmDeals)
    .leftJoin(crmDealStages, eq(crmDeals.stageId, crmDealStages.id))
    .leftJoin(crmContacts, eq(crmDeals.contactId, crmContacts.id))
    .leftJoin(crmCompanies, eq(crmDeals.companyId, crmCompanies.id))
    .where(and(
      ownerFilter,
      eq(crmDeals.accountId, accountId),
      eq(crmDeals.isArchived, false),
      sql`${crmDeals.wonAt} IS NULL AND ${crmDeals.lostAt} IS NULL`,
    ))
    .orderBy(desc(crmDeals.value))
    .limit(5);

  return {
    totalPipelineValue,
    dealsWonCount,
    dealsWonValue,
    dealsLostCount,
    winRate,
    averageDealSize,
    dealCount,
    valueByStage: valueByStage.map((s) => ({
      stageId: s.stageId,
      stageName: s.stageName,
      stageColor: s.stageColor,
      value: Number(s.value),
      count: Number(s.count),
    })),
    recentActivities,
    dealsClosingSoon,
    topDeals,
  };
}

// ─── Seed Sample Data ───────────────────────────────────────────────

export async function seedSampleData(userId: string, accountId: string) {
  // Seed default pipeline stages
  const stages = await seedDefaultStages(accountId);

  // Idempotency guard — skip sample data if contacts already exist
  const existingContacts = await db.select({ id: crmContacts.id }).from(crmContacts)
    .where(and(eq(crmContacts.accountId, accountId), eq(crmContacts.isArchived, false))).limit(1);
  if (existingContacts.length > 0) {
    logger.info({ userId, accountId }, 'Seeded CRM default stages (sample data already exists)');
    return { stages: stages.length };
  }

  // Build a stage lookup by name
  const allStages = await db.select().from(crmDealStages)
    .where(eq(crmDealStages.accountId, accountId))
    .orderBy(asc(crmDealStages.sequence));
  const stageByName: Record<string, string> = {};
  for (const s of allStages) {
    stageByName[s.name.toLowerCase()] = s.id;
  }

  // --- Companies ---
  const acme = await createCompany(userId, accountId, {
    name: 'Acme Corp', industry: 'Technology', size: '50', domain: 'acmecorp.com',
  });
  const globalTech = await createCompany(userId, accountId, {
    name: 'GlobalTech Solutions', industry: 'Consulting', size: '200', domain: 'globaltech.io',
  });
  const brightStar = await createCompany(userId, accountId, {
    name: 'BrightStar Media', industry: 'Marketing', size: '25', domain: 'brightstarmedia.com',
  });

  // --- Contacts (2 per company) ---
  const johnSmith = await createContact(userId, accountId, {
    name: 'John Smith', email: 'john@acmecorp.com', position: 'CEO', companyId: acme.id,
  });
  const sarahJohnson = await createContact(userId, accountId, {
    name: 'Sarah Johnson', email: 'sarah@acmecorp.com', position: 'CTO', companyId: acme.id,
  });
  const michaelChen = await createContact(userId, accountId, {
    name: 'Michael Chen', email: 'michael@globaltech.io', position: 'VP Sales', companyId: globalTech.id,
  });
  const emilyDavis = await createContact(userId, accountId, {
    name: 'Emily Davis', email: 'emily@globaltech.io', position: 'Marketing Director', companyId: globalTech.id,
  });
  const davidWilson = await createContact(userId, accountId, {
    name: 'David Wilson', email: 'david@brightstarmedia.com', position: 'Founder', companyId: brightStar.id,
  });
  const lisaAnderson = await createContact(userId, accountId, {
    name: 'Lisa Anderson', email: 'lisa@brightstarmedia.com', position: 'Creative Director', companyId: brightStar.id,
  });

  // --- Deals ---
  const proposalStageId = stageByName['proposal'] ?? allStages[2]?.id;
  const qualifiedStageId = stageByName['qualified'] ?? allStages[1]?.id;
  const negotiationStageId = stageByName['negotiation'] ?? allStages[3]?.id;
  const wonStageId = stageByName['closed won'] ?? allStages[4]?.id;

  const deal1 = await createDeal(userId, accountId, {
    title: 'Acme Enterprise License', value: 45000, stageId: proposalStageId,
    contactId: johnSmith.id, companyId: acme.id, probability: 60,
  });
  await createDeal(userId, accountId, {
    title: 'GlobalTech Consulting Package', value: 120000, stageId: qualifiedStageId,
    contactId: michaelChen.id, companyId: globalTech.id, probability: 40,
  });
  const deal3 = await createDeal(userId, accountId, {
    title: 'BrightStar Social Campaign', value: 15000, stageId: negotiationStageId,
    contactId: davidWilson.id, companyId: brightStar.id, probability: 80,
  });
  const deal4 = await createDeal(userId, accountId, {
    title: 'Acme Support Add-on', value: 8000, stageId: wonStageId,
    contactId: sarahJohnson.id, companyId: acme.id, probability: 100,
  });
  // Mark the won deal
  await markDealWon(userId, accountId, deal4.id, 'all');

  // --- Leads ---
  await createLead(userId, accountId, {
    name: 'TechStart Inc', email: 'info@techstart.io', phone: '+1-555-0201', source: 'website', companyName: 'TechStart Inc', notes: 'Interested in starter plan',
  });
  await createLead(userId, accountId, {
    name: 'Metro Solutions', email: 'sales@metrosolutions.com', phone: '+1-555-0202', source: 'referral', companyName: 'Metro Solutions', notes: 'Called, scheduling demo',
  });
  await createLead(userId, accountId, {
    name: 'CloudNine Labs', email: 'hello@cloudninelabs.io', phone: '+1-555-0203', source: 'social_media', companyName: 'CloudNine Labs', notes: 'Budget approved, needs proposal',
  });
  await createLead(userId, accountId, {
    name: 'Peak Performance', email: 'contact@peakperf.com', source: 'website', companyName: 'Peak Performance', notes: 'Filled out lead form',
  });
  // Update statuses for non-new leads
  const allLeads = await listLeads(userId, accountId, {});
  for (const lead of allLeads) {
    if (lead.name === 'Metro Solutions') {
      await updateLead(userId, accountId, lead.id, { status: 'contacted' });
    } else if (lead.name === 'CloudNine Labs') {
      await updateLead(userId, accountId, lead.id, { status: 'qualified' });
    }
  }

  // --- Activities ---
  await createActivity(userId, accountId, {
    type: 'call', body: 'Discussed enterprise requirements', contactId: johnSmith.id, dealId: deal1.id,
  });
  await createActivity(userId, accountId, {
    type: 'meeting', body: 'Product demo scheduled', contactId: michaelChen.id,
  });
  await createActivity(userId, accountId, {
    type: 'note', body: 'Waiting for creative brief', dealId: deal3.id,
  });
  await createActivity(userId, accountId, {
    type: 'email', body: 'Sent proposal deck', contactId: lisaAnderson.id,
  });

  logger.info({ userId, accountId }, 'Seeded CRM sample data (stages, companies, contacts, deals, leads, activities)');
  return { stages: stages.length, companies: 3, contacts: 6, deals: 4, leads: 4, activities: 4 };
}

// ─── Seed Sample Leads (standalone) ──────────────────────────────────

export async function seedSampleLeads(userId: string, accountId: string) {
  // Idempotency guard
  const existing = await db.select({ id: crmLeads.id }).from(crmLeads)
    .where(and(eq(crmLeads.accountId, accountId), eq(crmLeads.isArchived, false))).limit(1);
  if (existing.length > 0) return { skipped: true, leads: 0 };

  await createLead(userId, accountId, {
    name: 'TechStart Inc', email: 'info@techstart.io', phone: '+1-555-0201', source: 'website', companyName: 'TechStart Inc', notes: 'Interested in starter plan',
  });
  const metro = await createLead(userId, accountId, {
    name: 'Metro Solutions', email: 'sales@metrosolutions.com', phone: '+1-555-0202', source: 'referral', companyName: 'Metro Solutions', notes: 'Called, scheduling demo',
  });
  const cloud = await createLead(userId, accountId, {
    name: 'CloudNine Labs', email: 'hello@cloudninelabs.io', phone: '+1-555-0203', source: 'social_media', companyName: 'CloudNine Labs', notes: 'Budget approved, needs proposal',
  });

  await updateLead(userId, accountId, metro.id, { status: 'contacted' });
  await updateLead(userId, accountId, cloud.id, { status: 'qualified' });

  return { leads: 3 };
}

// ─── Seed Example Workflows ──────────────────────────────────────────

export async function seedExampleWorkflows(userId: string, accountId: string) {
  // Idempotency guard — skip if workflows already exist for this account
  const existing = await db.select({ id: crmWorkflows.id }).from(crmWorkflows)
    .where(and(eq(crmWorkflows.userId, userId), eq(crmWorkflows.accountId, accountId))).limit(1);
  if (existing.length > 0) return { skipped: true };

  // Look up stages by name for this account
  const stages = await db.select().from(crmDealStages)
    .where(eq(crmDealStages.accountId, accountId))
    .orderBy(asc(crmDealStages.sequence));

  const stageByName: Record<string, string> = {};
  for (const s of stages) {
    stageByName[s.name.toLowerCase()] = s.id;
  }

  const qualifiedId = stageByName['qualified'] ?? '';
  const proposalId = stageByName['proposal'] ?? '';

  const workflows: Array<{
    name: string;
    trigger: string;
    triggerConfig: Record<string, unknown>;
    action: string;
    actionConfig: Record<string, unknown>;
  }> = [
    {
      name: 'Qualified → Schedule demo',
      trigger: 'deal_stage_changed',
      triggerConfig: qualifiedId ? { toStage: qualifiedId } : {},
      action: 'create_task',
      actionConfig: { taskTitle: 'Schedule discovery call with contact' },
    },
    {
      name: 'Proposal → Prepare document',
      trigger: 'deal_stage_changed',
      triggerConfig: proposalId ? { toStage: proposalId } : {},
      action: 'create_task',
      actionConfig: { taskTitle: 'Prepare and send proposal' },
    },
    {
      name: 'Won → Welcome task',
      trigger: 'deal_won',
      triggerConfig: {},
      action: 'create_task',
      actionConfig: { taskTitle: 'Send welcome package to new customer' },
    },
    {
      name: 'Won → Set probability',
      trigger: 'deal_won',
      triggerConfig: {},
      action: 'update_field',
      actionConfig: { fieldName: 'probability', fieldValue: '100' },
    },
    {
      name: 'Won → Tag customer',
      trigger: 'deal_won',
      triggerConfig: {},
      action: 'add_tag',
      actionConfig: { tag: 'customer' },
    },
    {
      name: 'Lost → Review task',
      trigger: 'deal_lost',
      triggerConfig: {},
      action: 'create_task',
      actionConfig: { taskTitle: 'Schedule deal loss review' },
    },
    {
      name: 'Lost → Log activity',
      trigger: 'deal_lost',
      triggerConfig: {},
      action: 'log_activity',
      actionConfig: { activityType: 'note', body: 'Deal was lost. Review and follow up.' },
    },
    {
      name: 'New contact → Intro email task',
      trigger: 'contact_created',
      triggerConfig: {},
      action: 'create_task',
      actionConfig: { taskTitle: 'Send introduction email' },
    },
    {
      name: 'Call logged → Follow up',
      trigger: 'activity_logged',
      triggerConfig: { activityType: 'call' },
      action: 'create_task',
      actionConfig: { taskTitle: 'Send follow-up email after call' },
    },
    {
      name: 'Meeting logged → Notes',
      trigger: 'activity_logged',
      triggerConfig: { activityType: 'meeting' },
      action: 'create_task',
      actionConfig: { taskTitle: 'Write meeting notes and share with team' },
    },
  ];

  let created = 0;
  for (const wf of workflows) {
    await createWorkflow(userId, accountId, wf);
    created++;
  }

  logger.info({ userId, accountId, created }, 'Seeded CRM example workflows');
  return { created };
}

// ─── Bulk Import ───────────────────────────────────────────────────────

export async function bulkCreateContacts(
  userId: string,
  accountId: string,
  rows: Array<Record<string, string>>,
): Promise<{ imported: number; failed: number; errors: string[] }> {
  let imported = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.name?.trim()) {
        errors.push(`Row ${i + 1}: Name is required`);
        failed++;
        continue;
      }
      await createContact(userId, accountId, {
        name: row.name.trim(),
        email: row.email?.trim() || null,
        phone: row.phone?.trim() || null,
        position: row.position?.trim() || null,
        source: row.source?.trim() || null,
        companyId: null,
      });
      imported++;
    } catch (err) {
      failed++;
      errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  logger.info({ userId, accountId, imported, failed }, 'Bulk imported CRM contacts');
  return { imported, failed, errors };
}

export async function bulkCreateCompanies(
  userId: string,
  accountId: string,
  rows: Array<Record<string, string>>,
): Promise<{ imported: number; failed: number; errors: string[] }> {
  let imported = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.name?.trim()) {
        errors.push(`Row ${i + 1}: Name is required`);
        failed++;
        continue;
      }
      await createCompany(userId, accountId, {
        name: row.name.trim(),
        domain: row.domain?.trim() || null,
        industry: row.industry?.trim() || null,
        size: row.size?.trim() || null,
        address: row.address?.trim() || null,
        phone: row.phone?.trim() || null,
      });
      imported++;
    } catch (err) {
      failed++;
      errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  logger.info({ userId, accountId, imported, failed }, 'Bulk imported CRM companies');
  return { imported, failed, errors };
}

export async function bulkCreateDeals(
  userId: string,
  accountId: string,
  rows: Array<Record<string, string>>,
): Promise<{ imported: number; failed: number; errors: string[] }> {
  let imported = 0;
  let failed = 0;
  const errors: string[] = [];

  // Get default stage for deals without a stage
  const stages = await listDealStages(accountId);
  const defaultStage = stages.find((s) => s.isDefault) ?? stages[0];

  if (!defaultStage) {
    return { imported: 0, failed: rows.length, errors: ['No deal stages configured. Create stages first.'] };
  }

  // Build a stage lookup by name (case-insensitive)
  const stageByName: Record<string, string> = {};
  for (const s of stages) {
    stageByName[s.name.toLowerCase()] = s.id;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.title?.trim()) {
        errors.push(`Row ${i + 1}: Title is required`);
        failed++;
        continue;
      }

      // Resolve stage by name or use default
      let stageId = defaultStage.id;
      if (row.stage?.trim()) {
        const matchedStageId = stageByName[row.stage.trim().toLowerCase()];
        if (matchedStageId) stageId = matchedStageId;
      }

      await createDeal(userId, accountId, {
        title: row.title.trim(),
        value: Number(row.value) || 0,
        stageId,
        probability: Number(row.probability) || 0,
        expectedCloseDate: row.expectedCloseDate?.trim() || null,
        contactId: null,
        companyId: null,
      });
      imported++;
    } catch (err) {
      failed++;
      errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  logger.info({ userId, accountId, imported, failed }, 'Bulk imported CRM deals');
  return { imported, failed, errors };
}

// ─── Workflow Automations ──────────────────────────────────────────

interface CreateWorkflowInput {
  name: string;
  trigger: string;
  triggerConfig?: Record<string, unknown>;
  action: string;
  actionConfig: Record<string, unknown>;
}

interface UpdateWorkflowInput {
  name?: string;
  trigger?: string;
  triggerConfig?: Record<string, unknown>;
  action?: string;
  actionConfig?: Record<string, unknown>;
  isActive?: boolean;
}

export async function listWorkflows(userId: string, accountId: string) {
  return db
    .select()
    .from(crmWorkflows)
    .where(and(eq(crmWorkflows.userId, userId), eq(crmWorkflows.accountId, accountId)))
    .orderBy(desc(crmWorkflows.createdAt));
}

export async function createWorkflow(userId: string, accountId: string, input: CreateWorkflowInput) {
  const now = new Date();

  const [created] = await db
    .insert(crmWorkflows)
    .values({
      accountId,
      userId,
      name: input.name,
      trigger: input.trigger,
      triggerConfig: input.triggerConfig ?? {},
      action: input.action,
      actionConfig: input.actionConfig,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, workflowId: created.id }, 'CRM workflow created');
  return created;
}

export async function updateWorkflow(userId: string, workflowId: string, input: UpdateWorkflowInput) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) updates.name = input.name;
  if (input.trigger !== undefined) updates.trigger = input.trigger;
  if (input.triggerConfig !== undefined) updates.triggerConfig = input.triggerConfig;
  if (input.action !== undefined) updates.action = input.action;
  if (input.actionConfig !== undefined) updates.actionConfig = input.actionConfig;
  if (input.isActive !== undefined) updates.isActive = input.isActive;

  await db
    .update(crmWorkflows)
    .set(updates)
    .where(and(eq(crmWorkflows.id, workflowId), eq(crmWorkflows.userId, userId)));

  const [updated] = await db
    .select()
    .from(crmWorkflows)
    .where(and(eq(crmWorkflows.id, workflowId), eq(crmWorkflows.userId, userId)))
    .limit(1);

  return updated || null;
}

export async function deleteWorkflow(userId: string, workflowId: string) {
  await db
    .delete(crmWorkflows)
    .where(and(eq(crmWorkflows.id, workflowId), eq(crmWorkflows.userId, userId)));
}

export async function toggleWorkflow(userId: string, workflowId: string) {
  const [existing] = await db
    .select()
    .from(crmWorkflows)
    .where(and(eq(crmWorkflows.id, workflowId), eq(crmWorkflows.userId, userId)))
    .limit(1);

  if (!existing) return null;

  const now = new Date();
  await db
    .update(crmWorkflows)
    .set({ isActive: !existing.isActive, updatedAt: now })
    .where(eq(crmWorkflows.id, workflowId));

  const [updated] = await db
    .select()
    .from(crmWorkflows)
    .where(eq(crmWorkflows.id, workflowId))
    .limit(1);

  return updated || null;
}

export async function executeWorkflows(
  accountId: string,
  userId: string,
  trigger: string,
  context: Record<string, unknown>,
) {
  // Find all active workflows matching this trigger for the account
  const workflows = await db
    .select()
    .from(crmWorkflows)
    .where(and(
      eq(crmWorkflows.accountId, accountId),
      eq(crmWorkflows.trigger, trigger),
      eq(crmWorkflows.isActive, true),
    ));

  for (const workflow of workflows) {
    try {
      // Check trigger config matches context
      if (!matchesTriggerConfig(workflow.triggerConfig, trigger, context)) {
        continue;
      }

      // Execute the action
      await executeAction(userId, accountId, workflow.action, workflow.actionConfig, context);

      // Update execution stats
      const now = new Date();
      await db
        .update(crmWorkflows)
        .set({
          executionCount: sql`${crmWorkflows.executionCount} + 1`,
          lastExecutedAt: now,
          updatedAt: now,
        })
        .where(eq(crmWorkflows.id, workflow.id));

      logger.info({ workflowId: workflow.id, trigger, action: workflow.action }, 'CRM workflow executed');
    } catch (error) {
      logger.error({ error, workflowId: workflow.id, trigger }, 'CRM workflow execution failed');
    }
  }
}

function matchesTriggerConfig(
  config: Record<string, unknown>,
  trigger: string,
  context: Record<string, unknown>,
): boolean {
  if (!config || Object.keys(config).length === 0) return true;

  if (trigger === 'deal_stage_changed') {
    if (config.fromStage && config.fromStage !== context.fromStage) return false;
    if (config.toStage && config.toStage !== context.toStage) return false;
  }

  if (trigger === 'activity_logged') {
    if (config.activityType && config.activityType !== context.activityType) return false;
  }

  return true;
}

async function executeAction(
  userId: string,
  accountId: string,
  action: string,
  actionConfig: Record<string, unknown>,
  context: Record<string, unknown>,
) {
  switch (action) {
    case 'create_task': {
      const title = (actionConfig.taskTitle as string) || 'Automated task';
      const now = new Date();
      await db.insert(tasksTable).values({
        accountId,
        userId,
        title,
        status: 'todo',
        when: 'inbox',
        priority: 'none',
        type: 'task',
        tags: [],
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      });
      break;
    }
    case 'update_field': {
      const fieldName = actionConfig.fieldName as string;
      const fieldValue = actionConfig.fieldValue as string;
      const dealId = context.dealId as string | undefined;
      if (dealId && fieldName) {
        const now = new Date();
        const updates: Record<string, unknown> = { updatedAt: now };
        // Support common deal fields
        if (fieldName === 'probability') updates.probability = Number(fieldValue) || 0;
        else if (fieldName === 'value') updates.value = Number(fieldValue) || 0;
        else if (fieldName === 'title') updates.title = fieldValue;

        if (Object.keys(updates).length > 1) {
          await db.update(crmDeals).set(updates).where(eq(crmDeals.id, dealId));
        }
      }
      break;
    }
    case 'change_deal_stage': {
      const newStageId = actionConfig.newStageId as string;
      const dealId = context.dealId as string | undefined;
      if (dealId && newStageId) {
        const now = new Date();
        await db.update(crmDeals).set({ stageId: newStageId, updatedAt: now }).where(eq(crmDeals.id, dealId));
      }
      break;
    }
    case 'add_tag': {
      const tag = (actionConfig.tag as string)?.trim();
      const dealId = context.dealId as string | undefined;
      const contactId = context.contactId as string | undefined;
      const companyId = context.companyId as string | undefined;
      if (tag) {
        const now = new Date();
        if (dealId) {
          const [deal] = await db.select().from(crmDeals).where(eq(crmDeals.id, dealId)).limit(1);
          if (deal) {
            const tags = Array.isArray(deal.tags) ? [...deal.tags] : [];
            if (!tags.includes(tag)) {
              tags.push(tag);
              await db.update(crmDeals).set({ tags, updatedAt: now }).where(eq(crmDeals.id, dealId));
            }
          }
        } else if (contactId) {
          const [contact] = await db.select().from(crmContacts).where(eq(crmContacts.id, contactId)).limit(1);
          if (contact) {
            const tags = Array.isArray(contact.tags) ? [...contact.tags] : [];
            if (!tags.includes(tag)) {
              tags.push(tag);
              await db.update(crmContacts).set({ tags, updatedAt: now }).where(eq(crmContacts.id, contactId));
            }
          }
        } else if (companyId) {
          const [company] = await db.select().from(crmCompanies).where(eq(crmCompanies.id, companyId)).limit(1);
          if (company) {
            const tags = Array.isArray(company.tags) ? [...company.tags] : [];
            if (!tags.includes(tag)) {
              tags.push(tag);
              await db.update(crmCompanies).set({ tags, updatedAt: now }).where(eq(crmCompanies.id, companyId));
            }
          }
        }
      }
      break;
    }
    case 'assign_user': {
      const assignedUserId = actionConfig.assignedUserId as string | undefined;
      const dealId = context.dealId as string | undefined;
      if (dealId && assignedUserId) {
        const now = new Date();
        await db.update(crmDeals).set({ assignedUserId, updatedAt: now }).where(eq(crmDeals.id, dealId));
      }
      break;
    }
    case 'log_activity': {
      const activityType = (actionConfig.activityType as string) || 'note';
      const body = (actionConfig.body as string) || '';
      const dealId = context.dealId as string | undefined;
      const contactId = context.contactId as string | undefined;
      const companyId = context.companyId as string | undefined;
      const now = new Date();
      await db.insert(crmActivities).values({
        accountId,
        userId,
        type: activityType,
        body,
        dealId: dealId ?? null,
        contactId: contactId ?? null,
        companyId: companyId ?? null,
        createdAt: now,
        updatedAt: now,
      });
      break;
    }
    case 'send_notification': {
      const message = (actionConfig.message as string) || '';
      logger.info({ message, context }, 'Workflow notification');
      break;
    }
  }
}

// ─── Leads ─────────────────────────────────────────────────────────

interface CreateLeadInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  source?: string;
  notes?: string | null;
}

interface UpdateLeadInput extends Partial<CreateLeadInput> {
  status?: string;
  sortOrder?: number;
  isArchived?: boolean;
  tags?: string[];
  expectedRevenue?: number;
  probability?: number;
  assignedUserId?: string | null;
  expectedCloseDate?: string | null;
}

export async function listLeads(userId: string, accountId: string, filters?: {
  status?: string;
  source?: string;
  search?: string;
  recordAccess?: CrmRecordAccess;
}) {
  const conditions = [eq(crmLeads.accountId, accountId)];
  if (!filters?.recordAccess || filters.recordAccess === 'own') {
    conditions.push(eq(crmLeads.userId, userId));
  }
  conditions.push(eq(crmLeads.isArchived, false));

  if (filters?.status) {
    conditions.push(eq(crmLeads.status, filters.status));
  }
  if (filters?.source) {
    conditions.push(eq(crmLeads.source, filters.source));
  }
  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(sql`(${crmLeads.name} ILIKE ${searchTerm} OR ${crmLeads.email} ILIKE ${searchTerm} OR ${crmLeads.companyName} ILIKE ${searchTerm})`);
  }

  return db.select().from(crmLeads)
    .where(and(...conditions))
    .orderBy(asc(crmLeads.sortOrder), desc(crmLeads.createdAt));
}

export async function getLead(userId: string, accountId: string, id: string, recordAccess?: CrmRecordAccess) {
  const conditions = [eq(crmLeads.id, id), eq(crmLeads.accountId, accountId)];
  if (!recordAccess || recordAccess === 'own') {
    conditions.push(eq(crmLeads.userId, userId));
  }
  const [lead] = await db.select().from(crmLeads).where(and(...conditions)).limit(1);
  return lead || null;
}

export async function createLead(userId: string, accountId: string, input: CreateLeadInput) {
  const now = new Date();
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${crmLeads.sortOrder}), -1)` })
    .from(crmLeads)
    .where(eq(crmLeads.userId, userId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db.insert(crmLeads).values({
    accountId,
    userId,
    name: input.name,
    email: input.email ?? null,
    phone: input.phone ?? null,
    companyName: input.companyName ?? null,
    source: input.source ?? 'other',
    status: 'new',
    notes: input.notes ?? null,
    tags: [],
    sortOrder,
    createdAt: now,
    updatedAt: now,
  }).returning();

  logger.info({ userId, leadId: created.id }, 'CRM lead created');
  return created;
}

export async function updateLead(userId: string, accountId: string, id: string, input: UpdateLeadInput, recordAccess?: CrmRecordAccess) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) updates.name = input.name;
  if (input.email !== undefined) updates.email = input.email;
  if (input.phone !== undefined) updates.phone = input.phone;
  if (input.companyName !== undefined) updates.companyName = input.companyName;
  if (input.source !== undefined) updates.source = input.source;
  if (input.status !== undefined) updates.status = input.status;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.tags !== undefined) updates.tags = input.tags;
  if (input.expectedRevenue !== undefined) updates.expectedRevenue = input.expectedRevenue;
  if (input.probability !== undefined) updates.probability = input.probability;
  if (input.assignedUserId !== undefined) updates.assignedUserId = input.assignedUserId;
  if (input.expectedCloseDate !== undefined) updates.expectedCloseDate = input.expectedCloseDate ? new Date(input.expectedCloseDate) : null;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  const conditions = [eq(crmLeads.id, id), eq(crmLeads.accountId, accountId)];
  if (!recordAccess || recordAccess === 'own') {
    conditions.push(eq(crmLeads.userId, userId));
  }

  await db.update(crmLeads).set(updates).where(and(...conditions));
  const [updated] = await db.select().from(crmLeads).where(and(...conditions)).limit(1);
  return updated || null;
}

export async function deleteLead(userId: string, accountId: string, id: string, recordAccess?: CrmRecordAccess) {
  await updateLead(userId, accountId, id, { isArchived: true }, recordAccess);
}

export async function enrichLead(userId: string, accountId: string, leadId: string) {
  const { getProviderKeyForAccount, enrichLeadWithAI } = await import('../../services/ai.service');

  const lead = await getLead(userId, accountId, leadId, 'all');
  if (!lead) throw new Error('Lead not found');

  const config = await getProviderKeyForAccount(accountId);
  const enriched = await enrichLeadWithAI(config, {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    companyName: lead.companyName,
    source: lead.source,
  });

  const now = new Date();
  await db.update(crmLeads).set({ enrichedData: enriched, enrichedAt: now, updatedAt: now })
    .where(and(eq(crmLeads.id, leadId), eq(crmLeads.accountId, accountId)));

  // Log enrichment as an activity
  const summaryParts = [];
  if (enriched.companyIndustry) summaryParts.push(`Industry: ${enriched.companyIndustry}`);
  if (enriched.companySize) summaryParts.push(`Size: ${enriched.companySize}`);
  if (enriched.leadScore) summaryParts.push(`Score: ${enriched.leadScore}/100`);
  if (enriched.companyDescription) summaryParts.push(enriched.companyDescription);

  await createActivity(userId, accountId, {
    type: 'note',
    body: `Lead enriched via AI\n${summaryParts.join('\n')}`,
  });

  logger.info({ userId, leadId }, 'CRM lead enriched via AI');
  return enriched;
}

export async function convertLead(userId: string, accountId: string, leadId: string, options: {
  dealTitle: string;
  dealStageId: string;
  dealValue?: number;
}) {
  const lead = await getLead(userId, accountId, leadId, 'all');
  if (!lead) throw new Error('Lead not found');
  if (lead.status === 'converted') throw new Error('Lead is already converted');

  // 1. Create a contact from the lead
  const contact = await createContact(userId, accountId, {
    name: lead.name,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    source: lead.source,
    companyId: null,
  });

  // 2. Optionally create a company from lead's companyName
  let company = null;
  if (lead.companyName) {
    company = await createCompany(userId, accountId, {
      name: lead.companyName,
    });
    // Link contact to company
    await updateContact(userId, accountId, contact.id, { companyId: company.id }, 'all');
  }

  // 3. Create a deal
  const deal = await createDeal(userId, accountId, {
    title: options.dealTitle,
    value: options.dealValue ?? 0,
    stageId: options.dealStageId,
    contactId: contact.id,
    companyId: company?.id ?? null,
  });

  // 4. Update lead status
  const now = new Date();
  await db.update(crmLeads).set({
    status: 'converted',
    convertedContactId: contact.id,
    convertedDealId: deal.id,
    updatedAt: now,
  }).where(eq(crmLeads.id, leadId));

  logger.info({ userId, leadId, contactId: contact.id, dealId: deal.id }, 'CRM lead converted');
  return { contact, company, deal };
}

// ─── Notes (rich text) ─────────────────────────────────────────────

interface CreateNoteInput {
  title?: string;
  content: Record<string, unknown>;
  dealId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
}

interface UpdateNoteInput {
  title?: string;
  content?: Record<string, unknown>;
  isPinned?: boolean;
  isArchived?: boolean;
}

export async function listNotes(userId: string, accountId: string, filters?: {
  dealId?: string;
  contactId?: string;
  companyId?: string;
}) {
  const conditions = [eq(crmNotes.accountId, accountId), eq(crmNotes.isArchived, false)];

  if (filters?.dealId) conditions.push(eq(crmNotes.dealId, filters.dealId));
  if (filters?.contactId) conditions.push(eq(crmNotes.contactId, filters.contactId));
  if (filters?.companyId) conditions.push(eq(crmNotes.companyId, filters.companyId));

  return db.select().from(crmNotes)
    .where(and(...conditions))
    .orderBy(desc(crmNotes.isPinned), desc(crmNotes.createdAt));
}

export async function createNote(userId: string, accountId: string, input: CreateNoteInput) {
  const now = new Date();
  const [created] = await db.insert(crmNotes).values({
    accountId,
    userId,
    title: input.title ?? '',
    content: input.content,
    dealId: input.dealId ?? null,
    contactId: input.contactId ?? null,
    companyId: input.companyId ?? null,
    createdAt: now,
    updatedAt: now,
  }).returning();

  logger.info({ userId, noteId: created.id }, 'CRM note created');
  return created;
}

export async function updateNote(userId: string, noteId: string, input: UpdateNoteInput) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.title !== undefined) updates.title = input.title;
  if (input.content !== undefined) updates.content = input.content;
  if (input.isPinned !== undefined) updates.isPinned = input.isPinned;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  await db.update(crmNotes).set(updates)
    .where(and(eq(crmNotes.id, noteId), eq(crmNotes.userId, userId)));

  const [updated] = await db.select().from(crmNotes)
    .where(and(eq(crmNotes.id, noteId), eq(crmNotes.userId, userId)))
    .limit(1);

  return updated || null;
}

export async function deleteNote(userId: string, noteId: string) {
  await db.update(crmNotes).set({ isArchived: true, updatedAt: new Date() })
    .where(and(eq(crmNotes.id, noteId), eq(crmNotes.userId, userId)));
}

// ─── Forecasting ───────────────────────────────────────────────────

export async function getForecast(accountId: string) {
  const now = new Date();
  const months: { month: string; weightedValue: number }[] = [];

  for (let i = 0; i < 6; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0, 23, 59, 59);
    const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const [agg] = await db
      .select({
        weighted: sql<number>`COALESCE(SUM(${crmDeals.value} * ${crmDeals.probability} / 100.0), 0)`.as('weighted'),
      })
      .from(crmDeals)
      .where(and(
        eq(crmDeals.accountId, accountId),
        eq(crmDeals.isArchived, false),
        isNull(crmDeals.wonAt),
        isNull(crmDeals.lostAt),
        sql`${crmDeals.expectedCloseDate} IS NOT NULL`,
        gte(crmDeals.expectedCloseDate, monthDate),
        lte(crmDeals.expectedCloseDate, monthEnd),
      ));

    months.push({ month: monthLabel, weightedValue: Number(agg?.weighted ?? 0) });
  }

  // Total weighted pipeline
  const [totalAgg] = await db
    .select({
      weighted: sql<number>`COALESCE(SUM(${crmDeals.value} * ${crmDeals.probability} / 100.0), 0)`.as('weighted'),
      bestCase: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`.as('best_case'),
    })
    .from(crmDeals)
    .where(and(
      eq(crmDeals.accountId, accountId),
      eq(crmDeals.isArchived, false),
      isNull(crmDeals.wonAt),
      isNull(crmDeals.lostAt),
    ));

  // Committed (won deals)
  const [wonAgg] = await db
    .select({
      committed: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`.as('committed'),
    })
    .from(crmDeals)
    .where(and(
      eq(crmDeals.accountId, accountId),
      eq(crmDeals.isArchived, false),
      sql`${crmDeals.wonAt} IS NOT NULL`,
    ));

  return {
    months,
    totalWeighted: Number(totalAgg?.weighted ?? 0),
    bestCase: Number(totalAgg?.bestCase ?? 0),
    committed: Number(wonAgg?.committed ?? 0),
  };
}

// ─── Merge Records ─────────────────────────────────────────────────

export async function mergeContacts(userId: string, accountId: string, primaryId: string, secondaryId: string) {
  const [primary] = await db.select().from(crmContacts)
    .where(and(eq(crmContacts.id, primaryId), eq(crmContacts.accountId, accountId))).limit(1);
  const [secondary] = await db.select().from(crmContacts)
    .where(and(eq(crmContacts.id, secondaryId), eq(crmContacts.accountId, accountId))).limit(1);

  if (!primary || !secondary) throw new Error('Contact not found');

  const now = new Date();
  // Copy empty fields from secondary to primary
  const updates: Record<string, unknown> = { updatedAt: now };
  if (!primary.email && secondary.email) updates.email = secondary.email;
  if (!primary.phone && secondary.phone) updates.phone = secondary.phone;
  if (!primary.companyId && secondary.companyId) updates.companyId = secondary.companyId;
  if (!primary.position && secondary.position) updates.position = secondary.position;
  if (!primary.source && secondary.source) updates.source = secondary.source;

  // Merge tags
  const mergedTags = [...new Set([...(primary.tags ?? []), ...(secondary.tags ?? [])])];
  updates.tags = mergedTags;

  await db.update(crmContacts).set(updates).where(eq(crmContacts.id, primaryId));

  // Re-link deals from secondary to primary
  await db.update(crmDeals).set({ contactId: primaryId, updatedAt: now })
    .where(eq(crmDeals.contactId, secondaryId));

  // Re-link activities from secondary to primary
  await db.update(crmActivities).set({ contactId: primaryId, updatedAt: now })
    .where(eq(crmActivities.contactId, secondaryId));

  // Re-link notes from secondary to primary
  await db.update(crmNotes).set({ contactId: primaryId, updatedAt: now })
    .where(eq(crmNotes.contactId, secondaryId));

  // Delete secondary (soft)
  await db.update(crmContacts).set({ isArchived: true, updatedAt: now })
    .where(eq(crmContacts.id, secondaryId));

  logger.info({ userId, primaryId, secondaryId }, 'CRM contacts merged');
  return getContact(userId, accountId, primaryId, 'all');
}

export async function mergeCompanies(userId: string, accountId: string, primaryId: string, secondaryId: string) {
  const [primary] = await db.select().from(crmCompanies)
    .where(and(eq(crmCompanies.id, primaryId), eq(crmCompanies.accountId, accountId))).limit(1);
  const [secondary] = await db.select().from(crmCompanies)
    .where(and(eq(crmCompanies.id, secondaryId), eq(crmCompanies.accountId, accountId))).limit(1);

  if (!primary || !secondary) throw new Error('Company not found');

  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (!primary.domain && secondary.domain) updates.domain = secondary.domain;
  if (!primary.industry && secondary.industry) updates.industry = secondary.industry;
  if (!primary.size && secondary.size) updates.size = secondary.size;
  if (!primary.address && secondary.address) updates.address = secondary.address;
  if (!primary.phone && secondary.phone) updates.phone = secondary.phone;

  const mergedTags = [...new Set([...(primary.tags ?? []), ...(secondary.tags ?? [])])];
  updates.tags = mergedTags;

  await db.update(crmCompanies).set(updates).where(eq(crmCompanies.id, primaryId));

  // Re-link contacts from secondary to primary
  await db.update(crmContacts).set({ companyId: primaryId, updatedAt: now })
    .where(eq(crmContacts.companyId, secondaryId));

  // Re-link deals from secondary to primary
  await db.update(crmDeals).set({ companyId: primaryId, updatedAt: now })
    .where(eq(crmDeals.companyId, secondaryId));

  // Re-link activities from secondary to primary
  await db.update(crmActivities).set({ companyId: primaryId, updatedAt: now })
    .where(eq(crmActivities.companyId, secondaryId));

  // Re-link notes from secondary to primary
  await db.update(crmNotes).set({ companyId: primaryId, updatedAt: now })
    .where(eq(crmNotes.companyId, secondaryId));

  // Delete secondary (soft)
  await db.update(crmCompanies).set({ isArchived: true, updatedAt: now })
    .where(eq(crmCompanies.id, secondaryId));

  logger.info({ userId, primaryId, secondaryId }, 'CRM companies merged');
  return getCompany(userId, accountId, primaryId, 'all');
}

// ─── Dashboard Charts (extended) ──────────────────────────────────

export async function getDashboardCharts(userId: string, accountId: string, recordAccess?: CrmRecordAccess) {
  const ownerFilter = (!recordAccess || recordAccess === 'own')
    ? eq(crmDeals.userId, userId)
    : sql`TRUE`;
  const now = new Date();

  // Win/Loss by month (last 6 months)
  const winLossByMonth: { month: string; won: number; lost: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const [wonAgg] = await db.select({ count: sql<number>`COUNT(*)` }).from(crmDeals)
      .where(and(ownerFilter, eq(crmDeals.accountId, accountId), eq(crmDeals.isArchived, false),
        sql`${crmDeals.wonAt} IS NOT NULL`, gte(crmDeals.wonAt, monthDate), lte(crmDeals.wonAt, monthEnd)));

    const [lostAgg] = await db.select({ count: sql<number>`COUNT(*)` }).from(crmDeals)
      .where(and(ownerFilter, eq(crmDeals.accountId, accountId), eq(crmDeals.isArchived, false),
        sql`${crmDeals.lostAt} IS NOT NULL`, gte(crmDeals.lostAt, monthDate), lte(crmDeals.lostAt, monthEnd)));

    winLossByMonth.push({
      month: monthLabel,
      won: Number(wonAgg?.count ?? 0),
      lost: Number(lostAgg?.count ?? 0),
    });
  }

  // Revenue trend (last 6 months)
  const revenueTrend: { month: string; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const [revAgg] = await db.select({
      revenue: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`,
    }).from(crmDeals)
      .where(and(ownerFilter, eq(crmDeals.accountId, accountId), eq(crmDeals.isArchived, false),
        sql`${crmDeals.wonAt} IS NOT NULL`, gte(crmDeals.wonAt, monthDate), lte(crmDeals.wonAt, monthEnd)));

    revenueTrend.push({ month: monthLabel, revenue: Number(revAgg?.revenue ?? 0) });
  }

  // Sales cycle length (avg days from created to won, last 6 months)
  const salesCycleLength: { month: string; avgDays: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const [cycleAgg] = await db.select({
      avgDays: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${crmDeals.wonAt} - ${crmDeals.createdAt})) / 86400), 0)`,
    }).from(crmDeals)
      .where(and(ownerFilter, eq(crmDeals.accountId, accountId), eq(crmDeals.isArchived, false),
        sql`${crmDeals.wonAt} IS NOT NULL`, gte(crmDeals.wonAt, monthDate), lte(crmDeals.wonAt, monthEnd)));

    salesCycleLength.push({ month: monthLabel, avgDays: Math.round(Number(cycleAgg?.avgDays ?? 0)) });
  }

  // Conversion funnel — count of deals that reached each stage (ever)
  const funnelData = await db.select({
    stage: crmDealStages.name,
    stageColor: crmDealStages.color,
    count: sql<number>`COUNT(*)`,
    sequence: crmDealStages.sequence,
  }).from(crmDeals)
    .leftJoin(crmDealStages, eq(crmDeals.stageId, crmDealStages.id))
    .where(and(ownerFilter, eq(crmDeals.accountId, accountId), eq(crmDeals.isArchived, false)))
    .groupBy(crmDealStages.name, crmDealStages.color, crmDealStages.sequence)
    .orderBy(asc(crmDealStages.sequence));

  const conversionFunnel = funnelData.map((r) => ({
    stage: r.stage || 'Unknown',
    stageColor: r.stageColor || '#6b7280',
    count: Number(r.count),
    sequence: r.sequence ?? 0,
  }));

  // Deals by source — grouped by contact.source
  const sourceData = await db.select({
    source: crmContacts.source,
    count: sql<number>`COUNT(*)`,
    value: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`,
  }).from(crmDeals)
    .leftJoin(crmContacts, eq(crmDeals.contactId, crmContacts.id))
    .where(and(ownerFilter, eq(crmDeals.accountId, accountId), eq(crmDeals.isArchived, false)))
    .groupBy(crmContacts.source);

  const dealsBySource = sourceData.map((r) => ({
    source: r.source || 'Unknown',
    count: Number(r.count),
    value: Number(r.value),
  }));

  return { winLossByMonth, revenueTrend, salesCycleLength, conversionFunnel, dealsBySource };
}

// ─── Widget summary (lightweight) ──────────────────────────────────

export async function getWidgetData(userId: string, accountId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Active pipeline value + deal count
  const [pipelineAgg] = await db
    .select({
      totalValue: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`.as('total_value'),
      dealCount: sql<number>`COUNT(*)`.as('deal_count'),
    })
    .from(crmDeals)
    .where(and(
      eq(crmDeals.accountId, accountId),
      eq(crmDeals.isArchived, false),
      sql`${crmDeals.wonAt} IS NULL AND ${crmDeals.lostAt} IS NULL`,
    ));

  // Won this month
  const [wonAgg] = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(crmDeals)
    .where(and(
      eq(crmDeals.accountId, accountId),
      eq(crmDeals.isArchived, false),
      sql`${crmDeals.wonAt} IS NOT NULL`,
      gte(crmDeals.wonAt, monthStart),
    ));

  // Lost this month
  const [lostAgg] = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(crmDeals)
    .where(and(
      eq(crmDeals.accountId, accountId),
      eq(crmDeals.isArchived, false),
      sql`${crmDeals.lostAt} IS NOT NULL`,
      gte(crmDeals.lostAt, monthStart),
    ));

  return {
    totalValue: Number(pipelineAgg?.totalValue ?? 0),
    dealCount: Number(pipelineAgg?.dealCount ?? 0),
    wonThisMonth: Number(wonAgg?.count ?? 0),
    lostThisMonth: Number(lostAgg?.count ?? 0),
  };
}

// ─── Saved Views ──────────────────────────────────────────────────

interface CreateSavedViewInput {
  appSection: string;
  name: string;
  filters: Record<string, unknown>;
  isPinned?: boolean;
  isShared?: boolean;
}

interface UpdateSavedViewInput {
  name?: string;
  filters?: Record<string, unknown>;
  isPinned?: boolean;
  isShared?: boolean;
  sortOrder?: number;
}

export async function listSavedViews(userId: string, accountId: string, appSection?: string) {
  const conditions = [eq(crmSavedViews.accountId, accountId)];

  // Return user's own views + shared views from other users
  conditions.push(
    or(
      eq(crmSavedViews.userId, userId),
      eq(crmSavedViews.isShared, true),
    )!,
  );

  if (appSection) {
    conditions.push(eq(crmSavedViews.appSection, appSection));
  }

  return db.select().from(crmSavedViews)
    .where(and(...conditions))
    .orderBy(desc(crmSavedViews.isPinned), asc(crmSavedViews.sortOrder), desc(crmSavedViews.createdAt));
}

export async function createSavedView(userId: string, accountId: string, input: CreateSavedViewInput) {
  const now = new Date();
  const [created] = await db.insert(crmSavedViews).values({
    accountId,
    userId,
    appSection: input.appSection,
    name: input.name,
    filters: input.filters,
    isPinned: input.isPinned ?? false,
    isShared: input.isShared ?? false,
    createdAt: now,
    updatedAt: now,
  }).returning();

  logger.info({ userId, viewId: created.id }, 'CRM saved view created');
  return created;
}

export async function updateSavedView(userId: string, accountId: string, id: string, input: UpdateSavedViewInput) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) updates.name = input.name;
  if (input.filters !== undefined) updates.filters = input.filters;
  if (input.isPinned !== undefined) updates.isPinned = input.isPinned;
  if (input.isShared !== undefined) updates.isShared = input.isShared;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;

  await db.update(crmSavedViews).set(updates)
    .where(and(eq(crmSavedViews.id, id), eq(crmSavedViews.userId, userId), eq(crmSavedViews.accountId, accountId)));

  const [updated] = await db.select().from(crmSavedViews)
    .where(and(eq(crmSavedViews.id, id), eq(crmSavedViews.accountId, accountId)))
    .limit(1);

  return updated || null;
}

export async function deleteSavedView(userId: string, accountId: string, id: string) {
  await db.delete(crmSavedViews)
    .where(and(eq(crmSavedViews.id, id), eq(crmSavedViews.userId, userId), eq(crmSavedViews.accountId, accountId)));
}

// ─── Lead Forms ───────────────────────────────────────────────────

interface CreateLeadFormInput {
  name: string;
}

interface LeadFormFieldDef {
  id: string;
  type: string;
  label: string;
  placeholder: string;
  required: boolean;
  options?: string[];
  mapTo?: string;
}

const DEFAULT_LEAD_FORM_FIELDS: LeadFormFieldDef[] = [
  { id: 'f1', type: 'text', label: 'Name', placeholder: 'Your name', required: true, mapTo: 'name' },
  { id: 'f2', type: 'email', label: 'Email', placeholder: 'your@email.com', required: true, mapTo: 'email' },
  { id: 'f3', type: 'phone', label: 'Phone', placeholder: '+1 (555) 000-0000', required: false, mapTo: 'phone' },
  { id: 'f4', type: 'text', label: 'Company', placeholder: 'Company name', required: false, mapTo: 'companyName' },
  { id: 'f5', type: 'textarea', label: 'Message', placeholder: 'How can we help?', required: false, mapTo: 'message' },
];

interface UpdateLeadFormInput {
  name?: string;
  fields?: LeadFormFieldDef[];
  isActive?: boolean;
}

export async function listLeadForms(userId: string, accountId: string) {
  return db.select().from(crmLeadForms)
    .where(eq(crmLeadForms.accountId, accountId))
    .orderBy(desc(crmLeadForms.createdAt));
}

export async function createLeadForm(userId: string, accountId: string, name: string) {
  const now = new Date();
  const token = crypto.randomBytes(32).toString('hex');

  const [created] = await db.insert(crmLeadForms).values({
    accountId,
    userId,
    name,
    token,
    fields: DEFAULT_LEAD_FORM_FIELDS,
    createdAt: now,
    updatedAt: now,
  }).returning();

  logger.info({ userId, formId: created.id }, 'CRM lead form created');
  return created;
}

export async function updateLeadForm(userId: string, accountId: string, id: string, input: UpdateLeadFormInput) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) updates.name = input.name;
  if (input.fields !== undefined) updates.fields = input.fields;
  if (input.isActive !== undefined) updates.isActive = input.isActive;

  await db.update(crmLeadForms).set(updates)
    .where(and(eq(crmLeadForms.id, id), eq(crmLeadForms.accountId, accountId)));

  const [updated] = await db.select().from(crmLeadForms)
    .where(and(eq(crmLeadForms.id, id), eq(crmLeadForms.accountId, accountId)))
    .limit(1);

  return updated || null;
}

export async function deleteLeadForm(userId: string, accountId: string, id: string) {
  await db.delete(crmLeadForms)
    .where(and(eq(crmLeadForms.id, id), eq(crmLeadForms.accountId, accountId)));
}

export async function submitLeadForm(token: string, formData: Record<string, string>) {
  // Find form by token
  const [form] = await db.select().from(crmLeadForms)
    .where(and(eq(crmLeadForms.token, token), eq(crmLeadForms.isActive, true)))
    .limit(1);

  if (!form) return null;

  // Map form fields to lead fields using mapTo
  const mapped: Record<string, string> = {};
  const fields = form.fields as LeadFormFieldDef[];
  for (const field of fields) {
    if (field.mapTo && formData[field.id]) {
      mapped[field.mapTo] = formData[field.id];
    }
  }
  // Also support direct field name submission (backward compat)
  if (!mapped.name && formData.name) mapped.name = formData.name;
  if (!mapped.email && formData.email) mapped.email = formData.email;
  if (!mapped.phone && formData.phone) mapped.phone = formData.phone;
  if (!mapped.companyName && formData.companyName) mapped.companyName = formData.companyName;
  if (!mapped.message && formData.message) mapped.message = formData.message;

  // Create lead using existing createLead function
  const lead = await createLead(form.userId, form.accountId, {
    name: mapped.name || 'Web form submission',
    email: mapped.email ?? null,
    phone: mapped.phone ?? null,
    companyName: mapped.companyName ?? null,
    source: 'website',
    notes: mapped.message ?? null,
  });

  // Increment submit count
  await db.update(crmLeadForms).set({
    submitCount: sql`${crmLeadForms.submitCount} + 1`,
    updatedAt: new Date(),
  }).where(eq(crmLeadForms.id, form.id));

  logger.info({ formId: form.id, leadId: lead.id }, 'CRM lead form submitted');
  return lead;
}
