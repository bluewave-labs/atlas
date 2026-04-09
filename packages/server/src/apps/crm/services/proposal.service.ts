import { db } from '../../../config/database';
import {
  crmProposals, crmCompanies, crmContacts, crmDeals,
  invoices, invoiceLineItems, invoiceSettings,
} from '../../../db/schema';
import { eq, and, desc, sql, ilike } from 'drizzle-orm';
import { logger } from '../../../utils/logger';

// ─── Types ─────────────────────────────────────────────────────────

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

interface ProposalFilters {
  dealId?: string;
  companyId?: string;
  status?: string;
  search?: string;
}

interface CreateProposalInput {
  title: string;
  dealId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  content?: unknown;
  lineItems?: LineItem[];
  taxPercent?: number;
  discountPercent?: number;
  currency?: string;
  validUntil?: string | null;
  notes?: string | null;
}

interface UpdateProposalInput {
  title?: string;
  dealId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  content?: unknown;
  lineItems?: LineItem[];
  taxPercent?: number;
  discountPercent?: number;
  currency?: string;
  validUntil?: string | null;
  notes?: string | null;
}

// ─── Helpers ───────────────────────────────────────────────────────

function computeTotals(lineItems: LineItem[], taxPercent: number, discountPercent: number) {
  const subtotal = lineItems.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
  const taxAmount = subtotal * (taxPercent / 100);
  const discountAmount = subtotal * (discountPercent / 100);
  const total = subtotal + taxAmount - discountAmount;
  return { subtotal, taxAmount, discountAmount, total };
}

// ─── List ──────────────────────────────────────────────────────────

export async function listProposals(tenantId: string, filters?: ProposalFilters) {
  const conditions = [
    eq(crmProposals.tenantId, tenantId),
    eq(crmProposals.isArchived, false),
  ];

  if (filters?.dealId) conditions.push(eq(crmProposals.dealId, filters.dealId));
  if (filters?.companyId) conditions.push(eq(crmProposals.companyId, filters.companyId));
  if (filters?.status) conditions.push(eq(crmProposals.status, filters.status));
  if (filters?.search) {
    conditions.push(ilike(crmProposals.title, `%${filters.search}%`));
  }

  const rows = await db
    .select({
      proposal: crmProposals,
      companyName: crmCompanies.name,
      contactName: crmContacts.name,
      dealTitle: crmDeals.title,
    })
    .from(crmProposals)
    .leftJoin(crmCompanies, eq(crmProposals.companyId, crmCompanies.id))
    .leftJoin(crmContacts, eq(crmProposals.contactId, crmContacts.id))
    .leftJoin(crmDeals, eq(crmProposals.dealId, crmDeals.id))
    .where(and(...conditions))
    .orderBy(desc(crmProposals.createdAt));

  return rows.map((r) => ({
    ...r.proposal,
    companyName: r.companyName ?? null,
    contactName: r.contactName ?? null,
    dealTitle: r.dealTitle ?? null,
  }));
}

// ─── Get ───────────────────────────────────────────────────────────

export async function getProposal(tenantId: string, id: string) {
  const [row] = await db
    .select({
      proposal: crmProposals,
      companyName: crmCompanies.name,
      contactName: crmContacts.name,
      dealTitle: crmDeals.title,
    })
    .from(crmProposals)
    .leftJoin(crmCompanies, eq(crmProposals.companyId, crmCompanies.id))
    .leftJoin(crmContacts, eq(crmProposals.contactId, crmContacts.id))
    .leftJoin(crmDeals, eq(crmProposals.dealId, crmDeals.id))
    .where(and(eq(crmProposals.tenantId, tenantId), eq(crmProposals.id, id)))
    .limit(1);

  if (!row) return null;

  return {
    ...row.proposal,
    companyName: row.companyName ?? null,
    contactName: row.contactName ?? null,
    dealTitle: row.dealTitle ?? null,
  };
}

// ─── Create ────────────────────────────────────────────────────────

export async function createProposal(userId: string, tenantId: string, input: CreateProposalInput) {
  const items = input.lineItems ?? [];
  const taxPct = input.taxPercent ?? 0;
  const discPct = input.discountPercent ?? 0;
  const { subtotal, taxAmount, discountAmount, total } = computeTotals(items, taxPct, discPct);
  const now = new Date();

  const [created] = await db
    .insert(crmProposals)
    .values({
      tenantId,
      userId,
      dealId: input.dealId ?? null,
      contactId: input.contactId ?? null,
      companyId: input.companyId ?? null,
      title: input.title,
      content: input.content ?? null,
      lineItems: items,
      subtotal,
      taxPercent: taxPct,
      taxAmount,
      discountPercent: discPct,
      discountAmount,
      total,
      currency: input.currency ?? 'USD',
      validUntil: input.validUntil ? new Date(input.validUntil) : null,
      notes: input.notes ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

// ─── Update ────────────────────────────────────────────────────────

export async function updateProposal(tenantId: string, id: string, input: UpdateProposalInput) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.title !== undefined) updates.title = input.title;
  if (input.dealId !== undefined) updates.dealId = input.dealId;
  if (input.contactId !== undefined) updates.contactId = input.contactId;
  if (input.companyId !== undefined) updates.companyId = input.companyId;
  if (input.content !== undefined) updates.content = input.content;
  if (input.currency !== undefined) updates.currency = input.currency;
  if (input.validUntil !== undefined) updates.validUntil = input.validUntil ? new Date(input.validUntil) : null;
  if (input.notes !== undefined) updates.notes = input.notes;

  // Recompute totals when line items or financial fields change
  const needsRecompute = input.lineItems !== undefined || input.taxPercent !== undefined || input.discountPercent !== undefined;
  if (needsRecompute) {
    // Need current values to fill in gaps
    const [existing] = await db
      .select()
      .from(crmProposals)
      .where(and(eq(crmProposals.tenantId, tenantId), eq(crmProposals.id, id)))
      .limit(1);

    if (!existing) return null;

    const items = input.lineItems ?? (existing.lineItems as LineItem[]) ?? [];
    const taxPct = input.taxPercent ?? existing.taxPercent;
    const discPct = input.discountPercent ?? existing.discountPercent;
    const { subtotal, taxAmount, discountAmount, total } = computeTotals(items, taxPct, discPct);

    updates.lineItems = items;
    updates.taxPercent = taxPct;
    updates.discountPercent = discPct;
    updates.subtotal = subtotal;
    updates.taxAmount = taxAmount;
    updates.discountAmount = discountAmount;
    updates.total = total;
  }

  const [updated] = await db
    .update(crmProposals)
    .set(updates)
    .where(and(eq(crmProposals.tenantId, tenantId), eq(crmProposals.id, id)))
    .returning();

  return updated ?? null;
}

// ─── Delete (soft) ─────────────────────────────────────────────────

export async function deleteProposal(tenantId: string, id: string) {
  await db
    .update(crmProposals)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(and(eq(crmProposals.tenantId, tenantId), eq(crmProposals.id, id)));
}

// ─── Send ──────────────────────────────────────────────────────────

export async function sendProposal(tenantId: string, id: string) {
  const now = new Date();
  const [updated] = await db
    .update(crmProposals)
    .set({ status: 'sent', sentAt: now, updatedAt: now })
    .where(and(eq(crmProposals.tenantId, tenantId), eq(crmProposals.id, id)))
    .returning();

  return updated ?? null;
}

// ─── Duplicate ─────────────────────────────────────────────────────

export async function duplicateProposal(userId: string, tenantId: string, id: string) {
  const existing = await getProposal(tenantId, id);
  if (!existing) return null;

  const now = new Date();
  const [created] = await db
    .insert(crmProposals)
    .values({
      tenantId,
      userId,
      dealId: existing.dealId,
      contactId: existing.contactId,
      companyId: existing.companyId,
      title: `${existing.title} (copy)`,
      content: existing.content,
      lineItems: existing.lineItems as LineItem[],
      subtotal: existing.subtotal,
      taxPercent: existing.taxPercent,
      taxAmount: existing.taxAmount,
      discountPercent: existing.discountPercent,
      discountAmount: existing.discountAmount,
      total: existing.total,
      currency: existing.currency,
      validUntil: existing.validUntil,
      notes: existing.notes,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

// ─── Public: get by token ──────────────────────────────────────────

export async function getProposalByPublicToken(token: string) {
  const [row] = await db
    .select({
      proposal: crmProposals,
      companyName: crmCompanies.name,
    })
    .from(crmProposals)
    .leftJoin(crmCompanies, eq(crmProposals.companyId, crmCompanies.id))
    .where(and(eq(crmProposals.publicToken, token), eq(crmProposals.isArchived, false)))
    .limit(1);

  if (!row) return null;

  return {
    ...row.proposal,
    companyName: row.companyName ?? null,
  };
}

// ─── Public: accept ────────────────────────────────────────────────

async function getNextInvoiceNumber(tenantId: string): Promise<string> {
  const [settings] = await db
    .select()
    .from(invoiceSettings)
    .where(eq(invoiceSettings.tenantId, tenantId))
    .limit(1);

  const prefix = settings?.invoicePrefix || 'INV';

  const [updated] = await db
    .update(invoiceSettings)
    .set({ nextInvoiceNumber: sql`COALESCE(${invoiceSettings.nextInvoiceNumber}, 1) + 1`, updatedAt: new Date() })
    .where(eq(invoiceSettings.tenantId, tenantId))
    .returning({ num: invoiceSettings.nextInvoiceNumber });

  if (!updated) {
    await db.insert(invoiceSettings).values({ tenantId, nextInvoiceNumber: 2 } as any).onConflictDoNothing();
    return `${prefix}-${String(1).padStart(3, '0')}`;
  }

  const num = updated.num - 1;
  return `${prefix}-${String(num).padStart(3, '0')}`;
}

export async function acceptProposal(token: string) {
  return db.transaction(async (tx) => {
    // 1. Find the proposal
    const [proposal] = await tx
      .select()
      .from(crmProposals)
      .where(and(eq(crmProposals.publicToken, token), eq(crmProposals.isArchived, false)))
      .limit(1);

    if (!proposal) return null;

    // 2. Mark as accepted
    const now = new Date();
    const [updated] = await tx
      .update(crmProposals)
      .set({ status: 'accepted', acceptedAt: now, updatedAt: now })
      .where(eq(crmProposals.id, proposal.id))
      .returning();

    // 3. Create a draft invoice if the proposal has line items and a company
    const items = (proposal.lineItems as LineItem[]) ?? [];
    if (items.length > 0 && proposal.companyId) {
      const invoiceNumber = await getNextInvoiceNumber(proposal.tenantId);

      const [inv] = await tx
        .insert(invoices)
        .values({
          tenantId: proposal.tenantId,
          userId: proposal.userId,
          companyId: proposal.companyId,
          contactId: proposal.contactId ?? null,
          dealId: proposal.dealId ?? null,
          proposalId: proposal.id,
          invoiceNumber,
          status: 'draft',
          subtotal: proposal.subtotal,
          taxPercent: proposal.taxPercent,
          taxAmount: proposal.taxAmount,
          discountPercent: proposal.discountPercent,
          discountAmount: proposal.discountAmount,
          total: proposal.total,
          currency: proposal.currency,
          issueDate: now,
          dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days
          notes: proposal.notes ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      // 4. Insert invoice line items
      if (inv) {
        const lineItemValues = items.map((li, idx) => ({
          invoiceId: inv.id,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          amount: li.quantity * li.unitPrice,
          taxRate: li.taxRate ?? 0,
          sortOrder: idx,
          createdAt: now,
        }));

        await tx.insert(invoiceLineItems).values(lineItemValues);
      }
    }

    return updated ?? null;
  });
}

// ─── Public: decline ───────────────────────────────────────────────

export async function declineProposal(token: string) {
  const now = new Date();
  const [updated] = await db
    .update(crmProposals)
    .set({ status: 'declined', declinedAt: now, updatedAt: now })
    .where(and(eq(crmProposals.publicToken, token), eq(crmProposals.isArchived, false)))
    .returning();

  return updated ?? null;
}
