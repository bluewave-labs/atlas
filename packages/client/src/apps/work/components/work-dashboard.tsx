import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatRelativeDate, formatCurrency, formatNumber } from '../../../lib/format';
import { StatCard } from '../../../components/ui/stat-card';
import {
  Clock, FolderKanban, FileText, DollarSign, AlertCircle, Plus,
} from 'lucide-react';
import {
  useDashboard, useProjects, useCreateTimeEntry,
} from '../hooks';
import type { WorkProject } from '../hooks';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { useAppActions } from '../../../hooks/use-app-permissions';
import '../../../styles/projects.css';

// ─── Revenue Chart ───────────────────────────────────────────────────

function DashboardRevenueChart({ invoiced, paid, outstanding }: { invoiced: number; paid: number; outstanding: number }) {
  const { t } = useTranslation();
  const maxVal = Math.max(invoiced, paid, outstanding, 1);
  const bars = [
    { label: t('projects.reports.invoiced'), value: invoiced, color: '#3b82f6' },
    { label: t('projects.status.paid'), value: paid, color: '#10b981' },
    { label: t('projects.reports.outstanding'), value: outstanding, color: '#f59e0b' },
  ];

  return (
    <div className="projects-dashboard-card">
      <h3 className="projects-dashboard-card-title">{t('projects.dashboard.revenueOverview')}</h3>
      <div className="projects-bar-chart">
        {bars.map((bar) => (
          <div key={bar.label} className="projects-bar-row">
            <span className="projects-bar-label">{bar.label}</span>
            <div className="projects-bar-track">
              <div
                className="projects-bar"
                style={{ width: `${Math.max((bar.value / maxVal) * 100, 2)}%`, backgroundColor: bar.color }}
              />
            </div>
            <span className="projects-bar-value">{formatCurrency(bar.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Hours Chart ─────────────────────────────────────────────────────

function DashboardHoursChart({ hoursByDay }: { hoursByDay: Array<{ date: string; hours: number }> }) {
  const { t } = useTranslation();
  const maxHours = Math.max(...hoursByDay.map(d => d.hours), 1);
  const dayLabels = [
    t('projects.dashboard.mon'), t('projects.dashboard.tue'), t('projects.dashboard.wed'),
    t('projects.dashboard.thu'), t('projects.dashboard.fri'), t('projects.dashboard.sat'), t('projects.dashboard.sun'),
  ];

  return (
    <div className="projects-dashboard-card">
      <h3 className="projects-dashboard-card-title">{t('projects.dashboard.hoursThisWeekChart')}</h3>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--spacing-sm)', height: 120, padding: 'var(--spacing-md) var(--spacing-sm) 0' }}>
        {hoursByDay.map((day, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}>
              {day.hours > 0 ? formatNumber(day.hours, 1) : ''}
            </span>
            <div style={{
              width: '100%', maxWidth: 32, borderRadius: 'var(--radius-sm)',
              height: `${Math.max((day.hours / maxHours) * 80, day.hours > 0 ? 4 : 2)}px`,
              backgroundColor: day.hours > 0 ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
              transition: 'height 0.3s ease',
            }} />
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
              {dayLabels[i]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recent Activity ─────────────────────────────────────────────────

function DashboardRecentActivity({ recentTimeEntries, recentInvoiceActions }: {
  recentTimeEntries: Array<{ id: string; projectName: string; projectColor: string; hours: number; date: string; description: string | null; createdAt: string }>;
  recentInvoiceActions: Array<{ id: string; invoiceNumber: string; clientName: string | null; status: string; amount: number; updatedAt: string }>;
}) {
  const { t } = useTranslation();

  const combined = [
    ...recentTimeEntries.map(e => ({
      ...e,
      key: `time-${e.id}`,
      type: 'time' as const,
      date: e.createdAt,
    })),
    ...recentInvoiceActions.map(i => ({
      ...i,
      key: `inv-${i.id}`,
      type: 'invoice' as const,
      date: i.updatedAt,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 8);

  return (
    <div className="projects-dashboard-card">
      <h3 className="projects-dashboard-card-title">{t('projects.dashboard.recentActivity')}</h3>
      {combined.length === 0 ? (
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', padding: 'var(--spacing-md)' }}>
          {t('projects.reports.noData')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {combined.map((item) => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', padding: 'var(--spacing-sm) var(--spacing-md)', borderBottom: '1px solid var(--color-border-secondary)' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--color-bg-tertiary)', flexShrink: 0 }}>
                {item.type === 'time' ? <Clock size={12} style={{ color: '#f59e0b' }} /> : <FileText size={12} style={{ color: '#3b82f6' }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.type === 'time'
                    ? `${formatNumber((item as typeof recentTimeEntries[0] & { type: 'time' }).hours, 1)}h - ${(item as typeof recentTimeEntries[0] & { type: 'time' }).projectName}`
                    : `${(item as typeof recentInvoiceActions[0] & { type: 'invoice' }).invoiceNumber} - ${formatCurrency((item as typeof recentInvoiceActions[0] & { type: 'invoice' }).amount)}`
                  }
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                  {item.type === 'time'
                    ? (item as typeof recentTimeEntries[0] & { type: 'time' }).description || formatDate((item as typeof recentTimeEntries[0] & { type: 'time' }).date)
                    : `${(item as typeof recentInvoiceActions[0] & { type: 'invoice' }).clientName || ''} - ${t(`projects.status.${(item as typeof recentInvoiceActions[0] & { type: 'invoice' }).status}`)}`
                  }
                </div>
              </div>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', flexShrink: 0 }}>
                {formatRelativeDate(item.date)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Quick Time Log ──────────────────────────────────────────────────

function QuickTimeLog({ projects }: { projects: WorkProject[] }) {
  const { t } = useTranslation();
  const createTimeEntry = useCreateTimeEntry();
  const [projectId, setProjectId] = useState('');
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const todayStr = new Date().toISOString().slice(0, 10);

  const handleSubmit = () => {
    if (!projectId || !hours) return;
    createTimeEntry.mutate({
      projectId,
      date: todayStr,
      hours: parseFloat(hours) || 0,
      description: description.trim() || null,
      isBillable: true,
    }, {
      onSuccess: () => { setHours(''); setDescription(''); },
    });
  };

  return (
    <div className="projects-dashboard-card">
      <h3 className="projects-dashboard-card-title">{t('projects.dashboard.quickTimeLog')}</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: 'var(--spacing-sm) var(--spacing-md) var(--spacing-md)' }}>
        <Select
          value={projectId}
          onChange={setProjectId}
          options={[
            { value: '', label: t('projects.timeTracking.selectProject') },
            ...projects.map(p => ({ value: p.id, label: p.name })),
          ]}
          size="sm"
          width={200}
        />
        <Input
          type="number"
          step="0.25"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="0"
          size="sm"
          style={{ width: 100 }}
          aria-label={t('projects.timeTracking.hours')}
        />
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('projects.dashboard.whatDidYouWorkOn')}
          size="sm"
          style={{ flex: 1 }}
          aria-label={t('projects.dashboard.whatDidYouWorkOn')}
        />
        <Button
          variant="primary"
          size="sm"
          icon={<Plus size={13} />}
          onClick={handleSubmit}
          disabled={!projectId || !hours || createTimeEntry.isPending}
        >
          {t('projects.dashboard.logTime')}
        </Button>
      </div>
    </div>
  );
}

// ─── Work Dashboard ──────────────────────────────────────────────────

export function WorkDashboard() {
  const { t } = useTranslation();
  const { data } = useDashboard();
  const { data: projectsData } = useProjects();
  const projects = projectsData?.projects ?? [];
  const { canCreate } = useAppActions('work');

  return (
    <div style={{ overflow: 'auto', flex: 1, padding: 'var(--spacing-lg)' }}>
      <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', margin: '0 0 var(--spacing-lg) 0' }}>
        {t('work.sidebar.dashboard')}
      </h1>
      <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
        <StatCard
          label={t('projects.dashboard.hoursThisWeek')}
          value={formatNumber(data?.hoursThisWeek ?? 0, 1) + 'h'}
          subtitle={t('projects.dashboard.tracked')}
          color="#f59e0b"
          icon={Clock}
        />
        <StatCard
          label={t('projects.dashboard.activeProjects')}
          value={String(data?.activeProjects ?? 0)}
          subtitle={t('projects.dashboard.inProgress')}
          color="#8b5cf6"
          icon={FolderKanban}
        />
        <StatCard
          label={t('projects.dashboard.outstandingInvoices')}
          value={String(data?.outstandingInvoices ?? 0)}
          subtitle={formatCurrency(data?.totalOutstandingAmount ?? 0)}
          color="#3b82f6"
          icon={FileText}
        />
        <StatCard
          label={t('projects.dashboard.overdue')}
          value={String(data?.overdueInvoices ?? 0)}
          subtitle={formatCurrency(data?.totalOverdueAmount ?? 0)}
          color="var(--color-error)"
          icon={DollarSign}
        />
        <StatCard
          label={t('projects.dashboard.unbilledHours')}
          value={formatNumber(data?.unbilledHours ?? 0, 1) + 'h'}
          subtitle={t('projects.dashboard.needsInvoicing')}
          color="#ef4444"
          icon={AlertCircle}
        />
      </div>

      <div className="projects-dashboard-charts-grid">
        <DashboardRevenueChart
          invoiced={data?.revenue?.invoiced ?? 0}
          paid={data?.revenue?.paid ?? 0}
          outstanding={data?.revenue?.outstanding ?? 0}
        />
        <DashboardHoursChart hoursByDay={data?.hoursByDay ?? []} />
      </div>

      {canCreate && (
        <div style={{ marginBottom: 'var(--spacing-lg)' }}>
          <QuickTimeLog projects={projects} />
        </div>
      )}

      <DashboardRecentActivity
        recentTimeEntries={data?.recentTimeEntries ?? []}
        recentInvoiceActions={data?.recentInvoiceActions ?? []}
      />
    </div>
  );
}
