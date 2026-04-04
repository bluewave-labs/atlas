import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { formatDate, formatCurrency } from '../../lib/format';
import {
  Briefcase, Users, Building2, Clock, Plus, Search, Settings2, X,
  ChevronRight, ChevronDown, Trash2, Phone as PhoneIcon, Mail,
  Trophy, XCircle, LayoutGrid, List,
  PhoneCall, CalendarDays, StickyNote, Pencil, AlertTriangle,
  Download, Upload, BarChart3, Zap, Shield, FileSpreadsheet,
  UserPlus, TrendingUp, Merge, Sliders, RotateCcw,
  DollarSign, Calendar, Globe, Tag, User, Target, Eye, FileText, EyeOff,
  Layers, Check, CalendarPlus,
} from 'lucide-react';
import {
  useCompanies, useCreateCompany, useUpdateCompany, useDeleteCompany,
  useContacts, useCreateContact, useUpdateContact, useDeleteContact,
  useStages, useCreateStage,
  useDeals, useCreateDeal, useUpdateDeal, useDeleteDeal,
  useMarkDealWon, useMarkDealLost,
  useActivities, useCreateActivity, useUpdateActivity, useDeleteActivity, useCompleteActivity,
  useActivityTypes, useSeedActivityTypes,
  useSeedCrmData,
  useMyCrmPermission, useCrmPermissions, canAccess,
  type CrmCompany, type CrmContact, type CrmDealStage, type CrmDeal, type CrmActivity,
  type CrmActivityTypeConfig,
} from './hooks';
import { DealKanban } from './components/deal-kanban';
import { FilterBar, applyFilters, type CrmFilter, type FilterColumn } from './components/filter-bar';
import { SavedViews, usePinnedViews, type SavedView } from './components/saved-views';
import { CsvImportModal, exportToCsv, exportToXlsx, exportToJson } from './components/csv-import-modal';
import { CrmDashboard } from './components/dashboard';
import { DashboardCharts } from './components/dashboard-charts';
import { AutomationsView } from './components/automations-view';
import { PermissionsView } from './components/permissions-view';
import { LeadsView } from './components/leads-view';
import { LeadDetailPage } from './components/lead-detail-page';
import { DealDetailPage } from './components/deal-detail-page';
import { LeadFormsView } from './components/lead-forms-view';
import { ForecastView } from './components/forecast-view';
import { MergeContactsModal, MergeCompaniesModal } from './components/merge-modal';
import { NotesSection } from './components/notes-section';
import { EmailTimeline } from './components/email-timeline';
import { AppSidebar, SidebarSection, SidebarItem } from '../../components/layout/app-sidebar';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Modal } from '../../components/ui/modal';
import { Textarea } from '../../components/ui/textarea';
import { IconButton } from '../../components/ui/icon-button';
import { Badge } from '../../components/ui/badge';
import { Chip } from '../../components/ui/chip';
import { SmartButtonBar } from '../../components/shared/SmartButtonBar';
import { PresenceAvatars } from '../../components/shared/presence-avatars';
import { CustomFieldsRenderer } from '../../components/shared/custom-fields-renderer';
import { DataTable, type DataTableColumn, type SortState as DTSortState } from '../../components/ui/data-table';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { ColumnHeader } from '../../components/ui/column-header';
import { FeatureEmptyState } from '../../components/ui/feature-empty-state';
import { StatusDot } from '../../components/ui/status-dot';
import { DetailPanel } from '../../components/ui/detail-panel';
import { ListToolbar } from '../../components/ui/list-toolbar';
import { ContentArea } from '../../components/ui/content-area';
import { Popover, PopoverTrigger, PopoverContent } from '../../components/ui/popover';
import { useUIStore } from '../../stores/ui-store';
import '../../styles/crm.css';

// ─── Activity type icon mapping ──────────────────────────────
const ACTIVITY_TYPE_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  'sticky-note': StickyNote,
  'phone-call': PhoneCall,
  'mail': Mail,
  'calendar-days': CalendarDays,
  'target': Target,
  'trophy': Trophy,
  'x-circle': XCircle,
};

// ─── Table interaction types ──────────────────────────────────

interface EditingCell {
  rowId: string;
  column: string;
}

type SortDirection = 'asc' | 'desc';

interface SortState {
  column: string;
  direction: SortDirection;
}

// ─── Sort header helper (uses shared ColumnHeader) ──────────────

// ─── Inline edit cell helper ──────────────────────────────────

function InlineEditInput({
  value, type, onSave, onCancel,
}: {
  value: string;
  type: 'text' | 'number' | 'date';
  onSave: (val: string) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  return (
    <input
      ref={inputRef}
      type={type}
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') onSave(val);
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => onSave(val)}
      style={{
        width: '100%', padding: '4px 6px', border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)',
        background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', outline: 'none',
        boxSizing: 'border-box',
      }}
    />
  );
}

function InlineSelectCell({
  value, options, onSave, onCancel,
}: {
  value: string;
  options: { value: string; label: string }[];
  onSave: (val: string) => void;
  onCancel: () => void;
}) {
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  return (
    <select
      ref={selectRef}
      value={value}
      onChange={(e) => onSave(e.target.value)}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => onCancel()}
      style={{
        width: '100%', padding: '4px 6px', border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)',
        background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', outline: 'none',
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── Types ─────────────────────────────────────────────────────────

type ActiveView = 'dashboard' | 'leads' | 'lead-detail' | 'pipeline' | 'deals' | 'deal-detail' | 'contacts' | 'companies' | 'activities' | 'automations' | 'permissions' | 'forecast' | 'leadForms';

// ─── Column definitions for filtering ─────────────────────────────

function getDealsFilterColumns(stages: CrmDealStage[], t: (key: string) => string): FilterColumn[] {
  return [
    { key: 'title', label: t('crm.deals.title'), type: 'text' },
    { key: 'companyName', label: t('crm.deals.company'), type: 'text' },
    { key: 'contactName', label: t('crm.deals.contact'), type: 'text' },
    { key: 'value', label: t('crm.deals.value'), type: 'number' },
    { key: 'stageName', label: t('crm.deals.stage'), type: 'select', options: stages.map((s) => ({ value: s.name, label: s.name })) },
    { key: 'expectedCloseDate', label: t('crm.deals.closeDate'), type: 'date' },
  ];
}

function getContactsFilterColumns(t: (key: string) => string): FilterColumn[] {
  return [
    { key: 'name', label: t('crm.contacts.name'), type: 'text' },
    { key: 'email', label: t('crm.contacts.email'), type: 'text' },
    { key: 'phone', label: t('crm.contacts.phone'), type: 'text' },
    { key: 'companyName', label: t('crm.deals.company'), type: 'text' },
    { key: 'position', label: t('crm.contacts.position'), type: 'text' },
  ];
}

function getCompaniesFilterColumns(t: (key: string) => string): FilterColumn[] {
  return [
    { key: 'name', label: t('crm.companies.name'), type: 'text' },
    { key: 'domain', label: t('crm.companies.domain'), type: 'text' },
    { key: 'industry', label: t('crm.companies.industry'), type: 'text' },
    { key: 'size', label: t('crm.companies.size'), type: 'text' },
  ];
}

// CSV export column configs (built with t)
function getDealsCsvColumns(t: (key: string) => string) {
  return [
    { key: 'title', label: t('crm.deals.title') },
    { key: 'value', label: t('crm.deals.value') },
    { key: 'stageName', label: t('crm.deals.stage') },
    { key: 'companyName', label: t('crm.deals.company') },
    { key: 'contactName', label: t('crm.deals.contact') },
    { key: 'probability', label: t('crm.deals.probability') },
    { key: 'expectedCloseDate', label: t('crm.deals.closeDate') },
  ];
}

function getContactsCsvColumns(t: (key: string) => string) {
  return [
    { key: 'name', label: t('crm.contacts.name') },
    { key: 'email', label: t('crm.contacts.email') },
    { key: 'phone', label: t('crm.contacts.phone') },
    { key: 'companyName', label: t('crm.deals.company') },
    { key: 'position', label: t('crm.contacts.position') },
    { key: 'source', label: t('crm.contacts.source') },
  ];
}

function getCompaniesCsvColumns(t: (key: string) => string) {
  return [
    { key: 'name', label: t('crm.companies.name') },
    { key: 'domain', label: t('crm.companies.domain') },
    { key: 'industry', label: t('crm.companies.industry') },
    { key: 'size', label: t('crm.companies.size') },
    { key: 'address', label: t('crm.companies.address') },
    { key: 'phone', label: t('crm.contacts.phone') },
  ];
}

// CSV import field configs (built with t)
function getDealsImportFields(t: (key: string) => string) {
  return [
    { key: 'title', label: t('crm.deals.title'), required: true },
    { key: 'value', label: t('crm.deals.value') },
    { key: 'stage', label: t('crm.deals.stage') },
    { key: 'probability', label: t('crm.deals.probability') },
    { key: 'expectedCloseDate', label: t('crm.deals.closeDate') },
  ];
}

function getContactsImportFields(t: (key: string) => string) {
  return [
    { key: 'name', label: t('crm.contacts.name'), required: true },
    { key: 'email', label: t('crm.contacts.email') },
    { key: 'phone', label: t('crm.contacts.phone') },
    { key: 'position', label: t('crm.contacts.position') },
    { key: 'source', label: t('crm.contacts.source') },
  ];
}

function getCompaniesImportFields(t: (key: string) => string) {
  return [
    { key: 'name', label: t('crm.companies.name'), required: true },
    { key: 'domain', label: t('crm.companies.domain') },
    { key: 'industry', label: t('crm.companies.industry') },
    { key: 'size', label: t('crm.companies.size') },
    { key: 'address', label: t('crm.companies.address') },
    { key: 'phone', label: t('crm.contacts.phone') },
  ];
}

// ─── Helpers ───────────────────────────────────────────────────────

// ─── Avatar colors ────────────────────────────────────────────────

const AVATAR_COLORS = ['#ef4444','#f97316','#f59e0b','#10b981','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#ec4899','#14b8a6'];
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function NameAvatar({ name }: { name: string }) {
  return (
    <span style={{ width: 24, height: 24, borderRadius: '50%', background: getAvatarColor(name), color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function CompanyLogo({ domain }: { domain: string | null | undefined }) {
  if (!domain) return null;
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=16`}
      width={16} height={16}
      style={{ borderRadius: 2, flexShrink: 0 }}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      alt=""
    />
  );
}

// formatDate and formatCurrency are imported from ../../lib/format

function getActivityIcon(type: string) {
  switch (type) {
    case 'call': return <PhoneCall size={14} />;
    case 'email': return <Mail size={14} />;
    case 'meeting': return <CalendarDays size={14} />;
    case 'stage_change': return <Target size={14} />;
    case 'deal_won': return <Trophy size={14} />;
    case 'deal_lost': return <XCircle size={14} />;
    default: return <StickyNote size={14} />;
  }
}

function getActivityLabel(type: string, t: (key: string) => string): string {
  switch (type) {
    case 'call': return t('crm.activities.call');
    case 'email': return t('crm.activities.email');
    case 'meeting': return t('crm.activities.meeting');
    case 'stage_change': return t('crm.activities.stageChange');
    case 'deal_won': return t('crm.activities.dealWon');
    case 'deal_lost': return t('crm.activities.dealLost');
    default: return t('crm.activities.note');
  }
}

type ActivityDueStatus = 'overdue' | 'due-today' | 'due-future' | 'no-date' | 'completed';

function getActivityDueStatus(activity: CrmActivity): ActivityDueStatus {
  if (activity.completedAt) return 'completed';
  if (!activity.scheduledAt) return 'no-date';
  const now = new Date();
  const due = new Date(activity.scheduledAt);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86400000);
  if (due < startOfToday) return 'overdue';
  if (due < endOfToday) return 'due-today';
  return 'due-future';
}

const DUE_STATUS_COLORS: Record<ActivityDueStatus, string> = {
  'overdue': '#ef4444',
  'due-today': '#f59e0b',
  'due-future': '#10b981',
  'no-date': '#6b7280',
  'completed': '#6b7280',
};

function getActivityDueLabel(activity: CrmActivity, t: (key: string, opts?: Record<string, unknown>) => string): string | null {
  const status = getActivityDueStatus(activity);
  if (status === 'completed') return null;
  if (status === 'no-date') return null;
  if (status === 'overdue') {
    const days = Math.ceil((Date.now() - new Date(activity.scheduledAt!).getTime()) / 86400000);
    return t('crm.activities.overdueBy', { days });
  }
  if (status === 'due-today') return t('crm.activities.dueToday');
  const due = new Date(activity.scheduledAt!);
  return t('crm.activities.dueDate') + ': ' + due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getDealRottingInfo(deal: CrmDeal): { isRotting: boolean; daysInStage: number; rottingDays: number | null } {
  const rottingDays = deal.stageRottingDays ?? null;
  if (!rottingDays || !deal.stageEnteredAt) return { isRotting: false, daysInStage: 0, rottingDays };
  const daysInStage = Math.floor((Date.now() - new Date(deal.stageEnteredAt).getTime()) / 86400000);
  return { isRotting: daysInStage > rottingDays, daysInStage, rottingDays };
}

// ─── Create Deal Modal ─────────────────────────────────────────────

function CreateDealModal({
  open, onClose, stages, contacts, companies,
}: {
  open: boolean;
  onClose: () => void;
  stages: CrmDealStage[];
  contacts: CrmContact[];
  companies: CrmCompany[];
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [probability, setProbability] = useState('');
  const [stageId, setStageId] = useState('');
  const [contactId, setContactId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [closeDate, setCloseDate] = useState('');
  const createDeal = useCreateDeal();

  const defaultStage = stages.find((s) => s.isDefault) ?? stages[0];

  useEffect(() => {
    if (open && defaultStage && !stageId) {
      setStageId(defaultStage.id);
    }
  }, [open, defaultStage, stageId]);

  const reset = () => { setTitle(''); setValue(''); setProbability(''); setStageId(''); setContactId(''); setCompanyId(''); setCloseDate(''); };

  const handleSubmit = () => {
    if (!title.trim() || !stageId) return;
    createDeal.mutate({
      title: title.trim(),
      value: Number(value) || 0,
      probability: probability !== '' ? Math.min(100, Math.max(0, Number(probability))) : undefined,
      stageId,
      contactId: contactId || null,
      companyId: companyId || null,
      expectedCloseDate: closeDate || null,
    }, {
      onSuccess: () => { reset(); onClose(); },
    });
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} width={480} title={t('crm.deals.newDeal')}>
      <Modal.Header title={t('crm.deals.newDeal')} subtitle={t('crm.deals.newDealSubtitle')} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <Input label={t('crm.deals.dealTitle')} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enterprise license" autoFocus />
          <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
            <Input label={t('crm.deals.valueAmount')} type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="0" style={{ flex: 1 }} />
            <Input label={t('crm.deals.probabilityPercent')} type="number" value={probability} onChange={(e) => setProbability(e.target.value)} placeholder="0-100" style={{ flex: 1 }} />
          </div>
          <Input label={t('crm.deals.expectedClose')} type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>{t('crm.deals.stage')}</label>
            <Select
              value={stageId}
              onChange={setStageId}
              options={stages.map((s) => ({ value: s.id, label: s.name }))}
              placeholder={t('crm.deals.selectStage')}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>{t('crm.deals.contact')}</label>
              <Select
                value={contactId}
                onChange={setContactId}
                options={[{ value: '', label: t('crm.deals.noneAssigned') }, ...contacts.map((c) => ({ value: c.id, label: c.name }))]}
                placeholder={t('crm.deals.selectContact')}
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>{t('crm.deals.company')}</label>
              <Select
                value={companyId}
                onChange={setCompanyId}
                options={[{ value: '', label: t('crm.deals.noneAssigned') }, ...companies.map((c) => ({ value: c.id, label: c.name }))]}
                placeholder={t('crm.deals.selectCompany')}
              />
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>{t('crm.actions.cancel')}</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!title.trim() || !stageId}>{t('crm.deals.createDeal')}</Button>
      </Modal.Footer>
    </Modal>
  );
}

// ─── Create Contact Modal ──────────────────────────────────────────

function CreateContactModal({
  open, onClose, companies, contacts: existingContacts,
}: {
  open: boolean;
  onClose: () => void;
  companies: CrmCompany[];
  contacts: CrmContact[];
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [position, setPosition] = useState('');
  const createContact = useCreateContact();

  const duplicateContact = useMemo(() => {
    if (!email.trim()) return null;
    return existingContacts.find(
      (c) => c.email && c.email.toLowerCase() === email.trim().toLowerCase()
    ) ?? null;
  }, [email, existingContacts]);

  const reset = () => { setName(''); setEmail(''); setPhone(''); setCompanyId(''); setPosition(''); };

  const handleSubmit = () => {
    if (!name.trim()) return;
    createContact.mutate({
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      companyId: companyId || null,
      position: position.trim() || null,
    }, {
      onSuccess: () => { reset(); onClose(); },
    });
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} width={440} title={t('crm.contacts.newContact')}>
      <Modal.Header title={t('crm.contacts.newContact')} subtitle={t('crm.contacts.newContactSubtitle')} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <Input label={t('crm.contacts.fullName')} value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" autoFocus />
          <div>
            <Input label={t('crm.contacts.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@company.com" />
            {duplicateContact && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-xs)', padding: 'var(--spacing-xs) var(--spacing-sm)', borderRadius: 'var(--radius-sm)', background: 'var(--color-warning-bg, rgba(245, 158, 11, 0.1))' }}>
                <AlertTriangle size={13} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-warning)', fontFamily: 'var(--font-family)' }}>
                  {t('crm.contacts.duplicateEmail', { name: duplicateContact.name })}
                </span>
              </div>
            )}
          </div>
          <Input label={t('crm.contacts.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1-555-0100" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>{t('crm.deals.company')}</label>
            <Select
              value={companyId}
              onChange={setCompanyId}
              options={[{ value: '', label: t('crm.deals.noneAssigned') }, ...companies.map((c) => ({ value: c.id, label: c.name }))]}
              placeholder={t('crm.deals.selectCompany')}
            />
          </div>
          <Input label={t('crm.contacts.position')} value={position} onChange={(e) => setPosition(e.target.value)} placeholder="CTO" />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>{t('crm.actions.cancel')}</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!name.trim()}>{t('crm.contacts.addContact')}</Button>
      </Modal.Footer>
    </Modal>
  );
}

// ─── Create Company Modal ──────────────────────────────────────────

function CreateCompanyModal({
  open, onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [industry, setIndustry] = useState('');
  const [size, setSize] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const createCompany = useCreateCompany();

  const reset = () => { setName(''); setDomain(''); setIndustry(''); setSize(''); setAddress(''); setPhone(''); };

  const handleSubmit = () => {
    if (!name.trim()) return;
    createCompany.mutate({
      name: name.trim(),
      domain: domain.trim() || null,
      industry: industry.trim() || null,
      size: size || null,
      address: address.trim() || null,
      phone: phone.trim() || null,
    }, {
      onSuccess: () => { reset(); onClose(); },
    });
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} width={440} title={t('crm.companies.newCompany')}>
      <Modal.Header title={t('crm.companies.newCompany')} subtitle={t('crm.companies.newCompanySubtitle')} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <Input label={t('crm.companies.companyName')} value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" autoFocus />
          <Input label={t('crm.companies.domain')} value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.com" />
          <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
            <Input label={t('crm.companies.industry')} value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="Technology" style={{ flex: 1 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>{t('crm.companies.size')}</label>
              <Select
                value={size}
                onChange={setSize}
                options={[
                  { value: '', label: t('crm.deals.selectStage') },
                  { value: '1-10', label: '1-10' },
                  { value: '11-50', label: '11-50' },
                  { value: '51-200', label: '51-200' },
                  { value: '201-500', label: '201-500' },
                  { value: '501-1000', label: '501-1000' },
                  { value: '1000+', label: '1000+' },
                ]}
              />
            </div>
          </div>
          <Input label={t('crm.companies.address')} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" />
          <Input label={t('crm.contacts.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1-555-0100" />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>{t('crm.actions.cancel')}</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!name.trim()}>{t('crm.companies.addCompany')}</Button>
      </Modal.Footer>
    </Modal>
  );
}

// ─── Log Activity Modal ────────────────────────────────────────────

function LogActivityModal({
  open, onClose, defaultDealId, defaultContactId, defaultCompanyId,
  deals, contacts, companies,
}: {
  open: boolean;
  onClose: () => void;
  defaultDealId?: string | null;
  defaultContactId?: string | null;
  defaultCompanyId?: string | null;
  deals: CrmDeal[];
  contacts: CrmContact[];
  companies: CrmCompany[];
}) {
  const { t } = useTranslation();
  const [type, setType] = useState('note');
  const [body, setBody] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [assignedUserId, setAssignedUserId] = useState('');
  const [dealId, setDealId] = useState(defaultDealId || '');
  const [contactId, setContactId] = useState(defaultContactId || '');
  const [companyId, setCompanyId] = useState(defaultCompanyId || '');
  const createActivity = useCreateActivity();
  const { data: permData } = useCrmPermissions();
  const teamMembers = permData?.permissions ?? [];

  useEffect(() => {
    setDealId(defaultDealId || '');
    setContactId(defaultContactId || '');
    setCompanyId(defaultCompanyId || '');
  }, [defaultDealId, defaultContactId, defaultCompanyId]);

  const reset = () => { setType('note'); setBody(''); setScheduledAt(''); setAssignedUserId(''); setDealId(''); setContactId(''); setCompanyId(''); };

  const handleSubmit = () => {
    if (!body.trim()) return;
    createActivity.mutate({
      type,
      body: body.trim(),
      dealId: dealId || null,
      contactId: contactId || null,
      companyId: companyId || null,
      assignedUserId: assignedUserId || null,
      scheduledAt: scheduledAt || null,
    }, {
      onSuccess: () => { reset(); onClose(); },
    });
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} width={480} title={t('crm.activities.logActivity')}>
      <Modal.Header title={t('crm.activities.logActivity')} subtitle={t('crm.activities.logActivitySubtitle')} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>{t('crm.activities.type')}</label>
            <Select
              value={type}
              onChange={setType}
              options={[
                { value: 'note', label: t('crm.activities.note') },
                { value: 'call', label: t('crm.activities.call') },
                { value: 'email', label: t('crm.activities.email') },
                { value: 'meeting', label: t('crm.activities.meeting') },
              ]}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>{t('crm.activities.details')}</label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={t('crm.activities.whatHappened')} rows={3} autoFocus />
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>{t('crm.activities.dueDate')}</label>
              <Input type="date" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} size="sm" />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>{t('crm.activities.assignee')}</label>
              <Select value={assignedUserId} onChange={setAssignedUserId} options={[{ value: '', label: t('crm.activities.unassigned') }, ...teamMembers.map((m) => ({ value: m.userId, label: m.userName || m.userEmail }))]} size="sm" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>{t('crm.sidebar.deals')}</label>
              <Select value={dealId} onChange={setDealId} options={[{ value: '', label: t('crm.deals.noneAssigned') }, ...deals.map((d) => ({ value: d.id, label: d.title }))]} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>{t('crm.deals.contact')}</label>
              <Select value={contactId} onChange={setContactId} options={[{ value: '', label: t('crm.deals.noneAssigned') }, ...contacts.map((c) => ({ value: c.id, label: c.name }))]} />
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>{t('crm.actions.cancel')}</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!body.trim()}>{t('crm.activities.logActivity')}</Button>
      </Modal.Footer>
    </Modal>
  );
}

// ─── Mark Lost Modal ───────────────────────────────────────────────

function MarkLostModal({
  open, onClose, dealId,
}: {
  open: boolean;
  onClose: () => void;
  dealId: string;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const markLost = useMarkDealLost();

  const handleSubmit = () => {
    markLost.mutate({ id: dealId, reason: reason.trim() || undefined }, {
      onSuccess: () => { setReason(''); onClose(); },
    });
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} width={400} title={t('crm.deals.markAsLost')}>
      <Modal.Header title={t('crm.deals.markDealAsLost')} subtitle={t('crm.deals.markDealAsLostSubtitle')} />
      <Modal.Body>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('crm.deals.lostReasonPlaceholder')} rows={3} autoFocus />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>{t('crm.actions.cancel')}</Button>
        <Button variant="danger" onClick={handleSubmit}>{t('crm.deals.markAsLost')}</Button>
      </Modal.Footer>
    </Modal>
  );
}

// ─── Activity Timeline ─────────────────────────────────────────────

function ActivityTimeline({ activities }: { activities: CrmActivity[] }) {
  const { t } = useTranslation();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();
  const completeActivity = useCompleteActivity();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState('');
  const [editBody, setEditBody] = useState('');
  const [scheduleNextId, setScheduleNextId] = useState<string | null>(null);
  const [nextType, setNextType] = useState('call');
  const [nextDate, setNextDate] = useState('');
  const [nextNote, setNextNote] = useState('');

  const startEdit = (activity: CrmActivity) => {
    setEditingId(activity.id);
    setEditType(activity.type);
    setEditBody(activity.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditType('');
    setEditBody('');
  };

  const saveEdit = () => {
    if (!editingId || !editBody.trim()) return;
    updateActivity.mutate({ id: editingId, type: editType, body: editBody.trim() }, {
      onSuccess: () => cancelEdit(),
    });
  };

  const handleMarkDone = (activityId: string) => {
    setScheduleNextId(activityId);
    setNextType('call');
    setNextDate('');
    setNextNote('');
  };

  const handleScheduleNext = () => {
    if (!scheduleNextId || !nextDate) return;
    completeActivity.mutate({
      id: scheduleNextId,
      scheduleNext: { type: nextType, body: nextNote.trim() || undefined, scheduledAt: new Date(nextDate).toISOString() },
    }, { onSuccess: () => setScheduleNextId(null) });
  };

  const handleSkipSchedule = () => {
    if (!scheduleNextId) return;
    completeActivity.mutate({ id: scheduleNextId }, { onSuccess: () => setScheduleNextId(null) });
  };

  const setQuickDate = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setNextDate(d.toISOString().split('T')[0]);
  };

  if (activities.length === 0) {
    return (
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', padding: 'var(--spacing-sm) 0' }}>
        {t('crm.activities.noActivities')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {activities.slice(0, 10).map((activity) => (
        <div key={activity.id} className="crm-activity-item" style={{ position: 'relative' }}>
          <div className="crm-activity-icon">
            {getActivityIcon(activity.type)}
          </div>
          {editingId === activity.id ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
              <Select
                value={editType}
                onChange={setEditType}
                options={[
                  { value: 'note', label: t('crm.activities.note') },
                  { value: 'call', label: t('crm.activities.call') },
                  { value: 'email', label: t('crm.activities.email') },
                  { value: 'meeting', label: t('crm.activities.meeting') },
                ]}
                size="sm"
              />
              <Input value={editBody} onChange={(e) => setEditBody(e.target.value)} size="sm" autoFocus />
              <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                <Button variant="primary" size="sm" onClick={saveEdit} disabled={!editBody.trim()}>{t('crm.actions.save')}</Button>
                <Button variant="ghost" size="sm" onClick={cancelEdit}>{t('crm.actions.cancel')}</Button>
              </div>
            </div>
          ) : (
            <div className="crm-activity-body" style={{ flex: 1 }}>
              <div className="crm-activity-text" style={activity.completedAt ? { textDecoration: 'line-through', opacity: 0.6 } : undefined}>{activity.body}</div>
              <div className="crm-activity-meta" style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                <span>{getActivityLabel(activity.type, t)} &middot; {formatDate(activity.createdAt)}{activity.assignedUserName ? ` · ${activity.assignedUserName}` : ''}</span>
                {(() => {
                  const dueStatus = getActivityDueStatus(activity);
                  const dueLabel = getActivityDueLabel(activity, t);
                  if (!dueLabel) return null;
                  return (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 'var(--font-size-xs)', color: DUE_STATUS_COLORS[dueStatus], fontWeight: 'var(--font-weight-medium)' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: DUE_STATUS_COLORS[dueStatus], flexShrink: 0 }} />
                      {dueLabel}
                    </span>
                  );
                })()}
                {activity.completedAt && (
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                    &middot; {t('crm.activities.completedOn', { date: formatDate(activity.completedAt) })}
                  </span>
                )}
              </div>
            </div>
          )}
          {editingId !== activity.id && (
            <div style={{ display: 'flex', gap: 2, flexShrink: 0, alignItems: 'center' }}>
              {!activity.completedAt && (
                <Popover open={scheduleNextId === activity.id} onOpenChange={(o) => { if (!o) setScheduleNextId(null); }}>
                  <PopoverTrigger asChild>
                    <span><IconButton icon={<Check size={12} />} label={t('crm.activities.markDone')} size={24} onClick={() => handleMarkDone(activity.id)} /></span>
                  </PopoverTrigger>
                  <PopoverContent align="end" style={{ width: 280, padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                      {t('crm.activities.scheduleNext')}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                      {t('crm.activities.scheduleNextSubtitle')}
                    </div>
                    <Select value={nextType} onChange={setNextType} options={[
                      { value: 'call', label: t('crm.activities.call') },
                      { value: 'email', label: t('crm.activities.email') },
                      { value: 'meeting', label: t('crm.activities.meeting') },
                      { value: 'note', label: t('crm.activities.note') },
                    ]} size="sm" />
                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                      <Button variant={nextDate === new Date(Date.now() + 86400000).toISOString().split('T')[0] ? 'primary' : 'secondary'} size="sm" onClick={() => setQuickDate(1)} style={{ flex: 1 }}>{t('crm.activities.tomorrow')}</Button>
                      <Button variant={nextDate === new Date(Date.now() + 604800000).toISOString().split('T')[0] ? 'primary' : 'secondary'} size="sm" onClick={() => setQuickDate(7)} style={{ flex: 1 }}>{t('crm.activities.nextWeek')}</Button>
                    </div>
                    <Input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} size="sm" />
                    <Input value={nextNote} onChange={(e) => setNextNote(e.target.value)} placeholder={t('crm.activities.optionalNote')} size="sm" />
                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', justifyContent: 'flex-end' }}>
                      <Button variant="ghost" size="sm" onClick={handleSkipSchedule}>{t('crm.activities.skip')}</Button>
                      <Button variant="primary" size="sm" onClick={handleScheduleNext} disabled={!nextDate}>{t('crm.activities.schedule')}</Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              <IconButton icon={<Pencil size={12} />} label={t('crm.activities.editActivity')} size={24} onClick={() => startEdit(activity)} />
              <IconButton icon={<Trash2 size={12} />} label={t('crm.activities.deleteActivity')} size={24} destructive onClick={() => deleteActivity.mutate(activity.id)} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Deal Detail Panel ─────────────────────────────────────────────

function DealDetailPanel({
  deal, stages, onClose, onMarkWon, onMarkLost, onContactClick, onCompanyClick,
}: {
  deal: CrmDeal;
  stages: CrmDealStage[];
  onClose: () => void;
  onMarkWon: () => void;
  onMarkLost: () => void;
  onContactClick?: (contactId: string) => void;
  onCompanyClick?: (companyId: string) => void;
}) {
  const { t } = useTranslation();
  const [stageId, setStageId] = useState(deal.stageId);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  const { data: activitiesData } = useActivities({ dealId: deal.id });
  const activities = activitiesData?.activities ?? [];

  useEffect(() => {
    setStageId(deal.stageId);
  }, [deal.id, deal.stageId]);

  return (
    <div className="crm-detail-panel">
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('crm.deals.deleteDeal')}
        description={t('crm.confirm.deleteDeal', { name: deal.title })}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={() => { deleteDeal.mutate(deal.id); onClose(); }}
      />
      <div style={{
        padding: '12px var(--spacing-lg)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-family)' }}>
          {t('crm.deals.dealDetail')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <PresenceAvatars appId="crm" recordId={deal.id} />
          <IconButton icon={<Trash2 size={14} />} label={t('crm.deals.deleteDeal')} size={28} destructive onClick={() => setShowDeleteConfirm(true)} />
          <IconButton icon={<X size={14} />} label={t('common.close')} size={28} onClick={onClose} />
        </div>
      </div>

      <SmartButtonBar appId="crm" recordId={deal.id} />

      <div className="crm-detail-body">
        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
          {deal.title}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          <div className="crm-detail-field">
            <span className="crm-detail-field-label">{t('crm.deals.value')}</span>
            <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
              {formatCurrency(deal.value)}
            </div>
          </div>

          <div className="crm-detail-field">
            <span className="crm-detail-field-label">{t('crm.deals.stage')}</span>
            <Select
              value={stageId}
              onChange={(v) => {
                setStageId(v);
                updateDeal.mutate({ id: deal.id, stageId: v });
              }}
              options={stages.map((s) => ({
                value: s.id,
                label: s.name,
                icon: <StatusDot color={s.color} size={8} />,
              }))}
              size="sm"
            />
          </div>

          {deal.companyName && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.deals.company')}</span>
              <div
                style={{ fontSize: 'var(--font-size-sm)', color: deal.companyId && onCompanyClick ? 'var(--color-accent-primary)' : 'var(--color-text-primary)', fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: deal.companyId && onCompanyClick ? 'pointer' : 'default' }}
                onClick={() => { if (deal.companyId && onCompanyClick) onCompanyClick(deal.companyId); }}
              >
                <Building2 size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                {deal.companyName}
              </div>
            </div>
          )}

          {deal.contactName && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.deals.contact')}</span>
              <div
                style={{ fontSize: 'var(--font-size-sm)', color: deal.contactId && onContactClick ? 'var(--color-accent-primary)' : 'var(--color-text-primary)', fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', cursor: deal.contactId && onContactClick ? 'pointer' : 'default' }}
                onClick={() => { if (deal.contactId && onContactClick) onContactClick(deal.contactId); }}
              >
                <Users size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                {deal.contactName}
              </div>
            </div>
          )}

          <div className="crm-detail-field">
            <span className="crm-detail-field-label">{t('crm.deals.probability')}</span>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
              {deal.probability}%
            </div>
          </div>

          {deal.expectedCloseDate && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.deals.expectedClose')}</span>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {formatDate(deal.expectedCloseDate)}
              </div>
            </div>
          )}

          {deal.wonAt && (
            <Badge variant="success">{t('crm.deals.wonOn')} {formatDate(deal.wonAt)}</Badge>
          )}
          {deal.lostAt && (
            <div>
              <Badge variant="error">{t('crm.deals.lostOn')} {formatDate(deal.lostAt)}</Badge>
              {deal.lostReason && (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', marginTop: 'var(--spacing-xs)' }}>
                  {deal.lostReason}
                </div>
              )}
            </div>
          )}

          {!deal.wonAt && !deal.lostAt && (
            <div className="crm-deal-action-buttons">
              <Button variant="primary" size="sm" icon={<Trophy size={14} />} onClick={onMarkWon}>
                {t('crm.deals.markWon')}
              </Button>
              <Button variant="danger" size="sm" icon={<XCircle size={14} />} onClick={onMarkLost}>
                {t('crm.deals.markLost')}
              </Button>
            </div>
          )}
        </div>

        {/* Activities */}
        <div style={{ marginTop: 'var(--spacing-lg)', borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-lg)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--spacing-sm)', fontFamily: 'var(--font-family)' }}>
            {t('crm.sidebar.activities')}
          </div>
          <ActivityTimeline activities={activities} />
        </div>

        {/* Emails */}
        <div style={{ marginTop: 'var(--spacing-lg)', borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-lg)' }}>
          <EmailTimeline dealId={deal.id} />
        </div>

        {/* Notes */}
        <div style={{ marginTop: 'var(--spacing-lg)', borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-lg)' }}>
          <NotesSection dealId={deal.id} />
        </div>
      </div>
    </div>
  );
}

// ─── Contact Detail Panel ──────────────────────────────────────────

function ContactDetailPanel({
  contact, deals, onClose, onCompanyClick, onDealClick,
}: {
  contact: CrmContact;
  deals: CrmDeal[];
  onClose: () => void;
  onCompanyClick?: (companyId: string) => void;
  onDealClick?: (dealId: string) => void;
}) {
  const { t } = useTranslation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const { data: activitiesData } = useActivities({ contactId: contact.id });
  const activities = activitiesData?.activities ?? [];
  const contactDeals = deals.filter((d) => d.contactId === contact.id);

  return (
    <div className="crm-detail-panel">
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('crm.contacts.deleteContact')}
        description={t('crm.confirm.deleteContact', { name: contact.name })}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={() => { deleteContact.mutate(contact.id); onClose(); }}
      />
      <div style={{
        padding: '12px var(--spacing-lg)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-family)' }}>
          {t('crm.contacts.contactDetail')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <PresenceAvatars appId="crm" recordId={contact.id} />
          <IconButton icon={<Trash2 size={14} />} label={t('crm.contacts.deleteContact')} size={28} destructive onClick={() => setShowDeleteConfirm(true)} />
          <IconButton icon={<X size={14} />} label={t('common.close')} size={28} onClick={onClose} />
        </div>
      </div>

      <SmartButtonBar appId="crm" recordId={contact.id} />

      <div className="crm-detail-body">
        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
          {contact.name}
        </div>
        {contact.position && (
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', marginTop: -8 }}>
            {contact.position}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          {contact.email && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.contacts.email')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                <Mail size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                {contact.email}
              </div>
            </div>
          )}

          {contact.phone && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.contacts.phone')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                <PhoneIcon size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                {contact.phone}
              </div>
            </div>
          )}

          {contact.companyName && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.deals.company')}</span>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: contact.companyId && onCompanyClick ? 'var(--color-accent-primary)' : 'var(--color-text-primary)', fontFamily: 'var(--font-family)', cursor: contact.companyId && onCompanyClick ? 'pointer' : 'default' }}
                onClick={() => { if (contact.companyId && onCompanyClick) onCompanyClick(contact.companyId); }}
              >
                <Building2 size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                {contact.companyName}
              </div>
            </div>
          )}

          {contact.source && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.contacts.source')}</span>
              <Chip>{contact.source}</Chip>
            </div>
          )}
        </div>

        {/* Linked deals */}
        {contactDeals.length > 0 && (
          <div style={{ marginTop: 'var(--spacing-sm)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--spacing-sm)', fontFamily: 'var(--font-family)' }}>
              {t('crm.sidebar.deals')} ({contactDeals.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {contactDeals.map((deal) => (
                <div key={deal.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px var(--spacing-sm)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-secondary)',
                  fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)',
                  cursor: onDealClick ? 'pointer' : 'default',
                }}
                  onClick={() => { if (onDealClick) onDealClick(deal.id); }}
                >
                  <span style={{ color: onDealClick ? 'var(--color-accent-primary)' : 'var(--color-text-primary)' }}>{deal.title}</span>
                  <span style={{ color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(deal.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <CustomFieldsRenderer appId="crm" recordType="contacts" recordId={contact.id} />

        {/* Activities */}
        <div style={{ marginTop: 'var(--spacing-lg)', borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-lg)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--spacing-sm)', fontFamily: 'var(--font-family)' }}>
            {t('crm.sidebar.activities')}
          </div>
          <ActivityTimeline activities={activities} />
        </div>

        {/* Emails */}
        <div style={{ marginTop: 'var(--spacing-lg)', borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-lg)' }}>
          <EmailTimeline contactId={contact.id} defaultTo={contact.email || undefined} />
        </div>

        {/* Notes */}
        <div style={{ marginTop: 'var(--spacing-lg)', borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-lg)' }}>
          <NotesSection contactId={contact.id} />
        </div>
      </div>
    </div>
  );
}

// ─── Company Detail Panel ──────────────────────────────────────────

function CompanyDetailPanel({
  company, contacts, deals, onClose, onContactClick, onDealClick,
}: {
  company: CrmCompany;
  contacts: CrmContact[];
  deals: CrmDeal[];
  onClose: () => void;
  onContactClick?: (contactId: string) => void;
  onDealClick?: (dealId: string) => void;
}) {
  const { t } = useTranslation();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteCompany = useDeleteCompany();
  const { data: activitiesData } = useActivities({ companyId: company.id });
  const activities = activitiesData?.activities ?? [];
  const companyContacts = contacts.filter((c) => c.companyId === company.id);
  const companyDeals = deals.filter((d) => d.companyId === company.id);

  return (
    <div className="crm-detail-panel">
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('crm.companies.deleteCompany')}
        description={t('crm.confirm.deleteCompany', { name: company.name })}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={() => { deleteCompany.mutate(company.id); onClose(); }}
      />
      <div style={{
        padding: '12px var(--spacing-lg)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-family)' }}>
          {t('crm.companies.companyDetail')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <PresenceAvatars appId="crm" recordId={company.id} />
          <IconButton icon={<Trash2 size={14} />} label={t('crm.companies.deleteCompany')} size={28} destructive onClick={() => setShowDeleteConfirm(true)} />
          <IconButton icon={<X size={14} />} label={t('common.close')} size={28} onClick={onClose} />
        </div>
      </div>

      <SmartButtonBar appId="crm" recordId={company.id} />

      <div className="crm-detail-body">
        <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
          {company.name}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          {company.domain && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.companies.domain')}</span>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {company.domain}
              </div>
            </div>
          )}

          {company.industry && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.companies.industry')}</span>
              <Chip>{company.industry}</Chip>
            </div>
          )}

          {company.size && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.companies.size')}</span>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {company.size} {t('crm.companies.employees')}
              </div>
            </div>
          )}

          {company.address && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.companies.address')}</span>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {company.address}
              </div>
            </div>
          )}

          {company.phone && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.contacts.phone')}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                <PhoneIcon size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                {company.phone}
              </div>
            </div>
          )}
        </div>

        {/* Contacts */}
        {companyContacts.length > 0 && (
          <div style={{ marginTop: 'var(--spacing-sm)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--spacing-sm)', fontFamily: 'var(--font-family)' }}>
              {t('crm.sidebar.contacts')} ({companyContacts.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {companyContacts.map((contact) => (
                <div key={contact.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px var(--spacing-sm)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-secondary)',
                  fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)',
                  cursor: onContactClick ? 'pointer' : 'default',
                }}
                  onClick={() => { if (onContactClick) onContactClick(contact.id); }}
                >
                  <span style={{ color: onContactClick ? 'var(--color-accent-primary)' : 'var(--color-text-primary)' }}>{contact.name}</span>
                  <span style={{ color: 'var(--color-text-tertiary)' }}>{contact.position || ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Deals */}
        {companyDeals.length > 0 && (
          <div style={{ marginTop: 'var(--spacing-sm)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--spacing-sm)', fontFamily: 'var(--font-family)' }}>
              {t('crm.sidebar.deals')} ({companyDeals.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {companyDeals.map((deal) => (
                <div key={deal.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px var(--spacing-sm)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-secondary)',
                  fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)',
                  cursor: onDealClick ? 'pointer' : 'default',
                }}
                  onClick={() => { if (onDealClick) onDealClick(deal.id); }}
                >
                  <span style={{ color: onDealClick ? 'var(--color-accent-primary)' : 'var(--color-text-primary)' }}>{deal.title}</span>
                  <span style={{ color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(deal.value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity */}
        <div style={{ marginTop: 'var(--spacing-sm)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--spacing-sm)', fontFamily: 'var(--font-family)' }}>
            {t('crm.sidebar.activities')}
          </div>
          <ActivityTimeline activities={activities} />
        </div>

        {/* Notes */}
        <div style={{ marginTop: 'var(--spacing-lg)', borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-lg)' }}>
          <NotesSection companyId={company.id} />
        </div>
      </div>
    </div>
  );
}

// ─── Deals List View ───────────────────────────────────────────────

function DealsListView({
  deals, stages, selectedId, onSelect, searchQuery,
  selectedIds, onSelectionChange, focusedIndex, onFocusedIndexChange,
  editingCell, onEditingCellChange, sort, onSortChange,
  companies, onAdd, canEdit = true, groupBy = null,
}: {
  deals: CrmDeal[];
  stages: CrmDealStage[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  focusedIndex: number | null;
  onFocusedIndexChange: (idx: number | null) => void;
  editingCell: EditingCell | null;
  onEditingCellChange: (cell: EditingCell | null) => void;
  sort: SortState | null;
  onSortChange: (sort: SortState | null) => void;
  companies: CrmCompany[];
  onAdd: () => void;
  canEdit?: boolean;
  groupBy?: string | null;
}) {
  const { t } = useTranslation();
  const updateDeal = useUpdateDeal();

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return deals;
    const q = searchQuery.toLowerCase();
    return deals.filter((d) =>
      d.title.toLowerCase().includes(q) ||
      (d.companyName?.toLowerCase().includes(q)) ||
      (d.contactName?.toLowerCase().includes(q)),
    );
  }, [deals, searchQuery]);

  const companyDomainMap = useMemo(() => {
    const map = new Map<string, string>();
    companies.forEach((c) => { if (c.domain) map.set(c.id, c.domain); });
    return map;
  }, [companies]);

  const handleCellClick = (rowId: string, column: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    onEditingCellChange({ rowId, column });
  };

  const handleSave = (dealId: string, column: string, value: string) => {
    const updates: Record<string, unknown> = { id: dealId };
    switch (column) {
      case 'title': updates.title = value; break;
      case 'value': updates.value = Number(value) || 0; break;
      case 'stage': updates.stageId = value; break;
      case 'closeDate': updates.expectedCloseDate = value || null; break;
    }
    updateDeal.mutate(updates as Parameters<typeof updateDeal.mutate>[0]);
    onEditingCellChange(null);
  };

  if (filtered.length === 0) {
    if (searchQuery) {
      return (
        <div className="crm-empty-state">
          <Briefcase size={48} className="crm-empty-state-icon" />
          <div className="crm-empty-state-title">{t('crm.empty.noMatchingDeals')}</div>
          <div className="crm-empty-state-desc">{t('crm.empty.tryDifferentSearch')}</div>
        </div>
      );
    }
    return (
      <FeatureEmptyState
        illustration="pipeline"
        title={t('crm.empty.pipelineTitle')}
        description={t('crm.empty.pipelineDesc')}
        highlights={[
          { icon: <LayoutGrid size={14} />, title: t('crm.empty.pipelineH1Title'), description: t('crm.empty.pipelineH1Desc') },
          { icon: <BarChart3 size={14} />, title: t('crm.empty.pipelineH2Title'), description: t('crm.empty.pipelineH2Desc') },
          { icon: <Target size={14} />, title: t('crm.empty.pipelineH3Title'), description: t('crm.empty.pipelineH3Desc') },
        ]}
        actionLabel={t('crm.empty.createDeal')}
        actionIcon={<Plus size={14} />}
        onAction={onAdd}
      />
    );
  }

  const isEd = (dealId: string, col: string) => editingCell?.rowId === dealId && editingCell?.column === col;

  const dealColumns: DataTableColumn<CrmDeal>[] = [
    {
      key: 'title', label: t('crm.deals.title'), icon: <Briefcase size={12} />, width: 180, sortable: true,
      render: (deal) => isEd(deal.id, 'title') ? (
        <InlineEditInput value={deal.title} type="text" onSave={(v) => handleSave(deal.id, 'title', v)} onCancel={() => onEditingCellChange(null)} />
      ) : (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', cursor: 'text' }} onClick={(e) => handleCellClick(deal.id, 'title', e)}>
          <NameAvatar name={deal.title} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{deal.title}</span>
        </span>
      ),
      compare: (a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()),
    },
    {
      key: 'company', label: t('crm.deals.company'), icon: <Building2 size={12} />, width: 130, sortable: true,
      render: (deal) => (
        <span className="dt-cell-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {deal.companyId && <CompanyLogo domain={companyDomainMap.get(deal.companyId)} />}
          {deal.companyName || '-'}
        </span>
      ),
      compare: (a, b) => (a.companyName || '').localeCompare(b.companyName || ''),
    },
    {
      key: 'contact', label: t('crm.deals.contact'), icon: <Users size={12} />, width: 110, sortable: true,
      render: (deal) => <span className="dt-cell-secondary">{deal.contactName || '-'}</span>,
      compare: (a, b) => (a.contactName || '').localeCompare(b.contactName || ''),
    },
    {
      key: 'value', label: t('crm.deals.value'), icon: <DollarSign size={12} />, width: 100, sortable: true, align: 'right',
      render: (deal) => isEd(deal.id, 'value') ? (
        <InlineEditInput value={String(deal.value)} type="number" onSave={(v) => handleSave(deal.id, 'value', v)} onCancel={() => onEditingCellChange(null)} />
      ) : (
        <span style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-sm)', fontVariantNumeric: 'tabular-nums', cursor: 'text' }} onClick={(e) => handleCellClick(deal.id, 'value', e)}>
          {formatCurrency(deal.value)}
        </span>
      ),
    },
    {
      key: 'stage', label: t('crm.deals.stage'), icon: <LayoutGrid size={12} />, width: 100, sortable: true,
      render: (deal) => isEd(deal.id, 'stage') ? (
        <InlineSelectCell value={deal.stageId} options={stages.map((s) => ({ value: s.id, label: s.name }))} onSave={(v) => handleSave(deal.id, 'stage', v)} onCancel={() => onEditingCellChange(null)} />
      ) : (
        <span style={{ cursor: 'pointer' }} onClick={(e) => handleCellClick(deal.id, 'stage', e)}>
          {deal.stageName && <Badge variant="default"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><StatusDot color={deal.stageColor || '#6b7280'} size={6} />{deal.stageName}</span></Badge>}
        </span>
      ),
      compare: (a, b) => (a.stageName || '').localeCompare(b.stageName || ''),
    },
    {
      key: 'closeDate', label: t('crm.deals.closeDate'), icon: <Calendar size={12} />, width: 100, sortable: true,
      render: (deal) => isEd(deal.id, 'closeDate') ? (
        <InlineEditInput value={deal.expectedCloseDate || ''} type="date" onSave={(v) => handleSave(deal.id, 'closeDate', v)} onCancel={() => onEditingCellChange(null)} />
      ) : (
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', cursor: 'text' }} onClick={(e) => handleCellClick(deal.id, 'closeDate', e)}>
          {deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : '-'}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      data={filtered}
      columns={dealColumns}
      selectable
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      sort={sort}
      onSortChange={onSortChange}
      activeRowId={selectedId}
      onRowClick={(deal) => { if (!editingCell) onSelect(deal.id); }}
      onAddRow={onAdd}
      addRowLabel={t('crm.actions.addNew')}
      aggregations={[
        { label: t('crm.deals.total'), compute: (rows) => formatCurrency(rows.reduce((s, d) => s + d.value, 0)) },
        { label: t('crm.deals.avg'), compute: (rows) => formatCurrency(Math.round(rows.reduce((s, d) => s + d.value, 0) / (rows.length || 1))), style: { color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-normal)' } },
        { label: t('crm.deals.avgProbability'), compute: (rows) => `${rows.length ? Math.round(rows.reduce((s, d) => s + (d.probability ?? 0), 0) / rows.length) : 0}%`, style: { color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-normal)' } },
      ]}
      groupBy={groupBy ? (deal) => {
        switch (groupBy) {
          case 'stage': return deal.stageName || 'No stage';
          case 'contact': return deal.contactName || 'No contact';
          case 'company': return deal.companyName || 'No company';
          default: return 'Other';
        }
      } : undefined}
      emptyTitle={t('crm.empty.noMatchingDeals')}
    />
  );
}

// ─── Contacts List View ────────────────────────────────────────────

function ContactsListView({
  contacts, selectedId, onSelect, searchQuery,
  selectedIds, onSelectionChange, focusedIndex, onFocusedIndexChange,
  editingCell, onEditingCellChange, sort, onSortChange,
  companies, onAdd, canEdit = true, groupBy = null,
}: {
  contacts: CrmContact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  focusedIndex: number | null;
  onFocusedIndexChange: (idx: number | null) => void;
  editingCell: EditingCell | null;
  onEditingCellChange: (cell: EditingCell | null) => void;
  sort: SortState | null;
  onSortChange: (sort: SortState | null) => void;
  companies: CrmCompany[];
  onAdd: () => void;
  groupBy?: string | null;
  canEdit?: boolean;
}) {
  const { t } = useTranslation();
  const updateContact = useUpdateContact();

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.email?.toLowerCase().includes(q)) ||
      (c.companyName?.toLowerCase().includes(q)),
    );
  }, [contacts, searchQuery]);

  const companyDomainMap = useMemo(() => {
    const map = new Map<string, string>();
    companies.forEach((c) => { if (c.domain) map.set(c.id, c.domain); });
    return map;
  }, [companies]);

  const handleCellClick = (rowId: string, column: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    onEditingCellChange({ rowId, column });
  };

  const handleSave = (contactId: string, column: string, value: string) => {
    const updates: Record<string, unknown> = { id: contactId };
    switch (column) {
      case 'name': updates.name = value; break;
      case 'email': updates.email = value || null; break;
      case 'phone': updates.phone = value || null; break;
      case 'position': updates.position = value || null; break;
    }
    updateContact.mutate(updates as Parameters<typeof updateContact.mutate>[0]);
    onEditingCellChange(null);
  };

  if (filtered.length === 0) {
    if (searchQuery) {
      return (
        <div className="crm-empty-state">
          <Users size={48} className="crm-empty-state-icon" />
          <div className="crm-empty-state-title">{t('crm.empty.noMatchingContacts')}</div>
          <div className="crm-empty-state-desc">{t('crm.empty.tryDifferentSearch')}</div>
        </div>
      );
    }
    return (
      <FeatureEmptyState
        illustration="contacts"
        title={t('crm.empty.contactsTitle')}
        description={t('crm.empty.contactsDesc')}
        highlights={[
          { icon: <Users size={14} />, title: t('crm.empty.contactsH1Title'), description: t('crm.empty.contactsH1Desc') },
          { icon: <Mail size={14} />, title: t('crm.empty.contactsH2Title'), description: t('crm.empty.contactsH2Desc') },
          { icon: <TrendingUp size={14} />, title: t('crm.empty.contactsH3Title'), description: t('crm.empty.contactsH3Desc') },
        ]}
        actionLabel={t('crm.empty.addContact')}
        actionIcon={<Plus size={14} />}
        onAction={onAdd}
      />
    );
  }

  const isEd = (cId: string, col: string) => editingCell?.rowId === cId && editingCell?.column === col;

  const contactColumns: DataTableColumn<CrmContact>[] = [
    {
      key: 'name', label: t('crm.contacts.name'), icon: <User size={12} />, width: 160, sortable: true,
      render: (c) => isEd(c.id, 'name') ? (
        <InlineEditInput value={c.name} type="text" onSave={(v) => handleSave(c.id, 'name', v)} onCancel={() => onEditingCellChange(null)} />
      ) : (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', cursor: 'text' }} onClick={(e) => handleCellClick(c.id, 'name', e)}>
          <NameAvatar name={c.name} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
        </span>
      ),
    },
    {
      key: 'email', label: t('crm.contacts.email'), icon: <Mail size={12} />, width: 170, sortable: true,
      render: (c) => isEd(c.id, 'email') ? (
        <InlineEditInput value={c.email || ''} type="text" onSave={(v) => handleSave(c.id, 'email', v)} onCancel={() => onEditingCellChange(null)} />
      ) : (
        <span className="dt-cell-secondary" style={{ cursor: 'text' }} onClick={(e) => handleCellClick(c.id, 'email', e)}>{c.email || '-'}</span>
      ),
    },
    {
      key: 'phone', label: t('crm.contacts.phone'), icon: <PhoneIcon size={12} />, width: 120, sortable: true,
      render: (c) => isEd(c.id, 'phone') ? (
        <InlineEditInput value={c.phone || ''} type="text" onSave={(v) => handleSave(c.id, 'phone', v)} onCancel={() => onEditingCellChange(null)} />
      ) : (
        <span className="dt-cell-secondary" style={{ cursor: 'text' }} onClick={(e) => handleCellClick(c.id, 'phone', e)}>{c.phone || '-'}</span>
      ),
    },
    {
      key: 'company', label: t('crm.deals.company'), icon: <Building2 size={12} />, width: 130, sortable: true,
      render: (c) => (
        <span className="dt-cell-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {c.companyId && <CompanyLogo domain={companyDomainMap.get(c.companyId)} />}
          {c.companyName || '-'}
        </span>
      ),
      compare: (a, b) => (a.companyName || '').localeCompare(b.companyName || ''),
    },
    {
      key: 'position', label: t('crm.contacts.position'), icon: <Briefcase size={12} />, width: 130, sortable: true,
      render: (c) => isEd(c.id, 'position') ? (
        <InlineEditInput value={c.position || ''} type="text" onSave={(v) => handleSave(c.id, 'position', v)} onCancel={() => onEditingCellChange(null)} />
      ) : (
        <span className="dt-cell-secondary" style={{ cursor: 'text' }} onClick={(e) => handleCellClick(c.id, 'position', e)}>{c.position || '-'}</span>
      ),
    },
  ];

  return (
    <DataTable
      data={filtered}
      columns={contactColumns}
      selectable
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      sort={sort}
      onSortChange={onSortChange}
      activeRowId={selectedId}
      onRowClick={(c) => { if (!editingCell) onSelect(c.id); }}
      onAddRow={onAdd}
      addRowLabel={t('crm.actions.addNew')}
      emptyTitle={t('crm.empty.noMatchingContacts')}
    />
  );
}

// ─── Companies List View ───────────────────────────────────────────

function CompaniesListView({
  companies, selectedId, onSelect, searchQuery,
  selectedIds, onSelectionChange, focusedIndex, onFocusedIndexChange,
  editingCell, onEditingCellChange, sort, onSortChange,
  onAdd, canEdit = true, groupBy = null,
}: {
  companies: CrmCompany[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  focusedIndex: number | null;
  onFocusedIndexChange: (idx: number | null) => void;
  editingCell: EditingCell | null;
  onEditingCellChange: (cell: EditingCell | null) => void;
  sort: SortState | null;
  onSortChange: (sort: SortState | null) => void;
  onAdd: () => void;
  canEdit?: boolean;
  groupBy?: string | null;
}) {
  const { t } = useTranslation();
  const updateCompany = useUpdateCompany();

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return companies;
    const q = searchQuery.toLowerCase();
    return companies.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.domain?.toLowerCase().includes(q)) ||
      (c.industry?.toLowerCase().includes(q)),
    );
  }, [companies, searchQuery]);

  const handleCellClick = (rowId: string, column: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) return;
    onEditingCellChange({ rowId, column });
  };

  const handleSave = (companyId: string, column: string, value: string) => {
    const updates: Record<string, unknown> = { id: companyId };
    switch (column) {
      case 'name': updates.name = value; break;
      case 'domain': updates.domain = value || null; break;
      case 'industry': updates.industry = value || null; break;
    }
    updateCompany.mutate(updates as Parameters<typeof updateCompany.mutate>[0]);
    onEditingCellChange(null);
  };

  if (filtered.length === 0) {
    if (searchQuery) {
      return (
        <div className="crm-empty-state">
          <Building2 size={48} className="crm-empty-state-icon" />
          <div className="crm-empty-state-title">{t('crm.empty.noMatchingCompanies')}</div>
          <div className="crm-empty-state-desc">{t('crm.empty.tryDifferentSearch')}</div>
        </div>
      );
    }
    return (
      <FeatureEmptyState
        illustration="contacts"
        title={t('crm.empty.companiesTitle')}
        description={t('crm.empty.companiesDesc')}
        highlights={[
          { icon: <Building2 size={14} />, title: t('crm.empty.companiesH1Title'), description: t('crm.empty.companiesH1Desc') },
          { icon: <Globe size={14} />, title: t('crm.empty.companiesH2Title'), description: t('crm.empty.companiesH2Desc') },
          { icon: <Users size={14} />, title: t('crm.empty.companiesH3Title'), description: t('crm.empty.companiesH3Desc') },
        ]}
        actionLabel={t('crm.empty.addCompany')}
        actionIcon={<Plus size={14} />}
        onAction={onAdd}
      />
    );
  }

  const isEd = (cId: string, col: string) => editingCell?.rowId === cId && editingCell?.column === col;

  const companyColumns: DataTableColumn<CrmCompany>[] = [
    {
      key: 'name', label: t('crm.companies.name'), icon: <Building2 size={12} />, width: 160, sortable: true,
      render: (c) => isEd(c.id, 'name') ? (
        <InlineEditInput value={c.name} type="text" onSave={(v) => handleSave(c.id, 'name', v)} onCancel={() => onEditingCellChange(null)} />
      ) : (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', cursor: 'text' }} onClick={(e) => handleCellClick(c.id, 'name', e)}>
          <CompanyLogo domain={c.domain} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
        </span>
      ),
    },
    {
      key: 'domain', label: t('crm.companies.domain'), icon: <Globe size={12} />, width: 150, sortable: true,
      render: (c) => isEd(c.id, 'domain') ? (
        <InlineEditInput value={c.domain || ''} type="text" onSave={(v) => handleSave(c.id, 'domain', v)} onCancel={() => onEditingCellChange(null)} />
      ) : (
        <span className="dt-cell-secondary" style={{ cursor: 'text' }} onClick={(e) => handleCellClick(c.id, 'domain', e)}>{c.domain || '-'}</span>
      ),
    },
    {
      key: 'industry', label: t('crm.companies.industry'), icon: <Tag size={12} />, width: 120, sortable: true,
      render: (c) => isEd(c.id, 'industry') ? (
        <InlineEditInput value={c.industry || ''} type="text" onSave={(v) => handleSave(c.id, 'industry', v)} onCancel={() => onEditingCellChange(null)} />
      ) : (
        <span style={{ cursor: 'text' }} onClick={(e) => handleCellClick(c.id, 'industry', e)}>
          {c.industry ? <Chip>{c.industry}</Chip> : <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>-</span>}
        </span>
      ),
    },
    {
      key: 'size', label: t('crm.companies.size'), icon: <Users size={12} />, width: 80, sortable: true,
      render: (c) => <span className="dt-cell-secondary">{c.size || '-'}</span>,
    },
    {
      key: 'stats', label: t('crm.companies.contactsDeals'),
      render: (c) => (
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
          {c.contactCount} {t('crm.sidebar.contacts').toLowerCase()} &middot; {c.dealCount} {t('crm.sidebar.deals').toLowerCase()}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      data={filtered}
      columns={companyColumns}
      selectable
      selectedIds={selectedIds}
      onSelectionChange={onSelectionChange}
      sort={sort}
      onSortChange={onSortChange}
      activeRowId={selectedId}
      onRowClick={(c) => { if (!editingCell) onSelect(c.id); }}
      onAddRow={onAdd}
      addRowLabel={t('crm.actions.addNew')}
      emptyTitle={t('crm.empty.noMatchingCompanies')}
    />
  );
}

// ─── Activities List View ──────────────────────────────────────────

function ActivitiesListView({
  activities, searchQuery,
}: {
  activities: CrmActivity[];
  searchQuery: string;
}) {
  const { t } = useTranslation();
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return activities;
    const q = searchQuery.toLowerCase();
    return activities.filter((a) =>
      a.body.toLowerCase().includes(q) ||
      a.type.toLowerCase().includes(q),
    );
  }, [activities, searchQuery]);

  if (filtered.length === 0) {
    return (
      <div className="crm-empty-state">
        <Clock size={48} className="crm-empty-state-icon" />
        <div className="crm-empty-state-title">{searchQuery ? t('crm.empty.noMatchingActivities') : t('crm.activities.noActivities')}</div>
        <div className="crm-empty-state-desc">{searchQuery ? t('crm.empty.tryDifferentSearch') : t('crm.empty.logFirstActivity')}</div>
      </div>
    );
  }

  // Group by date
  const grouped = useMemo(() => {
    const map: Record<string, CrmActivity[]> = {};
    for (const a of filtered) {
      const date = formatDate(a.createdAt);
      if (!map[date]) map[date] = [];
      map[date].push(a);
    }
    return Object.entries(map);
  }, [filtered]);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-lg)' }}>
      {grouped.map(([date, items]) => (
        <div key={date} style={{ marginBottom: 'var(--spacing-xl)' }}>
          <div style={{
            fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em',
            marginBottom: 'var(--spacing-sm)', fontFamily: 'var(--font-family)',
          }}>
            {date}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((activity) => (
              <div key={activity.id} className="crm-activity-item">
                <div className="crm-activity-icon">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="crm-activity-body">
                  <div className="crm-activity-text">{activity.body}</div>
                  <div className="crm-activity-meta">
                    {getActivityLabel(activity.type, t)} &middot; {new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main CRM Page ─────────────────────────────────────────────────

export function CrmPage() {
  const { t } = useTranslation();
  const { openSettings } = useUIStore();

  // Permissions
  const { data: myPermission } = useMyCrmPermission();
  const myRole = myPermission?.role ?? 'admin'; // Default admin for backward compat

  // Navigation
  // URL-based routing for sidebar views
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = (searchParams.get('view') || 'dashboard') as ActiveView;
  const activeView = viewParam;
  const setActiveView = useCallback((view: ActiveView) => {
    setSearchParams({ view }, { replace: true });
  }, [setSearchParams]);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Multi-select & table interaction state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [sort, setSort] = useState<SortState | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [bulkStageId, setBulkStageId] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState<CrmFilter[]>([]);
  const pendingViewRef = useRef<SavedView | null>(null);

  // Grouping
  const [groupBy, setGroupBy] = useState<string | null>(null);

  // Import/export modals
  const [showImportModal, setShowImportModal] = useState(false);

  // Modals
  const [showCreateDeal, setShowCreateDeal] = useState(false);
  const [showCreateContact, setShowCreateContact] = useState(false);
  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [showLogActivity, setShowLogActivity] = useState(false);
  const [markLostDealId, setMarkLostDealId] = useState<string | null>(null);
  const [showMergeContacts, setShowMergeContacts] = useState(false);
  const [showMergeCompanies, setShowMergeCompanies] = useState(false);

  // Data
  const { data: companiesData } = useCompanies();
  const companies = companiesData?.companies ?? [];

  const { data: contactsData } = useContacts();
  const contacts = contactsData?.contacts ?? [];

  const { data: stagesData, isLoading: loadingStages } = useStages();
  const stages = stagesData?.stages ?? [];

  const { data: dealsData, isLoading: loadingDeals } = useDeals();
  const deals = dealsData?.deals ?? [];

  const { data: activitiesData } = useActivities();
  const activities = activitiesData?.activities ?? [];

  // Pinned saved views for sidebar
  const pinnedDealViews = usePinnedViews('deals');
  const pinnedContactViews = usePinnedViews('contacts');
  const pinnedCompanyViews = usePinnedViews('companies');

  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  const deleteContact = useDeleteContact();
  const deleteCompany = useDeleteCompany();
  const markWon = useMarkDealWon();
  const seedCrm = useSeedCrmData();

  // Auto-seed on first visit
  const hasSeeded = useRef(false);
  useEffect(() => {
    if (
      !loadingStages &&
      !loadingDeals &&
      stages.length === 0 &&
      deals.length === 0 &&
      companies.length === 0 &&
      !hasSeeded.current
    ) {
      hasSeeded.current = true;
      seedCrm.mutate();
    }
  }, [loadingStages, loadingDeals, stages.length, deals.length, companies.length, seedCrm]);

  // Selected entities
  const selectedDeal = selectedDealId ? deals.find((d) => d.id === selectedDealId) : null;
  const selectedContact = selectedContactId ? contacts.find((c) => c.id === selectedContactId) : null;
  const selectedCompany = selectedCompanyId ? companies.find((c) => c.id === selectedCompanyId) : null;

  // Close selection on view change — but if a saved view is pending, apply its filters instead of clearing
  useEffect(() => {
    setSelectedDealId(null);
    setSelectedContactId(null);
    setSelectedCompanyId(null);
    setSearchQuery('');
    setShowSearch(false);
    setSelectedIds(new Set());
    setFocusedIndex(null);
    setEditingCell(null);

    setGroupBy(null);

    const pending = pendingViewRef.current;
    if (pending) {
      setFilters(pending.filters);
      if (pending.sortColumn) {
        setSort({ column: pending.sortColumn, direction: pending.sortDirection });
      } else {
        setSort(null);
      }
      pendingViewRef.current = null;
    } else {
      setSort(null);
      setFilters([]);
    }
  }, [activeView]);

  // Filter column definitions (memoized)
  const dealsFilterColumns = useMemo(() => getDealsFilterColumns(stages, t), [stages, t]);
  const contactsFilterColumns = useMemo(() => getContactsFilterColumns(t), [t]);
  const companiesFilterColumns = useMemo(() => getCompaniesFilterColumns(t), [t]);

  // Filtered data (applying advanced filters)
  const filteredDeals = useMemo(
    () => applyFilters(deals as unknown as Record<string, unknown>[], filters, dealsFilterColumns) as unknown as CrmDeal[],
    [deals, filters, dealsFilterColumns],
  );
  const filteredContacts = useMemo(
    () => applyFilters(contacts as unknown as Record<string, unknown>[], filters, contactsFilterColumns) as unknown as CrmContact[],
    [contacts, filters, contactsFilterColumns],
  );
  const filteredCompanies = useMemo(
    () => applyFilters(companies as unknown as Record<string, unknown>[], filters, companiesFilterColumns) as unknown as CrmCompany[],
    [companies, filters, companiesFilterColumns],
  );

  // Apply saved view handler
  const handleApplyView = useCallback((view: SavedView) => {
    setFilters(view.filters);
    if (view.sortColumn) {
      setSort({ column: view.sortColumn, direction: view.sortDirection });
    } else {
      setSort(null);
    }
  }, []);

  // Export handler
  const handleExport = useCallback((format: 'csv' | 'xlsx' | 'json' = 'csv') => {
    const now = new Date().toISOString().slice(0, 10);
    const exportFn = format === 'xlsx' ? exportToXlsx : format === 'json' ? exportToJson : exportToCsv;
    switch (activeView) {
      case 'deals':
        exportFn(filteredDeals as unknown as Record<string, unknown>[], getDealsCsvColumns(t), `crm-deals-${now}`);
        break;
      case 'contacts':
        exportFn(filteredContacts as unknown as Record<string, unknown>[], getContactsCsvColumns(t), `crm-contacts-${now}`);
        break;
      case 'companies':
        exportFn(filteredCompanies as unknown as Record<string, unknown>[], getCompaniesCsvColumns(t), `crm-companies-${now}`);
        break;
    }
  }, [activeView, filteredDeals, filteredContacts, filteredCompanies, t]);

  // Import fields for current entity type
  const importEntityType = activeView === 'deals' ? 'deals' : activeView === 'contacts' ? 'contacts' : 'companies';
  const importFields = activeView === 'deals' ? getDealsImportFields(t) : activeView === 'contacts' ? getContactsImportFields(t) : getCompaniesImportFields(t);

  // Current filter columns based on view
  const currentFilterColumns = useMemo(() => {
    switch (activeView) {
      case 'deals': return dealsFilterColumns;
      case 'contacts': return contactsFilterColumns;
      case 'companies': return companiesFilterColumns;
      default: return [];
    }
  }, [activeView, dealsFilterColumns, contactsFilterColumns, companiesFilterColumns]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showSearch) {
          setShowSearch(false);
          setSearchQuery('');
        } else if (selectedDealId || selectedContactId || selectedCompanyId) {
          setSelectedDealId(null);
          setSelectedContactId(null);
          setSelectedCompanyId(null);
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
  }, [selectedDealId, selectedContactId, selectedCompanyId, showSearch]);

  // Section title
  const sectionTitle = useMemo(() => {
    switch (activeView) {
      case 'dashboard': return t('crm.sidebar.dashboard');
      case 'leads': return 'Leads';
      case 'pipeline': return t('crm.sidebar.pipeline');
      case 'deals': return t('crm.sidebar.deals');
      case 'contacts': return t('crm.sidebar.contacts');
      case 'companies': return t('crm.sidebar.companies');
      case 'activities': return t('crm.sidebar.activities');
      case 'automations': return t('crm.sidebar.automations');
      case 'permissions': return t('crm.sidebar.permissions');
      case 'forecast': return 'Forecast';
      case 'leadForms': return t('crm.leadForms.title');
    }
  }, [activeView, t]);

  // Add button
  const handleAdd = () => {
    switch (activeView) {
      case 'pipeline':
      case 'deals':
        setShowCreateDeal(true);
        break;
      case 'contacts':
        setShowCreateContact(true);
        break;
      case 'companies':
        setShowCreateCompany(true);
        break;
      case 'activities':
        setShowLogActivity(true);
        break;
    }
  };

  const addButtonLabel = useMemo(() => {
    switch (activeView) {
      case 'dashboard':
        return t('crm.deals.newDeal');
      case 'pipeline':
      case 'deals':
        return t('crm.deals.newDeal');
      case 'contacts':
        return t('crm.contacts.newContact');
      case 'companies':
        return t('crm.companies.newCompany');
      case 'activities':
        return t('crm.activities.logActivity');
      case 'permissions':
      case 'automations':
      case 'leads':
      case 'forecast':
      case 'leadForms':
        return '';
    }
  }, [activeView, t]);

  // Kanban handlers
  const handleMoveDeal = useCallback((dealId: string, newStageId: string) => {
    const stage = stages.find((s) => s.id === newStageId);
    updateDeal.mutate({
      id: dealId,
      stageId: newStageId,
      probability: stage?.probability ?? 0,
    });
  }, [stages, updateDeal]);

  const handleDealClick = useCallback((dealId: string) => {
    setSearchParams({ view: 'deal-detail', dealId }, { replace: true });
  }, [setSearchParams]);

  // Bulk actions
  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (activeView === 'deals') {
      ids.forEach((id) => deleteDeal.mutate(id));
    } else if (activeView === 'contacts') {
      ids.forEach((id) => deleteContact.mutate(id));
    } else if (activeView === 'companies') {
      ids.forEach((id) => deleteCompany.mutate(id));
    }
    setSelectedIds(new Set());
    setShowBulkDeleteConfirm(false);
  }, [selectedIds, activeView, deleteDeal, deleteContact, deleteCompany]);

  const handleBulkStageChange = useCallback((stageId: string) => {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => updateDeal.mutate({ id, stageId }));
    setBulkStageId(null);
  }, [selectedIds, updateDeal]);

  // Has detail panel
  const hasDetailPanel = !!(
    (activeView === 'pipeline' && selectedDeal) ||
    (activeView === 'deals' && selectedDeal) ||
    (activeView === 'contacts' && selectedContact) ||
    (activeView === 'companies' && selectedCompany)
  );

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <AppSidebar
        storageKey="atlas_crm_sidebar"
        title={t('crm.title')}
        footer={
          <SidebarItem
            label={t('crm.sidebar.settings')}
            icon={<Settings2 size={14} />}
            onClick={() => openSettings('crm')}
          />
        }
      >
        <SidebarSection>
          <SidebarItem
            label={t('crm.sidebar.dashboard')}
            icon={<BarChart3 size={14} />}
            iconColor="#f97316"
            isActive={activeView === 'dashboard'}
            onClick={() => setActiveView('dashboard')}
          />
          <SidebarItem
            label="Leads"
            icon={<UserPlus size={14} />}
            iconColor="#ec4899"
            isActive={activeView === 'leads' || activeView === 'lead-detail'}
            onClick={() => setActiveView('leads')}
          />
          <SidebarItem
            label={t('crm.sidebar.pipeline')}
            icon={<LayoutGrid size={14} />}
            iconColor="#8b5cf6"
            isActive={activeView === 'pipeline'}
            onClick={() => setActiveView('pipeline')}
          />
          <SidebarItem
            label={t('crm.sidebar.deals')}
            icon={<List size={14} />}
            iconColor="#3b82f6"
            isActive={activeView === 'deals' || activeView === 'deal-detail'}
            count={deals.length}
            onClick={() => setActiveView('deals')}
          />
          {pinnedDealViews.map((v) => (
            <SidebarItem
              key={v.id}
              label={v.name}
              icon={<Eye size={12} />}
              isActive={false}
              onClick={() => {
                if (activeView === 'deals') {
                  handleApplyView(v);
                } else {
                  pendingViewRef.current = v;
                  setActiveView('deals');
                }
              }}
              style={{ paddingLeft: 'var(--spacing-xl)' }}
            />
          ))}
        </SidebarSection>

        <SidebarSection>
          <SidebarItem
            label={t('crm.sidebar.contacts')}
            icon={<Users size={14} />}
            iconColor="#10b981"
            isActive={activeView === 'contacts'}
            count={contacts.length}
            onClick={() => setActiveView('contacts')}
          />
          {pinnedContactViews.map((v) => (
            <SidebarItem
              key={v.id}
              label={v.name}
              icon={<Eye size={12} />}
              isActive={false}
              onClick={() => {
                if (activeView === 'contacts') {
                  handleApplyView(v);
                } else {
                  pendingViewRef.current = v;
                  setActiveView('contacts');
                }
              }}
              style={{ paddingLeft: 'var(--spacing-xl)' }}
            />
          ))}
          <SidebarItem
            label={t('crm.sidebar.companies')}
            icon={<Building2 size={14} />}
            iconColor="#06b6d4"
            isActive={activeView === 'companies'}
            count={companies.length}
            onClick={() => setActiveView('companies')}
          />
          {pinnedCompanyViews.map((v) => (
            <SidebarItem
              key={v.id}
              label={v.name}
              icon={<Eye size={12} />}
              isActive={false}
              onClick={() => {
                if (activeView === 'companies') {
                  handleApplyView(v);
                } else {
                  pendingViewRef.current = v;
                  setActiveView('companies');
                }
              }}
              style={{ paddingLeft: 'var(--spacing-xl)' }}
            />
          ))}
        </SidebarSection>

        <SidebarSection>
          <SidebarItem
            label="Forecast"
            icon={<TrendingUp size={14} />}
            iconColor="#6366f1"
            isActive={activeView === 'forecast'}
            onClick={() => setActiveView('forecast')}
          />
          {canAccess(myRole, 'activities', 'view') && (
            <SidebarItem
              label={t('crm.sidebar.activities')}
              icon={<Clock size={14} />}
              iconColor="#f59e0b"
              isActive={activeView === 'activities'}
              onClick={() => setActiveView('activities')}
            />
          )}
          {canAccess(myRole, 'workflows', 'view') && (
            <SidebarItem
              label={t('crm.sidebar.automations')}
              icon={<Zap size={14} />}
              iconColor="#ef4444"
              isActive={activeView === 'automations'}
              onClick={() => setActiveView('automations')}
            />
          )}
          {myRole === 'admin' && (
            <SidebarItem
              label={t('crm.sidebar.permissions')}
              icon={<Shield size={14} />}
              iconColor="#6b7280"
              isActive={activeView === 'permissions'}
              onClick={() => setActiveView('permissions')}
            />
          )}
          <SidebarItem
            label={t('crm.sidebar.leadForms')}
            icon={<FileText size={14} />}
            iconColor="#14b8a6"
            isActive={activeView === 'leadForms'}
            onClick={() => setActiveView('leadForms')}
          />
        </SidebarSection>
      </AppSidebar>

      {/* Main content */}
      <ContentArea
        title={sectionTitle ?? ''}
        actions={
          activeView !== 'dashboard' && activeView !== 'automations' && activeView !== 'permissions' ? (
            <>
              <IconButton
                icon={<Search size={14} />}
                label={t('crm.actions.search')}
                size={28}
                active={showSearch}
                onClick={() => {
                  setShowSearch(!showSearch);
                  if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50);
                }}
              />
              {((activeView === 'pipeline' || activeView === 'deals') && canAccess(myRole, 'deals', 'create')) ||
               (activeView === 'contacts' && canAccess(myRole, 'contacts', 'create')) ||
               (activeView === 'companies' && canAccess(myRole, 'companies', 'create')) ||
               (activeView === 'activities' && canAccess(myRole, 'activities', 'create'))
                ? (
                  <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={handleAdd}>
                    {addButtonLabel}
                  </Button>
                ) : null}
            </>
          ) : undefined
        }
      >
        {/* Search bar */}
        {showSearch && (
          <div className="crm-search-bar">
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('crm.actions.search')}
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

        {/* Toolbar (for deals, contacts, companies) */}
        {(activeView === 'deals' || activeView === 'contacts' || activeView === 'companies') && (
          <ListToolbar
            actions={
              <>
                <Button variant="ghost" size="sm" icon={<Upload size={13} />} onClick={() => setShowImportModal(true)}>
                  {t('crm.actions.import')}
                </Button>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" icon={<Download size={13} />}>
                      {t('crm.actions.export')}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" style={{ padding: 'var(--spacing-xs)', minWidth: 130 }}>
                    {(['csv', 'xlsx', 'json'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => handleExport(fmt)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
                          width: '100%', padding: '6px var(--spacing-sm)',
                          background: 'transparent', border: 'none', borderRadius: 'var(--radius-sm)',
                          color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)',
                          fontFamily: 'var(--font-family)', cursor: 'pointer', textAlign: 'left',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <FileSpreadsheet size={13} style={{ color: 'var(--color-text-tertiary)' }} />
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </PopoverContent>
                </Popover>
              </>
            }
          >
            <SavedViews
              entityType={importEntityType as 'deals' | 'contacts' | 'companies'}
              currentFilters={filters}
              currentSort={sort}
              onApplyView={handleApplyView}
            />
            <ListToolbar.Separator />
            {/* Group by dropdown */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={groupBy ? 'secondary' : 'ghost'} size="sm" icon={<Layers size={13} />}>
                  {t('crm.list.groupBy')}{groupBy ? `: ${groupBy}` : ''}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" style={{ padding: 'var(--spacing-xs)', minWidth: 150 }}>
                {[
                  { value: null, label: t('crm.list.noGrouping') },
                  ...(activeView === 'deals' ? [
                    { value: 'stage', label: t('crm.deals.groupByStage') },
                    { value: 'contact', label: t('crm.deals.groupByContact') },
                    { value: 'company', label: t('crm.deals.groupByCompany') },
                  ] : activeView === 'contacts' ? [
                    { value: 'company', label: t('crm.contacts.groupByCompany') },
                  ] : [
                    { value: 'industry', label: t('crm.companies.groupByIndustry') },
                  ]),
                ].map((opt) => (
                  <button
                    key={opt.value ?? 'none'}
                    onClick={() => setGroupBy(opt.value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
                      width: '100%', padding: '6px var(--spacing-sm)',
                      background: groupBy === opt.value ? 'var(--color-surface-selected)' : 'transparent',
                      border: 'none', borderRadius: 'var(--radius-sm)',
                      color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)',
                      fontFamily: 'var(--font-family)', cursor: 'pointer', textAlign: 'left',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = groupBy === opt.value ? 'var(--color-surface-selected)' : 'transparent'; }}
                  >
                    {opt.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            <ListToolbar.Separator />
            <FilterBar
              columns={currentFilterColumns}
              filters={filters}
              onFiltersChange={setFilters}
            />
          </ListToolbar>
        )}

        {/* Content area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {activeView === 'dashboard' && (
              <div style={{ overflow: 'auto', flex: 1 }}>
                <CrmDashboard />
                <div style={{ padding: '0 var(--spacing-xl) var(--spacing-xl)' }}>
                  <DashboardCharts />
                </div>
              </div>
            )}

            {activeView === 'leads' && (
              <LeadsView />
            )}

            {activeView === 'lead-detail' && searchParams.get('leadId') && (
              <LeadDetailPage
                leadId={searchParams.get('leadId')!}
                onBack={() => setActiveView('leads')}
                onNavigate={(leadId) => setSearchParams({ view: 'lead-detail', leadId }, { replace: true })}
              />
            )}

            {activeView === 'deal-detail' && searchParams.get('dealId') && (
              <DealDetailPage
                dealId={searchParams.get('dealId')!}
                onBack={() => setActiveView('deals')}
                onNavigate={(dealId) => setSearchParams({ view: 'deal-detail', dealId }, { replace: true })}
              />
            )}

            {activeView === 'leadForms' && (
              <LeadFormsView />
            )}

            {activeView === 'forecast' && (
              <ForecastView />
            )}

            {activeView === 'pipeline' && (
              <DealKanban
                deals={deals}
                stages={stages}
                onMoveDeal={handleMoveDeal}
                onDealClick={handleDealClick}
              />
            )}

            {activeView === 'deals' && (
              <DealsListView
                deals={filteredDeals}
                stages={stages}
                selectedId={selectedDealId}
                onSelect={handleDealClick}
                searchQuery={searchQuery}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                focusedIndex={focusedIndex}
                onFocusedIndexChange={setFocusedIndex}
                editingCell={editingCell}
                onEditingCellChange={setEditingCell}
                sort={sort}
                onSortChange={setSort}
                companies={companies}
                onAdd={() => setShowCreateDeal(true)}
                canEdit={canAccess(myRole, 'deals', 'update')}
                groupBy={groupBy}
              />
            )}

            {activeView === 'contacts' && (
              <ContactsListView
                contacts={filteredContacts}
                selectedId={selectedContactId}
                onSelect={(id) => { setSelectedContactId(id); setSelectedDealId(null); setSelectedCompanyId(null); }}
                searchQuery={searchQuery}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                focusedIndex={focusedIndex}
                onFocusedIndexChange={setFocusedIndex}
                editingCell={editingCell}
                onEditingCellChange={setEditingCell}
                sort={sort}
                onSortChange={setSort}
                companies={companies}
                onAdd={() => setShowCreateContact(true)}
                canEdit={canAccess(myRole, 'contacts', 'update')}
                groupBy={groupBy}
              />
            )}

            {activeView === 'companies' && (
              <CompaniesListView
                companies={filteredCompanies}
                selectedId={selectedCompanyId}
                onSelect={(id) => { setSelectedCompanyId(id); setSelectedDealId(null); setSelectedContactId(null); }}
                searchQuery={searchQuery}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                focusedIndex={focusedIndex}
                onFocusedIndexChange={setFocusedIndex}
                editingCell={editingCell}
                onEditingCellChange={setEditingCell}
                sort={sort}
                onSortChange={setSort}
                onAdd={() => setShowCreateCompany(true)}
                canEdit={canAccess(myRole, 'companies', 'update')}
                groupBy={groupBy}
              />
            )}

            {activeView === 'activities' && (
              <ActivitiesListView
                activities={activities}
                searchQuery={searchQuery}
              />
            )}

            {activeView === 'automations' && (
              <AutomationsView stages={stages} />
            )}

            {activeView === 'permissions' && (
              <PermissionsView />
            )}
          </div>

          {/* Slide-out detail drawer */}
          {hasDetailPanel && (
            <div className="crm-drawer-backdrop" onClick={() => { setSelectedDealId(null); setSelectedContactId(null); setSelectedCompanyId(null); }} />
          )}
          <div className={`crm-drawer-container${hasDetailPanel ? ' open' : ''}`}>
            {(activeView === 'pipeline' || activeView === 'deals') && selectedDeal && (
              <DealDetailPanel
                deal={selectedDeal}
                stages={stages}
                onClose={() => setSelectedDealId(null)}
                onMarkWon={() => markWon.mutate(selectedDeal.id)}
                onMarkLost={() => setMarkLostDealId(selectedDeal.id)}
                onContactClick={(contactId) => { setActiveView('contacts'); setSelectedContactId(contactId); setSelectedDealId(null); setSelectedCompanyId(null); }}
                onCompanyClick={(companyId) => { setActiveView('companies'); setSelectedCompanyId(companyId); setSelectedDealId(null); setSelectedContactId(null); }}
              />
            )}
            {activeView === 'contacts' && selectedContact && (
              <ContactDetailPanel
                contact={selectedContact}
                deals={deals}
                onClose={() => setSelectedContactId(null)}
                onCompanyClick={(companyId) => { setActiveView('companies'); setSelectedCompanyId(companyId); setSelectedContactId(null); setSelectedDealId(null); }}
                onDealClick={(dealId) => { setActiveView('deals'); setSelectedDealId(dealId); setSelectedContactId(null); setSelectedCompanyId(null); }}
              />
            )}
            {activeView === 'companies' && selectedCompany && (
              <CompanyDetailPanel
                company={selectedCompany}
                contacts={contacts}
                deals={deals}
                onClose={() => setSelectedCompanyId(null)}
                onContactClick={(contactId) => { setActiveView('contacts'); setSelectedContactId(contactId); setSelectedCompanyId(null); setSelectedDealId(null); }}
                onDealClick={(dealId) => { setActiveView('deals'); setSelectedDealId(dealId); setSelectedCompanyId(null); setSelectedContactId(null); }}
              />
            )}
          </div>
        </div>
      </ContentArea>

      {/* Floating bulk action bar */}
      {selectedIds.size > 0 && (activeView === 'deals' || activeView === 'contacts' || activeView === 'companies') && (
        <div className="crm-bulk-bar">
          <span className="crm-bulk-bar-count">{t('common.selected', { count: selectedIds.size })}</span>
          {activeView === 'deals' && (
            <Select
              value={bulkStageId || ''}
              onChange={(v) => { if (v) handleBulkStageChange(v); }}
              options={[{ value: '', label: t('crm.deals.changeStage') }, ...stages.map((s) => ({ value: s.id, label: s.name }))]}
              size="sm"
              width={150}
            />
          )}
          {selectedIds.size === 2 && activeView === 'contacts' && (
            <Button variant="secondary" size="sm" onClick={() => setShowMergeContacts(true)}>
              <Merge size={14} style={{ marginRight: 4 }} />
              Merge
            </Button>
          )}
          {selectedIds.size === 2 && activeView === 'companies' && (
            <Button variant="secondary" size="sm" onClick={() => setShowMergeCompanies(true)}>
              <Merge size={14} style={{ marginRight: 4 }} />
              Merge
            </Button>
          )}
          {((activeView === 'deals' && canAccess(myRole, 'deals', 'delete')) ||
            (activeView === 'contacts' && canAccess(myRole, 'contacts', 'delete')) ||
            (activeView === 'companies' && canAccess(myRole, 'companies', 'delete'))) && (
            <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setShowBulkDeleteConfirm(true)}>
              {t('crm.actions.delete')}
            </Button>
          )}
          <IconButton icon={<X size={14} />} label={t('crm.deals.clearSelection')} size={24} onClick={() => setSelectedIds(new Set())} />
        </div>
      )}

      {/* Bulk delete confirmation */}
      <ConfirmDialog
        open={showBulkDeleteConfirm}
        onOpenChange={setShowBulkDeleteConfirm}
        title={t('crm.bulk.deleteTitle', { count: selectedIds.size })}
        description={t('crm.bulk.deleteDescription')}
        confirmLabel={t('crm.actions.delete')}
        onConfirm={handleBulkDelete}
        destructive
      />

      {/* Modals */}
      <CreateDealModal
        open={showCreateDeal}
        onClose={() => setShowCreateDeal(false)}
        stages={stages}
        contacts={contacts}
        companies={companies}
      />
      <CreateContactModal
        open={showCreateContact}
        onClose={() => setShowCreateContact(false)}
        companies={companies}
        contacts={contacts}
      />
      <CreateCompanyModal
        open={showCreateCompany}
        onClose={() => setShowCreateCompany(false)}
      />
      <LogActivityModal
        open={showLogActivity}
        onClose={() => setShowLogActivity(false)}
        deals={deals}
        contacts={contacts}
        companies={companies}
      />
      {markLostDealId && (
        <MarkLostModal
          open={!!markLostDealId}
          onClose={() => setMarkLostDealId(null)}
          dealId={markLostDealId}
        />
      )}
      {(activeView === 'deals' || activeView === 'contacts' || activeView === 'companies') && (
        <CsvImportModal
          open={showImportModal}
          onClose={() => setShowImportModal(false)}
          entityType={importEntityType as 'deals' | 'contacts' | 'companies'}
          fields={importFields}
        />
      )}

      {/* Merge modals */}
      {(() => {
        const selectedArr = Array.from(selectedIds);
        if (showMergeContacts && selectedArr.length === 2) {
          const cA = contacts.find((c) => c.id === selectedArr[0]) ?? null;
          const cB = contacts.find((c) => c.id === selectedArr[1]) ?? null;
          return (
            <MergeContactsModal
              open={showMergeContacts}
              onClose={() => { setShowMergeContacts(false); setSelectedIds(new Set()); }}
              contactA={cA}
              contactB={cB}
            />
          );
        }
        if (showMergeCompanies && selectedArr.length === 2) {
          const cA = companies.find((c) => c.id === selectedArr[0]) ?? null;
          const cB = companies.find((c) => c.id === selectedArr[1]) ?? null;
          return (
            <MergeCompaniesModal
              open={showMergeCompanies}
              onClose={() => { setShowMergeCompanies(false); setSelectedIds(new Set()); }}
              companyA={cA}
              companyB={cB}
            />
          );
        }
        return null;
      })()}
    </div>
  );
}
