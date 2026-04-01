import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, DollarSign, Trophy } from 'lucide-react';
import { useForecast, type CrmForecast } from '../hooks';
import { formatCurrencyCompact } from '../../../lib/format';
import { Skeleton } from '../../../components/ui/skeleton';
import { StatCard } from '../../../components/ui/stat-card';

function ForecastSkeleton() {
  return (
    <div style={{ padding: 'var(--spacing-xl)' }}>
      <div style={{ display: 'flex', gap: 'var(--spacing-lg)', marginBottom: 'var(--spacing-xl)' }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} width={200} height={80} style={{ borderRadius: 'var(--radius-md)' }} />
        ))}
      </div>
      <Skeleton width="100%" height={300} style={{ borderRadius: 'var(--radius-md)' }} />
    </div>
  );
}

export function ForecastView() {
  const { t } = useTranslation();
  const { data: forecast, isLoading } = useForecast();

  const maxValue = useMemo(() => {
    if (!forecast) return 1;
    return Math.max(...forecast.months.map((m) => m.weightedValue), 1);
  }, [forecast]);

  if (isLoading || !forecast) return <ForecastSkeleton />;

  return (
    <div style={{ padding: 'var(--spacing-xl)', maxWidth: 900 }}>
      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xl)', flexWrap: 'wrap' }}>
        <StatCard
          label={t('crm.forecast.weightedForecast')}
          value={formatCurrencyCompact(forecast.totalWeighted)}
          color="var(--color-accent-primary)"
          icon={TrendingUp}
        />
        <StatCard
          label={t('crm.forecast.bestCase')}
          value={formatCurrencyCompact(forecast.bestCase)}
          color="#3b82f6"
          icon={DollarSign}
        />
        <StatCard
          label={t('crm.forecast.committed')}
          value={formatCurrencyCompact(forecast.committed)}
          color="var(--color-success)"
          icon={Trophy}
        />
      </div>

      {/* Monthly bar chart */}
      <div className="crm-dashboard-card">
        <h3 className="crm-dashboard-card-title">{t('crm.forecast.monthlyForecast')}</h3>
        <div className="crm-bar-chart">
          {forecast.months.map((month) => (
            <div key={month.month} className="crm-bar-row">
              <span className="crm-bar-label" style={{ minWidth: 80 }}>{month.month}</span>
              <div className="crm-bar-track">
                <div
                  className="crm-bar"
                  style={{
                    width: `${Math.max((month.weightedValue / maxValue) * 100, 2)}%`,
                    backgroundColor: 'var(--color-accent-primary)',
                  }}
                />
              </div>
              <span className="crm-bar-value">{formatCurrencyCompact(month.weightedValue)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
