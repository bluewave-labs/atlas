import { useTranslation } from 'react-i18next';
import { MemoryStick } from 'lucide-react';
import { useSystemMetrics } from '../hooks';
import { formatBytes } from '../../../lib/format';
import type { AppWidgetProps } from '../../../config/app-manifest.client';

function gaugeColor(percent: number): string {
  if (percent >= 85) return '#ef4444';
  if (percent >= 60) return '#f59e0b';
  return '#10b981';
}

export function MemoryWidget(_props: AppWidgetProps) {
  const { t } = useTranslation();
  const { data: metrics } = useSystemMetrics();
  const usage = metrics?.memory.usagePercent ?? 0;
  const color = gaugeColor(usage);

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
        <MemoryStick size={12} style={{ color: 'rgba(255,255,255,0.5)' }} />
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'rgba(255,255,255,0.5)' }}>
          {t('system.memoryUsage')}
        </span>
      </div>

      {/* Big number — centered */}
      <div style={{ fontSize: 32, fontWeight: 'var(--font-weight-bold)', color: 'rgba(255,255,255,0.95)', lineHeight: 1 }}>
        {usage.toFixed(0)}%
      </div>

      {/* Progress bar */}
      <div style={{ width: '100%', maxWidth: 160 }}>
        <div style={{
          height: 6,
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${Math.min(100, usage)}%`,
            background: color,
            borderRadius: 'var(--radius-full)',
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* Subtitle */}
      {metrics && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>
          {formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)}
        </div>
      )}
    </div>
  );
}
