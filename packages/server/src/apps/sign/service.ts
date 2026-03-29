import { db } from '../../config/database';
import { signatureDocuments, signatureFields, signingTokens } from '../../db/schema';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import crypto from 'node:crypto';

// ─── Documents ──────────────────────────────────────────────────────

export async function listDocuments(userId: string, accountId: string) {
  const docs = await db
    .select()
    .from(signatureDocuments)
    .where(
      and(
        eq(signatureDocuments.userId, userId),
        eq(signatureDocuments.accountId, accountId),
        eq(signatureDocuments.isArchived, false),
      ),
    )
    .orderBy(desc(signatureDocuments.updatedAt));
  return docs;
}

export async function getDocument(userId: string, documentId: string) {
  const [doc] = await db
    .select()
    .from(signatureDocuments)
    .where(
      and(
        eq(signatureDocuments.id, documentId),
        eq(signatureDocuments.userId, userId),
      ),
    )
    .limit(1);
  return doc || null;
}

export async function createDocument(
  userId: string,
  accountId: string,
  data: {
    title: string;
    fileName: string;
    storagePath: string;
    pageCount?: number;
    status?: string;
    expiresAt?: string | null;
    tags?: string[];
  },
) {
  const now = new Date();

  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${signatureDocuments.sortOrder}), -1)` })
    .from(signatureDocuments)
    .where(eq(signatureDocuments.userId, userId));
  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(signatureDocuments)
    .values({
      accountId,
      userId,
      title: data.title,
      fileName: data.fileName,
      storagePath: data.storagePath,
      pageCount: data.pageCount ?? 1,
      status: data.status ?? 'draft',
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      tags: data.tags ?? [],
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, documentId: created.id }, 'Signature document created');
  return created;
}

export async function updateDocument(
  userId: string,
  documentId: string,
  data: {
    title?: string;
    status?: string;
    expiresAt?: string | null;
    tags?: string[];
    pageCount?: number;
  },
) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (data.title !== undefined) updates.title = data.title;
  if (data.status !== undefined) updates.status = data.status;
  if (data.expiresAt !== undefined) updates.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
  if (data.tags !== undefined) updates.tags = data.tags;
  if (data.pageCount !== undefined) updates.pageCount = data.pageCount;

  await db
    .update(signatureDocuments)
    .set(updates)
    .where(
      and(
        eq(signatureDocuments.id, documentId),
        eq(signatureDocuments.userId, userId),
      ),
    );

  return getDocument(userId, documentId);
}

export async function deleteDocument(userId: string, documentId: string) {
  const now = new Date();
  await db
    .update(signatureDocuments)
    .set({ isArchived: true, updatedAt: now })
    .where(
      and(
        eq(signatureDocuments.id, documentId),
        eq(signatureDocuments.userId, userId),
      ),
    );
  logger.info({ userId, documentId }, 'Signature document archived');
}

// ─── Fields ─────────────────────────────────────────────────────────

export async function listFields(documentId: string) {
  return db
    .select()
    .from(signatureFields)
    .where(eq(signatureFields.documentId, documentId))
    .orderBy(asc(signatureFields.sortOrder), asc(signatureFields.createdAt));
}

export async function createField(data: {
  documentId: string;
  type?: string;
  pageNumber?: number;
  x: number;
  y: number;
  width: number;
  height: number;
  signerEmail?: string;
  label?: string;
  required?: boolean;
  sortOrder?: number;
}) {
  const now = new Date();

  const [created] = await db
    .insert(signatureFields)
    .values({
      documentId: data.documentId,
      type: data.type ?? 'signature',
      pageNumber: data.pageNumber ?? 1,
      x: data.x,
      y: data.y,
      width: data.width,
      height: data.height,
      signerEmail: data.signerEmail ?? null,
      label: data.label ?? null,
      required: data.required ?? true,
      sortOrder: data.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ fieldId: created.id, documentId: data.documentId }, 'Signature field created');
  return created;
}

export async function updateField(
  fieldId: string,
  data: {
    type?: string;
    pageNumber?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    signerEmail?: string | null;
    label?: string | null;
    required?: boolean;
    sortOrder?: number;
    signatureData?: string | null;
    signedAt?: Date | null;
  },
) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (data.type !== undefined) updates.type = data.type;
  if (data.pageNumber !== undefined) updates.pageNumber = data.pageNumber;
  if (data.x !== undefined) updates.x = data.x;
  if (data.y !== undefined) updates.y = data.y;
  if (data.width !== undefined) updates.width = data.width;
  if (data.height !== undefined) updates.height = data.height;
  if (data.signerEmail !== undefined) updates.signerEmail = data.signerEmail;
  if (data.label !== undefined) updates.label = data.label;
  if (data.required !== undefined) updates.required = data.required;
  if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;
  if (data.signatureData !== undefined) updates.signatureData = data.signatureData;
  if (data.signedAt !== undefined) updates.signedAt = data.signedAt;

  await db
    .update(signatureFields)
    .set(updates)
    .where(eq(signatureFields.id, fieldId));

  const [updated] = await db
    .select()
    .from(signatureFields)
    .where(eq(signatureFields.id, fieldId))
    .limit(1);

  return updated || null;
}

export async function deleteField(fieldId: string) {
  await db.delete(signatureFields).where(eq(signatureFields.id, fieldId));
  logger.info({ fieldId }, 'Signature field deleted');
}

// ─── Signing Tokens ─────────────────────────────────────────────────

export async function createSigningToken(
  documentId: string,
  email: string,
  name: string | null,
  expiresInDays = 30,
) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000);
  const token = crypto.randomUUID();

  const [created] = await db
    .insert(signingTokens)
    .values({
      documentId,
      signerEmail: email,
      signerName: name,
      token,
      status: 'pending',
      expiresAt,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ tokenId: created.id, documentId, email }, 'Signing token created');
  return created;
}

export async function getSigningToken(token: string) {
  const [row] = await db
    .select()
    .from(signingTokens)
    .where(eq(signingTokens.token, token))
    .limit(1);

  if (!row) return null;

  // Join with document
  const [doc] = await db
    .select()
    .from(signatureDocuments)
    .where(eq(signatureDocuments.id, row.documentId))
    .limit(1);

  return { token: row, document: doc || null };
}

export async function listSigningTokens(documentId: string) {
  return db
    .select()
    .from(signingTokens)
    .where(eq(signingTokens.documentId, documentId))
    .orderBy(desc(signingTokens.createdAt));
}

// ─── Signing Operations ─────────────────────────────────────────────

export async function signField(fieldId: string, signatureData: string) {
  const now = new Date();
  return updateField(fieldId, {
    signatureData,
    signedAt: now,
  });
}

export async function completeSigningToken(tokenId: string) {
  const now = new Date();
  await db
    .update(signingTokens)
    .set({ status: 'signed', signedAt: now, updatedAt: now })
    .where(eq(signingTokens.id, tokenId));
  logger.info({ tokenId }, 'Signing token marked as signed');
}

export async function declineSigningToken(tokenId: string, reason: string | null) {
  const now = new Date();
  await db
    .update(signingTokens)
    .set({ status: 'declined', declineReason: reason, updatedAt: now })
    .where(eq(signingTokens.id, tokenId));
  logger.info({ tokenId, reason }, 'Signing token declined');
}

export async function voidDocument(userId: string, documentId: string) {
  const now = new Date();

  // Mark document as voided
  await db
    .update(signatureDocuments)
    .set({ status: 'voided', updatedAt: now })
    .where(
      and(
        eq(signatureDocuments.id, documentId),
        eq(signatureDocuments.userId, userId),
      ),
    );

  // Expire all pending signing tokens
  await db
    .update(signingTokens)
    .set({ status: 'expired', updatedAt: now })
    .where(
      and(
        eq(signingTokens.documentId, documentId),
        eq(signingTokens.status, 'pending'),
      ),
    );

  logger.info({ userId, documentId }, 'Signature document voided');
  return getDocument(userId, documentId);
}

export async function checkDocumentComplete(documentId: string) {
  // Get all required fields for this document
  const fields = await db
    .select()
    .from(signatureFields)
    .where(
      and(
        eq(signatureFields.documentId, documentId),
        eq(signatureFields.required, true),
      ),
    );

  // Check if all required fields are signed
  const allSigned = fields.length > 0 && fields.every((f) => f.signedAt !== null);

  if (allSigned) {
    const now = new Date();
    await db
      .update(signatureDocuments)
      .set({ status: 'signed', completedAt: now, updatedAt: now })
      .where(eq(signatureDocuments.id, documentId));
    logger.info({ documentId }, 'Signature document marked as completed');
    return true;
  }

  return false;
}
