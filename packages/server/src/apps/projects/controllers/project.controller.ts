import type { Request, Response } from 'express';
import * as projectService from '../service';
import { logger } from '../../../utils/logger';
import { emitAppEvent } from '../../../services/event.service';
import { canAccess } from '../../../services/app-permissions.service';

// ─── Projects ───────────────────────────────────────────────────────

export async function listProjects(req: Request, res: Response) {
  try {
    const perm = req.projectsPerm!;
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { search, companyId, clientId, status, includeArchived } = req.query;

    // Only admins see every project in the tenant. Editors and
    // viewers are scoped to projects they own or are a member of.
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
    const perm = req.projectsPerm!;
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    const project = await projectService.getProject(userId, tenantId, id);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    // Non-admins may only see projects they own or are a member of.
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
    const perm = req.projectsPerm!;
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
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
    const perm = req.projectsPerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
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
    const perm = req.projectsPerm!;
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    // Non-admins (delete_own only) may only delete projects they
    // own or are a member of.
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
    const perm = req.projectsPerm!;
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const projectId = req.params.projectId as string;
    const { userId: memberUserId, hourlyRate } = req.body;

    // Verify the project exists in this tenant
    const project = await projectService.getProject(userId, tenantId, projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    // Only blanket-update roles (admin/editor) or the project owner
    // may add members. This prevents anyone with plain create
    // permission from joining themselves to any project in the tenant.
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
    const perm = req.projectsPerm!;
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const projectId = req.params.projectId as string;
    const memberId = req.params.memberId as string;

    // Verify the project exists in this tenant
    const project = await projectService.getProject(userId, tenantId, projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    // Only blanket-delete roles (admin) or the project owner may remove members.
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
    const perm = req.projectsPerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update in projects' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const projectId = req.params.projectId as string;
    const memberId = req.params.memberId as string;
    const { hourlyRate } = req.body;

    // Verify the project exists in this tenant
    const project = await projectService.getProject(userId, tenantId, projectId);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    // Only blanket-update roles (admin/editor) or the project owner
    // may change member rates. Match the sibling add/remove pattern.
    if (!canAccess(perm.role, 'update') && project.userId !== userId) {
      res.status(403).json({ success: false, error: 'Only the project owner or an admin can manage members' });
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
