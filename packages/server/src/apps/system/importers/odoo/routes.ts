import { Router } from 'express';
import multer from 'multer';
import type { Request, Response, NextFunction } from 'express';
import { isTenantOwner } from '@atlas-platform/shared';
import { authMiddleware } from '../../../../middleware/auth';
import * as controller from './controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 3 },
});

function requireTenantOwner(req: Request, res: Response, next: NextFunction) {
  if (!isTenantOwner(req.auth?.tenantRole)) {
    res.status(403).json({ success: false, error: 'Owner access required' });
    return;
  }
  next();
}

const router = Router();
router.use(authMiddleware);
router.use(requireTenantOwner);

router.post(
  '/preview',
  upload.fields([
    { name: 'partners', maxCount: 1 },
    { name: 'leads', maxCount: 1 },
    { name: 'activities', maxCount: 1 },
  ]),
  controller.previewOdoo,
);
router.post('/commit', controller.commitOdoo);

export default router;
