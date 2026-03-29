import type { Request, Response } from 'express';
import * as crmService from './service';
import { logger } from '../../utils/logger';

// ─── Companies ──────────────────────────────────────────────────────

export async function listCompanies(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { search, industry, includeArchived } = req.query;

    const companies = await crmService.listCompanies(userId, accountId, {
      search: search as string | undefined,
      industry: industry as string | undefined,
      includeArchived: includeArchived === 'true',
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

    const company = await crmService.getCompany(userId, accountId, id);
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

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const company = await crmService.createCompany(userId, accountId, {
      name: name.trim(), domain, industry, size, address, phone, tags,
    });

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

    const company = await crmService.updateCompany(userId, accountId, id, {
      name, domain, industry, size, address, phone, tags, sortOrder, isArchived,
    });

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

    await crmService.deleteCompany(userId, accountId, id);
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

    const contacts = await crmService.listContacts(userId, accountId, {
      search: search as string | undefined,
      companyId: companyId as string | undefined,
      includeArchived: includeArchived === 'true',
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

    const contact = await crmService.getContact(userId, accountId, id);
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

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const contact = await crmService.createContact(userId, accountId, {
      name: name.trim(), email, phone, companyId, position, source, tags,
    });

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

    const contact = await crmService.updateContact(userId, accountId, id, {
      name, email, phone, companyId, position, source, tags, sortOrder, isArchived,
    });

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

    await crmService.deleteContact(userId, accountId, id);
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
    const accountId = req.auth!.accountId;
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

    const deals = await crmService.listDeals(userId, accountId, {
      stageId: stageId as string | undefined,
      contactId: contactId as string | undefined,
      companyId: companyId as string | undefined,
      includeArchived: includeArchived === 'true',
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

    const deal = await crmService.getDeal(userId, accountId, id);
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

    const deal = await crmService.updateDeal(userId, accountId, id, {
      title, value, stageId, contactId, companyId, assignedUserId,
      probability, expectedCloseDate, tags, sortOrder, isArchived,
    });

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

    await crmService.deleteDeal(userId, accountId, id);
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

    const deal = await crmService.markDealWon(userId, accountId, id);
    if (!deal) {
      res.status(404).json({ success: false, error: 'Deal not found' });
      return;
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

    const deal = await crmService.markDealLost(userId, accountId, id, reason);
    if (!deal) {
      res.status(404).json({ success: false, error: 'Deal not found' });
      return;
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

    const counts = await crmService.countsByStage(userId, accountId);
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

    const value = await crmService.pipelineValue(userId, accountId);
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

    const activities = await crmService.listActivities(userId, accountId, {
      dealId: dealId as string | undefined,
      contactId: contactId as string | undefined,
      companyId: companyId as string | undefined,
      includeArchived: includeArchived === 'true',
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
