import { sql } from 'drizzle-orm';
import { db } from '../config/database';
import type { GlobalSearchResult } from '@atlasmail/shared';

export async function searchGlobal(query: string, tenantId: string): Promise<GlobalSearchResult[]> {
  if (!query || query.length < 2) return [];

  const term = `%${query}%`;

  const rows = await db.execute(sql`
    (SELECT id::text AS record_id, title, 'docs' AS app_id, 'Write' AS app_name
     FROM documents WHERE tenant_id = ${tenantId} AND is_archived = false AND title ILIKE ${term}
     ORDER BY updated_at DESC LIMIT 5)
    UNION ALL
    (SELECT id::text AS record_id, title, 'tasks' AS app_id, 'Tasks' AS app_name
     FROM tasks WHERE tenant_id = ${tenantId} AND title ILIKE ${term}
     ORDER BY updated_at DESC LIMIT 5)
    UNION ALL
    (SELECT id::text AS record_id, title, 'draw' AS app_id, 'Draw' AS app_name
     FROM drawings WHERE tenant_id = ${tenantId} AND is_archived = false AND title ILIKE ${term}
     ORDER BY updated_at DESC LIMIT 5)
    UNION ALL
    (SELECT id::text AS record_id, title, 'tables' AS app_id, 'Tables' AS app_name
     FROM spreadsheets WHERE tenant_id = ${tenantId} AND is_archived = false AND title ILIKE ${term}
     ORDER BY updated_at DESC LIMIT 5)
    UNION ALL
    (SELECT id::text AS record_id, title, 'sign' AS app_id, 'Sign' AS app_name
     FROM signature_documents WHERE tenant_id = ${tenantId} AND is_archived = false AND title ILIKE ${term}
     ORDER BY updated_at DESC LIMIT 5)
    UNION ALL
    (SELECT id::text AS record_id, name AS title, 'hr' AS app_id, 'HR' AS app_name
     FROM employees WHERE tenant_id = ${tenantId} AND is_archived = false AND name ILIKE ${term}
     ORDER BY updated_at DESC LIMIT 5)
    UNION ALL
    (SELECT id::text AS record_id, title, 'crm' AS app_id, 'CRM' AS app_name
     FROM crm_deals WHERE tenant_id = ${tenantId} AND is_archived = false AND title ILIKE ${term}
     ORDER BY updated_at DESC LIMIT 5)
    UNION ALL
    (SELECT id::text AS record_id, name AS title, 'crm' AS app_id, 'CRM' AS app_name
     FROM crm_contacts WHERE tenant_id = ${tenantId} AND is_archived = false AND name ILIKE ${term}
     ORDER BY updated_at DESC LIMIT 5)
    UNION ALL
    (SELECT id::text AS record_id, name AS title, 'crm' AS app_id, 'CRM' AS app_name
     FROM crm_companies WHERE tenant_id = ${tenantId} AND is_archived = false AND name ILIKE ${term}
     ORDER BY updated_at DESC LIMIT 5)
    UNION ALL
    (SELECT id::text AS record_id, name AS title, 'projects' AS app_id, 'Projects' AS app_name
     FROM project_clients WHERE tenant_id = ${tenantId} AND is_archived = false AND name ILIKE ${term}
     ORDER BY updated_at DESC LIMIT 5)
    UNION ALL
    (SELECT id::text AS record_id, name AS title, 'projects' AS app_id, 'Projects' AS app_name
     FROM project_projects WHERE tenant_id = ${tenantId} AND is_archived = false AND name ILIKE ${term}
     ORDER BY updated_at DESC LIMIT 5)
    UNION ALL
    (SELECT id::text AS record_id, invoice_number AS title, 'projects' AS app_id, 'Projects' AS app_name
     FROM project_invoices WHERE tenant_id = ${tenantId} AND is_archived = false AND invoice_number ILIKE ${term}
     ORDER BY created_at DESC LIMIT 5)
    LIMIT 25
  `);

  return ((rows.rows ?? rows) as any[]).map(r => ({
    appId: r.app_id,
    recordId: r.record_id,
    title: r.title ?? 'Untitled',
    appName: r.app_name,
  }));
}
