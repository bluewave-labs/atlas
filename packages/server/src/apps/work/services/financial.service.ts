import { db } from '../../../config/database';
import { invoices, invoicePayments } from '../../../db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function getProjectFinancials(tenantId: string, projectId: string) {
  const payments = db
    .select({
      invoiceId: invoicePayments.invoiceId,
      amountPaid: sql<number>`SUM(CASE WHEN ${invoicePayments.type} = 'payment' THEN ${invoicePayments.amount} ELSE -${invoicePayments.amount} END)`.as('amount_paid'),
    })
    .from(invoicePayments)
    .groupBy(invoicePayments.invoiceId)
    .as('payments');

  const rows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      issueDate: invoices.issueDate,
      dueDate: invoices.dueDate,
      total: invoices.total,
      status: invoices.status,
      currency: invoices.currency,
      amountPaid: sql<number>`COALESCE("payments"."amount_paid", 0)`.as('amount_paid'),
    })
    .from(invoices)
    .leftJoin(payments, eq(payments.invoiceId, invoices.id))
    .where(and(
      eq(invoices.tenantId, tenantId),
      eq(invoices.projectId, projectId),
      eq(invoices.isArchived, false),
    ))
    .orderBy(invoices.issueDate);

  const currencies = new Set(rows.map(r => r.currency));
  const currency = currencies.size === 1 ? Array.from(currencies)[0] : 'MIXED';

  const totalBilled = rows.reduce((acc, r) => acc + Number(r.total ?? 0), 0);
  const totalPaid = rows.reduce((acc, r) => acc + Math.round((Number(r.amountPaid) || 0) * 100) / 100, 0);
  const outstanding = rows.reduce((acc, r) => {
    const total = Number(r.total ?? 0);
    const paid = Math.round((Number(r.amountPaid) || 0) * 100) / 100;
    return acc + Math.max(0, Math.round((total - paid) * 100) / 100);
  }, 0);

  return {
    summary: { totalBilled, totalPaid, outstanding, currency: currency || 'USD' },
    invoices: rows.map(r => {
      const total = Number(r.total ?? 0);
      const amountPaid = Math.round((Number(r.amountPaid) || 0) * 100) / 100;
      const balanceDue = Math.round((total - amountPaid) * 100) / 100;
      return {
        id: r.id,
        invoiceNumber: r.invoiceNumber,
        issueDate: r.issueDate,
        dueDate: r.dueDate,
        total,
        balanceDue,
        status: r.status,
        currency: r.currency,
      };
    }),
  };
}
