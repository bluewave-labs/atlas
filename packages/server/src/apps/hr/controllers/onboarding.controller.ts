import type { Request, Response } from 'express';
import * as hrService from '../services/onboarding.service';
import { logger } from '../../../utils/logger';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';

// ─── Onboarding Tasks ──────────────────────────────────────────────

export async function listOnboardingTasks(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const employeeId = req.params.id as string;

    const tasks = await hrService.listOnboardingTasks(tenantId, employeeId);
    res.json({ success: true, data: tasks });
  } catch (error) {
    logger.error({ error }, 'Failed to list onboarding tasks');
    res.status(500).json({ success: false, error: 'Failed to list onboarding tasks' });
  }
}

export async function createOnboardingTask(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const employeeId = req.params.id as string;
    const { title, description, category, dueDate } = req.body;

    if (!title?.trim()) {
      res.status(400).json({ success: false, error: 'Title is required' });
      return;
    }

    const task = await hrService.createOnboardingTask(tenantId, employeeId, {
      title: title.trim(), description, category, dueDate,
    });
    res.json({ success: true, data: task });
  } catch (error) {
    logger.error({ error }, 'Failed to create onboarding task');
    res.status(500).json({ success: false, error: 'Failed to create onboarding task' });
  }
}

export async function updateOnboardingTask(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update HR records' });
      return;
    }

    const taskId = req.params.taskId as string;
    const { title, description, category, dueDate, completed, completedBy, sortOrder, isArchived } = req.body;

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (completed !== undefined) {
      updates.completedAt = completed ? new Date() : null;
      updates.completedBy = completed ? completedBy || null : null;
    }
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    if (isArchived !== undefined) updates.isArchived = isArchived;

    const task = await hrService.updateOnboardingTask(tenantId, taskId, updates as any);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }
    res.json({ success: true, data: task });
  } catch (error) {
    logger.error({ error }, 'Failed to update onboarding task');
    res.status(500).json({ success: false, error: 'Failed to update onboarding task' });
  }
}

export async function deleteOnboardingTask(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete' });
      return;
    }

    const taskId = req.params.taskId as string;

    await hrService.deleteOnboardingTask(tenantId, taskId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete onboarding task');
    res.status(500).json({ success: false, error: 'Failed to delete onboarding task' });
  }
}

export async function createTasksFromTemplate(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const employeeId = req.params.id as string;
    const { templateId } = req.body;

    if (!templateId) {
      res.status(400).json({ success: false, error: 'templateId is required' });
      return;
    }

    const tasks = await hrService.createTasksFromTemplate(tenantId, employeeId, templateId);
    res.json({ success: true, data: tasks });
  } catch (error) {
    logger.error({ error }, 'Failed to create tasks from template');
    res.status(500).json({ success: false, error: 'Failed to create tasks from template' });
  }
}

// ─── Onboarding Templates ──────────────────────────────────────────

export async function listOnboardingTemplates(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const templates = await hrService.listOnboardingTemplates(tenantId);
    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error({ error }, 'Failed to list onboarding templates');
    res.status(500).json({ success: false, error: 'Failed to list onboarding templates' });
  }
}

export async function createOnboardingTemplate(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;

    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'hr');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create HR records' });
      return;
    }

    const { name, tasks } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const template = await hrService.createOnboardingTemplate(tenantId, {
      name: name.trim(), tasks: tasks || [],
    });
    res.json({ success: true, data: template });
  } catch (error) {
    logger.error({ error }, 'Failed to create onboarding template');
    res.status(500).json({ success: false, error: 'Failed to create onboarding template' });
  }
}
