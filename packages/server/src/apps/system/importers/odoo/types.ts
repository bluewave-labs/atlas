import type { OdooImportPreview, OdooImportSummary, OdooImportFileKind } from '@atlas-platform/shared';

export type { OdooImportPreview, OdooImportSummary, OdooImportFileKind };

/** Parsed row from res.partner.csv. All fields optional except id + name. */
export interface OdooPartnerRow {
  id: number;
  name: string;
  is_company: boolean;
  parent_id?: number | null;
  type?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  function?: string;
  street?: string;
  street2?: string;
  city?: string;
  zip?: string;
  state_id?: string;
  country_id?: string;
  vat?: string;
  website?: string;
  comment?: string;
  industry_id?: string;
  category_id?: string;
  image_1920?: string;
  active?: boolean;
  create_date?: string;
  write_date?: string;
}

/** Parsed row from crm.lead.csv. All fields optional except id + name + type. */
export interface OdooLeadRow {
  id: number;
  name: string;
  type: 'lead' | 'opportunity';
  partner_name?: string;
  contact_name?: string;
  email_from?: string;
  phone?: string;
  mobile?: string;
  partner_id?: number | null;
  stage_id?: string;
  expected_revenue?: number;
  probability?: number;
  date_deadline?: string;
  description?: string;
  tag_ids?: string;
  active?: boolean;
  lost_reason_id?: string;
  currency_id?: string;
  create_date?: string;
  write_date?: string;
}

/** Parsed row from mail.activity.csv. */
export interface OdooActivityRow {
  id: number;
  res_model: string;
  res_id: number;
  activity_type_id?: string;
  summary?: string;
  note?: string;
  date_deadline: string;
  create_date?: string;
  write_date?: string;
}

/** A row that the parser couldn't map to one of the three row types. */
export interface DroppedRow {
  file: OdooImportFileKind;
  reason: string;
  rowNumber: number;
}

/** In-memory session held between preview and commit. */
export interface ImportSession {
  sessionId: string;
  tenantId: string;
  userId: string;
  createdAt: number;
  partners: OdooPartnerRow[];
  leads: OdooLeadRow[];
  activities: OdooActivityRow[];
  dropped: DroppedRow[];
  customFields: Array<{ column: string; sampleValue: string | null; file: OdooImportFileKind }>;
}
