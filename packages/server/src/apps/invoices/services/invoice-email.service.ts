/**
 * Send invoice email service.
 *
 * Orchestrates loading the invoice, resolving a recipient, generating
 * the PDF, building the email body, and dispatching via the shared
 * sendEmail() helper. Updates last_emailed_at and email_sent_count on
 * success. Never throws — all failures become structured log entries
 * plus a `{ sent: false, reason }` return value.
 */

import { db } from '../../../config/database';
import { invoices, crmCompanies, crmContacts } from '../../../db/schema';
import { and, asc, eq, sql } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import { env } from '../../../config/env';
import { sendEmail } from '../../../services/email.service';
import { getInvoice } from './invoice.service';
import { getInvoiceSettings } from './settings.service';
import { generateInvoicePdf } from './pdf.service';
import { buildInvoiceEmailTemplate } from '../email-templates';

export interface SendInvoiceEmailOptions {
  customSubject?: string;
  customMessage?: string;
  ccEmails?: string[];
  recipientOverride?: string;
}

export interface SendInvoiceEmailResult {
  sent: boolean;
  reason?: string;
  recipient?: string;
}

export async function sendInvoiceEmail(
  invoiceId: string,
  tenantId: string,
  options?: SendInvoiceEmailOptions,
): Promise<SendInvoiceEmailResult> {
  try {
    // 1. Load invoice scoped to tenant
    const invoice = await getInvoice('', tenantId, invoiceId);
    if (!invoice) {
      logger.warn({ invoiceId, tenantId }, 'sendInvoiceEmail: invoice not found');
      return { sent: false, reason: 'Invoice not found' };
    }

    // 2. Load company
    const [company] = await db
      .select()
      .from(crmCompanies)
      .where(eq(crmCompanies.id, invoice.companyId))
      .limit(1);

    if (!company) {
      logger.warn({ invoiceId, companyId: invoice.companyId }, 'sendInvoiceEmail: company not found');
      return { sent: false, reason: 'Company not found' };
    }

    // 3. Load tenant invoice settings (default to empty if missing)
    const settings = (await getInvoiceSettings(tenantId)) ?? {};

    // 4. Resolve recipient
    let recipient: string | undefined;
    if (options?.recipientOverride) {
      recipient = options.recipientOverride;
    } else {
      // First non-archived contact for this company that has an email
      const [primaryContact] = await db
        .select({ email: crmContacts.email })
        .from(crmContacts)
        .where(
          and(
            eq(crmContacts.companyId, company.id),
            eq(crmContacts.isArchived, false),
          ),
        )
        .orderBy(asc(crmContacts.sortOrder), asc(crmContacts.createdAt))
        .limit(1);

      if (primaryContact?.email) {
        recipient = primaryContact.email;
      } else if (invoice.contactEmail) {
        // Fallback to the contact email already joined into the invoice
        recipient = invoice.contactEmail;
      }
    }

    if (!recipient) {
      logger.warn(
        { invoiceId, companyId: company.id },
        'sendInvoiceEmail: no recipient email available',
      );
      return { sent: false, reason: 'No recipient email address available' };
    }

    if (options?.ccEmails && options.ccEmails.length > 0) {
      logger.warn(
        { invoiceId, ccCount: options.ccEmails.length },
        'sendInvoiceEmail: ccEmails not yet supported by sendEmail; ignoring',
      );
    }

    // 5. Generate PDF
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await generateInvoicePdf(tenantId, invoiceId);
    } catch (err) {
      logger.error({ err, invoiceId }, 'sendInvoiceEmail: failed to render PDF');
      return { sent: false, reason: 'Failed to generate invoice PDF', recipient };
    }

    // 6. Build portal URL — matches the public route mounted at
    //    /api/invoices/portal/:token/:invoiceId (see invoices/routes.ts)
    const baseUrl = env.CLIENT_PUBLIC_URL || env.SERVER_PUBLIC_URL;
    const portalUrl = company.portalToken
      ? `${baseUrl}/api/invoices/portal/${company.portalToken}/${invoice.id}`
      : `${baseUrl}/api/invoices/portal/${invoice.id}`;

    // 7. Build email content
    const template = buildInvoiceEmailTemplate({
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        balanceDue: invoice.total,
        currency: invoice.currency,
        dueDate: invoice.dueDate instanceof Date ? invoice.dueDate : invoice.dueDate ? new Date(invoice.dueDate) : null,
        issueDate: invoice.issueDate instanceof Date ? invoice.issueDate : invoice.issueDate ? new Date(invoice.issueDate) : null,
      },
      company: {
        name: company.name,
        email: null,
      },
      settings: {
        companyName: settings.companyName ?? null,
        companyEmail: settings.companyEmail ?? null,
        companyAddress: settings.companyAddress ?? null,
        companyCity: settings.companyCity ?? null,
        companyCountry: settings.companyCountry ?? null,
        companyPhone: settings.companyPhone ?? null,
        companyWebsite: settings.companyWebsite ?? null,
        companyTaxId: settings.companyTaxId ?? null,
        accentColor: settings.accentColor ?? null,
        paymentInstructions: settings.paymentInstructions ?? null,
        bankDetails: settings.bankDetails ?? null,
        footerText: settings.footerText ?? null,
      },
      portalUrl,
      customSubject: options?.customSubject,
      customMessage: options?.customMessage,
    });

    // 8. Dispatch
    const sent = await sendEmail({
      to: recipient,
      subject: template.subject,
      text: template.text,
      html: template.html,
      attachments: [
        {
          filename: `Invoice-${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: 'application/pdf',
        },
      ],
    });

    if (sent) {
      try {
        await db
          .update(invoices)
          .set({
            lastEmailedAt: new Date(),
            emailSentCount: sql`${invoices.emailSentCount} + 1`,
            updatedAt: new Date(),
          })
          .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)));
      } catch (err) {
        logger.error({ err, invoiceId }, 'sendInvoiceEmail: failed to update send-state columns');
      }

      logger.info(
        { invoiceId, recipient, invoiceNumber: invoice.invoiceNumber },
        'Invoice email sent',
      );
      return { sent: true, recipient };
    }

    logger.warn(
      { invoiceId, reason: 'SMTP not configured or send failed' },
      'Invoice email not sent',
    );
    return {
      sent: false,
      reason: 'SMTP not configured or send failed',
      recipient,
    };
  } catch (err) {
    logger.error({ err, invoiceId, tenantId }, 'sendInvoiceEmail: unexpected failure');
    return { sent: false, reason: 'Unexpected error sending invoice email' };
  }
}
