import { useState, useCallback, useRef, useEffect } from 'react';
import type { AgGridReact } from 'ag-grid-react';
import type { TableRow } from '@atlasmail/shared';

interface UseFillHandleOptions {
  gridRef: React.RefObject<AgGridReact | null>;
  rows: TableRow[];
  onUpdateRows: (rows: TableRow[]) => void;
  pushUndoState: () => void;
}

export function useFillHandle({
  gridRef,
  rows,
  onUpdateRows,
  pushUndoState,
}: UseFillHandleOptions) {
  const [handlePos, setHandlePos] = useState<{ top: number; left: number } | null>(null);
  const [fillPreview, setFillPreview] = useState<{ startRow: number; endRow: number; colId: string } | null>(null);
  const isDragging = useRef(false);
  const sourceCell = useRef<{ rowIndex: number; colId: string } | null>(null);
  const gridContainerRef = useRef<HTMLElement | null>(null);

  // Update handle position when focused cell changes
  const updateHandlePosition = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api) {
      setHandlePos(null);
      return;
    }

    const focused = api.getFocusedCell();
    if (!focused || focused.rowPinned != null) {
      setHandlePos(null);
      return;
    }

    // Check if this column is editable
    const colDef = focused.column.getColDef();
    if (!colDef.editable) {
      setHandlePos(null);
      return;
    }

    // Get cell element and compute position
    const cellEl = document.querySelector(
      `.ag-row[row-index="${focused.rowIndex}"] .ag-cell[col-id="${focused.column.getColId()}"]`,
    ) as HTMLElement | null;

    if (!cellEl) {
      setHandlePos(null);
      return;
    }

    const container = cellEl.closest('.tables-grid-container');
    if (!container) {
      setHandlePos(null);
      return;
    }
    gridContainerRef.current = container as HTMLElement;

    const cellRect = cellEl.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    setHandlePos({
      top: cellRect.bottom - containerRect.top - 4,
      left: cellRect.right - containerRect.left - 4,
    });

    sourceCell.current = { rowIndex: focused.rowIndex, colId: focused.column.getColId() };
  }, [gridRef]);

  // Listen for cell focus changes
  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api) return;

    const onFocusChanged = () => {
      if (!isDragging.current) {
        updateHandlePosition();
      }
    };

    api.addEventListener('cellFocused', onFocusChanged);
    return () => {
      api.removeEventListener('cellFocused', onFocusChanged);
    };
  }, [gridRef, updateHandlePosition]);

  // Clear handle position on scroll (it'll be recalculated)
  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api) return;

    const onScroll = () => {
      if (!isDragging.current) {
        updateHandlePosition();
      }
    };

    api.addEventListener('bodyScroll', onScroll);
    return () => {
      api.removeEventListener('bodyScroll', onScroll);
    };
  }, [gridRef, updateHandlePosition]);

  const getRowIndexFromPoint = useCallback((clientY: number): number | null => {
    const el = document.elementFromPoint(
      (gridContainerRef.current?.getBoundingClientRect().left ?? 0) + 50,
      clientY,
    );
    if (!el) return null;

    const rowEl = el.closest('.ag-row') as HTMLElement | null;
    if (!rowEl) return null;

    const rowIndexStr = rowEl.getAttribute('row-index');
    if (rowIndexStr == null) return null;
    const rowIndex = parseInt(rowIndexStr, 10);
    if (isNaN(rowIndex) || rowIndex < 0) return null;
    if (rowEl.classList.contains('ag-row-pinned-bottom')) return null;

    return rowIndex;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!sourceCell.current) return;
    isDragging.current = true;
    setFillPreview(null);
  }, []);

  // Global mousemove/mouseup during drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !sourceCell.current) return;
      e.preventDefault();

      const targetRow = getRowIndexFromPoint(e.clientY);
      if (targetRow == null || targetRow === sourceCell.current.rowIndex) {
        setFillPreview(null);
        return;
      }

      setFillPreview({
        startRow: sourceCell.current.rowIndex,
        endRow: targetRow,
        colId: sourceCell.current.colId,
      });
    };

    const handleMouseUp = () => {
      if (!isDragging.current || !sourceCell.current) {
        isDragging.current = false;
        return;
      }

      isDragging.current = false;

      if (!fillPreview) return;

      const api = gridRef.current?.api;
      if (!api) return;

      // Get source value
      const sourceRow = api.getDisplayedRowAtIndex(fillPreview.startRow);
      if (!sourceRow) return;
      const sourceValue = (sourceRow.data as TableRow)?.[fillPreview.colId];

      const minRow = Math.min(fillPreview.startRow, fillPreview.endRow);
      const maxRow = Math.max(fillPreview.startRow, fillPreview.endRow);

      // Detect pattern for smart fill
      const fillValues = computeFillValues(sourceValue, fillPreview.startRow, minRow, maxRow);

      pushUndoState();

      // Build list of row IDs to update
      const rowUpdates = new Map<string, unknown>();
      for (let i = minRow; i <= maxRow; i++) {
        if (i === fillPreview.startRow) continue;
        const rowNode = api.getDisplayedRowAtIndex(i);
        if (!rowNode || rowNode.rowPinned === 'bottom') continue;
        const rowId = (rowNode.data as TableRow)?._id;
        if (rowId) {
          const fillIdx = i - minRow;
          rowUpdates.set(rowId, fillValues[fillIdx] !== undefined ? fillValues[fillIdx] : sourceValue);
        }
      }

      const updated = rows.map((r) => {
        if (rowUpdates.has(r._id)) {
          return { ...r, [fillPreview.colId]: rowUpdates.get(r._id) };
        }
        return r;
      });

      onUpdateRows(updated);
      setFillPreview(null);
      updateHandlePosition();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gridRef, rows, fillPreview, onUpdateRows, pushUndoState, getRowIndexFromPoint, updateHandlePosition]);

  return {
    handlePos,
    fillPreview,
    handleMouseDown,
    updateHandlePosition,
  };
}

function computeFillValues(
  sourceValue: unknown,
  sourceRow: number,
  minRow: number,
  maxRow: number,
): unknown[] {
  const count = maxRow - minRow + 1;
  const values: unknown[] = new Array(count);

  // Try number increment
  if (typeof sourceValue === 'number') {
    for (let i = 0; i < count; i++) {
      const rowIdx = minRow + i;
      values[i] = sourceValue + (rowIdx - sourceRow);
    }
    return values;
  }

  // Try date increment
  if (typeof sourceValue === 'string' && /^\d{4}-\d{2}-\d{2}/.test(sourceValue)) {
    const baseDate = new Date(sourceValue);
    if (!isNaN(baseDate.getTime())) {
      for (let i = 0; i < count; i++) {
        const rowIdx = minRow + i;
        const d = new Date(baseDate);
        d.setDate(d.getDate() + (rowIdx - sourceRow));
        values[i] = d.toISOString().split('T')[0];
      }
      return values;
    }
  }

  // Default: copy value
  for (let i = 0; i < count; i++) {
    values[i] = sourceValue;
  }
  return values;
}
