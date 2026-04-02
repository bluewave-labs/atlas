import { db } from '../../config/database';
import { signatureDocuments, signatureFields, signingTokens, signAuditLog, signTemplates, users } from '../../db/schema';
import { eq, and, asc, desc, sql, inArray } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';
import crypto from 'node:crypto';
import { readFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { sendSigningInviteEmail, sendDocumentCompletedEmail } from './email';

const UPLOADS_DIR = path.join(__dirname, '../../../uploads');

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

async function getUser(userId: string): Promise<{ name: string; email: string }> {
  const [user] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return { name: user?.name || user?.email || 'Unknown', email: user?.email || '' };
}

async function getUserName(userId: string): Promise<string> {
  return (await getUser(userId)).name;
}

async function getUserEmail(userId: string): Promise<string> {
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
  options?: Record<string, unknown>;
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
      options: data.options ?? {},
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
    options?: Record<string, unknown>;
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
  if (data.options !== undefined) updates.options = data.options;
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
  signingOrder = 0,
  role: 'signer' | 'viewer' | 'approver' | 'cc' = 'signer',
  customSubject?: string,
  customMessage?: string,
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
      role,
      signingOrder,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ tokenId: created.id, documentId, email, signingOrder }, 'Signing token created');

  // Audit: signing_link.created
  logAuditEvent({
    documentId,
    action: 'signing_link.created',
    actorEmail: email,
    actorName: name ?? undefined,
    metadata: { email, name, signingOrder, expiresAt: expiresAt.toISOString() },
  }).catch(() => {});

  // CC recipients: mark as "signed" immediately (they don't need to act) and send notification only
  if (role === 'cc') {
    await db
      .update(signingTokens)
      .set({ status: 'signed', signedAt: now, updatedAt: now })
      .where(eq(signingTokens.id, created.id));

    const [doc] = await db
      .select({ title: signatureDocuments.title, userId: signatureDocuments.userId })
      .from(signatureDocuments)
      .where(eq(signatureDocuments.id, documentId))
      .limit(1);

    if (doc) {
      const senderName = await getUserName(doc.userId);
      sendDocumentCompletedEmail({
        to: email,
        documentTitle: doc.title,
      }).catch(() => {});
    }

    return created;
  }

  // Email: only send invite to the signer if it's their turn.
  // For sequential signing (signingOrder > 0), only the first signer (order 0) gets the email immediately.
  // Subsequent signers get notified when the previous signer completes.
  const shouldSendEmail = signingOrder === 0;

  if (shouldSendEmail) {
    const [doc] = await db
      .select({ title: signatureDocuments.title, userId: signatureDocuments.userId })
      .from(signatureDocuments)
      .where(eq(signatureDocuments.id, documentId))
      .limit(1);

    if (doc) {
      const senderName = await getUserName(doc.userId);
      const clientUrl = env.CLIENT_PUBLIC_URL || 'http://localhost:5180';
      sendSigningInviteEmail({
        to: email,
        signerName: name ?? undefined,
        documentTitle: doc.title,
        senderName,
        signingLink: `${clientUrl}/sign/${token}`,
        expiresAt,
        customSubject,
        customMessage,
      }).catch(() => {});
    }
  }

  return created;
}

// ─── Sequential Signing Helpers ─────────────────────────────────────

/**
 * Get the next pending signer in sequence for a document.
 * Returns the pending token with the lowest signingOrder.
 */
export async function getNextPendingSigner(documentId: string) {
  const [next] = await db
    .select()
    .from(signingTokens)
    .where(
      and(
        eq(signingTokens.documentId, documentId),
        eq(signingTokens.status, 'pending'),
      ),
    )
    .orderBy(asc(signingTokens.signingOrder))
    .limit(1);
  return next || null;
}

/**
 * Send signing invite to the next signer in the sequence.
 * Called after a signer completes their token.
 */
async function notifyNextSigner(documentId: string) {
  const next = await getNextPendingSigner(documentId);
  if (!next) return; // No more pending signers

  const [doc] = await db
    .select({ title: signatureDocuments.title, userId: signatureDocuments.userId })
    .from(signatureDocuments)
    .where(eq(signatureDocuments.id, documentId))
    .limit(1);

  if (doc) {
    const senderName = await getUserName(doc.userId);
    const clientUrl = env.CLIENT_PUBLIC_URL || 'http://localhost:5180';
    sendSigningInviteEmail({
      to: next.signerEmail,
      signerName: next.signerName ?? undefined,
      documentTitle: doc.title,
      senderName,
      signingLink: `${clientUrl}/sign/${next.token}`,
      expiresAt: next.expiresAt,
    }).catch(() => {});

    logger.info({ documentId, nextSignerEmail: next.signerEmail, signingOrder: next.signingOrder }, 'Notified next signer in sequence');
  }
}

/**
 * Check if it's a given signer's turn based on sequential signing order.
 * Returns true if all signers with a lower signingOrder have completed (signed/declined).
 */
export async function isSignerTurn(documentId: string, signingOrder: number): Promise<boolean> {
  // If signingOrder is 0, it's always their turn (they are first or all signers have order 0 = parallel)
  if (signingOrder === 0) return true;

  // Check if any previous signers (lower order) are still pending
  const previousPending = await db
    .select({ id: signingTokens.id })
    .from(signingTokens)
    .where(
      and(
        eq(signingTokens.documentId, documentId),
        eq(signingTokens.status, 'pending'),
        sql`${signingTokens.signingOrder} < ${signingOrder}`,
      ),
    )
    .limit(1);

  return previousPending.length === 0;
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

  // Check if this signer needs to wait for previous signers (sequential signing)
  let waitingForPrevious = false;
  if (row.status === 'pending' && row.signingOrder > 0) {
    const isTurn = await isSignerTurn(row.documentId, row.signingOrder);
    waitingForPrevious = !isTurn;
  }

  // Audit: document.viewed (when a signer views the document)
  if (row.status === 'pending') {
    logAuditEvent({
      documentId: row.documentId,
      action: 'document.viewed',
      actorEmail: row.signerEmail,
      actorName: row.signerName ?? undefined,
      metadata: { tokenId: row.id, waitingForPrevious },
    }).catch(() => {});
  }

  return { token: row, document: doc || null, waitingForPrevious };
}

export async function listSigningTokens(documentId: string) {
  return db
    .select()
    .from(signingTokens)
    .where(eq(signingTokens.documentId, documentId))
    .orderBy(asc(signingTokens.signingOrder), asc(signingTokens.createdAt));
}

// ─── Signing Operations ─────────────────────────────────────────────

export async function signField(fieldId: string, signatureData: string) {
  const now = new Date();
  const result = await updateField(fieldId, {
    signatureData,
    signedAt: now,
  });

  // Audit: document.signed
  if (result) {
    logAuditEvent({
      documentId: result.documentId,
      action: 'document.signed',
      actorEmail: result.signerEmail ?? undefined,
      metadata: { fieldId, fieldType: result.type, label: result.label },
    }).catch(() => {});
  }

  return result;
}

export async function completeSigningToken(tokenId: string) {
  const now = new Date();

  // Fetch the token before updating to get the signer info
  const [tokenRow] = await db
    .select()
    .from(signingTokens)
    .where(eq(signingTokens.id, tokenId))
    .limit(1);

  // Viewer role: mark as "viewed" (we use 'signed' status but log differently)
  const statusLabel = tokenRow?.role === 'viewer' ? 'signed' : 'signed';

  await db
    .update(signingTokens)
    .set({ status: 'signed', signedAt: now, updatedAt: now })
    .where(eq(signingTokens.id, tokenId));
  logger.info({ tokenId, role: tokenRow?.role }, 'Signing token marked as completed');

  // Audit: token completed
  if (tokenRow) {
    logAuditEvent({
      documentId: tokenRow.documentId,
      action: 'signing_token.completed',
      actorEmail: tokenRow.signerEmail,
      actorName: tokenRow.signerName ?? undefined,
      metadata: { tokenId },
    }).catch(() => {});

    // Sequential signing: notify the next signer in the sequence
    notifyNextSigner(tokenRow.documentId).catch(() => {});
  }
}

export async function declineSigningToken(tokenId: string, reason: string | null) {
  const now = new Date();

  // Fetch the token to get signer info
  const [tokenRow] = await db
    .select()
    .from(signingTokens)
    .where(eq(signingTokens.id, tokenId))
    .limit(1);

  await db
    .update(signingTokens)
    .set({ status: 'declined', declineReason: reason, updatedAt: now })
    .where(eq(signingTokens.id, tokenId));
  logger.info({ tokenId, reason }, 'Signing token declined');

  // Audit: document.declined
  if (tokenRow) {
    logAuditEvent({
      documentId: tokenRow.documentId,
      action: 'document.declined',
      actorEmail: tokenRow.signerEmail,
      actorName: tokenRow.signerName ?? undefined,
      metadata: { tokenId, reason },
    }).catch(() => {});
  }
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
  const allFieldsSigned = fields.length > 0 && fields.every((f) => f.signedAt !== null);

  // Also check that all signer/approver tokens are completed (viewer/cc don't need to sign)
  const actionableTokens = await db
    .select()
    .from(signingTokens)
    .where(
      and(
        eq(signingTokens.documentId, documentId),
        sql`${signingTokens.role} IN ('signer', 'approver')`,
      ),
    );

  const allTokensComplete = actionableTokens.length > 0 &&
    actionableTokens.every((t) => t.status === 'signed' || t.status === 'declined');

  const allSigned = allFieldsSigned && allTokensComplete;

  if (allSigned) {
    const now = new Date();
    await db
      .update(signatureDocuments)
      .set({ status: 'signed', completedAt: now, updatedAt: now })
      .where(eq(signatureDocuments.id, documentId));
    logger.info({ documentId }, 'Signature document marked as completed');

    // Audit: document.completed
    logAuditEvent({
      documentId,
      action: 'document.completed',
      metadata: { fieldCount: fields.length },
    }).catch(() => {});

    // Email: notify all signers + document owner that the document is complete
    const [doc] = await db
      .select({ title: signatureDocuments.title, userId: signatureDocuments.userId })
      .from(signatureDocuments)
      .where(eq(signatureDocuments.id, documentId))
      .limit(1);

    if (doc) {
      // Get all signer emails
      const tokens = await db
        .select({ signerEmail: signingTokens.signerEmail })
        .from(signingTokens)
        .where(eq(signingTokens.documentId, documentId));

      const recipientEmails = new Set<string>();
      for (const t of tokens) {
        recipientEmails.add(t.signerEmail);
      }

      // Add the document owner email
      const ownerEmail = await getUserEmail(doc.userId);
      if (ownerEmail) recipientEmails.add(ownerEmail);

      for (const email of recipientEmails) {
        sendDocumentCompletedEmail({
          to: email,
          documentTitle: doc.title,
        }).catch(() => {});
      }
    }

    return true;
  }

  return false;
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

// ─── Templates ──────────────────────────────────────────────────────

export async function listTemplates(userId: string, accountId: string) {
  return db
    .select()
    .from(signTemplates)
    .where(
      and(
        eq(signTemplates.accountId, accountId),
        eq(signTemplates.isArchived, false),
      ),
    )
    .orderBy(desc(signTemplates.updatedAt));
}

export async function createTemplate(
  userId: string,
  accountId: string,
  data: {
    title: string;
    fileName: string;
    storagePath: string;
    pageCount?: number;
    fields?: Array<{
      type: string;
      pageNumber: number;
      x: number;
      y: number;
      width: number;
      height: number;
      signerEmail: string | null;
      label: string | null;
      required: boolean;
    }>;
  },
) {
  const now = new Date();
  const [created] = await db
    .insert(signTemplates)
    .values({
      accountId,
      userId,
      title: data.title,
      fileName: data.fileName,
      storagePath: data.storagePath,
      pageCount: data.pageCount ?? 1,
      fields: data.fields ?? [],
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  logger.info({ userId, templateId: created.id }, 'Sign template created');
  return created;
}

export async function saveAsTemplate(
  userId: string,
  accountId: string,
  documentId: string,
  title?: string,
) {
  // Get the document
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

  if (!doc) throw new Error('Document not found');

  // Get the fields
  const fields = await db
    .select()
    .from(signatureFields)
    .where(eq(signatureFields.documentId, documentId));

  // Copy the file
  const ext = path.extname(doc.storagePath);
  const newFileName = `tpl_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
  const srcPath = path.join(UPLOADS_DIR, doc.storagePath);
  const dstPath = path.join(UPLOADS_DIR, newFileName);

  try {
    await copyFile(srcPath, dstPath);
  } catch (err) {
    logger.warn({ err }, 'Failed to copy file for template — using same path');
  }

  // Create the template
  return createTemplate(userId, accountId, {
    title: title || `${doc.title} (template)`,
    fileName: doc.fileName,
    storagePath: newFileName,
    pageCount: doc.pageCount,
    fields: fields.map((f) => ({
      type: f.type,
      pageNumber: f.pageNumber,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      signerEmail: f.signerEmail,
      label: f.label,
      required: f.required,
    })),
  });
}

export async function createDocumentFromTemplate(
  userId: string,
  accountId: string,
  templateId: string,
  title?: string,
) {
  // Get the template
  const [tpl] = await db
    .select()
    .from(signTemplates)
    .where(
      and(
        eq(signTemplates.id, templateId),
        eq(signTemplates.accountId, accountId),
        eq(signTemplates.isArchived, false),
      ),
    )
    .limit(1);

  if (!tpl) throw new Error('Template not found');

  // Copy the file
  const ext = path.extname(tpl.storagePath);
  const newFileName = `sign_${userId}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
  const srcPath = path.join(UPLOADS_DIR, tpl.storagePath);
  const dstPath = path.join(UPLOADS_DIR, newFileName);

  try {
    await copyFile(srcPath, dstPath);
  } catch (err) {
    logger.warn({ err }, 'Failed to copy template file — using same path');
  }

  // Create the document
  const doc = await createDocument(userId, accountId, {
    title: title || tpl.title,
    fileName: tpl.fileName,
    storagePath: newFileName,
    pageCount: tpl.pageCount,
  });

  // Create the fields
  for (const f of tpl.fields) {
    await createField({
      documentId: doc.id,
      type: f.type,
      pageNumber: f.pageNumber,
      x: f.x,
      y: f.y,
      width: f.width,
      height: f.height,
      signerEmail: f.signerEmail ?? undefined,
      label: f.label ?? undefined,
      required: f.required,
    });
  }

  return doc;
}

export async function deleteTemplate(userId: string, accountId: string, templateId: string) {
  const now = new Date();
  await db
    .update(signTemplates)
    .set({ isArchived: true, updatedAt: now })
    .where(
      and(
        eq(signTemplates.id, templateId),
        eq(signTemplates.accountId, accountId),
      ),
    );
  logger.info({ userId, templateId }, 'Sign template archived');
}

// ─── Seed sample data (called from setup wizard) ────────────────────

export async function seedSampleData(userId: string, accountId: string) {
  return { skipped: true };
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

// ─── Single Reminder ─────────────────────────────────────────────────

/**
 * Manually send a reminder for a specific signing token.
 * Returns true if the reminder was sent successfully.
 */
export async function sendSingleReminder(documentId: string, tokenId: string): Promise<boolean> {
  const [tokenRow] = await db
    .select()
    .from(signingTokens)
    .where(
      and(
        eq(signingTokens.id, tokenId),
        eq(signingTokens.documentId, documentId),
        eq(signingTokens.status, 'pending'),
      ),
    )
    .limit(1);

  if (!tokenRow) return false;

  // Check expiry
  if (new Date(tokenRow.expiresAt) < new Date()) return false;

  // For sequential signing, only allow reminder if it's their turn
  if (tokenRow.signingOrder > 0) {
    const isTurn = await isSignerTurn(documentId, tokenRow.signingOrder);
    if (!isTurn) return false;
  }

  const [doc] = await db
    .select({ title: signatureDocuments.title, userId: signatureDocuments.userId })
    .from(signatureDocuments)
    .where(eq(signatureDocuments.id, documentId))
    .limit(1);

  if (!doc) return false;

  const senderName = await getUserName(doc.userId);
  const clientUrl = env.CLIENT_PUBLIC_URL || 'http://localhost:5180';

  await sendSigningInviteEmail({
    to: tokenRow.signerEmail,
    signerName: tokenRow.signerName ?? undefined,
    documentTitle: doc.title,
    senderName,
    signingLink: `${clientUrl}/sign/${tokenRow.token}`,
    expiresAt: tokenRow.expiresAt,
  });

  // Update lastReminderAt
  const now = new Date();
  await db
    .update(signingTokens)
    .set({ lastReminderAt: now, updatedAt: now })
    .where(eq(signingTokens.id, tokenId));

  logger.info({ tokenId, signerEmail: tokenRow.signerEmail }, 'Manual reminder sent');

  // Audit
  logAuditEvent({
    documentId,
    action: 'reminder.sent',
    actorEmail: tokenRow.signerEmail,
    actorName: tokenRow.signerName ?? undefined,
    metadata: { tokenId, manual: true },
  }).catch(() => {});

  return true;
}
