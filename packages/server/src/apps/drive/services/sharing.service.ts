import { db } from '../../../config/database';
import { driveItems, driveShareLinks, driveItemShares } from '../../../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import crypto from 'node:crypto';
import { hashPassword, verifyPassword } from '../../../utils/password';

// ─── Link sharing ────────────────────────────────────────────────────

export async function createShareLink(
  userId: string,
  itemId: string,
  expiresAt?: string | null,
  password?: string | null,
  options: {
    mode?: 'view' | 'edit' | 'upload_only';
    uploadInstructions?: string | null;
    requireUploaderEmail?: boolean;
  } = {},
) {
  const { getItem } = await import('./items.service');
  const item = await getItem(userId, itemId);
  if (!item) return null;

  const mode = options.mode ?? 'view';
  if (mode === 'upload_only' && item.type !== 'folder') {
    throw new Error('Upload-only links require a folder');
  }

  const shareToken = crypto.randomUUID();
  const passwordHashValue = password ? await hashPassword(password) : null;
  const [link] = await db
    .insert(driveShareLinks)
    .values({
      driveItemId: itemId,
      userId,
      shareToken,
      passwordHash: passwordHashValue,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      mode,
      uploadInstructions: options.uploadInstructions ?? null,
      requireUploaderEmail: options.requireUploaderEmail ?? true,
      createdAt: new Date(),
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
  const { normalizeTags } = await import('./items.service');
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

  const normalizedItem = normalizeTags(item);
  if (!normalizedItem) return null;

  return {
    ...normalizedItem,
    hasPassword: !!link.passwordHash,
  };
}

export async function verifyShareLinkPassword(token: string, password: string): Promise<boolean> {
  const [link] = await db
    .select()
    .from(driveShareLinks)
    .where(eq(driveShareLinks.shareToken, token))
    .limit(1);

  if (!link || !link.passwordHash) return false;
  return verifyPassword(password, link.passwordHash);
}

export async function getShareLinkByToken(token: string) {
  const [link] = await db
    .select()
    .from(driveShareLinks)
    .where(eq(driveShareLinks.shareToken, token))
    .limit(1);
  return link || null;
}

// ─── Per-user sharing ───────────────────────────────────────────────

export async function shareItem(driveItemId: string, sharedWithUserId: string, permission: string, sharedByUserId: string) {
  const [share] = await db.insert(driveItemShares).values({
    driveItemId, sharedWithUserId, permission, sharedByUserId,
  }).onConflictDoUpdate({
    target: [driveItemShares.driveItemId, driveItemShares.sharedWithUserId],
    set: { permission },
  }).returning();
  return share;
}

export async function listItemShares(driveItemId: string) {
  return db.select().from(driveItemShares)
    .where(eq(driveItemShares.driveItemId, driveItemId));
}

export async function revokeShare(driveItemId: string, sharedWithUserId: string) {
  await db.delete(driveItemShares)
    .where(and(
      eq(driveItemShares.driveItemId, driveItemId),
      eq(driveItemShares.sharedWithUserId, sharedWithUserId),
    ));
}

export async function listSharedWithMe(userId: string, _tenantId: string) {
  const shares = await db.select({
    share: driveItemShares,
    item: driveItems,
  }).from(driveItemShares)
    .innerJoin(driveItems, eq(driveItems.id, driveItemShares.driveItemId))
    .where(and(
      eq(driveItemShares.sharedWithUserId, userId),
      eq(driveItems.isArchived, false),
    ));
  return shares.map(s => ({ ...s.item, sharePermission: s.share.permission, sharedBy: s.share.sharedByUserId }));
}

// ─── Check share permission for a user on an item ───────────────────

export async function checkSharePermission(userId: string, itemId: string): Promise<'view' | 'edit' | null> {
  const [share] = await db.select().from(driveItemShares)
    .where(and(
      eq(driveItemShares.driveItemId, itemId),
      eq(driveItemShares.sharedWithUserId, userId),
    ))
    .limit(1);
  if (share) return share.permission as 'view' | 'edit';

  // Also check ancestor shares (recursive)
  const access = await hasSharedAccess(userId, itemId);
  return access.permission as 'view' | 'edit' | null;
}

// ─── Recursive shared access check (Feature 5) ─────────────────────

export async function hasSharedAccess(userId: string, itemId: string): Promise<{ hasAccess: boolean; permission: string | null }> {
  try {
    const result = await db.execute(sql`
      WITH RECURSIVE ancestors AS (
        SELECT id, parent_id, 0 as depth FROM drive_items WHERE id = ${itemId}
        UNION ALL
        SELECT di.id, di.parent_id, a.depth + 1 FROM drive_items di
        JOIN ancestors a ON di.id = a.parent_id
        WHERE a.depth < 10
      )
      SELECT dis.permission FROM drive_item_shares dis
      JOIN ancestors a ON dis.drive_item_id = a.id
      WHERE dis.shared_with_user_id = ${userId}
      LIMIT 1
    `);
    const rows = result.rows as Array<{ permission: string }>;
    if (rows.length > 0) {
      return { hasAccess: true, permission: rows[0].permission };
    }
    return { hasAccess: false, permission: null };
  } catch (err) {
    logger.error({ err, userId, itemId }, 'Failed to check shared access');
    return { hasAccess: false, permission: null };
  }
}
