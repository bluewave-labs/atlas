import { db } from '../../../config/database';
import { driveItems } from '../../../db/schema';
import { eq, and, asc, desc, sql, isNull, inArray, or } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import { unlinkSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { CreateDriveItemInput, UpdateDriveItemInput } from '@atlas-platform/shared';
import { hasSharedAccess } from './sharing.service';
import { UPLOADS_DIR, safeFilePath } from '../lib/safe-path';

function normalizeTags(item: any) {
  if (!item) return item;
  if (typeof item.tags === 'string') {
    try { item.tags = JSON.parse(item.tags); } catch { item.tags = []; }
  }
  if (!Array.isArray(item.tags)) item.tags = [];
  return item;
}

function normalizeAll(items: any[]) {
  return items.map(normalizeTags);
}

export { normalizeTags, normalizeAll };

// ─── List items in a folder ──────────────────────────────────────────

export async function listItems(userId: string, parentId: string | null, includeArchived = false, sortBy?: string, sortOrder?: string, tenantId?: string | null) {
  const foldersFirst = desc(sql`CASE WHEN ${driveItems.type} = 'folder' THEN 0 ELSE 1 END`);
  const dir = sortOrder === 'desc' ? desc : asc;

  let sortClauses;
  switch (sortBy) {
    case 'name':
      sortClauses = [foldersFirst, dir(driveItems.name)];
      break;
    case 'size':
      sortClauses = [foldersFirst, dir(driveItems.size)];
      break;
    case 'date':
      sortClauses = [foldersFirst, dir(driveItems.updatedAt)];
      break;
    case 'type':
      sortClauses = [foldersFirst, dir(driveItems.mimeType), dir(driveItems.name)];
      break;
    default:
      sortClauses = [foldersFirst, asc(driveItems.sortOrder), asc(driveItems.name)];
  }

  // Normal owner query — include team-visible items from same tenant
  const ownerCondition = tenantId
    ? or(eq(driveItems.userId, userId), and(eq(driveItems.visibility, 'team'), eq(driveItems.tenantId, tenantId)))
    : eq(driveItems.userId, userId);
  const conditions = [ownerCondition!];
  if (parentId) {
    conditions.push(eq(driveItems.parentId, parentId));
  } else {
    conditions.push(isNull(driveItems.parentId));
  }
  if (!includeArchived) {
    conditions.push(eq(driveItems.isArchived, false));
  }

  const items = await db
    .select({
      id: driveItems.id, tenantId: driveItems.tenantId, userId: driveItems.userId,
      name: driveItems.name, type: driveItems.type, mimeType: driveItems.mimeType,
      size: driveItems.size, parentId: driveItems.parentId, storagePath: driveItems.storagePath,
      icon: driveItems.icon, linkedResourceType: driveItems.linkedResourceType,
      linkedResourceId: driveItems.linkedResourceId, isFavourite: driveItems.isFavourite,
      isArchived: driveItems.isArchived, tags: driveItems.tags, sortOrder: driveItems.sortOrder,
      createdAt: driveItems.createdAt, updatedAt: driveItems.updatedAt,
      shareCount: sql<number>`COALESCE((SELECT COUNT(*) FROM drive_item_shares WHERE drive_item_id = ${driveItems.id}), 0)`.as('share_count'),
      hasShareLink: sql<boolean>`EXISTS(SELECT 1 FROM drive_share_links WHERE drive_item_id = ${driveItems.id})`.as('has_share_link'),
    })
    .from(driveItems)
    .where(and(...conditions))
    .orderBy(...sortClauses);

  // If parentId specified and no results, check if user has shared access to this folder
  if (parentId && items.length === 0) {
    const access = await hasSharedAccess(userId, parentId);
    if (access.hasAccess) {
      const sharedConditions = [eq(driveItems.parentId, parentId)];
      if (!includeArchived) {
        sharedConditions.push(eq(driveItems.isArchived, false));
      }
      const sharedItems = await db
        .select()
        .from(driveItems)
        .where(and(...sharedConditions))
        .orderBy(...sortClauses);
      return normalizeAll(sharedItems);
    }
  }

  return normalizeAll(items);
}

// ─── Get a single item ──────────────────────────────────────────────

export async function getItem(userId: string, itemId: string, tenantId?: string | null) {
  const ownerCondition = tenantId
    ? or(eq(driveItems.userId, userId), and(eq(driveItems.visibility, 'team'), eq(driveItems.tenantId, tenantId)))
    : eq(driveItems.userId, userId);
  const [item] = await db
    .select()
    .from(driveItems)
    .where(and(eq(driveItems.id, itemId), ownerCondition!))
    .limit(1);

  if (item) return normalizeTags(item);

  // Fallback: check shared access (Feature 5 — folder sharing)
  const access = await hasSharedAccess(userId, itemId);
  if (access.hasAccess) {
    const [sharedItem] = await db
      .select()
      .from(driveItems)
      .where(eq(driveItems.id, itemId))
      .limit(1);
    return normalizeTags(sharedItem) || null;
  }

  return null;
}

// ─── Create a folder ─────────────────────────────────────────────────

export async function createFolder(userId: string, tenantId: string, input: { name: string; parentId?: string | null }) {
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
      name: input.name || 'Untitled folder',
      type: 'folder',
      parentId: input.parentId || null,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, itemId: created.id }, 'Drive folder created');
  return created;
}

// ─── Upload file (create record after multer has saved the file) ─────

export async function uploadFile(userId: string, tenantId: string, input: CreateDriveItemInput) {
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
      name: input.name,
      type: 'file',
      mimeType: input.mimeType || null,
      size: input.size || null,
      parentId: input.parentId || null,
      storagePath: input.storagePath || null,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, itemId: created.id, name: input.name }, 'Drive file uploaded');
  return created;
}

// ─── Update an item (rename, move, favourite, archive) ───────────────

export async function updateItem(userId: string, itemId: string, input: UpdateDriveItemInput, isSharedEdit = false) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) updates.name = input.name;
  if (!isSharedEdit && input.parentId !== undefined) updates.parentId = input.parentId;
  if (!isSharedEdit && input.icon !== undefined) updates.icon = input.icon;
  if (!isSharedEdit && input.isFavourite !== undefined) updates.isFavourite = input.isFavourite;
  if (!isSharedEdit && input.isArchived !== undefined) updates.isArchived = input.isArchived;
  if (input.tags !== undefined) updates.tags = JSON.stringify(input.tags);

  if (isSharedEdit) {
    // Shared edit: update by item id only (user is not the owner)
    await db
      .update(driveItems)
      .set(updates)
      .where(eq(driveItems.id, itemId));

    const [updated] = await db
      .select()
      .from(driveItems)
      .where(eq(driveItems.id, itemId))
      .limit(1);

    return normalizeTags(updated) || null;
  }

  await db
    .update(driveItems)
    .set(updates)
    .where(and(eq(driveItems.id, itemId), eq(driveItems.userId, userId)));

  const [updated] = await db
    .select()
    .from(driveItems)
    .where(and(eq(driveItems.id, itemId), eq(driveItems.userId, userId)))
    .limit(1);

  return normalizeTags(updated) || null;
}

// ─── Soft delete (move to trash) ─────────────────────────────────────

export async function deleteItem(userId: string, itemId: string) {
  // Recursively archive the item and ALL descendants (not just direct children)
  // using a CTE that walks the full subtree in one query.
  await db.execute(sql`
    WITH RECURSIVE subtree AS (
      SELECT id FROM drive_items WHERE id = ${itemId} AND user_id = ${userId}
      UNION ALL
      SELECT di.id FROM drive_items di
      INNER JOIN subtree s ON di.parent_id = s.id AND di.user_id = ${userId}
    )
    UPDATE drive_items
    SET is_archived = true, updated_at = NOW()
    WHERE id IN (SELECT id FROM subtree)
  `);
}

// ─── Restore from trash ──────────────────────────────────────────────

export async function restoreItem(userId: string, itemId: string) {
  // Recursively restore the item and ALL descendants (CTE covers the root + every subtree level)
  await db.execute(sql`
    WITH RECURSIVE subtree AS (
      SELECT id FROM drive_items WHERE id = ${itemId} AND user_id = ${userId}
      UNION ALL
      SELECT di.id FROM drive_items di
      INNER JOIN subtree s ON di.parent_id = s.id AND di.user_id = ${userId}
    )
    UPDATE drive_items
    SET is_archived = false, updated_at = NOW()
    WHERE id IN (SELECT id FROM subtree)
  `);

  const [restored] = await db
    .select()
    .from(driveItems)
    .where(and(eq(driveItems.id, itemId), eq(driveItems.userId, userId)))
    .limit(1);

  return normalizeTags(restored) || null;
}

// ─── Permanent delete + unlink from disk ─────────────────────────────

export async function permanentDelete(userId: string, itemId: string) {
  const item = await getItem(userId, itemId);
  if (!item) return;

  // If it's a file with a storage path, remove from disk
  if (item.type === 'file' && item.storagePath) {
    const filePath = safeFilePath(item.storagePath);
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    } catch (err) {
      logger.warn({ err, filePath }, 'Failed to unlink drive file from disk');
    }
  }

  // If it's a folder, recursively delete children
  if (item.type === 'folder') {
    const children = await db
      .select()
      .from(driveItems)
      .where(and(eq(driveItems.parentId, itemId), eq(driveItems.userId, userId)));

    for (const child of children) {
      await permanentDelete(userId, child.id);
    }
  }

  await db.delete(driveItems).where(and(eq(driveItems.id, itemId), eq(driveItems.userId, userId)));

  logger.info({ userId, itemId }, 'Drive item permanently deleted');
}

// ─── List trash ──────────────────────────────────────────────────────

export async function listTrash(userId: string) {
  const items = await db
    .select()
    .from(driveItems)
    .where(and(eq(driveItems.userId, userId), eq(driveItems.isArchived, true)))
    .orderBy(desc(driveItems.updatedAt));
  return normalizeAll(items);
}

// ─── List favourites ─────────────────────────────────────────────────

export async function listFavourites(userId: string) {
  const items = await db
    .select()
    .from(driveItems)
    .where(and(eq(driveItems.userId, userId), eq(driveItems.isFavourite, true), eq(driveItems.isArchived, false)))
    .orderBy(desc(driveItems.updatedAt));
  return normalizeAll(items);
}

// ─── List recent files ───────────────────────────────────────────────

export async function listRecent(userId: string, limit = 20) {
  const items = await db
    .select()
    .from(driveItems)
    .where(and(eq(driveItems.userId, userId), eq(driveItems.type, 'file'), eq(driveItems.isArchived, false)))
    .orderBy(desc(driveItems.updatedAt))
    .limit(limit);
  return normalizeAll(items);
}

// ─── Search items by name ────────────────────────────────────────────

export async function searchItems(userId: string, query: string) {
  const searchTerm = `%${query}%`;
  const items = await db
    .select()
    .from(driveItems)
    .where(
      and(
        eq(driveItems.userId, userId),
        eq(driveItems.isArchived, false),
        sql`${driveItems.name} LIKE ${searchTerm}`,
      ),
    )
    .orderBy(desc(driveItems.updatedAt))
    .limit(50);
  return normalizeAll(items);
}

// ─── Get breadcrumbs ─────────────────────────────────────────────────

export async function getBreadcrumbs(userId: string, itemId: string) {
  const { driveItemShares } = await import('../../../db/schema');
  const crumbs: Array<{ id: string; name: string }> = [];
  let currentId: string | null = itemId;

  while (currentId) {
    const item = await getItem(userId, currentId);
    if (!item) break;
    crumbs.unshift({ id: item.id, name: item.name });

    // For shared folders, stop at the first directly shared ancestor
    if (item.userId !== userId) {
      const [directShare] = await db.select().from(driveItemShares)
        .where(and(eq(driveItemShares.driveItemId, item.id), eq(driveItemShares.sharedWithUserId, userId)))
        .limit(1);
      if (directShare) break; // Stop here — don't show parent hierarchy above shared item
    }

    currentId = item.parentId;
  }

  return crumbs;
}

// ─── Get storage usage ──────────────────────────────────────────────

export async function getStorageUsage(userId: string) {
  const [result] = await db
    .select({
      total: sql<number>`COALESCE(SUM(${driveItems.size}), 0)`,
      fileCount: sql<number>`COUNT(*)`,
    })
    .from(driveItems)
    .where(and(eq(driveItems.userId, userId), eq(driveItems.type, 'file'), eq(driveItems.isArchived, false)));

  return { totalBytes: result?.total ?? 0, fileCount: result?.fileCount ?? 0 };
}

// ─── Widget summary (lightweight) ──────────────────────────────────

export async function getWidgetData(userId: string) {
  const [result] = await db
    .select({
      fileCount: sql<number>`COUNT(*) FILTER (WHERE ${driveItems.type} = 'file')`.as('file_count'),
      folderCount: sql<number>`COUNT(*) FILTER (WHERE ${driveItems.type} = 'folder')`.as('folder_count'),
      storageUsed: sql<number>`COALESCE(SUM(CASE WHEN ${driveItems.type} = 'file' THEN ${driveItems.size} ELSE 0 END), 0)`.as('storage_used'),
    })
    .from(driveItems)
    .where(and(eq(driveItems.userId, userId), eq(driveItems.isArchived, false)));

  return {
    fileCount: Number(result?.fileCount ?? 0),
    folderCount: Number(result?.folderCount ?? 0),
    storageUsed: Number(result?.storageUsed ?? 0),
  };
}

// ─── Seed sample folder on first visit ───────────────────────────────

export async function seedSampleFolder(_userId: string, _tenantId: string) {
  // No-op — sample data removed
}

// ─── Seed sample data (called from setup wizard) ────────────────────

export async function seedSampleData(userId: string, tenantId: string) {
  // Idempotency guard — skip if folders already exist
  const existing = await db.select({ id: driveItems.id }).from(driveItems)
    .where(and(eq(driveItems.userId, userId), eq(driveItems.type, 'folder')))
    .limit(1);
  if (existing.length > 0) return { skipped: true };

  // Create top-level folders
  const company = await createFolder(userId, tenantId, { name: 'Company' });
  await createFolder(userId, tenantId, { name: 'Projects' });
  await createFolder(userId, tenantId, { name: 'Shared' });

  // Create subfolders inside Company
  await createFolder(userId, tenantId, { name: 'Templates', parentId: company.id });
  await createFolder(userId, tenantId, { name: 'Policies', parentId: company.id });

  logger.info({ userId }, 'Drive sample folders seeded');
  return { seeded: true };
}

// ─── List all folders (for move modal) ───────────────────────────────

export async function listFolders(userId: string) {
  return db
    .select({ id: driveItems.id, name: driveItems.name, parentId: driveItems.parentId })
    .from(driveItems)
    .where(and(eq(driveItems.userId, userId), eq(driveItems.type, 'folder'), eq(driveItems.isArchived, false)))
    .orderBy(asc(driveItems.name));
}

// ─── Duplicate item ──────────────────────────────────────────────────

export async function duplicateItem(userId: string, itemId: string) {
  const item = await getItem(userId, itemId);
  if (!item) return null;

  const now = new Date();
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${driveItems.sortOrder}), -1)` })
    .from(driveItems)
    .where(eq(driveItems.userId, userId));
  const sortOrder = (maxSort?.max ?? -1) + 1;

  let newStoragePath: string | null = null;
  if (item.type === 'file' && item.storagePath) {
    const srcPath = safeFilePath(item.storagePath);
    if (existsSync(srcPath)) {
      const ext = path.extname(item.storagePath);
      const newFilename = `${userId}_${Date.now()}_copy_${crypto.randomUUID()}${ext}`;
      const tenantDir = path.join(UPLOADS_DIR, item.tenantId);
      if (!existsSync(tenantDir)) mkdirSync(tenantDir, { recursive: true });
      newStoragePath = `${item.tenantId}/${newFilename}`;
      copyFileSync(srcPath, safeFilePath(newStoragePath));
    }
  }

  // Add (copy) suffix before extension for files, or at end for folders
  let copyName: string;
  if (item.type === 'file') {
    const extIdx = item.name.lastIndexOf('.');
    if (extIdx > 0) {
      copyName = `${item.name.slice(0, extIdx)} (copy)${item.name.slice(extIdx)}`;
    } else {
      copyName = `${item.name} (copy)`;
    }
  } else {
    copyName = `${item.name} (copy)`;
  }

  const [created] = await db
    .insert(driveItems)
    .values({
      tenantId: item.tenantId,
      userId: item.userId,
      name: copyName,
      type: item.type,
      mimeType: item.mimeType,
      size: item.size,
      parentId: item.parentId,
      storagePath: newStoragePath,
      isFavourite: false,
      tags: item.tags as any,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, itemId: created.id }, 'Drive item duplicated');
  return normalizeTags(created);
}

// ─── Copy item (with recursive folder support) ──────────────────────

export async function copyItem(userId: string, tenantId: string, itemId: string, targetParentId?: string | null): Promise<typeof driveItems.$inferSelect | null> {
  const item = await getItem(userId, itemId);
  if (!item) return null;

  const now = new Date();
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${driveItems.sortOrder}), -1)` })
    .from(driveItems)
    .where(eq(driveItems.userId, userId));
  const sortOrder = (maxSort?.max ?? -1) + 1;

  // Determine parent: use targetParentId if provided, otherwise same parent as original
  const parentId = targetParentId !== undefined ? targetParentId : item.parentId;

  // Add (copy) suffix
  let copyName: string;
  if (item.type === 'file') {
    const extIdx = item.name.lastIndexOf('.');
    if (extIdx > 0) {
      copyName = `${item.name.slice(0, extIdx)} (copy)${item.name.slice(extIdx)}`;
    } else {
      copyName = `${item.name} (copy)`;
    }
  } else {
    copyName = `${item.name} (copy)`;
  }

  let newStoragePath: string | null = null;
  if (item.type === 'file' && item.storagePath) {
    const srcPath = safeFilePath(item.storagePath);
    if (existsSync(srcPath)) {
      const ext = path.extname(item.storagePath);
      const newFilename = `${userId}_${Date.now()}_copy_${crypto.randomUUID()}${ext}`;
      const tenantDir = path.join(UPLOADS_DIR, tenantId);
      if (!existsSync(tenantDir)) mkdirSync(tenantDir, { recursive: true });
      newStoragePath = `${tenantId}/${newFilename}`;
      copyFileSync(srcPath, safeFilePath(newStoragePath));
    }
  }

  const [created] = await db
    .insert(driveItems)
    .values({
      tenantId,
      userId,
      name: copyName,
      type: item.type,
      mimeType: item.mimeType,
      size: item.size,
      parentId: parentId || null,
      storagePath: newStoragePath,
      isFavourite: false,
      tags: item.tags as any,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  // If it's a folder, recursively copy all children into the new folder
  if (item.type === 'folder') {
    const children = await db
      .select()
      .from(driveItems)
      .where(and(eq(driveItems.userId, userId), eq(driveItems.parentId, itemId), eq(driveItems.isArchived, false)));

    for (const child of children) {
      await copyItem(userId, tenantId, child.id, created.id);
    }
  }

  logger.info({ userId, itemId: created.id, originalId: itemId }, 'Drive item copied');
  return normalizeTags(created);
}

// ─── Batch delete (soft) ─────────────────────────────────────────────

export async function batchDelete(userId: string, itemIds: string[]) {
  if (itemIds.length === 0) return;
  const now = new Date();
  await db
    .update(driveItems)
    .set({ isArchived: true, updatedAt: now })
    .where(and(eq(driveItems.userId, userId), inArray(driveItems.id, itemIds)));
}

// ─── Batch move ──────────────────────────────────────────────────────

export async function batchMove(userId: string, itemIds: string[], parentId: string | null) {
  if (itemIds.length === 0) return;
  const now = new Date();
  await db
    .update(driveItems)
    .set({ parentId, updatedAt: now })
    .where(and(eq(driveItems.userId, userId), inArray(driveItems.id, itemIds)));
}

// ─── Batch favourite ─────────────────────────────────────────────────

export async function batchFavourite(userId: string, itemIds: string[], isFavourite: boolean) {
  if (itemIds.length === 0) return;
  const now = new Date();
  await db
    .update(driveItems)
    .set({ isFavourite, updatedAt: now })
    .where(and(eq(driveItems.userId, userId), inArray(driveItems.id, itemIds)));
}

// ─── File type filtering ─────────────────────────────────────────────

export async function listItemsByType(userId: string, typeCategory: string) {
  let mimeCondition: ReturnType<typeof sql>;
  switch (typeCategory) {
    case 'images':
      mimeCondition = sql`${driveItems.mimeType} LIKE 'image/%'`;
      break;
    case 'documents':
      mimeCondition = sql`(${driveItems.mimeType} LIKE 'application/pdf' OR ${driveItems.mimeType} LIKE '%document%' OR ${driveItems.mimeType} LIKE '%word%' OR ${driveItems.mimeType} LIKE 'text/%')`;
      break;
    case 'videos':
      mimeCondition = sql`${driveItems.mimeType} LIKE 'video/%'`;
      break;
    case 'audio':
      mimeCondition = sql`${driveItems.mimeType} LIKE 'audio/%'`;
      break;
    default:
      return [];
  }

  const items = await db
    .select()
    .from(driveItems)
    .where(and(
      eq(driveItems.userId, userId),
      eq(driveItems.type, 'file'),
      eq(driveItems.isArchived, false),
      mimeCondition,
    ))
    .orderBy(desc(driveItems.updatedAt))
    .limit(100);

  return normalizeAll(items);
}

// ─── Get all items in a folder recursively (for ZIP) ─────────────────

export async function getFolderContents(userId: string, folderId: string): Promise<Array<{ item: typeof driveItems.$inferSelect; relativePath: string }>> {
  const results: Array<{ item: typeof driveItems.$inferSelect; relativePath: string }> = [];

  async function walk(parentId: string, prefix: string) {
    const children = await db
      .select()
      .from(driveItems)
      .where(and(eq(driveItems.userId, userId), eq(driveItems.parentId, parentId), eq(driveItems.isArchived, false)));

    for (const child of children) {
      const childPath = prefix ? `${prefix}/${child.name}` : child.name;
      if (child.type === 'file') {
        results.push({ item: child, relativePath: childPath });
      } else {
        await walk(child.id, childPath);
      }
    }
  }

  await walk(folderId, '');
  return results;
}

// ─── Visibility ────────────────────────────────────────────────────

export async function updateDriveItemVisibility(userId: string, itemId: string, visibility: 'private' | 'team') {
  await db.update(driveItems).set({ visibility, updatedAt: new Date() })
    .where(and(eq(driveItems.id, itemId), eq(driveItems.userId, userId)));
}

// ─── Batch trash (soft) ──────────────────────────────────────────────

// batchTrash is semantically identical to batchDelete (both soft-delete by
// setting isArchived=true). It exists as a separate endpoint so the new
// DriveBulkBar Trash action can invalidate queries independently of the
// legacy batch/delete path. Safe to unify in a future cleanup.
export async function batchTrash(userId: string, itemIds: string[]) {
  if (itemIds.length === 0) return { trashed: 0 };
  const result = await db
    .update(driveItems)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(and(
      eq(driveItems.userId, userId),
      inArray(driveItems.id, itemIds),
    ))
    .returning({ id: driveItems.id });
  return { trashed: result.length };
}

// ─── Batch tag (add/remove tags on multiple items) ───────────────────

export async function batchTag(
  userId: string,
  itemIds: string[],
  tags: string[],
  op: 'add' | 'remove',
) {
  if (itemIds.length === 0 || tags.length === 0) return { updated: 0 };
  // TODO: read-modify-write is non-atomic. For scale (thousands of rows, concurrent users),
  // migrate to a single UPDATE using jsonb_set or a dedicated tags table.
  const rows = await db
    .select({ id: driveItems.id, tags: driveItems.tags })
    .from(driveItems)
    .where(and(
      eq(driveItems.userId, userId),
      inArray(driveItems.id, itemIds),
    ));
  let updated = 0;
  for (const row of rows) {
    const current = new Set((row.tags as string[]) ?? []);
    for (const t of tags) {
      if (op === 'add') current.add(t);
      else current.delete(t);
    }
    await db
      .update(driveItems)
      .set({ tags: Array.from(current), updatedAt: new Date() })
      .where(eq(driveItems.id, row.id));
    updated++;
  }
  return { updated };
}

// ─── List uploads (files received via public upload links) ───────────

export async function listUploads(userId: string) {
  const rows = await db
    .select()
    .from(driveItems)
    .where(and(
      eq(driveItems.userId, userId),
      eq(driveItems.isArchived, false),
      sql`${driveItems.uploadSource} IS NOT NULL`,
    ))
    .orderBy(desc(driveItems.createdAt));
  return normalizeAll(rows);
}
