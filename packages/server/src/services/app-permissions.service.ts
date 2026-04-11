import { db } from '../config/database';
import { appPermissions, tenantMembers } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { logger } from '../utils/logger';

export type AppRole = 'admin' | 'editor' | 'viewer';
export type AppOperation = 'view' | 'create' | 'update' | 'delete' | 'delete_own';
export type AppRecordAccess = 'all' | 'own';

const ROLE_MATRIX: Record<AppRole, Set<AppOperation>> = {
  admin: new Set(['view', 'create', 'update', 'delete', 'delete_own']),
  editor: new Set(['view', 'create', 'update', 'delete_own']),
  viewer: new Set(['view']),
};

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
      return { role: isPrivileged ? 'admin' : 'viewer', recordAccess: isPrivileged ? 'all' : 'own' };
    }
  }

  // 3. Single-user / no tenant — full admin
  return { role: 'admin', recordAccess: 'all' };
}

export function canAccess(role: AppRole, operation: AppOperation): boolean {
  return ROLE_MATRIX[role]?.has(operation) ?? false;
}

/**
 * Determine whether a caller may delete a record they have already loaded.
 *
 * - `admin` has blanket `delete` — always allowed (including records they don't own).
 * - `editor` has only `delete_own` — must own the record.
 * - `viewer` has neither — never allowed.
 *
 * Returns:
 *   - 'allow'    — caller can proceed with the delete
 *   - 'not_own'  — caller has `delete_own` but does not own the record; the
 *                  controller should respond 404 to avoid leaking existence
 *   - 'forbid'   — caller has no delete permission at all; controller should
 *                  respond 403
 *
 * Use this helper anywhere the old dead `!canAccess('delete') && !canAccess('delete_own')`
 * idiom appeared. Load the record first, then call this, then branch.
 */
export type DeleteDecision = 'allow' | 'not_own' | 'forbid';

export function decideRecordDelete(
  role: AppRole,
  recordOwnerUserId: string | null | undefined,
  currentUserId: string,
): DeleteDecision {
  if (canAccess(role, 'delete')) return 'allow';
  if (canAccess(role, 'delete_own')) {
    return recordOwnerUserId === currentUserId ? 'allow' : 'not_own';
  }
  return 'forbid';
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
