import { useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plus,
} from 'lucide-react';
import '../styles/calendar.css';
import { useCalendars, useCalendarEvents, useSyncCalendar, useToggleCalendar } from '../hooks/use-calendar';
import { useCalendarStore } from '../stores/calendar-store';
import { EventModal } from '../components/calendar/event-modal';
import { MiniMonth } from '../components/calendar/mini-month';
import { WeekGrid } from '../components/calendar/week-grid';
import type { CSSProperties } from 'react';

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Get the Sunday that starts the week containing the given date */
function getWeekStart(dateStr: string): Date {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getTimeRange(weekStart: Date) {
  const start = new Date(weekStart);
  start.setDate(start.getDate() - 7);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 14);
  return {
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
  };
}

function formatWeekRange(weekStart: Date): string {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const sMonth = weekStart.toLocaleDateString('en-US', { month: 'long' });
  const eMonth = weekEnd.toLocaleDateString('en-US', { month: 'long' });
  const sDay = weekStart.getDate();
  const eDay = weekEnd.getDate();
  const year = weekEnd.getFullYear();

  if (sMonth === eMonth) {
    return `${sMonth} ${sDay} \u2013 ${eDay}, ${year}`;
  }
  return `${sMonth} ${sDay} \u2013 ${eMonth} ${eDay}, ${year}`;
}

export function CalendarPage() {
  const navigate = useNavigate();
  const {
    selectedDate,
    setSelectedDate,
    openCreateModal,
    openEditModal,
  } = useCalendarStore();

  const weekStart = useMemo(() => getWeekStart(selectedDate), [selectedDate]);
  const { timeMin, timeMax } = useMemo(() => getTimeRange(weekStart), [weekStart]);
  const { data: calendars } = useCalendars();
  const { data: events } = useCalendarEvents(timeMin, timeMax);
  const syncCalendar = useSyncCalendar();
  const toggleCalendar = useToggleCalendar();

  // Derive selected calendar IDs and color map
  const selectedCalendarIds = useMemo(() => {
    if (!calendars) return new Set<string>();
    return new Set(calendars.filter((c) => c.isSelected).map((c) => c.id));
  }, [calendars]);

  const calendarColorMap = useMemo(() => {
    const map = new Map<string, string>();
    if (calendars) {
      for (const c of calendars) {
        map.set(c.id, c.backgroundColor || '#5a7fa0');
      }
    }
    return map;
  }, [calendars]);

  // Initial sync on mount
  useEffect(() => {
    syncCalendar.mutate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const goToday = useCallback(() => setSelectedDate(toYMD(new Date())), [setSelectedDate]);

  const goPrevWeek = useCallback(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - 7);
    setSelectedDate(toYMD(d));
  }, [selectedDate, setSelectedDate]);

  const goNextWeek = useCallback(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + 7);
    setSelectedDate(toYMD(d));
  }, [selectedDate, setSelectedDate]);

  const weekRangeLabel = useMemo(() => formatWeekRange(weekStart), [weekStart]);

  const handleDragCreate = useCallback(
    (start: Date, end: Date) => {
      openCreateModal(start.toISOString(), end.toISOString());
    },
    [openCreateModal],
  );

  const isDesktop = !!('atlasDesktop' in window);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--color-bg-primary)',
        fontFamily: 'var(--font-family)',
        overflow: 'hidden',
      }}
    >
      {/* Top toolbar */}
      <div
        className={isDesktop ? 'desktop-drag-region' : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          padding: '6px 16px',
          paddingTop: isDesktop ? 40 : 6,
          borderBottom: '1px solid var(--color-border-primary)',
          background: 'var(--color-bg-secondary)',
          flexShrink: 0,
        }}
      >
        {/* Back to inbox */}
        <button
          onClick={() => navigate('/')}
          title="Back to inbox"
          style={iconBtnStyle}
        >
          <ArrowLeft size={16} />
        </button>

        <div style={{ width: 1, height: 20, background: 'var(--color-border-primary)', margin: '0 4px' }} />

        {/* Today button */}
        <button onClick={goToday} style={toolbarBtnStyle}>
          Today
        </button>

        {/* Prev / Next */}
        <button onClick={goPrevWeek} style={iconBtnStyle}>
          <ChevronLeft size={16} />
        </button>
        <button onClick={goNextWeek} style={iconBtnStyle}>
          <ChevronRight size={16} />
        </button>

        {/* Week range label */}
        <span
          style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
            color: 'var(--color-text-primary)',
            marginLeft: 4,
          }}
        >
          {weekRangeLabel}
        </span>

        <div style={{ flex: 1 }} />

        {/* Sync button */}
        <button
          onClick={() => syncCalendar.mutate()}
          disabled={syncCalendar.isPending}
          title="Sync calendar"
          style={{
            ...iconBtnStyle,
            border: '1px solid var(--color-border-primary)',
            opacity: syncCalendar.isPending ? 0.5 : 1,
          }}
        >
          <RefreshCw
            size={13}
            style={{
              animation: syncCalendar.isPending ? 'spin 1s linear infinite' : undefined,
            }}
          />
        </button>

        {/* New event button */}
        <button
          onClick={() => openCreateModal()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            height: 30,
            padding: '0 12px',
            background: 'var(--color-accent-primary)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--color-text-inverse)',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-family)',
            fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
            cursor: 'pointer',
          }}
        >
          <Plus size={14} />
          New event
        </button>
      </div>

      {/* Main content: sidebar + week grid */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left sidebar */}
        <div
          style={{
            width: 210,
            flexShrink: 0,
            borderRight: '1px solid var(--color-border-primary)',
            background: 'var(--color-bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Mini month picker */}
          <MiniMonth selectedDate={selectedDate} onSelectDate={setSelectedDate} />

          <div style={{ height: 1, background: 'var(--color-border-primary)', margin: '4px 8px' }} />

          {/* Calendar list */}
          <div style={{ padding: '8px 12px', flex: 1, overflowY: 'auto' }}>
            <div
              style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 6,
              }}
            >
              Calendars
            </div>
            {calendars?.map((cal) => {
              const color = cal.backgroundColor || '#5a7fa0';
              return (
                <label
                  key={cal.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '4px 0',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={cal.isSelected}
                    onChange={() =>
                      toggleCalendar.mutate({ calendarId: cal.id, isSelected: !cal.isSelected })
                    }
                    style={{ accentColor: color, width: 14, height: 14, cursor: 'pointer' }}
                  />
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cal.summary || 'Calendar'}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Week grid */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <WeekGrid
            weekStart={weekStart}
            events={events || []}
            selectedCalendarIds={selectedCalendarIds}
            calendarColorMap={calendarColorMap}
            onEventClick={openEditModal}
            onDragCreate={handleDragCreate}
          />
        </div>
      </div>

      {/* Event modal */}
      <EventModal />

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const iconBtnStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  padding: 0,
  background: 'transparent',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text-secondary)',
  cursor: 'pointer',
};

const toolbarBtnStyle: CSSProperties = {
  height: 28,
  padding: '0 10px',
  background: 'transparent',
  border: '1px solid var(--color-border-primary)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text-primary)',
  fontSize: 'var(--font-size-sm)',
  fontFamily: 'var(--font-family)',
  cursor: 'pointer',
};
