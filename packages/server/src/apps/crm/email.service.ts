import { google } from 'googleapis';
import { db } from '../../config/database';
import { crmContacts, crmDeals, emails } from '../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getAuthenticatedClient } from '../../services/google-auth';
import { logger } from '../../utils/logger';

// ─── Get emails for a CRM contact ─────────────────────────────────────

export async function getContactEmails(tenantId: string, contactId: string, limit = 50) {
  const [contact] = await db.select({ email: crmContacts.email })
    .from(crmContacts)
    .where(and(eq(crmContacts.id, contactId), eq(crmContacts.tenantId, tenantId)))
    .limit(1);

  if (!contact?.email) return [];

  const contactEmail = contact.email.toLowerCase();

  const results = await db.execute(sql`
    SELECT e.id, e.account_id, e.thread_id, e.gmail_message_id,
           e.from_address, e.from_name, e.to_addresses, e.cc_addresses,
           e.subject, e.snippet, e.body_text, e.internal_date,
           e.is_unread, e.is_starred, e.gmail_labels
    FROM emails e
    WHERE e.account_id = ${tenantId}
    AND (
      e.from_address = ${contactEmail}
      OR e.to_addresses @> ${JSON.stringify([{ address: contactEmail }])}::jsonb
      OR e.cc_addresses @> ${JSON.stringify([{ address: contactEmail }])}::jsonb
    )
    ORDER BY e.internal_date DESC
    LIMIT ${limit}
  `);

  return results.rows;
}

// ─── Get emails for a CRM deal ─────────────────────────────────────────

export async function getDealEmails(tenantId: string, dealId: string, limit = 50) {
  const [deal] = await db.select({
    contactId: crmDeals.contactId,
    companyId: crmDeals.companyId,
  })
    .from(crmDeals)
    .where(and(eq(crmDeals.id, dealId), eq(crmDeals.tenantId, tenantId)))
    .limit(1);

  if (!deal) return [];

  // If deal has a contact, use contact emails
  if (deal.contactId) {
    return getContactEmails(tenantId, deal.contactId, limit);
  }

  // If deal has a company but no contact, get all company contact emails
  if (deal.companyId) {
    return getCompanyEmails(tenantId, deal.companyId, limit);
  }

  return [];
}

// ─── Get emails for a CRM company ──────────────────────────────────────

export async function getCompanyEmails(tenantId: string, companyId: string, limit = 50) {
  // Get all contacts for this company
  const contacts = await db.select({ email: crmContacts.email })
    .from(crmContacts)
    .where(and(
      eq(crmContacts.companyId, companyId),
      eq(crmContacts.tenantId, tenantId),
      eq(crmContacts.isArchived, false),
    ));

  const contactEmails = contacts
    .map((c) => c.email?.toLowerCase())
    .filter((e): e is string => !!e);

  if (contactEmails.length === 0) return [];

  // Build a dynamic OR query for all contact emails
  const emailConditions = contactEmails.map((email) =>
    sql`(e.from_address = ${email} OR e.to_addresses @> ${JSON.stringify([{ address: email }])}::jsonb OR e.cc_addresses @> ${JSON.stringify([{ address: email }])}::jsonb)`,
  );

  const combinedCondition = sql.join(emailConditions, sql` OR `);

  const results = await db.execute(sql`
    SELECT e.id, e.account_id, e.thread_id, e.gmail_message_id,
           e.from_address, e.from_name, e.to_addresses, e.cc_addresses,
           e.subject, e.snippet, e.body_text, e.internal_date,
           e.is_unread, e.is_starred, e.gmail_labels
    FROM emails e
    WHERE e.account_id = ${tenantId}
    AND (${combinedCondition})
    ORDER BY e.internal_date DESC
    LIMIT ${limit}
  `);

  return results.rows;
}

// ─── Send email via Gmail ──────────────────────────────────────────────

export async function sendEmail(
  tenantId: string,
  to: string,
  subject: string,
  bodyText: string,
  threadGmailId?: string,
) {
  const client = await getAuthenticatedClient(tenantId);
  const gmail = google.gmail({ version: 'v1', auth: client });

  // Build RFC 2822 message
  const messageParts = [
    'Content-Type: text/plain; charset=utf-8',
    'MIME-Version: 1.0',
    `To: ${to}`,
    `Subject: ${subject}`,
    '',
    bodyText,
  ];

  const rawMessage = messageParts.join('\r\n');
  const encodedMessage = Buffer.from(rawMessage).toString('base64url');

  const requestBody: { raw: string; threadId?: string } = { raw: encodedMessage };
  if (threadGmailId) {
    requestBody.threadId = threadGmailId;
  }

  const sendRes = await gmail.users.messages.send({
    userId: 'me',
    requestBody,
  });

  logger.info({ tenantId, to, subject, messageId: sendRes.data.id }, 'Email sent via Gmail');
  return sendRes.data;
}
