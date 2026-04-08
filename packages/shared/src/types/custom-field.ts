// ─── Custom Fields (JSONB Properties Pattern) ──────────────────────

export type CustomFieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'boolean'
  | 'select'
  | 'multi_select'
  | 'url'
  | 'relation';

export interface CustomFieldDefinition {
  id: string;
  tenantId: string | null;
  appId: string;
  recordType: string;
  name: string;
  slug: string;
  fieldType: CustomFieldType;
  options: Record<string, unknown>;
  isRequired: boolean;
  sortOrder: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFieldValue {
  id: string;
  tenantId: string;
  fieldDefinitionId: string;
  recordId: string;
  value: unknown;
  createdAt: string;
  updatedAt: string;
}

/** A field definition merged with its current value for a specific record */
export interface CustomFieldWithValue extends CustomFieldDefinition {
  value: unknown;
  valueId: string | null;
}
