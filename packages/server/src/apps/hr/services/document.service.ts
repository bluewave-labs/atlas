import { db } from '../../../config/database';
import { employeeDocuments } from '../../../db/schema';
import { eq, and, desc } from 'drizzle-orm';

// ─── Employee Documents ────────────────────────────────────────────

export async function listEmployeeDocuments(tenantId: string, employeeId: string) {
  return db
    .select()
    .from(employeeDocuments)
    .where(and(
      eq(employeeDocuments.tenantId, tenantId),
      eq(employeeDocuments.employeeId, employeeId),
      eq(employeeDocuments.isArchived, false),
    ))
    .orderBy(desc(employeeDocuments.createdAt));
}

export async function createEmployeeDocument(tenantId: string, input: {
  employeeId: string;
  name: string;
  type: string;
  storagePath: string;
  mimeType?: string | null;
  size?: number | null;
  expiresAt?: string | null;
  notes?: string | null;
  uploadedBy: string;
}) {
  const now = new Date();
  const [created] = await db
    .insert(employeeDocuments)
    .values({
      tenantId,
      employeeId: input.employeeId,
      name: input.name,
      type: input.type || 'other',
      storagePath: input.storagePath,
      mimeType: input.mimeType ?? null,
      size: input.size ?? null,
      expiresAt: input.expiresAt ?? null,
      notes: input.notes ?? null,
      uploadedBy: input.uploadedBy,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

export async function deleteEmployeeDocument(tenantId: string, docId: string) {
  const now = new Date();
  const [updated] = await db
    .update(employeeDocuments)
    .set({ isArchived: true, updatedAt: now })
    .where(and(eq(employeeDocuments.id, docId), eq(employeeDocuments.tenantId, tenantId)))
    .returning();

  return updated || null;
}

export async function getEmployeeDocument(tenantId: string, docId: string) {
  const [doc] = await db
    .select()
    .from(employeeDocuments)
    .where(and(eq(employeeDocuments.id, docId), eq(employeeDocuments.tenantId, tenantId)))
    .limit(1);

  return doc || null;
}
