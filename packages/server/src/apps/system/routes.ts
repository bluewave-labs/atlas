// System app routes — two distinct admin gates live in this file:
//
//   1. `requireAdmin` ("tenant admin or better") guards operational routes
//      like metrics and email settings. Tenant admins are expected to
//      diagnose the running system (SMTP, CPU, disk) without being able to
//      reassign each others' roles.
//
//   2. `requireTenantOwner` ("tenant owner only") guards the permissions
//      management grid. Reassigning RBAC is a privileged operation reserved
//      for the single owner; regular admins must not be able to promote
//      themselves or each other.
//
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import * as systemController from './controller';
import * as permissionsController from './permissions.controller';
import { authMiddleware } from '../../middleware/auth';

// Allow the tenant owner or a tenant admin. In single-tenant self-hosted
// Atlas, tenant owner is effectively the operator, so gating routine system
// tasks (metrics, SMTP config) strictly on the owner was over-restrictive.
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const allowed =
    req.auth?.tenantRole === 'owner' ||
    req.auth?.tenantRole === 'admin';
  if (!allowed) {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }
  next();
}

// Only the tenant owner can view/edit the unified permissions grid. Regular
// admins can manage system metrics and SMTP, but per-user RBAC is a privileged
// operation reserved for the owner.
function requireTenantOwner(req: Request, res: Response, next: NextFunction) {
  const allowed = req.auth?.tenantRole === 'owner';
  if (!allowed) {
    res.status(403).json({ success: false, error: 'Owner access required' });
    return;
  }
  next();
}

const router = Router();
router.use(authMiddleware);

router.get('/metrics', requireAdmin, systemController.getMetrics);
router.get('/email-settings', requireAdmin, systemController.getEmailSettings);
router.put('/email-settings', requireAdmin, systemController.updateEmailSettings);
router.post('/email-test', requireAdmin, systemController.testEmail);

// Unified app permissions grid (owner-only)
router.get('/permissions', requireTenantOwner, permissionsController.listPermissions);
router.put('/permissions/:userId/:appId', requireTenantOwner, permissionsController.setPermission);
router.delete('/permissions/:userId/:appId', requireTenantOwner, permissionsController.revertPermission);

export default router;
