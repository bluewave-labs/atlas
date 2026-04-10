import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { db } from '../../../config/database';
import { crmCompanies, crmContacts } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { getTemplate } from '../templates';
import type { InvoiceTemplateProps } from '../templates/types';
import { getInvoiceSettings } from './settings.service';
import { getInvoice } from './invoice.service';
import { logger } from '../../../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function generateInvoicePdf(tenantId: string, invoiceId: string): Promise<Buffer> {
  // Fetch invoice and settings in parallel
  const [invoice, settings] = await Promise.all([
    getInvoice('', tenantId, invoiceId),
    getInvoiceSettings(tenantId),
  ]);
  if (!invoice) throw new Error('Invoice not found');

  // Fetch company and contact in parallel
  const [companyResult, contact] = await Promise.all([
    db.select().from(crmCompanies).where(eq(crmCompanies.id, invoice.companyId)),
    invoice.contactId
      ? db.select().from(crmContacts).where(eq(crmContacts.id, invoice.contactId)).then(r => r[0] ?? null)
      : Promise.resolve(null),
  ]);
  const company = companyResult[0];

  // Read logo file if exists, convert to base64
  // logoPath is a relative path under uploads/ (e.g. "{tenantId}/{filename}")
  let logoBase64: string | undefined;
  if (settings?.logoPath) {
    try {
      const uploadsRoot = path.join(__dirname, '../../../../uploads');
      const logoFullPath = path.resolve(uploadsRoot, settings.logoPath);
      // Guard against path traversal — ensure resolved path stays within uploads/
      if (!logoFullPath.startsWith(path.resolve(uploadsRoot))) {
        throw new Error('logoPath escapes uploads directory');
      }
      const logoBuffer = await fs.readFile(logoFullPath);
      const ext = path.extname(settings.logoPath).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';
      logoBase64 = `data:${mime};base64,${logoBuffer.toString('base64')}`;
    } catch (err) {
      logger.warn({ err, logoPath: settings.logoPath }, 'Failed to read logo file');
    }
  }

  const templateProps: InvoiceTemplateProps = {
    invoice: {
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      currency: invoice.currency,
      subtotal: invoice.subtotal,
      taxPercent: invoice.taxPercent,
      taxAmount: invoice.taxAmount,
      discountPercent: invoice.discountPercent,
      discountAmount: invoice.discountAmount,
      total: invoice.total,
      notes: invoice.notes,
      issueDate: invoice.issueDate instanceof Date ? invoice.issueDate.toISOString() : String(invoice.issueDate),
      dueDate: invoice.dueDate instanceof Date ? invoice.dueDate.toISOString() : String(invoice.dueDate),
    },
    lineItems: Array.isArray(invoice.lineItems) ? invoice.lineItems.map((li) => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      amount: li.amount,
      taxRate: li.taxRate,
    })) : [],
    branding: {
      logoBase64,
      accentColor: settings?.accentColor ?? '#13715B',
      companyName: settings?.companyName ?? undefined,
      companyAddress: settings?.companyAddress ?? undefined,
      companyCity: settings?.companyCity ?? undefined,
      companyCountry: settings?.companyCountry ?? undefined,
      companyPhone: settings?.companyPhone ?? undefined,
      companyEmail: settings?.companyEmail ?? undefined,
      companyWebsite: settings?.companyWebsite ?? undefined,
      companyTaxId: settings?.companyTaxId ?? undefined,
      paymentInstructions: settings?.paymentInstructions ?? undefined,
      bankDetails: settings?.bankDetails ?? undefined,
      footerText: settings?.footerText ?? undefined,
    },
    client: {
      name: company?.name || 'Unknown',
      address: company?.address ?? undefined,
      postalCode: company?.postalCode ?? undefined,
      state: company?.state ?? undefined,
      country: company?.country ?? undefined,
      taxId: company?.taxId ?? undefined,
      contactName: contact?.name ?? invoice.contactName ?? undefined,
      contactEmail: contact?.email ?? invoice.contactEmail ?? undefined,
    },
  };

  const templateId = settings?.templateId || 'classic';
  const Template = getTemplate(templateId);

  // @react-pdf/renderer types expect DocumentProps but templates return Document elements
  const pdfBuffer = await renderToBuffer(React.createElement(Template, templateProps) as any);
  return Buffer.from(pdfBuffer);
}
