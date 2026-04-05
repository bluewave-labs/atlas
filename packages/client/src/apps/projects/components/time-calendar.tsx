import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTimeEntries, type TimeEntry } from '../hooks';
import { IconButton } from '../../../components/ui/icon-button';
import { formatNumber } from '../../../lib/format';

// ─── Helpers ──────────────────────────────────────────────────────

function getMonthDates(year: number, month: number): Array<{ date: string; isCurrentMonth: boolean }> {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0

  const dates: Array<{ date: string; isCurrentMonth: boolean }> = [];

  // Previous month days
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    dates.push({ date: d.toISOString().slice(0, 10), isCurrentMonth: false });
  }

  // Current month days
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i);
    dates.push({ date: d.toISOString().slice(0, 10), isCurrentMonth: true });
  }

  // Next month days to fill grid
  const remaining = 7 - (dates.length % 7);
  if (remaining < 7) {
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      dates.push({ date: d.toISOString().slice(0, 10), isCurrentMonth: false });
    }
  }

  return dates;
}

function getMonthName(month: number, t: (k: string) => string): string {
  const keys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  return t(`projects.calendar.${keys[month]}`);
}

function getDayNames(t: (k: string) => string): string[] {
  return ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => t(`projects.calendar.${d}`));
}

// ─── Component ────────────────────────────────────────────────────

export function TimeCalendar() {
  const { t } = useTranslation();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth());

  const firstOfMonth = new Date(year, month, 1).toISOString().slice(0, 10);
  const lastOfMonth = new Date(year, month + 1, 0).toISOString().slice(0, 10);

  const { data: entriesData } = useTimeEntries({ startDate: firstOfMonth, endDate: lastOfMonth });
  const entries = entriesData?.entries ?? [];

  const monthDates = useMemo(() => getMonthDates(year, month), [year, month]);

  // Group entries by date and project
  const entryMap = useMemo(() => {
    const map = new Map<string, Array<{ projectId: string; projectName: string; projectColor: string; hours: number }>>();
    entries.forEach((entry) => {
      if (!map.has(entry.date)) map.set(entry.date, []);
      const list = map.get(entry.date)!;
      const existing = list.find((e) => e.projectId === entry.projectId);
      if (existing) {
        existing.hours += entry.hours;
      } else {
        list.push({
          projectId: entry.projectId,
          projectName: entry.projectName || '',
          projectColor: entry.projectColor || '#6b7280',
          hours: entry.hours,
        });
      }
    });
    return map;
  }, [entries]);

  const navigateMonth = (direction: number) => {
    const d = new Date(year, month + direction, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  return (
    <div style={{ padding: 'var(--spacing-lg)', overflow: 'auto', flex: 1 }}>
      {/* Month navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <IconButton icon={<ChevronLeft size={14} />} label={t('projects.timeTracking.prevMonth')} size={28} onClick={() => navigateMonth(-1)} />
        <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', minWidth: 160, textAlign: 'center' }}>
          {getMonthName(month, t)} {year}
        </span>
        <IconButton icon={<ChevronRight size={14} />} label={t('projects.timeTracking.nextMonth')} size={28} onClick={() => navigateMonth(1)} />
      </div>

      {/* Calendar grid */}
      <div className="projects-calendar">
        {/* Day headers */}
        {getDayNames(t).map((day) => (
          <div key={day} className="projects-calendar-header">{day}</div>
        ))}

        {/* Day cells */}
        {monthDates.map(({ date, isCurrentMonth }) => {
          const dayEntries = entryMap.get(date) || [];
          const totalHours = dayEntries.reduce((sum, e) => sum + e.hours, 0);
          const dayNumber = new Date(date + 'T00:00:00').getDate();

          return (
            <div key={date} className={`projects-calendar-day${isCurrentMonth ? '' : ' other-month'}`}>
              <div className="projects-calendar-day-number">{dayNumber}</div>
              {totalHours > 0 && (
                <div className="projects-calendar-day-hours">{formatNumber(totalHours, 1)}h</div>
              )}
              {dayEntries.slice(0, 3).map((entry) => (
                <div
                  key={entry.projectId}
                  className="projects-calendar-bar"
                  style={{ backgroundColor: entry.projectColor }}
                  title={`${entry.projectName}: ${entry.hours}h`}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
