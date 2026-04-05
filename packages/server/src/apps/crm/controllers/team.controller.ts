import type { Request, Response } from 'express';
import * as crmService from '../services/team.service';
import { logger } from '../../../utils/logger';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';

// ─── Sales Teams ──────────────────────────────────────────────────

export async function listTeams(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'crm');
    if (!canAccess(perm.role, 'view')) { res.status(403).json({ success: false, error: 'No permission' }); return; }
    const data = await crmService.listTeams(req.auth!.accountId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to list CRM teams');
    res.status(500).json({ success: false, error: 'Failed to list teams' });
  }
}

export async function createTeam(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'crm');
    if (!canAccess(perm.role, 'create')) { res.status(403).json({ success: false, error: 'No permission' }); return; }
    const { name, color, leaderUserId } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ success: false, error: 'Team name is required' }); return;
    }
    const data = await crmService.createTeam(req.auth!.accountId, { name: name.trim(), color, leaderUserId });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to create CRM team');
    res.status(500).json({ success: false, error: 'Failed to create team' });
  }
}

export async function updateTeam(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'crm');
    if (!canAccess(perm.role, 'update')) { res.status(403).json({ success: false, error: 'No permission' }); return; }
    const id = req.params.id as string;
    const { name, color, leaderUserId, isArchived } = req.body;
    const data = await crmService.updateTeam(req.auth!.accountId, id, { name, color, leaderUserId, isArchived });
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to update CRM team');
    res.status(500).json({ success: false, error: 'Failed to update team' });
  }
}

export async function deleteTeam(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'crm');
    if (!canAccess(perm.role, 'delete')) { res.status(403).json({ success: false, error: 'No permission' }); return; }
    const id = req.params.id as string;
    await crmService.deleteTeam(req.auth!.accountId, id);
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to delete CRM team');
    res.status(500).json({ success: false, error: 'Failed to delete team' });
  }
}

export async function listTeamMembers(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'crm');
    if (!canAccess(perm.role, 'view')) { res.status(403).json({ success: false, error: 'No permission' }); return; }
    const teamId = req.params.id as string;
    const data = await crmService.listTeamMembers(teamId, req.auth!.accountId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to list team members');
    res.status(500).json({ success: false, error: 'Failed to list team members' });
  }
}

export async function addTeamMember(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'crm');
    if (!canAccess(perm.role, 'update')) { res.status(403).json({ success: false, error: 'No permission' }); return; }
    const teamId = req.params.id as string;
    const { userId } = req.body;
    const data = await crmService.addTeamMember(teamId, userId, req.auth!.accountId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to add team member');
    res.status(500).json({ success: false, error: 'Failed to add team member' });
  }
}

export async function removeTeamMember(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'crm');
    if (!canAccess(perm.role, 'update')) { res.status(403).json({ success: false, error: 'No permission' }); return; }
    const teamId = req.params.id as string;
    const userId = req.params.userId as string;
    await crmService.removeTeamMember(teamId, userId, req.auth!.accountId);
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to remove team member');
    res.status(500).json({ success: false, error: 'Failed to remove team member' });
  }
}

export async function getUserTeams(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'crm');
    if (!canAccess(perm.role, 'view')) { res.status(403).json({ success: false, error: 'No permission' }); return; }
    const userId = req.params.userId as string;
    const teamIds = await crmService.getUserTeamIds(userId, req.auth!.accountId);
    res.json({ success: true, data: teamIds });
  } catch (error) {
    logger.error({ error }, 'Failed to get user teams');
    res.status(500).json({ success: false, error: 'Failed to get user teams' });
  }
}
