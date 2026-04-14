import type { Request, Response } from 'express';
import * as driveService from '../service';
import { logger } from '../../../utils/logger';
import { emitAppEvent } from '../../../services/event.service';
import { canAccess } from '../../../services/app-permissions.service';
import { parseMentionsAndNotify } from '../../../utils/mentions';

// GET /api/drive/:id/versions
export async function listVersions(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const itemId = req.params.id as string;

    const versions = await driveService.listVersions(userId, itemId);
    res.json({ success: true, data: { versions } });
  } catch (error) {
    logger.error({ error }, 'Failed to list versions');
    res.status(500).json({ success: false, error: 'Failed to list versions' });
  }
}

// POST /api/drive/:id/replace — upload new version
export async function replaceFile(req: Request, res: Response) {
  try {
    const perm = req.drivePerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update in drive' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const itemId = req.params.id as string;
    const file = req.file as Express.Multer.File;

    if (!file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    const item = await driveService.getItem(userId, itemId);
    if (!item || item.type !== 'file') {
      res.status(404).json({ success: false, error: 'File not found' });
      return;
    }

    // Snapshot current file as a version
    await driveService.createVersion(userId, tenantId, itemId);

    // Update main record with new file data
    const now = new Date();
    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    await driveService.updateItem(userId, itemId, { name: decodedName });

    // Also update mimeType, size, storagePath via raw update
    const { db: database } = await import('../../../config/database');
    const { driveItems: driveItemsTable } = await import('../../../db/schema');
    const { eq, and } = await import('drizzle-orm');
    await database
      .update(driveItemsTable)
      .set({
        mimeType: file.mimetype,
        size: file.size,
        storagePath: `${tenantId}/${file.filename}`,
        updatedAt: now,
      })
      .where(and(eq(driveItemsTable.id, itemId), eq(driveItemsTable.userId, userId)));

    const updated = await driveService.getItem(userId, itemId);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error({ error }, 'Failed to replace file');
    res.status(500).json({ success: false, error: 'Failed to replace file' });
  }
}

// POST /api/drive/:id/versions/:versionId/restore
export async function restoreVersion(req: Request, res: Response) {
  try {
    const perm = req.drivePerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update in drive' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const itemId = req.params.id as string;
    const versionId = req.params.versionId as string;

    const item = await driveService.restoreVersion(userId, tenantId, itemId, versionId);
    if (!item) {
      res.status(404).json({ success: false, error: 'Version not found' });
      return;
    }

    res.json({ success: true, data: item });
  } catch (error) {
    logger.error({ error }, 'Failed to restore version');
    res.status(500).json({ success: false, error: 'Failed to restore version' });
  }
}

// GET /api/drive/:id/versions/:versionId/download
export async function downloadVersion(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const versionId = req.params.versionId as string;

    const version = await driveService.getVersion(userId, versionId);
    if (!version || !version.storagePath) {
      res.status(404).json({ success: false, error: 'Version not found' });
      return;
    }

    const path = require('node:path');
    const { existsSync, createReadStream, statSync } = require('node:fs');
    const UPLOADS_DIR = path.join(__dirname, '../../../../uploads');

    const filePath = path.join(UPLOADS_DIR, version.storagePath);
    if (!existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'Version file not found on disk' });
      return;
    }

    const stat = statSync(filePath);
    const mimeType = version.mimeType || 'application/octet-stream';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(version.name)}"`);

    createReadStream(filePath).pipe(res);
  } catch (error) {
    logger.error({ error }, 'Failed to download version');
    res.status(500).json({ success: false, error: 'Failed to download version' });
  }
}

// POST /api/drive/:id/share — create share link
export async function createShareLink(req: Request, res: Response) {
  try {
    const perm = req.drivePerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update in drive' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const itemId = req.params.id as string;
    const { expiresAt, password, mode, uploadInstructions, requireUploaderEmail } = req.body as {
      expiresAt?: string;
      password?: string;
      mode?: 'view' | 'edit' | 'upload_only';
      uploadInstructions?: string | null;
      requireUploaderEmail?: boolean;
    };

    const link = await driveService.createShareLink(userId, itemId, expiresAt, password, {
      mode, uploadInstructions, requireUploaderEmail,
    });
    if (!link) {
      res.status(404).json({ success: false, error: 'Item not found' });
      return;
    }

    if (tenantId) {
      const item = await driveService.getItem(userId, itemId);
      emitAppEvent({
        tenantId,
        userId,
        appId: 'drive',
        eventType: 'file.shared',
        title: `shared ${item?.name ?? 'a file'}`,
        metadata: { itemId, linkId: link.id },
      }).catch((err) => logger.warn({ err }, 'Drive activity log failed'));
    }

    driveService.logDriveActivity({ driveItemId: itemId, tenantId, userId, action: 'share_link.created' }).catch((err) => logger.warn({ err }, 'Drive activity log failed'));
    res.json({ success: true, data: link });
  } catch (error) {
    if (error instanceof Error && error.message === 'Upload-only links require a folder') {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    logger.error({ error }, 'Failed to create share link');
    res.status(500).json({ success: false, error: 'Failed to create share link' });
  }
}

// GET /api/drive/:id/share — list share links
export async function listShareLinks(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const itemId = req.params.id as string;

    const links = await driveService.getShareLinks(userId, itemId);
    res.json({ success: true, data: { links } });
  } catch (error) {
    logger.error({ error }, 'Failed to list share links');
    res.status(500).json({ success: false, error: 'Failed to list share links' });
  }
}

// DELETE /api/drive/share/:linkId
export async function deleteShareLink(req: Request, res: Response) {
  try {
    const perm = req.drivePerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update in drive' });
      return;
    }

    const userId = req.auth!.userId;
    const linkId = req.params.linkId as string;

    await driveService.deleteShareLink(userId, linkId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete share link');
    res.status(500).json({ success: false, error: 'Failed to delete share link' });
  }
}

// POST /api/drive/:id/shares — share item with a user
export async function shareWithUser(req: Request, res: Response) {
  try {
    const perm = req.drivePerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update in drive' });
      return;
    }

    const userId = req.auth!.userId;
    const itemId = req.params.id as string;
    const { userId: targetUserId, permission } = req.body as { userId?: string; permission?: string };
    if (!targetUserId) {
      res.status(400).json({ success: false, error: 'userId is required' });
      return;
    }
    const share = await driveService.shareItem(itemId, targetUserId, permission || 'view', userId);
    driveService.logDriveActivity({ driveItemId: itemId, tenantId: req.auth!.tenantId, userId, action: 'file.shared', metadata: { sharedWith: targetUserId, permission: permission || 'view' } }).catch((err) => logger.warn({ err }, 'Drive activity log failed'));
    res.json({ success: true, data: share });
  } catch (error) {
    logger.error({ error }, 'Failed to share item');
    res.status(500).json({ success: false, error: 'Failed to share item' });
  }
}

// GET /api/drive/:id/shares — list shares for an item
export async function listShares(req: Request, res: Response) {
  try {
    const itemId = req.params.id as string;
    const shares = await driveService.listItemShares(itemId);
    res.json({ success: true, data: shares });
  } catch (error) {
    logger.error({ error }, 'Failed to list shares');
    res.status(500).json({ success: false, error: 'Failed to list shares' });
  }
}

// DELETE /api/drive/:id/shares/:userId — revoke share
export async function revokeShare(req: Request, res: Response) {
  try {
    const perm = req.drivePerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update in drive' });
      return;
    }

    const itemId = req.params.id as string;
    const targetUserId = req.params.userId as string;
    await driveService.revokeShare(itemId, targetUserId);
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to revoke share');
    res.status(500).json({ success: false, error: 'Failed to revoke share' });
  }
}

// GET /api/drive/shared-with-me — list items shared with current user
export async function getSharedWithMe(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const items = await driveService.listSharedWithMe(userId, tenantId);
    res.json({ success: true, data: items });
  } catch (error) {
    logger.error({ error }, 'Failed to get shared items');
    res.status(500).json({ success: false, error: 'Failed to get shared items' });
  }
}

// GET /api/drive/:id/activity — file activity log
export async function getActivityLog(req: Request, res: Response) {
  try {
    const itemId = req.params.id as string;
    const activities = await driveService.getActivityLog(itemId);
    res.json({ success: true, data: activities });
  } catch (error) {
    logger.error({ error }, 'Failed to get activity log');
    res.status(500).json({ success: false, error: 'Failed to get activity log' });
  }
}

// GET /api/drive/:id/comments — list comments
export async function listComments(req: Request, res: Response) {
  try {
    const itemId = req.params.id as string;
    const comments = await driveService.listComments(itemId);
    res.json({ success: true, data: comments });
  } catch (error) {
    logger.error({ error }, 'Failed to list comments');
    res.status(500).json({ success: false, error: 'Failed to list comments' });
  }
}

// POST /api/drive/:id/comments — create comment
export async function createComment(req: Request, res: Response) {
  try {
    if (!canAccess(req.drivePerm!.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to comment in drive' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const itemId = req.params.id as string;
    const { body } = req.body as { body?: string };

    if (!body || !body.trim()) {
      res.status(400).json({ success: false, error: 'Comment body is required' });
      return;
    }

    const comment = await driveService.createComment(userId, tenantId, itemId, body.trim());
    res.json({ success: true, data: comment });

    // Fire-and-forget: parse @mentions and create notifications
    if (req.auth?.tenantId) {
      const authorEmail = req.auth.email || '';
      const authorName = authorEmail.split('@')[0] || 'Someone';
      parseMentionsAndNotify({
        body: body.trim(),
        tenantId: req.auth.tenantId,
        authorUserId: userId,
        authorName,
        sourceApp: 'drive',
        sourceRecordId: itemId,
      }).catch(() => {});
    }
  } catch (error) {
    logger.error({ error }, 'Failed to create comment');
    res.status(500).json({ success: false, error: 'Failed to create comment' });
  }
}

// DELETE /api/drive/comments/:commentId — delete comment (author-only)
export async function deleteComment(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const commentId = req.params.commentId as string;

    const deleted = await driveService.deleteComment(userId, commentId);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Comment not found or not authorized' });
      return;
    }

    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete comment');
    res.status(500).json({ success: false, error: 'Failed to delete comment' });
  }
}
