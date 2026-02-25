import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { MapPin, Pencil, Trash2, Video, X } from 'lucide-react';
import type { CalendarEvent } from '@atlasmail/shared';
import type { CSSProperties } from 'react';

interface WeekGridProps {
  weekStart: Date;
  events: CalendarEvent[];
  selectedCalendarIds: Set<string>;
  calendarColorMap: Map<string, string>;
  onEventClick: (event: CalendarEvent) => void;
  onDragCreate: (start: Date, end: Date) => void;
  onEventUpdate?: (eventId: string, startTime: string, endTime: string) => void;
  onQuickCreate?: (title: string, start: Date, end: Date) => void;
  onEventDelete?: (eventId: string) => void;
  /** Number of days to display. Defaults to 7 (week view). Use 1 for day view. */
  dayCount?: number;
  /** Whether the week starts on Monday. Defaults to false (Sunday). */
  weekStartsOnMonday?: boolean;
}

interface QuickCreateState {
  dayIndex: number;
  topY: number;
  start: Date;
  end: Date;
}

interface EventPopoverState {
  event: CalendarEvent;
  dayIndex: number;
  topY: number;
}

const HOUR_HEIGHT = 56;
const START_HOUR = 0;
const END_HOUR = 24;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const SNAP_MINUTES = 15;
const SNAP_PX = (SNAP_MINUTES / 60) * HOUR_HEIGHT;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MIN_EVENT_HEIGHT = 18;
const RESIZE_HANDLE_HEIGHT = 6;

/** Parse hex color to RGB and compute relative luminance (0–1). Returns true if color is "light". */
function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length < 6) return false;
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 0.6;
}

function toYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getEventTop(date: Date): number {
  const hours = date.getHours() + date.getMinutes() / 60;
  return (hours - START_HOUR) * HOUR_HEIGHT;
}

function getEventHeight(start: Date, end: Date): number {
  const startMin = start.getHours() * 60 + start.getMinutes();
  const endMin = end.getHours() * 60 + end.getMinutes();
  const diff = Math.max(endMin - startMin, 15);
  return (diff / 60) * HOUR_HEIGHT;
}

function formatTime(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${ampm}` : `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatTimeFromParts(hours: number, minutes: number): string {
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return minutes === 0 ? `${h12} ${ampm}` : `${h12}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

/** Snap a pixel offset to the nearest 15-min interval */
function snapY(y: number): number {
  return Math.round(y / SNAP_PX) * SNAP_PX;
}

/** Convert a pixel Y offset to hours + minutes */
function yToTime(y: number): { hours: number; minutes: number } {
  const totalMinutes = Math.round((y / HOUR_HEIGHT) * 60);
  const clamped = Math.max(0, Math.min(totalMinutes, 24 * 60));
  return { hours: Math.floor(clamped / 60), minutes: clamped % 60 };
}

/** Convert hours+minutes to a Date on the given day */
function timeToDate(day: Date, t: { hours: number; minutes: number }): Date {
  const d = new Date(day);
  d.setHours(t.hours, t.minutes, 0, 0);
  return d;
}

interface PositionedEvent {
  event: CalendarEvent;
  start: Date;
  end: Date;
  column: number;
  totalColumns: number;
}

function layoutEvents(dayEvents: Array<{ event: CalendarEvent; start: Date; end: Date }>): PositionedEvent[] {
  if (dayEvents.length === 0) return [];
  const sorted = [...dayEvents].sort((a, b) => a.start.getTime() - b.start.getTime());
  const result: PositionedEvent[] = [];
  const columns: Array<{ end: number }> = [];

  for (const item of sorted) {
    const startTime = item.start.getTime();
    let col = -1;
    for (let i = 0; i < columns.length; i++) {
      if (columns[i].end <= startTime) {
        col = i;
        break;
      }
    }
    if (col === -1) {
      col = columns.length;
      columns.push({ end: 0 });
    }
    columns[col].end = item.end.getTime();
    result.push({ ...item, column: col, totalColumns: 0 });
  }

  const total = columns.length;
  for (const r of result) r.totalColumns = total;
  return result;
}

// ─── Drag types ───────────────────────────────────────────────────────

type InteractionMode = 'create' | 'move' | 'resize';

interface CreateDrag {
  mode: 'create';
  dayIndex: number;
  startY: number;
  currentY: number;
}

interface MoveDrag {
  mode: 'move';
  event: CalendarEvent;
  eventStart: Date;
  eventEnd: Date;
  /** Day index where the event currently appears */
  dayIndex: number;
  /** Y offset within the event where the user grabbed */
  offsetY: number;
  /** Current snapped top Y */
  currentTopY: number;
  /** Current day index (can change as user drags across columns) */
  currentDayIndex: number;
  /** Whether we've moved enough to consider this a real drag (not a click) */
  hasMoved: boolean;
}

interface ResizeDrag {
  mode: 'resize';
  event: CalendarEvent;
  eventStart: Date;
  dayIndex: number;
  /** The fixed top Y (start doesn't change during resize) */
  topY: number;
  /** Current bottom Y being dragged */
  currentBottomY: number;
}

type DragState = CreateDrag | MoveDrag | ResizeDrag;

export function WeekGrid({
  weekStart,
  events,
  selectedCalendarIds,
  calendarColorMap,
  onEventClick,
  onDragCreate,
  onEventUpdate,
  onQuickCreate,
  onEventDelete,
  dayCount = 7,
  weekStartsOnMonday = false,
}: WeekGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const todayStr = useMemo(() => toYMD(new Date()), []);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [quickCreate, setQuickCreate] = useState<QuickCreateState | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const quickInputRef = useRef<HTMLInputElement>(null);
  const [eventPopover, setEventPopover] = useState<EventPopoverState | null>(null);

  const days = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      result.push(d);
    }
    return result;
  }, [weekStart, dayCount]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Array<{ event: CalendarEvent; start: Date; end: Date }>>();
    const allDayMap = new Map<string, CalendarEvent[]>();

    for (const day of days) {
      map.set(toYMD(day), []);
      allDayMap.set(toYMD(day), []);
    }

    if (!events) return { timed: map, allDay: allDayMap };

    for (const ev of events) {
      if (!selectedCalendarIds.has(ev.calendarId)) continue;
      const start = new Date(ev.startTime);
      const end = new Date(ev.endTime);

      if (ev.isAllDay) {
        for (const day of days) {
          const dayStr = toYMD(day);
          const dayStart = new Date(day);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(day);
          dayEnd.setHours(23, 59, 59, 999);
          if (start <= dayEnd && end >= dayStart) {
            allDayMap.get(dayStr)?.push(ev);
          }
        }
      } else {
        // Handle multi-day timed events: split across day columns
        for (const day of days) {
          const dayStr = toYMD(day);
          const dayStart = new Date(day);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(day);
          dayEnd.setHours(23, 59, 59, 999);

          if (start > dayEnd || end <= dayStart) continue;

          // Clamp start/end to this day's boundaries
          const segStart = start < dayStart ? dayStart : start;
          const segEnd = end > dayEnd ? new Date(dayEnd.getTime() + 1) : end; // 24:00
          map.get(dayStr)?.push({ event: ev, start: segStart, end: segEnd });
        }
      }
    }

    return { timed: map, allDay: allDayMap };
  }, [events, days, selectedCalendarIds]);

  const hasAllDay = useMemo(() => {
    for (const evs of eventsByDay.allDay.values()) {
      if (evs.length > 0) return true;
    }
    return false;
  }, [eventsByDay.allDay]);

  // Scroll to 8:30 AM on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 8.5 * HOUR_HEIGHT;
    }
  }, []);

  // ─── Helpers ──────────────────────────────────────────────────────────

  const getYInGrid = useCallback((clientY: number, colEl: HTMLElement) => {
    const rect = colEl.getBoundingClientRect();
    return clientY - rect.top;
  }, []);

  const getDayColumns = useCallback(() => {
    if (!gridRef.current) return [];
    return Array.from(gridRef.current.querySelectorAll<HTMLElement>('[data-day-col]'));
  }, []);

  /** Find which day column the mouse is over */
  const getDayIndexFromX = useCallback((clientX: number): number | null => {
    const cols = getDayColumns();
    for (let i = 0; i < cols.length; i++) {
      const rect = cols[i].getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) return i;
    }
    return null;
  }, [getDayColumns]);

  const cancelDrag = useCallback(() => {
    dragRef.current = null;
    setDrag(null);
  }, []);

  // ─── Create drag ─────────────────────────────────────────────────────

  const handleGridMouseDown = useCallback((e: React.MouseEvent, dayIndex: number) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-event]')) return;
    if ((e.target as HTMLElement).closest('[data-quick-create]')) return;

    // Close popovers if open
    setQuickCreate(null);
    setEventPopover(null);

    const colEl = e.currentTarget as HTMLElement;
    const y = snapY(getYInGrid(e.clientY, colEl));
    const state: CreateDrag = { mode: 'create', dayIndex, startY: y, currentY: y };
    dragRef.current = state;
    setDrag(state);
    e.preventDefault();
  }, [getYInGrid]);

  // ─── Move drag ────────────────────────────────────────────────────────

  const handleEventMouseDown = useCallback((e: React.MouseEvent, pe: PositionedEvent, dayIndex: number) => {
    if (e.button !== 0) return;
    // Don't start move if clicking the resize handle
    if ((e.target as HTMLElement).closest('[data-resize-handle]')) return;

    const colEl = (e.currentTarget as HTMLElement).closest('[data-day-col]') as HTMLElement;
    if (!colEl) return;

    const eventTopPx = getEventTop(pe.start);
    const clickY = getYInGrid(e.clientY, colEl);
    const offsetY = clickY - eventTopPx;

    const state: MoveDrag = {
      mode: 'move',
      event: pe.event,
      eventStart: pe.start,
      eventEnd: pe.end,
      dayIndex,
      offsetY,
      currentTopY: snapY(eventTopPx),
      currentDayIndex: dayIndex,
      hasMoved: false,
    };
    dragRef.current = state;
    setDrag(state);
    e.preventDefault();
    e.stopPropagation();
  }, [getYInGrid]);

  // ─── Resize drag ─────────────────────────────────────────────────────

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, pe: PositionedEvent, dayIndex: number) => {
    if (e.button !== 0) return;

    const topY = getEventTop(pe.start);
    const bottomY = topY + getEventHeight(pe.start, pe.end);

    const state: ResizeDrag = {
      mode: 'resize',
      event: pe.event,
      eventStart: pe.start,
      dayIndex,
      topY,
      currentBottomY: snapY(bottomY),
    };
    dragRef.current = state;
    setDrag(state);
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // ─── Unified drag effect ─────────────────────────────────────────────

  useEffect(() => {
    if (!drag) return;

    const handleMouseMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;

      // Auto-scroll when near edges
      if (scrollRef.current) {
        const rect = scrollRef.current.getBoundingClientRect();
        const edgeZone = 40;
        const scrollSpeed = 8;
        if (e.clientY < rect.top + edgeZone) {
          scrollRef.current.scrollTop -= scrollSpeed;
        } else if (e.clientY > rect.bottom - edgeZone) {
          scrollRef.current.scrollTop += scrollSpeed;
        }
      }

      const cols = getDayColumns();

      if (d.mode === 'create') {
        const col = cols[d.dayIndex];
        if (!col) return;
        const y = snapY(getYInGrid(e.clientY, col));
        const newState: CreateDrag = { ...d, currentY: y };
        dragRef.current = newState;
        setDrag(newState);
      } else if (d.mode === 'move') {
        // Determine which day column we're over
        let targetDayIndex = d.currentDayIndex;
        const dayIdx = getDayIndexFromX(e.clientX);
        if (dayIdx !== null) targetDayIndex = dayIdx;

        const col = cols[targetDayIndex];
        if (!col) return;

        const rawY = getYInGrid(e.clientY, col) - d.offsetY;
        const newTopY = snapY(rawY);

        const moved = Math.abs(newTopY - snapY(getEventTop(d.eventStart))) > 2 || targetDayIndex !== d.dayIndex;

        const newState: MoveDrag = {
          ...d,
          currentTopY: newTopY,
          currentDayIndex: targetDayIndex,
          hasMoved: d.hasMoved || moved,
        };
        dragRef.current = newState;
        setDrag(newState);
      } else if (d.mode === 'resize') {
        const col = cols[d.dayIndex];
        if (!col) return;
        const rawY = getYInGrid(e.clientY, col);
        const newBottomY = Math.max(snapY(rawY), d.topY + SNAP_PX);

        const newState: ResizeDrag = { ...d, currentBottomY: newBottomY };
        dragRef.current = newState;
        setDrag(newState);
      }
    };

    const handleMouseUp = () => {
      const d = dragRef.current;
      if (!d) return;

      dragRef.current = null;
      setDrag(null);

      if (d.mode === 'create') {
        const topY = Math.min(d.startY, d.currentY);
        const bottomY = Math.max(d.startY, d.currentY);
        const wasClick = Math.abs(d.currentY - d.startY) < SNAP_PX;

        if (wasClick) {
          // Single click → show quick-create popover
          const startTime = yToTime(topY);
          const endTimeParts = yToTime(topY + 2 * SNAP_PX); // 30 min default
          const day = days[d.dayIndex];
          const startDate = timeToDate(day, startTime);
          const endDate = timeToDate(day, endTimeParts);
          setQuickCreate({ dayIndex: d.dayIndex, topY, start: startDate, end: endDate });
          setQuickTitle('');
          setTimeout(() => quickInputRef.current?.focus(), 50);
          return;
        }

        // Real drag → open full modal
        const finalBottomY = bottomY;
        const startTime = yToTime(topY);
        const endTime = yToTime(finalBottomY);

        const day = days[d.dayIndex];
        const startDate = timeToDate(day, startTime);
        const endDate = timeToDate(day, endTime);

        onDragCreate(startDate, endDate);
      } else if (d.mode === 'move') {
        if (!d.hasMoved) {
          // It was just a click, not a drag — show event popover
          const eventTopPx = getEventTop(d.eventStart);
          setEventPopover({ event: d.event, dayIndex: d.dayIndex, topY: eventTopPx });
          setQuickCreate(null);
          return;
        }
        if (!onEventUpdate) return;

        const durationMs = d.eventEnd.getTime() - d.eventStart.getTime();
        const newStartTime = yToTime(d.currentTopY);
        const newDay = days[d.currentDayIndex];
        const newStart = timeToDate(newDay, newStartTime);
        const newEnd = new Date(newStart.getTime() + durationMs);

        onEventUpdate(d.event.id, newStart.toISOString(), newEnd.toISOString());
      } else if (d.mode === 'resize') {
        if (!onEventUpdate) return;

        const newEndTime = yToTime(d.currentBottomY);
        const newDay = days[d.dayIndex];
        const newEnd = timeToDate(newDay, newEndTime);

        onEventUpdate(d.event.id, d.eventStart.toISOString(), newEnd.toISOString());
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelDrag();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [drag, days, getYInGrid, getDayColumns, getDayIndexFromX, onDragCreate, onEventClick, onEventUpdate, cancelDrag]);

  // ─── Drag previews ───────────────────────────────────────────────────

  const createPreview = useMemo(() => {
    if (!drag || drag.mode !== 'create') return null;
    const topY = Math.min(drag.startY, drag.currentY);
    const bottomY = Math.max(drag.startY, drag.currentY);
    const height = Math.max(bottomY - topY, SNAP_PX);
    const startTime = yToTime(topY);
    const endTime = yToTime(topY + height);
    return {
      dayIndex: drag.dayIndex,
      top: topY,
      height,
      label: `${formatTimeFromParts(startTime.hours, startTime.minutes)} – ${formatTimeFromParts(endTime.hours, endTime.minutes)}`,
    };
  }, [drag]);

  const movePreview = useMemo(() => {
    if (!drag || drag.mode !== 'move' || !drag.hasMoved) return null;
    const durationMs = drag.eventEnd.getTime() - drag.eventStart.getTime();
    const durationPx = (durationMs / (60 * 60 * 1000)) * HOUR_HEIGHT;
    const startTime = yToTime(drag.currentTopY);
    const endTime = yToTime(drag.currentTopY + durationPx);
    return {
      dayIndex: drag.currentDayIndex,
      top: drag.currentTopY,
      height: durationPx,
      label: `${formatTimeFromParts(startTime.hours, startTime.minutes)} – ${formatTimeFromParts(endTime.hours, endTime.minutes)}`,
      eventId: drag.event.id,
      bgColor: calendarColorMap.get(drag.event.calendarId) || 'var(--color-accent-primary)',
    };
  }, [drag, calendarColorMap]);

  const resizePreview = useMemo(() => {
    if (!drag || drag.mode !== 'resize') return null;
    const height = Math.max(drag.currentBottomY - drag.topY, SNAP_PX);
    const startTime = yToTime(drag.topY);
    const endTime = yToTime(drag.topY + height);
    return {
      dayIndex: drag.dayIndex,
      top: drag.topY,
      height,
      endLabel: formatTimeFromParts(endTime.hours, endTime.minutes),
      startLabel: formatTimeFromParts(startTime.hours, startTime.minutes),
      eventId: drag.event.id,
    };
  }, [drag]);

  const isAnyDrag = !!drag;
  const movingEventId = drag?.mode === 'move' && drag.hasMoved ? drag.event.id : null;
  const resizingEventId = drag?.mode === 'resize' ? drag.event.id : null;

  const timeAxisWidth = 56;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', userSelect: isAnyDrag ? 'none' : 'auto' }}>
      {/* Day headers */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--color-border-primary)',
          flexShrink: 0,
        }}
      >
        <div style={{ width: timeAxisWidth, flexShrink: 0 }} />
        {days.map((day) => {
          const dayStr = toYMD(day);
          const isToday = dayStr === todayStr;
          return (
            <div
              key={dayStr}
              style={{
                flex: 1,
                textAlign: 'center',
                padding: '8px 0',
                borderLeft: '1px solid var(--color-border-secondary)',
              }}
            >
              <div
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: isToday ? 'var(--color-accent-primary)' : 'var(--color-text-tertiary)',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {DAY_NAMES[day.getDay()]}
              </div>
              <div
                style={{
                  fontSize: 'var(--font-size-xl)',
                  fontWeight: isToday
                    ? ('var(--font-weight-semibold)' as CSSProperties['fontWeight'])
                    : ('var(--font-weight-normal)' as CSSProperties['fontWeight']),
                  color: isToday ? 'var(--color-text-inverse)' : 'var(--color-text-primary)',
                  background: isToday ? 'var(--color-accent-primary)' : 'transparent',
                  width: 32,
                  height: 32,
                  borderRadius: 'var(--radius-full)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 2,
                }}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day event row */}
      {hasAllDay && (
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid var(--color-border-primary)',
            flexShrink: 0,
            minHeight: 28,
          }}
        >
          <div
            style={{
              width: timeAxisWidth,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              paddingRight: 8,
              fontSize: 10,
              color: 'var(--color-text-tertiary)',
            }}
          >
            all-day
          </div>
          {days.map((day) => {
            const dayStr = toYMD(day);
            const allDayEvs = eventsByDay.allDay.get(dayStr) || [];
            return (
              <div
                key={dayStr}
                style={{
                  flex: 1,
                  borderLeft: '1px solid var(--color-border-secondary)',
                  padding: '2px 2px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1,
                }}
              >
                {allDayEvs.map((ev) => {
                  const pillBg = calendarColorMap.get(ev.calendarId) || 'var(--color-accent-primary)';
                  const pillText = isLightColor(pillBg) ? '#1a1a1a' : '#fff';
                  return (
                    <button
                      key={ev.id}
                      data-event
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(ev);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        width: '100%',
                        padding: '2px 6px',
                        background: pillBg,
                        color: pillText,
                        border: 'none',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        fontFamily: 'var(--font-family)',
                        textAlign: 'left',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: '16px',
                        transition: 'box-shadow var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
                    >
                      {ev.hangoutLink && <Video size={9} style={{ flexShrink: 0, opacity: 0.8 }} />}
                      {ev.summary || '(No title)'}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* Scrollable time grid */}
      <div ref={scrollRef} style={{ flex: 1, overflow: 'auto' }}>
        <div ref={gridRef} style={{ display: 'flex', position: 'relative', minHeight: TOTAL_HOURS * HOUR_HEIGHT }}>
          {/* Time axis */}
          <div style={{ width: timeAxisWidth, flexShrink: 0, position: 'relative' }}>
            {Array.from({ length: TOTAL_HOURS }, (_, i) => {
              const hour = START_HOUR + i;
              if (hour === 0) return null;
              const h12 = hour % 12 || 12;
              const ampm = hour >= 12 ? 'PM' : 'AM';
              return (
                <div
                  key={hour}
                  style={{
                    position: 'absolute',
                    top: i * HOUR_HEIGHT - 7,
                    right: 8,
                    fontSize: 10,
                    color: 'var(--color-text-tertiary)',
                    lineHeight: 1,
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  {h12} {ampm}
                </div>
              );
            })}
          </div>

          {/* Day columns */}
          {days.map((day, dayIndex) => {
            const dayStr = toYMD(day);
            const dayEvents = eventsByDay.timed.get(dayStr) || [];
            const positioned = layoutEvents(dayEvents);

            return (
              <div
                key={dayStr}
                data-day-col
                style={{
                  flex: 1,
                  position: 'relative',
                  borderLeft: '1px solid var(--color-border-secondary)',
                  cursor: isAnyDrag && drag?.mode === 'move' ? 'grabbing' : 'crosshair',
                }}
                onMouseDown={(e) => handleGridMouseDown(e, dayIndex)}
              >
                {/* Hour lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      top: i * HOUR_HEIGHT,
                      left: 0,
                      right: 0,
                      height: 1,
                      background: 'var(--color-border-secondary)',
                      pointerEvents: 'none',
                    }}
                  />
                ))}

                {/* Half-hour lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, i) => (
                  <div
                    key={`half-${i}`}
                    style={{
                      position: 'absolute',
                      top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2,
                      left: 0,
                      right: 0,
                      height: 1,
                      background: 'var(--color-border-secondary)',
                      opacity: 0.4,
                      pointerEvents: 'none',
                    }}
                  />
                ))}

                {/* Current time indicator */}
                {dayStr === todayStr && <NowLine />}

                {/* Create drag preview */}
                {createPreview && createPreview.dayIndex === dayIndex && (
                  <div
                    style={{
                      position: 'absolute',
                      top: createPreview.top,
                      left: 2,
                      right: 2,
                      height: createPreview.height,
                      background: 'color-mix(in srgb, var(--color-accent-primary) 20%, transparent)',
                      border: '1px solid var(--color-accent-primary)',
                      borderLeft: '3px solid var(--color-accent-primary)',
                      borderRadius: 'var(--radius-sm)',
                      zIndex: 10,
                      pointerEvents: 'none',
                      padding: '2px 6px',
                      fontSize: 11,
                      color: 'var(--color-accent-primary)',
                      fontWeight: 600,
                      fontFamily: 'var(--font-family)',
                    }}
                  >
                    {createPreview.label}
                  </div>
                )}

                {/* Move ghost preview */}
                {movePreview && movePreview.dayIndex === dayIndex && (
                  <div
                    style={{
                      position: 'absolute',
                      top: movePreview.top,
                      left: 2,
                      right: 2,
                      height: Math.max(movePreview.height, MIN_EVENT_HEIGHT),
                      background: `color-mix(in srgb, ${movePreview.bgColor} 30%, transparent)`,
                      border: `1px dashed ${movePreview.bgColor}`,
                      borderLeft: `3px solid ${movePreview.bgColor}`,
                      borderRadius: 'var(--radius-sm)',
                      zIndex: 10,
                      pointerEvents: 'none',
                      padding: '2px 6px',
                      fontSize: 11,
                      color: movePreview.bgColor,
                      fontWeight: 600,
                      fontFamily: 'var(--font-family)',
                    }}
                  >
                    {movePreview.label}
                  </div>
                )}

                {/* Events */}
                {positioned.map((pe) => {
                  const isMoving = pe.event.id === movingEventId;
                  const isResizing = pe.event.id === resizingEventId;

                  // During resize, use the preview height
                  const eventTop = getEventTop(pe.start);
                  let eventHeight = getEventHeight(pe.start, pe.end);
                  if (isResizing && resizePreview) {
                    eventHeight = resizePreview.height;
                  }

                  const colWidth = 100 / pe.totalColumns;
                  const left = pe.column * colWidth;
                  const bgColor = calendarColorMap.get(pe.event.calendarId) || 'var(--color-accent-primary)';
                  const textColor = isLightColor(bgColor) ? '#1a1a1a' : bgColor;

                  return (
                    <div
                      key={pe.event.id}
                      data-event
                      onMouseDown={(e) => handleEventMouseDown(e, pe, dayIndex)}
                      style={{
                        position: 'absolute',
                        top: eventTop,
                        left: `calc(${left}% + 2px)`,
                        width: `calc(${colWidth}% - 4px)`,
                        height: Math.max(eventHeight, MIN_EVENT_HEIGHT),
                        background: `color-mix(in srgb, ${bgColor} 18%, var(--color-bg-primary))`,
                        borderLeft: `3px solid ${bgColor}`,
                        borderRadius: 'var(--radius-sm)',
                        padding: '2px 4px',
                        overflow: 'hidden',
                        cursor: isMoving ? 'grabbing' : 'grab',
                        textAlign: 'left',
                        fontFamily: 'var(--font-family)',
                        zIndex: isMoving || isResizing ? 5 : 1,
                        transition: isMoving || isResizing ? 'none' : 'box-shadow var(--transition-fast)',
                        boxSizing: 'border-box',
                        opacity: isMoving ? 0.4 : 1,
                        border: 'none',
                        borderLeftStyle: 'solid',
                        borderLeftWidth: 3,
                        borderLeftColor: bgColor,
                      }}
                      onMouseEnter={(e) => {
                        if (!isAnyDrag) e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: textColor,
                          lineHeight: '14px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        {pe.event.hangoutLink && <Video size={10} style={{ flexShrink: 0, opacity: 0.7 }} />}
                        {pe.event.summary || '(No title)'}
                        {pe.event.selfResponseStatus && pe.event.selfResponseStatus !== 'accepted' && (
                          <span
                            title={pe.event.selfResponseStatus}
                            style={{
                              flexShrink: 0,
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: pe.event.selfResponseStatus === 'declined' ? 'var(--color-error)'
                                : pe.event.selfResponseStatus === 'tentative' ? '#f0ad4e'
                                : '#999',
                            }}
                          />
                        )}
                      </div>
                      {eventHeight > 30 && (
                        <div
                          style={{
                            fontSize: 10,
                            color: 'var(--color-text-tertiary)',
                            lineHeight: '13px',
                            marginTop: 1,
                          }}
                        >
                          {isResizing && resizePreview
                            ? `${resizePreview.startLabel} – ${resizePreview.endLabel}`
                            : `${formatTime(pe.start)} – ${formatTime(pe.end)}`
                          }
                        </div>
                      )}
                      {eventHeight > 50 && pe.event.location && (
                        <div
                          style={{
                            fontSize: 9,
                            color: 'var(--color-text-tertiary)',
                            lineHeight: '12px',
                            marginTop: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                          }}
                        >
                          <MapPin size={8} style={{ flexShrink: 0 }} />
                          {pe.event.location}
                        </div>
                      )}

                      {/* Resize handle at bottom */}
                      <div
                        data-resize-handle
                        onMouseDown={(e) => handleResizeMouseDown(e, pe, dayIndex)}
                        style={{
                          position: 'absolute',
                          bottom: 0,
                          left: 0,
                          right: 0,
                          height: RESIZE_HANDLE_HEIGHT,
                          cursor: 's-resize',
                          borderRadius: '0 0 var(--radius-sm) var(--radius-sm)',
                        }}
                      />
                    </div>
                  );
                })}

                {/* Quick-create popover */}
                {quickCreate && quickCreate.dayIndex === dayIndex && (
                  <div
                    data-quick-create
                    style={{
                      position: 'absolute',
                      top: quickCreate.topY,
                      left: 2,
                      right: 2,
                      zIndex: 20,
                    }}
                  >
                    {/* 30-min slot indicator */}
                    <div
                      style={{
                        height: 2 * SNAP_PX,
                        background: 'color-mix(in srgb, var(--color-accent-primary) 20%, transparent)',
                        borderLeft: '3px solid var(--color-accent-primary)',
                        borderRadius: 'var(--radius-sm)',
                      }}
                    />
                    {/* Popover card */}
                    <div
                      style={{
                        marginTop: 4,
                        background: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border-primary)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-lg)',
                        padding: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        fontFamily: 'var(--font-family)',
                        minWidth: 180,
                      }}
                    >
                      <input
                        ref={quickInputRef}
                        value={quickTitle}
                        onChange={(e) => setQuickTitle(e.target.value)}
                        placeholder="Event title"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && quickTitle.trim() && quickCreate) {
                            onQuickCreate?.(quickTitle.trim(), quickCreate.start, quickCreate.end);
                            setQuickCreate(null);
                            setQuickTitle('');
                          }
                          if (e.key === 'Escape') {
                            setQuickCreate(null);
                            setQuickTitle('');
                          }
                        }}
                        style={{
                          width: '100%',
                          height: 30,
                          padding: '0 8px',
                          border: '1px solid var(--color-border-primary)',
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--color-bg-primary)',
                          color: 'var(--color-text-primary)',
                          fontSize: 'var(--font-size-sm)',
                          fontFamily: 'var(--font-family)',
                          outline: 'none',
                          boxSizing: 'border-box',
                        }}
                      />
                      <div style={{ display: 'flex', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                        {formatTime(quickCreate.start)} – {formatTime(quickCreate.end)}
                      </div>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between', alignItems: 'center' }}>
                        <button
                          onClick={() => {
                            if (quickCreate) {
                              onDragCreate(quickCreate.start, quickCreate.end);
                            }
                            setQuickCreate(null);
                            setQuickTitle('');
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--color-accent-primary)',
                            fontSize: 'var(--font-size-xs)',
                            fontFamily: 'var(--font-family)',
                            cursor: 'pointer',
                            padding: 0,
                          }}
                        >
                          More options
                        </button>
                        <button
                          onClick={() => {
                            if (quickTitle.trim() && quickCreate) {
                              onQuickCreate?.(quickTitle.trim(), quickCreate.start, quickCreate.end);
                            }
                            setQuickCreate(null);
                            setQuickTitle('');
                          }}
                          disabled={!quickTitle.trim()}
                          style={{
                            height: 26,
                            padding: '0 12px',
                            background: 'var(--color-accent-primary)',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--color-text-inverse)',
                            fontSize: 'var(--font-size-xs)',
                            fontFamily: 'var(--font-family)',
                            cursor: quickTitle.trim() ? 'pointer' : 'not-allowed',
                            opacity: quickTitle.trim() ? 1 : 0.5,
                          }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Event quick-view popover */}
                {eventPopover && eventPopover.dayIndex === dayIndex && (
                  <div
                    data-event
                    style={{
                      position: 'absolute',
                      top: Math.max(0, eventPopover.topY - 10),
                      left: 4,
                      right: 4,
                      zIndex: 30,
                    }}
                  >
                    <div
                      style={{
                        background: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border-primary)',
                        borderRadius: 'var(--radius-md)',
                        boxShadow: 'var(--shadow-lg)',
                        padding: 14,
                        fontFamily: 'var(--font-family)',
                        minWidth: 220,
                      }}
                    >
                      {/* Header: title + close */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              background: calendarColorMap.get(eventPopover.event.calendarId) || 'var(--color-accent-primary)',
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 'var(--font-size-md)',
                              fontWeight: 600,
                              color: 'var(--color-text-primary)',
                              lineHeight: 1.3,
                              wordBreak: 'break-word',
                            }}
                          >
                            {eventPopover.event.summary || '(No title)'}
                          </span>
                        </div>
                        <button
                          onClick={() => setEventPopover(null)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 22,
                            height: 22,
                            padding: 0,
                            background: 'transparent',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--color-text-tertiary)',
                            cursor: 'pointer',
                            flexShrink: 0,
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {/* Time */}
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                        {(() => {
                          const ev = eventPopover.event;
                          const s = new Date(ev.startTime);
                          const e = new Date(ev.endTime);
                          if (ev.isAllDay) return 'All day';
                          const dateStr = s.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                          return `${dateStr}, ${formatTime(s)} – ${formatTime(e)}`;
                        })()}
                      </div>

                      {/* Location */}
                      {eventPopover.event.location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 6 }}>
                          <MapPin size={12} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {eventPopover.event.location}
                          </span>
                        </div>
                      )}

                      {/* Meet link */}
                      {eventPopover.event.hangoutLink && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--font-size-sm)', marginBottom: 6 }}>
                          <Video size={12} style={{ flexShrink: 0, color: 'var(--color-accent-primary)' }} />
                          <a
                            href={eventPopover.event.hangoutLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--color-accent-primary)', textDecoration: 'none' }}
                          >
                            Join meeting
                          </a>
                        </div>
                      )}

                      {/* Description preview */}
                      {eventPopover.event.description && (
                        <div
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-tertiary)',
                            marginBottom: 6,
                            overflow: 'hidden',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            lineHeight: 1.4,
                          }}
                        >
                          {eventPopover.event.description}
                        </div>
                      )}

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button
                          onClick={() => {
                            const ev = eventPopover.event;
                            setEventPopover(null);
                            onEventClick(ev);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            height: 28,
                            padding: '0 10px',
                            background: 'var(--color-accent-primary)',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            color: 'var(--color-text-inverse)',
                            fontSize: 'var(--font-size-xs)',
                            fontFamily: 'var(--font-family)',
                            cursor: 'pointer',
                          }}
                        >
                          <Pencil size={11} />
                          Edit
                        </button>
                        {onEventDelete && (
                          <button
                            onClick={() => {
                              onEventDelete(eventPopover.event.id);
                              setEventPopover(null);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              height: 28,
                              padding: '0 10px',
                              background: 'transparent',
                              border: '1px solid var(--color-border-primary)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--color-error)',
                              fontSize: 'var(--font-size-xs)',
                              fontFamily: 'var(--font-family)',
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={11} />
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function NowLine() {
  const [top, setTop] = useState(getEventTop(new Date()));

  useEffect(() => {
    const update = () => setTop(getEventTop(new Date()));
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: -4,
        right: 0,
        zIndex: 2,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--color-error)',
          position: 'absolute',
          top: -3.5,
          left: 0,
        }}
      />
      <div
        style={{
          height: 1.5,
          background: 'var(--color-error)',
          marginLeft: 4,
        }}
      />
    </div>
  );
}
