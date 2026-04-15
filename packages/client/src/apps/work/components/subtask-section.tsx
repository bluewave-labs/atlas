import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppActions } from '../../../hooks/use-app-permissions';
import { useAuthStore } from '../../../stores/auth-store';
import { useSubtasks, useCreateSubtask, useUpdateSubtask, useDeleteSubtask } from '../hooks';
import { IconButton } from '../../../components/ui/icon-button';

export function SubtaskSection({ taskId }: { taskId: string }) {
  const { t } = useTranslation();
  const { canCreate, canEdit, canDelete, canDeleteOwn } = useAppActions('work');
  const { account } = useAuthStore();
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
    <div style={{
      padding: 'var(--spacing-md) var(--spacing-lg)',
      borderTop: '1px solid var(--color-border-secondary)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--spacing-sm)',
      }}>
        <span style={{
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-medium)',
          color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {t('tasks.subtasks.title')} {subtasks.length > 0 && `(${completedCount}/${subtasks.length})`}
        </span>
        {canCreate && (
          <IconButton
            icon={<Plus size={14} />}
            label={t('tasks.subtasks.add')}
            size={24}
            tooltip={false}
            onClick={() => setIsAdding(!isAdding)}
          />
        )}
      </div>

      {/* Progress bar */}
      {subtasks.length > 0 && (
        <div style={{
          width: '100%',
          height: 6,
          background: 'var(--color-bg-tertiary)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 'var(--spacing-sm)',
          overflow: 'hidden',
        }}>
          <div
            style={{
              height: '100%',
              background: 'var(--color-success)',
              borderRadius: 'var(--radius-sm)',
              width: `${(completedCount / subtasks.length) * 100}%`,
              transition: 'width 300ms',
            }}
          />
        </div>
      )}

      {/* Subtask list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {subtasks.map((subtask) => (
          <div key={subtask.id} className="group" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <input
              type="checkbox"
              checked={subtask.isCompleted}
              disabled={!canEdit}
              onChange={(e) => {
                if (!canEdit) return;
                updateSubtask.mutate({
                  subtaskId: subtask.id,
                  taskId,
                  isCompleted: e.target.checked,
                });
              }}
              style={{
                width: 14,
                height: 14,
                cursor: 'pointer',
                accentColor: 'var(--color-success)',
                border: '1px solid var(--color-border-primary)',
                flexShrink: 0,
              }}
            />
            <span style={{
              flex: 1,
              fontSize: 'var(--font-size-sm)',
              color: subtask.isCompleted ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
              textDecoration: subtask.isCompleted ? 'line-through' : 'none',
            }}>
              {subtask.title}
            </span>
            {(canDelete || (canDeleteOwn && subtask.userId === account?.userId)) && (
              <IconButton
                icon={<Trash2 size={12} />}
                label={t('tasks.subtasks.delete')}
                size={22}
                destructive
                tooltip={false}
                onClick={() => deleteSubtask.mutate({ subtaskId: subtask.id, taskId })}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              />
            )}
          </div>
        ))}
      </div>

      {/* Add subtask input */}
      {isAdding && canCreate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setIsAdding(false); }}
            placeholder={t('tasks.subtasks.placeholder')}
            style={{
              flex: 1,
              fontSize: 'var(--font-size-sm)',
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-primary)',
              outline: 'none',
            }}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
