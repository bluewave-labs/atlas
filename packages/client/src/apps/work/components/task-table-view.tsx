import { useMemo, useState, memo, type CSSProperties, type KeyboardEvent } from 'react';
import { Check, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Task, TaskProject, TenantUser } from '@atlas-platform/shared';
import { isDoneStatus } from '@atlas-platform/shared';
import { getDueBadgeClass, formatDueDate } from '../lib/helpers';
import { PRIORITY_OPTIONS } from '../lib/constants';
import { Avatar } from '../../../components/ui/avatar';

type SortKey = 'title' | 'project' | 'priority' | 'dueDate' | 'assignee';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER: Record<Task['priority'], number> = Object.fromEntries(
  PRIORITY_OPTIONS.map((p, i) => [p.value, i]),
) as Record<Task['priority'], number>;

const NO_DUE_DATE_SORT_KEY = '￿';

const TH_STYLE: CSSProperties = {
  padding: '6px var(--spacing-md)',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-semibold)',
  color: 'var(--color-text-tertiary)',
  fontFamily: 'var(--font-family)',
  textAlign: 'left',
  borderBottom: '1px solid var(--color-border-secondary)',
  whiteSpace: 'nowrap',
  userSelect: 'none',
};

const TD_STYLE: CSSProperties = {
  padding: '7px var(--spacing-md)',
  fontSize: 'var(--font-size-sm)',
  fontFamily: 'var(--font-family)',
  borderBottom: '1px solid var(--color-border-secondary)',
  verticalAlign: 'middle',
};

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (col !== sortKey) return <ChevronsUpDown size={11} style={{ opacity: 0.35 }} />;
  return sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />;
}

interface SortHeaderProps {
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  label: string;
}

function SortHeader({ col, sortKey, sortDir, onSort, label }: SortHeaderProps) {
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        background: 'transparent',
        border: 'none',
        padding: 0,
        margin: 0,
        font: 'inherit',
        color: 'inherit',
        cursor: 'pointer',
      }}
    >
      {label}
      <SortIcon col={col} sortKey={sortKey} sortDir={sortDir} />
    </button>
  );
}

interface Props {
  tasks: Task[];
  projects: TaskProject[];
  members?: TenantUser[];
  selectedTaskId: string | null;
  selectedIds: Set<string>;
  onSelectTask: (id: string) => void;
  onComplete: (id: string) => void;
  onCheckToggle: (id: string) => void;
}

function TaskTableViewInner({
  tasks,
  projects,
  members,
  selectedTaskId,
  selectedIds,
  onSelectTask,
  onComplete,
  onCheckToggle,
}: Props) {
  const { t } = useTranslation();
  const [sortKey, setSortKey] = useState<SortKey>('dueDate');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const projectById = useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
  const memberById = useMemo(
    () => new Map((members ?? []).map(m => [m.userId, m])),
    [members],
  );

  const sorted = useMemo(() => {
    const list = [...tasks];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'title') {
        cmp = a.title.localeCompare(b.title);
      } else if (sortKey === 'project') {
        const pa = (a.projectId && projectById.get(a.projectId)?.title) ?? '';
        const pb = (b.projectId && projectById.get(b.projectId)?.title) ?? '';
        cmp = pa.localeCompare(pb);
      } else if (sortKey === 'priority') {
        const last = PRIORITY_OPTIONS.length - 1;
        cmp = (PRIORITY_ORDER[a.priority] ?? last) - (PRIORITY_ORDER[b.priority] ?? last);
      } else if (sortKey === 'dueDate') {
        const da = a.dueDate ?? NO_DUE_DATE_SORT_KEY;
        const db = b.dueDate ?? NO_DUE_DATE_SORT_KEY;
        cmp = da.localeCompare(db);
      } else if (sortKey === 'assignee') {
        const ua = (a.assigneeId && memberById.get(a.assigneeId)?.name) ?? '';
        const ub = (b.assigneeId && memberById.get(b.assigneeId)?.name) ?? '';
        cmp = ua.localeCompare(ub);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return list;
  }, [tasks, sortKey, sortDir, projectById, memberById]);

  const handleRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, taskId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectTask(taskId);
    }
  };

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: 36 }} />
          <col style={{ width: 36 }} />
          <col style={{ minWidth: 200 }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '10%' }} />
          <col style={{ width: '13%' }} />
          <col style={{ width: '16%' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={TH_STYLE} />
            <th style={TH_STYLE} />
            <th style={TH_STYLE}>
              <SortHeader col="title" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} label={t('tasks.fields.title')} />
            </th>
            <th style={TH_STYLE}>
              <SortHeader col="project" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} label={t('tasks.fields.project')} />
            </th>
            <th style={TH_STYLE}>
              <SortHeader col="priority" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} label={t('tasks.fields.priority')} />
            </th>
            <th style={TH_STYLE}>
              <SortHeader col="dueDate" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} label={t('tasks.fields.dueDate')} />
            </th>
            <th style={TH_STYLE}>
              <SortHeader col="assignee" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} label={t('tasks.fields.assignee')} />
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(task => {
            const project = task.projectId ? projectById.get(task.projectId) : null;
            const assignee = task.assigneeId ? memberById.get(task.assigneeId) : null;
            const done = isDoneStatus(task.status);
            const isSelected = selectedTaskId === task.id;
            const isChecked = selectedIds.has(task.id);

            return (
              <tr
                key={task.id}
                className="tasks-table-row"
                role="button"
                tabIndex={0}
                aria-selected={isSelected}
                onClick={() => onSelectTask(task.id)}
                onKeyDown={e => handleRowKeyDown(e, task.id)}
              >
                <td style={{ ...TD_STYLE, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onCheckToggle(task.id)}
                    onClick={e => e.stopPropagation()}
                    aria-label={isChecked ? t('tasks.deselectAll') : t('tasks.selectAll')}
                    style={{ cursor: 'pointer', accentColor: 'var(--color-accent-primary)' }}
                  />
                </td>

                <td style={{ ...TD_STYLE, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    className={`task-checkbox${done ? ' completed' : ''}`}
                    onClick={() => onComplete(task.id)}
                    aria-label={done ? t('tasks.markIncomplete') : t('tasks.markComplete')}
                    style={{ margin: '0 auto' }}
                  >
                    {done && <Check size={12} color="var(--color-text-inverse)" strokeWidth={3} className="task-check-icon" />}
                  </button>
                </td>

                <td style={{ ...TD_STYLE, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {task.priority !== 'none' && <div className={`task-priority-dot ${task.priority}`} style={{ flexShrink: 0 }} />}
                    {task.icon && <span>{task.icon}</span>}
                    <span className={done ? 'task-title-text completed' : ''} style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {task.title || t('tasks.untitled')}
                    </span>
                  </span>
                </td>

                <td style={{ ...TD_STYLE, color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {project ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {project.icon
                        ? <span style={{ fontSize: 'var(--font-size-xs)' }}>{project.icon}</span>
                        : <div className="task-project-dot" style={{ background: project.color, flexShrink: 0 }} />}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{project.title}</span>
                    </span>
                  ) : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
                </td>

                <td style={{ ...TD_STYLE, color: 'var(--color-text-secondary)' }}>
                  {task.priority !== 'none'
                    ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div className={`task-priority-dot ${task.priority}`} />
                        {t(`tasks.priority.${task.priority}`)}
                      </span>
                    )
                    : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
                </td>

                <td style={TD_STYLE}>
                  {task.dueDate
                    ? <span className={getDueBadgeClass(task.dueDate)}>{formatDueDate(task.dueDate, t)}</span>
                    : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
                </td>

                <td style={TD_STYLE}>
                  {assignee
                    ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Avatar name={assignee.name} email={assignee.email} size={20} />
                        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {assignee.name || assignee.email}
                        </span>
                      </span>
                    )
                    : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {sorted.length === 0 && (
        <div style={{ padding: 'var(--spacing-2xl)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)' }}>
          {t('tasks.noTasks')}
        </div>
      )}
    </div>
  );
}

export const TaskTableView = memo(TaskTableViewInner);
