import { db } from '../../config/database';
import { systemSettings, tenantMembers } from '../../db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { logger } from '../../utils/logger';

// ─── Email Settings ────────────────────────────────────────────────

export interface EmailSettings {
  smtpHost: string | null;
  smtpPort: number;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpFrom: string;
  smtpSecure: boolean;
  smtpEnabled: boolean;
}

/**
 * Get or create the singleton system settings row.
 */
async function getOrCreateSettings() {
  const rows = await db.select().from(systemSettings).limit(1);
  if (rows.length > 0) return rows[0];

  const created = await db.insert(systemSettings).values({}).returning();
  return created[0];
}

export async function getEmailSettings(): Promise<EmailSettings> {
  const settings = await getOrCreateSettings();
  return {
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpUser: settings.smtpUser,
    smtpPass: settings.smtpPass ? '••••••••' : null, // mask password
    smtpFrom: settings.smtpFrom,
    smtpSecure: settings.smtpSecure,
    smtpEnabled: settings.smtpEnabled,
  };
}

export async function updateEmailSettings(patch: Partial<EmailSettings>) {
  const settings = await getOrCreateSettings();

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (patch.smtpHost !== undefined) update.smtpHost = patch.smtpHost;
  if (patch.smtpPort !== undefined) update.smtpPort = patch.smtpPort;
  if (patch.smtpUser !== undefined) update.smtpUser = patch.smtpUser;
  // Only update password if it's not the masked placeholder
  if (patch.smtpPass !== undefined && patch.smtpPass !== '••••••••') {
    update.smtpPass = patch.smtpPass;
  }
  if (patch.smtpFrom !== undefined) update.smtpFrom = patch.smtpFrom;
  if (patch.smtpSecure !== undefined) update.smtpSecure = patch.smtpSecure;
  if (patch.smtpEnabled !== undefined) update.smtpEnabled = patch.smtpEnabled;

  await db.update(systemSettings).set(update).where(eq(systemSettings.id, settings.id));
  logger.info('Email settings updated');
  return getEmailSettings();
}

/**
 * Get raw (unmasked) SMTP settings for actually sending email.
 */
export async function getRawSmtpSettings() {
  const settings = await getOrCreateSettings();
  return {
    host: settings.smtpHost,
    port: settings.smtpPort,
    user: settings.smtpUser,
    pass: settings.smtpPass,
    from: settings.smtpFrom,
    secure: settings.smtpSecure,
    enabled: settings.smtpEnabled,
  };
}

/**
 * Test SMTP connection by sending a test email.
 */
export async function testEmailConnection(to: string): Promise<{ success: boolean; error?: string }> {
  try {
    const smtp = await getRawSmtpSettings();
    if (!smtp.host || !smtp.user) {
      return { success: false, error: 'SMTP host and user are required' };
    }

    // Dynamic import nodemailer
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.user ? { user: smtp.user, pass: smtp.pass || '' } : undefined,
    });

    await transport.verify();
    await transport.sendMail({
      from: smtp.from,
      to,
      subject: 'Atlas — Test email',
      text: 'This is a test email from Atlas. If you received this, your SMTP settings are configured correctly.',
      html: '<p>This is a test email from <strong>Atlas</strong>.</p><p>If you received this, your SMTP settings are configured correctly.</p>',
    });

    return { success: true };
  } catch (err: any) {
    logger.error({ error: err }, 'SMTP test failed');
    return { success: false, error: err.message || 'Connection failed' };
  }
}

// ─── Product tour ────────────────────────────────────────────────

export interface TourStatus {
  tourCompletedAt: string | null;
}

export async function getTourStatus(
  userId: string,
  tenantId: string,
): Promise<TourStatus> {
  const [row] = await db
    .select({ tourCompletedAt: tenantMembers.tourCompletedAt })
    .from(tenantMembers)
    .where(and(eq(tenantMembers.userId, userId), eq(tenantMembers.tenantId, tenantId)))
    .limit(1);

  if (!row) {
    throw new Error('TENANT_MEMBERSHIP_NOT_FOUND');
  }

  return {
    tourCompletedAt: row.tourCompletedAt
      ? row.tourCompletedAt.toISOString()
      : null,
  };
}

export async function markTourComplete(
  userId: string,
  tenantId: string,
): Promise<TourStatus> {
  // COALESCE makes this idempotent — a re-call doesn't bump the timestamp.
  const [row] = await db
    .update(tenantMembers)
    .set({ tourCompletedAt: sql`COALESCE(${tenantMembers.tourCompletedAt}, now())` })
    .where(and(eq(tenantMembers.userId, userId), eq(tenantMembers.tenantId, tenantId)))
    .returning({ tourCompletedAt: tenantMembers.tourCompletedAt });

  if (!row) {
    throw new Error('TENANT_MEMBERSHIP_NOT_FOUND');
  }

  return {
    tourCompletedAt: row.tourCompletedAt
      ? row.tourCompletedAt.toISOString()
      : null,
  };
}
