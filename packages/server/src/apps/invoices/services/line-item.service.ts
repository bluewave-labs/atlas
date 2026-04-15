import { db } from '../../../config/database';
import {
  invoiceLineItems, invoices,
  projectTimeEntries,
} from '../../../db/schema';
import { eq, asc } from 'drizzle-orm';

// ─── Input types ────────────────────────────────────────────────────

interface CreateLineItemInput {
  invoiceId: string;
  timeEntryId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate?: number;
  sortOrder?: number;
}

interface UpdateLineItemInput {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
  taxRate?: number;
  sortOrder?: number;
}

// ─── Line Items ─────────────────────────────────────────────────────

export async function getLineItemById(id: string) {
  const [lineItem] = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.id, id))
    .limit(1);

  return lineItem || null;
}

export async function listInvoiceLineItems(invoiceId: string) {
  return db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.invoiceId, invoiceId))
    .orderBy(asc(invoiceLineItems.sortOrder), asc(invoiceLineItems.createdAt));
}

export async function createLineItem(input: CreateLineItemInput) {
  const now = new Date();
  const [created] = await db
    .insert(invoiceLineItems)
    .values({
      invoiceId: input.invoiceId,
      timeEntryId: input.timeEntryId ?? null,
      description: input.description,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      amount: input.amount,
      taxRate: input.taxRate ?? 20,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
    })
    .returning();

  return created;
}

export async function updateLineItem(id: string, input: UpdateLineItemInput) {
  const updates: Record<string, unknown> = {};

  if (input.description !== undefined) updates.description = input.description;
  if (input.quantity !== undefined) updates.quantity = input.quantity;
  if (input.unitPrice !== undefined) updates.unitPrice = input.unitPrice;
  if (input.amount !== undefined) updates.amount = input.amount;
  if (input.taxRate !== undefined) updates.taxRate = input.taxRate;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;

  const [updated] = await db
    .update(invoiceLineItems)
    .set(updates)
    .where(eq(invoiceLineItems.id, id))
    .returning();

  return updated ?? null;
}

export async function replaceLineItems(
  invoiceId: string,
  items: Array<{ description: string; quantity: number; unitPrice: number; taxRate?: number }>,
) {
  // Delete existing line items (simple ones without time entries for bulk replace)
  await db.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, invoiceId));

  if (items.length === 0) return [];

  const now = new Date();
  const rows = items.map((item, i) => ({
    invoiceId,
    timeEntryId: null as string | null,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    amount: item.quantity * item.unitPrice,
    taxRate: item.taxRate ?? 0,
    sortOrder: i,
    createdAt: now,
  }));

  return db.insert(invoiceLineItems).values(rows).returning();
}

export async function deleteLineItem(id: string) {
  // If the line item had a time entry, unmark it
  const [lineItem] = await db
    .select()
    .from(invoiceLineItems)
    .where(eq(invoiceLineItems.id, id))
    .limit(1);

  if (lineItem?.timeEntryId) {
    await db
      .update(projectTimeEntries)
      .set({ billed: false, locked: false, invoiceLineItemId: null, updatedAt: new Date() })
      .where(eq(projectTimeEntries.id, lineItem.timeEntryId));
  }

  await db
    .delete(invoiceLineItems)
    .where(eq(invoiceLineItems.id, id));
}
