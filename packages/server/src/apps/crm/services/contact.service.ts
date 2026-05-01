import { db } from '../../../config/database';
import { crmCompanies, crmContacts, crmDeals, crmActivities, crmNotes } from '../../../db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import type { CrmRecordAccess } from '@atlas-platform/shared';
import { executeWorkflows } from './workflow.service';
import { backfillContactMessages } from './contact-message-backfill.service';

// ─── Input types ────────────────────────────────────────────────────

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

// ─── Contacts ───────────────────────────────────────────────────────

export async function listContacts(userId: string, tenantId: string, filters?: {
  search?: string;
  companyId?: string;
  includeArchived?: boolean;
  recordAccess?: CrmRecordAccess;
}) {
  const conditions = [eq(crmContacts.tenantId, tenantId)];
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
      tenantId: crmContacts.tenantId,
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

export async function getContact(userId: string, tenantId: string, id: string, recordAccess?: CrmRecordAccess) {
  const conditions = [eq(crmContacts.id, id), eq(crmContacts.tenantId, tenantId)];
  if (!recordAccess || recordAccess === 'own') {
    conditions.push(eq(crmContacts.userId, userId));
  }

  const [contact] = await db
    .select({
      id: crmContacts.id,
      tenantId: crmContacts.tenantId,
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

export async function createContact(userId: string, tenantId: string, input: CreateContactInput) {
  const now = new Date();

  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${crmContacts.sortOrder}), -1)` })
    .from(crmContacts)
    .where(eq(crmContacts.userId, userId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(crmContacts)
    .values({
      tenantId,
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
  executeWorkflows(tenantId, userId, 'contact_created', { contactId: created.id })
    .catch((err) => logger.warn({ err, trigger: 'contact_created' }, 'Workflow dispatch failed'));

  // Phase 3a: retroactively link prior messages to this contact.
  // Fire-and-forget — backfill failures should not block contact creation.
  backfillContactMessages(tenantId, created.id, userId)
    .catch((err) => logger.error({ err, contactId: created.id }, 'Contact backfill failed'));

  return created;
}

export async function updateContact(userId: string, tenantId: string, id: string, input: UpdateContactInput, recordAccess?: CrmRecordAccess) {
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

  const updateConditions = [eq(crmContacts.id, id), eq(crmContacts.tenantId, tenantId)];
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

export async function deleteContact(userId: string, tenantId: string, id: string, recordAccess?: CrmRecordAccess) {
  await updateContact(userId, tenantId, id, { isArchived: true }, recordAccess);
}

// ─── Bulk Import ───────────────────────────────────────────────────────

export async function bulkCreateContacts(
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
      await createContact(userId, tenantId, {
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

  logger.info({ userId, tenantId, imported, failed }, 'Bulk imported CRM contacts');
  return { imported, failed, errors };
}

// ─── Merge Contacts ─────────────────────────────────────────────────

export async function mergeContacts(userId: string, tenantId: string, primaryId: string, secondaryId: string) {
  const [primary] = await db.select().from(crmContacts)
    .where(and(eq(crmContacts.id, primaryId), eq(crmContacts.tenantId, tenantId))).limit(1);
  const [secondary] = await db.select().from(crmContacts)
    .where(and(eq(crmContacts.id, secondaryId), eq(crmContacts.tenantId, tenantId))).limit(1);

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
  return getContact(userId, tenantId, primaryId, 'all');
}
