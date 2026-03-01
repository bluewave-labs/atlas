import { db } from '../config/database';
import { driveItems, driveItemVersions, driveShareLinks } from '../db/schema';
import { eq, and, asc, desc, sql, isNull, inArray } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { unlinkSync, existsSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { CreateDriveItemInput, UpdateDriveItemInput } from '@atlasmail/shared';

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

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

// ─── List items in a folder ──────────────────────────────────────────

export async function listItems(userId: string, parentId: string | null, includeArchived = false, sortBy?: string, sortOrder?: string) {
  const conditions = [eq(driveItems.userId, userId)];

  if (parentId) {
    conditions.push(eq(driveItems.parentId, parentId));
  } else {
    conditions.push(isNull(driveItems.parentId));
  }

  if (!includeArchived) {
    conditions.push(eq(driveItems.isArchived, false));
  }

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

  const items = await db
    .select()
    .from(driveItems)
    .where(and(...conditions))
    .orderBy(...sortClauses);
  return normalizeAll(items);
}

// ─── Get a single item ──────────────────────────────────────────────

export async function getItem(userId: string, itemId: string) {
  const [item] = await db
    .select()
    .from(driveItems)
    .where(and(eq(driveItems.id, itemId), eq(driveItems.userId, userId)))
    .limit(1);

  return normalizeTags(item) || null;
}

// ─── Create a folder ─────────────────────────────────────────────────

export async function createFolder(userId: string, accountId: string, input: { name: string; parentId?: string | null }) {
  const now = new Date().toISOString();

  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${driveItems.sortOrder}), -1)` })
    .from(driveItems)
    .where(eq(driveItems.userId, userId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(driveItems)
    .values({
      accountId,
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

export async function uploadFile(userId: string, accountId: string, input: CreateDriveItemInput) {
  const now = new Date().toISOString();

  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${driveItems.sortOrder}), -1)` })
    .from(driveItems)
    .where(eq(driveItems.userId, userId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(driveItems)
    .values({
      accountId,
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

export async function updateItem(userId: string, itemId: string, input: UpdateDriveItemInput) {
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.name !== undefined) updates.name = input.name;
  if (input.parentId !== undefined) updates.parentId = input.parentId;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.isFavourite !== undefined) updates.isFavourite = input.isFavourite;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;
  if (input.tags !== undefined) updates.tags = JSON.stringify(input.tags);

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
  await updateItem(userId, itemId, { isArchived: true });
}

// ─── Restore from trash ──────────────────────────────────────────────

export async function restoreItem(userId: string, itemId: string) {
  const now = new Date().toISOString();

  await db
    .update(driveItems)
    .set({ isArchived: false, updatedAt: now })
    .where(and(eq(driveItems.id, itemId), eq(driveItems.userId, userId)));

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
    const filePath = path.join(UPLOADS_DIR, item.storagePath);
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
  const crumbs: Array<{ id: string; name: string }> = [];
  let currentId: string | null = itemId;

  while (currentId) {
    const item = await getItem(userId, currentId);
    if (!item) break;
    crumbs.unshift({ id: item.id, name: item.name });
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

// ─── Seed sample folder on first visit ───────────────────────────────

export async function seedSampleFolder(userId: string, accountId: string) {
  // Check if seed data already exists by looking for a known sample folder name
  const existing = await db
    .select({ id: driveItems.id })
    .from(driveItems)
    .where(and(eq(driveItems.userId, userId), eq(driveItems.name, 'Work'), eq(driveItems.type, 'folder')))
    .limit(1);

  if (existing.length > 0) return;

  const now = new Date().toISOString();
  const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
  let sort = 0;

  // Helper to create a folder
  const mkFolder = async (name: string, parentId?: string | null, icon?: string) => {
    const [f] = await db.insert(driveItems).values({
      accountId, userId, name, type: 'folder', parentId: parentId || null,
      icon: icon || null, sortOrder: sort++, createdAt: ago(14), updatedAt: ago(1),
    }).returning();
    return f;
  };

  // Helper to create a file (no actual storage, just metadata for demo)
  const mkFile = async (name: string, mime: string, size: number, parentId?: string | null, opts?: { icon?: string; favourite?: boolean; created?: string; updated?: string }) => {
    await db.insert(driveItems).values({
      accountId, userId, name, type: 'file', mimeType: mime, size,
      parentId: parentId || null, icon: opts?.icon || null,
      isFavourite: opts?.favourite ? true : false,
      sortOrder: sort++,
      createdAt: opts?.created || ago(7), updatedAt: opts?.updated || ago(1),
    });
  };

  // ─── Root folders ────────────────────────────────────────────────
  const work = await mkFolder('Work', null, '💼');
  const personal = await mkFolder('Personal', null, '🏠');
  const projects = await mkFolder('Projects', null, '🚀');
  const archive = await mkFolder('Archive', null, '📦');
  const photos = await mkFolder('Photos', null, '📷');

  // ─── Work subfolders & files ─────────────────────────────────────
  const meetings = await mkFolder('Meeting notes', work.id);
  const reports = await mkFolder('Reports', work.id);
  const presentations = await mkFolder('Presentations', work.id);

  await mkFile('Q4 planning notes.md', 'text/markdown', 4200, meetings.id, { created: ago(5), updated: ago(2) });
  await mkFile('Weekly standup — Feb 24.md', 'text/markdown', 1800, meetings.id, { created: ago(4), updated: ago(4) });
  await mkFile('Client call summary.md', 'text/markdown', 2400, meetings.id, { created: ago(2), updated: ago(1) });
  await mkFile('Annual review 2025.pdf', 'application/pdf', 245000, reports.id, { favourite: true, created: ago(30), updated: ago(10) });
  await mkFile('Budget forecast.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 89000, reports.id, { created: ago(20), updated: ago(5) });
  await mkFile('Team metrics dashboard.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 67000, reports.id, { created: ago(12), updated: ago(3) });
  await mkFile('Product roadmap 2026.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 3200000, presentations.id, { favourite: true, created: ago(15), updated: ago(2) });
  await mkFile('Company overview.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 5400000, presentations.id, { created: ago(45), updated: ago(20) });

  // ─── Personal files ──────────────────────────────────────────────
  await mkFile('Reading list.md', 'text/markdown', 1200, personal.id, { created: ago(60), updated: ago(3) });
  await mkFile('Apartment lease.pdf', 'application/pdf', 180000, personal.id, { created: ago(90), updated: ago(90) });
  await mkFile('Tax documents 2025.pdf', 'application/pdf', 320000, personal.id, { favourite: true, created: ago(40), updated: ago(30) });
  await mkFile('Recipes.md', 'text/markdown', 3400, personal.id, { created: ago(100), updated: ago(8) });

  // ─── Projects subfolders & files ─────────────────────────────────
  const atlas = await mkFolder('Atlas redesign', projects.id, '🎨');
  const api = await mkFolder('API migration', projects.id, '⚡');

  await mkFile('Design system tokens.json', 'application/json', 12000, atlas.id, { created: ago(10), updated: ago(2) });
  await mkFile('Component inventory.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 45000, atlas.id, { created: ago(8), updated: ago(1) });
  await mkFile('Wireframes v2.fig', 'application/octet-stream', 890000, atlas.id, { created: ago(6), updated: ago(1) });
  await mkFile('Color palette.png', 'image/png', 156000, atlas.id, { created: ago(5), updated: ago(5) });
  await mkFile('Migration checklist.md', 'text/markdown', 2800, api.id, { created: ago(14), updated: ago(3) });
  await mkFile('Endpoint mapping.csv', 'text/csv', 8900, api.id, { created: ago(12), updated: ago(6) });
  await mkFile('Load test results.pdf', 'application/pdf', 410000, api.id, { created: ago(4), updated: ago(2) });

  // ─── Photos ──────────────────────────────────────────────────────
  const vacation = await mkFolder('Vacation 2025', photos.id);
  await mkFile('Beach sunset.jpg', 'image/jpeg', 4200000, vacation.id, { created: ago(50), updated: ago(50) });
  await mkFile('Mountain hike.jpg', 'image/jpeg', 3800000, vacation.id, { created: ago(49), updated: ago(49) });
  await mkFile('Group photo.jpg', 'image/jpeg', 5100000, vacation.id, { created: ago(48), updated: ago(48) });
  await mkFile('Team offsite.jpg', 'image/jpeg', 2900000, photos.id, { created: ago(20), updated: ago(20) });
  await mkFile('Profile photo.png', 'image/png', 1200000, photos.id, { favourite: true, created: ago(60), updated: ago(15) });

  // ─── Archive files ───────────────────────────────────────────────
  await mkFile('Old project brief.pdf', 'application/pdf', 98000, archive.id, { created: ago(180), updated: ago(120) });
  await mkFile('2024 invoices.zip', 'application/zip', 12400000, archive.id, { created: ago(365), updated: ago(365) });
  await mkFile('Legacy database export.sql', 'application/sql', 2300000, archive.id, { created: ago(200), updated: ago(200) });

  // ─── Root-level files ────────────────────────────────────────────
  await mkFile('Resume — latest.pdf', 'application/pdf', 156000, null, { favourite: true, created: ago(30), updated: ago(5) });
  await mkFile('Quick notes.md', 'text/markdown', 890, null, { created: ago(1), updated: ago(0) });
  await mkFile('Project ideas.md', 'text/markdown', 2100, null, { created: ago(15), updated: ago(2) });

  logger.info({ userId }, 'Seeded sample drive folders and files');
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

  const now = new Date().toISOString();
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${driveItems.sortOrder}), -1)` })
    .from(driveItems)
    .where(eq(driveItems.userId, userId));
  const sortOrder = (maxSort?.max ?? -1) + 1;

  let newStoragePath: string | null = null;
  if (item.type === 'file' && item.storagePath) {
    const srcPath = path.join(UPLOADS_DIR, item.storagePath);
    if (existsSync(srcPath)) {
      const ext = path.extname(item.storagePath);
      const newFilename = `${userId}_${Date.now()}_copy_${crypto.randomUUID()}${ext}`;
      newStoragePath = newFilename;
      copyFileSync(srcPath, path.join(UPLOADS_DIR, newFilename));
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
      accountId: item.accountId,
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

// ─── Batch delete (soft) ─────────────────────────────────────────────

export async function batchDelete(userId: string, itemIds: string[]) {
  if (itemIds.length === 0) return;
  const now = new Date().toISOString();
  await db
    .update(driveItems)
    .set({ isArchived: true, updatedAt: now })
    .where(and(eq(driveItems.userId, userId), inArray(driveItems.id, itemIds)));
}

// ─── Batch move ──────────────────────────────────────────────────────

export async function batchMove(userId: string, itemIds: string[], parentId: string | null) {
  if (itemIds.length === 0) return;
  const now = new Date().toISOString();
  await db
    .update(driveItems)
    .set({ parentId, updatedAt: now })
    .where(and(eq(driveItems.userId, userId), inArray(driveItems.id, itemIds)));
}

// ─── Batch favourite ─────────────────────────────────────────────────

export async function batchFavourite(userId: string, itemIds: string[], isFavourite: boolean) {
  if (itemIds.length === 0) return;
  const now = new Date().toISOString();
  await db
    .update(driveItems)
    .set({ isFavourite, updatedAt: now })
    .where(and(eq(driveItems.userId, userId), inArray(driveItems.id, itemIds)));
}

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
      createdAt: new Date().toISOString(),
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
  const now = new Date().toISOString();
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

// ─── Link sharing ────────────────────────────────────────────────────

export async function createShareLink(userId: string, itemId: string, expiresAt?: string | null) {
  const item = await getItem(userId, itemId);
  if (!item) return null;

  const shareToken = crypto.randomUUID();
  const [link] = await db
    .insert(driveShareLinks)
    .values({
      driveItemId: itemId,
      userId,
      shareToken,
      expiresAt: expiresAt || null,
      createdAt: new Date().toISOString(),
    })
    .returning();

  logger.info({ userId, itemId, linkId: link.id }, 'Share link created');
  return link;
}

export async function getShareLinks(userId: string, itemId: string) {
  return db
    .select()
    .from(driveShareLinks)
    .where(and(eq(driveShareLinks.driveItemId, itemId), eq(driveShareLinks.userId, userId)))
    .orderBy(desc(driveShareLinks.createdAt));
}

export async function deleteShareLink(userId: string, linkId: string) {
  await db
    .delete(driveShareLinks)
    .where(and(eq(driveShareLinks.id, linkId), eq(driveShareLinks.userId, userId)));
}

export async function getItemByShareToken(token: string) {
  const [link] = await db
    .select()
    .from(driveShareLinks)
    .where(eq(driveShareLinks.shareToken, token))
    .limit(1);

  if (!link) return null;

  // Check expiry
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) return null;

  const [item] = await db
    .select()
    .from(driveItems)
    .where(eq(driveItems.id, link.driveItemId))
    .limit(1);

  return normalizeTags(item) || null;
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

// ─── Create linked resources ─────────────────────────────────────────

export async function createLinkedDocument(userId: string, accountId: string, parentId?: string | null) {
  const { createDocument } = await import('./document.service');
  const doc = await createDocument(userId, accountId, { title: 'Untitled document' });

  const now = new Date().toISOString();
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${driveItems.sortOrder}), -1)` })
    .from(driveItems)
    .where(eq(driveItems.userId, userId));
  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(driveItems)
    .values({
      accountId,
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

export async function createLinkedDrawing(userId: string, accountId: string, parentId?: string | null) {
  const { createDrawing } = await import('./drawing.service');
  const drawing = await createDrawing(userId, accountId, { title: 'Untitled drawing' });

  const now = new Date().toISOString();
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${driveItems.sortOrder}), -1)` })
    .from(driveItems)
    .where(eq(driveItems.userId, userId));
  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(driveItems)
    .values({
      accountId,
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

export async function createLinkedSpreadsheet(userId: string, accountId: string, parentId?: string | null) {
  const { createSpreadsheet } = await import('./table.service');
  const spreadsheet = await createSpreadsheet(userId, accountId, { title: 'Untitled spreadsheet' });

  const now = new Date().toISOString();
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${driveItems.sortOrder}), -1)` })
    .from(driveItems)
    .where(eq(driveItems.userId, userId));
  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(driveItems)
    .values({
      accountId,
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
