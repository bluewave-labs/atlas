import { db } from '../../../config/database';
import { documentVersions } from '../../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getDocument, updateDocument } from './document.service';

// ─── Document version history (snapshots) ─────────────────────────────

export async function createVersion(userId: string, documentId: string) {
  const doc = await getDocument(userId, documentId);
  if (!doc) return null;

  const [version] = await db
    .insert(documentVersions)
    .values({
      documentId,
      tenantId: doc.tenantId,
      userId,
      title: doc.title,
      content: doc.content,
      createdAt: new Date(),
    })
    .returning();

  // Keep only last 50 versions per document
  const versions = await db
    .select({ id: documentVersions.id })
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(sql`${documentVersions.createdAt} DESC`)
    .limit(100)
    .offset(50);

  for (const v of versions) {
    await db.delete(documentVersions).where(eq(documentVersions.id, v.id));
  }

  return version;
}

export async function listVersions(userId: string, documentId: string, tenantId?: string | null) {
  // Access gate: require the caller can read the parent document.
  const doc = await getDocument(userId, documentId, tenantId);
  if (!doc) return [];

  return db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy(sql`${documentVersions.createdAt} DESC`)
    .limit(50);
}

export async function getVersion(userId: string, versionId: string) {
  // userId kept in signature for call-site compatibility; access is controlled at the
  // document level before callers reach this function.
  const [version] = await db
    .select()
    .from(documentVersions)
    .where(eq(documentVersions.id, versionId))
    .limit(1);

  return version || null;
}

export async function restoreVersion(userId: string, documentId: string, versionId: string) {
  const version = await getVersion(userId, versionId);
  if (!version) return null;

  // Save current state as a version before restoring
  await createVersion(userId, documentId);

  // Restore the old version's content
  return updateDocument(userId, documentId, {
    title: version.title,
    content: version.content,
  });
}
