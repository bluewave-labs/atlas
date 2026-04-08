import { db } from '../../config/database';
import { crmPermissions } from '../../db/schema';
import { accounts, tenantMembers } from '../../db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import type { CrmRole, CrmRecordAccess, CrmEntity, CrmOperation } from '@atlasmail/shared';

// ─── Permission matrix ─────────────────────────────────────────────
// Defines which operations each role can perform on each entity.
// 'crud' = create + read + update + delete, 'view' = read only, 'none' = no access

const ROLE_MATRIX: Record<CrmRole, Record<CrmEntity, Set<CrmOperation>>> = {
  admin: {
    deals: new Set(['view', 'create', 'update', 'delete']),
    contacts: new Set(['view', 'create', 'update', 'delete']),
    companies: new Set(['view', 'create', 'update', 'delete']),
    activities: new Set(['view', 'create', 'update', 'delete']),
    workflows: new Set(['view', 'create', 'update', 'delete']),
    dashboard: new Set(['view']),
  },
  manager: {
    deals: new Set(['view', 'create', 'update', 'delete']),
    contacts: new Set(['view', 'create', 'update', 'delete']),
    companies: new Set(['view', 'create', 'update', 'delete']),
    activities: new Set(['view', 'create', 'update', 'delete']),
    workflows: new Set(['view']),
    dashboard: new Set(['view']),
  },
  sales: {
    deals: new Set(['view', 'create', 'update', 'delete']),
    contacts: new Set(['view', 'create', 'update', 'delete']),
    companies: new Set(['view']),
    activities: new Set(['view', 'create', 'update', 'delete']),
    workflows: new Set<CrmOperation>(),
    dashboard: new Set(['view']),
  },
  viewer: {
    deals: new Set(['view']),
    contacts: new Set(['view']),
    companies: new Set(['view']),
    activities: new Set(['view']),
    workflows: new Set<CrmOperation>(),
    dashboard: new Set(['view']),
  },
};

// ─── Get / resolve CRM permission ──────────────────────────────────

export interface ResolvedCrmPermission {
  id: string | null;
  tenantId: string;
  userId: string;
  role: CrmRole;
  recordAccess: CrmRecordAccess;
}

/**
 * Fetch the CRM permission for a user. If none exists, derive from tenant role:
 * - tenant owner/admin → CRM admin with 'all' record access
 * - tenant member → CRM viewer with 'own' record access
 * - no tenant (single-user) → backward compat admin
 */
export async function getCrmPermission(tenantId: string, userId: string): Promise<ResolvedCrmPermission> {
  const [perm] = await db
    .select()
    .from(crmPermissions)
    .where(and(eq(crmPermissions.tenantId, tenantId), eq(crmPermissions.userId, userId)))
    .limit(1);

  if (perm) {
    return {
      id: perm.id,
      tenantId: perm.tenantId,
      userId: perm.userId,
      role: perm.role as CrmRole,
      recordAccess: perm.recordAccess as CrmRecordAccess,
    };
  }

  // No explicit permission — derive from tenant role
  if (tenantId) {
    const [member] = await db
      .select()
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
      .limit(1);

    if (member) {
      const tenantRole = member.role;
      // owner/admin get CRM admin, member gets viewer
      const crmRole = (tenantRole === 'owner' || tenantRole === 'admin') ? 'admin' : 'viewer';
      return {
        id: null,
        tenantId,
        userId,
        role: crmRole as CrmRole,
        recordAccess: crmRole === 'admin' ? 'all' : 'own',
      };
    }
  }

  // Single-user (no tenant) — backward compat
  return {
    id: null,
    tenantId,
    userId,
    role: 'admin',
    recordAccess: 'all',
  };
}

// ─── Entity access check ───────────────────────────────────────────

export function canAccess(role: CrmRole, entity: CrmEntity, operation: CrmOperation): boolean {
  return ROLE_MATRIX[role]?.[entity]?.has(operation) ?? false;
}

// ─── Record-level filter ───────────────────────────────────────────

/**
 * Returns a SQL condition to filter records by ownership.
 * - 'all': no extra filter (returns SQL `TRUE`)
 * - 'own': adds `userIdColumn = currentUserId`
 */
export function getRecordFilter(recordAccess: CrmRecordAccess, userIdColumn: any, currentUserId: string) {
  if (recordAccess === 'own') {
    return eq(userIdColumn, currentUserId);
  }
  // 'all' — no filter needed; return a tautology
  return sql`TRUE`;
}

// ─── Permission CRUD ───────────────────────────────────────────────

export async function listCrmPermissions(tenantId: string, tenantId: string) {
  // Get all tenant members first
  const members = await db
    .select()
    .from(tenantMembers)
    .where(eq(tenantMembers.tenantId, tenantId));

  if (members.length === 0) return [];

  const userIds = members.map((m) => m.userId);

  // Get all existing CRM permissions for these users
  const existingPerms = await db
    .select()
    .from(crmPermissions)
    .where(and(
      eq(crmPermissions.tenantId, tenantId),
      inArray(crmPermissions.userId, userIds),
    ));

  // Get user details from accounts
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

    // Derive default role from tenant membership when no explicit CRM perm
    const tenantRole = m.role;
    const defaultCrmRole: CrmRole = (tenantRole === 'owner' || tenantRole === 'admin') ? 'admin' : 'viewer';
    const defaultRecordAccess: CrmRecordAccess = defaultCrmRole === 'admin' ? 'all' : 'own';

    return {
      id: perm?.id ?? null,
      tenantId,
      userId: m.userId,
      role: (perm?.role as CrmRole) ?? defaultCrmRole,
      recordAccess: (perm?.recordAccess as CrmRecordAccess) ?? defaultRecordAccess,
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
  role: CrmRole,
  recordAccess: CrmRecordAccess,
) {
  const now = new Date();

  // Check if exists
  const [existing] = await db
    .select()
    .from(crmPermissions)
    .where(and(eq(crmPermissions.tenantId, tenantId), eq(crmPermissions.userId, userId)))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(crmPermissions)
      .set({ role, recordAccess, updatedAt: now })
      .where(eq(crmPermissions.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(crmPermissions)
    .values({ tenantId, userId, role, recordAccess, createdAt: now, updatedAt: now })
    .returning();

  return created;
}
