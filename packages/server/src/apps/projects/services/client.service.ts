import { db } from '../../../config/database';
import {
  projectClients, projectInvoices, projectInvoiceLineItems,
} from '../../../db/schema';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import { getSettings } from './settings.service';
import { markInvoiceViewed } from './invoice.service';

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
