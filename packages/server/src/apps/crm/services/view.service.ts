import { db } from '../../../config/database';
import { crmSavedViews } from '../../../db/schema';
import { eq, and, or, asc, desc } from 'drizzle-orm';
import { logger } from '../../../utils/logger';

// ─── Input types ────────────────────────────────────────────────────

interface CreateSavedViewInput {
  appSection: string;
  name: string;
  filters: Record<string, unknown>;
  isPinned?: boolean;
  isShared?: boolean;
}

interface UpdateSavedViewInput {
  name?: string;
  filters?: Record<string, unknown>;
  isPinned?: boolean;
  isShared?: boolean;
  sortOrder?: number;
}

// ─── Saved Views ──────────────────────────────────────────────────

export async function listSavedViews(userId: string, tenantId: string, appSection?: string) {
  const conditions = [
    eq(crmSavedViews.tenantId, tenantId),
    eq(crmSavedViews.isArchived, false),
  ];

  // Return user's own views + shared views from other users
  conditions.push(
    or(
      eq(crmSavedViews.userId, userId),
      eq(crmSavedViews.isShared, true),
    )!,
  );

  if (appSection) {
    conditions.push(eq(crmSavedViews.appSection, appSection));
  }

  return db.select().from(crmSavedViews)
    .where(and(...conditions))
    .orderBy(desc(crmSavedViews.isPinned), asc(crmSavedViews.sortOrder), desc(crmSavedViews.createdAt));
}

export async function createSavedView(userId: string, tenantId: string, input: CreateSavedViewInput) {
  const now = new Date();
  const [created] = await db.insert(crmSavedViews).values({
    tenantId,
    userId,
    appSection: input.appSection,
    name: input.name,
    filters: input.filters,
    isPinned: input.isPinned ?? false,
    isShared: input.isShared ?? false,
    createdAt: now,
    updatedAt: now,
  }).returning();

  logger.info({ userId, viewId: created.id }, 'CRM saved view created');
  return created;
}

export async function updateSavedView(userId: string, tenantId: string, id: string, input: UpdateSavedViewInput) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) updates.name = input.name;
  if (input.filters !== undefined) updates.filters = input.filters;
  if (input.isPinned !== undefined) updates.isPinned = input.isPinned;
  if (input.isShared !== undefined) updates.isShared = input.isShared;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;

  await db.update(crmSavedViews).set(updates)
    .where(and(eq(crmSavedViews.id, id), eq(crmSavedViews.userId, userId), eq(crmSavedViews.tenantId, tenantId)));

  const [updated] = await db.select().from(crmSavedViews)
    .where(and(eq(crmSavedViews.id, id), eq(crmSavedViews.tenantId, tenantId)))
    .limit(1);

  return updated || null;
}

export async function deleteSavedView(userId: string, tenantId: string, id: string) {
  await db.update(crmSavedViews)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(and(eq(crmSavedViews.id, id), eq(crmSavedViews.userId, userId), eq(crmSavedViews.tenantId, tenantId)));
}
