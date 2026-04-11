import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAppActions } from '../../../hooks/use-app-permissions';
import { useSubtasks, useCreateSubtask, useUpdateSubtask, useDeleteSubtask } from '../hooks';
import { IconButton } from '../../../components/ui/icon-button';

export function SubtaskSection({ taskId }: { taskId: string }) {
  const { t } = useTranslation();
  const { canDelete } = useAppActions('tasks');
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
          {t('tasks.subtasks.title')} {subtasks.length > 0 && `(${completedCount}/${subtasks.length})`}
        </span>
        <IconButton
          icon={<Plus size={14} />}
          label={t('tasks.subtasks.add')}
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
            {canDelete && (
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
      {isAdding && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setIsAdding(false); }}
            placeholder={t('tasks.subtasks.placeholder')}
            className="flex-1 text-sm px-2 py-1 border border-gray-200 rounded focus:outline-none focus:border-blue-400"
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
