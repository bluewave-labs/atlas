import { useTranslation } from 'react-i18next';
import { useSystemMetrics } from '../hooks';
import { formatBytes } from '../../../lib/format';
import type { AppWidgetProps } from '../../../config/app-manifest.client';

function gaugeColor(percent: number): string {
  if (percent >= 85) return '#ef4444';
  if (percent >= 60) return '#f59e0b';
  return '#10b981';
}

export function MemoryWidget({ width, height }: AppWidgetProps) {
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
        justifyContent: 'center',
        padding: 16,
        gap: 8,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
        {t('system.memoryUsage')}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>
        {usage.toFixed(1)}%
      </div>
      {/* Bar gauge */}
      <div style={{ height: 8, background: 'rgba(255,255,255,0.1)', borderRadius: 4, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, usage)}%`,
            background: color,
            borderRadius: 4,
            transition: 'width 0.5s ease',
          }}
        />
      </div>
      {metrics && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
          {formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)}
        </div>
      )}
    </div>
  );
}
