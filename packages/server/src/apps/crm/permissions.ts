// CRM permission persistence — thin wrapper around the generic app_permissions table.
//
// The CRM admin UI writes through these helpers. Request-time enforcement
// lives in packages/server/src/services/app-permissions.service.ts and is
// used by every CRM controller via getAppPermission/canAccessEntity.
//
// The legacy `crm_permissions` table is no longer read or written by code.
// Any existing rows are migrated into `app_permissions` in db/migrate.ts.

import { db } from '../../config/database';
import { accounts, appPermissions, tenantMembers } from '../../db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import type { AppRole, AppRecordAccess } from '../../services/app-permissions.service';

const CRM_APP_ID = 'crm';

export async function listCrmPermissions(tenantId: string) {
  // Get all tenant members
  const members = await db
    .select()
    .from(tenantMembers)
    .where(eq(tenantMembers.tenantId, tenantId));

  if (members.length === 0) return [];

  const userIds = members.map((m) => m.userId);

  // Existing CRM rows in app_permissions
  const existingPerms = await db
    .select()
    .from(appPermissions)
    .where(and(
      eq(appPermissions.tenantId, tenantId),
      eq(appPermissions.appId, CRM_APP_ID),
      inArray(appPermissions.userId, userIds),
    ));

  // Account details for display
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

  const permMap = new Map<string, typeof existingPerms[0]>();
  for (const p of existingPerms) {
    permMap.set(p.userId, p);
  }

  return members.map((m) => {
    const acct = accountMap.get(m.userId);
    const perm = permMap.get(m.userId);

    // Derive default role from tenant membership when no explicit perm exists
    const tenantRole = m.role;
    const isPrivileged = tenantRole === 'owner' || tenantRole === 'admin';
    const defaultRole: AppRole = isPrivileged ? 'admin' : 'viewer';
    const defaultRecordAccess: AppRecordAccess = isPrivileged ? 'all' : 'own';

    return {
      id: perm?.id ?? null,
      tenantId,
      userId: m.userId,
      role: (perm?.role as AppRole) ?? defaultRole,
      recordAccess: (perm?.recordAccess as AppRecordAccess) ?? defaultRecordAccess,
      userName: acct?.name ?? null,
      userEmail: acct?.email ?? 'unknown',
      createdAt: perm?.createdAt?.toISOString() ?? null,
      updatedAt: perm?.updatedAt?.toISOString() ?? null,
    };
  });
}

export async function upsertCrmPermission(
  tenantId: string,
  userId: string,
  role: AppRole,
  recordAccess: AppRecordAccess,
) {
  const now = new Date();

  const [existing] = await db
    .select()
    .from(appPermissions)
    .where(and(
      eq(appPermissions.tenantId, tenantId),
      eq(appPermissions.userId, userId),
      eq(appPermissions.appId, CRM_APP_ID),
    ))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(appPermissions)
      .set({ role, recordAccess, updatedAt: now })
      .where(eq(appPermissions.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(appPermissions)
    .values({
      tenantId,
      userId,
      appId: CRM_APP_ID,
      role,
      recordAccess,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}
