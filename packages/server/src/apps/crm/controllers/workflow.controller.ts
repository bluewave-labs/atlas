import type { Request, Response } from 'express';
import * as crmService from '../services/workflow.service';
import { logger } from '../../../utils/logger';
import { getAppPermission, canAccessEntity } from '../../../services/app-permissions.service';

// ─── Workflow Automations ──────────────────────────────────────────

export async function listWorkflows(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'workflows', 'view', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No access to workflows' });
      return;
    }

    const workflows = await crmService.listWorkflows(userId, accountId);
    res.json({ success: true, data: { workflows } });
  } catch (error) {
    logger.error({ error }, 'Failed to list CRM workflows');
    res.status(500).json({ success: false, error: 'Failed to list workflows' });
  }
}

export async function createWorkflow(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { name, trigger, triggerConfig, action, actionConfig } = req.body;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'workflows', 'create', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to create workflows' });
      return;
    }

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }
    if (!trigger) {
      res.status(400).json({ success: false, error: 'Trigger is required' });
      return;
    }
    if (!action) {
      res.status(400).json({ success: false, error: 'Action is required' });
      return;
    }

    const workflow = await crmService.createWorkflow(userId, accountId, {
      name: name.trim(), trigger, triggerConfig, action, actionConfig: actionConfig ?? {},
    });

    res.json({ success: true, data: workflow });
  } catch (error) {
    logger.error({ error }, 'Failed to create CRM workflow');
    res.status(500).json({ success: false, error: 'Failed to create workflow' });
  }
}

export async function updateWorkflow(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const id = req.params.id as string;
    const { name, trigger, triggerConfig, action, actionConfig, isActive } = req.body;

    const workflow = await crmService.updateWorkflow(userId, id, {
      name, trigger, triggerConfig, action, actionConfig, isActive,
    });

    if (!workflow) {
      res.status(404).json({ success: false, error: 'Workflow not found' });
      return;
    }

    res.json({ success: true, data: workflow });
  } catch (error) {
    logger.error({ error }, 'Failed to update CRM workflow');
    res.status(500).json({ success: false, error: 'Failed to update workflow' });
  }
}

export async function deleteWorkflow(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const id = req.params.id as string;

    await crmService.deleteWorkflow(userId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete CRM workflow');
    res.status(500).json({ success: false, error: 'Failed to delete workflow' });
  }
}

export async function toggleWorkflow(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const id = req.params.id as string;

    const workflow = await crmService.toggleWorkflow(userId, id);
    if (!workflow) {
      res.status(404).json({ success: false, error: 'Workflow not found' });
      return;
    }

    res.json({ success: true, data: workflow });
  } catch (error) {
    logger.error({ error }, 'Failed to toggle CRM workflow');
    res.status(500).json({ success: false, error: 'Failed to toggle workflow' });
  }
}

export async function seedExampleWorkflows(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;

    const result = await crmService.seedExampleWorkflows(userId, accountId);
    res.json({ success: true, data: { message: 'Seeded example workflows', ...result } });
  } catch (error) {
    logger.error({ error }, 'Failed to seed CRM example workflows');
    res.status(500).json({ success: false, error: 'Failed to seed example workflows' });
  }
}
