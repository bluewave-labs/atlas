import type { Request, Response } from 'express';
import * as documentService from './service';
import { logger } from '../../utils/logger';
import { getAppPermission, canAccess, decideRecordDelete } from '../../services/app-permissions.service';
import { parseMentionsAndNotify } from '../../utils/mentions';

// GET /api/docs
export async function listDocuments(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'docs');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view docs' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const includeArchived = req.query.includeArchived === 'true';

    const docs = await documentService.listDocuments(userId, includeArchived, req.auth!.tenantId ?? null);
    const tree = documentService.buildDocumentTree(docs);

    res.json({ success: true, data: { documents: docs, tree } });
  } catch (error) {
    logger.error({ error }, 'Failed to list documents');
    res.status(500).json({ success: false, error: 'Failed to list documents' });
  }
}

// POST /api/docs
export async function createDocument(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'docs');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create docs' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { parentId, title, icon, content } = req.body;

    const doc = await documentService.createDocument(userId, tenantId, {
      parentId,
      title,
      icon,
      content,
    });

    res.json({ success: true, data: doc });
  } catch (error) {
    logger.error({ error }, 'Failed to create document');
    res.status(500).json({ success: false, error: 'Failed to create document' });
  }
}

// GET /api/docs/:id
export async function getDocument(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'docs');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view docs' });
      return;
    }

    const userId = req.auth!.userId;
    const documentId = req.params.id as string;

    const doc = await documentService.getDocument(userId, documentId, req.auth!.tenantId ?? null);

    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    res.json({ success: true, data: doc });
  } catch (error) {
    logger.error({ error }, 'Failed to get document');
    res.status(500).json({ success: false, error: 'Failed to get document' });
  }
}

// PATCH /api/docs/:id
export async function updateDocument(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'docs');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update docs' });
      return;
    }

    const userId = req.auth!.userId;
    const documentId = req.params.id as string;
    const { title, content, icon, coverImage, parentId, isArchived } = req.body;

    const doc = await documentService.updateDocument(userId, documentId, {
      title,
      content,
      icon,
      coverImage,
      parentId,
      isArchived,
    });

    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    res.json({ success: true, data: doc });
  } catch (error) {
    logger.error({ error }, 'Failed to update document');
    res.status(500).json({ success: false, error: 'Failed to update document' });
  }
}

// DELETE /api/docs/:id (soft delete)
export async function deleteDocument(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'docs');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete docs' });
      return;
    }

    const userId = req.auth!.userId;
    const documentId = req.params.id as string;

    // Load the record first so we can enforce real ownership for delete_own.
    const existing = await documentService.getDocument(userId, documentId, req.auth!.tenantId ?? null);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    const decision = decideRecordDelete(perm.role, existing.userId, userId);
    if (decision === 'forbid') {
      res.status(403).json({ success: false, error: 'No permission to delete docs' });
      return;
    }
    if (decision === 'not_own') {
      // Editor trying to delete someone else's doc — 404, not 403, so we
      // don't leak existence of records they cannot touch.
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    await documentService.deleteDocument(existing.userId, documentId);

    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete document');
    res.status(500).json({ success: false, error: 'Failed to delete document' });
  }
}

// PATCH /api/docs/:id/move
export async function moveDocument(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'docs');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update docs' });
      return;
    }

    const userId = req.auth!.userId;
    const documentId = req.params.id as string;
    const { parentId, sortOrder } = req.body;

    if (typeof sortOrder !== 'number') {
      res.status(400).json({ success: false, error: 'sortOrder must be a number' });
      return;
    }

    const doc = await documentService.moveDocument(userId, documentId, {
      parentId: parentId ?? null,
      sortOrder,
    });

    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    res.json({ success: true, data: doc });
  } catch (error: any) {
    if (error.message?.includes('descendants')) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    logger.error({ error }, 'Failed to move document');
    res.status(500).json({ success: false, error: 'Failed to move document' });
  }
}

// PATCH /api/docs/:id/restore
export async function restoreDocument(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'docs');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete docs' });
      return;
    }

    const userId = req.auth!.userId;
    const documentId = req.params.id as string;

    // Mirror deleteDocument ownership rules: editors can only restore their own.
    const existing = await documentService.getDocument(userId, documentId, req.auth!.tenantId ?? null);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }
    const decision = decideRecordDelete(perm.role, existing.userId, userId);
    if (decision === 'forbid') {
      res.status(403).json({ success: false, error: 'No permission to delete docs' });
      return;
    }
    if (decision === 'not_own') {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    const doc = await documentService.restoreDocument(existing.userId, documentId);

    if (!doc) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    res.json({ success: true, data: doc });
  } catch (error) {
    logger.error({ error }, 'Failed to restore document');
    res.status(500).json({ success: false, error: 'Failed to restore document' });
  }
}

// GET /api/docs/search?q=...
export async function searchDocuments(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'docs');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view docs' });
      return;
    }

    const userId = req.auth!.userId;
    const query = (req.query.q as string) || '';

    if (!query.trim()) {
      res.json({ success: true, data: [] });
      return;
    }

    const results = await documentService.searchDocuments(userId, query.trim());
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error({ error }, 'Failed to search documents');
    res.status(500).json({ success: false, error: 'Failed to search documents' });
  }
}

// GET /api/docs/:id/versions
export async function listVersions(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'docs');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view docs' });
      return;
    }

    const userId = req.auth!.userId;
    const documentId = req.params.id as string;

    const versions = await documentService.listVersions(userId, documentId);
    res.json({ success: true, data: versions });
  } catch (error) {
    logger.error({ error }, 'Failed to list versions');
    res.status(500).json({ success: false, error: 'Failed to list versions' });
  }
}

// POST /api/docs/:id/versions (create a snapshot)
export async function createVersion(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'docs');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update docs' });
      return;
    }

    const userId = req.auth!.userId;
    const documentId = req.params.id as string;

    const version = await documentService.createVersion(userId, documentId);
    if (!version) {
      res.status(404).json({ success: false, error: 'Document not found' });
      return;
    }

    res.json({ success: true, data: version });
  } catch (error) {
    logger.error({ error }, 'Failed to create version');
    res.status(500).json({ success: false, error: 'Failed to create version' });
  }
}

// POST /api/docs/:id/versions/:versionId/restore
export async function restoreVersion(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'docs');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update docs' });
      return;
    }

    const userId = req.auth!.userId;
    const documentId = req.params.id as string;
    const versionId = req.params.versionId as string;

    const doc = await documentService.restoreVersion(userId, documentId, versionId);
    if (!doc) {
      res.status(404).json({ success: false, error: 'Version not found' });
      return;
    }

    res.json({ success: true, data: doc });
  } catch (error) {
    logger.error({ error }, 'Failed to restore version');
    res.status(500).json({ success: false, error: 'Failed to restore version' });
  }
}

// ─── Seed sample data ───────────────────────────────────────────────

export async function seedSampleData(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const result = await documentService.seedSampleDocuments(userId, tenantId);
    res.json({ success: true, data: { message: 'Seeded Docs sample data', ...result } });
  } catch (error) {
    logger.error({ error }, 'Failed to seed Docs sample data');
    res.status(500).json({ success: false, error: 'Failed to seed Docs sample data' });
  }
}

// ─── Comments ────────────────────────────────────────────────────────

export async function listComments(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'docs');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view docs' });
      return;
    }

    const comments = await documentService.listComments(req.auth!.userId, req.params.id as string);
    res.json({ success: true, data: comments });
  } catch (error) {
    logger.error({ error }, 'Failed to list comments');
    res.status(500).json({ success: false, error: 'Failed to list comments' });
  }
}

export async function createComment(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'docs');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create in docs' });
      return;
    }

    const comment = await documentService.createComment(req.auth!.userId, req.auth!.tenantId, req.params.id as string, req.body);
    res.json({ success: true, data: comment });

    // Fire-and-forget: parse @mentions and create notifications
    const commentContent = req.body?.content || '';
    if (req.auth?.tenantId && commentContent) {
      const authorEmail = req.auth.email || '';
      const authorName = authorEmail.split('@')[0] || 'Someone';
      parseMentionsAndNotify({
        body: commentContent,
        tenantId: req.auth.tenantId,
        authorUserId: req.auth.userId,
        authorName,
        sourceApp: 'docs',
        sourceRecordId: req.params.id as string,
      }).catch(() => {});
    }
  } catch (error) {
    logger.error({ error }, 'Failed to create comment');
    res.status(500).json({ success: false, error: 'Failed to create comment' });
  }
}

export async function updateComment(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'docs');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update docs' });
      return;
    }

    const comment = await documentService.updateComment(req.auth!.userId, req.params.commentId as string, req.body);
    if (!comment) { res.status(404).json({ success: false, error: 'Comment not found' }); return; }
    res.json({ success: true, data: comment });
  } catch (error) {
    logger.error({ error }, 'Failed to update comment');
    res.status(500).json({ success: false, error: 'Failed to update comment' });
  }
}

export async function deleteComment(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'docs');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete in docs' });
      return;
    }

    const userId = req.auth!.userId;
    const commentId = req.params.commentId as string;

    const existing = await documentService.getCommentById(commentId);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Comment not found' });
      return;
    }
    const decision = decideRecordDelete(perm.role, existing.userId, userId);
    if (decision === 'forbid') {
      res.status(403).json({ success: false, error: 'No permission to delete in docs' });
      return;
    }
    if (decision === 'not_own') {
      res.status(404).json({ success: false, error: 'Comment not found' });
      return;
    }

    // Admin path bypasses the per-user scoped deleteComment by id only.
    await documentService.deleteCommentById(commentId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete comment');
    res.status(500).json({ success: false, error: 'Failed to delete comment' });
  }
}

export async function resolveComment(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'docs');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update docs' });
      return;
    }

    const comment = await documentService.resolveComment(req.auth!.userId, req.params.commentId as string);
    if (!comment) { res.status(404).json({ success: false, error: 'Comment not found' }); return; }
    res.json({ success: true, data: comment });
  } catch (error) {
    logger.error({ error }, 'Failed to resolve comment');
    res.status(500).json({ success: false, error: 'Failed to resolve comment' });
  }
}

// ─── Backlinks ───────────────────────────────────────────────────────

export async function getBacklinks(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'docs');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view docs' });
      return;
    }

    const backlinks = await documentService.getBacklinks(req.auth!.userId, req.params.id as string);
    res.json({ success: true, data: backlinks });
  } catch (error) {
    logger.error({ error }, 'Failed to get backlinks');
    res.status(500).json({ success: false, error: 'Failed to get backlinks' });
  }
}

// ─── Import ──────────────────────────────────────────────────────────

export async function importDocument(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'docs');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create in docs' });
      return;
    }

    // Simple import: accept { html, title } from client
    // Client handles file conversion (mammoth for docx, marked for md)
    const { html, title } = req.body;
    const doc = await documentService.createDocument(req.auth!.userId, req.auth!.tenantId, {
      title: title || 'Imported document',
      content: html ? { _html: html } : null,
    });
    res.json({ success: true, data: doc });
  } catch (error) {
    logger.error({ error }, 'Failed to import document');
    res.status(500).json({ success: false, error: 'Failed to import document' });
  }
}

// ─── Visibility ─────────────────────────────────────────────────────

export async function updateDocumentVisibility(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const documentId = req.params.id as string;
    const { visibility } = req.body;

    if (visibility !== 'private' && visibility !== 'team') {
      res.status(400).json({ success: false, error: 'Visibility must be "private" or "team"' });
      return;
    }

    await documentService.updateDocumentVisibility(userId, documentId, visibility);
    res.json({ success: true, data: null });
  } catch (error: any) {
    if (error.message === 'Tenant required for team visibility') {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    logger.error({ error }, 'Failed to update document visibility');
    res.status(500).json({ success: false, error: 'Failed to update document visibility' });
  }
}
