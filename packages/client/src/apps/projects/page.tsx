import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDate, formatRelativeDate, formatCurrency, formatNumber } from '../../lib/format';
import { StatCard } from '../../components/ui/stat-card';
import {
  LayoutDashboard, Clock, FolderKanban, Users, FileText, BarChart3, Settings2,
  Plus, Search, X, Trash2, Copy, ExternalLink,
  DollarSign, Calendar, Mail, Phone, MapPin, Hash, Percent, Activity,
  AlertCircle, Pencil, Check, Send, CheckCircle2,
} from 'lucide-react';
import {
  useDashboard,
  useProjects, useCreateProject, useUpdateProject, useDeleteProject,
  useClients, useCreateClient, useUpdateClient, useDeleteClient,
  useInvoices, useCreateInvoice, useUpdateInvoice, useDeleteInvoice,
  useSendInvoice, useMarkInvoicePaid, useWaiveInvoice, useDuplicateInvoice,
  useProjectSettings, useUpdateProjectSettings,
  useTimeEntries, useCreateTimeEntry, useUpdateTimeEntry, useDeleteTimeEntry,
  type Project, type ProjectClient, type Invoice, type TimeEntry,
  getInvoiceStatusVariant,
} from './hooks';
import { TimeTracker } from './components/time-tracker';
import { ReportsView } from './components/reports-view';
import { InvoiceBuilder } from './components/invoice-builder';
import { AppSidebar, SidebarSection, SidebarItem } from '../../components/layout/app-sidebar';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { Modal } from '../../components/ui/modal';
import { IconButton } from '../../components/ui/icon-button';
import { Badge } from '../../components/ui/badge';
import { DataTable, type DataTableColumn } from '../../components/ui/data-table';
import { FeatureEmptyState } from '../../components/ui/feature-empty-state';
import { StatusDot } from '../../components/ui/status-dot';
import { ContentArea } from '../../components/ui/content-area';
import { SmartButtonBar } from '../../components/shared/SmartButtonBar';
import { CustomFieldsRenderer } from '../../components/shared/custom-fields-renderer';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { SettingsSection, SettingsRow } from '../../components/settings/settings-primitives';
import { useUIStore } from '../../stores/ui-store';
import { useToastStore } from '../../stores/toast-store';
import '../../styles/projects.css';

// ─── Types ────────────────────────────────────────────────────────

type ActiveView = 'dashboard' | 'timeTracking' | 'projects' | 'clients' | 'invoices' | 'reports' | 'settings';

// ─── Status helpers ───────────────────────────────────────────────

function getProjectStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'var(--color-success)';
    case 'paused': return 'var(--color-warning)';
    case 'completed': return 'var(--color-accent-primary)';
    case 'archived': return 'var(--color-text-tertiary)';
    default: return 'var(--color-text-tertiary)';
  }
}

// KPI cards use the shared StatCard component from components/ui/stat-card.tsx

// ─── Dashboard View ───────────────────────────────────────────────

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

function QuickTimeLog({ projects }: { projects: Project[] }) {
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
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--spacing-sm)', padding: 'var(--spacing-sm) var(--spacing-md) var(--spacing-md)' }}>
        <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
          <label style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
            {t('projects.timeTracking.project')}
          </label>
          <Select
            value={projectId}
            onChange={setProjectId}
            options={[
              { value: '', label: t('projects.timeTracking.selectProject') },
              ...projects.map(p => ({ value: p.id, label: p.name })),
            ]}
            size="sm"
          />
        </div>
        <Input
          label={t('projects.reports.hours')}
          type="number"
          step="0.25"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="0"
          size="sm"
          style={{ width: 70 }}
        />
        <Input
          label={t('projects.invoices.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('projects.dashboard.whatDidYouWorkOn')}
          size="sm"
          style={{ flex: 2 }}
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

function DashboardView() {
  const { t } = useTranslation();
  const { data } = useDashboard();
  const { data: projectsData } = useProjects();
  const projects = projectsData?.projects ?? [];

  return (
    <div style={{ overflow: 'auto', flex: 1, padding: 'var(--spacing-lg)' }}>
      {/* KPI Cards — responsive grid */}
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

      {/* Charts — responsive grid */}
      <div className="projects-dashboard-charts-grid">
        <DashboardRevenueChart
          invoiced={data?.revenue?.invoiced ?? 0}
          paid={data?.revenue?.paid ?? 0}
          outstanding={data?.revenue?.outstanding ?? 0}
        />
        <DashboardHoursChart hoursByDay={data?.hoursByDay ?? []} />
      </div>

      {/* Quick time log */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <QuickTimeLog projects={projects} />
      </div>

      {/* Recent activity */}
      <DashboardRecentActivity
        recentTimeEntries={data?.recentTimeEntries ?? []}
        recentInvoiceActions={data?.recentInvoiceActions ?? []}
      />
    </div>
  );
}

// ─── Create Project Modal ─────────────────────────────────────────

function CreateProjectModal({ open, onClose, clients }: {
  open: boolean;
  onClose: () => void;
  clients: ProjectClient[];
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [budgetHours, setBudgetHours] = useState('');
  const [description, setDescription] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const createProject = useCreateProject();

  const reset = () => { setName(''); setClientId(''); setHourlyRate(''); setBudgetHours(''); setDescription(''); setIsBillable(true); };

  const handleSubmit = () => {
    if (!name.trim()) return;
    createProject.mutate({
      name: name.trim(),
      clientId: clientId || null,
      hourlyRate: Number(hourlyRate) || 0,
      budgetHours: budgetHours ? Number(budgetHours) : null,
      description: description.trim() || null,
      isBillable,
    }, {
      onSuccess: () => { reset(); onClose(); },
    });
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} width={480} title={t('projects.projects.newProject')}>
      <Modal.Header title={t('projects.projects.newProject')} subtitle={t('projects.projects.newProjectSubtitle')} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <Input label={t('projects.projects.projectName')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('projects.projects.projectNamePlaceholder')} autoFocus />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              {t('projects.invoices.client')}
            </label>
            <Select
              value={clientId}
              onChange={setClientId}
              options={[{ value: '', label: t('projects.common.none') }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
            <Input label={t('projects.projects.hourlyRate')} type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="0" style={{ flex: 1 }} />
            <Input label={t('projects.projects.budgetHours')} type="number" value={budgetHours} onChange={(e) => setBudgetHours(e.target.value)} placeholder={t('projects.common.none')} style={{ flex: 1 }} />
          </div>
          <Textarea label={t('projects.projects.description')} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)', cursor: 'pointer' }}>
            <input type="checkbox" checked={isBillable} onChange={(e) => setIsBillable(e.target.checked)} />
            {t('projects.projects.billable')}
          </label>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>{t('projects.actions.cancel')}</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!name.trim()}>{t('projects.projects.createProject')}</Button>
      </Modal.Footer>
    </Modal>
  );
}

// ─── Create Client Modal ──────────────────────────────────────────

function CreateClientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const createClient = useCreateClient();

  const reset = () => { setName(''); setEmail(''); setPhone(''); setAddress(''); };

  const handleSubmit = () => {
    if (!name.trim()) return;
    createClient.mutate({
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
    }, {
      onSuccess: () => { reset(); onClose(); },
    });
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} width={440} title={t('projects.clients.newClient')}>
      <Modal.Header title={t('projects.clients.newClient')} subtitle={t('projects.clients.newClientSubtitle')} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <Input label={t('projects.clients.clientName')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('projects.clients.clientNamePlaceholder')} autoFocus />
          <Input label={t('projects.clients.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client@company.com" />
          <Input label={t('projects.clients.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1-555-0100" />
          <Textarea label={t('projects.clients.address')} value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>{t('projects.actions.cancel')}</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!name.trim()}>{t('projects.clients.addClient')}</Button>
      </Modal.Footer>
    </Modal>
  );
}

// ─── Projects List View ───────────────────────────────────────────

function ProjectsListView({ projects, searchQuery, onSelect, selectedId, onAdd }: {
  projects: Project[];
  searchQuery: string;
  onSelect: (id: string) => void;
  selectedId: string | null;
  onAdd: () => void;
  clients: ProjectClient[];
}) {
  const { t } = useTranslation();

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter((p) => p.name.toLowerCase().includes(q) || (p.clientName?.toLowerCase().includes(q)));
  }, [projects, searchQuery]);

  if (filtered.length === 0 && !searchQuery) {
    return (
      <FeatureEmptyState
        illustration="pipeline"
        title={t('projects.empty.projectsTitle')}
        description={t('projects.empty.projectsDesc')}
        highlights={[
          { icon: <FolderKanban size={14} />, title: t('projects.empty.projectsH1Title'), description: t('projects.empty.projectsH1Desc') },
          { icon: <Clock size={14} />, title: t('projects.empty.projectsH2Title'), description: t('projects.empty.projectsH2Desc') },
          { icon: <BarChart3 size={14} />, title: t('projects.empty.projectsH3Title'), description: t('projects.empty.projectsH3Desc') },
        ]}
        actionLabel={t('projects.projects.createProject')}
        actionIcon={<Plus size={14} />}
        onAction={onAdd}
      />
    );
  }

  const columns: DataTableColumn<Project>[] = [
    {
      key: 'name',
      label: t('projects.projects.name'),
      icon: <FolderKanban size={12} />,
      width: 200,
      sortable: true,
      render: (project) => (
        <span style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <StatusDot color={project.color} size={8} />
          {project.name}
        </span>
      ),
    },
    {
      key: 'clientName',
      label: t('projects.invoices.client'),
      icon: <Users size={12} />,
      width: 140,
      sortable: true,
      render: (project) => (
        <span className="dt-cell-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {project.clientName || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('projects.projects.status'),
      width: 100,
      sortable: true,
      render: (project) => (
        <Badge variant={project.status === 'active' ? 'success' : project.status === 'paused' ? 'warning' : project.status === 'completed' ? 'primary' : 'default'}>
          {t(`projects.status.${project.status}`)}
        </Badge>
      ),
    },
    {
      key: 'totalHours',
      label: t('projects.reports.hours'),
      icon: <Clock size={12} />,
      width: 80,
      sortable: true,
      align: 'right',
      render: (project) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatNumber(project.totalHours, 1)}h</span>
      ),
    },
    {
      key: 'budgetAmount',
      label: t('projects.projects.budget'),
      icon: <DollarSign size={12} />,
      sortable: true,
      render: (project) => {
        const budgetPct = project.budgetHours ? Math.min((project.totalHours / project.budgetHours) * 100, 100) : 0;
        return (
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', overflow: 'hidden' }}>
            {project.budgetHours ? (
              <>
                <div style={{ flex: 1, height: 6, background: 'var(--color-bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${budgetPct}%`, background: budgetPct > 90 ? 'var(--color-error)' : budgetPct > 70 ? 'var(--color-warning)' : 'var(--color-success)', borderRadius: 3, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {formatNumber(budgetPct, 0)}%
                </span>
              </>
            ) : (
              <span className="dt-cell-secondary">-</span>
            )}
            {project.unbilledHours > 0 && (
              <span style={{ marginLeft: 'var(--spacing-sm)' }}>
                <Badge variant="warning">{formatNumber(project.unbilledHours, 1)}h {t('projects.dashboard.unbilled')}</Badge>
              </span>
            )}
            {project.totalAmount > 0 && (
              <span style={{ marginLeft: 'var(--spacing-xs)' }}>
                <Badge variant="success">{formatCurrency(project.totalAmount)}</Badge>
              </span>
            )}
          </span>
        );
      },
    },
  ];

  return (
    <DataTable
      data={filtered}
      columns={columns}
      activeRowId={selectedId}
      onRowClick={(project) => onSelect(project.id)}
      onAddRow={onAdd}
      addRowLabel={t('projects.actions.addNew')}
      emptyTitle={t('projects.empty.noMatchingProjects')}
      emptyDescription={t('projects.empty.tryDifferentSearch')}
      emptyIcon={<FolderKanban size={48} />}
    />
  );
}

// ─── Project Detail Panel ─────────────────────────────────────────

function ProjectDetailPanel({ project, onClose }: { project: Project; onClose: () => void }) {
  const { t } = useTranslation();
  const deleteProject = useDeleteProject();
  const updateProject = useUpdateProject();
  const updateTimeEntry = useUpdateTimeEntry();
  const deleteTimeEntry = useDeleteTimeEntry();
  const { addToast } = useToastStore();
  const { data: timeData } = useTimeEntries({ projectId: project.id });
  const recentEntries = (timeData?.entries ?? []).slice(0, 5);
  const { data: invoicesData } = useInvoices({ clientId: project.clientId ?? undefined });
  const clientInvoices = (invoicesData?.invoices ?? []).slice(0, 5);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [confirmDeleteEntryId, setConfirmDeleteEntryId] = useState<string | null>(null);

  const handleStartEdit = (entry: TimeEntry) => {
    setEditingEntryId(entry.id);
    setEditHours(String(entry.hours));
    setEditDescription(entry.description || '');
  };

  const handleSaveEdit = (entryId: string) => {
    updateTimeEntry.mutate({ id: entryId, hours: parseFloat(editHours) || 0, description: editDescription.trim() || null }, {
      onSuccess: () => { setEditingEntryId(null); addToast({ type: 'success', message: t('projects.timeTracking.saved') }); },
    });
  };

  const handleDeleteEntry = (entryId: string) => {
    deleteTimeEntry.mutate(entryId, {
      onSuccess: () => { setConfirmDeleteEntryId(null); addToast({ type: 'success', message: t('projects.timeTracking.deleteEntry') }); },
    });
  };

  const hoursPct = project.budgetHours ? Math.min((project.totalHours / project.budgetHours) * 100, 100) : 0;
  const amountPct = project.budgetAmount ? Math.min((project.totalAmount / project.budgetAmount) * 100, 100) : 0;

  return (
    <div className="projects-detail-panel">
      <div style={{ padding: '12px var(--spacing-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0 }}>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-family)' }}>
          {t('projects.projects.projectDetail')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconButton icon={<Trash2 size={14} />} label={t('projects.actions.delete')} size={28} destructive onClick={() => { deleteProject.mutate(project.id); onClose(); }} />
          <IconButton icon={<X size={14} />} label={t('common.close')} size={28} onClick={onClose} />
        </div>
      </div>
      <SmartButtonBar appId="projects" recordId={project.id} />
      <div className="projects-detail-body">
        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <StatusDot color={project.color} size={10} />
          {project.name}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          {/* Status + client */}
          <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'center' }}>
            <Badge variant={project.status === 'active' ? 'success' : project.status === 'paused' ? 'warning' : project.status === 'completed' ? 'primary' : 'default'}>
              {t(`projects.status.${project.status}`)}
            </Badge>
            {project.clientName && (
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                <Users size={13} style={{ color: 'var(--color-text-tertiary)' }} />
                {project.clientName}
              </span>
            )}
          </div>

          {/* Status selector */}
          <div className="projects-detail-field">
            <span className="projects-detail-field-label">{t('projects.projects.status')}</span>
            <Select
              value={project.status}
              onChange={(v) => updateProject.mutate({ id: project.id, status: v })}
              options={[
                { value: 'active', label: t('projects.status.active') },
                { value: 'paused', label: t('projects.status.paused') },
                { value: 'completed', label: t('projects.status.completed') },
                { value: 'archived', label: t('projects.status.archived') },
              ]}
              size="sm"
            />
          </div>

          {/* Budget section - hours */}
          <div className="projects-detail-field">
            <span className="projects-detail-field-label">{t('projects.dashboard.budgetHours')}</span>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}>
              {formatNumber(project.totalHours, 1)}h{project.budgetHours ? ` / ${formatNumber(project.budgetHours, 0)}h` : ''}
            </div>
            {project.budgetHours && (
              <div style={{ height: 6, background: 'var(--color-bg-tertiary)', borderRadius: 3, overflow: 'hidden', marginTop: 'var(--spacing-xs)' }}>
                <div style={{ height: '100%', width: `${hoursPct}%`, background: hoursPct > 90 ? 'var(--color-error)' : hoursPct > 70 ? 'var(--color-warning)' : 'var(--color-success)', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
            )}
          </div>

          {/* Budget section - amount */}
          {project.budgetAmount != null && (
            <div className="projects-detail-field">
              <span className="projects-detail-field-label">{t('projects.dashboard.budgetAmount')}</span>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}>
                {formatCurrency(project.totalAmount)} / {formatCurrency(project.budgetAmount)}
              </div>
              <div style={{ height: 6, background: 'var(--color-bg-tertiary)', borderRadius: 3, overflow: 'hidden', marginTop: 'var(--spacing-xs)' }}>
                <div style={{ height: '100%', width: `${amountPct}%`, background: amountPct > 90 ? 'var(--color-error)' : amountPct > 70 ? 'var(--color-warning)' : 'var(--color-success)', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
            </div>
          )}

          {project.description && (
            <div className="projects-detail-field">
              <span className="projects-detail-field-label">{t('projects.projects.description')}</span>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)', lineHeight: 'var(--line-height-normal)' }}>
                {project.description}
              </div>
            </div>
          )}

          <div className="projects-detail-field">
            <span className="projects-detail-field-label">{t('projects.projects.billable')}</span>
            <Badge variant={project.isBillable ? 'success' : 'default'}>
              {project.isBillable ? t('projects.common.yes') : t('projects.common.no')}
            </Badge>
          </div>

          <CustomFieldsRenderer appId="projects" recordType="projects" recordId={project.id} />

          {/* Recent time entries */}
          <div className="projects-detail-field">
            <span className="projects-detail-field-label">{t('projects.dashboard.recentTimeEntries')}</span>
            {recentEntries.length === 0 ? (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                {t('projects.reports.noData')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 'var(--spacing-xs)' }}>
                {recentEntries.map((entry) => (
                  <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--color-border-secondary)', gap: 'var(--spacing-xs)' }}>
                    {editingEntryId === entry.id ? (
                      <>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                          <Input
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder={t('projects.dashboard.noDescription')}
                            size="sm"
                          />
                          <Input
                            type="number"
                            step="0.25"
                            value={editHours}
                            onChange={(e) => setEditHours(e.target.value)}
                            placeholder="0"
                            size="sm"
                            style={{ width: 70 }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                          <IconButton icon={<Check size={12} />} label={t('projects.timeTracking.saveEntry')} size={22} onClick={() => handleSaveEdit(entry.id)} />
                          <IconButton icon={<X size={12} />} label={t('projects.actions.cancel')} size={22} onClick={() => setEditingEntryId(null)} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {entry.description || t('projects.dashboard.noDescription')}
                          </div>
                          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                            {formatDate(entry.date)}
                          </div>
                        </div>
                        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                          {formatNumber(entry.hours, 1)}h
                        </span>
                        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                          <IconButton icon={<Pencil size={11} />} label={t('projects.timeTracking.editEntry')} size={20} onClick={() => handleStartEdit(entry)} />
                          <IconButton icon={<Trash2 size={11} />} label={t('projects.timeTracking.deleteEntry')} size={20} destructive onClick={() => setConfirmDeleteEntryId(entry.id)} />
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <ConfirmDialog
            open={!!confirmDeleteEntryId}
            onOpenChange={(open) => { if (!open) setConfirmDeleteEntryId(null); }}
            title={t('projects.timeTracking.deleteEntry')}
            description={t('projects.timeTracking.deleteEntry') + '?'}
            confirmLabel={t('projects.actions.delete')}
            destructive
            onConfirm={() => confirmDeleteEntryId && handleDeleteEntry(confirmDeleteEntryId)}
          />

          {/* Linked invoices */}
          {project.clientId && clientInvoices.length > 0 && (
            <div className="projects-detail-field">
              <span className="projects-detail-field-label">{t('projects.sidebar.invoices')}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 'var(--spacing-xs)' }}>
                {clientInvoices.map((inv) => (
                  <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--color-border-secondary)' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                      {inv.invoiceNumber}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>
                        {formatCurrency(inv.total)}
                      </span>
                      <Badge variant={getInvoiceStatusVariant(inv.status)}>
                        {t(`projects.status.${inv.status}`)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Clients List View ────────────────────────────────────────────

function ClientsListView({ clients, searchQuery, onSelect, selectedId, onAdd }: {
  clients: ProjectClient[];
  searchQuery: string;
  onSelect: (id: string) => void;
  selectedId: string | null;
  onAdd: () => void;
}) {
  const { t } = useTranslation();

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter((c) => c.name.toLowerCase().includes(q) || (c.email?.toLowerCase().includes(q)));
  }, [clients, searchQuery]);

  if (filtered.length === 0 && !searchQuery) {
    return (
      <FeatureEmptyState
        illustration="contacts"
        title={t('projects.empty.clientsTitle')}
        description={t('projects.empty.clientsDesc')}
        highlights={[
          { icon: <Users size={14} />, title: t('projects.empty.clientsH1Title'), description: t('projects.empty.clientsH1Desc') },
          { icon: <FileText size={14} />, title: t('projects.empty.clientsH2Title'), description: t('projects.empty.clientsH2Desc') },
          { icon: <DollarSign size={14} />, title: t('projects.empty.clientsH3Title'), description: t('projects.empty.clientsH3Desc') },
        ]}
        actionLabel={t('projects.clients.addClient')}
        actionIcon={<Plus size={14} />}
        onAction={onAdd}
      />
    );
  }

  const columns: DataTableColumn<ProjectClient>[] = [
    {
      key: 'name',
      label: t('projects.clients.name'),
      icon: <Users size={12} />,
      width: 180,
      sortable: true,
      render: (client) => (
        <span style={{ fontWeight: 'var(--font-weight-medium)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {client.name}
        </span>
      ),
    },
    {
      key: 'email',
      label: t('projects.clients.email'),
      icon: <Mail size={12} />,
      width: 180,
      sortable: true,
      render: (client) => (
        <span className="dt-cell-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {client.email || '-'}
        </span>
      ),
    },
    {
      key: 'projectCount',
      label: t('projects.sidebar.projects'),
      icon: <FolderKanban size={12} />,
      width: 70,
      sortable: true,
      align: 'right',
      render: (client) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{client.projectCount}</span>
      ),
    },
    {
      key: 'totalBilled',
      label: t('projects.dashboard.totalBilled'),
      icon: <DollarSign size={12} />,
      width: 110,
      sortable: true,
      align: 'right',
      render: (client) => (
        <span className="dt-cell-secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(client.totalBilled)}
        </span>
      ),
    },
    {
      key: 'outstandingAmount',
      label: t('projects.reports.outstanding'),
      icon: <DollarSign size={12} />,
      sortable: true,
      align: 'right',
      render: (client) => (
        <span style={{ fontWeight: 'var(--font-weight-medium)', fontVariantNumeric: 'tabular-nums', color: client.outstandingAmount > 0 ? 'var(--color-warning)' : 'var(--color-text-tertiary)' }}>
          {formatCurrency(client.outstandingAmount)}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      data={filtered}
      columns={columns}
      activeRowId={selectedId}
      onRowClick={(client) => onSelect(client.id)}
      onAddRow={onAdd}
      addRowLabel={t('projects.actions.addNew')}
      emptyTitle={t('projects.empty.noMatchingClients')}
      emptyDescription={t('projects.empty.tryDifferentSearch')}
      emptyIcon={<Users size={48} />}
    />
  );
}

// ─── Client Detail Panel ──────────────────────────────────────────

function ClientDetailPanel({ client, onClose, onNavigate }: { client: ProjectClient; onClose: () => void; onNavigate?: (view: ActiveView, selectId?: string) => void }) {
  const { t } = useTranslation();
  const deleteClient = useDeleteClient();
  const { data: projectsData } = useProjects({ clientId: client.id });
  const clientProjects = projectsData?.projects ?? [];
  const { data: invoicesData } = useInvoices({ clientId: client.id });
  const clientInvoices = (invoicesData?.invoices ?? []).slice(0, 5);
  const [copied, setCopied] = useState(false);

  const portalUrl = client.portalToken
    ? `${window.location.origin}/projects/portal/${client.portalToken}`
    : null;

  const handleCopyPortalLink = () => {
    if (portalUrl) {
      navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Compute invoice summary
  const totalBilled = clientInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const overdueAmount = clientInvoices.filter(inv => inv.status === 'overdue').reduce((sum, inv) => sum + inv.total, 0);

  return (
    <div className="projects-detail-panel">
      <div style={{ padding: '12px var(--spacing-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0 }}>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-family)' }}>
          {t('projects.clients.clientDetail')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconButton icon={<Trash2 size={14} />} label={t('projects.actions.delete')} size={28} destructive onClick={() => { deleteClient.mutate(client.id); onClose(); }} />
          <IconButton icon={<X size={14} />} label={t('common.close')} size={28} onClick={onClose} />
        </div>
      </div>
      <SmartButtonBar appId="projects" recordId={client.id} />
      <div className="projects-detail-body">
        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
          {client.name}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          {/* Contact info */}
          {client.email && (
            <div className="projects-detail-field">
              <span className="projects-detail-field-label">{t('projects.clients.email')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                <Mail size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                {client.email}
              </div>
            </div>
          )}
          {client.phone && (
            <div className="projects-detail-field">
              <span className="projects-detail-field-label">{t('projects.clients.phone')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                <Phone size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                {client.phone}
              </div>
            </div>
          )}
          {client.address && (
            <div className="projects-detail-field">
              <span className="projects-detail-field-label">{t('projects.clients.address')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                <MapPin size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                {client.address}
              </div>
            </div>
          )}

          {/* Portal link */}
          {portalUrl && (
            <div className="projects-detail-field">
              <span className="projects-detail-field-label">{t('projects.portal.clientPortal')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                <div style={{ flex: 1, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', background: 'var(--color-bg-tertiary)', padding: '4px 8px', borderRadius: 'var(--radius-sm)' }}>
                  {portalUrl}
                </div>
                <IconButton
                  icon={copied ? <ExternalLink size={13} /> : <Copy size={13} />}
                  label={copied ? t('projects.dashboard.copied') : t('projects.dashboard.copyLink')}
                  size={24}
                  onClick={handleCopyPortalLink}
                />
              </div>
            </div>
          )}

          {/* Invoice summary */}
          <div className="projects-detail-field">
            <span className="projects-detail-field-label">{t('projects.dashboard.invoiceSummary')}</span>
            <div style={{ display: 'flex', gap: 'var(--spacing-lg)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)' }}>
              <div>
                <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>{t('projects.dashboard.totalBilled')}</div>
                <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' } as React.CSSProperties}>{formatCurrency(client.totalBilled)}</div>
              </div>
              <div>
                <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>{t('projects.reports.outstanding')}</div>
                <div style={{ fontWeight: 'var(--font-weight-semibold)', color: client.outstandingAmount > 0 ? 'var(--color-warning)' : 'var(--color-text-primary)', fontVariantNumeric: 'tabular-nums' } as React.CSSProperties}>{formatCurrency(client.outstandingAmount)}</div>
              </div>
              {overdueAmount > 0 && (
                <div>
                  <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>{t('projects.dashboard.overdue')}</div>
                  <div style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-error)', fontVariantNumeric: 'tabular-nums' } as React.CSSProperties}>{formatCurrency(overdueAmount)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Projects */}
          <div className="projects-detail-field">
            <span className="projects-detail-field-label">{t('projects.clients.linkedProjects')} ({clientProjects.length})</span>
            {clientProjects.length === 0 ? (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                {t('projects.clients.noProjects')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 'var(--spacing-xs)' }}>
                {clientProjects.map((proj) => (
                  <div
                    key={proj.id}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--color-border-secondary)', cursor: onNavigate ? 'pointer' : undefined }}
                    onClick={() => onNavigate?.('projects', proj.id)}
                  >
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                      <StatusDot color={proj.color} size={6} />
                      {proj.name}
                    </span>
                    <Badge variant={proj.status === 'active' ? 'success' : proj.status === 'paused' ? 'warning' : proj.status === 'completed' ? 'primary' : 'default'}>
                      {t(`projects.status.${proj.status}`)}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <CustomFieldsRenderer appId="projects" recordType="clients" recordId={client.id} />

          {/* Recent invoices */}
          <div className="projects-detail-field">
            <span className="projects-detail-field-label">{t('projects.clients.linkedInvoices')} ({clientInvoices.length})</span>
            {clientInvoices.length === 0 ? (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                {t('projects.clients.noInvoices')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 'var(--spacing-xs)' }}>
                {clientInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--color-border-secondary)', cursor: onNavigate ? 'pointer' : undefined }}
                    onClick={() => onNavigate?.('invoices', inv.id)}
                  >
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                      {inv.invoiceNumber}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                      <span style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>
                        {formatCurrency(inv.total)}
                      </span>
                      <Badge variant={getInvoiceStatusVariant(inv.status)}>
                        {t(`projects.status.${inv.status}`)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Invoices List View ───────────────────────────────────────────

function InvoicesListView({ invoices, searchQuery, onSelect, selectedId, onAdd }: {
  invoices: Invoice[];
  searchQuery: string;
  onSelect: (id: string) => void;
  selectedId: string | null;
  onAdd: () => void;
}) {
  const { t } = useTranslation();

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return invoices;
    const q = searchQuery.toLowerCase();
    return invoices.filter((inv) =>
      inv.invoiceNumber.toLowerCase().includes(q) ||
      (inv.clientName?.toLowerCase().includes(q)),
    );
  }, [invoices, searchQuery]);

  if (filtered.length === 0 && !searchQuery) {
    return (
      <FeatureEmptyState
        illustration="documents"
        title={t('projects.empty.invoicesTitle')}
        description={t('projects.empty.invoicesDesc')}
        highlights={[
          { icon: <FileText size={14} />, title: t('projects.empty.invoicesH1Title'), description: t('projects.empty.invoicesH1Desc') },
          { icon: <DollarSign size={14} />, title: t('projects.empty.invoicesH2Title'), description: t('projects.empty.invoicesH2Desc') },
          { icon: <Users size={14} />, title: t('projects.empty.invoicesH3Title'), description: t('projects.empty.invoicesH3Desc') },
        ]}
        actionLabel={t('projects.invoices.newInvoice')}
        actionIcon={<Plus size={14} />}
        onAction={onAdd}
      />
    );
  }

  const totalAmount = filtered.reduce((sum, inv) => sum + inv.total, 0);

  const columns: DataTableColumn<Invoice>[] = [
    {
      key: 'invoiceNumber',
      label: t('projects.invoices.number'),
      icon: <Hash size={12} />,
      width: 120,
      sortable: true,
      render: (invoice) => (
        <span style={{ fontWeight: 'var(--font-weight-medium)' }}>{invoice.invoiceNumber}</span>
      ),
    },
    {
      key: 'clientName',
      label: t('projects.invoices.client'),
      icon: <Users size={12} />,
      width: 160,
      sortable: true,
      render: (invoice) => (
        <span className="dt-cell-secondary" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {invoice.clientName || '-'}
        </span>
      ),
    },
    {
      key: 'total',
      label: t('projects.invoices.amount'),
      icon: <DollarSign size={12} />,
      width: 110,
      sortable: true,
      align: 'right',
      render: (invoice) => (
        <span style={{ fontWeight: 'var(--font-weight-semibold)', fontVariantNumeric: 'tabular-nums' }}>
          {formatCurrency(invoice.total)}
        </span>
      ),
    },
    {
      key: 'lineItemCount',
      label: t('projects.invoices.lineItems'),
      icon: <Hash size={12} />,
      width: 60,
      sortable: true,
      align: 'right',
      render: (invoice) => (
        <span className="dt-cell-secondary" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {invoice.lineItemCount ?? invoice.lineItems?.length ?? 0}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('projects.projects.status'),
      width: 100,
      sortable: true,
      render: (invoice) => (
        <Badge variant={getInvoiceStatusVariant(invoice.status)}>
          {t(`projects.status.${invoice.status}`)}
        </Badge>
      ),
    },
    {
      key: 'issueDate',
      label: t('projects.invoices.issueDate'),
      icon: <Calendar size={12} />,
      sortable: true,
      render: (invoice) => (
        <span className="dt-cell-secondary">{formatDate(invoice.issueDate)}</span>
      ),
    },
  ];

  return (
    <DataTable
      data={filtered}
      columns={columns}
      activeRowId={selectedId}
      onRowClick={(invoice) => onSelect(invoice.id)}
      onAddRow={onAdd}
      addRowLabel={t('projects.actions.addNew')}
      emptyTitle={t('projects.empty.noMatchingInvoices')}
      emptyDescription={t('projects.empty.tryDifferentSearch')}
      emptyIcon={<FileText size={48} />}
      aggregations={[
        {
          label: t('projects.invoices.total'),
          compute: () => formatCurrency(totalAmount),
        },
      ]}
    />
  );
}

// ─── Invoice Detail Panel ─────────────────────────────────────────

function InvoiceDetailPanel({ invoice, onClose, onEdit }: { invoice: Invoice; onClose: () => void; onEdit: () => void }) {
  const { t } = useTranslation();
  const deleteInvoice = useDeleteInvoice();
  const sendInvoice = useSendInvoice();
  const markPaid = useMarkInvoicePaid();
  const waive = useWaiveInvoice();
  const duplicate = useDuplicateInvoice();

  return (
    <div className="projects-detail-panel">
      <div style={{ padding: '12px var(--spacing-lg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0 }}>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-family)' }}>
          {t('projects.invoices.invoiceDetail')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconButton icon={<Trash2 size={14} />} label={t('projects.actions.delete')} size={28} destructive onClick={() => { deleteInvoice.mutate(invoice.id); onClose(); }} />
          <IconButton icon={<X size={14} />} label={t('common.close')} size={28} onClick={onClose} />
        </div>
      </div>
      <div className="projects-detail-body">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
            {invoice.invoiceNumber}
          </div>
          <Badge variant={getInvoiceStatusVariant(invoice.status)}>
            {t(`projects.status.${invoice.status}`)}
          </Badge>
        </div>

        {/* Status timeline */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: 'var(--spacing-sm) 0' }}>
          {(['draft', 'sent', 'viewed', 'paid'] as const).map((step, i) => {
            const statusOrder = { draft: 0, sent: 1, viewed: 2, paid: 3, overdue: 1, waived: 3 } as const;
            const currentOrder = statusOrder[invoice.status as keyof typeof statusOrder] ?? 0;
            const stepOrder = statusOrder[step];
            const isActive = stepOrder <= currentOrder;
            const isCurrent = (invoice.status === 'overdue' && step === 'sent') || (invoice.status === 'waived' && step === 'paid') || step === invoice.status;
            return (
              <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : undefined }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  backgroundColor: isActive ? (invoice.status === 'overdue' && step === 'sent' ? 'var(--color-error)' : 'var(--color-accent-primary)') : 'var(--color-bg-tertiary)',
                  color: isActive ? '#fff' : 'var(--color-text-tertiary)',
                  fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', fontFamily: 'var(--font-family)',
                  border: isCurrent ? '2px solid var(--color-accent-primary)' : 'none',
                }}>
                  {isActive ? <CheckCircle2 size={12} /> : (i + 1)}
                </div>
                <span style={{ fontSize: 'var(--font-size-xs)', color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', marginLeft: 'var(--spacing-xs)', whiteSpace: 'nowrap' }}>
                  {t(`projects.status.${step}`)}
                </span>
                {i < 3 && (
                  <div style={{ flex: 1, height: 2, backgroundColor: isActive ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)', margin: '0 var(--spacing-xs)' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Next action prompt */}
        <div style={{ padding: 'var(--spacing-sm) 0' }}>
          <span className="projects-detail-field-label">{t('projects.invoices.nextAction')}</span>
          <div style={{ marginTop: 'var(--spacing-xs)' }}>
            {invoice.status === 'draft' && (
              <Button variant="primary" size="sm" icon={<Send size={13} />} onClick={() => sendInvoice.mutate(invoice.id)}>
                {t('projects.invoices.sendInvoice')}
              </Button>
            )}
            {(invoice.status === 'sent' || invoice.status === 'viewed') && (
              <Button variant="primary" size="sm" icon={<DollarSign size={13} />} onClick={() => markPaid.mutate(invoice.id)}>
                {t('projects.invoices.markPaid')}
              </Button>
            )}
            {invoice.status === 'overdue' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Badge variant="error">{t('projects.dashboard.overdue')}</Badge>
                <Button variant="primary" size="sm" icon={<DollarSign size={13} />} onClick={() => markPaid.mutate(invoice.id)}>
                  {t('projects.invoices.markPaid')}
                </Button>
              </div>
            )}
            {invoice.status === 'paid' && (
              <Badge variant="success">{t('projects.status.paid')}</Badge>
            )}
            {invoice.status === 'waived' && (
              <Badge variant="default">{t('projects.status.waived')}</Badge>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          <div className="projects-detail-field">
            <span className="projects-detail-field-label">{t('projects.invoices.client')}</span>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
              {invoice.clientName || '-'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--spacing-lg)' }}>
            <div className="projects-detail-field" style={{ flex: 1 }}>
              <span className="projects-detail-field-label">{t('projects.invoices.issueDate')}</span>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {formatDate(invoice.issueDate)}
              </div>
            </div>
            <div className="projects-detail-field" style={{ flex: 1 }}>
              <span className="projects-detail-field-label">{t('projects.invoices.dueDate')}</span>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {formatDate(invoice.dueDate)}
              </div>
            </div>
          </div>

          {/* Line items */}
          <div>
            <span className="projects-detail-field-label">{t('projects.invoices.lineItems')}</span>
            <div style={{ marginTop: 'var(--spacing-sm)' }}>
              {invoice.lineItems.map((li, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--spacing-xs) 0', borderBottom: '1px solid var(--color-border-secondary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)' }}>
                  <span style={{ color: 'var(--color-text-primary)', flex: 1 }}>{li.description}</span>
                  <span style={{ color: 'var(--color-text-tertiary)', width: 60, textAlign: 'right' }}>{li.quantity}h</span>
                  <span style={{ color: 'var(--color-text-tertiary)', width: 80, textAlign: 'right' }}>{formatCurrency(li.unitPrice)}</span>
                  <span style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-semibold)', width: 80, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(li.amount)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="projects-invoice-totals">
            <div className="projects-invoice-totals-row">
              <span className="projects-invoice-totals-label">{t('projects.invoices.subtotal')}</span>
              <span className="projects-invoice-totals-value">{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.taxPercent > 0 && (
              <div className="projects-invoice-totals-row">
                <span className="projects-invoice-totals-label">{t('projects.invoices.tax')} ({invoice.taxPercent}%)</span>
                <span className="projects-invoice-totals-value">{formatCurrency(invoice.taxAmount)}</span>
              </div>
            )}
            {invoice.discountPercent > 0 && (
              <div className="projects-invoice-totals-row">
                <span className="projects-invoice-totals-label">{t('projects.invoices.discount')} ({invoice.discountPercent}%)</span>
                <span className="projects-invoice-totals-value">-{formatCurrency(invoice.discountAmount)}</span>
              </div>
            )}
            <div className="projects-invoice-totals-row" style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-sm)' }}>
              <span className="projects-invoice-totals-label">{t('projects.invoices.total')}</span>
              <span className="projects-invoice-totals-total">{formatCurrency(invoice.total)}</span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
            {invoice.status === 'draft' && (
              <>
                <Button variant="secondary" size="sm" onClick={onEdit}>{t('projects.actions.edit')}</Button>
                <Button variant="primary" size="sm" onClick={() => sendInvoice.mutate(invoice.id)}>{t('projects.invoices.send')}</Button>
              </>
            )}
            {(invoice.status === 'sent' || invoice.status === 'viewed' || invoice.status === 'overdue') && (
              <>
                <Button variant="primary" size="sm" onClick={() => markPaid.mutate(invoice.id)}>{t('projects.invoices.markPaid')}</Button>
                <Button variant="ghost" size="sm" onClick={() => waive.mutate(invoice.id)}>{t('projects.invoices.waive')}</Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={() => duplicate.mutate(invoice.id)}>{t('projects.invoices.duplicate')}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Settings View ────────────────────────────────────────────────

function SettingsView() {
  const { t } = useTranslation();
  const { data: settings } = useProjectSettings();
  const updateSettings = useUpdateProjectSettings();

  const [invoicePrefix, setInvoicePrefix] = useState('');
  const [defaultRate, setDefaultRate] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');

  useEffect(() => {
    if (settings) {
      setInvoicePrefix(settings.invoicePrefix);
      setDefaultRate(String(settings.defaultHourlyRate));
      setCompanyName(settings.companyName);
      setCompanyAddress(settings.companyAddress);
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate({
      invoicePrefix,
      defaultHourlyRate: Number(defaultRate) || 0,
      companyName,
      companyAddress,
    });
  };

  return (
    <div style={{ padding: 'var(--spacing-lg) var(--spacing-xl)', overflow: 'auto', flex: 1, maxWidth: 640 }}>
      <SettingsSection title={t('projects.settings.invoiceSettings')}>
        <SettingsRow label={t('projects.settings.invoicePrefix')} description={t('projects.settings.invoicePrefixDesc')}>
          <Input value={invoicePrefix} onChange={(e) => setInvoicePrefix(e.target.value)} size="sm" style={{ width: 120 }} />
        </SettingsRow>
        <SettingsRow label={t('projects.settings.defaultHourlyRate')} description={t('projects.settings.defaultHourlyRateDesc')}>
          <Input type="number" value={defaultRate} onChange={(e) => setDefaultRate(e.target.value)} size="sm" style={{ width: 100 }} />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title={t('projects.settings.companyInfo')}>
        <SettingsRow label={t('projects.settings.companyName')} description={t('projects.settings.companyNameDesc')}>
          <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} size="sm" style={{ width: 200 }} />
        </SettingsRow>
        <SettingsRow label={t('projects.settings.companyAddress')} description={t('projects.settings.companyAddressDesc')}>
          <Textarea value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} rows={2} style={{ width: 240 }} />
        </SettingsRow>
      </SettingsSection>

      <Button variant="primary" size="sm" onClick={handleSave} disabled={updateSettings.isPending}>
        {t('projects.actions.save')}
      </Button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export function ProjectsPage() {
  const { t } = useTranslation();
  const { openSettings } = useUIStore();

  // Navigation
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = (searchParams.get('view') || 'dashboard') as ActiveView;
  const activeView = viewParam;
  const setActiveView = useCallback((view: ActiveView) => {
    setSearchParams({ view }, { replace: true });
  }, [setSearchParams]);

  // Selection state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modals
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showInvoiceBuilder, setShowInvoiceBuilder] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  // Data
  const { data: projectsData } = useProjects();
  const projects = projectsData?.projects ?? [];

  const { data: clientsData } = useClients();
  const clients = clientsData?.clients ?? [];

  const { data: invoicesData } = useInvoices();
  const invoices = invoicesData?.invoices ?? [];

  // Selected entities
  const selectedProject = selectedProjectId ? projects.find((p) => p.id === selectedProjectId) : null;
  const selectedClient = selectedClientId ? clients.find((c) => c.id === selectedClientId) : null;
  const selectedInvoice = selectedInvoiceId ? invoices.find((i) => i.id === selectedInvoiceId) : null;

  // Close selection on view change
  useEffect(() => {
    setSelectedProjectId(null);
    setSelectedClientId(null);
    setSelectedInvoiceId(null);
    setSearchQuery('');
    setShowSearch(false);
  }, [activeView]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showSearch) {
          setShowSearch(false);
          setSearchQuery('');
        } else {
          setSelectedProjectId(null);
          setSelectedClientId(null);
          setSelectedInvoiceId(null);
        }
      }
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSearch]);

  // Section title
  const sectionTitle = useMemo(() => {
    switch (activeView) {
      case 'dashboard': return t('projects.sidebar.dashboard');
      case 'timeTracking': return t('projects.sidebar.timeTracking');
      case 'projects': return t('projects.sidebar.allProjects');
      case 'clients': return t('projects.sidebar.clients');
      case 'invoices': return t('projects.sidebar.invoices');
      case 'reports': return t('projects.sidebar.reports');
      case 'settings': return t('projects.sidebar.settings');
    }
  }, [activeView, t]);

  // Add handler
  const handleAdd = () => {
    switch (activeView) {
      case 'projects':
        setShowCreateProject(true);
        break;
      case 'clients':
        setShowCreateClient(true);
        break;
      case 'invoices':
        setEditingInvoice(null);
        setShowInvoiceBuilder(true);
        break;
    }
  };

  const addButtonLabel = useMemo(() => {
    switch (activeView) {
      case 'dashboard': return t('projects.projects.newProject');
      case 'projects': return t('projects.projects.newProject');
      case 'clients': return t('projects.clients.newClient');
      case 'invoices': return t('projects.invoices.newInvoice');
      default: return '';
    }
  }, [activeView, t]);

  const hasDetailPanel = !!(
    (activeView === 'projects' && selectedProject) ||
    (activeView === 'clients' && selectedClient) ||
    (activeView === 'invoices' && selectedInvoice)
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <AppSidebar
        storageKey="atlas_projects_sidebar"
        title={t('projects.title')}
        footer={
          <SidebarItem
            label={t('projects.sidebar.settings')}
            icon={<Settings2 size={14} />}
            onClick={() => setActiveView('settings')}
          />
        }
      >
        <SidebarSection>
          <SidebarItem
            label={t('projects.sidebar.dashboard')}
            icon={<LayoutDashboard size={14} />}
            iconColor="#0ea5e9"
            isActive={activeView === 'dashboard'}
            onClick={() => setActiveView('dashboard')}
          />
          <SidebarItem
            label={t('projects.sidebar.timeTracking')}
            icon={<Clock size={14} />}
            iconColor="#f59e0b"
            isActive={activeView === 'timeTracking'}
            onClick={() => setActiveView('timeTracking')}
          />
          <SidebarItem
            label={t('projects.sidebar.allProjects')}
            icon={<FolderKanban size={14} />}
            iconColor="#8b5cf6"
            isActive={activeView === 'projects'}
            count={projects.length}
            onClick={() => setActiveView('projects')}
          />
          <SidebarItem
            label={t('projects.sidebar.clients')}
            icon={<Users size={14} />}
            iconColor="#10b981"
            isActive={activeView === 'clients'}
            count={clients.length}
            onClick={() => setActiveView('clients')}
          />
          <SidebarItem
            label={t('projects.sidebar.invoices')}
            icon={<FileText size={14} />}
            iconColor="#3b82f6"
            isActive={activeView === 'invoices'}
            count={invoices.length}
            onClick={() => setActiveView('invoices')}
          />
          <SidebarItem
            label={t('projects.sidebar.reports')}
            icon={<BarChart3 size={14} />}
            iconColor="#6366f1"
            isActive={activeView === 'reports'}
            onClick={() => setActiveView('reports')}
          />
        </SidebarSection>
      </AppSidebar>

      {/* Main content */}
      <ContentArea
        title={sectionTitle ?? ''}
        actions={
          activeView !== 'dashboard' && activeView !== 'timeTracking' && activeView !== 'reports' && activeView !== 'settings' ? (
            <>
              <IconButton
                icon={<Search size={14} />}
                label={t('projects.actions.search')}
                size={28}
                active={showSearch}
                onClick={() => {
                  setShowSearch(!showSearch);
                  if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
              />
              {addButtonLabel && (
                <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={handleAdd}>
                  {addButtonLabel}
                </Button>
              )}
            </>
          ) : activeView === 'dashboard' ? (
            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => { setActiveView('projects'); setShowCreateProject(true); }}>
              {t('projects.projects.newProject')}
            </Button>
          ) : undefined
        }
      >
        {/* Search bar */}
        {showSearch && (
          <div className="projects-search-bar">
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('projects.actions.search')}
              iconLeft={<Search size={14} />}
              size="sm"
              style={{ border: 'none', background: 'transparent' }}
            />
            <IconButton
              icon={<X size={14} />}
              label={t('common.close')}
              size={24}
              onClick={() => { setShowSearch(false); setSearchQuery(''); }}
            />
          </div>
        )}

        {/* Content area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {activeView === 'dashboard' && <DashboardView />}

            {activeView === 'timeTracking' && <TimeTracker />}

            {activeView === 'projects' && (
              <ProjectsListView
                projects={projects}
                searchQuery={searchQuery}
                selectedId={selectedProjectId}
                onSelect={(id) => { setSelectedProjectId(id); setSelectedClientId(null); setSelectedInvoiceId(null); }}
                onAdd={() => setShowCreateProject(true)}
                clients={clients}
              />
            )}

            {activeView === 'clients' && (
              <ClientsListView
                clients={clients}
                searchQuery={searchQuery}
                selectedId={selectedClientId}
                onSelect={(id) => { setSelectedClientId(id); setSelectedProjectId(null); setSelectedInvoiceId(null); }}
                onAdd={() => setShowCreateClient(true)}
              />
            )}

            {activeView === 'invoices' && (
              <InvoicesListView
                invoices={invoices}
                searchQuery={searchQuery}
                selectedId={selectedInvoiceId}
                onSelect={(id) => { setSelectedInvoiceId(id); setSelectedProjectId(null); setSelectedClientId(null); }}
                onAdd={() => { setEditingInvoice(null); setShowInvoiceBuilder(true); }}
              />
            )}

            {activeView === 'reports' && <ReportsView />}

            {activeView === 'settings' && <SettingsView />}
          </div>

          {/* Detail panels */}
          {hasDetailPanel && (
            <div style={{ width: 360, borderLeft: '1px solid var(--color-border-secondary)', flexShrink: 0, overflow: 'hidden' }}>
              {activeView === 'projects' && selectedProject && (
                <ProjectDetailPanel project={selectedProject} onClose={() => setSelectedProjectId(null)} />
              )}
              {activeView === 'clients' && selectedClient && (
                <ClientDetailPanel
                  client={selectedClient}
                  onClose={() => setSelectedClientId(null)}
                  onNavigate={(view, selectId) => {
                    setActiveView(view);
                    setSelectedClientId(null);
                    if (view === 'projects' && selectId) setSelectedProjectId(selectId);
                    if (view === 'invoices' && selectId) setSelectedInvoiceId(selectId);
                  }}
                />
              )}
              {activeView === 'invoices' && selectedInvoice && (
                <InvoiceDetailPanel
                  invoice={selectedInvoice}
                  onClose={() => setSelectedInvoiceId(null)}
                  onEdit={() => { setEditingInvoice(selectedInvoice); setShowInvoiceBuilder(true); }}
                />
              )}
            </div>
          )}
        </div>
      </ContentArea>

      {/* Modals */}
      <CreateProjectModal open={showCreateProject} onClose={() => setShowCreateProject(false)} clients={clients} />
      <CreateClientModal open={showCreateClient} onClose={() => setShowCreateClient(false)} />
      <InvoiceBuilder open={showInvoiceBuilder} onClose={() => { setShowInvoiceBuilder(false); setEditingInvoice(null); }} invoice={editingInvoice} />
    </div>
  );
}
