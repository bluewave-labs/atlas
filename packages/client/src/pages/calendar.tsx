import { useEffect, useMemo, useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Layers,
  RefreshCw,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useMediaQuery } from '../hooks/use-media-query';
import { useUIStore } from '../stores/ui-store';
import { api } from '../lib/api-client';
import '../styles/calendar.css';
import { Button } from '../components/ui/button';
import { IconButton } from '../components/ui/icon-button';
import { Input } from '../components/ui/input';
import { Select } from '../components/ui/select';
import { useCalendars, useCalendarEvents, useAggregatedEvents, useSyncCalendar, useToggleCalendar, useCreateCalendar, useUpdateCalendarEvent, useCreateCalendarEvent, useDeleteCalendarEvent, useSearchCalendarEvents } from '../hooks/use-calendar';
import type { AggregatedEvent } from '../hooks/use-calendar';
import type { CalendarEvent } from '@atlas-platform/shared';
import { useCalendarStore } from '../stores/calendar-store';
import { useCalendarSettingsStore } from '../stores/calendar-settings-store';
import { useToastStore } from '../stores/toast-store';
import { EventModal } from '../components/calendar/event-modal';
import { MiniMonth } from '../components/calendar/mini-month';
import { WeekGrid } from '../components/calendar/week-grid';
import { MonthGrid } from '../components/calendar/month-grid';
import { AgendaView } from '../components/calendar/agenda-view';
import { YearGrid } from '../components/calendar/year-grid';
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
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openSettings } = useUIStore();
  const {
    selectedDate,
    setSelectedDate,
    view,
    setView,
    openCreateModal,
    openEditModal,
  } = useCalendarStore();

  const {
    weekStartsOnMonday,
    showWeekNumbers,
    density: calendarDensity,
    workStartHour,
    workEndHour,
    secondaryTimezone,
    setSecondaryTimezone,
    eventReminderMinutes,
  } = useCalendarSettingsStore();

  const hourHeight = calendarDensity === 'compact' ? 40 : calendarDensity === 'comfortable' ? 72 : 56;

  const weekStart = useMemo(() => {
    if (view === 'day') {
      const d = new Date(selectedDate + 'T12:00:00');
      d.setHours(0, 0, 0, 0);
      return d;
    }
    if (view === 'month-grid') {
      // For month view, get the first of the month, then back up to the week start
      const d = new Date(selectedDate + 'T12:00:00');
      d.setDate(1);
      const day = d.getDay();
      const offset = weekStartsOnMonday ? ((day + 6) % 7) : day;
      d.setDate(d.getDate() - offset);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    return getWeekStart(selectedDate, weekStartsOnMonday);
  }, [selectedDate, view, weekStartsOnMonday]);

  const { timeMin, timeMax } = useMemo(() => {
    if (view === 'agenda') {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 90);
      return { timeMin: start.toISOString(), timeMax: end.toISOString() };
    }
    if (view === 'month-grid') {
      // Month view needs ~6 weeks of data
      const start = new Date(weekStart);
      start.setDate(start.getDate() - 7);
      const end = new Date(weekStart);
      end.setDate(end.getDate() + 49); // 7 weeks to be safe
      return { timeMin: start.toISOString(), timeMax: end.toISOString() };
    }
    return getTimeRange(weekStart);
  }, [weekStart, view]);
  const [showAllApps, setShowAllApps] = useState(true);

  const { data: calendars } = useCalendars();
  const { data: events, isLoading: eventsLoading } = useCalendarEvents(timeMin, timeMax);
  const { data: aggregatedEvents } = useAggregatedEvents(
    showAllApps ? timeMin : '',
    showAllApps ? timeMax : '',
  );
  const syncCalendar = useSyncCalendar();
  const toggleCalendar = useToggleCalendar();
  const updateEvent = useUpdateCalendarEvent();
  const createEvent = useCreateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();
  const createCalendar = useCreateCalendar();
  const addToast = useToastStore((s) => s.addToast);
  const [showAddCalendar, setShowAddCalendar] = useState(false);
  const [newCalName, setNewCalName] = useState('');
  const [newCalColor, setNewCalColor] = useState('#039be5');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);
  const [showTzPicker, setShowTzPicker] = useState(false);
  const tzPickerRef = useRef<HTMLDivElement>(null);
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [scrollToTime, setScrollToTime] = useState<string | null>(null);

  // Clear scrollToTime after it's been consumed
  useEffect(() => {
    if (!scrollToTime) return;
    const id = setTimeout(() => setScrollToTime(null), 500);
    return () => clearTimeout(id);
  }, [scrollToTime]);

  // Derive selected calendar IDs and color map
  const selectedCalendarIds = useMemo(() => {
    if (!calendars) return new Set<string>();
    const ids = new Set(calendars.filter((c) => c.isSelected).map((c) => c.id));
    // Include virtual calendar IDs for aggregated app events
    if (showAllApps) {
      ids.add('__crm__');
      ids.add('__hr-leave__');
      ids.add('__task__');
    }
    return ids;
  }, [calendars, showAllApps]);

  const calendarColorMap = useMemo(() => {
    const map = new Map<string, string>();
    if (calendars) {
      for (const c of calendars) {
        map.set(c.id, c.backgroundColor || '#5a7fa0');
      }
    }
    return map;
  }, [calendars]);

  // Compute event days set for mini-month indicators
  const eventDays = useMemo(() => {
    const set = new Set<string>();
    if (events) {
      for (const ev of events) {
        if (!selectedCalendarIds.has(ev.calendarId)) continue;
        const start = new Date(ev.startTime);
        const end = new Date(ev.endTime);
        // Add each day the event spans
        const cursor = new Date(start);
        cursor.setHours(0, 0, 0, 0);
        while (cursor <= end) {
          set.add(toYMD(cursor));
          cursor.setDate(cursor.getDate() + 1);
        }
      }
    }
    return set;
  }, [events, selectedCalendarIds]);

  // Initial sync on mount
  useEffect(() => {
    syncCalendar.mutate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Browser notifications for upcoming events ────────────────────────
  const notifiedRef = useRef(new Set<string>());
  useEffect(() => {
    if (!events || events.length === 0) return;
    if (!('Notification' in window)) return;
    if (eventReminderMinutes <= 0) return;

    // Request permission if not yet decided
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const checkUpcoming = () => {
      if (Notification.permission !== 'granted') return;
      const now = Date.now();
      const reminderMs = eventReminderMinutes * 60 * 1000;

      for (const ev of events) {
        if (!selectedCalendarIds.has(ev.calendarId)) continue;
        if (ev.isAllDay) continue;
        const startMs = new Date(ev.startTime).getTime();
        const diff = startMs - now;

        // Notify if event starts within the reminder window and we haven't already
        if (diff > 0 && diff <= reminderMs && !notifiedRef.current.has(ev.id)) {
          notifiedRef.current.add(ev.id);
          const minutesAway = Math.ceil(diff / 60_000);
          new Notification(ev.summary || t('calendar.upcomingEvent'), {
            body: `Starts in ${minutesAway} minute${minutesAway === 1 ? '' : 's'}`,
            icon: '/favicon.ico',
            tag: ev.id,
          });
        }
      }
    };

    checkUpcoming();
    const id = setInterval(checkUpcoming, 60_000);
    return () => clearInterval(id);
  }, [events, selectedCalendarIds, eventReminderMinutes]);

  const goToday = useCallback(() => setSelectedDate(toYMD(new Date())), [setSelectedDate]);

  const goPrev = useCallback(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    if (view === 'month-grid') {
      d.setMonth(d.getMonth() - 1);
    } else {
      d.setDate(d.getDate() - (view === 'day' ? 1 : 7));
    }
    setSelectedDate(toYMD(d));
  }, [selectedDate, setSelectedDate, view]);

  const goNext = useCallback(() => {
    const d = new Date(selectedDate + 'T12:00:00');
    if (view === 'month-grid') {
      d.setMonth(d.getMonth() + 1);
    } else {
      d.setDate(d.getDate() + (view === 'day' ? 1 : 7));
    }
    setSelectedDate(toYMD(d));
  }, [selectedDate, setSelectedDate, view]);

  const dateLabel = useMemo(() => {
    if (view === 'day') {
      const d = new Date(selectedDate + 'T12:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
    if (view === 'month-grid') {
      const d = new Date(selectedDate + 'T12:00:00');
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    return formatWeekRange(weekStart);
  }, [weekStart, view, selectedDate]);

  const handleDragCreate = useCallback(
    (start: Date, end: Date, isAllDay?: boolean) => {
      openCreateModal(start.toISOString(), end.toISOString(), isAllDay);
    },
    [openCreateModal],
  );

  const handleEventClick = useCallback(
    (event: CalendarEvent) => {
      // If this is an aggregated app event with a route, navigate instead of opening modal
      const evAny = event as any;
      if (evAny._route) {
        navigate(evAny._route);
        return;
      }
      openEditModal(event);
    },
    [navigate, openEditModal],
  );

  const handleRSVP = useCallback(
    (eventId: string, status: 'accepted' | 'declined' | 'tentative') => {
      updateEvent.mutate({ eventId, responseStatus: status });
    },
    [updateEvent],
  );

  const handleEventUpdate = useCallback(
    (eventId: string, startTime: string, endTime: string) => {
      // Commit any pending undo toasts to avoid stale-snapshot race conditions
      const currentToasts = useToastStore.getState().toasts;
      for (const t of currentToasts) {
        if (t.type === 'undo' && t.commitAction) {
          useToastStore.getState().commitToast(t.id);
        }
      }

      // Cancel in-flight calendar queries so they don't overwrite our optimistic update
      queryClient.cancelQueries({ queryKey: ['calendar', 'events'] });

      // Snapshot all event caches so undo can restore exact previous state
      const previousQueries = queryClient.getQueriesData<any>({ queryKey: ['calendar', 'events'] });

      // Optimistically apply the new times to every matching cache entry
      queryClient.setQueriesData<any>(
        { queryKey: ['calendar', 'events'] },
        (old: any) => {
          if (!old) return old;
          return (old as any[]).map((ev: any) =>
            ev.id === eventId ? { ...ev, startTime, endTime } : ev,
          );
        },
      );

      addToast({
        type: 'undo',
        message: t('calendar.eventUpdated'),
        duration: 5000,
        undoAction: () => {
          // Restore the snapshot — refetch will reconcile with the server
          for (const [key, data] of previousQueries) {
            queryClient.setQueryData(key, data);
          }
          // Refetch to reconcile with server
          queryClient.invalidateQueries({ queryKey: ['calendar', 'events'] });
        },
        commitAction: () => {
          updateEvent.mutate({ eventId, startTime, endTime });
        },
      });
    },
    [updateEvent, queryClient, addToast],
  );

  const handleEventDelete = useCallback(
    (eventId: string) => {
      // Cancel in-flight queries so they don't overwrite our optimistic update
      queryClient.cancelQueries({ queryKey: ['calendar', 'events'] });

      // Snapshot current event caches for rollback
      const previousQueries = queryClient.getQueriesData<any>({ queryKey: ['calendar', 'events'] });

      // Optimistically remove from all caches
      queryClient.setQueriesData<any>(
        { queryKey: ['calendar', 'events'] },
        (old: any) => {
          if (!old) return old;
          return (old as any[]).filter((ev: any) => ev.id !== eventId);
        },
      );

      addToast({
        type: 'undo',
        message: t('calendar.eventDeleted'),
        duration: 5000,
        undoAction: () => {
          // Restore previous caches
          for (const [key, data] of previousQueries) {
            queryClient.setQueryData(key, data);
          }
          // Refetch to reconcile with server
          queryClient.invalidateQueries({ queryKey: ['calendar', 'events'] });
        },
        commitAction: () => {
          deleteEvent.mutate({ eventId });
        },
      });
    },
    [deleteEvent, queryClient, addToast],
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
      setScrollToTime(start.toISOString());
    },
    [calendars, createEvent],
  );

  const handleEventDuplicate = useCallback(
    (event: CalendarEvent) => {
      createEvent.mutate({
        calendarId: event.calendarId,
        summary: `${event.summary || '(No title)'} (copy)`,
        description: event.description || undefined,
        location: event.location || undefined,
        startTime: event.startTime,
        endTime: event.endTime,
        isAllDay: event.isAllDay,
        colorId: event.colorId || undefined,
      });
      setScrollToTime(event.startTime);
    },
    [createEvent],
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
        case 'm':
          e.preventDefault();
          setView('month-grid');
          break;
        case 'a':
          e.preventDefault();
          setView('agenda');
          break;
        case 'y':
          e.preventDefault();
          setView('year');
          break;
        case 'g':
          e.preventDefault();
          setShowDatePicker(true);
          break;
        case '?':
          e.preventDefault();
          setShowShortcutsHelp((v) => !v);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openCreateModal, goToday, goNext, goPrev, syncCalendar, setView, setShowDatePicker, eventModal.open]);

  // ─── Sync toasts ────────────────────────────────────────────────────
  const prevSyncStatus = useRef<'idle' | 'pending' | 'success' | 'error'>('idle');
  useEffect(() => {
    const status = syncCalendar.isPending ? 'pending' : syncCalendar.isSuccess ? 'success' : syncCalendar.isError ? 'error' : 'idle';
    if (prevSyncStatus.current === 'pending' && status === 'success') {
      addToast({ message: t('calendar.calendarSynced'), type: 'success', duration: 3000 });
    } else if (prevSyncStatus.current === 'pending' && status === 'error') {
      const errCode = (syncCalendar.error as any)?.response?.data?.code;
      if (errCode === 'API_NOT_ENABLED') {
        addToast({ message: 'Google Calendar API not enabled — enable it in Google Cloud Console', type: 'error', duration: 10000 });
      } else if (errCode === 'SCOPE_MISSING') {
        addToast({ message: 'Calendar permissions missing — please sign out and sign back in', type: 'error', duration: 10000 });
      } else {
        addToast({ message: 'Sync failed — try again', type: 'error', duration: 5000 });
      }
    }
    prevSyncStatus.current = status;
  }, [syncCalendar.isPending, syncCalendar.isSuccess, syncCalendar.isError, syncCalendar.error, addToast]);

  const isDesktop = !!('atlasDesktop' in window);
  const isNarrow = useMediaQuery('(max-width: 900px)');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const showSidebar = !sidebarCollapsed && !isNarrow;
  const [searchQuery, setSearchQuery] = useState('');

  // Detect if calendar sync failed with a permissions error
  const syncErrorCode = syncCalendar.isError
    ? (syncCalendar.error as any)?.response?.data?.code
    : null;
  const scopeMissing = syncErrorCode === 'SCOPE_MISSING';
  const apiNotEnabled = syncErrorCode === 'API_NOT_ENABLED';

  const handleReAuth = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/google/connect');
      if (data.data?.url) {
        window.location.href = data.data.url;
      }
    } catch {
      addToast({ message: 'Failed to start Google re-authentication', type: 'error', duration: 5000 });
    }
  }, [addToast]);

  // Server-side search for global results across all time ranges
  const { data: searchResults } = useSearchCalendarEvents(searchQuery);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close date picker popover on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close timezone picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tzPickerRef.current && !tzPickerRef.current.contains(e.target as Node)) {
        setShowTzPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Client-side filtering for the week/day/month grid view
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

  // Merge aggregated events (from other apps) into the display list
  const displayEvents: CalendarEvent[] = useMemo(() => {
    const base = filteredEvents;
    if (!showAllApps || !aggregatedEvents) return base;

    // Map aggregated non-google events to CalendarEvent-compatible shape
    const appEvents: CalendarEvent[] = aggregatedEvents
      .filter((evt) => evt.source !== 'google')
      .map((evt) => ({
        id: evt.id,
        accountId: '',
        calendarId: `__${evt.source}__`,
        googleEventId: '',
        summary: evt.title,
        description: evt.description || null,
        location: null,
        startTime: evt.startTime,
        endTime: evt.endTime,
        isAllDay: evt.isAllDay,
        status: 'confirmed' as const,
        selfResponseStatus: null,
        htmlLink: null,
        hangoutLink: null,
        organizer: null,
        attendees: null,
        recurrence: null,
        recurringEventId: null,
        transparency: null,
        colorId: null,
        reminders: null,
        createdAt: '',
        updatedAt: '',
        _source: evt.source,
        _color: evt.color,
        _route: evt.route,
      }));

    return [...base, ...appEvents];
  }, [filteredEvents, showAllApps, aggregatedEvents]);

  // Show overlay only on the very first load before any cached data is available
  const showLoadingOverlay = eventsLoading && events === undefined;

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
        data-calendar-toolbar
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
        {/* Back to home */}
        <IconButton
          icon={<ArrowLeft size={16} />}
          label="Home screen"
          onClick={() => navigate('/')}
        />

        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.01em',
          }}
        >
          Calendar
        </span>

        {/* Sidebar toggle */}
        {!isNarrow && (
          <IconButton
            icon={sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            label={sidebarCollapsed ? t('calendar.showSidebar') : t('calendar.hideSidebar')}
            onClick={() => setSidebarCollapsed((v) => !v)}
          />
        )}

        <div style={{ width: 1, height: 20, background: 'var(--color-border-primary)', margin: '0 4px' }} />

        {/* Today button */}
        <Button variant="secondary" size="sm" onClick={goToday}>
          Today
        </Button>

        {/* Prev / Next */}
        <IconButton
          icon={<ChevronLeft size={16} />}
          label="Previous"
          onClick={goPrev}
        />
        <IconButton
          icon={<ChevronRight size={16} />}
          label="Next"
          onClick={goNext}
        />

        {/* Week range label — click to jump to a date */}
        <div
          ref={datePickerRef}
          style={{ position: 'relative', marginLeft: 4 }}
        >
          <span
            role="button"
            tabIndex={0}
            onClick={() => setShowDatePicker((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setShowDatePicker((v) => !v);
              }
            }}
            title="Go to date (G)"
            style={{
              fontSize: 'var(--font-size-md)',
              fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
              userSelect: 'none',
              textDecoration: showDatePicker ? 'underline' : 'none',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = showDatePicker ? 'underline' : 'none'; }}
          >
            {dateLabel}
          </span>

          {showDatePicker && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 4,
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                zIndex: 50,
                padding: 8,
              }}
            >
              <input
                autoFocus
                type="date"
                defaultValue={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedDate(e.target.value);
                    setShowDatePicker(false);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setShowDatePicker(false);
                  }
                }}
                style={{
                  display: 'block',
                  height: 28,
                  padding: '0 8px',
                  border: '1px solid var(--color-border-primary)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-bg-primary)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-sm)',
                  fontFamily: 'var(--font-family)',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              />
            </div>
          )}
        </div>

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
          {(['day', 'week', 'month-grid', 'agenda', 'year'] as const).map((v) => (
            <Button
              key={v}
              variant={view === v ? 'primary' : 'ghost'}
              onClick={() => setView(v)}
              style={{
                height: 26,
                padding: '0 10px',
                borderRadius: 0,
                fontSize: 'var(--font-size-xs)',
                fontWeight: view === v ? 600 : 400,
                textTransform: 'capitalize',
                border: 'none',
              }}
            >
              {v === 'month-grid' ? t('calendar.month') : v === 'agenda' ? t('calendar.agenda') : v === 'year' ? t('calendar.year') : v === 'day' ? t('calendar.day') : v === 'week' ? t('calendar.week') : v}
            </Button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div
          ref={searchRef}
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            placeholder="Search events"
            size="sm"
            iconLeft={<Search size={13} />}
            style={{
              width: isNarrow ? 120 : 180,
            }}
          />
          {/* Search results dropdown */}
          {searchFocused && searchQuery.trim().length >= 2 && searchResults && searchResults.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                width: 320,
                maxHeight: 360,
                overflowY: 'auto',
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                zIndex: 100,
              }}
            >
              <div
                style={{
                  padding: '8px 12px',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                  borderBottom: '1px solid var(--color-border-primary)',
                }}
              >
                {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} across all dates
              </div>
              {searchResults.slice(0, 20).map((ev) => {
                const startDate = new Date(ev.startTime);
                const color = calendarColorMap.get(ev.calendarId) || '#5a7fa0';
                return (
                  <button
                    key={ev.id}
                    onClick={() => {
                      setSearchFocused(false);
                      setSelectedDate(toYMD(startDate));
                      openEditModal(ev);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 8,
                      width: '100%',
                      padding: '8px 12px',
                      border: 'none',
                      borderBottom: '1px solid var(--color-border-primary)',
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'var(--font-family)',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div
                      style={{
                        width: 4,
                        height: 32,
                        borderRadius: 2,
                        background: color,
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 'var(--font-size-sm)',
                          color: 'var(--color-text-primary)',
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ev.summary || '(No title)'}
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          color: 'var(--color-text-tertiary)',
                          marginTop: 2,
                        }}
                      >
                        {startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {!ev.isAllDay && (
                          <> · {startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</>
                        )}
                      </div>
                      {ev.location && (
                        <div
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-tertiary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {ev.location}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Timezone label — click to set secondary timezone */}
        <div ref={tzPickerRef} style={{ position: 'relative' }}>
          <Button
            variant={secondaryTimezone ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowTzPicker((v) => !v)}
            title="Set secondary timezone"
            style={{
              height: 26,
              padding: '0 8px',
              fontSize: 'var(--font-size-xs)',
              ...(secondaryTimezone ? {
                background: 'color-mix(in srgb, var(--color-accent-primary) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-accent-primary) 40%, transparent)',
              } : {}),
            }}
          >
            {new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop()}
            {secondaryTimezone && (
              <span style={{ opacity: 0.65, fontSize: 9, marginLeft: 2 }}>
                +{new Date().toLocaleTimeString('en-US', { timeZone: secondaryTimezone, timeZoneName: 'short' }).split(' ').pop()}
              </span>
            )}
          </Button>

          {showTzPicker && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: 4,
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                zIndex: 50,
                padding: 12,
                minWidth: 220,
              }}
            >
              <div
                style={{
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 600,
                  color: 'var(--color-text-secondary)',
                  marginBottom: 8,
                }}
              >
                Secondary timezone
              </div>
              <Select
                value={secondaryTimezone || ''}
                onChange={(val) => {
                  setSecondaryTimezone(val || null);
                  setShowTzPicker(false);
                }}
                size="sm"
                options={[
                  { value: '', label: 'Off' },
                  { value: 'America/New_York', label: 'America/New York (ET)' },
                  { value: 'America/Chicago', label: 'America/Chicago (CT)' },
                  { value: 'America/Denver', label: 'America/Denver (MT)' },
                  { value: 'America/Los_Angeles', label: 'America/Los Angeles (PT)' },
                  { value: 'America/Sao_Paulo', label: 'America/Sao Paulo (BRT)' },
                  { value: 'Europe/London', label: 'Europe/London (GMT/BST)' },
                  { value: 'Europe/Paris', label: 'Europe/Paris (CET)' },
                  { value: 'Europe/Berlin', label: 'Europe/Berlin (CET)' },
                  { value: 'Europe/Istanbul', label: 'Europe/Istanbul (TRT)' },
                  { value: 'Asia/Dubai', label: 'Asia/Dubai (GST)' },
                  { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST)' },
                  { value: 'Asia/Shanghai', label: 'Asia/Shanghai (CST)' },
                  { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST)' },
                  { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST)' },
                  { value: 'Pacific/Auckland', label: 'Pacific/Auckland (NZST)' },
                ]}
              />
            </div>
          )}
        </div>

        {/* All apps toggle */}
        <IconButton
          icon={<Layers size={14} />}
          label={showAllApps ? t('calendar.allApps', 'All apps') : t('calendar.googleOnly', 'Google only')}
          onClick={() => setShowAllApps(!showAllApps)}
          style={{
            border: '1px solid var(--color-border-primary)',
            ...(showAllApps ? {
              background: 'color-mix(in srgb, var(--color-accent-primary) 10%, transparent)',
              borderColor: 'color-mix(in srgb, var(--color-accent-primary) 40%, transparent)',
            } : {}),
          }}
        />

        {/* Sync button */}
        <IconButton
          icon={<RefreshCw size={13} style={{ animation: syncCalendar.isPending ? 'spin 1s linear infinite' : undefined }} />}
          label="Sync calendar"
          onClick={() => syncCalendar.mutate()}
          disabled={syncCalendar.isPending}
          style={{
            border: '1px solid var(--color-border-primary)',
            opacity: syncCalendar.isPending ? 0.5 : 1,
          }}
        />

        {/* Settings button */}
        <IconButton
          icon={<Settings size={15} />}
          label="Calendar settings"
          onClick={() => openSettings('calendar')}
        />

        {/* New event button */}
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={14} />}
          onClick={() => openCreateModal()}
          style={{ height: 30 }}
        >
          New event
        </Button>
      </div>

      {/* Main content: sidebar + week grid */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left sidebar */}
        {showSidebar && (
        <div
          data-sidebar
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
          <MiniMonth selectedDate={selectedDate} onSelectDate={setSelectedDate} weekStartsOnMonday={weekStartsOnMonday} showWeekNumbers={showWeekNumbers} eventDays={eventDays} />

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

            {/* Add calendar */}
            {showAddCalendar ? (
              <div style={{ marginTop: 6 }}>
                <input
                  autoFocus
                  value={newCalName}
                  onChange={(e) => setNewCalName(e.target.value)}
                  placeholder="Calendar name"
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowAddCalendar(false);
                      setNewCalName('');
                    }
                    if (e.key === 'Enter' && newCalName.trim()) {
                      createCalendar.mutate(
                        { summary: newCalName.trim(), backgroundColor: newCalColor },
                        {
                          onSuccess: () => {
                            setNewCalName('');
                            setShowAddCalendar(false);
                            addToast({ message: t('calendar.calendarCreated'), type: 'success', duration: 3000 });
                          },
                          onError: () => {
                            addToast({ message: 'Failed to create calendar', type: 'error', duration: 5000 });
                          },
                        },
                      );
                    }
                  }}
                  style={{
                    width: '100%',
                    height: 26,
                    padding: '0 6px',
                    border: '1px solid var(--color-border-primary)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-bg-primary)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-xs)',
                    fontFamily: 'var(--font-family)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <input
                    type="color"
                    value={newCalColor}
                    onChange={(e) => setNewCalColor(e.target.value)}
                    style={{ width: 20, height: 20, border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }}
                  />
                  <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', flex: 1 }}>Color</span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      if (newCalName.trim()) {
                        createCalendar.mutate(
                          { summary: newCalName.trim(), backgroundColor: newCalColor },
                          {
                            onSuccess: () => {
                              setNewCalName('');
                              setShowAddCalendar(false);
                              addToast({ message: t('calendar.calendarCreated'), type: 'success', duration: 3000 });
                            },
                            onError: () => {
                              addToast({ message: 'Failed to create calendar', type: 'error', duration: 5000 });
                            },
                          },
                        );
                      }
                    }}
                    disabled={!newCalName.trim() || createCalendar.isPending}
                    style={{ height: 22, padding: '0 8px', fontSize: 10, borderRadius: 'var(--radius-sm)' }}
                  >
                    {createCalendar.isPending ? 'Creating...' : 'Add'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => { setShowAddCalendar(false); setNewCalName(''); }}
                    style={{ height: 22, padding: '0 8px', fontSize: 10, borderRadius: 'var(--radius-sm)' }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                icon={<Plus size={12} />}
                onClick={() => setShowAddCalendar(true)}
                style={{ marginTop: 4, padding: '3px 0', height: 'auto', fontSize: 'var(--font-size-xs)' }}
              >
                Add calendar
              </Button>
            )}

          </div>
        </div>
        )}

        {/* Calendar grid */}
        <div data-calendar-grid style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative', paddingBottom: 'var(--global-dock-offset, 0px)' }}>
          {showLoadingOverlay && (
            <div
              aria-label="Loading events"
              aria-live="polite"
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                background: 'color-mix(in srgb, var(--color-bg-primary) 80%, transparent)',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: '2.5px solid var(--color-border-primary)',
                  borderTopColor: 'var(--color-accent-primary)',
                  animation: 'spin 0.75s linear infinite',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                  fontFamily: 'var(--font-family)',
                }}
              >
                Loading...
              </span>
            </div>
          )}
          {(scopeMissing || apiNotEnabled) && (
            <div
              style={{
                padding: '12px 16px',
                background: 'color-mix(in srgb, var(--color-warning, #f59e0b) 10%, var(--color-bg-primary))',
                borderBottom: '1px solid var(--color-border-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', flex: 1 }}>
                {apiNotEnabled
                  ? 'Google Calendar API is not enabled in your Google Cloud project. Enable it in the Google Cloud Console, wait a minute, then click retry.'
                  : 'Calendar access not granted. Please re-authenticate to enable calendar sync.'}
              </span>
              {scopeMissing && (
                <Button variant="primary" size="sm" onClick={handleReAuth} style={{ height: 30 }}>
                  Grant access
                </Button>
              )}
              {apiNotEnabled && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => syncCalendar.mutate()}
                  disabled={syncCalendar.isPending}
                  style={{ height: 30, opacity: syncCalendar.isPending ? 0.5 : 1 }}
                >
                  Retry sync
                </Button>
              )}
            </div>
          )}
          {view === 'year' ? (
            <YearGrid weekStartsOnMonday={weekStartsOnMonday} />
          ) : view === 'agenda' ? (
            <AgendaView
              events={displayEvents}
              selectedCalendarIds={selectedCalendarIds}
              calendarColorMap={calendarColorMap}
              onEventClick={handleEventClick}
            />
          ) : view === 'month-grid' ? (
            <MonthGrid
              selectedDate={selectedDate}
              events={displayEvents}
              selectedCalendarIds={selectedCalendarIds}
              calendarColorMap={calendarColorMap}
              weekStartsOnMonday={weekStartsOnMonday}
              onEventClick={handleEventClick}
              onDateClick={(date) => {
                setSelectedDate(date);
                setView('day');
              }}
            />
          ) : (
            <WeekGrid
              weekStart={weekStart}
              events={displayEvents}
              selectedCalendarIds={selectedCalendarIds}
              calendarColorMap={calendarColorMap}
              onEventClick={handleEventClick}
              onDragCreate={handleDragCreate}
              onEventUpdate={handleEventUpdate}
              onQuickCreate={handleQuickCreate}
              onEventDelete={handleEventDelete}
              onEventDuplicate={handleEventDuplicate}
              onRSVP={handleRSVP}
              dayCount={isNarrow ? 1 : view === 'day' ? 1 : 7}
              weekStartsOnMonday={weekStartsOnMonday}
              hourHeight={hourHeight}
              workStartHour={workStartHour}
              workEndHour={workEndHour}
              secondaryTimezone={secondaryTimezone}
              scrollToTime={scrollToTime}
              onDayClick={(date) => {
                setSelectedDate(toYMD(date));
                setView('day');
              }}
            />
          )}
        </div>
      </div>

      {/* Event modal */}
      <EventModal />

      {/* Keyboard shortcuts help dialog */}
      {showShortcutsHelp && (
        <div
          onClick={() => setShowShortcutsHelp(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
              padding: 24,
              minWidth: 320,
              maxWidth: 400,
              fontFamily: 'var(--font-family)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Keyboard shortcuts
              </span>
              <IconButton
                icon={<span style={{ fontSize: 14, lineHeight: 1 }}>✕</span>}
                label="Close"
                onClick={() => setShowShortcutsHelp(false)}
                size={24}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr', rowGap: 8, columnGap: 12, fontSize: 'var(--font-size-sm)' }}>
              {([
                ['C', t('calendar.shortcuts.createEvent')],
                ['T', t('calendar.today')],
                ['J / →', t('calendar.shortcuts.nextPeriod')],
                ['K / ←', t('calendar.shortcuts.previousPeriod')],
                ['R', t('calendar.shortcuts.refreshSync')],
                ['D', t('calendar.shortcuts.dayView')],
                ['W', t('calendar.shortcuts.weekView')],
                ['M', t('calendar.shortcuts.monthView')],
                ['A', t('calendar.shortcuts.agendaView')],
                ['G', t('calendar.goToDate')],
                ['?', t('calendar.shortcuts.thisHelp')],
              ] as [string, string][]).map(([key, desc]) => (
                <div key={key} style={{ display: 'contents' }}>
                  <kbd style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 22,
                    padding: '0 6px',
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border-primary)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--color-text-secondary)',
                  }}>
                    {key}
                  </kbd>
                  <span style={{ color: 'var(--color-text-primary)', lineHeight: '22px' }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

