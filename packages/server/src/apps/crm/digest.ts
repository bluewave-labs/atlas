import { db } from '../../config/database';
import { crmLeads, crmDeals, crmActivities, crmPermissions, users, tenantMembers } from '../../db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { sendEmail } from '../../services/email.service';
import { env } from '../../config/env';

const DIGEST_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface DigestStats {
  newLeads24h: number;
  newLeads7d: number;
  newLeads30d: number;
  dealsWon24h: number;
  dealsWon7d: number;
  dealsWon30d: number;
  activitiesLogged24h: number;
  activitiesLogged7d: number;
  activitiesLogged30d: number;
  totalPipelineValue: number;
  activeDeals: number;
}

async function getDigestStats(tenantId: string): Promise<DigestStats> {
  const now = new Date();
  const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [leads24h] = await db.select({ count: sql<number>`count(*)` }).from(crmLeads)
    .where(and(eq(crmLeads.tenantId, tenantId), gte(crmLeads.createdAt, h24), eq(crmLeads.isArchived, false)));
  const [leads7d] = await db.select({ count: sql<number>`count(*)` }).from(crmLeads)
    .where(and(eq(crmLeads.tenantId, tenantId), gte(crmLeads.createdAt, d7), eq(crmLeads.isArchived, false)));
  const [leads30d] = await db.select({ count: sql<number>`count(*)` }).from(crmLeads)
    .where(and(eq(crmLeads.tenantId, tenantId), gte(crmLeads.createdAt, d30), eq(crmLeads.isArchived, false)));

  const [won24h] = await db.select({ count: sql<number>`count(*)` }).from(crmDeals)
    .where(and(eq(crmDeals.tenantId, tenantId), gte(crmDeals.wonAt, h24)));
  const [won7d] = await db.select({ count: sql<number>`count(*)` }).from(crmDeals)
    .where(and(eq(crmDeals.tenantId, tenantId), gte(crmDeals.wonAt, d7)));
  const [won30d] = await db.select({ count: sql<number>`count(*)` }).from(crmDeals)
    .where(and(eq(crmDeals.tenantId, tenantId), gte(crmDeals.wonAt, d30)));

  const [act24h] = await db.select({ count: sql<number>`count(*)` }).from(crmActivities)
    .where(and(eq(crmActivities.tenantId, tenantId), gte(crmActivities.createdAt, h24), eq(crmActivities.isArchived, false)));
  const [act7d] = await db.select({ count: sql<number>`count(*)` }).from(crmActivities)
    .where(and(eq(crmActivities.tenantId, tenantId), gte(crmActivities.createdAt, d7), eq(crmActivities.isArchived, false)));
  const [act30d] = await db.select({ count: sql<number>`count(*)` }).from(crmActivities)
    .where(and(eq(crmActivities.tenantId, tenantId), gte(crmActivities.createdAt, d30), eq(crmActivities.isArchived, false)));

  const [pipeline] = await db.select({
    totalValue: sql<number>`COALESCE(SUM(value), 0)`,
    count: sql<number>`count(*)`,
  }).from(crmDeals)
    .where(and(eq(crmDeals.tenantId, tenantId), eq(crmDeals.isArchived, false), sql`won_at IS NULL AND lost_at IS NULL`));

  return {
    newLeads24h: Number(leads24h?.count ?? 0),
    newLeads7d: Number(leads7d?.count ?? 0),
    newLeads30d: Number(leads30d?.count ?? 0),
    dealsWon24h: Number(won24h?.count ?? 0),
    dealsWon7d: Number(won7d?.count ?? 0),
    dealsWon30d: Number(won30d?.count ?? 0),
    activitiesLogged24h: Number(act24h?.count ?? 0),
    activitiesLogged7d: Number(act7d?.count ?? 0),
    activitiesLogged30d: Number(act30d?.count ?? 0),
    totalPipelineValue: Number(pipeline?.totalValue ?? 0),
    activeDeals: Number(pipeline?.count ?? 0),
  };
}

function buildDigestHtml(stats: DigestStats, baseUrl: string): string {
  const fmt = (n: number) => n.toLocaleString();
  const fmtCurrency = (n: number) => `$${n.toLocaleString()}`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px">

<div style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e4e7ec">
  <div style="background:#13715B;padding:24px;text-align:center">
    <h1 style="margin:0;color:#fff;font-size:20px;font-weight:600">Atlas CRM Daily Digest</h1>
    <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
  </div>

  <div style="padding:24px">
    <div style="margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #e4e7ec">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h2 style="margin:0;font-size:14px;font-weight:600;color:#111;text-transform:uppercase;letter-spacing:0.04em">New Leads</h2>
        <a href="${baseUrl}/crm?view=leads" style="color:#13715B;font-size:13px;text-decoration:none;font-weight:500">Open Report →</a>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="text-align:center">
        <tr>
          <td style="padding:8px"><div style="font-size:28px;font-weight:700;color:#111">${fmt(stats.newLeads24h)}</div><div style="font-size:12px;color:#6b7280;margin-top:4px">Last 24 hours</div></td>
          <td style="padding:8px"><div style="font-size:28px;font-weight:700;color:#111">${fmt(stats.newLeads7d)}</div><div style="font-size:12px;color:#6b7280;margin-top:4px">Last 7 days</div></td>
          <td style="padding:8px"><div style="font-size:28px;font-weight:700;color:#111">${fmt(stats.newLeads30d)}</div><div style="font-size:12px;color:#6b7280;margin-top:4px">Last 30 days</div></td>
        </tr>
      </table>
    </div>

    <div style="margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #e4e7ec">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h2 style="margin:0;font-size:14px;font-weight:600;color:#111;text-transform:uppercase;letter-spacing:0.04em">Deals Won</h2>
        <a href="${baseUrl}/crm?view=deals" style="color:#13715B;font-size:13px;text-decoration:none;font-weight:500">Open Report →</a>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="text-align:center">
        <tr>
          <td style="padding:8px"><div style="font-size:28px;font-weight:700;color:#111">${fmt(stats.dealsWon24h)}</div><div style="font-size:12px;color:#6b7280;margin-top:4px">Last 24 hours</div></td>
          <td style="padding:8px"><div style="font-size:28px;font-weight:700;color:#111">${fmt(stats.dealsWon7d)}</div><div style="font-size:12px;color:#6b7280;margin-top:4px">Last 7 days</div></td>
          <td style="padding:8px"><div style="font-size:28px;font-weight:700;color:#111">${fmt(stats.dealsWon30d)}</div><div style="font-size:12px;color:#6b7280;margin-top:4px">Last 30 days</div></td>
        </tr>
      </table>
    </div>

    <div style="margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #e4e7ec">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h2 style="margin:0;font-size:14px;font-weight:600;color:#111;text-transform:uppercase;letter-spacing:0.04em">Activities Logged</h2>
        <a href="${baseUrl}/crm?view=activities" style="color:#13715B;font-size:13px;text-decoration:none;font-weight:500">Open Report →</a>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="text-align:center">
        <tr>
          <td style="padding:8px"><div style="font-size:28px;font-weight:700;color:#111">${fmt(stats.activitiesLogged24h)}</div><div style="font-size:12px;color:#6b7280;margin-top:4px">Last 24 hours</div></td>
          <td style="padding:8px"><div style="font-size:28px;font-weight:700;color:#111">${fmt(stats.activitiesLogged7d)}</div><div style="font-size:12px;color:#6b7280;margin-top:4px">Last 7 days</div></td>
          <td style="padding:8px"><div style="font-size:28px;font-weight:700;color:#111">${fmt(stats.activitiesLogged30d)}</div><div style="font-size:12px;color:#6b7280;margin-top:4px">Last 30 days</div></td>
        </tr>
      </table>
    </div>

    <div style="text-align:center;padding:8px;background:#f9fafb;border-radius:8px">
      <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:4px">Active Pipeline</div>
      <div style="font-size:24px;font-weight:700;color:#111">${fmtCurrency(stats.totalPipelineValue)}</div>
      <div style="font-size:13px;color:#6b7280">${fmt(stats.activeDeals)} active deals</div>
    </div>
  </div>

  <div style="padding:16px 24px;background:#f9fafb;text-align:center;border-top:1px solid #e4e7ec">
    <a href="${baseUrl}" style="color:#13715B;font-size:13px;text-decoration:none;font-weight:500">Open Atlas →</a>
    <span style="color:#d0d5dd;margin:0 8px">|</span>
    <span style="color:#6b7280;font-size:12px">Sent daily to CRM users</span>
  </div>
</div>

<p style="text-align:center;font-size:11px;color:#9ca3af;margin-top:16px">
  You're receiving this because you have CRM access on Atlas.
  To stop, ask your admin to disable the CRM digest.
</p>

</div>
</body>
</html>`;
}

async function sendDigests(): Promise<number> {
  let sentCount = 0;

  try {
    // Get all accounts with CRM permissions
    const crmUsers = await db
      .select({
        tenantId: crmPermissions.tenantId,
        userId: crmPermissions.userId,
        email: users.email,
        name: users.name,
      })
      .from(crmPermissions)
      .innerJoin(users, eq(crmPermissions.userId, users.id));

    // Group by account
    const byAccount = new Map<string, { email: string; name: string | null }[]>();
    for (const u of crmUsers) {
      if (!u.email) continue;
      const arr = byAccount.get(u.tenantId) ?? [];
      arr.push({ email: u.email, name: u.name });
      byAccount.set(u.tenantId, arr);
    }

    const baseUrl = env.CLIENT_PUBLIC_URL || env.SERVER_PUBLIC_URL || 'http://localhost:3001';

    for (const [tenantId, recipients] of byAccount) {
      const stats = await getDigestStats(tenantId);

      // Skip if no activity at all
      if (stats.newLeads30d === 0 && stats.dealsWon30d === 0 && stats.activitiesLogged30d === 0) continue;

      const html = buildDigestHtml(stats, baseUrl);
      const subject = `Atlas CRM Digest — ${stats.newLeads24h} new leads, ${stats.dealsWon24h} deals won`;

      for (const recipient of recipients) {
        const sent = await sendEmail({
          to: recipient.email,
          subject,
          text: `CRM Daily Digest: ${stats.newLeads24h} new leads (24h), ${stats.dealsWon24h} deals won (24h), ${stats.activitiesLogged24h} activities (24h). Pipeline: $${stats.totalPipelineValue.toLocaleString()} across ${stats.activeDeals} active deals.`,
          html,
        });
        if (sent) sentCount++;
      }
    }

    logger.info({ sentCount }, 'CRM digest emails sent');
  } catch (err) {
    logger.error({ err }, 'Failed to send CRM digest emails');
  }

  return sentCount;
}

let digestTimer: ReturnType<typeof setInterval> | null = null;

export function startDigestScheduler(): void {
  // Run daily — first run after 1 minute, then every 24 hours
  setTimeout(() => {
    sendDigests().catch(() => {});
  }, 60_000);

  digestTimer = setInterval(() => {
    sendDigests().catch((err) => {
      logger.error({ err }, 'CRM digest scheduler failed');
    });
  }, DIGEST_INTERVAL_MS);

  logger.info('CRM digest scheduler started (daily)');
}

export function stopDigestScheduler(): void {
  if (digestTimer) {
    clearInterval(digestTimer);
    digestTimer = null;
  }
}
