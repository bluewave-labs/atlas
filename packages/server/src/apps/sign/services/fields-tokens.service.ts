import { db } from '../../../config/database';
import { signatureDocuments, signatureFields, signingTokens } from '../../../db/schema';
import { eq, and, asc, desc, sql } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import { env } from '../../../config/env';
import crypto from 'node:crypto';
import { sendSigningInviteEmail, sendDocumentCompletedEmail } from '../email';
import { logAuditEvent, getUser, getUserName, getUserEmail } from './documents.service';

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

/**
 * Fetch a signature field together with the owning document's user id.
 * Returns null when either the field or its parent document is missing.
 */
export async function getFieldWithOwner(fieldId: string) {
  const rows = await db
    .select({
      id: signatureFields.id,
      documentId: signatureFields.documentId,
      signerEmail: signatureFields.signerEmail,
      ownerUserId: signatureDocuments.userId,
    })
    .from(signatureFields)
    .leftJoin(signatureDocuments, eq(signatureFields.documentId, signatureDocuments.id))
    .where(eq(signatureFields.id, fieldId))
    .limit(1);
  return rows[0] || null;
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
      sendDocumentCompletedEmail({
        to: email,
        documentTitle: doc.title,
      }).catch(() => {});
    }

    return created;
  }

  // Email: only send invite to the signer if it's their turn.
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

export async function listSigningTokens(documentId: string) {
  return db
    .select()
    .from(signingTokens)
    .where(eq(signingTokens.documentId, documentId))
    .orderBy(asc(signingTokens.signingOrder), asc(signingTokens.createdAt));
}

// ─── Sequential Signing Helpers ─────────────────────────────────────

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

async function notifyNextSigner(documentId: string) {
  const next = await getNextPendingSigner(documentId);
  if (!next) return;

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

export async function isSignerTurn(documentId: string, signingOrder: number): Promise<boolean> {
  if (signingOrder === 0) return true;

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

export async function getSigningToken(
  token: string,
  meta?: { ipAddress?: string; userAgent?: string },
) {
  const [row] = await db
    .select()
    .from(signingTokens)
    .where(eq(signingTokens.token, token))
    .limit(1);

  if (!row) return null;

  const [doc] = await db
    .select()
    .from(signatureDocuments)
    .where(eq(signatureDocuments.id, row.documentId))
    .limit(1);

  let waitingForPrevious = false;
  if (row.status === 'pending' && row.signingOrder > 0) {
    const isTurn = await isSignerTurn(row.documentId, row.signingOrder);
    waitingForPrevious = !isTurn;
  }

  if (row.status === 'pending' && !row.viewedAt) {
    const now = new Date();
    await db
      .update(signingTokens)
      .set({ viewedAt: now, updatedAt: now })
      .where(eq(signingTokens.id, row.id));

    logAuditEvent({
      documentId: row.documentId,
      action: 'document.viewed',
      actorEmail: row.signerEmail,
      actorName: row.signerName ?? undefined,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      metadata: { tokenId: row.id, waitingForPrevious },
    }).catch(() => {});
  }

  return { token: row, document: doc || null, waitingForPrevious };
}

// ─── Signing Operations ─────────────────────────────────────────────

export async function signField(
  fieldId: string,
  signatureData: string,
  meta?: { ipAddress?: string; userAgent?: string },
) {
  const now = new Date();
  const result = await updateField(fieldId, {
    signatureData,
    signedAt: now,
  });

  if (result) {
    logAuditEvent({
      documentId: result.documentId,
      action: 'document.signed',
      actorEmail: result.signerEmail ?? undefined,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      metadata: { fieldId, fieldType: result.type, label: result.label },
    }).catch(() => {});
  }

  return result;
}

export async function completeSigningToken(tokenId: string) {
  const now = new Date();

  const [tokenRow] = await db
    .select()
    .from(signingTokens)
    .where(eq(signingTokens.id, tokenId))
    .limit(1);

  await db
    .update(signingTokens)
    .set({ status: 'signed', signedAt: now, updatedAt: now })
    .where(eq(signingTokens.id, tokenId));
  logger.info({ tokenId, role: tokenRow?.role }, 'Signing token marked as completed');

  if (tokenRow) {
    logAuditEvent({
      documentId: tokenRow.documentId,
      action: 'signing_token.completed',
      actorEmail: tokenRow.signerEmail,
      actorName: tokenRow.signerName ?? undefined,
      metadata: { tokenId },
    }).catch(() => {});

    notifyNextSigner(tokenRow.documentId).catch(() => {});
  }
}

export async function declineSigningToken(tokenId: string, reason: string | null) {
  const now = new Date();

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

export async function checkDocumentComplete(documentId: string) {
  const fields = await db
    .select()
    .from(signatureFields)
    .where(
      and(
        eq(signatureFields.documentId, documentId),
        eq(signatureFields.required, true),
      ),
    );

  const allFieldsSigned = fields.length > 0 && fields.every((f) => f.signedAt !== null);

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

    logAuditEvent({
      documentId,
      action: 'document.completed',
      metadata: { fieldCount: fields.length },
    }).catch(() => {});

    const [doc] = await db
      .select({ title: signatureDocuments.title, userId: signatureDocuments.userId })
      .from(signatureDocuments)
      .where(eq(signatureDocuments.id, documentId))
      .limit(1);

    if (doc) {
      const tokens = await db
        .select({ signerEmail: signingTokens.signerEmail })
        .from(signingTokens)
        .where(eq(signingTokens.documentId, documentId));

      const recipientEmails = new Set<string>();
      for (const t of tokens) {
        recipientEmails.add(t.signerEmail);
      }

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

// ─── Single Reminder ─────────────────────────────────────────────────

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

  if (new Date(tokenRow.expiresAt) < new Date()) return false;

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

  const now = new Date();
  await db
    .update(signingTokens)
    .set({ lastReminderAt: now, updatedAt: now })
    .where(eq(signingTokens.id, tokenId));

  logger.info({ tokenId, signerEmail: tokenRow.signerEmail }, 'Manual reminder sent');

  logAuditEvent({
    documentId,
    action: 'reminder.sent',
    actorEmail: tokenRow.signerEmail,
    actorName: tokenRow.signerName ?? undefined,
    metadata: { tokenId, manual: true },
  }).catch(() => {});

  return true;
}
