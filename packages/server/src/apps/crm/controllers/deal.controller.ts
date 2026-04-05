import type { Request, Response } from 'express';
import * as crmService from '../services/deal.service';
import { logger } from '../../../utils/logger';
import { emitAppEvent, getTenantMemberUserIds } from '../../../services/event.service';
import { getAppPermission, canAccessEntity } from '../../../services/app-permissions.service';

// ─── Deal Stages ────────────────────────────────────────────────────

export async function listDealStages(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const stages = await crmService.listDealStages(accountId);
    res.json({ success: true, data: { stages } });
  } catch (error) {
    logger.error({ error }, 'Failed to list CRM deal stages');
    res.status(500).json({ success: false, error: 'Failed to list deal stages' });
  }
}

export async function createDealStage(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const { name, color, probability, sequence, isDefault } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const stage = await crmService.createDealStage(accountId, {
      name: name.trim(), color, probability, sequence, isDefault,
    });

    res.json({ success: true, data: stage });
  } catch (error) {
    logger.error({ error }, 'Failed to create CRM deal stage');
    res.status(500).json({ success: false, error: 'Failed to create deal stage' });
  }
}

export async function updateDealStage(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;
    const { name, color, probability, sequence, isDefault } = req.body;

    const stage = await crmService.updateDealStage(accountId, id, {
      name, color, probability, sequence, isDefault,
    });

    if (!stage) {
      res.status(404).json({ success: false, error: 'Deal stage not found' });
      return;
    }

    res.json({ success: true, data: stage });
  } catch (error) {
    logger.error({ error }, 'Failed to update CRM deal stage');
    res.status(500).json({ success: false, error: 'Failed to update deal stage' });
  }
}

export async function deleteDealStage(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    await crmService.deleteDealStage(accountId, id);
    res.json({ success: true, data: null });
  } catch (error: any) {
    if (error?.message?.includes('Cannot delete')) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    logger.error({ error }, 'Failed to delete CRM deal stage');
    res.status(500).json({ success: false, error: 'Failed to delete deal stage' });
  }
}

export async function reorderDealStages(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'deals', 'update', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to reorder stages' });
      return;
    }
    const { stageIds } = req.body;

    if (!Array.isArray(stageIds)) {
      res.status(400).json({ success: false, error: 'stageIds must be an array' });
      return;
    }

    await crmService.reorderDealStages(accountId, stageIds);
    const stages = await crmService.listDealStages(accountId);
    res.json({ success: true, data: { stages } });
  } catch (error) {
    logger.error({ error }, 'Failed to reorder CRM deal stages');
    res.status(500).json({ success: false, error: 'Failed to reorder deal stages' });
  }
}

export async function seedDefaultStages(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const stages = await crmService.seedDefaultStages(accountId);
    res.json({ success: true, data: { stages } });
  } catch (error) {
    logger.error({ error }, 'Failed to seed CRM default stages');
    res.status(500).json({ success: false, error: 'Failed to seed default stages' });
  }
}

// ─── Deals ──────────────────────────────────────────────────────────

export async function listDeals(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { stageId, contactId, companyId, includeArchived } = req.query;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'deals', 'view', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No access to deals' });
      return;
    }

    const deals = await crmService.listDeals(userId, accountId, {
      stageId: stageId as string | undefined,
      contactId: contactId as string | undefined,
      companyId: companyId as string | undefined,
      includeArchived: includeArchived === 'true',
      recordAccess: perm.recordAccess,
    });

    res.json({ success: true, data: { deals } });
  } catch (error) {
    logger.error({ error }, 'Failed to list CRM deals');
    res.status(500).json({ success: false, error: 'Failed to list deals' });
  }
}

export async function getDeal(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    const deal = await crmService.getDeal(userId, accountId, id, perm.recordAccess);
    if (!deal) {
      res.status(404).json({ success: false, error: 'Deal not found' });
      return;
    }

    res.json({ success: true, data: deal });
  } catch (error) {
    logger.error({ error }, 'Failed to get CRM deal');
    res.status(500).json({ success: false, error: 'Failed to get deal' });
  }
}

export async function createDeal(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { title, value, stageId, contactId, companyId, assignedUserId, probability, expectedCloseDate, tags } = req.body;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'deals', 'create', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to create deals' });
      return;
    }

    if (!title?.trim()) {
      res.status(400).json({ success: false, error: 'Title is required' });
      return;
    }
    if (!stageId) {
      res.status(400).json({ success: false, error: 'Stage is required' });
      return;
    }

    const deal = await crmService.createDeal(userId, accountId, {
      title: title.trim(), value: value ?? 0, stageId, contactId, companyId,
      assignedUserId, probability, expectedCloseDate, tags,
    });

    if (req.auth!.tenantId) {
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'crm',
        eventType: 'deal.created',
        title: `created a new deal: ${deal.title}`,
        metadata: { dealId: deal.id, value: deal.value },
      }).catch(() => {});
    }

    res.json({ success: true, data: deal });
  } catch (error) {
    logger.error({ error }, 'Failed to create CRM deal');
    res.status(500).json({ success: false, error: 'Failed to create deal' });
  }
}

export async function updateDeal(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;
    const { title, value, stageId, contactId, companyId, assignedUserId, probability, expectedCloseDate, tags, sortOrder, isArchived } = req.body;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'deals', 'update', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to update deals' });
      return;
    }

    const deal = await crmService.updateDeal(userId, accountId, id, {
      title, value, stageId, contactId, companyId, assignedUserId,
      probability, expectedCloseDate, tags, sortOrder, isArchived,
    }, perm.recordAccess);

    if (!deal) {
      res.status(404).json({ success: false, error: 'Deal not found' });
      return;
    }

    res.json({ success: true, data: deal });
  } catch (error) {
    logger.error({ error }, 'Failed to update CRM deal');
    res.status(500).json({ success: false, error: 'Failed to update deal' });
  }
}

export async function deleteDeal(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'deals', 'delete', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to delete deals' });
      return;
    }

    await crmService.deleteDeal(userId, accountId, id, perm.recordAccess);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete CRM deal');
    res.status(500).json({ success: false, error: 'Failed to delete deal' });
  }
}

export async function markDealWon(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'deals', 'update', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to update deals' });
      return;
    }

    const deal = await crmService.markDealWon(userId, accountId, id, perm.recordAccess);
    if (!deal) {
      res.status(404).json({ success: false, error: 'Deal not found' });
      return;
    }

    if (req.auth!.tenantId) {
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'crm',
        eventType: 'deal.won',
        title: `won deal: ${deal.title}`,
        metadata: { dealId: deal.id, value: deal.value },
        notifyUserIds: await getTenantMemberUserIds(req.auth!.tenantId),
      }).catch(() => {});
    }

    res.json({ success: true, data: deal });
  } catch (error) {
    logger.error({ error }, 'Failed to mark CRM deal as won');
    res.status(500).json({ success: false, error: 'Failed to mark deal as won' });
  }
}

export async function markDealLost(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;
    const { reason } = req.body;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'deals', 'update', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to update deals' });
      return;
    }

    const deal = await crmService.markDealLost(userId, accountId, id, reason, perm.recordAccess);
    if (!deal) {
      res.status(404).json({ success: false, error: 'Deal not found' });
      return;
    }

    if (req.auth!.tenantId) {
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'crm',
        eventType: 'deal.lost',
        title: `lost deal: ${deal.title}`,
        metadata: { dealId: deal.id, value: deal.value, reason },
        notifyUserIds: await getTenantMemberUserIds(req.auth!.tenantId),
      }).catch(() => {});
    }

    res.json({ success: true, data: deal });
  } catch (error) {
    logger.error({ error }, 'Failed to mark CRM deal as lost');
    res.status(500).json({ success: false, error: 'Failed to mark deal as lost' });
  }
}

export async function countsByStage(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    const counts = await crmService.countsByStage(userId, accountId, perm.recordAccess);
    res.json({ success: true, data: counts });
  } catch (error) {
    logger.error({ error }, 'Failed to get CRM deal counts by stage');
    res.status(500).json({ success: false, error: 'Failed to get deal counts' });
  }
}

export async function pipelineValue(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    const value = await crmService.pipelineValue(userId, accountId, perm.recordAccess);
    res.json({ success: true, data: value });
  } catch (error) {
    logger.error({ error }, 'Failed to get CRM pipeline value');
    res.status(500).json({ success: false, error: 'Failed to get pipeline value' });
  }
}

export async function importDeals(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { rows } = req.body;

    if (!Array.isArray(rows)) {
      res.status(400).json({ success: false, error: 'rows must be an array' });
      return;
    }

    const result = await crmService.bulkCreateDeals(userId, accountId, rows);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to bulk import CRM deals');
    res.status(500).json({ success: false, error: 'Failed to import deals' });
  }
}

export async function getForecast(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const forecast = await crmService.getForecast(accountId);
    res.json({ success: true, data: forecast });
  } catch (error) {
    logger.error({ error }, 'Failed to get CRM forecast');
    res.status(500).json({ success: false, error: 'Failed to get forecast' });
  }
}
