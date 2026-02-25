import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import type { CalendarEvent } from '@atlasmail/shared';
import type { CSSProperties } from 'react';

interface WeekGridProps {
  weekStart: Date;
  events: CalendarEvent[];
  selectedCalendarIds: Set<string>;
  calendarColorMap: Map<string, string>;
  onEventClick: (event: CalendarEvent) => void;
  onDragCreate: (start: Date, end: Date) => void;
}

const HOUR_HEIGHT = 56;
const START_HOUR = 0;
const END_HOUR = 24;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const SNAP_MINUTES = 15;
const SNAP_PX = (SNAP_MINUTES / 60) * HOUR_HEIGHT;
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

// ─── Drag state ───────────────────────────────────────────────────────

interface DragState {
  dayIndex: number;
  startY: number;
  currentY: number;
}

export function WeekGrid({
  weekStart,
  events,
  selectedCalendarIds,
  calendarColorMap,
  onEventClick,
  onDragCreate,
}: WeekGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const todayStr = useMemo(() => toYMD(new Date()), []);
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);

  const days = useMemo(() => {
    const result: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      result.push(d);
    }
    return result;
  }, [weekStart]);

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
        const dayStr = toYMD(start);
        map.get(dayStr)?.push({ event: ev, start, end });
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

  // ─── Drag-to-create handlers ────────────────────────────────────────

  const getYInGrid = useCallback((clientY: number, colEl: HTMLElement) => {
    const rect = colEl.getBoundingClientRect();
    return clientY - rect.top + (scrollRef.current?.scrollTop || 0);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, dayIndex: number) => {
    // Only left click, not on an event
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-event]')) return;

    const colEl = e.currentTarget as HTMLElement;
    const y = snapY(getYInGrid(e.clientY, colEl));
    const state: DragState = { dayIndex, startY: y, currentY: y };
    dragRef.current = state;
    setDrag(state);
    e.preventDefault();
  }, [getYInGrid]);

  useEffect(() => {
    if (!drag) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current || !gridRef.current) return;
      const dayColumns = gridRef.current.querySelectorAll<HTMLElement>('[data-day-col]');
      const col = dayColumns[dragRef.current.dayIndex];
      if (!col) return;

      const y = snapY(getYInGrid(e.clientY, col));
      const newState = { ...dragRef.current, currentY: y };
      dragRef.current = newState;
      setDrag(newState);
    };

    const handleMouseUp = () => {
      if (!dragRef.current) return;
      const { dayIndex, startY, currentY } = dragRef.current;
      const topY = Math.min(startY, currentY);
      const bottomY = Math.max(startY, currentY);

      // Require at least 15 min drag (or click = 30 min default)
      const minDrag = SNAP_PX;
      const finalBottomY = bottomY - topY < minDrag ? topY + 2 * SNAP_PX : bottomY;

      const startTime = yToTime(topY);
      const endTime = yToTime(finalBottomY);

      const day = days[dayIndex];
      const startDate = new Date(day);
      startDate.setHours(startTime.hours, startTime.minutes, 0, 0);
      const endDate = new Date(day);
      endDate.setHours(endTime.hours, endTime.minutes, 0, 0);

      dragRef.current = null;
      setDrag(null);

      onDragCreate(startDate, endDate);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [drag, days, getYInGrid, onDragCreate]);

  // ─── Drag preview ───────────────────────────────────────────────────

  const dragPreview = useMemo(() => {
    if (!drag) return null;
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

  const timeAxisWidth = 56;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', userSelect: drag ? 'none' : 'auto' }}>
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
                {allDayEvs.map((ev) => (
                  <button
                    key={ev.id}
                    data-event
                    onClick={() => onEventClick(ev)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '1px 4px',
                      background: calendarColorMap.get(ev.calendarId) || 'var(--color-accent-primary)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 3,
                      fontSize: 10,
                      fontFamily: 'var(--font-family)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {ev.summary || '(No title)'}
                  </button>
                ))}
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
                  cursor: 'crosshair',
                }}
                onMouseDown={(e) => handleMouseDown(e, dayIndex)}
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

                {/* Drag preview */}
                {dragPreview && dragPreview.dayIndex === dayIndex && (
                  <div
                    style={{
                      position: 'absolute',
                      top: dragPreview.top,
                      left: 2,
                      right: 2,
                      height: dragPreview.height,
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
                    {dragPreview.label}
                  </div>
                )}

                {/* Events */}
                {positioned.map((pe) => {
                  const top = getEventTop(pe.start);
                  const height = getEventHeight(pe.start, pe.end);
                  const colWidth = 100 / pe.totalColumns;
                  const left = pe.column * colWidth;
                  const bgColor = calendarColorMap.get(pe.event.calendarId) || 'var(--color-accent-primary)';

                  return (
                    <button
                      key={pe.event.id}
                      data-event
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(pe.event);
                      }}
                      style={{
                        position: 'absolute',
                        top,
                        left: `calc(${left}% + 2px)`,
                        width: `calc(${colWidth}% - 4px)`,
                        height: Math.max(height, 18),
                        background: `color-mix(in srgb, ${bgColor} 18%, var(--color-bg-primary))`,
                        border: 'none',
                        borderLeft: `3px solid ${bgColor}`,
                        borderRadius: 'var(--radius-sm)',
                        padding: '2px 4px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'var(--font-family)',
                        zIndex: 1,
                        transition: 'box-shadow var(--transition-fast)',
                        boxSizing: 'border-box',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: bgColor,
                          lineHeight: '14px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {pe.event.summary || '(No title)'}
                      </div>
                      {height > 30 && (
                        <div
                          style={{
                            fontSize: 10,
                            color: 'var(--color-text-tertiary)',
                            lineHeight: '13px',
                            marginTop: 1,
                          }}
                        >
                          {formatTime(pe.start)} – {formatTime(pe.end)}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatTimeFromParts(hours: number, minutes: number): string {
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return minutes === 0 ? `${h12} ${ampm}` : `${h12}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

function NowLine() {
  const now = new Date();
  const top = getEventTop(now);

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
