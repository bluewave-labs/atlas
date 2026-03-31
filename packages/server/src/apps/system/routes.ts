import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import * as systemController from './controller';
import { authMiddleware } from '../../middleware/auth';

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.auth?.isSuperAdmin) {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }
  next();
}

const router = Router();
router.use(authMiddleware);

router.get('/metrics', systemController.getMetrics);
router.get('/email-settings', requireAdmin, systemController.getEmailSettings);
router.put('/email-settings', requireAdmin, systemController.updateEmailSettings);
router.post('/email-test', requireAdmin, systemController.testEmail);

export default router;
