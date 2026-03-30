import { Router } from 'express';
import * as systemController from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/metrics', systemController.getMetrics);

export default router;
