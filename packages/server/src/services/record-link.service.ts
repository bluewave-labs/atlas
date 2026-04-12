import { eq, and, or, sql } from 'drizzle-orm';
import { db } from '../config/database';
import { recordLinks } from '../db/schema';
import type { LinkCount, LinkedRecord } from '@atlas-platform/shared';

export async function getLinksForRecord(appId: string, recordId: string) {
  return db.select().from(recordLinks)
    .where(or(
      and(eq(recordLinks.sourceAppId, appId), eq(recordLinks.sourceRecordId, recordId)),
      and(eq(recordLinks.targetAppId, appId), eq(recordLinks.targetRecordId, recordId)),
    ));
}

export async function getLinkCounts(appId: string, recordId: string): Promise<LinkCount[]> {
  const rows = await db.execute(sql`
    SELECT
      CASE
        WHEN source_app_id = ${appId} AND source_record_id = ${recordId}
        THEN target_app_id
        ELSE source_app_id
      END AS app_id,
      COUNT(*)::int AS count
    FROM record_links
    WHERE (source_app_id = ${appId} AND source_record_id = ${recordId})
       OR (target_app_id = ${appId} AND target_record_id = ${recordId})
    GROUP BY app_id
  `);
  return (rows.rows ?? rows) as unknown as LinkCount[];
}

export async function getLinksWithTitles(appId: string, recordId: string): Promise<LinkedRecord[]> {
  const links = await getLinksForRecord(appId, recordId);
  if (links.length === 0) return [];

  const results: LinkedRecord[] = [];

  for (const link of links) {
    const isSource = link.sourceAppId === appId && link.sourceRecordId === recordId;
    const linkedAppId = isSource ? link.targetAppId : link.sourceAppId;
    const linkedRecordId = isSource ? link.targetRecordId : link.sourceRecordId;

    let title = 'Untitled';
    try {
      const titleRow = await resolveRecordTitle(linkedAppId, linkedRecordId);
      if (titleRow) title = titleRow;
    } catch { /* fallback to Untitled */ }

    results.push({
      linkId: link.id,
      appId: linkedAppId,
      recordId: linkedRecordId,
      title,
      linkType: link.linkType,
      createdAt: link.createdAt.toISOString(),
    });
  }

  return results;
}

async function resolveRecordTitle(appId: string, recordId: string): Promise<string | null> {
  const tableMap: Record<string, { table: string; column: string }> = {
    docs: { table: 'documents', column: 'title' },
    tasks: { table: 'tasks', column: 'title' },
    draw: { table: 'drawings', column: 'title' },
    drive: { table: 'drive_items', column: 'name' },
  };

  const mapping = tableMap[appId];
  if (!mapping) return null;

  const rows = await db.execute(
    sql`SELECT ${sql.raw(mapping.column)} as title FROM ${sql.raw(mapping.table)} WHERE id = ${recordId} LIMIT 1`
  );
  const row = ((rows.rows ?? rows) as any[])[0];
  return row?.title ?? null;
}

export async function createLink(data: {
  tenantId?: string;
  sourceAppId: string;
  sourceRecordId: string;
  targetAppId: string;
  targetRecordId: string;
  linkType?: string;
  metadata?: Record<string, unknown>;
  createdBy: string;
}) {
  const [link] = await db.insert(recordLinks).values({
    tenantId: data.tenantId,
    sourceAppId: data.sourceAppId,
    sourceRecordId: data.sourceRecordId,
    targetAppId: data.targetAppId,
    targetRecordId: data.targetRecordId,
    linkType: data.linkType ?? 'related',
    metadata: data.metadata ?? {},
    createdBy: data.createdBy,
  }).returning();
  return link;
}

export async function getLinkById(id: string) {
  const [link] = await db.select().from(recordLinks)
    .where(eq(recordLinks.id, id))
    .limit(1);
  return link ?? null;
}

export async function deleteLink(id: string) {
  const [deleted] = await db.delete(recordLinks)
    .where(eq(recordLinks.id, id))
    .returning();
  return deleted ?? null;
}
