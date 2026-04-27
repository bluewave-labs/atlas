import type { OdooActivityRow } from './types';
import type { OdooIdMap } from './odoo-id-map';

export interface ActivityInsert {
  type: string;
  body: string;
  dealId: string | null;
  contactId: string | null;
  companyId: string | null;
  scheduledAt: Date | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type MapActivityResult =
  | { kind: 'activity'; insert: ActivityInsert }
  | { kind: 'drop'; reason: string };

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

function stripHtml(html: string | undefined): string {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

export function mapActivity(row: OdooActivityRow, idMap: OdooIdMap): MapActivityResult {
  if (row.res_model !== 'res.partner' && row.res_model !== 'crm.lead') {
    return { kind: 'drop', reason: `unsupported res_model='${row.res_model}'` };
  }

  let dealId: string | null = null;
  let contactId: string | null = null;
  let companyId: string | null = null;

  if (row.res_model === 'crm.lead') {
    const entry = idMap.get(row.res_id);
    if (!entry || entry.kind !== 'deal') {
      return {
        kind: 'drop',
        reason:
          'attached to a lead, which Atlas activities cannot reference (only deals/contacts/companies)',
      };
    }
    dealId = entry.atlasId;
  } else {
    const entry = idMap.get(row.res_id);
    if (!entry) {
      return { kind: 'drop', reason: `partner id=${row.res_id} not found in uploaded partners file` };
    }
    if (entry.kind === 'company') {
      companyId = entry.atlasId;
    } else if (entry.kind === 'contact') {
      contactId = entry.atlasId;
    } else {
      return { kind: 'drop', reason: 'partner mapped to unexpected kind' };
    }
  }

  const summary = stripHtml(row.summary);
  const note = stripHtml(row.note);
  const body = [summary, note].filter(Boolean).join('\n\n');

  const insert: ActivityInsert = {
    type: row.activity_type_id || 'note',
    body,
    dealId,
    contactId,
    companyId,
    scheduledAt: parseDateOrNull(row.date_deadline),
    isArchived: false,
    createdAt: parseDate(row.create_date),
    updatedAt: parseDate(row.write_date),
  };
  return { kind: 'activity', insert };
}
