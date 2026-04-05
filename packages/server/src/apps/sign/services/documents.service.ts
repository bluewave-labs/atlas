import { db } from '../../../config/database';
import { signatureDocuments, signatureFields, signingTokens, signAuditLog, users } from '../../../db/schema';
import { eq, and, asc, desc, sql, inArray } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';

const UPLOADS_DIR = path.join(__dirname, '../../../../uploads');

// ─── Audit Log ──────────────────────────────────────────────────────

export async function logAuditEvent(data: {
  documentId: string;
  action: string;
  actorEmail?: string;
  actorName?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db.insert(signAuditLog).values({
      documentId: data.documentId,
      action: data.action,
      actorEmail: data.actorEmail ?? null,
      actorName: data.actorName ?? null,
      ipAddress: data.ipAddress ?? null,
      userAgent: data.userAgent ?? null,
      metadata: data.metadata ?? {},
    });
  } catch (error) {
    // Audit logging should never block the main flow
    logger.warn({ error, action: data.action, documentId: data.documentId }, 'Failed to log audit event');
  }
}

export async function getAuditLog(documentId: string) {
  return db
    .select()
    .from(signAuditLog)
    .where(eq(signAuditLog.documentId, documentId))
    .orderBy(desc(signAuditLog.createdAt));
}

// ─── Helper: get user name by userId ─────────────────────────────────

export async function getUser(userId: string): Promise<{ name: string; email: string }> {
  const [user] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return { name: user?.name || user?.email || 'Unknown', email: user?.email || '' };
}

export async function getUserName(userId: string): Promise<string> {
  return (await getUser(userId)).name;
}

export async function getUserEmail(userId: string): Promise<string> {
  return (await getUser(userId)).email;
}

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

  // Batch-fetch signer summaries for all documents
  if (docs.length === 0) return docs;

  const docIds = docs.map((d) => d.id);
  const allTokens = await db
    .select({
      documentId: signingTokens.documentId,
      signerEmail: signingTokens.signerEmail,
      signerName: signingTokens.signerName,
      status: signingTokens.status,
    })
    .from(signingTokens)
    .where(inArray(signingTokens.documentId, docIds));

  // Group tokens by document
  const tokensByDoc = new Map<string, typeof allTokens>();
  for (const token of allTokens) {
    const existing = tokensByDoc.get(token.documentId) || [];
    existing.push(token);
    tokensByDoc.set(token.documentId, existing);
  }

  // Enrich documents with signer summary
  return docs.map((doc) => {
    const tokens = tokensByDoc.get(doc.id) || [];
    return {
      ...doc,
      signerCount: tokens.length,
      signedCount: tokens.filter((t) => t.status === 'signed').length,
      signers: tokens.map((t) => ({
        email: t.signerEmail,
        name: t.signerName,
        status: t.status,
      })),
    };
  });
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
    redirectUrl?: string | null;
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
      redirectUrl: data.redirectUrl ?? null,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, documentId: created.id }, 'Signature document created');

  // Audit: document.created
  const creator = await getUser(userId);
  logAuditEvent({
    documentId: created.id,
    action: 'document.created',
    actorEmail: creator.email,
    actorName: creator.name,
    metadata: { title: data.title },
  }).catch(() => {});

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
    redirectUrl?: string | null;
  },
) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (data.title !== undefined) updates.title = data.title;
  if (data.status !== undefined) updates.status = data.status;
  if (data.expiresAt !== undefined) updates.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
  if (data.tags !== undefined) updates.tags = data.tags;
  if (data.pageCount !== undefined) updates.pageCount = data.pageCount;
  if (data.redirectUrl !== undefined) updates.redirectUrl = data.redirectUrl;

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

  // Audit: document.voided
  const voider = await getUser(userId);
  logAuditEvent({
    documentId,
    action: 'document.voided',
    actorEmail: voider.email,
    actorName: voider.name,
  }).catch(() => {});

  return getDocument(userId, documentId);
}

// ─── PDF Flattening (embed signatures into PDF) ────────────────────

export async function generateSignedPDF(documentId: string, storagePath: string): Promise<Buffer> {
  const filePath = path.join(UPLOADS_DIR, storagePath);
  const originalBytes = await readFile(filePath);
  const pdfDoc = await PDFDocument.load(originalBytes);
  const pages = pdfDoc.getPages();

  // Get all signed fields
  const fields = await db
    .select()
    .from(signatureFields)
    .where(eq(signatureFields.documentId, documentId));

  for (const field of fields) {
    if (!field.signatureData) continue;

    const pageIndex = field.pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Convert percentage positions to PDF points
    const x = (field.x / 100) * pageWidth;
    const w = (field.width / 100) * pageWidth;
    const h = (field.height / 100) * pageHeight;
    // PDF coordinate system has origin at bottom-left, so flip y
    const y = pageHeight - (field.y / 100) * pageHeight - h;

    if (field.type === 'checkbox') {
      // For checkboxes, draw a checkmark text
      if (field.signatureData === 'checked') {
        page.drawText('✓', { x: x + w * 0.25, y: y + h * 0.15, size: Math.min(w, h) * 0.7 });
      }
    } else if (field.type === 'date' || field.type === 'text' || field.type === 'dropdown') {
      // For text-based fields, draw the text
      page.drawText(field.signatureData, { x: x + 4, y: y + h * 0.3, size: Math.min(h * 0.5, 14) });
    } else {
      // For signature/initials, embed the image
      try {
        const base64Data = field.signatureData.replace(/^data:image\/\w+;base64,/, '');
        const imageBytes = Buffer.from(base64Data, 'base64');
        const pngImage = await pdfDoc.embedPng(imageBytes);
        page.drawImage(pngImage, { x, y, width: w, height: h });
      } catch (err) {
        logger.warn({ err, fieldId: field.id }, 'Failed to embed signature image — skipping');
      }
    }
  }

  const signedBytes = await pdfDoc.save();
  return Buffer.from(signedBytes);
}

// ─── Widget summary (lightweight) ──────────────────────────────────

export async function getWidgetData(userId: string, accountId: string) {
  const rows = await db
    .select({ status: signatureDocuments.status, count: sql<number>`COUNT(*)`.as('count') })
    .from(signatureDocuments)
    .where(and(
      eq(signatureDocuments.accountId, accountId),
      eq(signatureDocuments.isArchived, false),
    ))
    .groupBy(signatureDocuments.status);

  let pending = 0;
  let signed = 0;
  let draft = 0;
  let total = 0;

  for (const row of rows) {
    const c = Number(row.count);
    total += c;
    if (row.status === 'draft') draft += c;
    else if (row.status === 'completed' || row.status === 'signed') signed += c;
    else if (row.status === 'sent' || row.status === 'pending') pending += c;
  }

  return { pending, signed, draft, total };
}

// ─── Seed sample data (called from setup wizard) ────────────────────

export async function seedSampleData(userId: string, accountId: string) {
  return { skipped: true };
}
