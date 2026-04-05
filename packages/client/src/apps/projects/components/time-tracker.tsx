import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Play, Square, Copy, Save, Plus, X, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  useProjects, useTimeEntriesWeekly, useBulkSaveTimeEntries, useCopyLastWeek, useCreateTimeEntry,
  type Project, type TimeEntry,
} from '../hooks';
import { Button } from '../../../components/ui/button';
import { Select } from '../../../components/ui/select';
import { IconButton } from '../../../components/ui/icon-button';
import { StatusDot } from '../../../components/ui/status-dot';
import { ListToolbar } from '../../../components/ui/list-toolbar';
import { useToastStore } from '../../../stores/toast-store';

// ─── Helpers ──────────────────────────────────────────────────────

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

function getWeekDates(weekStart: string): string[] {
  const dates: string[] = [];
  const start = new Date(weekStart + 'T00:00:00');
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function formatShortDate(dateStr: string, t?: (k: string) => string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const dayLabel = t ? t(`projects.calendar.${dayKeys[d.getDay()]}`) : dayKeys[d.getDay()];
  return `${dayLabel} ${d.getDate()}`;
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Running Timer ────────────────────────────────────────────────

const TIMER_STORAGE_KEY = 'atlas_projects_timer';

interface TimerState {
  isRunning: boolean;
  startedAt: number; // timestamp when timer started
  projectId: string;
}

function saveTimerState(state: TimerState | null) {
  if (state) {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
  } else {
    localStorage.removeItem(TIMER_STORAGE_KEY);
  }
}

function loadTimerState(): TimerState | null {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function RunningTimer({ projects }: { projects: Project[] }) {
  const { t } = useTranslation();
  const saved = useRef(loadTimerState());
  const [isRunning, setIsRunning] = useState(saved.current?.isRunning ?? false);
  const [elapsed, setElapsed] = useState(() => {
    if (saved.current?.isRunning && saved.current.startedAt) {
      return Math.floor((Date.now() - saved.current.startedAt) / 1000);
    }
    return 0;
  });
  const [selectedProjectId, setSelectedProjectId] = useState(saved.current?.projectId ?? '');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(saved.current?.startedAt ?? 0);
  const createTimeEntry = useCreateTimeEntry();

  useEffect(() => {
    if (isRunning) {
      if (!startTimeRef.current) startTimeRef.current = Date.now() - elapsed * 1000;
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const handleStop = () => {
    setIsRunning(false);
    if (selectedProjectId && elapsed > 0) {
      const hours = Math.round((elapsed / 3600) * 100) / 100;
      createTimeEntry.mutate({
        projectId: selectedProjectId,
        date: new Date().toISOString().slice(0, 10),
        hours,
      });
    }
    setElapsed(0);
    startTimeRef.current = 0;
    saveTimerState(null);
  };

  return (
    <div className="projects-timer">
      <Select
        value={selectedProjectId}
        onChange={setSelectedProjectId}
        options={[
          { value: '', label: t('projects.timeTracking.selectProject') },
          ...projects.map((p) => ({ value: p.id, label: p.name })),
        ]}
        size="sm"
        width={180}
      />
      <span className="projects-timer-display">{formatElapsed(elapsed)}</span>
      {isRunning ? (
        <Button variant="danger" size="sm" icon={<Square size={14} />} onClick={handleStop}>
          {t('projects.timeTracking.stop')}
        </Button>
      ) : (
        <Button
          variant="primary"
          size="sm"
          icon={<Play size={14} />}
          onClick={() => {
            if (selectedProjectId) {
              startTimeRef.current = Date.now();
              saveTimerState({ isRunning: true, startedAt: startTimeRef.current, projectId: selectedProjectId });
              setIsRunning(true);
            }
          }}
          disabled={!selectedProjectId}
        >
          {t('projects.timeTracking.start')}
        </Button>
      )}
    </div>
  );
}

// ─── Weekly Grid ──────────────────────────────────────────────────

interface GridRow {
  projectId: string;
  projectName: string;
  projectColor: string;
  hours: Record<string, number>;
}

export function TimeTracker() {
  const { t } = useTranslation();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()));
  const weekDates = useMemo(() => getWeekDates(currentWeekStart), [currentWeekStart]);

  const { data: projectsData } = useProjects({ status: 'active' });
  const projects = projectsData?.projects ?? [];

  const { data: entriesData } = useTimeEntriesWeekly(currentWeekStart);
  const entries = entriesData?.entries;

  const bulkSave = useBulkSaveTimeEntries();
  const copyLastWeek = useCopyLastWeek();
  const { addToast } = useToastStore();

  // Build grid rows from entries
  const [rows, setRows] = useState<GridRow[]>([]);
  const [addProjectId, setAddProjectId] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // Rebuild rows when entries change
  useEffect(() => {
    if (!entries) return;
    const rowMap = new Map<string, GridRow>();
    entries.forEach((entry) => {
      if (!rowMap.has(entry.projectId)) {
        rowMap.set(entry.projectId, {
          projectId: entry.projectId,
          projectName: entry.projectName || '',
          projectColor: entry.projectColor || '#6b7280',
          hours: {},
        });
      }
      const row = rowMap.get(entry.projectId)!;
      row.hours[entry.date] = (row.hours[entry.date] || 0) + entry.hours;
    });
    setRows(Array.from(rowMap.values()));
    setIsDirty(false);
  }, [entries]);

  const handleCellChange = useCallback((projectId: string, date: string, value: string) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.projectId !== projectId) return row;
        const hours = { ...row.hours };
        const num = parseFloat(value);
        if (isNaN(num) || num <= 0) {
          delete hours[date];
        } else {
          hours[date] = num;
        }
        return { ...row, hours };
      }),
    );
    setIsDirty(true);
  }, []);

  const handleAddProject = () => {
    if (!addProjectId) return;
    const project = projects.find((p) => p.id === addProjectId);
    if (!project || rows.some((r) => r.projectId === addProjectId)) return;
    setRows((prev) => [
      ...prev,
      { projectId: project.id, projectName: project.name, projectColor: project.color, hours: {} },
    ]);
    setAddProjectId('');
  };

  const handleRemoveRow = (projectId: string) => {
    setRows((prev) => prev.filter((r) => r.projectId !== projectId));
    setIsDirty(true);
  };

  const handleSave = () => {
    const allEntries: Array<{ projectId: string; date: string; hours: number }> = [];
    rows.forEach((row) => {
      weekDates.forEach((date) => {
        const hours = row.hours[date];
        if (hours && hours > 0) {
          allEntries.push({ projectId: row.projectId, date, hours });
        }
      });
    });
    bulkSave.mutate(allEntries, {
      onSuccess: () => {
        setIsDirty(false);
        addToast({ type: 'success', message: t('projects.timeTracking.saved') });
      },
    });
  };

  const handleCopyLastWeek = () => {
    copyLastWeek.mutate(currentWeekStart);
  };

  const navigateWeek = (direction: number) => {
    const d = new Date(currentWeekStart + 'T00:00:00');
    d.setDate(d.getDate() + direction * 7);
    setCurrentWeekStart(d.toISOString().slice(0, 10));
  };

  const availableProjects = projects.filter((p) => !rows.some((r) => r.projectId === p.id));

  // Totals
  const dayTotals = weekDates.map((date) =>
    rows.reduce((sum, row) => sum + (row.hours[date] || 0), 0),
  );
  const weekTotal = dayTotals.reduce((sum, t) => sum + t, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <ListToolbar
        actions={
          <>
            <RunningTimer projects={projects} />
          </>
        }
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <IconButton icon={<ChevronLeft size={14} />} label={t('projects.timeTracking.prevWeek')} size={28} onClick={() => navigateWeek(-1)} />
          <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', minWidth: 160, textAlign: 'center' }}>
            {formatShortDate(weekDates[0], t)} - {formatShortDate(weekDates[6], t)}
          </span>
          <IconButton icon={<ChevronRight size={14} />} label={t('projects.timeTracking.nextWeek')} size={28} onClick={() => navigateWeek(1)} />
        </div>
        <ListToolbar.Separator />
        <Button variant="ghost" size="sm" icon={<Copy size={13} />} onClick={handleCopyLastWeek}>
          {t('projects.timeTracking.copyLastWeek')}
        </Button>
        <Button variant="primary" size="sm" icon={<Save size={13} />} onClick={handleSave} disabled={!isDirty}>
          {t('projects.actions.save')}
        </Button>
      </ListToolbar>

      <div className="projects-time-grid">
        {/* Header */}
        <div className="projects-time-header">
          <div className="projects-time-header-cell" style={{ width: 200, textAlign: 'left', paddingLeft: 'var(--spacing-md)' }}>
            {t('projects.timeTracking.project')}
          </div>
          {weekDates.map((date) => (
            <div key={date} className="projects-time-header-cell" style={{ width: 70 }}>
              {formatShortDate(date, t)}
            </div>
          ))}
          <div className="projects-time-header-cell" style={{ width: 70 }}>
            {t('projects.timeTracking.total')}
          </div>
          <div style={{ width: 32 }} />
        </div>

        {/* Data rows */}
        {rows.map((row) => {
          const rowTotal = weekDates.reduce((sum, d) => sum + (row.hours[d] || 0), 0);
          return (
            <div key={row.projectId} className="projects-time-row">
              <div className="projects-time-project-name" style={{ width: 200 }}>
                <StatusDot color={row.projectColor} size={8} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.projectName}
                </span>
              </div>
              {weekDates.map((date) => (
                <div key={date} className="projects-time-cell" style={{ width: 70 }}>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={row.hours[date] || ''}
                    onChange={(e) => handleCellChange(row.projectId, date, e.target.value)}
                    placeholder="0"
                  />
                </div>
              ))}
              <div className="projects-time-total" style={{ width: 70 }}>
                {rowTotal > 0 ? rowTotal.toFixed(1) : '-'}
              </div>
              <IconButton
                icon={<X size={12} />}
                label={t('projects.actions.remove')}
                size={22}
                onClick={() => handleRemoveRow(row.projectId)}
              />
            </div>
          );
        })}

        {/* Totals row */}
        <div className="projects-time-row" style={{ fontWeight: 'var(--font-weight-semibold)' as React.CSSProperties['fontWeight'] }}>
          <div className="projects-time-project-name" style={{ width: 200, fontWeight: 'var(--font-weight-semibold)' as React.CSSProperties['fontWeight'] }}>
            {t('projects.timeTracking.total')}
          </div>
          {dayTotals.map((total, i) => (
            <div key={i} className="projects-time-total" style={{ width: 70 }}>
              {total > 0 ? total.toFixed(1) : '-'}
            </div>
          ))}
          <div className="projects-time-total" style={{ width: 70, color: 'var(--color-accent-primary)' }}>
            {weekTotal > 0 ? weekTotal.toFixed(1) : '0'}
          </div>
          <div style={{ width: 32 }} />
        </div>

        {/* Add project row */}
        {availableProjects.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', padding: 'var(--spacing-sm) var(--spacing-md)' }}>
            <Select
              value={addProjectId}
              onChange={setAddProjectId}
              options={[
                { value: '', label: t('projects.timeTracking.selectProject') },
                ...availableProjects.map((p) => ({ value: p.id, label: p.name })),
              ]}
              size="sm"
              width={180}
            />
            <Button variant="ghost" size="sm" icon={<Plus size={13} />} onClick={handleAddProject} disabled={!addProjectId}>
              {t('projects.timeTracking.addProject')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
