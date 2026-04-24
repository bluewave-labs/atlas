import { db } from '../config/database';
import { appPermissions, appPermissionAudit, tenantMembers, accounts, users } from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
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
  // 0. Instance-level super-admin bypass. Super-admins can act on any tenant
  // with full admin privileges even if their own tenant_members row says
  // otherwise; this keeps the `/system` operator flow unblocked.
  const [userRow] = await db.select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (userRow?.isSuperAdmin) {
    return { role: 'admin', recordAccess: 'all' };
  }

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
  tenantId: string,
  userId: string,
  appId: string,
  role: AppRole,
  recordAccess: AppRecordAccess = 'all',
  actorUserId: string | null = null,
) {
  const [existing] = await db.select().from(appPermissions)
    .where(and(
      eq(appPermissions.tenantId, tenantId),
      eq(appPermissions.userId, userId),
      eq(appPermissions.appId, appId),
    )).limit(1);

  let result;
  if (existing) {
    const [updated] = await db.update(appPermissions)
      .set({ role, recordAccess, updatedAt: new Date() })
      .where(eq(appPermissions.id, existing.id))
      .returning();
    result = updated;
  } else {
    const [created] = await db.insert(appPermissions)
      .values({ tenantId, userId, appId, role, recordAccess })
      .returning();
    result = created;
  }

  // Write audit row. A missing prior row means this was a fresh grant;
  // an existing row means an in-place update.
  await db.insert(appPermissionAudit).values({
    tenantId,
    targetUserId: userId,
    actorUserId: actorUserId ?? null,
    actorType: actorUserId ? 'user' : 'system',
    appId,
    action: existing ? 'update' : 'grant',
    beforeRole: (existing?.role as AppRole | undefined) ?? null,
    beforeRecordAccess: (existing?.recordAccess as AppRecordAccess | undefined) ?? null,
    afterRole: role,
    afterRecordAccess: recordAccess,
  });

  return result;
}

export async function listUserPermissions(tenantId: string, userId: string) {
  return db.select().from(appPermissions)
    .where(and(eq(appPermissions.tenantId, tenantId), eq(appPermissions.userId, userId)));
}

export async function listAllTenantPermissions(tenantId: string) {
  return db.select().from(appPermissions)
    .where(eq(appPermissions.tenantId, tenantId));
}

export async function deleteAppPermission(
  tenantId: string,
  userId: string,
  appId: string,
  actorUserId: string | null = null,
) {
  const [existing] = await db.select().from(appPermissions)
    .where(and(
      eq(appPermissions.tenantId, tenantId),
      eq(appPermissions.userId, userId),
      eq(appPermissions.appId, appId),
    )).limit(1);

  await db.delete(appPermissions)
    .where(and(
      eq(appPermissions.tenantId, tenantId),
      eq(appPermissions.userId, userId),
      eq(appPermissions.appId, appId),
    ));

  await db.insert(appPermissionAudit).values({
    tenantId,
    targetUserId: userId,
    actorUserId: actorUserId ?? null,
    actorType: actorUserId ? 'user' : 'system',
    appId,
    action: 'revoke',
    beforeRole: (existing?.role as AppRole | undefined) ?? null,
    beforeRecordAccess: (existing?.recordAccess as AppRecordAccess | undefined) ?? null,
    afterRole: null,
    afterRecordAccess: null,
  });
}

// ─── Audit log ─────────────────────────────────────────────────────

export interface PermissionAuditRow {
  id: string;
  tenantId: string;
  targetUserId: string;
  targetName: string | null;
  targetEmail: string | null;
  actorUserId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorType: 'user' | 'system';
  appId: string;
  action: 'grant' | 'revoke' | 'update';
  beforeRole: AppRole | null;
  beforeRecordAccess: AppRecordAccess | null;
  afterRole: AppRole | null;
  afterRecordAccess: AppRecordAccess | null;
  createdAt: string;
}

export async function listPermissionAudit(
  tenantId: string,
  filters?: {
    targetUserId?: string;
    appId?: string;
    limit?: number;
    offset?: number;
  },
): Promise<PermissionAuditRow[]> {
  const limit = Math.min(filters?.limit ?? 100, 500);
  const offset = filters?.offset ?? 0;

  const where = [eq(appPermissionAudit.tenantId, tenantId)];
  if (filters?.targetUserId) where.push(eq(appPermissionAudit.targetUserId, filters.targetUserId));
  if (filters?.appId) where.push(eq(appPermissionAudit.appId, filters.appId));

  const rows = await db
    .select()
    .from(appPermissionAudit)
    .where(and(...where))
    .orderBy(desc(appPermissionAudit.createdAt))
    .limit(limit)
    .offset(offset);

  // Batch-look up account info for display.
  const userIds = new Set<string>();
  for (const r of rows) {
    if (r.targetUserId) userIds.add(r.targetUserId);
    if (r.actorUserId) userIds.add(r.actorUserId);
  }
  const acctList = userIds.size
    ? await db
        .select({ userId: accounts.userId, name: accounts.name, email: accounts.email })
        .from(accounts)
    : [];
  const acctMap = new Map<string, { name: string | null; email: string }>();
  for (const a of acctList) acctMap.set(a.userId, { name: a.name, email: a.email });

  return rows.map((r) => {
    const tgt = acctMap.get(r.targetUserId);
    const act = r.actorUserId ? acctMap.get(r.actorUserId) : null;
    return {
      id: r.id,
      tenantId: r.tenantId,
      targetUserId: r.targetUserId,
      targetName: tgt?.name ?? null,
      targetEmail: tgt?.email ?? null,
      actorUserId: r.actorUserId,
      actorName: act?.name ?? null,
      actorEmail: act?.email ?? null,
      actorType: (r.actorType as 'user' | 'system') ?? 'user',
      appId: r.appId,
      action: r.action as 'grant' | 'revoke' | 'update',
      beforeRole: (r.beforeRole as AppRole | null) ?? null,
      beforeRecordAccess: (r.beforeRecordAccess as AppRecordAccess | null) ?? null,
      afterRole: (r.afterRole as AppRole | null) ?? null,
      afterRecordAccess: (r.afterRecordAccess as AppRecordAccess | null) ?? null,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    };
  });
}
