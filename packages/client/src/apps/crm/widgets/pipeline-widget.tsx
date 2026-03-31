import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { Briefcase } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { queryKeys } from '../../../config/query-keys';
import type { AppWidgetProps } from '../../../config/app-manifest.client';

interface CrmWidgetData {
  totalValue: number;
  dealCount: number;
  wonThisMonth: number;
  lostThisMonth: number;
}

function formatValue(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function PipelineWidget(_props: AppWidgetProps) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: queryKeys.crm.widget,
    queryFn: async () => {
      const { data: res } = await api.get('/crm/widget');
      return res.data as CrmWidgetData;
    },
    staleTime: 60_000,
  });

  const totalValue = data?.totalValue ?? 0;
  const dealCount = data?.dealCount ?? 0;
  const wonThisMonth = data?.wonThisMonth ?? 0;
  const lostThisMonth = data?.lostThisMonth ?? 0;

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
        <Briefcase size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'rgba(255,255,255,0.5)' }}>
          {t('crm.widgetTitle', 'Pipeline')}
        </span>
      </div>

      {/* Big number */}
      <div style={{ fontSize: 32, fontWeight: 'var(--font-weight-bold)', color: 'rgba(255,255,255,0.95)', lineHeight: 1 }}>
        {formatValue(totalValue)}
      </div>

      {/* Subtitle */}
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'rgba(255,255,255,0.6)' }}>
        {dealCount} {t('crm.widgetActiveDeals', 'active deals')}
      </div>

      {/* Won/Lost indicators */}
      <div style={{ display: 'flex', gap: 'var(--spacing-md)', fontSize: 14, marginTop: 2 }}>
        <span style={{ color: '#10b981' }}>
          {wonThisMonth} {t('crm.widgetWon', 'won')}
        </span>
        <span style={{ color: lostThisMonth > 0 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)' }}>
          {lostThisMonth} {t('crm.widgetLost', 'lost')}
        </span>
      </div>
    </div>
  );
}
