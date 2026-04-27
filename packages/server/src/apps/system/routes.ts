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
import { isTenantAdmin, isTenantOwner } from '@atlas-platform/shared';
import * as systemController from './controller';
import * as permissionsController from './permissions.controller';
import { authMiddleware } from '../../middleware/auth';
import odooImporterRouter from './importers/odoo/routes';

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isTenantAdmin(req.auth?.tenantRole)) {
    res.status(403).json({ success: false, error: 'Admin access required' });
    return;
  }
  next();
}

function requireTenantOwner(req: Request, res: Response, next: NextFunction) {
  if (!isTenantOwner(req.auth?.tenantRole)) {
    res.status(403).json({ success: false, error: 'Owner access required' });
    return;
  }
  next();
}

const router = Router();
router.use(authMiddleware);

router.use('/importers/odoo', odooImporterRouter);

// Product tour — every authenticated tenant member can read and mark their own tour.
router.get('/tour', systemController.getTour);
router.patch('/tour/complete', systemController.completeTour);

router.get('/metrics', requireAdmin, systemController.getMetrics);
router.get('/email-settings', requireAdmin, systemController.getEmailSettings);
router.put('/email-settings', requireAdmin, systemController.updateEmailSettings);
router.post('/email-test', requireAdmin, systemController.testEmail);

// Unified app permissions grid (owner-only)
router.get('/permissions', requireTenantOwner, permissionsController.listPermissions);
router.get('/permissions/audit', requireTenantOwner, permissionsController.listAudit);
router.put('/permissions/:userId/:appId', requireTenantOwner, permissionsController.setPermission);
router.delete('/permissions/:userId/:appId', requireTenantOwner, permissionsController.revertPermission);

export default router;
