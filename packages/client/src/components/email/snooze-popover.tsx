/**
 * SnoozePopover
 *
 * Usage:
 *   <SnoozePopover threadId={thread.id} onSnooze={handleSnooze}>
 *     <button aria-label="Snooze">...</button>
 *   </SnoozePopover>
 */

import { useState, useId, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Sun, Calendar, Pencil } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';

export interface SnoozePopoverProps {
  threadId: string;
  onSnooze: (threadId: string, snoozeUntil: Date) => void;
  children: React.ReactNode;
}

// ─── Date helpers ──────────────────────────────────────────────────────────────

function getLaterToday(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 3, 0, 0, 0);
  // Cap at 11 PM today — if the result spills past midnight, clamp to today's end
  const endOfDay = new Date();
  endOfDay.setHours(23, 0, 0, 0);
  if (d > endOfDay) {
    return endOfDay;
  }
  return d;
}

function getTomorrow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d;
}

function getNextMonday(): Date {
  const d = new Date();
  const day = d.getDay(); // 0 = Sun, 1 = Mon, …
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(8, 0, 0, 0);
  return d;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatNextMonday(date: Date): string {
  return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) +
    ', ' + formatTime(date);
}

/** Convert a Date to the value expected by <input type="datetime-local">. */
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) +
    ':' + pad(date.getMinutes())
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface OptionRowProps {
  icon: typeof Clock;
  label: string;
  timeLabel: string;
  onClick: () => void;
}

function OptionRow({ icon: Icon, label, timeLabel, onClick }: OptionRowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        width: '100%',
        padding: 'var(--spacing-sm) var(--spacing-md)',
        border: 'none',
        background: hovered ? 'var(--color-surface-hover)' : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        borderRadius: 'var(--radius-sm)',
        transition: 'background var(--transition-normal)',
      }}
    >
      <Icon
        size={16}
        style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}
      />
      <span style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        <span
          style={{
            fontSize: 'var(--font-size-md)',
            color: 'var(--color-text-primary)',
            lineHeight: 'var(--line-height-tight)',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-tertiary)',
            lineHeight: 'var(--line-height-tight)',
          }}
        >
          {timeLabel}
        </span>
      </span>
    </button>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function SnoozePopover({ threadId, onSnooze, children }: SnoozePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customValue, setCustomValue] = useState('');
  const customInputId = useId();

  // Open the popover when the 'h' shortcut fires for this thread
  useEffect(() => {
    function onSnoozeShortcut(e: Event) {
      const { threadId: eventThreadId } = (e as CustomEvent<{ threadId: string }>).detail;
      if (eventThreadId === threadId) {
        setOpen(true);
      }
    }
    document.addEventListener('atlasmail:snooze', onSnoozeShortcut);
    return () => document.removeEventListener('atlasmail:snooze', onSnoozeShortcut);
  }, [threadId]);

  const laterToday = getLaterToday();
  const tomorrow = getTomorrow();
  const nextMonday = getNextMonday();

  function handlePreset(date: Date) {
    onSnooze(threadId, date);
    setOpen(false);
    setShowCustom(false);
  }

  function handleCustomSubmit() {
    if (!customValue) return;
    const date = new Date(customValue);
    if (isNaN(date.getTime())) return;
    onSnooze(threadId, date);
    setOpen(false);
    setShowCustom(false);
    setCustomValue('');
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setShowCustom(false);
      setCustomValue('');
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        width={240}
        style={{ padding: 'var(--spacing-xs)' }}
      >
          {/* Preset options */}
          <OptionRow
            icon={Clock}
            label={t('snooze.laterToday')}
            timeLabel={formatTime(laterToday)}
            onClick={() => handlePreset(laterToday)}
          />
          <OptionRow
            icon={Sun}
            label={t('snooze.tomorrow')}
            timeLabel={`${t('snooze.tomorrow')}, ${formatTime(tomorrow)}`}
            onClick={() => handlePreset(tomorrow)}
          />
          <OptionRow
            icon={Calendar}
            label={t('snooze.nextWeek')}
            timeLabel={formatNextMonday(nextMonday)}
            onClick={() => handlePreset(nextMonday)}
          />

          {/* Separator */}
          <div
            role="separator"
            aria-orientation="horizontal"
            style={{
              height: '1px',
              background: 'var(--color-border-primary)',
              margin: 'var(--spacing-xs) 0',
            }}
          />

          {/* Custom option */}
          {!showCustom ? (
            <OptionRow
              icon={Pencil}
              label={t('snooze.custom')}
              timeLabel={t('snooze.pickDateTime')}
              onClick={() => {
                setCustomValue(toDatetimeLocalValue(laterToday));
                setShowCustom(true);
              }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--spacing-sm)',
                padding: 'var(--spacing-sm) var(--spacing-md)',
              }}
            >
              <label
                htmlFor={customInputId}
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {t('snooze.pickDateTime')}
              </label>
              <input
                id={customInputId}
                type="datetime-local"
                value={customValue}
                min={toDatetimeLocalValue(new Date())}
                onChange={(e) => setCustomValue(e.target.value)}
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-primary)',
                  background: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border-primary)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px var(--spacing-sm)',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box',
                  colorScheme: 'light dark',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCustomSubmit();
                  if (e.key === 'Escape') {
                    setShowCustom(false);
                    setCustomValue('');
                  }
                }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCustom(false);
                    setCustomValue('');
                  }}
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                    background: 'transparent',
                    border: '1px solid var(--color-border-primary)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px var(--spacing-md)',
                    cursor: 'pointer',
                    height: '32px',
                  }}
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleCustomSubmit}
                  disabled={!customValue}
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-inverse)',
                    background: customValue
                      ? 'var(--color-accent-primary)'
                      : 'var(--color-text-tertiary)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    padding: '6px var(--spacing-md)',
                    cursor: customValue ? 'pointer' : 'not-allowed',
                    height: '32px',
                  }}
                >
                  {t('snooze.snooze')}
                </button>
              </div>
            </div>
          )}
      </PopoverContent>
    </Popover>
  );
}
