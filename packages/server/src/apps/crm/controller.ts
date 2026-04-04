import type { Request, Response } from 'express';
import * as crmService from './service';
import { listCrmPermissions, upsertCrmPermission } from './permissions';
import * as crmEmailService from './email.service';
import * as crmCalendarService from './calendar.service';
import { isGoogleConfigured } from '../../services/google-auth';
import { getRedisClient } from '../../config/redis';
import { enqueueSyncJob, SyncJobType } from '../../workers';
import { db } from '../../config/database';
import { accounts } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { emitAppEvent, getTenantMemberUserIds } from '../../services/event.service';
import { getAppPermission, canAccess, canAccessEntity } from '../../services/app-permissions.service';
import type { CrmRole, CrmRecordAccess } from '@atlasmail/shared';

// ─── Widget ─────────────────────────────────────────────────────────

export async function getWidgetData(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const data = await crmService.getWidgetData(userId, accountId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get CRM widget data');
    res.status(500).json({ success: false, error: 'Failed to get CRM widget data' });
  }
}

// ─── Companies ──────────────────────────────────────────────────────

export async function listCompanies(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { search, industry, includeArchived } = req.query;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'companies', 'view', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No access to companies' });
      return;
    }

    const companies = await crmService.listCompanies(userId, accountId, {
      search: search as string | undefined,
      industry: industry as string | undefined,
      includeArchived: includeArchived === 'true',
      recordAccess: perm.recordAccess,
    });

    res.json({ success: true, data: { companies } });
  } catch (error) {
    logger.error({ error }, 'Failed to list CRM companies');
    res.status(500).json({ success: false, error: 'Failed to list companies' });
  }
}

export async function getCompany(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'companies', 'view', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No access to companies' });
      return;
    }

    const company = await crmService.getCompany(userId, accountId, id, perm.recordAccess);
    if (!company) {
      res.status(404).json({ success: false, error: 'Company not found' });
      return;
    }

    res.json({ success: true, data: company });
  } catch (error) {
    logger.error({ error }, 'Failed to get CRM company');
    res.status(500).json({ success: false, error: 'Failed to get company' });
  }
}

export async function createCompany(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { name, domain, industry, size, address, phone, tags } = req.body;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'companies', 'create', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to create companies' });
      return;
    }

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const company = await crmService.createCompany(userId, accountId, {
      name: name.trim(), domain, industry, size, address, phone, tags,
    });

    if (req.auth!.tenantId) {
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'crm',
        eventType: 'company.created',
        title: `added a new company: ${company.name}`,
        metadata: { companyId: company.id },
      }).catch(() => {});
    }

    res.json({ success: true, data: company });
  } catch (error) {
    logger.error({ error }, 'Failed to create CRM company');
    res.status(500).json({ success: false, error: 'Failed to create company' });
  }
}

export async function updateCompany(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;
    const { name, domain, industry, size, address, phone, tags, sortOrder, isArchived } = req.body;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'companies', 'update', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to update companies' });
      return;
    }

    const company = await crmService.updateCompany(userId, accountId, id, {
      name, domain, industry, size, address, phone, tags, sortOrder, isArchived,
    }, perm.recordAccess);

    if (!company) {
      res.status(404).json({ success: false, error: 'Company not found' });
      return;
    }

    res.json({ success: true, data: company });
  } catch (error) {
    logger.error({ error }, 'Failed to update CRM company');
    res.status(500).json({ success: false, error: 'Failed to update company' });
  }
}

export async function deleteCompany(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'companies', 'delete', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to delete companies' });
      return;
    }

    await crmService.deleteCompany(userId, accountId, id, perm.recordAccess);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete CRM company');
    res.status(500).json({ success: false, error: 'Failed to delete company' });
  }
}

// ─── Contacts ───────────────────────────────────────────────────────

export async function listContacts(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { search, companyId, includeArchived } = req.query;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'contacts', 'view', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No access to contacts' });
      return;
    }

    const contacts = await crmService.listContacts(userId, accountId, {
      search: search as string | undefined,
      companyId: companyId as string | undefined,
      includeArchived: includeArchived === 'true',
      recordAccess: perm.recordAccess,
    });

    res.json({ success: true, data: { contacts } });
  } catch (error) {
    logger.error({ error }, 'Failed to list CRM contacts');
    res.status(500).json({ success: false, error: 'Failed to list contacts' });
  }
}

export async function getContact(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    const contact = await crmService.getContact(userId, accountId, id, perm.recordAccess);
    if (!contact) {
      res.status(404).json({ success: false, error: 'Contact not found' });
      return;
    }

    res.json({ success: true, data: contact });
  } catch (error) {
    logger.error({ error }, 'Failed to get CRM contact');
    res.status(500).json({ success: false, error: 'Failed to get contact' });
  }
}

export async function createContact(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { name, email, phone, companyId, position, source, tags } = req.body;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'contacts', 'create', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to create contacts' });
      return;
    }

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const contact = await crmService.createContact(userId, accountId, {
      name: name.trim(), email, phone, companyId, position, source, tags,
    });

    if (req.auth!.tenantId) {
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'crm',
        eventType: 'contact.created',
        title: `added a new contact: ${contact.name}`,
        metadata: { contactId: contact.id },
      }).catch(() => {});
    }

    res.json({ success: true, data: contact });
  } catch (error) {
    logger.error({ error }, 'Failed to create CRM contact');
    res.status(500).json({ success: false, error: 'Failed to create contact' });
  }
}

export async function updateContact(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;
    const { name, email, phone, companyId, position, source, tags, sortOrder, isArchived } = req.body;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'contacts', 'update', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to update contacts' });
      return;
    }

    const contact = await crmService.updateContact(userId, accountId, id, {
      name, email, phone, companyId, position, source, tags, sortOrder, isArchived,
    }, perm.recordAccess);

    if (!contact) {
      res.status(404).json({ success: false, error: 'Contact not found' });
      return;
    }

    res.json({ success: true, data: contact });
  } catch (error) {
    logger.error({ error }, 'Failed to update CRM contact');
    res.status(500).json({ success: false, error: 'Failed to update contact' });
  }
}

export async function deleteContact(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'contacts', 'delete', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to delete contacts' });
      return;
    }

    await crmService.deleteContact(userId, accountId, id, perm.recordAccess);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete CRM contact');
    res.status(500).json({ success: false, error: 'Failed to delete contact' });
  }
}

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

// ─── Dashboard ─────────────────────────────────────────────────────

export async function getDashboard(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    const dashboard = await crmService.getDashboard(userId, accountId, perm.recordAccess);
    res.json({ success: true, data: dashboard });
  } catch (error) {
    logger.error({ error }, 'Failed to get CRM dashboard');
    res.status(500).json({ success: false, error: 'Failed to get dashboard' });
  }
}

// ─── Sales Teams ──────────────────────────────────────────────────

export async function listTeams(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'crm');
    if (!canAccess(perm.role, 'view')) { res.status(403).json({ success: false, error: 'No permission' }); return; }
    const data = await crmService.listTeams(req.auth!.accountId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to list CRM teams');
    res.status(500).json({ success: false, error: 'Failed to list teams' });
  }
}

export async function createTeam(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'crm');
    if (!canAccess(perm.role, 'create')) { res.status(403).json({ success: false, error: 'No permission' }); return; }
    const { name, color, leaderUserId } = req.body;
    const data = await crmService.createTeam(req.auth!.accountId, { name, color, leaderUserId });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to create CRM team');
    res.status(500).json({ success: false, error: 'Failed to create team' });
  }
}

export async function updateTeam(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'crm');
    if (!canAccess(perm.role, 'update')) { res.status(403).json({ success: false, error: 'No permission' }); return; }
    const id = req.params.id as string;
    const { name, color, leaderUserId, isArchived } = req.body;
    const data = await crmService.updateTeam(req.auth!.accountId, id, { name, color, leaderUserId, isArchived });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to update CRM team');
    res.status(500).json({ success: false, error: 'Failed to update team' });
  }
}

export async function deleteTeam(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'crm');
    if (!canAccess(perm.role, 'delete')) { res.status(403).json({ success: false, error: 'No permission' }); return; }
    const id = req.params.id as string;
    await crmService.deleteTeam(req.auth!.accountId, id);
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to delete CRM team');
    res.status(500).json({ success: false, error: 'Failed to delete team' });
  }
}

export async function listTeamMembers(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'crm');
    if (!canAccess(perm.role, 'view')) { res.status(403).json({ success: false, error: 'No permission' }); return; }
    const teamId = req.params.id as string;
    const data = await crmService.listTeamMembers(teamId, req.auth!.accountId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to list team members');
    res.status(500).json({ success: false, error: 'Failed to list team members' });
  }
}

export async function addTeamMember(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'crm');
    if (!canAccess(perm.role, 'update')) { res.status(403).json({ success: false, error: 'No permission' }); return; }
    const teamId = req.params.id as string;
    const { userId } = req.body;
    const data = await crmService.addTeamMember(teamId, userId, req.auth!.accountId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to add team member');
    res.status(500).json({ success: false, error: 'Failed to add team member' });
  }
}

export async function removeTeamMember(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'crm');
    if (!canAccess(perm.role, 'update')) { res.status(403).json({ success: false, error: 'No permission' }); return; }
    const teamId = req.params.id as string;
    const userId = req.params.userId as string;
    await crmService.removeTeamMember(teamId, userId, req.auth!.accountId);
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to remove team member');
    res.status(500).json({ success: false, error: 'Failed to remove team member' });
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

// ─── Complete Activity + Schedule Next ──────────────────────────────

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

// ─── Bulk Import ────────────────────────────────────────────────────

export async function importContacts(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { rows } = req.body;

    if (!Array.isArray(rows)) {
      res.status(400).json({ success: false, error: 'rows must be an array' });
      return;
    }

    const result = await crmService.bulkCreateContacts(userId, accountId, rows);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to bulk import CRM contacts');
    res.status(500).json({ success: false, error: 'Failed to import contacts' });
  }
}

export async function importCompanies(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { rows } = req.body;

    if (!Array.isArray(rows)) {
      res.status(400).json({ success: false, error: 'rows must be an array' });
      return;
    }

    const result = await crmService.bulkCreateCompanies(userId, accountId, rows);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to bulk import CRM companies');
    res.status(500).json({ success: false, error: 'Failed to import companies' });
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

// ─── Seed Sample Data ───────────────────────────────────────────────

export async function seedSampleData(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;

    const result = await crmService.seedSampleData(userId, accountId);
    res.json({ success: true, data: { message: 'Seeded CRM sample data', ...result } });
  } catch (error) {
    logger.error({ error }, 'Failed to seed CRM sample data');
    res.status(500).json({ success: false, error: 'Failed to seed CRM sample data' });
  }
}

export async function seedSampleLeads(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const result = await crmService.seedSampleLeads(userId, accountId);
    res.json({ success: true, data: { message: 'Seeded CRM sample leads', ...result } });
  } catch (error) {
    logger.error({ error }, 'Failed to seed CRM sample leads');
    res.status(500).json({ success: false, error: 'Failed to seed sample leads' });
  }
}

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

// ─── Permissions ──────────────────────────────────────────────────

export async function listPermissions(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    // Only admins can list all permissions
    const myPerm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (myPerm.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Only CRM admins can manage permissions' });
      return;
    }

    const permissions = await listCrmPermissions(accountId, tenantId);
    res.json({ success: true, data: { permissions } });
  } catch (error) {
    logger.error({ error }, 'Failed to list CRM permissions');
    res.status(500).json({ success: false, error: 'Failed to list permissions' });
  }
}

export async function getMyPermission(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const userId = req.auth!.userId;

    const permission = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    res.json({ success: true, data: permission });
  } catch (error) {
    logger.error({ error }, 'Failed to get CRM permission');
    res.status(500).json({ success: false, error: 'Failed to get permission' });
  }
}

export async function updatePermission(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const currentUserId = req.auth!.userId;
    const targetUserId = req.params.userId as string;
    const { role, recordAccess } = req.body;

    // Only admins can update permissions
    const myPerm = await getAppPermission(req.auth?.tenantId, currentUserId, 'crm');
    if (myPerm.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Only CRM admins can manage permissions' });
      return;
    }

    // Prevent admin from removing their own admin role
    if (targetUserId === currentUserId && role !== 'admin') {
      res.status(400).json({ success: false, error: 'Cannot remove your own admin role' });
      return;
    }

    const validRoles: CrmRole[] = ['admin', 'manager', 'sales', 'viewer'];
    const validAccess: CrmRecordAccess[] = ['all', 'own'];

    if (!validRoles.includes(role)) {
      res.status(400).json({ success: false, error: 'Invalid role' });
      return;
    }
    if (!validAccess.includes(recordAccess)) {
      res.status(400).json({ success: false, error: 'Invalid record access' });
      return;
    }

    const updated = await upsertCrmPermission(accountId, targetUserId, role, recordAccess);
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error({ error }, 'Failed to update CRM permission');
    res.status(500).json({ success: false, error: 'Failed to update permission' });
  }
}

// ─── Leads ──────────────────────────────────────────────────────────

export async function listLeads(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { status, source, search } = req.query;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'contacts', 'view', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No access to leads' });
      return;
    }

    const leads = await crmService.listLeads(userId, accountId, {
      status: status as string | undefined,
      source: source as string | undefined,
      search: search as string | undefined,
      recordAccess: perm.recordAccess,
    });
    res.json({ success: true, data: { leads } });
  } catch (error) {
    logger.error({ error }, 'Failed to list CRM leads');
    res.status(500).json({ success: false, error: 'Failed to list leads' });
  }
}

export async function getLead(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    const lead = await crmService.getLead(userId, accountId, id, perm.recordAccess);
    if (!lead) {
      res.status(404).json({ success: false, error: 'Lead not found' });
      return;
    }
    res.json({ success: true, data: lead });
  } catch (error) {
    logger.error({ error }, 'Failed to get CRM lead');
    res.status(500).json({ success: false, error: 'Failed to get lead' });
  }
}

export async function createLead(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { name, email, phone, companyName, source, notes } = req.body;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'contacts', 'create', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to create leads' });
      return;
    }

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const lead = await crmService.createLead(userId, accountId, {
      name: name.trim(), email, phone, companyName, source, notes,
    });
    res.json({ success: true, data: lead });
  } catch (error) {
    logger.error({ error }, 'Failed to create CRM lead');
    res.status(500).json({ success: false, error: 'Failed to create lead' });
  }
}

export async function updateLead(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;
    const { name, email, phone, companyName, source, status, notes, tags, sortOrder, isArchived } = req.body;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'contacts', 'update', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to update leads' });
      return;
    }

    const lead = await crmService.updateLead(userId, accountId, id, {
      name, email, phone, companyName, source, status, notes, tags, sortOrder, isArchived,
    }, perm.recordAccess);

    if (!lead) {
      res.status(404).json({ success: false, error: 'Lead not found' });
      return;
    }
    res.json({ success: true, data: lead });
  } catch (error) {
    logger.error({ error }, 'Failed to update CRM lead');
    res.status(500).json({ success: false, error: 'Failed to update lead' });
  }
}

export async function deleteLead(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'contacts', 'delete', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to delete leads' });
      return;
    }

    await crmService.deleteLead(userId, accountId, id, perm.recordAccess);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete CRM lead');
    res.status(500).json({ success: false, error: 'Failed to delete lead' });
  }
}

export async function enrichLead(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    const data = await crmService.enrichLead(userId, accountId, id);
    res.json({ success: true, data });
  } catch (error: any) {
    const message = error?.message || 'Failed to enrich lead';
    logger.error({ error }, 'Failed to enrich CRM lead');
    res.status(error?.message?.includes('not enabled') || error?.message?.includes('No API key') ? 400 : 500)
      .json({ success: false, error: message });
  }
}

export async function convertLead(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;
    const { dealTitle, dealStageId, dealValue } = req.body;

    if (!dealTitle?.trim()) {
      res.status(400).json({ success: false, error: 'Deal title is required' });
      return;
    }
    if (!dealStageId) {
      res.status(400).json({ success: false, error: 'Deal stage is required' });
      return;
    }

    const result = await crmService.convertLead(userId, accountId, id, {
      dealTitle: dealTitle.trim(), dealStageId, dealValue,
    });
    res.json({ success: true, data: result });
  } catch (error: any) {
    if (error?.message?.includes('not found') || error?.message?.includes('already converted')) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    logger.error({ error }, 'Failed to convert CRM lead');
    res.status(500).json({ success: false, error: 'Failed to convert lead' });
  }
}

// ─── Notes ──────────────────────────────────────────────────────────

export async function listNotes(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { dealId, contactId, companyId } = req.query;

    const notes = await crmService.listNotes(userId, accountId, {
      dealId: dealId as string | undefined,
      contactId: contactId as string | undefined,
      companyId: companyId as string | undefined,
    });
    res.json({ success: true, data: { notes } });
  } catch (error) {
    logger.error({ error }, 'Failed to list CRM notes');
    res.status(500).json({ success: false, error: 'Failed to list notes' });
  }
}

export async function createNote(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { title, content, dealId, contactId, companyId } = req.body;

    if (!content) {
      res.status(400).json({ success: false, error: 'Content is required' });
      return;
    }

    const note = await crmService.createNote(userId, accountId, {
      title, content, dealId, contactId, companyId,
    });
    res.json({ success: true, data: note });
  } catch (error) {
    logger.error({ error }, 'Failed to create CRM note');
    res.status(500).json({ success: false, error: 'Failed to create note' });
  }
}

export async function updateNote(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const id = req.params.id as string;
    const { title, content, isPinned, isArchived } = req.body;

    const note = await crmService.updateNote(userId, id, { title, content, isPinned, isArchived });
    if (!note) {
      res.status(404).json({ success: false, error: 'Note not found' });
      return;
    }
    res.json({ success: true, data: note });
  } catch (error) {
    logger.error({ error }, 'Failed to update CRM note');
    res.status(500).json({ success: false, error: 'Failed to update note' });
  }
}

export async function deleteNote(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const id = req.params.id as string;

    await crmService.deleteNote(userId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete CRM note');
    res.status(500).json({ success: false, error: 'Failed to delete note' });
  }
}

// ─── Forecast ───────────────────────────────────────────────────────

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

// ─── Merge Records ──────────────────────────────────────────────────

export async function mergeContacts(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { primaryId, secondaryId } = req.body;

    if (!primaryId || !secondaryId) {
      res.status(400).json({ success: false, error: 'primaryId and secondaryId are required' });
      return;
    }
    if (primaryId === secondaryId) {
      res.status(400).json({ success: false, error: 'Cannot merge a record with itself' });
      return;
    }

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'contacts', 'update', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to merge contacts' });
      return;
    }

    const merged = await crmService.mergeContacts(userId, accountId, primaryId, secondaryId);
    res.json({ success: true, data: merged });
  } catch (error: any) {
    if (error?.message?.includes('not found')) {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    logger.error({ error }, 'Failed to merge CRM contacts');
    res.status(500).json({ success: false, error: 'Failed to merge contacts' });
  }
}

export async function mergeCompanies(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { primaryId, secondaryId } = req.body;

    if (!primaryId || !secondaryId) {
      res.status(400).json({ success: false, error: 'primaryId and secondaryId are required' });
      return;
    }
    if (primaryId === secondaryId) {
      res.status(400).json({ success: false, error: 'Cannot merge a record with itself' });
      return;
    }

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'companies', 'update', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to merge companies' });
      return;
    }

    const merged = await crmService.mergeCompanies(userId, accountId, primaryId, secondaryId);
    res.json({ success: true, data: merged });
  } catch (error: any) {
    if (error?.message?.includes('not found')) {
      res.status(404).json({ success: false, error: error.message });
      return;
    }
    logger.error({ error }, 'Failed to merge CRM companies');
    res.status(500).json({ success: false, error: 'Failed to merge companies' });
  }
}

// ─── Dashboard Charts ───────────────────────────────────────────────

export async function getDashboardCharts(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    const charts = await crmService.getDashboardCharts(userId, accountId, perm.recordAccess);
    res.json({ success: true, data: charts });
  } catch (error) {
    logger.error({ error }, 'Failed to get CRM dashboard charts');
    res.status(500).json({ success: false, error: 'Failed to get dashboard charts' });
  }
}

// ─── Google Sync Status & Control ──────────────────────────────────────

export async function getGoogleSyncStatus(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    const [account] = await db.select({
      provider: accounts.provider,
      syncStatus: accounts.syncStatus,
      syncError: accounts.syncError,
      lastSync: accounts.lastSync,
      lastFullSync: accounts.lastFullSync,
    }).from(accounts).where(eq(accounts.id, accountId)).limit(1);

    res.json({
      success: true,
      data: {
        googleConfigured: isGoogleConfigured(),
        connected: account?.provider === 'google',
        syncStatus: account?.syncStatus ?? 'idle',
        syncError: account?.syncError ?? null,
        lastSync: account?.lastSync ?? null,
        lastFullSync: account?.lastFullSync ?? null,
        redisAvailable: !!getRedisClient(),
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get Google sync status');
    res.status(500).json({ success: false, error: 'Failed to get sync status' });
  }
}

export async function startGoogleSync(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    if (!getRedisClient()) {
      res.status(503).json({ success: false, error: 'Redis is not available. Background sync requires Redis.' });
      return;
    }

    await enqueueSyncJob(SyncJobType.FULL_EMAIL, accountId);
    await enqueueSyncJob(SyncJobType.FULL_CALENDAR, accountId);

    res.json({ success: true, data: { message: 'Sync jobs enqueued' } });
  } catch (error) {
    logger.error({ error }, 'Failed to start Google sync');
    res.status(500).json({ success: false, error: 'Failed to start sync' });
  }
}

export async function stopGoogleSync(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

    await db.update(accounts).set({
      syncStatus: 'idle',
      syncError: null,
      updatedAt: new Date(),
    }).where(eq(accounts.id, accountId));

    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to stop Google sync');
    res.status(500).json({ success: false, error: 'Failed to stop sync' });
  }
}

// ─── CRM Emails ────────────────────────────────────────────────────────

export async function getContactEmails(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const contactId = req.params.id as string;
    const limit = parseInt(req.query.limit as string) || 50;

    const emailList = await crmEmailService.getContactEmails(accountId, contactId, limit);
    res.json({ success: true, data: { emails: emailList } });
  } catch (error) {
    logger.error({ error }, 'Failed to get contact emails');
    res.status(500).json({ success: false, error: 'Failed to get contact emails' });
  }
}

export async function getDealEmails(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const dealId = req.params.id as string;
    const limit = parseInt(req.query.limit as string) || 50;

    const emailList = await crmEmailService.getDealEmails(accountId, dealId, limit);
    res.json({ success: true, data: { emails: emailList } });
  } catch (error) {
    logger.error({ error }, 'Failed to get deal emails');
    res.status(500).json({ success: false, error: 'Failed to get deal emails' });
  }
}

export async function getCompanyEmails(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const companyId = req.params.id as string;
    const limit = parseInt(req.query.limit as string) || 50;

    const emailList = await crmEmailService.getCompanyEmails(accountId, companyId, limit);
    res.json({ success: true, data: { emails: emailList } });
  } catch (error) {
    logger.error({ error }, 'Failed to get company emails');
    res.status(500).json({ success: false, error: 'Failed to get company emails' });
  }
}

export async function sendCrmEmail(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const userId = req.auth!.userId;
    const { to, subject, body, threadGmailId, dealId, contactId, companyId } = req.body;

    if (!to || !subject || !body) {
      res.status(400).json({ success: false, error: 'to, subject, and body are required' });
      return;
    }

    const sentMessage = await crmEmailService.sendEmail(accountId, to, subject, body, threadGmailId);

    // Create a CRM activity for the sent email
    await crmService.createActivity(userId, accountId, {
      type: 'email',
      body: `Sent email: ${subject}`,
      dealId: dealId ?? null,
      contactId: contactId ?? null,
      companyId: companyId ?? null,
    });

    res.json({ success: true, data: sentMessage });
  } catch (error) {
    logger.error({ error }, 'Failed to send CRM email');
    res.status(500).json({ success: false, error: 'Failed to send email' });
  }
}

// ─── CRM Calendar Events ──────────────────────────────────────────────

export async function getContactEvents(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const contactId = req.params.id as string;
    const limit = parseInt(req.query.limit as string) || 50;

    const events = await crmCalendarService.getContactEvents(accountId, contactId, limit);
    res.json({ success: true, data: { events } });
  } catch (error) {
    logger.error({ error }, 'Failed to get contact events');
    res.status(500).json({ success: false, error: 'Failed to get contact events' });
  }
}

export async function getDealEvents(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const dealId = req.params.id as string;
    const limit = parseInt(req.query.limit as string) || 50;

    const events = await crmCalendarService.getDealEvents(accountId, dealId, limit);
    res.json({ success: true, data: { events } });
  } catch (error) {
    logger.error({ error }, 'Failed to get deal events');
    res.status(500).json({ success: false, error: 'Failed to get deal events' });
  }
}

export async function createCrmEvent(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const userId = req.auth!.userId;
    const { summary, startTime, endTime, attendees, location, description, dealId, contactId, companyId } = req.body;

    if (!summary || !startTime || !endTime) {
      res.status(400).json({ success: false, error: 'summary, startTime, and endTime are required' });
      return;
    }

    const event = await crmCalendarService.createCalendarEvent(
      accountId, summary, startTime, endTime,
      attendees ?? [], location, description,
    );

    // Create a CRM activity for the meeting
    await crmService.createActivity(userId, accountId, {
      type: 'meeting',
      body: `Scheduled meeting: ${summary}`,
      dealId: dealId ?? null,
      contactId: contactId ?? null,
      companyId: companyId ?? null,
    });

    res.json({ success: true, data: event });
  } catch (error) {
    logger.error({ error }, 'Failed to create CRM calendar event');
    res.status(500).json({ success: false, error: 'Failed to create calendar event' });
  }
}

// ─── Saved Views ───────────────────────────────────────────────────

export async function listSavedViews(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const section = req.query.section as string | undefined;

    const views = await crmService.listSavedViews(userId, accountId, section);
    res.json({ success: true, data: { views } });
  } catch (error) {
    logger.error({ error }, 'Failed to list CRM saved views');
    res.status(500).json({ success: false, error: 'Failed to list saved views' });
  }
}

export async function createSavedView(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { appSection, name, filters, isPinned, isShared } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }
    if (!appSection?.trim()) {
      res.status(400).json({ success: false, error: 'Section is required' });
      return;
    }

    const view = await crmService.createSavedView(userId, accountId, {
      appSection, name: name.trim(), filters: filters ?? {}, isPinned, isShared,
    });
    res.json({ success: true, data: view });
  } catch (error) {
    logger.error({ error }, 'Failed to create CRM saved view');
    res.status(500).json({ success: false, error: 'Failed to create saved view' });
  }
}

export async function updateSavedView(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;
    const { name, filters, isPinned, isShared, sortOrder } = req.body;

    const view = await crmService.updateSavedView(userId, accountId, id, {
      name, filters, isPinned, isShared, sortOrder,
    });

    if (!view) {
      res.status(404).json({ success: false, error: 'View not found' });
      return;
    }
    res.json({ success: true, data: view });
  } catch (error) {
    logger.error({ error }, 'Failed to update CRM saved view');
    res.status(500).json({ success: false, error: 'Failed to update saved view' });
  }
}

export async function deleteSavedView(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    await crmService.deleteSavedView(userId, accountId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete CRM saved view');
    res.status(500).json({ success: false, error: 'Failed to delete saved view' });
  }
}

// ─── Lead Forms ────────────────────────────────────────────────────

export async function listLeadForms(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;

    const forms = await crmService.listLeadForms(userId, accountId);
    res.json({ success: true, data: { forms } });
  } catch (error) {
    logger.error({ error }, 'Failed to list CRM lead forms');
    res.status(500).json({ success: false, error: 'Failed to list lead forms' });
  }
}

export async function createLeadForm(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { name } = req.body;

    const form = await crmService.createLeadForm(userId, accountId, name || 'Default Lead Form');
    res.json({ success: true, data: form });
  } catch (error) {
    logger.error({ error }, 'Failed to create CRM lead form');
    res.status(500).json({ success: false, error: 'Failed to create lead form' });
  }
}

export async function updateLeadForm(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;
    const { name, fields, isActive } = req.body;

    const form = await crmService.updateLeadForm(userId, accountId, id, {
      name, fields, isActive,
    });

    if (!form) {
      res.status(404).json({ success: false, error: 'Lead form not found' });
      return;
    }
    res.json({ success: true, data: form });
  } catch (error) {
    logger.error({ error }, 'Failed to update CRM lead form');
    res.status(500).json({ success: false, error: 'Failed to update lead form' });
  }
}

export async function deleteLeadForm(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    await crmService.deleteLeadForm(userId, accountId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete CRM lead form');
    res.status(500).json({ success: false, error: 'Failed to delete lead form' });
  }
}

export async function submitLeadForm(req: Request, res: Response) {
  try {
    const token = req.params.token as string;
    const { name, email, phone, companyName, message } = req.body;

    const lead = await crmService.submitLeadForm(token, {
      name, email, phone, companyName, message,
    });

    if (!lead) {
      res.status(404).json({ success: false, error: 'Form not found or inactive' });
      return;
    }

    // HTML form submissions send urlencoded content-type; return a "thank you" page
    const contentType = req.headers['content-type'] || '';
    const acceptHeader = req.headers.accept || '';
    if (contentType.includes('application/x-www-form-urlencoded') || acceptHeader.includes('text/html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Thank you</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f9fafb}
.card{background:#fff;border-radius:12px;padding:40px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,.1)}
h2{margin:0 0 8px;color:#111827}p{margin:0;color:#6b7280}</style>
</head><body><div class="card"><h2>Thank you!</h2><p>Your submission has been received.</p></div></body></html>`);
      return;
    }

    res.json({ success: true, data: lead });
  } catch (error) {
    logger.error({ error }, 'Failed to submit lead form');
    res.status(500).json({ success: false, error: 'Failed to submit form' });
  }
}
