import type { Request, Response } from 'express';
import { z } from 'zod';
import * as crmService from '../services/workflow.service';
import { logger } from '../../../utils/logger';
import { canAccessEntity } from '../../../services/app-permissions.service';
import {
  workflowCreateSchema,
  workflowUpdateSchema,
  stepInputSchema,
  stepPatchSchema,
  reorderSchema,
} from '../validation/workflow-validation';

function zodError(res: Response, err: z.ZodError) {
  res.status(400).json({ success: false, error: err.errors[0]?.message ?? 'Invalid input' });
}

export async function listWorkflows(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const perm = req.crmPerm!;
    if (!canAccessEntity(perm.role, 'workflows', 'view', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No access to workflows' });
      return;
    }
    const workflows = await crmService.listWorkflows(userId, tenantId);
    res.json({ success: true, data: { workflows } });
  } catch (error) {
    logger.error({ error }, 'Failed to list CRM workflows');
    res.status(500).json({ success: false, error: 'Failed to list workflows' });
  }
}

export async function getWorkflow(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const id = req.params.id as string;
    const workflow = await crmService.getWorkflow(userId, id);
    if (!workflow) {
      res.status(404).json({ success: false, error: 'Workflow not found' });
      return;
    }
    res.json({ success: true, data: workflow });
  } catch (error) {
    logger.error({ error }, 'Failed to get CRM workflow');
    res.status(500).json({ success: false, error: 'Failed to get workflow' });
  }
}

export async function createWorkflow(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const perm = req.crmPerm!;
    if (!canAccessEntity(perm.role, 'workflows', 'create', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to create workflows' });
      return;
    }

    const parsed = workflowCreateSchema.safeParse(req.body);
    if (!parsed.success) return zodError(res, parsed.error);

    const workflow = await crmService.createWorkflow(userId, tenantId, parsed.data);
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

    const parsed = workflowUpdateSchema.safeParse(req.body);
    if (!parsed.success) return zodError(res, parsed.error);

    const workflow = await crmService.updateWorkflow(userId, id, parsed.data);
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
    const tenantId = req.auth!.tenantId;
    const result = await crmService.seedExampleWorkflows(userId, tenantId);
    res.json({ success: true, data: { message: 'Seeded example workflows', ...result } });
  } catch (error) {
    logger.error({ error }, 'Failed to seed CRM example workflows');
    res.status(500).json({ success: false, error: 'Failed to seed example workflows' });
  }
}

// ─── Step handlers ─────────────────────────────────────────────────

export async function appendStep(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const workflowId = req.params.id as string;
    const parsed = stepInputSchema.safeParse(req.body);
    if (!parsed.success) return zodError(res, parsed.error);
    const step = await crmService.appendStep(userId, workflowId, parsed.data);
    if (!step) {
      res.status(404).json({ success: false, error: 'Workflow not found' });
      return;
    }
    res.json({ success: true, data: step });
  } catch (error) {
    logger.error({ error }, 'Failed to append workflow step');
    res.status(500).json({ success: false, error: 'Failed to append step' });
  }
}

export async function updateStep(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const workflowId = req.params.id as string;
    const stepId = req.params.stepId as string;
    const parsed = stepPatchSchema.safeParse(req.body);
    if (!parsed.success) return zodError(res, parsed.error);
    const step = await crmService.updateStep(userId, workflowId, stepId, parsed.data);
    if (!step) {
      res.status(404).json({ success: false, error: 'Step not found' });
      return;
    }
    res.json({ success: true, data: step });
  } catch (error) {
    logger.error({ error }, 'Failed to update workflow step');
    res.status(500).json({ success: false, error: 'Failed to update step' });
  }
}

export async function deleteStep(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const workflowId = req.params.id as string;
    const stepId = req.params.stepId as string;
    const result = await crmService.deleteStep(userId, workflowId, stepId);
    if (!result.deleted) {
      if (result.error === 'LAST_STEP') {
        res.status(400).json({ success: false, error: 'LAST_STEP', message: 'A workflow needs at least one step' });
      } else {
        res.status(404).json({ success: false, error: 'Step not found' });
      }
      return;
    }
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete workflow step');
    res.status(500).json({ success: false, error: 'Failed to delete step' });
  }
}

export async function reorderSteps(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const workflowId = req.params.id as string;
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) return zodError(res, parsed.error);
    const result = await crmService.reorderSteps(userId, workflowId, parsed.data.stepIds);
    if (!result.ok) {
      if (result.error === 'MISMATCH') {
        res.status(400).json({ success: false, error: 'MISMATCH', message: 'stepIds must match existing step set exactly' });
      } else {
        res.status(404).json({ success: false, error: 'Workflow not found' });
      }
      return;
    }
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to reorder workflow steps');
    res.status(500).json({ success: false, error: 'Failed to reorder steps' });
  }
}
