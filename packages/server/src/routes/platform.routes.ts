import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as ctrl from '../controllers/platform.controller';

const router = Router();
router.use(authMiddleware);

// ─── Catalog (public browsing for authenticated users) ───────────────
router.get('/catalog', ctrl.listCatalog);
router.get('/catalog/:manifestId', ctrl.getCatalogApp);

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

// ─── Installations ──────────────────────────────────────────────────
router.get('/tenants/:id/installations', ctrl.listInstallations);
router.post('/tenants/:id/installations', ctrl.installApp);
router.get('/tenants/:id/installations/:iid', ctrl.getInstallation);
router.post('/tenants/:id/installations/:iid/start', ctrl.startApp);
router.post('/tenants/:id/installations/:iid/stop', ctrl.stopApp);
router.post('/tenants/:id/installations/:iid/restart', ctrl.restartApp);
router.post('/tenants/:id/installations/:iid/backup', ctrl.createBackup);
router.get('/tenants/:id/installations/:iid/backups', ctrl.listBackups);
router.delete('/tenants/:id/installations/:iid', ctrl.uninstallApp);

// ─── App Assignments ───────────────────────────────────────────────
router.get('/tenants/:id/installations/:iid/assignments', ctrl.listAssignments);
router.post('/tenants/:id/installations/:iid/assignments', ctrl.assignUser);
router.put('/tenants/:id/installations/:iid/assignments/:userId', ctrl.updateAssignment);
router.delete('/tenants/:id/installations/:iid/assignments/:userId', ctrl.removeAssignment);

export default router;
