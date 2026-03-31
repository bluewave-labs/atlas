import { db } from '../config/database';
import { appPermissions, tenantMembers } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

export type AppRole = 'admin' | 'editor' | 'viewer';
export type AppOperation = 'view' | 'create' | 'update' | 'delete';
export type AppRecordAccess = 'all' | 'own';

const ROLE_MATRIX: Record<AppRole, Set<AppOperation>> = {
  admin: new Set(['view', 'create', 'update', 'delete']),
  editor: new Set(['view', 'create', 'update']),
  viewer: new Set(['view']),
};

export interface ResolvedAppPermission {
  role: AppRole;
  recordAccess: AppRecordAccess;
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
      return { role: perm.role as AppRole, recordAccess: perm.recordAccess as AppRecordAccess };
    }

    // 2. Derive from tenant role
    const [member] = await db.select().from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
      .limit(1);

    if (member) {
      const isPrivileged = member.role === 'owner' || member.role === 'admin';
      return { role: isPrivileged ? 'admin' : 'editor', recordAccess: isPrivileged ? 'all' : 'all' };
    }
  }

  // 3. Single-user / no tenant — full admin
  return { role: 'admin', recordAccess: 'all' };
}

export function canAccess(role: AppRole, operation: AppOperation): boolean {
  return ROLE_MATRIX[role]?.has(operation) ?? false;
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

export async function deleteAppPermission(tenantId: string, userId: string, appId: string) {
  await db.delete(appPermissions)
    .where(and(
      eq(appPermissions.tenantId, tenantId),
      eq(appPermissions.userId, userId),
      eq(appPermissions.appId, appId),
    ));
}
