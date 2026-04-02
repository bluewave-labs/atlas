import { sendEmail } from '../../services/email.service';
import { env } from '../../config/env';

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Send an email inviting a signer to review and sign a document.
 */
export async function sendSigningInviteEmail(data: {
  to: string;
  signerName?: string;
  documentTitle: string;
  senderName: string;
  signingLink: string;
  expiresAt: Date;
  customSubject?: string;
  customMessage?: string;
}) {
  const greeting = data.signerName ? `Hello ${data.signerName}` : 'Hello';
  const expiryStr = data.expiresAt.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const bodyMessage = data.customMessage
    ? data.customMessage
    : `You've been invited to sign "${data.documentTitle}" by ${data.senderName}.`;

  const text = [
    `${greeting},`,
    '',
    bodyMessage,
    '',
    `Please review and sign the document using the link below:`,
    data.signingLink,
    '',
    `This link expires on ${expiryStr}.`,
    '',
    'Thank you,',
    'Atlas Sign',
  ].join('\n');

  const htmlBodyMessage = data.customMessage
    ? `<p style="color: #374151; font-size: 15px; line-height: 1.6;">${escapeHtml(data.customMessage)}</p>`
    : `<p style="color: #374151; font-size: 15px; line-height: 1.6;">
        You've been invited to sign <strong>"${escapeHtml(data.documentTitle)}"</strong> by <strong>${escapeHtml(data.senderName)}</strong>.
      </p>`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 0;">
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">${greeting},</p>
      ${htmlBodyMessage}
      <div style="margin: 24px 0; text-align: center;">
        <a href="${data.signingLink}" style="display: inline-block; background: #8b5cf6; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px;">
          Review &amp; sign
        </a>
      </div>
      <p style="color: #6b7280; font-size: 13px; line-height: 1.5;">
        This link expires on ${expiryStr}.
      </p>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">Atlas Sign</p>
    </div>
  `.trim();

  const subject = data.customSubject || `Signature requested: ${data.documentTitle}`;

  return sendEmail({
    to: data.to,
    subject,
    text,
    html,
  });
}

/**
 * Send an email notifying that all parties have signed a document.
 */
export async function sendDocumentCompletedEmail(data: {
  to: string;
  documentTitle: string;
}) {
  const text = [
    'Hello,',
    '',
    `"${data.documentTitle}" has been signed by all parties. The document is now complete.`,
    '',
    'You can view and download the signed document from your Atlas Sign dashboard.',
    '',
    'Thank you,',
    'Atlas Sign',
  ].join('\n');

  const clientUrl = env.CLIENT_PUBLIC_URL || 'http://localhost:5180';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 0;">
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">Hello,</p>
      <p style="color: #374151; font-size: 15px; line-height: 1.6;">
        <strong>"${escapeHtml(data.documentTitle)}"</strong> has been signed by all parties. The document is now complete.
      </p>
      <div style="margin: 24px 0; text-align: center;">
        <a href="${clientUrl}/sign-app" style="display: inline-block; background: #10b981; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 15px;">
          View document
        </a>
      </div>
      <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
      <p style="color: #9ca3af; font-size: 12px;">Atlas Sign</p>
    </div>
  `.trim();

  return sendEmail({
    to: data.to,
    subject: `Completed: ${data.documentTitle}`,
    text,
    html,
  });
}
