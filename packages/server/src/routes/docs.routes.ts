import { Router } from 'express';
import * as documentController from '../controllers/document.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', documentController.listDocuments);
router.post('/', documentController.createDocument);
router.get('/search', documentController.searchDocuments);

// Import (must be before /:id to avoid route conflicts)
router.post('/import', documentController.importDocument);

// Comments on specific paths (must be before /:id to avoid conflicts)
router.patch('/comments/:commentId', documentController.updateComment);
router.delete('/comments/:commentId', documentController.deleteComment);
router.patch('/comments/:commentId/resolve', documentController.resolveComment);

router.get('/:id', documentController.getDocument);
router.patch('/:id', documentController.updateDocument);
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
