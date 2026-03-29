import { sql } from 'drizzle-orm';
import { db } from '../config/database';
import type { GlobalSearchResult } from '@atlasmail/shared';

export async function searchGlobal(query: string, accountId: string): Promise<GlobalSearchResult[]> {
  if (!query || query.length < 2) return [];

  const term = `%${query}%`;

  const rows = await db.execute(sql`
    (SELECT id::text AS record_id, title, 'docs' AS app_id, 'Write' AS app_name
     FROM documents WHERE account_id = ${accountId} AND is_archived = false AND title ILIKE ${term}
     ORDER BY updated_at DESC LIMIT 5)
    UNION ALL
    (SELECT id::text AS record_id, title, 'tasks' AS app_id, 'Tasks' AS app_name
     FROM tasks WHERE account_id = ${accountId} AND title ILIKE ${term}
     ORDER BY updated_at DESC LIMIT 5)
    UNION ALL
    (SELECT id::text AS record_id, title, 'draw' AS app_id, 'Draw' AS app_name
     FROM drawings WHERE account_id = ${accountId} AND is_archived = false AND title ILIKE ${term}
     ORDER BY updated_at DESC LIMIT 5)
    UNION ALL
    (SELECT id::text AS record_id, title, 'tables' AS app_id, 'Tables' AS app_name
     FROM spreadsheets WHERE account_id = ${accountId} AND is_archived = false AND title ILIKE ${term}
     ORDER BY updated_at DESC LIMIT 5)
    UNION ALL
    (SELECT id::text AS record_id, title, 'sign' AS app_id, 'Sign' AS app_name
     FROM signature_documents WHERE account_id = ${accountId} AND is_archived = false AND title ILIKE ${term}
     ORDER BY updated_at DESC LIMIT 5)
    UNION ALL
    (SELECT id::text AS record_id, name AS title, 'hr' AS app_id, 'HR' AS app_name
     FROM employees WHERE account_id = ${accountId} AND is_archived = false AND name ILIKE ${term}
     ORDER BY updated_at DESC LIMIT 5)
    LIMIT 25
  `);

  return ((rows.rows ?? rows) as any[]).map(r => ({
    appId: r.app_id,
    recordId: r.record_id,
    title: r.title ?? 'Untitled',
    appName: r.app_name,
  }));
}
