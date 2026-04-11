import type { Request, Response } from 'express';
import * as expenseReportService from '../services/expense-report.service';
import { logger } from '../../../utils/logger';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';
import { findEmployeeIdByLinkedUser } from '../services/employee.service';

// ─── List Expense Reports ──────────────────────────────────────

export async function listExpenseReports(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const { status, employeeId } = req.query;
    const data = await expenseReportService.listExpenseReports(tenantId, {
      status: status as string | undefined,
      employeeId: employeeId as string | undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to list expense reports');
    res.status(500).json({ success: false, error: 'Failed to list expense reports' });
  }
}

// ─── List My Expense Reports ───────────────────────────────────

export async function listMyExpenseReports(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;
    const data = await expenseReportService.listMyExpenseReports(tenantId, userId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to list my expense reports');
    res.status(500).json({ success: false, error: 'Failed to list my expense reports' });
  }
}

// ─── Get Expense Report ────────────────────────────────────────

export async function getExpenseReport(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const data = await expenseReportService.getExpenseReport(tenantId, req.params.id as string);
    if (!data) {
      res.status(404).json({ success: false, error: 'Expense report not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get expense report');
    res.status(500).json({ success: false, error: 'Failed to get expense report' });
  }
}

// ─── Create Expense Report ─────────────────────────────────────

// Expense reports are a self-service HR feature — every user with a
// linked employee record can create their own report, even viewers.
// This mirrors the createExpense bypass in expense.controller.ts.
export async function createExpenseReport(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const employeeId = await findEmployeeIdByLinkedUser(userId, tenantId);
    if (!employeeId) {
      res.status(400).json({ success: false, error: 'No linked employee profile found' });
      return;
    }

    const { title, currency } = req.body;
    if (!title?.trim()) {
      res.status(400).json({ success: false, error: 'Title is required' });
      return;
    }

    const data = await expenseReportService.createExpenseReport(userId, tenantId, employeeId, {
      title: title.trim(),
      currency,
    });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to create expense report');
    res.status(500).json({ success: false, error: 'Failed to create expense report' });
  }
}

// ─── Update Expense Report ─────────────────────────────────────

export async function updateExpenseReport(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update HR records' });
      return;
    }

    const { title } = req.body;
    const data = await expenseReportService.updateExpenseReport(tenantId, req.params.id as string, { title });
    if (!data) {
      res.status(404).json({ success: false, error: 'Expense report not found or not editable' });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to update expense report');
    res.status(500).json({ success: false, error: 'Failed to update expense report' });
  }
}

// ─── Delete Expense Report ─────────────────────────────────────

export async function deleteExpenseReport(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete' });
      return;
    }

    const data = await expenseReportService.deleteExpenseReport(tenantId, req.params.id as string);
    if (!data) {
      res.status(404).json({ success: false, error: 'Expense report not found or not deletable' });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to delete expense report');
    res.status(500).json({ success: false, error: 'Failed to delete expense report' });
  }
}

// ─── Submit Expense Report ─────────────────────────────────────

export async function submitExpenseReport(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const employeeId = await findEmployeeIdByLinkedUser(userId, tenantId);
    if (!employeeId) {
      res.status(400).json({ success: false, error: 'No linked employee profile found' });
      return;
    }

    const data = await expenseReportService.submitExpenseReport(tenantId, req.params.id as string, employeeId);
    if (!data) {
      res.status(404).json({ success: false, error: 'Expense report not found or not submittable' });
      return;
    }
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error({ error }, 'Failed to submit expense report');
    res.status(400).json({ success: false, error: error.message || 'Failed to submit expense report' });
  }
}

// ─── Approve Expense Report ────────────────────────────────────

export async function approveExpenseReport(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to approve expense reports' });
      return;
    }

    const approverId = await findEmployeeIdByLinkedUser(userId, tenantId);
    if (!approverId) {
      res.status(400).json({ success: false, error: 'No linked employee profile found' });
      return;
    }

    const data = await expenseReportService.approveExpenseReport(tenantId, req.params.id as string, approverId);
    if (!data) {
      res.status(404).json({ success: false, error: 'Expense report not found or not approvable' });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to approve expense report');
    res.status(500).json({ success: false, error: 'Failed to approve expense report' });
  }
}

// ─── Refuse Expense Report ─────────────────────────────────────

export async function refuseExpenseReport(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to refuse expense reports' });
      return;
    }

    const approverId = await findEmployeeIdByLinkedUser(userId, tenantId);
    if (!approverId) {
      res.status(400).json({ success: false, error: 'No linked employee profile found' });
      return;
    }

    const { comment } = req.body;
    const data = await expenseReportService.refuseExpenseReport(tenantId, req.params.id as string, approverId, comment);
    if (!data) {
      res.status(404).json({ success: false, error: 'Expense report not found or not refusable' });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to refuse expense report');
    res.status(500).json({ success: false, error: 'Failed to refuse expense report' });
  }
}
