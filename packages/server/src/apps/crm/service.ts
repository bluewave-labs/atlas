import { db } from '../../config/database';
import { crmCompanies, crmContacts, crmDealStages, crmDeals, crmActivities } from '../../db/schema';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { logger } from '../../utils/logger';

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

interface UpdateDealStageInput extends Partial<CreateDealStageInput> {}

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
}) {
  const conditions = [eq(crmCompanies.userId, userId), eq(crmCompanies.accountId, accountId)];

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

export async function getCompany(userId: string, accountId: string, id: string) {
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
    .where(and(eq(crmCompanies.id, id), eq(crmCompanies.userId, userId), eq(crmCompanies.accountId, accountId)))
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

export async function updateCompany(userId: string, accountId: string, id: string, input: UpdateCompanyInput) {
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

  await db
    .update(crmCompanies)
    .set(updates)
    .where(and(eq(crmCompanies.id, id), eq(crmCompanies.userId, userId), eq(crmCompanies.accountId, accountId)));

  const [updated] = await db
    .select()
    .from(crmCompanies)
    .where(and(eq(crmCompanies.id, id), eq(crmCompanies.userId, userId), eq(crmCompanies.accountId, accountId)))
    .limit(1);

  return updated || null;
}

export async function deleteCompany(userId: string, accountId: string, id: string) {
  await updateCompany(userId, accountId, id, { isArchived: true });
}

// ─── Contacts ───────────────────────────────────────────────────────

export async function listContacts(userId: string, accountId: string, filters?: {
  search?: string;
  companyId?: string;
  includeArchived?: boolean;
}) {
  const conditions = [eq(crmContacts.userId, userId), eq(crmContacts.accountId, accountId)];

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

export async function getContact(userId: string, accountId: string, id: string) {
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
    .where(and(eq(crmContacts.id, id), eq(crmContacts.userId, userId), eq(crmContacts.accountId, accountId)))
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
  return created;
}

export async function updateContact(userId: string, accountId: string, id: string, input: UpdateContactInput) {
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

  await db
    .update(crmContacts)
    .set(updates)
    .where(and(eq(crmContacts.id, id), eq(crmContacts.userId, userId), eq(crmContacts.accountId, accountId)));

  const [updated] = await db
    .select()
    .from(crmContacts)
    .where(and(eq(crmContacts.id, id), eq(crmContacts.userId, userId), eq(crmContacts.accountId, accountId)))
    .limit(1);

  return updated || null;
}

export async function deleteContact(userId: string, accountId: string, id: string) {
  await updateContact(userId, accountId, id, { isArchived: true });
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
}) {
  const conditions = [eq(crmDeals.userId, userId), eq(crmDeals.accountId, accountId)];

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
    .orderBy(asc(crmDeals.sortOrder), asc(crmDeals.createdAt));
}

export async function getDeal(userId: string, accountId: string, id: string) {
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
    .where(and(eq(crmDeals.id, id), eq(crmDeals.userId, userId), eq(crmDeals.accountId, accountId)))
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
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, dealId: created.id }, 'CRM deal created');
  return created;
}

export async function updateDeal(userId: string, accountId: string, id: string, input: UpdateDealInput) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.title !== undefined) updates.title = input.title;
  if (input.value !== undefined) updates.value = input.value;
  if (input.stageId !== undefined) updates.stageId = input.stageId;
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
    .where(and(eq(crmDeals.id, id), eq(crmDeals.userId, userId), eq(crmDeals.accountId, accountId)));

  return getDeal(userId, accountId, id);
}

export async function deleteDeal(userId: string, accountId: string, id: string) {
  await updateDeal(userId, accountId, id, { isArchived: true });
}

export async function markDealWon(userId: string, accountId: string, id: string) {
  const now = new Date();
  await db
    .update(crmDeals)
    .set({ wonAt: now, lostAt: null, lostReason: null, probability: 100, updatedAt: now })
    .where(and(eq(crmDeals.id, id), eq(crmDeals.userId, userId), eq(crmDeals.accountId, accountId)));

  return getDeal(userId, accountId, id);
}

export async function markDealLost(userId: string, accountId: string, id: string, reason?: string) {
  const now = new Date();
  await db
    .update(crmDeals)
    .set({ lostAt: now, wonAt: null, lostReason: reason ?? null, probability: 0, updatedAt: now })
    .where(and(eq(crmDeals.id, id), eq(crmDeals.userId, userId), eq(crmDeals.accountId, accountId)));

  return getDeal(userId, accountId, id);
}

export async function countsByStage(userId: string, accountId: string) {
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
    .where(and(eq(crmDeals.userId, userId), eq(crmDeals.accountId, accountId), eq(crmDeals.isArchived, false)))
    .groupBy(crmDeals.stageId, crmDealStages.name, crmDealStages.color);
}

export async function pipelineValue(userId: string, accountId: string) {
  const [result] = await db
    .select({
      totalValue: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`.as('total_value'),
      dealCount: sql<number>`COUNT(*)`.as('deal_count'),
      weightedValue: sql<number>`COALESCE(SUM(${crmDeals.value} * ${crmDeals.probability} / 100.0), 0)`.as('weighted_value'),
    })
    .from(crmDeals)
    .where(and(
      eq(crmDeals.userId, userId),
      eq(crmDeals.accountId, accountId),
      eq(crmDeals.isArchived, false),
      sql`${crmDeals.wonAt} IS NULL AND ${crmDeals.lostAt} IS NULL`,
    ));

  return result || { totalValue: 0, dealCount: 0, weightedValue: 0 };
}

// ─── Activities ─────────────────────────────────────────────────────

export async function listActivities(userId: string, accountId: string, filters?: {
  dealId?: string;
  contactId?: string;
  companyId?: string;
  includeArchived?: boolean;
}) {
  const conditions = [eq(crmActivities.userId, userId), eq(crmActivities.accountId, accountId)];

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

  return db
    .select()
    .from(crmActivities)
    .where(and(...conditions))
    .orderBy(desc(crmActivities.createdAt));
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
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, activityId: created.id }, 'CRM activity created');
  return created;
}

export async function updateActivity(userId: string, accountId: string, id: string, input: UpdateActivityInput) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.type !== undefined) updates.type = input.type;
  if (input.body !== undefined) updates.body = input.body;
  if (input.dealId !== undefined) updates.dealId = input.dealId;
  if (input.contactId !== undefined) updates.contactId = input.contactId;
  if (input.companyId !== undefined) updates.companyId = input.companyId;
  if (input.scheduledAt !== undefined) updates.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  if (input.completedAt !== undefined) updates.completedAt = input.completedAt ? new Date(input.completedAt) : null;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  await db
    .update(crmActivities)
    .set(updates)
    .where(and(eq(crmActivities.id, id), eq(crmActivities.userId, userId), eq(crmActivities.accountId, accountId)));

  const [updated] = await db
    .select()
    .from(crmActivities)
    .where(and(eq(crmActivities.id, id), eq(crmActivities.userId, userId), eq(crmActivities.accountId, accountId)))
    .limit(1);

  return updated || null;
}

export async function deleteActivity(userId: string, accountId: string, id: string) {
  await updateActivity(userId, accountId, id, { isArchived: true });
}

// ─── Seed Sample Data ───────────────────────────────────────────────

export async function seedSampleData(userId: string, accountId: string) {
  // Idempotency guard — skip if data already exists
  const existing = await db.select({ id: crmCompanies.id }).from(crmCompanies)
    .where(eq(crmCompanies.userId, userId)).limit(1);
  if (existing.length > 0) return { skipped: true };

  // Seed default stages
  const stages = await seedDefaultStages(accountId);
  const leadStage = stages[0];
  const qualifiedStage = stages[1];
  const proposalStage = stages[2];
  const negotiationStage = stages[3];

  // Create sample companies
  const acme = await createCompany(userId, accountId, {
    name: 'Acme Corp', domain: 'acme.com', industry: 'Technology', size: '51-200', phone: '+1-555-1000',
  });
  const globex = await createCompany(userId, accountId, {
    name: 'Globex Inc', domain: 'globex.io', industry: 'Finance', size: '201-500', phone: '+1-555-2000',
  });
  const initech = await createCompany(userId, accountId, {
    name: 'Initech Solutions', domain: 'initech.com', industry: 'Consulting', size: '11-50',
  });
  const umbrella = await createCompany(userId, accountId, {
    name: 'Umbrella Partners', domain: 'umbrella.co', industry: 'Healthcare', size: '501-1000', phone: '+1-555-4000',
  });

  // Create sample contacts
  const johnSmith = await createContact(userId, accountId, {
    name: 'John Smith', email: 'john@acme.com', phone: '+1-555-1001',
    companyId: acme.id, position: 'CTO', source: 'referral',
  });
  const janeDoe = await createContact(userId, accountId, {
    name: 'Jane Doe', email: 'jane@globex.io', phone: '+1-555-2001',
    companyId: globex.id, position: 'VP of Engineering', source: 'website',
  });
  const bobJohnson = await createContact(userId, accountId, {
    name: 'Bob Johnson', email: 'bob@initech.com',
    companyId: initech.id, position: 'Director of IT', source: 'conference',
  });
  const aliceWong = await createContact(userId, accountId, {
    name: 'Alice Wong', email: 'alice@umbrella.co', phone: '+1-555-4001',
    companyId: umbrella.id, position: 'Head of Procurement', source: 'cold-email',
  });
  await createContact(userId, accountId, {
    name: 'Charlie Brown', email: 'charlie@acme.com',
    companyId: acme.id, position: 'Engineering Manager', source: 'referral',
  });

  // Create sample deals
  const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString();
  const twoMonths = new Date(Date.now() + 60 * 86400000).toISOString();
  const threeMonths = new Date(Date.now() + 90 * 86400000).toISOString();

  const deal1 = await createDeal(userId, accountId, {
    title: 'Acme Enterprise License', value: 50000, stageId: negotiationStage.id,
    contactId: johnSmith.id, companyId: acme.id, expectedCloseDate: nextMonth,
    probability: 75,
  });
  const deal2 = await createDeal(userId, accountId, {
    title: 'Globex Platform Migration', value: 120000, stageId: proposalStage.id,
    contactId: janeDoe.id, companyId: globex.id, expectedCloseDate: twoMonths,
    probability: 50,
  });
  await createDeal(userId, accountId, {
    title: 'Initech Consulting Package', value: 25000, stageId: qualifiedStage.id,
    contactId: bobJohnson.id, companyId: initech.id, expectedCloseDate: threeMonths,
    probability: 25,
  });
  await createDeal(userId, accountId, {
    title: 'Umbrella Annual Contract', value: 80000, stageId: leadStage.id,
    contactId: aliceWong.id, companyId: umbrella.id,
    probability: 10,
  });

  // Create sample activities
  await createActivity(userId, accountId, {
    type: 'call', body: 'Initial discovery call with John. Discussed current pain points and potential solutions.',
    dealId: deal1.id, contactId: johnSmith.id, companyId: acme.id,
  });
  await createActivity(userId, accountId, {
    type: 'meeting', body: 'Product demo with Jane and her team. Very positive feedback on the platform.',
    dealId: deal2.id, contactId: janeDoe.id, companyId: globex.id,
  });
  await createActivity(userId, accountId, {
    type: 'email', body: 'Sent proposal document to Bob for review.',
    contactId: bobJohnson.id, companyId: initech.id,
  });
  await createActivity(userId, accountId, {
    type: 'note', body: 'Alice mentioned they are evaluating three vendors. Follow up next week.',
    contactId: aliceWong.id, companyId: umbrella.id,
  });
  await createActivity(userId, accountId, {
    type: 'call', body: 'Follow-up call to discuss pricing. They want a 10% volume discount.',
    dealId: deal1.id, contactId: johnSmith.id, companyId: acme.id,
  });

  logger.info({ userId, accountId }, 'Seeded CRM sample data');
  return { companies: 4, contacts: 5, stages: stages.length, deals: 4, activities: 5 };
}
