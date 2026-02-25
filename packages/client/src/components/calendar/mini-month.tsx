import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CSSProperties } from 'react';

interface MiniMonthProps {
  selectedDate: string; // YYYY-MM-DD
  onSelectDate: (date: string) => void;
  weekStartsOnMonday?: boolean;
}

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DAY_NAMES_SUN = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const DAY_NAMES_MON = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

export function MiniMonth({ selectedDate, onSelectDate, weekStartsOnMonday = false }: MiniMonthProps) {
  const selectedDateObj = new Date(selectedDate + 'T12:00:00');
  const [viewYear, setViewYear] = useState(selectedDateObj.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDateObj.getMonth());

  const todayStr = useMemo(() => toYMD(new Date()), []);

  const dayNames = weekStartsOnMonday ? DAY_NAMES_MON : DAY_NAMES_SUN;

  const weeks = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const dow = firstDay.getDay(); // 0=Sun
    const offset = weekStartsOnMonday ? ((dow + 6) % 7) : dow;
    const start = new Date(firstDay);
    start.setDate(start.getDate() - offset);

    const rows: Date[][] = [];
    const cursor = new Date(start);
    for (let w = 0; w < 6; w++) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d++) {
        week.push(new Date(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
      rows.push(week);
    }
    // Skip last row if entirely in next month
    if (rows[5][0].getMonth() !== viewMonth) {
      rows.pop();
    }
    return rows;
  }, [viewYear, viewMonth, weekStartsOnMonday]);

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const cellSize = 26;

  return (
    <div style={{ padding: '8px 4px' }}>
      {/* Month header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
          padding: '0 2px',
        }}
      >
        <button onClick={prevMonth} style={navBtnStyle}>
          <ChevronLeft size={14} />
        </button>
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
            color: 'var(--color-text-primary)',
          }}
        >
          {monthLabel}
        </span>
        <button onClick={nextMonth} style={navBtnStyle}>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Day name headers */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(7, ${cellSize}px)`, justifyContent: 'center' }}>
        {dayNames.map((d) => (
          <div
            key={d}
            style={{
              height: cellSize,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              color: 'var(--color-text-tertiary)',
              fontWeight: 500,
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Date grid */}
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: 'grid', gridTemplateColumns: `repeat(7, ${cellSize}px)`, justifyContent: 'center' }}>
          {week.map((day) => {
            const dateStr = toYMD(day);
            const isCurrentMonth = day.getMonth() === viewMonth;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;

            return (
              <button
                key={dateStr}
                onClick={() => onSelectDate(dateStr)}
                style={{
                  width: cellSize,
                  height: cellSize,
                  padding: 0,
                  border: 'none',
                  borderRadius: 'var(--radius-full)',
                  background: isSelected
                    ? 'var(--color-accent-primary)'
                    : isToday
                      ? 'var(--color-accent-subtle)'
                      : 'transparent',
                  color: isSelected
                    ? 'var(--color-text-inverse)'
                    : isToday
                      ? 'var(--color-accent-primary)'
                      : isCurrentMonth
                        ? 'var(--color-text-primary)'
                        : 'var(--color-text-tertiary)',
                  fontSize: 11,
                  fontFamily: 'var(--font-family)',
                  fontWeight: isToday || isSelected ? 600 : 400,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'background var(--transition-fast)',
                  opacity: isCurrentMonth ? 1 : 0.5,
                }}
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const navBtnStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  padding: 0,
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
};
