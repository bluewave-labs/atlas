import type { Request, Response } from 'express';
import * as hrService from '../services/time-off.service';
import { logger } from '../../../utils/logger';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';

// ─── Time Off Requests ──────────────────────────────────────────────

export async function listTimeOffRequests(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const { employeeId, status, type, includeArchived } = req.query;

    const requests = await hrService.listTimeOffRequests(userId, tenantId, {
      employeeId: employeeId as string | undefined,
      status: status as string | undefined,
      type: type as string | undefined,
      includeArchived: includeArchived === 'true',
    });

    res.json({ success: true, data: { timeOffRequests: requests } });
  } catch (error) {
    logger.error({ error }, 'Failed to list time-off requests');
    res.status(500).json({ success: false, error: 'Failed to list time-off requests' });
  }
}

export async function createTimeOffRequest(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const { employeeId, type, startDate, endDate, approverId, notes } = req.body;

    if (!employeeId?.trim()) {
      res.status(400).json({ success: false, error: 'Employee ID is required' });
      return;
    }
    if (!type?.trim()) {
      res.status(400).json({ success: false, error: 'Type is required' });
      return;
    }
    if (!startDate?.trim()) {
      res.status(400).json({ success: false, error: 'Start date is required' });
      return;
    }
    if (!endDate?.trim()) {
      res.status(400).json({ success: false, error: 'End date is required' });
      return;
    }

    const request = await hrService.createTimeOffRequest(userId, tenantId, {
      employeeId, type, startDate, endDate, approverId, notes,
    });

    res.json({ success: true, data: request });
  } catch (error) {
    logger.error({ error }, 'Failed to create time-off request');
    res.status(500).json({ success: false, error: 'Failed to create time-off request' });
  }
}

export async function updateTimeOffRequest(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update HR records' });
      return;
    }

    const id = req.params.id as string;
    const { type, startDate, endDate, status, approverId, notes, sortOrder, isArchived } = req.body;

    const request = await hrService.updateTimeOffRequest(userId, tenantId, id, {
      type, startDate, endDate, status, approverId, notes, sortOrder, isArchived,
    });

    if (!request) {
      res.status(404).json({ success: false, error: 'Time-off request not found' });
      return;
    }

    res.json({ success: true, data: request });
  } catch (error) {
    logger.error({ error }, 'Failed to update time-off request');
    res.status(500).json({ success: false, error: 'Failed to update time-off request' });
  }
}

export async function deleteTimeOffRequest(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete' });
      return;
    }

    const id = req.params.id as string;

    await hrService.deleteTimeOffRequest(userId, tenantId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete time-off request');
    res.status(500).json({ success: false, error: 'Failed to delete time-off request' });
  }
}

// ─── Leave Balances ────────────────────────────────────────────────

export async function getLeaveBalances(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const employeeId = req.params.id as string;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    const balances = await hrService.getLeaveBalances(tenantId, employeeId, year);
    res.json({ success: true, data: balances });
  } catch (error) {
    logger.error({ error }, 'Failed to get leave balances');
    res.status(500).json({ success: false, error: 'Failed to get leave balances' });
  }
}

export async function allocateLeave(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const employeeId = req.params.id as string;
    const { leaveType, year, days } = req.body;

    if (!leaveType || !year || days == null) {
      res.status(400).json({ success: false, error: 'leaveType, year, and days are required' });
      return;
    }

    const balance = await hrService.allocateLeave(tenantId, employeeId, leaveType, year, days);
    res.json({ success: true, data: balance });
  } catch (error) {
    logger.error({ error }, 'Failed to allocate leave');
    res.status(500).json({ success: false, error: 'Failed to allocate leave' });
  }
}

export async function getLeaveBalancesSummary(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const balances = await hrService.getLeaveBalancesSummary(tenantId);
    res.json({ success: true, data: balances });
  } catch (error) {
    logger.error({ error }, 'Failed to get leave balances summary');
    res.status(500).json({ success: false, error: 'Failed to get leave balances summary' });
  }
}
