import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import * as controller from './controller';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Catalog & installed (visible to all authenticated users)
router.get('/catalog', controller.getCatalog);
router.get('/installed', controller.getInstalled);

// App lifecycle (admin-only checks are handled inside each controller)
router.post('/:appId/deploy', controller.deploy);
router.post('/:appId/start', controller.start);
router.post('/:appId/stop', controller.stop);
router.post('/:appId/update', controller.update);
router.delete('/:appId', controller.remove);

// Status & logs
router.get('/:appId/status', controller.getStatus);
router.get('/:appId/logs', controller.getLogs);

export { router as marketplaceRouter };
