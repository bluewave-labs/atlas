import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { AgGridReact } from 'ag-grid-react';
import type { TableColumn, TableRow } from '@atlasmail/shared';

export interface FindMatch {
  rowIndex: number;
  colId: string;
  rowId: string;
}

interface UseFindReplaceOptions {
  gridRef: React.RefObject<AgGridReact | null>;
  rows: TableRow[];
  columns: TableColumn[];
  hiddenColumns?: string[];
  onUpdateRows: (rows: TableRow[]) => void;
  pushUndoState: () => void;
}

export function useFindReplace({
  gridRef,
  rows,
  columns,
  hiddenColumns,
  onUpdateRows,
  pushUndoState,
}: UseFindReplaceOptions) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

  // Compute matches
  const matches = useMemo(() => {
    if (!searchTerm || !isOpen) return [];

    const hidden = new Set(hiddenColumns || []);
    const visibleCols = columns.filter((c) => !hidden.has(c.id));
    const result: FindMatch[] = [];
    const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      for (const col of visibleCols) {
        const val = row[col.id];
        if (val == null) continue;
        const str = String(val);
        const cmp = caseSensitive ? str : str.toLowerCase();
        if (cmp.includes(term)) {
          result.push({ rowIndex: rowIdx, colId: col.id, rowId: row._id });
        }
      }
    }
    return result;
  }, [searchTerm, rows, columns, hiddenColumns, caseSensitive, isOpen]);

  // Clamp current index
  useEffect(() => {
    if (currentMatchIndex >= matches.length) {
      setCurrentMatchIndex(0);
    }
  }, [matches, currentMatchIndex]);

  const currentMatch = matches.length > 0 ? matches[currentMatchIndex] : null;

  // Navigate to current match in grid
  useEffect(() => {
    if (!currentMatch || !gridRef.current?.api) return;
    const api = gridRef.current.api;
    api.ensureIndexVisible(currentMatch.rowIndex);
    api.ensureColumnVisible(currentMatch.colId);
  }, [currentMatch, gridRef]);

  const goToNext = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev + 1) % matches.length);
  }, [matches.length]);

  const goToPrev = useCallback(() => {
    if (matches.length === 0) return;
    setCurrentMatchIndex((prev) => (prev - 1 + matches.length) % matches.length);
  }, [matches.length]);

  const replaceCurrent = useCallback(() => {
    if (!currentMatch) return;
    pushUndoState();
    const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();
    const updated = rows.map((r) => {
      if (r._id !== currentMatch.rowId) return r;
      const val = r[currentMatch.colId];
      if (val == null) return r;
      const str = String(val);
      const cmp = caseSensitive ? str : str.toLowerCase();
      const idx = cmp.indexOf(term);
      if (idx === -1) return r;
      const newVal = str.slice(0, idx) + replaceTerm + str.slice(idx + term.length);
      return { ...r, [currentMatch.colId]: newVal };
    });
    onUpdateRows(updated);
  }, [currentMatch, rows, searchTerm, replaceTerm, caseSensitive, onUpdateRows, pushUndoState]);

  const replaceAll = useCallback(() => {
    if (matches.length === 0) return;
    pushUndoState();
    const matchSet = new Map<string, Set<string>>();
    for (const m of matches) {
      if (!matchSet.has(m.rowId)) matchSet.set(m.rowId, new Set());
      matchSet.get(m.rowId)!.add(m.colId);
    }
    const updated = rows.map((r) => {
      const colIds = matchSet.get(r._id);
      if (!colIds) return r;
      const copy = { ...r };
      for (const cid of colIds) {
        const val = copy[cid];
        if (val == null) continue;
        const str = String(val);
        // Replace all occurrences
        if (caseSensitive) {
          copy[cid] = str.split(searchTerm).join(replaceTerm);
        } else {
          copy[cid] = str.replace(new RegExp(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), replaceTerm.replace(/\$/g, '$$$$'));
        }
      }
      return copy;
    });
    onUpdateRows(updated);
  }, [matches, rows, searchTerm, replaceTerm, caseSensitive, onUpdateRows, pushUndoState]);

  const open = useCallback(() => {
    setIsOpen(true);
    setCurrentMatchIndex(0);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setSearchTerm('');
    setReplaceTerm('');
    setCurrentMatchIndex(0);
    // Refresh cells to remove highlights
    gridRef.current?.api?.refreshCells({ force: true });
  }, [gridRef]);

  // Build a Set for fast lookup in cellClassRules
  const matchSet = useMemo(() => {
    const set = new Set<string>();
    for (const m of matches) {
      set.add(`${m.rowIndex}:${m.colId}`);
    }
    return set;
  }, [matches]);

  const currentMatchKey = currentMatch ? `${currentMatch.rowIndex}:${currentMatch.colId}` : '';

  return {
    isOpen,
    searchTerm,
    setSearchTerm,
    replaceTerm,
    setReplaceTerm,
    caseSensitive,
    setCaseSensitive,
    matches,
    currentMatchIndex,
    currentMatch,
    matchSet,
    currentMatchKey,
    goToNext,
    goToPrev,
    replaceCurrent,
    replaceAll,
    open,
    close,
  };
}
