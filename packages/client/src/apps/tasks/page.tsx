import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Plus, Search, Inbox, Star, Calendar, Coffee,
  Archive, BookOpen, Check, Trash2, X, ChevronRight, ChevronDown,
  Hash, CircleDot, MoreHorizontal, Moon, Sun, GripVertical,
  Clock, FileText, Filter, Tag, CheckCircle2, Settings2,
  Repeat, LayoutList, LayoutGrid,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { formatDate as formatDateGlobal } from '../../lib/format';
import {
  useTaskList, useCreateTask, useUpdateTask, useDeleteTask,
  useProjectList, useCreateProject, useUpdateProject, useDeleteProject, useTaskCounts,
  useReorderTasks,
  useSubtasks, useCreateSubtask, useUpdateSubtask, useDeleteSubtask,
  useTaskActivities,
} from './hooks';
import { TaskNotesEditor } from './components/task-notes-editor';
import { queryKeys } from '../../config/query-keys';
import { api } from '../../lib/api-client';
import type { Task, TaskProject, TaskWhen, RecurrenceRule } from '@atlasmail/shared';
import { AppSidebar } from '../../components/layout/app-sidebar';
import { EmojiPicker } from '../../components/shared/emoji-picker';
import { TasksSettingsModal } from './components/tasks-settings-modal';
import { KanbanBoard } from './components/kanban-board';
import { useTasksSettingsStore } from './settings-store';
import { useUIStore } from '../../stores/ui-store';
import { SmartButtonBar } from '../../components/shared/SmartButtonBar';
import { Button } from '../../components/ui/button';
import { IconButton } from '../../components/ui/icon-button';
import { Select } from '../../components/ui/select';
import { FeatureEmptyState } from '../../components/ui/feature-empty-state';
import { StatusDot } from '../../components/ui/status-dot';
import '../../styles/tasks.css';

// ─── Navigation sections (Things 3 inspired) ────────────────────────

type NavSection = 'inbox' | 'today' | 'upcoming' | 'anytime' | 'someday' | 'logbook' | `project:${string}` | `tag:${string}`;

interface NavItem {
  id: NavSection;
  labelKey: string;
  icon: typeof Inbox;
  color: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'inbox', labelKey: 'tasks.inbox', icon: Inbox, color: '#3b82f6' },
  { id: 'today', labelKey: 'tasks.today', icon: Star, color: '#f59e0b' },
  { id: 'upcoming', labelKey: 'tasks.upcoming', icon: Calendar, color: '#ef4444' },
  { id: 'anytime', labelKey: 'tasks.anytime', icon: CircleDot, color: '#06b6d4' },
  { id: 'someday', labelKey: 'tasks.someday', icon: Coffee, color: '#a78bfa' },
  { id: 'logbook', labelKey: 'tasks.logbook', icon: BookOpen, color: '#6b7280' },
];

// ─── Helpers ────────────────────────────────────────────────────────

function getTodayStr(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function isToday(dateStr: string): boolean {
  return dateStr.slice(0, 10) === getTodayStr();
}

function isOverdue(dateStr: string): boolean {
  return dateStr.slice(0, 10) < getTodayStr();
}

function formatDueDate(dateStr: string): string {
  const dd = dateStr.slice(0, 10);
  const todayStr = getTodayStr();
  if (dd === todayStr) return 'Today';

  // Use local date parts to avoid timezone issues
  const [y, m, d] = dd.split('-').map(Number);
  const dueLocal = new Date(y, m - 1, d);
  const now = new Date();
  const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((dueLocal.getTime() - todayLocal.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff < -1) return `${Math.abs(diff)}d overdue`;
  if (diff <= 7) return dueLocal.toLocaleDateString([], { weekday: 'short' });
  return formatDateGlobal(dueLocal);
}

function getDueBadgeClass(dateStr: string): string {
  if (isOverdue(dateStr)) return 'task-due-badge overdue';
  if (isToday(dateStr)) return 'task-due-badge today';
  return 'task-due-badge upcoming';
}

// ─── Priority selector ──────────────────────────────────────────────

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High', color: '#ef4444' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'low', label: 'Low', color: '#3b82f6' },
  { value: 'none', label: 'None', color: 'transparent' },
] as const;

const WHEN_OPTIONS: { value: TaskWhen; label: string; icon: typeof Inbox }[] = [
  { value: 'inbox', label: 'Inbox', icon: Inbox },
  { value: 'today', label: 'Today', icon: Star },
  { value: 'evening', label: 'This evening', icon: Moon },
  { value: 'anytime', label: 'Anytime', icon: CircleDot },
  { value: 'someday', label: 'Someday', icon: Coffee },
];

const RECURRENCE_OPTIONS: { value: RecurrenceRule | ''; labelKey: string }[] = [
  { value: '', labelKey: 'tasks.repeatNone' },
  { value: 'daily', labelKey: 'tasks.repeatDaily' },
  { value: 'weekdays', labelKey: 'tasks.repeatWeekdays' },
  { value: 'weekly', labelKey: 'tasks.repeatWeekly' },
  { value: 'biweekly', labelKey: 'tasks.repeatBiweekly' },
  { value: 'monthly', labelKey: 'tasks.repeatMonthly' },
  { value: 'yearly', labelKey: 'tasks.repeatYearly' },
];

// ─── When Badge Component (feature 7) ──────────────────────────────

function WhenBadge({ when, dueDate, showBadge }: { when: TaskWhen; dueDate: string | null; showBadge: boolean }) {
  if (!showBadge) return null;

  if (when === 'today') {
    return <span className="task-when-badge today" title="Today"><Star size={12} /></span>;
  }
  if (when === 'evening') {
    return <span className="task-when-badge evening" title="This evening"><Moon size={12} /></span>;
  }
  if (dueDate) {
    return <span className="task-when-badge upcoming" title={formatDueDate(dueDate)}><Calendar size={12} /></span>;
  }
  return null;
}

// ─── TaskItem Component ─────────────────────────────────────────────

function TaskItem({
  task,
  isSelected,
  onClick,
  onComplete,
  onTitleSave,
  projects,
  showWhenBadge,
  showProject = true,
  showDueDate = true,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  isDragging,
  isDropTarget,
}: {
  task: Task;
  isSelected: boolean;
  onClick: () => void;
  onComplete: () => void;
  onTitleSave: (title: string) => void;
  projects: TaskProject[];
  showWhenBadge: boolean;
  showProject?: boolean;
  showDueDate?: boolean;
  onDragStart?: (e: React.DragEvent, taskId: string) => void;
  onDragOver?: (e: React.DragEvent, taskId: string) => void;
  onDrop?: (e: React.DragEvent, taskId: string) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  isDropTarget?: boolean;
}) {
  const tasksSettings = useTasksSettingsStore();
  const [completing, setCompleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditTitle(task.title);
  }, [task.title]);

  useEffect(() => {
    if (isEditing && editRef.current) {
      editRef.current.focus();
      editRef.current.select();
    }
  }, [isEditing]);

  const handleComplete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.status === 'completed') {
      onComplete(); // uncomplete immediately
      return;
    }
    setCompleting(true);
    setTimeout(() => onComplete(), 800);
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
  };

  const handleTitleSave = () => {
    setIsEditing(false);
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== task.title) {
      onTitleSave(trimmed);
    } else {
      setEditTitle(task.title);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditTitle(task.title);
    }
  };

  const project = task.projectId ? projects.find(p => p.id === task.projectId) : null;

  return (
    <div
      className={`task-item${isSelected ? ' selected' : ''}${completing ? ' completing' : ''}${isDragging ? ' dragging' : ''}${isDropTarget ? ' drop-target' : ''}`}
      data-task-id={task.id}
      onClick={onClick}
      onDragOver={e => onDragOver?.(e, task.id)}
      onDrop={e => onDrop?.(e, task.id)}
    >
      <div
        className="task-drag-handle"
        draggable
        onDragStart={e => onDragStart?.(e, task.id)}
        onDragEnd={onDragEnd}
      >
        <GripVertical size={14} />
      </div>

      <button
        className={`task-checkbox${task.status === 'completed' || completing ? ' completed' : ''}`}
        onClick={handleComplete}
      >
        {(task.status === 'completed' || completing) && (
          <Check size={12} color="#fff" strokeWidth={3} className="task-check-icon" />
        )}
      </button>

      <div className="task-item-content">
        <div className="task-item-title-row">
          {task.priority !== 'none' && (
            <div className={`task-priority-dot ${task.priority}`} />
          )}
          {task.icon && <span className="task-item-emoji">{task.icon}</span>}
          {isEditing ? (
            <input
              ref={editRef}
              className="task-inline-edit"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleTitleSave}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span
              className={`task-title-text${task.status === 'completed' ? ' completed' : ''}`}
              onClick={handleTitleClick}
            >
              {task.title || 'Untitled'}
            </span>
          )}
          {task.subtasks && task.subtasks.length > 0 && (
            <span className="ml-1.5 text-[10px] text-gray-400 font-medium">
              {task.subtasks.filter(s => s.isCompleted).length}/{task.subtasks.length}
            </span>
          )}
          <WhenBadge when={task.when} dueDate={task.dueDate} showBadge={showWhenBadge} />
        </div>

        {((showDueDate && task.dueDate) || (showProject && project) || task.tags.length > 0 || task.recurrenceRule) && (
          <div className="task-meta-row">
            {showDueDate && task.dueDate && (
              <span className={getDueBadgeClass(task.dueDate)}>
                {formatDueDate(task.dueDate)}
              </span>
            )}
            {task.recurrenceRule && (
              <span className="task-meta-recurrence" title={`Repeats ${task.recurrenceRule}`}>
                <Repeat size={10} />
              </span>
            )}
            {showProject && project && (
              <span className="task-meta-project">
                {project.icon ? (
                  <span className="task-meta-project-emoji">{project.icon}</span>
                ) : (
                  <div className="task-project-dot" style={{ background: project.color }} />
                )}
                {project.title}
              </span>
            )}
            {task.tags.length > 0 && (
              <span className="task-meta-tags">
                <Hash size={10} />
                {task.tags[0]}
                {task.tags.length > 1 && ` +${task.tags.length - 1}`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Notes indicator (respects settings) */}
      {tasksSettings.showNotesIndicator && (task.description || task.notes) && (
        <FileText size={13} className="task-notes-indicator" />
      )}

      {isSelected && (
        <ChevronRight size={14} color="var(--color-text-tertiary)" style={{ flexShrink: 0, marginTop: 3 }} />
      )}
    </div>
  );
}

// ─── Collapsible Section Header ─────────────────────────────────────

function CollapsibleSection({
  label,
  icon: Icon,
  color,
  count,
  defaultOpen = true,
  children,
}: {
  label: string;
  icon: typeof Inbox;
  color: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="task-collapsible-section">
      <button
        className="task-section-header task-section-header-collapsible"
        style={{ color }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <ChevronDown size={13} className={`task-section-chevron${isOpen ? '' : ' collapsed'}`} />
        <Icon size={13} />
        <span>{label}</span>
        <span className="task-section-count">{count}</span>
      </button>
      {isOpen && children}
    </div>
  );
}

// ─── Heading Row Component (feature 4 — sections within projects) ───

function HeadingRow({
  task,
  childCount,
  isCollapsed,
  onToggle,
  onDelete,
}: {
  task: Task;
  childCount: number;
  isCollapsed: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="task-heading-row">
      <button className="task-heading-toggle" onClick={onToggle}>
        <ChevronDown size={13} className={`task-section-chevron${isCollapsed ? ' collapsed' : ''}`} />
      </button>
      <span className="task-heading-title">{task.title}</span>
      <span className="task-heading-count">{childCount}</span>
      <IconButton
        icon={<X size={12} />}
        label="Delete section"
        size={24}
        destructive
        className="task-heading-delete"
        onClick={onDelete}
      />
    </div>
  );
}

// EmojiPicker is now imported from ../components/shared/emoji-picker

// ─── New Task Inline Creator ────────────────────────────────────────

function NewTaskCreator({
  defaultWhen,
  projectId,
  headingId,
  onCreated,
}: {
  defaultWhen: TaskWhen;
  projectId?: string | null;
  headingId?: string | null;
  onCreated?: () => void;
}) {
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const createTask = useCreateTask();

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    createTask.mutate(
      {
        title: trimmed,
        when: defaultWhen,
        projectId: projectId ?? undefined,
        headingId: headingId ?? undefined,
      },
      {
        onSuccess: () => {
          setTitle('');
          onCreated?.();
          inputRef.current?.focus();
        },
      },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="task-new-persistent">
      <Plus size={16} className="task-new-persistent-icon" />
      <input
        ref={inputRef}
        className="task-new-persistent-input"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add a task..."
      />
    </div>
  );
}

// ─── New Heading Creator (feature 4) ────────────────────────────────

function NewHeadingCreator({
  projectId,
}: {
  projectId: string;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const createTask = useCreateTask();

  useEffect(() => {
    if (isCreating && inputRef.current) inputRef.current.focus();
  }, [isCreating]);

  const handleSubmit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setIsCreating(false);
      setTitle('');
      return;
    }
    createTask.mutate(
      { title: trimmed, type: 'heading', projectId },
      { onSuccess: () => { setTitle(''); setIsCreating(false); } },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
    if (e.key === 'Escape') { setIsCreating(false); setTitle(''); }
  };

  if (!isCreating) {
    return (
      <Button
        variant="ghost"
        size="sm"
        icon={<Plus size={14} />}
        onClick={() => setIsCreating(true)}
      >
        Add section
      </Button>
    );
  }

  return (
    <div className="task-new-heading-inline">
      <input
        ref={inputRef}
        className="task-new-heading-input"
        value={title}
        onChange={e => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleSubmit}
        placeholder="Section name..."
      />
    </div>
  );
}

// ─── Subtask Section ─────────────────────────────────────────────────

function SubtaskSection({ taskId }: { taskId: string }) {
  const { data: subtasks = [] } = useSubtasks(taskId);
  const createSubtask = useCreateSubtask();
  const updateSubtask = useUpdateSubtask();
  const deleteSubtask = useDeleteSubtask();
  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const completedCount = subtasks.filter(s => s.isCompleted).length;

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    createSubtask.mutate({ taskId, title: newTitle.trim() });
    setNewTitle('');
  };

  return (
    <div className="px-4 py-3 border-t border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          Subtasks {subtasks.length > 0 && `(${completedCount}/${subtasks.length})`}
        </span>
        <IconButton
          icon={<Plus size={14} />}
          label="Add subtask"
          size={24}
          tooltip={false}
          onClick={() => setIsAdding(!isAdding)}
        />
      </div>

      {/* Progress bar */}
      {subtasks.length > 0 && (
        <div className="w-full h-1.5 bg-gray-100 rounded-full mb-2">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${(completedCount / subtasks.length) * 100}%` }}
          />
        </div>
      )}

      {/* Subtask list */}
      <div className="space-y-1">
        {subtasks.map((subtask) => (
          <div key={subtask.id} className="flex items-center gap-2 group">
            <input
              type="checkbox"
              checked={subtask.isCompleted}
              onChange={(e) => updateSubtask.mutate({
                subtaskId: subtask.id,
                taskId,
                isCompleted: e.target.checked,
              })}
              className="w-3.5 h-3.5 rounded border-gray-300 text-green-600 cursor-pointer"
            />
            <span className={`flex-1 text-sm ${subtask.isCompleted ? 'line-through text-gray-400' : 'text-gray-700'}`}>
              {subtask.title}
            </span>
            <IconButton
              icon={<Trash2 size={12} />}
              label="Delete subtask"
              size={22}
              destructive
              tooltip={false}
              onClick={() => deleteSubtask.mutate({ subtaskId: subtask.id, taskId })}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
        ))}
      </div>

      {/* Add subtask input */}
      {isAdding && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setIsAdding(false); }}
            placeholder="Add a subtask..."
            className="flex-1 text-sm px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-blue-400"
            autoFocus
          />
        </div>
      )}
    </div>
  );
}

// ─── Activity Section ────────────────────────────────────────────────

function ActivitySection({ taskId }: { taskId: string }) {
  const { data: activities = [] } = useTaskActivities(taskId);
  const [isExpanded, setIsExpanded] = useState(false);

  if (activities.length === 0) return null;

  function formatAction(activity: any): string {
    if (activity.action === 'created') return 'Created this task';
    if (activity.action === 'completed') return 'Completed this task';
    if (activity.action === 'updated' && activity.field) {
      return `Changed ${activity.field}`;
    }
    if (activity.action === 'subtask_added') return 'Added a subtask';
    if (activity.action === 'subtask_completed') return 'Completed a subtask';
    return activity.action;
  }

  function getRelativeTime(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  return (
    <div className="px-4 py-3 border-t border-gray-100">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
      >
        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <Clock className="w-3 h-3" />
        Activity ({activities.length})
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-2 ml-1 border-l-2 border-gray-100 pl-3">
          {activities.slice(0, 20).map((activity: any) => (
            <div key={activity.id} className="text-xs">
              <span className="text-gray-600">{formatAction(activity)}</span>
              <span className="text-gray-400 ml-1.5">{getRelativeTime(activity.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Task Detail Panel ──────────────────────────────────────────────

function TaskDetailPanel({
  task,
  projects,
  onClose,
}: {
  task: Task;
  projects: TaskProject[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(task.title);
  const [when, setWhen] = useState(task.when);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate || '');
  const [showTaskEmoji, setShowTaskEmoji] = useState(false);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const titleRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setTitle(task.title);
    setWhen(task.when);
    setPriority(task.priority);
    setDueDate(task.dueDate || '');
  }, [task.id, task.title, task.when, task.priority, task.dueDate]);

  const autoSave = useCallback((updates: Record<string, unknown>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      updateTask.mutate({ id: task.id, ...updates } as any);
    }, 500);
  }, [task.id, updateTask]);

  const handleDelete = () => {
    deleteTask.mutate(task.id);
    onClose();
  };

  const project = task.projectId ? projects.find(p => p.id === task.projectId) : null;

  return (
    <div className="task-detail-panel">
      {/* Header */}
      <div className="task-detail-header">
        <span className="task-detail-header-label">Task detail</span>
        <div className="task-detail-header-actions">
          <IconButton
            icon={<Trash2 size={14} />}
            label="Delete task"
            size={28}
            destructive
            onClick={handleDelete}
          />
          <IconButton
            icon={<X size={14} />}
            label="Close"
            size={28}
            onClick={onClose}
          />
        </div>
      </div>

      <SmartButtonBar appId="tasks" recordId={task.id} />

      {/* Body */}
      <div className="task-detail-body task-list-scroll">
        {/* Task emoji + title row */}
        <div className="task-detail-title-row">
          <div style={{ position: 'relative' }}>
            <button
              className="task-detail-emoji-btn"
              onClick={() => setShowTaskEmoji(!showTaskEmoji)}
              title="Set icon"
            >
              {task.icon || <Plus size={14} />}
            </button>
            {showTaskEmoji && (
              <EmojiPicker
                onSelect={(emoji) => { updateTask.mutate({ id: task.id, icon: emoji }); setShowTaskEmoji(false); }}
                onRemove={() => { updateTask.mutate({ id: task.id, icon: null }); setShowTaskEmoji(false); }}
                onClose={() => setShowTaskEmoji(false)}
              />
            )}
          </div>
          <input
            ref={titleRef}
            className="task-detail-title"
            value={title}
            onChange={e => {
              setTitle(e.target.value);
              autoSave({ title: e.target.value });
            }}
            placeholder="Task title..."
          />
        </div>

        {/* Timestamps */}
        <div className="task-detail-timestamps">
          <div className="task-detail-timestamp-text">
            Created {formatDateGlobal(task.createdAt)}
            {task.completedAt && (
              <> · Completed {formatDateGlobal(task.completedAt)}</>
            )}
          </div>
        </div>

        {/* Metadata fields */}
        <div className="task-detail-fields">
          {/* When */}
          <div className="task-detail-field">
            <span className="task-detail-label">When</span>
            <div className="task-detail-pills">
              {WHEN_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`task-pill${when === opt.value ? ' active' : ''}`}
                  onClick={() => {
                    setWhen(opt.value);
                    updateTask.mutate({ id: task.id, when: opt.value });
                  }}
                >
                  <opt.icon size={11} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="task-detail-field">
            <span className="task-detail-label">Priority</span>
            <div className="task-detail-pills">
              {PRIORITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`task-pill${priority === opt.value ? ' active' : ''}`}
                  onClick={() => {
                    setPriority(opt.value);
                    updateTask.mutate({ id: task.id, priority: opt.value });
                  }}
                >
                  {opt.color !== 'transparent' && (
                    <StatusDot color={opt.color} size={6} />
                  )}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Due date */}
          <div className="task-detail-field">
            <span className="task-detail-label">Due</span>
            <input
              type="date"
              className="task-date-input"
              value={dueDate}
              onChange={e => {
                setDueDate(e.target.value);
                updateTask.mutate({ id: task.id, dueDate: e.target.value || null });
              }}
            />
            {dueDate && (
              <IconButton
                icon={<X size={12} />}
                label="Clear due date"
                size={24}
                onClick={() => {
                  setDueDate('');
                  updateTask.mutate({ id: task.id, dueDate: null });
                }}
              />
            )}
          </div>

          {/* Recurrence */}
          <div className="task-detail-field">
            <span className="task-detail-label">{t('tasks.repeat')}</span>
            <Select
              value={task.recurrenceRule || ''}
              onChange={(v) => {
                const val = v || null;
                updateTask.mutate({ id: task.id, recurrenceRule: val as RecurrenceRule | null });
              }}
              options={RECURRENCE_OPTIONS.map(opt => ({ value: opt.value, label: t(opt.labelKey) }))}
              size="sm"
            />
          </div>

          {/* Project */}
          {project && (
            <div className="task-detail-field">
              <span className="task-detail-label">Project</span>
              <span className="task-detail-project-info">
                {project.icon ? (
                  <span style={{ fontSize: 'var(--font-size-md)' }}>{project.icon}</span>
                ) : (
                  <div className="task-detail-project-dot" style={{ background: project.color }} />
                )}
                {project.title}
              </span>
            </div>
          )}
        </div>

        {/* Subtasks */}
        <SubtaskSection taskId={task.id} />

        {/* Rich notes editor (below details) */}
        <div style={{ paddingTop: 16 }}>
          <TaskNotesEditor
            content={task.description || task.notes || ''}
            onChange={(html) => {
              autoSave({ description: html || null });
            }}
            placeholder="Add notes..."
          />
        </div>

        {/* Activity log */}
        <ActivitySection taskId={task.id} />
      </div>
    </div>
  );
}

// ─── Project Header (features 9 + 10: description + emoji) ─────────

function ProjectHeader({
  project,
}: {
  project: TaskProject;
}) {
  const updateProject = useUpdateProject();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [desc, setDesc] = useState(project.description || '');
  const descRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDesc(project.description || '');
  }, [project.id, project.description]);

  useEffect(() => {
    if (isEditingDesc && descRef.current) descRef.current.focus();
  }, [isEditingDesc]);

  const handleEmojiSelect = (emoji: string) => {
    updateProject.mutate({ id: project.id, icon: emoji || null });
  };

  const handleDescSave = () => {
    setIsEditingDesc(false);
    updateProject.mutate({ id: project.id, description: desc || null });
  };

  return (
    <div className="task-project-header">
      <div className="task-project-header-top">
        <div className="task-project-emoji-wrapper" style={{ position: 'relative' }}>
          <button
            className="task-project-emoji-btn"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            title="Change icon"
          >
            {project.icon || <div className="tasks-project-indicator large" style={{ background: project.color }} />}
          </button>
          {showEmojiPicker && (
            <EmojiPicker
              onSelect={(emoji) => { handleEmojiSelect(emoji); setShowEmojiPicker(false); }}
              onRemove={() => { handleEmojiSelect(''); setShowEmojiPicker(false); }}
              onClose={() => setShowEmojiPicker(false)}
            />
          )}
        </div>
        <h2 className="task-project-header-title">{project.title}</h2>
      </div>

      {isEditingDesc ? (
        <input
          ref={descRef}
          className="task-project-desc-input"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          onBlur={handleDescSave}
          onKeyDown={e => { if (e.key === 'Enter') handleDescSave(); if (e.key === 'Escape') setIsEditingDesc(false); }}
          placeholder="Add a description..."
        />
      ) : (
        <div
          className="task-project-desc"
          onClick={() => setIsEditingDesc(true)}
        >
          {project.description || <span className="task-project-desc-placeholder">Add a description...</span>}
        </div>
      )}
    </div>
  );
}

// ─── Main Tasks Page ────────────────────────────────────────────────

export function TasksPage() {
  const { t } = useTranslation();
  const isDesktop = !!('atlasDesktop' in window);

  // Settings
  const { openSettings } = useUIStore();
  const tasksSettings = useTasksSettingsStore();

  // Sidebar
  const [activeSection, setActiveSection] = useState<NavSection>(tasksSettings.defaultView);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // View mode (list/board) — board only available in inbox
  const [viewMode, setViewMode] = useState<'list' | 'board'>(tasksSettings.viewMode || 'list');
  const canShowBoard = activeSection === 'inbox';

  // Auto-switch to list when leaving inbox
  useEffect(() => {
    if (!canShowBoard && viewMode === 'board') setViewMode('list');
  }, [canShowBoard, viewMode]);

  // Drag state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Collapsed headings state (keyed by heading task ID)
  const [collapsedHeadings, setCollapsedHeadings] = useState<Set<string>>(new Set());
  // Completed section collapsed state
  const [completedCollapsed, setCompletedCollapsed] = useState(true);

  // Data
  const { data: counts } = useTaskCounts();
  const { data: projectsData } = useProjectList();
  const projects = projectsData?.projects ?? [];

  // Determine filters based on active section
  const taskFilters = useMemo(() => {
    if (activeSection === 'inbox') return { status: 'todo' }; // fetch ALL todo tasks for inbox overview
    if (activeSection === 'today') return { when: 'today', status: 'todo' };
    if (activeSection === 'anytime') return { when: 'anytime', status: 'todo' };
    if (activeSection === 'someday') return { when: 'someday', status: 'todo' };
    if (activeSection === 'logbook') return { status: 'completed' };
    if (activeSection === 'upcoming') return { status: 'todo' };
    if (activeSection.startsWith('project:')) {
      return { projectId: activeSection.replace('project:', ''), status: 'todo' };
    }
    if (activeSection.startsWith('tag:')) {
      return { status: 'todo' }; // fetch all todo tasks, filter by tag client-side
    }
    return {};
  }, [activeSection]);

  const { data: tasksData, isLoading } = useTaskList(taskFilters);
  const allTasks = tasksData?.tasks ?? [];

  // Fetch completed tasks for the current section (for "Completed" footer)
  const completedFilters = useMemo(() => {
    if (activeSection === 'logbook') return null; // logbook already shows completed
    if (activeSection.startsWith('project:')) {
      return { projectId: activeSection.replace('project:', ''), status: 'completed' };
    }
    // For non-project views, show completed from that "when" bucket
    if (['inbox', 'today', 'anytime', 'someday'].includes(activeSection)) {
      return { when: activeSection === 'today' ? 'today' : activeSection, status: 'completed' };
    }
    return null;
  }, [activeSection]);

  const { data: completedData } = useTaskList(completedFilters ?? { status: 'completed' }, { enabled: completedFilters !== null });
  const completedTasks = completedFilters ? (completedData?.tasks ?? []) : [];

  // Client-side filter for upcoming (tasks with due dates) and tags
  const displayTasks = useMemo(() => {
    let tasks = allTasks;
    if (activeSection === 'upcoming') {
      return tasks.filter(t => t.dueDate).sort((a, b) => (a.dueDate! > b.dueDate! ? 1 : -1));
    }
    if (activeSection.startsWith('tag:')) {
      const tag = activeSection.replace('tag:', '');
      tasks = tasks.filter(t => t.tags.includes(tag));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      tasks = tasks.filter(t => t.title.toLowerCase().includes(q));
    }
    return tasks;
  }, [allTasks, activeSection, searchQuery]);

  // Split today view into daytime + evening (feature 2)
  const todayTasks = useMemo(() => {
    if (activeSection !== 'today') return null;
    if (!tasksSettings.showEveningSection) {
      // If evening section is disabled, show all as one flat list
      const all = displayTasks.filter(t => t.type !== 'heading');
      return { daytime: all, evening: [] };
    }
    const daytime = displayTasks.filter(t => t.when === 'today' && t.type !== 'heading');
    const evening = displayTasks.filter(t => t.when === 'evening' && t.type !== 'heading');
    return { daytime, evening };
  }, [activeSection, displayTasks, tasksSettings.showEveningSection]);

  // Group project tasks by headings (feature 4)
  const projectTaskGroups = useMemo(() => {
    if (!activeSection.startsWith('project:')) return null;

    const headings = displayTasks.filter(t => t.type === 'heading');
    const regularTasks = displayTasks.filter(t => t.type !== 'heading');

    const ungrouped = regularTasks.filter(t => !t.headingId);
    const groups: { heading: Task | null; tasks: Task[] }[] = [];

    if (ungrouped.length > 0) {
      groups.push({ heading: null, tasks: ungrouped });
    }

    for (const h of headings) {
      const children = regularTasks.filter(t => t.headingId === h.id);
      groups.push({ heading: h, tasks: children });
    }

    return groups;
  }, [activeSection, displayTasks]);

  // Group inbox tasks by "when" category (Inbox is a unified overview of all todo tasks)
  // Tasks with overdue due dates are pulled into an "Overdue" section at the top
  const inboxGroups = useMemo(() => {
    if (activeSection !== 'inbox') return null;

    const tasks = displayTasks.filter(t => t.type !== 'heading');
    const todayStr = getTodayStr();

    const overdue: Task[] = [];
    const inbox: Task[] = [];
    const today: Task[] = [];
    const evening: Task[] = [];
    const anytime: Task[] = [];
    const someday: Task[] = [];

    for (const t of tasks) {
      // Tasks with overdue due dates go to the Overdue section regardless of "when"
      if (t.dueDate && t.dueDate.slice(0, 10) < todayStr) {
        overdue.push(t);
      } else if (t.when === 'today') today.push(t);
      else if (t.when === 'evening') evening.push(t);
      else if (t.when === 'anytime') anytime.push(t);
      else if (t.when === 'someday') someday.push(t);
      else inbox.push(t); // 'inbox' or any other value
    }

    const groups: { label: string; icon: typeof Inbox; color: string; tasks: Task[]; noHeader?: boolean }[] = [];
    if (overdue.length > 0) groups.push({ label: 'Overdue', icon: Calendar, color: '#ef4444', tasks: overdue });
    // Unscheduled inbox tasks appear without a section header (they're the default)
    if (inbox.length > 0) groups.push({ label: 'Unscheduled', icon: Inbox, color: '#3b82f6', tasks: inbox, noHeader: true });
    if (today.length > 0) groups.push({ label: 'Today', icon: Star, color: '#f59e0b', tasks: today });
    if (evening.length > 0) groups.push({ label: 'This evening', icon: Moon, color: '#6366f1', tasks: evening });
    if (anytime.length > 0) groups.push({ label: 'Anytime', icon: CircleDot, color: '#06b6d4', tasks: anytime });
    if (someday.length > 0) groups.push({ label: 'Someday', icon: Coffee, color: '#a78bfa', tasks: someday });

    return groups;
  }, [activeSection, displayTasks]);

  // Determine if we should show "when" badges
  const showWhenBadges = useMemo(() => {
    if (!tasksSettings.showWhenBadges) return false;
    return activeSection.startsWith('project:') || activeSection.startsWith('tag:') || activeSection === 'upcoming' || activeSection === 'logbook';
  }, [activeSection, tasksSettings.showWhenBadges]);

  // Show project name only in project views, tags, upcoming, logbook (not in inbox/today/anytime/someday)
  const showProjectInList = useMemo(() => {
    return activeSection.startsWith('project:') || activeSection.startsWith('tag:') || activeSection === 'upcoming' || activeSection === 'logbook';
  }, [activeSection]);

  // Hide due date chips in views where tasks are already grouped by time (inbox, today)
  const showDueDateInList = useMemo(() => {
    return activeSection !== 'inbox' && activeSection !== 'today';
  }, [activeSection]);

  const selectedTask = displayTasks.find(t => t.id === selectedTaskId) ?? null;
  const updateTask = useUpdateTask();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();
  const reorderTasks = useReorderTasks();
  const queryClient = useQueryClient();
  const [seeding, setSeeding] = useState(false);
  const [projectMenuId, setProjectMenuId] = useState<string | null>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);

  const handleSeedSampleData = useCallback(async () => {
    setSeeding(true);
    try {
      await api.post('/tasks/seed');
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all });
    } catch { /* ignore */ }
    setSeeding(false);
  }, [queryClient]);

  // Auto-seed on first visit when there are no tasks at all
  const hasSeeded = useRef(false);
  useEffect(() => {
    if (!isLoading && allTasks.length === 0 && !seeding && !hasSeeded.current && counts !== undefined && counts.total === 0 && counts.logbook === 0) {
      hasSeeded.current = true;
      handleSeedSampleData();
    }
  }, [isLoading, allTasks.length, seeding, counts, handleSeedSampleData]);

  // Default "when" for new tasks in current section
  const defaultWhen: TaskWhen = useMemo(() => {
    if (activeSection === 'today') return 'today';
    if (activeSection === 'anytime') return 'anytime';
    if (activeSection === 'someday') return 'someday';
    if (activeSection.startsWith('tag:')) return 'inbox';
    return 'inbox';
  }, [activeSection]);

  const projectIdForNew = activeSection.startsWith('project:')
    ? activeSection.replace('project:', '')
    : null;

  const activeProject = projectIdForNew ? projects.find(p => p.id === projectIdForNew) : null;

  // Close project menu on click outside
  useEffect(() => {
    if (!projectMenuId) return;
    const close = (e: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
        setProjectMenuId(null);
      }
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [projectMenuId]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (projectMenuId) { setProjectMenuId(null); return; }
        if (showSearch) { setShowSearch(false); setSearchQuery(''); }
        else if (selectedTaskId) setSelectedTaskId(null);
      }
      if (e.key === '/' && !isInputFocused()) {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTaskId, showSearch, projectMenuId]);

  // Collect unique tags from all visible tasks
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const t of allTasks) {
      for (const tag of t.tags) tagSet.add(tag);
    }
    return Array.from(tagSet).sort();
  }, [allTasks]);

  const handleComplete = useCallback((taskId: string) => {
    const task = allTasks.find(t => t.id === taskId) ?? completedTasks.find(t => t.id === taskId);
    const newStatus = task?.status === 'completed' ? 'todo' : 'completed';
    updateTask.mutate({ id: taskId, status: newStatus });
  }, [updateTask, allTasks, completedTasks]);

  // ─── Drag-and-drop handlers (feature 8) ────────────────────────
  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);

    // Create a custom drag ghost from the task row
    const taskEl = document.querySelector(`[data-task-id="${taskId}"]`) as HTMLElement | null;
    if (taskEl) {
      const ghost = taskEl.cloneNode(true) as HTMLElement;
      ghost.style.position = 'absolute';
      ghost.style.top = '-9999px';
      ghost.style.left = '-9999px';
      ghost.style.width = `${taskEl.offsetWidth}px`;
      ghost.style.background = 'var(--color-bg-elevated)';
      ghost.style.borderRadius = 'var(--radius-lg)';
      ghost.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
      ghost.style.opacity = '0.92';
      ghost.style.padding = '10px 16px';
      document.body.appendChild(ghost);
      // Calculate cursor offset relative to the task element so ghost aligns with cursor
      const rect = taskEl.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      const offsetY = e.clientY - rect.top;
      e.dataTransfer.setDragImage(ghost, offsetX, offsetY);
      // Clean up ghost after drag starts
      requestAnimationFrame(() => document.body.removeChild(ghost));
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetId(targetId);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = draggedTaskId;
    if (!sourceId || sourceId === targetId) {
      setDraggedTaskId(null);
      setDropTargetId(null);
      return;
    }

    // Reorder locally then persist
    const currentOrder = displayTasks.filter(t => t.type !== 'heading').map(t => t.id);
    const sourceIdx = currentOrder.indexOf(sourceId);
    const targetIdx = currentOrder.indexOf(targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    currentOrder.splice(sourceIdx, 1);
    currentOrder.splice(targetIdx, 0, sourceId);

    reorderTasks.mutate(currentOrder);
    setDraggedTaskId(null);
    setDropTargetId(null);
  }, [draggedTaskId, displayTasks, reorderTasks]);

  const handleDragEnd = useCallback(() => {
    setDraggedTaskId(null);
    setDropTargetId(null);
  }, []);

  const handleDeleteHeading = useCallback((headingId: string) => {
    // Ungroup tasks under this heading, then delete the heading
    const childTasks = allTasks.filter(t => t.headingId === headingId);
    for (const child of childTasks) {
      updateTask.mutate({ id: child.id, headingId: null });
    }
    updateTask.mutate({ id: headingId, isArchived: true });
  }, [allTasks, updateTask]);

  // Get section title
  const sectionTitle = useMemo(() => {
    if (activeSection.startsWith('project:')) {
      return null; // We show the project header instead
    }
    if (activeSection.startsWith('tag:')) {
      return `#${activeSection.replace('tag:', '')}`;
    }
    const nav = NAV_ITEMS.find(n => n.id === activeSection);
    return nav ? t(nav.labelKey) : '';
  }, [activeSection, t]);

  // Count for each nav item
  const navCounts = useMemo(() => ({
    inbox: counts?.inbox ?? 0,
    today: counts?.today ?? 0,
    upcoming: counts?.upcoming ?? 0,
    anytime: counts?.anytime ?? 0,
    someday: counts?.someday ?? 0,
    logbook: counts?.logbook ?? 0,
  }), [counts]);

  const handleNewProject = () => {
    createProject.mutate({ title: 'New project' }, {
      onSuccess: (proj) => {
        setActiveSection(`project:${proj.id}`);
      },
    });
  };

  const handleDeleteProject = (projectId: string) => {
    if (activeSection === `project:${projectId}`) {
      setActiveSection('inbox');
      setSelectedTaskId(null);
    }
    deleteProject.mutate(projectId);
    setProjectMenuId(null);
  };

  // Render task items helper
  const renderTaskItem = (task: Task) => (
    <TaskItem
      key={task.id}
      task={task}
      isSelected={selectedTaskId === task.id}
      onClick={() => setSelectedTaskId(task.id)}
      onComplete={() => handleComplete(task.id)}
      onTitleSave={(title) => updateTask.mutate({ id: task.id, title })}
      projects={projects}
      showWhenBadge={showWhenBadges}
      showProject={showProjectInList}
      showDueDate={showDueDateInList}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onDragEnd={handleDragEnd}
      isDragging={draggedTaskId === task.id}
      isDropTarget={dropTargetId === task.id && draggedTaskId !== task.id}
    />
  );

  return (
    <div className="tasks-page">
      {/* Desktop drag region */}
      {isDesktop && <div className="desktop-drag-region tasks-drag-region" />}

      {/* ─── Sidebar ─── */}
      <AppSidebar storageKey="atlas_tasks_sidebar" title="Tasks">
        {/* Nav items */}
        <div className="tasks-nav-section">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`task-nav-item${activeSection === item.id ? ' active' : ''}`}
              onClick={() => { setActiveSection(item.id); setSelectedTaskId(null); }}
            >
              <item.icon size={16} color={item.color} strokeWidth={1.8} />
              <span style={{ flex: 1 }}>{t(item.labelKey)}</span>
              {navCounts[item.id as keyof typeof navCounts] > 0 && (
                <span className="task-nav-count">
                  {navCounts[item.id as keyof typeof navCounts]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Projects section */}
        <div style={{ marginTop: 16, padding: '0 8px' }}>
          <div className="tasks-projects-header">
            <span className="tasks-projects-label">Projects</span>
            <IconButton
              icon={<Plus size={14} />}
              label="New project"
              size={24}
              onClick={handleNewProject}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {projects.map(proj => (
              <div key={proj.id} className="tasks-project-row" style={{ position: 'relative' }}>
                <button
                  className={`task-nav-item${activeSection === `project:${proj.id}` ? ' active' : ''}`}
                  onClick={() => { setActiveSection(`project:${proj.id}`); setSelectedTaskId(null); }}
                >
                  {proj.icon ? (
                    <span className="tasks-project-emoji">{proj.icon}</span>
                  ) : (
                    <div className="tasks-project-indicator" style={{ background: proj.color }} />
                  )}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {proj.title}
                  </span>
                </button>
                <IconButton
                  icon={<MoreHorizontal size={14} />}
                  label="Project options"
                  size={24}
                  tooltip={false}
                  className="tasks-project-more-btn"
                  onClick={e => {
                    e.stopPropagation();
                    setProjectMenuId(projectMenuId === proj.id ? null : proj.id);
                  }}
                />
                {projectMenuId === proj.id && (
                  <div className="tasks-project-popover" ref={projectMenuRef}>
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<Trash2 size={13} />}
                      onClick={() => handleDeleteProject(proj.id)}
                      style={{ width: '100%', justifyContent: 'flex-start' }}
                    >
                      Delete project
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tags section */}
        {allTags.length > 0 && (
          <div style={{ marginTop: 16, padding: '0 8px' }}>
            <div className="tasks-projects-header">
              <span className="tasks-projects-label">Tags</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {allTags.map(tag => (
                <button
                  key={tag}
                  className={`task-nav-item${activeSection === `tag:${tag}` as any ? ' active' : ''}`}
                  onClick={() => { setActiveSection(`tag:${tag}` as NavSection); setSelectedTaskId(null); }}
                >
                  <Hash size={14} color="var(--color-text-tertiary)" />
                  <span style={{ flex: 1 }}>{tag}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ flex: 1 }} />
      </AppSidebar>

      {/* ─── Main content ─── */}
      <div className="tasks-main">
        {/* Toolbar */}
        <div className="tasks-toolbar" style={{ paddingTop: isDesktop ? 46 : 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {sectionTitle && (
              <>
                <h2 className="tasks-toolbar-title">{sectionTitle}</h2>
                {displayTasks.length > 0 && (
                  <span className="tasks-toolbar-count">{displayTasks.length}</span>
                )}
              </>
            )}

            {canShowBoard && (
              <div className="tasks-view-toggle">
                <button
                  className={`tasks-view-toggle-btn${viewMode === 'list' ? ' active' : ''}`}
                  onClick={() => { setViewMode('list'); tasksSettings.setViewMode('list'); }}
                  title={t('tasks.listView')}
                >
                  <LayoutList size={14} />
                </button>
                <button
                  className={`tasks-view-toggle-btn${viewMode === 'board' ? ' active' : ''}`}
                  onClick={() => { setViewMode('board'); tasksSettings.setViewMode('board'); }}
                  title={t('tasks.boardView')}
                >
                  <LayoutGrid size={14} />
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {showSearch ? (
              <div className="tasks-search-bar">
                <Search size={13} color="var(--color-text-tertiary)" />
                <input
                  ref={searchInputRef}
                  className="tasks-search-input"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); } }}
                  placeholder="Search tasks..."
                />
                <IconButton
                  icon={<X size={12} />}
                  label="Close search"
                  size={24}
                  tooltip={false}
                  onClick={() => { setShowSearch(false); setSearchQuery(''); }}
                />
              </div>
            ) : (
              <IconButton
                icon={<Search size={15} />}
                label="Search (press /)"
                size={28}
                onClick={() => { setShowSearch(true); setTimeout(() => searchInputRef.current?.focus(), 50); }}
              />
            )}
            <IconButton
              icon={<Settings2 size={15} strokeWidth={1.8} />}
              label="Tasks settings"
              size={28}
              onClick={() => openSettings('tasks')}
            />
          </div>
        </div>

        {/* Task list + detail */}
        <div className="tasks-content">
          {viewMode === 'board' && canShowBoard ? (
            /* ─── Kanban board view ─── */
            <>
              <KanbanBoard
                tasks={displayTasks}
                projects={projects}
                onComplete={handleComplete}
                onSelectTask={(id) => setSelectedTaskId(id)}
              />
              {/* Detail panel in board view */}
              {selectedTask && selectedTask.type !== 'heading' && (
                <TaskDetailPanel
                  task={selectedTask}
                  projects={projects}
                  onClose={() => setSelectedTaskId(null)}
                />
              )}
            </>
          ) : (
            /* ─── List view ─── */
            <>
              <div className={`tasks-list-container task-list-scroll${tasksSettings.compactMode ? ' compact' : ''}`}>
                {/* Project header (features 9 + 10) */}
                {activeProject && <ProjectHeader project={activeProject} />}


                {/* ─── Today view with evening split (feature 2) ─── */}
                {todayTasks ? (
                  <>
                    <NewTaskCreator defaultWhen="today" projectId={projectIdForNew} />

                    {todayTasks.daytime.length > 0 && (
                      <CollapsibleSection label="Today" icon={Sun} color="#d97706" count={todayTasks.daytime.length}>
                        {todayTasks.daytime.map(renderTaskItem)}
                      </CollapsibleSection>
                    )}

                    {todayTasks.evening.length > 0 && (
                      <CollapsibleSection label="This evening" icon={Moon} color="#6366f1" count={todayTasks.evening.length}>
                        {todayTasks.evening.map(renderTaskItem)}
                      </CollapsibleSection>
                    )}

                    {todayTasks.daytime.length === 0 && todayTasks.evening.length === 0 && !isLoading && (
                      <EmptyState section={activeSection} seeding={seeding} onSeed={handleSeedSampleData} />
                    )}
                  </>
                ) : projectTaskGroups ? (
                  /* ─── Project view with headings (feature 3 + 4) ─── */
                  <>
                    <NewTaskCreator defaultWhen={defaultWhen} projectId={projectIdForNew} />

                    {projectTaskGroups.map((group, idx) => (
                      <div key={group.heading?.id || `ungrouped-${idx}`}>
                        {group.heading && (
                          <HeadingRow
                            task={group.heading}
                            childCount={group.tasks.length}
                            isCollapsed={collapsedHeadings.has(group.heading.id)}
                            onToggle={() => {
                              setCollapsedHeadings(prev => {
                                const next = new Set(prev);
                                if (next.has(group.heading!.id)) next.delete(group.heading!.id);
                                else next.add(group.heading!.id);
                                return next;
                              });
                            }}
                            onDelete={() => handleDeleteHeading(group.heading!.id)}
                          />
                        )}
                        {(!group.heading || !collapsedHeadings.has(group.heading.id)) && group.tasks.map(renderTaskItem)}
                      </div>
                    ))}

                    {projectIdForNew && <NewHeadingCreator projectId={projectIdForNew} />}

                    {displayTasks.filter(t => t.type !== 'heading').length === 0 && !isLoading && (
                      <EmptyState section={activeSection} seeding={seeding} onSeed={handleSeedSampleData} />
                    )}
                  </>
                ) : inboxGroups ? (
                  /* ─── Inbox grouped by time periods ─── */
                  <>
                    <NewTaskCreator defaultWhen={defaultWhen} projectId={projectIdForNew} />

                    {inboxGroups.map((group) => (
                      group.noHeader ? (
                        <div key={group.label}>
                          {group.tasks.map(renderTaskItem)}
                        </div>
                      ) : (
                        <CollapsibleSection
                          key={group.label}
                          label={group.label}
                          icon={group.icon}
                          color={group.color}
                          count={group.tasks.length}
                        >
                          {group.tasks.map(renderTaskItem)}
                        </CollapsibleSection>
                      )
                    ))}

                    {displayTasks.length === 0 && !isLoading && (
                      <EmptyState section={activeSection} seeding={seeding} onSeed={handleSeedSampleData} />
                    )}
                  </>
                ) : (
                  /* ─── Standard list view ─── */
                  <>
                    {activeSection !== 'logbook' && activeSection !== 'upcoming' && (
                      <NewTaskCreator defaultWhen={defaultWhen} projectId={projectIdForNew} />
                    )}

                    {displayTasks.map(renderTaskItem)}

                    {displayTasks.length === 0 && !isLoading && (
                      <EmptyState section={activeSection} seeding={seeding} onSeed={handleSeedSampleData} />
                    )}
                  </>
                )}

                {/* ─── Completed section at bottom ─── */}
                {completedTasks.length > 0 && activeSection !== 'logbook' && (
                  <div className="task-completed-section">
                    <button
                      className="task-completed-section-header"
                      onClick={() => setCompletedCollapsed(!completedCollapsed)}
                    >
                      <ChevronDown size={13} className={`task-section-chevron${completedCollapsed ? ' collapsed' : ''}`} />
                      <CheckCircle2 size={13} />
                      <span>Completed</span>
                      <span className="task-section-count">{completedTasks.length}</span>
                    </button>
                    {!completedCollapsed && completedTasks.map(renderTaskItem)}
                  </div>
                )}
              </div>

              {/* Detail panel */}
              {selectedTask && selectedTask.type !== 'heading' && (
                <TaskDetailPanel
                  task={selectedTask}
                  projects={projects}
                  onClose={() => setSelectedTaskId(null)}
                />
              )}
            </>
          )}
        </div>
      </div>

    </div>
  );
}

// ─── Empty State Component ──────────────────────────────────────────

function EmptyState({
  section,
  seeding,
  onSeed,
}: {
  section: NavSection;
  seeding: boolean;
  onSeed: () => void;
}) {
  const { t } = useTranslation();
  const isProject = section.startsWith('project:');

  // For inbox section with no tasks, show rich empty state
  if (section === 'inbox') {
    return (
      <FeatureEmptyState
        illustration="tasks"
        title={t('tasks.empty.inboxTitle')}
        description={t('tasks.empty.inboxDesc')}
        highlights={[
          { icon: <Inbox size={14} />, title: t('tasks.empty.inboxH1Title'), description: t('tasks.empty.inboxH1Desc') },
          { icon: <Star size={14} />, title: t('tasks.empty.inboxH2Title'), description: t('tasks.empty.inboxH2Desc') },
          { icon: <Calendar size={14} />, title: t('tasks.empty.inboxH3Title'), description: t('tasks.empty.inboxH3Desc') },
        ]}
        actionLabel={seeding ? t('common.loading') : t('tasks.empty.loadSample')}
        actionIcon={<Plus size={14} />}
        onAction={onSeed}
      />
    );
  }

  // For other sections, keep simple empty states
  const config: Record<string, { icon: typeof Inbox; title: string; desc: string }> = {
    today: { icon: Star, title: t('tasks.empty.todayTitle'), desc: t('tasks.empty.todayDesc') },
    upcoming: { icon: Calendar, title: t('tasks.empty.upcomingTitle'), desc: t('tasks.empty.upcomingDesc') },
    anytime: { icon: CircleDot, title: t('tasks.empty.anytimeTitle'), desc: t('tasks.empty.anytimeDesc') },
    someday: { icon: Coffee, title: t('tasks.empty.somedayTitle'), desc: t('tasks.empty.somedayDesc') },
    logbook: { icon: BookOpen, title: t('tasks.empty.logbookTitle'), desc: t('tasks.empty.logbookDesc') },
  };

  const cfg = isProject
    ? { icon: Archive, title: t('tasks.empty.projectTitle'), desc: t('tasks.empty.projectDesc') }
    : config[section] ?? { icon: Inbox, title: t('tasks.noTasks'), desc: '' };

  const Icon = cfg.icon;

  return (
    <div className="task-empty-state">
      <Icon size={32} color="var(--color-text-tertiary)" strokeWidth={1.2} />
      <span className="task-empty-title">{cfg.title}</span>
      <span className="task-empty-desc">{cfg.desc}</span>
    </div>
  );
}

// ─── Utility ────────────────────────────────────────────────────────

function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || (el as HTMLElement).isContentEditable;
}
