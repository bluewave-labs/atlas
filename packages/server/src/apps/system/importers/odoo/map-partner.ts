import type { OdooPartnerRow } from './types';

export interface CompanyInsert {
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  address: string | null;
  phone: string | null;
  taxId: string | null;
  postalCode: string | null;
  state: string | null;
  country: string | null;
  logo: string | null;
  tags: string[];
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
  /** comment column, used to seed a crmNote post-insert */
  comment: string | null;
}

export interface ContactInsert {
  name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  tags: string[];
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type MapPartnerResult =
  | { kind: 'company'; odooId: number; insert: CompanyInsert }
  | { kind: 'contact'; odooId: number; parentOdooId: number | null; insert: ContactInsert }
  | { kind: 'drop'; reason: string };

function parseDate(s: string | undefined): Date {
  if (!s) return new Date();
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
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
    .filter((s) => s.length > 0);
  return Array.from(new Set(parts));
}

function buildAddress(row: OdooPartnerRow): string | null {
  const parts: string[] = [];
  if (row.street) parts.push(row.street);
  if (row.street2) parts.push(row.street2);
  const cityLine = [row.city, row.state_id, row.zip].filter(Boolean).join(' ').trim();
  if (cityLine) parts.push(cityLine);
  if (row.country_id) parts.push(row.country_id);
  return parts.length > 0 ? parts.join(', ') : null;
}

function normalizeWebsite(w: string | undefined): string | null {
  if (!w) return null;
  return w
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase();
}

export function mapPartner(row: OdooPartnerRow): MapPartnerResult {
  if (row.type && row.type !== 'contact') {
    return {
      kind: 'drop',
      reason: `partner type='${row.type}' (only 'contact' or unset is imported)`,
    };
  }

  const created = parseDate(row.create_date);
  const updated = parseDate(row.write_date);

  if (row.is_company) {
    const insert: CompanyInsert = {
      name: row.name,
      domain: normalizeWebsite(row.website),
      industry: row.industry_id || null,
      size: null,
      address: buildAddress(row),
      phone: row.phone || null,
      taxId: row.vat ? row.vat.slice(0, 11) : null,
      postalCode: row.zip || null,
      state: row.state_id || null,
      country: row.country_id || null,
      logo: row.image_1920 ? `data:image/png;base64,${row.image_1920}` : null,
      tags: splitTags(row.category_id),
      isArchived: !row.active,
      createdAt: created,
      updatedAt: updated,
      comment: stripHtml(row.comment),
    };
    return { kind: 'company', odooId: row.id, insert };
  }

  const insert: ContactInsert = {
    name: row.name,
    email: row.email || null,
    phone: row.phone || row.mobile || null,
    position: row.function || null,
    tags: splitTags(row.category_id),
    isArchived: !row.active,
    createdAt: created,
    updatedAt: updated,
  };
  return { kind: 'contact', odooId: row.id, parentOdooId: row.parent_id ?? null, insert };
}
