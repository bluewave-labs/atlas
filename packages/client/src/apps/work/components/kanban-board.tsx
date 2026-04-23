import { useState, useMemo, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Check, Inbox, Star, CircleDot, Coffee, Hash, Calendar, Repeat,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Task, TaskProject, TaskWhen } from '@atlas-platform/shared';
import { useUpdateTask, useReorderTasks } from '../hooks';

// ─── Column definitions ──────────────────────────────────────────────

interface KanbanColumnDef {
  id: string;
  titleKey: string;
  icon: typeof Inbox;
  color: string;
  whenValues: TaskWhen[];
}

const COLUMNS: KanbanColumnDef[] = [
  { id: 'inbox', titleKey: 'tasks.inbox', icon: Inbox, color: '#3b82f6', whenValues: ['inbox'] },
  { id: 'today', titleKey: 'tasks.today', icon: Star, color: '#f59e0b', whenValues: ['today', 'evening'] },
  { id: 'anytime', titleKey: 'tasks.anytime', icon: CircleDot, color: '#06b6d4', whenValues: ['anytime'] },
  { id: 'someday', titleKey: 'tasks.someday', icon: Coffee, color: '#a78bfa', whenValues: ['someday'] },
];

// Map column id to the "when" value to set on drop
const COLUMN_TO_WHEN: Record<string, TaskWhen> = {
  inbox: 'inbox',
  today: 'today',
  anytime: 'anytime',
  someday: 'someday',
};

// ─── Helpers ──────────────────────────────────────────────────────────

function getColumnForTask(task: Task): string {
  // Overdue tasks go to Inbox column (matches list view's separate "Overdue" group)
  if (task.dueDate && task.dueDate.slice(0, 10) < getTodayStr()) return 'inbox';
  if (task.when === 'today' || task.when === 'evening') return 'today';
  if (task.when === 'anytime') return 'anytime';
  if (task.when === 'someday') return 'someday';
  return 'inbox';
}

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDueDateKanban(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const dd = dateStr.slice(0, 10);
  const todayStr = getTodayStr();
  if (dd === todayStr) return t('tasks.todayLabel');
  const [y, m, d] = dd.split('-').map(Number);
  const dueLocal = new Date(y, m - 1, d);
  const now = new Date();
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((dueLocal.getTime() - todayLocal.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 1) return t('tasks.tomorrowLabel');
  if (diff === -1) return t('tasks.yesterdayLabel');
  if (diff < -1) return t('tasks.daysOverdue', { count: Math.abs(diff) });
  if (diff <= 7) return dueLocal.toLocaleDateString([], { weekday: 'short' });
  return dueLocal.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function isOverdue(dateStr: string): boolean {
  return dateStr.slice(0, 10) < getTodayStr();
}

// ─── Sortable Kanban Card ────────────────────────────────────────────

function KanbanCard({
  task,
  projects,
  onComplete,
  onClick,
  isDragOverlay,
}: {
  task: Task;
  projects: TaskProject[];
  onComplete: (id: string) => void;
  onClick: (id: string) => void;
  isDragOverlay?: boolean;
}) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, disabled: isDragOverlay });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const project = task.projectId ? projects.find(p => p.id === task.projectId) : null;

  return (
    <div
      ref={!isDragOverlay ? setNodeRef : undefined}
      style={!isDragOverlay ? style : undefined}
      className={`kanban-card${isDragOverlay ? ' drag-overlay' : ''}`}
      onClick={() => onClick(task.id)}
      {...(!isDragOverlay ? { ...attributes, ...listeners } : {})}
    >
      <div className="kanban-card-top">
        <button
          className={`task-checkbox${task.status === 'completed' ? ' completed' : ''}`}
          onClick={(e) => { e.stopPropagation(); onComplete(task.id); }}
          aria-label={t('tasks.complete')}
        >
          {task.status === 'completed' && (
            <Check size={10} color="var(--color-text-inverse)" strokeWidth={3} className="task-check-icon" />
          )}
        </button>
        <div className="kanban-card-content">
          {task.priority !== 'none' && (
            <div className={`task-priority-dot ${task.priority}`} />
          )}
          <span className={`kanban-card-title${task.status === 'completed' ? ' completed' : ''}`}>
            {task.title || t('tasks.noTasks')}
          </span>
        </div>
      </div>

      {(task.dueDate || project || task.tags.length > 0 || task.recurrenceRule) && (
        <div className="kanban-card-meta">
          {task.dueDate && (
            <span className={`kanban-card-due${isOverdue(task.dueDate) ? ' overdue' : ''}`}>
              <Calendar size={9} />
              {formatDueDateKanban(task.dueDate, t)}
            </span>
          )}
          {task.recurrenceRule && (
            <span className="kanban-card-recurrence" title={`${t('tasks.repeat')}: ${task.recurrenceRule}`}>
              <Repeat size={9} />
            </span>
          )}
          {project && (
            <span className="kanban-card-project">
              {project.icon ? (
                <span style={{ fontSize: 10 }}>{project.icon}</span>
              ) : (
                <div className="task-project-dot" style={{ background: project.color, width: 6, height: 6 }} />
              )}
              {project.title}
            </span>
          )}
          {task.tags.length > 0 && (
            <span className="kanban-card-tags">
              <Hash size={9} />
              {task.tags[0]}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Droppable Column ────────────────────────────────────────────────

function KanbanColumnComponent({
  column,
  tasks,
  projects,
  onComplete,
  onClick,
  isOver,
}: {
  column: KanbanColumnDef;
  tasks: Task[];
  projects: TaskProject[];
  onComplete: (id: string) => void;
  onClick: (id: string) => void;
  isOver: boolean;
}) {
  const { t } = useTranslation();
  const { setNodeRef } = useDroppable({ id: column.id });
  const Icon = column.icon;

  return (
    <div className={`kanban-column${isOver ? ' drop-target' : ''}`} ref={setNodeRef}>
      <div className="kanban-column-header">
        <Icon size={14} color={column.color} />
        <span className="kanban-column-title">{t(column.titleKey)}</span>
        <span className="kanban-column-count">{tasks.length}</span>
      </div>
      <div className="kanban-column-body">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <KanbanCard
              key={task.id}
              task={task}
              projects={projects}
              onComplete={onComplete}
              onClick={onClick}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="kanban-column-empty">{t('tasks.noTasksInColumn')}</div>
        )}
      </div>
    </div>
  );
}

// ─── Main Board ──────────────────────────────────────────────────────

export function KanbanBoard({
  tasks,
  projects,
  onComplete,
  onSelectTask,
}: {
  tasks: Task[];
  projects: TaskProject[];
  onComplete: (id: string) => void;
  onSelectTask: (id: string) => void;
}) {
  const updateTask = useUpdateTask();
  const reorderTasks = useReorderTasks();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Group tasks by column
  const columnTasks = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    for (const col of COLUMNS) groups[col.id] = [];
    for (const task of tasks) {
      if (task.type === 'heading') continue;
      if (task.status === 'completed' || task.status === 'cancelled') continue;
      const colId = getColumnForTask(task);
      if (groups[colId]) groups[colId].push(task);
    }
    return groups;
  }, [tasks]);

  const activeTask = activeId ? tasks.find(t => t.id === activeId) : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setOverColumnId(null);
      return;
    }

    // Determine target column: could be a column id or a task id
    let targetCol = COLUMNS.find(c => c.id === over.id)?.id;
    if (!targetCol) {
      // over is a task — find its column
      const overTask = tasks.find(t => t.id === over.id);
      if (overTask) targetCol = getColumnForTask(overTask);
    }
    setOverColumnId(targetCol ?? null);
  }, [tasks]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setOverColumnId(null);

    if (!over) return;

    const taskId = active.id as string;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Determine target column
    let targetCol = COLUMNS.find(c => c.id === over.id)?.id;
    if (!targetCol) {
      const overTask = tasks.find(t => t.id === over.id);
      if (overTask) targetCol = getColumnForTask(overTask);
    }
    if (!targetCol) return;

    const sourceCol = getColumnForTask(task);
    const newWhen = COLUMN_TO_WHEN[targetCol];

    if (sourceCol !== targetCol && newWhen) {
      // Move to different column — update "when"
      updateTask.mutate({ id: taskId, when: newWhen });
    }

    // Reorder within the target column
    const targetTasks = columnTasks[targetCol] || [];
    const taskIds = targetTasks.map(t => t.id);
    const oldIndex = taskIds.indexOf(taskId);
    const overIndex = taskIds.indexOf(over.id as string);

    if (overIndex >= 0 && oldIndex !== overIndex) {
      // Simple reorder: move task to new position
      const newIds = [...taskIds];
      if (oldIndex >= 0) newIds.splice(oldIndex, 1);
      newIds.splice(overIndex, 0, taskId);
      reorderTasks.mutate(newIds);
    }
  }, [tasks, columnTasks, updateTask, reorderTasks]);

  return (
    <div className="kanban-board">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {COLUMNS.map(col => (
          <KanbanColumnComponent
            key={col.id}
            column={col}
            tasks={columnTasks[col.id] || []}
            projects={projects}
            onComplete={onComplete}
            onClick={onSelectTask}
            isOver={overColumnId === col.id}
          />
        ))}
        <DragOverlay>
          {activeTask ? (
            <KanbanCard
              task={activeTask}
              projects={projects}
              onComplete={onComplete}
              onClick={onSelectTask}
              isDragOverlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
