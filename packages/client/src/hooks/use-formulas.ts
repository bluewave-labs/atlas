import { useMemo, useCallback } from 'react';
import type { TableRow, TableColumn } from '@atlasmail/shared';
import { evaluateFormula, buildColMap, isFormulaValue, colIndexToLetter } from '../lib/formula-engine';

interface UseFormulasOptions {
  rows: TableRow[];
  columns: TableColumn[];
  hiddenColumns?: string[];
}

export function useFormulas({ rows, columns, hiddenColumns }: UseFormulasOptions) {
  const colMap = useMemo(
    () => buildColMap(columns),
    [columns],
  );

  // Compute all formula results
  const computedValues = useMemo(() => {
    const cache = new Map<string, unknown>(); // "rowId:colId" → computed value

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      for (const col of columns) {
        const val = row[col.id];
        if (isFormulaValue(val)) {
          const key = `${row._id}:${col.id}`;
          const result = evaluateFormula(val as string, rowIdx, rows, colMap);
          cache.set(key, result);
        }
      }
    }

    return cache;
  }, [rows, columns, colMap]);

  // Get computed value for a cell (returns raw value if not a formula)
  const getComputedValue = useCallback(
    (rowId: string, colId: string, rawValue: unknown): unknown => {
      if (!isFormulaValue(rawValue)) return rawValue;
      const key = `${rowId}:${colId}`;
      return computedValues.get(key) ?? rawValue;
    },
    [computedValues],
  );

  // Check if any cell has a formula
  const hasFormulas = useMemo(() => {
    return computedValues.size > 0;
  }, [computedValues]);

  // Get cell reference string (e.g., "A1")
  const getCellReference = useCallback(
    (rowIndex: number, colId: string): string => {
      const colIdx = colMap.indexOf(colId);
      if (colIdx === -1) return '';
      return `${colIndexToLetter(colIdx)}${rowIndex + 1}`;
    },
    [colMap],
  );

  return {
    computedValues,
    getComputedValue,
    hasFormulas,
    getCellReference,
    colMap,
  };
}
