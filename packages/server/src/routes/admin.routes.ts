import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/admin-auth';
import {
  createTenant,
  getOverview,
  listTenants,
  getTenant,
  updateTenantStatus,
  updateTenantPlanHandler,
  listAllInstallations,
  startInstallation,
  stopInstallation,
  restartInstallation,
  listContainers,
} from '../controllers/admin.controller';

const router = Router();

// All routes require super admin auth
router.use(adminAuthMiddleware);
router.get('/overview', getOverview);
router.get('/tenants', listTenants);
router.post('/tenants', createTenant);
router.get('/tenants/:id', getTenant);
router.put('/tenants/:id/status', updateTenantStatus);
router.put('/tenants/:id/plan', updateTenantPlanHandler);
router.get('/installations', listAllInstallations);
router.post('/installations/:id/start', startInstallation);
router.post('/installations/:id/stop', stopInstallation);
router.post('/installations/:id/restart', restartInstallation);
router.get('/containers', listContainers);

export default router;
