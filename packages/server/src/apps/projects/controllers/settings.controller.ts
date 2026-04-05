import type { Request, Response } from 'express';
import * as projectService from '../service';
import { logger } from '../../../utils/logger';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';

// ─── Widget ─────────────────────────────────────────────────────────

export async function getWidgetData(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view projects' });
      return;
    }

    const accountId = req.auth!.accountId;
    const data = await projectService.getWidgetData(accountId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get Projects widget data');
    res.status(500).json({ success: false, error: 'Failed to get Projects widget data' });
  }
}

export async function getDashboardData(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view projects' });
      return;
    }

    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const data = await projectService.getDashboardData(userId, accountId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get Projects dashboard data');
    res.status(500).json({ success: false, error: 'Failed to get dashboard data' });
  }
}

// ─── Settings ───────────────────────────────────────────────────────

export async function getSettings(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view project settings' });
      return;
    }

    const accountId = req.auth!.accountId;
    const settings = await projectService.getSettings(accountId);
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error({ error }, 'Failed to get project settings');
    res.status(500).json({ success: false, error: 'Failed to get project settings' });
  }
}

export async function updateSettings(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update project settings' });
      return;
    }

    const accountId = req.auth!.accountId;
    const { invoicePrefix, defaultHourlyRate, companyName, companyAddress, companyLogo, nextInvoiceNumber } = req.body;

    const settings = await projectService.updateSettings(accountId, {
      invoicePrefix, defaultHourlyRate, companyName, companyAddress, companyLogo, nextInvoiceNumber,
    });

    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error({ error }, 'Failed to update project settings');
    res.status(500).json({ success: false, error: 'Failed to update project settings' });
  }
}

// ─── Seed ──────────────────────────────────────────────────────────

export async function seedSampleData(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const result = await projectService.seedSampleData(userId, accountId);
    res.json({ success: true, data: { message: 'Seeded Projects sample data', ...result } });
  } catch (error) {
    logger.error({ error }, 'Failed to seed Projects sample data');
    res.status(500).json({ success: false, error: 'Failed to seed Projects data' });
  }
}
