import type { Request, Response } from 'express';
import * as signService from '../service';
import { sendPendingReminders } from '../reminder';
import { logger } from '../../../utils/logger';
import { emitAppEvent } from '../../../services/event.service';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';
import path from 'node:path';
import { existsSync, createReadStream, statSync } from 'node:fs';

const UPLOADS_DIR = path.join(__dirname, '../../../../uploads');

// ─── Widget ─────────────────────────────────────────────────────────

export async function getWidgetData(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view sign documents' });
      return;
    }

    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const data = await signService.getWidgetData(userId, accountId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get sign widget data');
    res.status(500).json({ success: false, error: 'Failed to get sign widget data' });
  }
}

// ─── Document CRUD ──────────────────────────────────────────────────

export async function listDocuments(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view sign documents' });
      return;
    }

    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const docs = await signService.listDocuments(userId, accountId);
    res.json({ success: true, data: { documents: docs } });
  } catch (error) {
    logger.error({ error }, 'Failed to list signature documents');
    res.status(500).json({ success: false, error: 'Failed to list signature documents' });
  }
}

export async function createDocument(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create sign documents' });
      return;
    }

    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { title, fileName, storagePath, pageCount, status, expiresAt, tags, redirectUrl } = req.body;

    if (!title || !fileName || !storagePath) {
      res.status(400).json({ success: false, error: 'title, fileName, and storagePath are required' });
      return;
    }

    const doc = await signService.createDocument(userId, accountId, {
      title, fileName, storagePath, pageCount, status, expiresAt, tags, redirectUrl,
    });
    res.json({ success: true, data: doc });
  } catch (error) {
    logger.error({ error }, 'Failed to create signature document');
    res.status(500).json({ success: false, error: 'Failed to create signature document' });
  }
}

export async function uploadPDF(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create sign documents' });
      return;
    }

    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const file = req.file as Express.Multer.File;

    if (!file) {
      res.status(400).json({ success: false, error: 'No PDF file uploaded' });
      return;
    }

    const decodedName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const title = req.body.title || decodedName.replace(/\.pdf$/i, '');
    const pageCount = parseInt(req.body.pageCount) || 1;

    const doc = await signService.createDocument(userId, accountId, {
      title, fileName: decodedName, storagePath: file.filename, pageCount,
    });

    res.json({ success: true, data: doc });
  } catch (error) {
    logger.error({ error }, 'Failed to upload PDF');
    res.status(500).json({ success: false, error: 'Failed to upload PDF' });
  }
}

export async function getDocument(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view sign documents' });
      return;
    }

    const userId = req.auth!.userId;
    const documentId = req.params.id as string;

    const doc = await signService.getDocument(userId, documentId);
    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    res.json({ success: true, data: doc });
  } catch (error) {
    logger.error({ error }, 'Failed to get signature document');
    res.status(500).json({ success: false, error: 'Failed to get signature document' });
  }
}

export async function updateDocument(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update sign documents' });
      return;
    }

    const userId = req.auth!.userId;
    const documentId = req.params.id as string;
    const { title, status, expiresAt, tags, pageCount, redirectUrl } = req.body;

    const doc = await signService.updateDocument(userId, documentId, {
      title, status, expiresAt, tags, pageCount, redirectUrl,
    });

    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    res.json({ success: true, data: doc });
  } catch (error) {
    logger.error({ error }, 'Failed to update signature document');
    res.status(500).json({ success: false, error: 'Failed to update signature document' });
  }
}

export async function deleteDocument(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete sign documents' });
      return;
    }

    const userId = req.auth!.userId;
    const documentId = req.params.id as string;

    await signService.deleteDocument(userId, documentId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete signature document');
    res.status(500).json({ success: false, error: 'Failed to delete signature document' });
  }
}

export async function viewPDF(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view sign documents' });
      return;
    }

    const userId = req.auth!.userId;
    const documentId = req.params.id as string;

    const doc = await signService.getDocument(userId, documentId);
    if (!doc || !doc.storagePath) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    const filePath = path.join(UPLOADS_DIR, doc.storagePath);
    if (!existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'PDF file not found on disk' });
      return;
    }

    const stat = statSync(filePath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.fileName)}"`);

    createReadStream(filePath).pipe(res);
  } catch (error) {
    logger.error({ error }, 'Failed to view PDF');
    res.status(500).json({ success: false, error: 'Failed to view PDF' });
  }
}

export async function downloadPDF(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view sign documents' });
      return;
    }

    const userId = req.auth!.userId;
    const documentId = req.params.id as string;

    const doc = await signService.getDocument(userId, documentId);
    if (!doc || !doc.storagePath) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    const filePath = path.join(UPLOADS_DIR, doc.storagePath);
    if (!existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'PDF file not found on disk' });
      return;
    }

    const signedPdfBuffer = await signService.generateSignedPDF(documentId, doc.storagePath);
    const signedFileName = doc.fileName.replace(/\.pdf$/i, '') + '_signed.pdf';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', signedPdfBuffer.length);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(signedFileName)}"`);

    res.end(signedPdfBuffer);
  } catch (error) {
    logger.error({ error }, 'Failed to download PDF');
    res.status(500).json({ success: false, error: 'Failed to download PDF' });
  }
}

export async function voidDocument(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update sign documents' });
      return;
    }

    const userId = req.auth!.userId;
    const documentId = req.params.id as string;

    const doc = await signService.getDocument(userId, documentId);
    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    if (doc.status !== 'pending') {
      res.status(400).json({ success: false, error: 'Only pending documents can be voided' });
      return;
    }

    const updated = await signService.voidDocument(userId, documentId);

    if (req.auth!.tenantId) {
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'sign',
        eventType: 'document.voided',
        title: `voided document: ${doc.title}`,
        metadata: { documentId },
      }).catch(() => {});
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error({ error }, 'Failed to void document');
    res.status(500).json({ success: false, error: 'Failed to void document' });
  }
}

export async function seedSampleData(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;

    const result = await signService.seedSampleData(userId, accountId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to seed sign sample data');
    res.status(500).json({ success: false, error: 'Failed to seed sign sample data' });
  }
}

export async function getAuditLog(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view sign documents' });
      return;
    }

    const documentId = req.params.id as string;
    const entries = await signService.getAuditLog(documentId);
    res.json({ success: true, data: { entries } });
  } catch (error) {
    logger.error({ error }, 'Failed to get audit log');
    res.status(500).json({ success: false, error: 'Failed to get audit log' });
  }
}

// ─── Reminders ─────────────────────────────────────────────────────

export async function triggerReminders(req: Request, res: Response) {
  try {
    const count = await sendPendingReminders();
    res.json({ success: true, data: { remindersSent: count } });
  } catch (error) {
    logger.error({ error }, 'Failed to trigger signing reminders');
    res.status(500).json({ success: false, error: 'Failed to trigger signing reminders' });
  }
}

export async function sendSingleReminder(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to send reminders' });
      return;
    }

    const documentId = req.params.id as string;
    const tokenId = req.params.tokenId as string;

    const result = await signService.sendSingleReminder(documentId, tokenId);
    if (!result) {
      res.status(404).json({ success: false, error: 'Token not found or not eligible for reminder' });
      return;
    }

    res.json({ success: true, data: { sent: true } });
  } catch (error) {
    logger.error({ error }, 'Failed to send single reminder');
    res.status(500).json({ success: false, error: 'Failed to send single reminder' });
  }
}
