import { db } from '../../../config/database';
import { crmNotes } from '../../../db/schema';
import { eq, and, asc, desc } from 'drizzle-orm';
import { logger } from '../../../utils/logger';

// ─── Input types ────────────────────────────────────────────────────

interface CreateNoteInput {
  title?: string;
  content: Record<string, unknown>;
  dealId?: string | null;
  contactId?: string | null;
  companyId?: string | null;
}

interface UpdateNoteInput {
  title?: string;
  content?: Record<string, unknown>;
  isPinned?: boolean;
  isArchived?: boolean;
}

// ─── Notes (rich text) ─────────────────────────────────────────────

export async function listNotes(userId: string, tenantId: string, filters?: {
  dealId?: string;
  contactId?: string;
  companyId?: string;
}) {
  const conditions = [eq(crmNotes.tenantId, tenantId), eq(crmNotes.isArchived, false)];

  if (filters?.dealId) conditions.push(eq(crmNotes.dealId, filters.dealId));
  if (filters?.contactId) conditions.push(eq(crmNotes.contactId, filters.contactId));
  if (filters?.companyId) conditions.push(eq(crmNotes.companyId, filters.companyId));

  return db.select().from(crmNotes)
    .where(and(...conditions))
    .orderBy(desc(crmNotes.isPinned), desc(crmNotes.createdAt));
}

export async function createNote(userId: string, tenantId: string, input: CreateNoteInput) {
  const now = new Date();
  const [created] = await db.insert(crmNotes).values({
    tenantId,
    userId,
    title: input.title ?? '',
    content: input.content,
    dealId: input.dealId ?? null,
    contactId: input.contactId ?? null,
    companyId: input.companyId ?? null,
    createdAt: now,
    updatedAt: now,
  }).returning();

  logger.info({ userId, noteId: created.id }, 'CRM note created');
  return created;
}

export async function updateNote(userId: string, noteId: string, input: UpdateNoteInput) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.title !== undefined) updates.title = input.title;
  if (input.content !== undefined) updates.content = input.content;
  if (input.isPinned !== undefined) updates.isPinned = input.isPinned;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  await db.update(crmNotes).set(updates)
    .where(and(eq(crmNotes.id, noteId), eq(crmNotes.userId, userId)));

  const [updated] = await db.select().from(crmNotes)
    .where(and(eq(crmNotes.id, noteId), eq(crmNotes.userId, userId)))
    .limit(1);

  return updated || null;
}

export async function deleteNote(userId: string, noteId: string) {
  await db.update(crmNotes).set({ isArchived: true, updatedAt: new Date() })
    .where(and(eq(crmNotes.id, noteId), eq(crmNotes.userId, userId)));
}
