import type { Request, Response } from 'express';
import * as projectService from '../service';
import { logger } from '../../../utils/logger';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';

// ─── Clients ────────────────────────────────────────────────────────

export async function listClients(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { search, includeArchived } = req.query;

    const clients = await projectService.listClients(userId, tenantId, {
      search: search as string | undefined,
      includeArchived: includeArchived === 'true',
    });

    res.json({ success: true, data: { clients } });
  } catch (error) {
    logger.error({ error }, 'Failed to list project clients');
    res.status(500).json({ success: false, error: 'Failed to list clients' });
  }
}

export async function getClient(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const client = await projectService.getClient(userId, tenantId, id);
    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    res.json({ success: true, data: client });
  } catch (error) {
    logger.error({ error }, 'Failed to get project client');
    res.status(500).json({ success: false, error: 'Failed to get client' });
  }
}

export async function createClient(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { name, email, phone, address, city, state, country, postalCode, currency, logo, notes } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const client = await projectService.createClient(userId, tenantId, {
      name: name.trim(), email, phone, address, city, state, country, postalCode, currency, logo, notes,
    });

    res.json({ success: true, data: client });
  } catch (error) {
    logger.error({ error }, 'Failed to create project client');
    res.status(500).json({ success: false, error: 'Failed to create client' });
  }
}

export async function updateClient(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;
    const { name, email, phone, address, city, state, country, postalCode, currency, logo, notes, sortOrder, isArchived } = req.body;

    const client = await projectService.updateClient(userId, tenantId, id, {
      name, email, phone, address, city, state, country, postalCode, currency, logo, notes, sortOrder, isArchived,
    });

    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    res.json({ success: true, data: client });
  } catch (error) {
    logger.error({ error }, 'Failed to update project client');
    res.status(500).json({ success: false, error: 'Failed to update client' });
  }
}

export async function deleteClient(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    await projectService.deleteClient(userId, tenantId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete project client');
    res.status(500).json({ success: false, error: 'Failed to delete client' });
  }
}

export async function regeneratePortalToken(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const client = await projectService.regeneratePortalToken(userId, tenantId, id);
    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    res.json({ success: true, data: client });
  } catch (error) {
    logger.error({ error }, 'Failed to regenerate portal token');
    res.status(500).json({ success: false, error: 'Failed to regenerate portal token' });
  }
}

// ─── Portal (public) ────────────────────────────────────────────────

export async function portalGetClient(req: Request, res: Response) {
  try {
    const token = req.params.token as string;
    const client = await projectService.getClientByPortalToken(token);
    if (!client) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    res.json({ success: true, data: client });
  } catch (error) {
    logger.error({ error }, 'Failed to get portal client');
    res.status(500).json({ success: false, error: 'Failed to get portal client' });
  }
}

export async function portalListInvoices(req: Request, res: Response) {
  try {
    const token = req.params.token as string;
    const invoices = await projectService.listClientInvoices(token);
    if (!invoices) {
      res.status(404).json({ success: false, error: 'Client not found' });
      return;
    }

    res.json({ success: true, data: { invoices } });
  } catch (error) {
    logger.error({ error }, 'Failed to list portal invoices');
    res.status(500).json({ success: false, error: 'Failed to list portal invoices' });
  }
}

export async function portalGetInvoiceDetail(req: Request, res: Response) {
  try {
    const token = req.params.token as string;
    const invoiceId = req.params.invoiceId as string;
    const detail = await projectService.getClientInvoiceDetail(token, invoiceId);
    if (!detail) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    res.json({ success: true, data: detail });
  } catch (error) {
    logger.error({ error }, 'Failed to get portal invoice detail');
    res.status(500).json({ success: false, error: 'Failed to get portal invoice detail' });
  }
}
