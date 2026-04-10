import { db } from '../../../config/database';
import {
  recurringInvoices,
  recurringInvoiceLineItems,
  invoices,
  invoiceLineItems,
  crmCompanies,
} from '../../../db/schema';
import { and, asc, desc, eq } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import { AppError } from '../../../middleware/error-handler';
import { getNextInvoiceNumber, sendInvoice } from './invoice.service';
import { sendInvoiceEmail } from './invoice-email.service';
import type {
  RecurringInvoice,
  RecurringInvoiceLineItem,
  CreateRecurringInvoiceInput,
  UpdateRecurringInvoiceInput,
  RecurrenceFrequency,
} from '@atlas-platform/shared';

// ─── Helpers ────────────────────────────────────────────────────────

const VALID_FREQUENCIES: RecurrenceFrequency[] = ['weekly', 'monthly', 'quarterly', 'yearly'];

function addFrequency(from: Date, frequency: RecurrenceFrequency): Date {
  const d = new Date(from);
  switch (frequency) {
    case 'weekly':
      return new Date(from.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      return d;
    case 'quarterly':
      d.setMonth(d.getMonth() + 3);
      return d;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      return d;
    default:
      throw new AppError(400, 'Invalid frequency');
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseDate(value: Date | string, field: string): Date {
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) {
    throw new AppError(400, `Invalid date for ${field}`);
  }
  return d;
}

async function fetchRecurringWithItems(
  id: string,
  tenantId: string,
): Promise<RecurringInvoice> {
  const [row] = await db
    .select()
    .from(recurringInvoices)
    .where(and(eq(recurringInvoices.id, id), eq(recurringInvoices.tenantId, tenantId)))
    .limit(1);

  if (!row) {
    throw new AppError(404, 'Recurring invoice not found');
  }

  const items = await db
    .select()
    .from(recurringInvoiceLineItems)
    .where(eq(recurringInvoiceLineItems.recurringInvoiceId, id))
    .orderBy(asc(recurringInvoiceLineItems.sortOrder));

  return { ...(row as unknown as RecurringInvoice), lineItems: items as unknown as RecurringInvoiceLineItem[] };
}

// ─── CRUD ───────────────────────────────────────────────────────────

export async function listRecurringInvoices(
  tenantId: string,
  userId: string,
  isAdmin: boolean,
): Promise<RecurringInvoice[]> {
  const conditions = [eq(recurringInvoices.tenantId, tenantId)];
  if (!isAdmin) {
    conditions.push(eq(recurringInvoices.userId, userId));
  }

  const rows = await db
    .select()
    .from(recurringInvoices)
    .where(and(...conditions))
    .orderBy(desc(recurringInvoices.createdAt));

  return rows as unknown as RecurringInvoice[];
}

export async function getRecurringInvoice(
  id: string,
  tenantId: string,
): Promise<RecurringInvoice> {
  return fetchRecurringWithItems(id, tenantId);
}

export async function createRecurringInvoice(
  input: CreateRecurringInvoiceInput,
  userId: string,
  tenantId: string,
): Promise<RecurringInvoice> {
  // ── Validation ──
  if (!input.title || !input.title.trim()) {
    throw new AppError(400, 'Title is required');
  }
  if (!input.companyId) {
    throw new AppError(400, 'Company is required');
  }
  if (!VALID_FREQUENCIES.includes(input.frequency)) {
    throw new AppError(400, 'Invalid frequency');
  }
  const startDate = parseDate(input.startDate, 'startDate');
  let endDate: Date | null = null;
  if (input.endDate != null) {
    endDate = parseDate(input.endDate, 'endDate');
    if (endDate <= startDate) {
      throw new AppError(400, 'endDate must be after startDate');
    }
  }
  if (input.maxRuns != null && input.maxRuns <= 0) {
    throw new AppError(400, 'maxRuns must be greater than 0');
  }
  if (input.paymentTermsDays != null && input.paymentTermsDays < 0) {
    throw new AppError(400, 'paymentTermsDays must be >= 0');
  }
  if (!Array.isArray(input.lineItems) || input.lineItems.length === 0) {
    throw new AppError(400, 'At least one line item is required');
  }

  // Verify company belongs to the tenant
  const [company] = await db
    .select({ id: crmCompanies.id })
    .from(crmCompanies)
    .where(and(eq(crmCompanies.id, input.companyId), eq(crmCompanies.tenantId, tenantId)))
    .limit(1);
  if (!company) {
    throw new AppError(404, 'Company not found');
  }

  const now = new Date();

  const created = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(recurringInvoices)
      .values({
        tenantId,
        userId,
        companyId: input.companyId,
        title: input.title.trim(),
        description: input.description ?? null,
        currency: input.currency ?? 'USD',
        taxPercent: input.taxPercent ?? 0,
        discountPercent: input.discountPercent ?? 0,
        notes: input.notes ?? null,
        paymentInstructions: input.paymentInstructions ?? null,
        frequency: input.frequency,
        startDate,
        endDate,
        nextRunAt: startDate, // first generation is at startDate
        lastRunAt: null,
        runCount: 0,
        maxRuns: input.maxRuns ?? null,
        autoSend: input.autoSend ?? false,
        paymentTermsDays: input.paymentTermsDays ?? 30,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await tx.insert(recurringInvoiceLineItems).values(
      input.lineItems.map((li, idx) => ({
        recurringInvoiceId: row.id,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        taxRate: li.taxRate ?? 0,
        sortOrder: idx,
      })),
    );

    return row;
  });

  logger.info({ userId, tenantId, recurringInvoiceId: created.id }, 'Recurring invoice created');
  return fetchRecurringWithItems(created.id, tenantId);
}

export async function updateRecurringInvoice(
  id: string,
  input: UpdateRecurringInvoiceInput,
  tenantId: string,
): Promise<RecurringInvoice> {
  const existing = await fetchRecurringWithItems(id, tenantId);

  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (input.title !== undefined) {
    if (!input.title || !input.title.trim()) {
      throw new AppError(400, 'Title cannot be empty');
    }
    updates.title = input.title.trim();
  }
  if (input.description !== undefined) updates.description = input.description;
  if (input.currency !== undefined) updates.currency = input.currency;
  if (input.taxPercent !== undefined) updates.taxPercent = input.taxPercent;
  if (input.discountPercent !== undefined) updates.discountPercent = input.discountPercent;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.paymentInstructions !== undefined) updates.paymentInstructions = input.paymentInstructions;
  if (input.autoSend !== undefined) updates.autoSend = input.autoSend;
  if (input.isActive !== undefined) updates.isActive = input.isActive;

  if (input.paymentTermsDays !== undefined) {
    if (input.paymentTermsDays < 0) {
      throw new AppError(400, 'paymentTermsDays must be >= 0');
    }
    updates.paymentTermsDays = input.paymentTermsDays;
  }

  if (input.maxRuns !== undefined) {
    if (input.maxRuns != null && input.maxRuns <= 0) {
      throw new AppError(400, 'maxRuns must be greater than 0');
    }
    updates.maxRuns = input.maxRuns;
  }

  let newFrequency: RecurrenceFrequency | undefined;
  if (input.frequency !== undefined) {
    if (!VALID_FREQUENCIES.includes(input.frequency)) {
      throw new AppError(400, 'Invalid frequency');
    }
    newFrequency = input.frequency;
    updates.frequency = input.frequency;
  }

  let newStartDate: Date | undefined;
  if (input.startDate !== undefined) {
    newStartDate = parseDate(input.startDate, 'startDate');
    updates.startDate = newStartDate;
  }

  if (input.endDate !== undefined) {
    if (input.endDate === null) {
      updates.endDate = null;
    } else {
      const ed = parseDate(input.endDate, 'endDate');
      const startForCheck = newStartDate ?? parseDate(existing.startDate, 'startDate');
      if (ed <= startForCheck) {
        throw new AppError(400, 'endDate must be after startDate');
      }
      updates.endDate = ed;
    }
  }

  // Recompute nextRunAt if frequency or startDate changed
  if (newFrequency !== undefined || newStartDate !== undefined) {
    const effectiveFrequency = newFrequency ?? (existing.frequency as RecurrenceFrequency);
    const effectiveStart = newStartDate ?? parseDate(existing.startDate, 'startDate');
    if (existing.runCount === 0) {
      updates.nextRunAt = effectiveStart;
    } else if (existing.lastRunAt) {
      const lastRun = parseDate(existing.lastRunAt, 'lastRunAt');
      updates.nextRunAt = addFrequency(lastRun, effectiveFrequency);
    } else {
      updates.nextRunAt = effectiveStart;
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(recurringInvoices)
      .set(updates)
      .where(and(eq(recurringInvoices.id, id), eq(recurringInvoices.tenantId, tenantId)));

    if (input.lineItems !== undefined) {
      if (!Array.isArray(input.lineItems) || input.lineItems.length === 0) {
        throw new AppError(400, 'At least one line item is required');
      }
      await tx
        .delete(recurringInvoiceLineItems)
        .where(eq(recurringInvoiceLineItems.recurringInvoiceId, id));
      await tx.insert(recurringInvoiceLineItems).values(
        input.lineItems.map((li, idx) => ({
          recurringInvoiceId: id,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          taxRate: li.taxRate ?? 0,
          sortOrder: idx,
        })),
      );
    }
  });

  return fetchRecurringWithItems(id, tenantId);
}

export async function pauseRecurringInvoice(
  id: string,
  tenantId: string,
): Promise<RecurringInvoice> {
  const [updated] = await db
    .update(recurringInvoices)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(recurringInvoices.id, id), eq(recurringInvoices.tenantId, tenantId)))
    .returning();

  if (!updated) {
    throw new AppError(404, 'Recurring invoice not found');
  }
  return fetchRecurringWithItems(id, tenantId);
}

export async function resumeRecurringInvoice(
  id: string,
  tenantId: string,
): Promise<RecurringInvoice> {
  const existing = await fetchRecurringWithItems(id, tenantId);
  const now = new Date();
  const nextRunAt = parseDate(existing.nextRunAt, 'nextRunAt');

  const updates: Record<string, unknown> = {
    isActive: true,
    updatedAt: now,
  };
  if (nextRunAt < now) {
    updates.nextRunAt = now;
  }

  await db
    .update(recurringInvoices)
    .set(updates)
    .where(and(eq(recurringInvoices.id, id), eq(recurringInvoices.tenantId, tenantId)));

  return fetchRecurringWithItems(id, tenantId);
}

export async function deleteRecurringInvoice(
  id: string,
  tenantId: string,
): Promise<void> {
  const result = await db
    .delete(recurringInvoices)
    .where(and(eq(recurringInvoices.id, id), eq(recurringInvoices.tenantId, tenantId)))
    .returning({ id: recurringInvoices.id });

  if (result.length === 0) {
    throw new AppError(404, 'Recurring invoice not found');
  }
  logger.info({ tenantId, recurringInvoiceId: id }, 'Recurring invoice deleted');
}

// ─── Generator ──────────────────────────────────────────────────────

export async function generateInvoiceFromRecurring(
  recurringInvoiceId: string,
  tenantId: string,
): Promise<{ invoiceId: string; emailed: boolean; deactivated: boolean }> {
  // Need the invoice number BEFORE the transaction because getNextInvoiceNumber
  // updates invoice_settings atomically on its own connection.
  const invoiceNumber = await getNextInvoiceNumber(tenantId);

  const result = await db.transaction(async (tx) => {
    // Row lock to prevent double-generation
    const [rec] = await tx
      .select()
      .from(recurringInvoices)
      .where(and(eq(recurringInvoices.id, recurringInvoiceId), eq(recurringInvoices.tenantId, tenantId)))
      .for('update')
      .limit(1);

    if (!rec) {
      throw new AppError(404, 'Recurring invoice not found');
    }
    if (!rec.isActive) {
      throw new AppError(400, 'Recurring invoice is not active');
    }

    const items = await tx
      .select()
      .from(recurringInvoiceLineItems)
      .where(eq(recurringInvoiceLineItems.recurringInvoiceId, rec.id))
      .orderBy(asc(recurringInvoiceLineItems.sortOrder));

    if (items.length === 0) {
      throw new AppError(400, 'Recurring invoice has no line items');
    }

    const now = new Date();
    const issueDate = now;
    const dueDate = new Date(now.getTime() + rec.paymentTermsDays * 24 * 60 * 60 * 1000);

    // Compute totals from line items
    const subtotal = round2(
      items.reduce((sum, li) => sum + (Number(li.quantity) || 0) * (Number(li.unitPrice) || 0), 0),
    );
    const discountAmount = round2((subtotal * (Number(rec.discountPercent) || 0)) / 100);
    const taxableBase = subtotal - discountAmount;
    const taxAmount = round2((taxableBase * (Number(rec.taxPercent) || 0)) / 100);
    const total = round2(taxableBase + taxAmount);

    // Insert the invoice
    const [created] = await tx
      .insert(invoices)
      .values({
        tenantId,
        userId: rec.userId,
        companyId: rec.companyId,
        contactId: null,
        dealId: null,
        proposalId: null,
        invoiceNumber,
        status: 'draft',
        subtotal,
        taxPercent: rec.taxPercent,
        taxAmount,
        discountPercent: rec.discountPercent,
        discountAmount,
        total,
        currency: rec.currency,
        issueDate,
        dueDate,
        notes: rec.notes,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    // Insert line items (amount = quantity * unitPrice)
    await tx.insert(invoiceLineItems).values(
      items.map((li, idx) => ({
        invoiceId: created.id,
        description: li.description,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        amount: round2((Number(li.quantity) || 0) * (Number(li.unitPrice) || 0)),
        taxRate: li.taxRate,
        sortOrder: idx,
        createdAt: now,
      })),
    );

    // Update recurring row: advance nextRunAt, increment runCount, possibly deactivate
    const newRunCount = rec.runCount + 1;
    const nextRunAt = addFrequency(now, rec.frequency as RecurrenceFrequency);
    let nowActive = true;
    if (rec.maxRuns != null && newRunCount >= rec.maxRuns) {
      nowActive = false;
    }
    if (rec.endDate && new Date(rec.endDate) <= now) {
      nowActive = false;
    }

    await tx
      .update(recurringInvoices)
      .set({
        lastRunAt: now,
        runCount: newRunCount,
        nextRunAt,
        isActive: nowActive,
        updatedAt: now,
      })
      .where(eq(recurringInvoices.id, rec.id));

    return {
      invoiceId: created.id,
      autoSend: rec.autoSend,
      userId: rec.userId,
      deactivated: !nowActive,
    };
  });

  // Email send outside the transaction so delivery failure doesn't roll back.
  let emailed = false;
  if (result.autoSend) {
    try {
      // Flip status to 'sent' first — the invoice has left draft state regardless
      // of whether delivery ultimately succeeds.
      await sendInvoice(result.userId, tenantId, result.invoiceId);
      const emailResult = await sendInvoiceEmail(result.invoiceId, tenantId);
      emailed = emailResult.sent;
      if (!emailed) {
        logger.warn(
          { invoiceId: result.invoiceId, tenantId, reason: emailResult.reason },
          'Auto-send of generated recurring invoice failed',
        );
      }
    } catch (err) {
      logger.warn({ err, invoiceId: result.invoiceId, tenantId }, 'Failed to auto-send recurring invoice');
      emailed = false;
    }
  }

  logger.info(
    { tenantId, recurringInvoiceId, invoiceId: result.invoiceId, emailed, deactivated: result.deactivated },
    'Generated invoice from recurring template',
  );

  return {
    invoiceId: result.invoiceId,
    emailed,
    deactivated: result.deactivated,
  };
}

