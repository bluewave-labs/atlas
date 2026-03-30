import type { Request, Response } from 'express';
import * as projectService from './service';
import { logger } from '../../utils/logger';
import { emitAppEvent } from '../../services/event.service';

// ─── Widget ─────────────────────────────────────────────────────────

export async function getWidgetData(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const data = await projectService.getWidgetData(accountId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get Projects widget data');
    res.status(500).json({ success: false, error: 'Failed to get Projects widget data' });
  }
}

// ─── Clients ────────────────────────────────────────────────────────

export async function listClients(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { search, includeArchived } = req.query;

    const clients = await projectService.listClients(userId, accountId, {
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
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    const client = await projectService.getClient(userId, accountId, id);
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
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { name, email, phone, address, city, state, country, postalCode, currency, logo, notes } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const client = await projectService.createClient(userId, accountId, {
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
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;
    const { name, email, phone, address, city, state, country, postalCode, currency, logo, notes, sortOrder, isArchived } = req.body;

    const client = await projectService.updateClient(userId, accountId, id, {
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
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    await projectService.deleteClient(userId, accountId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete project client');
    res.status(500).json({ success: false, error: 'Failed to delete client' });
  }
}

export async function regeneratePortalToken(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    const client = await projectService.regeneratePortalToken(userId, accountId, id);
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

// ─── Projects ───────────────────────────────────────────────────────

export async function listProjects(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { search, clientId, status, includeArchived } = req.query;

    const projects = await projectService.listProjects(userId, accountId, {
      search: search as string | undefined,
      clientId: clientId as string | undefined,
      status: status as string | undefined,
      includeArchived: includeArchived === 'true',
    });

    res.json({ success: true, data: { projects } });
  } catch (error) {
    logger.error({ error }, 'Failed to list projects');
    res.status(500).json({ success: false, error: 'Failed to list projects' });
  }
}

export async function getProject(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    const project = await projectService.getProject(userId, accountId, id);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    res.json({ success: true, data: project });
  } catch (error) {
    logger.error({ error }, 'Failed to get project');
    res.status(500).json({ success: false, error: 'Failed to get project' });
  }
}

export async function createProject(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { name, clientId, description, billable, status, estimatedHours, estimatedAmount, startDate, endDate, color } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const project = await projectService.createProject(userId, accountId, {
      name: name.trim(), clientId, description, billable, status, estimatedHours, estimatedAmount, startDate, endDate, color,
    });

    if (req.auth!.tenantId) {
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'projects',
        eventType: 'project.created',
        title: `created project: ${project.name}`,
        metadata: { projectId: project.id },
      }).catch(() => {});
    }

    res.json({ success: true, data: project });
  } catch (error) {
    logger.error({ error }, 'Failed to create project');
    res.status(500).json({ success: false, error: 'Failed to create project' });
  }
}

export async function updateProject(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;
    const { name, clientId, description, billable, status, estimatedHours, estimatedAmount, startDate, endDate, color, sortOrder, isArchived } = req.body;

    const project = await projectService.updateProject(userId, accountId, id, {
      name, clientId, description, billable, status, estimatedHours, estimatedAmount, startDate, endDate, color, sortOrder, isArchived,
    });

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    res.json({ success: true, data: project });
  } catch (error) {
    logger.error({ error }, 'Failed to update project');
    res.status(500).json({ success: false, error: 'Failed to update project' });
  }
}

export async function deleteProject(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    await projectService.deleteProject(userId, accountId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete project');
    res.status(500).json({ success: false, error: 'Failed to delete project' });
  }
}

// ─── Members ────────────────────────────────────────────────────────

export async function listProjectMembers(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const projectId = req.params.projectId as string;

    const members = await projectService.listProjectMembers(userId, accountId, projectId);
    res.json({ success: true, data: { members } });
  } catch (error) {
    logger.error({ error }, 'Failed to list project members');
    res.status(500).json({ success: false, error: 'Failed to list project members' });
  }
}

export async function addProjectMember(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const projectId = req.params.projectId as string;
    const { userId: memberUserId, hourlyRate, role } = req.body;

    // Verify the project belongs to the authenticated user's account
    const project = await projectService.getProject(userId, accountId, projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    if (!memberUserId) {
      res.status(400).json({ success: false, error: 'userId is required' });
      return;
    }

    const member = await projectService.addProjectMember(projectId, memberUserId, hourlyRate ?? null, role ?? 'member');
    res.json({ success: true, data: member });
  } catch (error) {
    logger.error({ error }, 'Failed to add project member');
    res.status(500).json({ success: false, error: 'Failed to add project member' });
  }
}

export async function removeProjectMember(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const projectId = req.params.projectId as string;
    const memberId = req.params.memberId as string;

    // Verify the project belongs to the authenticated user's account
    const project = await projectService.getProject(userId, accountId, projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    await projectService.removeProjectMember(projectId, memberId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to remove project member');
    res.status(500).json({ success: false, error: 'Failed to remove project member' });
  }
}

export async function updateProjectMemberRate(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const projectId = req.params.projectId as string;
    const memberId = req.params.memberId as string;
    const { hourlyRate } = req.body;

    // Verify the project belongs to the authenticated user's account
    const project = await projectService.getProject(userId, accountId, projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const member = await projectService.updateProjectMemberRate(projectId, memberId, hourlyRate ?? null);
    if (!member) {
      res.status(404).json({ success: false, error: 'Member not found' });
      return;
    }

    res.json({ success: true, data: member });
  } catch (error) {
    logger.error({ error }, 'Failed to update member rate');
    res.status(500).json({ success: false, error: 'Failed to update member rate' });
  }
}

// ─── Time Entries ───────────────────────────────────────────────────

export async function listTimeEntries(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { projectId, startDate, endDate, billed, billable, entryUserId, includeArchived } = req.query;

    const entries = await projectService.listTimeEntries(userId, accountId, {
      projectId: projectId as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      billed: billed !== undefined ? billed === 'true' : undefined,
      billable: billable !== undefined ? billable === 'true' : undefined,
      entryUserId: entryUserId as string | undefined,
      includeArchived: includeArchived === 'true',
    });

    res.json({ success: true, data: { entries } });
  } catch (error) {
    logger.error({ error }, 'Failed to list time entries');
    res.status(500).json({ success: false, error: 'Failed to list time entries' });
  }
}

export async function getTimeEntry(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    const entry = await projectService.getTimeEntry(userId, accountId, id);
    if (!entry) {
      res.status(404).json({ success: false, error: 'Time entry not found' });
      return;
    }

    res.json({ success: true, data: entry });
  } catch (error) {
    logger.error({ error }, 'Failed to get time entry');
    res.status(500).json({ success: false, error: 'Failed to get time entry' });
  }
}

export async function createTimeEntry(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { projectId, durationMinutes, workDate, startTime, endTime, billable, notes, taskDescription } = req.body;

    if (!projectId || !workDate) {
      res.status(400).json({ success: false, error: 'projectId and workDate are required' });
      return;
    }

    const entry = await projectService.createTimeEntry(userId, accountId, {
      projectId, durationMinutes: durationMinutes || 0, workDate, startTime, endTime, billable, notes, taskDescription,
    });

    res.json({ success: true, data: entry });
  } catch (error) {
    logger.error({ error }, 'Failed to create time entry');
    res.status(500).json({ success: false, error: 'Failed to create time entry' });
  }
}

export async function updateTimeEntry(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;
    const { projectId, durationMinutes, workDate, startTime, endTime, billable, billed, locked, notes, taskDescription, sortOrder, isArchived } = req.body;

    const entry = await projectService.updateTimeEntry(userId, accountId, id, {
      projectId, durationMinutes, workDate, startTime, endTime, billable, billed, locked, notes, taskDescription, sortOrder, isArchived,
    });

    if (!entry) {
      res.status(404).json({ success: false, error: 'Time entry not found' });
      return;
    }

    res.json({ success: true, data: entry });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Cannot edit a locked time entry') {
      res.status(409).json({ success: false, error: error.message });
      return;
    }
    logger.error({ error }, 'Failed to update time entry');
    res.status(500).json({ success: false, error: 'Failed to update time entry' });
  }
}

export async function deleteTimeEntry(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    await projectService.deleteTimeEntry(userId, accountId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete time entry');
    res.status(500).json({ success: false, error: 'Failed to delete time entry' });
  }
}

export async function bulkLockEntries(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { entryIds, locked } = req.body;

    if (!Array.isArray(entryIds) || entryIds.length === 0) {
      res.status(400).json({ success: false, error: 'entryIds array is required' });
      return;
    }

    await projectService.bulkLockEntries(userId, accountId, entryIds, locked ?? true);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to bulk lock entries');
    res.status(500).json({ success: false, error: 'Failed to bulk lock entries' });
  }
}

export async function getWeeklyView(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const weekStart = req.query.weekStart as string;

    if (!weekStart) {
      res.status(400).json({ success: false, error: 'weekStart query parameter is required' });
      return;
    }

    const entries = await projectService.getWeeklyView(userId, accountId, weekStart);
    res.json({ success: true, data: { entries } });
  } catch (error) {
    logger.error({ error }, 'Failed to get weekly view');
    res.status(500).json({ success: false, error: 'Failed to get weekly view' });
  }
}

// ─── Invoices ───────────────────────────────────────────────────────

export async function listInvoices(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { clientId, status, includeArchived } = req.query;

    const invoices = await projectService.listInvoices(userId, accountId, {
      clientId: clientId as string | undefined,
      status: status as string | undefined,
      includeArchived: includeArchived === 'true',
    });

    res.json({ success: true, data: { invoices } });
  } catch (error) {
    logger.error({ error }, 'Failed to list invoices');
    res.status(500).json({ success: false, error: 'Failed to list invoices' });
  }
}

export async function getInvoice(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    const invoice = await projectService.getInvoice(userId, accountId, id);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    logger.error({ error }, 'Failed to get invoice');
    res.status(500).json({ success: false, error: 'Failed to get invoice' });
  }
}

export async function createInvoice(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { clientId, invoiceNumber, status, amount, tax, taxAmount, discount, discountAmount, currency, issueDate, dueDate, notes } = req.body;

    if (!clientId) {
      res.status(400).json({ success: false, error: 'clientId is required' });
      return;
    }

    const invoice = await projectService.createInvoice(userId, accountId, {
      clientId, invoiceNumber, status, amount, tax, taxAmount, discount, discountAmount, currency, issueDate, dueDate, notes,
    });

    res.json({ success: true, data: invoice });
  } catch (error) {
    logger.error({ error }, 'Failed to create invoice');
    res.status(500).json({ success: false, error: 'Failed to create invoice' });
  }
}

export async function updateInvoice(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;
    const { clientId, invoiceNumber, status, amount, tax, taxAmount, discount, discountAmount, currency, issueDate, dueDate, notes, isArchived } = req.body;

    const invoice = await projectService.updateInvoice(userId, accountId, id, {
      clientId, invoiceNumber, status, amount, tax, taxAmount, discount, discountAmount, currency, issueDate, dueDate, notes, isArchived,
    });

    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    logger.error({ error }, 'Failed to update invoice');
    res.status(500).json({ success: false, error: 'Failed to update invoice' });
  }
}

export async function deleteInvoice(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    await projectService.deleteInvoice(userId, accountId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete invoice');
    res.status(500).json({ success: false, error: 'Failed to delete invoice' });
  }
}

export async function sendInvoice(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    const invoice = await projectService.sendInvoice(userId, accountId, id);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    // Get client name for event
    const fullInvoice = await projectService.getInvoice(userId, accountId, id);

    if (req.auth!.tenantId) {
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'projects',
        eventType: 'invoice.sent',
        title: `sent invoice ${invoice.invoiceNumber} to ${fullInvoice?.clientName ?? 'client'}`,
        metadata: { invoiceId: invoice.id },
      }).catch(() => {});
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    logger.error({ error }, 'Failed to send invoice');
    res.status(500).json({ success: false, error: 'Failed to send invoice' });
  }
}

export async function markInvoicePaid(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    const invoice = await projectService.markInvoicePaid(userId, accountId, id);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    if (req.auth!.tenantId) {
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'projects',
        eventType: 'invoice.paid',
        title: `invoice ${invoice.invoiceNumber} marked as paid`,
        metadata: { invoiceId: invoice.id },
      }).catch(() => {});
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    logger.error({ error }, 'Failed to mark invoice paid');
    res.status(500).json({ success: false, error: 'Failed to mark invoice paid' });
  }
}

export async function duplicateInvoice(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    const invoice = await projectService.duplicateInvoice(userId, accountId, id);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    logger.error({ error }, 'Failed to duplicate invoice');
    res.status(500).json({ success: false, error: 'Failed to duplicate invoice' });
  }
}

export async function getNextInvoiceNumber(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const invoiceNumber = await projectService.getNextInvoiceNumber(accountId);
    res.json({ success: true, data: { invoiceNumber } });
  } catch (error) {
    logger.error({ error }, 'Failed to get next invoice number');
    res.status(500).json({ success: false, error: 'Failed to get next invoice number' });
  }
}

// ─── Line Items ─────────────────────────────────────────────────────

export async function listLineItems(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const invoiceId = req.params.invoiceId as string;

    // Verify the invoice belongs to the authenticated user's account
    const invoice = await projectService.getInvoice(userId, accountId, invoiceId);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    const lineItems = await projectService.listInvoiceLineItems(invoiceId);
    res.json({ success: true, data: { lineItems } });
  } catch (error) {
    logger.error({ error }, 'Failed to list line items');
    res.status(500).json({ success: false, error: 'Failed to list line items' });
  }
}

export async function createLineItem(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const invoiceId = req.params.invoiceId as string;
    const { timeEntryId, description, quantity, unitPrice, amount } = req.body;

    // Verify the invoice belongs to the authenticated user's account
    const invoice = await projectService.getInvoice(userId, accountId, invoiceId);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    if (!description) {
      res.status(400).json({ success: false, error: 'description is required' });
      return;
    }

    const lineItem = await projectService.createLineItem({
      invoiceId, timeEntryId, description, quantity: quantity ?? 1, unitPrice: unitPrice ?? 0, amount: amount ?? 0,
    });

    res.json({ success: true, data: lineItem });
  } catch (error) {
    logger.error({ error }, 'Failed to create line item');
    res.status(500).json({ success: false, error: 'Failed to create line item' });
  }
}

export async function updateLineItem(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;
    const { description, quantity, unitPrice, amount } = req.body;

    // Verify the line item's invoice belongs to the authenticated user's account
    const existingLineItem = await projectService.getLineItemById(id);
    if (!existingLineItem) {
      res.status(404).json({ success: false, error: 'Line item not found' });
      return;
    }
    const invoice = await projectService.getInvoice(userId, accountId, existingLineItem.invoiceId);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    const lineItem = await projectService.updateLineItem(id, { description, quantity, unitPrice, amount });
    if (!lineItem) {
      res.status(404).json({ success: false, error: 'Line item not found' });
      return;
    }

    res.json({ success: true, data: lineItem });
  } catch (error) {
    logger.error({ error }, 'Failed to update line item');
    res.status(500).json({ success: false, error: 'Failed to update line item' });
  }
}

export async function deleteLineItem(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    // Verify the line item's invoice belongs to the authenticated user's account
    const existingLineItem = await projectService.getLineItemById(id);
    if (!existingLineItem) {
      res.status(404).json({ success: false, error: 'Line item not found' });
      return;
    }
    const invoice = await projectService.getInvoice(userId, accountId, existingLineItem.invoiceId);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    await projectService.deleteLineItem(id);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete line item');
    res.status(500).json({ success: false, error: 'Failed to delete line item' });
  }
}

export async function populateFromTimeEntries(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const invoiceId = req.params.invoiceId as string;
    const { clientId, startDate, endDate } = req.body;

    if (!clientId || !startDate || !endDate) {
      res.status(400).json({ success: false, error: 'clientId, startDate, and endDate are required' });
      return;
    }

    const lineItems = await projectService.populateFromTimeEntries(accountId, invoiceId, clientId, startDate, endDate);
    res.json({ success: true, data: { lineItems } });
  } catch (error) {
    logger.error({ error }, 'Failed to populate from time entries');
    res.status(500).json({ success: false, error: 'Failed to populate from time entries' });
  }
}

// ─── Reports ────────────────────────────────────────────────────────

export async function getTimeReport(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { startDate, endDate, projectId } = req.query;

    const report = await projectService.getTimeReport(userId, accountId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      projectId: projectId as string | undefined,
    });

    res.json({ success: true, data: report });
  } catch (error) {
    logger.error({ error }, 'Failed to get time report');
    res.status(500).json({ success: false, error: 'Failed to get time report' });
  }
}

export async function getRevenueReport(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { startDate, endDate } = req.query;

    const report = await projectService.getRevenueReport(userId, accountId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });

    res.json({ success: true, data: report });
  } catch (error) {
    logger.error({ error }, 'Failed to get revenue report');
    res.status(500).json({ success: false, error: 'Failed to get revenue report' });
  }
}

export async function getProjectProfitability(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;

    const report = await projectService.getProjectProfitability(userId, accountId);
    res.json({ success: true, data: report });
  } catch (error) {
    logger.error({ error }, 'Failed to get project profitability');
    res.status(500).json({ success: false, error: 'Failed to get project profitability' });
  }
}

export async function getTeamUtilization(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { startDate, endDate } = req.query;

    const report = await projectService.getTeamUtilization(userId, accountId, {
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
    });

    res.json({ success: true, data: report });
  } catch (error) {
    logger.error({ error }, 'Failed to get team utilization');
    res.status(500).json({ success: false, error: 'Failed to get team utilization' });
  }
}

// ─── Settings ───────────────────────────────────────────────────────

export async function getSettings(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const settings = await projectService.getSettings(accountId);
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error({ error }, 'Failed to get project settings');
    res.status(500).json({ success: false, error: 'Failed to get project settings' });
  }
}

export async function updateSettings(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const { invoicePrefix, defaultHourlyRate, companyName, companyAddress, companyLogo, nextInvoiceNumber } = req.body;

    const settings = await projectService.updateSettings(accountId, {
      invoicePrefix, defaultHourlyRate, companyName, companyAddress, companyLogo, nextInvoiceNumber,
    });

    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error({ error }, 'Failed to update project settings');
    res.status(500).json({ success: false, error: 'Failed to update project settings' });
  }
}

// ─── Preview Time Entry Line Items ───────────────────────────────────

export async function previewTimeEntryLineItems(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;
    const { clientId, startDate, endDate } = req.body;

    if (!clientId || !startDate || !endDate) {
      res.status(400).json({ success: false, error: 'clientId, startDate, and endDate are required' });
      return;
    }

    const lineItems = await projectService.previewTimeEntryLineItems(accountId, clientId, startDate, endDate);
    res.json({ success: true, data: { lineItems } });
  } catch (error) {
    logger.error({ error }, 'Failed to preview time entry line items');
    res.status(500).json({ success: false, error: 'Failed to preview time entry line items' });
  }
}

// ─── Bulk Time Entry Operations ───────────────────────────────────────

export async function bulkSaveTimeEntries(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { entries } = req.body;

    if (!Array.isArray(entries)) {
      res.status(400).json({ success: false, error: 'entries array is required' });
      return;
    }

    const created = await projectService.bulkSaveTimeEntries(userId, accountId, entries);
    res.json({ success: true, data: created });
  } catch (error) {
    logger.error({ error }, 'Failed to bulk save time entries');
    res.status(500).json({ success: false, error: 'Failed to bulk save time entries' });
  }
}

export async function copyLastWeek(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { weekStart } = req.body;

    if (!weekStart) {
      res.status(400).json({ success: false, error: 'weekStart is required' });
      return;
    }

    const created = await projectService.copyLastWeek(userId, accountId, weekStart);
    res.json({ success: true, data: created });
  } catch (error) {
    logger.error({ error }, 'Failed to copy last week entries');
    res.status(500).json({ success: false, error: 'Failed to copy last week entries' });
  }
}

export async function waiveInvoice(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const id = req.params.id as string;

    const invoice = await projectService.waiveInvoice(userId, accountId, id);
    if (!invoice) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    logger.error({ error }, 'Failed to waive invoice');
    res.status(500).json({ success: false, error: 'Failed to waive invoice' });
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

// ─── Seed ──────────────────────────────────────────────────────────

export async function seedSampleData(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const result = await projectService.seedSampleData(userId, accountId);
    res.json({ success: true, data: { message: 'Seeded Projects sample data', ...result } });
  } catch (error) {
    logger.error({ error }, 'Failed to seed Projects sample data');
    res.status(500).json({ success: false, error: 'Failed to seed Projects data' });
  }
}
