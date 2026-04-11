import type { Request, Response } from 'express';
import * as paymentService from '../services/payment.service';
import * as invoiceService from '../services/invoice.service';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';

// ─── Payments ───────────────────────────────────────────────────────
//
// Note: service methods throw AppError on validation / not-found issues.
// Express 5 auto-forwards async rejections to the error-handler middleware
// (see packages/server/src/middleware/error-handler.ts), so handlers here
// don't wrap service calls in try/catch.

export async function listPayments(req: Request, res: Response) {
  const tenantId = req.auth!.tenantId;
  if (!tenantId) {
    res.status(400).json({ success: false, error: 'Tenant context required' });
    return;
  }
  const perm = await getAppPermission(tenantId, req.auth!.userId, 'invoices');
  if (!canAccess(perm.role, 'view')) {
    res.status(403).json({ success: false, error: 'No permission to view invoices' });
    return;
  }

  const invoiceId = req.params.invoiceId as string;
  const isAdmin = perm.role === 'admin';
  const parent = await invoiceService.getInvoice(req.auth!.userId, tenantId, invoiceId, isAdmin ? undefined : req.auth!.userId);
  if (!parent) {
    res.status(404).json({ success: false, error: 'Invoice not found' });
    return;
  }

  const payments = await paymentService.listPaymentsForInvoice(invoiceId, tenantId);
  res.json({ success: true, data: payments });
}

export async function recordPayment(req: Request, res: Response) {
  const tenantId = req.auth!.tenantId;
  if (!tenantId) {
    res.status(400).json({ success: false, error: 'Tenant context required' });
    return;
  }
  const perm = await getAppPermission(tenantId, req.auth!.userId, 'invoices');
  if (!canAccess(perm.role, 'update')) {
    res.status(403).json({ success: false, error: 'No permission to record payments' });
    return;
  }

  const invoiceId = req.params.invoiceId as string;
  const isAdmin = perm.role === 'admin';
  const parent = await invoiceService.getInvoice(req.auth!.userId, tenantId, invoiceId, isAdmin ? undefined : req.auth!.userId);
  if (!parent) {
    res.status(404).json({ success: false, error: 'Invoice not found' });
    return;
  }

  const input = { ...req.body, invoiceId };
  const payment = await paymentService.recordPayment(input, req.auth!.userId, tenantId);
  res.json({ success: true, data: payment });
}

export async function updatePayment(req: Request, res: Response) {
  const tenantId = req.auth!.tenantId;
  if (!tenantId) {
    res.status(400).json({ success: false, error: 'Tenant context required' });
    return;
  }
  const perm = await getAppPermission(tenantId, req.auth!.userId, 'invoices');
  if (!canAccess(perm.role, 'update')) {
    res.status(403).json({ success: false, error: 'No permission to update payments' });
    return;
  }

  const paymentId = req.params.paymentId as string;
  const parentInvoiceId = await paymentService.getPaymentInvoiceId(paymentId, tenantId);
  if (!parentInvoiceId) {
    res.status(404).json({ success: false, error: 'Payment not found' });
    return;
  }
  const isAdmin = perm.role === 'admin';
  const parent = await invoiceService.getInvoice(req.auth!.userId, tenantId, parentInvoiceId, isAdmin ? undefined : req.auth!.userId);
  if (!parent) {
    res.status(404).json({ success: false, error: 'Payment not found' });
    return;
  }

  const payment = await paymentService.updatePayment(paymentId, req.body, tenantId);
  res.json({ success: true, data: payment });
}

export async function deletePayment(req: Request, res: Response) {
  const tenantId = req.auth!.tenantId;
  if (!tenantId) {
    res.status(400).json({ success: false, error: 'Tenant context required' });
    return;
  }
  const perm = await getAppPermission(tenantId, req.auth!.userId, 'invoices');
  if (!canAccess(perm.role, 'update')) {
    res.status(403).json({ success: false, error: 'No permission to delete payments' });
    return;
  }

  const paymentId = req.params.paymentId as string;
  const parentInvoiceId = await paymentService.getPaymentInvoiceId(paymentId, tenantId);
  if (!parentInvoiceId) {
    res.status(404).json({ success: false, error: 'Payment not found' });
    return;
  }
  const isAdmin = perm.role === 'admin';
  const parent = await invoiceService.getInvoice(req.auth!.userId, tenantId, parentInvoiceId, isAdmin ? undefined : req.auth!.userId);
  if (!parent) {
    res.status(404).json({ success: false, error: 'Payment not found' });
    return;
  }

  await paymentService.deletePayment(paymentId, tenantId);
  res.json({ success: true });
}
