import type { ColDef } from 'ag-grid-community';
import type { TableColumn } from '@atlas-platform/shared';
import { TableCustomHeader } from '../components/TableCustomHeader';
import { isCellInRange } from '../hooks/use-cell-range-selection';
import type { CellRange } from '../hooks/use-cell-range-selection';
import { FIELD_TYPE_ICONS } from '../../../lib/field-type-icons';
import { MultiSelectCellEditor } from '../components/MultiSelectCellEditor';
import { RichSelectCellEditor } from '../components/RichSelectCellEditor';
import {
  TagRenderer,
  MultiTagRenderer,
  LinkRenderer,
  EmailRenderer,
  CurrencyRenderer,
  StarRenderer,
  PercentRenderer,
  AttachmentCellRenderer,
  DateRenderer,
} from '../components/renderers/cell-renderers';
import {
  LinkedRecordRenderer,
  LinkedRecordEditor,
} from '../components/renderers/linked-record';

// ─── Build AG Grid column defs ──────────────────────────────────────

export interface BuildColDefsSettings {
  dateFormat: string;
  currencySymbol: string;
  showFieldTypeIcons: boolean;
  canEdit?: boolean;
}

export function buildColDefs(
  columns: TableColumn[],
  t: (key: string) => string,
  onMenuOpen?: (columnId: string, x: number, y: number) => void,
  hiddenColumns?: Set<string>,
  frozenColumnCount?: number,
  onHeaderClicked?: (colId: string) => void,
  settings?: BuildColDefsSettings,
  linkedTableData?: Map<string, { rows: Array<{ _id: string; [key: string]: unknown }>; columns: Array<{ id: string; name: string }> }>,
): ColDef[] {
  const canEdit = settings?.canEdit !== false;
  return columns.map((col, idx) => {
    const TypeIcon = settings?.showFieldTypeIcons !== false ? FIELD_TYPE_ICONS[col.type] : undefined;
    const base: ColDef = {
      field: col.id,
      headerName: col.name,
      editable: canEdit,
      width: col.width || 180,
      resizable: true,
      sortable: true,
      hide: hiddenColumns?.has(col.id),
      headerComponent: TableCustomHeader,
      headerComponentParams: {
        fieldType: col.type,
        fieldTypeIcon: TypeIcon,
        fieldDescription: col.description,
        onMenuOpen,
        onHeaderClicked,
      },
      cellClassRules: {
        'cell-range-selected': (params: { context: Record<string, unknown>; colDef: { field?: string }; node: { rowIndex: number | null; rowPinned?: string | null } }) => {
          const { cellRangeRef, colIndexMapRef } = params.context as {
            cellRangeRef?: { current: CellRange | null };
            colIndexMapRef?: { current: Map<string, number> };
          };
          if (!cellRangeRef?.current || !params.colDef.field) return false;
          const rowIndex = params.node.rowIndex;
          if (rowIndex == null || params.node.rowPinned === 'bottom') return false;
          return isCellInRange(rowIndex, params.colDef.field, cellRangeRef.current, colIndexMapRef!.current);
        },
        'cell-find-match': (params: { context: Record<string, unknown>; colDef: { field?: string }; node: { rowIndex: number | null; rowPinned?: string | null } }) => {
          const { findMatchSet } = params.context as { findMatchSet?: Set<string> };
          if (!findMatchSet?.size || !params.colDef.field) return false;
          const rowIndex = params.node.rowIndex;
          if (rowIndex == null || params.node.rowPinned === 'bottom') return false;
          return findMatchSet.has(`${rowIndex}:${params.colDef.field}`);
        },
        'cell-find-current': (params: { context: Record<string, unknown>; colDef: { field?: string }; node: { rowIndex: number | null; rowPinned?: string | null } }) => {
          const { findCurrentMatchKey } = params.context as { findCurrentMatchKey?: string };
          if (!findCurrentMatchKey || !params.colDef.field) return false;
          const rowIndex = params.node.rowIndex;
          if (rowIndex == null || params.node.rowPinned === 'bottom') return false;
          return `${rowIndex}:${params.colDef.field}` === findCurrentMatchKey;
        },
        'cell-formula': (params: { data: Record<string, unknown>; colDef: { field?: string } }) => {
          if (!params.colDef.field || !params.data) return false;
          const val = params.data[params.colDef.field];
          return typeof val === 'string' && val.startsWith('=');
        },
      },
    };

    // Freeze columns
    if (frozenColumnCount && idx < frozenColumnCount) {
      base.pinned = 'left';
      base.lockPosition = 'left';
    }

    switch (col.type) {
      case 'text':
      case 'phone':
        base.cellEditor = 'agTextCellEditor';
        break;
      case 'number':
        base.cellEditor = 'agNumberCellEditor';
        base.cellEditorParams = { precision: 2 };
        base.cellStyle = { textAlign: 'right' };
        break;
      case 'checkbox':
        base.cellRenderer = 'agCheckboxCellRenderer';
        base.cellEditor = 'agCheckboxCellEditor';
        break;
      case 'singleSelect':
        base.cellEditor = RichSelectCellEditor;
        base.cellEditorPopup = true;
        base.cellEditorParams = { options: col.options || [] };
        base.cellRenderer = TagRenderer;
        break;
      case 'multiSelect':
        base.cellRenderer = MultiTagRenderer;
        base.cellEditor = MultiSelectCellEditor;
        base.cellEditorPopup = true;
        base.cellEditorParams = { options: col.options || [] };
        break;
      case 'date':
        base.cellEditor = 'agDateCellEditor';
        base.cellRenderer = DateRenderer;
        base.cellRendererParams = { dateFormat: settings?.dateFormat || 'MM/DD/YYYY' };
        break;
      case 'url':
        base.cellEditor = 'agTextCellEditor';
        base.cellRenderer = LinkRenderer;
        break;
      case 'attachment':
        base.cellRenderer = AttachmentCellRenderer;
        base.editable = false;
        break;
      case 'email':
        base.cellEditor = 'agTextCellEditor';
        base.cellRenderer = EmailRenderer;
        break;
      case 'currency':
        base.cellEditor = 'agNumberCellEditor';
        base.cellEditorParams = { precision: 2 };
        base.cellRenderer = CurrencyRenderer;
        base.cellRendererParams = { currencySymbol: settings?.currencySymbol || '$' };
        base.cellStyle = { textAlign: 'right' };
        break;
      case 'rating':
        base.cellEditor = 'agNumberCellEditor';
        base.cellEditorParams = { min: 0, max: 5, precision: 0 };
        base.cellRenderer = StarRenderer;
        break;
      case 'percent':
        base.cellEditor = 'agNumberCellEditor';
        base.cellEditorParams = { min: 0, max: 100, precision: 0 };
        base.cellRenderer = PercentRenderer;
        break;
      case 'longText':
        base.cellEditor = 'agLargeTextCellEditor';
        base.cellEditorPopup = true;
        base.cellEditorParams = { maxLength: 5000, rows: 6, cols: 50 };
        break;
      case 'linkedRecord': {
        const linked = col.linkedTableId ? linkedTableData?.get(col.linkedTableId) : undefined;
        base.cellRenderer = LinkedRecordRenderer;
        base.cellRendererParams = {
          linkedRows: linked?.rows ?? [],
          linkedColumns: linked?.columns ?? [],
        };
        base.cellEditor = LinkedRecordEditor;
        base.cellEditorPopup = true;
        base.editable = canEdit;
        break;
      }
    }

    return base;
  });
}
