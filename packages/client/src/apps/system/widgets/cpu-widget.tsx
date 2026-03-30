import { useTranslation } from 'react-i18next';
import { useSystemMetrics } from '../hooks';
import type { AppWidgetProps } from '../../../config/app-manifest.client';

function gaugeColor(percent: number): string {
  if (percent >= 85) return '#ef4444';
  if (percent >= 60) return '#f59e0b';
  return '#10b981';
}

export function CpuWidget({ width, height }: AppWidgetProps) {
  const { t } = useTranslation();
  const { data: metrics } = useSystemMetrics();
  const usage = metrics?.cpu.usage ?? 0;
  const color = gaugeColor(usage);
  const size = Math.min(width, height) * 0.5;
  const strokeWidth = 6;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 12,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: '50%',
          background: `conic-gradient(${color} ${usage * 3.6}deg, rgba(255,255,255,0.1) 0deg)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: size - strokeWidth * 2,
            height: size - strokeWidth * 2,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 700, color }}>
            {usage.toFixed(0)}%
          </span>
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
        {t('system.cpuUsage')}
      </div>
      {metrics && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
          {metrics.cpu.cores} {t('system.cores')}
        </div>
      )}
    </div>
  );
}
