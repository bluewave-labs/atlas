import type { Request, Response } from 'express';
import { generateInvoicePdf } from '../services/pdf.service';
import { logger } from '../../../utils/logger';

export async function getInvoicePdf(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const { id } = req.params;
    const pdfBytes = await generateInvoicePdf(tenantId, id as string);

    const inline = req.query.inline === 'true';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', inline ? 'inline' : `attachment; filename="invoice-${id}.pdf"`);
    res.send(pdfBytes);
  } catch (error) {
    logger.error({ error }, 'Failed to generate invoice PDF');
    res.status(500).json({ success: false, error: 'Failed to generate invoice PDF' });
  }
}
