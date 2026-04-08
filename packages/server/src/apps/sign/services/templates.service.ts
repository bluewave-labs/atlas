import { db } from '../../../config/database';
import { signatureDocuments, signTemplates } from '../../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import crypto from 'node:crypto';
import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import { createDocument } from './documents.service';
import { createField, listFields } from './fields-tokens.service';

const UPLOADS_DIR = path.join(__dirname, '../../../../uploads');

// ─── Templates ──────────────────────────────────────────────────────

export async function listTemplates(userId: string, tenantId: string) {
  return db
    .select()
    .from(signTemplates)
    .where(
      and(
        eq(signTemplates.tenantId, tenantId),
        eq(signTemplates.isArchived, false),
      ),
    )
    .orderBy(desc(signTemplates.updatedAt));
}

export async function createTemplate(
  userId: string,
  tenantId: string,
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
      tenantId,
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
  tenantId: string,
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
  const fields = await listFields(documentId);

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
  return createTemplate(userId, tenantId, {
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
  tenantId: string,
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
        eq(signTemplates.tenantId, tenantId),
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
  const doc = await createDocument(userId, tenantId, {
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

export async function deleteTemplate(userId: string, tenantId: string, templateId: string) {
  const now = new Date();
  await db
    .update(signTemplates)
    .set({ isArchived: true, updatedAt: now })
    .where(
      and(
        eq(signTemplates.id, templateId),
        eq(signTemplates.tenantId, tenantId),
      ),
    );
  logger.info({ userId, templateId }, 'Sign template archived');
}
