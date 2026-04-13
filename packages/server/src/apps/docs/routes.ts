import { Router, Request, Response, NextFunction } from 'express';
import * as documentController from './controller';
import { authMiddleware } from '../../middleware/auth';
import { requireAppPermission } from '../../middleware/require-app-permission';
import { withConcurrencyCheck } from '../../middleware/concurrency-check';
import { documents } from '../../db/schema';
import { isTenantAdmin } from '@atlas-platform/shared';

function requireSeedAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isTenantAdmin(req.auth?.tenantRole)) {
    res.status(403).json({ success: false, error: 'Only organization admins can seed demo data' });
    return;
  }
  next();
}

const router = Router();
router.use(authMiddleware);
router.use(requireAppPermission('docs'));

router.get('/', documentController.listDocuments);
router.post('/', documentController.createDocument);
router.get('/search', documentController.searchDocuments);

// Seed sample data
router.post('/seed', requireSeedAdmin, documentController.seedSampleData);

// Import (must be before /:id to avoid route conflicts)
router.post('/import', documentController.importDocument);

// Comments on specific paths (must be before /:id to avoid conflicts)
router.patch('/comments/:commentId', documentController.updateComment);
router.delete('/comments/:commentId', documentController.deleteComment);
router.patch('/comments/:commentId/resolve', documentController.resolveComment);

router.get('/:id', documentController.getDocument);
router.patch('/:id', withConcurrencyCheck(documents), documentController.updateDocument);
router.patch('/:id/visibility', documentController.updateDocumentVisibility);
router.delete('/:id', documentController.deleteDocument);
router.patch('/:id/move', documentController.moveDocument);
router.patch('/:id/restore', documentController.restoreDocument);
router.get('/:id/versions', documentController.listVersions);
router.post('/:id/versions', documentController.createVersion);
router.post('/:id/versions/:versionId/restore', documentController.restoreVersion);

// Comments (nested under document)
router.get('/:id/comments', documentController.listComments);
router.post('/:id/comments', documentController.createComment);

// Backlinks
router.get('/:id/backlinks', documentController.getBacklinks);

export default router;
