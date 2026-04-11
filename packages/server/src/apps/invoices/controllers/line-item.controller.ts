import type { Request, Response } from 'express';
import * as invoiceService from '../services/invoice.service';
import * as lineItemService from '../services/line-item.service';
import { logger } from '../../../utils/logger';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';

// ─── Line Items ─────────────────────────────────────────────────────

export async function listLineItems(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'invoices');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view invoices' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const invoiceId = req.params.invoiceId as string;

    // Verify the invoice belongs to the authenticated user's tenant, and for
    // non-admins, that it belongs to them specifically.
    const isAdmin = perm.role === 'admin';
    const invoice = await invoiceService.getInvoice(userId, tenantId, invoiceId, isAdmin ? undefined : userId);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    const lineItems = await lineItemService.listInvoiceLineItems(invoiceId);
    res.json({ success: true, data: { lineItems } });
  } catch (error) {
    logger.error({ error }, 'Failed to list line items');
    res.status(500).json({ success: false, error: 'Failed to list line items' });
  }
}

export async function createLineItem(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'invoices');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create in invoices' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const invoiceId = req.params.invoiceId as string;
    const { timeEntryId, description, quantity, unitPrice, amount, taxRate } = req.body;

    // Verify the invoice belongs to the authenticated user's tenant, and for
    // non-admins, that it belongs to them specifically.
    const isAdmin = perm.role === 'admin';
    const invoice = await invoiceService.getInvoice(userId, tenantId, invoiceId, isAdmin ? undefined : userId);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    if (!description) {
      res.status(400).json({ success: false, error: 'description is required' });
      return;
    }

    const lineItem = await lineItemService.createLineItem({
      invoiceId, timeEntryId, description, quantity: quantity ?? 1, unitPrice: unitPrice ?? 0, amount: amount ?? 0, taxRate,
    });

    res.json({ success: true, data: lineItem });
  } catch (error) {
    logger.error({ error }, 'Failed to create line item');
    res.status(500).json({ success: false, error: 'Failed to create line item' });
  }
}

export async function updateLineItem(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'invoices');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update in invoices' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const itemId = req.params.itemId as string;
    const { description, quantity, unitPrice, amount, taxRate } = req.body;

    // Verify the line item's invoice belongs to the authenticated user's tenant
    const existingLineItem = await lineItemService.getLineItemById(itemId);
    if (!existingLineItem) {
      res.status(404).json({ success: false, error: 'Line item not found' });
      return;
    }
    const isAdmin = perm.role === 'admin';
    const invoice = await invoiceService.getInvoice(userId, tenantId, existingLineItem.invoiceId, isAdmin ? undefined : userId);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    const lineItem = await lineItemService.updateLineItem(itemId, { description, quantity, unitPrice, amount, taxRate });
    if (!lineItem) {
      res.status(404).json({ success: false, error: 'Line item not found' });
      return;
    }

    res.json({ success: true, data: lineItem });
  } catch (error) {
    logger.error({ error }, 'Failed to update line item');
    res.status(500).json({ success: false, error: 'Failed to update line item' });
  }
}

export async function deleteLineItem(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'invoices');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete in invoices' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const itemId = req.params.itemId as string;

    // Verify the line item's invoice belongs to the authenticated user's tenant
    const existingLineItem = await lineItemService.getLineItemById(itemId);
    if (!existingLineItem) {
      res.status(404).json({ success: false, error: 'Line item not found' });
      return;
    }
    const isAdmin = perm.role === 'admin';
    const invoice = await invoiceService.getInvoice(userId, tenantId, existingLineItem.invoiceId, isAdmin ? undefined : userId);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    await lineItemService.deleteLineItem(itemId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete line item');
    res.status(500).json({ success: false, error: 'Failed to delete line item' });
  }
}
