import {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
  type ReactNode,
  type CSSProperties,
} from 'react';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
  Download,
  Columns3,
  Check,
} from 'lucide-react';
import { ColumnHeader } from './column-header';
import { Button } from './button';
import { Select } from './select';
import { Input } from './input';
import { Popover, PopoverTrigger, PopoverContent } from './popover';

// ─── Types ──────────────────────────────────────────────────────────

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  column: string;
  direction: SortDirection;
}

export interface DataTableColumn<T> {
  key: string;
  label: string;
  icon?: ReactNode;
  width?: number | string;
  minWidth?: number | string;
  sortable?: boolean;
  align?: 'left' | 'right';
  render: (item: T, index: number) => ReactNode;
  compare?: (a: T, b: T) => number;
  /** Plain-string value used by the search filter and CSV export. If
   * omitted, the table will try to coerce the result of `render()` to a
   * string — works for primitive renders, returns empty string for JSX. */
  searchValue?: (item: T) => string;
  /** Plain-string value used by the CSV export. Defaults to `searchValue` if
   * defined, otherwise the coerced render result. */
  csvValue?: (item: T) => string | number;
  /** Whether this column may be hidden via the column selector. Default true.
   * Set to false for "always-on" identity columns. */
  hideable?: boolean;
  /** Whether this column may be resized when `resizableColumns` is on.
   * Default true. */
  resizable?: boolean;
}

export interface DataTableBulkAction<T> {
  key: string;
  label: string;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  onAction?: (selectedIds: string[], selectedItems: T[]) => void;
  visible?: (selectedIds: string[], selectedItems: T[]) => boolean;
  render?: (selectedIds: string[], selectedItems: T[]) => ReactNode;
}

export interface DataTableAggregation<T> {
  label: string;
  compute: (visibleRows: T[]) => string | number;
  style?: CSSProperties;
}

export interface DataTableProps<T extends { id: string }> {
  data: T[];
  columns: DataTableColumn<T>[];

  // Selection
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;

  // Sort
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;

  // Row interaction
  onRowClick?: (item: T) => void;
  activeRowId?: string | null;

  // Bulk actions
  bulkActions?: DataTableBulkAction<T>[];

  // Toolbar
  toolbar?: { left?: ReactNode; right?: ReactNode };

  // Footer
  aggregations?: DataTableAggregation<T>[];
  hideFooter?: boolean;

  // Pagination
  paginated?: boolean;
  defaultPageSize?: number;
  pageSizes?: number[];

  // Add row
  onAddRow?: () => void;
  addRowLabel?: string;

  // Empty state
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;

  // Grouping
  groupBy?: (item: T) => string;

  // Keyboard
  keyboardNavigation?: boolean;

  // ─── Built-in toolbar features (opt-in) ───────────────────────────

  /** Show a search input in the toolbar. Filters rows client-side using
   * each column's `searchValue` (or coerced render output). */
  searchable?: boolean;
  /** Placeholder text for the search input. */
  searchPlaceholder?: string;
  /** Lift search state out of the table. When provided, the table calls
   * this on each change but still filters internally unless you also
   * filter `data` upstream. */
  onSearchChange?: (query: string) => void;

  /** Show an "Export CSV" button in the toolbar. Exports filtered + sorted
   * rows (NOT just the current page) using each visible column's `csvValue`
   * (or coerced render output). Pass `{ filename }` to control the
   * download name; default is `table.csv`. */
  exportable?: boolean | { filename?: string };

  /** Show a "Columns" popover in the toolbar that toggles column
   * visibility. Columns with `hideable: false` are excluded from the list.
   * State persists in localStorage when `storageKey` is set. */
  columnSelector?: boolean;

  /** Allow the user to drag column edges to resize widths. State persists
   * in localStorage when `storageKey` is set. */
  resizableColumns?: boolean;

  /** Stable identifier used to namespace localStorage keys for the
   * built-in toolbar features (column visibility + widths). Without this
   * the user's preferences won't persist across reloads. */
  storageKey?: string;

  // Misc
  className?: string;
  rowClassName?: (item: T, index: number) => string;
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Best-effort stringification of a ReactNode for search/CSV. Walks the
 * tree and concatenates string/number children; returns '' for elements
 * we can't safely peek into. The escape hatch is the explicit
 * `searchValue`/`csvValue` column field. */
function coerceNodeToString(node: ReactNode): string {
  if (node == null || node === false || node === true) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(coerceNodeToString).join(' ');
  return '';
}

function getSearchableString<T>(col: DataTableColumn<T>, item: T, index: number): string {
  if (col.searchValue) return col.searchValue(item);
  return coerceNodeToString(col.render(item, index));
}

function getCsvValue<T>(col: DataTableColumn<T>, item: T, index: number): string {
  if (col.csvValue) return String(col.csvValue(item));
  if (col.searchValue) return col.searchValue(item);
  return coerceNodeToString(col.render(item, index));
}

/** RFC 4180 CSV cell escape: wrap in double quotes and double any internal
 * quotes if the value contains commas, quotes, or newlines. */
function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map(row => row.map(csvCell).join(',')).join('\n');
  // Prepend BOM so Excel opens UTF-8 correctly.
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Component ──────────────────────────────────────────────────────

export function DataTable<T extends { id: string }>({
  data,
  columns,
  selectable = false,
  selectedIds: controlledSelectedIds,
  onSelectionChange,
  sort: controlledSort,
  onSortChange,
  onRowClick,
  activeRowId,
  bulkActions,
  toolbar,
  aggregations,
  hideFooter = false,
  paginated = true,
  defaultPageSize = 25,
  pageSizes = [25, 50, 100],
  onAddRow,
  addRowLabel = 'Add new',
  emptyIcon,
  emptyTitle,
  emptyDescription,
  groupBy,
  keyboardNavigation = true,
  searchable = false,
  searchPlaceholder = 'Search…',
  onSearchChange,
  exportable = false,
  columnSelector = false,
  resizableColumns = false,
  storageKey,
  className,
  rowClassName,
}: DataTableProps<T>) {
  // ─── Selection state ────────────────────────────────────────────
  const [internalSelectedIds, setInternalSelectedIds] = useState<Set<string>>(new Set());
  const selectedIds = controlledSelectedIds ?? internalSelectedIds;
  const setSelectedIds = onSelectionChange ?? setInternalSelectedIds;
  const lastSelectedIndex = useRef<number | null>(null);

  // ─── Sort state ─────────────────────────────────────────────────
  const [internalSort, setInternalSort] = useState<SortState | null>(null);
  const sort = controlledSort !== undefined ? controlledSort : internalSort;
  const setSort = onSortChange ?? setInternalSort;

  // ─── Pagination state ───────────────────────────────────────────
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // ─── Search state ───────────────────────────────────────────────
  const [query, setQuery] = useState('');

  // ─── Column visibility state ────────────────────────────────────
  // Stores the set of HIDDEN column keys (not visible). Inverse of "visible"
  // so newly added columns default to visible without a migration step.
  const visibilityStorageKey = storageKey ? `atlasmail_dt_hidden_${storageKey}` : null;
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(() => {
    if (!visibilityStorageKey || typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem(visibilityStorageKey);
      if (!raw) return new Set();
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return new Set(parsed.map(String));
    } catch { /* ignore */ }
    return new Set();
  });
  useEffect(() => {
    if (!visibilityStorageKey || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(visibilityStorageKey, JSON.stringify([...hiddenKeys]));
    } catch { /* ignore */ }
  }, [hiddenKeys, visibilityStorageKey]);

  // ─── Column width overrides (for resizable columns) ─────────────
  const widthsStorageKey = storageKey ? `atlasmail_dt_widths_${storageKey}` : null;
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    if (!widthsStorageKey || typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(widthsStorageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, number>;
    } catch { /* ignore */ }
    return {};
  });
  useEffect(() => {
    if (!widthsStorageKey || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(widthsStorageKey, JSON.stringify(columnWidths));
    } catch { /* ignore */ }
  }, [columnWidths, widthsStorageKey]);

  // Active resize drag — column key + starting x + starting width.
  const resizeDragRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);
  useEffect(() => {
    if (!resizableColumns) return;
    const onMouseMove = (e: MouseEvent) => {
      const drag = resizeDragRef.current;
      if (!drag) return;
      const next = Math.max(60, Math.round(drag.startWidth + (e.clientX - drag.startX)));
      setColumnWidths(prev => ({ ...prev, [drag.key]: next }));
    };
    const onMouseUp = () => {
      if (!resizeDragRef.current) return;
      resizeDragRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [resizableColumns]);

  // ─── Keyboard focus ─────────────────────────────────────────────
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset page when data changes
  const dataLen = data.length;
  useEffect(() => { setPage(0); }, [dataLen]);

  // ─── Visible columns (after column-selector hides) ──────────────
  const visibleColumns = useMemo(
    () => columns.filter(c => !hiddenKeys.has(c.key)),
    [columns, hiddenKeys],
  );

  // ─── Search filter ──────────────────────────────────────────────
  const filteredData = useMemo(() => {
    if (!searchable || !query.trim()) return data;
    const needle = query.trim().toLowerCase();
    return data.filter((item, index) =>
      visibleColumns.some(col =>
        getSearchableString(col, item, index).toLowerCase().includes(needle),
      ),
    );
  }, [data, searchable, query, visibleColumns]);

  // ─── Sort handler ───────────────────────────────────────────────
  const handleSort = useCallback((columnKey: string) => {
    const current = controlledSort !== undefined ? controlledSort : internalSort;
    let next: SortState | null;
    if (!current || current.column !== columnKey) {
      next = { column: columnKey, direction: 'asc' };
    } else if (current.direction === 'asc') {
      next = { column: columnKey, direction: 'desc' };
    } else {
      next = null;
    }
    if (onSortChange) onSortChange(next);
    else setInternalSort(next);
    setPage(0);
  }, [controlledSort, internalSort, onSortChange]);

  // ─── Sorted data ───────────────────────────────────────────────
  const sortedData = useMemo(() => {
    if (!sort) return filteredData;
    const col = columns.find(c => c.key === sort.column);
    if (!col) return filteredData;

    const sorted = [...filteredData].sort((a, b) => {
      if (col.compare) return col.compare(a, b);
      const aVal = (a as Record<string, unknown>)[col.key];
      const bVal = (b as Record<string, unknown>)[col.key];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      if (typeof aVal === 'number' && typeof bVal === 'number') return aVal - bVal;
      return String(aVal).localeCompare(String(bVal));
    });
    return sort.direction === 'desc' ? sorted.reverse() : sorted;
  }, [filteredData, sort, columns]);

  // ─── Grouped data ──────────────────────────────────────────────
  const groups = useMemo(() => {
    if (!groupBy) return null;
    const map = new Map<string, T[]>();
    for (const item of sortedData) {
      const key = groupBy(item);
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return map;
  }, [sortedData, groupBy]);

  // ─── Paginated data ────────────────────────────────────────────
  const totalRows = sortedData.length;
  const totalPages = paginated ? Math.max(1, Math.ceil(totalRows / pageSize)) : 1;
  const paginatedData = useMemo(() => {
    if (!paginated) return sortedData;
    const start = page * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize, paginated]);

  // For display when grouping: paginate over the flat sorted array
  const displayData = groupBy ? sortedData : paginatedData;

  // ─── Selection handlers ────────────────────────────────────────
  const allChecked = selectable && displayData.length > 0 && displayData.every(d => selectedIds.has(d.id));
  const someChecked = selectable && displayData.some(d => selectedIds.has(d.id));

  const handleHeaderCheckbox = useCallback(() => {
    if (allChecked) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayData.map(d => d.id)));
    }
  }, [allChecked, displayData, setSelectedIds]);

  const handleRowCheckbox = useCallback((index: number, event: React.MouseEvent) => {
    event.stopPropagation();
    const item = displayData[index];
    if (!item) return;

    if (event.shiftKey && lastSelectedIndex.current !== null) {
      const start = Math.min(lastSelectedIndex.current, index);
      const end = Math.max(lastSelectedIndex.current, index);
      const next = new Set(selectedIds);
      for (let i = start; i <= end; i++) {
        if (displayData[i]) next.add(displayData[i].id);
      }
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.add(item.id);
      }
      setSelectedIds(next);
    }
    lastSelectedIndex.current = index;
  }, [displayData, selectedIds, setSelectedIds]);

  // ─── Keyboard ──────────────────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!keyboardNavigation) return;
    const len = displayData.length;
    if (len === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => prev === null ? 0 : Math.min(prev + 1, len - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => prev === null ? 0 : Math.max(prev - 1, 0));
        break;
      case 'Enter':
        if (focusedIndex !== null && displayData[focusedIndex] && onRowClick) {
          e.preventDefault();
          onRowClick(displayData[focusedIndex]);
        }
        break;
      case ' ':
        if (selectable && focusedIndex !== null && displayData[focusedIndex]) {
          e.preventDefault();
          const next = new Set(selectedIds);
          const id = displayData[focusedIndex].id;
          next.has(id) ? next.delete(id) : next.add(id);
          setSelectedIds(next);
        }
        break;
      case 'Escape':
        setFocusedIndex(null);
        if (selectable && selectedIds.size > 0) setSelectedIds(new Set());
        break;
    }
  }, [keyboardNavigation, displayData, focusedIndex, onRowClick, selectable, selectedIds, setSelectedIds]);

  // ─── Bulk bar items ────────────────────────────────────────────
  const selectedItems = useMemo(() => {
    return data.filter(d => selectedIds.has(d.id));
  }, [data, selectedIds]);
  const selectedIdArr = useMemo(() => [...selectedIds], [selectedIds]);

  // ─── Pagination controls ───────────────────────────────────────
  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
    const pages: (number | 'ellipsis')[] = [0];
    const start = Math.max(1, page - 1);
    const end = Math.min(totalPages - 2, page + 1);
    if (start > 1) pages.push('ellipsis');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 2) pages.push('ellipsis');
    pages.push(totalPages - 1);
    return pages;
  }, [totalPages, page]);

  // ─── Resolve effective column width ────────────────────────────
  const getEffectiveWidth = useCallback(
    (col: DataTableColumn<T>): number | string | undefined => {
      if (resizableColumns && columnWidths[col.key] != null) return columnWidths[col.key];
      return col.width;
    },
    [resizableColumns, columnWidths],
  );

  const startResize = useCallback(
    (col: DataTableColumn<T>, e: React.MouseEvent) => {
      if (!resizableColumns) return;
      e.preventDefault();
      e.stopPropagation();
      // Measure the actual current width from the DOM rather than trusting
      // the prop, so the drag starts from where the user sees the edge.
      const headerCell = (e.currentTarget as HTMLElement).parentElement;
      const startWidth = headerCell?.getBoundingClientRect().width ?? 120;
      resizeDragRef.current = { key: col.key, startX: e.clientX, startWidth };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [resizableColumns],
  );

  // ─── CSV export ────────────────────────────────────────────────
  const exportCsv = useCallback(() => {
    const cols = visibleColumns;
    const headers = cols.map(c => c.label);
    const body = sortedData.map((item, idx) =>
      cols.map(col => getCsvValue(col, item, idx)),
    );
    const filename =
      typeof exportable === 'object' && exportable.filename
        ? exportable.filename
        : storageKey
          ? `${storageKey}.csv`
          : 'table.csv';
    downloadCsv(filename, [headers, ...body]);
  }, [visibleColumns, sortedData, exportable, storageKey]);

  // ─── Search input handler ──────────────────────────────────────
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      setPage(0);
      onSearchChange?.(value);
    },
    [onSearchChange],
  );

  // ─── Built-in toolbar parts ────────────────────────────────────
  const showBuiltInToolbar = searchable || exportable || columnSelector;
  const hideableColumns = columns.filter(c => c.hideable !== false);

  // ─── Render helpers ────────────────────────────────────────────
  const renderRow = (item: T, index: number, globalIndex: number) => {
    const isActive = activeRowId === item.id;
    const isFocused = focusedIndex === globalIndex;
    const isSelected = selectedIds.has(item.id);
    const extraClass = rowClassName?.(item, index) ?? '';

    return (
      <div
        key={item.id}
        className={`dt-row${isActive || isSelected ? ' selected' : ''}${isFocused ? ' focused' : ''} ${extraClass}`}
        onClick={() => {
          setFocusedIndex(globalIndex);
          if (onRowClick) onRowClick(item);
        }}
      >
        {selectable && (
          <input
            type="checkbox"
            className={`dt-checkbox`}
            checked={selectedIds.has(item.id)}
            onClick={(e) => handleRowCheckbox(globalIndex, e)}
            readOnly
          />
        )}
        {visibleColumns.map(col => {
          const w = getEffectiveWidth(col);
          return (
            <span
              key={col.key}
              style={{
                width: w ?? undefined,
                minWidth: col.minWidth ?? undefined,
                flex: w ? undefined : 1,
                flexShrink: w ? 0 : undefined,
                textAlign: col.align,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {col.render(item, index)}
            </span>
          );
        })}
      </div>
    );
  };

  const renderGrouped = () => {
    if (!groups) return null;
    let globalIndex = 0;
    const elements: ReactNode[] = [];

    for (const [groupLabel, items] of groups) {
      elements.push(
        <div key={`group-${groupLabel}`} className="dt-group-header">
          {groupLabel} <span style={{ opacity: 0.6, marginLeft: 4 }}>({items.length})</span>
        </div>
      );
      items.forEach((item, i) => {
        elements.push(renderRow(item, i, globalIndex));
        globalIndex++;
      });
    }
    return elements;
  };

  // ─── Render ────────────────────────────────────────────────────
  return (
    <div className={`dt-container ${className ?? ''}`} ref={containerRef} tabIndex={0} onKeyDown={handleKeyDown}>
      {/* Toolbar */}
      {(toolbar || showBuiltInToolbar) && (
        <div className="dt-toolbar">
          <div className="dt-toolbar-left">
            {searchable && (
              <Input
                size="sm"
                iconLeft={<Search size={14} />}
                placeholder={searchPlaceholder}
                value={query}
                onChange={handleSearchChange}
                style={{ width: 240 }}
              />
            )}
            {toolbar?.left}
          </div>
          <div className="dt-toolbar-right">
            {toolbar?.right}
            {columnSelector && hideableColumns.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Columns3 size={14} />}
                    aria-label="Show fields"
                  >
                    Fields
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" sideOffset={4} style={{ padding: 0, minWidth: 200 }}>
                  <div
                    style={{
                      padding: '8px 12px',
                      fontSize: 'var(--font-size-xs)',
                      fontWeight: 'var(--font-weight-semibold)',
                      color: 'var(--color-text-tertiary)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                      borderBottom: '1px solid var(--color-border-secondary)',
                    }}
                  >
                    Show fields
                  </div>
                  <div style={{ maxHeight: 320, overflow: 'auto', padding: 4 }}>
                    {hideableColumns.map(col => {
                      const isVisible = !hiddenKeys.has(col.key);
                      return (
                        <button
                          key={col.key}
                          type="button"
                          onClick={() => {
                            setHiddenKeys(prev => {
                              const next = new Set(prev);
                              if (next.has(col.key)) next.delete(col.key);
                              else next.add(col.key);
                              return next;
                            });
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            padding: '6px 8px',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--color-text-primary)',
                            fontSize: 'var(--font-size-sm)',
                            fontFamily: 'var(--font-family)',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 16,
                              height: 16,
                              flexShrink: 0,
                              borderRadius: 3,
                              border: `1.5px solid ${isVisible ? 'var(--color-accent-primary)' : 'var(--color-border-primary)'}`,
                              background: isVisible ? 'var(--color-accent-primary)' : 'transparent',
                            }}
                          >
                            {isVisible && <Check size={11} color="#fff" strokeWidth={3} />}
                          </span>
                          {col.label}
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {exportable && (
              <Button
                variant="ghost"
                size="sm"
                icon={<Download size={14} />}
                onClick={exportCsv}
                aria-label="Export as CSV"
              >
                Export CSV
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Scrollable area */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {/* Header */}
        <div className="dt-header">
          {selectable && (
            <input
              type="checkbox"
              className={`dt-checkbox${!allChecked && someChecked ? ' indeterminate' : ''}`}
              checked={allChecked}
              onChange={handleHeaderCheckbox}
            />
          )}
          {visibleColumns.map(col => {
            const w = getEffectiveWidth(col);
            const allowResize = resizableColumns && col.resizable !== false;
            return (
              <div
                key={col.key}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  width: w ?? undefined,
                  minWidth: col.minWidth ?? undefined,
                  flex: w ? undefined : 1,
                  flexShrink: w ? 0 : undefined,
                }}
              >
                <ColumnHeader
                  label={col.label}
                  icon={col.icon}
                  sortable={col.sortable}
                  columnKey={col.key}
                  sortColumn={sort?.column ?? null}
                  sortDirection={sort?.direction}
                  onSort={handleSort}
                  style={{
                    flex: 1,
                    textAlign: col.align,
                  }}
                />
                {allowResize && (
                  <span
                    onMouseDown={(e) => startResize(col, e)}
                    className="dt-resize-handle"
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Body */}
        {displayData.length === 0 ? (
          <div className="dt-empty">
            {emptyIcon && <div className="dt-empty-icon">{emptyIcon}</div>}
            {emptyTitle && <div className="dt-empty-title">{emptyTitle}</div>}
            {emptyDescription && <div className="dt-empty-desc">{emptyDescription}</div>}
            {!emptyTitle && !emptyDescription && <div className="dt-empty-title">No data</div>}
          </div>
        ) : groupBy ? (
          renderGrouped()
        ) : (
          paginatedData.map((item, i) => renderRow(item, i, page * pageSize + i))
        )}

        {/* Add row */}
        {onAddRow && (
          <div className="dt-add-row" onClick={onAddRow}>
            <Plus size={14} /> {addRowLabel}
          </div>
        )}
      </div>

      {/* Footer */}
      {!hideFooter && (
        <div className="dt-footer">
          <span>{totalRows} {totalRows === 1 ? 'row' : 'rows'}</span>
          {aggregations?.map((agg, i) => (
            <span key={i} style={{ marginLeft: i === 0 ? 'auto' : 0, ...agg.style }}>
              {agg.label}: {agg.compute(paginatedData)}
            </span>
          ))}

          {/* Pagination */}
          {paginated && totalPages > 1 && (
            <div className="dt-pagination" style={{ marginLeft: aggregations?.length ? 'var(--spacing-lg)' : 'auto' }}>
              <button
                className="dt-pagination-btn"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft size={14} />
              </button>
              {pageNumbers.map((p, i) =>
                p === 'ellipsis' ? (
                  <span key={`e${i}`} className="dt-pagination-info">…</span>
                ) : (
                  <button
                    key={p}
                    className={`dt-pagination-btn${p === page ? ' active' : ''}`}
                    onClick={() => setPage(p as number)}
                  >
                    {(p as number) + 1}
                  </button>
                )
              )}
              <button
                className="dt-pagination-btn"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
              >
                <ChevronRight size={14} />
              </button>
              <Select
                value={String(pageSize)}
                onChange={(v) => { setPageSize(Number(v)); setPage(0); }}
                options={pageSizes.map(s => ({ value: String(s), label: `${s} / page` }))}
                size="sm"
                width={100}
              />
            </div>
          )}
        </div>
      )}

      {/* Bulk action bar */}
      {selectable && selectedIds.size > 0 && bulkActions && bulkActions.length > 0 && (
        <div className="dt-bulk-bar">
          <span className="dt-bulk-bar-count">{selectedIds.size} selected</span>
          {bulkActions.map(action => {
            if (action.visible && !action.visible(selectedIdArr, selectedItems)) return null;
            if (action.render) return <span key={action.key}>{action.render(selectedIdArr, selectedItems)}</span>;
            return (
              <Button
                key={action.key}
                variant={(action.variant as 'primary' | 'secondary' | 'ghost' | 'danger') ?? 'ghost'}
                size="sm"
                icon={action.icon}
                onClick={() => action.onAction?.(selectedIdArr, selectedItems)}
              >
                {action.label}
              </Button>
            );
          })}
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
