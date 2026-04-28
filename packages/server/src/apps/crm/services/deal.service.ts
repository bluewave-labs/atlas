import { db } from '../../../config/database';
import { crmCompanies, crmContacts, crmDealStages, crmDeals } from '../../../db/schema';
import { eq, and, or, asc, desc, sql, gte, lte, isNull } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import type { CrmRecordAccess } from '@atlas-platform/shared';
import { executeWorkflows } from './workflow.service';
import { createActivity } from './activity.service';

// ─── Lightweight lookups ───────────────────────────────────────────

export async function getDealAssigneeInfo(dealId: string): Promise<{ assignedUserId: string | null; title: string } | null> {
  const [deal] = await db.select({ assignedUserId: crmDeals.assignedUserId, title: crmDeals.title })
    .from(crmDeals).where(eq(crmDeals.id, dealId)).limit(1);
  return deal || null;
}

// ─── Input types ────────────────────────────────────────────────────

interface CreateDealStageInput {
  name: string;
  color?: string;
  probability?: number;
  sequence?: number;
  isDefault?: boolean;
}

interface UpdateDealStageInput extends Partial<CreateDealStageInput> {
  rottingDays?: number | null;
}

interface CreateDealInput {
  title: string;
  value: number;
  stageId: string;
  contactId?: string | null;
  companyId?: string | null;
  assignedUserId?: string | null;
  probability?: number;
  expectedCloseDate?: string | null;
  tags?: string[];
}

interface UpdateDealInput extends Partial<CreateDealInput> {
  sortOrder?: number;
  isArchived?: boolean;
}

// ─── Deal Stages ────────────────────────────────────────────────────

export async function listDealStages(tenantId: string) {
  return db
    .select()
    .from(crmDealStages)
    .where(eq(crmDealStages.tenantId, tenantId))
    .orderBy(asc(crmDealStages.sequence));
}

export async function createDealStage(tenantId: string, input: CreateDealStageInput) {
  const [maxSeq] = await db
    .select({ max: sql<number>`COALESCE(MAX(${crmDealStages.sequence}), -1)` })
    .from(crmDealStages)
    .where(eq(crmDealStages.tenantId, tenantId));

  const sequence = input.sequence ?? ((maxSeq?.max ?? -1) + 1);

  const [created] = await db
    .insert(crmDealStages)
    .values({
      tenantId,
      name: input.name,
      color: input.color ?? '#6b7280',
      probability: input.probability ?? 0,
      sequence,
      isDefault: input.isDefault ?? false,
    })
    .returning();

  logger.info({ tenantId, stageId: created.id }, 'CRM deal stage created');
  return created;
}

export async function updateDealStage(tenantId: string, id: string, input: UpdateDealStageInput) {
  const updates: Record<string, unknown> = {};

  if (input.name !== undefined) updates.name = input.name;
  if (input.color !== undefined) updates.color = input.color;
  if (input.probability !== undefined) updates.probability = input.probability;
  if (input.sequence !== undefined) updates.sequence = input.sequence;
  if (input.isDefault !== undefined) updates.isDefault = input.isDefault;
  if (input.rottingDays !== undefined) updates.rottingDays = input.rottingDays;

  await db
    .update(crmDealStages)
    .set(updates)
    .where(and(eq(crmDealStages.id, id), eq(crmDealStages.tenantId, tenantId)));

  const [updated] = await db
    .select()
    .from(crmDealStages)
    .where(and(eq(crmDealStages.id, id), eq(crmDealStages.tenantId, tenantId)))
    .limit(1);

  return updated || null;
}

export async function deleteDealStage(tenantId: string, id: string) {
  // Check if there are deals in this stage
  const [dealCount] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(crmDeals)
    .where(and(eq(crmDeals.stageId, id), eq(crmDeals.isArchived, false)));

  if ((dealCount?.count ?? 0) > 0) {
    throw new Error('Cannot delete a stage that has deals');
  }

  await db
    .delete(crmDealStages)
    .where(and(eq(crmDealStages.id, id), eq(crmDealStages.tenantId, tenantId)));
}

export async function reorderDealStages(tenantId: string, stageIds: string[]) {
  for (let i = 0; i < stageIds.length; i++) {
    await db
      .update(crmDealStages)
      .set({ sequence: i })
      .where(and(eq(crmDealStages.id, stageIds[i]), eq(crmDealStages.tenantId, tenantId)));
  }
}

export async function seedDefaultStages(tenantId: string) {
  // Idempotency guard
  const existing = await db.select({ id: crmDealStages.id }).from(crmDealStages)
    .where(eq(crmDealStages.tenantId, tenantId)).limit(1);
  if (existing.length > 0) return existing;

  const defaults = [
    { name: 'Lead', color: '#6b7280', probability: 10, sequence: 0, isDefault: true },
    { name: 'Qualified', color: '#3b82f6', probability: 25, sequence: 1, isDefault: false },
    { name: 'Proposal', color: '#f59e0b', probability: 50, sequence: 2, isDefault: false },
    { name: 'Negotiation', color: '#f97316', probability: 75, sequence: 3, isDefault: false },
    { name: 'Closed Won', color: '#10b981', probability: 100, sequence: 4, isDefault: false },
    { name: 'Closed Lost', color: '#ef4444', probability: 0, sequence: 5, isDefault: false },
  ];

  const stages = [];
  for (const d of defaults) {
    const stage = await createDealStage(tenantId, d);
    stages.push(stage);
  }

  logger.info({ tenantId }, 'Seeded default CRM deal stages');
  return stages;
}

// ─── Deals ──────────────────────────────────────────────────────────

export async function listDeals(userId: string, tenantId: string, filters?: {
  stageId?: string;
  contactId?: string;
  companyId?: string;
  includeArchived?: boolean;
  recordAccess?: CrmRecordAccess;
}) {
  const conditions = [eq(crmDeals.tenantId, tenantId)];
  if (!filters?.recordAccess || filters.recordAccess === 'own') {
    conditions.push(or(
      eq(crmDeals.userId, userId),
      eq(crmDeals.assignedUserId, userId),
    )!);
  }

  if (!filters?.includeArchived) {
    conditions.push(eq(crmDeals.isArchived, false));
  }
  if (filters?.stageId) {
    conditions.push(eq(crmDeals.stageId, filters.stageId));
  }
  if (filters?.contactId) {
    conditions.push(eq(crmDeals.contactId, filters.contactId));
  }
  if (filters?.companyId) {
    conditions.push(eq(crmDeals.companyId, filters.companyId));
  }

  return db
    .select({
      id: crmDeals.id,
      tenantId: crmDeals.tenantId,
      userId: crmDeals.userId,
      title: crmDeals.title,
      value: crmDeals.value,
      currency: crmDeals.currency,
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
      stageEnteredAt: crmDeals.stageEnteredAt,
      isArchived: crmDeals.isArchived,
      sortOrder: crmDeals.sortOrder,
      createdAt: crmDeals.createdAt,
      updatedAt: crmDeals.updatedAt,
      stageName: crmDealStages.name,
      stageColor: crmDealStages.color,
      stageRottingDays: crmDealStages.rottingDays,
      contactName: crmContacts.name,
      companyName: crmCompanies.name,
    })
    .from(crmDeals)
    .leftJoin(crmDealStages, eq(crmDeals.stageId, crmDealStages.id))
    .leftJoin(crmContacts, eq(crmDeals.contactId, crmContacts.id))
    .leftJoin(crmCompanies, eq(crmDeals.companyId, crmCompanies.id))
    .where(and(...conditions))
    .orderBy(asc(crmDeals.sortOrder), asc(crmDeals.createdAt));
}

export async function getDeal(userId: string, tenantId: string, id: string, recordAccess?: CrmRecordAccess) {
  const conditions = [eq(crmDeals.id, id), eq(crmDeals.tenantId, tenantId)];
  if (!recordAccess || recordAccess === 'own') {
    conditions.push(or(
      eq(crmDeals.userId, userId),
      eq(crmDeals.assignedUserId, userId),
    )!);
  }

  const [deal] = await db
    .select({
      id: crmDeals.id,
      tenantId: crmDeals.tenantId,
      userId: crmDeals.userId,
      title: crmDeals.title,
      value: crmDeals.value,
      currency: crmDeals.currency,
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
    .where(and(...conditions))
    .limit(1);

  return deal || null;
}

export async function createDeal(userId: string, tenantId: string, input: CreateDealInput) {
  const now = new Date();

  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${crmDeals.sortOrder}), -1)` })
    .from(crmDeals)
    .where(eq(crmDeals.userId, userId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(crmDeals)
    .values({
      tenantId,
      userId,
      title: input.title,
      value: input.value,
      stageId: input.stageId,
      contactId: input.contactId ?? null,
      companyId: input.companyId ?? null,
      assignedUserId: input.assignedUserId ?? null,
      probability: input.probability ?? 0,
      expectedCloseDate: input.expectedCloseDate ? new Date(input.expectedCloseDate) : null,
      tags: input.tags ?? [],
      stageEnteredAt: now,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, dealId: created.id }, 'CRM deal created');

  // Fire workflow trigger
  executeWorkflows(tenantId, userId, 'deal_created', { dealId: created.id })
    .catch((err) => logger.warn({ err, trigger: 'deal_created' }, 'Workflow dispatch failed'));

  return created;
}

export async function updateDeal(userId: string, tenantId: string, id: string, input: UpdateDealInput, recordAccess?: CrmRecordAccess) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  const updateConditions = [eq(crmDeals.id, id), eq(crmDeals.tenantId, tenantId)];
  if (!recordAccess || recordAccess === 'own') {
    updateConditions.push(or(
      eq(crmDeals.userId, userId),
      eq(crmDeals.assignedUserId, userId),
    )!);
  }

  // Capture old stage for workflow trigger
  let oldStageId: string | null = null;
  if (input.stageId !== undefined) {
    const [existing] = await db.select({ stageId: crmDeals.stageId }).from(crmDeals)
      .where(and(...updateConditions)).limit(1);
    if (existing) oldStageId = existing.stageId;
  }

  if (input.title !== undefined) updates.title = input.title;
  if (input.value !== undefined) updates.value = input.value;
  if (input.stageId !== undefined) {
    updates.stageId = input.stageId;
    // Track when deal enters a new stage (for rotting detection)
    if (oldStageId && oldStageId !== input.stageId) {
      updates.stageEnteredAt = now;
    }
  }
  if (input.contactId !== undefined) updates.contactId = input.contactId;
  if (input.companyId !== undefined) updates.companyId = input.companyId;
  if (input.assignedUserId !== undefined) updates.assignedUserId = input.assignedUserId;
  if (input.probability !== undefined) updates.probability = input.probability;
  if (input.expectedCloseDate !== undefined) updates.expectedCloseDate = input.expectedCloseDate ? new Date(input.expectedCloseDate) : null;
  if (input.tags !== undefined) updates.tags = input.tags;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  await db
    .update(crmDeals)
    .set(updates)
    .where(and(...updateConditions));

  // Fire workflow trigger + log activity if stage changed
  if (input.stageId !== undefined && oldStageId && oldStageId !== input.stageId) {
    executeWorkflows(tenantId, userId, 'deal_stage_changed', {
      dealId: id, fromStage: oldStageId, toStage: input.stageId,
    }).catch((err) => logger.warn({ err, trigger: 'deal_stage_changed' }, 'Workflow dispatch failed'));

    // Auto-log stage change activity
    const [oldStage, newStage] = await Promise.all([
      db.select({ name: crmDealStages.name }).from(crmDealStages).where(eq(crmDealStages.id, oldStageId)).limit(1),
      db.select({ name: crmDealStages.name }).from(crmDealStages).where(eq(crmDealStages.id, input.stageId)).limit(1),
    ]);
    const fromName = oldStage[0]?.name ?? 'Unknown';
    const toName = newStage[0]?.name ?? 'Unknown';
    createActivity(userId, tenantId, {
      type: 'stage_change',
      body: `__i18n:crm.activities.bodies.stageChange?from=${encodeURIComponent(fromName)}&to=${encodeURIComponent(toName)}`,
      dealId: id,
    }).catch(() => {});
  }

  return getDeal(userId, tenantId, id, recordAccess);
}

export async function deleteDeal(userId: string, tenantId: string, id: string, recordAccess?: CrmRecordAccess) {
  await updateDeal(userId, tenantId, id, { isArchived: true }, recordAccess);
}

export async function markDealWon(userId: string, tenantId: string, id: string, recordAccess?: CrmRecordAccess) {
  const now = new Date();
  const conditions = [eq(crmDeals.id, id), eq(crmDeals.tenantId, tenantId)];
  if (!recordAccess || recordAccess === 'own') {
    conditions.push(or(
      eq(crmDeals.userId, userId),
      eq(crmDeals.assignedUserId, userId),
    )!);
  }
  await db
    .update(crmDeals)
    .set({ wonAt: now, lostAt: null, lostReason: null, probability: 100, updatedAt: now })
    .where(and(...conditions));

  // Fire workflow trigger + log activity
  executeWorkflows(tenantId, userId, 'deal_won', { dealId: id })
    .catch((err) => logger.warn({ err, trigger: 'deal_won' }, 'Workflow dispatch failed'));
  createActivity(userId, tenantId, { type: 'deal_won', body: '__i18n:crm.activities.bodies.dealWon', dealId: id }).catch(() => {});

  return getDeal(userId, tenantId, id, recordAccess);
}

export async function markDealLost(userId: string, tenantId: string, id: string, reason?: string, recordAccess?: CrmRecordAccess) {
  const now = new Date();
  const conditions = [eq(crmDeals.id, id), eq(crmDeals.tenantId, tenantId)];
  if (!recordAccess || recordAccess === 'own') {
    conditions.push(or(
      eq(crmDeals.userId, userId),
      eq(crmDeals.assignedUserId, userId),
    )!);
  }
  await db
    .update(crmDeals)
    .set({ lostAt: now, wonAt: null, lostReason: reason ?? null, probability: 0, updatedAt: now })
    .where(and(...conditions));

  // Fire workflow trigger + log activity
  executeWorkflows(tenantId, userId, 'deal_lost', { dealId: id })
    .catch((err) => logger.warn({ err, trigger: 'deal_lost' }, 'Workflow dispatch failed'));
  createActivity(userId, tenantId, {
    type: 'deal_lost',
    body: reason
      ? `__i18n:crm.activities.bodies.dealLostWithReason?reason=${encodeURIComponent(reason)}`
      : '__i18n:crm.activities.bodies.dealLost',
    dealId: id,
  }).catch(() => {});

  return getDeal(userId, tenantId, id, recordAccess);
}

export async function countsByStage(userId: string, tenantId: string, recordAccess?: CrmRecordAccess) {
  const conditions = [eq(crmDeals.tenantId, tenantId), eq(crmDeals.isArchived, false)];
  if (!recordAccess || recordAccess === 'own') {
    conditions.push(or(
      eq(crmDeals.userId, userId),
      eq(crmDeals.assignedUserId, userId),
    )!);
  }
  return db
    .select({
      stageId: crmDeals.stageId,
      stageName: crmDealStages.name,
      stageColor: crmDealStages.color,
      count: sql<number>`COUNT(*)`.as('count'),
      totalValue: sql<number>`SUM(${crmDeals.value})`.as('total_value'),
    })
    .from(crmDeals)
    .leftJoin(crmDealStages, eq(crmDeals.stageId, crmDealStages.id))
    .where(and(...conditions))
    .groupBy(crmDeals.stageId, crmDealStages.name, crmDealStages.color);
}

export async function pipelineValue(userId: string, tenantId: string, recordAccess?: CrmRecordAccess) {
  const conditions = [
    eq(crmDeals.tenantId, tenantId),
    eq(crmDeals.isArchived, false),
    sql`${crmDeals.wonAt} IS NULL AND ${crmDeals.lostAt} IS NULL`,
  ];
  if (!recordAccess || recordAccess === 'own') {
    conditions.push(or(
      eq(crmDeals.userId, userId),
      eq(crmDeals.assignedUserId, userId),
    )!);
  }
  const [result] = await db
    .select({
      totalValue: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`.as('total_value'),
      dealCount: sql<number>`COUNT(*)`.as('deal_count'),
      weightedValue: sql<number>`COALESCE(SUM(${crmDeals.value} * ${crmDeals.probability} / 100.0), 0)`.as('weighted_value'),
    })
    .from(crmDeals)
    .where(and(...conditions));

  return result || { totalValue: 0, dealCount: 0, weightedValue: 0 };
}

// ─── Bulk Import ───────────────────────────────────────────────────────

export async function bulkCreateDeals(
  userId: string,
  tenantId: string,
  rows: Array<Record<string, string>>,
): Promise<{ imported: number; failed: number; errors: string[] }> {
  let imported = 0;
  let failed = 0;
  const errors: string[] = [];

  // Get default stage for deals without a stage
  const stages = await listDealStages(tenantId);
  const defaultStage = stages.find((s) => s.isDefault) ?? stages[0];

  if (!defaultStage) {
    return { imported: 0, failed: rows.length, errors: ['No deal stages configured. Create stages first.'] };
  }

  // Build a stage lookup by name (case-insensitive)
  const stageByName: Record<string, string> = {};
  for (const s of stages) {
    stageByName[s.name.toLowerCase()] = s.id;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.title?.trim()) {
        errors.push(`Row ${i + 1}: Title is required`);
        failed++;
        continue;
      }

      // Resolve stage by name or use default
      let stageId = defaultStage.id;
      if (row.stage?.trim()) {
        const matchedStageId = stageByName[row.stage.trim().toLowerCase()];
        if (matchedStageId) stageId = matchedStageId;
      }

      await createDeal(userId, tenantId, {
        title: row.title.trim(),
        value: Number(row.value) || 0,
        stageId,
        probability: Number(row.probability) || 0,
        expectedCloseDate: row.expectedCloseDate?.trim() || null,
        contactId: null,
        companyId: null,
      });
      imported++;
    } catch (err) {
      failed++;
      errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  logger.info({ userId, tenantId, imported, failed }, 'Bulk imported CRM deals');
  return { imported, failed, errors };
}

// ─── Forecasting ───────────────────────────────────────────────────

export async function getForecast(tenantId: string) {
  const now = new Date();
  const months: { month: string; weightedValue: number }[] = [];

  for (let i = 0; i < 6; i++) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + i + 1, 0, 23, 59, 59);
    const monthLabel = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const [agg] = await db
      .select({
        weighted: sql<number>`COALESCE(SUM(${crmDeals.value} * ${crmDeals.probability} / 100.0), 0)`.as('weighted'),
      })
      .from(crmDeals)
      .where(and(
        eq(crmDeals.tenantId, tenantId),
        eq(crmDeals.isArchived, false),
        isNull(crmDeals.wonAt),
        isNull(crmDeals.lostAt),
        sql`${crmDeals.expectedCloseDate} IS NOT NULL`,
        gte(crmDeals.expectedCloseDate, monthDate),
        lte(crmDeals.expectedCloseDate, monthEnd),
      ));

    months.push({ month: monthLabel, weightedValue: Number(agg?.weighted ?? 0) });
  }

  // Total weighted pipeline
  const [totalAgg] = await db
    .select({
      weighted: sql<number>`COALESCE(SUM(${crmDeals.value} * ${crmDeals.probability} / 100.0), 0)`.as('weighted'),
      bestCase: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`.as('best_case'),
    })
    .from(crmDeals)
    .where(and(
      eq(crmDeals.tenantId, tenantId),
      eq(crmDeals.isArchived, false),
      isNull(crmDeals.wonAt),
      isNull(crmDeals.lostAt),
    ));

  // Committed (won deals)
  const [wonAgg] = await db
    .select({
      committed: sql<number>`COALESCE(SUM(${crmDeals.value}), 0)`.as('committed'),
    })
    .from(crmDeals)
    .where(and(
      eq(crmDeals.tenantId, tenantId),
      eq(crmDeals.isArchived, false),
      sql`${crmDeals.wonAt} IS NOT NULL`,
    ));

  return {
    months,
    totalWeighted: Number(totalAgg?.weighted ?? 0),
    bestCase: Number(totalAgg?.bestCase ?? 0),
    committed: Number(wonAgg?.committed ?? 0),
  };
}
