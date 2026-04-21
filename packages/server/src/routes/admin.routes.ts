import { Router } from 'express';
import { adminAuthMiddleware } from '../middleware/admin-auth';
import {
  createTenant,
  getOverview,
  listTenants,
  getTenant,
  updateTenantStatus,
  updateTenantPlanHandler,
  updateTenantStorageQuota,
  listAllUsers,
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
router.put('/tenants/:id/storage-quota', updateTenantStorageQuota);
router.get('/users', listAllUsers);

export default router;
