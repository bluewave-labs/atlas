import type { Request, Response } from 'express';
import * as expenseService from '../services/expense.service';
import { logger } from '../../../utils/logger';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';
import { findEmployeeIdByLinkedUser } from '../services/employee.service';

// ─── List Expenses (admin) ──────────────────────────────────────

export async function listExpenses(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const { status, employeeId, categoryId, projectId, startDate, endDate, search } = req.query;
    const data = await expenseService.listExpenses(tenantId, {
      status: status as string | undefined,
      employeeId: employeeId as string | undefined,
      categoryId: categoryId as string | undefined,
      projectId: projectId as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      search: search as string | undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to list expenses');
    res.status(500).json({ success: false, error: 'Failed to list expenses' });
  }
}

// ─── List My Expenses ───────────────────────────────────────────

export async function listMyExpenses(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const { status, categoryId, projectId, startDate, endDate, search } = req.query;
    const data = await expenseService.listMyExpenses(tenantId, userId, {
      status: status as string | undefined,
      categoryId: categoryId as string | undefined,
      projectId: projectId as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      search: search as string | undefined,
    });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to list my expenses');
    res.status(500).json({ success: false, error: 'Failed to list my expenses' });
  }
}

// ─── Get Expense ────────────────────────────────────────────────

export async function getExpense(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const data = await expenseService.getExpense(tenantId, req.params.id as string);
    if (!data) {
      res.status(404).json({ success: false, error: 'Expense not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get expense');
    res.status(500).json({ success: false, error: 'Failed to get expense' });
  }
}

// ─── Create Expense ─────────────────────────────────────────────

// Expenses are a self-service feature — any HR user with a linked
// employee record can create their own expenses. This intentionally
// bypasses the usual canAccess(role, 'create') gate (which would
// otherwise require editor+), scoping creation to the caller's own
// employee record via findEmployeeIdByLinkedUser.
export async function createExpense(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const employeeId = await findEmployeeIdByLinkedUser(userId, tenantId);
    if (!employeeId) {
      res.status(400).json({ success: false, error: 'No employee record found for current user' });
      return;
    }

    const data = await expenseService.createExpense(userId, tenantId, employeeId, req.body);
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error({ error }, 'Failed to create expense');
    res.status(400).json({ success: false, error: error.message || 'Failed to create expense' });
  }
}

// ─── Update Expense ─────────────────────────────────────────────

// Viewers can update their OWN expenses (self-service); editor+ can
// update any expense they have permission to see.
export async function updateExpense(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    // If the caller doesn't have blanket update permission, verify the
    // expense belongs to them via their linked employee record.
    if (!canAccess(perm.role, 'update')) {
      const callerEmployeeId = await findEmployeeIdByLinkedUser(userId, tenantId);
      if (!callerEmployeeId) {
        res.status(400).json({ success: false, error: 'No employee record found for current user' });
        return;
      }
      const existing = await expenseService.getExpense(tenantId, req.params.id as string);
      if (!existing || existing.employeeId !== callerEmployeeId) {
        res.status(403).json({ success: false, error: 'No permission to update this expense' });
        return;
      }
    }

    const data = await expenseService.updateExpense(tenantId, req.params.id as string, req.body);
    if (!data) {
      res.status(404).json({ success: false, error: 'Expense not found or not editable' });
      return;
    }
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error({ error }, 'Failed to update expense');
    res.status(400).json({ success: false, error: error.message || 'Failed to update expense' });
  }
}

// ─── Delete Expense ─────────────────────────────────────────────

// Viewers can delete their OWN draft expenses (self-service); editor+
// can delete any expense they have permission to see.
export async function deleteExpense(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      const callerEmployeeId = await findEmployeeIdByLinkedUser(userId, tenantId);
      if (!callerEmployeeId) {
        res.status(400).json({ success: false, error: 'No employee record found for current user' });
        return;
      }
      const existing = await expenseService.getExpense(tenantId, req.params.id as string);
      if (!existing || existing.employeeId !== callerEmployeeId) {
        res.status(403).json({ success: false, error: 'No permission to delete this expense' });
        return;
      }
    }

    const data = await expenseService.deleteExpense(tenantId, req.params.id as string);
    if (!data) {
      res.status(404).json({ success: false, error: 'Expense not found or not deletable' });
      return;
    }
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error({ error }, 'Failed to delete expense');
    res.status(400).json({ success: false, error: error.message || 'Failed to delete expense' });
  }
}

// ─── Submit Expense ─────────────────────────────────────────────

// Submitting a draft is a self-service action — any HR user with a
// linked employee record can submit their OWN drafts. Editor+ can
// submit any expense they have permission to see (e.g. for correcting
// workflow issues). Ownership is enforced in the service layer too
// because submitExpense already passes the caller's employeeId.
export async function submitExpense(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    const employeeId = await findEmployeeIdByLinkedUser(userId, tenantId);
    if (!employeeId) {
      res.status(400).json({ success: false, error: 'No employee record found for current user' });
      return;
    }

    // For non-privileged roles, verify the expense belongs to the caller.
    if (!canAccess(perm.role, 'update')) {
      const existing = await expenseService.getExpense(tenantId, req.params.id as string);
      if (!existing || existing.employeeId !== employeeId) {
        res.status(403).json({ success: false, error: 'No permission to submit this expense' });
        return;
      }
    }

    const data = await expenseService.submitExpense(tenantId, req.params.id as string, employeeId);
    if (!data) {
      res.status(400).json({ success: false, error: 'Cannot submit this expense' });
      return;
    }
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error({ error }, 'Failed to submit expense');
    res.status(400).json({ success: false, error: error.message || 'Failed to submit expense' });
  }
}

// ─── Recall Expense ─────────────────────────────────────────────

// Viewers can recall their OWN submitted expenses (self-service);
// editor+ can recall any expense they have permission to see.
export async function recallExpense(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      const callerEmployeeId = await findEmployeeIdByLinkedUser(userId, tenantId);
      if (!callerEmployeeId) {
        res.status(400).json({ success: false, error: 'No employee record found for current user' });
        return;
      }
      const existing = await expenseService.getExpense(tenantId, req.params.id as string);
      if (!existing || existing.employeeId !== callerEmployeeId) {
        res.status(403).json({ success: false, error: 'No permission to recall this expense' });
        return;
      }
    }

    const data = await expenseService.recallExpense(tenantId, req.params.id as string, userId);
    if (!data) {
      res.status(400).json({ success: false, error: 'Cannot recall this expense' });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to recall expense');
    res.status(500).json({ success: false, error: 'Failed to recall expense' });
  }
}

// ─── Approve Expense ────────────────────────────────────────────

export async function approveExpense(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update HR records' });
      return;
    }

    const approverId = await findEmployeeIdByLinkedUser(userId, tenantId);
    if (!approverId) {
      res.status(400).json({ success: false, error: 'No employee record found for current user' });
      return;
    }

    const data = await expenseService.approveExpense(tenantId, req.params.id as string, approverId);
    if (!data) {
      res.status(400).json({ success: false, error: 'Cannot approve this expense' });
      return;
    }
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error({ error }, 'Failed to approve expense');
    res.status(400).json({ success: false, error: error.message || 'Failed to approve expense' });
  }
}

// ─── Refuse Expense ─────────────────────────────────────────────

export async function refuseExpense(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update HR records' });
      return;
    }

    const approverId = await findEmployeeIdByLinkedUser(userId, tenantId);
    if (!approverId) {
      res.status(400).json({ success: false, error: 'No employee record found for current user' });
      return;
    }

    const { comment } = req.body;
    const data = await expenseService.refuseExpense(tenantId, req.params.id as string, approverId, comment);
    if (!data) {
      res.status(400).json({ success: false, error: 'Cannot refuse this expense' });
      return;
    }
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error({ error }, 'Failed to refuse expense');
    res.status(400).json({ success: false, error: error.message || 'Failed to refuse expense' });
  }
}

// ─── Bulk Pay Expenses ──────────────────────────────────────────

export async function bulkPayExpenses(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update HR records' });
      return;
    }

    const { expenseIds } = req.body;
    if (!Array.isArray(expenseIds) || expenseIds.length === 0) {
      res.status(400).json({ success: false, error: 'expenseIds array is required' });
      return;
    }

    const data = await expenseService.bulkPayExpenses(tenantId, expenseIds);
    res.json({ success: true, data });
  } catch (error: any) {
    logger.error({ error }, 'Failed to bulk pay expenses');
    res.status(400).json({ success: false, error: error.message || 'Failed to bulk pay expenses' });
  }
}

// ─── Get Pending Expenses ───────────────────────────────────────

export async function getPendingExpenses(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const approverId = await findEmployeeIdByLinkedUser(userId, tenantId);
    if (!approverId) {
      res.status(400).json({ success: false, error: 'No employee record found for current user' });
      return;
    }

    const data = await expenseService.getPendingExpenses(tenantId, approverId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get pending expenses');
    res.status(500).json({ success: false, error: 'Failed to get pending expenses' });
  }
}

// ─── Get Pending Expense Count ──────────────────────────────────

export async function getPendingExpenseCount(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    const userId = req.auth!.userId;

    const approverId = await findEmployeeIdByLinkedUser(userId, tenantId);
    if (!approverId) {
      res.json({ success: true, data: { count: 0 } });
      return;
    }

    const data = await expenseService.getPendingExpenseCount(tenantId, approverId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get pending expense count');
    res.status(500).json({ success: false, error: 'Failed to get pending expense count' });
  }
}
