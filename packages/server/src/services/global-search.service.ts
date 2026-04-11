import { sql, SQL } from 'drizzle-orm';
import { db } from '../config/database';
import type { GlobalSearchResult } from '@atlas-platform/shared';
import {
  type ResolvedAppPermission,
  isAdminCaller,
  canAccess,
} from './app-permissions.service';

export type AppPermissionsMap = Map<string, ResolvedAppPermission>;

/**
 * Build a scope condition (SQL fragment) for a non-admin caller against a
 * table that has a `user_id` column. Admin callers get `TRUE`. Callers without
 * `view` permission get `FALSE` (branch is effectively skipped).
 */
function ownScope(
  perm: ResolvedAppPermission | undefined,
  userId: string,
): SQL | null {
  if (!perm || !canAccess(perm.role, 'view')) return null; // skip branch
  if (isAdminCaller(perm)) return sql`TRUE`;
  if (perm.recordAccess === 'all') return sql`TRUE`;
  return sql`user_id = ${userId}`;
}

/**
 * CRM-style scope: non-admin sees records they own OR are assigned to.
 * Used for crm_deals (and crm_leads/activities if surfaced).
 */
function crmOwnOrAssignedScope(
  perm: ResolvedAppPermission | undefined,
  userId: string,
): SQL | null {
  if (!perm || !canAccess(perm.role, 'view')) return null;
  if (isAdminCaller(perm) || perm.recordAccess === 'all') return sql`TRUE`;
  return sql`(user_id = ${userId} OR assigned_user_id = ${userId})`;
}

/**
 * Projects scope: non-admin sees projects they own OR are a member of.
 * `projectIdExpr` is the SQL expression identifying the project row's id
 * (or the project_id foreign key on a related table).
 */
function projectAccessibleScope(
  perm: ResolvedAppPermission | undefined,
  userId: string,
  tenantId: string,
  projectIdExpr: SQL,
): SQL | null {
  if (!perm || !canAccess(perm.role, 'view')) return null;
  if (isAdminCaller(perm) || perm.recordAccess === 'all') return sql`TRUE`;
  return sql`EXISTS (
    SELECT 1 FROM project_projects pp
    WHERE pp.id = ${projectIdExpr}
      AND pp.tenant_id = ${tenantId}
      AND (
        pp.user_id = ${userId}
        OR EXISTS (
          SELECT 1 FROM project_members pm
          WHERE pm.project_id = pp.id AND pm.user_id = ${userId}
        )
      )
  )`;
}

interface SearchBranch {
  sql: SQL;
}

export async function searchGlobal(
  query: string,
  tenantId: string,
  userId?: string,
  permissions?: AppPermissionsMap,
): Promise<GlobalSearchResult[]> {
  if (!query || query.length < 2) return [];

  const term = `%${query}%`;
  // When called without userId/permissions (legacy callers / tests that don't
  // care about scoping), default to an admin-on-everything map so behaviour is
  // unchanged. Production callers must pass real permissions.
  const uid = userId ?? '';
  const perms: AppPermissionsMap = permissions ?? new Map();
  const getPerm = (appId: string): ResolvedAppPermission | undefined => {
    if (permissions) return perms.get(appId);
    // Back-compat: no permissions argument → treat as full admin.
    return { role: 'admin', recordAccess: 'all' };
  };

  const branches: SearchBranch[] = [];

  // docs (Write)
  {
    const scope = ownScope(getPerm('docs'), uid);
    if (scope)
      branches.push({
        sql: sql`(SELECT id::text AS record_id, title, 'docs' AS app_id, 'Write' AS app_name
          FROM documents WHERE tenant_id = ${tenantId} AND is_archived = false AND title ILIKE ${term} AND ${scope}
          ORDER BY updated_at DESC LIMIT 5)`,
      });
  }

  // tasks
  {
    const scope = ownScope(getPerm('tasks'), uid);
    if (scope)
      branches.push({
        sql: sql`(SELECT id::text AS record_id, title, 'tasks' AS app_id, 'Tasks' AS app_name
          FROM tasks WHERE tenant_id = ${tenantId} AND title ILIKE ${term} AND ${scope}
          ORDER BY updated_at DESC LIMIT 5)`,
      });
  }

  // draw
  {
    const scope = ownScope(getPerm('draw'), uid);
    if (scope)
      branches.push({
        sql: sql`(SELECT id::text AS record_id, title, 'draw' AS app_id, 'Draw' AS app_name
          FROM drawings WHERE tenant_id = ${tenantId} AND is_archived = false AND title ILIKE ${term} AND ${scope}
          ORDER BY updated_at DESC LIMIT 5)`,
      });
  }

  // tables
  {
    const scope = ownScope(getPerm('tables'), uid);
    if (scope)
      branches.push({
        sql: sql`(SELECT id::text AS record_id, title, 'tables' AS app_id, 'Tables' AS app_name
          FROM spreadsheets WHERE tenant_id = ${tenantId} AND is_archived = false AND title ILIKE ${term} AND ${scope}
          ORDER BY updated_at DESC LIMIT 5)`,
      });
  }

  // sign
  {
    const scope = ownScope(getPerm('sign'), uid);
    if (scope)
      branches.push({
        sql: sql`(SELECT id::text AS record_id, title, 'sign' AS app_id, 'Agreements' AS app_name
          FROM signature_documents WHERE tenant_id = ${tenantId} AND is_archived = false AND title ILIKE ${term} AND ${scope}
          ORDER BY updated_at DESC LIMIT 5)`,
      });
  }

  // hr / employees
  {
    const scope = ownScope(getPerm('hr'), uid);
    if (scope)
      branches.push({
        sql: sql`(SELECT id::text AS record_id, name AS title, 'hr' AS app_id, 'HR' AS app_name
          FROM employees WHERE tenant_id = ${tenantId} AND is_archived = false AND name ILIKE ${term} AND ${scope}
          ORDER BY updated_at DESC LIMIT 5)`,
      });
  }

  // crm — deals (own OR assigned)
  {
    const scope = crmOwnOrAssignedScope(getPerm('crm'), uid);
    if (scope)
      branches.push({
        sql: sql`(SELECT id::text AS record_id, title, 'crm' AS app_id, 'CRM' AS app_name
          FROM crm_deals WHERE tenant_id = ${tenantId} AND is_archived = false AND title ILIKE ${term} AND ${scope}
          ORDER BY updated_at DESC LIMIT 5)`,
      });
  }

  // crm — contacts (plain own)
  {
    const scope = ownScope(getPerm('crm'), uid);
    if (scope)
      branches.push({
        sql: sql`(SELECT id::text AS record_id, name AS title, 'crm' AS app_id, 'CRM' AS app_name
          FROM crm_contacts WHERE tenant_id = ${tenantId} AND is_archived = false AND name ILIKE ${term} AND ${scope}
          ORDER BY updated_at DESC LIMIT 5)`,
      });
  }

  // crm — companies (plain own)
  {
    const scope = ownScope(getPerm('crm'), uid);
    if (scope)
      branches.push({
        sql: sql`(SELECT id::text AS record_id, name AS title, 'crm' AS app_id, 'CRM' AS app_name
          FROM crm_companies WHERE tenant_id = ${tenantId} AND is_archived = false AND name ILIKE ${term} AND ${scope}
          ORDER BY updated_at DESC LIMIT 5)`,
      });
  }

  // projects
  {
    const projPerm = getPerm('projects');
    const scope = projectAccessibleScope(
      projPerm,
      uid,
      tenantId,
      sql`project_projects.id`,
    );
    if (scope)
      branches.push({
        sql: sql`(SELECT id::text AS record_id, name AS title, 'projects' AS app_id, 'Projects' AS app_name
          FROM project_projects WHERE tenant_id = ${tenantId} AND is_archived = false AND name ILIKE ${term} AND ${scope}
          ORDER BY updated_at DESC LIMIT 5)`,
      });
  }

  // invoices
  {
    const scope = ownScope(getPerm('invoices'), uid);
    if (scope)
      branches.push({
        sql: sql`(SELECT id::text AS record_id, invoice_number AS title, 'invoices' AS app_id, 'Invoices' AS app_name
          FROM invoices WHERE tenant_id = ${tenantId} AND is_archived = false AND invoice_number ILIKE ${term} AND ${scope}
          ORDER BY created_at DESC LIMIT 5)`,
      });
  }

  if (branches.length === 0) return [];

  // Join branches with UNION ALL.
  let combined: SQL = branches[0].sql;
  for (let i = 1; i < branches.length; i++) {
    combined = sql`${combined} UNION ALL ${branches[i].sql}`;
  }
  const finalQuery = sql`${combined} LIMIT 25`;

  const rows = await db.execute(finalQuery);

  return ((rows.rows ?? rows) as any[]).map((r) => ({
    appId: r.app_id,
    recordId: r.record_id,
    title: r.title ?? 'Untitled',
    appName: r.app_name,
  }));
}
