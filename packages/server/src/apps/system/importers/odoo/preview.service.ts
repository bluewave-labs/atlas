import { parsePartnerCsv, parseLeadCsv, parseActivityCsv } from './csv-parser';
import { mapPartner } from './map-partner';
import { mapLead } from './map-lead';
import type {
  OdooPartnerRow,
  OdooLeadRow,
  OdooActivityRow,
  OdooImportPreview,
  OdooImportFileKind,
} from './types';

interface PreviewBuffers {
  partners: Buffer | undefined;
  leads: Buffer | undefined;
  activities: Buffer | undefined;
}

interface AtlasStage {
  id: string;
  name: string;
  sequence: number;
}

export interface PreviewResult {
  preview: Omit<OdooImportPreview, 'sessionId' | 'atlasStages'> & {
    atlasStages: AtlasStage[];
  };
  partners: OdooPartnerRow[];
  leads: OdooLeadRow[];
  activities: OdooActivityRow[];
  customFields: Array<{ column: string; sampleValue: string | null; file: OdooImportFileKind }>;
  dropped: Array<{ file: OdooImportFileKind; reason: string; count: number }>;
}

function findSampleValue(buf: Buffer, column: string): string | null {
  const text = buf.toString('utf-8');
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return null;
  const header = lines[0].split(',').map((s) => s.replace(/^"|"$/g, '').trim());
  const idx = header.indexOf(column);
  if (idx === -1) {
    const altIdx = header.findIndex((h) => h.replace(/\/\.?id$/, '') === column);
    if (altIdx === -1) return null;
    return findInColumn(lines, altIdx);
  }
  return findInColumn(lines, idx);
}

function findInColumn(lines: string[], idx: number): string | null {
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    const cell = cells[idx]?.replace(/^"|"$/g, '').trim();
    if (cell) return cell;
  }
  return null;
}

export function buildPreview(buffers: PreviewBuffers, atlasStages: AtlasStage[]): PreviewResult {
  const customFields: Array<{ column: string; sampleValue: string | null; file: OdooImportFileKind }> = [];
  const dropped: Array<{ file: OdooImportFileKind; reason: string; count: number }> = [];

  let partnerRows: OdooPartnerRow[] = [];
  let leadRows: OdooLeadRow[] = [];
  let activityRows: OdooActivityRow[] = [];

  let companyCount = 0;
  let contactCount = 0;
  let leadCount = 0;
  let dealCount = 0;
  const stageBuckets = new Map<string, number>();
  const droppedReasons = new Map<string, number>();

  if (buffers.partners) {
    const parsed = parsePartnerCsv(buffers.partners);
    partnerRows = parsed.rows;
    for (const col of parsed.unrecognizedColumns) {
      customFields.push({ column: col, sampleValue: findSampleValue(buffers.partners, col), file: 'partners' });
    }
    for (const row of partnerRows) {
      const result = mapPartner(row);
      if (result.kind === 'company') companyCount++;
      else if (result.kind === 'contact') contactCount++;
      else if (result.kind === 'drop') {
        const key = `partners|${result.reason}`;
        droppedReasons.set(key, (droppedReasons.get(key) ?? 0) + 1);
      }
    }
  }

  if (buffers.leads) {
    const parsed = parseLeadCsv(buffers.leads);
    leadRows = parsed.rows;
    for (const col of parsed.unrecognizedColumns) {
      customFields.push({ column: col, sampleValue: findSampleValue(buffers.leads, col), file: 'leads' });
    }
    for (const row of leadRows) {
      const result = mapLead(row);
      if (result.kind === 'lead') leadCount++;
      else if (result.kind === 'deal') {
        dealCount++;
        const stage = result.odooStage ?? '(no stage)';
        stageBuckets.set(stage, (stageBuckets.get(stage) ?? 0) + 1);
      }
    }
  }

  if (buffers.activities) {
    const parsed = parseActivityCsv(buffers.activities);
    activityRows = parsed.rows;
    for (const col of parsed.unrecognizedColumns) {
      customFields.push({ column: col, sampleValue: findSampleValue(buffers.activities, col), file: 'activities' });
    }
  }

  for (const [key, count] of droppedReasons.entries()) {
    const [file, reason] = key.split('|');
    dropped.push({ file: file as OdooImportFileKind, reason, count });
  }

  const stages = Array.from(stageBuckets.entries())
    .map(([odooStage, rowCount]) => ({ odooStage, rowCount }))
    .sort((a, b) => b.rowCount - a.rowCount);

  return {
    preview: {
      counts: {
        companies: companyCount,
        contacts: contactCount,
        leads: leadCount,
        deals: dealCount,
        activities: activityRows.length,
      },
      dropped,
      stages,
      customFields,
      atlasStages,
    },
    partners: partnerRows,
    leads: leadRows,
    activities: activityRows,
    customFields,
    dropped,
  };
}
