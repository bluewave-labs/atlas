import type { Request, Response } from 'express';
import * as projectService from '../services/project.service';
import { logger } from '../../../utils/logger';
import { emitAppEvent } from '../../../services/event.service';
import { canAccess } from '../../../services/app-permissions.service';

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
    // Route uses :userId for the member's userId, but DB stores by member row id.
    // The route is DELETE /projects/:id/members/:userId — we remove by userId match.
    const memberUserId = req.params.userId as string;

    const project = await projectService.getProject(userId, tenantId, projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    if (!canAccess(perm.role, 'delete') && project.userId !== userId) {
      res.status(403).json({ success: false, error: 'Only the project owner or an admin can manage members' });
      return;
    }

    // removeProjectMember takes (projectId, memberId) where memberId is the row id.
    // The route exposes :userId — pass it as memberId; the service deletes WHERE id = memberId AND project_id = projectId.
    // For the work app the route param is :userId so we treat it as the member row id for backward compat.
    await projectService.removeProjectMember(projectId, memberUserId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to remove project member');
    res.status(500).json({ success: false, error: 'Failed to remove project member' });
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

// ─── Financials (stub — implemented in Task 7) ───────────────────────

export async function getProjectFinancials(_req: Request, res: Response) {
  res.status(501).json({ success: false, error: 'Not implemented yet' });
}
