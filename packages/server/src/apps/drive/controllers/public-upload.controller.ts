import type { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { db } from '../../../config/database';
import { driveItems, driveShareLinks, driveActivityLog } from '../../../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../../../utils/logger';

const UPLOADS_DIR = path.join(__dirname, '../../../../uploads');

export async function handlePublicUpload(req: Request, res: Response) {
  try {
    const token = req.params.token as string;
    const { name, email } = req.body as { name?: string; email?: string };

    const [link] = await db
      .select()
      .from(driveShareLinks)
      .where(eq(driveShareLinks.shareToken, token))
      .limit(1);
    if (!link) {
      res.status(404).json({ success: false, error: 'Link not found' });
      return;
    }
    if (link.mode !== 'upload_only') {
      res.status(403).json({ success: false, error: 'Not an upload link' });
      return;
    }
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      res.status(410).json({ success: false, error: 'Link expired' });
      return;
    }
    if (link.requireUploaderEmail && (!name || !email)) {
      res.status(400).json({ success: false, error: 'Name and email required' });
      return;
    }

    const [folder] = await db
      .select()
      .from(driveItems)
      .where(eq(driveItems.id, link.driveItemId))
      .limit(1);
    if (!folder || folder.type !== 'folder') {
      res.status(404).json({ success: false, error: 'Target folder not found' });
      return;
    }

    const files = (req.files as Express.Multer.File[]) ?? [];

    const fileMetadatas: Array<{ storageRel: string; file: Express.Multer.File }> = [];
    for (const file of files) {
      const storageRel = `${folder.tenantId}/${crypto.randomUUID()}_${Date.now()}_${file.originalname}`;
      const storageAbs = path.join(UPLOADS_DIR, storageRel);
      await fs.mkdir(path.dirname(storageAbs), { recursive: true });
      await fs.writeFile(storageAbs, file.buffer);
      fileMetadatas.push({ storageRel, file });
    }

    const rows = fileMetadatas.length > 0
      ? await db.insert(driveItems).values(
          fileMetadatas.map(({ storageRel, file }) => ({
            tenantId: folder.tenantId,
            userId: folder.userId,
            parentId: folder.id,
            name: file.originalname,
            type: 'file' as const,
            mimeType: file.mimetype,
            size: file.size,
            storagePath: storageRel,
            uploadSource: {
              name: name || null,
              email: email || null,
              shareToken: token,
              uploadedAt: new Date().toISOString(),
              ip: req.ip ?? undefined,
            },
          })),
        ).returning()
      : [];

    // drive_activity_log.tenant_id is NOT NULL — include it.
    if (rows.length > 0) {
      await db.insert(driveActivityLog).values(rows.map(row => ({
        driveItemId: row.id,
        tenantId: folder.tenantId,
        userId: folder.userId,
        action: 'public_upload',
        metadata: { uploaderName: name, uploaderEmail: email, viaToken: token },
      })));
    }

    const created = rows.map(row => ({ id: row.id, name: row.name, size: row.size ?? 0 }));

    res.json({ success: true, data: { uploaded: created } });
  } catch (error) {
    logger.error({ error }, 'Public upload failed');
    res.status(500).json({ success: false, error: 'Upload failed' });
  }
}
