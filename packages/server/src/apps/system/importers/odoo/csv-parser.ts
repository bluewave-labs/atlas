import { parse } from 'csv-parse/sync';
import type { OdooPartnerRow, OdooLeadRow, OdooActivityRow } from './types';

const PARTNER_COLUMNS = new Set([
  'id', 'name', 'is_company', 'parent_id', 'type',
  'email', 'phone', 'mobile', 'function',
  'street', 'street2', 'city', 'zip', 'state_id', 'country_id',
  'vat', 'website', 'comment', 'industry_id', 'category_id',
  'image_1920', 'active', 'create_date', 'write_date',
  'display_name', 'complete_name', 'commercial_partner_id',
  'customer_rank', 'supplier_rank', 'lang', 'tz', 'title', 'ref',
  'team_id', 'user_id', 'employee', 'company_registry',
]);

const LEAD_COLUMNS = new Set([
  'id', 'name', 'type', 'partner_name', 'contact_name',
  'email_from', 'phone', 'mobile', 'partner_id', 'stage_id',
  'expected_revenue', 'probability', 'date_deadline',
  'description', 'tag_ids', 'active', 'lost_reason_id', 'currency_id',
  'create_date', 'write_date',
  'team_id', 'user_id', 'source_id', 'medium_id', 'campaign_id',
  'priority', 'function', 'title', 'website', 'company_id',
  'recurring_revenue', 'recurring_plan', 'date_closed', 'date_open',
  'date_last_stage_update', 'kanban_state', 'color',
]);

const ACTIVITY_COLUMNS = new Set([
  'id', 'res_model', 'res_id', 'activity_type_id',
  'summary', 'note', 'date_deadline',
  'create_date', 'write_date',
  'res_model_id', 'user_id', 'previous_activity_type_id',
  'recommended_activity_type_id', 'chaining_type', 'date_done',
]);

export function normalizeColumnName(col: string): string {
  return col.replace(/\/\.?id$/, '');
}

function stripBom(buf: Buffer): string {
  const text = buf.toString('utf-8');
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text;
}

function parseBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v !== 'string') return false;
  const t = v.trim().toLowerCase();
  return t === 'true' || t === '1' || t === 'yes';
}

function parseNumber(v: unknown): number | undefined {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

interface ParseResult<T> {
  rows: T[];
  unrecognizedColumns: string[];
}

function parseCsv(buf: Buffer, requiredColumns: string[], knownColumns: Set<string>): {
  records: Record<string, string>[];
  normalizedHeaders: string[];
  unrecognized: string[];
} {
  const text = stripBom(buf);
  const records = parse(text, {
    columns: (header: string[]) => header.map(normalizeColumnName),
    skip_empty_lines: true,
    relax_column_count: true,
    bom: false,
    trim: true,
  }) as Record<string, string>[];

  const normalizedHeaders = records.length > 0 ? Object.keys(records[0]) : [];
  const missing = requiredColumns.filter((col) => !normalizedHeaders.includes(col));
  if (missing.length > 0) {
    throw new Error(`Required column(s) missing: ${missing.join(', ')}`);
  }

  const unrecognized = normalizedHeaders.filter((h) => !knownColumns.has(h));

  return { records, normalizedHeaders, unrecognized };
}

export function parsePartnerCsv(buf: Buffer): ParseResult<OdooPartnerRow> {
  const { records, unrecognized } = parseCsv(buf, ['id', 'name', 'is_company'], PARTNER_COLUMNS);
  const rows: OdooPartnerRow[] = records.map((r) => ({
    id: Number(r.id),
    name: r.name,
    is_company: parseBool(r.is_company),
    parent_id: parseNumber(r.parent_id) ?? null,
    type: r.type || undefined,
    email: r.email || undefined,
    phone: r.phone || undefined,
    mobile: r.mobile || undefined,
    function: r.function || undefined,
    street: r.street || undefined,
    street2: r.street2 || undefined,
    city: r.city || undefined,
    zip: r.zip || undefined,
    state_id: r.state_id || undefined,
    country_id: r.country_id || undefined,
    vat: r.vat || undefined,
    website: r.website || undefined,
    comment: r.comment || undefined,
    industry_id: r.industry_id || undefined,
    category_id: r.category_id || undefined,
    image_1920: r.image_1920 || undefined,
    active: r.active === undefined ? true : parseBool(r.active),
    create_date: r.create_date || undefined,
    write_date: r.write_date || undefined,
  }));
  return { rows, unrecognizedColumns: unrecognized };
}

export function parseLeadCsv(buf: Buffer): ParseResult<OdooLeadRow> {
  const { records, unrecognized } = parseCsv(buf, ['id', 'name', 'type'], LEAD_COLUMNS);
  const rows: OdooLeadRow[] = records.map((r) => ({
    id: Number(r.id),
    name: r.name,
    type: r.type === 'opportunity' ? 'opportunity' : 'lead',
    partner_name: r.partner_name || undefined,
    contact_name: r.contact_name || undefined,
    email_from: r.email_from || undefined,
    phone: r.phone || undefined,
    mobile: r.mobile || undefined,
    partner_id: parseNumber(r.partner_id) ?? null,
    stage_id: r.stage_id || undefined,
    expected_revenue: parseNumber(r.expected_revenue),
    probability: parseNumber(r.probability),
    date_deadline: r.date_deadline || undefined,
    description: r.description || undefined,
    tag_ids: r.tag_ids || undefined,
    active: r.active === undefined ? true : parseBool(r.active),
    lost_reason_id: r.lost_reason_id || undefined,
    currency_id: r.currency_id || undefined,
    create_date: r.create_date || undefined,
    write_date: r.write_date || undefined,
  }));
  return { rows, unrecognizedColumns: unrecognized };
}

export function parseActivityCsv(buf: Buffer): ParseResult<OdooActivityRow> {
  const { records, unrecognized } = parseCsv(
    buf,
    ['id', 'res_model', 'res_id', 'date_deadline'],
    ACTIVITY_COLUMNS,
  );
  const rows: OdooActivityRow[] = records.map((r) => ({
    id: Number(r.id),
    res_model: r.res_model,
    res_id: Number(r.res_id),
    activity_type_id: r.activity_type_id || undefined,
    summary: r.summary || undefined,
    note: r.note || undefined,
    date_deadline: r.date_deadline,
    create_date: r.create_date || undefined,
    write_date: r.write_date || undefined,
  }));
  return { rows, unrecognizedColumns: unrecognized };
}
