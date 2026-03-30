import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { PenTool } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { queryKeys } from '../../../config/query-keys';
import type { AppWidgetProps } from '../../../config/app-manifest.client';

interface SignWidgetData {
  pending: number;
  signed: number;
  draft: number;
  total: number;
}

export function SignWidget(_props: AppWidgetProps) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: queryKeys.sign.widget,
    queryFn: async () => {
      const { data: res } = await api.get('/sign/widget');
      return res.data as SignWidgetData;
    },
    staleTime: 60_000,
  });

  const pending = data?.pending ?? 0;
  const signed = data?.signed ?? 0;
  const draft = data?.draft ?? 0;

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
        <PenTool size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.5)' }}>
          {t('sign.widgetTitle', 'Sign')}
        </span>
      </div>

      {/* Big number */}
      <div style={{ fontSize: 32, fontWeight: 'var(--font-weight-bold)', color: pending > 0 ? '#f59e0b' : 'rgba(255,255,255,0.95)', lineHeight: 1 }}>
        {pending}
      </div>

      {/* Subtitle */}
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.6)' }}>
        {t('sign.widgetAwaiting', 'awaiting signature')}
      </div>

      {/* Signed / Draft indicators */}
      <div style={{ display: 'flex', gap: 'var(--spacing-md)', fontSize: 10, marginTop: 2 }}>
        <span style={{ color: '#10b981' }}>
          {signed} {t('sign.widgetCompleted', 'completed')}
        </span>
        <span style={{ color: 'rgba(255,255,255,0.4)' }}>
          {draft} {t('sign.widgetDraft', 'draft')}
        </span>
      </div>
    </div>
  );
}
