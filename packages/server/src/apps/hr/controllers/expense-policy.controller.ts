import type { Request, Response } from 'express';
import * as expensePolicyService from '../services/expense-policy.service';
import { logger } from '../../../utils/logger';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';

// ─── Expense Policies ────────────────────────────────────────────

export async function listExpensePolicies(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const data = await expensePolicyService.listExpensePolicies(tenantId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to list expense policies');
    res.status(500).json({ success: false, error: 'Failed to list expense policies' });
  }
}

export async function getExpensePolicy(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const data = await expensePolicyService.getExpensePolicy(tenantId, req.params.id as string);
    if (!data) {
      res.status(404).json({ success: false, error: 'Expense policy not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get expense policy');
    res.status(500).json({ success: false, error: 'Failed to get expense policy' });
  }
}

export async function createExpensePolicy(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const { name, monthlyLimit, requireReceiptAbove, autoApproveBelow, isActive } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const data = await expensePolicyService.createExpensePolicy(tenantId, {
      name: name.trim(), monthlyLimit, requireReceiptAbove, autoApproveBelow, isActive,
    });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to create expense policy');
    res.status(500).json({ success: false, error: 'Failed to create expense policy' });
  }
}

export async function updateExpensePolicy(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update HR records' });
      return;
    }

    const { name, monthlyLimit, requireReceiptAbove, autoApproveBelow, isActive } = req.body;
    const data = await expensePolicyService.updateExpensePolicy(tenantId, req.params.id as string, {
      name, monthlyLimit, requireReceiptAbove, autoApproveBelow, isActive,
    });
    if (!data) {
      res.status(404).json({ success: false, error: 'Expense policy not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to update expense policy');
    res.status(500).json({ success: false, error: 'Failed to update expense policy' });
  }
}

export async function deleteExpensePolicy(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'delete')) {
      res.status(403).json({ success: false, error: 'No permission to delete HR records' });
      return;
    }

    const data = await expensePolicyService.deleteExpensePolicy(tenantId, req.params.id as string);
    if (!data) {
      res.status(404).json({ success: false, error: 'Expense policy not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to delete expense policy');
    res.status(500).json({ success: false, error: 'Failed to delete expense policy' });
  }
}

// ─── Policy Assignments ──────────────────────────────────────────

export async function assignPolicy(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const { employeeId, departmentId } = req.body;
    if (!employeeId && !departmentId) {
      res.status(400).json({ success: false, error: 'Either employeeId or departmentId is required' });
      return;
    }

    const data = await expensePolicyService.assignPolicy(tenantId, req.params.id as string, {
      employeeId, departmentId,
    });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to assign expense policy');
    res.status(500).json({ success: false, error: 'Failed to assign expense policy' });
  }
}

export async function removeAssignment(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'delete')) {
      res.status(403).json({ success: false, error: 'No permission to delete HR records' });
      return;
    }

    const data = await expensePolicyService.removeAssignment(tenantId, req.params.assignmentId as string);
    if (!data) {
      res.status(404).json({ success: false, error: 'Assignment not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to remove expense policy assignment');
    res.status(500).json({ success: false, error: 'Failed to remove expense policy assignment' });
  }
}
