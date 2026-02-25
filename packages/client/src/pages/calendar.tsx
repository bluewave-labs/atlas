import { useEffect, useMemo, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from 'lucide-react';
import { useMediaQuery } from '../hooks/use-media-query';
import '../styles/calendar.css';
import { useCalendars, useCalendarEvents, useSyncCalendar, useToggleCalendar, useUpdateCalendarEvent, useCreateCalendarEvent, useDeleteCalendarEvent } from '../hooks/use-calendar';
import { useCalendarStore } from '../stores/calendar-store';
import { useToastStore } from '../stores/toast-store';
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

/** Get the start of the week containing the given date. Sunday-start by default. */
function getWeekStart(dateStr: string, mondayStart = false): Date {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay(); // 0=Sun
  const offset = mondayStart ? ((day + 6) % 7) : day;
  d.setDate(d.getDate() - offset);
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
    view,
    setView,
    weekStartsOnMonday,
    setWeekStartsOnMonday,
    openCreateModal,
    openEditModal,
  } = useCalendarStore();

  const weekStart = useMemo(() => {
    if (view === 'day') {
      const d = new Date(selectedDate + 'T12:00:00');
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return getWeekStart(selectedDate, weekStartsOnMonday);
  }, [selectedDate, view, weekStartsOnMonday]);
  const { timeMin, timeMax } = useMemo(() => getTimeRange(weekStart), [weekStart]);
  const { data: calendars } = useCalendars();
  const { data: events } = useCalendarEvents(timeMin, timeMax);
  const syncCalendar = useSyncCalendar();
  const toggleCalendar = useToggleCalendar();
  const updateEvent = useUpdateCalendarEvent();
  const createEvent = useCreateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();

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

  const step = view === 'day' ? 1 : 7;

  const goPrev = useCallback(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() - step);
    setSelectedDate(toYMD(d));
  }, [selectedDate, setSelectedDate, step]);

  const goNext = useCallback(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + step);
    setSelectedDate(toYMD(d));
  }, [selectedDate, setSelectedDate, step]);

  const dateLabel = useMemo(() => {
    if (view === 'day') {
      const d = new Date(selectedDate + 'T12:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    return formatWeekRange(weekStart);
  }, [weekStart, view, selectedDate]);

  const handleDragCreate = useCallback(
    (start: Date, end: Date) => {
      openCreateModal(start.toISOString(), end.toISOString());
    },
    [openCreateModal],
  );

  const handleEventUpdate = useCallback(
    (eventId: string, startTime: string, endTime: string) => {
      updateEvent.mutate({ eventId, startTime, endTime });
    },
    [updateEvent],
  );

  const handleEventDelete = useCallback(
    (eventId: string) => {
      deleteEvent.mutate(eventId);
    },
    [deleteEvent],
  );

  const handleQuickCreate = useCallback(
    (title: string, start: Date, end: Date) => {
      const primaryCalendarId = calendars?.find((c) => c.isPrimary)?.id || calendars?.[0]?.id;
      if (!primaryCalendarId) return;
      createEvent.mutate({
        calendarId: primaryCalendarId,
        summary: title,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      });
    },
    [calendars, createEvent],
  );

  // ─── Keyboard shortcuts ──────────────────────────────────────────────
  const { eventModal } = useCalendarStore();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs or when modal is open
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (eventModal.open) return;

      switch (e.key) {
        case 'c':
          e.preventDefault();
          openCreateModal();
          break;
        case 't':
          e.preventDefault();
          goToday();
          break;
        case 'j':
        case 'ArrowRight':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            goNext();
          }
          break;
        case 'k':
        case 'ArrowLeft':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            goPrev();
          }
          break;
        case 'r':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            syncCalendar.mutate();
          }
          break;
        case 'd':
          e.preventDefault();
          setView('day');
          break;
        case 'w':
          e.preventDefault();
          setView('week');
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openCreateModal, goToday, goNext, goPrev, syncCalendar, setView, eventModal.open]);

  // ─── Sync toasts ────────────────────────────────────────────────────
  const addToast = useToastStore((s) => s.addToast);
  const prevSyncStatus = useRef<'idle' | 'pending' | 'success' | 'error'>('idle');
  useEffect(() => {
    const status = syncCalendar.isPending ? 'pending' : syncCalendar.isSuccess ? 'success' : syncCalendar.isError ? 'error' : 'idle';
    if (prevSyncStatus.current === 'pending' && status === 'success') {
      addToast({ message: 'Calendar synced', type: 'success', duration: 3000 });
    } else if (prevSyncStatus.current === 'pending' && status === 'error') {
      addToast({ message: 'Sync failed — try again', type: 'error', duration: 5000 });
    }
    prevSyncStatus.current = status;
  }, [syncCalendar.isPending, syncCalendar.isSuccess, syncCalendar.isError, addToast]);

  const isDesktop = !!('atlasDesktop' in window);
  const isNarrow = useMediaQuery('(max-width: 900px)');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const showSidebar = !sidebarCollapsed && !isNarrow;
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEvents = useMemo(() => {
    if (!events) return [];
    if (!searchQuery.trim()) return events;
    const q = searchQuery.trim().toLowerCase();
    return events.filter(
      (ev) =>
        ev.summary?.toLowerCase().includes(q) ||
        ev.location?.toLowerCase().includes(q) ||
        ev.description?.toLowerCase().includes(q),
    );
  }, [events, searchQuery]);

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

        {/* Sidebar toggle */}
        {!isNarrow && (
          <button
            onClick={() => setSidebarCollapsed((v) => !v)}
            title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            style={iconBtnStyle}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        )}

        <div style={{ width: 1, height: 20, background: 'var(--color-border-primary)', margin: '0 4px' }} />

        {/* Today button */}
        <button onClick={goToday} style={toolbarBtnStyle}>
          Today
        </button>

        {/* Prev / Next */}
        <button onClick={goPrev} style={iconBtnStyle}>
          <ChevronLeft size={16} />
        </button>
        <button onClick={goNext} style={iconBtnStyle}>
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
          {dateLabel}
        </span>

        {/* View switcher */}
        <div
          style={{
            display: 'flex',
            marginLeft: 12,
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }}
        >
          {(['day', 'week'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                height: 26,
                padding: '0 10px',
                background: view === v ? 'var(--color-accent-primary)' : 'transparent',
                border: 'none',
                color: view === v ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-xs)',
                fontFamily: 'var(--font-family)',
                fontWeight: view === v ? 600 : 400,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {v}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Search
            size={13}
            style={{
              position: 'absolute',
              left: 8,
              color: 'var(--color-text-tertiary)',
              pointerEvents: 'none',
            }}
          />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events"
            style={{
              width: isNarrow ? 120 : 180,
              height: 28,
              paddingLeft: 28,
              paddingRight: 8,
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-xs)',
              fontFamily: 'var(--font-family)',
              outline: 'none',
            }}
          />
        </div>

        {/* Timezone label */}
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-tertiary)',
            whiteSpace: 'nowrap',
          }}
          title={Intl.DateTimeFormat().resolvedOptions().timeZone}
        >
          {new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop()}
        </span>

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
        {showSidebar && (
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
          <MiniMonth selectedDate={selectedDate} onSelectDate={setSelectedDate} weekStartsOnMonday={weekStartsOnMonday} />

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

            <div style={{ height: 1, background: 'var(--color-border-primary)', margin: '8px 0' }} />

            {/* Settings */}
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
              Settings
            </div>
            <label
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
                checked={weekStartsOnMonday}
                onChange={(e) => setWeekStartsOnMonday(e.target.checked)}
                style={{ width: 14, height: 14, cursor: 'pointer' }}
              />
              Week starts on Monday
            </label>
          </div>
        </div>
        )}

        {/* Week grid */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <WeekGrid
            weekStart={weekStart}
            events={filteredEvents}
            selectedCalendarIds={selectedCalendarIds}
            calendarColorMap={calendarColorMap}
            onEventClick={openEditModal}
            onDragCreate={handleDragCreate}
            onEventUpdate={handleEventUpdate}
            onQuickCreate={handleQuickCreate}
            onEventDelete={handleEventDelete}
            dayCount={isNarrow ? 1 : view === 'day' ? 1 : 7}
            weekStartsOnMonday={weekStartsOnMonday}
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
