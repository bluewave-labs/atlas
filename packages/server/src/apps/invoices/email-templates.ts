import { escapeHtml, escapeHtmlMultiline } from '../../utils/html';

export interface InvoiceEmailData {
  invoice: {
    id: string;
    invoiceNumber: string;
    total: number;
    balanceDue?: number;
    currency: string;
    dueDate: Date | null;
    issueDate?: Date | null;
  };
  company: {
    name: string;
    email?: string | null;
  };
  settings: {
    companyName?: string | null;
    companyEmail?: string | null;
    companyAddress?: string | null;
    companyCity?: string | null;
    companyCountry?: string | null;
    companyPhone?: string | null;
    companyWebsite?: string | null;
    companyTaxId?: string | null;
    accentColor?: string | null;
    paymentInstructions?: string | null;
    bankDetails?: string | null;
    footerText?: string | null;
  };
  portalUrl: string;
  customSubject?: string;
  customMessage?: string;
}

export interface BuiltEmail {
  subject: string;
  text: string;
  html: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  TRY: '₺',
  JPY: '¥',
  CAD: 'CA$',
  AUD: 'A$',
  CHF: 'CHF ',
  CNY: '¥',
  INR: '₹',
};

function formatMoney(amount: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;
  const formatted = (Math.round(amount * 100) / 100).toFixed(2);
  // Add thousands separators
  const [whole, dec] = formatted.split('.');
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${symbol}${withCommas}.${dec}`;
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return 'N/A';
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function getCompanyName(data: InvoiceEmailData): string {
  return data.settings.companyName || data.company.name || 'Your supplier';
}

function getAccentColor(data: InvoiceEmailData): string {
  return data.settings.accentColor || '#13715B';
}

function getBalance(data: InvoiceEmailData): number {
  return data.invoice.balanceDue ?? data.invoice.total;
}

// ---------------------------------------------------------------------------
// Shared rendering blocks
// ---------------------------------------------------------------------------

interface RenderOptions {
  data: InvoiceEmailData;
  greeting: string;
  intro: string; // primary body sentence(s) for text version
  introHtml: string; // HTML version of intro
  ctaLabel: string;
  reminderLine?: string; // muted line under CTA (e.g. due date / overdue notice)
  subject: string;
}

function buildEmail(opts: RenderOptions): BuiltEmail {
  const { data, greeting, intro, introHtml, ctaLabel, reminderLine, subject } = opts;
  const accent = getAccentColor(data);
  const companyName = getCompanyName(data);
  const customMessage = data.customMessage?.trim();

  // ---------- Plain text ----------
  const textParts: string[] = [];
  textParts.push(`${greeting},`, '');
  if (customMessage) {
    textParts.push(customMessage, '');
  }
  textParts.push(intro, '');
  textParts.push('Invoice details:');
  textParts.push(`  Number:    ${data.invoice.invoiceNumber}`);
  textParts.push(`  Amount:    ${formatMoney(data.invoice.total, data.invoice.currency)}`);
  if (data.invoice.balanceDue !== undefined && data.invoice.balanceDue !== data.invoice.total) {
    textParts.push(`  Balance:   ${formatMoney(data.invoice.balanceDue, data.invoice.currency)}`);
  }
  if (data.invoice.issueDate) {
    textParts.push(`  Issued:    ${formatDate(data.invoice.issueDate)}`);
  }
  textParts.push(`  Due date:  ${formatDate(data.invoice.dueDate)}`);
  textParts.push('');
  textParts.push('View and pay your invoice online:');
  textParts.push(data.portalUrl);
  textParts.push('');
  if (reminderLine) {
    textParts.push(reminderLine, '');
  }
  if (data.settings.paymentInstructions) {
    textParts.push('Payment instructions:');
    textParts.push(data.settings.paymentInstructions, '');
  }
  if (data.settings.bankDetails) {
    textParts.push('Bank details:');
    textParts.push(data.settings.bankDetails, '');
  }
  textParts.push('Thank you,');
  textParts.push(companyName);
  textParts.push('');
  textParts.push('---');
  const footerLines: string[] = [];
  if (data.settings.companyAddress) footerLines.push(data.settings.companyAddress);
  const cityCountry = [data.settings.companyCity, data.settings.companyCountry].filter(Boolean).join(', ');
  if (cityCountry) footerLines.push(cityCountry);
  if (data.settings.companyPhone) footerLines.push(`Phone: ${data.settings.companyPhone}`);
  if (data.settings.companyWebsite) footerLines.push(data.settings.companyWebsite);
  if (data.settings.companyTaxId) footerLines.push(`Tax ID: ${data.settings.companyTaxId}`);
  if (footerLines.length > 0) {
    textParts.push(...footerLines, '');
  }
  if (data.settings.footerText) {
    textParts.push(data.settings.footerText, '');
  }
  textParts.push(
    `This email was sent by ${companyName}. If you believe you received this in error, please contact us.`,
  );
  const text = textParts.join('\n');

  // ---------- HTML ----------
  const customMessageHtml = customMessage
    ? `<p style="color: #374151; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${escapeHtmlMultiline(customMessage)}</p>`
    : '';

  const balanceRow =
    data.invoice.balanceDue !== undefined && data.invoice.balanceDue !== data.invoice.total
      ? `<tr><td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Balance</td><td style="padding: 4px 0; color: #111827; font-size: 13px; text-align: right; font-weight: 600;">${escapeHtml(
          formatMoney(data.invoice.balanceDue, data.invoice.currency),
        )}</td></tr>`
      : '';

  const issueRow = data.invoice.issueDate
    ? `<tr><td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Issued</td><td style="padding: 4px 0; color: #111827; font-size: 13px; text-align: right;">${escapeHtml(
        formatDate(data.invoice.issueDate),
      )}</td></tr>`
    : '';

  const reminderHtml = reminderLine
    ? `<p style="color: #6b7280; font-size: 13px; line-height: 1.5; text-align: center;">${escapeHtml(reminderLine)}</p>`
    : '';

  const paymentInstructionsHtml = data.settings.paymentInstructions
    ? `<div style="margin: 16px 0; padding: 12px 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;">
         <p style="margin: 0 0 6px; color: #374151; font-size: 13px; font-weight: 600;">Payment instructions</p>
         <p style="margin: 0; color: #4b5563; font-size: 13px; line-height: 1.5; white-space: pre-wrap;">${escapeHtmlMultiline(
           data.settings.paymentInstructions,
         )}</p>
       </div>`
    : '';

  const bankDetailsHtml = data.settings.bankDetails
    ? `<div style="margin: 16px 0; padding: 12px 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;">
         <p style="margin: 0 0 6px; color: #374151; font-size: 13px; font-weight: 600;">Bank details</p>
         <p style="margin: 0; color: #4b5563; font-size: 13px; line-height: 1.5; white-space: pre-wrap;">${escapeHtmlMultiline(
           data.settings.bankDetails,
         )}</p>
       </div>`
    : '';

  // Footer contact info
  const footerInfoParts: string[] = [];
  if (data.settings.companyAddress) footerInfoParts.push(escapeHtml(data.settings.companyAddress));
  if (cityCountry) footerInfoParts.push(escapeHtml(cityCountry));
  if (data.settings.companyPhone) footerInfoParts.push(`Phone: ${escapeHtml(data.settings.companyPhone)}`);
  if (data.settings.companyWebsite)
    footerInfoParts.push(
      `<a href="${escapeHtml(data.settings.companyWebsite)}" style="color: #6b7280; text-decoration: underline;">${escapeHtml(data.settings.companyWebsite)}</a>`,
    );
  if (data.settings.companyTaxId) footerInfoParts.push(`Tax ID: ${escapeHtml(data.settings.companyTaxId)}`);

  const footerInfoHtml =
    footerInfoParts.length > 0
      ? `<p style="color: #9ca3af; font-size: 11px; line-height: 1.5; margin: 8px 0 0;">${footerInfoParts.join(' &middot; ')}</p>`
      : '';

  const customFooterTextHtml = data.settings.footerText
    ? `<p style="color: #9ca3af; font-size: 11px; line-height: 1.5; margin: 8px 0 0; white-space: pre-wrap;">${escapeHtmlMultiline(
        data.settings.footerText,
      )}</p>`
    : '';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 0;">
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">${escapeHtml(greeting)},</p>
      ${customMessageHtml}
      ${introHtml}
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; margin: 16px 0; border-collapse: collapse;">
        <tr>
          <td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Invoice number</td>
          <td style="padding: 4px 0; color: #111827; font-size: 13px; text-align: right; font-weight: 600;">${escapeHtml(data.invoice.invoiceNumber)}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Total</td>
          <td style="padding: 4px 0; color: #111827; font-size: 13px; text-align: right; font-weight: 600;">${escapeHtml(formatMoney(data.invoice.total, data.invoice.currency))}</td>
        </tr>
        ${balanceRow}
        ${issueRow}
        <tr>
          <td style="padding: 4px 0; color: #6b7280; font-size: 13px;">Due date</td>
          <td style="padding: 4px 0; color: #111827; font-size: 13px; text-align: right;">${escapeHtml(formatDate(data.invoice.dueDate))}</td>
        </tr>
      </table>
      <div style="margin: 24px 0; text-align: center;">
        <a href="${escapeHtml(data.portalUrl)}" style="display: inline-block; background: ${escapeHtml(accent)}; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px;">
          ${escapeHtml(ctaLabel)}
        </a>
      </div>
      ${reminderHtml}
      ${paymentInstructionsHtml}
      ${bankDetailsHtml}
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #6b7280; font-size: 13px; font-weight: 600; margin: 0;">${escapeHtml(companyName)}</p>
      ${footerInfoHtml}
      ${customFooterTextHtml}
      <p style="color: #9ca3af; font-size: 11px; line-height: 1.5; margin: 16px 0 0;">
        This email was sent by ${escapeHtml(companyName)}. If you believe you received this in error, please contact us.
      </p>
    </div>
  `.trim();

  return {
    subject: data.customSubject || subject,
    text,
    html,
  };
}

// ---------------------------------------------------------------------------
// Public builders
// ---------------------------------------------------------------------------

/**
 * Initial invoice delivery — friendly, "Thank you for your business."
 */
export function buildInvoiceEmailTemplate(data: InvoiceEmailData): BuiltEmail {
  const companyName = getCompanyName(data);
  const greeting = data.company.name ? `Hello ${data.company.name}` : 'Hello';
  const intro = `Thank you for your business. Please find your invoice ${data.invoice.invoiceNumber} from ${companyName} below.`;
  const introHtml = `<p style="color: #374151; font-size: 15px; line-height: 1.6;">
    Thank you for your business. Please find your invoice <strong>${escapeHtml(data.invoice.invoiceNumber)}</strong> from <strong>${escapeHtml(companyName)}</strong> below.
  </p>`;
  const reminderLine = data.invoice.dueDate
    ? `Payment is due by ${formatDate(data.invoice.dueDate)}.`
    : undefined;

  return buildEmail({
    data,
    greeting,
    intro,
    introHtml,
    ctaLabel: 'View & pay invoice',
    reminderLine,
    subject: `Invoice ${data.invoice.invoiceNumber} from ${companyName}`,
  });
}

/**
 * Overdue reminder. Tone escalates with stage:
 *   1 = friendly, 2 = firmer, 3 = serious, 4 = final notice.
 */
export function buildInvoiceReminderTemplate(
  data: InvoiceEmailData,
  stage: 1 | 2 | 3 | 4,
): BuiltEmail {
  const companyName = getCompanyName(data);
  const greeting = data.company.name ? `Hello ${data.company.name}` : 'Hello';
  const balance = getBalance(data);
  const balanceStr = formatMoney(balance, data.invoice.currency);

  const today = new Date();
  const overdueDays = data.invoice.dueDate ? Math.max(0, daysBetween(data.invoice.dueDate, today)) : 0;

  let intro: string;
  let introHtml: string;
  let ctaLabel: string;
  let subject: string;
  let reminderLine: string | undefined;

  const automatedSuffix = 'This is an automated reminder — if payment has already been sent, please disregard.';
  const withAutomatedSuffix = (base?: string) => (base ? `${base} ${automatedSuffix}` : automatedSuffix);

  switch (stage) {
    case 1:
      intro = `A quick reminder that invoice ${data.invoice.invoiceNumber} for ${balanceStr} is now due. If you've already paid, please disregard this message.`;
      introHtml = `<p style="color: #374151; font-size: 15px; line-height: 1.6;">
        A quick reminder that invoice <strong>${escapeHtml(data.invoice.invoiceNumber)}</strong> for <strong>${escapeHtml(balanceStr)}</strong> is now due. If you've already paid, please disregard this message.
      </p>`;
      ctaLabel = 'View invoice';
      subject = `Friendly reminder: Invoice ${data.invoice.invoiceNumber}`;
      reminderLine = withAutomatedSuffix(data.invoice.dueDate ? `Originally due ${formatDate(data.invoice.dueDate)}.` : undefined);
      break;
    case 2:
      intro = `Your invoice ${data.invoice.invoiceNumber} for ${balanceStr} is now ${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue. Please arrange payment at your earliest convenience.`;
      introHtml = `<p style="color: #374151; font-size: 15px; line-height: 1.6;">
        Your invoice <strong>${escapeHtml(data.invoice.invoiceNumber)}</strong> for <strong>${escapeHtml(balanceStr)}</strong> is now <strong>${overdueDays} day${overdueDays === 1 ? '' : 's'} overdue</strong>. Please arrange payment at your earliest convenience.
      </p>`;
      ctaLabel = 'Pay now';
      subject = `Second reminder: Invoice ${data.invoice.invoiceNumber}`;
      reminderLine = withAutomatedSuffix('This is our second reminder regarding this invoice.');
      break;
    case 3:
      intro = `This is our third notice regarding invoice ${data.invoice.invoiceNumber}, which remains unpaid (${balanceStr}, ${overdueDays} days overdue). Please arrange payment as soon as possible to avoid further action.`;
      introHtml = `<p style="color: #b45309; font-size: 15px; line-height: 1.6;">
        This is our <strong>third notice</strong> regarding invoice <strong>${escapeHtml(data.invoice.invoiceNumber)}</strong>, which remains unpaid (<strong>${escapeHtml(balanceStr)}</strong>, ${overdueDays} days overdue). Please arrange payment as soon as possible to avoid further action.
      </p>`;
      ctaLabel = 'Pay now';
      subject = `Third notice: Invoice ${data.invoice.invoiceNumber}`;
      reminderLine = withAutomatedSuffix('If payment has been made, please send us confirmation so we can update our records.');
      break;
    case 4:
    default:
      intro = `Your account is significantly overdue. Invoice ${data.invoice.invoiceNumber} for ${balanceStr} is now ${overdueDays} days past due. This is a final notice — please settle this balance immediately to avoid escalation.`;
      introHtml = `<p style="color: #b91c1c; font-size: 15px; line-height: 1.6;">
        Your account is <strong>significantly overdue</strong>. Invoice <strong>${escapeHtml(data.invoice.invoiceNumber)}</strong> for <strong>${escapeHtml(balanceStr)}</strong> is now <strong>${overdueDays} days past due</strong>. This is a <strong>final notice</strong> — please settle this balance immediately to avoid escalation.
      </p>`;
      ctaLabel = 'Settle balance now';
      subject = `Overdue: Invoice ${data.invoice.invoiceNumber} — final notice`;
      reminderLine = withAutomatedSuffix(`Failure to respond may result in collection action. Please contact ${companyName} immediately if you are unable to pay in full.`);
      break;
  }

  return buildEmail({
    data,
    greeting,
    intro,
    introHtml,
    ctaLabel,
    reminderLine,
    subject,
  });
}

/**
 * Payment received confirmation — celebratory.
 */
export function buildPaymentConfirmationTemplate(
  data: InvoiceEmailData & {
    paidAmount: number;
    paymentMethod?: string;
    remainingBalance: number;
  },
): BuiltEmail {
  const companyName = getCompanyName(data);
  const greeting = data.company.name ? `Hello ${data.company.name}` : 'Hello';
  const paidStr = formatMoney(data.paidAmount, data.invoice.currency);
  const remainingStr = formatMoney(data.remainingBalance, data.invoice.currency);
  const fullySettled = data.remainingBalance <= 0.0001;

  const methodSuffix = data.paymentMethod ? ` via ${data.paymentMethod}` : '';

  const intro = fullySettled
    ? `Thank you! We've received your payment of ${paidStr}${methodSuffix} for invoice ${data.invoice.invoiceNumber}. Your account is now fully settled — we appreciate your business.`
    : `Thank you! We've received your payment of ${paidStr}${methodSuffix} for invoice ${data.invoice.invoiceNumber}. A balance of ${remainingStr} remains outstanding.`;

  const introHtml = fullySettled
    ? `<p style="color: #047857; font-size: 15px; line-height: 1.6;">
         Thank you! We've received your payment of <strong>${escapeHtml(paidStr)}</strong>${data.paymentMethod ? ` via <strong>${escapeHtml(data.paymentMethod)}</strong>` : ''} for invoice <strong>${escapeHtml(data.invoice.invoiceNumber)}</strong>. Your account is now <strong>fully settled</strong> — we appreciate your business.
       </p>`
    : `<p style="color: #374151; font-size: 15px; line-height: 1.6;">
         Thank you! We've received your payment of <strong>${escapeHtml(paidStr)}</strong>${data.paymentMethod ? ` via <strong>${escapeHtml(data.paymentMethod)}</strong>` : ''} for invoice <strong>${escapeHtml(data.invoice.invoiceNumber)}</strong>. A balance of <strong>${escapeHtml(remainingStr)}</strong> remains outstanding.
       </p>`;

  const reminderLine = fullySettled
    ? `Thank you for your prompt payment.`
    : `You can view the remaining balance and make further payments via the link above.`;

  // Pass an InvoiceEmailData with balanceDue overridden to remainingBalance for the details table
  const dataForBuilder: InvoiceEmailData = {
    ...data,
    invoice: {
      ...data.invoice,
      balanceDue: data.remainingBalance,
    },
  };

  return buildEmail({
    data: dataForBuilder,
    greeting,
    intro,
    introHtml,
    ctaLabel: fullySettled ? 'View receipt' : 'View invoice',
    reminderLine,
    subject: `Payment received for Invoice ${data.invoice.invoiceNumber}`,
  });
}
