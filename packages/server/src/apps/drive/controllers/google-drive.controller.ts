import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../../../utils/logger';
import { env } from '../../../config/env';
import { isGoogleConfigured, getDriveConnectUrl } from '../../../services/google-auth';
import * as googleDriveService from '../services/google-drive.service';

// ─── Get Google Drive connection status ─────────────────────────────

export async function getStatus(req: Request, res: Response) {
  try {
    const { tenantId } = req.auth!;
    const data = await googleDriveService.getDriveStatus(tenantId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get Google Drive status');
    res.status(500).json({ success: false, error: 'Failed to get Google Drive status' });
  }
}

// ─── Generate OAuth URL for Drive scope consent ─────────────────────

export async function connect(req: Request, res: Response) {
  try {
    if (!isGoogleConfigured()) {
      res.status(501).json({
        success: false,
        error: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      });
      return;
    }

    const state = jwt.sign(
      { userId: req.auth!.userId, tenantId: req.auth!.tenantId },
      env.JWT_SECRET,
      { expiresIn: '10m' },
    );

    const url = getDriveConnectUrl(state);
    res.json({ success: true, data: { url } });
  } catch (error) {
    logger.error({ error }, 'Failed to generate Google Drive connect URL');
    res.status(500).json({ success: false, error: 'Failed to generate Google Drive connect URL' });
  }
}

// ─── Browse files in Google Drive ───────────────────────────────────

export async function browse(req: Request, res: Response) {
  try {
    const { tenantId } = req.auth!;
    const parentId = req.query.parentId as string | undefined;
    const query = req.query.q as string | undefined;

    const files = await googleDriveService.listGoogleDriveFiles(tenantId, parentId, query);
    res.json({ success: true, data: files });
  } catch (error) {
    logger.error({ error }, 'Failed to browse Google Drive files');
    res.status(500).json({ success: false, error: 'Failed to browse Google Drive files' });
  }
}

// ─── Import files from Google Drive ─────────────────────────────────

export async function importFiles(req: Request, res: Response) {
  try {
    const { userId, tenantId } = req.auth!;
    const { fileIds, targetParentId } = req.body as {
      fileIds: string[];
      targetParentId?: string | null;
    };

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      res.status(400).json({ success: false, error: 'fileIds is required and must be a non-empty array' });
      return;
    }

    const results = [];
    const errors: string[] = [];

    for (const fileId of fileIds) {
      try {
        const item = await googleDriveService.importFileFromGoogleDrive(
          tenantId,
          userId,
          fileId,
          targetParentId,
        );
        results.push(item);
      } catch (err) {
        logger.error({ err, fileId }, 'Failed to import Google Drive file');
        errors.push(`Failed to import file ${fileId}`);
      }
    }

    res.json({ success: true, data: { imported: results, errors } });
  } catch (error) {
    logger.error({ error }, 'Failed to import from Google Drive');
    res.status(500).json({ success: false, error: 'Failed to import from Google Drive' });
  }
}

// ─── Export an Atlas Drive file to Google Drive ─────────────────────

export async function exportFile(req: Request, res: Response) {
  try {
    const { userId, tenantId } = req.auth!;
    const { driveItemId, googleParentFolderId } = req.body as {
      driveItemId: string;
      googleParentFolderId?: string;
    };

    if (!driveItemId) {
      res.status(400).json({ success: false, error: 'driveItemId is required' });
      return;
    }

    const data = await googleDriveService.exportToGoogleDrive(
      tenantId,
      userId,
      driveItemId,
      googleParentFolderId,
    );

    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to export to Google Drive');
    res.status(500).json({ success: false, error: 'Failed to export to Google Drive' });
  }
}
