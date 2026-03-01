import React, { useMemo, useRef } from 'react';
import type { TableColumn, TableRow } from '@atlasmail/shared';

interface GanttViewProps {
  columns: TableColumn[];
  rows: TableRow[];
  startColumnId: string | null;
  endColumnId: string | null;
  labelColumnId: string | null;
}

const DAY_WIDTH = 32;
const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 48;

function parseDate(val: unknown): Date | null {
  if (!val || typeof val !== 'string') return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function GanttView({ columns, rows, startColumnId, endColumnId, labelColumnId }: GanttViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { minDate, maxDate, items } = useMemo(() => {
    if (!startColumnId || !endColumnId) {
      return { minDate: new Date(), maxDate: new Date(), items: [] };
    }

    let earliest = Infinity;
    let latest = -Infinity;

    const parsed = rows.map((row) => {
      const start = parseDate(row[startColumnId]);
      const end = parseDate(row[endColumnId]);
      const label = labelColumnId ? String(row[labelColumnId] || '') : '';

      if (start) earliest = Math.min(earliest, start.getTime());
      if (end) latest = Math.max(latest, end.getTime());

      return { id: row._id, start, end, label };
    });

    if (earliest === Infinity) earliest = Date.now();
    if (latest === -Infinity) latest = Date.now() + 30 * 86400000;

    // Add padding
    const min = new Date(earliest - 7 * 86400000);
    const max = new Date(latest + 7 * 86400000);

    return { minDate: min, maxDate: max, items: parsed };
  }, [rows, startColumnId, endColumnId, labelColumnId]);

  const totalDays = daysBetween(minDate, maxDate) + 1;
  const totalWidth = totalDays * DAY_WIDTH;

  // Generate month headers
  const months = useMemo(() => {
    const result: Array<{ label: string; left: number; width: number }> = [];
    const current = new Date(minDate);
    current.setDate(1);

    while (current <= maxDate) {
      const monthStart = new Date(Math.max(current.getTime(), minDate.getTime()));
      const nextMonth = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      const monthEnd = new Date(Math.min(nextMonth.getTime() - 1, maxDate.getTime()));

      const left = daysBetween(minDate, monthStart) * DAY_WIDTH;
      const width = (daysBetween(monthStart, monthEnd) + 1) * DAY_WIDTH;

      const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      result.push({
        label: `${names[current.getMonth()]} ${current.getFullYear()}`,
        left,
        width,
      });

      current.setMonth(current.getMonth() + 1);
    }

    return result;
  }, [minDate, maxDate]);

  // Today marker
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayOffset = daysBetween(minDate, today) * DAY_WIDTH;

  if (!startColumnId || !endColumnId) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-400">
        Configure start and end date columns to use the Gantt view
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden border-t border-gray-200">
      {/* Row labels */}
      <div className="w-48 flex-shrink-0 border-r border-gray-200 bg-white">
        <div className="h-12 border-b border-gray-200 px-3 flex items-center text-xs font-medium text-gray-500">
          Name
        </div>
        {items.map((item) => (
          <div key={item.id} className="h-9 px-3 flex items-center text-sm text-gray-700 border-b border-gray-50 truncate">
            {item.label || '\u2014'}
          </div>
        ))}
      </div>

      {/* Timeline area */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <div style={{ width: totalWidth, minHeight: '100%' }} className="relative">
          {/* Month headers */}
          <div className="sticky top-0 z-10 h-12 bg-white border-b border-gray-200 flex">
            {months.map((m, i) => (
              <div
                key={i}
                className="absolute top-0 h-full flex items-center px-2 text-xs font-medium text-gray-500 border-r border-gray-100"
                style={{ left: m.left, width: m.width }}
              >
                {m.label}
              </div>
            ))}
          </div>

          {/* Today line */}
          {todayOffset >= 0 && todayOffset <= totalWidth && (
            <div
              className="absolute top-0 bottom-0 w-px bg-red-400 z-20"
              style={{ left: todayOffset }}
            />
          )}

          {/* Bars */}
          {items.map((item, idx) => {
            if (!item.start || !item.end) return null;
            const left = daysBetween(minDate, item.start) * DAY_WIDTH;
            const width = Math.max((daysBetween(item.start, item.end) + 1) * DAY_WIDTH, DAY_WIDTH);

            return (
              <div
                key={item.id}
                className="absolute h-6 rounded bg-blue-500/80 hover:bg-blue-600/80 transition-colors cursor-pointer"
                style={{
                  left,
                  width,
                  top: HEADER_HEIGHT + idx * ROW_HEIGHT + (ROW_HEIGHT - 24) / 2,
                }}
                title={item.label}
              />
            );
          })}

          {/* Row grid lines */}
          {items.map((_, idx) => (
            <div
              key={idx}
              className="absolute left-0 right-0 border-b border-gray-50"
              style={{ top: HEADER_HEIGHT + (idx + 1) * ROW_HEIGHT }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
