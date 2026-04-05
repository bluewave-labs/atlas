import type { Request, Response } from 'express';
import * as crmService from '../services/activity.service';
import { logger } from '../../../utils/logger';
import { getAppPermission, canAccessEntity } from '../../../services/app-permissions.service';

// ─── Activities ─────────────────────────────────────────────────────

export async function listActivities(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { dealId, contactId, companyId, includeArchived } = req.query;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'activities', 'view', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No access to activities' });
      return;
    }

    const activities = await crmService.listActivities(userId, accountId, {
      dealId: dealId as string | undefined,
      contactId: contactId as string | undefined,
      companyId: companyId as string | undefined,
      includeArchived: includeArchived === 'true',
      recordAccess: perm.recordAccess,
    });

    res.json({ success: true, data: { activities } });
  } catch (error) {
    logger.error({ error }, 'Failed to list CRM activities');
    res.status(500).json({ success: false, error: 'Failed to list activities' });
  }
}

export async function createActivity(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { type, body, dealId, contactId, companyId, scheduledAt } = req.body;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'activities', 'create', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to create activities' });
      return;
    }

    if (!body?.trim()) {
      res.status(400).json({ success: false, error: 'Body is required' });
      return;
    }

    const activity = await crmService.createActivity(userId, accountId, {
      type: type ?? 'note', body: body.trim(), dealId, contactId, companyId, scheduledAt,
    });

    res.json({ success: true, data: activity });
  } catch (error) {
    logger.error({ error }, 'Failed to create CRM activity');
    res.status(500).json({ success: false, error: 'Failed to create activity' });
  }
}

export async function updateActivity(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'activities', 'update', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to update activities' });
      return;
    }
    const id = req.params.id as string;
    const { type, body, dealId, contactId, companyId, scheduledAt, completedAt, isArchived } = req.body;

    const activity = await crmService.updateActivity(userId, accountId, id, {
      type, body, dealId, contactId, companyId, scheduledAt, completedAt, isArchived,
    });

    if (!activity) {
      res.status(404).json({ success: false, error: 'Activity not found' });
      return;
    }

    res.json({ success: true, data: activity });
  } catch (error) {
    logger.error({ error }, 'Failed to update CRM activity');
    res.status(500).json({ success: false, error: 'Failed to update activity' });
  }
}

export async function deleteActivity(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    await crmService.deleteActivity(userId, accountId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete CRM activity');
    res.status(500).json({ success: false, error: 'Failed to delete activity' });
  }
}

export async function completeActivity(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { id } = req.params;
    const { scheduleNext } = req.body;

    const result = await crmService.completeAndScheduleNext(userId, accountId, id as string, scheduleNext);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to complete CRM activity');
    res.status(500).json({ success: false, error: 'Failed to complete activity' });
  }
}

// ─── Activity Types ───────────────────────────────────────────────

export async function listActivityTypes(req: Request, res: Response) {
  try {
    const data = await crmService.listActivityTypes(req.auth!.accountId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to list CRM activity types');
    res.status(500).json({ success: false, error: 'Failed to list activity types' });
  }
}

export async function createActivityType(req: Request, res: Response) {
  try {
    const data = await crmService.createActivityType(req.auth!.accountId, req.body);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to create CRM activity type');
    res.status(500).json({ success: false, error: 'Failed to create activity type' });
  }
}

export async function updateActivityType(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const data = await crmService.updateActivityType(req.auth!.accountId, id, req.body);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to update CRM activity type');
    res.status(500).json({ success: false, error: 'Failed to update activity type' });
  }
}

export async function deleteActivityType(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    await crmService.deleteActivityType(req.auth!.accountId, id);
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to delete CRM activity type');
    res.status(500).json({ success: false, error: 'Failed to delete activity type' });
  }
}

export async function reorderActivityTypes(req: Request, res: Response) {
  try {
    await crmService.reorderActivityTypes(req.auth!.accountId, req.body.typeIds);
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to reorder CRM activity types');
    res.status(500).json({ success: false, error: 'Failed to reorder activity types' });
  }
}

export async function seedActivityTypes(req: Request, res: Response) {
  try {
    const data = await crmService.seedDefaultActivityTypes(req.auth!.accountId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to seed CRM activity types');
    res.status(500).json({ success: false, error: 'Failed to seed activity types' });
  }
}
