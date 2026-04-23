import { db } from '../../../config/database';
import { documents } from '../../../db/schema';
import { eq, and, isNull, asc, sql, or } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import type {
  CreateDocumentInput,
  UpdateDocumentInput,
  MoveDocumentInput,
  DocumentTreeNode,
} from '@atlas-platform/shared';
import { syncDocumentLinks } from './link.service';

// ─── List all documents (flat) for building the tree ─────────────────

export async function listDocuments(userId: string, includeArchived = false, tenantId?: string | null) {
  const ownerCondition = tenantId
    ? or(eq(documents.userId, userId), and(eq(documents.visibility, 'team'), eq(documents.tenantId, tenantId)))
    : eq(documents.userId, userId);
  const conditions = [ownerCondition!];

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
      visibility: documents.visibility,
      userId: documents.userId,
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

export async function seedSampleDocuments(userId: string, tenantId: string) {
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
    tenantId, userId, title: 'Getting started', icon: '🚀', sortOrder: 0, createdAt: now, updatedAt: now,
    coverImage: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1200&h=300&fit=crop',
    content: c([
      '<h1>Getting started</h1>',
      '<p>Welcome to your workspace. This is a flexible home for notes, docs, and ideas. Everything you create here is auto-saved and organized in the sidebar.</p>',
      '<hr>',
      '<p>Use the <strong>+ New page</strong> button in the sidebar to create your first page, or type <code>/</code> on an empty line to explore the slash command menu.</p>',
      '<div data-type="callout" data-callout-type="info"><p><strong>Tip:</strong> Pages can be nested as deep as you like. Hover over any page in the sidebar and click <strong>+</strong> to add a sub-page.</p></div>',
    ].join('')),
  });

  logger.info({ userId, tenantId }, 'Seeded sample documents');
  return { documents: 1 };
}

// ─── Get a single document with full content ─────────────────────────

export async function getDocument(userId: string, documentId: string, tenantId?: string | null) {
  const ownerCondition = tenantId
    ? or(eq(documents.userId, userId), and(eq(documents.visibility, 'team'), eq(documents.tenantId, tenantId)))
    : eq(documents.userId, userId);
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), ownerCondition!))
    .limit(1);

  return doc || null;
}

// ─── Create a new document ───────────────────────────────────────────

export async function createDocument(userId: string, tenantId: string, input: CreateDocumentInput) {
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
      tenantId,
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

export async function searchDocuments(userId: string, query: string, tenantId?: string | null) {
  const searchTerm = `%${query}%`;
  const ownerCondition = tenantId
    ? or(eq(documents.userId, userId), and(eq(documents.visibility, 'team'), eq(documents.tenantId, tenantId)))
    : eq(documents.userId, userId);
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
        ownerCondition!,
        eq(documents.isArchived, false),
        sql`(${documents.title} LIKE ${searchTerm} OR CAST(${documents.content} AS TEXT) LIKE ${searchTerm})`,
      ),
    )
    .orderBy(asc(documents.updatedAt))
    .limit(20);
}

// ─── Visibility ────────────────────────────────────────────────────

export async function updateDocumentVisibility(userId: string, documentId: string, visibility: 'private' | 'team') {
  await db.update(documents).set({ visibility, updatedAt: new Date() })
    .where(and(eq(documents.id, documentId), eq(documents.userId, userId)));
}
