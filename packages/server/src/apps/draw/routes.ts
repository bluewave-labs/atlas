import { Router, Request, Response, NextFunction } from 'express';
import * as drawingController from './controller';
import { authMiddleware } from '../../middleware/auth';
import { requireAppPermission } from '../../middleware/require-app-permission';
import { withConcurrencyCheck } from '../../middleware/concurrency-check';
import { drawings } from '../../db/schema';
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
router.use(requireAppPermission('draw'));

router.post('/seed', requireSeedAdmin, drawingController.seedSampleData);
router.get('/', drawingController.listDrawings);
router.post('/', drawingController.createDrawing);
router.get('/search', drawingController.searchDrawings);
router.get('/:id', drawingController.getDrawing);
router.patch('/:id', withConcurrencyCheck(drawings), drawingController.updateDrawing);
router.patch('/:id/visibility', withConcurrencyCheck(drawings), drawingController.updateDrawingVisibility);
router.delete('/:id', drawingController.deleteDrawing);
router.patch('/:id/restore', drawingController.restoreDrawing);

export default router;
