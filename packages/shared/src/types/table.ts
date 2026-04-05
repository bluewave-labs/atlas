export type TableFieldType =
  | 'text'
  | 'number'
  | 'checkbox'
  | 'singleSelect'
  | 'multiSelect'
  | 'date'
  | 'url'
  | 'email'
  | 'currency'
  | 'phone'
  | 'rating'
  | 'percent'
  | 'longText'
  | 'attachment'
  | 'linkedRecord'
  | 'lookup'
  | 'rollup';

export interface TableColumn {
  id: string;
  name: string;
  type: TableFieldType;
  width?: number;
  options?: string[];
  required?: boolean;
  description?: string;
  linkedTableId?: string;
  linkedDisplayColumnId?: string;
  lookupLinkedColumnId?: string;
  lookupTargetColumnId?: string;
  rollupFunction?: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'countAll' | 'arrayUnique' | 'arrayFlatten';
}

export interface TableRow {
  _id: string;
  _createdAt: string;
  [columnId: string]: unknown;
}

export interface TableAttachment {
  url: string;
  name: string;
  size: number;
  type: string; // MIME type
}

export interface TableViewTab {
  key: 'grid' | 'kanban' | 'calendar' | 'gallery';
  label: string;
}

export interface TableViewConfig {
  activeView: 'grid' | 'kanban' | 'calendar' | 'gallery';
  kanbanGroupByColumnId?: string;
  calendarDateColumnId?: string;
  sorts?: Array<{ columnId: string; direction: 'asc' | 'desc' }>;
  filters?: Array<{ columnId: string; operator: string; value: unknown }>;
  hiddenColumns?: string[];
  rowHeight?: 'short' | 'medium' | 'tall' | 'extraTall';
  frozenColumnCount?: number;
  rowColorMode?: 'none' | 'bySelectField';
  rowColorColumnId?: string;
  setFilters?: Record<string, string[]>;
  groupByColumnId?: string | null;
  views?: TableViewTab[];
}

export interface Spreadsheet {
  id: string;
  accountId: string;
  userId: string;
  title: string;
  columns: TableColumn[];
  rows: TableRow[];
  viewConfig: TableViewConfig;
  sortOrder: number;
  isArchived: boolean;
  color?: string;
  icon?: string;
  guide?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSpreadsheetInput {
  title?: string;
  columns?: TableColumn[];
  rows?: TableRow[];
  viewConfig?: TableViewConfig;
  color?: string;
  icon?: string;
}

export interface UpdateSpreadsheetInput {
  title?: string;
  columns?: TableColumn[];
  rows?: TableRow[];
  viewConfig?: TableViewConfig;
  isArchived?: boolean;
  color?: string;
  icon?: string;
  guide?: string;
}
