import type { Request, Response } from 'express';
import * as projectService from '../service';
import { logger } from '../../../utils/logger';
import { emitAppEvent } from '../../../services/event.service';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';

// ─── Invoices ───────────────────────────────────────────────────────

export async function listInvoices(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { clientId, status, search, includeArchived } = req.query;

    const isAdmin = perm.role === 'admin' || perm.role === 'manager';
    const invoices = await projectService.listInvoices(userId, tenantId, {
      clientId: clientId as string | undefined,
      status: status as string | undefined,
      search: search as string | undefined,
      includeArchived: includeArchived === 'true',
      isAdmin,
    });

    res.json({ success: true, data: { invoices } });
  } catch (error) {
    logger.error({ error }, 'Failed to list invoices');
    res.status(500).json({ success: false, error: 'Failed to list invoices' });
  }
}

export async function getInvoice(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const invoice = await projectService.getInvoice(userId, tenantId, id);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    logger.error({ error }, 'Failed to get invoice');
    res.status(500).json({ success: false, error: 'Failed to get invoice' });
  }
}

export async function createInvoice(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { clientId, invoiceNumber, status, amount, tax, taxAmount, discount, discountAmount, currency, issueDate, dueDate, notes } = req.body;

    if (!clientId) {
      res.status(400).json({ success: false, error: 'clientId is required' });
      return;
    }

    const invoice = await projectService.createInvoice(userId, tenantId, {
      clientId, invoiceNumber, status, amount, tax, taxAmount, discount, discountAmount, currency, issueDate, dueDate, notes,
    });

    res.json({ success: true, data: invoice });
  } catch (error) {
    logger.error({ error }, 'Failed to create invoice');
    res.status(500).json({ success: false, error: 'Failed to create invoice' });
  }
}

export async function updateInvoice(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;
    const { clientId, invoiceNumber, status, amount, tax, taxAmount, discount, discountAmount, currency, issueDate, dueDate, notes, isArchived } = req.body;

    const invoice = await projectService.updateInvoice(userId, tenantId, id, {
      clientId, invoiceNumber, status, amount, tax, taxAmount, discount, discountAmount, currency, issueDate, dueDate, notes, isArchived,
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    logger.error({ error }, 'Failed to update invoice');
    res.status(500).json({ success: false, error: 'Failed to update invoice' });
  }
}

export async function deleteInvoice(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    await projectService.deleteInvoice(userId, tenantId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete invoice');
    res.status(500).json({ success: false, error: 'Failed to delete invoice' });
  }
}

export async function sendInvoice(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const invoice = await projectService.sendInvoice(userId, tenantId, id);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    // Get client name for event
    const fullInvoice = await projectService.getInvoice(userId, tenantId, id);

    if (req.auth!.tenantId) {
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'projects',
        eventType: 'invoice.sent',
        title: `sent invoice ${invoice.invoiceNumber} to ${fullInvoice?.clientName ?? 'client'}`,
        metadata: { invoiceId: invoice.id },
      }).catch(() => {});
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    logger.error({ error }, 'Failed to send invoice');
    res.status(500).json({ success: false, error: 'Failed to send invoice' });
  }
}

export async function markInvoicePaid(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const invoice = await projectService.markInvoicePaid(userId, tenantId, id);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    if (req.auth!.tenantId) {
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'projects',
        eventType: 'invoice.paid',
        title: `invoice ${invoice.invoiceNumber} marked as paid`,
        metadata: { invoiceId: invoice.id },
      }).catch(() => {});
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    logger.error({ error }, 'Failed to mark invoice paid');
    res.status(500).json({ success: false, error: 'Failed to mark invoice paid' });
  }
}

export async function duplicateInvoice(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const invoice = await projectService.duplicateInvoice(userId, tenantId, id);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    logger.error({ error }, 'Failed to duplicate invoice');
    res.status(500).json({ success: false, error: 'Failed to duplicate invoice' });
  }
}

export async function getNextInvoiceNumber(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view projects' });
      return;
    }

    const tenantId = req.auth!.tenantId;
    const invoiceNumber = await projectService.getNextInvoiceNumber(tenantId);
    res.json({ success: true, data: { invoiceNumber } });
  } catch (error) {
    logger.error({ error }, 'Failed to get next invoice number');
    res.status(500).json({ success: false, error: 'Failed to get next invoice number' });
  }
}

export async function waiveInvoice(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const invoice = await projectService.waiveInvoice(userId, tenantId, id);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    logger.error({ error }, 'Failed to waive invoice');
    res.status(500).json({ success: false, error: 'Failed to waive invoice' });
  }
}

// ─── Line Items ─────────────────────────────────────────────────────

export async function listLineItems(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const invoiceId = req.params.invoiceId as string;

    // Verify the invoice belongs to the authenticated user's account
    const invoice = await projectService.getInvoice(userId, tenantId, invoiceId);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    const lineItems = await projectService.listInvoiceLineItems(invoiceId);
    res.json({ success: true, data: { lineItems } });
  } catch (error) {
    logger.error({ error }, 'Failed to list line items');
    res.status(500).json({ success: false, error: 'Failed to list line items' });
  }
}

export async function createLineItem(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const invoiceId = req.params.invoiceId as string;
    const { timeEntryId, description, quantity, unitPrice, amount, taxRate } = req.body;

    // Verify the invoice belongs to the authenticated user's account
    const invoice = await projectService.getInvoice(userId, tenantId, invoiceId);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    if (!description) {
      res.status(400).json({ success: false, error: 'description is required' });
      return;
    }

    const lineItem = await projectService.createLineItem({
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
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;
    const { description, quantity, unitPrice, amount, taxRate } = req.body;

    // Verify the line item's invoice belongs to the authenticated user's account
    const existingLineItem = await projectService.getLineItemById(id);
    if (!existingLineItem) {
      res.status(404).json({ success: false, error: 'Line item not found' });
      return;
    }
    const invoice = await projectService.getInvoice(userId, tenantId, existingLineItem.invoiceId);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    const lineItem = await projectService.updateLineItem(id, { description, quantity, unitPrice, amount, taxRate });
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
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    // Verify the line item's invoice belongs to the authenticated user's account
    const existingLineItem = await projectService.getLineItemById(id);
    if (!existingLineItem) {
      res.status(404).json({ success: false, error: 'Line item not found' });
      return;
    }
    const invoice = await projectService.getInvoice(userId, tenantId, existingLineItem.invoiceId);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    await projectService.deleteLineItem(id);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete line item');
    res.status(500).json({ success: false, error: 'Failed to delete line item' });
  }
}

export async function populateFromTimeEntries(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create in projects' });
      return;
    }

    const tenantId = req.auth!.tenantId;
    const invoiceId = req.params.invoiceId as string;
    const { clientId, startDate, endDate } = req.body;

    if (!clientId || !startDate || !endDate) {
      res.status(400).json({ success: false, error: 'clientId, startDate, and endDate are required' });
      return;
    }

    const lineItems = await projectService.populateFromTimeEntries(tenantId, invoiceId, clientId, startDate, endDate);
    res.json({ success: true, data: { lineItems } });
  } catch (error) {
    logger.error({ error }, 'Failed to populate from time entries');
    res.status(500).json({ success: false, error: 'Failed to populate from time entries' });
  }
}

export async function previewTimeEntryLineItems(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view projects' });
      return;
    }

    const tenantId = req.auth!.tenantId;
    const { clientId, startDate, endDate } = req.body;

    if (!clientId || !startDate || !endDate) {
      res.status(400).json({ success: false, error: 'clientId, startDate, and endDate are required' });
      return;
    }

    const lineItems = await projectService.previewTimeEntryLineItems(tenantId, clientId, startDate, endDate);
    res.json({ success: true, data: { lineItems } });
  } catch (error) {
    logger.error({ error }, 'Failed to preview time entry line items');
    res.status(500).json({ success: false, error: 'Failed to preview time entry line items' });
  }
}
