import type { Request, Response } from 'express';
import * as projectService from '../service';
import { logger } from '../../../utils/logger';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';

// ─── Reports ────────────────────────────────────────────────────────

export async function getTimeReport(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view projects' });
      return;
    }

    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { startDate, endDate, projectId } = req.query;

    const report = await projectService.getTimeReport(userId, accountId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      projectId: projectId as string | undefined,
    });

    res.json({ success: true, data: report });
  } catch (error) {
    logger.error({ error }, 'Failed to get time report');
    res.status(500).json({ success: false, error: 'Failed to get time report' });
  }
}

export async function getRevenueReport(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view projects' });
      return;
    }

    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { startDate, endDate } = req.query;

    const report = await projectService.getRevenueReport(userId, accountId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });

    res.json({ success: true, data: report });
  } catch (error) {
    logger.error({ error }, 'Failed to get revenue report');
    res.status(500).json({ success: false, error: 'Failed to get revenue report' });
  }
}

export async function getProjectProfitability(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view projects' });
      return;
    }

    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;

    const report = await projectService.getProjectProfitability(userId, accountId);
    res.json({ success: true, data: report });
  } catch (error) {
    logger.error({ error }, 'Failed to get project profitability');
    res.status(500).json({ success: false, error: 'Failed to get project profitability' });
  }
}

export async function getTeamUtilization(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view projects' });
      return;
    }

    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { startDate, endDate } = req.query;

    const report = await projectService.getTeamUtilization(userId, accountId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });

    res.json({ success: true, data: report });
  } catch (error) {
    logger.error({ error }, 'Failed to get team utilization');
    res.status(500).json({ success: false, error: 'Failed to get team utilization' });
  }
}
