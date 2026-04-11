import { db } from '../config/database';
import { appPermissions, tenantMembers } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { canAccess, type AppRole, type AppOperation, type AppRecordAccess } from '@atlas-platform/shared';

// Re-export shared types so existing server-side imports keep working.
export { canAccess };
export type { AppRole, AppOperation, AppRecordAccess };

export interface ResolvedAppPermission {
  role: AppRole;
  recordAccess: AppRecordAccess;
  entityPermissions?: Record<string, string[]> | null;
}

export async function getAppPermission(
  tenantId: string | null | undefined,
  userId: string,
  appId: string,
): Promise<ResolvedAppPermission> {
  // 1. Check explicit permission
  if (tenantId) {
    const [perm] = await db.select().from(appPermissions)
      .where(and(
        eq(appPermissions.tenantId, tenantId),
        eq(appPermissions.userId, userId),
        eq(appPermissions.appId, appId),
      )).limit(1);

    if (perm) {
      return {
        role: perm.role as AppRole,
        recordAccess: perm.recordAccess as AppRecordAccess,
        entityPermissions: perm.entityPermissions ?? null,
      };
    }

    // 2. Derive from tenant role
    const [member] = await db.select().from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
      .limit(1);

    if (member) {
      const isPrivileged = member.role === 'owner' || member.role === 'admin';
      // Non-privileged tenant members default to editor+all so newly invited
      // teammates are productive on day one rather than landing on blank
      // read-only apps until an admin sets per-app permissions. See RBAC audit.
      return isPrivileged
        ? { role: 'admin', recordAccess: 'all' }
        : { role: 'editor', recordAccess: 'all' };
    }
  }

  // 3. Single-user / no tenant — full admin
  return { role: 'admin', recordAccess: 'all' };
}

export function isAdminCaller(perm: ResolvedAppPermission | undefined): boolean {
  return perm?.role === 'admin' && perm?.recordAccess === 'all';
}

export function canAccessEntity(
  role: AppRole,
  entity: string,
  operation: AppOperation,
  entityPermissions?: Record<string, string[]> | null
): boolean {
  // If entity-level overrides exist, use them
  if (entityPermissions && entity in entityPermissions) {
    return entityPermissions[entity].includes(operation);
  }
  // Fall back to role matrix
  return canAccess(role, operation);
}

export function getRecordFilter(recordAccess: AppRecordAccess, userIdColumn: any, currentUserId: string) {
  if (recordAccess === 'own') {
    return eq(userIdColumn, currentUserId);
  }
  return sql`TRUE`;
}

// CRUD for managing permissions
export async function listAppPermissions(tenantId: string, appId: string) {
  return db.select().from(appPermissions)
    .where(and(eq(appPermissions.tenantId, tenantId), eq(appPermissions.appId, appId)));
}

export async function setAppPermission(
  tenantId: string, userId: string, appId: string, role: AppRole, recordAccess: AppRecordAccess = 'all'
) {
  const [existing] = await db.select().from(appPermissions)
    .where(and(
      eq(appPermissions.tenantId, tenantId),
      eq(appPermissions.userId, userId),
      eq(appPermissions.appId, appId),
    )).limit(1);

  if (existing) {
    const [updated] = await db.update(appPermissions)
      .set({ role, recordAccess, updatedAt: new Date() })
      .where(eq(appPermissions.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db.insert(appPermissions)
    .values({ tenantId, userId, appId, role, recordAccess })
    .returning();
  return created;
}

export async function listUserPermissions(tenantId: string, userId: string) {
  return db.select().from(appPermissions)
    .where(and(eq(appPermissions.tenantId, tenantId), eq(appPermissions.userId, userId)));
}

export async function listAllTenantPermissions(tenantId: string) {
  return db.select().from(appPermissions)
    .where(eq(appPermissions.tenantId, tenantId));
}

export async function deleteAppPermission(tenantId: string, userId: string, appId: string) {
  await db.delete(appPermissions)
    .where(and(
      eq(appPermissions.tenantId, tenantId),
      eq(appPermissions.userId, userId),
      eq(appPermissions.appId, appId),
    ));
}
