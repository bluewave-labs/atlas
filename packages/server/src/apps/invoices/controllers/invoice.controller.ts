import type { Request, Response } from 'express';
import * as invoiceService from '../services/invoice.service';
import { sendInvoiceEmail } from '../services/invoice-email.service';
import { logger } from '../../../utils/logger';
import { canAccess } from '../../../services/app-permissions.service';
import { emitAppEvent } from '../../../services/event.service';

// ─── Invoices ───────────────────────────────────────────────────────

export async function listInvoices(req: Request, res: Response) {
  try {
    const perm = req.invoicesPerm!;
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { companyId, contactId, dealId, status, search, includeArchived } = req.query;

    const isAdmin = perm.role === 'admin';
    const invoicesList = await invoiceService.listInvoices(userId, tenantId, {
      companyId: companyId as string | undefined,
      contactId: contactId as string | undefined,
      dealId: dealId as string | undefined,
      status: status as string | undefined,
      search: search as string | undefined,
      includeArchived: includeArchived === 'true',
      isAdmin,
    });

    res.json({ success: true, data: { invoices: invoicesList } });
  } catch (error) {
    logger.error({ error }, 'Failed to list invoices');
    res.status(500).json({ success: false, error: 'Failed to list invoices' });
  }
}

export async function getInvoice(req: Request, res: Response) {
  try {
    const perm = req.invoicesPerm!;
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const isAdmin = perm.role === 'admin';
    const invoice = await invoiceService.getInvoice(userId, tenantId, id, isAdmin ? undefined : userId);
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

export async function getNextInvoiceNumber(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const invoiceNumber = await invoiceService.getNextInvoiceNumber(tenantId);
    res.json({ success: true, data: { invoiceNumber } });
  } catch (error) {
    logger.error({ error }, 'Failed to get next invoice number');
    res.status(500).json({ success: false, error: 'Failed to get next invoice number' });
  }
}

export async function createInvoice(req: Request, res: Response) {
  try {
    const perm = req.invoicesPerm!;
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create invoices' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const {
      companyId, contactId, dealId, proposalId,
      invoiceNumber, status, subtotal, taxPercent, taxAmount,
      discountPercent, discountAmount, total, currency,
      issueDate, dueDate, notes, timeEntryIds,
    } = req.body;

    if (!companyId) {
      res.status(400).json({ success: false, error: 'companyId is required' });
      return;
    }

    const invoice = await invoiceService.createInvoice(userId, tenantId, {
      companyId, contactId, dealId, proposalId,
      invoiceNumber, status, subtotal, taxPercent, taxAmount,
      discountPercent, discountAmount, total, currency,
      issueDate, dueDate, notes, timeEntryIds,
    });

    res.json({ success: true, data: invoice });
  } catch (error) {
    logger.error({ error }, 'Failed to create invoice');
    res.status(500).json({ success: false, error: 'Failed to create invoice' });
  }
}

export async function updateInvoice(req: Request, res: Response) {
  try {
    const perm = req.invoicesPerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update invoices' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;
    const {
      companyId, contactId, dealId, proposalId,
      invoiceNumber, status, subtotal, taxPercent, taxAmount,
      discountPercent, discountAmount, total, currency,
      issueDate, dueDate, notes, isArchived, lineItems,
    } = req.body;

    const isAdmin = perm.role === 'admin';
    const invoice = await invoiceService.updateInvoice(userId, tenantId, id, {
      companyId, contactId, dealId, proposalId,
      invoiceNumber, status, subtotal, taxPercent, taxAmount,
      discountPercent, discountAmount, total, currency,
      issueDate, dueDate, notes, isArchived, lineItems,
    }, isAdmin ? undefined : userId);

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
    const perm = req.invoicesPerm!;
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete invoices' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const isAdmin = perm.role === 'admin';
    const deleted = await invoiceService.deleteInvoice(userId, tenantId, id, isAdmin ? undefined : userId);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete invoice');
    res.status(500).json({ success: false, error: 'Failed to delete invoice' });
  }
}

export async function sendInvoice(req: Request, res: Response) {
  try {
    const perm = req.invoicesPerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update invoices' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;
    const {
      customSubject,
      customMessage,
      ccEmails,
      skipEmail,
    } = (req.body ?? {}) as {
      customSubject?: string;
      customMessage?: string;
      ccEmails?: string[];
      skipEmail?: boolean;
    };

    // Ownership guard: non-admins can only send their own invoices.
    const isAdmin = perm.role === 'admin';
    const ownedCheck = await invoiceService.getInvoice(userId, tenantId, id, isAdmin ? undefined : userId);
    if (!ownedCheck) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    // 1. Flip status to 'sent' and stamp sentAt (existing behavior).
    const invoice = await invoiceService.sendInvoice(userId, tenantId, id);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    // Get full invoice for event metadata
    const fullInvoice = await invoiceService.getInvoice(userId, tenantId, id);

    if (req.auth!.tenantId) {
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'invoices',
        eventType: 'invoice.sent',
        title: `sent invoice ${invoice.invoiceNumber} to ${fullInvoice?.companyName ?? 'client'}`,
        metadata: { invoiceId: invoice.id },
      }).catch(() => {});
    }

    // 2. "Just mark as sent" path — skip email dispatch.
    if (skipEmail === true) {
      res.json({
        success: true,
        data: { invoice, emailSent: false, reason: 'skipped' },
      });
      return;
    }

    // 3. Attempt the email dispatch. The status flip already succeeded,
    //    so any email failure is a partial success reported in `data`,
    //    never a 500.
    const emailResult = await sendInvoiceEmail(id, tenantId, {
      customSubject,
      customMessage,
      ccEmails,
    });

    res.json({
      success: true,
      data: {
        invoice,
        emailSent: emailResult.sent,
        ...(emailResult.reason ? { reason: emailResult.reason } : {}),
        ...(emailResult.recipient ? { recipient: emailResult.recipient } : {}),
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to send invoice');
    res.status(500).json({ success: false, error: 'Failed to send invoice' });
  }
}

export async function emailInvoice(req: Request, res: Response) {
  try {
    const perm = req.invoicesPerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to email invoices' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;
    const {
      customSubject,
      customMessage,
      ccEmails,
      recipientOverride,
    } = (req.body ?? {}) as {
      customSubject?: string;
      customMessage?: string;
      ccEmails?: string[];
      recipientOverride?: string;
    };

    // Verify the invoice exists and is not in draft status. Non-admins can
    // only re-email their own invoices.
    const isAdmin = perm.role === 'admin';
    const existing = await invoiceService.getInvoice(userId, tenantId, id, isAdmin ? undefined : userId);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    if (existing.status === 'draft') {
      res.status(400).json({
        success: false,
        error: 'Cannot email a draft invoice. Send it first.',
      });
      return;
    }

    // Re-send the email without touching status.
    const emailResult = await sendInvoiceEmail(id, tenantId, {
      customSubject,
      customMessage,
      ccEmails,
      recipientOverride,
    });

    res.json({
      success: true,
      data: {
        emailSent: emailResult.sent,
        ...(emailResult.reason ? { reason: emailResult.reason } : {}),
        ...(emailResult.recipient ? { recipient: emailResult.recipient } : {}),
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to email invoice');
    res.status(500).json({ success: false, error: 'Failed to email invoice' });
  }
}

export async function markInvoicePaid(req: Request, res: Response) {
  try {
    const perm = req.invoicesPerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update invoices' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    // Ownership guard: non-admins can only mark their own invoices as paid.
    const isAdmin = perm.role === 'admin';
    const ownedCheck = await invoiceService.getInvoice(userId, tenantId, id, isAdmin ? undefined : userId);
    if (!ownedCheck) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    const invoice = await invoiceService.markInvoicePaid(userId, tenantId, id);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    if (req.auth!.tenantId) {
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'invoices',
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

export async function waiveInvoice(req: Request, res: Response) {
  try {
    const perm = req.invoicesPerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update invoices' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    // Ownership guard: non-admins can only waive their own invoices.
    const isAdmin = perm.role === 'admin';
    const ownedCheck = await invoiceService.getInvoice(userId, tenantId, id, isAdmin ? undefined : userId);
    if (!ownedCheck) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    const invoice = await invoiceService.waiveInvoice(userId, tenantId, id);
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

export async function duplicateInvoice(req: Request, res: Response) {
  try {
    const perm = req.invoicesPerm!;
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create invoices' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    // Ownership guard: non-admins can only duplicate their own invoices.
    // (duplicateInvoice internally calls getInvoice; we gate it up-front.)
    const viewPerm = req.invoicesPerm!;
    const isAdmin = viewPerm.role === 'admin';
    const ownedCheck = await invoiceService.getInvoice(userId, tenantId, id, isAdmin ? undefined : userId);
    if (!ownedCheck) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    const invoice = await invoiceService.duplicateInvoice(userId, tenantId, id);
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
