import type { Request, Response } from 'express';
import * as hrService from '../services/lifecycle.service';
import { logger } from '../../../utils/logger';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';

// ─── Lifecycle Events ─────────────────────────────────────────────

export async function getLifecycleTimeline(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view HR data' });
      return;
    }

    const data = await hrService.getLifecycleTimeline(accountId, req.params.id as string);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get lifecycle timeline');
    res.status(500).json({ success: false, error: 'Failed to get lifecycle timeline' });
  }
}

export async function createLifecycleEventHandler(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const userId = req.auth!.userId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const employeeId = req.params.id as string;
    const { eventType, eventDate, effectiveDate, fromValue, toValue, fromDepartmentId, toDepartmentId, notes } = req.body;
    if (!eventType || !eventDate) {
      res.status(400).json({ success: false, error: 'eventType and eventDate are required' });
      return;
    }
    const data = await hrService.createLifecycleEvent(accountId, {
      employeeId, eventType, eventDate, effectiveDate, fromValue, toValue,
      fromDepartmentId, toDepartmentId, notes, createdBy: userId,
    });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to create lifecycle event');
    res.status(500).json({ success: false, error: 'Failed to create lifecycle event' });
  }
}

export async function deleteLifecycleEvent(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete' });
      return;
    }

    await hrService.deleteLifecycleEvent(accountId, req.params.id as string);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete lifecycle event');
    res.status(500).json({ success: false, error: 'Failed to delete lifecycle event' });
  }
}
