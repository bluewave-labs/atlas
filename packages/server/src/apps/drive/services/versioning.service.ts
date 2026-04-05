import { db } from '../../../config/database';
import { driveItems, driveItemVersions } from '../../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import { getItem, normalizeTags } from './items.service';

// ─── File versioning ─────────────────────────────────────────────────

export async function createVersion(userId: string, accountId: string, itemId: string) {
  const item = await getItem(userId, itemId);
  if (!item || item.type !== 'file') return null;

  const [version] = await db
    .insert(driveItemVersions)
    .values({
      driveItemId: item.id,
      accountId,
      userId,
      name: item.name,
      mimeType: item.mimeType,
      size: item.size,
      storagePath: item.storagePath,
      createdAt: new Date(),
    })
    .returning();

  logger.info({ userId, itemId, versionId: version.id }, 'Drive file version created');
  return version;
}

export async function listVersions(userId: string, itemId: string) {
  return db
    .select()
    .from(driveItemVersions)
    .where(and(eq(driveItemVersions.driveItemId, itemId), eq(driveItemVersions.userId, userId)))
    .orderBy(desc(driveItemVersions.createdAt))
    .limit(20);
}

export async function restoreVersion(userId: string, accountId: string, itemId: string, versionId: string) {
  const item = await getItem(userId, itemId);
  if (!item || item.type !== 'file') return null;

  const [version] = await db
    .select()
    .from(driveItemVersions)
    .where(and(eq(driveItemVersions.id, versionId), eq(driveItemVersions.userId, userId)))
    .limit(1);

  if (!version) return null;

  // Snapshot current file as a new version before restoring
  await createVersion(userId, accountId, itemId);

  // Overwrite main record with version data
  const now = new Date();
  await db
    .update(driveItems)
    .set({
      name: version.name,
      mimeType: version.mimeType,
      size: version.size,
      storagePath: version.storagePath,
      updatedAt: now,
    })
    .where(and(eq(driveItems.id, itemId), eq(driveItems.userId, userId)));

  const [restored] = await db
    .select()
    .from(driveItems)
    .where(and(eq(driveItems.id, itemId), eq(driveItems.userId, userId)))
    .limit(1);

  logger.info({ userId, itemId, versionId }, 'Drive file version restored');
  return normalizeTags(restored) || null;
}

export async function getVersion(userId: string, versionId: string) {
  const [version] = await db
    .select()
    .from(driveItemVersions)
    .where(and(eq(driveItemVersions.id, versionId), eq(driveItemVersions.userId, userId)))
    .limit(1);
  return version || null;
}
