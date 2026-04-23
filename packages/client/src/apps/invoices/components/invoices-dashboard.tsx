import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useInvoicesDashboard } from '../hooks';
import { formatCurrency } from '../../../lib/format';
import { Skeleton } from '../../../components/ui/skeleton';
import { QueryErrorState } from '../../../components/ui/query-error-state';
import { QuickActions } from '../../../components/shared/quick-actions';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';

// ─── Helpers ──────────────────────────────────────────────────────

function formatMonthLabel(month: string): string {
  const [year, m] = month.split('-');
  const date = new Date(Number(year), Number(m) - 1);
  return date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────

export function InvoicesDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useInvoicesDashboard();

  const quickActions = [
    { label: t('invoices.quickActions.newInvoice'), icon: <Plus size={13} />, onClick: () => navigate('/invoices?view=invoices&action=create') },
  ];

  if (isError) {
    return (
      <div style={{ padding: 'var(--spacing-xl)' }}>
        <QueryErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div style={{ padding: 'var(--spacing-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
        <Skeleton height={180} />
        <Skeleton height={320} />
        <Skeleton height={220} />
      </div>
    );
  }

  const { receivables, monthlyActivity, periodSummary, defaultCurrency, excludedCurrencyCount } = data;

  return (
    <div style={{ padding: 'var(--spacing-xl)', overflow: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)', maxWidth: 960 }}>
        <QuickActions actions={quickActions} />
        {excludedCurrencyCount > 0 && (
          <div
            style={{
              padding: 'var(--spacing-md) var(--spacing-lg)',
              background: 'color-mix(in srgb, var(--color-warning) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-warning) 40%, transparent)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-family)',
            }}
          >
            {t('invoices.dashboard.multiCurrencyNotice', { currency: defaultCurrency, count: excludedCurrencyCount })}
          </div>
        )}
        <ReceivablesSection receivables={receivables} t={t} />
        <ActivitySection monthlyActivity={monthlyActivity} t={t} />
        <PeriodSummarySection periodSummary={periodSummary} t={t} />
      </div>
    </div>
  );
}

// ─── Total Receivables ──────────────────────────────────────────

interface ReceivablesProps {
  receivables: {
    total: number;
    current: number;
    overdue1to15: number;
    overdue16to30: number;
    overdue31to45: number;
    overdue45plus: number;
  };
  t: (key: string) => string;
}

const BUCKET_COLORS = ['#22c55e', '#f97316', '#ef4444', '#dc2626', '#991b1b'] as const;

function ReceivablesSection({ receivables, t }: ReceivablesProps) {
  const buckets = [
    { label: t('invoices.dashboard.current'), amount: receivables.current, color: BUCKET_COLORS[0] },
    { label: t('invoices.dashboard.days1to15'), amount: receivables.overdue1to15, color: BUCKET_COLORS[1] },
    { label: t('invoices.dashboard.days16to30'), amount: receivables.overdue16to30, color: BUCKET_COLORS[2] },
    { label: t('invoices.dashboard.days31to45'), amount: receivables.overdue31to45, color: BUCKET_COLORS[3] },
    { label: t('invoices.dashboard.days45plus'), amount: receivables.overdue45plus, color: BUCKET_COLORS[4] },
  ];

  const total = receivables.total || 1; // avoid division by zero

  return (
    <div style={{
      background: 'var(--color-bg-elevated)',
      border: '1px solid var(--color-border-secondary)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--spacing-xl)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--spacing-lg)' }}>
        <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
          {t('invoices.dashboard.totalReceivables')}
        </span>
        <span style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)' }}>
          {formatCurrency(receivables.total)}
        </span>
      </div>

      {/* Stacked bar */}
      <div style={{
        display: 'flex',
        height: 12,
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        marginBottom: 'var(--spacing-lg)',
        background: 'var(--color-bg-tertiary)',
      }}>
        {buckets.map((b, i) => {
          const pct = (b.amount / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={i}
              style={{
                width: `${pct}%`,
                backgroundColor: b.color,
                minWidth: pct > 0 ? 2 : 0,
              }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
        {buckets.map((b, i) => (
          <div key={i} style={{ flex: '1 1 120px', minWidth: 120 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', marginBottom: 2 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: b.color, flexShrink: 0 }} />
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>{b.label}</span>
            </div>
            <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
              {formatCurrency(b.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Invoice Activity ───────────────────────────────────────────

interface ActivityProps {
  monthlyActivity: Array<{ month: string; invoiced: number; paid: number }>;
  t: (key: string) => string;
}

function ActivitySection({ monthlyActivity, t }: ActivityProps) {
  const { maxValue, ticks, totalInvoiced, totalPaid } = useMemo(() => {
    let max = 0;
    let sumInvoiced = 0;
    let sumPaid = 0;
    for (const m of monthlyActivity) {
      if (m.invoiced > max) max = m.invoiced;
      if (m.paid > max) max = m.paid;
      sumInvoiced += m.invoiced;
      sumPaid += m.paid;
    }
    // Round max up for nice ticks
    const roundedMax = max <= 0 ? 1000 : Math.ceil(max / 1000) * 1000;
    const step = roundedMax / 4;
    const tickValues = [0, step, step * 2, step * 3, roundedMax];
    return { maxValue: roundedMax, ticks: tickValues, totalInvoiced: sumInvoiced, totalPaid: sumPaid };
  }, [monthlyActivity]);

  const chartHeight = 200;

  return (
    <div style={{
      background: 'var(--color-bg-elevated)',
      border: '1px solid var(--color-border-secondary)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--spacing-xl)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 'var(--spacing-xl)' }}>
        <div>
          <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
            {t('invoices.dashboard.invoiceActivity')}
          </span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginLeft: 'var(--spacing-sm)' }}>
            {t('invoices.dashboard.last12Months')}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 'var(--spacing-xl)' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {t('invoices.dashboard.totalInvoiced')}
            </div>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: '#3b82f6' }}>
              {formatCurrency(totalInvoiced)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
              {t('invoices.dashboard.totalPaid')}
            </div>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: '#22c55e' }}>
              {formatCurrency(totalPaid)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
        {/* Y-axis */}
        <div style={{
          display: 'flex',
          flexDirection: 'column-reverse',
          justifyContent: 'space-between',
          height: chartHeight,
          width: 60,
          flexShrink: 0,
        }}>
          {ticks.map((tick, i) => (
            <span
              key={i}
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-tertiary)',
                textAlign: 'right',
                lineHeight: '1',
              }}
            >
              {formatCurrency(tick)}
            </span>
          ))}
        </div>

        {/* Bars */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 2,
            height: chartHeight,
            borderBottom: '1px solid var(--color-border-secondary)',
          }}>
            {monthlyActivity.map((m, i) => {
              const invoicedHeight = (m.invoiced / maxValue) * 100;
              const paidHeight = (m.paid / maxValue) * 100;
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    gap: 2,
                    height: '100%',
                  }}
                >
                  <div
                    style={{
                      width: '35%',
                      height: `${invoicedHeight}%`,
                      backgroundColor: '#3b82f6',
                      borderRadius: '2px 2px 0 0',
                      minHeight: m.invoiced > 0 ? 2 : 0,
                    }}
                    title={`${t('invoices.dashboard.invoiced')}: ${formatCurrency(m.invoiced)}`}
                  />
                  <div
                    style={{
                      width: '35%',
                      height: `${paidHeight}%`,
                      backgroundColor: '#22c55e',
                      borderRadius: '2px 2px 0 0',
                      minHeight: m.paid > 0 ? 2 : 0,
                    }}
                    title={`${t('invoices.dashboard.received')}: ${formatCurrency(m.paid)}`}
                  />
                </div>
              );
            })}
          </div>

          {/* X-axis labels */}
          <div style={{ display: 'flex', gap: 2, marginTop: 'var(--spacing-xs)' }}>
            {monthlyActivity.map((m, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  fontSize: 10,
                  color: 'var(--color-text-tertiary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatMonthLabel(m.month)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#3b82f6' }} />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            {t('invoices.dashboard.invoiced')}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#22c55e' }} />
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            {t('invoices.dashboard.received')}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Period Summary Table ───────────────────────────────────────

interface PeriodSummaryProps {
  periodSummary: {
    today: { invoiced: number; received: number; due: number };
    thisWeek: { invoiced: number; received: number; due: number };
    thisMonth: { invoiced: number; received: number; due: number };
    thisQuarter: { invoiced: number; received: number; due: number };
    thisYear: { invoiced: number; received: number; due: number };
  };
  t: (key: string) => string;
}

interface PeriodRow {
  id: string;
  label: string;
  invoiced: number;
  received: number;
  due: number;
}

function PeriodSummarySection({ periodSummary, t }: PeriodSummaryProps) {
  const rows: PeriodRow[] = [
    { id: 'today', label: t('invoices.dashboard.today'), ...periodSummary.today },
    { id: 'thisWeek', label: t('invoices.dashboard.thisWeek'), ...periodSummary.thisWeek },
    { id: 'thisMonth', label: t('invoices.dashboard.thisMonth'), ...periodSummary.thisMonth },
    { id: 'thisQuarter', label: t('invoices.dashboard.thisQuarter'), ...periodSummary.thisQuarter },
    { id: 'thisYear', label: t('invoices.dashboard.thisYear'), ...periodSummary.thisYear },
  ];

  const columns: DataTableColumn<PeriodRow>[] = [
    {
      key: 'label',
      label: t('invoices.dashboard.period'),
      hideable: false,
      minWidth: 120,
      render: (row) => (
        <span style={{ fontWeight: 'var(--font-weight-medium)' as never, color: 'var(--color-text-primary)' }}>
          {row.label}
        </span>
      ),
    },
    {
      key: 'invoiced',
      label: t('invoices.dashboard.invoiced'),
      width: 130,
      align: 'right',
      render: (row) => (
        <span style={{ color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(row.invoiced)}
        </span>
      ),
    },
    {
      key: 'received',
      label: t('invoices.dashboard.received'),
      width: 130,
      align: 'right',
      render: (row) => (
        <span style={{ color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(row.received)}
        </span>
      ),
    },
    {
      key: 'due',
      label: t('invoices.dashboard.due'),
      width: 130,
      align: 'right',
      render: (row) => (
        <span style={{ color: 'var(--color-accent-primary)', fontWeight: 'var(--font-weight-semibold)' as never, fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(row.due)}
        </span>
      ),
    },
  ];

  return (
    <div style={{
      background: 'var(--color-bg-elevated)',
      border: '1px solid var(--color-border-secondary)',
      borderRadius: 'var(--radius-lg)',
      overflow: 'hidden',
    }}>
      <div style={{ padding: 'var(--spacing-lg) var(--spacing-xl)', borderBottom: '1px solid var(--color-border-secondary)' }}>
        <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
          {t('invoices.dashboard.salesReceiptsDues')}
        </span>
      </div>
      <DataTable
        data={rows}
        columns={columns}
        storageKey="invoices_sales_receipts_dues"
        paginated={false}
        searchable={false}
        hideFooter
      />
    </div>
  );
}
