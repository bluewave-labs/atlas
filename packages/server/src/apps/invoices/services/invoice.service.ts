import { db } from '../../../config/database';
import {
  invoices, invoiceLineItems, invoiceSettings, invoicePayments,
  crmCompanies, crmContacts, crmDeals,
  projectTimeEntries,
} from '../../../db/schema';
import { eq, and, asc, desc, inArray, sql } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import { getInvoiceSettings } from './settings.service';
import { recordPayment } from './payment.service';
import { replaceLineItems } from './line-item.service';

// ─── Input types ────────────────────────────────────────────────────

interface CreateInvoiceInput {
  companyId: string;
  contactId?: string | null;
  dealId?: string | null;
  proposalId?: string | null;
  invoiceNumber?: string;
  status?: string;
  subtotal?: number;
  taxPercent?: number;
  taxAmount?: number;
  discountPercent?: number;
  discountAmount?: number;
  total?: number;
  currency?: string;
  issueDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  timeEntryIds?: string[];
}

interface UpdateInvoiceInput {
  companyId?: string;
  contactId?: string | null;
  dealId?: string | null;
  proposalId?: string | null;
  invoiceNumber?: string;
  status?: string;
  subtotal?: number;
  taxPercent?: number;
  taxAmount?: number;
  discountPercent?: number;
  discountAmount?: number;
  total?: number;
  currency?: string;
  issueDate?: string | null;
  dueDate?: string | null;
  notes?: string | null;
  isArchived?: boolean;
  lineItems?: Array<{ description: string; quantity: number; unitPrice: number; taxRate?: number }>;
}

// ─── Invoices ───────────────────────────────────────────────────────

export async function listInvoices(userId: string, tenantId: string, filters?: {
  companyId?: string;
  contactId?: string;
  dealId?: string;
  status?: string;
  search?: string;
  includeArchived?: boolean;
  isAdmin?: boolean;
}) {
  const conditions = [eq(invoices.tenantId, tenantId)];

  // Non-admin users can only see invoices they created
  if (!filters?.isAdmin) {
    conditions.push(eq(invoices.userId, userId));
  }
  if (!filters?.includeArchived) {
    conditions.push(eq(invoices.isArchived, false));
  }
  if (filters?.companyId) {
    conditions.push(eq(invoices.companyId, filters.companyId));
  }
  if (filters?.contactId) {
    conditions.push(eq(invoices.contactId, filters.contactId));
  }
  if (filters?.dealId) {
    conditions.push(eq(invoices.dealId, filters.dealId));
  }
  // Status filter supports both stored statuses and computed virtual states
  // ('overdue' and 'unpaid'), which are derived from balance_due + due_date.
  if (filters?.status) {
    if (filters.status === 'overdue') {
      // Virtual: invoice has outstanding balance AND due date is in the past.
      // The stored status column can still be 'sent' or 'viewed' for these rows.
      conditions.push(sql`(
        ${invoices.dueDate} < NOW()
        AND ${invoices.status} NOT IN ('paid', 'waived', 'draft')
        AND ${invoices.total} > COALESCE((
          SELECT SUM(CASE WHEN ${invoicePayments.type} = 'payment' THEN ${invoicePayments.amount} ELSE -${invoicePayments.amount} END)
          FROM ${invoicePayments}
          WHERE ${invoicePayments.invoiceId} = ${invoices.id}
        ), 0)
      )`);
    } else if (filters.status === 'unpaid') {
      // Virtual: any invoice with a non-zero outstanding balance (and not draft/waived).
      conditions.push(sql`(
        ${invoices.status} NOT IN ('paid', 'waived', 'draft')
        AND ${invoices.total} > COALESCE((
          SELECT SUM(CASE WHEN ${invoicePayments.type} = 'payment' THEN ${invoicePayments.amount} ELSE -${invoicePayments.amount} END)
          FROM ${invoicePayments}
          WHERE ${invoicePayments.invoiceId} = ${invoices.id}
        ), 0)
      )`);
    } else {
      conditions.push(eq(invoices.status, filters.status));
    }
  }
  if (filters?.search) {
    const searchTerm = `%${filters.search}%`;
    conditions.push(sql`(${invoices.invoiceNumber} ILIKE ${searchTerm} OR ${crmCompanies.name} ILIKE ${searchTerm})`);
  }

  const rows = await db
    .select({
      id: invoices.id,
      tenantId: invoices.tenantId,
      userId: invoices.userId,
      companyId: invoices.companyId,
      contactId: invoices.contactId,
      dealId: invoices.dealId,
      proposalId: invoices.proposalId,
      invoiceNumber: invoices.invoiceNumber,
      status: invoices.status,
      subtotal: invoices.subtotal,
      taxPercent: invoices.taxPercent,
      taxAmount: invoices.taxAmount,
      discountPercent: invoices.discountPercent,
      discountAmount: invoices.discountAmount,
      total: invoices.total,
      currency: invoices.currency,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      notes: invoices.notes,
      sentAt: invoices.sentAt,
      viewedAt: invoices.viewedAt,
      paidAt: invoices.paidAt,
      isArchived: invoices.isArchived,
      createdAt: invoices.createdAt,
      updatedAt: invoices.updatedAt,
      eFaturaType: invoices.eFaturaType,
      eFaturaUuid: invoices.eFaturaUuid,
      eFaturaStatus: invoices.eFaturaStatus,
      companyName: crmCompanies.name,
      contactName: crmContacts.name,
      contactEmail: crmContacts.email,
      dealTitle: crmDeals.title,
      lineItemCount: sql<number>`(SELECT COUNT(*) FROM invoice_line_items WHERE invoice_id = ${invoices.id})`.as('line_item_count'),
      amountPaid: sql<number>`COALESCE((
        SELECT SUM(CASE WHEN ${invoicePayments.type} = 'payment' THEN ${invoicePayments.amount} ELSE -${invoicePayments.amount} END)
        FROM ${invoicePayments}
        WHERE ${invoicePayments.invoiceId} = ${invoices.id}
      ), 0)`.as('amount_paid'),
    })
    .from(invoices)
    .leftJoin(crmCompanies, eq(invoices.companyId, crmCompanies.id))
    .leftJoin(crmContacts, eq(invoices.contactId, crmContacts.id))
    .leftJoin(crmDeals, eq(invoices.dealId, crmDeals.id))
    .where(and(...conditions))
    .orderBy(desc(invoices.createdAt));

  return rows.map((row) => {
    const total = Number(row.total) || 0;
    const amountPaid = Math.round((Number(row.amountPaid) || 0) * 100) / 100;
    const balanceDue = Math.round((total - amountPaid) * 100) / 100;
    return { ...row, amountPaid, balanceDue };
  });
}

export async function getInvoice(userId: string, tenantId: string, id: string, ownerUserId?: string) {
  const conditions = [eq(invoices.id, id), eq(invoices.tenantId, tenantId)];
  if (ownerUserId) {
    conditions.push(eq(invoices.userId, ownerUserId));
  }
  const [invoice] = await db
    .select({
      id: invoices.id,
      tenantId: invoices.tenantId,
      userId: invoices.userId,
      companyId: invoices.companyId,
      contactId: invoices.contactId,
      dealId: invoices.dealId,
      proposalId: invoices.proposalId,
      invoiceNumber: invoices.invoiceNumber,
      status: invoices.status,
      subtotal: invoices.subtotal,
      taxPercent: invoices.taxPercent,
      taxAmount: invoices.taxAmount,
      discountPercent: invoices.discountPercent,
      discountAmount: invoices.discountAmount,
      total: invoices.total,
      currency: invoices.currency,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      notes: invoices.notes,
      sentAt: invoices.sentAt,
      viewedAt: invoices.viewedAt,
      paidAt: invoices.paidAt,
      isArchived: invoices.isArchived,
      createdAt: invoices.createdAt,
      updatedAt: invoices.updatedAt,
      eFaturaType: invoices.eFaturaType,
      eFaturaUuid: invoices.eFaturaUuid,
      eFaturaStatus: invoices.eFaturaStatus,
      companyName: crmCompanies.name,
      contactName: crmContacts.name,
      contactEmail: crmContacts.email,
      dealTitle: crmDeals.title,
      amountPaid: sql<number>`COALESCE((
        SELECT SUM(CASE WHEN ${invoicePayments.type} = 'payment' THEN ${invoicePayments.amount} ELSE -${invoicePayments.amount} END)
        FROM ${invoicePayments}
        WHERE ${invoicePayments.invoiceId} = ${invoices.id}
      ), 0)`.as('amount_paid'),
    })
    .from(invoices)
    .leftJoin(crmCompanies, eq(invoices.companyId, crmCompanies.id))
    .leftJoin(crmContacts, eq(invoices.contactId, crmContacts.id))
    .leftJoin(crmDeals, eq(invoices.dealId, crmDeals.id))
    .where(and(...conditions))
    .limit(1);

  if (!invoice) return null;

  // Fetch line items
  const lineItems = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, id))
    .orderBy(asc(invoiceLineItems.sortOrder), asc(invoiceLineItems.createdAt));

  const total = Number(invoice.total) || 0;
  const amountPaid = Math.round((Number(invoice.amountPaid) || 0) * 100) / 100;
  const balanceDue = Math.round((total - amountPaid) * 100) / 100;

  return { ...invoice, amountPaid, balanceDue, lineItems };
}

export async function getNextInvoiceNumber(tenantId: string): Promise<string> {
  // Read the prefix first (needed for formatting)
  const settings = await getInvoiceSettings(tenantId);
  const prefix = settings?.invoicePrefix || 'INV';

  // Atomically increment and return the number in a single query to avoid race conditions
  const [updated] = await db
    .update(invoiceSettings)
    .set({ nextInvoiceNumber: sql`COALESCE(${invoiceSettings.nextInvoiceNumber}, 1) + 1`, updatedAt: new Date() })
    .where(eq(invoiceSettings.tenantId, tenantId))
    .returning({ num: invoiceSettings.nextInvoiceNumber });

  if (!updated) {
    // No settings row exists yet -- create one with nextInvoiceNumber = 2 (we use 1 now)
    await db.insert(invoiceSettings).values({ tenantId, nextInvoiceNumber: 2 }).onConflictDoNothing();
    return `${prefix}-${String(1).padStart(3, '0')}`;
  }

  // updated.num is the value AFTER increment, so the number we use is num - 1
  const num = updated.num - 1;
  return `${prefix}-${String(num).padStart(3, '0')}`;
}

export async function createInvoice(userId: string, tenantId: string, input: CreateInvoiceInput) {
  const now = new Date();
  const invoiceNumber = input.invoiceNumber || await getNextInvoiceNumber(tenantId);

  // If timeEntryIds are provided, use a transaction to atomically create invoice + mark time entries
  if (input.timeEntryIds && input.timeEntryIds.length > 0) {
    return db.transaction(async (tx) => {
      const [created] = await tx
        .insert(invoices)
        .values({
          tenantId,
          userId,
          companyId: input.companyId,
          contactId: input.contactId ?? null,
          dealId: input.dealId ?? null,
          proposalId: input.proposalId ?? null,
          invoiceNumber,
          status: input.status ?? 'draft',
          subtotal: input.subtotal ?? 0,
          taxPercent: input.taxPercent ?? 0,
          taxAmount: input.taxAmount ?? 0,
          discountPercent: input.discountPercent ?? 0,
          discountAmount: input.discountAmount ?? 0,
          total: input.total ?? 0,
          currency: input.currency ?? 'USD',
          issueDate: input.issueDate ? new Date(input.issueDate) : now,
          dueDate: input.dueDate ? new Date(input.dueDate) : now,
          notes: input.notes ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // Mark time entries as billed and locked
      await tx
        .update(projectTimeEntries)
        .set({ billed: true, locked: true, updatedAt: now })
        .where(inArray(projectTimeEntries.id, input.timeEntryIds!));

      logger.info({ userId, invoiceId: created.id, invoiceNumber, timeEntries: input.timeEntryIds!.length }, 'Invoice created with time entries');
      return created;
    });
  }

  const [created] = await db
    .insert(invoices)
    .values({
      tenantId,
      userId,
      companyId: input.companyId,
      contactId: input.contactId ?? null,
      dealId: input.dealId ?? null,
      proposalId: input.proposalId ?? null,
      invoiceNumber,
      status: input.status ?? 'draft',
      subtotal: input.subtotal ?? 0,
      taxPercent: input.taxPercent ?? 0,
      taxAmount: input.taxAmount ?? 0,
      discountPercent: input.discountPercent ?? 0,
      discountAmount: input.discountAmount ?? 0,
      total: input.total ?? 0,
      currency: input.currency ?? 'USD',
      issueDate: input.issueDate ? new Date(input.issueDate) : now,
      dueDate: input.dueDate ? new Date(input.dueDate) : now,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, invoiceId: created.id, invoiceNumber }, 'Invoice created');
  return created;
}

export async function updateInvoice(userId: string, tenantId: string, id: string, input: UpdateInvoiceInput, ownerUserId?: string) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.companyId !== undefined) updates.companyId = input.companyId;
  if (input.contactId !== undefined) updates.contactId = input.contactId;
  if (input.dealId !== undefined) updates.dealId = input.dealId;
  if (input.proposalId !== undefined) updates.proposalId = input.proposalId;
  if (input.invoiceNumber !== undefined) updates.invoiceNumber = input.invoiceNumber;
  if (input.status !== undefined) updates.status = input.status;
  if (input.subtotal !== undefined) updates.subtotal = input.subtotal;
  if (input.taxPercent !== undefined) updates.taxPercent = input.taxPercent;
  if (input.taxAmount !== undefined) updates.taxAmount = input.taxAmount;
  if (input.discountPercent !== undefined) updates.discountPercent = input.discountPercent;
  if (input.discountAmount !== undefined) updates.discountAmount = input.discountAmount;
  if (input.total !== undefined) updates.total = input.total;
  if (input.currency !== undefined) updates.currency = input.currency;
  if (input.issueDate !== undefined) updates.issueDate = input.issueDate ? new Date(input.issueDate) : null;
  if (input.dueDate !== undefined) updates.dueDate = input.dueDate ? new Date(input.dueDate) : null;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  const conditions = [eq(invoices.id, id), eq(invoices.tenantId, tenantId)];
  if (ownerUserId) {
    conditions.push(eq(invoices.userId, ownerUserId));
  }

  const [updated] = await db
    .update(invoices)
    .set(updates)
    .where(and(...conditions))
    .returning();

  if (!updated) return null;

  if (input.lineItems !== undefined) {
    await replaceLineItems(id, input.lineItems);
  }

  return updated;
}

export async function deleteInvoice(userId: string, tenantId: string, id: string, ownerUserId?: string) {
  // Ownership guard: when a non-admin caller passes ownerUserId, verify the
  // invoice belongs to them before touching any related rows. Returns false
  // if the invoice is not found under the scoping filters.
  const existing = await getInvoice(userId, tenantId, id, ownerUserId);
  if (!existing) return false;

  // When an invoice is deleted, unmark all linked time entries
  const lineItems = await db
    .select({ timeEntryId: invoiceLineItems.timeEntryId })
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, id));

  const timeEntryIds = lineItems
    .map(li => li.timeEntryId)
    .filter((id): id is string => id !== null);

  if (timeEntryIds.length > 0) {
    await db
      .update(projectTimeEntries)
      .set({ billed: false, locked: false, invoiceLineItemId: null, updatedAt: new Date() })
      .where(inArray(projectTimeEntries.id, timeEntryIds));
  }

  await updateInvoice(userId, tenantId, id, { isArchived: true }, ownerUserId);
  return true;
}

export async function sendInvoice(userId: string, tenantId: string, id: string) {
  const now = new Date();
  const [invoice] = await db
    .update(invoices)
    .set({ status: 'sent', sentAt: now, updatedAt: now })
    .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
    .returning();

  return invoice ?? null;
}

export async function markInvoiceViewed(tenantId: string, id: string) {
  const now = new Date();
  await db
    .update(invoices)
    .set({ status: 'viewed', viewedAt: now, updatedAt: now })
    .where(and(
      eq(invoices.id, id),
      eq(invoices.tenantId, tenantId),
      sql`${invoices.viewedAt} IS NULL`,
    ));
}

export async function markInvoicePaid(userId: string, tenantId: string, id: string) {
  // Load the invoice first so we know the total and currency.
  const [existing] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
    .limit(1);

  if (!existing) return null;

  // If already paid, nothing to do — return as-is to preserve idempotency.
  if (existing.status === 'paid') {
    return existing;
  }

  // Compute the remaining balance so "mark as paid" records only what's outstanding
  // (not the full total) when partial payments already exist.
  const [{ netPaid }] = await db
    .select({
      netPaid: sql<number>`COALESCE(SUM(CASE WHEN type = 'payment' THEN amount ELSE -amount END), 0)`,
    })
    .from(sql`invoice_payments`)
    .where(sql`invoice_id = ${id}`);

  const outstanding = Math.max(0, existing.total - (Number(netPaid) || 0));

  if (outstanding > 0) {
    await recordPayment(
      {
        invoiceId: id,
        type: 'payment',
        amount: outstanding,
        currency: existing.currency,
        paymentDate: new Date(),
        method: 'other',
        notes: 'Marked as paid',
      },
      userId,
      tenantId,
    );
  }

  // recordPayment calls updateInvoicePaidStatus which flips the invoice to 'paid'.
  // Return the refreshed invoice row.
  const [updated] = await db
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, id), eq(invoices.tenantId, tenantId)))
    .limit(1);

  return updated ?? null;
}

export async function duplicateInvoice(userId: string, tenantId: string, id: string) {
  const existing = await getInvoice(userId, tenantId, id);
  if (!existing) return null;

  const invoiceNumber = await getNextInvoiceNumber(tenantId);
  const now = new Date();

  const [newInvoice] = await db
    .insert(invoices)
    .values({
      tenantId,
      userId,
      companyId: existing.companyId,
      contactId: existing.contactId,
      dealId: existing.dealId,
      proposalId: existing.proposalId,
      invoiceNumber,
      status: 'draft',
      subtotal: existing.subtotal,
      taxPercent: existing.taxPercent,
      taxAmount: existing.taxAmount,
      discountPercent: existing.discountPercent,
      discountAmount: existing.discountAmount,
      total: existing.total,
      currency: existing.currency,
      issueDate: existing.issueDate,
      dueDate: existing.dueDate,
      notes: existing.notes,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // Duplicate line items in a single batch insert (without time entry links)
  if (existing.lineItems && existing.lineItems.length > 0) {
    await db.insert(invoiceLineItems).values(
      existing.lineItems.map((li, idx) => ({
        invoiceId: newInvoice.id,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        amount: li.amount,
        taxRate: li.taxRate,
        sortOrder: idx,
        createdAt: now,
      }))
    );
  }

  return newInvoice;
}

export async function waiveInvoice(userId: string, tenantId: string, id: string) {
  const [invoice] = await db
    .update(invoices)
    .set({ status: 'waived', updatedAt: new Date() })
    .where(and(
      eq(invoices.id, id),
      eq(invoices.tenantId, tenantId),
      eq(invoices.isArchived, false),
    ))
    .returning();

  return invoice || null;
}
