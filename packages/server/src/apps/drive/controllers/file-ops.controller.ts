import type { Request, Response } from 'express';
import * as driveService from '../service';
import { logger } from '../../../utils/logger';
import { canAccess } from '../../../services/app-permissions.service';
import path from 'node:path';
import { existsSync, createReadStream, readFileSync, statSync } from 'node:fs';
import archiver from 'archiver';

const UPLOADS_DIR = path.join(__dirname, '../../../../uploads');

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

// POST /api/drive/create-document
export async function createLinkedDocument(req: Request, res: Response) {
  try {
    const perm = req.drivePerm!;
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create in drive' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { parentId } = req.body as { parentId?: string };

    const result = await driveService.createLinkedDocument(userId, tenantId, parentId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to create linked document');
    res.status(500).json({ success: false, error: 'Failed to create linked document' });
  }
}

// POST /api/drive/create-drawing
export async function createLinkedDrawing(req: Request, res: Response) {
  try {
    const perm = req.drivePerm!;
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create in drive' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { parentId } = req.body as { parentId?: string };

    const result = await driveService.createLinkedDrawing(userId, tenantId, parentId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to create linked drawing');
    res.status(500).json({ success: false, error: 'Failed to create linked drawing' });
  }
}

