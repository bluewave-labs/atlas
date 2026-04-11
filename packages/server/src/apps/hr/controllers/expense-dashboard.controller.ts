import type { Request, Response } from 'express';
import * as expenseDashboardService from '../services/expense-dashboard.service';
import { logger } from '../../../utils/logger';

// ─── Expense Dashboard ──────────────────────────────────────────────

export async function getExpenseDashboard(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const data = await expenseDashboardService.getExpenseDashboard(tenantId!);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get expense dashboard');
    res.status(500).json({ success: false, error: 'Failed to get expense dashboard' });
  }
}
