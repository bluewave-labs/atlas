import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download } from 'lucide-react';
import {
  useTimeReport, useRevenueReport, useProfitabilityReport, useUtilizationReport,
} from '../hooks';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Badge } from '../../../components/ui/badge';
import { ColumnHeader } from '../../../components/ui/column-header';
import { formatCurrency, formatNumber } from '../../../lib/format';

// ─── CSV Export ───────────────────────────────────────────────────

function exportCsv(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Date helpers ─────────────────────────────────────────────────

function getDefaultStartDate(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

function getDefaultEndDate(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Time Report Tab ──────────────────────────────────────────────

function TimeReportTab() {
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(getDefaultEndDate);
  const [groupBy, setGroupBy] = useState('project');

  const { data } = useTimeReport({ startDate, endDate, groupBy });
  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const maxHours = useMemo(() => Math.max(...entries.map((e) => e.hours), 1), [entries]);

  const handleExport = () => {
    const rows = [
      [t('projects.reports.name'), t('projects.reports.hours')],
      ...entries.map((e) => [e.label, String(e.hours)]),
      [t('projects.timeTracking.total'), String(total)],
    ];
    exportCsv(rows, `time-report-${startDate}-${endDate}`);
  };

  return (
    <div style={{ padding: 'var(--spacing-lg)', overflow: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <Input label={t('projects.invoices.from')} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} size="sm" style={{ width: 160 }} />
        <Input label={t('projects.invoices.to')} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} size="sm" style={{ width: 160 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
          <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
            {t('projects.reports.groupBy')}
          </label>
          <Select
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { value: 'project', label: t('projects.reports.byProject') },
              { value: 'member', label: t('projects.reports.byMember') },
            ]}
            size="sm"
          />
        </div>
        <Button variant="ghost" size="sm" icon={<Download size={13} />} onClick={handleExport}>
          {t('projects.reports.exportCsv')}
        </Button>
      </div>

      {/* Bar chart */}
      <div className="projects-dashboard-card" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <h3 className="projects-dashboard-card-title">{t('projects.reports.hoursBreakdown')}</h3>
        {entries.length === 0 ? (
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', padding: 'var(--spacing-md)' }}>
            {t('projects.reports.noData')}
          </div>
        ) : (
          <div className="projects-bar-chart">
            {entries.map((entry, i) => (
              <div key={i} className="projects-bar-row">
                <span className="projects-bar-label">{entry.label}</span>
                <div className="projects-bar-track">
                  <div
                    className="projects-bar"
                    style={{
                      width: `${Math.max((entry.hours / maxHours) * 100, 2)}%`,
                      backgroundColor: entry.color,
                    }}
                  />
                </div>
                <span className="projects-bar-value">{formatNumber(entry.hours, 1)}h</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Table breakdown */}
      <div className="projects-dashboard-card">
        <h3 className="projects-dashboard-card-title">{t('projects.reports.detailed')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', padding: 'var(--spacing-sm) var(--spacing-md)', borderBottom: '1px solid var(--color-border-secondary)' }}>
            <ColumnHeader label={t('projects.reports.name')} style={{ flex: 1 }} />
            <ColumnHeader label={t('projects.reports.hours')} style={{ width: 100, textAlign: 'right' }} />
          </div>
          {entries.map((entry, i) => (
            <div key={i} style={{ display: 'flex', padding: 'var(--spacing-sm) var(--spacing-md)', borderBottom: '1px solid var(--color-border-secondary)' }}>
              <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
                {entry.label}
              </span>
              <span style={{ width: 100, textAlign: 'right', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}>
                {formatNumber(entry.hours, 1)}h
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', padding: 'var(--spacing-sm) var(--spacing-md)', fontWeight: 'var(--font-weight-semibold)' as React.CSSProperties['fontWeight'] }}>
            <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
              {t('projects.timeTracking.total')}
            </span>
            <span style={{ width: 100, textAlign: 'right', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}>
              {formatNumber(total, 1)}h
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Revenue Report Tab ───────────────────────────────────────────

function RevenueReportTab() {
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(getDefaultEndDate);

  const { data } = useRevenueReport({ startDate, endDate });
  const byClient = data?.byClient ?? [];
  const maxClientVal = useMemo(() => Math.max(...byClient.map(c => Math.max(c.invoiced, c.outstanding)), 1), [byClient]);

  return (
    <div style={{ padding: 'var(--spacing-lg)', overflow: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <Input label={t('projects.invoices.from')} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} size="sm" style={{ width: 160 }} />
        <Input label={t('projects.invoices.to')} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} size="sm" style={{ width: 160 }} />
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <div className="projects-kpi-card">
          <div className="projects-kpi-card-content">
            <span className="projects-kpi-card-label">{t('projects.reports.invoiced')}</span>
            <span className="projects-kpi-card-value">{formatCurrency(data?.invoiced ?? 0)}</span>
          </div>
        </div>
        <div className="projects-kpi-card">
          <div className="projects-kpi-card-content">
            <span className="projects-kpi-card-label">{t('projects.reports.outstanding')}</span>
            <span className="projects-kpi-card-value">{formatCurrency(data?.outstanding ?? 0)}</span>
          </div>
        </div>
        <div className="projects-kpi-card">
          <div className="projects-kpi-card-content">
            <span className="projects-kpi-card-label">{t('projects.reports.overdue')}</span>
            <span className="projects-kpi-card-value" style={{ color: 'var(--color-error)' }}>{formatCurrency(data?.overdue ?? 0)}</span>
          </div>
        </div>
      </div>

      {/* Stacked bar chart: Invoiced vs Outstanding per client */}
      {byClient.length > 0 && (
        <div className="projects-dashboard-card" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h3 className="projects-dashboard-card-title">{t('projects.reports.revenueByClient')}</h3>
          <div className="projects-bar-chart">
            {byClient.map((row) => (
              <div key={row.clientId} className="projects-bar-row">
                <span className="projects-bar-label">{row.clientName}</span>
                <div className="projects-bar-track" style={{ position: 'relative' }}>
                  <div
                    className="projects-bar"
                    style={{ width: `${Math.max((row.invoiced / maxClientVal) * 100, 2)}%`, backgroundColor: '#3b82f6', position: 'relative', zIndex: 1 }}
                  />
                  {row.outstanding > 0 && (
                    <div
                      style={{
                        position: 'absolute', top: 0, left: `${(row.invoiced / maxClientVal) * 100}%`,
                        width: `${Math.max((row.outstanding / maxClientVal) * 100, 2)}%`,
                        height: '100%', backgroundColor: '#f59e0b', borderRadius: '0 4px 4px 0',
                      }}
                    />
                  )}
                </div>
                <span className="projects-bar-value">{formatCurrency(row.invoiced)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-lg)', padding: 'var(--spacing-sm) var(--spacing-md) 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#3b82f6' }} />
              {t('projects.reports.invoiced')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#f59e0b' }} />
              {t('projects.reports.outstanding')}
            </span>
          </div>
        </div>
      )}

      {/* By client table */}
      <div className="projects-dashboard-card">
        <h3 className="projects-dashboard-card-title">{t('projects.reports.revenueByClient')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', padding: 'var(--spacing-sm) var(--spacing-md)', borderBottom: '1px solid var(--color-border-secondary)' }}>
            <ColumnHeader label={t('projects.clients.name')} style={{ flex: 1 }} />
            <ColumnHeader label={t('projects.reports.invoiced')} style={{ width: 120, textAlign: 'right' }} />
            <ColumnHeader label={t('projects.reports.outstanding')} style={{ width: 120, textAlign: 'right' }} />
          </div>
          {byClient.map((row) => (
            <div key={row.clientId} style={{ display: 'flex', padding: 'var(--spacing-sm) var(--spacing-md)', borderBottom: '1px solid var(--color-border-secondary)' }}>
              <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {row.clientName}
              </span>
              <span style={{ width: 120, textAlign: 'right', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(row.invoiced)}
              </span>
              <span style={{ width: 120, textAlign: 'right', fontSize: 'var(--font-size-sm)', color: row.outstanding > 0 ? 'var(--color-warning)' : 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(row.outstanding)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Profitability Report Tab ─────────────────────────────────────

function ProfitabilityReportTab() {
  const { t } = useTranslation();
  const { data } = useProfitabilityReport();
  const projects = data?.projects ?? [];
  const maxVal = useMemo(() => Math.max(...projects.map(p => Math.max(p.revenue, p.cost)), 1), [projects]);

  return (
    <div style={{ padding: 'var(--spacing-lg)', overflow: 'auto', flex: 1 }}>
      {/* Revenue vs Cost chart */}
      {projects.length > 0 && (
        <div className="projects-dashboard-card" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <h3 className="projects-dashboard-card-title">{t('projects.reports.revenueVsCost')}</h3>
          <div className="projects-bar-chart">
            {projects.map((row) => (
              <div key={row.projectId} className="projects-bar-row">
                <span className="projects-bar-label">{row.projectName}</span>
                <div className="projects-bar-track" style={{ position: 'relative' }}>
                  <div
                    className="projects-bar"
                    style={{ width: `${Math.max((row.revenue / maxVal) * 100, 2)}%`, backgroundColor: '#10b981' }}
                  />
                  <div
                    style={{
                      position: 'absolute', top: 0, left: 0,
                      width: `${Math.max((row.cost / maxVal) * 100, 2)}%`,
                      height: '100%', backgroundColor: '#ef4444', opacity: 0.4, borderRadius: 4,
                    }}
                  />
                </div>
                <span className="projects-bar-value">
                  <Badge variant={row.margin >= 0 ? 'success' : 'error'}>
                    {formatNumber(row.margin, 0)}%
                  </Badge>
                </span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-lg)', padding: 'var(--spacing-sm) var(--spacing-md) 0', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#10b981' }} />
              {t('projects.reports.revenue')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: '#ef4444', opacity: 0.6 }} />
              {t('projects.reports.cost')}
            </span>
          </div>
        </div>
      )}

      {/* Table breakdown */}
      <div className="projects-dashboard-card">
        <h3 className="projects-dashboard-card-title">{t('projects.reports.profitability')}</h3>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', padding: 'var(--spacing-sm) var(--spacing-md)', borderBottom: '1px solid var(--color-border-secondary)' }}>
            <ColumnHeader label={t('projects.sidebar.projects')} style={{ flex: 1 }} />
            <ColumnHeader label={t('projects.reports.hours')} style={{ width: 80, textAlign: 'right' }} />
            <ColumnHeader label={t('projects.reports.cost')} style={{ width: 100, textAlign: 'right' }} />
            <ColumnHeader label={t('projects.reports.revenue')} style={{ width: 100, textAlign: 'right' }} />
            <ColumnHeader label={t('projects.reports.margin')} style={{ width: 80, textAlign: 'right' }} />
          </div>
          {projects.map((row) => (
            <div key={row.projectId} style={{ display: 'flex', padding: 'var(--spacing-sm) var(--spacing-md)', borderBottom: '1px solid var(--color-border-secondary)' }}>
              <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {row.projectName}
              </span>
              <span style={{ width: 80, textAlign: 'right', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}>
                {formatNumber(row.hours, 1)}h
              </span>
              <span style={{ width: 100, textAlign: 'right', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(row.cost)}
              </span>
              <span style={{ width: 100, textAlign: 'right', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(row.revenue)}
              </span>
              <span style={{ width: 80, textAlign: 'right', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}>
                <Badge variant={row.margin >= 0 ? 'success' : 'error'}>
                  {formatNumber(row.margin, 1)}%
                </Badge>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Utilization Report Tab ───────────────────────────────────────

function UtilizationReportTab() {
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState(getDefaultStartDate);
  const [endDate, setEndDate] = useState(getDefaultEndDate);

  const { data } = useUtilizationReport({ startDate, endDate });
  const members = data?.members ?? [];
  const maxHours = useMemo(() => Math.max(...members.map((m) => m.hoursLogged), 1), [members]);

  return (
    <div style={{ padding: 'var(--spacing-lg)', overflow: 'auto', flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <Input label={t('projects.invoices.from')} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} size="sm" style={{ width: 160 }} />
        <Input label={t('projects.invoices.to')} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} size="sm" style={{ width: 160 }} />
      </div>

      <div className="projects-dashboard-card">
        <h3 className="projects-dashboard-card-title">{t('projects.reports.utilization')}</h3>
        {members.length === 0 ? (
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', padding: 'var(--spacing-md)' }}>
            {t('projects.reports.noData')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            {members.map((member) => (
              <div key={member.userId} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                    {member.userName}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                      {formatNumber(member.hoursLogged, 1)}h / {member.capacity}h
                    </span>
                    <Badge variant={member.utilization >= 80 ? 'success' : member.utilization >= 50 ? 'warning' : 'error'}>
                      {formatNumber(member.utilization, 0)}%
                    </Badge>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                      {t('projects.reports.billable')}: {formatNumber(member.billableRatio, 0)}%
                    </span>
                  </div>
                </div>
                <div style={{ height: 8, background: 'var(--color-bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(member.utilization, 100)}%`,
                      background: member.utilization >= 80 ? 'var(--color-success)' : member.utilization >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
                      borderRadius: 4,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Reports View ─────────────────────────────────────────────────

type ReportTab = 'time' | 'revenue' | 'profitability' | 'utilization';

export function ReportsView() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<ReportTab>('time');

  const tabs: Array<{ id: ReportTab; label: string }> = [
    { id: 'time', label: t('projects.reports.time') },
    { id: 'revenue', label: t('projects.reports.revenue') },
    { id: 'profitability', label: t('projects.reports.profitability') },
    { id: 'utilization', label: t('projects.reports.utilization') },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div className="projects-report-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`projects-report-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'time' && <TimeReportTab />}
      {activeTab === 'revenue' && <RevenueReportTab />}
      {activeTab === 'profitability' && <ProfitabilityReportTab />}
      {activeTab === 'utilization' && <UtilizationReportTab />}
    </div>
  );
}
