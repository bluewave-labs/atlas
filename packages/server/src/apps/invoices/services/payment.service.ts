import { db } from '../../../config/database';
import { invoices, invoicePayments } from '../../../db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { PgTransaction } from 'drizzle-orm/pg-core';
import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import * as schema from '../../../db/schema';
import { logger } from '../../../utils/logger';
import { AppError } from '../../../middleware/error-handler';
import type {
  InvoicePayment,
  RecordPaymentInput,
  UpdatePaymentInput,
  PaymentType,
} from '@atlas-platform/shared';

// ─── Helpers ────────────────────────────────────────────────────────

const MONEY_EPSILON = 0.01;
const OVERPAY_EPSILON_FACTOR = 1.0001;

// Drizzle transaction type — helpers accept this so they run inside the
// caller's transaction, sharing the same row locks and commit boundary.
type Tx = PgTransaction<
  NodePgQueryResultHKT,
  typeof schema,
  ExtractTablesWithRelations<typeof schema>
>;

function toDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function serializePayment(row: typeof invoicePayments.$inferSelect): InvoicePayment {
  return {
    id: row.id,
    tenantId: row.tenantId,
    invoiceId: row.invoiceId,
    userId: row.userId,
    type: row.type as PaymentType,
    amount: row.amount,
    currency: row.currency,
    paymentDate: row.paymentDate,
    method: row.method ?? null,
    reference: row.reference ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Loads an invoice scoped to a tenant and acquires a row-level lock
 * (SELECT ... FOR UPDATE) so concurrent writers targeting the same invoice
 * are serialized for the duration of the enclosing transaction.
 */
async function loadInvoiceForUpdate(tx: Tx, invoiceId: string, tenantId: string) {
  const [invoice] = await tx
    .select()
    .from(invoices)
    .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
    .for('update')
    .limit(1);
  if (!invoice) {
    throw new AppError(404, 'invoice not found');
  }
  return invoice;
}

/**
 * Computes net paid amount for an invoice: sum(payments) - sum(refunds).
 * Optionally excludes a specific payment id (used by updatePayment to
 * exclude the row being edited so we can re-validate with the new amount).
 */
async function computeNetPaidInTx(
  tx: Tx,
  invoiceId: string,
  excludePaymentId?: string,
): Promise<number> {
  const rows = await tx
    .select({ type: invoicePayments.type, amount: invoicePayments.amount, id: invoicePayments.id })
    .from(invoicePayments)
    .where(eq(invoicePayments.invoiceId, invoiceId));

  let net = 0;
  for (const r of rows) {
    if (excludePaymentId && r.id === excludePaymentId) continue;
    net += r.type === 'refund' ? -r.amount : r.amount;
  }
  return net;
}

/**
 * Recomputes an invoice's paid state from the sum of its payments.
 * Must be called inside a transaction after the invoice row has already
 * been locked via loadInvoiceForUpdate().
 */
async function updateInvoicePaidStatusInTx(
  tx: Tx,
  invoice: typeof invoices.$inferSelect,
): Promise<void> {
  const [{ netPaid }] = await tx
    .select({
      netPaid: sql<number>`COALESCE(SUM(CASE WHEN ${invoicePayments.type} = 'payment' THEN ${invoicePayments.amount} ELSE -${invoicePayments.amount} END), 0)`,
    })
    .from(invoicePayments)
    .where(eq(invoicePayments.invoiceId, invoice.id));

  const net = Number(netPaid) || 0;
  const now = new Date();

  if (net >= invoice.total - MONEY_EPSILON) {
    if (invoice.status !== 'paid') {
      await tx
        .update(invoices)
        .set({ status: 'paid', paidAt: now, updatedAt: now })
        .where(and(eq(invoices.id, invoice.id), eq(invoices.tenantId, invoice.tenantId)));
    }
    return;
  }

  // Net paid is below total
  if (invoice.status === 'paid') {
    const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;
    const isOverdue = dueDate != null && dueDate.getTime() < now.getTime();
    const wasViewed = invoice.viewedAt != null;
    // Preserve 'viewed' when the invoice was previously opened by the recipient.
    const revertTo = isOverdue ? 'overdue' : (wasViewed ? 'viewed' : 'sent');
    await tx
      .update(invoices)
      .set({ status: revertTo, paidAt: null, updatedAt: now })
      .where(and(eq(invoices.id, invoice.id), eq(invoices.tenantId, invoice.tenantId)));
  }
  // else: leave status as-is (e.g. 'sent' with partial payment)
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Look up the invoiceId for a payment, scoped to tenant. Returns null if the
 * payment does not exist (or is in another tenant). Callers use this to run
 * an ownership check on the parent invoice before mutating a payment.
 */
export async function getPaymentInvoiceId(
  paymentId: string,
  tenantId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ invoiceId: invoicePayments.invoiceId })
    .from(invoicePayments)
    .where(and(eq(invoicePayments.id, paymentId), eq(invoicePayments.tenantId, tenantId)))
    .limit(1);
  return row?.invoiceId ?? null;
}

export async function listPaymentsForInvoice(
  invoiceId: string,
  tenantId: string,
): Promise<InvoicePayment[]> {
  const rows = await db
    .select()
    .from(invoicePayments)
    .where(and(eq(invoicePayments.invoiceId, invoiceId), eq(invoicePayments.tenantId, tenantId)))
    .orderBy(desc(invoicePayments.paymentDate), desc(invoicePayments.createdAt));
  return rows.map(serializePayment);
}

export async function recordPayment(
  input: RecordPaymentInput,
  userId: string,
  tenantId: string,
): Promise<InvoicePayment> {
  // 1. Validate amount (pure, outside txn)
  if (!(typeof input.amount === 'number') || !isFinite(input.amount) || input.amount <= 0) {
    throw new AppError(400, 'amount must be positive');
  }

  // 2. Validate payment date (pure, outside txn)
  const paymentDate = toDate(input.paymentDate);
  if (isNaN(paymentDate.getTime())) {
    throw new AppError(400, 'invalid payment date');
  }
  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + 1); // 1-day buffer for timezone slack
  if (paymentDate.getTime() > maxDate.getTime()) {
    throw new AppError(400, 'payment date cannot be in the future');
  }

  const type: PaymentType = input.type ?? 'payment';

  return await db.transaction(async (tx) => {
    // Lock invoice row for the rest of the transaction
    const invoice = await loadInvoiceForUpdate(tx, input.invoiceId, tenantId);

    // Balance checks re-run inside the lock
    const netPaid = await computeNetPaidInTx(tx, input.invoiceId);
    if (type === 'payment') {
      const limit = invoice.total * OVERPAY_EPSILON_FACTOR;
      if (netPaid + input.amount > limit) {
        throw new AppError(400, 'payment would exceed invoice total');
      }
    } else {
      if (input.amount > netPaid + MONEY_EPSILON) {
        throw new AppError(400, 'refund amount exceeds paid amount');
      }
    }

    const currency = input.currency ?? invoice.currency;
    const now = new Date();
    const [created] = await tx
      .insert(invoicePayments)
      .values({
        tenantId,
        invoiceId: input.invoiceId,
        userId,
        type,
        amount: input.amount,
        currency,
        paymentDate,
        method: (input.method as string | null | undefined) ?? null,
        reference: input.reference ?? null,
        notes: input.notes ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    await updateInvoicePaidStatusInTx(tx, invoice);

    logger.info(
      { userId, invoiceId: input.invoiceId, paymentId: created.id, type, amount: input.amount },
      'Invoice payment recorded',
    );

    return serializePayment(created);
  });
}

export async function updatePayment(
  paymentId: string,
  input: UpdatePaymentInput,
  tenantId: string,
): Promise<InvoicePayment> {
  return await db.transaction(async (tx) => {
    // Load existing payment scoped to tenant
    const [existing] = await tx
      .select()
      .from(invoicePayments)
      .where(and(eq(invoicePayments.id, paymentId), eq(invoicePayments.tenantId, tenantId)))
      .limit(1);
    if (!existing) {
      throw new AppError(404, 'payment not found');
    }

    // Lock the related invoice row
    const invoice = await loadInvoiceForUpdate(tx, existing.invoiceId, tenantId);

    // Determine new values (type and invoiceId are immutable)
    const newAmount = input.amount !== undefined ? input.amount : existing.amount;
    const newPaymentDate =
      input.paymentDate !== undefined ? toDate(input.paymentDate) : existing.paymentDate;

    if (input.amount !== undefined) {
      if (!(typeof newAmount === 'number') || !isFinite(newAmount) || newAmount <= 0) {
        throw new AppError(400, 'amount must be positive');
      }
    }

    if (input.paymentDate !== undefined) {
      if (isNaN(newPaymentDate.getTime())) {
        throw new AppError(400, 'invalid payment date');
      }
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 1);
      if (newPaymentDate.getTime() > maxDate.getTime()) {
        throw new AppError(400, 'payment date cannot be in the future');
      }
    }

    // Re-run balance validation excluding this row, then adding the updated amount
    const netPaidExcluding = await computeNetPaidInTx(tx, existing.invoiceId, existing.id);
    if (existing.type === 'payment') {
      const limit = invoice.total * OVERPAY_EPSILON_FACTOR;
      if (netPaidExcluding + newAmount > limit) {
        throw new AppError(400, 'payment would exceed invoice total');
      }
    } else {
      // refund: refund amount must not exceed current net paid (without this row)
      if (newAmount > netPaidExcluding + MONEY_EPSILON) {
        throw new AppError(400, 'refund amount exceeds paid amount');
      }
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.amount !== undefined) updates.amount = newAmount;
    if (input.paymentDate !== undefined) updates.paymentDate = newPaymentDate;
    if (input.method !== undefined) updates.method = input.method ?? null;
    if (input.reference !== undefined) updates.reference = input.reference ?? null;
    if (input.notes !== undefined) updates.notes = input.notes ?? null;

    const [updated] = await tx
      .update(invoicePayments)
      .set(updates)
      .where(and(eq(invoicePayments.id, paymentId), eq(invoicePayments.tenantId, tenantId)))
      .returning();

    await updateInvoicePaidStatusInTx(tx, invoice);

    return serializePayment(updated);
  });
}

export async function deletePayment(paymentId: string, tenantId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: invoicePayments.id, invoiceId: invoicePayments.invoiceId })
      .from(invoicePayments)
      .where(and(eq(invoicePayments.id, paymentId), eq(invoicePayments.tenantId, tenantId)))
      .limit(1);
    if (!existing) {
      throw new AppError(404, 'payment not found');
    }

    // Lock the related invoice before mutating payments
    const invoice = await loadInvoiceForUpdate(tx, existing.invoiceId, tenantId);

    await tx
      .delete(invoicePayments)
      .where(and(eq(invoicePayments.id, paymentId), eq(invoicePayments.tenantId, tenantId)));

    await updateInvoicePaidStatusInTx(tx, invoice);
  });
}

/**
 * Public wrapper: recomputes an invoice's paid state in its own transaction.
 * Used by callers outside the payment service (e.g. invoice status changes).
 */
export async function updateInvoicePaidStatus(
  invoiceId: string,
  tenantId: string,
): Promise<void> {
  await db.transaction(async (tx) => {
    const invoice = await loadInvoiceForUpdate(tx, invoiceId, tenantId);
    await updateInvoicePaidStatusInTx(tx, invoice);
  });
}
