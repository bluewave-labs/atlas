import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import * as systemController from './controller';
import * as permissionsController from './permissions.controller';
import { authMiddleware } from '../../middleware/auth';

// Allow super admin OR the tenant owner/admin. In single-tenant self-hosted
// Atlas, super admin and tenant owner are effectively the same person, so
// gating strictly on isSuperAdmin was over-restrictive for routine system
// tasks (metrics, SMTP config).
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const allowed =
    req.auth?.isSuperAdmin ||
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
  const allowed =
    req.auth?.isSuperAdmin ||
    req.auth?.tenantRole === 'owner';
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
