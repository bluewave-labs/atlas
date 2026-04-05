import type { Request, Response } from 'express';
import { listCrmPermissions, upsertCrmPermission } from '../permissions';
import { logger } from '../../../utils/logger';
import { getAppPermission } from '../../../services/app-permissions.service';
import type { CrmRole, CrmRecordAccess } from '@atlasmail/shared';

// ─── Permissions ──────────────────────────────────────────────────

export async function listPermissions(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    // Only admins can list all permissions
    const myPerm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (myPerm.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Only CRM admins can manage permissions' });
      return;
    }

    const permissions = await listCrmPermissions(accountId, tenantId);
    res.json({ success: true, data: { permissions } });
  } catch (error) {
    logger.error({ error }, 'Failed to list CRM permissions');
    res.status(500).json({ success: false, error: 'Failed to list permissions' });
  }
}

export async function getMyPermission(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const userId = req.auth!.userId;

    const permission = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    res.json({ success: true, data: permission });
  } catch (error) {
    logger.error({ error }, 'Failed to get CRM permission');
    res.status(500).json({ success: false, error: 'Failed to get permission' });
  }
}

export async function updatePermission(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const currentUserId = req.auth!.userId;
    const targetUserId = req.params.userId as string;
    const { role, recordAccess } = req.body;

    // Only admins can update permissions
    const myPerm = await getAppPermission(req.auth?.tenantId, currentUserId, 'crm');
    if (myPerm.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Only CRM admins can manage permissions' });
      return;
    }

    // Prevent admin from removing their own admin role
    if (targetUserId === currentUserId && role !== 'admin') {
      res.status(400).json({ success: false, error: 'Cannot remove your own admin role' });
      return;
    }

    const validRoles: CrmRole[] = ['admin', 'manager', 'sales', 'viewer'];
    const validAccess: CrmRecordAccess[] = ['all', 'own'];

    if (!validRoles.includes(role)) {
      res.status(400).json({ success: false, error: 'Invalid role' });
      return;
    }
    if (!validAccess.includes(recordAccess)) {
      res.status(400).json({ success: false, error: 'Invalid record access' });
      return;
    }

    const updated = await upsertCrmPermission(accountId, targetUserId, role, recordAccess);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error({ error }, 'Failed to update CRM permission');
    res.status(500).json({ success: false, error: 'Failed to update permission' });
  }
}
