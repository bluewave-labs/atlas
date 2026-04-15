import { useState } from 'react';
import { ChevronRight, ChevronDown, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TaskActivity } from '@atlas-platform/shared';
import { formatRelativeDate } from '../../../lib/format';
import { useTaskActivities } from '../hooks';

export function ActivitySection({ taskId }: { taskId: string }) {
  const { t } = useTranslation();
  const { data: activities = [] } = useTaskActivities(taskId);
  const [isExpanded, setIsExpanded] = useState(false);

  if (activities.length === 0) return null;

  function formatAction(activity: TaskActivity): string {
    if (activity.action === 'created') return t('tasks.activity.created');
    if (activity.action === 'completed') return t('tasks.activity.completed');
    if (activity.action === 'updated' && activity.field) {
      return t('tasks.activity.changedField', { field: activity.field });
    }
    if (activity.action === 'subtask_added') return t('tasks.activity.subtaskAdded');
    if (activity.action === 'subtask_completed') return t('tasks.activity.subtaskCompleted');
    return activity.action;
  }

  return (
    <div style={{
      padding: 'var(--spacing-md) var(--spacing-lg)',
      borderTop: '1px solid var(--color-border-secondary)',
    }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-medium)',
          color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          cursor: 'pointer',
          background: 'none',
          border: 'none',
          padding: 0,
        }}
      >
        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Clock size={12} />
        {t('tasks.activity.title')} ({activities.length})
      </button>

      {isExpanded && (
        <div style={{
          marginTop: 'var(--spacing-sm)',
          marginLeft: 4,
          paddingLeft: 'var(--spacing-md)',
          borderLeft: '2px solid var(--color-border-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-sm)',
        }}>
          {activities.slice(0, 20).map((activity: TaskActivity) => (
            <div key={activity.id} style={{ fontSize: 'var(--font-size-xs)' }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>{formatAction(activity)}</span>
              <span style={{ color: 'var(--color-text-tertiary)', marginLeft: 6 }}>{formatRelativeDate(activity.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
