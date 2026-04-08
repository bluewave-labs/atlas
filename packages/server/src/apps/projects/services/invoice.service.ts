import { db } from '../../../config/database';
import {
  projectInvoices, projectInvoiceLineItems, projectClients,
  projectTimeEntries,
  projectSettings,
} from '../../../db/schema';
import { eq, and, asc, desc, inArray, sql } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import { getSettings } from './settings.service';

// ─── Input types ────────────────────────────────────────────────────

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

// ─── Invoices ───────────────────────────────────────────────────────

export async function listInvoices(userId: string, tenantId: string, filters?: {
  clientId?: string;
  status?: string;
  search?: string;
  includeArchived?: boolean;
  isAdmin?: boolean;
}) {
  const conditions = [eq(projectInvoices.tenantId, tenantId)];

  // Non-admin users can only see invoices they created
  if (!filters?.isAdmin) {
    conditions.push(eq(projectInvoices.userId, userId));
  }
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
      tenantId: projectInvoices.tenantId,
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
      eFaturaType: projectInvoices.eFaturaType,
      eFaturaUuid: projectInvoices.eFaturaUuid,
      eFaturaStatus: projectInvoices.eFaturaStatus,
      clientName: projectClients.name,
      lineItemCount: sql<number>`(SELECT COUNT(*) FROM project_invoice_line_items WHERE invoice_id = ${projectInvoices.id})`.as('line_item_count'),
    })
    .from(projectInvoices)
    .leftJoin(projectClients, eq(projectInvoices.clientId, projectClients.id))
    .where(and(...conditions))
    .orderBy(desc(projectInvoices.createdAt));
}

export async function getInvoice(userId: string, tenantId: string, id: string) {
  const [invoice] = await db
    .select({
      id: projectInvoices.id,
      tenantId: projectInvoices.tenantId,
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
      eFaturaType: projectInvoices.eFaturaType,
      eFaturaUuid: projectInvoices.eFaturaUuid,
      eFaturaStatus: projectInvoices.eFaturaStatus,
      clientName: projectClients.name,
    })
    .from(projectInvoices)
    .leftJoin(projectClients, eq(projectInvoices.clientId, projectClients.id))
    .where(and(eq(projectInvoices.id, id), eq(projectInvoices.tenantId, tenantId)))
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

export async function getNextInvoiceNumber(tenantId: string): Promise<string> {
  // Read the prefix first (needed for formatting)
  const settings = await getSettings(tenantId);
  const prefix = settings?.invoicePrefix || 'INV';

  // Atomically increment and return the number in a single query to avoid race conditions
  const [updated] = await db
    .update(projectSettings)
    .set({ nextInvoiceNumber: sql`COALESCE(${projectSettings.nextInvoiceNumber}, 1) + 1`, updatedAt: new Date() })
    .where(eq(projectSettings.tenantId, tenantId))
    .returning({ num: projectSettings.nextInvoiceNumber });

  if (!updated) {
    // No settings row exists yet -- create one with nextInvoiceNumber = 2 (we use 1 now)
    await db.insert(projectSettings).values({ tenantId, nextInvoiceNumber: 2 }).onConflictDoNothing();
    return `${prefix}-${String(1).padStart(3, '0')}`;
  }

  // updated.num is the value AFTER increment, so the number we use is num - 1
  const num = updated.num - 1;
  return `${prefix}-${String(num).padStart(3, '0')}`;
}

export async function createInvoice(userId: string, tenantId: string, input: CreateInvoiceInput) {
  const now = new Date();
  const invoiceNumber = input.invoiceNumber || await getNextInvoiceNumber(tenantId);

  const [created] = await db
    .insert(projectInvoices)
    .values({
      tenantId,
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

export async function updateInvoice(userId: string, tenantId: string, id: string, input: UpdateInvoiceInput) {
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

  const conditions = [eq(projectInvoices.id, id), eq(projectInvoices.tenantId, tenantId)];

  const [updated] = await db
    .update(projectInvoices)
    .set(updates)
    .where(and(...conditions))
    .returning();

  return updated ?? null;
}

export async function deleteInvoice(userId: string, tenantId: string, id: string) {
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

  await updateInvoice(userId, tenantId, id, { isArchived: true });
}

export async function sendInvoice(userId: string, tenantId: string, id: string) {
  const now = new Date();
  const [invoice] = await db
    .update(projectInvoices)
    .set({ status: 'sent', sentAt: now, updatedAt: now })
    .where(and(eq(projectInvoices.id, id), eq(projectInvoices.tenantId, tenantId)))
    .returning();

  return invoice ?? null;
}

export async function markInvoiceViewed(tenantId: string, id: string) {
  const now = new Date();
  await db
    .update(projectInvoices)
    .set({ status: 'viewed', viewedAt: now, updatedAt: now })
    .where(and(
      eq(projectInvoices.id, id),
      eq(projectInvoices.tenantId, tenantId),
      sql`${projectInvoices.viewedAt} IS NULL`,
    ));
}

export async function markInvoicePaid(userId: string, tenantId: string, id: string) {
  const now = new Date();
  const [invoice] = await db
    .update(projectInvoices)
    .set({ status: 'paid', paidAt: now, updatedAt: now })
    .where(and(eq(projectInvoices.id, id), eq(projectInvoices.tenantId, tenantId)))
    .returning();

  return invoice ?? null;
}

export async function duplicateInvoice(userId: string, tenantId: string, id: string) {
  const existing = await getInvoice(userId, tenantId, id);
  if (!existing) return null;

  const invoiceNumber = await getNextInvoiceNumber(tenantId);
  const now = new Date();

  const [newInvoice] = await db
    .insert(projectInvoices)
    .values({
      tenantId,
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

export async function waiveInvoice(userId: string, tenantId: string, id: string) {
  const [invoice] = await db
    .update(projectInvoices)
    .set({ status: 'waived', updatedAt: new Date() })
    .where(and(
      eq(projectInvoices.id, id),
      eq(projectInvoices.tenantId, tenantId),
      eq(projectInvoices.isArchived, false),
    ))
    .returning();

  return invoice || null;
}
