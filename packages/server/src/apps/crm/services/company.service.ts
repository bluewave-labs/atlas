import { db } from '../../../config/database';
import { crmCompanies, crmContacts, crmDeals, crmActivities, crmNotes } from '../../../db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
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

// ─── Companies ──────────────────────────────────────────────────────

export async function listCompanies(userId: string, tenantId: string, filters?: {
  search?: string;
  industry?: string;
  includeArchived?: boolean;
  recordAccess?: CrmRecordAccess;
}) {
  const conditions = [eq(crmCompanies.tenantId, tenantId)];
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
      tenantId: crmCompanies.tenantId,
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
        tenantId: crmCompanies.tenantId,
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

export async function getCompany(userId: string, tenantId: string, id: string, recordAccess?: CrmRecordAccess) {
  const conditions = [eq(crmCompanies.id, id), eq(crmCompanies.tenantId, tenantId)];
  if (!recordAccess || recordAccess === 'own') {
    conditions.push(eq(crmCompanies.userId, userId));
  }

  const [company] = await db
    .select({
      id: crmCompanies.id,
      tenantId: crmCompanies.tenantId,
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

export async function createCompany(userId: string, tenantId: string, input: CreateCompanyInput) {
  const now = new Date();

  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${crmCompanies.sortOrder}), -1)` })
    .from(crmCompanies)
    .where(eq(crmCompanies.userId, userId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(crmCompanies)
    .values({
      tenantId,
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

export async function updateCompany(userId: string, tenantId: string, id: string, input: UpdateCompanyInput, recordAccess?: CrmRecordAccess) {
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

  const updateConditions = [eq(crmCompanies.id, id), eq(crmCompanies.tenantId, tenantId)];
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

export async function deleteCompany(userId: string, tenantId: string, id: string, recordAccess?: CrmRecordAccess) {
  await updateCompany(userId, tenantId, id, { isArchived: true }, recordAccess);
}

// ─── Bulk Import ───────────────────────────────────────────────────────

export async function bulkCreateCompanies(
  userId: string,
  tenantId: string,
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
      await createCompany(userId, tenantId, {
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

  logger.info({ userId, tenantId, imported, failed }, 'Bulk imported CRM companies');
  return { imported, failed, errors };
}

// ─── Merge Companies ─────────────────────────────────────────────────

export async function mergeCompanies(userId: string, tenantId: string, primaryId: string, secondaryId: string) {
  const [primary] = await db.select().from(crmCompanies)
    .where(and(eq(crmCompanies.id, primaryId), eq(crmCompanies.tenantId, tenantId))).limit(1);
  const [secondary] = await db.select().from(crmCompanies)
    .where(and(eq(crmCompanies.id, secondaryId), eq(crmCompanies.tenantId, tenantId))).limit(1);

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
  return getCompany(userId, tenantId, primaryId, 'all');
}
