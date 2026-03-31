import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { queryKeys } from '../../../config/query-keys';
import type { AppWidgetProps } from '../../../config/app-manifest.client';

interface HrWidgetData {
  employeeCount: number;
  departmentCount: number;
  onLeaveToday: number;
}

export function TeamWidget(_props: AppWidgetProps) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: queryKeys.hr.widget,
    queryFn: async () => {
      const { data: res } = await api.get('/hr/widget');
      return res.data as HrWidgetData;
    },
    staleTime: 60_000,
  });

  const employeeCount = data?.employeeCount ?? 0;
  const departmentCount = data?.departmentCount ?? 0;
  const onLeaveToday = data?.onLeaveToday ?? 0;

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
        <Users size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'rgba(255,255,255,0.5)' }}>
          {t('hr.widgetTitle', 'Team')}
        </span>
      </div>

      {/* Big number */}
      <div style={{ fontSize: 32, fontWeight: 'var(--font-weight-bold)', color: 'rgba(255,255,255,0.95)', lineHeight: 1 }}>
        {employeeCount}
      </div>

      {/* Subtitle */}
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'rgba(255,255,255,0.6)' }}>
        {departmentCount} {t('hr.widgetDepartments', 'departments')}
      </div>

      {/* On leave indicator */}
      {onLeaveToday > 0 && (
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
          {onLeaveToday} {t('hr.widgetOnLeave', 'on leave today')}
        </div>
      )}
      {onLeaveToday === 0 && (
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
          {t('hr.widgetNoLeave', 'No one on leave today')}
        </div>
      )}
    </div>
  );
}
