import { db } from '../../config/database';
import { spreadsheets } from '../../db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import type { CreateSpreadsheetInput, UpdateSpreadsheetInput } from '@atlasmail/shared';

// ─── List all spreadsheets (flat list) ───────────────────────────────

export async function listSpreadsheets(userId: string, includeArchived = false) {
  const conditions = [eq(spreadsheets.userId, userId)];

  if (!includeArchived) {
    conditions.push(eq(spreadsheets.isArchived, false));
  }

  return db
    .select({
      id: spreadsheets.id,
      accountId: spreadsheets.accountId,
      userId: spreadsheets.userId,
      title: spreadsheets.title,
      columns: spreadsheets.columns,
      viewConfig: spreadsheets.viewConfig,
      sortOrder: spreadsheets.sortOrder,
      isArchived: spreadsheets.isArchived,
      color: spreadsheets.color,
      icon: spreadsheets.icon,
      createdAt: spreadsheets.createdAt,
      updatedAt: spreadsheets.updatedAt,
    })
    .from(spreadsheets)
    .where(and(...conditions))
    .orderBy(asc(spreadsheets.sortOrder), asc(spreadsheets.createdAt));
}

// ─── Get a single spreadsheet with full data ──────────────────────────

export async function getSpreadsheet(userId: string, spreadsheetId: string) {
  const [spreadsheet] = await db
    .select()
    .from(spreadsheets)
    .where(and(eq(spreadsheets.id, spreadsheetId), eq(spreadsheets.userId, userId)))
    .limit(1);

  return spreadsheet || null;
}

// ─── Seed sample spreadsheets on first visit ─────────────────────────

export async function seedSampleSpreadsheets(userId: string, accountId: string) {
  const existing = await db
    .select({ id: spreadsheets.id })
    .from(spreadsheets)
    .where(eq(spreadsheets.userId, userId))
    .limit(1);

  if (existing.length > 0) return { skipped: true }; // User already has tables

  const now = new Date();
  const ts = now.toISOString();

  const bugCols = [
    { id: 'col_title', name: 'Title', type: 'text' as const, width: 280 },
    { id: 'col_priority', name: 'Priority', type: 'singleSelect' as const, width: 120, options: ['Critical', 'High', 'Medium', 'Low'] },
    { id: 'col_status', name: 'Status', type: 'singleSelect' as const, width: 130, options: ['Open', 'In Progress', 'Fixed', 'Closed'] },
    { id: 'col_assigned', name: 'Assigned To', type: 'text' as const, width: 160 },
  ];

  const bugRows = [
    { _id: 'bug_1', _createdAt: ts, col_title: 'Login page crashes on Safari 17', col_priority: 'Critical', col_status: 'In Progress', col_assigned: 'Alice Chen' },
    { _id: 'bug_2', _createdAt: ts, col_title: 'Dark mode flicker on page load', col_priority: 'High', col_status: 'Open', col_assigned: 'Eva Schmidt' },
    { _id: 'bug_3', _createdAt: ts, col_title: 'CSV export missing last column', col_priority: 'Medium', col_status: 'Fixed', col_assigned: 'Alice Chen' },
  ];

  await db.insert(spreadsheets).values({
    accountId, userId, title: 'Bug tracker', columns: bugCols, rows: bugRows,
    viewConfig: { activeView: 'grid' }, sortOrder: 0, createdAt: now, updatedAt: now,
  });

  logger.info({ userId }, 'Seeded sample spreadsheets');
  return { spreadsheets: 1 };
}

// ─── Create a new spreadsheet ────────────────────────────────────────

export async function createSpreadsheet(userId: string, accountId: string, input: CreateSpreadsheetInput) {
  const now = new Date();

  const [created] = await db
    .insert(spreadsheets)
    .values({
      accountId,
      userId,
      title: input.title || 'Untitled table',
      columns: input.columns ?? [],
      rows: input.rows ?? [],
      viewConfig: input.viewConfig ?? { activeView: 'grid' as const },
      sortOrder: sql`COALESCE((SELECT MAX(${spreadsheets.sortOrder}) FROM spreadsheets WHERE ${spreadsheets.userId} = ${userId}), -1) + 1`,
      color: input.color ?? null,
      icon: input.icon ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, spreadsheetId: created.id }, 'Spreadsheet created');
  return created;
}

// ─── Update a spreadsheet ────────────────────────────────────────────

export async function updateSpreadsheet(
  userId: string,
  spreadsheetId: string,
  input: UpdateSpreadsheetInput,
) {
  const now = new Date();

  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.title !== undefined) updates.title = input.title;
  if (input.columns !== undefined) updates.columns = input.columns;
  if (input.rows !== undefined) updates.rows = input.rows;
  if (input.viewConfig !== undefined) updates.viewConfig = input.viewConfig;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;
  if (input.color !== undefined) updates.color = input.color;
  if (input.icon !== undefined) updates.icon = input.icon;
  if (input.guide !== undefined) updates.guide = input.guide;

  const [updated] = await db
    .update(spreadsheets)
    .set(updates)
    .where(and(eq(spreadsheets.id, spreadsheetId), eq(spreadsheets.userId, userId)))
    .returning();

  return updated || null;
}

// ─── Delete (soft delete) a spreadsheet ──────────────────────────────

export async function deleteSpreadsheet(userId: string, spreadsheetId: string) {
  return updateSpreadsheet(userId, spreadsheetId, { isArchived: true });
}

// ─── Restore an archived spreadsheet ─────────────────────────────────

export async function restoreSpreadsheet(userId: string, spreadsheetId: string) {
  const now = new Date();

  const [restored] = await db
    .update(spreadsheets)
    .set({ isArchived: false, updatedAt: now })
    .where(and(eq(spreadsheets.id, spreadsheetId), eq(spreadsheets.userId, userId)))
    .returning();

  return restored || null;
}

// ─── Search spreadsheets by title ────────────────────────────────────

export async function searchSpreadsheets(userId: string, query: string) {
  const searchTerm = `%${query}%`;
  return db
    .select({
      id: spreadsheets.id,
      accountId: spreadsheets.accountId,
      userId: spreadsheets.userId,
      title: spreadsheets.title,
      columns: spreadsheets.columns,
      viewConfig: spreadsheets.viewConfig,
      sortOrder: spreadsheets.sortOrder,
      isArchived: spreadsheets.isArchived,
      color: spreadsheets.color,
      icon: spreadsheets.icon,
      createdAt: spreadsheets.createdAt,
      updatedAt: spreadsheets.updatedAt,
    })
    .from(spreadsheets)
    .where(
      and(
        eq(spreadsheets.userId, userId),
        eq(spreadsheets.isArchived, false),
        sql`${spreadsheets.title} LIKE ${searchTerm}`,
      ),
    )
    .orderBy(asc(spreadsheets.updatedAt))
    .limit(20);
}
