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
import * as fs from 'fs';
import * as path from 'path';

export async function generateInvoicePdf(tenantId: string, invoiceId: string): Promise<Buffer> {
  // 1. Fetch invoice with line items
  const invoice = await getInvoice('', tenantId, invoiceId);
  if (!invoice) throw new Error('Invoice not found');

  // 2. Fetch settings (branding + templateId)
  const settings = await getInvoiceSettings(tenantId);

  // 3. Fetch company (client) info
  const [company] = await db.select().from(crmCompanies).where(eq(crmCompanies.id, invoice.companyId));

  // 4. Fetch contact if set
  let contact: any = null;
  if (invoice.contactId) {
    const [c] = await db.select().from(crmContacts).where(eq(crmContacts.id, invoice.contactId));
    contact = c;
  }

  // 5. Read logo file if exists, convert to base64
  let logoBase64: string | undefined;
  if (settings?.logoPath) {
    try {
      const logoFullPath = path.resolve(settings.logoPath);
      const logoBuffer = fs.readFileSync(logoFullPath);
      const ext = path.extname(settings.logoPath).toLowerCase();
      const mime = ext === '.png' ? 'image/png' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';
      logoBase64 = `data:${mime};base64,${logoBuffer.toString('base64')}`;
    } catch (err) {
      logger.warn({ err, logoPath: settings.logoPath }, 'Failed to read logo file');
    }
  }

  // 6. Build template props
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
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
    },
    lineItems: (invoice.lineItems || []).map((li: any) => ({
      description: li.description,
      quantity: li.quantity,
      unitPrice: li.unitPrice,
      amount: li.amount,
      taxRate: li.taxRate,
    })),
    branding: {
      logoBase64,
      accentColor: settings?.accentColor || '#13715B',
      companyName: settings?.companyName || undefined,
      companyAddress: settings?.companyAddress || undefined,
      companyCity: settings?.companyCity || undefined,
      companyCountry: settings?.companyCountry || undefined,
      companyPhone: settings?.companyPhone || undefined,
      companyEmail: settings?.companyEmail || undefined,
      companyWebsite: settings?.companyWebsite || undefined,
      companyTaxId: settings?.companyTaxId || undefined,
      paymentInstructions: settings?.paymentInstructions || undefined,
      bankDetails: settings?.bankDetails || undefined,
      footerText: settings?.footerText || undefined,
    },
    client: {
      name: company?.name || 'Unknown',
      address: company?.address || undefined,
      postalCode: company?.postalCode || undefined,
      city: company?.city || undefined,
      state: company?.state || undefined,
      country: company?.country || undefined,
      taxId: company?.taxId || undefined,
      contactName: contact?.name || invoice.contactName || undefined,
      contactEmail: contact?.email || invoice.contactEmail || undefined,
    },
  };

  // 7. Get template component
  const templateId = settings?.templateId || 'classic';
  const Template = getTemplate(templateId);

  // 8. Render to PDF buffer
  const pdfBuffer = await renderToBuffer(React.createElement(Template, templateProps));
  return Buffer.from(pdfBuffer);
}
