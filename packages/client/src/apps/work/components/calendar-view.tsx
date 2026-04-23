import { useState, useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Task } from '@atlas-platform/shared';
import { getTodayStr } from '../lib/helpers';
import { Button } from '../../../components/ui/button';

export function CalendarView({
  tasks,
  onSelectTask,
}: {
  tasks: Task[];
  onSelectTask: (taskId: string) => void;
}) {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday
  const daysInMonth = lastDayOfMonth.getDate();

  // Build calendar grid
  const calendarDays: (number | null)[] = [];
  // Pad with nulls for days before the first
  for (let i = 0; i < startDayOfWeek; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);
  // Pad remaining cells to fill the grid
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);

  const todayStr = getTodayStr();
  const monthNames = t('tasks.calendar.monthNames', { returnObjects: true }) as string[];
  const dayNames = t('tasks.calendar.dayNames', { returnObjects: true }) as string[];

  // Group tasks by due date
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (task.dueDate && task.status !== 'completed' && task.status !== 'cancelled') {
        const dateKey = task.dueDate.slice(0, 10);
        if (!map.has(dateKey)) map.set(dateKey, []);
        map.get(dateKey)!.push(task);
      }
    }
    return map;
  }, [tasks]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const MAX_TASKS_PER_CELL = 3;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Calendar header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--spacing-lg)',
        borderBottom: '1px solid var(--color-border-secondary)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <h2 style={{
            fontSize: 'var(--font-size-lg)',
            fontWeight: 'var(--font-weight-semibold)' as any,
            color: 'var(--color-text-primary)',
            margin: 0,
            fontFamily: 'var(--font-family)',
          }}>
            {monthNames[month]} {year}
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
          <Button variant="ghost" size="sm" onClick={prevMonth}>
            <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToday}>
            {t('tasks.calendar.today')}
          </Button>
          <Button variant="ghost" size="sm" onClick={nextMonth}>
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>

      {/* Day headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        borderBottom: '1px solid var(--color-border-secondary)',
        flexShrink: 0,
      }}>
        {dayNames.map((day) => (
          <div key={day} style={{
            padding: 'var(--spacing-sm) var(--spacing-xs)',
            textAlign: 'center',
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-medium)' as any,
            color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.05em',
            fontFamily: 'var(--font-family)',
          }}>
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gridAutoRows: '1fr',
        flex: 1,
        overflow: 'auto',
      }}>
        {calendarDays.map((day, idx) => {
          if (day === null) {
            return (
              <div key={`empty-${idx}`} style={{
                borderRight: '1px solid var(--color-border-secondary)',
                borderBottom: '1px solid var(--color-border-secondary)',
                background: 'var(--color-bg-secondary)',
                minHeight: 80,
              }} />
            );
          }

          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const dayTasks = tasksByDate.get(dateStr) || [];
          const isCurrentDay = dateStr === todayStr;
          const isPast = dateStr < todayStr;

          return (
            <div key={dateStr} style={{
              borderRight: '1px solid var(--color-border-secondary)',
              borderBottom: '1px solid var(--color-border-secondary)',
              padding: 'var(--spacing-xs)',
              minHeight: 80,
              background: isCurrentDay ? 'var(--color-surface-selected)' : 'transparent',
              overflow: 'hidden',
            }}>
              <div style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: isCurrentDay ? 'var(--font-weight-bold)' as any : 'var(--font-weight-normal)' as any,
                color: isCurrentDay ? 'var(--color-accent-primary)' : isPast ? 'var(--color-text-tertiary)' : 'var(--color-text-secondary)',
                marginBottom: 'var(--spacing-xs)',
                fontFamily: 'var(--font-family)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: isCurrentDay ? 'var(--color-accent-primary)' : 'transparent',
                ...(isCurrentDay ? { color: 'var(--color-text-inverse)' } : {}),
              }}>
                {day}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {dayTasks.slice(0, MAX_TASKS_PER_CELL).map((task) => (
                  <button
                    key={task.id}
                    onClick={() => onSelectTask(task.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '2px 4px',
                      fontSize: 10,
                      lineHeight: '14px',
                      color: 'var(--color-text-primary)',
                      background: task.priority === 'high' ? 'rgba(239, 68, 68, 0.12)' :
                        task.priority === 'medium' ? 'rgba(245, 158, 11, 0.12)' :
                        'var(--color-bg-tertiary)',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontFamily: 'var(--font-family)',
                    }}
                    title={task.title}
                  >
                    {task.title || t('tasks.untitled')}
                  </button>
                ))}
                {dayTasks.length > MAX_TASKS_PER_CELL && (
                  <span style={{
                    fontSize: 10,
                    color: 'var(--color-text-tertiary)',
                    paddingLeft: 4,
                    fontFamily: 'var(--font-family)',
                  }}>
                    {t('tasks.calendar.more', { count: dayTasks.length - MAX_TASKS_PER_CELL })}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
