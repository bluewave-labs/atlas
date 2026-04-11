import type { Request, Response } from 'express';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../config/database';
import { accounts, appPermissions, tenantMembers } from '../../db/schema';
import {
  setAppPermission,
  deleteAppPermission,
  listPermissionAudit,
  type AppRole,
  type AppRecordAccess,
} from '../../services/app-permissions.service';
import { serverAppRegistry } from '../../config/app-registry.server';
import { logger } from '../../utils/logger';

const VALID_ROLES: AppRole[] = ['admin', 'editor', 'viewer'];
const VALID_ACCESS: AppRecordAccess[] = ['all', 'own'];

// Apps the permissions matrix should show. System is a platform
// management view (owner-only by design) so we hide it from the grid.
const HIDDEN_APPS = new Set(['system', 'calendar']);

interface PermissionCell {
  userId: string;
  userName: string | null;
  userEmail: string;
  tenantRole: string;
  appId: string;
  role: AppRole;
  recordAccess: AppRecordAccess;
  inherited: boolean;
}

export async function listPermissions(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    // 1. Enabled apps from server registry
    const apps = serverAppRegistry.getAll()
      .map((m) => ({ id: m.id, name: m.name }))
      .filter((a) => !HIDDEN_APPS.has(a.id));

    // 2. Tenant members
    const members = await db
      .select()
      .from(tenantMembers)
      .where(eq(tenantMembers.tenantId, tenantId));

    if (members.length === 0) {
      res.json({ success: true, data: { users: [], apps, cells: [] } });
      return;
    }

    const userIds = members.map((m) => m.userId);

    // 3. Account details
    const userAccounts = await db
      .select({
        userId: accounts.userId,
        email: accounts.email,
        name: accounts.name,
      })
      .from(accounts)
      .where(inArray(accounts.userId, userIds));

    const accountMap = new Map<string, { email: string; name: string | null }>();
    for (const acct of userAccounts) {
      accountMap.set(acct.userId, { email: acct.email, name: acct.name });
    }

    // 4. Explicit permissions (single query)
    const explicit = await db
      .select()
      .from(appPermissions)
      .where(and(
        eq(appPermissions.tenantId, tenantId),
        inArray(appPermissions.userId, userIds),
      ));

    const explicitMap = new Map<string, { role: AppRole; recordAccess: AppRecordAccess }>();
    for (const p of explicit) {
      explicitMap.set(`${p.userId}:${p.appId}`, {
        role: p.role as AppRole,
        recordAccess: p.recordAccess as AppRecordAccess,
      });
    }

    // 5. Cross-join users × apps in JS, resolving the derived default when
    // there's no explicit row.
    const cells: PermissionCell[] = [];
    const users = members.map((m) => {
      const acct = accountMap.get(m.userId);
      return {
        userId: m.userId,
        userName: acct?.name ?? null,
        userEmail: acct?.email ?? 'unknown',
        tenantRole: m.role,
      };
    });

    for (const user of users) {
      const isPrivileged = user.tenantRole === 'owner' || user.tenantRole === 'admin';
      const defaultRole: AppRole = isPrivileged ? 'admin' : 'editor';
      const defaultAccess: AppRecordAccess = 'all';

      for (const app of apps) {
        const key = `${user.userId}:${app.id}`;
        const ex = explicitMap.get(key);
        cells.push({
          userId: user.userId,
          userName: user.userName,
          userEmail: user.userEmail,
          tenantRole: user.tenantRole,
          appId: app.id,
          role: ex?.role ?? defaultRole,
          recordAccess: ex?.recordAccess ?? defaultAccess,
          inherited: !ex,
        });
      }
    }

    res.json({ success: true, data: { users, apps, cells } });
  } catch (error) {
    logger.error({ error }, 'Failed to list app permissions');
    res.status(500).json({ success: false, error: 'Failed to list permissions' });
  }
}

export async function setPermission(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    const { userId, appId } = req.params as { userId: string; appId: string };
    const { role, recordAccess } = req.body as { role: unknown; recordAccess: unknown };

    if (typeof role !== 'string' || !VALID_ROLES.includes(role as AppRole)) {
      res.status(400).json({ success: false, error: 'Invalid role' });
      return;
    }
    if (typeof recordAccess !== 'string' || !VALID_ACCESS.includes(recordAccess as AppRecordAccess)) {
      res.status(400).json({ success: false, error: 'Invalid record access' });
      return;
    }

    // Reject changes to the tenant owner
    const [member] = await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
      .limit(1);

    if (!member) {
      res.status(404).json({ success: false, error: 'User is not a member of this tenant' });
      return;
    }
    if (member.role === 'owner') {
      res.status(400).json({ success: false, error: 'Cannot change owner permissions' });
      return;
    }

    // Validate appId exists in the server registry
    if (!serverAppRegistry.get(appId)) {
      res.status(400).json({ success: false, error: 'Unknown app' });
      return;
    }

    const updated = await setAppPermission(
      tenantId,
      userId,
      appId,
      role as AppRole,
      recordAccess as AppRecordAccess,
      req.auth!.userId,
    );
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error({ error }, 'Failed to update app permission');
    res.status(500).json({ success: false, error: 'Failed to update permission' });
  }
}

export async function revertPermission(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    const { userId, appId } = req.params as { userId: string; appId: string };

    const [member] = await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
      .limit(1);

    if (!member) {
      res.status(404).json({ success: false, error: 'User is not a member of this tenant' });
      return;
    }
    if (member.role === 'owner') {
      res.status(400).json({ success: false, error: 'Cannot change owner permissions' });
      return;
    }

    await deleteAppPermission(tenantId, userId, appId, req.auth!.userId);
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to revert app permission');
    res.status(500).json({ success: false, error: 'Failed to revert permission' });
  }
}

export async function listAudit(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    const { targetUserId, appId, limit, offset } = req.query as Record<string, string | undefined>;

    const parsedLimit = limit ? Math.max(1, Math.min(500, parseInt(limit, 10) || 100)) : 100;
    const parsedOffset = offset ? Math.max(0, parseInt(offset, 10) || 0) : 0;

    const rows = await listPermissionAudit(tenantId, {
      targetUserId: targetUserId || undefined,
      appId: appId || undefined,
      limit: parsedLimit,
      offset: parsedOffset,
    });

    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error({ error }, 'Failed to list permission audit log');
    res.status(500).json({ success: false, error: 'Failed to list permission audit log' });
  }
}
