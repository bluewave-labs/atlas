import { db } from '../../../config/database';
import { driveItems, driveItemVersions, userSettings } from '../../../db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import { unlinkSync, existsSync } from 'node:fs';
import { safeFilePath } from '../lib/safe-path';
import { getItem, normalizeTags } from './items.service';

// ─── File versioning ─────────────────────────────────────────────────

/**
 * Fetch the user's driveMaxVersions setting. Falls back to 20 if not found.
 * accountId is used for the settings lookup (same key as req.auth.accountId).
 */
async function getMaxVersions(accountId: string): Promise<number> {
  try {
    const [row] = await db
      .select({ driveMaxVersions: userSettings.driveMaxVersions })
      .from(userSettings)
      .where(eq(userSettings.accountId, accountId))
      .limit(1);
    return row?.driveMaxVersions ?? 20;
  } catch {
    return 20;
  }
}

/**
 * Delete version rows beyond the retention limit, also removing their disk files.
 * accountId is the owner's account ID used to look up the driveMaxVersions setting.
 */
async function pruneOldVersions(userId: string, itemId: string, accountId: string): Promise<void> {
  const maxVersions = await getMaxVersions(accountId);
  if (maxVersions <= 0) return; // 0 means "keep none" — prune all

  // Fetch all versions oldest-first so we can delete the excess from the front
  const allVersions = await db
    .select()
    .from(driveItemVersions)
    .where(and(eq(driveItemVersions.driveItemId, itemId), eq(driveItemVersions.userId, userId)))
    .orderBy(asc(driveItemVersions.createdAt));

  const toDelete = allVersions.slice(0, Math.max(0, allVersions.length - maxVersions));
  if (toDelete.length === 0) return;

  for (const v of toDelete) {
    // Remove disk file before deleting the DB row
    if (v.storagePath) {
      try {
        const diskPath = safeFilePath(v.storagePath);
        if (existsSync(diskPath)) {
          unlinkSync(diskPath);
        }
      } catch (err) {
        logger.warn({ err, storagePath: v.storagePath }, 'Failed to unlink old version file from disk');
      }
    }
    await db.delete(driveItemVersions).where(eq(driveItemVersions.id, v.id));
  }

  logger.info({ userId, itemId, pruned: toDelete.length }, 'Pruned old drive file versions');
}

export async function createVersion(userId: string, tenantId: string, itemId: string, accountId?: string) {
  const item = await getItem(userId, itemId);
  if (!item || item.type !== 'file') return null;

  const [version] = await db
    .insert(driveItemVersions)
    .values({
      driveItemId: item.id,
      tenantId,
      userId,
      name: item.name,
      mimeType: item.mimeType,
      size: item.size,
      storagePath: item.storagePath,
      createdAt: new Date(),
    })
    .returning();

  logger.info({ userId, itemId, versionId: version.id }, 'Drive file version created');

  // Prune versions beyond the user's retention limit (fire-and-forget if no accountId)
  if (accountId) {
    pruneOldVersions(userId, itemId, accountId).catch((err) =>
      logger.warn({ err, itemId }, 'Failed to prune old drive versions'),
    );
  }

  return version;
}

export async function listVersions(userId: string, itemId: string, accountId?: string) {
  // Use the user's driveMaxVersions setting as the list cap; fall back to 20
  const limit = accountId ? await getMaxVersions(accountId) : 20;
  return db
    .select()
    .from(driveItemVersions)
    .where(and(eq(driveItemVersions.driveItemId, itemId), eq(driveItemVersions.userId, userId)))
    .orderBy(desc(driveItemVersions.createdAt))
    .limit(Math.max(1, limit));
}

export async function restoreVersion(userId: string, tenantId: string, itemId: string, versionId: string) {
  const item = await getItem(userId, itemId);
  if (!item || item.type !== 'file') return null;

  const [version] = await db
    .select()
    .from(driveItemVersions)
    .where(and(eq(driveItemVersions.id, versionId), eq(driveItemVersions.userId, userId)))
    .limit(1);

  if (!version) return null;

  // Snapshot current file as a new version before restoring
  await createVersion(userId, tenantId, itemId);

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
