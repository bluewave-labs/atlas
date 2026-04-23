import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, Trophy, Target, TrendingUp, XCircle,
  CalendarDays, PhoneCall, Mail, StickyNote, Users as UsersIcon,
  Briefcase, Building2, Tag, AlertTriangle, RefreshCw,
  Plus, Handshake, UserPlus, FileText,
} from 'lucide-react';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { useDashboard, type CrmDashboard, type CrmDeal, type CrmActivity } from '../hooks';
import { formatCurrencyCompact, formatDate } from '../../../lib/format';
import { Skeleton } from '../../../components/ui/skeleton';
import { Chip } from '../../../components/ui/chip';
import { StatCard } from '../../../components/ui/stat-card';
import { Button } from '../../../components/ui/button';
import { QuickActions } from '../../../components/shared/quick-actions';

function getActivityIcon(type: string) {
  switch (type) {
    case 'call': return <PhoneCall size={13} />;
    case 'email': return <Mail size={13} />;
    case 'meeting': return <UsersIcon size={13} />;
    case 'stage_change': return <Target size={13} />;
    case 'deal_won': return <Trophy size={13} />;
    case 'deal_lost': return <XCircle size={13} />;
    default: return <StickyNote size={13} />;
  }
}

function getActivityLabelDash(type: string, t: (key: string) => string): string {
  switch (type) {
    case 'call': return t('crm.activities.call');
    case 'email': return t('crm.activities.email');
    case 'meeting': return t('crm.activities.meeting');
    case 'note': return t('crm.activities.note');
    case 'stage_change': return t('crm.activities.stageChange');
    case 'deal_won': return t('crm.activities.dealWon');
    case 'deal_lost': return t('crm.activities.dealLost');
    default: return type;
  }
}

function timeAgo(dateStr: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t('crm.dashboard.justNow');
  if (mins < 60) return t('crm.dashboard.minutesAgo', { count: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('crm.dashboard.hoursAgo', { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t('crm.dashboard.daysAgo', { count: days });
  return formatDate(dateStr);
}

function daysUntil(dateStr: string | null, t: (key: string, opts?: Record<string, unknown>) => string): string {
  if (!dateStr) return '--';
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return t('crm.dashboard.overdue');
  if (days === 0) return t('crm.dashboard.today');
  if (days === 1) return t('crm.dashboard.tomorrow');
  return t('crm.dashboard.daysLeft', { count: days });
}

// KPI cards use the shared StatCard component

// ─── Pipeline Bar Chart ───────────────────────────────────────────

function PipelineChart({
  valueByStage,
}: {
  valueByStage: CrmDashboard['valueByStage'];
}) {
  const { t } = useTranslation();
  const maxValue = useMemo(
    () => Math.max(...valueByStage.map((s) => s.value), 1),
    [valueByStage],
  );

  if (valueByStage.length === 0) {
    return (
      <div className="crm-dashboard-card">
        <h3 className="crm-dashboard-card-title">{t('crm.dashboard.pipelineByStage')}</h3>
        <div className="crm-dashboard-empty">{t('crm.dashboard.noActiveDeals')}</div>
      </div>
    );
  }

  return (
    <div className="crm-dashboard-card">
      <h3 className="crm-dashboard-card-title">{t('crm.dashboard.pipelineByStage')}</h3>
      <div className="crm-bar-chart">
        {valueByStage.map((stage) => (
          <div key={stage.stageId} className="crm-bar-row">
            <span className="crm-bar-label">{stage.stageName || 'Unknown'}</span>
            <div className="crm-bar-track">
              <div
                className="crm-bar"
                style={{
                  width: `${Math.max((stage.value / maxValue) * 100, 2)}%`,
                  backgroundColor: stage.stageColor || 'var(--color-accent-primary)',
                }}
              />
            </div>
            <span className="crm-bar-value">
              {formatCurrencyCompact(stage.value)}
              <span className="crm-bar-count">({stage.count} {stage.count === 1 ? t('crm.deals.deal') : t('crm.sidebar.deals').toLowerCase()})</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Recent Activities ────────────────────────────────────────────

function RecentActivities({ activities }: { activities: CrmActivity[] }) {
  const { t } = useTranslation();
  if (activities.length === 0) {
    return (
      <div className="crm-dashboard-card">
        <h3 className="crm-dashboard-card-title">{t('crm.dashboard.recentActivities')}</h3>
        <div className="crm-dashboard-empty">{t('crm.activities.noActivities')}</div>
      </div>
    );
  }

  return (
    <div className="crm-dashboard-card">
      <h3 className="crm-dashboard-card-title">{t('crm.dashboard.recentActivities')}</h3>
      <div className="crm-dashboard-activities">
        {activities.map((activity) => (
          <div key={activity.id} className="crm-activity-item">
            <div className="crm-activity-icon">
              {getActivityIcon(activity.type)}
            </div>
            <div className="crm-activity-body">
              <div className="crm-activity-text">{activity.body}</div>
              <div className="crm-activity-meta">
                {getActivityLabelDash(activity.type, t)} &middot; {timeAgo(activity.createdAt, t)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Deals Table ──────────────────────────────────────────────────

function DealsTable({
  title,
  deals,
  showCloseDate,
  storageKey,
}: {
  title: string;
  deals: CrmDeal[];
  showCloseDate?: boolean;
  storageKey: string;
}) {
  const { t } = useTranslation();

  const columns: DataTableColumn<CrmDeal>[] = [
    {
      key: 'title',
      label: t('crm.deals.deal'),
      icon: <Briefcase size={12} />,
      minWidth: 120,
      hideable: false,
      render: (deal) => (
        <span className="crm-dashboard-table-primary">{deal.title}</span>
      ),
      searchValue: (deal) => deal.title,
      compare: (a, b) => a.title.localeCompare(b.title),
    },
    {
      key: 'companyName',
      label: t('crm.deals.company'),
      icon: <Building2 size={12} />,
      minWidth: 100,
      render: (deal) => <span>{deal.companyName || '--'}</span>,
      searchValue: (deal) => deal.companyName ?? '',
      compare: (a, b) => (a.companyName ?? '').localeCompare(b.companyName ?? ''),
    },
    {
      key: 'value',
      label: t('crm.deals.value'),
      icon: <DollarSign size={12} />,
      width: 90,
      align: 'right',
      render: (deal) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrencyCompact(deal.value)}
        </span>
      ),
      compare: (a, b) => a.value - b.value,
    },
    ...(showCloseDate ? [{
      key: 'expectedCloseDate',
      label: t('crm.deals.closeDate'),
      icon: <CalendarDays size={12} />,
      width: 110,
      render: (deal: CrmDeal) => (
        <span className="crm-dashboard-close-date">
          <CalendarDays size={12} />
          {daysUntil(deal.expectedCloseDate, t)}
        </span>
      ),
      searchValue: (deal: CrmDeal) => deal.expectedCloseDate ?? '',
      compare: (a: CrmDeal, b: CrmDeal) =>
        (a.expectedCloseDate ?? '').localeCompare(b.expectedCloseDate ?? ''),
    } as DataTableColumn<CrmDeal>] : []),
    {
      key: 'stageName',
      label: t('crm.deals.stage'),
      icon: <Tag size={12} />,
      width: 110,
      render: (deal) =>
        deal.stageName ? (
          <Chip color={deal.stageColor || undefined}>{deal.stageName}</Chip>
        ) : null,
      searchValue: (deal) => deal.stageName ?? '',
    },
  ];

  return (
    <div className="crm-dashboard-card">
      <h3 className="crm-dashboard-card-title">{title}</h3>
      <DataTable
        data={deals}
        columns={columns}
        storageKey={storageKey}
        paginated={false}
        searchable={false}
        emptyTitle={t('crm.dashboard.noDealsToShow')}
        hideFooter
      />
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="crm-dashboard">
      <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ flex: 1, minWidth: 180, padding: '18px 20px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border-primary)', borderRadius: 'var(--radius-lg)' }}>
            <Skeleton width={80} height={12} />
            <Skeleton width={100} height={24} style={{ marginTop: 6 }} />
            <Skeleton width={60} height={10} style={{ marginTop: 3 }} />
          </div>
        ))}
      </div>
      <div className="crm-dashboard-grid">
        <div className="crm-dashboard-card"><Skeleton width="100%" height={200} /></div>
        <div className="crm-dashboard-card"><Skeleton width="100%" height={200} /></div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────

export function CrmDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: dashboard, isLoading, error, refetch } = useDashboard();

  const quickActions = [
    { label: t('crm.quickActions.newLead'), icon: <Plus size={13} />, onClick: () => navigate('/crm?view=leads&action=create') },
    { label: t('crm.quickActions.newDeal'), icon: <Handshake size={13} />, onClick: () => navigate('/crm?view=pipeline&action=create') },
    { label: t('crm.quickActions.newContact'), icon: <UserPlus size={13} />, onClick: () => navigate('/crm?view=contacts&action=create') },
    { label: t('crm.quickActions.newProposal'), icon: <FileText size={13} />, onClick: () => navigate('/crm?view=proposals&action=create') },
  ];

  if (error) {
    return (
      <div className="crm-dashboard" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-md)', padding: 'var(--spacing-2xl)', minHeight: 300 }}>
        <AlertTriangle size={32} style={{ color: 'var(--color-error)' }} />
        <span style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' }}>{t('crm.dashboard.loadFailed')}</span>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>{t('crm.dashboard.loadFailedDesc')}</span>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          <RefreshCw size={14} style={{ marginRight: 6 }} />
          {t('crm.dashboard.retry')}
        </Button>
      </div>
    );
  }

  if (isLoading || !dashboard) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="crm-dashboard">
      <QuickActions actions={quickActions} />
      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', flexWrap: 'wrap' }}>
        <StatCard
          label={t('crm.dashboard.totalPipeline')}
          value={formatCurrencyCompact(dashboard.totalPipelineValue)}
          subtitle={t('crm.dashboard.activeDeals', { count: dashboard.dealCount })}
          color="var(--color-accent-primary)"
          icon={DollarSign}
        />
        <StatCard
          label={t('crm.dashboard.dealsWonThisMonth')}
          value={`${dashboard.dealsWonCount}`}
          subtitle={`${formatCurrencyCompact(dashboard.dealsWonValue)} ${t('crm.dashboard.revenue')}`}
          color="var(--color-success)"
          icon={Trophy}
        />
        <StatCard
          label={t('crm.dashboard.winRate')}
          value={`${dashboard.winRate}%`}
          subtitle={`${dashboard.dealsWonCount}W / ${dashboard.dealsLostCount}L ${t('crm.dashboard.thisMonth')}`}
          color="var(--color-warning)"
          icon={Target}
        />
        <StatCard
          label={t('crm.dashboard.avgDealSize')}
          value={formatCurrencyCompact(dashboard.averageDealSize)}
          subtitle={t('crm.dashboard.acrossActiveDeals')}
          color="#6366f1"
          icon={TrendingUp}
        />
      </div>

      {/* Pipeline chart + recent activities */}
      <div className="crm-dashboard-grid">
        <PipelineChart valueByStage={dashboard.valueByStage} />
        <RecentActivities activities={dashboard.recentActivities} />
      </div>

      {/* Tables */}
      <div className="crm-dashboard-grid">
        <DealsTable
          title={t('crm.dashboard.closingSoon')}
          deals={dashboard.dealsClosingSoon}
          showCloseDate
          storageKey="crm_dashboard_closing"
        />
        <DealsTable
          title={t('crm.dashboard.topDeals')}
          deals={dashboard.topDeals}
          storageKey="crm_dashboard_top"
        />
      </div>
    </div>
  );
}
