import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/platform.controller';

const router = Router();
router.use(authMiddleware);

// ─── Tenants ─────────────────────────────────────────────────────────
router.post('/tenants', ctrl.createTenant);
router.get('/tenants', ctrl.listMyTenants);
router.get('/tenants/:id', ctrl.getTenant);

// ─── Tenant Users ───────────────────────────────────────────────────
router.get('/tenants/:id/users', ctrl.listTenantUsers);
router.post('/tenants/:id/users', ctrl.createTenantUser);
router.delete('/tenants/:id/users/:userId', ctrl.removeTenantUser);
router.put('/tenants/:id/users/:userId/role', ctrl.updateTenantUserRole);
router.post('/tenants/:id/invitations', ctrl.inviteTenantUser);

// ─── Tenant Apps ────────────────────────────────────────────────────
router.get('/tenants/:id/apps', ctrl.listTenantApps);
router.post('/tenants/:id/apps/:appId/enable', ctrl.enableTenantApp);
router.post('/tenants/:id/apps/:appId/disable', ctrl.disableTenantApp);

export default router;
