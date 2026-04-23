import { db } from '../../../config/database';
import { signatureDocuments, signatureFields, signingTokens, signAuditLog, users } from '../../../db/schema';
import { eq, and, asc, desc, sql, inArray } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

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

export async function listDocuments(tenantId: string, userIdFilter?: string) {
  const docs = await db
    .select()
    .from(signatureDocuments)
    .where(
      and(
        eq(signatureDocuments.tenantId, tenantId),
        eq(signatureDocuments.isArchived, false),
        ...(userIdFilter ? [eq(signatureDocuments.userId, userIdFilter)] : []),
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

export async function getDocument(tenantId: string, documentId: string, userIdFilter?: string) {
  const [doc] = await db
    .select()
    .from(signatureDocuments)
    .where(
      and(
        eq(signatureDocuments.id, documentId),
        eq(signatureDocuments.tenantId, tenantId),
        ...(userIdFilter ? [eq(signatureDocuments.userId, userIdFilter)] : []),
      ),
    )
    .limit(1);
  return doc || null;
}

export async function createDocument(
  userId: string,
  tenantId: string,
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
      tenantId,
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
  tenantId: string,
  documentId: string,
  data: {
    title?: string;
    status?: string;
    expiresAt?: string | null;
    tags?: string[];
    pageCount?: number;
    redirectUrl?: string | null;
    documentType?: string;
    counterpartyName?: string | null;
  },
  userIdFilter?: string,
) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (data.title !== undefined) updates.title = data.title;
  if (data.status !== undefined) updates.status = data.status;
  if (data.expiresAt !== undefined) updates.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
  if (data.tags !== undefined) updates.tags = data.tags;
  if (data.pageCount !== undefined) updates.pageCount = data.pageCount;
  if (data.redirectUrl !== undefined) updates.redirectUrl = data.redirectUrl;
  if (data.documentType !== undefined) updates.documentType = data.documentType;
  if (data.counterpartyName !== undefined) updates.counterpartyName = data.counterpartyName;

  await db
    .update(signatureDocuments)
    .set(updates)
    .where(
      and(
        eq(signatureDocuments.id, documentId),
        eq(signatureDocuments.tenantId, tenantId),
        ...(userIdFilter ? [eq(signatureDocuments.userId, userIdFilter)] : []),
      ),
    );

  return getDocument(tenantId, documentId, userIdFilter);
}

export async function deleteDocument(tenantId: string, documentId: string, userIdFilter?: string) {
  const now = new Date();

  // Fetch the storagePath before archiving so we can unlink the file
  const doc = await getDocument(tenantId, documentId, userIdFilter);

  await db
    .update(signatureDocuments)
    .set({ isArchived: true, updatedAt: now })
    .where(
      and(
        eq(signatureDocuments.id, documentId),
        eq(signatureDocuments.tenantId, tenantId),
        ...(userIdFilter ? [eq(signatureDocuments.userId, userIdFilter)] : []),
      ),
    );

  logger.info({ tenantId, documentId }, 'Signature document archived');

  // Unlink PDF from disk (non-blocking — archive response is already sent)
  if (doc?.storagePath) {
    unlink(path.join(UPLOADS_DIR, doc.storagePath)).catch((err) => {
      logger.warn({ err, documentId, storagePath: doc.storagePath }, 'Failed to unlink sign document PDF from disk');
    });
  }
}

export async function voidDocument(
  tenantId: string,
  documentId: string,
  actorUserId: string,
  userIdFilter?: string,
) {
  const now = new Date();

  // Mark document as voided
  await db
    .update(signatureDocuments)
    .set({ status: 'voided', updatedAt: now })
    .where(
      and(
        eq(signatureDocuments.id, documentId),
        eq(signatureDocuments.tenantId, tenantId),
        ...(userIdFilter ? [eq(signatureDocuments.userId, userIdFilter)] : []),
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

  logger.info({ actorUserId, documentId }, 'Signature document voided');

  const voider = await getUser(actorUserId);
  logAuditEvent({
    documentId,
    action: 'document.voided',
    actorEmail: voider.email,
    actorName: voider.name,
  }).catch(() => {});

  return getDocument(tenantId, documentId, userIdFilter);
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

  // ── Audit trail page ────────────────────────────────────────────
  // Fetch the document record plus audit events for signers
  const [docRecord] = await db
    .select({ id: signatureDocuments.id, title: signatureDocuments.title, createdAt: signatureDocuments.createdAt, completedAt: signatureDocuments.updatedAt })
    .from(signatureDocuments)
    .where(eq(signatureDocuments.id, documentId))
    .limit(1);

  const auditRows = await db
    .select()
    .from(signAuditLog)
    .where(and(eq(signAuditLog.documentId, documentId), eq(signAuditLog.action, 'document.signed')))
    .orderBy(asc(signAuditLog.createdAt));

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const auditPage = pdfDoc.addPage([595, 842]); // A4
  const { width, height } = auditPage.getSize();
  const margin = 50;
  let y = height - margin;

  function drawLine(text: string, size = 11, isBold = false, color = rgb(0, 0, 0)) {
    auditPage.drawText(text, { x: margin, y, size, font: isBold ? boldFont : font, color });
    y -= size + 6;
  }

  drawLine('Signature Audit Trail', 16, true, rgb(0.1, 0.1, 0.1));
  y -= 4;
  auditPage.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: rgb(0.7, 0.7, 0.7) });
  y -= 12;

  if (docRecord) {
    drawLine(`Document: ${docRecord.title}`, 11, true);
    drawLine(`Document ID: ${docRecord.id}`, 10, false, rgb(0.4, 0.4, 0.4));
    drawLine(`Created: ${docRecord.createdAt?.toISOString() ?? 'N/A'}`, 10, false, rgb(0.4, 0.4, 0.4));
  }

  y -= 8;
  drawLine('Signers', 12, true);
  y -= 4;

  if (auditRows.length === 0) {
    drawLine('No signed events recorded.', 10, false, rgb(0.5, 0.5, 0.5));
  } else {
    for (const row of auditRows) {
      const meta = (row.metadata ?? {}) as Record<string, string>;
      const name = row.actorName ?? meta.signerName ?? 'Unknown';
      const email = row.actorEmail ?? meta.signerEmail ?? '';
      const ip = row.ipAddress ?? 'N/A';
      const ts = row.createdAt?.toISOString() ?? 'N/A';
      drawLine(`• ${name} <${email}>`, 10, true);
      drawLine(`  Signed: ${ts}    IP: ${ip}`, 9, false, rgb(0.4, 0.4, 0.4));
      y -= 4;
    }
  }

  const signedBytes = await pdfDoc.save();
  return Buffer.from(signedBytes);
}

// ─── Widget summary (lightweight) ──────────────────────────────────

export async function getWidgetData(userId: string, tenantId: string) {
  const rows = await db
    .select({ status: signatureDocuments.status, count: sql<number>`COUNT(*)`.as('count') })
    .from(signatureDocuments)
    .where(and(
      eq(signatureDocuments.tenantId, tenantId),
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
