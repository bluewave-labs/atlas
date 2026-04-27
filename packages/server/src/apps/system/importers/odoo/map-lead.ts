import type { OdooLeadRow } from './types';

export interface LeadInsert {
  name: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  source: string;
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  notes: string | null;
  expectedRevenue: number;
  probability: number;
  expectedCloseDate: Date | null;
  tags: string[];
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DealInsert {
  title: string;
  value: number;
  currency: string;
  probability: number;
  expectedCloseDate: Date | null;
  lostReason: string | null;
  wonAt: Date | null;
  lostAt: Date | null;
  tags: string[];
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** Used to attach a crmNote with the description after insert */
  description: string | null;
}

export type MapLeadResult =
  | { kind: 'lead'; odooId: number; partnerOdooId: number | null; insert: LeadInsert }
  | {
      kind: 'deal';
      odooId: number;
      partnerOdooId: number | null;
      odooStage: string | null;
      insert: DealInsert;
    };

function parseDate(s: string | undefined): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}

function parseDateOrNull(s: string | undefined): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function stripHtml(html: string | undefined): string | null {
  if (!html) return null;
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
  return text || null;
}

function splitTags(raw: string | undefined): string[] {
  if (!raw) return [];
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(parts));
}

export function mapLead(row: OdooLeadRow): MapLeadResult {
  const created = parseDate(row.create_date);
  const updated = parseDate(row.write_date);

  if (row.type === 'opportunity') {
    const insert: DealInsert = {
      title: row.name,
      value: row.expected_revenue ?? 0,
      currency: row.currency_id || 'USD',
      probability: row.probability ?? 0,
      expectedCloseDate: parseDateOrNull(row.date_deadline),
      lostReason: row.lost_reason_id || null,
      wonAt: null,
      lostAt: row.active === false && row.lost_reason_id ? updated : null,
      tags: splitTags(row.tag_ids),
      isArchived: row.active === false && !row.lost_reason_id,
      createdAt: created,
      updatedAt: updated,
      description: stripHtml(row.description),
    };
    return {
      kind: 'deal',
      odooId: row.id,
      partnerOdooId: row.partner_id ?? null,
      odooStage: row.stage_id || null,
      insert,
    };
  }

  let status: LeadInsert['status'] = 'new';
  if (row.active === false && row.lost_reason_id) status = 'lost';

  const name =
    row.contact_name && row.contact_name !== row.name ? row.contact_name : row.name;
  const noteParts: string[] = [];
  if (row.contact_name && row.contact_name !== row.name)
    noteParts.push(`Original name: ${row.name}`);
  const desc = stripHtml(row.description);
  if (desc) noteParts.push(desc);

  const insert: LeadInsert = {
    name,
    email: row.email_from || null,
    phone: row.phone || row.mobile || null,
    companyName: row.partner_name || null,
    source: 'other',
    status,
    notes: noteParts.length > 0 ? noteParts.join('\n\n') : null,
    expectedRevenue: row.expected_revenue ?? 0,
    probability: row.probability ?? 0,
    expectedCloseDate: parseDateOrNull(row.date_deadline),
    tags: splitTags(row.tag_ids),
    isArchived: row.active === false && !row.lost_reason_id,
    createdAt: created,
    updatedAt: updated,
  };
  return { kind: 'lead', odooId: row.id, partnerOdooId: row.partner_id ?? null, insert };
}
