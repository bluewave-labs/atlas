import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as appPermissionsService from '../services/app-permissions.service';
import type { AppRole, AppRecordAccess } from '../services/app-permissions.service';
import { logger } from '../utils/logger';
import { db } from '../config/database';
import { tenantMembers } from '../db/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();
router.use(authMiddleware);

/**
 * Helper: check if the requester is a tenant owner or admin.
 */
async function isTenantAdmin(tenantId: string, userId: string): Promise<boolean> {
  const [member] = await db.select().from(tenantMembers)
    .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
    .limit(1);
  return member?.role === 'owner' || member?.role === 'admin';
}

// GET /my-apps — list app IDs the current user has access to
router.get('/my-apps', async (req: Request, res: Response) => {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    if (!tenantId) {
      res.json({ success: true, data: { appIds: [], role: null } });
      return;
    }

    // Run both queries in parallel — discard perms if user is privileged
    const [memberResult, perms] = await Promise.all([
      db.select().from(tenantMembers)
        .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
        .limit(1),
      appPermissionsService.listUserPermissions(tenantId, userId),
    ]);

    const member = memberResult[0];
    if (!member) {
      res.json({ success: true, data: { appIds: [], role: null } });
      return;
    }

    const isPrivileged = member.role === 'owner' || member.role === 'admin';
    if (isPrivileged) {
      res.json({ success: true, data: { appIds: '__all__', role: member.role } });
      return;
    }

    const appIds = perms.map(p => p.appId);
    res.json({ success: true, data: { appIds, role: member.role } });
  } catch (err) {
    logger.error({ err }, 'Failed to get my apps');
    res.status(500).json({ success: false, error: 'Failed to get accessible apps' });
  }
});

// GET /all — list ALL permissions for the tenant (admin only, used by members page)
router.get('/all', async (req: Request, res: Response) => {
  try {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    if (!(await isTenantAdmin(tenantId, req.auth!.userId))) {
      res.status(403).json({ success: false, error: 'Only tenant admins can list permissions' });
      return;
    }

    const permissions = await appPermissionsService.listAllTenantPermissions(tenantId);
    res.json({ success: true, data: { permissions } });
  } catch (err) {
    logger.error({ err }, 'Failed to list all permissions');
    res.status(500).json({ success: false, error: 'Failed to list all permissions' });
  }
});

// GET /:appId — list permissions for an app (tenant admin only)
router.get('/:appId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    if (!(await isTenantAdmin(tenantId, req.auth!.userId))) {
      res.status(403).json({ success: false, error: 'Only tenant admins can list permissions' });
      return;
    }

    const permissions = await appPermissionsService.listAppPermissions(tenantId, req.params.appId as string);
    res.json({ success: true, data: permissions });
  } catch (err) {
    logger.error({ err }, 'Failed to list app permissions');
    res.status(500).json({ success: false, error: 'Failed to list app permissions' });
  }
});

// GET /:appId/me — get my permission for an app
router.get('/:appId/me', async (req: Request, res: Response) => {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;
    const appId = req.params.appId as string;

    const permission = await appPermissionsService.getAppPermission(tenantId, userId, appId);
    res.json({ success: true, data: permission });
  } catch (err) {
    logger.error({ err }, 'Failed to get app permission');
    res.status(500).json({ success: false, error: 'Failed to get app permission' });
  }
});

// PUT /:appId/:userId — set permission for a user (tenant admin only)
router.put('/:appId/:userId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    if (!(await isTenantAdmin(tenantId, req.auth!.userId))) {
      res.status(403).json({ success: false, error: 'Only tenant admins can manage permissions' });
      return;
    }

    const { role, recordAccess } = req.body;
    const validRoles: AppRole[] = ['admin', 'editor', 'viewer'];
    const validAccess: AppRecordAccess[] = ['all', 'own'];

    if (!role || !validRoles.includes(role)) {
      res.status(400).json({ success: false, error: `role must be one of: ${validRoles.join(', ')}` });
      return;
    }

    if (recordAccess && !validAccess.includes(recordAccess)) {
      res.status(400).json({ success: false, error: `recordAccess must be one of: ${validAccess.join(', ')}` });
      return;
    }

    const permission = await appPermissionsService.setAppPermission(
      tenantId,
      req.params.userId as string,
      req.params.appId as string,
      role as AppRole,
      (recordAccess as AppRecordAccess) || 'all',
    );
    res.json({ success: true, data: permission });
  } catch (err) {
    logger.error({ err }, 'Failed to set app permission');
    res.status(500).json({ success: false, error: 'Failed to set app permission' });
  }
});

// DELETE /:appId/:userId — remove explicit permission (tenant admin only)
router.delete('/:appId/:userId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    if (!(await isTenantAdmin(tenantId, req.auth!.userId))) {
      res.status(403).json({ success: false, error: 'Only tenant admins can manage permissions' });
      return;
    }

    await appPermissionsService.deleteAppPermission(tenantId, req.params.userId as string, req.params.appId as string);
    res.json({ success: true, data: { message: 'Permission removed' } });
  } catch (err) {
    logger.error({ err }, 'Failed to delete app permission');
    res.status(500).json({ success: false, error: 'Failed to delete app permission' });
  }
});

export default router;
