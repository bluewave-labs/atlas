import { db } from '../../config/database';
import { drawings } from '../../db/schema';
import { eq, and, asc, sql, or } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import type { CreateDrawingInput, UpdateDrawingInput } from '@atlas-platform/shared';

// ─── List all drawings (flat list) ───────────────────────────────────

export async function listDrawings(userId: string, includeArchived = false, tenantId?: string | null) {
  const ownerCondition = tenantId
    ? or(eq(drawings.userId, userId), and(eq(drawings.visibility, 'team'), eq(drawings.tenantId, tenantId)))
    : eq(drawings.userId, userId);
  const conditions = [ownerCondition!];

  if (!includeArchived) {
    conditions.push(eq(drawings.isArchived, false));
  }

  return db
    .select({
      id: drawings.id,
      tenantId: drawings.tenantId,
      userId: drawings.userId,
      title: drawings.title,
      thumbnailUrl: drawings.thumbnailUrl,
      sortOrder: drawings.sortOrder,
      isArchived: drawings.isArchived,
      visibility: drawings.visibility,
      createdAt: drawings.createdAt,
      updatedAt: drawings.updatedAt,
    })
    .from(drawings)
    .where(and(...conditions))
    .orderBy(asc(drawings.sortOrder), asc(drawings.createdAt));
}

// ─── Get a single drawing with full content ──────────────────────────

export async function getDrawing(userId: string, drawingId: string, tenantId?: string | null) {
  const ownerCondition = tenantId
    ? or(eq(drawings.userId, userId), and(eq(drawings.visibility, 'team'), eq(drawings.tenantId, tenantId)))
    : eq(drawings.userId, userId);
  const [drawing] = await db
    .select()
    .from(drawings)
    .where(and(eq(drawings.id, drawingId), ownerCondition!))
    .limit(1);

  return drawing || null;
}

// ─── Seed sample drawings on first visit ─────────────────────────────

export async function seedSampleDrawings(userId: string, tenantId: string) {
  const existing = await db
    .select({ id: drawings.id })
    .from(drawings)
    .where(eq(drawings.userId, userId))
    .limit(1);

  if (existing.length > 0) return { skipped: true }; // User already has drawings

  const now = new Date();

  const baseProps = {
    strokeColor: '#1e1e1e',
    fillStyle: 'solid' as const,
    strokeWidth: 2,
    roughness: 1,
    opacity: 100,
    angle: 0,
    isDeleted: false,
    boundElements: null,
    link: null,
    locked: false,
    groupIds: [] as string[],
  };

  // ── Drawing 1: Product roadmap (3 boxes + 2 arrows) ──────────────
  const roadmapElements = [
    // Phase 1 box
    { ...baseProps, type: 'rectangle', id: 'road-r1', seed: 1001, version: 1, x: 80, y: 100, width: 200, height: 70, backgroundColor: '#a5d8ff', roundness: { type: 3 } },
    { ...baseProps, type: 'text', id: 'road-t1', seed: 1002, version: 1, x: 110, y: 120, width: 140, height: 30, text: 'Phase 1: MVP', fontSize: 20, fontFamily: 1, textAlign: 'center', verticalAlign: 'middle', backgroundColor: 'transparent', roundness: null },
    // Phase 2 box
    { ...baseProps, type: 'rectangle', id: 'road-r2', seed: 1003, version: 1, x: 380, y: 100, width: 200, height: 70, backgroundColor: '#b2f2bb', roundness: { type: 3 } },
    { ...baseProps, type: 'text', id: 'road-t2', seed: 1004, version: 1, x: 400, y: 120, width: 160, height: 30, text: 'Phase 2: Growth', fontSize: 20, fontFamily: 1, textAlign: 'center', verticalAlign: 'middle', backgroundColor: 'transparent', roundness: null },
    // Phase 3 box
    { ...baseProps, type: 'rectangle', id: 'road-r3', seed: 1005, version: 1, x: 680, y: 100, width: 200, height: 70, backgroundColor: '#d0bfff', roundness: { type: 3 } },
    { ...baseProps, type: 'text', id: 'road-t3', seed: 1006, version: 1, x: 710, y: 120, width: 140, height: 30, text: 'Phase 3: Scale', fontSize: 20, fontFamily: 1, textAlign: 'center', verticalAlign: 'middle', backgroundColor: 'transparent', roundness: null },
    // Arrow 1→2
    { ...baseProps, type: 'arrow', id: 'road-a1', seed: 1007, version: 1, x: 280, y: 135, width: 100, height: 0, points: [[0, 0], [100, 0]], backgroundColor: 'transparent', roundness: { type: 2 }, startBinding: null, endBinding: null },
    // Arrow 2→3
    { ...baseProps, type: 'arrow', id: 'road-a2', seed: 1008, version: 1, x: 580, y: 135, width: 100, height: 0, points: [[0, 0], [100, 0]], backgroundColor: 'transparent', roundness: { type: 2 }, startBinding: null, endBinding: null },
  ];

  // ── Drawing 2: Team structure (org chart) ─────────────────────────
  const teamElements = [
    // CEO box (top center)
    { ...baseProps, type: 'rectangle', id: 'team-r1', seed: 2001, version: 1, x: 300, y: 60, width: 160, height: 60, backgroundColor: '#ffd8a8', roundness: { type: 3 } },
    { ...baseProps, type: 'text', id: 'team-t1', seed: 2002, version: 1, x: 350, y: 75, width: 60, height: 30, text: 'CEO', fontSize: 22, fontFamily: 1, textAlign: 'center', verticalAlign: 'middle', backgroundColor: 'transparent', roundness: null },
    // Engineering box (bottom left)
    { ...baseProps, type: 'rectangle', id: 'team-r2', seed: 2003, version: 1, x: 160, y: 200, width: 180, height: 60, backgroundColor: '#a5d8ff', roundness: { type: 3 } },
    { ...baseProps, type: 'text', id: 'team-t2', seed: 2004, version: 1, x: 190, y: 215, width: 120, height: 30, text: 'Engineering', fontSize: 20, fontFamily: 1, textAlign: 'center', verticalAlign: 'middle', backgroundColor: 'transparent', roundness: null },
    // Design box (bottom right)
    { ...baseProps, type: 'rectangle', id: 'team-r3', seed: 2005, version: 1, x: 420, y: 200, width: 180, height: 60, backgroundColor: '#d0bfff', roundness: { type: 3 } },
    { ...baseProps, type: 'text', id: 'team-t3', seed: 2006, version: 1, x: 465, y: 215, width: 90, height: 30, text: 'Design', fontSize: 20, fontFamily: 1, textAlign: 'center', verticalAlign: 'middle', backgroundColor: 'transparent', roundness: null },
    // Line CEO → Engineering
    { ...baseProps, type: 'arrow', id: 'team-a1', seed: 2007, version: 1, x: 380, y: 120, width: -130, height: 80, points: [[0, 0], [-130, 80]], backgroundColor: 'transparent', roundness: { type: 2 }, startBinding: null, endBinding: null },
    // Line CEO → Design
    { ...baseProps, type: 'arrow', id: 'team-a2', seed: 2008, version: 1, x: 380, y: 120, width: 130, height: 80, points: [[0, 0], [130, 80]], backgroundColor: 'transparent', roundness: { type: 2 }, startBinding: null, endBinding: null },
  ];

  // ── Drawing 3: Brainstorm (mind map) ──────────────────────────────
  const brainstormElements = [
    // Center "Ideas" text with ellipse
    { ...baseProps, type: 'ellipse', id: 'brain-e1', seed: 3001, version: 1, x: 320, y: 180, width: 140, height: 80, backgroundColor: '#ffec99', roundness: { type: 2 } },
    { ...baseProps, type: 'text', id: 'brain-t0', seed: 3002, version: 1, x: 358, y: 205, width: 64, height: 30, text: 'Ideas', fontSize: 24, fontFamily: 1, textAlign: 'center', verticalAlign: 'middle', backgroundColor: 'transparent', roundness: null },
    // Branch 1: top-left
    { ...baseProps, type: 'text', id: 'brain-t1', seed: 3003, version: 1, x: 140, y: 70, width: 130, height: 26, text: 'New markets', fontSize: 20, fontFamily: 1, textAlign: 'center', verticalAlign: 'middle', backgroundColor: 'transparent', roundness: null },
    { ...baseProps, type: 'arrow', id: 'brain-a1', seed: 3004, version: 1, x: 330, y: 190, width: -120, height: -100, points: [[0, 0], [-120, -100]], backgroundColor: 'transparent', roundness: { type: 2 }, startBinding: null, endBinding: null },
    // Branch 2: top-right
    { ...baseProps, type: 'text', id: 'brain-t2', seed: 3005, version: 1, x: 530, y: 70, width: 130, height: 26, text: 'Automation', fontSize: 20, fontFamily: 1, textAlign: 'center', verticalAlign: 'middle', backgroundColor: 'transparent', roundness: null },
    { ...baseProps, type: 'arrow', id: 'brain-a2', seed: 3006, version: 1, x: 450, y: 190, width: 120, height: -100, points: [[0, 0], [120, -100]], backgroundColor: 'transparent', roundness: { type: 2 }, startBinding: null, endBinding: null },
    // Branch 3: bottom-left
    { ...baseProps, type: 'text', id: 'brain-t3', seed: 3007, version: 1, x: 120, y: 340, width: 160, height: 26, text: 'User feedback', fontSize: 20, fontFamily: 1, textAlign: 'center', verticalAlign: 'middle', backgroundColor: 'transparent', roundness: null },
    { ...baseProps, type: 'arrow', id: 'brain-a3', seed: 3008, version: 1, x: 340, y: 255, width: -120, height: 90, points: [[0, 0], [-120, 90]], backgroundColor: 'transparent', roundness: { type: 2 }, startBinding: null, endBinding: null },
    // Branch 4: bottom-right
    { ...baseProps, type: 'text', id: 'brain-t4', seed: 3009, version: 1, x: 530, y: 340, width: 140, height: 26, text: 'Partnerships', fontSize: 20, fontFamily: 1, textAlign: 'center', verticalAlign: 'middle', backgroundColor: 'transparent', roundness: null },
    { ...baseProps, type: 'arrow', id: 'brain-a4', seed: 3010, version: 1, x: 440, y: 255, width: 130, height: 90, points: [[0, 0], [130, 90]], backgroundColor: 'transparent', roundness: { type: 2 }, startBinding: null, endBinding: null },
  ];

  await db.insert(drawings).values({
    tenantId,
    userId,
    title: 'Product roadmap',
    content: { elements: roadmapElements, appState: { viewBackgroundColor: '#ffffff' } },
    sortOrder: 0,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(drawings).values({
    tenantId,
    userId,
    title: 'Team structure',
    content: { elements: teamElements, appState: { viewBackgroundColor: '#ffffff' } },
    sortOrder: 1,
    createdAt: now,
    updatedAt: now,
  });

  await db.insert(drawings).values({
    tenantId,
    userId,
    title: 'Brainstorm',
    content: { elements: brainstormElements, appState: { viewBackgroundColor: '#ffffff' } },
    sortOrder: 2,
    createdAt: now,
    updatedAt: now,
  });

  logger.info({ userId }, 'Seeded sample drawings');
  return { drawings: 3 };
}

// ─── Create a new drawing ────────────────────────────────────────────

export async function createDrawing(userId: string, tenantId: string, input: CreateDrawingInput) {
  const now = new Date();

  // Determine the next sort order
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${drawings.sortOrder}), -1)` })
    .from(drawings)
    .where(eq(drawings.userId, userId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(drawings)
    .values({
      tenantId,
      userId,
      title: input.title || 'Untitled drawing',
      content: input.content ?? null,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, drawingId: created.id }, 'Drawing created');
  return created;
}

// ─── Update a drawing ────────────────────────────────────────────────

export async function updateDrawing(
  userId: string,
  drawingId: string,
  input: UpdateDrawingInput,
) {
  const now = new Date();

  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.title !== undefined) updates.title = input.title;
  if (input.content !== undefined) updates.content = input.content;
  if (input.thumbnailUrl !== undefined) updates.thumbnailUrl = input.thumbnailUrl;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  await db
    .update(drawings)
    .set(updates)
    .where(and(eq(drawings.id, drawingId), eq(drawings.userId, userId)));

  const [updated] = await db
    .select()
    .from(drawings)
    .where(and(eq(drawings.id, drawingId), eq(drawings.userId, userId)))
    .limit(1);

  return updated || null;
}

// ─── Delete (soft delete) a drawing ──────────────────────────────────

export async function deleteDrawing(userId: string, drawingId: string) {
  await updateDrawing(userId, drawingId, { isArchived: true });
}

// ─── Restore an archived drawing ─────────────────────────────────────

export async function restoreDrawing(userId: string, drawingId: string) {
  const now = new Date();

  await db
    .update(drawings)
    .set({ isArchived: false, updatedAt: now })
    .where(and(eq(drawings.id, drawingId), eq(drawings.userId, userId)));

  const [restored] = await db
    .select()
    .from(drawings)
    .where(and(eq(drawings.id, drawingId), eq(drawings.userId, userId)))
    .limit(1);

  return restored || null;
}

// ─── Search drawings by title ────────────────────────────────────────

export async function searchDrawings(userId: string, query: string) {
  const searchTerm = `%${query}%`;
  return db
    .select({
      id: drawings.id,
      tenantId: drawings.tenantId,
      userId: drawings.userId,
      title: drawings.title,
      thumbnailUrl: drawings.thumbnailUrl,
      sortOrder: drawings.sortOrder,
      isArchived: drawings.isArchived,
      createdAt: drawings.createdAt,
      updatedAt: drawings.updatedAt,
    })
    .from(drawings)
    .where(
      and(
        eq(drawings.userId, userId),
        eq(drawings.isArchived, false),
        sql`${drawings.title} LIKE ${searchTerm}`,
      ),
    )
    .orderBy(asc(drawings.updatedAt))
    .limit(20);
}

// ─── Auto-purge archived drawings older than 30 days ─────────────────

const PURGE_DAYS = 30;

export async function purgeOldArchivedDrawings() {
  const cutoff = new Date(Date.now() - PURGE_DAYS * 24 * 60 * 60 * 1000);

  const deleted = await db
    .delete(drawings)
    .where(
      and(
        eq(drawings.isArchived, true),
        sql`${drawings.updatedAt} < ${cutoff}`,
      ),
    )
    .returning({ id: drawings.id });

  if (deleted.length > 0) {
    logger.info({ count: deleted.length }, 'Auto-purged archived drawings older than 30 days');
  }

  return deleted.length;
}

// ─── Visibility ────────────────────────────────────────────────────

export async function updateDrawingVisibility(userId: string, drawingId: string, visibility: 'private' | 'team') {
  if (visibility === 'team') {
    const [drawing] = await db.select({ tenantId: drawings.tenantId })
      .from(drawings)
      .where(and(eq(drawings.id, drawingId), eq(drawings.userId, userId)))
      .limit(1);
    if (!drawing?.tenantId) throw new Error('Tenant required for team visibility');
  }
  await db.update(drawings).set({ visibility, updatedAt: new Date() })
    .where(and(eq(drawings.id, drawingId), eq(drawings.userId, userId)));
}
