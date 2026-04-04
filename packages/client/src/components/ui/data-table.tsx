import { useState, useCallback, useRef, useMemo, useEffect, type ReactNode, type CSSProperties } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { ColumnHeader } from './column-header';
import { Button } from './button';
import { Select } from './select';

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
  sortable?: boolean;
  align?: 'left' | 'right';
  render: (item: T, index: number) => ReactNode;
  compare?: (a: T, b: T) => number;
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

  // Misc
  className?: string;
  rowClassName?: (item: T, index: number) => string;
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

  // ─── Keyboard focus ─────────────────────────────────────────────
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset page when data changes
  const dataLen = data.length;
  useEffect(() => { setPage(0); }, [dataLen]);

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
    if (!sort) return data;
    const col = columns.find(c => c.key === sort.column);
    if (!col) return data;

    const sorted = [...data].sort((a, b) => {
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
  }, [data, sort, columns]);

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
        {columns.map(col => (
          <span
            key={col.key}
            style={{
              width: col.width ?? undefined,
              flex: col.width ? undefined : 1,
              flexShrink: col.width ? 0 : undefined,
              textAlign: col.align,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {col.render(item, index)}
          </span>
        ))}
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
      {toolbar && (
        <div className="dt-toolbar">
          <div className="dt-toolbar-left">{toolbar.left}</div>
          <div className="dt-toolbar-right">{toolbar.right}</div>
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
          {columns.map(col => (
            <ColumnHeader
              key={col.key}
              label={col.label}
              icon={col.icon}
              sortable={col.sortable}
              columnKey={col.key}
              sortColumn={sort?.column ?? null}
              sortDirection={sort?.direction}
              onSort={handleSort}
              style={{
                width: col.width ?? undefined,
                flex: col.width ? undefined : 1,
                flexShrink: col.width ? 0 : undefined,
                textAlign: col.align,
              }}
            />
          ))}
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
