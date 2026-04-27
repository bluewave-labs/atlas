export type OdooImportFileKind = 'partners' | 'leads' | 'activities';

export interface OdooStagePreview {
  /** Distinct Odoo stage label seen in crm.lead.csv */
  odooStage: string;
  /** Number of opportunity rows in this stage */
  rowCount: number;
}

export interface OdooCustomFieldPreview {
  /** Column name as seen in the CSV */
  column: string;
  /** Sample non-empty value from the first row that had it */
  sampleValue: string | null;
  /** Which file the column came from */
  file: OdooImportFileKind;
}

export interface OdooImportPreview {
  sessionId: string;
  counts: {
    companies: number;
    contacts: number;
    leads: number;
    deals: number;
    activities: number;
  };
  /** Per-file row counts dropped + reason */
  dropped: Array<{ file: OdooImportFileKind; reason: string; count: number }>;
  /** Distinct stages from crm.lead.csv opportunities. Empty when no leads file uploaded. */
  stages: OdooStagePreview[];
  /** Custom fields detected in any uploaded file */
  customFields: OdooCustomFieldPreview[];
  /** Existing Atlas crmDealStages for this tenant. Used to populate the mapping dropdown. */
  atlasStages: Array<{ id: string; name: string; sequence: number }>;
}

export interface OdooImportStageMapping {
  /** Maps an Odoo stage label → Atlas crmDealStages.id */
  [odooStage: string]: string;
}

export interface OdooImportCommitInput {
  sessionId: string;
  stageMapping: OdooImportStageMapping;
}

export interface OdooImportSummary {
  imported: {
    companies: number;
    contacts: number;
    leads: number;
    deals: number;
    activities: number;
  };
  dropped: Array<{ file: OdooImportFileKind; reason: string; count: number }>;
  customFieldsSkipped: number;
}
