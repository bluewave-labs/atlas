import type { Request, Response } from 'express';
import * as efaturaService from '../services/efatura.service';
import * as invoiceService from '../services/invoice.service';
import { logger } from '../../../utils/logger';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';

// ─── e-Fatura ──────────────────────────────────────────────────────

export async function generateEFatura(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'invoices');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update invoices' });
      return;
    }

    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;
    const { eFaturaType } = req.body || {};

    // Ownership guard: non-admins can only generate e-Fatura for their own invoices.
    const isAdmin = perm.role === 'admin';
    const parent = await invoiceService.getInvoice(req.auth!.userId, tenantId, id, isAdmin ? undefined : req.auth!.userId);
    if (!parent) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    const invoice = await efaturaService.generateEFatura(tenantId, id, eFaturaType);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    res.json({ success: true, data: invoice });
  } catch (error: any) {
    const message = error?.message || 'Failed to generate e-Fatura';
    logger.error({ error }, message);
    if (message === 'e-Fatura is not enabled' || message === 'Invoice client not found' || message === 'Invoice has no line items') {
      res.status(400).json({ success: false, error: message });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to generate e-Fatura' });
  }
}

export async function getEFaturaXml(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'invoices');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view invoices' });
      return;
    }

    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const isAdmin = perm.role === 'admin';
    const parent = await invoiceService.getInvoice(req.auth!.userId, tenantId, id, isAdmin ? undefined : req.auth!.userId);
    if (!parent) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    const xml = await efaturaService.getEFaturaXml(tenantId, id);
    if (!xml) {
      res.status(404).json({ success: false, error: 'e-Fatura XML not found. Generate it first.' });
      return;
    }

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  } catch (error) {
    logger.error({ error }, 'Failed to get e-Fatura XML');
    res.status(500).json({ success: false, error: 'Failed to get e-Fatura XML' });
  }
}

export async function getEFaturaPreview(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'invoices');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view invoices' });
      return;
    }

    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const isAdmin = perm.role === 'admin';
    const parent = await invoiceService.getInvoice(req.auth!.userId, tenantId, id, isAdmin ? undefined : req.auth!.userId);
    if (!parent) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    const html = await efaturaService.getEFaturaPreviewHtml(tenantId, id);
    if (!html) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (error) {
    logger.error({ error }, 'Failed to get e-Fatura preview');
    res.status(500).json({ success: false, error: 'Failed to get e-Fatura preview' });
  }
}

export async function getEFaturaPdf(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'invoices');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view invoices' });
      return;
    }

    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const isAdmin = perm.role === 'admin';
    const parent = await invoiceService.getInvoice(req.auth!.userId, tenantId, id, isAdmin ? undefined : req.auth!.userId);
    if (!parent) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    const html = await efaturaService.getEFaturaPreviewHtml(tenantId, id);
    if (!html) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    // Serve as downloadable HTML file (client can use window.print() for PDF)
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="efatura-${id}.html"`);
    res.send(html);
  } catch (error) {
    logger.error({ error }, 'Failed to get e-Fatura PDF');
    res.status(500).json({ success: false, error: 'Failed to get e-Fatura PDF' });
  }
}
