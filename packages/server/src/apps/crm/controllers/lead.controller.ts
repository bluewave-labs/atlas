import type { Request, Response } from 'express';
import * as crmService from '../services/lead.service';
import { logger } from '../../../utils/logger';
import { getAppPermission, canAccessEntity } from '../../../services/app-permissions.service';
import { emitAppEvent, getTenantMemberUserIds } from '../../../services/event.service';

// ─── Leads ──────────────────────────────────────────────────────────

export async function listLeads(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { status, source, search } = req.query;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'contacts', 'view', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No access to leads' });
      return;
    }

    const leads = await crmService.listLeads(userId, tenantId, {
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
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    const lead = await crmService.getLead(userId, tenantId, id, perm.recordAccess);
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
    const tenantId = req.auth!.tenantId;
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

    const lead = await crmService.createLead(userId, tenantId, {
      name: name.trim(), email, phone, companyName, source, notes,
    });

    if (req.auth!.tenantId) {
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'crm',
        eventType: 'lead.created',
        title: `new lead: ${lead.name}`,
        metadata: { leadId: lead.id, source: lead.source },
        notifyUserIds: await getTenantMemberUserIds(req.auth!.tenantId),
      }).catch(() => {});
    }

    res.json({ success: true, data: lead });
  } catch (error) {
    logger.error({ error }, 'Failed to create CRM lead');
    res.status(500).json({ success: false, error: 'Failed to create lead' });
  }
}

export async function updateLead(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;
    const { name, email, phone, companyName, source, status, notes, tags, sortOrder, isArchived } = req.body;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'contacts', 'update', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to update leads' });
      return;
    }

    const lead = await crmService.updateLead(userId, tenantId, id, {
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
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const perm = await getAppPermission(req.auth?.tenantId, userId, 'crm');
    if (!canAccessEntity(perm.role, 'contacts', 'delete', perm.entityPermissions)) {
      res.status(403).json({ success: false, error: 'No permission to delete leads' });
      return;
    }

    await crmService.deleteLead(userId, tenantId, id, perm.recordAccess);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete CRM lead');
    res.status(500).json({ success: false, error: 'Failed to delete lead' });
  }
}

export async function enrichLead(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const data = await crmService.enrichLead(userId, tenantId, id);
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
    const tenantId = req.auth!.tenantId;
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

    // Fetch lead name before conversion for the notification title
    const leadBeforeConvert = await crmService.getLead(userId, tenantId, id, 'all');

    const result = await crmService.convertLead(userId, tenantId, id, {
      dealTitle: dealTitle.trim(), dealStageId, dealValue,
    });

    if (req.auth!.tenantId && leadBeforeConvert) {
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'crm',
        eventType: 'lead.converted',
        title: `converted lead "${leadBeforeConvert.name}" to deal`,
        metadata: { leadId: id, dealId: result.deal.id },
      }).catch(() => {});
    }

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

export async function seedSampleLeads(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const result = await crmService.seedSampleLeads(userId, tenantId);
    res.json({ success: true, data: { message: 'Seeded CRM sample leads', ...result } });
  } catch (error) {
    logger.error({ error }, 'Failed to seed CRM sample leads');
    res.status(500).json({ success: false, error: 'Failed to seed sample leads' });
  }
}

// ─── Lead Forms ────────────────────────────────────────────────────

export async function listLeadForms(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const forms = await crmService.listLeadForms(userId, tenantId);
    res.json({ success: true, data: { forms } });
  } catch (error) {
    logger.error({ error }, 'Failed to list CRM lead forms');
    res.status(500).json({ success: false, error: 'Failed to list lead forms' });
  }
}

export async function createLeadForm(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { name } = req.body;

    const form = await crmService.createLeadForm(userId, tenantId, name || 'Default Lead Form');
    res.json({ success: true, data: form });
  } catch (error) {
    logger.error({ error }, 'Failed to create CRM lead form');
    res.status(500).json({ success: false, error: 'Failed to create lead form' });
  }
}

export async function updateLeadForm(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;
    const { name, fields, isActive } = req.body;

    const form = await crmService.updateLeadForm(userId, tenantId, id, {
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
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    await crmService.deleteLeadForm(userId, tenantId, id);
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
