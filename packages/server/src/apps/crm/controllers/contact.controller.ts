import type { Request, Response } from 'express';
import * as crmService from '../services/contact.service';
import { logger } from '../../../utils/logger';
import { emitAppEvent } from '../../../services/event.service';
import { getAppPermission, canAccessEntity } from '../../../services/app-permissions.service';

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
