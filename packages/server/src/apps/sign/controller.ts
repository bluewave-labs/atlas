import type { Request, Response } from 'express';
import * as signService from './service';
import { logger } from '../../utils/logger';
import { emitAppEvent } from '../../services/event.service';
import path from 'node:path';
import { existsSync, createReadStream, statSync } from 'node:fs';

const UPLOADS_DIR = path.join(__dirname, '../../../uploads');

// ─── Widget ─────────────────────────────────────────────────────────

export async function getWidgetData(req: Request, res: Response) {
  try {
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

// GET /api/sign
export async function listDocuments(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const docs = await signService.listDocuments(userId, accountId);
    res.json({ success: true, data: { documents: docs } });
  } catch (error) {
    logger.error({ error }, 'Failed to list signature documents');
    res.status(500).json({ success: false, error: 'Failed to list signature documents' });
  }
}

// POST /api/sign
export async function createDocument(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { title, fileName, storagePath, pageCount, status, expiresAt, tags } = req.body;

    if (!title || !fileName || !storagePath) {
      res.status(400).json({ success: false, error: 'title, fileName, and storagePath are required' });
      return;
    }

    const doc = await signService.createDocument(userId, accountId, {
      title,
      fileName,
      storagePath,
      pageCount,
      status,
      expiresAt,
      tags,
    });
    res.json({ success: true, data: doc });
  } catch (error) {
    logger.error({ error }, 'Failed to create signature document');
    res.status(500).json({ success: false, error: 'Failed to create signature document' });
  }
}

// POST /api/sign/upload
export async function uploadPDF(req: Request, res: Response) {
  try {
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
      title,
      fileName: decodedName,
      storagePath: file.filename,
      pageCount,
    });

    res.json({ success: true, data: doc });
  } catch (error) {
    logger.error({ error }, 'Failed to upload PDF');
    res.status(500).json({ success: false, error: 'Failed to upload PDF' });
  }
}

// GET /api/sign/:id
export async function getDocument(req: Request, res: Response) {
  try {
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

// PUT /api/sign/:id
export async function updateDocument(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const documentId = req.params.id as string;
    const { title, status, expiresAt, tags, pageCount } = req.body;

    const doc = await signService.updateDocument(userId, documentId, {
      title,
      status,
      expiresAt,
      tags,
      pageCount,
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

// DELETE /api/sign/:id
export async function deleteDocument(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const documentId = req.params.id as string;

    await signService.deleteDocument(userId, documentId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete signature document');
    res.status(500).json({ success: false, error: 'Failed to delete signature document' });
  }
}

// GET /api/sign/:id/view
export async function viewPDF(req: Request, res: Response) {
  try {
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

// GET /api/sign/:id/download
export async function downloadPDF(req: Request, res: Response) {
  try {
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

    // Generate flattened PDF with signatures embedded
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

// POST /api/sign/:id/void
export async function voidDocument(req: Request, res: Response) {
  try {
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

// ─── Field CRUD ─────────────────────────────────────────────────────

// GET /api/sign/:id/fields
export async function listFields(req: Request, res: Response) {
  try {
    const documentId = req.params.id as string;
    const fields = await signService.listFields(documentId);
    res.json({ success: true, data: { fields } });
  } catch (error) {
    logger.error({ error }, 'Failed to list signature fields');
    res.status(500).json({ success: false, error: 'Failed to list signature fields' });
  }
}

// POST /api/sign/:id/fields
export async function createField(req: Request, res: Response) {
  try {
    const documentId = req.params.id as string;
    const { type, pageNumber, x, y, width, height, signerEmail, label, required, sortOrder } = req.body;

    if (x === undefined || y === undefined || width === undefined || height === undefined) {
      res.status(400).json({ success: false, error: 'x, y, width, and height are required' });
      return;
    }

    const field = await signService.createField({
      documentId,
      type,
      pageNumber,
      x,
      y,
      width,
      height,
      signerEmail,
      label,
      required,
      sortOrder,
    });
    res.json({ success: true, data: field });
  } catch (error) {
    logger.error({ error }, 'Failed to create signature field');
    res.status(500).json({ success: false, error: 'Failed to create signature field' });
  }
}

// PUT /api/sign/fields/:fieldId
export async function updateField(req: Request, res: Response) {
  try {
    const fieldId = req.params.fieldId as string;
    const { type, pageNumber, x, y, width, height, signerEmail, label, required, sortOrder } = req.body;

    const field = await signService.updateField(fieldId, {
      type,
      pageNumber,
      x,
      y,
      width,
      height,
      signerEmail,
      label,
      required,
      sortOrder,
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

// DELETE /api/sign/fields/:fieldId
export async function deleteField(req: Request, res: Response) {
  try {
    const fieldId = req.params.fieldId as string;
    await signService.deleteField(fieldId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete signature field');
    res.status(500).json({ success: false, error: 'Failed to delete signature field' });
  }
}

// ─── Token CRUD ─────────────────────────────────────────────────────

// POST /api/sign/:id/tokens
export async function createSigningToken(req: Request, res: Response) {
  try {
    const documentId = req.params.id as string;
    const { email, name, expiresInDays } = req.body;

    if (!email) {
      res.status(400).json({ success: false, error: 'email is required' });
      return;
    }

    const token = await signService.createSigningToken(
      documentId,
      email,
      name || null,
      expiresInDays || 30,
    );

    if (req.auth!.tenantId) {
      // Fetch the document to get its title for the event message
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

// GET /api/sign/:id/tokens
export async function listSigningTokens(req: Request, res: Response) {
  try {
    const documentId = req.params.id as string;
    const tokens = await signService.listSigningTokens(documentId);
    res.json({ success: true, data: { tokens } });
  } catch (error) {
    logger.error({ error }, 'Failed to list signing tokens');
    res.status(500).json({ success: false, error: 'Failed to list signing tokens' });
  }
}

// ─── Public Endpoints (no auth) ─────────────────────────────────────

// GET /api/sign/public/:token
export async function getByToken(req: Request, res: Response) {
  try {
    const token = req.params.token as string;
    const result = await signService.getSigningToken(token);

    if (!result || !result.document) {
      res.status(404).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    // Check expiry
    if (new Date(result.token.expiresAt) < new Date()) {
      res.status(410).json({ success: false, error: 'Token has expired' });
      return;
    }

    // Get fields for this document
    const fields = await signService.listFields(result.document.id);

    // Get the PDF file path for viewing
    const doc = result.document;

    res.json({
      success: true,
      data: {
        token: {
          id: result.token.id,
          signerEmail: result.token.signerEmail,
          signerName: result.token.signerName,
          status: result.token.status,
          expiresAt: result.token.expiresAt,
        },
        document: {
          id: doc.id,
          title: doc.title,
          fileName: doc.fileName,
          pageCount: doc.pageCount,
          status: doc.status,
        },
        fields,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get document by token');
    res.status(500).json({ success: false, error: 'Failed to get document by token' });
  }
}

// POST /api/sign/public/:token/sign
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

    // Check expiry
    if (new Date(result.token.expiresAt) < new Date()) {
      res.status(410).json({ success: false, error: 'Token has expired' });
      return;
    }

    // Check token is not already used
    if (result.token.status === 'signed') {
      res.status(409).json({ success: false, error: 'Token has already been used' });
      return;
    }

    // Sign the field
    const field = await signService.signField(fieldId, signatureData);

    // Mark token as signed
    await signService.completeSigningToken(result.token.id);

    // Check if document is now complete
    const isComplete = await signService.checkDocumentComplete(result.document.id);

    res.json({
      success: true,
      data: {
        field,
        documentComplete: isComplete,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to sign by token');
    res.status(500).json({ success: false, error: 'Failed to sign by token' });
  }
}

// POST /api/sign/public/:token/decline
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

// GET /api/sign/public/:token/view — stream PDF for public signers
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
