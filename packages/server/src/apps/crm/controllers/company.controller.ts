import type { Request, Response } from 'express';
import * as crmService from '../services/company.service';
import { logger } from '../../../utils/logger';
import { emitAppEvent } from '../../../services/event.service';
import { getAppPermission, canAccessEntity } from '../../../services/app-permissions.service';

// ─── Companies ──────────────────────────────────────────────────────

export async function listCompanies(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { search, industry, includeArchived } = req.query;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'companies', 'view', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No access to companies' });
      return;
    }

    const companies = await crmService.listCompanies(userId, tenantId, {
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
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'companies', 'view', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No access to companies' });
      return;
    }

    const company = await crmService.getCompany(userId, tenantId, id, perm.recordAccess);
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
    const tenantId = req.auth!.tenantId;
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

    const company = await crmService.createCompany(userId, tenantId, {
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
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;
    const { name, domain, industry, size, address, phone, tags, sortOrder, isArchived } = req.body;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'companies', 'update', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to update companies' });
      return;
    }

    const company = await crmService.updateCompany(userId, tenantId, id, {
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
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'companies', 'delete', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to delete companies' });
      return;
    }

    await crmService.deleteCompany(userId, tenantId, id, perm.recordAccess);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete CRM company');
    res.status(500).json({ success: false, error: 'Failed to delete company' });
  }
}

export async function importCompanies(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { rows } = req.body;

    if (!Array.isArray(rows)) {
      res.status(400).json({ success: false, error: 'rows must be an array' });
      return;
    }

    const result = await crmService.bulkCreateCompanies(userId, tenantId, rows);
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to bulk import CRM companies');
    res.status(500).json({ success: false, error: 'Failed to import companies' });
  }
}

export async function mergeCompanies(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
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

    const merged = await crmService.mergeCompanies(userId, tenantId, primaryId, secondaryId);
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
