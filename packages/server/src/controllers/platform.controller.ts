import type { Request, Response } from 'express';
import * as tenantService from '../services/platform/tenant.service';
import * as tenantUserService from '../services/platform/tenant-user.service';
import * as catalogService from '../services/platform/catalog.service';
import * as installService from '../services/platform/install.service';
import * as assignmentService from '../services/platform/assignment.service';
import { addAppInstallJob, addAppBackupJob } from '../jobs/app-install.worker';
import { logger } from '../utils/logger';
import { env } from '../config/env';
import { validatePasswordStrength } from '../utils/password';
import type { AppRole, TenantMemberRole } from '@atlasmail/shared';

/** Safely extract a route param (Express 5 returns string | string[]). */
function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

/** Guard: require platform DB to be configured. Returns true if NOT configured (caller should return). */
function requirePlatformDb(res: Response): boolean {
  if (!env.DATABASE_PLATFORM_URL) {
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

    // Fall back to disk manifests when platform DB is not configured
    if (!env.DATABASE_PLATFORM_URL) {
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

    // Fall back to disk manifests when platform DB is not configured
    if (!env.DATABASE_PLATFORM_URL) {
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
    if (!env.DATABASE_PLATFORM_URL) {
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

    const { email, name, password, role } = req.body;
    if (!email || !name || !password) {
      res.status(400).json({ success: false, error: 'email, name, and password are required' });
      return;
    }

    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      res.status(400).json({ success: false, error: strength.error });
      return;
    }

    const user = await tenantUserService.createTenantUser(tenantId, { email, name, password, role });
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

    await tenantUserService.removeTenantUser(tenantId, userId);
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

    const { email, role = 'member' } = req.body;
    if (!email) {
      res.status(400).json({ success: false, error: 'email is required' });
      return;
    }

    const invitation = await tenantUserService.inviteUser(tenantId, email, role, req.auth!.userId);
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

    const { catalogAppId, subdomain, customEnv } = req.body;
    if (!catalogAppId || !subdomain) {
      res.status(400).json({ success: false, error: 'catalogAppId and subdomain are required' });
      return;
    }

    // Validate subdomain
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(subdomain)) {
      res.status(400).json({ success: false, error: 'Invalid subdomain format' });
      return;
    }

    // Enqueue install job (async via BullMQ) — pass userId for auto-assignment
    await addAppInstallJob(tenantId, { catalogAppId, subdomain, customEnv }, req.auth!.userId);

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

    const { userId, appRole = 'member' } = req.body;
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId is required' });
      return;
    }

    if (!VALID_APP_ROLES.includes(appRole)) {
      res.status(400).json({ success: false, error: `appRole must be one of: ${VALID_APP_ROLES.join(', ')}` });
      return;
    }

    // Verify the target user is a tenant member
    const membership = await tenantService.getTenantMembership(inst.tenantId, userId);
    if (!membership) {
      res.status(400).json({ success: false, error: 'User is not a member of this tenant' });
      return;
    }

    const assignment = await assignmentService.assignUserToApp(inst.id, userId, appRole, req.auth!.userId);
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

    res.json({ success: true, data: { message: 'Assignment removed' } });
  } catch (err) {
    logger.error({ err }, 'Failed to remove assignment');
    res.status(500).json({ success: false, error: 'Failed to remove assignment' });
  }
}
