import { db } from '../../../config/database';
import { driveItems } from '../../../db/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import { normalizeTags } from './items.service';

// ─── Create linked resources ─────────────────────────────────────────

export async function createLinkedDocument(userId: string, tenantId: string, parentId?: string | null) {
  const { createDocument } = await import('../../docs/service');
  const doc = await createDocument(userId, tenantId, { title: 'Untitled document' });

  const now = new Date();
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${driveItems.sortOrder}), -1)` })
    .from(driveItems)
    .where(eq(driveItems.userId, userId));
  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(driveItems)
    .values({
      tenantId,
      userId,
      name: 'Untitled document',
      type: 'file',
      mimeType: 'application/vnd.atlasmail.document',
      parentId: parentId || null,
      linkedResourceType: 'document',
      linkedResourceId: doc.id,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, itemId: created.id, resourceId: doc.id }, 'Linked document created in Drive');
  return { driveItem: normalizeTags(created), resourceId: doc.id };
}

export async function createLinkedDrawing(userId: string, tenantId: string, parentId?: string | null) {
  const { createDrawing } = await import('../../draw/service');
  const drawing = await createDrawing(userId, tenantId, { title: 'Untitled drawing' });

  const now = new Date();
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${driveItems.sortOrder}), -1)` })
    .from(driveItems)
    .where(eq(driveItems.userId, userId));
  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(driveItems)
    .values({
      tenantId,
      userId,
      name: 'Untitled drawing',
      type: 'file',
      mimeType: 'application/vnd.atlasmail.drawing',
      parentId: parentId || null,
      linkedResourceType: 'drawing',
      linkedResourceId: drawing.id,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, itemId: created.id, resourceId: drawing.id }, 'Linked drawing created in Drive');
  return { driveItem: normalizeTags(created), resourceId: drawing.id };
}

export async function createLinkedSpreadsheet(userId: string, tenantId: string, parentId?: string | null) {
  const { createSpreadsheet } = await import('../../tables/service');
  const spreadsheet = await createSpreadsheet(userId, tenantId, { title: 'Untitled spreadsheet' });

  const now = new Date();
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${driveItems.sortOrder}), -1)` })
    .from(driveItems)
    .where(eq(driveItems.userId, userId));
  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(driveItems)
    .values({
      tenantId,
      userId,
      name: 'Untitled spreadsheet',
      type: 'file',
      mimeType: 'application/vnd.atlasmail.spreadsheet',
      parentId: parentId || null,
      linkedResourceType: 'spreadsheet',
      linkedResourceId: spreadsheet.id,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, itemId: created.id, resourceId: spreadsheet.id }, 'Linked spreadsheet created in Drive');
  return { driveItem: normalizeTags(created), resourceId: spreadsheet.id };
}
