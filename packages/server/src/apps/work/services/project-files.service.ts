import { db } from '../../../config/database';
import { recordLinks, driveItems } from '../../../db/schema';
import { eq, and, or, inArray } from 'drizzle-orm';

export async function listProjectFiles(tenantId: string, projectId: string) {
  const links = await db
    .select({
      sourceRecordId: recordLinks.sourceRecordId,
      targetRecordId: recordLinks.targetRecordId,
      sourceAppId: recordLinks.sourceAppId,
      targetAppId: recordLinks.targetAppId,
    })
    .from(recordLinks)
    .where(and(
      eq(recordLinks.tenantId, tenantId),
      or(
        and(eq(recordLinks.sourceAppId, 'work'), eq(recordLinks.sourceRecordId, projectId), eq(recordLinks.targetAppId, 'drive')),
        and(eq(recordLinks.targetAppId, 'work'), eq(recordLinks.targetRecordId, projectId), eq(recordLinks.sourceAppId, 'drive')),
      ),
    ));

  const driveItemIds = links.map(l =>
    l.sourceAppId === 'drive' ? l.sourceRecordId : l.targetRecordId,
  );
  if (driveItemIds.length === 0) return [];

  return db.select().from(driveItems)
    .where(and(eq(driveItems.tenantId, tenantId), inArray(driveItems.id, driveItemIds)));
}
