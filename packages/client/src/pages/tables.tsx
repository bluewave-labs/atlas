import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type CellEditRequestEvent,
  type RowDragEndEvent,
  type ICellRendererParams,
  type CellKeyDownEvent,
  type ColumnResizedEvent,
} from 'ag-grid-community';
import {
  Plus,
  ArrowLeft,
  Trash2,
  RotateCcw,
  Table2,
  LayoutGrid,
  Kanban,
  Search,
  X,
  Undo2,
  Redo2,
  Type,
  Hash,
  CheckSquare,
  ChevronDown,
  List,
  Calendar,
  Link2,
  AtSign,
  DollarSign,
  Phone,
  Star,
  Percent,
  AlignLeft,
  Paperclip,
} from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  useTableList,
  useTable,
  useCreateTable,
  useDeleteTable,
  useRestoreTable,
  useAutoSaveTable,
} from '../hooks/use-tables';
import { ROUTES } from '../config/routes';
import type { TableColumn, TableRow, TableFieldType, TableViewConfig } from '@atlasmail/shared';
import { TableCustomHeader } from '../components/tables/TableCustomHeader';
import { ColumnHeaderMenu } from '../components/tables/ColumnHeaderMenu';
import { RowContextMenu } from '../components/tables/RowContextMenu';
import { SortPopover } from '../components/tables/SortPopover';
import { FilterPopover } from '../components/tables/FilterPopover';
import { ExpandRowModal } from '../components/tables/ExpandRowModal';
import { MultiSelectCellEditor } from '../components/tables/MultiSelectCellEditor';
import '../styles/tables.css';

// ─── AG Grid module registration ────────────────────────────────────

ModuleRegistry.registerModules([AllCommunityModule]);

// ─── Constants ──────────────────────────────────────────────────────

const PLACEHOLDER_ROW_ID = '__placeholder__';
const SIDEBAR_WIDTH_KEY = 'atlasmail_tables_sidebar_width';
const DEFAULT_SIDEBAR_WIDTH = 260;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 400;

function getSavedSidebarWidth(): number {
  try {
    const w = parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) || '', 10);
    if (w >= MIN_SIDEBAR_WIDTH && w <= MAX_SIDEBAR_WIDTH) return w;
  } catch { /* ignore */ }
  return DEFAULT_SIDEBAR_WIDTH;
}

const FIELD_TYPES: { value: TableFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'singleSelect', label: 'Single select' },
  { value: 'multiSelect', label: 'Multi select' },
  { value: 'date', label: 'Date' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'currency', label: 'Currency' },
  { value: 'phone', label: 'Phone' },
  { value: 'rating', label: 'Rating' },
  { value: 'percent', label: 'Percent' },
  { value: 'longText', label: 'Long text' },
  { value: 'attachment', label: 'Attachment' },
];

// ─── Tag color palette ──────────────────────────────────────────────

const TAG_COLORS = [
  '#e8f5e9', '#e3f2fd', '#fce4ec', '#fff3e0', '#f3e5f5',
  '#e0f7fa', '#fff8e1', '#ede7f6', '#e8eaf6', '#fbe9e7',
];

function getTagColor(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = value.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

// ─── Field type icons ───────────────────────────────────────────────

const FIELD_TYPE_ICONS: Record<TableFieldType, React.ComponentType<{ size?: number }>> = {
  text: Type,
  number: Hash,
  checkbox: CheckSquare,
  singleSelect: ChevronDown,
  multiSelect: List,
  date: Calendar,
  url: Link2,
  email: AtSign,
  currency: DollarSign,
  phone: Phone,
  rating: Star,
  percent: Percent,
  longText: AlignLeft,
  attachment: Paperclip,
};

// ─── Default columns/rows for new tables ────────────────────────────

function createDefaultColumns(): TableColumn[] {
  return [
    { id: crypto.randomUUID(), name: 'Name', type: 'text', width: 250 },
    { id: crypto.randomUUID(), name: 'Notes', type: 'longText', width: 300 },
    {
      id: crypto.randomUUID(),
      name: 'Status',
      type: 'singleSelect',
      width: 180,
      options: ['Todo', 'In progress', 'Done'],
    },
  ];
}

function createDefaultRows(count = 3): TableRow[] {
  return Array.from({ length: count }, () => ({
    _id: crypto.randomUUID(),
    _createdAt: new Date().toISOString(),
  }));
}

// ─── Cell renderers ─────────────────────────────────────────────────

function TagRenderer(params: ICellRendererParams) {
  if (!params.value) return null;
  return (
    <span className="tables-cell-tag" style={{ background: getTagColor(String(params.value)) }}>
      {String(params.value)}
    </span>
  );
}

function MultiTagRenderer(params: ICellRendererParams) {
  const values = Array.isArray(params.value) ? params.value : [];
  if (values.length === 0) return null;
  return (
    <div className="tables-cell-multi-tags">
      {values.map((v: string, i: number) => (
        <span key={i} className="tables-cell-tag" style={{ background: getTagColor(v) }}>
          {v}
        </span>
      ))}
    </div>
  );
}

function LinkRenderer(params: ICellRendererParams) {
  if (!params.value) return null;
  const url = String(params.value);
  return (
    <a
      href={url.startsWith('http') ? url : `https://${url}`}
      target="_blank"
      rel="noopener noreferrer"
      className="tables-cell-link"
      onClick={(e) => e.stopPropagation()}
    >
      {url}
    </a>
  );
}

function EmailRenderer(params: ICellRendererParams) {
  if (!params.value) return null;
  return (
    <a href={`mailto:${params.value}`} className="tables-cell-link" onClick={(e) => e.stopPropagation()}>
      {String(params.value)}
    </a>
  );
}

function CurrencyRenderer(params: ICellRendererParams) {
  if (params.value == null || params.value === '') return null;
  const num = Number(params.value);
  if (isNaN(num)) return <span>{String(params.value)}</span>;
  return <span>${num.toFixed(2)}</span>;
}

function StarRenderer(params: ICellRendererParams) {
  const val = Number(params.value) || 0;
  return (
    <div className="tables-cell-stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`tables-cell-star ${i <= val ? '' : 'empty'}`}>&#9733;</span>
      ))}
    </div>
  );
}

function PercentRenderer(params: ICellRendererParams) {
  if (params.value == null || params.value === '') return null;
  const val = Math.min(100, Math.max(0, Number(params.value) || 0));
  return (
    <div className="tables-cell-percent">
      <div className="tables-cell-percent-bar">
        <div className="tables-cell-percent-fill" style={{ width: `${val}%` }} />
      </div>
      <span>{val}%</span>
    </div>
  );
}

function DateRenderer(params: ICellRendererParams) {
  if (!params.value) return null;
  const d = new Date(String(params.value));
  if (isNaN(d.getTime())) return <span>{String(params.value)}</span>;
  return <span>{d.toLocaleDateString()}</span>;
}

// ─── Build AG Grid column defs ──────────────────────────────────────

function buildColDefs(
  columns: TableColumn[],
  t: (key: string) => string,
  onMenuOpen?: (columnId: string, x: number, y: number) => void,
): ColDef[] {
  return columns.map((col, idx) => {
    const TypeIcon = FIELD_TYPE_ICONS[col.type];
    const base: ColDef = {
      field: col.id,
      headerName: col.name,
      editable: true,
      width: col.width || 180,
      resizable: true,
      sortable: true,
      rowDrag: idx === 0,
      headerComponent: TableCustomHeader,
      headerComponentParams: {
        fieldType: col.type,
        fieldTypeIcon: TypeIcon,
        onMenuOpen,
      },
    };

    switch (col.type) {
      case 'text':
      case 'phone':
        base.cellEditor = 'agTextCellEditor';
        break;
      case 'number':
        base.cellEditor = 'agNumberCellEditor';
        base.cellEditorParams = { precision: 2 };
        break;
      case 'checkbox':
        base.cellRenderer = 'agCheckboxCellRenderer';
        base.cellEditor = 'agCheckboxCellEditor';
        break;
      case 'singleSelect':
        base.cellEditor = 'agSelectCellEditor';
        base.cellEditorParams = { values: col.options || [] };
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
        break;
      case 'url':
      case 'attachment':
        base.cellEditor = 'agTextCellEditor';
        base.cellRenderer = LinkRenderer;
        break;
      case 'email':
        base.cellEditor = 'agTextCellEditor';
        base.cellRenderer = EmailRenderer;
        break;
      case 'currency':
        base.cellEditor = 'agNumberCellEditor';
        base.cellEditorParams = { precision: 2 };
        base.cellRenderer = CurrencyRenderer;
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
    }

    return base;
  });
}

// ─── Kanban card (draggable) ────────────────────────────────────────

function KanbanCard({
  row,
  columns,
  groupColumnId,
}: {
  row: TableRow;
  columns: TableColumn[];
  groupColumnId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: row._id,
    data: { row },
  });

  // First text column as title
  const titleCol = columns.find((c) => c.type === 'text' && c.id !== groupColumnId);
  const title = titleCol ? String(row[titleCol.id] || '') : row._id;

  // Meta fields (up to 3, excluding title and group column)
  const metaFields = columns
    .filter((c) => c.id !== groupColumnId && c.id !== titleCol?.id && row[c.id] != null && row[c.id] !== '')
    .slice(0, 3);

  const style: React.CSSProperties = {
    ...(transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : {}),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      className={`tables-kanban-card${isDragging ? ' drag-overlay' : ''}`}
      style={style}
      {...listeners}
      {...attributes}
    >
      <div className="tables-kanban-card-title">{title || 'Untitled'}</div>
      {metaFields.length > 0 && (
        <div className="tables-kanban-card-meta">
          {metaFields.map((col) => (
            <span key={col.id} className="tables-kanban-card-meta-tag">
              {String(row[col.id])}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Kanban column (droppable) ──────────────────────────────────────

function KanbanColumn({
  option,
  rows,
  columns,
  groupColumnId,
}: {
  option: string;
  rows: TableRow[];
  columns: TableColumn[];
  groupColumnId: string;
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: option });

  return (
    <div
      ref={setNodeRef}
      className={`tables-kanban-column${isOver ? ' drop-target' : ''}`}
    >
      <div className="tables-kanban-column-header">
        <span className="tables-kanban-column-title">{option || t('tables.noValue')}</span>
        <span className="tables-kanban-column-count">{rows.length}</span>
      </div>
      <div className="tables-kanban-column-body">
        {rows.length === 0 ? (
          <div className="tables-kanban-column-empty">{t('tables.noItems')}</div>
        ) : (
          rows.map((row) => (
            <KanbanCard key={row._id} row={row} columns={columns} groupColumnId={groupColumnId} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Add column popover ─────────────────────────────────────────────

function AddColumnPopover({
  onAdd,
  onClose,
}: {
  onAdd: (name: string, type: TableFieldType, options?: string[]) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [type, setType] = useState<TableFieldType>('text');
  const [options, setOptions] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const needsOptions = type === 'singleSelect' || type === 'multiSelect';

  const handleSubmit = () => {
    if (!name.trim()) return;
    const opts = needsOptions
      ? options.split(',').map((o) => o.trim()).filter(Boolean)
      : undefined;
    onAdd(name.trim(), type, opts);
    onClose();
  };

  return (
    <div ref={popoverRef} className="tables-add-col-popover" onClick={(e) => e.stopPropagation()}>
      <div>
        <label>{t('tables.columnName')}</label>
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('tables.columnNamePlaceholder')}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
      </div>
      <div>
        <label>{t('tables.fieldType')}</label>
        <select value={type} onChange={(e) => setType(e.target.value as TableFieldType)}>
          {FIELD_TYPES.map((ft) => (
            <option key={ft.value} value={ft.value}>{ft.label}</option>
          ))}
        </select>
      </div>
      {needsOptions && (
        <div>
          <label>{t('tables.options')}</label>
          <input
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            placeholder={t('tables.optionsPlaceholder')}
          />
        </div>
      )}
      <div className="tables-add-col-actions">
        <button onClick={onClose}>{t('tables.cancel')}</button>
        <button className="primary" onClick={handleSubmit}>{t('tables.addColumn')}</button>
      </div>
    </div>
  );
}

// ─── Tables page ────────────────────────────────────────────────────

export function TablesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: paramId } = useParams<{ id: string }>();
  const { data: listData, isLoading: listLoading } = useTableList();
  const { data: archivedData } = useTableList(true);
  const createTable = useCreateTable();
  const deleteTable = useDeleteTable();
  const restoreTable = useRestoreTable();
  const { save: autoSave, isSaving } = useAutoSaveTable();

  const [selectedId, setSelectedId] = useState<string | null>(paramId ?? null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(getSavedSidebarWidth);
  const [showTrash, setShowTrash] = useState(false);

  // Local state for the active spreadsheet (optimistic)
  const [localColumns, setLocalColumns] = useState<TableColumn[]>([]);
  const [localRows, setLocalRows] = useState<TableRow[]>([]);
  const [localViewConfig, setLocalViewConfig] = useState<TableViewConfig>({ activeView: 'grid' });
  const [localTitle, setLocalTitle] = useState('');

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Context menu states
  const [columnMenu, setColumnMenu] = useState<{ columnId: string; x: number; y: number } | null>(null);
  const [rowMenu, setRowMenu] = useState<{ rowId: string; x: number; y: number } | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // Undo/redo
  const undoPastRef = useRef<Array<{ columns: TableColumn[]; rows: TableRow[] }>>([]);
  const undoFutureRef = useRef<Array<{ columns: TableColumn[]; rows: TableRow[] }>>([]);
  const [undoCounter, setUndoCounter] = useState(0); // triggers re-render for canUndo/canRedo

  // Fetch selected spreadsheet
  const { data: spreadsheet } = useTable(selectedId ?? undefined);

  // Sync remote → local when spreadsheet loads
  useEffect(() => {
    if (spreadsheet) {
      setLocalColumns(spreadsheet.columns || []);
      setLocalRows(spreadsheet.rows || []);
      setLocalViewConfig(spreadsheet.viewConfig || { activeView: 'grid' });
      setLocalTitle(spreadsheet.title || '');
    }
  }, [spreadsheet]);

  // When URL param changes
  useEffect(() => {
    if (paramId) setSelectedId(paramId);
  }, [paramId]);

  // Theme detection for AG Grid
  const [isDark, setIsDark] = useState(
    document.documentElement.getAttribute('data-theme') === 'dark'
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Tables list
  const allTables = listData?.spreadsheets ?? [];
  const archivedTables = useMemo(() => {
    const archived = archivedData?.spreadsheets ?? [];
    return archived.filter((s) => s.isArchived);
  }, [archivedData]);

  const filteredTables = useMemo(() => {
    if (!searchQuery.trim()) return allTables;
    const q = searchQuery.toLowerCase();
    return allTables.filter((s) => s.title.toLowerCase().includes(q));
  }, [allTables, searchQuery]);

  // Auto-save trigger
  const triggerAutoSave = useCallback(
    (updates: { columns?: TableColumn[]; rows?: TableRow[]; viewConfig?: TableViewConfig; title?: string }) => {
      if (!selectedId) return;
      autoSave(selectedId, updates);
    },
    [selectedId, autoSave],
  );

  // ─── Undo/redo helpers ─────────────────────────────────────────────

  const pushUndoState = useCallback(() => {
    undoPastRef.current = [...undoPastRef.current.slice(-49), { columns: localColumns, rows: localRows }];
    undoFutureRef.current = [];
    setUndoCounter((c) => c + 1);
  }, [localColumns, localRows]);

  const handleUndo = useCallback(() => {
    if (undoPastRef.current.length === 0) return;
    const prev = undoPastRef.current.pop()!;
    undoFutureRef.current.push({ columns: localColumns, rows: localRows });
    setLocalColumns(prev.columns);
    setLocalRows(prev.rows);
    triggerAutoSave({ columns: prev.columns, rows: prev.rows });
    setUndoCounter((c) => c + 1);
  }, [localColumns, localRows, triggerAutoSave]);

  const handleRedo = useCallback(() => {
    if (undoFutureRef.current.length === 0) return;
    const next = undoFutureRef.current.pop()!;
    undoPastRef.current.push({ columns: localColumns, rows: localRows });
    setLocalColumns(next.columns);
    setLocalRows(next.rows);
    triggerAutoSave({ columns: next.columns, rows: next.rows });
    setUndoCounter((c) => c + 1);
  }, [localColumns, localRows, triggerAutoSave]);

  // undoCounter is referenced to ensure re-renders update canUndo/canRedo
  const canUndo = undoCounter >= 0 && undoPastRef.current.length > 0;
  const canRedo = undoCounter >= 0 && undoFutureRef.current.length > 0;

  // Placeholder row style
  const getRowStyle = useCallback((params: { data?: { _id?: string } }) => {
    if (params.data?._id === PLACEHOLDER_ROW_ID) {
      return { opacity: '0.4', fontStyle: 'italic' } as Record<string, string>;
    }
    return undefined;
  }, []);

  // ─── Data pipeline: filter → sort → rowData ─────────────────────

  const filteredRows = useMemo(() => {
    const filters = localViewConfig.filters;
    if (!filters || filters.length === 0) return localRows;

    return localRows.filter((row) => {
      return filters.every((f) => {
        const val = row[f.columnId];
        const strVal = val != null ? String(val) : '';
        const filterVal = f.value != null ? String(f.value) : '';

        switch (f.operator) {
          case 'contains': return strVal.toLowerCase().includes(filterVal.toLowerCase());
          case 'doesNotContain': return !strVal.toLowerCase().includes(filterVal.toLowerCase());
          case 'is': return strVal === filterVal;
          case 'isNot': return strVal !== filterVal;
          case 'isEmpty': return val == null || strVal === '';
          case 'isNotEmpty': return val != null && strVal !== '';
          case 'greaterThan': return Number(val) > Number(f.value);
          case 'lessThan': return Number(val) < Number(f.value);
          case 'isBefore': return new Date(strVal) < new Date(filterVal);
          case 'isAfter': return new Date(strVal) > new Date(filterVal);
          case 'isChecked': return val === true;
          case 'isNotChecked': return val !== true;
          case 'isAnyOf': {
            const opts = Array.isArray(f.value) ? f.value : [];
            return opts.includes(strVal);
          }
          case 'isNoneOf': {
            const opts = Array.isArray(f.value) ? f.value : [];
            return !opts.includes(strVal);
          }
          default: return true;
        }
      });
    });
  }, [localRows, localViewConfig.filters]);

  const sortedRows = useMemo(() => {
    const sorts = localViewConfig.sorts;
    if (!sorts || sorts.length === 0) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      for (const sort of sorts) {
        const aVal = a[sort.columnId];
        const bVal = b[sort.columnId];
        const aStr = aVal != null ? String(aVal) : '';
        const bStr = bVal != null ? String(bVal) : '';
        const dir = sort.direction === 'desc' ? -1 : 1;

        // Numeric comparison if both are numbers
        const aNum = Number(aStr);
        const bNum = Number(bStr);
        if (!isNaN(aNum) && !isNaN(bNum) && aStr !== '' && bStr !== '') {
          if (aNum !== bNum) return (aNum - bNum) * dir;
          continue;
        }

        const cmp = aStr.localeCompare(bStr);
        if (cmp !== 0) return cmp * dir;
      }
      return 0;
    });
  }, [filteredRows, localViewConfig.sorts]);

  const rowData = sortedRows;

  // Global keyboard shortcuts (undo, redo, search)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd+Z → undo
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      // Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z → redo
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
        return;
      }
      // Ctrl/Cmd+F → search
      if (mod && e.key === 'f' && selectedId) {
        e.preventDefault();
        setShowSearch(true);
      }
      // Escape → close search
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchText('');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo, selectedId, showSearch]);

  // ─── Handlers ──────────────────────────────────────────────────────

  const handleSelectTable = useCallback(
    (id: string) => {
      setSelectedId(id);
      navigate(`/tables/${id}`, { replace: true });
    },
    [navigate],
  );

  const handleCreateTable = useCallback(async () => {
    const columns = createDefaultColumns();
    const rows = createDefaultRows(3);
    const created = await createTable.mutateAsync({ columns, rows });
    handleSelectTable(created.id);
  }, [createTable, handleSelectTable]);

  const handleDeleteTable = useCallback(
    (id: string) => {
      deleteTable.mutate(id);
      if (selectedId === id) {
        setSelectedId(null);
        navigate(ROUTES.TABLES, { replace: true });
      }
    },
    [deleteTable, selectedId, navigate],
  );

  const handleRestoreTable = useCallback(
    (id: string) => {
      restoreTable.mutate(id);
    },
    [restoreTable],
  );

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setLocalTitle(newTitle);
      triggerAutoSave({ title: newTitle });
    },
    [triggerAutoSave],
  );

  const handleAddColumn = useCallback(
    (name: string, type: TableFieldType, options?: string[]) => {
      pushUndoState();
      const newCol: TableColumn = {
        id: crypto.randomUUID(),
        name,
        type,
        width: 180,
        options: options?.length ? options : undefined,
      };
      const updated = [...localColumns, newCol];
      setLocalColumns(updated);
      triggerAutoSave({ columns: updated });
    },
    [localColumns, triggerAutoSave, pushUndoState],
  );

  const handleAddRow = useCallback(() => {
    pushUndoState();
    const newRow: TableRow = {
      _id: crypto.randomUUID(),
      _createdAt: new Date().toISOString(),
    };
    const updated = [...localRows, newRow];
    setLocalRows(updated);
    triggerAutoSave({ rows: updated });
  }, [localRows, triggerAutoSave, pushUndoState]);

  const handleDeleteRow = useCallback(
    (rowId: string) => {
      pushUndoState();
      const updated = localRows.filter((r) => r._id !== rowId);
      setLocalRows(updated);
      triggerAutoSave({ rows: updated });
    },
    [localRows, triggerAutoSave, pushUndoState],
  );

  // ─── Column context menu handlers ─────────────────────────────────

  const handleRenameColumn = useCallback(
    (colId: string, newName: string) => {
      pushUndoState();
      const updated = localColumns.map((c) =>
        c.id === colId ? { ...c, name: newName } : c,
      );
      setLocalColumns(updated);
      triggerAutoSave({ columns: updated });
    },
    [localColumns, triggerAutoSave, pushUndoState],
  );

  const handleDeleteColumn = useCallback(
    (colId: string) => {
      pushUndoState();
      const updatedCols = localColumns.filter((c) => c.id !== colId);
      const updatedRows = localRows.map((r) => {
        const copy = { ...r };
        delete copy[colId];
        return copy;
      });
      setLocalColumns(updatedCols);
      setLocalRows(updatedRows);
      triggerAutoSave({ columns: updatedCols, rows: updatedRows });
    },
    [localColumns, localRows, triggerAutoSave, pushUndoState],
  );

  const handleDuplicateColumn = useCallback(
    (colId: string) => {
      pushUndoState();
      const source = localColumns.find((c) => c.id === colId);
      if (!source) return;
      const newId = crypto.randomUUID();
      const newCol: TableColumn = { ...source, id: newId, name: `${source.name} (copy)` };
      const idx = localColumns.findIndex((c) => c.id === colId);
      const updatedCols = [...localColumns];
      updatedCols.splice(idx + 1, 0, newCol);
      // Copy data from all rows
      const updatedRows = localRows.map((r) => ({ ...r, [newId]: r[colId] }));
      setLocalColumns(updatedCols);
      setLocalRows(updatedRows);
      triggerAutoSave({ columns: updatedCols, rows: updatedRows });
    },
    [localColumns, localRows, triggerAutoSave, pushUndoState],
  );

  const handleChangeColumnType = useCallback(
    (colId: string, newType: TableFieldType) => {
      pushUndoState();
      const updated = localColumns.map((c) => {
        if (c.id !== colId) return c;
        const newCol: TableColumn = { ...c, type: newType };
        // Add default options for select types
        if ((newType === 'singleSelect' || newType === 'multiSelect') && !newCol.options?.length) {
          newCol.options = ['Option 1', 'Option 2', 'Option 3'];
        }
        // Clear options for non-select types
        if (newType !== 'singleSelect' && newType !== 'multiSelect') {
          delete newCol.options;
        }
        return newCol;
      });
      setLocalColumns(updated);
      triggerAutoSave({ columns: updated });
    },
    [localColumns, triggerAutoSave, pushUndoState],
  );

  const handleSortByColumn = useCallback(
    (colId: string, direction: 'asc' | 'desc') => {
      const sorts = [{ columnId: colId, direction }];
      const updated = { ...localViewConfig, sorts };
      setLocalViewConfig(updated);
      triggerAutoSave({ viewConfig: updated });
    },
    [localViewConfig, triggerAutoSave],
  );

  // ─── Row context menu handlers ────────────────────────────────────

  const handleInsertRowAbove = useCallback(
    (rowId: string) => {
      pushUndoState();
      const idx = localRows.findIndex((r) => r._id === rowId);
      if (idx < 0) return;
      const newRow: TableRow = { _id: crypto.randomUUID(), _createdAt: new Date().toISOString() };
      const updated = [...localRows];
      updated.splice(idx, 0, newRow);
      setLocalRows(updated);
      triggerAutoSave({ rows: updated });
    },
    [localRows, triggerAutoSave, pushUndoState],
  );

  const handleInsertRowBelow = useCallback(
    (rowId: string) => {
      pushUndoState();
      const idx = localRows.findIndex((r) => r._id === rowId);
      if (idx < 0) return;
      const newRow: TableRow = { _id: crypto.randomUUID(), _createdAt: new Date().toISOString() };
      const updated = [...localRows];
      updated.splice(idx + 1, 0, newRow);
      setLocalRows(updated);
      triggerAutoSave({ rows: updated });
    },
    [localRows, triggerAutoSave, pushUndoState],
  );

  const handleDuplicateRow = useCallback(
    (rowId: string) => {
      pushUndoState();
      const idx = localRows.findIndex((r) => r._id === rowId);
      if (idx < 0) return;
      const source = localRows[idx];
      const newRow: TableRow = { ...source, _id: crypto.randomUUID(), _createdAt: new Date().toISOString() };
      const updated = [...localRows];
      updated.splice(idx + 1, 0, newRow);
      setLocalRows(updated);
      triggerAutoSave({ rows: updated });
    },
    [localRows, triggerAutoSave, pushUndoState],
  );

  // Handle row context menu event from AG Grid
  const handleCellContextMenu = useCallback(
    (event: { data?: TableRow; event?: Event | null }) => {
      const mouseEvent = event.event as MouseEvent | undefined;
      if (!mouseEvent || !event.data) return;
      if (event.data._id === PLACEHOLDER_ROW_ID) return;
      mouseEvent.preventDefault();
      setRowMenu({ rowId: event.data._id, x: mouseEvent.clientX, y: mouseEvent.clientY });
    },
    [],
  );

  // Handle row field update (for expand modal)
  const handleUpdateRowField = useCallback(
    (rowId: string, colId: string, value: unknown) => {
      const updatedRows = localRows.map((r) =>
        r._id === rowId ? { ...r, [colId]: value } : r,
      );
      setLocalRows(updatedRows);
      triggerAutoSave({ rows: updatedRows });
    },
    [localRows, triggerAutoSave],
  );

  // Placeholder row for inline "add row"
  const pinnedBottomRowData = useMemo(() => [{ _id: PLACEHOLDER_ROW_ID, _createdAt: '' }], []);

  // AG Grid cell edit (controlled / read-only edit)
  const handleCellEditRequest = useCallback(
    (event: CellEditRequestEvent) => {
      const rowId = (event.data as TableRow)._id;
      const colId = event.colDef.field!;
      const newValue = event.newValue;

      pushUndoState();

      // If editing the placeholder row, create a real row first
      if (rowId === PLACEHOLDER_ROW_ID) {
        const newRow: TableRow = {
          _id: crypto.randomUUID(),
          _createdAt: new Date().toISOString(),
          [colId]: newValue,
        };
        const updated = [...localRows, newRow];
        setLocalRows(updated);
        triggerAutoSave({ rows: updated });
        return;
      }

      const updatedRows = localRows.map((r) =>
        r._id === rowId ? { ...r, [colId]: newValue } : r,
      );
      setLocalRows(updatedRows);
      triggerAutoSave({ rows: updatedRows });
    },
    [localRows, triggerAutoSave, pushUndoState],
  );

  // AG Grid cell keyboard handling
  const handleCellKeyDown = useCallback(
    (event: CellKeyDownEvent) => {
      const kbEvent = event.event as KeyboardEvent | undefined;
      if (!kbEvent) return;

      // Delete/Backspace clears cell value (only when not in edit mode)
      if ((kbEvent.key === 'Delete' || kbEvent.key === 'Backspace') && !(event as unknown as { editing?: boolean }).editing) {
        const colId = event.colDef.field;
        if (!colId) return;
        const rowId = (event.data as TableRow)?._id;
        if (!rowId || rowId === PLACEHOLDER_ROW_ID) return;

        const updatedRows = localRows.map((r) =>
          r._id === rowId ? { ...r, [colId]: undefined } : r,
        );
        setLocalRows(updatedRows);
        triggerAutoSave({ rows: updatedRows });
      }
    },
    [localRows, triggerAutoSave],
  );

  // AG Grid row drag reorder
  const handleRowDragEnd = useCallback(
    (event: RowDragEndEvent) => {
      const movedData = event.node.data as TableRow;
      const overIndex = event.overIndex;
      if (overIndex < 0) return;

      const copy = localRows.filter((r) => r._id !== movedData._id);
      copy.splice(overIndex, 0, movedData);
      setLocalRows(copy);
      triggerAutoSave({ rows: copy });
    },
    [localRows, triggerAutoSave],
  );

  // Column resize persistence
  const handleColumnResized = useCallback(
    (event: ColumnResizedEvent) => {
      if (!event.finished || !event.column) return;
      const colId = event.column.getColId();
      // Skip row number column (no colId match in localColumns)
      const colIndex = localColumns.findIndex((c) => c.id === colId);
      if (colIndex < 0) return;
      const newWidth = event.column.getActualWidth();
      const updated = localColumns.map((c, i) =>
        i === colIndex ? { ...c, width: newWidth } : c,
      );
      setLocalColumns(updated);
      triggerAutoSave({ columns: updated });
    },
    [localColumns, triggerAutoSave],
  );

  // View toggle
  const handleViewToggle = useCallback(
    (view: 'grid' | 'kanban') => {
      const updated = { ...localViewConfig, activeView: view };
      setLocalViewConfig(updated);
      triggerAutoSave({ viewConfig: updated });
    },
    [localViewConfig, triggerAutoSave],
  );

  // AG Grid column defs
  const ROW_NUMBER_COL: ColDef = useMemo(() => ({
    headerName: '',
    width: 50,
    maxWidth: 50,
    minWidth: 50,
    pinned: 'left',
    editable: false,
    sortable: false,
    resizable: false,
    suppressMovable: true,
    lockPosition: 'left',
    cellStyle: { color: 'var(--color-text-tertiary)', textAlign: 'center', fontSize: '12px' },
    valueGetter: (params) => params.node?.rowIndex != null ? params.node.rowIndex + 1 : '',
  }), []);

  const handleColumnMenuOpen = useCallback((columnId: string, x: number, y: number) => {
    setColumnMenu({ columnId, x, y });
  }, []);

  const columnDefs = useMemo(
    () => [ROW_NUMBER_COL, ...buildColDefs(localColumns, t, handleColumnMenuOpen)],
    [localColumns, t, ROW_NUMBER_COL, handleColumnMenuOpen],
  );

  // Kanban DnD
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const kanbanGroupCol = localColumns.find(
    (c) => c.id === localViewConfig.kanbanGroupByColumnId && c.type === 'singleSelect',
  );

  // If no kanban group column is set, try to auto-pick the first singleSelect
  const effectiveKanbanCol = kanbanGroupCol ?? localColumns.find((c) => c.type === 'singleSelect');

  const kanbanGroups = useMemo(() => {
    if (!effectiveKanbanCol) return null;
    const opts = effectiveKanbanCol.options || [];
    const grouped: Record<string, TableRow[]> = {};
    for (const opt of opts) {
      grouped[opt] = [];
    }
    grouped[''] = []; // uncategorized
    for (const row of localRows) {
      const val = String(row[effectiveKanbanCol.id] || '');
      if (!grouped[val]) grouped[val] = [];
      grouped[val].push(row);
    }
    return grouped;
  }, [effectiveKanbanCol, localRows]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggedRowId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggedRowId(null);
      if (!event.over || !effectiveKanbanCol) return;

      const rowId = event.active.id as string;
      const newValue = event.over.id as string;

      const updatedRows = localRows.map((r) =>
        r._id === rowId ? { ...r, [effectiveKanbanCol.id]: newValue } : r,
      );
      setLocalRows(updatedRows);
      triggerAutoSave({ rows: updatedRows });
    },
    [effectiveKanbanCol, localRows, triggerAutoSave],
  );

  const draggedRow = draggedRowId ? localRows.find((r) => r._id === draggedRowId) : null;

  // Sidebar resize
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const latestWidthRef = useRef(sidebarWidth);
  latestWidthRef.current = sidebarWidth;

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizeRef.current = { startX: e.clientX, startWidth: latestWidthRef.current };

      const handleMove = (ev: MouseEvent) => {
        if (!resizeRef.current) return;
        const newWidth = Math.min(
          MAX_SIDEBAR_WIDTH,
          Math.max(MIN_SIDEBAR_WIDTH, resizeRef.current.startWidth + (ev.clientX - resizeRef.current.startX)),
        );
        setSidebarWidth(newWidth);
        latestWidthRef.current = newWidth;
      };

      const handleUp = () => {
        document.removeEventListener('mousemove', handleMove);
        document.removeEventListener('mouseup', handleUp);
        localStorage.setItem(SIDEBAR_WIDTH_KEY, String(latestWidthRef.current));
        resizeRef.current = null;
      };

      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleUp);
    },
    [],
  );

  // Row data for AG Grid (with getRowId)
  const getRowId = useCallback((params: { data: TableRow }) => params.data._id, []);

  // Select columns for kanban group-by
  const selectColumns = localColumns.filter((c) => c.type === 'singleSelect');

  return (
    <div className="tables-page">
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <div className="tables-sidebar" style={{ width: sidebarWidth, position: 'relative' }}>
        <div className="tables-sidebar-header">
          <button className="tables-back-btn" onClick={() => navigate(ROUTES.HOME)} title={t('tables.backToHome')}>
            <ArrowLeft size={16} />
          </button>
          <span className="tables-sidebar-title">{t('tables.title')}</span>
          <button
            className="tables-toolbar-btn"
            onClick={handleCreateTable}
            title={t('tables.newTable')}
            style={{ marginLeft: 'auto', padding: '4px 8px' }}
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="tables-sidebar-search">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('tables.searchTables')}
          />
        </div>

        <div className="tables-sidebar-list">
          {filteredTables.length === 0 && !listLoading && (
            <div className="tables-sidebar-empty">{t('tables.noTables')}</div>
          )}

          {filteredTables.map((table) => (
            <div
              key={table.id}
              role="button"
              tabIndex={0}
              className={`tables-sidebar-item${selectedId === table.id ? ' active' : ''}`}
              onClick={() => handleSelectTable(table.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSelectTable(table.id); }}
            >
              <Table2 size={14} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {table.title}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTable(table.id);
                }}
                style={{
                  border: 'none', background: 'none', padding: 2, cursor: 'pointer',
                  color: 'var(--color-text-tertiary)', opacity: 0, transition: 'opacity 100ms',
                }}
                className="tables-sidebar-delete-btn"
                title={t('tables.delete')}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}

          {/* Trash section */}
          {archivedTables.length > 0 && (
            <>
              <button
                className="tables-sidebar-item"
                onClick={() => setShowTrash(!showTrash)}
                style={{ marginTop: 8 }}
              >
                <Trash2 size={14} />
                <span>{t('tables.trash')}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                  {archivedTables.length}
                </span>
              </button>
              {showTrash &&
                archivedTables.map((table) => (
                  <div
                    key={table.id}
                    className="tables-sidebar-item archived"
                  >
                    <Table2 size={14} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {table.title}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestoreTable(table.id);
                      }}
                      style={{ border: 'none', background: 'none', padding: 2, cursor: 'pointer', color: 'var(--color-text-tertiary)' }}
                      title={t('tables.restore')}
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                ))}
            </>
          )}
        </div>

        {/* Resize handle */}
        <div className="tables-sidebar-resize" onMouseDown={handleResizeStart} />
      </div>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div className="tables-main">
        {!selectedId || !spreadsheet ? (
          <div className="tables-empty-state">
            <Table2 size={48} className="tables-empty-state-icon" />
            <div className="tables-empty-state-title">{t('tables.emptyTitle')}</div>
            <div className="tables-empty-state-desc">{t('tables.emptyDesc')}</div>
            <button className="tables-toolbar-btn" onClick={handleCreateTable}>
              <Plus size={14} /> {t('tables.newTable')}
            </button>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="tables-toolbar">
              <input
                className="tables-toolbar-title"
                value={localTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={() => triggerAutoSave({ title: localTitle })}
              />

              <div style={{ position: 'relative' }}>
                <button className="tables-toolbar-btn" onClick={() => setShowAddColumn(!showAddColumn)}>
                  <Plus size={14} /> {t('tables.column')}
                </button>
                {showAddColumn && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 100 }}>
                    <AddColumnPopover onAdd={handleAddColumn} onClose={() => setShowAddColumn(false)} />
                  </div>
                )}
              </div>

              <SortPopover
                columns={localColumns}
                viewConfig={localViewConfig}
                onUpdate={(sorts) => {
                  const updated = { ...localViewConfig, sorts };
                  setLocalViewConfig(updated);
                  triggerAutoSave({ viewConfig: updated });
                }}
              />

              <FilterPopover
                columns={localColumns}
                viewConfig={localViewConfig}
                onUpdate={(filters) => {
                  const updated = { ...localViewConfig, filters };
                  setLocalViewConfig(updated);
                  triggerAutoSave({ viewConfig: updated });
                }}
              />

              <div className="tables-toolbar-spacer" />

              {/* Kanban group-by selector */}
              {localViewConfig.activeView === 'kanban' && selectColumns.length > 0 && (
                <select
                  value={localViewConfig.kanbanGroupByColumnId || effectiveKanbanCol?.id || ''}
                  onChange={(e) => {
                    const updated = { ...localViewConfig, kanbanGroupByColumnId: e.target.value };
                    setLocalViewConfig(updated);
                    triggerAutoSave({ viewConfig: updated });
                  }}
                  style={{
                    padding: '4px 8px',
                    border: '1px solid var(--color-border-primary)',
                    borderRadius: 'var(--radius-md, 4px)',
                    background: 'var(--color-bg-primary)',
                    color: 'var(--color-text-secondary)',
                    fontSize: 'var(--font-size-sm)',
                    fontFamily: 'var(--font-family)',
                    height: 30,
                  }}
                >
                  {selectColumns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}

              <button
                className="tables-toolbar-btn"
                onClick={handleUndo}
                disabled={!canUndo}
                title={t('tables.undo')}
                style={{ opacity: canUndo ? 1 : 0.4 }}
              >
                <Undo2 size={14} />
              </button>
              <button
                className="tables-toolbar-btn"
                onClick={handleRedo}
                disabled={!canRedo}
                title={t('tables.redo')}
                style={{ opacity: canRedo ? 1 : 0.4 }}
              >
                <Redo2 size={14} />
              </button>

              <button
                className={`tables-toolbar-btn${showSearch ? ' active' : ''}`}
                onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchText(''); }}
                title={t('tables.search')}
              >
                <Search size={14} />
              </button>

              {isSaving && (
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                  {t('tables.saving')}
                </span>
              )}

              {/* View toggle */}
              <div className="tables-view-toggle">
                <button
                  className={localViewConfig.activeView === 'grid' ? 'active' : ''}
                  onClick={() => handleViewToggle('grid')}
                  title={t('tables.gridView')}
                >
                  <LayoutGrid size={14} />
                </button>
                <button
                  className={localViewConfig.activeView === 'kanban' ? 'active' : ''}
                  onClick={() => handleViewToggle('kanban')}
                  title={t('tables.kanbanView')}
                >
                  <Kanban size={14} />
                </button>
              </div>
            </div>

            {/* Search bar */}
            {showSearch && (
              <div className="tables-search-bar">
                <Search size={14} />
                <input
                  autoFocus
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder={t('tables.searchPlaceholder')}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setShowSearch(false); setSearchText(''); } }}
                />
                <button onClick={() => { setShowSearch(false); setSearchText(''); }}>
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Grid view */}
            {localViewConfig.activeView === 'grid' && (
              <>
                <div className="tables-grid-container">
                  <div className={isDark ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'}>
                    <AgGridReact
                      columnDefs={columnDefs}
                      rowData={rowData}
                      getRowId={getRowId}
                      readOnlyEdit={true}
                      onCellEditRequest={handleCellEditRequest}
                      onCellKeyDown={handleCellKeyDown}
                      onColumnResized={handleColumnResized}
                      rowDragManaged={false}
                      onRowDragEnd={handleRowDragEnd}
                      animateRows={true}
                      undoRedoCellEditing={false}
                      suppressMoveWhenRowDragging={true}
                      rowSelection={{ mode: 'multiRow' }}
                      enterNavigatesVertically={true}
                      enterNavigatesVerticallyAfterEdit={true}
                      enableCellTextSelection={true}
                      ensureDomOrder={true}
                      suppressContextMenu={true}
                      onCellContextMenu={handleCellContextMenu}
                      pinnedBottomRowData={pinnedBottomRowData}
                      getRowStyle={getRowStyle}
                      quickFilterText={searchText}
                      context={{ deleteRow: handleDeleteRow }}
                    />
                  </div>
                </div>
                <div className="tables-footer">
                  <button className="tables-footer-btn" onClick={handleAddRow}>
                    <Plus size={14} /> {t('tables.addRow')}
                  </button>
                  <span>{t('tables.rowCount', { count: localRows.length })}</span>
                </div>
              </>
            )}

            {/* Kanban view */}
            {localViewConfig.activeView === 'kanban' && (
              <>
                {!effectiveKanbanCol ? (
                  <div className="tables-kanban-no-group">
                    <Kanban size={36} style={{ opacity: 0.3 }} />
                    <div>{t('tables.kanbanNoSelectColumn')}</div>
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="tables-kanban-board">
                      {kanbanGroups &&
                        Object.entries(kanbanGroups).map(([option, rows]) => (
                          <KanbanColumn
                            key={option}
                            option={option}
                            rows={rows}
                            columns={localColumns}
                            groupColumnId={effectiveKanbanCol.id}
                          />
                        ))}
                    </div>
                    <DragOverlay>
                      {draggedRow ? (
                        <div className="tables-kanban-card drag-overlay">
                          <div className="tables-kanban-card-title">
                            {(() => {
                              const titleCol = localColumns.find((c) => c.type === 'text' && c.id !== effectiveKanbanCol?.id);
                              return titleCol ? String(draggedRow[titleCol.id] || 'Untitled') : 'Untitled';
                            })()}
                          </div>
                        </div>
                      ) : null}
                    </DragOverlay>
                  </DndContext>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Column header context menu */}
      {columnMenu && (() => {
        const col = localColumns.find((c) => c.id === columnMenu.columnId);
        if (!col) return null;
        return (
          <ColumnHeaderMenu
            columnId={columnMenu.columnId}
            columnName={col.name}
            columnType={col.type}
            x={columnMenu.x}
            y={columnMenu.y}
            onClose={() => setColumnMenu(null)}
            onRename={handleRenameColumn}
            onDelete={handleDeleteColumn}
            onDuplicate={handleDuplicateColumn}
            onChangeType={handleChangeColumnType}
            onSortAsc={(colId) => handleSortByColumn(colId, 'asc')}
            onSortDesc={(colId) => handleSortByColumn(colId, 'desc')}
          />
        );
      })()}

      {/* Row context menu */}
      {rowMenu && (
        <RowContextMenu
          rowId={rowMenu.rowId}
          x={rowMenu.x}
          y={rowMenu.y}
          onClose={() => setRowMenu(null)}
          onInsertAbove={handleInsertRowAbove}
          onInsertBelow={handleInsertRowBelow}
          onDuplicate={handleDuplicateRow}
          onExpand={(rowId) => setExpandedRowId(rowId)}
          onDelete={handleDeleteRow}
        />
      )}

      {/* Expand row modal */}
      {expandedRowId && (() => {
        const row = localRows.find((r) => r._id === expandedRowId);
        if (!row) return null;
        return (
          <ExpandRowModal
            row={row}
            columns={localColumns}
            open={true}
            onOpenChange={(open) => { if (!open) setExpandedRowId(null); }}
            onUpdateField={handleUpdateRowField}
          />
        );
      })()}

      {/* Hover effect for sidebar delete buttons */}
      <style>{`
        .tables-sidebar-item:hover .tables-sidebar-delete-btn {
          opacity: 1 !important;
        }
      `}</style>
    </div>
  );
}
