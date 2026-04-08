import { db } from '../../../config/database';
import {
  projectInvoiceLineItems, projectInvoices,
  projectTimeEntries, projectProjects, projectMembers,
} from '../../../db/schema';
import { eq, and, asc, gte, lte, inArray, sql } from 'drizzle-orm';
import { getSettings } from './settings.service';

// ─── Input types ────────────────────────────────────────────────────

interface CreateLineItemInput {
  invoiceId: string;
  timeEntryId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxRate?: number;
}

interface UpdateLineItemInput {
  description?: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
  taxRate?: number;
}

// ─── Line Items ─────────────────────────────────────────────────────

export async function getLineItemById(id: string) {
  const [lineItem] = await db
    .select()
    .from(projectInvoiceLineItems)
    .where(eq(projectInvoiceLineItems.id, id))
    .limit(1);

  return lineItem || null;
}

export async function listInvoiceLineItems(invoiceId: string) {
  return db
    .select()
    .from(projectInvoiceLineItems)
    .where(eq(projectInvoiceLineItems.invoiceId, invoiceId))
    .orderBy(asc(projectInvoiceLineItems.createdAt));
}

export async function createLineItem(input: CreateLineItemInput) {
  const now = new Date();
  const [created] = await db
    .insert(projectInvoiceLineItems)
    .values({
      invoiceId: input.invoiceId,
      timeEntryId: input.timeEntryId ?? null,
      description: input.description,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
      amount: input.amount,
      taxRate: input.taxRate ?? 20,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

export async function updateLineItem(id: string, input: UpdateLineItemInput) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.description !== undefined) updates.description = input.description;
  if (input.quantity !== undefined) updates.quantity = input.quantity;
  if (input.unitPrice !== undefined) updates.unitPrice = input.unitPrice;
  if (input.amount !== undefined) updates.amount = input.amount;
  if (input.taxRate !== undefined) updates.taxRate = input.taxRate;

  const [updated] = await db
    .update(projectInvoiceLineItems)
    .set(updates)
    .where(eq(projectInvoiceLineItems.id, id))
    .returning();

  return updated ?? null;
}

export async function deleteLineItem(id: string) {
  // If the line item had a time entry, unmark it
  const [lineItem] = await db
    .select()
    .from(projectInvoiceLineItems)
    .where(eq(projectInvoiceLineItems.id, id))
    .limit(1);

  if (lineItem?.timeEntryId) {
    await db
      .update(projectTimeEntries)
      .set({ billed: false, locked: false, invoiceLineItemId: null, updatedAt: new Date() })
      .where(eq(projectTimeEntries.id, lineItem.timeEntryId));
  }

  await db
    .delete(projectInvoiceLineItems)
    .where(eq(projectInvoiceLineItems.id, id));
}

export async function populateFromTimeEntries(
  tenantId: string,
  invoiceId: string,
  clientId: string,
  startDate: string,
  endDate: string,
) {
  // Find all client's projects
  const clientProjects = await db
    .select({ id: projectProjects.id })
    .from(projectProjects)
    .where(and(
      eq(projectProjects.clientId, clientId),
      eq(projectProjects.tenantId, tenantId),
    ));

  const projectIds = clientProjects.map(p => p.id);
  if (projectIds.length === 0) return [];

  // Find unbilled billable time entries in date range
  const entries = await db
    .select({
      id: projectTimeEntries.id,
      durationMinutes: projectTimeEntries.durationMinutes,
      taskDescription: projectTimeEntries.taskDescription,
      notes: projectTimeEntries.notes,
      workDate: projectTimeEntries.workDate,
      userId: projectTimeEntries.userId,
      projectId: projectTimeEntries.projectId,
    })
    .from(projectTimeEntries)
    .where(and(
      eq(projectTimeEntries.tenantId, tenantId),
      eq(projectTimeEntries.billable, true),
      eq(projectTimeEntries.billed, false),
      eq(projectTimeEntries.isArchived, false),
      inArray(projectTimeEntries.projectId, projectIds),
      gte(projectTimeEntries.workDate, startDate),
      lte(projectTimeEntries.workDate, endDate),
    ));

  const now = new Date();

  // Batch: collect all unique (projectId, userId) pairs for member rate lookup
  const memberKeys = new Set<string>();
  for (const entry of entries) {
    memberKeys.add(`${entry.projectId}:${entry.userId}`);
  }
  const uniquePairs = [...memberKeys].map(k => { const [p, u] = k.split(':'); return { projectId: p, userId: u }; });

  // Batch-query all relevant project members in one query
  const allMembers = uniquePairs.length > 0
    ? await db
        .select({
          projectId: projectMembers.projectId,
          userId: projectMembers.userId,
          hourlyRate: projectMembers.hourlyRate,
        })
        .from(projectMembers)
        .where(sql`(${projectMembers.projectId}, ${projectMembers.userId}) IN (${sql.raw(
          uniquePairs.map(p => `('${p.projectId}', '${p.userId}')`).join(', ')
        )})`)
    : [];

  // Build O(1) lookup map
  const memberRateMap = new Map<string, number | null>();
  for (const m of allMembers) {
    memberRateMap.set(`${m.projectId}:${m.userId}`, m.hourlyRate);
  }

  // Load settings once for the default rate fallback
  const settings = await getSettings(tenantId);
  const defaultRate = settings?.defaultHourlyRate ?? 0;

  // Prepare all line items for batch insert
  const lineItemValues = entries.map(entry => {
    const rate = memberRateMap.get(`${entry.projectId}:${entry.userId}`) ?? defaultRate;
    const hours = entry.durationMinutes / 60;
    const amount = hours * rate;
    const description = entry.taskDescription || entry.notes || `Time entry ${entry.workDate}`;

    return {
      invoiceId,
      timeEntryId: entry.id,
      description,
      quantity: hours,
      unitPrice: rate,
      amount,
      createdAt: now,
      updatedAt: now,
    };
  });

  // Batch insert all line items at once
  const createdLineItems = lineItemValues.length > 0
    ? await db.insert(projectInvoiceLineItems).values(lineItemValues).returning()
    : [];

  // Build a map from timeEntryId -> lineItemId for batch update
  const entryToLineItem = new Map<string, string>();
  for (const li of createdLineItems) {
    if (li.timeEntryId) {
      entryToLineItem.set(li.timeEntryId, li.id);
    }
  }

  // Batch update: mark all time entries as billed and locked
  const timeEntryIds = entries.map(e => e.id);
  if (timeEntryIds.length > 0) {
    // We need individual updates for invoiceLineItemId, but we can batch the billed/locked flags
    await db
      .update(projectTimeEntries)
      .set({ billed: true, locked: true, updatedAt: now })
      .where(inArray(projectTimeEntries.id, timeEntryIds));

    // Set invoiceLineItemId for each entry individually (different value per row)
    for (const [entryId, lineItemId] of entryToLineItem) {
      await db
        .update(projectTimeEntries)
        .set({ invoiceLineItemId: lineItemId })
        .where(eq(projectTimeEntries.id, entryId));
    }
  }

  // Update invoice total
  const totalAmount = createdLineItems.reduce((sum, li) => sum + li.amount, 0);
  if (totalAmount > 0) {
    const [existingInvoice] = await db
      .select({ amount: projectInvoices.amount })
      .from(projectInvoices)
      .where(eq(projectInvoices.id, invoiceId))
      .limit(1);

    const newAmount = (existingInvoice?.amount ?? 0) + totalAmount;
    await db
      .update(projectInvoices)
      .set({ amount: newAmount, updatedAt: now })
      .where(eq(projectInvoices.id, invoiceId));
  }

  return createdLineItems;
}

export async function previewTimeEntryLineItems(
  tenantId: string,
  clientId: string,
  startDate: string,
  endDate: string,
) {
  // Find all client's projects
  const clientProjects = await db
    .select({ id: projectProjects.id })
    .from(projectProjects)
    .where(and(
      eq(projectProjects.clientId, clientId),
      eq(projectProjects.tenantId, tenantId),
    ));

  const projectIds = clientProjects.map(p => p.id);
  if (projectIds.length === 0) return [];

  // Find unbilled billable time entries in date range
  const entries = await db
    .select({
      id: projectTimeEntries.id,
      durationMinutes: projectTimeEntries.durationMinutes,
      taskDescription: projectTimeEntries.taskDescription,
      notes: projectTimeEntries.notes,
      workDate: projectTimeEntries.workDate,
      userId: projectTimeEntries.userId,
      projectId: projectTimeEntries.projectId,
    })
    .from(projectTimeEntries)
    .where(and(
      eq(projectTimeEntries.tenantId, tenantId),
      eq(projectTimeEntries.billable, true),
      eq(projectTimeEntries.billed, false),
      eq(projectTimeEntries.isArchived, false),
      inArray(projectTimeEntries.projectId, projectIds),
      gte(projectTimeEntries.workDate, startDate),
      lte(projectTimeEntries.workDate, endDate),
    ));

  // Batch: collect all unique (projectId, userId) pairs for member rate lookup
  const memberKeys = new Set<string>();
  for (const entry of entries) {
    memberKeys.add(`${entry.projectId}:${entry.userId}`);
  }
  const uniquePairs = [...memberKeys].map(k => { const [p, u] = k.split(':'); return { projectId: p, userId: u }; });

  // Batch-query all relevant project members in one query
  const allMembers = uniquePairs.length > 0
    ? await db
        .select({
          projectId: projectMembers.projectId,
          userId: projectMembers.userId,
          hourlyRate: projectMembers.hourlyRate,
        })
        .from(projectMembers)
        .where(sql`(${projectMembers.projectId}, ${projectMembers.userId}) IN (${sql.raw(
          uniquePairs.map(p => `('${p.projectId}', '${p.userId}')`).join(', ')
        )})`)
    : [];

  // Build O(1) lookup map
  const memberRateMap = new Map<string, number | null>();
  for (const m of allMembers) {
    memberRateMap.set(`${m.projectId}:${m.userId}`, m.hourlyRate);
  }

  // Load settings once for default rate fallback
  const settings = await getSettings(tenantId);
  const defaultRate = settings?.defaultHourlyRate ?? 0;

  const lineItems = entries.map(entry => {
    const rate = memberRateMap.get(`${entry.projectId}:${entry.userId}`) ?? defaultRate;
    const hours = entry.durationMinutes / 60;
    const description = entry.taskDescription || entry.notes || `Time entry ${entry.workDate}`;
    return { description, quantity: hours, unitPrice: rate };
  });

  return lineItems;
}
