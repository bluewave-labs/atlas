import type { Request, Response } from 'express';
import { z } from 'zod';
import * as tenantService from '../services/platform/tenant.service';
import * as tenantUserService from '../services/platform/tenant-user.service';
import * as tenantAppService from '../services/platform/tenant-app.service';
import { logger } from '../utils/logger';
import { emitAppEvent, getTenantMemberUserIds } from '../services/event.service';
import { validatePasswordStrength } from '../utils/password';
import type { TenantMemberRole } from '@atlas-platform/shared';

// ─── Zod Validation ──────────────────────────────────────────────────

function validateBody<T>(schema: z.ZodSchema<T>, body: unknown, res: Response): T | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    res.status(400).json({ success: false, error: result.error.errors[0].message });
    return null;
  }
  return result.data;
}

const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['owner', 'admin', 'member']).default('member'),
  appPermissions: z.array(z.object({
    appId: z.string(),
    enabled: z.boolean(),
    role: z.enum(['admin', 'editor', 'viewer']),
    recordAccess: z.enum(['all', 'team', 'own']).default('all'),
  })).optional(),
  crmTeamId: z.string().optional(),
});

const createTenantUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['owner', 'admin', 'member']).optional(),
});

/** Safely extract a route param (Express 5 returns string | string[]). */
function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

// ─── Tenants ─────────────────────────────────────────────────────────

export async function createTenant(req: Request, res: Response) {
  try {
    if (!req.auth!.isSuperAdmin) {
      res.status(403).json({ success: false, error: 'Only super admins can create tenants' });
      return;
    }

    const { slug, name, plan } = req.body;
    if (!slug || !name) {
      res.status(400).json({ success: false, error: 'slug and name are required' });
      return;
    }

    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug) || slug.length > 63) {
      res.status(400).json({ success: false, error: 'slug must be lowercase alphanumeric with hyphens, max 63 chars' });
      return;
    }

    const tenant = await tenantService.createTenant({ slug, name, plan }, req.auth!.userId);
    res.status(201).json({ success: true, data: tenant });
  } catch (err: any) {
    if (err?.code === '23505') {
      res.status(409).json({ success: false, error: 'Tenant slug already taken' });
      return;
    }
    logger.error({ err }, 'Failed to create tenant');
    res.status(500).json({ success: false, error: 'Failed to create tenant' });
  }
}

export async function listMyTenants(req: Request, res: Response) {
  try {
    // In dev mode, auto-add the current user to the dev tenant
    if (process.env.NODE_ENV !== 'production') {
      const devTenant = await tenantService.getTenantBySlug('dev');
      if (devTenant) {
        await tenantService.addTenantMember(devTenant.id, req.auth!.userId, 'owner');
      }
    }

    const tenants = await tenantService.listTenantsForUser(req.auth!.userId);
    res.json({ success: true, data: { tenants } });
  } catch (err) {
    logger.error({ err }, 'Failed to list tenants');
    res.status(500).json({ success: false, error: 'Failed to list tenants' });
  }
}

export async function getTenant(req: Request, res: Response) {
  try {
    const tenant = await tenantService.getTenantById(param(req, 'id'));
    if (!tenant) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    const membership = await tenantService.getTenantMembership(tenant.id, req.auth!.userId);
    if (!membership) {
      res.status(403).json({ success: false, error: 'Not a member of this tenant' });
      return;
    }

    res.json({ success: true, data: { ...tenant, role: membership.role } });
  } catch (err) {
    logger.error({ err }, 'Failed to get tenant');
    res.status(500).json({ success: false, error: 'Failed to get tenant' });
  }
}

// ─── Tenant Users ────────────────────────────────────────────────────

export async function listTenantUsers(req: Request, res: Response) {
  try {
    const tenantId = param(req, 'id');
    const membership = await tenantService.getTenantMembership(tenantId, req.auth!.userId);
    if (!membership) {
      res.status(403).json({ success: false, error: 'Not a member of this tenant' });
      return;
    }

    const users = await tenantUserService.listTenantUsers(tenantId);
    res.json({ success: true, data: { users } });
  } catch (err) {
    logger.error({ err }, 'Failed to list tenant users');
    res.status(500).json({ success: false, error: 'Failed to list tenant users' });
  }
}

export async function createTenantUser(req: Request, res: Response) {
  try {
    const tenantId = param(req, 'id');
    const membership = await tenantService.getTenantMembership(tenantId, req.auth!.userId);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      res.status(403).json({ success: false, error: 'Only owners and admins can create users' });
      return;
    }

    const data = validateBody(createTenantUserSchema, req.body, res);
    if (!data) return;

    const strength = validatePasswordStrength(data.password);
    if (!strength.valid) {
      res.status(400).json({ success: false, error: strength.error });
      return;
    }

    const user = await tenantUserService.createTenantUser(tenantId, { email: data.email, name: data.name, password: data.password, role: data.role });
    logger.info({ audit: true, action: 'user.create', tenantId, email: data.email, performedBy: req.auth!.userId }, 'User created');

    emitAppEvent({
      tenantId,
      userId: req.auth!.userId,
      appId: 'platform',
      eventType: 'user.created',
      title: `${data.name} joined the team`,
      metadata: { email: data.email, name: data.name },
      notifyUserIds: await getTenantMemberUserIds(tenantId),
    }).catch(() => {});

    res.status(201).json({ success: true, data: user });
  } catch (err: any) {
    if (err?.message?.includes('UNIQUE constraint failed') || err?.code === '23505') {
      res.status(409).json({ success: false, error: 'A user with this email already exists' });
      return;
    }
    logger.error({ err }, 'Failed to create tenant user');
    res.status(500).json({ success: false, error: 'Failed to create tenant user' });
  }
}

export async function removeTenantUser(req: Request, res: Response) {
  try {
    const tenantId = param(req, 'id');
    const userId = param(req, 'userId');

    const membership = await tenantService.getTenantMembership(tenantId, req.auth!.userId);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      res.status(403).json({ success: false, error: 'Only owners and admins can remove users' });
      return;
    }

    if (userId === req.auth!.userId) {
      res.status(400).json({ success: false, error: 'Cannot remove yourself from the tenant' });
      return;
    }

    await tenantUserService.removeTenantUser(tenantId, userId);
    logger.info({ audit: true, action: 'user.remove', tenantId, userId, performedBy: req.auth!.userId }, 'User removed');

    emitAppEvent({
      tenantId,
      userId: req.auth!.userId,
      appId: 'platform',
      eventType: 'user.removed',
      title: `removed a member from the team`,
      metadata: { removedUserId: userId },
    }).catch(() => {});

    res.json({ success: true, data: { message: 'User removed' } });
  } catch (err: any) {
    if (err?.code === 'LAST_ADMIN') {
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    logger.error({ err }, 'Failed to remove tenant user');
    res.status(500).json({ success: false, error: 'Failed to remove tenant user' });
  }
}

export async function updateTenantUserRole(req: Request, res: Response) {
  try {
    const tenantId = param(req, 'id');
    const userId = param(req, 'userId');
    const { role } = req.body;

    const validRoles: TenantMemberRole[] = ['owner', 'admin', 'member'];
    if (!role || !validRoles.includes(role)) {
      res.status(400).json({ success: false, error: `role must be one of: ${validRoles.join(', ')}` });
      return;
    }

    const membership = await tenantService.getTenantMembership(tenantId, req.auth!.userId);
    if (!membership || membership.role !== 'owner') {
      res.status(403).json({ success: false, error: 'Only owners can change user roles' });
      return;
    }

    await tenantUserService.updateTenantUserRole(tenantId, userId, role);
    logger.info({ audit: true, action: 'user.role.update', tenantId, userId, newRole: role, performedBy: req.auth!.userId }, 'User role updated');
    res.json({ success: true, data: { message: 'Role updated' } });
  } catch (err: any) {
    if (err?.code === 'LAST_ADMIN') {
      res.status(400).json({ success: false, error: err.message });
      return;
    }
    logger.error({ err }, 'Failed to update tenant user role');
    res.status(500).json({ success: false, error: 'Failed to update tenant user role' });
  }
}

export async function inviteTenantUser(req: Request, res: Response) {
  try {
    const tenantId = param(req, 'id');
    const membership = await tenantService.getTenantMembership(tenantId, req.auth!.userId);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      res.status(403).json({ success: false, error: 'Only owners and admins can invite users' });
      return;
    }

    const data = validateBody(inviteUserSchema, req.body, res);
    if (!data) return;

    const role = data.role ?? 'member';
    const invitation = await tenantUserService.inviteUser(tenantId, data.email, role, req.auth!.userId, {
      appPermissions: data.appPermissions,
      crmTeamId: data.crmTeamId,
    });
    logger.info({ audit: true, action: 'invitation.create', tenantId, email: data.email, role, performedBy: req.auth!.userId }, 'User invited');

    emitAppEvent({
      tenantId,
      userId: req.auth!.userId,
      appId: 'platform',
      eventType: 'user.invited',
      title: `invited ${data.email} to the team`,
      metadata: { email: data.email, role },
    }).catch(() => {});

    res.status(201).json({ success: true, data: invitation });
  } catch (err: any) {
    if (err?.code === '23505') {
      res.status(409).json({ success: false, error: 'An invitation for this email already exists' });
      return;
    }
    logger.error({ err }, 'Failed to invite user');
    res.status(500).json({ success: false, error: 'Failed to invite user' });
  }
}

// ─── Tenant Apps ────────────────────────────────────────────────────

export async function listTenantApps(req: Request, res: Response) {
  try {
    const tenantId = param(req, 'id');
    const membership = await tenantService.getTenantMembership(tenantId, req.auth!.userId);
    if (!membership) {
      res.status(403).json({ success: false, error: 'Not a member of this tenant' });
      return;
    }

    const apps = await tenantAppService.listTenantApps(tenantId);
    res.json({ success: true, data: { apps } });
  } catch (err) {
    logger.error({ err }, 'Failed to list tenant apps');
    res.status(500).json({ success: false, error: 'Failed to list tenant apps' });
  }
}

export async function enableTenantApp(req: Request, res: Response) {
  try {
    const tenantId = param(req, 'id');
    const appId = param(req, 'appId');

    const membership = await tenantService.getTenantMembership(tenantId, req.auth!.userId);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      res.status(403).json({ success: false, error: 'Only owners and admins can manage apps' });
      return;
    }

    const app = await tenantAppService.enableApp(tenantId, appId, req.auth!.userId);
    res.json({ success: true, data: app });
  } catch (err: any) {
    logger.error({ err }, 'Failed to enable app');
    res.status(400).json({ success: false, error: err?.message || 'Failed to enable app' });
  }
}

export async function disableTenantApp(req: Request, res: Response) {
  try {
    const tenantId = param(req, 'id');
    const appId = param(req, 'appId');

    const membership = await tenantService.getTenantMembership(tenantId, req.auth!.userId);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      res.status(403).json({ success: false, error: 'Only owners and admins can manage apps' });
      return;
    }

    await tenantAppService.disableApp(tenantId, appId);
    res.json({ success: true, data: { message: 'App disabled' } });
  } catch (err: any) {
    logger.error({ err }, 'Failed to disable app');
    res.status(400).json({ success: false, error: err?.message || 'Failed to disable app' });
  }
}
