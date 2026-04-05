import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, X, Link2, AlertTriangle, CheckCircle2, CircleDot } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Task } from '@atlasmail/shared';
import { useTaskDependencies, useAddDependency, useRemoveDependency } from '../hooks';
import { IconButton } from '../../../components/ui/icon-button';

export function DependencySection({ taskId, allTasks }: { taskId: string; allTasks: Task[] }) {
  const { t } = useTranslation();
  const { data: dependencies = [] } = useTaskDependencies(taskId);
  const addDependency = useAddDependency();
  const removeDependency = useRemoveDependency();
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding && searchInputRef.current) searchInputRef.current.focus();
  }, [isAdding]);

  // Filter available tasks for adding as blockers
  const availableTasks = useMemo(() => {
    const existingBlockerIds = new Set(dependencies.map(d => d.blockedByTaskId));
    existingBlockerIds.add(taskId); // Can't block itself
    return allTasks
      .filter(t => !existingBlockerIds.has(t.id) && t.type !== 'heading' && !t.isArchived)
      .filter(t => !searchQuery.trim() || t.title.toLowerCase().includes(searchQuery.toLowerCase()))
      .slice(0, 10);
  }, [allTasks, dependencies, taskId, searchQuery]);

  return (
    <div style={{
      padding: 'var(--spacing-lg)',
      borderTop: '1px solid var(--color-border-secondary)',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--spacing-md)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
        }}>
          <Link2 size={13} color="var(--color-text-tertiary)" />
          <span style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 'var(--font-weight-medium)' as any,
            color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.05em',
          }}>
            {t('tasks.dependencies.title')} {dependencies.length > 0 && `(${dependencies.length})`}
          </span>
        </div>
        <IconButton
          icon={<Plus size={14} />}
          label={t('tasks.dependencies.add')}
          size={24}
          onClick={() => setIsAdding(!isAdding)}
        />
      </div>

      {dependencies.length === 0 && !isAdding && (
        <div style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-tertiary)',
          padding: 'var(--spacing-sm) 0',
        }}>
          {t('tasks.dependencies.empty')}
        </div>
      )}

      {/* Dependency list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {dependencies.map((dep) => (
          <div key={dep.id} className="group" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-bg-secondary)',
          }}>
            {dep.blockerStatus !== 'completed' ? (
              <AlertTriangle size={13} color="var(--color-warning)" style={{ flexShrink: 0 }} />
            ) : (
              <CheckCircle2 size={13} color="var(--color-success)" style={{ flexShrink: 0 }} />
            )}
            <span style={{
              flex: 1,
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-primary)',
              textDecoration: dep.blockerStatus === 'completed' ? 'line-through' : 'none',
              opacity: dep.blockerStatus === 'completed' ? 0.6 : 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {dep.blockerTitle || t('tasks.untitled')}
            </span>
            <IconButton
              icon={<X size={12} />}
              label={t('tasks.dependencies.remove')}
              size={22}
              tooltip={false}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => removeDependency.mutate({ taskId, blockerTaskId: dep.blockedByTaskId })}
            />
          </div>
        ))}
      </div>

      {/* Add blocker search */}
      {isAdding && (
        <div style={{ marginTop: 'var(--spacing-sm)' }}>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setIsAdding(false); setSearchQuery(''); } }}
            placeholder={t('tasks.dependencies.add') + '...'}
            style={{
              width: '100%',
              fontSize: 'var(--font-size-sm)',
              padding: 'var(--spacing-xs) var(--spacing-sm)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-primary)',
              outline: 'none',
              fontFamily: 'var(--font-family)',
            }}
          />
          {availableTasks.length > 0 && (
            <div style={{
              marginTop: 'var(--spacing-xs)',
              border: '1px solid var(--color-border-secondary)',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg-elevated)',
              maxHeight: 200,
              overflowY: 'auto',
            }}>
              {availableTasks.map((task) => (
                <button
                  key={task.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)',
                    width: '100%',
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-family)',
                    textAlign: 'left',
                  }}
                  className="hover-bg-surface"
                  onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-surface-hover)'; }}
                  onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  onClick={() => {
                    addDependency.mutate({ taskId, blockedByTaskId: task.id });
                    setSearchQuery('');
                    setIsAdding(false);
                  }}
                >
                  {task.status === 'completed' ? (
                    <CheckCircle2 size={12} color="var(--color-success)" />
                  ) : (
                    <CircleDot size={12} color="var(--color-text-tertiary)" />
                  )}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {task.title || t('tasks.untitled')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
