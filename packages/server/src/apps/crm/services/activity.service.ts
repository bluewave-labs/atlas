import { db } from '../../../config/database';
import { crmActivities, crmActivityTypes, users } from '../../../db/schema';
import { eq, and, asc, desc, sql, gte, lte } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import type { CrmRecordAccess } from '@atlasmail/shared';
import { executeWorkflows } from './workflow.service';

// ─── Input types ────────────────────────────────────────────────────

interface CreateActivityInput {
  type: string;
  body: string;
  dealId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
  assignedUserId?: string | null;
  scheduledAt?: string | null;
}

interface UpdateActivityInput extends Partial<CreateActivityInput> {
  completedAt?: string | null;
  isArchived?: boolean;
}

// ─── Activities ─────────────────────────────────────────────────────

export async function listActivities(userId: string, accountId: string, filters?: {
  dealId?: string;
  contactId?: string;
  companyId?: string;
  includeArchived?: boolean;
  recordAccess?: CrmRecordAccess;
  dueBefore?: string;
  dueAfter?: string;
  sortBy?: 'createdAt' | 'scheduledAt';
}) {
  const conditions = [eq(crmActivities.accountId, accountId)];
  if (!filters?.recordAccess || filters.recordAccess === 'own') {
    conditions.push(eq(crmActivities.userId, userId));
  }

  if (!filters?.includeArchived) {
    conditions.push(eq(crmActivities.isArchived, false));
  }
  if (filters?.dealId) {
    conditions.push(eq(crmActivities.dealId, filters.dealId));
  }
  if (filters?.contactId) {
    conditions.push(eq(crmActivities.contactId, filters.contactId));
  }
  if (filters?.companyId) {
    conditions.push(eq(crmActivities.companyId, filters.companyId));
  }
  if (filters?.dueBefore) {
    conditions.push(lte(crmActivities.scheduledAt, new Date(filters.dueBefore)));
  }
  if (filters?.dueAfter) {
    conditions.push(gte(crmActivities.scheduledAt, new Date(filters.dueAfter)));
  }

  const orderCol = filters?.sortBy === 'scheduledAt' ? crmActivities.scheduledAt : crmActivities.createdAt;

  return db
    .select({
      id: crmActivities.id,
      accountId: crmActivities.accountId,
      userId: crmActivities.userId,
      type: crmActivities.type,
      body: crmActivities.body,
      dealId: crmActivities.dealId,
      contactId: crmActivities.contactId,
      companyId: crmActivities.companyId,
      assignedUserId: crmActivities.assignedUserId,
      scheduledAt: crmActivities.scheduledAt,
      completedAt: crmActivities.completedAt,
      isArchived: crmActivities.isArchived,
      createdAt: crmActivities.createdAt,
      updatedAt: crmActivities.updatedAt,
      assignedUserName: users.name,
    })
    .from(crmActivities)
    .leftJoin(users, eq(crmActivities.assignedUserId, users.id))
    .where(and(...conditions))
    .orderBy(desc(orderCol));
}

export async function createActivity(userId: string, accountId: string, input: CreateActivityInput) {
  const now = new Date();

  const [created] = await db
    .insert(crmActivities)
    .values({
      accountId,
      userId,
      type: input.type ?? 'note',
      body: input.body,
      dealId: input.dealId ?? null,
      contactId: input.contactId ?? null,
      companyId: input.companyId ?? null,
      assignedUserId: input.assignedUserId ?? null,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, activityId: created.id }, 'CRM activity created');

  // Fire workflow trigger
  executeWorkflows(accountId, userId, 'activity_logged', {
    activityId: created.id,
    dealId: created.dealId,
    contactId: created.contactId,
    activityType: created.type,
  }).catch(() => {});

  return created;
}

export async function updateActivity(userId: string, accountId: string, id: string, input: UpdateActivityInput, recordAccess?: CrmRecordAccess) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.type !== undefined) updates.type = input.type;
  if (input.body !== undefined) updates.body = input.body;
  if (input.dealId !== undefined) updates.dealId = input.dealId;
  if (input.contactId !== undefined) updates.contactId = input.contactId;
  if (input.companyId !== undefined) updates.companyId = input.companyId;
  if (input.assignedUserId !== undefined) updates.assignedUserId = input.assignedUserId;
  if (input.scheduledAt !== undefined) updates.scheduledAt = input.scheduledAt ? new Date(input.scheduledAt) : null;
  if (input.completedAt !== undefined) updates.completedAt = input.completedAt ? new Date(input.completedAt) : null;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  const updateConditions = [eq(crmActivities.id, id), eq(crmActivities.accountId, accountId)];
  if (!recordAccess || recordAccess === 'own') {
    updateConditions.push(eq(crmActivities.userId, userId));
  }

  await db
    .update(crmActivities)
    .set(updates)
    .where(and(...updateConditions));

  const [updated] = await db
    .select()
    .from(crmActivities)
    .where(and(...updateConditions))
    .limit(1);

  return updated || null;
}

export async function deleteActivity(userId: string, accountId: string, id: string, recordAccess?: CrmRecordAccess) {
  await updateActivity(userId, accountId, id, { isArchived: true }, recordAccess);
}

export async function completeAndScheduleNext(
  userId: string,
  accountId: string,
  activityId: string,
  nextInput?: { type: string; body?: string; scheduledAt: string },
  recordAccess?: CrmRecordAccess,
) {
  // Complete the current activity
  const completed = await updateActivity(userId, accountId, activityId, { completedAt: new Date().toISOString() }, recordAccess);
  if (!completed) throw new Error('Activity not found');

  let next = null;
  if (nextInput) {
    next = await createActivity(userId, accountId, {
      type: nextInput.type,
      body: nextInput.body || '',
      dealId: completed.dealId ?? undefined,
      contactId: completed.contactId ?? undefined,
      companyId: completed.companyId ?? undefined,
      scheduledAt: nextInput.scheduledAt,
    });
  }

  return { completed, next };
}

// ─── Activity Types ─────────────────────────────────────────────────

export async function listActivityTypes(accountId: string) {
  return db
    .select()
    .from(crmActivityTypes)
    .where(and(eq(crmActivityTypes.accountId, accountId), eq(crmActivityTypes.isArchived, false)))
    .orderBy(asc(crmActivityTypes.sortOrder));
}

export async function createActivityType(accountId: string, input: { name: string; icon?: string; color?: string }) {
  const now = new Date();
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${crmActivityTypes.sortOrder}), -1)` })
    .from(crmActivityTypes)
    .where(eq(crmActivityTypes.accountId, accountId));

  const [created] = await db
    .insert(crmActivityTypes)
    .values({
      accountId,
      name: input.name,
      icon: input.icon ?? 'sticky-note',
      color: input.color ?? '#6b7280',
      sortOrder: (maxSort?.max ?? -1) + 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

export async function updateActivityType(accountId: string, id: string, input: Partial<{ name: string; icon: string; color: string; sortOrder: number; isArchived: boolean }>) {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.color !== undefined) updates.color = input.color;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  await db.update(crmActivityTypes).set(updates)
    .where(and(eq(crmActivityTypes.id, id), eq(crmActivityTypes.accountId, accountId)));

  const [updated] = await db.select().from(crmActivityTypes)
    .where(and(eq(crmActivityTypes.id, id), eq(crmActivityTypes.accountId, accountId))).limit(1);
  return updated || null;
}

export async function deleteActivityType(accountId: string, id: string) {
  return updateActivityType(accountId, id, { isArchived: true });
}

export async function reorderActivityTypes(accountId: string, typeIds: string[]) {
  for (let i = 0; i < typeIds.length; i++) {
    await db.update(crmActivityTypes).set({ sortOrder: i })
      .where(and(eq(crmActivityTypes.id, typeIds[i]), eq(crmActivityTypes.accountId, accountId)));
  }
}

const DEFAULT_ACTIVITY_TYPES = [
  { name: 'note', icon: 'sticky-note', color: '#6b7280' },
  { name: 'call', icon: 'phone-call', color: '#3b82f6' },
  { name: 'email', icon: 'mail', color: '#8b5cf6' },
  { name: 'meeting', icon: 'calendar-days', color: '#f59e0b' },
];

export async function seedDefaultActivityTypes(accountId: string) {
  const existing = await listActivityTypes(accountId);
  if (existing.length > 0) return existing;

  const now = new Date();
  for (let i = 0; i < DEFAULT_ACTIVITY_TYPES.length; i++) {
    const t = DEFAULT_ACTIVITY_TYPES[i];
    await db.insert(crmActivityTypes).values({
      accountId, name: t.name, icon: t.icon, color: t.color,
      isDefault: true, sortOrder: i, createdAt: now, updatedAt: now,
    });
  }
  return listActivityTypes(accountId);
}
