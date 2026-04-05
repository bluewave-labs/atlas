import { db } from '../../../config/database';
import { crmCompanies, crmContacts, crmDealStages, crmDeals, crmActivities } from '../../../db/schema';
import { eq, and, asc, desc, sql, gte, lte } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import type { CrmRecordAccess } from '@atlasmail/shared';
import { createCompany } from './company.service';
import { createContact } from './contact.service';
import { createDeal, markDealWon, seedDefaultStages, listDealStages } from './deal.service';
import { createActivity } from './activity.service';
import { createLead, updateLead, listLeads } from './lead.service';

// ─── Dashboard ─────────────────────────────────────────────────────

export async function getDashboard(userId: string, accountId: string, recordAccess?: CrmRecordAccess) {
  // Build base ownership condition
  const ownerFilter = (!recordAccess || recordAccess === 'own')
    ? eq(crmDeals.userId, userId)
    : sql`TRUE`;

  // 1. Total pipeline value (active deals: not won, not lost, not archived)
  const [pipelineAgg] = await db
    .select({
      totalValue: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`.as('total_value'),
      dealCount: sql<number>`COUNT(*)`.as('deal_count'),
    })
    .from(crmDeals)
    .where(and(
      ownerFilter,
      eq(crmDeals.accountId, accountId),
      eq(crmDeals.isArchived, false),
      sql`${crmDeals.wonAt} IS NULL AND ${crmDeals.lostAt} IS NULL`,
    ));

  const totalPipelineValue = Number(pipelineAgg?.totalValue ?? 0);
  const dealCount = Number(pipelineAgg?.dealCount ?? 0);
  const averageDealSize = dealCount > 0 ? totalPipelineValue / dealCount : 0;

  // 2. Deals won this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [wonAgg] = await db
    .select({
      count: sql<number>`COUNT(*)`.as('count'),
      value: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`.as('value'),
    })
    .from(crmDeals)
    .where(and(
      ownerFilter,
      eq(crmDeals.accountId, accountId),
      eq(crmDeals.isArchived, false),
      sql`${crmDeals.wonAt} IS NOT NULL`,
      gte(crmDeals.wonAt, monthStart),
    ));

  const dealsWonCount = Number(wonAgg?.count ?? 0);
  const dealsWonValue = Number(wonAgg?.value ?? 0);

  // 3. Deals lost this month
  const [lostAgg] = await db
    .select({
      count: sql<number>`COUNT(*)`.as('count'),
    })
    .from(crmDeals)
    .where(and(
      ownerFilter,
      eq(crmDeals.accountId, accountId),
      eq(crmDeals.isArchived, false),
      sql`${crmDeals.lostAt} IS NOT NULL`,
      gte(crmDeals.lostAt, monthStart),
    ));

  const dealsLostCount = Number(lostAgg?.count ?? 0);
  const winRate = (dealsWonCount + dealsLostCount) > 0
    ? Math.round((dealsWonCount / (dealsWonCount + dealsLostCount)) * 100)
    : 0;

  // 4. Value by stage (all deals, including won/lost — matches pipeline view)
  const valueByStage = await db
    .select({
      stageId: crmDeals.stageId,
      stageName: crmDealStages.name,
      stageColor: crmDealStages.color,
      value: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`.as('value'),
      count: sql<number>`COUNT(*)`.as('count'),
      sequence: crmDealStages.sequence,
    })
    .from(crmDeals)
    .leftJoin(crmDealStages, eq(crmDeals.stageId, crmDealStages.id))
    .where(and(
      ownerFilter,
      eq(crmDeals.accountId, accountId),
      eq(crmDeals.isArchived, false),
    ))
    .groupBy(crmDeals.stageId, crmDealStages.name, crmDealStages.color, crmDealStages.sequence)
    .orderBy(asc(crmDealStages.sequence));

  // 5. Recent activities (last 10)
  const activityOwnerFilter = (!recordAccess || recordAccess === 'own')
    ? eq(crmActivities.userId, userId)
    : sql`TRUE`;
  const recentActivities = await db
    .select()
    .from(crmActivities)
    .where(and(
      activityOwnerFilter,
      eq(crmActivities.accountId, accountId),
      eq(crmActivities.isArchived, false),
    ))
    .orderBy(desc(crmActivities.createdAt))
    .limit(10);

  // 6. Deals closing soon (next 30 days)
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);
  const dealsClosingSoon = await db
    .select({
      id: crmDeals.id,
      accountId: crmDeals.accountId,
      userId: crmDeals.userId,
      title: crmDeals.title,
      value: crmDeals.value,
      stageId: crmDeals.stageId,
      contactId: crmDeals.contactId,
      companyId: crmDeals.companyId,
      assignedUserId: crmDeals.assignedUserId,
      probability: crmDeals.probability,
      expectedCloseDate: crmDeals.expectedCloseDate,
      wonAt: crmDeals.wonAt,
      lostAt: crmDeals.lostAt,
      lostReason: crmDeals.lostReason,
      tags: crmDeals.tags,
      isArchived: crmDeals.isArchived,
      sortOrder: crmDeals.sortOrder,
      createdAt: crmDeals.createdAt,
      updatedAt: crmDeals.updatedAt,
      stageName: crmDealStages.name,
      stageColor: crmDealStages.color,
      contactName: crmContacts.name,
      companyName: crmCompanies.name,
    })
    .from(crmDeals)
    .leftJoin(crmDealStages, eq(crmDeals.stageId, crmDealStages.id))
    .leftJoin(crmContacts, eq(crmDeals.contactId, crmContacts.id))
    .leftJoin(crmCompanies, eq(crmDeals.companyId, crmCompanies.id))
    .where(and(
      ownerFilter,
      eq(crmDeals.accountId, accountId),
      eq(crmDeals.isArchived, false),
      sql`${crmDeals.wonAt} IS NULL AND ${crmDeals.lostAt} IS NULL`,
      sql`${crmDeals.expectedCloseDate} IS NOT NULL`,
      lte(crmDeals.expectedCloseDate, thirtyDaysFromNow),
      gte(crmDeals.expectedCloseDate, now),
    ))
    .orderBy(asc(crmDeals.expectedCloseDate));

  // 7. Top deals by value (top 5)
  const topDeals = await db
    .select({
      id: crmDeals.id,
      accountId: crmDeals.accountId,
      userId: crmDeals.userId,
      title: crmDeals.title,
      value: crmDeals.value,
      stageId: crmDeals.stageId,
      contactId: crmDeals.contactId,
      companyId: crmDeals.companyId,
      assignedUserId: crmDeals.assignedUserId,
      probability: crmDeals.probability,
      expectedCloseDate: crmDeals.expectedCloseDate,
      wonAt: crmDeals.wonAt,
      lostAt: crmDeals.lostAt,
      lostReason: crmDeals.lostReason,
      tags: crmDeals.tags,
      isArchived: crmDeals.isArchived,
      sortOrder: crmDeals.sortOrder,
      createdAt: crmDeals.createdAt,
      updatedAt: crmDeals.updatedAt,
      stageName: crmDealStages.name,
      stageColor: crmDealStages.color,
      contactName: crmContacts.name,
      companyName: crmCompanies.name,
    })
    .from(crmDeals)
    .leftJoin(crmDealStages, eq(crmDeals.stageId, crmDealStages.id))
    .leftJoin(crmContacts, eq(crmDeals.contactId, crmContacts.id))
    .leftJoin(crmCompanies, eq(crmDeals.companyId, crmCompanies.id))
    .where(and(
      ownerFilter,
      eq(crmDeals.accountId, accountId),
      eq(crmDeals.isArchived, false),
      sql`${crmDeals.wonAt} IS NULL AND ${crmDeals.lostAt} IS NULL`,
    ))
    .orderBy(desc(crmDeals.value))
    .limit(5);

  return {
    totalPipelineValue,
    dealsWonCount,
    dealsWonValue,
    dealsLostCount,
    winRate,
    averageDealSize,
    dealCount,
    valueByStage: valueByStage.map((s) => ({
      stageId: s.stageId,
      stageName: s.stageName,
      stageColor: s.stageColor,
      value: Number(s.value),
      count: Number(s.count),
    })),
    recentActivities,
    dealsClosingSoon,
    topDeals,
  };
}

// ─── Dashboard Charts (extended) ──────────────────────────────────

export async function getDashboardCharts(userId: string, accountId: string, recordAccess?: CrmRecordAccess) {
  const ownerFilter = (!recordAccess || recordAccess === 'own')
    ? eq(crmDeals.userId, userId)
    : sql`TRUE`;
  const now = new Date();

  // Win/Loss by month (last 6 months)
  const winLossByMonth: { month: string; won: number; lost: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const [wonAgg] = await db.select({ count: sql<number>`COUNT(*)` }).from(crmDeals)
      .where(and(ownerFilter, eq(crmDeals.accountId, accountId), eq(crmDeals.isArchived, false),
        sql`${crmDeals.wonAt} IS NOT NULL`, gte(crmDeals.wonAt, monthDate), lte(crmDeals.wonAt, monthEnd)));

    const [lostAgg] = await db.select({ count: sql<number>`COUNT(*)` }).from(crmDeals)
      .where(and(ownerFilter, eq(crmDeals.accountId, accountId), eq(crmDeals.isArchived, false),
        sql`${crmDeals.lostAt} IS NOT NULL`, gte(crmDeals.lostAt, monthDate), lte(crmDeals.lostAt, monthEnd)));

    winLossByMonth.push({
      month: monthLabel,
      won: Number(wonAgg?.count ?? 0),
      lost: Number(lostAgg?.count ?? 0),
    });
  }

  // Revenue trend (last 6 months)
  const revenueTrend: { month: string; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const [revAgg] = await db.select({
      revenue: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`,
    }).from(crmDeals)
      .where(and(ownerFilter, eq(crmDeals.accountId, accountId), eq(crmDeals.isArchived, false),
        sql`${crmDeals.wonAt} IS NOT NULL`, gte(crmDeals.wonAt, monthDate), lte(crmDeals.wonAt, monthEnd)));

    revenueTrend.push({ month: monthLabel, revenue: Number(revAgg?.revenue ?? 0) });
  }

  // Sales cycle length (avg days from created to won, last 6 months)
  const salesCycleLength: { month: string; avgDays: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
    const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const [cycleAgg] = await db.select({
      avgDays: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${crmDeals.wonAt} - ${crmDeals.createdAt})) / 86400), 0)`,
    }).from(crmDeals)
      .where(and(ownerFilter, eq(crmDeals.accountId, accountId), eq(crmDeals.isArchived, false),
        sql`${crmDeals.wonAt} IS NOT NULL`, gte(crmDeals.wonAt, monthDate), lte(crmDeals.wonAt, monthEnd)));

    salesCycleLength.push({ month: monthLabel, avgDays: Math.round(Number(cycleAgg?.avgDays ?? 0)) });
  }

  // Conversion funnel — count of deals that reached each stage (ever)
  const funnelData = await db.select({
    stage: crmDealStages.name,
    stageColor: crmDealStages.color,
    count: sql<number>`COUNT(*)`,
    sequence: crmDealStages.sequence,
  }).from(crmDeals)
    .leftJoin(crmDealStages, eq(crmDeals.stageId, crmDealStages.id))
    .where(and(ownerFilter, eq(crmDeals.accountId, accountId), eq(crmDeals.isArchived, false)))
    .groupBy(crmDealStages.name, crmDealStages.color, crmDealStages.sequence)
    .orderBy(asc(crmDealStages.sequence));

  const conversionFunnel = funnelData.map((r) => ({
    stage: r.stage || 'Unknown',
    stageColor: r.stageColor || '#6b7280',
    count: Number(r.count),
    sequence: r.sequence ?? 0,
  }));

  // Deals by source — grouped by contact.source
  const sourceData = await db.select({
    source: crmContacts.source,
    count: sql<number>`COUNT(*)`,
    value: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`,
  }).from(crmDeals)
    .leftJoin(crmContacts, eq(crmDeals.contactId, crmContacts.id))
    .where(and(ownerFilter, eq(crmDeals.accountId, accountId), eq(crmDeals.isArchived, false)))
    .groupBy(crmContacts.source);

  const dealsBySource = sourceData.map((r) => ({
    source: r.source || 'Unknown',
    count: Number(r.count),
    value: Number(r.value),
  }));

  return { winLossByMonth, revenueTrend, salesCycleLength, conversionFunnel, dealsBySource };
}

// ─── Widget summary (lightweight) ──────────────────────────────────

export async function getWidgetData(userId: string, accountId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // Active pipeline value + deal count
  const [pipelineAgg] = await db
    .select({
      totalValue: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`.as('total_value'),
      dealCount: sql<number>`COUNT(*)`.as('deal_count'),
    })
    .from(crmDeals)
    .where(and(
      eq(crmDeals.accountId, accountId),
      eq(crmDeals.isArchived, false),
      sql`${crmDeals.wonAt} IS NULL AND ${crmDeals.lostAt} IS NULL`,
    ));

  // Won this month
  const [wonAgg] = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(crmDeals)
    .where(and(
      eq(crmDeals.accountId, accountId),
      eq(crmDeals.isArchived, false),
      sql`${crmDeals.wonAt} IS NOT NULL`,
      gte(crmDeals.wonAt, monthStart),
    ));

  // Lost this month
  const [lostAgg] = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(crmDeals)
    .where(and(
      eq(crmDeals.accountId, accountId),
      eq(crmDeals.isArchived, false),
      sql`${crmDeals.lostAt} IS NOT NULL`,
      gte(crmDeals.lostAt, monthStart),
    ));

  return {
    totalValue: Number(pipelineAgg?.totalValue ?? 0),
    dealCount: Number(pipelineAgg?.dealCount ?? 0),
    wonThisMonth: Number(wonAgg?.count ?? 0),
    lostThisMonth: Number(lostAgg?.count ?? 0),
  };
}

// ─── Seed Sample Data ───────────────────────────────────────────────

export async function seedSampleData(userId: string, accountId: string) {
  // Seed default pipeline stages
  const stages = await seedDefaultStages(accountId);

  // Idempotency guard — skip sample data if contacts already exist
  const existingContacts = await db.select({ id: crmContacts.id }).from(crmContacts)
    .where(and(eq(crmContacts.accountId, accountId), eq(crmContacts.isArchived, false))).limit(1);
  if (existingContacts.length > 0) {
    logger.info({ userId, accountId }, 'Seeded CRM default stages (sample data already exists)');
    return { stages: stages.length };
  }

  // Build a stage lookup by name
  const allStages = await db.select().from(crmDealStages)
    .where(eq(crmDealStages.accountId, accountId))
    .orderBy(asc(crmDealStages.sequence));
  const stageByName: Record<string, string> = {};
  for (const s of allStages) {
    stageByName[s.name.toLowerCase()] = s.id;
  }

  // --- Companies ---
  const acme = await createCompany(userId, accountId, {
    name: 'Acme Corp', industry: 'Technology', size: '50', domain: 'acmecorp.com',
  });
  const globalTech = await createCompany(userId, accountId, {
    name: 'GlobalTech Solutions', industry: 'Consulting', size: '200', domain: 'globaltech.io',
  });
  const brightStar = await createCompany(userId, accountId, {
    name: 'BrightStar Media', industry: 'Marketing', size: '25', domain: 'brightstarmedia.com',
  });

  // --- Contacts (2 per company) ---
  const johnSmith = await createContact(userId, accountId, {
    name: 'John Smith', email: 'john@acmecorp.com', position: 'CEO', companyId: acme.id,
  });
  const sarahJohnson = await createContact(userId, accountId, {
    name: 'Sarah Johnson', email: 'sarah@acmecorp.com', position: 'CTO', companyId: acme.id,
  });
  const michaelChen = await createContact(userId, accountId, {
    name: 'Michael Chen', email: 'michael@globaltech.io', position: 'VP Sales', companyId: globalTech.id,
  });
  const emilyDavis = await createContact(userId, accountId, {
    name: 'Emily Davis', email: 'emily@globaltech.io', position: 'Marketing Director', companyId: globalTech.id,
  });
  const davidWilson = await createContact(userId, accountId, {
    name: 'David Wilson', email: 'david@brightstarmedia.com', position: 'Founder', companyId: brightStar.id,
  });
  const lisaAnderson = await createContact(userId, accountId, {
    name: 'Lisa Anderson', email: 'lisa@brightstarmedia.com', position: 'Creative Director', companyId: brightStar.id,
  });

  // --- Deals ---
  const proposalStageId = stageByName['proposal'] ?? allStages[2]?.id;
  const qualifiedStageId = stageByName['qualified'] ?? allStages[1]?.id;
  const negotiationStageId = stageByName['negotiation'] ?? allStages[3]?.id;
  const wonStageId = stageByName['closed won'] ?? allStages[4]?.id;

  const deal1 = await createDeal(userId, accountId, {
    title: 'Acme Enterprise License', value: 45000, stageId: proposalStageId,
    contactId: johnSmith.id, companyId: acme.id, probability: 60,
  });
  await createDeal(userId, accountId, {
    title: 'GlobalTech Consulting Package', value: 120000, stageId: qualifiedStageId,
    contactId: michaelChen.id, companyId: globalTech.id, probability: 40,
  });
  const deal3 = await createDeal(userId, accountId, {
    title: 'BrightStar Social Campaign', value: 15000, stageId: negotiationStageId,
    contactId: davidWilson.id, companyId: brightStar.id, probability: 80,
  });
  const deal4 = await createDeal(userId, accountId, {
    title: 'Acme Support Add-on', value: 8000, stageId: wonStageId,
    contactId: sarahJohnson.id, companyId: acme.id, probability: 100,
  });
  // Mark the won deal
  await markDealWon(userId, accountId, deal4.id, 'all');

  // --- Leads ---
  await createLead(userId, accountId, {
    name: 'TechStart Inc', email: 'info@techstart.io', phone: '+1-555-0201', source: 'website', companyName: 'TechStart Inc', notes: 'Interested in starter plan',
  });
  await createLead(userId, accountId, {
    name: 'Metro Solutions', email: 'sales@metrosolutions.com', phone: '+1-555-0202', source: 'referral', companyName: 'Metro Solutions', notes: 'Called, scheduling demo',
  });
  await createLead(userId, accountId, {
    name: 'CloudNine Labs', email: 'hello@cloudninelabs.io', phone: '+1-555-0203', source: 'social_media', companyName: 'CloudNine Labs', notes: 'Budget approved, needs proposal',
  });
  await createLead(userId, accountId, {
    name: 'Peak Performance', email: 'contact@peakperf.com', source: 'website', companyName: 'Peak Performance', notes: 'Filled out lead form',
  });
  // Update statuses for non-new leads
  const allLeads = await listLeads(userId, accountId, {});
  for (const lead of allLeads) {
    if (lead.name === 'Metro Solutions') {
      await updateLead(userId, accountId, lead.id, { status: 'contacted' });
    } else if (lead.name === 'CloudNine Labs') {
      await updateLead(userId, accountId, lead.id, { status: 'qualified' });
    }
  }

  // --- Activities ---
  await createActivity(userId, accountId, {
    type: 'call', body: 'Discussed enterprise requirements', contactId: johnSmith.id, dealId: deal1.id,
  });
  await createActivity(userId, accountId, {
    type: 'meeting', body: 'Product demo scheduled', contactId: michaelChen.id,
  });
  await createActivity(userId, accountId, {
    type: 'note', body: 'Waiting for creative brief', dealId: deal3.id,
  });
  await createActivity(userId, accountId, {
    type: 'email', body: 'Sent proposal deck', contactId: lisaAnderson.id,
  });

  logger.info({ userId, accountId }, 'Seeded CRM sample data (stages, companies, contacts, deals, leads, activities)');
  return { stages: stages.length, companies: 3, contacts: 6, deals: 4, leads: 4, activities: 4 };
}
