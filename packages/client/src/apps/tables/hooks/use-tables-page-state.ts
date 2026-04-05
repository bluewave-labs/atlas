import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AgGridReact } from 'ag-grid-react';
import type {
  ColDef,
  CellEditRequestEvent,
  RowDragEndEvent,
  CellKeyDownEvent,
  ColumnResizedEvent,
  ColumnMovedEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';
import * as XLSX from 'xlsx';
import {
  useTableList,
  useTable,
  useCreateTable,
  useDeleteTable,
  useRestoreTable,
  useAutoSaveTable,
} from '../hooks';
import { ROUTES } from '../../../config/routes';
import type { TableColumn, TableRow, TableFieldType, TableViewConfig, TableAttachment, TableViewTab } from '@atlasmail/shared';
import { api } from '../../../lib/api-client';
import { useCellRangeSelection } from '../hooks/use-cell-range-selection';
import { useTablesSettingsStore } from '../settings-store';
import { useUIStore } from '../../../stores/ui-store';
import { useToastStore } from '../../../stores/toast-store';
import { useFindReplace } from '../hooks/use-find-replace';
import { useFillHandle } from '../hooks/use-fill-handle';
import { useRowGrouping } from '../hooks/use-row-grouping';
import { useFormulas } from '../hooks/use-formulas';
import { isFormulaValue } from '../../../lib/formula-engine';
import { getTagColor } from '../../../lib/tag-colors';
import { PLACEHOLDER_ROW_ID, LAST_TABLE_KEY, createDefaultColumns, createDefaultRows } from '../lib/table-constants';
import { buildColDefs, type BuildColDefsSettings } from '../lib/build-col-defs';
import { TABLE_TEMPLATES } from '../lib/table-template-data';
import type { TableTemplate } from '../lib/table-template-data';
import type { ImportModalData } from '../components/ImportModal';

export function useTablesPageState() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: paramId } = useParams<{ id: string }>();
  const { data: listData, isLoading: listLoading } = useTableList();
  const { data: archivedData } = useTableList(true);
  const createTable = useCreateTable();
  const deleteTable = useDeleteTable();
  const restoreTable = useRestoreTable();
  const { save: autoSave, isSaving, isSuccess: isSaveSuccess } = useAutoSaveTable();
  const tablesSettings = useTablesSettingsStore();
  const { openSettings } = useUIStore();

  const [selectedId, setSelectedId] = useState<string | null>(
    paramId ?? localStorage.getItem(LAST_TABLE_KEY) ?? null,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // "Saved" indicator auto-dismiss
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isSaveSuccess && !isSaving) {
      setShowSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setShowSaved(false), 2000);
    }
  }, [isSaveSuccess, isSaving]);
  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  // Local state for the active spreadsheet (optimistic)
  const [localColumns, setLocalColumns] = useState<TableColumn[]>([]);
  const [localRows, setLocalRows] = useState<TableRow[]>([]);
  const [localViewConfig, setLocalViewConfig] = useState<TableViewConfig>({ activeView: 'grid' });
  const [localTitle, setLocalTitle] = useState('');

  // Linked record
  const linkedTableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const col of localColumns) {
      if (col.type === 'linkedRecord' && col.linkedTableId) {
        ids.add(col.linkedTableId);
      }
    }
    return Array.from(ids);
  }, [localColumns]);

  const [linkedTablesMap, setLinkedTablesMap] = useState<Map<string, { rows: Array<{ _id: string; [key: string]: unknown }>; columns: Array<{ id: string; name: string }> }>>(new Map());

  useEffect(() => {
    if (linkedTableIds.length === 0) return;
    let cancelled = false;
    const fetchLinked = async () => {
      const newMap = new Map(linkedTablesMap);
      for (const tableId of linkedTableIds) {
        if (newMap.has(tableId)) continue;
        try {
          const { data: resp } = await api.get(`/tables/${tableId}`);
          const tbl = resp.data;
          newMap.set(tableId, {
            rows: tbl.rows ?? [],
            columns: (tbl.columns ?? []).map((c: any) => ({ id: c.id, name: c.name })),
          });
        } catch {
          // ignore
        }
      }
      if (!cancelled) setLinkedTablesMap(newMap);
    };
    fetchLinked();
    return () => { cancelled = true; };
  }, [linkedTableIds.join(',')]);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Context menu states
  const [columnMenu, setColumnMenu] = useState<{ columnId: string; x: number; y: number } | null>(null);
  const [rowMenu, setRowMenu] = useState<{ rowId: string; x: number; y: number } | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  // Import modal state
  const [importModalData, setImportModalData] = useState<ImportModalData | null>(null);

  // Attachment upload
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const pendingAttachmentCellRef = useRef<{ rowId: string; colId: string } | null>(null);

  // View tabs
  const [showAddViewDropdown, setShowAddViewDropdown] = useState(false);
  const addViewBtnRef = useRef<HTMLButtonElement>(null);
  const addViewDropdownRef = useRef<HTMLDivElement>(null);

  // Header dropdown
  const [showHeaderDropdown, setShowHeaderDropdown] = useState(false);
  const headerChevronRef = useRef<HTMLButtonElement>(null);
  const [localColor, setLocalColor] = useState<string | undefined>(undefined);
  const [localIcon, setLocalIcon] = useState<string | undefined>(undefined);
  const [localGuide, setLocalGuide] = useState<string | undefined>(undefined);

  // Close add-view dropdown on outside click
  useEffect(() => {
    if (!showAddViewDropdown) return;
    const handler = (e: MouseEvent) => {
      if (addViewBtnRef.current?.contains(e.target as Node) || addViewDropdownRef.current?.contains(e.target as Node)) return;
      setShowAddViewDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAddViewDropdown]);

  // Undo/redo
  const undoPastRef = useRef<Array<{ columns: TableColumn[]; rows: TableRow[] }>>([]);
  const undoFutureRef = useRef<Array<{ columns: TableColumn[]; rows: TableRow[] }>>([]);
  const [undoCounter, setUndoCounter] = useState(0);

  // Fetch selected spreadsheet
  const { data: spreadsheet, error: tableError } = useTable(selectedId ?? undefined);

  // Sync remote -> local
  useEffect(() => {
    if (spreadsheet) {
      setLocalColumns(spreadsheet.columns || []);
      setLocalRows(spreadsheet.rows || []);
      setLocalViewConfig(spreadsheet.viewConfig || { activeView: 'grid' });
      setLocalTitle(spreadsheet.title || '');
      setLocalColor(spreadsheet.color ?? undefined);
      setLocalIcon(spreadsheet.icon ?? undefined);
      setLocalGuide(spreadsheet.guide ?? undefined);
    }
  }, [spreadsheet]);

  useEffect(() => { if (paramId) setSelectedId(paramId); }, [paramId]);

  useEffect(() => {
    if (!paramId && selectedId) {
      navigate(`/tables/${selectedId}`, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tableError && (tableError as any)?.response?.status === 404) {
      setSelectedId(null);
      localStorage.removeItem(LAST_TABLE_KEY);
      navigate(ROUTES.TABLES, { replace: true });
    }
  }, [tableError, navigate]);

  // Theme detection
  const [isDark, setIsDark] = useState(document.documentElement.getAttribute('data-theme') === 'dark');

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
    (updates: { columns?: TableColumn[]; rows?: TableRow[]; viewConfig?: TableViewConfig; title?: string; color?: string; icon?: string; guide?: string }) => {
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

  const canUndo = undoCounter >= 0 && undoPastRef.current.length > 0;
  const canRedo = undoCounter >= 0 && undoFutureRef.current.length > 0;

  // Placeholder row style + conditional row coloring
  const getRowStyle = useCallback((params: { data?: { _id?: string; [key: string]: unknown } }) => {
    if (params.data?._id === PLACEHOLDER_ROW_ID) {
      return { opacity: '0.4', fontStyle: 'italic' } as Record<string, string>;
    }
    if (localViewConfig.rowColorMode === 'bySelectField' && localViewConfig.rowColorColumnId && params.data) {
      const val = params.data[localViewConfig.rowColorColumnId];
      if (val != null && String(val) !== '') {
        const color = getTagColor(String(val));
        return { borderLeft: `3px solid ${color.bg}`, background: `${color.bg}33` } as Record<string, string>;
      }
    }
    return undefined;
  }, [localViewConfig.rowColorMode, localViewConfig.rowColorColumnId]);

  // ─── Data pipeline ──────────────────────────────────────────────

  const filteredRows = useMemo(() => {
    let result = localRows;

    const filters = localViewConfig.filters;
    if (filters && filters.length > 0) {
      result = result.filter((row) => {
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
            case 'isAnyOf': { const opts = Array.isArray(f.value) ? f.value : []; return opts.includes(strVal); }
            case 'isNoneOf': { const opts = Array.isArray(f.value) ? f.value : []; return !opts.includes(strVal); }
            default: return true;
          }
        });
      });
    }

    const setFilters = localViewConfig.setFilters;
    if (setFilters && Object.keys(setFilters).length > 0) {
      result = result.filter((row) => {
        return Object.entries(setFilters).every(([colId, allowedValues]) => {
          const val = row[colId];
          const strVal = val != null ? String(val) : '';
          if (Array.isArray(val)) {
            return (val as string[]).some((v) => allowedValues.includes(String(v)));
          }
          return allowedValues.includes(strVal);
        });
      });
    }

    return result;
  }, [localRows, localViewConfig.filters, localViewConfig.setFilters]);

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

  // Row grouping
  const { groupedRows, toggleGroup, clearGrouping, isGrouped } = useRowGrouping({
    rows: sortedRows,
    groupByColumnId: localViewConfig.groupByColumnId ?? null,
    columns: localColumns,
  });

  const rowData = isGrouped ? groupedRows : sortedRows;

  // Formulas
  const { getComputedValue, getCellReference } = useFormulas({
    rows: localRows,
    columns: localColumns,
    hiddenColumns: localViewConfig.hiddenColumns,
  });

  // Footer aggregation
  const footerAgg = useMemo(() => {
    const numCol = localColumns.find((c) => c.type === 'number' || c.type === 'currency' || c.type === 'percent');
    if (!numCol) return null;
    const values = sortedRows.map((r) => Number(r[numCol.id])).filter((n) => !isNaN(n));
    if (values.length === 0) return null;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const isCurrency = numCol.type === 'currency';
    const isPercent = numCol.type === 'percent';
    const cs = tablesSettings.currencySymbol || '$';
    return {
      label: numCol.name,
      sum: isCurrency ? `${cs}${sum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : isPercent ? `${sum}%` : sum.toLocaleString(),
      avg: isCurrency ? `${cs}${avg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : isPercent ? `${avg.toFixed(1)}%` : avg.toLocaleString(undefined, { maximumFractionDigits: 1 }),
    };
  }, [localColumns, sortedRows, tablesSettings.currencySymbol]);

  // AG Grid ref
  const gridRef = useRef<AgGridReact>(null);

  // Cell range selection
  const {
    rangeContext, handleCellClicked: handleRangeCellClicked, handleCellMouseDown: handleRangeCellMouseDown,
    handleHeaderClicked: handleRangeHeaderClicked, handleRangeKeyDown, handleGlobalKeyDown: handleRangeGlobalKeyDown,
    clearRange, rebuildColIndexMap, rangeVersion, getSelectedCellCount, getCellsInRange,
  } = useCellRangeSelection(gridRef);

  useEffect(() => { rebuildColIndexMap(); }, [localColumns, localViewConfig.hiddenColumns, rebuildColIndexMap]);

  // Find & replace
  const handleUpdateRowsDirect = useCallback((updatedRows: TableRow[]) => {
    setLocalRows(updatedRows);
    triggerAutoSave({ rows: updatedRows });
  }, [triggerAutoSave]);

  const findReplace = useFindReplace({
    gridRef, rows: localRows, columns: localColumns, hiddenColumns: localViewConfig.hiddenColumns,
    onUpdateRows: handleUpdateRowsDirect, pushUndoState,
  });

  // Fill handle
  const fillHandle = useFillHandle({
    gridRef, rows: localRows, onUpdateRows: handleUpdateRowsDirect, pushUndoState,
  });

  // Batch edit state
  const [showBatchEdit, setShowBatchEdit] = useState(false);

  // Formula bar state
  const [focusedCellInfo, setFocusedCellInfo] = useState<{ rowId: string; colId: string; rowIndex: number } | null>(null);

  useEffect(() => {
    const gridApi = gridRef.current?.api;
    if (!gridApi) return;
    const onCellFocused = () => {
      const focused = gridApi.getFocusedCell();
      if (focused && focused.rowPinned == null) {
        const rowNode = gridApi.getDisplayedRowAtIndex(focused.rowIndex);
        if (rowNode) {
          const rowId = (rowNode.data as TableRow)?._id;
          if (rowId && rowId !== PLACEHOLDER_ROW_ID) {
            setFocusedCellInfo({ rowId, colId: focused.column.getColId(), rowIndex: focused.rowIndex });
            return;
          }
        }
      }
      setFocusedCellInfo(null);
    };
    gridApi.addEventListener('cellFocused', onCellFocused);
    return () => { gridApi.removeEventListener('cellFocused', onCellFocused); };
  }, [gridRef, localRows]);

  // Clipboard paste
  const handlePaste = useCallback(async () => {
    const gridApi = gridRef.current?.api;
    if (!gridApi) return;
    const isEditing = gridApi.getEditingCells()?.length ?? 0;
    if (isEditing > 0) return false;

    let text: string;
    try { text = await navigator.clipboard.readText(); } catch { return false; }
    if (!text) return false;

    const pastedRows = text.split('\n').map((line) => line.split('\t'));
    if (pastedRows.length === 0 || (pastedRows.length === 1 && pastedRows[0].length === 1 && pastedRows[0][0] === '')) return false;

    let startRow: number;
    let startColId: string;

    const range = rangeContext.cellRangeRef.current;
    if (range) {
      startRow = Math.min(range.anchor.rowIndex, range.end.rowIndex);
      const anchorColIdx = rangeContext.colIndexMapRef.current.get(range.anchor.colId) ?? 0;
      const endColIdx = rangeContext.colIndexMapRef.current.get(range.end.colId) ?? 0;
      const minColIdx = Math.min(anchorColIdx, endColIdx);
      const sortedEntries = Array.from(rangeContext.colIndexMapRef.current.entries()).sort((a, b) => a[1] - b[1]);
      const found = sortedEntries.find(([, idx]) => idx === minColIdx);
      startColId = found ? found[0] : range.anchor.colId;
    } else {
      const focused = gridApi.getFocusedCell();
      if (!focused || focused.rowPinned != null) return false;
      startRow = focused.rowIndex;
      startColId = focused.column.getColId();
    }

    const sortedCols = Array.from(rangeContext.colIndexMapRef.current.entries()).sort((a, b) => a[1] - b[1]).map(([id]) => id);
    const startColIdx = sortedCols.indexOf(startColId);
    if (startColIdx < 0) return false;

    pushUndoState();
    const updatedRows = [...localRows];
    for (let r = 0; r < pastedRows.length; r++) {
      const targetRowIdx = startRow + r;
      const rowNode = gridApi.getDisplayedRowAtIndex(targetRowIdx);
      if (!rowNode || rowNode.rowPinned === 'bottom') continue;
      const rowId = (rowNode.data as TableRow)?._id;
      if (!rowId || rowId === PLACEHOLDER_ROW_ID) continue;
      const localIdx = updatedRows.findIndex((lr) => lr._id === rowId);
      if (localIdx < 0) continue;
      const rowCopy = { ...updatedRows[localIdx] };
      for (let c = 0; c < pastedRows[r].length; c++) {
        const targetColId = sortedCols[startColIdx + c];
        if (!targetColId) break;
        rowCopy[targetColId] = pastedRows[r][c];
      }
      updatedRows[localIdx] = rowCopy;
    }
    setLocalRows(updatedRows);
    triggerAutoSave({ rows: updatedRows });
    gridApi.refreshCells({ force: true });
    return true;
  }, [localRows, triggerAutoSave, pushUndoState, rangeContext]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (handleRangeGlobalKeyDown(e)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'v') {
        const gridApi = gridRef.current?.api;
        const isEditing = gridApi?.getEditingCells()?.length ?? 0;
        if (isEditing === 0) { e.preventDefault(); handlePaste(); return; }
      }
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); return; }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo(); return; }
      if (mod && e.key === 'f' && selectedId) { e.preventDefault(); findReplace.open(); return; }
      if (mod && e.key === 'h' && selectedId) { e.preventDefault(); findReplace.open(); return; }
      if (e.key === 'Escape') {
        if (findReplace.isOpen) findReplace.close();
        else if (showBatchEdit) setShowBatchEdit(false);
        else if (showSearch) { setShowSearch(false); setSearchText(''); }
        else if (selectedRowIds.length > 0) { gridRef.current?.api?.deselectAll(); setSelectedRowIds([]); }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo, handlePaste, selectedId, showSearch, showBatchEdit, selectedRowIds, handleRangeGlobalKeyDown, findReplace]);

  // ─── Handlers ──────────────────────────────────────────────────────

  const handleSelectTable = useCallback((id: string) => {
    setSelectedId(id); setShowTemplates(false);
    localStorage.setItem(LAST_TABLE_KEY, id);
    navigate(`/tables/${id}`, { replace: true });
  }, [navigate]);

  const handleCreateTable = useCallback(async () => {
    const columns = createDefaultColumns();
    const rows = createDefaultRows(tablesSettings.defaultRowCount);
    const created = await createTable.mutateAsync({ columns, rows });
    handleSelectTable(created.id);
  }, [createTable, handleSelectTable, tablesSettings.defaultRowCount]);

  const handleCreateFromTemplate = useCallback(async (tplOrKey: TableTemplate | string) => {
    const tpl = typeof tplOrKey === 'string' ? TABLE_TEMPLATES.find((t) => t.key === tplOrKey) : tplOrKey;
    if (!tpl) return;
    const { title, columns, rows } = tpl.createData();
    const created = await createTable.mutateAsync({ title, columns, rows });
    handleSelectTable(created.id);
    setShowTemplates(false);
  }, [createTable, handleSelectTable]);

  const handleDeleteTable = useCallback((id: string) => { setDeleteConfirmId(id); }, []);

  const confirmDeleteTable = useCallback(() => {
    if (!deleteConfirmId) return;
    deleteTable.mutate(deleteConfirmId);
    if (selectedId === deleteConfirmId) { setSelectedId(null); localStorage.removeItem(LAST_TABLE_KEY); navigate(ROUTES.TABLES, { replace: true }); }
    setDeleteConfirmId(null);
  }, [deleteConfirmId, deleteTable, selectedId, navigate]);

  const handleRestoreTable = useCallback((id: string) => { restoreTable.mutate(id); }, [restoreTable]);

  const handleTitleChange = useCallback((newTitle: string) => {
    setLocalTitle(newTitle); triggerAutoSave({ title: newTitle });
  }, [triggerAutoSave]);

  const handleAddColumn = useCallback((name: string, type: TableFieldType, options?: string[], linkedTableId?: string) => {
    pushUndoState();
    const newCol: TableColumn = { id: crypto.randomUUID(), name, type, width: 180, options: options?.length ? options : undefined, linkedTableId: linkedTableId || undefined };
    const updated = [...localColumns, newCol];
    setLocalColumns(updated); triggerAutoSave({ columns: updated });
  }, [localColumns, triggerAutoSave, pushUndoState]);

  const handleAddRow = useCallback(() => {
    pushUndoState();
    const newRow: TableRow = { _id: crypto.randomUUID(), _createdAt: new Date().toISOString() };
    const updated = [...localRows, newRow];
    setLocalRows(updated); triggerAutoSave({ rows: updated });
  }, [localRows, triggerAutoSave, pushUndoState]);

  const handleDeleteRow = useCallback((rowId: string) => {
    pushUndoState();
    const updated = localRows.filter((r) => r._id !== rowId);
    setLocalRows(updated); triggerAutoSave({ rows: updated });
  }, [localRows, triggerAutoSave, pushUndoState]);

  const handleRenameColumn = useCallback((colId: string, newName: string) => {
    pushUndoState();
    const updated = localColumns.map((c) => c.id === colId ? { ...c, name: newName } : c);
    setLocalColumns(updated); triggerAutoSave({ columns: updated });
  }, [localColumns, triggerAutoSave, pushUndoState]);

  const handleDeleteColumn = useCallback((colId: string) => {
    pushUndoState();
    const updatedCols = localColumns.filter((c) => c.id !== colId);
    const updatedRows = localRows.map((r) => { const copy = { ...r }; delete copy[colId]; return copy; });
    setLocalColumns(updatedCols); setLocalRows(updatedRows);
    triggerAutoSave({ columns: updatedCols, rows: updatedRows });
  }, [localColumns, localRows, triggerAutoSave, pushUndoState]);

  const handleDuplicateColumn = useCallback((colId: string) => {
    pushUndoState();
    const source = localColumns.find((c) => c.id === colId);
    if (!source) return;
    const newId = crypto.randomUUID();
    const newCol: TableColumn = { ...source, id: newId, name: `${source.name} (copy)` };
    const idx = localColumns.findIndex((c) => c.id === colId);
    const updatedCols = [...localColumns]; updatedCols.splice(idx + 1, 0, newCol);
    const updatedRows = localRows.map((r) => ({ ...r, [newId]: r[colId] }));
    setLocalColumns(updatedCols); setLocalRows(updatedRows);
    triggerAutoSave({ columns: updatedCols, rows: updatedRows });
  }, [localColumns, localRows, triggerAutoSave, pushUndoState]);

  const handleChangeColumnType = useCallback((colId: string, newType: TableFieldType) => {
    pushUndoState();
    const updated = localColumns.map((c) => {
      if (c.id !== colId) return c;
      const newCol: TableColumn = { ...c, type: newType };
      if ((newType === 'singleSelect' || newType === 'multiSelect') && !newCol.options?.length) newCol.options = ['Option 1', 'Option 2', 'Option 3'];
      if (newType !== 'singleSelect' && newType !== 'multiSelect') delete newCol.options;
      return newCol;
    });
    setLocalColumns(updated); triggerAutoSave({ columns: updated });
  }, [localColumns, triggerAutoSave, pushUndoState]);

  const handleSortByColumn = useCallback((colId: string, direction: 'asc' | 'desc') => {
    const sorts = [{ columnId: colId, direction }];
    const updated = { ...localViewConfig, sorts };
    setLocalViewConfig(updated); triggerAutoSave({ viewConfig: updated });
  }, [localViewConfig, triggerAutoSave]);

  const handleInsertRowAbove = useCallback((rowId: string) => {
    pushUndoState();
    const idx = localRows.findIndex((r) => r._id === rowId); if (idx < 0) return;
    const newRow: TableRow = { _id: crypto.randomUUID(), _createdAt: new Date().toISOString() };
    const updated = [...localRows]; updated.splice(idx, 0, newRow);
    setLocalRows(updated); triggerAutoSave({ rows: updated });
  }, [localRows, triggerAutoSave, pushUndoState]);

  const handleInsertRowBelow = useCallback((rowId: string) => {
    pushUndoState();
    const idx = localRows.findIndex((r) => r._id === rowId); if (idx < 0) return;
    const newRow: TableRow = { _id: crypto.randomUUID(), _createdAt: new Date().toISOString() };
    const updated = [...localRows]; updated.splice(idx + 1, 0, newRow);
    setLocalRows(updated); triggerAutoSave({ rows: updated });
  }, [localRows, triggerAutoSave, pushUndoState]);

  const handleDuplicateRow = useCallback((rowId: string) => {
    pushUndoState();
    const idx = localRows.findIndex((r) => r._id === rowId); if (idx < 0) return;
    const source = localRows[idx];
    const newRow: TableRow = { ...source, _id: crypto.randomUUID(), _createdAt: new Date().toISOString() };
    const updated = [...localRows]; updated.splice(idx + 1, 0, newRow);
    setLocalRows(updated); triggerAutoSave({ rows: updated });
  }, [localRows, triggerAutoSave, pushUndoState]);

  const handleCellContextMenu = useCallback((event: { data?: TableRow; event?: Event | null }) => {
    const mouseEvent = event.event as MouseEvent | undefined;
    if (!mouseEvent || !event.data) return;
    if (event.data._id === PLACEHOLDER_ROW_ID) return;
    mouseEvent.preventDefault();
    setRowMenu({ rowId: event.data._id, x: mouseEvent.clientX, y: mouseEvent.clientY });
  }, []);

  const handleSelectionChanged = useCallback((event: SelectionChangedEvent) => {
    const rows = event.api.getSelectedRows() as TableRow[];
    const ids = rows.map((r) => r._id).filter((id) => id !== PLACEHOLDER_ROW_ID);
    setSelectedRowIds(ids);
    if (ids.length > 0) clearRange();
    event.api.refreshCells({ columns: ['__row_number__'], force: true });
  }, [clearRange]);

  const handleBulkDelete = useCallback(() => {
    if (selectedRowIds.length === 0) return;
    pushUndoState();
    const idSet = new Set(selectedRowIds);
    const updated = localRows.filter((r) => !idSet.has(r._id));
    setLocalRows(updated); triggerAutoSave({ rows: updated });
    gridRef.current?.api?.deselectAll(); setSelectedRowIds([]);
  }, [selectedRowIds, localRows, triggerAutoSave, pushUndoState]);

  const handleBulkDuplicate = useCallback(() => {
    if (selectedRowIds.length === 0) return;
    pushUndoState();
    const idSet = new Set(selectedRowIds);
    const updated: TableRow[] = [];
    for (const row of localRows) {
      updated.push(row);
      if (idSet.has(row._id)) updated.push({ ...row, _id: crypto.randomUUID(), _createdAt: new Date().toISOString() });
    }
    setLocalRows(updated); triggerAutoSave({ rows: updated });
    gridRef.current?.api?.deselectAll(); setSelectedRowIds([]);
  }, [selectedRowIds, localRows, triggerAutoSave, pushUndoState]);

  const handleClearSelection = useCallback(() => {
    gridRef.current?.api?.deselectAll(); setSelectedRowIds([]);
  }, []);

  const handleUpdateRowField = useCallback((rowId: string, colId: string, value: unknown) => {
    const updatedRows = localRows.map((r) => r._id === rowId ? { ...r, [colId]: value } : r);
    setLocalRows(updatedRows); triggerAutoSave({ rows: updatedRows });
  }, [localRows, triggerAutoSave]);

  const handleAttachmentUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const pending = pendingAttachmentCellRef.current;
    if (!file || !pending) return;
    const formData = new FormData(); formData.append('file', file);
    try {
      const { data: resp } = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const attachment: TableAttachment = resp.data;
      const row = localRows.find((r) => r._id === pending.rowId);
      const existing: TableAttachment[] = Array.isArray(row?.[pending.colId]) ? (row![pending.colId] as TableAttachment[]) : [];
      handleUpdateRowField(pending.rowId, pending.colId, [...existing, attachment]);
    } catch {
      useToastStore.getState().addToast({ message: t('tables.uploadFailed', 'File upload failed'), type: 'error' });
    }
    if (attachmentInputRef.current) attachmentInputRef.current.value = '';
    pendingAttachmentCellRef.current = null;
  }, [localRows, handleUpdateRowField]);

  const handleCellClickedWithAttachment = useCallback((event: any) => {
    const colId = event.colDef?.field;
    const col = localColumns.find((c) => c.id === colId);
    if (col?.type === 'attachment') {
      const rowId = event.data?._id;
      if (rowId && rowId !== PLACEHOLDER_ROW_ID) {
        pendingAttachmentCellRef.current = { rowId, colId };
        attachmentInputRef.current?.click(); return;
      }
    }
    if (col?.type === 'singleSelect' || col?.type === 'multiSelect') {
      const rowId = event.data?._id;
      if (rowId && rowId !== PLACEHOLDER_ROW_ID) {
        const gridApi = gridRef.current?.api;
        if (gridApi && gridApi.getEditingCells().length === 0) {
          gridApi.startEditingCell({ rowIndex: event.rowIndex, colKey: colId });
        }
      }
    }
    handleRangeCellClicked(event);
  }, [localColumns, handleRangeCellClicked]);

  const pinnedBottomRowData = useMemo(() => [{ _id: PLACEHOLDER_ROW_ID, _createdAt: '' }], []);

  const handleCellEditRequest = useCallback((event: CellEditRequestEvent) => {
    const rowId = (event.data as TableRow)._id;
    const colId = event.colDef.field!;
    const newValue = event.newValue;
    pushUndoState();
    if (rowId === PLACEHOLDER_ROW_ID) {
      const newRow: TableRow = { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [colId]: newValue };
      const updated = [...localRows, newRow];
      setLocalRows(updated); triggerAutoSave({ rows: updated }); return;
    }
    const updatedRows = localRows.map((r) => r._id === rowId ? { ...r, [colId]: newValue } : r);
    setLocalRows(updatedRows); triggerAutoSave({ rows: updatedRows });
  }, [localRows, triggerAutoSave, pushUndoState]);

  const handleCellKeyDown = useCallback((event: CellKeyDownEvent) => {
    const kbEvent = event.event as KeyboardEvent | undefined;
    if (!kbEvent) return;
    handleRangeKeyDown(event);
    const isEditing = gridRef.current?.api?.getEditingCells()?.length ?? 0;
    if (isEditing === 0 && getSelectedCellCount() > 1 && kbEvent.key.length === 1 && !kbEvent.metaKey && !kbEvent.ctrlKey && !kbEvent.altKey) {
      kbEvent.preventDefault(); setShowBatchEdit(true); return;
    }
    if ((kbEvent.key === 'Delete' || kbEvent.key === 'Backspace') && isEditing === 0) {
      const rangeCells = getCellsInRange();
      if (rangeCells.length > 0) {
        pushUndoState();
        const gridApi = gridRef.current?.api; if (!gridApi) return;
        const clearMap = new Map<string, Set<string>>();
        for (const cell of rangeCells) {
          const rowNode = gridApi.getDisplayedRowAtIndex(cell.rowIndex);
          if (!rowNode || rowNode.rowPinned === 'bottom') continue;
          const rowId = (rowNode.data as TableRow)?._id;
          if (!rowId || rowId === PLACEHOLDER_ROW_ID) continue;
          if (!clearMap.has(rowId)) clearMap.set(rowId, new Set());
          clearMap.get(rowId)!.add(cell.colId);
        }
        const updatedRows = localRows.map((r) => {
          const colIds = clearMap.get(r._id); if (!colIds) return r;
          const copy = { ...r }; for (const cid of colIds) copy[cid] = undefined; return copy;
        });
        setLocalRows(updatedRows); triggerAutoSave({ rows: updatedRows }); clearRange(); return;
      }
      const colId = event.colDef.field; if (!colId) return;
      const rowId = (event.data as TableRow)?._id;
      if (!rowId || rowId === PLACEHOLDER_ROW_ID) return;
      pushUndoState();
      const updatedRows = localRows.map((r) => r._id === rowId ? { ...r, [colId]: undefined } : r);
      setLocalRows(updatedRows); triggerAutoSave({ rows: updatedRows });
    }
  }, [localRows, triggerAutoSave, pushUndoState, handleRangeKeyDown, getCellsInRange, clearRange]);

  const handleRowDragEnd = useCallback((event: RowDragEndEvent) => {
    const movedData = event.node.data as TableRow;
    const overIndex = event.overIndex; if (overIndex < 0) return;
    pushUndoState();
    const copy = localRows.filter((r) => r._id !== movedData._id);
    copy.splice(overIndex, 0, movedData);
    setLocalRows(copy); triggerAutoSave({ rows: copy });
  }, [localRows, triggerAutoSave, pushUndoState]);

  const handleColumnResized = useCallback((event: ColumnResizedEvent) => {
    if (!event.finished || !event.column) return;
    const colId = event.column.getColId();
    const colIndex = localColumns.findIndex((c) => c.id === colId); if (colIndex < 0) return;
    const newWidth = event.column.getActualWidth();
    const updated = localColumns.map((c, i) => i === colIndex ? { ...c, width: newWidth } : c);
    setLocalColumns(updated); triggerAutoSave({ columns: updated });
  }, [localColumns, triggerAutoSave]);

  const handleColumnMoved = useCallback((event: ColumnMovedEvent) => {
    if (!event.finished || !event.column) return;
    const gridApi = gridRef.current?.api; if (!gridApi) return;
    const hidden = new Set(localViewConfig.hiddenColumns || []);
    const allDisplayedCols = gridApi.getAllDisplayedColumns();
    const visibleOrder: string[] = [];
    for (const agCol of allDisplayedCols) {
      const id = agCol.getColId();
      if (localColumns.some((c) => c.id === id)) visibleOrder.push(id);
    }
    const currentVisibleOrder = localColumns.filter((c) => !hidden.has(c.id)).map((c) => c.id);
    if (JSON.stringify(visibleOrder) === JSON.stringify(currentVisibleOrder)) return;
    const visibleSet = new Set(visibleOrder);
    const reordered = [...visibleOrder.map((id) => localColumns.find((c) => c.id === id)!), ...localColumns.filter((c) => !visibleSet.has(c.id))];
    setLocalColumns(reordered); triggerAutoSave({ columns: reordered });
  }, [localColumns, localViewConfig.hiddenColumns, triggerAutoSave]);

  const handleHideColumn = useCallback((colId: string) => {
    const hidden = new Set(localViewConfig.hiddenColumns || []); hidden.add(colId);
    const updated = { ...localViewConfig, hiddenColumns: Array.from(hidden) };
    setLocalViewConfig(updated); triggerAutoSave({ viewConfig: updated });
  }, [localViewConfig, triggerAutoSave]);

  const handleFreezeUpTo = useCallback((colId: string) => {
    const idx = localColumns.findIndex((c) => c.id === colId); if (idx < 0) return;
    const count = Math.min(idx + 1, 3);
    const updated = { ...localViewConfig, frozenColumnCount: count };
    setLocalViewConfig(updated); triggerAutoSave({ viewConfig: updated });
  }, [localColumns, localViewConfig, triggerAutoSave]);

  const handleUnfreezeColumns = useCallback(() => {
    const updated = { ...localViewConfig, frozenColumnCount: 0 };
    setLocalViewConfig(updated); triggerAutoSave({ viewConfig: updated });
  }, [localViewConfig, triggerAutoSave]);

  const handleInsertColumnLeft = useCallback((colId: string) => {
    pushUndoState();
    const idx = localColumns.findIndex((c) => c.id === colId); if (idx < 0) return;
    const newCol: TableColumn = { id: crypto.randomUUID(), name: t('tables.newColumnName'), type: 'text', width: 180 };
    const updated = [...localColumns]; updated.splice(idx, 0, newCol);
    setLocalColumns(updated); triggerAutoSave({ columns: updated });
  }, [localColumns, triggerAutoSave, pushUndoState, t]);

  const handleInsertColumnRight = useCallback((colId: string) => {
    pushUndoState();
    const idx = localColumns.findIndex((c) => c.id === colId); if (idx < 0) return;
    const newCol: TableColumn = { id: crypto.randomUUID(), name: t('tables.newColumnName'), type: 'text', width: 180 };
    const updated = [...localColumns]; updated.splice(idx + 1, 0, newCol);
    setLocalColumns(updated); triggerAutoSave({ columns: updated });
  }, [localColumns, triggerAutoSave, pushUndoState, t]);

  const handleEditColumnDescription = useCallback((colId: string, description: string) => {
    const updated = localColumns.map((c) => c.id === colId ? { ...c, description: description || undefined } : c);
    setLocalColumns(updated); triggerAutoSave({ columns: updated });
  }, [localColumns, triggerAutoSave]);

  const handleExportExcel = useCallback(() => {
    const hidden = new Set(localViewConfig.hiddenColumns || []);
    const visibleCols = localColumns.filter((c) => !hidden.has(c.id));
    const exportData = sortedRows.map((row) => {
      const obj: Record<string, unknown> = {};
      if (tablesSettings.includeRowIdsInExport) obj['_id'] = row._id;
      for (const col of visibleCols) {
        let val = row[col.id];
        if (isFormulaValue(val)) val = getComputedValue(row._id, col.id, val);
        if (Array.isArray(val)) val = val.join(', ');
        obj[col.name] = val ?? '';
      }
      return obj;
    });
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${localTitle || 'table'}.xlsx`);
  }, [localColumns, sortedRows, localViewConfig.hiddenColumns, localTitle, getComputedValue, tablesSettings.includeRowIdsInExport]);

  const importInputRef = useRef<HTMLInputElement>(null);
  const handleImportCSV = useCallback(() => { importInputRef.current?.click(); }, []);

  const handleFileImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 50 * 1024 * 1024) { useToastStore.getState().addToast({ type: 'error', message: 'File must be under 50 MB' }); return; }
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
      if (jsonData.length < 1) return;
      const firstRow = jsonData[0] as unknown[];
      const allStrings = firstRow.every((v) => typeof v === 'string' && v.trim().length > 0);
      const hasHeader = allStrings;
      const headerRow = hasHeader ? firstRow.map((h) => String(h || 'Column')) : firstRow.map((_, i) => `Column ${i + 1}`);
      const dataRows = hasHeader ? jsonData.slice(1) : jsonData;
      const columnMappings = headerRow.map((name, idx) => {
        const sampleValues = dataRows.slice(0, 10).map((r) => r[idx]).filter(Boolean);
        let type: TableFieldType = 'text';
        if (sampleValues.length > 0 && sampleValues.every((v) => typeof v === 'number' || !isNaN(Number(v)))) type = 'number';
        else if (sampleValues.length > 0 && sampleValues.every((v) => typeof v === 'boolean' || v === 'true' || v === 'false')) type = 'checkbox';
        return { name: String(name), type };
      });
      setImportModalData({ fileName: file.name.replace(/\.(csv|xlsx?|xls)$/i, ''), allRows: jsonData, firstRowHeader: hasHeader, columnMappings });
    } catch (error) { console.error('Import failed:', error); }
    e.target.value = '';
  }, []);

  const handleImportConfirm = useCallback(async () => {
    if (!importModalData) return;
    const { fileName, allRows, firstRowHeader, columnMappings } = importModalData;
    const dataRows = firstRowHeader ? allRows.slice(1) : allRows;
    const columns: TableColumn[] = columnMappings.map((col) => ({ id: crypto.randomUUID(), name: col.name, type: col.type, width: 150 }));
    const rows: TableRow[] = dataRows.map((row) => {
      const cells: Record<string, unknown> = { _id: crypto.randomUUID(), _createdAt: new Date().toISOString() };
      columns.forEach((col, idx) => { cells[col.id] = (row as unknown[])[idx] ?? ''; });
      return cells as TableRow;
    });
    try {
      const created = await createTable.mutateAsync({ title: fileName, columns, rows });
      handleSelectTable(created.id);
    } catch (error) { console.error('Import failed:', error); }
    setImportModalData(null);
  }, [importModalData, createTable, handleSelectTable]);

  const handleGroupByColumn = useCallback((colId: string) => {
    const updated = { ...localViewConfig, groupByColumnId: colId };
    setLocalViewConfig(updated); triggerAutoSave({ viewConfig: updated });
  }, [localViewConfig, triggerAutoSave]);

  const handleUngroupRows = useCallback(() => {
    const updated = { ...localViewConfig, groupByColumnId: null };
    setLocalViewConfig(updated); triggerAutoSave({ viewConfig: updated }); clearGrouping();
  }, [localViewConfig, triggerAutoSave, clearGrouping]);

  const handleBatchEditConfirm = useCallback((value: string) => {
    const cells = getCellsInRange(); if (cells.length === 0) return;
    const gridApi = gridRef.current?.api; if (!gridApi) return;
    pushUndoState();
    const updateMap = new Map<string, Record<string, unknown>>();
    for (const cell of cells) {
      const rowNode = gridApi.getDisplayedRowAtIndex(cell.rowIndex);
      if (!rowNode || rowNode.rowPinned === 'bottom') continue;
      const rowId = (rowNode.data as TableRow)?._id;
      if (!rowId || rowId === PLACEHOLDER_ROW_ID) continue;
      if (!updateMap.has(rowId)) updateMap.set(rowId, {});
      updateMap.get(rowId)![cell.colId] = value;
    }
    const updatedRows = localRows.map((r) => { const updates = updateMap.get(r._id); return updates ? { ...r, ...updates } : r; });
    setLocalRows(updatedRows); triggerAutoSave({ rows: updatedRows });
    setShowBatchEdit(false); clearRange();
  }, [localRows, getCellsInRange, pushUndoState, triggerAutoSave, clearRange]);

  const handleFormulaBarEdit = useCallback((value: string) => {
    if (!focusedCellInfo) return;
    pushUndoState();
    const updatedRows = localRows.map((r) => r._id === focusedCellInfo.rowId ? { ...r, [focusedCellInfo.colId]: value } : r);
    setLocalRows(updatedRows); triggerAutoSave({ rows: updatedRows });
  }, [focusedCellInfo, localRows, pushUndoState, triggerAutoSave]);

  const currentViews: TableViewTab[] = useMemo(
    () => localViewConfig.views?.length ? localViewConfig.views : [{ key: 'grid', label: 'Grid view' }],
    [localViewConfig.views],
  );

  const handleViewToggle = useCallback((view: TableViewConfig['activeView']) => {
    const updated = { ...localViewConfig, activeView: view };
    setLocalViewConfig(updated); triggerAutoSave({ viewConfig: updated });
  }, [localViewConfig, triggerAutoSave]);

  const handleAddView = useCallback((key: TableViewTab['key'], label: string) => {
    const views = [...currentViews, { key, label }];
    const updated = { ...localViewConfig, views, activeView: key };
    setLocalViewConfig(updated); triggerAutoSave({ viewConfig: updated }); setShowAddViewDropdown(false);
  }, [currentViews, localViewConfig, triggerAutoSave]);

  const handleRemoveView = useCallback((index: number) => {
    if (currentViews.length <= 1) return;
    const views = currentViews.filter((_, i) => i !== index);
    const removedView = currentViews[index];
    const activeView = removedView.key === localViewConfig.activeView ? views[0].key : localViewConfig.activeView;
    const updated = { ...localViewConfig, views, activeView };
    setLocalViewConfig(updated); triggerAutoSave({ viewConfig: updated });
  }, [currentViews, localViewConfig, triggerAutoSave]);

  const hiddenColumnsSet = useMemo(() => new Set(localViewConfig.hiddenColumns || []), [localViewConfig.hiddenColumns]);
  const handleColumnMenuOpen = useCallback((columnId: string, x: number, y: number) => { setColumnMenu({ columnId, x, y }); }, []);

  const kanbanGroupCol = localColumns.find((c) => c.id === localViewConfig.kanbanGroupByColumnId && c.type === 'singleSelect');
  const effectiveKanbanCol = kanbanGroupCol ?? localColumns.find((c) => c.type === 'singleSelect');
  const selectColumns = localColumns.filter((c) => c.type === 'singleSelect');
  const getRowId = useCallback((params: { data: TableRow }) => params.data._id, []);

  return {
    // State values
    t, selectedId, searchQuery, setSearchQuery, showAddColumn, setShowAddColumn,
    showTrash, setShowTrash, showTemplates, setShowTemplates, deleteConfirmId, setDeleteConfirmId,
    showSaved, isSaving,
    localColumns, setLocalColumns, localRows, setLocalRows, localViewConfig, setLocalViewConfig, localTitle, setLocalTitle,
    linkedTablesMap,
    showSearch, setShowSearch, searchText, setSearchText,
    columnMenu, setColumnMenu, rowMenu, setRowMenu, expandedRowId, setExpandedRowId,
    selectedRowIds, setSelectedRowIds,
    importModalData, setImportModalData,
    attachmentInputRef, pendingAttachmentCellRef,
    showAddViewDropdown, setShowAddViewDropdown, addViewBtnRef, addViewDropdownRef,
    showHeaderDropdown, setShowHeaderDropdown, headerChevronRef,
    localColor, setLocalColor, localIcon, setLocalIcon, localGuide, setLocalGuide,
    canUndo, canRedo,
    filteredRows, sortedRows, rowData, isGrouped,
    footerAgg, gridRef,
    rangeContext, handleRangeCellMouseDown, handleRangeHeaderClicked,
    clearRange, rangeVersion, getSelectedCellCount,
    findReplace, fillHandle,
    showBatchEdit, setShowBatchEdit,
    focusedCellInfo,
    isDark,
    allTables, archivedTables, filteredTables, listLoading,
    spreadsheet, tablesSettings, openSettings,
    getComputedValue, getCellReference,
    toggleGroup,
    pinnedBottomRowData, getRowStyle,
    columnDefs: undefined as unknown as ColDef[], // computed in page.tsx
    hiddenColumnsSet, handleColumnMenuOpen,
    effectiveKanbanCol, selectColumns, getRowId,
    currentViews,

    // Handlers
    triggerAutoSave, pushUndoState,
    handleUndo, handleRedo,
    handleSelectTable, handleCreateTable, handleCreateFromTemplate,
    handleDeleteTable, confirmDeleteTable, handleRestoreTable,
    handleTitleChange, handleAddColumn, handleAddRow, handleDeleteRow,
    handleRenameColumn, handleDeleteColumn, handleDuplicateColumn,
    handleChangeColumnType, handleSortByColumn,
    handleInsertRowAbove, handleInsertRowBelow, handleDuplicateRow,
    handleCellContextMenu, handleSelectionChanged,
    handleBulkDelete, handleBulkDuplicate, handleClearSelection,
    handleUpdateRowField, handleAttachmentUpload,
    handleCellClickedWithAttachment, handleCellEditRequest,
    handleCellKeyDown, handleRowDragEnd,
    handleColumnResized, handleColumnMoved,
    handleHideColumn, handleFreezeUpTo, handleUnfreezeColumns,
    handleInsertColumnLeft, handleInsertColumnRight, handleEditColumnDescription,
    handleExportExcel, handleImportCSV, handleFileImport, handleImportConfirm,
    handleGroupByColumn, handleUngroupRows,
    handleBatchEditConfirm, handleFormulaBarEdit,
    handleViewToggle, handleAddView, handleRemoveView,
    importInputRef,

    // For column defs building
    buildColDefsParams: {
      localColumns, t: t as (key: string) => string, handleColumnMenuOpen, hiddenColumnsSet,
      frozenColumnCount: localViewConfig.frozenColumnCount, handleRangeHeaderClicked,
      tablesSettings, linkedTablesMap, getComputedValue,
    },
  };
}
