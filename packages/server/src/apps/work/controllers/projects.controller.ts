import type { Request, Response } from 'express';
import * as projectService from '../services/project.service';
import * as financialService from '../services/financial.service';
import * as dashboardService from '../services/dashboard.service';
import { logger } from '../../../utils/logger';
import { emitAppEvent } from '../../../services/event.service';
import { canAccess } from '../../../services/app-permissions.service';
import { db } from '../../../config/database';
import { projectTimeEntries, invoiceLineItems, projectProjects, invoices } from '../../../db/schema';
import { eq as eqDb, and as andDb, gte, lte, isNull as isNullDb, inArray } from 'drizzle-orm';

// ─── Dashboard ───────────────────────────────────────────────────────

export async function getDashboard(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const data = await dashboardService.getDashboardData(userId, tenantId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get work dashboard');
    res.status(500).json({ success: false, error: 'Failed to get work dashboard' });
  }
}

// ─── Projects ───────────────────────────────────────────────────────

export async function listProjects(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const { search, companyId, clientId, status, includeArchived } = req.query;

    const isAdmin = perm.role === 'admin';
    const projects = await projectService.listProjects(userId, tenantId, {
      search: search as string | undefined,
      companyId: (companyId || clientId) as string | undefined,
      status: status as string | undefined,
      includeArchived: includeArchived === 'true',
      isAdmin,
    });

    res.json({ success: true, data: { projects } });
  } catch (error) {
    logger.error({ error }, 'Failed to list projects');
    res.status(500).json({ success: false, error: 'Failed to list projects' });
  }
}

export async function getProject(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const id = req.params.id as string;

    const project = await projectService.getProject(userId, tenantId, id);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    if (!canAccess(perm.role, 'update')) {
      const allowed = await projectService.userCanAccessProject(userId, tenantId, id);
      if (!allowed) {
        res.status(403).json({ success: false, error: 'No permission to view this project' });
        return;
      }
    }

    res.json({ success: true, data: project });
  } catch (error) {
    logger.error({ error }, 'Failed to get project');
    res.status(500).json({ success: false, error: 'Failed to get project' });
  }
}

export async function createProject(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const { name, companyId, clientId, description, billable, status, estimatedHours, estimatedAmount, startDate, endDate, color } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const project = await projectService.createProject(userId, tenantId, {
      name: name.trim(), companyId: companyId || clientId, description, billable, status, estimatedHours, estimatedAmount, startDate, endDate, color,
    });

    if (req.auth!.tenantId) {
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'work',
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
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const id = req.params.id as string;
    const { name, companyId, clientId, description, billable, status, estimatedHours, estimatedAmount, startDate, endDate, color, sortOrder, isArchived } = req.body;

    const project = await projectService.updateProject(userId, tenantId, id, {
      name, companyId: companyId ?? clientId, description, billable, status, estimatedHours, estimatedAmount, startDate, endDate, color, sortOrder, isArchived,
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
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const id = req.params.id as string;

    if (!canAccess(perm.role, 'delete')) {
      const allowed = await projectService.userCanAccessProject(userId, tenantId, id);
      if (!allowed) {
        res.status(403).json({ success: false, error: 'No permission to delete this project' });
        return;
      }
    }

    await projectService.deleteProject(userId, tenantId, id);
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
    const tenantId = req.auth!.tenantId!;
    const projectId = req.params.id as string;

    const members = await projectService.listProjectMembers(userId, tenantId, projectId);
    res.json({ success: true, data: { members } });
  } catch (error) {
    logger.error({ error }, 'Failed to list project members');
    res.status(500).json({ success: false, error: 'Failed to list project members' });
  }
}

export async function addProjectMember(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to manage project members' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const projectId = req.params.id as string;
    const { userId: memberUserId, hourlyRate } = req.body;

    const project = await projectService.getProject(userId, tenantId, projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    if (!canAccess(perm.role, 'update') && project.userId !== userId) {
      res.status(403).json({ success: false, error: 'Only the project owner or an admin can manage members' });
      return;
    }

    if (!memberUserId) {
      res.status(400).json({ success: false, error: 'userId is required' });
      return;
    }

    const member = await projectService.addProjectMember(projectId, memberUserId, hourlyRate ?? null);
    res.json({ success: true, data: member });
  } catch (error) {
    logger.error({ error }, 'Failed to add project member');
    res.status(500).json({ success: false, error: 'Failed to add project member' });
  }
}

export async function removeProjectMember(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to remove project members' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const projectId = req.params.id as string;
    const memberId = req.params.memberId as string;

    const project = await projectService.getProject(userId, tenantId, projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    if (!canAccess(perm.role, 'delete') && project.userId !== userId) {
      res.status(403).json({ success: false, error: 'Only the project owner or an admin can manage members' });
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
    const perm = req.workPerm!;
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const projectId = req.params.id as string;
    const memberId = req.params.memberId as string;
    const { hourlyRate } = req.body;

    const project = await projectService.getProject(userId, tenantId, projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    if (!canAccess(perm.role, 'update') && project.userId !== userId) {
      res.status(403).json({ success: false, error: 'Only the project owner or an admin can update member rates' });
      return;
    }

    const member = await projectService.updateProjectMemberRate(projectId, memberId, hourlyRate ?? null);
    if (!member) {
      res.status(404).json({ success: false, error: 'Project member not found' });
      return;
    }
    res.json({ success: true, data: member });
  } catch (error) {
    logger.error({ error }, 'Failed to update project member rate');
    res.status(500).json({ success: false, error: 'Failed to update project member rate' });
  }
}

// ─── Time Entries ────────────────────────────────────────────────────

export async function listProjectTimeEntries(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const projectId = req.params.id as string;
    const { startDate, endDate, billed, billable, entryUserId, includeArchived } = req.query;

    const isAdmin = perm.role === 'admin';
    const entries = await projectService.listTimeEntries(userId, tenantId, {
      projectId,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      billed: billed !== undefined ? billed === 'true' : undefined,
      billable: billable !== undefined ? billable === 'true' : undefined,
      entryUserId: entryUserId as string | undefined,
      includeArchived: includeArchived === 'true',
      isAdmin,
    });

    res.json({ success: true, data: { entries } });
  } catch (error) {
    logger.error({ error }, 'Failed to list project time entries');
    res.status(500).json({ success: false, error: 'Failed to list project time entries' });
  }
}

export async function createProjectTimeEntry(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create time entries' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const projectId = req.params.id as string;
    const { durationMinutes, workDate, startTime, endTime, billable, notes, taskDescription, tags, rateId } = req.body;

    if (!workDate) {
      res.status(400).json({ success: false, error: 'workDate is required' });
      return;
    }

    const isAdmin = perm.role === 'admin';
    let entry;
    try {
      entry = await projectService.createTimeEntry(userId, tenantId, {
        projectId, durationMinutes: durationMinutes || 0, workDate, startTime, endTime, billable, notes, taskDescription, tags, rateId,
      }, { isAdmin });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create time entry';
      if (msg === 'No access to this project' || msg === 'Project not found') {
        res.status(403).json({ success: false, error: msg });
        return;
      }
      throw err;
    }

    res.json({ success: true, data: entry });
  } catch (error) {
    logger.error({ error }, 'Failed to create project time entry');
    res.status(500).json({ success: false, error: 'Failed to create project time entry' });
  }
}

export async function updateProjectTimeEntry(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update time entries' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const entryId = req.params.entryId as string;
    const { durationMinutes, workDate, startTime, endTime, billable, billed, paid, locked, notes, taskDescription, tags, rateId, sortOrder, isArchived } = req.body;

    const isAdmin = perm.role === 'admin';
    const scopedUserId = isAdmin ? undefined : userId;
    const entry = await projectService.updateTimeEntry(userId, tenantId, entryId, {
      durationMinutes, workDate, startTime, endTime, billable, billed, paid, locked, notes, taskDescription, tags, rateId, sortOrder, isArchived,
    }, scopedUserId);

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
    logger.error({ error }, 'Failed to update project time entry');
    res.status(500).json({ success: false, error: 'Failed to update project time entry' });
  }
}

export async function deleteProjectTimeEntry(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete time entries' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const entryId = req.params.entryId as string;

    const isAdmin = perm.role === 'admin';
    await projectService.deleteTimeEntry(userId, tenantId, entryId, isAdmin ? undefined : userId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete project time entry');
    res.status(500).json({ success: false, error: 'Failed to delete project time entry' });
  }
}

// ─── Flat Time Entries (cross-project list/create/update/delete) ─────

export async function listTimeEntries(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const { projectId, startDate, endDate, billed, billable, includeArchived } = req.query;

    const isAdmin = perm.role === 'admin';
    const entries = await projectService.listTimeEntries(userId, tenantId, {
      projectId: projectId as string | undefined,
      startDate: startDate as string | undefined,
      endDate: endDate as string | undefined,
      billed: billed !== undefined ? billed === 'true' : undefined,
      billable: billable !== undefined ? billable === 'true' : undefined,
      includeArchived: includeArchived === 'true',
      isAdmin,
    });

    res.json({ success: true, data: { entries } });
  } catch (error) {
    logger.error({ error }, 'Failed to list time entries');
    res.status(500).json({ success: false, error: 'Failed to list time entries' });
  }
}

export async function createTimeEntry(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create time entries' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const { projectId, durationMinutes, workDate, startTime, endTime, billable, notes, taskDescription, tags, rateId } = req.body;

    if (!projectId) {
      res.status(400).json({ success: false, error: 'projectId is required' });
      return;
    }
    if (!workDate) {
      res.status(400).json({ success: false, error: 'workDate is required' });
      return;
    }

    const isAdmin = perm.role === 'admin';
    let entry;
    try {
      entry = await projectService.createTimeEntry(userId, tenantId, {
        projectId, durationMinutes: durationMinutes || 0, workDate, startTime, endTime, billable, notes, taskDescription, tags, rateId,
      }, { isAdmin });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create time entry';
      if (msg === 'No access to this project' || msg === 'Project not found') {
        res.status(403).json({ success: false, error: msg });
        return;
      }
      throw err;
    }

    res.json({ success: true, data: entry });
  } catch (error) {
    logger.error({ error }, 'Failed to create time entry');
    res.status(500).json({ success: false, error: 'Failed to create time entry' });
  }
}

export async function updateTimeEntry(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update time entries' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const entryId = req.params.id as string;
    const { durationMinutes, workDate, startTime, endTime, billable, billed, paid, locked, notes, taskDescription, tags, rateId, sortOrder, isArchived } = req.body;

    const isAdmin = perm.role === 'admin';
    const scopedUserId = isAdmin ? undefined : userId;
    const entry = await projectService.updateTimeEntry(userId, tenantId, entryId, {
      durationMinutes, workDate, startTime, endTime, billable, billed, paid, locked, notes, taskDescription, tags, rateId, sortOrder, isArchived,
    }, scopedUserId);

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
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete time entries' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const entryId = req.params.id as string;

    const isAdmin = perm.role === 'admin';
    await projectService.deleteTimeEntry(userId, tenantId, entryId, isAdmin ? undefined : userId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete time entry');
    res.status(500).json({ success: false, error: 'Failed to delete time entry' });
  }
}

// ─── Time Billing (preview + populate into invoice) ──────────────────

export async function previewTimeBilling(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId!;
    const { companyId, startDate, endDate, timeEntryIds } = req.body;

    if (!companyId || !startDate || !endDate) {
      res.status(400).json({ success: false, error: 'companyId, startDate, endDate are required' });
      return;
    }

    // Get all unbilled billable time entries for projects belonging to this company in the date range
    const conditions = [
      eqDb(projectTimeEntries.tenantId, tenantId),
      eqDb(projectTimeEntries.billable, true),
      eqDb(projectTimeEntries.isArchived, false),
      isNullDb(projectTimeEntries.invoiceLineItemId),
      gte(projectTimeEntries.workDate, startDate as string),
      lte(projectTimeEntries.workDate, endDate as string),
    ];

    if (timeEntryIds && Array.isArray(timeEntryIds) && timeEntryIds.length > 0) {
      conditions.push(inArray(projectTimeEntries.id, timeEntryIds as string[]));
    }

    const entries = await db
      .select({
        id: projectTimeEntries.id,
        projectId: projectTimeEntries.projectId,
        projectName: projectProjects.name,
        workDate: projectTimeEntries.workDate,
        notes: projectTimeEntries.notes,
        durationMinutes: projectTimeEntries.durationMinutes,
        companyId: projectProjects.companyId,
      })
      .from(projectTimeEntries)
      .innerJoin(projectProjects, eqDb(projectTimeEntries.projectId, projectProjects.id))
      .where(andDb(...conditions));

    // Filter by companyId
    const filtered = entries.filter(e => e.companyId === companyId);

    const lineItems = filtered.map(e => ({
      id: e.id,
      description: e.notes || '',
      quantity: parseFloat((e.durationMinutes / 60).toFixed(4)),
      unitPrice: 0,
      projectId: e.projectId,
      projectName: e.projectName || '',
      workDate: e.workDate,
    }));

    res.json({ success: true, data: { lineItems } });
  } catch (error) {
    logger.error({ error }, 'Failed to preview time billing');
    res.status(500).json({ success: false, error: 'Failed to preview time entries' });
  }
}

export async function populateFromTimeBilling(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId!;
    const { invoiceId, companyId, startDate, endDate, timeEntryIds } = req.body;

    if (!invoiceId || !companyId || !startDate || !endDate) {
      res.status(400).json({ success: false, error: 'invoiceId, companyId, startDate, endDate are required' });
      return;
    }

    // Verify invoice belongs to this tenant
    const [inv] = await db.select({ id: invoices.id }).from(invoices)
      .where(andDb(eqDb(invoices.id, invoiceId), eqDb(invoices.tenantId, tenantId)))
      .limit(1);
    if (!inv) {
      res.status(404).json({ success: false, error: 'Invoice not found' });
      return;
    }

    const conditions = [
      eqDb(projectTimeEntries.tenantId, tenantId),
      eqDb(projectTimeEntries.billable, true),
      eqDb(projectTimeEntries.isArchived, false),
      isNullDb(projectTimeEntries.invoiceLineItemId),
      gte(projectTimeEntries.workDate, startDate as string),
      lte(projectTimeEntries.workDate, endDate as string),
    ];

    if (timeEntryIds && Array.isArray(timeEntryIds) && timeEntryIds.length > 0) {
      conditions.push(inArray(projectTimeEntries.id, timeEntryIds as string[]));
    }

    const entries = await db
      .select({
        id: projectTimeEntries.id,
        projectId: projectTimeEntries.projectId,
        projectName: projectProjects.name,
        workDate: projectTimeEntries.workDate,
        notes: projectTimeEntries.notes,
        durationMinutes: projectTimeEntries.durationMinutes,
        companyId: projectProjects.companyId,
      })
      .from(projectTimeEntries)
      .innerJoin(projectProjects, eqDb(projectTimeEntries.projectId, projectProjects.id))
      .where(andDb(...conditions));

    const filtered = entries.filter(e => e.companyId === companyId);

    // Insert line items and mark entries as billed
    const now = new Date();
    for (const e of filtered) {
      const hours = parseFloat((e.durationMinutes / 60).toFixed(4));
      const [lineItem] = await db.insert(invoiceLineItems).values({
        invoiceId,
        timeEntryId: e.id,
        description: e.notes || `${e.projectName || ''} — ${e.workDate}`,
        quantity: hours,
        unitPrice: 0,
        amount: 0,
        sortOrder: 0,
        createdAt: now,
      }).returning();

      await db.update(projectTimeEntries)
        .set({ invoiceLineItemId: lineItem.id, billed: true, updatedAt: now })
        .where(eqDb(projectTimeEntries.id, e.id));
    }

    res.json({ success: true, data: { populated: filtered.length } });
  } catch (error) {
    logger.error({ error }, 'Failed to populate invoice from time entries');
    res.status(500).json({ success: false, error: 'Failed to populate invoice' });
  }
}

// ─── Files ──────────────────────────────────────────────────────────

export async function listProjectFiles(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId!;
    const projectId = req.params.id as string;

    const files = await projectService.listProjectFiles(tenantId, projectId);
    res.json({ success: true, data: { files } });
  } catch (error) {
    logger.error({ error }, 'Failed to list project files');
    res.status(500).json({ success: false, error: 'Failed to list project files' });
  }
}

export async function addProjectFile(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to link files' });
      return;
    }
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const projectId = req.params.id as string;
    const { driveItemId } = req.body;
    if (!driveItemId) {
      res.status(400).json({ success: false, error: 'driveItemId is required' });
      return;
    }
    const link = await projectService.addProjectFile(tenantId, projectId, driveItemId, userId);
    res.json({ success: true, data: link });
  } catch (error) {
    logger.error({ error }, 'Failed to link project file');
    res.status(500).json({ success: false, error: 'Failed to link file' });
  }
}

export async function removeProjectFile(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to unlink files' });
      return;
    }
    const tenantId = req.auth!.tenantId!;
    const projectId = req.params.id as string;
    const driveItemId = req.params.driveItemId as string;
    await projectService.removeProjectFile(tenantId, projectId, driveItemId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to unlink project file');
    res.status(500).json({ success: false, error: 'Failed to unlink file' });
  }
}

// ─── Financials ──────────────────────────────────────────────────────

export async function getProjectFinancials(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId!;
    const id = req.params.id as string;
    const data = await financialService.getProjectFinancials(tenantId, id);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get project financials');
    res.status(500).json({ success: false, error: 'Failed to get financials' });
  }
}
