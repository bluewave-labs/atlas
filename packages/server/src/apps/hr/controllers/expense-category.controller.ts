import type { Request, Response } from 'express';
import * as expenseCategoryService from '../services/expense-category.service';
import { logger } from '../../../utils/logger';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';

// ─── Expense Categories ──────────────────────────────────────────

export async function listExpenseCategories(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const data = await expenseCategoryService.listExpenseCategories(tenantId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to list expense categories');
    res.status(500).json({ success: false, error: 'Failed to list expense categories' });
  }
}

export async function createExpenseCategory(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const { name, icon, color, maxAmount, receiptRequired, isActive } = req.body;
    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }
    const data = await expenseCategoryService.createExpenseCategory(tenantId, {
      name: name.trim(), icon, color, maxAmount, receiptRequired, isActive,
    });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to create expense category');
    res.status(500).json({ success: false, error: 'Failed to create expense category' });
  }
}

export async function updateExpenseCategory(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update HR records' });
      return;
    }

    const id = req.params.id as string;
    const data = await expenseCategoryService.updateExpenseCategory(tenantId, id, req.body);
    if (!data) { res.status(404).json({ success: false, error: 'Expense category not found' }); return; }
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to update expense category');
    res.status(500).json({ success: false, error: 'Failed to update expense category' });
  }
}

export async function deleteExpenseCategory(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete' });
      return;
    }

    await expenseCategoryService.deleteExpenseCategory(tenantId, req.params.id as string);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete expense category');
    res.status(500).json({ success: false, error: 'Failed to delete expense category' });
  }
}

export async function reorderExpenseCategories(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update HR records' });
      return;
    }

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, error: 'items array is required' });
      return;
    }
    await expenseCategoryService.reorderExpenseCategories(tenantId, items);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to reorder expense categories');
    res.status(500).json({ success: false, error: 'Failed to reorder expense categories' });
  }
}

export async function seedExpenseCategories(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const result = await expenseCategoryService.seedExpenseCategories(tenantId);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to seed expense categories');
    res.status(500).json({ success: false, error: 'Failed to seed expense categories' });
  }
}
