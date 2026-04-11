import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, X, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDate as formatDateGlobal } from '../../../lib/format';
import type { Task, TaskProject, RecurrenceRule, TenantUser } from '@atlas-platform/shared';
import { useUpdateTask, useDeleteTask, useUpdateTaskVisibility } from '../hooks';
import { useMyAppPermission } from '../../../hooks/use-app-permissions';
import { useAuthStore } from '../../../stores/auth-store';
import { WHEN_OPTIONS, PRIORITY_OPTIONS, RECURRENCE_OPTIONS } from '../lib/constants';
import { TaskNotesEditor } from './task-notes-editor';
import { SubtaskSection } from './subtask-section';
import { DependencySection } from './dependency-section';
import { AttachmentSection } from './attachment-section';
import { CommentSection } from './comment-section';
import { ActivitySection } from './activity-section';
import { EmojiPicker } from '../../../components/shared/emoji-picker';
import { SmartButtonBar } from '../../../components/shared/SmartButtonBar';
import { PresenceAvatars } from '../../../components/shared/presence-avatars';
import { VisibilityToggle } from '../../../components/shared/visibility-toggle';
import { Avatar } from '../../../components/ui/avatar';
import { IconButton } from '../../../components/ui/icon-button';
import { Select } from '../../../components/ui/select';
import { StatusDot } from '../../../components/ui/status-dot';

export function TaskDetailPanel({
  task,
  projects,
  members,
  allTasks,
  onClose,
}: {
  task: Task;
  projects: TaskProject[];
  members?: TenantUser[];
  allTasks: Task[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { data: tasksPerm } = useMyAppPermission('tasks');
  const canDeleteAll = !tasksPerm || tasksPerm.role === 'admin';
  const canDeleteOwn = !tasksPerm || tasksPerm.role === 'admin' || tasksPerm.role === 'editor';
  const [title, setTitle] = useState(task.title);
  const [when, setWhen] = useState(task.when);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate || '');
  const [showTaskEmoji, setShowTaskEmoji] = useState(false);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const updateVisibility = useUpdateTaskVisibility();
  const { account } = useAuthStore();
  const isOwner = task.userId === account?.userId;
  const canDelete = canDeleteAll || (canDeleteOwn && isOwner);
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
        <span className="task-detail-header-label">{t('tasks.taskDetail')}</span>
        <div className="task-detail-header-actions">
          <PresenceAvatars appId="tasks" recordId={task.id} />
          {canDelete && (
            <IconButton
              icon={<Trash2 size={14} />}
              label={t('tasks.deleteTask')}
              size={28}
              destructive
              onClick={handleDelete}
            />
          )}
          <IconButton
            icon={<X size={14} />}
            label={t('common.close')}
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
              title={t('tasks.setIcon')}
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
            placeholder={t('tasks.taskTitlePlaceholder')}
          />
        </div>

        {/* Timestamps */}
        <div className="task-detail-timestamps">
          <div className="task-detail-timestamp-text">
            {t('tasks.createdOn', { date: formatDateGlobal(task.createdAt) })}
            {task.completedAt && (
              <> · {t('tasks.completedOn', { date: formatDateGlobal(task.completedAt) })}</>
            )}
          </div>
        </div>

        {/* Metadata fields */}
        <div className="task-detail-fields">
          {/* When */}
          <div className="task-detail-field">
            <span className="task-detail-label">{t('tasks.whenLabel')}</span>
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
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="task-detail-field">
            <span className="task-detail-label">{t('tasks.priorityLabel')}</span>
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
                  {t(opt.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Due date */}
          <div className="task-detail-field">
            <span className="task-detail-label">{t('tasks.dueLabel')}</span>
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
                label={t('tasks.clearDueDate')}
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
              <span className="task-detail-label">{t('tasks.projectLabel')}</span>
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

          {/* Assignee */}
          {members && members.length > 0 && (
            <div className="task-detail-field">
              <span className="task-detail-label">{t('tasks.assignee')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Select
                  value={task.assigneeId || ''}
                  onChange={(v) => {
                    updateTask.mutate({ id: task.id, assigneeId: v || null });
                  }}
                  options={[
                    { value: '', label: t('tasks.unassigned') },
                    ...members.map(m => ({
                      value: m.userId,
                      label: m.name || m.email,
                    })),
                  ]}
                  size="sm"
                />
                {task.assigneeId && (() => {
                  const assignee = members.find(m => m.userId === task.assigneeId);
                  return assignee ? (
                    <Avatar name={assignee.name} email={assignee.email} size={22} />
                  ) : null;
                })()}
              </div>
            </div>
          )}

          {/* Visibility */}
          <div className="task-detail-field">
            <span className="task-detail-label">{t('common.visibility')}</span>
            <VisibilityToggle
              visibility={(task.visibility as 'private' | 'team') || 'private'}
              onToggle={(v) => updateVisibility.mutate({ id: task.id, visibility: v })}
              disabled={!isOwner}
            />
          </div>
        </div>

        {/* Subtasks */}
        <SubtaskSection taskId={task.id} />

        {/* Dependencies (blocked by) */}
        <DependencySection taskId={task.id} allTasks={allTasks} />

        {/* Attachments */}
        <AttachmentSection taskId={task.id} />

        {/* Rich notes editor (below details) */}
        <div style={{ paddingTop: 16 }}>
          <TaskNotesEditor
            content={task.description || task.notes || ''}
            onChange={(html) => {
              autoSave({ description: html || null });
            }}
            placeholder={t('tasks.addNotes')}
          />
        </div>

        {/* Comments */}
        <CommentSection taskId={task.id} />

        {/* Activity log */}
        <ActivitySection taskId={task.id} />
      </div>
    </div>
  );
}
