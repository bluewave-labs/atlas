import { useRef, useState, useCallback, useEffect } from 'react';
import type { AgGridReact } from 'ag-grid-react';
import type { CellClickedEvent } from 'ag-grid-community';

// ─── Types ─────────────────────────────────────────────────────────

export interface CellCoord {
  rowIndex: number;
  colId: string;
}

export interface CellRange {
  anchor: CellCoord;
  end: CellCoord;
}

// ─── Utility ───────────────────────────────────────────────────────

export function isCellInRange(
  rowIndex: number,
  colId: string,
  range: CellRange,
  colIndexMap: Map<string, number>,
): boolean {
  const anchorCol = colIndexMap.get(range.anchor.colId);
  const endCol = colIndexMap.get(range.end.colId);
  const cellCol = colIndexMap.get(colId);
  if (anchorCol == null || endCol == null || cellCol == null) return false;

  const minRow = Math.min(range.anchor.rowIndex, range.end.rowIndex);
  const maxRow = Math.max(range.anchor.rowIndex, range.end.rowIndex);
  const minCol = Math.min(anchorCol, endCol);
  const maxCol = Math.max(anchorCol, endCol);

  return rowIndex >= minRow && rowIndex <= maxRow && cellCol >= minCol && cellCol <= maxCol;
}

// ─── Hook ──────────────────────────────────────────────────────────

export function useCellRangeSelection(
  gridRef: React.RefObject<AgGridReact | null>,
  excludedColIds?: Set<string>,
) {
  const rangeRef = useRef<CellRange | null>(null);
  const anchorRef = useRef<CellCoord | null>(null);
  const colIndexMapRef = useRef<Map<string, number>>(new Map());
  const isDraggingRef = useRef(false);
  const [rangeVersion, setRangeVersion] = useState(0);

  // ── Helpers ────────────────────────────────────────────────────

  const refreshAllCells = useCallback(() => {
    gridRef.current?.api?.refreshCells({ force: true });
  }, [gridRef]);

  const bumpVersion = useCallback(() => {
    setRangeVersion((v) => v + 1);
  }, []);

  const setRange = useCallback(
    (range: CellRange | null) => {
      const hadRange = rangeRef.current != null;
      rangeRef.current = range;
      refreshAllCells();
      if ((range != null) !== hadRange) bumpVersion();
    },
    [refreshAllCells, bumpVersion],
  );

  const clearRange = useCallback(() => {
    if (rangeRef.current == null) return;
    setRange(null);
  }, [setRange]);

  // ── Column index map ──────────────────────────────────────────

  const rebuildColIndexMap = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api) return;
    const map = new Map<string, number>();
    const cols = api.getAllDisplayedColumns();
    cols.forEach((col, idx) => {
      const id = col.getColId();
      // Only include data columns (those with a field defined)
      const field = col.getColDef().field;
      if (!field || excludedColIds?.has(id)) return;
      map.set(id, idx);
    });
    colIndexMapRef.current = map;
  }, [gridRef, excludedColIds]);

  // Ensures the map is populated before use (lazy rebuild)
  const ensureColIndexMap = useCallback(() => {
    if (colIndexMapRef.current.size === 0) {
      rebuildColIndexMap();
    }
  }, [rebuildColIndexMap]);

  // ── Compute selected cell count ───────────────────────────────

  const getSelectedCellCount = useCallback((): number => {
    const range = rangeRef.current;
    if (!range) return 0;
    const map = colIndexMapRef.current;
    const anchorCol = map.get(range.anchor.colId);
    const endCol = map.get(range.end.colId);
    if (anchorCol == null || endCol == null) return 0;
    const rowCount = Math.abs(range.end.rowIndex - range.anchor.rowIndex) + 1;
    const colCount = Math.abs(endCol - anchorCol) + 1;
    return rowCount * colCount;
  }, []);

  // ── Cell clicked handler ──────────────────────────────────────

  const handleCellClicked = useCallback(
    (event: CellClickedEvent) => {
      ensureColIndexMap();
      const colId = event.colDef.field;
      if (!colId || excludedColIds?.has(colId)) return;
      const rowIndex = event.rowIndex;
      if (rowIndex == null || event.node.rowPinned === 'bottom') return;

      const kbEvent = event.event as MouseEvent | undefined;

      if (kbEvent?.shiftKey && anchorRef.current) {
        // Shift+Click → create range from anchor to this cell
        const newRange: CellRange = {
          anchor: anchorRef.current,
          end: { rowIndex, colId },
        };
        setRange(newRange);
        // Clear row checkbox selection (mutual exclusion)
        gridRef.current?.api?.deselectAll();
      } else {
        // Normal click → set anchor, clear range
        anchorRef.current = { rowIndex, colId };
        clearRange();
      }
    },
    [gridRef, excludedColIds, setRange, clearRange, ensureColIndexMap],
  );

  // ── Header clicked handler (select entire column) ─────────────

  const handleHeaderClicked = useCallback(
    (colId: string) => {
      ensureColIndexMap();
      if (excludedColIds?.has(colId)) return;
      const api = gridRef.current?.api;
      if (!api) return;

      const lastRowIndex = api.getDisplayedRowCount() - 1;
      // Exclude the pinned bottom placeholder row
      let lastDataRow = lastRowIndex;
      for (let i = lastRowIndex; i >= 0; i--) {
        const node = api.getDisplayedRowAtIndex(i);
        if (node && node.rowPinned !== 'bottom') {
          lastDataRow = i;
          break;
        }
      }
      if (lastDataRow < 0) return;

      const newRange: CellRange = {
        anchor: { rowIndex: 0, colId },
        end: { rowIndex: lastDataRow, colId },
      };
      anchorRef.current = { rowIndex: 0, colId };
      setRange(newRange);
      gridRef.current?.api?.deselectAll();
    },
    [gridRef, excludedColIds, setRange, ensureColIndexMap],
  );

  // ── Helper: get sorted column IDs from colIndexMap ─────────────

  const getSortedColIds = useCallback((): string[] => {
    const entries = Array.from(colIndexMapRef.current.entries());
    entries.sort((a, b) => a[1] - b[1]);
    return entries.map(([id]) => id);
  }, []);

  // ── Shift+Arrow key handler (called inside onCellKeyDown) ─────

  const handleRangeKeyDown = useCallback(
    (event: { event?: Event | null }) => {
      ensureColIndexMap();
      const kbEvent = event.event as KeyboardEvent | undefined;
      if (!kbEvent) return;

      if (!kbEvent.shiftKey) {
        // Non-shift arrow key → update anchor to current focus, clear range
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(kbEvent.key)) {
          requestAnimationFrame(() => {
            const api = gridRef.current?.api;
            if (!api) return;
            const focused = api.getFocusedCell();
            if (focused && focused.rowPinned == null) {
              anchorRef.current = { rowIndex: focused.rowIndex, colId: focused.column.getColId() };
            }
          });
          clearRange();
        }
        return;
      }

      // Shift+Arrow → extend range
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(kbEvent.key)) return;

      // Prevent AG Grid's default Shift+Arrow behavior (row selection)
      kbEvent.preventDefault();

      const api = gridRef.current?.api;
      if (!api) return;

      // Determine the current end point (or use focused cell / anchor)
      const currentEnd = rangeRef.current?.end
        ?? anchorRef.current
        ?? (() => {
          const focused = api.getFocusedCell();
          if (focused && focused.rowPinned == null) {
            return { rowIndex: focused.rowIndex, colId: focused.column.getColId() };
          }
          return null;
        })();

      if (!currentEnd) return;
      if (excludedColIds?.has(currentEnd.colId)) return;

      // If no anchor, set it to the current position
      if (!anchorRef.current) {
        anchorRef.current = { ...currentEnd };
      }

      // Compute next end based on arrow direction
      const sortedCols = getSortedColIds();
      const colIdx = sortedCols.indexOf(currentEnd.colId);
      if (colIdx < 0) return;

      let nextRow = currentEnd.rowIndex;
      let nextColIdx = colIdx;

      // Find last data row (exclude pinned bottom)
      const totalRows = api.getDisplayedRowCount();
      let lastDataRowIdx = totalRows - 1;
      for (let i = totalRows - 1; i >= 0; i--) {
        const node = api.getDisplayedRowAtIndex(i);
        if (node && node.rowPinned !== 'bottom') {
          lastDataRowIdx = i;
          break;
        }
      }

      switch (kbEvent.key) {
        case 'ArrowUp':
          nextRow = Math.max(0, currentEnd.rowIndex - 1);
          break;
        case 'ArrowDown':
          nextRow = Math.min(lastDataRowIdx, currentEnd.rowIndex + 1);
          break;
        case 'ArrowLeft':
          nextColIdx = Math.max(0, colIdx - 1);
          break;
        case 'ArrowRight':
          nextColIdx = Math.min(sortedCols.length - 1, colIdx + 1);
          break;
      }

      const nextColId = sortedCols[nextColIdx];
      const newEnd: CellCoord = { rowIndex: nextRow, colId: nextColId };

      const newRange: CellRange = {
        anchor: anchorRef.current,
        end: newEnd,
      };
      setRange(newRange);
      api.deselectAll();
    },
    [gridRef, excludedColIds, setRange, clearRange, getSortedColIds, ensureColIndexMap],
  );

  // ── Clipboard copy ────────────────────────────────────────────

  const copyRangeToClipboard = useCallback(
    (api: NonNullable<AgGridReact['api']>, range: CellRange) => {
      const map = colIndexMapRef.current;
      const anchorCol = map.get(range.anchor.colId);
      const endCol = map.get(range.end.colId);
      if (anchorCol == null || endCol == null) return;

      const minRow = Math.min(range.anchor.rowIndex, range.end.rowIndex);
      const maxRow = Math.max(range.anchor.rowIndex, range.end.rowIndex);
      const minCol = Math.min(anchorCol, endCol);
      const maxCol = Math.max(anchorCol, endCol);

      // Get columns in display order within range
      const allCols = api.getAllDisplayedColumns();
      const rangeCols = allCols.filter((col) => {
        const idx = map.get(col.getColId());
        return idx != null && idx >= minCol && idx <= maxCol;
      });

      const lines: string[] = [];
      const flashCells: { rowNodes: unknown[]; columns: string[] } = {
        rowNodes: [],
        columns: rangeCols.map((c) => c.getColId()),
      };

      for (let r = minRow; r <= maxRow; r++) {
        const rowNode = api.getDisplayedRowAtIndex(r);
        if (!rowNode || rowNode.rowPinned === 'bottom') continue;
        flashCells.rowNodes.push(rowNode);

        const cells: string[] = [];
        for (const col of rangeCols) {
          const value = api.getCellValue({ rowNode, colKey: col, useFormatter: true });
          cells.push(value != null ? String(value) : '');
        }
        lines.push(cells.join('\t'));
      }

      const tsv = lines.join('\n');
      navigator.clipboard.writeText(tsv).catch(() => {
        // Fallback: ignore clipboard errors silently
      });

      // Flash copied cells for visual feedback
      api.flashCells({
        rowNodes: flashCells.rowNodes as NonNullable<ReturnType<typeof api.getDisplayedRowAtIndex>>[],
        columns: flashCells.columns,
        flashDuration: 300,
        fadeDuration: 200,
      });
    },
    [],
  );

  // ── Global keydown handler (Ctrl+C / Escape) ─────────────────

  const handleGlobalKeyDown = useCallback(
    (e: KeyboardEvent): boolean => {
      const api = gridRef.current?.api;
      if (!api) return false;
      const range = rangeRef.current;

      // Escape → clear range
      if (e.key === 'Escape' && range) {
        clearRange();
        return true;
      }

      // Ctrl/Cmd+C → copy range or focused cell to clipboard
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 'c') {
        // Don't intercept if a cell is being edited (let browser handle it)
        const isEditing = api.getEditingCells()?.length ?? 0;
        if (isEditing > 0) return false;

        if (range) {
          e.preventDefault();
          copyRangeToClipboard(api, range);
          return true;
        }

        // Single focused cell copy
        const focused = api.getFocusedCell();
        if (focused && focused.rowPinned == null) {
          const rowNode = api.getDisplayedRowAtIndex(focused.rowIndex);
          if (rowNode) {
            const value = api.getCellValue({ rowNode, colKey: focused.column, useFormatter: true });
            const text = value != null ? String(value) : '';
            e.preventDefault();
            navigator.clipboard.writeText(text).catch(() => {});
            api.flashCells({
              rowNodes: [rowNode],
              columns: [focused.column.getColId()],
              flashDuration: 300,
              fadeDuration: 200,
            });
            return true;
          }
        }
      }

      return false;
    },
    [gridRef, clearRange, copyRangeToClipboard],
  );

  // ── Get cells in range (for bulk clear) ───────────────────────

  const getCellsInRange = useCallback((): Array<{ rowIndex: number; colId: string }> => {
    const range = rangeRef.current;
    if (!range) return [];
    const api = gridRef.current?.api;
    if (!api) return [];

    const map = colIndexMapRef.current;
    const anchorCol = map.get(range.anchor.colId);
    const endCol = map.get(range.end.colId);
    if (anchorCol == null || endCol == null) return [];

    const minRow = Math.min(range.anchor.rowIndex, range.end.rowIndex);
    const maxRow = Math.max(range.anchor.rowIndex, range.end.rowIndex);
    const minCol = Math.min(anchorCol, endCol);
    const maxCol = Math.max(anchorCol, endCol);

    const allCols = api.getAllDisplayedColumns();
    const rangeCols = allCols.filter((col) => {
      const idx = map.get(col.getColId());
      return idx != null && idx >= minCol && idx <= maxCol;
    });

    const cells: Array<{ rowIndex: number; colId: string }> = [];
    for (let r = minRow; r <= maxRow; r++) {
      const rowNode = api.getDisplayedRowAtIndex(r);
      if (!rowNode || rowNode.rowPinned === 'bottom') continue;
      for (const col of rangeCols) {
        cells.push({ rowIndex: r, colId: col.getColId() });
      }
    }
    return cells;
  }, [gridRef]);

  // ── Mouse drag selection ───────────────────────────────────────

  const getCellCoordsFromPoint = useCallback((x: number, y: number): CellCoord | null => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;

    // Find the ag-cell element
    const cellEl = el.closest('.ag-cell') as HTMLElement | null;
    if (!cellEl) return null;

    const colId = cellEl.getAttribute('col-id');
    if (!colId) return null;

    // Only allow data columns (must be in our colIndexMap)
    if (!colIndexMapRef.current.has(colId)) return null;

    // Find the row element
    const rowEl = cellEl.closest('.ag-row') as HTMLElement | null;
    if (!rowEl) return null;

    const rowIndexStr = rowEl.getAttribute('row-index');
    if (rowIndexStr == null) return null;
    const rowIndex = parseInt(rowIndexStr, 10);
    if (isNaN(rowIndex) || rowIndex < 0) return null;

    // Skip pinned bottom rows
    if (rowEl.classList.contains('ag-row-pinned-bottom')) return null;

    return { rowIndex, colId };
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current || !anchorRef.current) return;

    // Prevent text selection while dragging
    e.preventDefault();

    const coord = getCellCoordsFromPoint(e.clientX, e.clientY);
    if (!coord) return;

    // Only create/update range if we've moved to a different cell
    const currentEnd = rangeRef.current?.end;
    if (currentEnd && currentEnd.rowIndex === coord.rowIndex && currentEnd.colId === coord.colId) return;

    const newRange: CellRange = {
      anchor: anchorRef.current,
      end: coord,
    };
    setRange(newRange);
    gridRef.current?.api?.deselectAll();
  }, [getCellCoordsFromPoint, setRange, gridRef]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  // Attach/detach global mousemove/mouseup listeners when dragging
  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleCellMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start drag on left-click, without shift (shift+click is handled by handleCellClicked)
    if (e.button !== 0 || e.shiftKey) return;

    ensureColIndexMap();
    const coord = getCellCoordsFromPoint(e.clientX, e.clientY);
    if (!coord) return;

    isDraggingRef.current = true;
    anchorRef.current = coord;
    // Don't set a range yet — only create range on mousemove (to not interfere with single clicks)
  }, [ensureColIndexMap, getCellCoordsFromPoint]);

  // ── Return ────────────────────────────────────────────────────

  return {
    // AG Grid context for cellClassRules
    rangeContext: {
      cellRangeRef: rangeRef,
      colIndexMapRef: colIndexMapRef,
    },
    // Handlers
    handleCellClicked,
    handleCellMouseDown,
    handleHeaderClicked,
    handleRangeKeyDown,
    handleGlobalKeyDown,
    clearRange,
    rebuildColIndexMap,
    // State
    rangeRef,
    rangeVersion,
    getSelectedCellCount,
    getCellsInRange,
  };
}
