import { db } from '../../../config/database';
import { projectInvoices, projectInvoiceLineItems, projectClients, projectSettings } from '../../../db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { generateUblXml } from '../../../services/efatura/ubl-generator';
import { generateInvoiceHtml } from '../../../services/efatura/pdf-generator';
import { logger } from '../../../utils/logger';

// ─── e-Fatura Service ──────────────────────────────────────────────

export async function getEFaturaContext(tenantId: string, invoiceId: string) {
  // Load invoice
  const [invoice] = await db
    .select()
    .from(projectInvoices)
    .where(and(eq(projectInvoices.id, invoiceId), eq(projectInvoices.tenantId, tenantId)))
    .limit(1);

  if (!invoice) return null;

  // Load line items
  const lineItems = await db
    .select()
    .from(projectInvoiceLineItems)
    .where(eq(projectInvoiceLineItems.invoiceId, invoiceId))
    .orderBy(asc(projectInvoiceLineItems.createdAt));

  // Load client
  const [client] = await db
    .select()
    .from(projectClients)
    .where(eq(projectClients.id, invoice.clientId))
    .limit(1);

  // Load settings
  const [settings] = await db
    .select()
    .from(projectSettings)
    .where(eq(projectSettings.tenantId, tenantId))
    .limit(1);

  return { invoice, lineItems, client: client || null, settings: settings || null };
}

export async function generateEFatura(tenantId: string, invoiceId: string, eFaturaType?: string) {
  const ctx = await getEFaturaContext(tenantId, invoiceId);
  if (!ctx) return null;

  const { invoice, lineItems, client, settings } = ctx;

  if (!settings?.eFaturaEnabled) {
    throw new Error('e-Fatura is not enabled');
  }

  if (!client) {
    throw new Error('Invoice client not found');
  }

  if (lineItems.length === 0) {
    throw new Error('Invoice has no line items');
  }

  // Generate UUID if not already set
  const eFaturaUuid = invoice.eFaturaUuid || randomUUID();
  const type = eFaturaType || invoice.eFaturaType || 'satis';

  // Generate UBL-TR XML
  const xml = generateUblXml(
    { ...invoice, eFaturaUuid, eFaturaType: type },
    lineItems,
    client,
    settings,
  );

  // Store in database
  const now = new Date();
  const [updated] = await db
    .update(projectInvoices)
    .set({
      eFaturaUuid,
      eFaturaType: type,
      eFaturaStatus: 'generated',
      eFaturaXml: xml,
      updatedAt: now,
    })
    .where(and(eq(projectInvoices.id, invoiceId), eq(projectInvoices.tenantId, tenantId)))
    .returning();

  logger.info({ invoiceId, eFaturaUuid }, 'e-Fatura XML generated');

  return updated;
}

export async function getEFaturaXml(tenantId: string, invoiceId: string): Promise<string | null> {
  const [invoice] = await db
    .select({ eFaturaXml: projectInvoices.eFaturaXml })
    .from(projectInvoices)
    .where(and(eq(projectInvoices.id, invoiceId), eq(projectInvoices.tenantId, tenantId)))
    .limit(1);

  return invoice?.eFaturaXml || null;
}

export async function getEFaturaPreviewHtml(tenantId: string, invoiceId: string): Promise<string | null> {
  const ctx = await getEFaturaContext(tenantId, invoiceId);
  if (!ctx) return null;

  const { invoice, lineItems, client, settings } = ctx;
  if (!client || !settings) return null;

  const html = generateInvoiceHtml(
    { ...invoice, eFaturaUuid: invoice.eFaturaUuid || undefined },
    lineItems,
    client,
    settings,
  );

  return html;
}
