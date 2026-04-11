import type { Request, Response } from 'express';
import * as hrService from '../services/department.service';
import { logger } from '../../../utils/logger';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';

// ─── Departments ────────────────────────────────────────────────────

export async function listDepartments(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const includeArchived = req.query.includeArchived === 'true';

    const depts = await hrService.listDepartments(userId, tenantId, includeArchived);
    res.json({ success: true, data: { departments: depts } });
  } catch (error) {
    logger.error({ error }, 'Failed to list departments');
    res.status(500).json({ success: false, error: 'Failed to list departments' });
  }
}

export async function createDepartment(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const { name, headEmployeeId, color, description } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const department = await hrService.createDepartment(userId, tenantId, {
      name, headEmployeeId, color, description,
    });

    res.json({ success: true, data: department });
  } catch (error) {
    logger.error({ error }, 'Failed to create department');
    res.status(500).json({ success: false, error: 'Failed to create department' });
  }
}

export async function updateDepartment(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update HR records' });
      return;
    }

    const id = req.params.id as string;
    const { name, headEmployeeId, color, description, sortOrder, isArchived } = req.body;

    const department = await hrService.updateDepartment(userId, tenantId, id, {
      name, headEmployeeId, color, description, sortOrder, isArchived,
    });

    if (!department) {
      res.status(404).json({ success: false, error: 'Department not found' });
      return;
    }

    res.json({ success: true, data: department });
  } catch (error) {
    logger.error({ error }, 'Failed to update department');
    res.status(500).json({ success: false, error: 'Failed to update department' });
  }
}

export async function deleteDepartment(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete' });
      return;
    }

    const id = req.params.id as string;

    await hrService.deleteDepartment(userId, tenantId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete department');
    res.status(500).json({ success: false, error: 'Failed to delete department' });
  }
}
