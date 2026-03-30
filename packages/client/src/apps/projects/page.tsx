import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDate, formatCurrency, formatNumber } from '../../lib/format';
import {
  LayoutDashboard, Clock, FolderKanban, Users, FileText, BarChart3, Settings2,
  Plus, Search, X, ChevronRight, Trash2,
  DollarSign, Calendar, Mail, Phone, MapPin, Hash, Percent,
} from 'lucide-react';
import {
  useDashboard,
  useProjects, useCreateProject, useUpdateProject, useDeleteProject,
  useClients, useCreateClient, useUpdateClient, useDeleteClient,
  useInvoices, useCreateInvoice, useUpdateInvoice, useDeleteInvoice,
  useSendInvoice, useMarkInvoicePaid, useWaiveInvoice, useDuplicateInvoice,
  useProjectSettings, useUpdateProjectSettings,
  type Project, type ProjectClient, type Invoice,
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
import { ColumnHeader } from '../../components/ui/column-header';
import { FeatureEmptyState } from '../../components/ui/feature-empty-state';
import { StatusDot } from '../../components/ui/status-dot';
import { ContentArea } from '../../components/ui/content-area';
import { ListToolbar } from '../../components/ui/list-toolbar';
import { SmartButtonBar } from '../../components/shared/SmartButtonBar';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { SettingsSection, SettingsRow } from '../../components/settings/settings-primitives';
import { useUIStore } from '../../stores/ui-store';
import '../../styles/projects.css';

// ─── Types ────────────────────────────────────────────────────────

type ActiveView = 'dashboard' | 'timeTracking' | 'projects' | 'clients' | 'invoices' | 'reports' | 'settings';

type SortDirection = 'asc' | 'desc';

interface SortState {
  column: string;
  direction: SortDirection;
}

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

function getInvoiceStatusVariant(status: string): 'default' | 'primary' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'draft': return 'default';
    case 'sent': return 'primary';
    case 'viewed': return 'warning';
    case 'paid': return 'success';
    case 'overdue': return 'error';
    case 'waived': return 'default';
    default: return 'default';
  }
}

// ─── KPI Card ─────────────────────────────────────────────────────

function KpiCard({ icon, label, value, subtitle, iconColor }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtitle: string;
  iconColor?: string;
}) {
  return (
    <div className="projects-kpi-card">
      <div className="projects-kpi-card-icon" style={{ color: iconColor }}>{icon}</div>
      <div className="projects-kpi-card-content">
        <span className="projects-kpi-card-label">{label}</span>
        <span className="projects-kpi-card-value">{value}</span>
        <span className="projects-kpi-card-subtitle">{subtitle}</span>
      </div>
    </div>
  );
}

// ─── Dashboard View ───────────────────────────────────────────────

function DashboardView() {
  const { t } = useTranslation();
  const { data } = useDashboard();

  return (
    <div style={{ overflow: 'auto', flex: 1, padding: 'var(--spacing-lg)' }}>
      <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
        <KpiCard
          icon={<Clock size={18} />}
          label={t('projects.dashboard.hoursThisWeek')}
          value={formatNumber(data?.hoursThisWeek ?? 0, 1) + 'h'}
          subtitle={t('projects.dashboard.tracked')}
          iconColor="#f59e0b"
        />
        <KpiCard
          icon={<FolderKanban size={18} />}
          label={t('projects.dashboard.activeProjects')}
          value={String(data?.activeProjects ?? 0)}
          subtitle={t('projects.dashboard.inProgress')}
          iconColor="#8b5cf6"
        />
        <KpiCard
          icon={<FileText size={18} />}
          label={t('projects.dashboard.outstandingInvoices')}
          value={String(data?.outstandingInvoices ?? 0)}
          subtitle={formatCurrency(data?.totalOutstandingAmount ?? 0)}
          iconColor="#3b82f6"
        />
        <KpiCard
          icon={<DollarSign size={18} />}
          label={t('projects.dashboard.overdue')}
          value={String(data?.overdueInvoices ?? 0)}
          subtitle={formatCurrency(data?.totalOverdueAmount ?? 0)}
          iconColor="var(--color-error)"
        />
      </div>
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

function ProjectsListView({ projects, searchQuery, onSelect, selectedId, onAdd, clients }: {
  projects: Project[];
  searchQuery: string;
  onSelect: (id: string) => void;
  selectedId: string | null;
  onAdd: () => void;
  clients: ProjectClient[];
}) {
  const { t } = useTranslation();
  const [sort, setSort] = useState<SortState | null>(null);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return projects;
    const q = searchQuery.toLowerCase();
    return projects.filter((p) => p.name.toLowerCase().includes(q) || (p.clientName?.toLowerCase().includes(q)));
  }, [projects, searchQuery]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (sort.column) {
        case 'name': aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
        case 'client': aVal = (a.clientName || '').toLowerCase(); bVal = (b.clientName || '').toLowerCase(); break;
        case 'status': aVal = a.status; bVal = b.status; break;
        case 'hours': aVal = a.totalHours; bVal = b.totalHours; break;
        case 'budget': aVal = a.budgetAmount ?? 0; bVal = b.budgetAmount ?? 0; break;
      }
      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sort]);

  const handleSort = useCallback((col: string) => {
    setSort((prev) =>
      !prev || prev.column !== col ? { column: col, direction: 'asc' }
        : prev.direction === 'asc' ? { column: col, direction: 'desc' } : null,
    );
  }, []);

  if (sorted.length === 0 && !searchQuery) {
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

  if (sorted.length === 0 && searchQuery) {
    return (
      <div className="projects-empty-state">
        <FolderKanban size={48} className="projects-empty-state-icon" />
        <div className="projects-empty-state-title">{t('projects.empty.noMatchingProjects')}</div>
        <div className="projects-empty-state-desc">{t('projects.empty.tryDifferentSearch')}</div>
      </div>
    );
  }

  const hdrStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: '8px var(--spacing-lg)',
    borderBottom: '1px solid var(--color-border-secondary)', fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)', flexShrink: 0,
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={hdrStyle}>
          <ColumnHeader label={t('projects.projects.name')} icon={<FolderKanban size={12} />} sortable columnKey="name" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 200, flexShrink: 0 }} />
          <ColumnHeader label={t('projects.invoices.client')} icon={<Users size={12} />} sortable columnKey="client" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 140, flexShrink: 0 }} />
          <ColumnHeader label={t('projects.projects.status')} sortable columnKey="status" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 100, flexShrink: 0 }} />
          <ColumnHeader label={t('projects.reports.hours')} icon={<Clock size={12} />} sortable columnKey="hours" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 80, flexShrink: 0, textAlign: 'right' }} />
          <ColumnHeader label={t('projects.projects.budget')} icon={<DollarSign size={12} />} sortable columnKey="budget" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ flex: 1 }} />
        </div>
        {sorted.map((project) => {
          const budgetPct = project.budgetHours ? Math.min((project.totalHours / project.budgetHours) * 100, 100) : 0;
          return (
            <div
              key={project.id}
              className={`projects-row${selectedId === project.id ? ' selected' : ''}`}
              onClick={() => onSelect(project.id)}
            >
              <span style={{ width: 200, flexShrink: 0, fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8 }}>
                <StatusDot color={project.color} size={8} />
                {project.name}
              </span>
              <span style={{ width: 140, flexShrink: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {project.clientName || '-'}
              </span>
              <span style={{ width: 100, flexShrink: 0 }}>
                <Badge variant={project.status === 'active' ? 'success' : project.status === 'paused' ? 'warning' : project.status === 'completed' ? 'primary' : 'default'}>
                  {t(`projects.status.${project.status}`)}
                </Badge>
              </span>
              <span style={{ width: 80, flexShrink: 0, textAlign: 'right', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>
                {formatNumber(project.totalHours, 1)}h
              </span>
              <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                {project.budgetHours ? (
                  <>
                    <div style={{ flex: 1, height: 6, background: 'var(--color-bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${budgetPct}%`, background: budgetPct > 90 ? 'var(--color-error)' : budgetPct > 70 ? 'var(--color-warning)' : 'var(--color-success)', borderRadius: 3, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                      {formatNumber(budgetPct, 0)}%
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>-</span>
                )}
              </span>
              {selectedId === project.id && <ChevronRight size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />}
            </div>
          );
        })}
        <div className="projects-add-row" onClick={onAdd}>
          <Plus size={14} /> {t('projects.actions.addNew')}
        </div>
      </div>
      <div className="projects-table-footer">
        <span>{sorted.length} {t('projects.sidebar.projects').toLowerCase()}</span>
      </div>
    </div>
  );
}

// ─── Project Detail Panel ─────────────────────────────────────────

function ProjectDetailPanel({ project, onClose }: { project: Project; onClose: () => void }) {
  const { t } = useTranslation();
  const deleteProject = useDeleteProject();
  const updateProject = useUpdateProject();

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

          {project.clientName && (
            <div className="projects-detail-field">
              <span className="projects-detail-field-label">{t('projects.invoices.client')}</span>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                <Users size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                {project.clientName}
              </div>
            </div>
          )}

          <div className="projects-detail-field">
            <span className="projects-detail-field-label">{t('projects.projects.hourlyRate')}</span>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
              {formatCurrency(project.hourlyRate)}/h
            </div>
          </div>

          <div className="projects-detail-field">
            <span className="projects-detail-field-label">{t('projects.reports.hours')}</span>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
              {formatNumber(project.totalHours, 1)}h{project.budgetHours ? ` / ${formatNumber(project.budgetHours, 0)}h` : ''}
            </div>
          </div>

          {project.budgetAmount != null && (
            <div className="projects-detail-field">
              <span className="projects-detail-field-label">{t('projects.projects.budget')}</span>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {formatCurrency(project.totalAmount)} / {formatCurrency(project.budgetAmount)}
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
  const [sort, setSort] = useState<SortState | null>(null);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return clients;
    const q = searchQuery.toLowerCase();
    return clients.filter((c) => c.name.toLowerCase().includes(q) || (c.email?.toLowerCase().includes(q)));
  }, [clients, searchQuery]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (sort.column) {
        case 'name': aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
        case 'email': aVal = (a.email || '').toLowerCase(); bVal = (b.email || '').toLowerCase(); break;
        case 'projects': aVal = a.projectCount; bVal = b.projectCount; break;
        case 'outstanding': aVal = a.outstandingAmount; bVal = b.outstandingAmount; break;
      }
      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sort]);

  const handleSort = useCallback((col: string) => {
    setSort((prev) =>
      !prev || prev.column !== col ? { column: col, direction: 'asc' }
        : prev.direction === 'asc' ? { column: col, direction: 'desc' } : null,
    );
  }, []);

  if (sorted.length === 0 && !searchQuery) {
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

  if (sorted.length === 0 && searchQuery) {
    return (
      <div className="projects-empty-state">
        <Users size={48} className="projects-empty-state-icon" />
        <div className="projects-empty-state-title">{t('projects.empty.noMatchingClients')}</div>
        <div className="projects-empty-state-desc">{t('projects.empty.tryDifferentSearch')}</div>
      </div>
    );
  }

  const hdrStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: '8px var(--spacing-lg)',
    borderBottom: '1px solid var(--color-border-secondary)', fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)', flexShrink: 0,
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={hdrStyle}>
          <ColumnHeader label={t('projects.clients.name')} icon={<Users size={12} />} sortable columnKey="name" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 200, flexShrink: 0 }} />
          <ColumnHeader label={t('projects.clients.email')} icon={<Mail size={12} />} sortable columnKey="email" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 200, flexShrink: 0 }} />
          <ColumnHeader label={t('projects.sidebar.projects')} icon={<FolderKanban size={12} />} sortable columnKey="projects" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 80, flexShrink: 0, textAlign: 'right' }} />
          <ColumnHeader label={t('projects.reports.outstanding')} icon={<DollarSign size={12} />} sortable columnKey="outstanding" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ flex: 1, textAlign: 'right' }} />
        </div>
        {sorted.map((client) => (
          <div
            key={client.id}
            className={`projects-row${selectedId === client.id ? ' selected' : ''}`}
            onClick={() => onSelect(client.id)}
          >
            <span style={{ width: 200, flexShrink: 0, fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {client.name}
            </span>
            <span style={{ width: 200, flexShrink: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {client.email || '-'}
            </span>
            <span style={{ width: 80, flexShrink: 0, textAlign: 'right', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>
              {client.projectCount}
            </span>
            <span style={{ flex: 1, textAlign: 'right', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums', color: client.outstandingAmount > 0 ? 'var(--color-warning)' : 'var(--color-text-tertiary)' }}>
              {formatCurrency(client.outstandingAmount)}
            </span>
            {selectedId === client.id && <ChevronRight size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />}
          </div>
        ))}
        <div className="projects-add-row" onClick={onAdd}>
          <Plus size={14} /> {t('projects.actions.addNew')}
        </div>
      </div>
      <div className="projects-table-footer">
        <span>{sorted.length} {t('projects.sidebar.clients').toLowerCase()}</span>
      </div>
    </div>
  );
}

// ─── Client Detail Panel ──────────────────────────────────────────

function ClientDetailPanel({ client, onClose }: { client: ProjectClient; onClose: () => void }) {
  const { t } = useTranslation();
  const deleteClient = useDeleteClient();

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
          <div className="projects-detail-field">
            <span className="projects-detail-field-label">{t('projects.sidebar.projects')}</span>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
              {client.projectCount}
            </div>
          </div>
          <div className="projects-detail-field">
            <span className="projects-detail-field-label">{t('projects.reports.outstanding')}</span>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: client.outstandingAmount > 0 ? 'var(--color-warning)' : 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
              {formatCurrency(client.outstandingAmount)}
            </div>
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
  const [sort, setSort] = useState<SortState | null>(null);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return invoices;
    const q = searchQuery.toLowerCase();
    return invoices.filter((inv) =>
      inv.invoiceNumber.toLowerCase().includes(q) ||
      (inv.clientName?.toLowerCase().includes(q)),
    );
  }, [invoices, searchQuery]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (sort.column) {
        case 'number': aVal = a.invoiceNumber; bVal = b.invoiceNumber; break;
        case 'client': aVal = (a.clientName || '').toLowerCase(); bVal = (b.clientName || '').toLowerCase(); break;
        case 'amount': aVal = a.total; bVal = b.total; break;
        case 'status': aVal = a.status; bVal = b.status; break;
        case 'date': aVal = a.issueDate; bVal = b.issueDate; break;
      }
      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sort]);

  const handleSort = useCallback((col: string) => {
    setSort((prev) =>
      !prev || prev.column !== col ? { column: col, direction: 'asc' }
        : prev.direction === 'asc' ? { column: col, direction: 'desc' } : null,
    );
  }, []);

  if (sorted.length === 0 && !searchQuery) {
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

  if (sorted.length === 0 && searchQuery) {
    return (
      <div className="projects-empty-state">
        <FileText size={48} className="projects-empty-state-icon" />
        <div className="projects-empty-state-title">{t('projects.empty.noMatchingInvoices')}</div>
        <div className="projects-empty-state-desc">{t('projects.empty.tryDifferentSearch')}</div>
      </div>
    );
  }

  const hdrStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: '8px var(--spacing-lg)',
    borderBottom: '1px solid var(--color-border-secondary)', fontSize: 'var(--font-size-xs)',
    fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)',
    textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)', flexShrink: 0,
  };

  const totalAmount = sorted.reduce((sum, inv) => sum + inv.total, 0);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={hdrStyle}>
          <ColumnHeader label={t('projects.invoices.number')} icon={<Hash size={12} />} sortable columnKey="number" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 120, flexShrink: 0 }} />
          <ColumnHeader label={t('projects.invoices.client')} icon={<Users size={12} />} sortable columnKey="client" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 160, flexShrink: 0 }} />
          <ColumnHeader label={t('projects.invoices.amount')} icon={<DollarSign size={12} />} sortable columnKey="amount" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 120, flexShrink: 0, textAlign: 'right' }} />
          <ColumnHeader label={t('projects.projects.status')} sortable columnKey="status" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 100, flexShrink: 0 }} />
          <ColumnHeader label={t('projects.invoices.issueDate')} icon={<Calendar size={12} />} sortable columnKey="date" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ flex: 1 }} />
        </div>
        {sorted.map((invoice) => (
          <div
            key={invoice.id}
            className={`projects-row${selectedId === invoice.id ? ' selected' : ''}`}
            onClick={() => onSelect(invoice.id)}
          >
            <span style={{ width: 120, flexShrink: 0, fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)' }}>
              {invoice.invoiceNumber}
            </span>
            <span style={{ width: 160, flexShrink: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {invoice.clientName || '-'}
            </span>
            <span style={{ width: 120, flexShrink: 0, textAlign: 'right', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums', color: 'var(--color-text-primary)' }}>
              {formatCurrency(invoice.total)}
            </span>
            <span style={{ width: 100, flexShrink: 0 }}>
              <Badge variant={getInvoiceStatusVariant(invoice.status)}>
                {t(`projects.status.${invoice.status}`)}
              </Badge>
            </span>
            <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
              {formatDate(invoice.issueDate)}
            </span>
            {selectedId === invoice.id && <ChevronRight size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />}
          </div>
        ))}
        <div className="projects-add-row" onClick={onAdd}>
          <Plus size={14} /> {t('projects.actions.addNew')}
        </div>
      </div>
      <div className="projects-table-footer">
        <span>{sorted.length} {t('projects.sidebar.invoices').toLowerCase()}</span>
        <span style={{ marginLeft: 'auto' }}>{t('projects.invoices.total')}: {formatCurrency(totalAmount)}</span>
      </div>
    </div>
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
      case 'projects': return t('projects.sidebar.projects');
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
            label={t('projects.sidebar.projects')}
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
                <ClientDetailPanel client={selectedClient} onClose={() => setSelectedClientId(null)} />
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
