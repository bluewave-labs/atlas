import type { Request, Response } from 'express';
import * as hrService from '../services/document.service';
import { logger } from '../../../utils/logger';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';

// ─── Employee Documents ────────────────────────────────────────────

export async function listEmployeeDocuments(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view HR data' });
      return;
    }

    const employeeId = req.params.id as string;

    const docs = await hrService.listEmployeeDocuments(tenantId, employeeId);
    res.json({ success: true, data: docs });
  } catch (error) {
    logger.error({ error }, 'Failed to list employee documents');
    res.status(500).json({ success: false, error: 'Failed to list employee documents' });
  }
}

export async function uploadEmployeeDocument(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const employeeId = req.params.id as string;
    const file = req.file;
    const { type, expiresAt, notes } = req.body;

    if (!file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    const doc = await hrService.createEmployeeDocument(tenantId, {
      employeeId,
      name: file.originalname,
      type: type || 'other',
      storagePath: file.path,
      mimeType: file.mimetype,
      size: file.size,
      expiresAt: expiresAt || null,
      notes: notes || null,
      uploadedBy: userId,
    });

    res.json({ success: true, data: doc });
  } catch (error) {
    logger.error({ error }, 'Failed to upload employee document');
    res.status(500).json({ success: false, error: 'Failed to upload employee document' });
  }
}

export async function deleteEmployeeDocument(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete' });
      return;
    }

    const docId = req.params.docId as string;

    await hrService.deleteEmployeeDocument(tenantId, docId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete employee document');
    res.status(500).json({ success: false, error: 'Failed to delete employee document' });
  }
}

export async function downloadEmployeeDocument(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view HR data' });
      return;
    }

    const docId = req.params.docId as string;

    const doc = await hrService.getEmployeeDocument(tenantId, docId);
    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    res.download(doc.storagePath, doc.name);
  } catch (error) {
    logger.error({ error }, 'Failed to download employee document');
    res.status(500).json({ success: false, error: 'Failed to download employee document' });
  }
}
