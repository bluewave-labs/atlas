import type { Request, Response } from 'express';
import * as driveService from './service';
import { logger } from '../../utils/logger';
import { emitAppEvent } from '../../services/event.service';
import path from 'node:path';
import { existsSync, createReadStream, readFileSync, statSync } from 'node:fs';
import archiver from 'archiver';

const UPLOADS_DIR = path.join(__dirname, '../../../uploads');

// GET /api/drive/widget
export async function getWidgetData(req: Request, res: Response) {
  try {
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
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const parentId = (req.query.parentId as string) || null;
    const sortBy = (req.query.sortBy as string) || undefined;
    const sortOrder = (req.query.sortOrder as string) || undefined;

    // Auto-seed on first visit
    await driveService.seedSampleFolder(userId, accountId);

    const items = await driveService.listItems(userId, parentId, false, sortBy, sortOrder);
    res.json({ success: true, data: { items } });
  } catch (error) {
    logger.error({ error }, 'Failed to list drive items');
    res.status(500).json({ success: false, error: 'Failed to list drive items' });
  }
}

// POST /api/drive/folder
export async function createFolder(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { name, parentId } = req.body;

    const folder = await driveService.createFolder(userId, accountId, { name, parentId });
    res.json({ success: true, data: folder });
  } catch (error) {
    logger.error({ error }, 'Failed to create folder');
    res.status(500).json({ success: false, error: 'Failed to create folder' });
  }
}

// POST /api/drive/upload
export async function uploadFiles(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
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
      const item = await driveService.uploadFile(userId, accountId, {
        name: decodedName,
        type: 'file',
        mimeType: file.mimetype,
        size: file.size,
        parentId,
        storagePath: file.filename,
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
      }).catch(() => {});
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
    const userId = req.auth!.userId;
    const itemId = req.params.id as string;

    const item = await driveService.getItem(userId, itemId);
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
    const userId = req.auth!.userId;
    const itemId = req.params.id as string;
    const { name, parentId, icon, isFavourite, isArchived, tags } = req.body;

    const item = await driveService.updateItem(userId, itemId, {
      name,
      parentId,
      icon,
      isFavourite,
      isArchived,
      tags,
    });

    if (!item) {
      res.status(404).json({ success: false, error: 'Item not found' });
      return;
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
    const userId = req.auth!.userId;
    const itemId = req.params.id as string;

    await driveService.deleteItem(userId, itemId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete drive item');
    res.status(500).json({ success: false, error: 'Failed to delete drive item' });
  }
}

// PATCH /api/drive/:id/restore
export async function restoreItem(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const itemId = req.params.id as string;

    const item = await driveService.restoreItem(userId, itemId);
    if (!item) {
      res.status(404).json({ success: false, error: 'Item not found' });
      return;
    }

    res.json({ success: true, data: item });
  } catch (error) {
    logger.error({ error }, 'Failed to restore drive item');
    res.status(500).json({ success: false, error: 'Failed to restore drive item' });
  }
}

// DELETE /api/drive/:id/permanent
export async function permanentDelete(req: Request, res: Response) {
  try {
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
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const itemId = req.params.id as string;
    const { targetParentId } = req.body as { targetParentId?: string | null };

    const item = await driveService.copyItem(userId, accountId, itemId, targetParentId);
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

// GET /api/drive/:id/download-zip
export async function downloadZip(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const itemId = req.params.id as string;

    const item = await driveService.getItem(userId, itemId);
    if (!item || item.type !== 'folder') {
      res.status(404).json({ success: false, error: 'Folder not found' });
      return;
    }

    const contents = await driveService.getFolderContents(userId, itemId);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(item.name)}.zip"`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(res);

    for (const { item: fileItem, relativePath } of contents) {
      if (fileItem.storagePath) {
        const filePath = path.join(UPLOADS_DIR, fileItem.storagePath);
        if (existsSync(filePath)) {
          archive.file(filePath, { name: relativePath });
        }
      }
    }

    await archive.finalize();
  } catch (error) {
    logger.error({ error }, 'Failed to download ZIP');
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Failed to download ZIP' });
    }
  }
}

// GET /api/drive/:id/download
export async function downloadFile(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const itemId = req.params.id as string;

    const item = await driveService.getItem(userId, itemId);
    if (!item || item.type !== 'file' || !item.storagePath) {
      res.status(404).json({ success: false, error: 'File not found' });
      return;
    }

    const filePath = path.join(UPLOADS_DIR, item.storagePath);
    if (!existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'File not found on disk' });
      return;
    }

    const stat = statSync(filePath);
    const mimeType = item.mimeType || 'application/octet-stream';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(item.name)}"`);

    createReadStream(filePath).pipe(res);
  } catch (error) {
    logger.error({ error }, 'Failed to download file');
    res.status(500).json({ success: false, error: 'Failed to download file' });
  }
}

// GET /api/drive/:id/view — inline view (for PDF/video/audio preview)
export async function viewFile(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const itemId = req.params.id as string;

    const item = await driveService.getItem(userId, itemId);
    if (!item || item.type !== 'file' || !item.storagePath) {
      res.status(404).json({ success: false, error: 'File not found' });
      return;
    }

    const filePath = path.join(UPLOADS_DIR, item.storagePath);
    if (!existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'File not found on disk' });
      return;
    }

    const stat = statSync(filePath);
    const mimeType = item.mimeType || 'application/octet-stream';

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(item.name)}"`);

    createReadStream(filePath).pipe(res);
  } catch (error) {
    logger.error({ error }, 'Failed to view file');
    res.status(500).json({ success: false, error: 'Failed to view file' });
  }
}

// GET /api/drive/by-type?type=images|documents|videos|audio
export async function listItemsByType(req: Request, res: Response) {
  try {
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
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
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
    await driveService.createVersion(userId, accountId, itemId);

    // Update main record with new file data
    const now = new Date();
    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    await driveService.updateItem(userId, itemId, { name: decodedName });

    // Also update mimeType, size, storagePath via raw update
    const { db: database } = await import('../../config/database');
    const { driveItems: driveItemsTable } = await import('../../db/schema');
    const { eq, and } = await import('drizzle-orm');
    await database
      .update(driveItemsTable)
      .set({
        mimeType: file.mimetype,
        size: file.size,
        storagePath: file.filename,
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
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const itemId = req.params.id as string;
    const versionId = req.params.versionId as string;

    const item = await driveService.restoreVersion(userId, accountId, itemId, versionId);
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
    const userId = req.auth!.userId;
    const itemId = req.params.id as string;
    const { expiresAt } = req.body as { expiresAt?: string };

    const link = await driveService.createShareLink(userId, itemId, expiresAt);
    if (!link) {
      res.status(404).json({ success: false, error: 'Item not found' });
      return;
    }

    if (req.auth!.tenantId) {
      const item = await driveService.getItem(userId, itemId);
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'drive',
        eventType: 'file.shared',
        title: `shared ${item?.name ?? 'a file'}`,
        metadata: { itemId, linkId: link.id },
      }).catch(() => {});
    }

    res.json({ success: true, data: link });
  } catch (error) {
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
    const userId = req.auth!.userId;
    const linkId = req.params.linkId as string;

    await driveService.deleteShareLink(userId, linkId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete share link');
    res.status(500).json({ success: false, error: 'Failed to delete share link' });
  }
}

// POST /api/drive/create-document
export async function createLinkedDocument(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { parentId } = req.body as { parentId?: string };

    const result = await driveService.createLinkedDocument(userId, accountId, parentId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to create linked document');
    res.status(500).json({ success: false, error: 'Failed to create linked document' });
  }
}

// POST /api/drive/create-drawing
export async function createLinkedDrawing(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { parentId } = req.body as { parentId?: string };

    const result = await driveService.createLinkedDrawing(userId, accountId, parentId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to create linked drawing');
    res.status(500).json({ success: false, error: 'Failed to create linked drawing' });
  }
}

// POST /api/drive/create-spreadsheet
export async function createLinkedSpreadsheet(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { parentId } = req.body as { parentId?: string };

    const result = await driveService.createLinkedSpreadsheet(userId, accountId, parentId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to create linked spreadsheet');
    res.status(500).json({ success: false, error: 'Failed to create linked spreadsheet' });
  }
}

// GET /api/drive/:id/preview — return text content for previewable files
const MAX_PREVIEW_BYTES = 512 * 1024; // 512KB max preview
const PREVIEWABLE_MIMES = [
  'text/', 'application/json', 'application/xml', 'application/javascript',
  'application/csv', 'application/x-yaml', 'application/x-sh',
];

function isPreviewable(mimeType: string | null, name: string): boolean {
  if (!mimeType) return false;
  if (PREVIEWABLE_MIMES.some((m) => mimeType.startsWith(m) || mimeType.includes(m))) return true;
  // Also allow by extension for common cases where mime type may be generic
  const ext = name.split('.').pop()?.toLowerCase();
  return ['csv', 'md', 'json', 'txt', 'xml', 'yaml', 'yml', 'sh', 'js', 'ts', 'html', 'css', 'log', 'ini', 'toml', 'env', 'sql'].includes(ext || '');
}

export async function previewFile(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const itemId = req.params.id as string;

    const item = await driveService.getItem(userId, itemId);
    if (!item || item.type !== 'file' || !item.storagePath) {
      res.status(404).json({ success: false, error: 'File not found' });
      return;
    }

    if (!isPreviewable(item.mimeType, item.name)) {
      res.status(400).json({ success: false, error: 'File type not previewable as text' });
      return;
    }

    const filePath = path.join(UPLOADS_DIR, item.storagePath);
    if (!existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'File not found on disk' });
      return;
    }

    const stat = statSync(filePath);
    const truncated = stat.size > MAX_PREVIEW_BYTES;
    const buffer = Buffer.alloc(Math.min(stat.size, MAX_PREVIEW_BYTES));
    const fd = require('node:fs').openSync(filePath, 'r');
    require('node:fs').readSync(fd, buffer, 0, buffer.length, 0);
    require('node:fs').closeSync(fd);

    const content = buffer.toString('utf-8');

    res.json({
      success: true,
      data: {
        content,
        truncated,
        totalSize: stat.size,
        mimeType: item.mimeType,
        name: item.name,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to preview file');
    res.status(500).json({ success: false, error: 'Failed to preview file' });
  }
}
