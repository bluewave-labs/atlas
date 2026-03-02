import type { Request, Response } from 'express';
import { z } from 'zod';
import * as tenantService from '../services/platform/tenant.service';
import * as tenantUserService from '../services/platform/tenant-user.service';
import * as catalogService from '../services/platform/catalog.service';
import * as installService from '../services/platform/install.service';
import * as assignmentService from '../services/platform/assignment.service';
import { addAppInstallJob, addAppBackupJob } from '../jobs/app-install.worker';
import * as provisioningService from '../services/platform/provisioning.service';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { validatePasswordStrength } from '../utils/password';
import type { AppRole, TenantMemberRole } from '@atlasmail/shared';

// ─── Zod Validation ──────────────────────────────────────────────────

function validateBody<T>(schema: z.ZodSchema<T>, body: unknown, res: Response): T | null {
  const result = schema.safeParse(body);
  if (!result.success) {
    res.status(400).json({ success: false, error: result.error.errors[0].message });
    return null;
  }
  return result.data;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const subdomainPattern = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

const inviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['owner', 'admin', 'member']).default('member'),
});

const createTenantUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['owner', 'admin', 'member']).optional(),
});

const installAppSchema = z.object({
  catalogAppId: z.string().regex(uuidPattern, 'catalogAppId must be a valid UUID'),
  subdomain: z.string().regex(subdomainPattern, 'subdomain must be lowercase alphanumeric with hyphens').max(63),
  customEnv: z.record(z.string()).optional(),
});

const assignUserSchema = z.object({
  userId: z.string().regex(uuidPattern, 'userId must be a valid UUID'),
  appRole: z.enum(['admin', 'member', 'viewer']).default('member'),
});

/** Safely extract a route param (Express 5 returns string | string[]). */
function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

/** Guard: require platform features to be configured. Returns true if NOT configured (caller should return). */
function requirePlatformDb(res: Response): boolean {
  if (!env.OIDC_SIGNING_KEY) {
    res.status(501).json({ success: false, error: 'Platform features are not configured' });
    return true;
  }
  return false;
}

/** Shared helper: look up installation + verify tenant membership. */
async function getInstallationWithAuth(req: Request, res: Response, requireAdmin = false) {
  const inst = await installService.getInstallation(param(req, 'iid'));
  if (!inst) {
    res.status(404).json({ success: false, error: 'Installation not found' });
    return null;
  }

  // Verify the installation belongs to the tenant specified in the URL
  // This prevents IDOR attacks where a user guesses another tenant's installation ID
  const urlTenantId = param(req, 'id');
  if (inst.tenantId !== urlTenantId) {
    res.status(404).json({ success: false, error: 'Installation not found' });
    return null;
  }

  const membership = await tenantService.getTenantMembership(inst.tenantId, req.auth!.userId);
  if (!membership) {
    res.status(403).json({ success: false, error: 'Not authorized' });
    return null;
  }

  if (requireAdmin && !['owner', 'admin'].includes(membership.role)) {
    res.status(403).json({ success: false, error: 'Only owners and admins can perform this action' });
    return null;
  }

  return inst;
}

// ─── Catalog ─────────────────────────────────────────────────────────

export async function listCatalog(req: Request, res: Response) {
  try {
    const category = req.query.category as string | undefined;

    // Fall back to disk manifests when platform features are not configured
    if (!env.OIDC_SIGNING_KEY) {
      const apps = catalogService.listCatalogAppsFromDisk({ category });
      res.json({ success: true, data: { apps } });
      return;
    }

    const apps = await catalogService.listCatalogApps({ category });
    res.json({ success: true, data: { apps } });
  } catch (err) {
    logger.error({ err }, 'Failed to list catalog');
    res.status(500).json({ success: false, error: 'Failed to list catalog apps' });
  }
}

export async function getCatalogApp(req: Request, res: Response) {
  try {
    const manifestId = param(req, 'manifestId');

    // Fall back to disk manifests when platform features are not configured
    if (!env.OIDC_SIGNING_KEY) {
      const app = catalogService.getCatalogAppFromDisk(manifestId);
      if (!app) {
        res.status(404).json({ success: false, error: 'App not found' });
        return;
      }
      res.json({ success: true, data: app });
      return;
    }

    const app = await catalogService.getCatalogApp(manifestId);
    if (!app) {
      res.status(404).json({ success: false, error: 'App not found' });
      return;
    }
    res.json({ success: true, data: app });
  } catch (err) {
    logger.error({ err }, 'Failed to get catalog app');
    res.status(500).json({ success: false, error: 'Failed to get catalog app' });
  }
}

// ─── Tenants ─────────────────────────────────────────────────────────

export async function createTenant(req: Request, res: Response) {
  try {
    if (requirePlatformDb(res)) return;

    const { slug, name, plan } = req.body;
    if (!slug || !name) {
      res.status(400).json({ success: false, error: 'slug and name are required' });
      return;
    }

    // Validate slug format
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug) || slug.length > 63) {
      res.status(400).json({ success: false, error: 'slug must be lowercase alphanumeric with hyphens, max 63 chars' });
      return;
    }

    const tenant = await tenantService.createTenant({ slug, name, plan }, req.auth!.userId);
    res.status(201).json({ success: true, data: tenant });
  } catch (err: any) {
    if (err?.code === '23505') { // unique violation
      res.status(409).json({ success: false, error: 'Tenant slug already taken' });
      return;
    }
    logger.error({ err }, 'Failed to create tenant');
    res.status(500).json({ success: false, error: 'Failed to create tenant' });
  }
}

export async function listMyTenants(req: Request, res: Response) {
  try {
    if (!env.OIDC_SIGNING_KEY) {
      res.json({ success: true, data: { tenants: [] } });
      return;
    }

    // In Docker dev mode, auto-add the current user to the dev tenant
    if (env.PLATFORM_RUNTIME === 'docker' && process.env.NODE_ENV !== 'production') {
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
    if (requirePlatformDb(res)) return;

    const tenant = await tenantService.getTenantById(param(req, 'id'));
    if (!tenant) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    // Check membership
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
    if (requirePlatformDb(res)) return;

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
    if (requirePlatformDb(res)) return;

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
    if (requirePlatformDb(res)) return;

    const tenantId = param(req, 'id');
    const userId = param(req, 'userId');

    const membership = await tenantService.getTenantMembership(tenantId, req.auth!.userId);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      res.status(403).json({ success: false, error: 'Only owners and admins can remove users' });
      return;
    }

    // Prevent removing yourself
    if (userId === req.auth!.userId) {
      res.status(400).json({ success: false, error: 'Cannot remove yourself from the tenant' });
      return;
    }

    // Deprovision user from all apps before removing from tenant
    await provisioningService.enqueueDeprovisionFromAllApps(tenantId, userId);

    await tenantUserService.removeTenantUser(tenantId, userId);
    logger.info({ audit: true, action: 'user.remove', tenantId, userId, performedBy: req.auth!.userId }, 'User removed');
    res.json({ success: true, data: { message: 'User removed' } });
  } catch (err) {
    logger.error({ err }, 'Failed to remove tenant user');
    res.status(500).json({ success: false, error: 'Failed to remove tenant user' });
  }
}

export async function updateTenantUserRole(req: Request, res: Response) {
  try {
    if (requirePlatformDb(res)) return;

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
  } catch (err) {
    logger.error({ err }, 'Failed to update tenant user role');
    res.status(500).json({ success: false, error: 'Failed to update tenant user role' });
  }
}

export async function inviteTenantUser(req: Request, res: Response) {
  try {
    if (requirePlatformDb(res)) return;

    const tenantId = param(req, 'id');
    const membership = await tenantService.getTenantMembership(tenantId, req.auth!.userId);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      res.status(403).json({ success: false, error: 'Only owners and admins can invite users' });
      return;
    }

    const data = validateBody(inviteUserSchema, req.body, res);
    if (!data) return;

    const role = data.role ?? 'member';
    const invitation = await tenantUserService.inviteUser(tenantId, data.email, role, req.auth!.userId);
    logger.info({ audit: true, action: 'invitation.create', tenantId, email: data.email, role, performedBy: req.auth!.userId }, 'User invited');
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

// ─── Installations ───────────────────────────────────────────────────

export async function listInstallations(req: Request, res: Response) {
  try {
    if (requirePlatformDb(res)) return;

    const tenantId = param(req, 'id');

    const membership = await tenantService.getTenantMembership(tenantId, req.auth!.userId);
    if (!membership) {
      res.status(403).json({ success: false, error: 'Not a member of this tenant' });
      return;
    }

    const installations = await installService.listInstallations(tenantId);
    res.json({ success: true, data: { installations } });
  } catch (err) {
    logger.error({ err }, 'Failed to list installations');
    res.status(500).json({ success: false, error: 'Failed to list installations' });
  }
}

export async function installApp(req: Request, res: Response) {
  try {
    if (requirePlatformDb(res)) return;

    const tenantId = param(req, 'id');

    // Only owner/admin can install
    const membership = await tenantService.getTenantMembership(tenantId, req.auth!.userId);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      res.status(403).json({ success: false, error: 'Only owners and admins can install apps' });
      return;
    }

    const data = validateBody(installAppSchema, req.body, res);
    if (!data) return;

    // Enqueue install job (async via BullMQ) — pass userId for auto-assignment
    await addAppInstallJob(tenantId, { catalogAppId: data.catalogAppId, subdomain: data.subdomain, customEnv: data.customEnv }, req.auth!.userId);
    logger.info({ audit: true, action: 'app.install', tenantId, catalogAppId: data.catalogAppId, subdomain: data.subdomain, performedBy: req.auth!.userId }, 'App installation started');

    res.status(202).json({
      success: true,
      data: { status: 'installing', message: 'App installation started' },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to start app installation');
    res.status(500).json({ success: false, error: 'Failed to start installation' });
  }
}

export async function getInstallation(req: Request, res: Response) {
  try {
    if (requirePlatformDb(res)) return;

    const inst = await getInstallationWithAuth(req, res);
    if (!inst) return;

    res.json({ success: true, data: inst });
  } catch (err) {
    logger.error({ err }, 'Failed to get installation');
    res.status(500).json({ success: false, error: 'Failed to get installation' });
  }
}

export async function startApp(req: Request, res: Response) {
  try {
    if (requirePlatformDb(res)) return;

    const inst = await getInstallationWithAuth(req, res, true);
    if (!inst) return;

    await installService.startApp(inst.id);
    logger.info({ audit: true, action: 'app.start', installationId: inst.id, tenantId: inst.tenantId, performedBy: req.auth!.userId }, 'App started');
    res.json({ success: true, data: { status: 'running' } });
  } catch (err) {
    logger.error({ err }, 'Failed to start app');
    res.status(500).json({ success: false, error: 'Failed to start app' });
  }
}

export async function stopApp(req: Request, res: Response) {
  try {
    if (requirePlatformDb(res)) return;

    const inst = await getInstallationWithAuth(req, res, true);
    if (!inst) return;

    await installService.stopApp(inst.id);
    logger.info({ audit: true, action: 'app.stop', installationId: inst.id, tenantId: inst.tenantId, performedBy: req.auth!.userId }, 'App stopped');
    res.json({ success: true, data: { status: 'stopped' } });
  } catch (err) {
    logger.error({ err }, 'Failed to stop app');
    res.status(500).json({ success: false, error: 'Failed to stop app' });
  }
}

export async function restartApp(req: Request, res: Response) {
  try {
    if (requirePlatformDb(res)) return;

    const inst = await getInstallationWithAuth(req, res, true);
    if (!inst) return;

    await installService.restartApp(inst.id);
    logger.info({ audit: true, action: 'app.restart', installationId: inst.id, tenantId: inst.tenantId, performedBy: req.auth!.userId }, 'App restarted');
    res.json({ success: true, data: { status: 'restarting' } });
  } catch (err) {
    logger.error({ err }, 'Failed to restart app');
    res.status(500).json({ success: false, error: 'Failed to restart app' });
  }
}

export async function createBackup(req: Request, res: Response) {
  try {
    if (requirePlatformDb(res)) return;

    const inst = await getInstallationWithAuth(req, res, true);
    if (!inst) return;

    await addAppBackupJob(inst.id, 'manual');
    res.status(202).json({ success: true, data: { status: 'pending', message: 'Backup started' } });
  } catch (err) {
    logger.error({ err }, 'Failed to create backup');
    res.status(500).json({ success: false, error: 'Failed to create backup' });
  }
}

export async function listBackups(req: Request, res: Response) {
  try {
    if (requirePlatformDb(res)) return;

    const inst = await getInstallationWithAuth(req, res);
    if (!inst) return;

    const backups = await installService.listBackups(inst.id);
    res.json({ success: true, data: { backups } });
  } catch (err) {
    logger.error({ err }, 'Failed to list backups');
    res.status(500).json({ success: false, error: 'Failed to list backups' });
  }
}

export async function uninstallApp(req: Request, res: Response) {
  try {
    if (requirePlatformDb(res)) return;

    const inst = await getInstallationWithAuth(req, res, true);
    if (!inst) return;

    await installService.uninstallApp(inst.id);
    logger.info({ audit: true, action: 'app.uninstall', installationId: inst.id, tenantId: inst.tenantId, performedBy: req.auth!.userId }, 'App uninstalled');
    res.json({ success: true, data: { message: 'App uninstalled' } });
  } catch (err) {
    logger.error({ err }, 'Failed to uninstall app');
    res.status(500).json({ success: false, error: 'Failed to uninstall app' });
  }
}

// ─── App Assignments ────────────────────────────────────────────────

const VALID_APP_ROLES: AppRole[] = ['admin', 'member', 'viewer'];

export async function listAssignments(req: Request, res: Response) {
  try {
    if (requirePlatformDb(res)) return;

    const inst = await getInstallationWithAuth(req, res, true);
    if (!inst) return;

    const assignments = await assignmentService.listAppAssignments(inst.id);
    res.json({ success: true, data: { assignments } });
  } catch (err) {
    logger.error({ err }, 'Failed to list assignments');
    res.status(500).json({ success: false, error: 'Failed to list assignments' });
  }
}

export async function assignUser(req: Request, res: Response) {
  try {
    if (requirePlatformDb(res)) return;

    const inst = await getInstallationWithAuth(req, res, true);
    if (!inst) return;

    const data = validateBody(assignUserSchema, req.body, res);
    if (!data) return;

    // Verify the target user is a tenant member
    const membership = await tenantService.getTenantMembership(inst.tenantId, data.userId);
    if (!membership) {
      res.status(400).json({ success: false, error: 'User is not a member of this tenant' });
      return;
    }

    const appRole = data.appRole ?? 'member';
    const assignment = await assignmentService.assignUserToApp(inst.id, data.userId, appRole, req.auth!.userId);

    // Provision user in the app
    await provisioningService.enqueueProvision(inst.id, data.userId, appRole);

    logger.info({ audit: true, action: 'app.assign', installationId: inst.id, userId: data.userId, appRole, performedBy: req.auth!.userId }, 'User assigned to app');
    res.status(201).json({ success: true, data: assignment });
  } catch (err) {
    logger.error({ err }, 'Failed to assign user');
    res.status(500).json({ success: false, error: 'Failed to assign user' });
  }
}

export async function updateAssignment(req: Request, res: Response) {
  try {
    if (requirePlatformDb(res)) return;

    const inst = await getInstallationWithAuth(req, res, true);
    if (!inst) return;

    const userId = param(req, 'userId');
    const { appRole } = req.body;

    if (!appRole || !VALID_APP_ROLES.includes(appRole)) {
      res.status(400).json({ success: false, error: `appRole must be one of: ${VALID_APP_ROLES.join(', ')}` });
      return;
    }

    const updated = await assignmentService.updateAppRole(inst.id, userId, appRole);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Assignment not found' });
      return;
    }

    // Update role in the app
    await provisioningService.enqueueRoleUpdate(inst.id, userId, appRole);

    logger.info({ audit: true, action: 'app.assignment.update', installationId: inst.id, userId, newAppRole: appRole, performedBy: req.auth!.userId }, 'App assignment updated');
    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error({ err }, 'Failed to update assignment');
    res.status(500).json({ success: false, error: 'Failed to update assignment' });
  }
}

export async function removeAssignment(req: Request, res: Response) {
  try {
    if (requirePlatformDb(res)) return;

    const inst = await getInstallationWithAuth(req, res, true);
    if (!inst) return;

    const userId = param(req, 'userId');
    const removed = await assignmentService.removeUserFromApp(inst.id, userId);
    if (!removed) {
      res.status(404).json({ success: false, error: 'Assignment not found' });
      return;
    }

    // Deprovision user from the app
    await provisioningService.enqueueDeprovision(inst.id, userId);

    logger.info({ audit: true, action: 'app.assignment.remove', installationId: inst.id, userId, performedBy: req.auth!.userId }, 'App assignment removed');
    res.json({ success: true, data: { message: 'Assignment removed' } });
  } catch (err) {
    logger.error({ err }, 'Failed to remove assignment');
    res.status(500).json({ success: false, error: 'Failed to remove assignment' });
  }
}

// ─── Provisioning ────────────────────────────────────────────────────

export async function listProvisioningLog(req: Request, res: Response) {
  try {
    if (requirePlatformDb(res)) return;

    const inst = await getInstallationWithAuth(req, res, true);
    if (!inst) return;

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    const log = await provisioningService.getProvisioningLog(inst.id, limit, offset);
    res.json({ success: true, data: { log } });
  } catch (err) {
    logger.error({ err }, 'Failed to list provisioning log');
    res.status(500).json({ success: false, error: 'Failed to list provisioning log' });
  }
}

export async function retryProvisioning(req: Request, res: Response) {
  try {
    if (requirePlatformDb(res)) return;

    const inst = await getInstallationWithAuth(req, res, true);
    if (!inst) return;

    const logId = param(req, 'logId');
    await provisioningService.retryFailedProvisioning(logId, inst.id);
    res.json({ success: true, data: { message: 'Retry enqueued' } });
  } catch (err: any) {
    logger.error({ err }, 'Failed to retry provisioning');
    res.status(400).json({ success: false, error: err?.message || 'Failed to retry provisioning' });
  }
}

export async function reconcileProvisioning(req: Request, res: Response) {
  try {
    if (requirePlatformDb(res)) return;

    const inst = await getInstallationWithAuth(req, res, true);
    if (!inst) return;

    const result = await provisioningService.reconcileInstallation(inst.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    logger.error({ err }, 'Failed to reconcile provisioning');
    res.status(400).json({ success: false, error: err?.message || 'Failed to reconcile provisioning' });
  }
}

export async function setupProvisioningTokenEndpoint(req: Request, res: Response) {
  try {
    if (requirePlatformDb(res)) return;

    const inst = await getInstallationWithAuth(req, res, true);
    if (!inst) return;

    await provisioningService.setupProvisioningToken(inst.id);
    res.json({ success: true, data: { message: 'Provisioning token configured' } });
  } catch (err: any) {
    logger.error({ err }, 'Failed to setup provisioning token');
    res.status(500).json({ success: false, error: err?.message || 'Failed to setup provisioning token' });
  }
}
