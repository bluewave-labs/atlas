import type { Request, Response } from 'express';
import * as projectService from '../service';
import { logger } from '../../../utils/logger';
import { emitAppEvent } from '../../../services/event.service';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';

// ─── Projects ───────────────────────────────────────────────────────

export async function listProjects(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { search, clientId, status, includeArchived } = req.query;

    const projects = await projectService.listProjects(userId, tenantId, {
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
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const project = await projectService.getProject(userId, tenantId, id);
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
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { name, clientId, description, billable, status, estimatedHours, estimatedAmount, startDate, endDate, color } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const project = await projectService.createProject(userId, tenantId, {
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
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;
    const { name, clientId, description, billable, status, estimatedHours, estimatedAmount, startDate, endDate, color, sortOrder, isArchived } = req.body;

    const project = await projectService.updateProject(userId, tenantId, id, {
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
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

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
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const projectId = req.params.projectId as string;

    const members = await projectService.listProjectMembers(userId, tenantId, projectId);
    res.json({ success: true, data: { members } });
  } catch (error) {
    logger.error({ error }, 'Failed to list project members');
    res.status(500).json({ success: false, error: 'Failed to list project members' });
  }
}

export async function addProjectMember(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const projectId = req.params.projectId as string;
    const { userId: memberUserId, hourlyRate, role } = req.body;

    // Verify the project belongs to the authenticated user's account
    const project = await projectService.getProject(userId, tenantId, projectId);
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
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const projectId = req.params.projectId as string;
    const memberId = req.params.memberId as string;

    // Verify the project belongs to the authenticated user's account
    const project = await projectService.getProject(userId, tenantId, projectId);
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
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'projects');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const projectId = req.params.projectId as string;
    const memberId = req.params.memberId as string;
    const { hourlyRate } = req.body;

    // Verify the project belongs to the authenticated user's account
    const project = await projectService.getProject(userId, tenantId, projectId);
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
