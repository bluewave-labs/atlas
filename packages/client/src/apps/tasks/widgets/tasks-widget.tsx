import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CheckSquare } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { queryKeys } from '../../../config/query-keys';
import type { AppWidgetProps } from '../../../config/app-manifest.client';

interface TasksWidgetData {
  dueToday: number;
  overdue: number;
  completedThisWeek: number;
  total: number;
}

export function TasksWidget(_props: AppWidgetProps) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: queryKeys.tasks.widget,
    queryFn: async () => {
      const { data: res } = await api.get('/tasks/widget');
      return res.data as TasksWidgetData;
    },
    staleTime: 60_000,
  });

  const dueToday = data?.dueToday ?? 0;
  const overdue = data?.overdue ?? 0;
  const completedThisWeek = data?.completedThisWeek ?? 0;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--spacing-lg)',
        gap: 'var(--spacing-sm)',
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
        <CheckSquare size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.5)' }}>
          {t('tasks.widgetTitle', 'Tasks')}
        </span>
      </div>

      {/* Big number */}
      <div style={{ fontSize: 32, fontWeight: 'var(--font-weight-bold)', color: 'rgba(255,255,255,0.95)', lineHeight: 1 }}>
        {dueToday}
      </div>

      {/* Subtitle */}
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.6)' }}>
        {t('tasks.widgetDueToday', 'due today')}
      </div>

      {/* Overdue + completed indicators */}
      <div style={{ display: 'flex', gap: 'var(--spacing-md)', fontSize: 10, marginTop: 2 }}>
        <span style={{ color: overdue > 0 ? '#ef4444' : 'rgba(255,255,255,0.4)' }}>
          {overdue} {t('tasks.widgetOverdue', 'overdue')}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.4)' }}>
          {completedThisWeek} {t('tasks.widgetCompleted', 'this week')}
        </span>
      </div>
    </div>
  );
}
