import { google } from 'googleapis';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getAuthenticatedClient, hasDriveScope } from '../../../services/google-auth';
import * as itemsService from './items.service';
import { logger } from '../../../utils/logger';

const UPLOADS_DIR = path.join(__dirname, '../../../../uploads');

// Ensure uploads directory exists at module load
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Google Docs MIME type → export MIME type + file extension
const GOOGLE_EXPORT_MAP: Record<string, { mimeType: string; ext: string }> = {
  'application/vnd.google-apps.document': {
    mimeType: 'application/pdf',
    ext: '.pdf',
  },
  'application/vnd.google-apps.spreadsheet': {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: '.xlsx',
  },
  'application/vnd.google-apps.presentation': {
    mimeType: 'application/pdf',
    ext: '.pdf',
  },
};

// ─── Check if Drive scope is granted ────────────────────────────────

export async function getDriveStatus(accountId: string) {
  const connected = await hasDriveScope(accountId);
  return { connected };
}

// ─── List files/folders in Google Drive ─────────────────────────────

export async function listGoogleDriveFiles(
  accountId: string,
  parentId?: string,
  query?: string,
) {
  const auth = await getAuthenticatedClient(accountId);
  const drive = google.drive({ version: 'v3', auth });

  let q: string;
  if (query) {
    q = `name contains '${query.replace(/'/g, "\\'")}' and trashed = false`;
  } else {
    const parent = parentId || 'root';
    q = `'${parent}' in parents and trashed = false`;
  }

  const res = await drive.files.list({
    q,
    fields: 'files(id, name, mimeType, size, modifiedTime, iconLink, parents)',
    pageSize: 100,
    orderBy: 'folder,name',
  });

  const files = res.data.files || [];

  return files.map((f) => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType || null,
    size: f.size ? Number(f.size) : null,
    modifiedTime: f.modifiedTime || null,
    isFolder: f.mimeType === 'application/vnd.google-apps.folder',
  }));
}

// ─── Import a file from Google Drive into Atlas Drive ───────────────

export async function importFileFromGoogleDrive(
  accountId: string,
  userId: string,
  googleFileId: string,
  targetParentId?: string | null,
  tenantId?: string | null,
) {
  const auth = await getAuthenticatedClient(accountId);
  const drive = google.drive({ version: 'v3', auth });

  // 1. Get file metadata
  const metaRes = await drive.files.get({
    fileId: googleFileId,
    fields: 'id, name, mimeType',
  });

  const meta = metaRes.data;
  const originalName = meta.name || 'Untitled';
  const originalMimeType = meta.mimeType || 'application/octet-stream';

  // 2. Determine if this is a Google Workspace doc that needs export
  const exportInfo = GOOGLE_EXPORT_MAP[originalMimeType];
  let finalMimeType: string;
  let finalName: string;

  if (exportInfo) {
    finalMimeType = exportInfo.mimeType;
    // Append the export extension if the name doesn't already have it
    finalName = originalName.endsWith(exportInfo.ext)
      ? originalName
      : `${originalName}${exportInfo.ext}`;
  } else {
    finalMimeType = originalMimeType;
    finalName = originalName;
  }

  // 3. Download the file content
  const safeName = finalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${userId}_${Date.now()}_${safeName}`;
  const filePath = path.join(UPLOADS_DIR, storagePath);

  let fileSize: number;

  try {
    if (exportInfo) {
      // Google Workspace doc — use export
      const exportRes = await drive.files.export(
        { fileId: googleFileId, mimeType: exportInfo.mimeType },
        { responseType: 'stream' },
      );
      const writeStream = fs.createWriteStream(filePath);
      await pipeline(exportRes.data as unknown as Readable, writeStream);
      fileSize = fs.statSync(filePath).size;
    } else {
      // Regular file — download via alt=media
      const downloadRes = await drive.files.get(
        { fileId: googleFileId, alt: 'media' },
        { responseType: 'stream' },
      );
      const writeStream = fs.createWriteStream(filePath);
      await pipeline(downloadRes.data as unknown as Readable, writeStream);
      fileSize = fs.statSync(filePath).size;
    }

    // 4. Create driveItem record
    const driveItem = await itemsService.uploadFile(userId, accountId, {
      name: finalName,
      type: 'file',
      mimeType: finalMimeType,
      size: fileSize,
      storagePath,
      parentId: targetParentId || null,
    }, tenantId);

    logger.info(
      { userId, googleFileId, driveItemId: driveItem.id },
      'Imported file from Google Drive',
    );

    return driveItem;
  } catch (err) {
    // Clean up partially downloaded file
    fs.unlink(filePath, () => {});
    throw err;
  }
}

// ─── Export an Atlas Drive file to Google Drive ─────────────────────

export async function exportToGoogleDrive(
  accountId: string,
  userId: string,
  driveItemId: string,
  googleParentFolderId?: string,
) {
  const auth = await getAuthenticatedClient(accountId);
  const drive = google.drive({ version: 'v3', auth });

  // 1. Get Atlas file record
  const item = await itemsService.getItem(userId, driveItemId);
  if (!item) {
    throw new Error('Drive item not found');
  }
  if (item.type !== 'file' || !item.storagePath) {
    throw new Error('Only files with storage can be exported');
  }

  // 2. Read file from disk as a stream
  const filePath = path.join(UPLOADS_DIR, item.storagePath);
  if (!fs.existsSync(filePath)) {
    throw new Error('File not found on disk');
  }

  const fileStream = fs.createReadStream(filePath);
  const mimeType = item.mimeType ?? 'application/octet-stream';

  // 3. Upload to Google Drive
  const requestBody: Record<string, unknown> = {
    name: item.name,
    mimeType,
  };
  if (googleParentFolderId) {
    requestBody.parents = [googleParentFolderId];
  }

  const uploadRes = await drive.files.create({
    requestBody: requestBody as any,
    media: {
      mimeType,
      body: fileStream,
    },
    fields: 'id, webViewLink',
  });

  logger.info(
    { userId, driveItemId, googleFileId: uploadRes.data.id },
    'Exported file to Google Drive',
  );

  return {
    id: uploadRes.data.id!,
    webViewLink: uploadRes.data.webViewLink || null,
  };
}
