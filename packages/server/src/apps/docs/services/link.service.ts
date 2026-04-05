import { db } from '../../../config/database';
import { documents, documentLinks } from '../../../db/schema';
import { eq, and } from 'drizzle-orm';

// ─── Document Links / Backlinks ──────────────────────────────────────

export async function syncDocumentLinks(userId: string, docId: string, content: Record<string, unknown> | null) {
  // Delete existing links from this document
  await db.delete(documentLinks).where(eq(documentLinks.sourceDocId, docId));

  if (!content) return;

  // Parse content to find pageMention nodes (simple JSON walk)
  const mentionedIds = new Set<string>();
  function walk(obj: unknown) {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) { obj.forEach(walk); return; }
    const o = obj as Record<string, unknown>;
    if (o.type === 'pageMention' && typeof o.attrs === 'object' && o.attrs) {
      const id = (o.attrs as Record<string, unknown>).pageId;
      if (typeof id === 'string') mentionedIds.add(id);
    }
    if (o.content) walk(o.content);
  }
  walk(content);

  // Insert links
  const now = new Date();
  for (const targetId of mentionedIds) {
    if (targetId === docId) continue; // Skip self-references
    try {
      await db.insert(documentLinks).values({
        sourceDocId: docId, targetDocId: targetId, createdAt: now,
      });
    } catch { /* duplicate or missing target — ignore */ }
  }
}

export async function getBacklinks(userId: string, docId: string) {
  const links = await db.select({
    id: documents.id,
    title: documents.title,
    icon: documents.icon,
  }).from(documentLinks)
    .innerJoin(documents, eq(documentLinks.sourceDocId, documents.id))
    .where(and(
      eq(documentLinks.targetDocId, docId),
      eq(documents.userId, userId),
      eq(documents.isArchived, false),
    ));
  return links;
}
