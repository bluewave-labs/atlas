import { useState, useMemo, useCallback, useEffect } from 'react';
import type { TableRow, TableColumn } from '@atlasmail/shared';

export interface GroupHeaderRow {
  _id: string;
  _createdAt: string;
  _isGroupHeader: true;
  _groupValue: string;
  _groupCount: number;
  _collapsed: boolean;
  _groupKey: string;
  _groupAggregations?: Record<string, { sum: number; avg: number; count: number }>;
  [key: string]: unknown;
}

export type MaybeGroupedRow = TableRow | GroupHeaderRow;

export function isGroupHeaderRow(row: MaybeGroupedRow): row is GroupHeaderRow {
  return (row as GroupHeaderRow)._isGroupHeader === true;
}

interface UseRowGroupingOptions {
  rows: TableRow[];
  groupByColumnId: string | null;
  columns: TableColumn[];
}

export function useRowGrouping({ rows, groupByColumnId, columns }: UseRowGroupingOptions) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }, []);

  const clearGrouping = useCallback(() => {
    setCollapsedGroups(new Set());
  }, []);

  // Reset collapsed state when group-by column changes
  useEffect(() => {
    setCollapsedGroups(new Set());
  }, [groupByColumnId]);

  const groupedRows: MaybeGroupedRow[] = useMemo(() => {
    if (!groupByColumnId) return rows;

    // Group rows by value
    const groups = new Map<string, TableRow[]>();
    const order: string[] = [];

    for (const row of rows) {
      const val = row[groupByColumnId];
      const key = val != null && val !== '' ? String(val) : '(empty)';
      if (!groups.has(key)) {
        groups.set(key, []);
        order.push(key);
      }
      groups.get(key)!.push(row);
    }

    // Find numeric columns for aggregations
    const numericCols = columns.filter((c) => c.type === 'number' || c.type === 'currency' || c.type === 'percent');

    const result: MaybeGroupedRow[] = [];

    for (const groupValue of order) {
      const groupRows = groups.get(groupValue)!;
      const isCollapsed = collapsedGroups.has(groupValue);

      // Compute aggregations
      const aggregations: Record<string, { sum: number; avg: number; count: number }> = {};
      for (const col of numericCols) {
        let sum = 0;
        let count = 0;
        for (const r of groupRows) {
          const v = Number(r[col.id]);
          if (!isNaN(v) && r[col.id] != null && r[col.id] !== '') {
            sum += v;
            count++;
          }
        }
        aggregations[col.id] = {
          sum: Math.round(sum * 100) / 100,
          avg: count > 0 ? Math.round((sum / count) * 100) / 100 : 0,
          count,
        };
      }

      // Add group header row
      const header: GroupHeaderRow = {
        _id: `__group_${groupByColumnId}_${groupValue}`,
        _createdAt: '',
        _isGroupHeader: true,
        _groupValue: groupValue,
        _groupCount: groupRows.length,
        _collapsed: isCollapsed,
        _groupKey: groupValue,
        _groupAggregations: aggregations,
      };
      result.push(header);

      // Add child rows if not collapsed
      if (!isCollapsed) {
        result.push(...groupRows);
      }
    }

    return result;
  }, [rows, groupByColumnId, columns, collapsedGroups]);

  return {
    groupedRows,
    toggleGroup,
    clearGrouping,
    isGrouped: groupByColumnId != null,
  };
}
