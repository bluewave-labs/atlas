import type { Request, Response } from 'express';
import * as driveService from '../service';
import { logger } from '../../../utils/logger';
import { emitAppEvent } from '../../../services/event.service';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';

// GET /api/drive/widget
export async function getWidgetData(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view drive' });
      return;
    }

    const userId = req.auth!.userId;
    const data = await driveService.getWidgetData(userId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get drive widget data');
    res.status(500).json({ success: false, error: 'Failed to get drive widget data' });
  }
}

// GET /api/drive
export async function listItems(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view drive' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const parentId = (req.query.parentId as string) || null;
    const sortBy = (req.query.sortBy as string) || undefined;
    const sortOrder = (req.query.sortOrder as string) || undefined;

    const items = await driveService.listItems(userId, parentId, false, sortBy, sortOrder, req.auth!.tenantId ?? null);
    res.json({ success: true, data: { items } });
  } catch (error) {
    logger.error({ error }, 'Failed to list drive items');
    res.status(500).json({ success: false, error: 'Failed to list drive items' });
  }
}

// POST /api/drive/folder
export async function createFolder(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create in drive' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { name, parentId } = req.body;

    const folder = await driveService.createFolder(userId, tenantId, { name, parentId });
    driveService.logDriveActivity({ driveItemId: folder.id, tenantId, userId, action: 'folder.created', metadata: { name: folder.name } }).catch((err) => logger.warn({ err }, 'Drive activity log failed'));
    res.json({ success: true, data: folder });
  } catch (error) {
    logger.error({ error }, 'Failed to create folder');
    res.status(500).json({ success: false, error: 'Failed to create folder' });
  }
}

// POST /api/drive/upload
export async function uploadFiles(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create in drive' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const parentId = (req.body.parentId as string) || null;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({ success: false, error: 'No files uploaded' });
      return;
    }

    const created = [];
    for (const file of files) {
      // Multer decodes filenames as Latin-1; re-decode as UTF-8 for proper Unicode support
      const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      const item = await driveService.uploadFile(userId, tenantId, {
        name: decodedName,
        type: 'file',
        mimeType: file.mimetype,
        size: file.size,
        parentId,
        storagePath: `${tenantId}/${file.filename}`,
      });
      created.push(item);
    }

    if (req.auth!.tenantId && created.length > 0) {
      const names = created.map((i) => i.name).join(', ');
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'drive',
        eventType: 'file.uploaded',
        title: `uploaded ${created.length === 1 ? names : `${created.length} files`}`,
        metadata: { itemIds: created.map((i) => i.id) },
      }).catch((err) => logger.warn({ err }, 'Drive activity log failed'));
    }

    // Activity log — fire-and-forget
    for (const item of created) {
      driveService.logDriveActivity({ driveItemId: item.id, tenantId, userId, action: 'file.uploaded', metadata: { name: item.name } }).catch((err) => logger.warn({ err }, 'Drive activity log failed'));
    }

    res.json({ success: true, data: { items: created } });
  } catch (error) {
    logger.error({ error }, 'Failed to upload files');
    res.status(500).json({ success: false, error: 'Failed to upload files' });
  }
}

// GET /api/drive/search?q=
export async function searchItems(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view drive' });
      return;
    }

    const userId = req.auth!.userId;
    const query = (req.query.q as string) || '';

    if (!query.trim()) {
      res.json({ success: true, data: { items: [] } });
      return;
    }

    const items = await driveService.searchItems(userId, query.trim());
    res.json({ success: true, data: { items } });
  } catch (error) {
    logger.error({ error }, 'Failed to search drive items');
    res.status(500).json({ success: false, error: 'Failed to search drive items' });
  }
}

// GET /api/drive/trash
export async function listTrash(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view drive' });
      return;
    }

    const userId = req.auth!.userId;
    const items = await driveService.listTrash(userId);
    res.json({ success: true, data: { items } });
  } catch (error) {
    logger.error({ error }, 'Failed to list trash');
    res.status(500).json({ success: false, error: 'Failed to list trash' });
  }
}

// GET /api/drive/favourites
export async function listFavourites(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view drive' });
      return;
    }

    const userId = req.auth!.userId;
    const items = await driveService.listFavourites(userId);
    res.json({ success: true, data: { items } });
  } catch (error) {
    logger.error({ error }, 'Failed to list favourites');
    res.status(500).json({ success: false, error: 'Failed to list favourites' });
  }
}

// GET /api/drive/recent
export async function listRecent(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view drive' });
      return;
    }

    const userId = req.auth!.userId;
    const limit = parseInt(req.query.limit as string) || 20;
    const items = await driveService.listRecent(userId, limit);
    res.json({ success: true, data: { items } });
  } catch (error) {
    logger.error({ error }, 'Failed to list recent files');
    res.status(500).json({ success: false, error: 'Failed to list recent files' });
  }
}

// GET /api/drive/folders
export async function listFolders(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view drive' });
      return;
    }

    const userId = req.auth!.userId;
    const folders = await driveService.listFolders(userId);
    res.json({ success: true, data: { folders } });
  } catch (error) {
    logger.error({ error }, 'Failed to list folders');
    res.status(500).json({ success: false, error: 'Failed to list folders' });
  }
}

// GET /api/drive/storage
export async function getStorageUsage(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view drive' });
      return;
    }

    const userId = req.auth!.userId;
    const usage = await driveService.getStorageUsage(userId);
    res.json({ success: true, data: usage });
  } catch (error) {
    logger.error({ error }, 'Failed to get storage usage');
    res.status(500).json({ success: false, error: 'Failed to get storage usage' });
  }
}

// GET /api/drive/:id
export async function getItem(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view drive' });
      return;
    }

    const userId = req.auth!.userId;
    const itemId = req.params.id as string;

    const item = await driveService.getItem(userId, itemId, req.auth!.tenantId ?? null);
    if (!item) {
      res.status(404).json({ success: false, error: 'Item not found' });
      return;
    }

    res.json({ success: true, data: item });
  } catch (error) {
    logger.error({ error }, 'Failed to get drive item');
    res.status(500).json({ success: false, error: 'Failed to get drive item' });
  }
}

// GET /api/drive/:id/breadcrumbs
export async function getBreadcrumbs(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view drive' });
      return;
    }

    const userId = req.auth!.userId;
    const itemId = req.params.id as string;

    const crumbs = await driveService.getBreadcrumbs(userId, itemId);
    res.json({ success: true, data: { breadcrumbs: crumbs } });
  } catch (error) {
    logger.error({ error }, 'Failed to get breadcrumbs');
    res.status(500).json({ success: false, error: 'Failed to get breadcrumbs' });
  }
}

// PATCH /api/drive/:id
export async function updateItem(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update in drive' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const itemId = req.params.id as string;
    const { name, parentId, icon, isFavourite, isArchived, tags } = req.body;

    let item = await driveService.updateItem(userId, itemId, {
      name,
      parentId,
      icon,
      isFavourite,
      isArchived,
      tags,
    });

    // If owner update returns null, check if user has edit share permission
    if (!item) {
      const sharePerm = await driveService.checkSharePermission(userId, itemId);
      if (sharePerm === 'edit') {
        // Allow limited updates: name and tags only
        item = await driveService.updateItem(userId, itemId, { name, tags }, true);
      }
      if (!item) {
        res.status(403).json({ success: false, error: 'Item not found or no edit permission' });
        return;
      }
    }

    // Activity log for rename
    if (name !== undefined) {
      driveService.logDriveActivity({ driveItemId: itemId, tenantId, userId, action: 'file.renamed', metadata: { name } }).catch((err) => logger.warn({ err }, 'Drive activity log failed'));
    }

    res.json({ success: true, data: item });
  } catch (error) {
    logger.error({ error }, 'Failed to update drive item');
    res.status(500).json({ success: false, error: 'Failed to update drive item' });
  }
}

// DELETE /api/drive/:id (soft delete)
export async function deleteItem(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete in drive' });
      return;
    }

    const userId = req.auth!.userId;
    const itemId = req.params.id as string;

    await driveService.deleteItem(userId, itemId);
    driveService.logDriveActivity({ driveItemId: itemId, tenantId: req.auth!.tenantId, userId, action: 'file.deleted' }).catch((err) => logger.warn({ err }, 'Drive activity log failed'));
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete drive item');
    res.status(500).json({ success: false, error: 'Failed to delete drive item' });
  }
}

// PATCH /api/drive/:id/restore
export async function restoreItem(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete in drive' });
      return;
    }

    const userId = req.auth!.userId;
    const itemId = req.params.id as string;

    const item = await driveService.restoreItem(userId, itemId);
    if (!item) {
      res.status(404).json({ success: false, error: 'Item not found' });
      return;
    }

    driveService.logDriveActivity({ driveItemId: itemId, tenantId: req.auth!.tenantId, userId, action: 'file.restored' }).catch((err) => logger.warn({ err }, 'Drive activity log failed'));
    res.json({ success: true, data: item });
  } catch (error) {
    logger.error({ error }, 'Failed to restore drive item');
    res.status(500).json({ success: false, error: 'Failed to restore drive item' });
  }
}

// DELETE /api/drive/:id/permanent
export async function permanentDelete(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete in drive' });
      return;
    }

    const userId = req.auth!.userId;
    const itemId = req.params.id as string;

    await driveService.permanentDelete(userId, itemId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to permanently delete drive item');
    res.status(500).json({ success: false, error: 'Failed to permanently delete drive item' });
  }
}

// POST /api/drive/:id/duplicate
export async function duplicateItem(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create in drive' });
      return;
    }

    const userId = req.auth!.userId;
    const itemId = req.params.id as string;

    const item = await driveService.duplicateItem(userId, itemId);
    if (!item) {
      res.status(404).json({ success: false, error: 'Item not found' });
      return;
    }

    res.json({ success: true, data: item });
  } catch (error) {
    logger.error({ error }, 'Failed to duplicate drive item');
    res.status(500).json({ success: false, error: 'Failed to duplicate drive item' });
  }
}

// POST /api/drive/:id/copy
export async function copyItem(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create in drive' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const itemId = req.params.id as string;
    const { targetParentId } = req.body as { targetParentId?: string | null };

    const item = await driveService.copyItem(userId, tenantId, itemId, targetParentId);
    if (!item) {
      res.status(404).json({ success: false, error: 'Item not found' });
      return;
    }

    res.json({ success: true, data: item });
  } catch (error) {
    logger.error({ error }, 'Failed to copy drive item');
    res.status(500).json({ success: false, error: 'Failed to copy drive item' });
  }
}

// POST /api/drive/batch/delete
export async function batchDelete(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete in drive' });
      return;
    }

    const userId = req.auth!.userId;
    const { itemIds } = req.body as { itemIds: string[] };

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      res.status(400).json({ success: false, error: 'itemIds required' });
      return;
    }

    await driveService.batchDelete(userId, itemIds);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to batch delete');
    res.status(500).json({ success: false, error: 'Failed to batch delete' });
  }
}

// POST /api/drive/batch/move
export async function batchMove(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update in drive' });
      return;
    }

    const userId = req.auth!.userId;
    const { itemIds, parentId } = req.body as { itemIds: string[]; parentId: string | null };

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      res.status(400).json({ success: false, error: 'itemIds required' });
      return;
    }

    await driveService.batchMove(userId, itemIds, parentId ?? null);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to batch move');
    res.status(500).json({ success: false, error: 'Failed to batch move' });
  }
}

// POST /api/drive/batch/favourite
export async function batchFavourite(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update in drive' });
      return;
    }

    const userId = req.auth!.userId;
    const { itemIds, isFavourite } = req.body as { itemIds: string[]; isFavourite: boolean };

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      res.status(400).json({ success: false, error: 'itemIds required' });
      return;
    }

    await driveService.batchFavourite(userId, itemIds, isFavourite);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to batch favourite');
    res.status(500).json({ success: false, error: 'Failed to batch favourite' });
  }
}

// GET /api/drive/by-type?type=images|documents|videos|audio
export async function listItemsByType(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'drive');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view drive' });
      return;
    }

    const userId = req.auth!.userId;
    const typeCategory = (req.query.type as string) || '';

    if (!['images', 'documents', 'videos', 'audio'].includes(typeCategory)) {
      res.status(400).json({ success: false, error: 'Invalid type category' });
      return;
    }

    const items = await driveService.listItemsByType(userId, typeCategory);
    res.json({ success: true, data: { items } });
  } catch (error) {
    logger.error({ error }, 'Failed to list items by type');
    res.status(500).json({ success: false, error: 'Failed to list items by type' });
  }
}

// POST /api/drive/seed
export async function seedSampleData(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const result = await driveService.seedSampleData(userId, tenantId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to seed drive sample data');
    res.status(500).json({ success: false, error: 'Failed to seed drive sample data' });
  }
}

// PATCH /api/drive/:id/visibility
export async function updateDriveItemVisibility(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const itemId = req.params.id as string;
    const { visibility } = req.body;

    if (visibility !== 'private' && visibility !== 'team') {
      res.status(400).json({ success: false, error: 'Visibility must be "private" or "team"' });
      return;
    }

    await driveService.updateDriveItemVisibility(userId, itemId, visibility);
    res.json({ success: true, data: null });
  } catch (error: any) {
    if (error.message === 'Tenant required for team visibility') {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    logger.error({ error }, 'Failed to update drive item visibility');
    res.status(500).json({ success: false, error: 'Failed to update drive item visibility' });
  }
}
