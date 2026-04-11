import type { Request, Response } from 'express';
import * as signService from '../service';
import { logger } from '../../../utils/logger';
import { emitAppEvent } from '../../../services/event.service';
import { getAppPermission, canAccess, decideRecordDelete } from '../../../services/app-permissions.service';
import path from 'node:path';
import { existsSync, createReadStream, statSync } from 'node:fs';

const UPLOADS_DIR = path.join(__dirname, '../../../../uploads');

// ─── Field CRUD ─────────────────────────────────────────────────────

export async function listFields(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view sign documents' });
      return;
    }

    const documentId = req.params.id as string;
    const fields = await signService.listFields(documentId);
    res.json({ success: true, data: { fields } });
  } catch (error) {
    logger.error({ error }, 'Failed to list signature fields');
    res.status(500).json({ success: false, error: 'Failed to list signature fields' });
  }
}

export async function createField(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create sign fields' });
      return;
    }

    const documentId = req.params.id as string;
    const { type, pageNumber, x, y, width, height, signerEmail, label, required, options, sortOrder } = req.body;

    if (x === undefined || y === undefined || width === undefined || height === undefined) {
      res.status(400).json({ success: false, error: 'x, y, width, and height are required' });
      return;
    }

    const field = await signService.createField({
      documentId, type, pageNumber, x, y, width, height, signerEmail, label, required, options, sortOrder,
    });
    res.json({ success: true, data: field });
  } catch (error) {
    logger.error({ error }, 'Failed to create signature field');
    res.status(500).json({ success: false, error: 'Failed to create signature field' });
  }
}

export async function updateField(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update sign fields' });
      return;
    }

    const fieldId = req.params.fieldId as string;
    const { type, pageNumber, x, y, width, height, signerEmail, label, required, options, sortOrder } = req.body;

    const field = await signService.updateField(fieldId, {
      type, pageNumber, x, y, width, height, signerEmail, label, required, options, sortOrder,
    });

    if (!field) {
      res.status(404).json({ success: false, error: 'Field not found' });
      return;
    }

    res.json({ success: true, data: field });
  } catch (error) {
    logger.error({ error }, 'Failed to update signature field');
    res.status(500).json({ success: false, error: 'Failed to update signature field' });
  }
}

export async function deleteField(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete sign fields' });
      return;
    }

    const userId = req.auth!.userId;
    const fieldId = req.params.fieldId as string;

    // Fields inherit ownership from their parent document.
    const field = await signService.getFieldWithOwner(fieldId);
    if (!field || !field.ownerUserId) {
      res.status(404).json({ success: false, error: 'Field not found' });
      return;
    }
    const decision = decideRecordDelete(perm.role, field.ownerUserId, userId);
    if (decision === 'forbid') {
      res.status(403).json({ success: false, error: 'No permission to delete sign fields' });
      return;
    }
    if (decision === 'not_own') {
      res.status(404).json({ success: false, error: 'Field not found' });
      return;
    }

    await signService.deleteField(fieldId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete signature field');
    res.status(500).json({ success: false, error: 'Failed to delete signature field' });
  }
}

// ─── Token CRUD ─────────────────────────────────────────────────────

export async function createSigningToken(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create signing tokens' });
      return;
    }

    const documentId = req.params.id as string;
    const { email, name, expiresInDays, signingOrder, role, customSubject, customMessage } = req.body;

    if (!email) {
      res.status(400).json({ success: false, error: 'email is required' });
      return;
    }

    const validRoles = ['signer', 'viewer', 'approver', 'cc'];
    const tokenRole = validRoles.includes(role) ? role : 'signer';

    const token = await signService.createSigningToken(
      documentId, email, name || null, expiresInDays || 30,
      typeof signingOrder === 'number' ? signingOrder : 0,
      tokenRole, customSubject || undefined, customMessage || undefined,
    );

    if (req.auth!.tenantId) {
      const doc = await signService.getDocument(req.auth!.userId, documentId);
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId: req.auth!.userId,
        appId: 'sign',
        eventType: 'document.sent_for_signing',
        title: `sent ${doc?.title ?? 'a document'} for signing to ${email}`,
        metadata: { documentId, signerEmail: email },
      }).catch(() => {});
    }

    res.json({ success: true, data: token });
  } catch (error) {
    logger.error({ error }, 'Failed to create signing token');
    res.status(500).json({ success: false, error: 'Failed to create signing token' });
  }
}

export async function listSigningTokens(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view signing tokens' });
      return;
    }

    const documentId = req.params.id as string;
    const tokens = await signService.listSigningTokens(documentId);
    res.json({ success: true, data: { tokens } });
  } catch (error) {
    logger.error({ error }, 'Failed to list signing tokens');
    res.status(500).json({ success: false, error: 'Failed to list signing tokens' });
  }
}

// ─── Public Endpoints (no auth) ─────────────────────────────────────

export async function getByToken(req: Request, res: Response) {
  try {
    const token = req.params.token as string;
    const result = await signService.getSigningToken(token);

    if (!result || !result.document) {
      res.status(404).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    if (new Date(result.token.expiresAt) < new Date()) {
      res.status(410).json({ success: false, error: 'Token has expired' });
      return;
    }

    const fields = await signService.listFields(result.document.id);
    const doc = result.document;

    res.json({
      success: true,
      data: {
        token: {
          id: result.token.id,
          signerEmail: result.token.signerEmail,
          signerName: result.token.signerName,
          status: result.token.status,
          role: result.token.role ?? 'signer',
          signingOrder: result.token.signingOrder,
          expiresAt: result.token.expiresAt,
        },
        document: {
          id: doc.id, title: doc.title, fileName: doc.fileName,
          pageCount: doc.pageCount, status: doc.status,
          redirectUrl: doc.redirectUrl ?? null,
        },
        fields,
        waitingForPrevious: result.waitingForPrevious,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get document by token');
    res.status(500).json({ success: false, error: 'Failed to get document by token' });
  }
}

export async function signByToken(req: Request, res: Response) {
  try {
    const token = req.params.token as string;
    const { fieldId, signatureData } = req.body;

    if (!fieldId || !signatureData) {
      res.status(400).json({ success: false, error: 'fieldId and signatureData are required' });
      return;
    }

    const result = await signService.getSigningToken(token);

    if (!result || !result.document) {
      res.status(404).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    if (new Date(result.token.expiresAt) < new Date()) {
      res.status(410).json({ success: false, error: 'Token has expired' });
      return;
    }

    if (result.token.status === 'signed') {
      res.status(409).json({ success: false, error: 'Token has already been used' });
      return;
    }

    if (result.waitingForPrevious) {
      res.status(403).json({ success: false, error: 'Waiting for previous signer to complete' });
      return;
    }

    const field = await signService.signField(fieldId, signatureData);
    await signService.completeSigningToken(result.token.id);
    const isComplete = await signService.checkDocumentComplete(result.document.id);

    res.json({
      success: true,
      data: { field, documentComplete: isComplete },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to sign by token');
    res.status(500).json({ success: false, error: 'Failed to sign by token' });
  }
}

export async function declineByToken(req: Request, res: Response) {
  try {
    const token = req.params.token as string;
    const { reason } = req.body;

    const result = await signService.getSigningToken(token);

    if (!result || !result.document) {
      res.status(404).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    if (new Date(result.token.expiresAt) < new Date()) {
      res.status(410).json({ success: false, error: 'Token has expired' });
      return;
    }

    if (result.token.status !== 'pending') {
      res.status(409).json({ success: false, error: 'Token has already been used or declined' });
      return;
    }

    await signService.declineSigningToken(result.token.id, reason || null);

    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to decline signing');
    res.status(500).json({ success: false, error: 'Failed to decline signing' });
  }
}

export async function viewPDFByToken(req: Request, res: Response) {
  try {
    const token = req.params.token as string;
    const result = await signService.getSigningToken(token);

    if (!result || !result.document) {
      res.status(404).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    if (new Date(result.token.expiresAt) < new Date()) {
      res.status(410).json({ success: false, error: 'Token has expired' });
      return;
    }

    const doc = result.document;
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
    logger.error({ error }, 'Failed to view PDF by token');
    res.status(500).json({ success: false, error: 'Failed to view PDF by token' });
  }
}

// ─── Template CRUD ──────────────────────────────────────────────────

export async function listTemplates(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view sign templates' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const templates = await signService.listTemplates(userId, tenantId);
    res.json({ success: true, data: { templates } });
  } catch (error) {
    logger.error({ error }, 'Failed to list sign templates');
    res.status(500).json({ success: false, error: 'Failed to list sign templates' });
  }
}

export async function createTemplate(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create sign templates' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { title, fileName, storagePath, pageCount, fields } = req.body;

    if (!title || !fileName || !storagePath) {
      res.status(400).json({ success: false, error: 'title, fileName, and storagePath are required' });
      return;
    }

    const template = await signService.createTemplate(userId, tenantId, {
      title, fileName, storagePath, pageCount, fields,
    });
    res.json({ success: true, data: template });
  } catch (error) {
    logger.error({ error }, 'Failed to create sign template');
    res.status(500).json({ success: false, error: 'Failed to create sign template' });
  }
}

export async function useTemplate(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create sign documents' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const templateId = req.params.id as string;
    const { title } = req.body;

    const doc = await signService.createDocumentFromTemplate(userId, tenantId, templateId, title);
    res.json({ success: true, data: doc });
  } catch (error) {
    logger.error({ error }, 'Failed to create document from template');
    res.status(500).json({ success: false, error: 'Failed to create document from template' });
  }
}

export async function saveAsTemplate(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create sign templates' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const documentId = req.params.id as string;
    const { title } = req.body;

    const template = await signService.saveAsTemplate(userId, tenantId, documentId, title);
    res.json({ success: true, data: template });
  } catch (error) {
    logger.error({ error }, 'Failed to save document as template');
    res.status(500).json({ success: false, error: 'Failed to save document as template' });
  }
}

export async function seedStarterTemplates(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    const perm = await getAppPermission(tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create sign templates' });
      return;
    }

    const userId = req.auth!.userId;

    const result = await signService.seedStarterTemplates(userId, tenantId);
    res.json({
      success: true,
      data: {
        created: result.created,
        skipped: result.skipped,
        failed: result.failed,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to seed starter sign templates');
    res.status(500).json({ success: false, error: 'Failed to seed starter sign templates' });
  }
}

export async function deleteTemplate(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'sign');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete sign templates' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const templateId = req.params.id as string;

    const existing = await signService.getSignTemplateById(templateId);
    // Templates are tenant-scoped; reject cross-tenant access outright.
    if (!existing || existing.tenantId !== tenantId) {
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }
    const decision = decideRecordDelete(perm.role, existing.userId, userId);
    if (decision === 'forbid') {
      res.status(403).json({ success: false, error: 'No permission to delete sign templates' });
      return;
    }
    if (decision === 'not_own') {
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }

    await signService.deleteTemplate(userId, tenantId, templateId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete sign template');
    res.status(500).json({ success: false, error: 'Failed to delete sign template' });
  }
}
