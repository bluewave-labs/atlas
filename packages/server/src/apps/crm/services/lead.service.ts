import { db } from '../../../config/database';
import { crmLeads, crmLeadForms, crmDeals } from '../../../db/schema';
import { eq, and, or, asc, desc, sql } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import crypto from 'crypto';
import type { CrmRecordAccess } from '@atlas-platform/shared';
import { createActivity } from './activity.service';
import { createContact, updateContact } from './contact.service';
import { createCompany } from './company.service';
import { createDeal } from './deal.service';

// ─── Input types ────────────────────────────────────────────────────

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

// ─── Leads ─────────────────────────────────────────────────────────

export async function listLeads(userId: string, tenantId: string, filters?: {
  status?: string;
  source?: string;
  search?: string;
  recordAccess?: CrmRecordAccess;
}) {
  const conditions = [eq(crmLeads.tenantId, tenantId)];
  if (!filters?.recordAccess || filters.recordAccess === 'own') {
    conditions.push(or(
      eq(crmLeads.userId, userId),
      eq(crmLeads.assignedUserId, userId),
    )!);
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

export async function getLead(userId: string, tenantId: string, id: string, recordAccess?: CrmRecordAccess) {
  const conditions = [eq(crmLeads.id, id), eq(crmLeads.tenantId, tenantId)];
  if (!recordAccess || recordAccess === 'own') {
    conditions.push(or(
      eq(crmLeads.userId, userId),
      eq(crmLeads.assignedUserId, userId),
    )!);
  }
  const [lead] = await db.select().from(crmLeads).where(and(...conditions)).limit(1);
  if (!lead) return null;

  // Attach convertedDealTitle via a lightweight lookup
  let convertedDealTitle: string | null = null;
  if (lead.convertedDealId) {
    const [deal] = await db
      .select({ title: crmDeals.title })
      .from(crmDeals)
      .where(eq(crmDeals.id, lead.convertedDealId))
      .limit(1);
    convertedDealTitle = deal?.title ?? null;
  }

  return { ...lead, convertedDealTitle };
}

export async function createLead(userId: string, tenantId: string, input: CreateLeadInput) {
  const now = new Date();
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${crmLeads.sortOrder}), -1)` })
    .from(crmLeads)
    .where(eq(crmLeads.userId, userId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db.insert(crmLeads).values({
    tenantId,
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

export async function updateLead(userId: string, tenantId: string, id: string, input: UpdateLeadInput, recordAccess?: CrmRecordAccess) {
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

  const conditions = [eq(crmLeads.id, id), eq(crmLeads.tenantId, tenantId)];
  if (!recordAccess || recordAccess === 'own') {
    conditions.push(or(
      eq(crmLeads.userId, userId),
      eq(crmLeads.assignedUserId, userId),
    )!);
  }

  await db.update(crmLeads).set(updates).where(and(...conditions));
  const [updated] = await db.select().from(crmLeads).where(and(...conditions)).limit(1);
  return updated || null;
}

export async function deleteLead(userId: string, tenantId: string, id: string, recordAccess?: CrmRecordAccess) {
  await updateLead(userId, tenantId, id, { isArchived: true }, recordAccess);
}

export async function enrichLead(userId: string, tenantId: string, leadId: string) {
  const { getProviderKeyForAccount, enrichLeadWithAI } = await import('../../../services/ai.service');

  const lead = await getLead(userId, tenantId, leadId, 'all');
  if (!lead) throw new Error('Lead not found');

  const config = await getProviderKeyForAccount(tenantId);
  const enriched = await enrichLeadWithAI(config, {
    name: lead.name,
    email: lead.email,
    phone: lead.phone,
    companyName: lead.companyName,
    source: lead.source,
  });

  const now = new Date();
  await db.update(crmLeads).set({ enrichedData: enriched, enrichedAt: now, updatedAt: now })
    .where(and(eq(crmLeads.id, leadId), eq(crmLeads.tenantId, tenantId)));

  // Log enrichment as an activity. crmActivities has no leadId FK, so we attach
  // to the converted contact when available; skip activity creation otherwise to
  // avoid creating a floating (unlinked) activity record.
  const summaryParts = [];
  if (enriched.companyIndustry) summaryParts.push(`Industry: ${enriched.companyIndustry}`);
  if (enriched.companySize) summaryParts.push(`Size: ${enriched.companySize}`);
  if (enriched.leadScore) summaryParts.push(`Score: ${enriched.leadScore}/100`);
  if (enriched.companyDescription) summaryParts.push(enriched.companyDescription);

  if (lead.convertedContactId) {
    await createActivity(userId, tenantId, {
      type: 'note',
      body: `__i18n:crm.activities.bodies.leadEnriched?summary=${encodeURIComponent(summaryParts.join('\n'))}`,
      contactId: lead.convertedContactId,
    });
  }

  logger.info({ userId, leadId }, 'CRM lead enriched via AI');
  return enriched;
}

export async function convertLead(userId: string, tenantId: string, leadId: string, options: {
  dealTitle: string;
  dealStageId: string;
  dealValue?: number;
}) {
  const lead = await getLead(userId, tenantId, leadId, 'all');
  if (!lead) throw new Error('Lead not found');
  if (lead.status === 'converted') throw new Error('Lead is already converted');

  // 1. Create a contact from the lead
  const contact = await createContact(userId, tenantId, {
    name: lead.name,
    email: lead.email ?? null,
    phone: lead.phone ?? null,
    source: lead.source,
    companyId: null,
  });

  // 2. Optionally create a company from lead's companyName
  let company = null;
  if (lead.companyName) {
    company = await createCompany(userId, tenantId, {
      name: lead.companyName,
    });
    // Link contact to company
    await updateContact(userId, tenantId, contact.id, { companyId: company.id }, 'all');
  }

  // 3. Create a deal
  const deal = await createDeal(userId, tenantId, {
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

// ─── Seed Sample Leads (standalone) ──────────────────────────────────

export async function seedSampleLeads(userId: string, tenantId: string) {
  // Idempotency guard
  const existing = await db.select({ id: crmLeads.id }).from(crmLeads)
    .where(and(eq(crmLeads.tenantId, tenantId), eq(crmLeads.isArchived, false))).limit(1);
  if (existing.length > 0) return { skipped: true, leads: 0 };

  await createLead(userId, tenantId, {
    name: 'TechStart Inc', email: 'info@techstart.io', phone: '+1-555-0201', source: 'website', companyName: 'TechStart Inc', notes: 'Interested in starter plan',
  });
  const metro = await createLead(userId, tenantId, {
    name: 'Metro Solutions', email: 'sales@metrosolutions.com', phone: '+1-555-0202', source: 'referral', companyName: 'Metro Solutions', notes: 'Called, scheduling demo',
  });
  const cloud = await createLead(userId, tenantId, {
    name: 'CloudNine Labs', email: 'hello@cloudninelabs.io', phone: '+1-555-0203', source: 'social_media', companyName: 'CloudNine Labs', notes: 'Budget approved, needs proposal',
  });

  await updateLead(userId, tenantId, metro.id, { status: 'contacted' });
  await updateLead(userId, tenantId, cloud.id, { status: 'qualified' });

  return { leads: 3 };
}

// ─── Lead Forms ───────────────────────────────────────────────────

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

export async function listLeadForms(userId: string, tenantId: string) {
  return db.select().from(crmLeadForms)
    .where(and(eq(crmLeadForms.tenantId, tenantId), eq(crmLeadForms.isArchived, false)))
    .orderBy(desc(crmLeadForms.createdAt));
}

export async function createLeadForm(userId: string, tenantId: string, name: string) {
  const now = new Date();
  const token = crypto.randomBytes(32).toString('hex');

  const [created] = await db.insert(crmLeadForms).values({
    tenantId,
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

export async function updateLeadForm(userId: string, tenantId: string, id: string, input: UpdateLeadFormInput) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) updates.name = input.name;
  if (input.fields !== undefined) updates.fields = input.fields;
  if (input.isActive !== undefined) updates.isActive = input.isActive;

  await db.update(crmLeadForms).set(updates)
    .where(and(eq(crmLeadForms.id, id), eq(crmLeadForms.tenantId, tenantId)));

  const [updated] = await db.select().from(crmLeadForms)
    .where(and(eq(crmLeadForms.id, id), eq(crmLeadForms.tenantId, tenantId)))
    .limit(1);

  return updated || null;
}

export async function deleteLeadForm(userId: string, tenantId: string, id: string) {
  await db.update(crmLeadForms)
    .set({ isArchived: true, isActive: false, updatedAt: new Date() })
    .where(and(eq(crmLeadForms.id, id), eq(crmLeadForms.tenantId, tenantId)));
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
  const lead = await createLead(form.userId, form.tenantId, {
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
