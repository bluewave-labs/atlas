import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Briefcase, Users, Building2, Clock, Plus, Search, Settings2, X,
  ChevronRight, Trash2, Phone as PhoneIcon, Mail,
  Trophy, XCircle, LayoutGrid, List,
  PhoneCall, CalendarDays, StickyNote,
  Download, Upload, BarChart3, Zap, Shield,
  UserPlus, TrendingUp, Merge,
  DollarSign, Calendar, Globe, Tag, User,
} from 'lucide-react';
import {
  useCompanies, useCreateCompany, useUpdateCompany, useDeleteCompany,
  useContacts, useCreateContact, useUpdateContact, useDeleteContact,
  useStages, useCreateStage,
  useDeals, useCreateDeal, useUpdateDeal, useDeleteDeal,
  useMarkDealWon, useMarkDealLost,
  useActivities, useCreateActivity, useDeleteActivity,
  useSeedCrmData,
  useMyCrmPermission, canAccess,
  type CrmCompany, type CrmContact, type CrmDealStage, type CrmDeal, type CrmActivity,
} from './hooks';
import { DealKanban } from './components/deal-kanban';
import { FilterBar, applyFilters, type CrmFilter, type FilterColumn } from './components/filter-bar';
import { SavedViews, type SavedView } from './components/saved-views';
import { CsvImportModal, exportToCsv } from './components/csv-import-modal';
import { CrmDashboard } from './components/dashboard';
import { DashboardCharts } from './components/dashboard-charts';
import { AutomationsView } from './components/automations-view';
import { PermissionsView } from './components/permissions-view';
import { LeadsView } from './components/leads-view';
import { ForecastView } from './components/forecast-view';
import { MergeContactsModal, MergeCompaniesModal } from './components/merge-modal';
import { NotesSection } from './components/notes-section';
import { AppSidebar, SidebarSection, SidebarItem } from '../../components/layout/app-sidebar';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Modal } from '../../components/ui/modal';
import { Textarea } from '../../components/ui/textarea';
import { IconButton } from '../../components/ui/icon-button';
import { Badge } from '../../components/ui/badge';
import { SmartButtonBar } from '../../components/shared/SmartButtonBar';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { ColumnHeader } from '../../components/ui/column-header';
import { useUIStore } from '../../stores/ui-store';
import '../../styles/crm.css';

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
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ─── Types ─────────────────────────────────────────────────────────

type ActiveView = 'dashboard' | 'leads' | 'pipeline' | 'deals' | 'contacts' | 'companies' | 'activities' | 'automations' | 'permissions' | 'forecast';

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

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString()}`;
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'call': return <PhoneCall size={14} />;
    case 'email': return <Mail size={14} />;
    case 'meeting': return <CalendarDays size={14} />;
    default: return <StickyNote size={14} />;
  }
}

function getActivityLabel(type: string, t: (key: string) => string): string {
  switch (type) {
    case 'call': return t('crm.activities.call');
    case 'email': return t('crm.activities.email');
    case 'meeting': return t('crm.activities.meeting');
    default: return t('crm.activities.note');
  }
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

  const reset = () => { setTitle(''); setValue(''); setStageId(''); setContactId(''); setCompanyId(''); setCloseDate(''); };

  const handleSubmit = () => {
    if (!title.trim() || !stageId) return;
    createDeal.mutate({
      title: title.trim(),
      value: Number(value) || 0,
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
            <Input label={t('crm.deals.expectedClose')} type="date" value={closeDate} onChange={(e) => setCloseDate(e.target.value)} style={{ flex: 1 }} />
          </div>
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
  open, onClose, companies,
}: {
  open: boolean;
  onClose: () => void;
  companies: CrmCompany[];
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [position, setPosition] = useState('');
  const createContact = useCreateContact();

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
          <Input label={t('crm.contacts.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@company.com" />
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
  const [dealId, setDealId] = useState(defaultDealId || '');
  const [contactId, setContactId] = useState(defaultContactId || '');
  const [companyId, setCompanyId] = useState(defaultCompanyId || '');
  const createActivity = useCreateActivity();

  useEffect(() => {
    setDealId(defaultDealId || '');
    setContactId(defaultContactId || '');
    setCompanyId(defaultCompanyId || '');
  }, [defaultDealId, defaultContactId, defaultCompanyId]);

  const reset = () => { setType('note'); setBody(''); setDealId(''); setContactId(''); setCompanyId(''); };

  const handleSubmit = () => {
    if (!body.trim()) return;
    createActivity.mutate({
      type,
      body: body.trim(),
      dealId: dealId || null,
      contactId: contactId || null,
      companyId: companyId || null,
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
        <div key={activity.id} className="crm-activity-item">
          <div className="crm-activity-icon">
            {getActivityIcon(activity.type)}
          </div>
          <div className="crm-activity-body">
            <div className="crm-activity-text">{activity.body}</div>
            <div className="crm-activity-meta">
              {getActivityLabel(activity.type, t)} &middot; {formatDate(activity.createdAt)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Deal Detail Panel ─────────────────────────────────────────────

function DealDetailPanel({
  deal, stages, onClose, onMarkWon, onMarkLost,
}: {
  deal: CrmDeal;
  stages: CrmDealStage[];
  onClose: () => void;
  onMarkWon: () => void;
  onMarkLost: () => void;
}) {
  const { t } = useTranslation();
  const [stageId, setStageId] = useState(deal.stageId);
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  const { data: activitiesData } = useActivities({ dealId: deal.id });
  const activities = activitiesData?.activities ?? [];

  useEffect(() => {
    setStageId(deal.stageId);
  }, [deal.id, deal.stageId]);

  return (
    <div className="crm-detail-panel">
      <div style={{
        padding: '12px var(--spacing-lg)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-family)' }}>
          {t('crm.deals.dealDetail')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconButton icon={<Trash2 size={14} />} label={t('crm.deals.deleteDeal')} size={28} destructive onClick={() => { deleteDeal.mutate(deal.id); onClose(); }} />
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
                icon: <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />,
              }))}
              size="sm"
            />
          </div>

          {deal.companyName && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.deals.company')}</span>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                <Building2 size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                {deal.companyName}
              </div>
            </div>
          )}

          {deal.contactName && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.deals.contact')}</span>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
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

        {/* Activity timeline */}
        <div style={{ marginTop: 'var(--spacing-sm)' }}>
          <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--spacing-sm)', fontFamily: 'var(--font-family)' }}>
            {t('crm.sidebar.activities')}
          </div>
          <ActivityTimeline activities={activities} />
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
  contact, deals, onClose,
}: {
  contact: CrmContact;
  deals: CrmDeal[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const { data: activitiesData } = useActivities({ contactId: contact.id });
  const activities = activitiesData?.activities ?? [];
  const contactDeals = deals.filter((d) => d.contactId === contact.id);

  return (
    <div className="crm-detail-panel">
      <div style={{
        padding: '12px var(--spacing-lg)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-family)' }}>
          {t('crm.contacts.contactDetail')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconButton icon={<Trash2 size={14} />} label={t('crm.contacts.deleteContact')} size={28} destructive onClick={() => { deleteContact.mutate(contact.id); onClose(); }} />
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                <Building2 size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                {contact.companyName}
              </div>
            </div>
          )}

          {contact.source && (
            <div className="crm-detail-field">
              <span className="crm-detail-field-label">{t('crm.contacts.source')}</span>
              <Badge variant="default">{contact.source}</Badge>
            </div>
          )}
        </div>

        {/* Linked deals */}
        {contactDeals.length > 0 && (
          <div style={{ marginTop: 'var(--spacing-sm)' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 'var(--spacing-sm)', fontFamily: 'var(--font-family)' }}>
              {t('crm.sidebar.deals')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {contactDeals.map((deal) => (
                <div key={deal.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px var(--spacing-sm)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-secondary)',
                  fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)',
                }}>
                  <span style={{ color: 'var(--color-text-primary)' }}>{deal.title}</span>
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
          <NotesSection contactId={contact.id} />
        </div>
      </div>
    </div>
  );
}

// ─── Company Detail Panel ──────────────────────────────────────────

function CompanyDetailPanel({
  company, contacts, deals, onClose,
}: {
  company: CrmCompany;
  contacts: CrmContact[];
  deals: CrmDeal[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const deleteCompany = useDeleteCompany();
  const { data: activitiesData } = useActivities({ companyId: company.id });
  const activities = activitiesData?.activities ?? [];
  const companyContacts = contacts.filter((c) => c.companyId === company.id);
  const companyDeals = deals.filter((d) => d.companyId === company.id);

  return (
    <div className="crm-detail-panel">
      <div style={{
        padding: '12px var(--spacing-lg)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-family)' }}>
          {t('crm.companies.companyDetail')}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <IconButton icon={<Trash2 size={14} />} label={t('crm.companies.deleteCompany')} size={28} destructive onClick={() => { deleteCompany.mutate(company.id); onClose(); }} />
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
              <Badge variant="default">{company.industry}</Badge>
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
                }}>
                  <span style={{ color: 'var(--color-text-primary)' }}>{contact.name}</span>
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
                }}>
                  <span style={{ color: 'var(--color-text-primary)' }}>{deal.title}</span>
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
}) {
  const { t } = useTranslation();
  const updateDeal = useUpdateDeal();
  const lastSelectedIndex = useRef<number | null>(null);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return deals;
    const q = searchQuery.toLowerCase();
    return deals.filter((d) =>
      d.title.toLowerCase().includes(q) ||
      (d.companyName?.toLowerCase().includes(q)) ||
      (d.contactName?.toLowerCase().includes(q)),
    );
  }, [deals, searchQuery]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      switch (sort.column) {
        case 'title': aVal = a.title.toLowerCase(); bVal = b.title.toLowerCase(); break;
        case 'company': aVal = (a.companyName || '').toLowerCase(); bVal = (b.companyName || '').toLowerCase(); break;
        case 'contact': aVal = (a.contactName || '').toLowerCase(); bVal = (b.contactName || '').toLowerCase(); break;
        case 'value': aVal = a.value; bVal = b.value; break;
        case 'stage': aVal = (a.stageName || '').toLowerCase(); bVal = (b.stageName || '').toLowerCase(); break;
        case 'closeDate': aVal = a.expectedCloseDate || ''; bVal = b.expectedCloseDate || ''; break;
      }
      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sort]);

  const handleSort = useCallback((col: string) => {
    onSortChange(
      !sort || sort.column !== col
        ? { column: col, direction: 'asc' }
        : sort.direction === 'asc'
          ? { column: col, direction: 'desc' }
          : null,
    );
  }, [sort, onSortChange]);

  const allChecked = sorted.length > 0 && sorted.every((d) => selectedIds.has(d.id));
  const someChecked = sorted.some((d) => selectedIds.has(d.id));

  const handleHeaderCheckbox = () => {
    if (allChecked) onSelectionChange(new Set());
    else onSelectionChange(new Set(sorted.map((d) => d.id)));
  };

  const handleRowCheckbox = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const deal = sorted[index];
    const newSet = new Set(selectedIds);
    if (e.shiftKey && lastSelectedIndex.current !== null) {
      const start = Math.min(lastSelectedIndex.current, index);
      const end = Math.max(lastSelectedIndex.current, index);
      for (let i = start; i <= end; i++) newSet.add(sorted[i].id);
    } else {
      if (newSet.has(deal.id)) newSet.delete(deal.id); else newSet.add(deal.id);
    }
    lastSelectedIndex.current = index;
    onSelectionChange(newSet);
  };

  const handleCellClick = (rowId: string, column: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (editingCell) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return;
    if (e.key === 'ArrowDown') { e.preventDefault(); onFocusedIndexChange(Math.min((focusedIndex ?? -1) + 1, sorted.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); onFocusedIndexChange(Math.max((focusedIndex ?? 1) - 1, 0)); }
    else if (e.key === 'Enter' && focusedIndex !== null && sorted[focusedIndex]) { e.preventDefault(); onSelect(sorted[focusedIndex].id); }
    else if (e.key === 'Escape') { onFocusedIndexChange(null); onSelectionChange(new Set()); }
    else if (e.key === ' ' && focusedIndex !== null && sorted[focusedIndex]) {
      e.preventDefault();
      const id = sorted[focusedIndex].id;
      const ns = new Set(selectedIds);
      if (ns.has(id)) ns.delete(id); else ns.add(id);
      onSelectionChange(ns);
    }
  }, [editingCell, focusedIndex, sorted, selectedIds, onFocusedIndexChange, onSelectionChange, onSelect]);

  const totalValue = useMemo(() => sorted.reduce((sum, d) => sum + d.value, 0), [sorted]);
  const avgValue = sorted.length > 0 ? totalValue / sorted.length : 0;

  if (filtered.length === 0) {
    return (
      <div className="crm-empty-state">
        <Briefcase size={48} className="crm-empty-state-icon" />
        <div className="crm-empty-state-title">{searchQuery ? t('crm.empty.noMatchingDeals') : t('crm.empty.noDeals')}</div>
        <div className="crm-empty-state-desc">{searchQuery ? t('crm.empty.tryDifferentSearch') : t('crm.empty.createFirstDeal')}</div>
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} tabIndex={0} onKeyDown={handleKeyDown}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={hdrStyle}>
          <input type="checkbox" className={`crm-checkbox${!allChecked && someChecked ? ' indeterminate' : ''}`} checked={allChecked} onChange={handleHeaderCheckbox} />
          <ColumnHeader label={t('crm.deals.title')} icon={<Briefcase size={12} />} sortable columnKey="title" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 180, flexShrink: 0 }} />
          <ColumnHeader label={t('crm.deals.company')} icon={<Building2 size={12} />} sortable columnKey="company" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 130, flexShrink: 0 }} />
          <ColumnHeader label={t('crm.deals.contact')} icon={<Users size={12} />} sortable columnKey="contact" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 110, flexShrink: 0 }} />
          <ColumnHeader label={t('crm.deals.value')} icon={<DollarSign size={12} />} sortable columnKey="value" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 100, flexShrink: 0, textAlign: 'right' }} />
          <ColumnHeader label={t('crm.deals.stage')} icon={<LayoutGrid size={12} />} sortable columnKey="stage" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 100, flexShrink: 0 }} />
          <ColumnHeader label={t('crm.deals.closeDate')} icon={<Calendar size={12} />} sortable columnKey="closeDate" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ flex: 1 }} />
        </div>
        {sorted.map((deal, idx) => {
          const isEd = (col: string) => editingCell?.rowId === deal.id && editingCell?.column === col;
          return (
            <div
              key={deal.id}
              className={`crm-row${selectedId === deal.id ? ' selected' : ''}${focusedIndex === idx ? ' focused' : ''}`}
              onClick={() => { onFocusedIndexChange(idx); if (!editingCell) onSelect(deal.id); }}
            >
              <input type="checkbox" className="crm-checkbox" checked={selectedIds.has(deal.id)} onClick={(e) => handleRowCheckbox(idx, e)} readOnly />
              {isEd('title') ? (
                <span className="crm-cell-editing" style={{ width: 180, flexShrink: 0 }}>
                  <InlineEditInput value={deal.title} type="text" onSave={(v) => handleSave(deal.id, 'title', v)} onCancel={() => onEditingCellChange(null)} />
                </span>
              ) : (
                <span style={{ width: 180, flexShrink: 0, fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }} onClick={(e) => handleCellClick(deal.id, 'title', e)}>
                  {deal.title}
                </span>
              )}
              <span style={{ width: 130, flexShrink: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {deal.companyName || '-'}
              </span>
              <span style={{ width: 110, flexShrink: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {deal.contactName || '-'}
              </span>
              {isEd('value') ? (
                <span className="crm-cell-editing" style={{ width: 100, flexShrink: 0 }}>
                  <InlineEditInput value={String(deal.value)} type="number" onSave={(v) => handleSave(deal.id, 'value', v)} onCancel={() => onEditingCellChange(null)} />
                </span>
              ) : (
                <span style={{ width: 100, flexShrink: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', textAlign: 'right', fontVariantNumeric: 'tabular-nums', cursor: 'text' }} onClick={(e) => handleCellClick(deal.id, 'value', e)}>
                  {formatCurrency(deal.value)}
                </span>
              )}
              {isEd('stage') ? (
                <span className="crm-cell-editing" style={{ width: 100, flexShrink: 0 }}>
                  <InlineSelectCell value={deal.stageId} options={stages.map((s) => ({ value: s.id, label: s.name }))} onSave={(v) => handleSave(deal.id, 'stage', v)} onCancel={() => onEditingCellChange(null)} />
                </span>
              ) : (
                <span style={{ width: 100, flexShrink: 0, cursor: 'pointer' }} onClick={(e) => handleCellClick(deal.id, 'stage', e)}>
                  {deal.stageName && (
                    <Badge variant="default">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: deal.stageColor || '#6b7280' }} />
                        {deal.stageName}
                      </span>
                    </Badge>
                  )}
                </span>
              )}
              {isEd('closeDate') ? (
                <span className="crm-cell-editing" style={{ flex: 1 }}>
                  <InlineEditInput value={deal.expectedCloseDate || ''} type="date" onSave={(v) => handleSave(deal.id, 'closeDate', v)} onCancel={() => onEditingCellChange(null)} />
                </span>
              ) : (
                <span style={{ flex: 1, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', cursor: 'text' }} onClick={(e) => handleCellClick(deal.id, 'closeDate', e)}>
                  {deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : '-'}
                </span>
              )}
              {selectedId === deal.id && <ChevronRight size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />}
            </div>
          );
        })}
      </div>
      <div className="crm-table-footer">
        <span>{sorted.length} {sorted.length !== 1 ? t('crm.sidebar.deals').toLowerCase() : t('crm.deals.deal')}</span>
        <span style={{ marginLeft: 'auto' }}>{t('crm.deals.total')}: {formatCurrency(totalValue)}</span>
        <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-normal)' }}>{t('crm.deals.avg')}: {formatCurrency(Math.round(avgValue))}</span>
      </div>
    </div>
  );
}

// ─── Contacts List View ────────────────────────────────────────────

function ContactsListView({
  contacts, selectedId, onSelect, searchQuery,
  selectedIds, onSelectionChange, focusedIndex, onFocusedIndexChange,
  editingCell, onEditingCellChange, sort, onSortChange,
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
}) {
  const { t } = useTranslation();
  const updateContact = useUpdateContact();
  const lastSelectedIndex = useRef<number | null>(null);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const q = searchQuery.toLowerCase();
    return contacts.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.email?.toLowerCase().includes(q)) ||
      (c.companyName?.toLowerCase().includes(q)),
    );
  }, [contacts, searchQuery]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let aVal = '', bVal = '';
      switch (sort.column) {
        case 'name': aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
        case 'email': aVal = (a.email || '').toLowerCase(); bVal = (b.email || '').toLowerCase(); break;
        case 'phone': aVal = (a.phone || '').toLowerCase(); bVal = (b.phone || '').toLowerCase(); break;
        case 'company': aVal = (a.companyName || '').toLowerCase(); bVal = (b.companyName || '').toLowerCase(); break;
        case 'position': aVal = (a.position || '').toLowerCase(); bVal = (b.position || '').toLowerCase(); break;
      }
      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sort]);

  const handleSort = useCallback((col: string) => {
    onSortChange(
      !sort || sort.column !== col ? { column: col, direction: 'asc' }
        : sort.direction === 'asc' ? { column: col, direction: 'desc' } : null,
    );
  }, [sort, onSortChange]);

  const allChecked = sorted.length > 0 && sorted.every((c) => selectedIds.has(c.id));
  const someChecked = sorted.some((c) => selectedIds.has(c.id));

  const handleHeaderCheckbox = () => {
    if (allChecked) onSelectionChange(new Set());
    else onSelectionChange(new Set(sorted.map((c) => c.id)));
  };

  const handleRowCheckbox = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const contact = sorted[index];
    const newSet = new Set(selectedIds);
    if (e.shiftKey && lastSelectedIndex.current !== null) {
      const start = Math.min(lastSelectedIndex.current, index);
      const end = Math.max(lastSelectedIndex.current, index);
      for (let i = start; i <= end; i++) newSet.add(sorted[i].id);
    } else {
      if (newSet.has(contact.id)) newSet.delete(contact.id); else newSet.add(contact.id);
    }
    lastSelectedIndex.current = index;
    onSelectionChange(newSet);
  };

  const handleCellClick = (rowId: string, column: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (editingCell) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return;
    if (e.key === 'ArrowDown') { e.preventDefault(); onFocusedIndexChange(Math.min((focusedIndex ?? -1) + 1, sorted.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); onFocusedIndexChange(Math.max((focusedIndex ?? 1) - 1, 0)); }
    else if (e.key === 'Enter' && focusedIndex !== null && sorted[focusedIndex]) { e.preventDefault(); onSelect(sorted[focusedIndex].id); }
    else if (e.key === 'Escape') { onFocusedIndexChange(null); onSelectionChange(new Set()); }
    else if (e.key === ' ' && focusedIndex !== null && sorted[focusedIndex]) {
      e.preventDefault();
      const id = sorted[focusedIndex].id;
      const ns = new Set(selectedIds);
      if (ns.has(id)) ns.delete(id); else ns.add(id);
      onSelectionChange(ns);
    }
  }, [editingCell, focusedIndex, sorted, selectedIds, onFocusedIndexChange, onSelectionChange, onSelect]);

  if (filtered.length === 0) {
    return (
      <div className="crm-empty-state">
        <Users size={48} className="crm-empty-state-icon" />
        <div className="crm-empty-state-title">{searchQuery ? t('crm.empty.noMatchingContacts') : t('crm.empty.noContacts')}</div>
        <div className="crm-empty-state-desc">{searchQuery ? t('crm.empty.tryDifferentSearch') : t('crm.empty.addFirstContact')}</div>
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} tabIndex={0} onKeyDown={handleKeyDown}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={hdrStyle}>
          <input type="checkbox" className={`crm-checkbox${!allChecked && someChecked ? ' indeterminate' : ''}`} checked={allChecked} onChange={handleHeaderCheckbox} />
          <ColumnHeader label={t('crm.contacts.name')} icon={<User size={12} />} sortable columnKey="name" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 160, flexShrink: 0 }} />
          <ColumnHeader label={t('crm.contacts.email')} icon={<Mail size={12} />} sortable columnKey="email" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 170, flexShrink: 0 }} />
          <ColumnHeader label={t('crm.contacts.phone')} icon={<PhoneIcon size={12} />} sortable columnKey="phone" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 120, flexShrink: 0 }} />
          <ColumnHeader label={t('crm.deals.company')} icon={<Building2 size={12} />} sortable columnKey="company" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 130, flexShrink: 0 }} />
          <ColumnHeader label={t('crm.contacts.position')} icon={<Briefcase size={12} />} sortable columnKey="position" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ flex: 1 }} />
        </div>
        {sorted.map((contact, idx) => {
          const isEd = (col: string) => editingCell?.rowId === contact.id && editingCell?.column === col;
          return (
            <div
              key={contact.id}
              className={`crm-row${selectedId === contact.id ? ' selected' : ''}${focusedIndex === idx ? ' focused' : ''}`}
              onClick={() => { onFocusedIndexChange(idx); if (!editingCell) onSelect(contact.id); }}
            >
              <input type="checkbox" className="crm-checkbox" checked={selectedIds.has(contact.id)} onClick={(e) => handleRowCheckbox(idx, e)} readOnly />
              {isEd('name') ? (
                <span className="crm-cell-editing" style={{ width: 160, flexShrink: 0 }}>
                  <InlineEditInput value={contact.name} type="text" onSave={(v) => handleSave(contact.id, 'name', v)} onCancel={() => onEditingCellChange(null)} />
                </span>
              ) : (
                <span style={{ width: 160, flexShrink: 0, fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }} onClick={(e) => handleCellClick(contact.id, 'name', e)}>
                  {contact.name}
                </span>
              )}
              {isEd('email') ? (
                <span className="crm-cell-editing" style={{ width: 170, flexShrink: 0 }}>
                  <InlineEditInput value={contact.email || ''} type="text" onSave={(v) => handleSave(contact.id, 'email', v)} onCancel={() => onEditingCellChange(null)} />
                </span>
              ) : (
                <span style={{ width: 170, flexShrink: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }} onClick={(e) => handleCellClick(contact.id, 'email', e)}>
                  {contact.email || '-'}
                </span>
              )}
              {isEd('phone') ? (
                <span className="crm-cell-editing" style={{ width: 120, flexShrink: 0 }}>
                  <InlineEditInput value={contact.phone || ''} type="text" onSave={(v) => handleSave(contact.id, 'phone', v)} onCancel={() => onEditingCellChange(null)} />
                </span>
              ) : (
                <span style={{ width: 120, flexShrink: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }} onClick={(e) => handleCellClick(contact.id, 'phone', e)}>
                  {contact.phone || '-'}
                </span>
              )}
              <span style={{ width: 130, flexShrink: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {contact.companyName || '-'}
              </span>
              {isEd('position') ? (
                <span className="crm-cell-editing" style={{ flex: 1 }}>
                  <InlineEditInput value={contact.position || ''} type="text" onSave={(v) => handleSave(contact.id, 'position', v)} onCancel={() => onEditingCellChange(null)} />
                </span>
              ) : (
                <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }} onClick={(e) => handleCellClick(contact.id, 'position', e)}>
                  {contact.position || '-'}
                </span>
              )}
              {selectedId === contact.id && <ChevronRight size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Companies List View ───────────────────────────────────────────

function CompaniesListView({
  companies, selectedId, onSelect, searchQuery,
  selectedIds, onSelectionChange, focusedIndex, onFocusedIndexChange,
  editingCell, onEditingCellChange, sort, onSortChange,
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
}) {
  const { t } = useTranslation();
  const updateCompany = useUpdateCompany();
  const lastSelectedIndex = useRef<number | null>(null);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return companies;
    const q = searchQuery.toLowerCase();
    return companies.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.domain?.toLowerCase().includes(q)) ||
      (c.industry?.toLowerCase().includes(q)),
    );
  }, [companies, searchQuery]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      let aVal = '', bVal = '';
      switch (sort.column) {
        case 'name': aVal = a.name.toLowerCase(); bVal = b.name.toLowerCase(); break;
        case 'domain': aVal = (a.domain || '').toLowerCase(); bVal = (b.domain || '').toLowerCase(); break;
        case 'industry': aVal = (a.industry || '').toLowerCase(); bVal = (b.industry || '').toLowerCase(); break;
        case 'size': aVal = (a.size || '').toLowerCase(); bVal = (b.size || '').toLowerCase(); break;
      }
      if (aVal < bVal) return sort.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sort.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sort]);

  const handleSort = useCallback((col: string) => {
    onSortChange(
      !sort || sort.column !== col ? { column: col, direction: 'asc' }
        : sort.direction === 'asc' ? { column: col, direction: 'desc' } : null,
    );
  }, [sort, onSortChange]);

  const allChecked = sorted.length > 0 && sorted.every((c) => selectedIds.has(c.id));
  const someChecked = sorted.some((c) => selectedIds.has(c.id));

  const handleHeaderCheckbox = () => {
    if (allChecked) onSelectionChange(new Set());
    else onSelectionChange(new Set(sorted.map((c) => c.id)));
  };

  const handleRowCheckbox = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const company = sorted[index];
    const newSet = new Set(selectedIds);
    if (e.shiftKey && lastSelectedIndex.current !== null) {
      const start = Math.min(lastSelectedIndex.current, index);
      const end = Math.max(lastSelectedIndex.current, index);
      for (let i = start; i <= end; i++) newSet.add(sorted[i].id);
    } else {
      if (newSet.has(company.id)) newSet.delete(company.id); else newSet.add(company.id);
    }
    lastSelectedIndex.current = index;
    onSelectionChange(newSet);
  };

  const handleCellClick = (rowId: string, column: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (editingCell) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'SELECT') return;
    if (e.key === 'ArrowDown') { e.preventDefault(); onFocusedIndexChange(Math.min((focusedIndex ?? -1) + 1, sorted.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); onFocusedIndexChange(Math.max((focusedIndex ?? 1) - 1, 0)); }
    else if (e.key === 'Enter' && focusedIndex !== null && sorted[focusedIndex]) { e.preventDefault(); onSelect(sorted[focusedIndex].id); }
    else if (e.key === 'Escape') { onFocusedIndexChange(null); onSelectionChange(new Set()); }
    else if (e.key === ' ' && focusedIndex !== null && sorted[focusedIndex]) {
      e.preventDefault();
      const id = sorted[focusedIndex].id;
      const ns = new Set(selectedIds);
      if (ns.has(id)) ns.delete(id); else ns.add(id);
      onSelectionChange(ns);
    }
  }, [editingCell, focusedIndex, sorted, selectedIds, onFocusedIndexChange, onSelectionChange, onSelect]);

  if (filtered.length === 0) {
    return (
      <div className="crm-empty-state">
        <Building2 size={48} className="crm-empty-state-icon" />
        <div className="crm-empty-state-title">{searchQuery ? t('crm.empty.noMatchingCompanies') : t('crm.empty.noCompanies')}</div>
        <div className="crm-empty-state-desc">{searchQuery ? t('crm.empty.tryDifferentSearch') : t('crm.empty.addFirstCompany')}</div>
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} tabIndex={0} onKeyDown={handleKeyDown}>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={hdrStyle}>
          <input type="checkbox" className={`crm-checkbox${!allChecked && someChecked ? ' indeterminate' : ''}`} checked={allChecked} onChange={handleHeaderCheckbox} />
          <ColumnHeader label={t('crm.companies.name')} icon={<Building2 size={12} />} sortable columnKey="name" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 160, flexShrink: 0 }} />
          <ColumnHeader label={t('crm.companies.domain')} icon={<Globe size={12} />} sortable columnKey="domain" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 150, flexShrink: 0 }} />
          <ColumnHeader label={t('crm.companies.industry')} icon={<Tag size={12} />} sortable columnKey="industry" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 120, flexShrink: 0 }} />
          <ColumnHeader label={t('crm.companies.size')} icon={<Users size={12} />} sortable columnKey="size" sortColumn={sort?.column} sortDirection={sort?.direction} onSort={handleSort} style={{ width: 80, flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{t('crm.companies.contactsDeals')}</span>
        </div>
        {sorted.map((company, idx) => {
          const isEd = (col: string) => editingCell?.rowId === company.id && editingCell?.column === col;
          return (
            <div
              key={company.id}
              className={`crm-row${selectedId === company.id ? ' selected' : ''}${focusedIndex === idx ? ' focused' : ''}`}
              onClick={() => { onFocusedIndexChange(idx); if (!editingCell) onSelect(company.id); }}
            >
              <input type="checkbox" className="crm-checkbox" checked={selectedIds.has(company.id)} onClick={(e) => handleRowCheckbox(idx, e)} readOnly />
              {isEd('name') ? (
                <span className="crm-cell-editing" style={{ width: 160, flexShrink: 0 }}>
                  <InlineEditInput value={company.name} type="text" onSave={(v) => handleSave(company.id, 'name', v)} onCancel={() => onEditingCellChange(null)} />
                </span>
              ) : (
                <span style={{ width: 160, flexShrink: 0, fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }} onClick={(e) => handleCellClick(company.id, 'name', e)}>
                  {company.name}
                </span>
              )}
              {isEd('domain') ? (
                <span className="crm-cell-editing" style={{ width: 150, flexShrink: 0 }}>
                  <InlineEditInput value={company.domain || ''} type="text" onSave={(v) => handleSave(company.id, 'domain', v)} onCancel={() => onEditingCellChange(null)} />
                </span>
              ) : (
                <span style={{ width: 150, flexShrink: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }} onClick={(e) => handleCellClick(company.id, 'domain', e)}>
                  {company.domain || '-'}
                </span>
              )}
              {isEd('industry') ? (
                <span className="crm-cell-editing" style={{ width: 120, flexShrink: 0 }}>
                  <InlineEditInput value={company.industry || ''} type="text" onSave={(v) => handleSave(company.id, 'industry', v)} onCancel={() => onEditingCellChange(null)} />
                </span>
              ) : (
                <span style={{ width: 120, flexShrink: 0, cursor: 'text' }} onClick={(e) => handleCellClick(company.id, 'industry', e)}>
                  {company.industry ? <Badge variant="default">{company.industry}</Badge> : <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>-</span>}
                </span>
              )}
              <span style={{ width: 80, flexShrink: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                {company.size || '-'}
              </span>
              <span style={{ flex: 1, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}>
                {company.contactCount} {t('crm.sidebar.contacts').toLowerCase()} &middot; {company.dealCount} {t('crm.sidebar.deals').toLowerCase()}
              </span>
              {selectedId === company.id && <ChevronRight size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />}
            </div>
          );
        })}
      </div>
    </div>
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

  // Close selection on view change
  useEffect(() => {
    setSelectedDealId(null);
    setSelectedContactId(null);
    setSelectedCompanyId(null);
    setSearchQuery('');
    setShowSearch(false);
    setSelectedIds(new Set());
    setFocusedIndex(null);
    setEditingCell(null);
    setSort(null);
    setFilters([]);
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
  const handleExport = useCallback(() => {
    const now = new Date().toISOString().slice(0, 10);
    switch (activeView) {
      case 'deals':
        exportToCsv(filteredDeals as unknown as Record<string, unknown>[], getDealsCsvColumns(t), `crm-deals-${now}`);
        break;
      case 'contacts':
        exportToCsv(filteredContacts as unknown as Record<string, unknown>[], getContactsCsvColumns(t), `crm-contacts-${now}`);
        break;
      case 'companies':
        exportToCsv(filteredCompanies as unknown as Record<string, unknown>[], getCompaniesCsvColumns(t), `crm-companies-${now}`);
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
    setSelectedDealId(dealId);
    setSelectedContactId(null);
    setSelectedCompanyId(null);
  }, []);

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
            isActive={activeView === 'leads'}
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
            isActive={activeView === 'deals'}
            count={deals.length}
            onClick={() => setActiveView('deals')}
          />
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
          <SidebarItem
            label={t('crm.sidebar.companies')}
            icon={<Building2 size={14} />}
            iconColor="#06b6d4"
            isActive={activeView === 'companies'}
            count={companies.length}
            onClick={() => setActiveView('companies')}
          />
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
        </SidebarSection>
      </AppSidebar>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Content header */}
        {activeView !== 'leads' && activeView !== 'forecast' && (
        <div className="crm-content-header">
          <span className="crm-content-header-title">{sectionTitle}</span>
          {activeView !== 'dashboard' && activeView !== 'automations' && activeView !== 'permissions' && (
            <div className="crm-content-header-actions">
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
            </div>
          )}
        </div>
        )}

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
          <div className="crm-toolbar">
            <SavedViews
              entityType={importEntityType as 'deals' | 'contacts' | 'companies'}
              currentFilters={filters}
              currentSort={sort}
              onApplyView={handleApplyView}
            />
            <div className="crm-toolbar-separator" />
            <FilterBar
              columns={currentFilterColumns}
              filters={filters}
              onFiltersChange={setFilters}
            />
            <div className="crm-toolbar-separator" />
            <Button variant="ghost" size="sm" icon={<Upload size={13} />} onClick={() => setShowImportModal(true)}>
              {t('crm.actions.import')}
            </Button>
            <Button variant="ghost" size="sm" icon={<Download size={13} />} onClick={handleExport}>
              {t('crm.actions.export')}
            </Button>
          </div>
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

          {/* Detail panel */}
          {hasDetailPanel && (
            <div style={{
              width: 380,
              borderLeft: '1px solid var(--color-border-primary)',
              flexShrink: 0,
              overflow: 'hidden',
              height: '100%',
            }}>
              {(activeView === 'pipeline' || activeView === 'deals') && selectedDeal && (
                <DealDetailPanel
                  deal={selectedDeal}
                  stages={stages}
                  onClose={() => setSelectedDealId(null)}
                  onMarkWon={() => markWon.mutate(selectedDeal.id)}
                  onMarkLost={() => setMarkLostDealId(selectedDeal.id)}
                />
              )}
              {activeView === 'contacts' && selectedContact && (
                <ContactDetailPanel
                  contact={selectedContact}
                  deals={deals}
                  onClose={() => setSelectedContactId(null)}
                />
              )}
              {activeView === 'companies' && selectedCompany && (
                <CompanyDetailPanel
                  company={selectedCompany}
                  contacts={contacts}
                  deals={deals}
                  onClose={() => setSelectedCompanyId(null)}
                />
              )}
            </div>
          )}
        </div>
      </div>

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
