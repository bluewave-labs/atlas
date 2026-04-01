import { db } from '../../config/database';
import { documents, documentVersions, documentComments, documentLinks } from '../../db/schema';
import { eq, and, isNull, asc, desc, sql } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import type {
  CreateDocumentInput,
  UpdateDocumentInput,
  MoveDocumentInput,
  DocumentTreeNode,
} from '@atlasmail/shared';

// ─── List all documents (flat) for building the tree ─────────────────

export async function listDocuments(userId: string, includeArchived = false) {
  const conditions = [eq(documents.userId, userId)];

  if (!includeArchived) {
    conditions.push(eq(documents.isArchived, false));
  }

  return db
    .select({
      id: documents.id,
      parentId: documents.parentId,
      title: documents.title,
      icon: documents.icon,
      sortOrder: documents.sortOrder,
      isArchived: documents.isArchived,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(and(...conditions))
    .orderBy(asc(documents.sortOrder), asc(documents.createdAt));
}

/** Build a tree structure from a flat list of documents. */
export function buildDocumentTree(
  docs: Array<{
    id: string;
    parentId: string | null;
    title: string;
    icon: string | null;
    sortOrder: number;
    isArchived: boolean;
  }>,
): DocumentTreeNode[] {
  const map = new Map<string, DocumentTreeNode>();
  const roots: DocumentTreeNode[] = [];

  // First pass: create nodes
  for (const doc of docs) {
    map.set(doc.id, {
      id: doc.id,
      parentId: doc.parentId,
      title: doc.title,
      icon: doc.icon,
      sortOrder: doc.sortOrder,
      isArchived: doc.isArchived,
      children: [],
    });
  }

  // Second pass: assemble tree
  for (const doc of docs) {
    const node = map.get(doc.id)!;
    if (doc.parentId && map.has(doc.parentId)) {
      map.get(doc.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ─── Seed sample documents if the account has none ───────────────────

export async function seedSampleDocuments(userId: string, accountId: string) {
  // Check if user has any meaningful docs (non-archived, with a title other than "Untitled")
  const meaningful = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.userId, userId),
        eq(documents.isArchived, false),
        sql`${documents.title} != 'Untitled'`,
      ),
    )
    .limit(1);

  if (meaningful.length > 0) return { skipped: true }; // Already has real documents

  // Delete any leftover empty "Untitled" docs so we can start fresh
  await db.delete(documents).where(eq(documents.userId, userId));

  const now = new Date();
  const c = (html: string) => ({ _html: html });

  await db.insert(documents).values({
    accountId, userId, title: 'Getting started', icon: '🚀', sortOrder: 0, createdAt: now, updatedAt: now,
    coverImage: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=300&fit=crop',
    content: c([
      '<h1>Getting started</h1>',
      '<p>Welcome to your workspace. This is a flexible home for notes, docs, and ideas. Everything you create here is auto-saved and organized in the sidebar.</p>',
      '<hr>',
      '<p>Use the <strong>+ New page</strong> button in the sidebar to create your first page, or type <code>/</code> on an empty line to explore the slash command menu.</p>',
      '<div data-type="callout" data-callout-type="info"><p><strong>Tip:</strong> Pages can be nested as deep as you like. Hover over any page in the sidebar and click <strong>+</strong> to add a sub-page.</p></div>',
    ].join('')),
  });

  logger.info({ userId, accountId }, 'Seeded sample documents');
  return { documents: 1 };
}

// ─── Get a single document with full content ─────────────────────────

export async function getDocument(userId: string, documentId: string) {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1);

  return doc || null;
}

// ─── Create a new document ───────────────────────────────────────────

export async function createDocument(userId: string, accountId: string, input: CreateDocumentInput) {
  const now = new Date();

  // Determine the next sort order within the target parent
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${documents.sortOrder}), -1)` })
    .from(documents)
    .where(
      and(
        eq(documents.userId, userId),
        input.parentId
          ? eq(documents.parentId, input.parentId)
          : isNull(documents.parentId),
      ),
    );

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(documents)
    .values({
      accountId,
      userId,
      parentId: input.parentId ?? null,
      title: input.title || 'Untitled',
      content: input.content ?? null,
      icon: input.icon ?? null,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, documentId: created.id }, 'Document created');
  return created;
}

// ─── Update a document ───────────────────────────────────────────────

export async function updateDocument(
  userId: string,
  documentId: string,
  input: UpdateDocumentInput,
) {
  const now = new Date();

  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.title !== undefined) updates.title = input.title;
  if (input.content !== undefined) updates.content = input.content;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.coverImage !== undefined) updates.coverImage = input.coverImage;
  if (input.parentId !== undefined) updates.parentId = input.parentId;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  await db
    .update(documents)
    .set(updates)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));

  // If archiving, also archive all descendants recursively
  if (input.isArchived === true) {
    await archiveDescendants(userId, documentId, true);
  }

  // Sync document links when content changes
  if (input.content !== undefined) {
    await syncDocumentLinks(userId, documentId, input.content);
  }

  const [updated] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1);

  return updated || null;
}

/** Recursively archive or unarchive all descendant documents. */
async function archiveDescendants(userId: string, parentId: string, isArchived: boolean) {
  const children = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.userId, userId), eq(documents.parentId, parentId)));

  for (const child of children) {
    await db
      .update(documents)
      .set({ isArchived, updatedAt: new Date() })
      .where(eq(documents.id, child.id));
    await archiveDescendants(userId, child.id, isArchived);
  }
}

// ─── Move / reorder a document ───────────────────────────────────────

export async function moveDocument(
  userId: string,
  documentId: string,
  input: MoveDocumentInput,
) {
  const now = new Date();

  // Prevent a document from being moved under itself (circular reference)
  if (input.parentId) {
    const isDescendant = await checkIsDescendant(userId, documentId, input.parentId);
    if (isDescendant) {
      throw new Error('Cannot move a document under one of its own descendants');
    }
  }

  await db
    .update(documents)
    .set({
      parentId: input.parentId,
      sortOrder: input.sortOrder,
      updatedAt: now,
    })
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));

  const [updated] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1);

  return updated || null;
}

/**
 * Check if `candidateParentId` is a descendant of `documentId`.
 * Used to prevent circular parent references.
 */
async function checkIsDescendant(
  userId: string,
  documentId: string,
  candidateParentId: string,
): Promise<boolean> {
  let currentId: string | null = candidateParentId;

  // Walk up the tree from candidateParentId. If we encounter documentId, it is a descendant.
  while (currentId) {
    if (currentId === documentId) return true;

    const [parent] = await db
      .select({ parentId: documents.parentId })
      .from(documents)
      .where(and(eq(documents.id, currentId), eq(documents.userId, userId)))
      .limit(1);

    currentId = parent?.parentId ?? null;
  }

  return false;
}

// ─── Delete (hard delete) a document and all descendants ─────────────

export async function deleteDocument(userId: string, documentId: string) {
  // Soft delete: just archive
  await updateDocument(userId, documentId, { isArchived: true });
}

// ─── Restore an archived document ────────────────────────────────────

export async function restoreDocument(userId: string, documentId: string) {
  const now = new Date();

  await db
    .update(documents)
    .set({ isArchived: false, updatedAt: now })
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));

  // Also restore descendants
  await archiveDescendants(userId, documentId, false);

  const [restored] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)))
    .limit(1);

  return restored || null;
}

// ─── Full-text search across document content ─────────────────────────

export async function searchDocuments(userId: string, query: string) {
  const searchTerm = `%${query}%`;
  return db
    .select({
      id: documents.id,
      parentId: documents.parentId,
      title: documents.title,
      icon: documents.icon,
      sortOrder: documents.sortOrder,
      isArchived: documents.isArchived,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(
      and(
        eq(documents.userId, userId),
        eq(documents.isArchived, false),
        sql`(${documents.title} LIKE ${searchTerm} OR CAST(${documents.content} AS TEXT) LIKE ${searchTerm})`,
      ),
    )
    .orderBy(asc(documents.updatedAt))
    .limit(20);
}

// ─── Document version history (snapshots) ─────────────────────────────

export async function createVersion(userId: string, documentId: string) {
  const doc = await getDocument(userId, documentId);
  if (!doc) return null;

  const [version] = await db
    .insert(documentVersions)
    .values({
      documentId,
      accountId: doc.accountId,
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

export async function listVersions(userId: string, documentId: string) {
  return db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.documentId, documentId),
        eq(documentVersions.userId, userId),
      ),
    )
    .orderBy(sql`${documentVersions.createdAt} DESC`)
    .limit(50);
}

export async function getVersion(userId: string, versionId: string) {
  const [version] = await db
    .select()
    .from(documentVersions)
    .where(
      and(
        eq(documentVersions.id, versionId),
        eq(documentVersions.userId, userId),
      ),
    )
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

// ─── Document Comments ───────────────────────────────────────────────

export async function listComments(userId: string, documentId: string) {
  return db.select().from(documentComments)
    .where(eq(documentComments.documentId, documentId))
    .orderBy(asc(documentComments.createdAt));
}

export async function createComment(userId: string, accountId: string, documentId: string, input: {
  content: string; selectionFrom?: number; selectionTo?: number; selectionText?: string; parentId?: string;
}) {
  const now = new Date();
  const [created] = await db.insert(documentComments).values({
    documentId, userId, accountId,
    content: input.content,
    selectionFrom: input.selectionFrom ?? null, selectionTo: input.selectionTo ?? null,
    selectionText: input.selectionText ?? null,
    parentId: input.parentId ?? null,
    createdAt: now, updatedAt: now,
  }).returning();
  return created;
}

export async function updateComment(userId: string, commentId: string, data: { content?: string; isResolved?: boolean }) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };
  if (data.content !== undefined) updates.content = data.content;
  if (data.isResolved !== undefined) updates.isResolved = data.isResolved;
  await db.update(documentComments).set(updates)
    .where(and(eq(documentComments.id, commentId), eq(documentComments.userId, userId)));
  const [updated] = await db.select().from(documentComments)
    .where(and(eq(documentComments.id, commentId), eq(documentComments.userId, userId))).limit(1);
  return updated || null;
}

export async function deleteComment(userId: string, commentId: string) {
  await db.delete(documentComments)
    .where(and(eq(documentComments.id, commentId), eq(documentComments.userId, userId)));
}

export async function resolveComment(userId: string, commentId: string) {
  return updateComment(userId, commentId, { isResolved: true });
}

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
