import type { Request, Response } from 'express';
import * as recurringService from '../services/recurring-invoice.service';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';

// ─── Recurring Invoices ─────────────────────────────────────────────
//
// Note: service methods throw AppError on validation / not-found issues.
// Express 5 auto-forwards async rejections to the error-handler middleware
// (see packages/server/src/middleware/error-handler.ts), so handlers here
// don't wrap service calls in try/catch.

export async function listRecurring(req: Request, res: Response) {
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

  const isAdmin = perm.role === 'admin' || perm.role === 'manager';
  const list = await recurringService.listRecurringInvoices(tenantId, req.auth!.userId, isAdmin);
  res.json({ success: true, data: list });
}

export async function getRecurring(req: Request, res: Response) {
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

  const id = req.params.id as string;
  const data = await recurringService.getRecurringInvoice(id, tenantId);
  res.json({ success: true, data });
}

export async function createRecurring(req: Request, res: Response) {
  const tenantId = req.auth!.tenantId;
  if (!tenantId) {
    res.status(400).json({ success: false, error: 'Tenant context required' });
    return;
  }
  const perm = await getAppPermission(tenantId, req.auth!.userId, 'invoices');
  if (!canAccess(perm.role, 'create')) {
    res.status(403).json({ success: false, error: 'No permission to create recurring invoices' });
    return;
  }

  const data = await recurringService.createRecurringInvoice(req.body, req.auth!.userId, tenantId);
  res.json({ success: true, data });
}

export async function updateRecurring(req: Request, res: Response) {
  const tenantId = req.auth!.tenantId;
  if (!tenantId) {
    res.status(400).json({ success: false, error: 'Tenant context required' });
    return;
  }
  const perm = await getAppPermission(tenantId, req.auth!.userId, 'invoices');
  if (!canAccess(perm.role, 'update')) {
    res.status(403).json({ success: false, error: 'No permission to update recurring invoices' });
    return;
  }

  const id = req.params.id as string;
  const data = await recurringService.updateRecurringInvoice(id, req.body, tenantId);
  res.json({ success: true, data });
}

export async function deleteRecurring(req: Request, res: Response) {
  const tenantId = req.auth!.tenantId;
  if (!tenantId) {
    res.status(400).json({ success: false, error: 'Tenant context required' });
    return;
  }
  const perm = await getAppPermission(tenantId, req.auth!.userId, 'invoices');
  if (!canAccess(perm.role, 'delete')) {
    res.status(403).json({ success: false, error: 'No permission to delete recurring invoices' });
    return;
  }

  const id = req.params.id as string;
  await recurringService.deleteRecurringInvoice(id, tenantId);
  res.json({ success: true });
}

export async function pauseRecurring(req: Request, res: Response) {
  const tenantId = req.auth!.tenantId;
  if (!tenantId) {
    res.status(400).json({ success: false, error: 'Tenant context required' });
    return;
  }
  const perm = await getAppPermission(tenantId, req.auth!.userId, 'invoices');
  if (!canAccess(perm.role, 'update')) {
    res.status(403).json({ success: false, error: 'No permission to pause recurring invoices' });
    return;
  }

  const id = req.params.id as string;
  const data = await recurringService.pauseRecurringInvoice(id, tenantId);
  res.json({ success: true, data });
}

export async function resumeRecurring(req: Request, res: Response) {
  const tenantId = req.auth!.tenantId;
  if (!tenantId) {
    res.status(400).json({ success: false, error: 'Tenant context required' });
    return;
  }
  const perm = await getAppPermission(tenantId, req.auth!.userId, 'invoices');
  if (!canAccess(perm.role, 'update')) {
    res.status(403).json({ success: false, error: 'No permission to resume recurring invoices' });
    return;
  }

  const id = req.params.id as string;
  const data = await recurringService.resumeRecurringInvoice(id, tenantId);
  res.json({ success: true, data });
}

export async function runRecurringNow(req: Request, res: Response) {
  const tenantId = req.auth!.tenantId;
  if (!tenantId) {
    res.status(400).json({ success: false, error: 'Tenant context required' });
    return;
  }
  const perm = await getAppPermission(tenantId, req.auth!.userId, 'invoices');
  if (!canAccess(perm.role, 'update')) {
    res.status(403).json({ success: false, error: 'No permission to generate recurring invoices' });
    return;
  }

  const id = req.params.id as string;
  const data = await recurringService.generateInvoiceFromRecurring(id, tenantId);
  res.json({ success: true, data });
}
