import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { UserPlus, Search, ChevronRight, Trash2, ArrowRightLeft, User, Mail, Building2, Globe, Tag, Plus, Phone, X, CheckCircle2 } from 'lucide-react';
import {
  useLeads, useCreateLead, useUpdateLead, useDeleteLead, useConvertLead, useStages,
  useMyCrmPermission, canAccess,
  type CrmLead, type CrmLeadStatus, type CrmLeadSource,
} from '../hooks';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Modal } from '../../../components/ui/modal';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import { IconButton } from '../../../components/ui/icon-button';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { DataTable, type DataTableColumn, type SortState } from '../../../components/ui/data-table';
import { formatDate } from '../../../lib/format';

const AVATAR_COLORS = ['#ef4444','#f97316','#f59e0b','#10b981','#06b6d4','#3b82f6','#6366f1','#8b5cf6','#ec4899','#14b8a6'];
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getStatusOptions(t: (key: string) => string): { value: CrmLeadStatus; label: string }[] {
  return [
    { value: 'new', label: t('crm.leads.new') },
    { value: 'contacted', label: t('crm.leads.contacted') },
    { value: 'qualified', label: t('crm.leads.qualified') },
    { value: 'converted', label: t('crm.leads.converted') },
    { value: 'lost', label: t('crm.leads.lost') },
  ];
}

function getSourceOptions(t: (key: string) => string): { value: CrmLeadSource; label: string }[] {
  return [
    { value: 'website', label: t('crm.leads.website') },
    { value: 'referral', label: t('crm.leads.referral') },
    { value: 'cold_call', label: t('crm.leads.coldCall') },
    { value: 'social_media', label: t('crm.leads.socialMedia') },
    { value: 'event', label: t('crm.leads.event') },
    { value: 'other', label: t('crm.leads.other') },
  ];
}

function statusBadgeVariant(status: CrmLeadStatus): 'default' | 'primary' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'new': return 'default';
    case 'contacted': return 'primary';
    case 'qualified': return 'warning';
    case 'converted': return 'success';
    case 'lost': return 'error';
  }
}

function sourceBadgeVariant(_source: CrmLeadSource): 'default' | 'primary' | 'success' | 'warning' | 'error' {
  return 'default';
}

// ─── Create lead modal ──────────────────────────────────────────

function CreateLeadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const createLead = useCreateLead();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [source, setSource] = useState<CrmLeadSource>('other');
  const [notes, setNotes] = useState('');
  const SOURCE_OPTIONS = getSourceOptions(t);

  const handleSubmit = () => {
    if (!name.trim()) return;
    createLead.mutate({
      name: name.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      companyName: companyName.trim() || undefined,
      source,
      notes: notes.trim() || undefined,
    }, {
      onSuccess: () => {
        onClose();
        setName(''); setEmail(''); setPhone(''); setCompanyName(''); setSource('other'); setNotes('');
      },
    });
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <Modal.Header title={t('crm.leads.newLead')} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <Input label={t('crm.leads.name')} value={name} onChange={(e) => setName(e.target.value)} size="md" />
          <Input label={t('crm.leads.email')} value={email} onChange={(e) => setEmail(e.target.value)} size="md" />
          <Input label={t('crm.leads.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} size="md" />
          <Input label={t('crm.leads.companyName')} value={companyName} onChange={(e) => setCompanyName(e.target.value)} size="md" />
          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>{t('crm.leads.source')}</div>
            <Select value={source} onChange={(v) => setSource(v as CrmLeadSource)} options={SOURCE_OPTIONS} size="md" />
          </div>
          <Textarea label={t('crm.leads.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} size="md">{t('common.cancel')}</Button>
        <Button variant="primary" onClick={handleSubmit} size="md" disabled={!name.trim() || createLead.isPending}>
          {createLead.isPending ? t('common.loading') : t('crm.leads.newLead')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// ─── Convert lead modal ─────────────────────────────────────────

export function ConvertLeadModal({
  open, onClose, lead,
}: { open: boolean; onClose: () => void; lead: CrmLead | null }) {
  const { t } = useTranslation();
  const convertLead = useConvertLead();
  const { data: stagesData } = useStages();
  const stages = stagesData?.stages ?? [];
  const [dealTitle, setDealTitle] = useState('');
  const [dealStageId, setDealStageId] = useState('');
  const [dealValue, setDealValue] = useState('0');
  const [result, setResult] = useState<{ deal: { id: string; title: string }; contact: { id: string }; company?: { id: string } } | null>(null);
  const [, setSearchParams] = useSearchParams();

  const handleClose = () => {
    setResult(null);
    onClose();
  };

  const defaultStage = stages.find((s) => s.isDefault) ?? stages[0];
  const resolvedStageId = dealStageId || defaultStage?.id || '';
  const canSubmit = !!lead && dealTitle.trim().length > 0 && resolvedStageId.length > 0 && !convertLead.isPending;

  const handleSubmit = () => {
    if (!canSubmit) return;

    convertLead.mutate({
      leadId: lead!.id,
      dealTitle: dealTitle.trim(),
      dealStageId: resolvedStageId,
      dealValue: Number(dealValue) || 0,
    }, {
      onSuccess: (data) => { setResult(data); },
    });
  };

  const handleViewDeal = () => {
    if (!result) return;
    handleClose();
    setSearchParams({ view: 'deal-detail', dealId: result.deal.id }, { replace: true });
  };

  const handleCreateProposal = () => {
    if (!result) return;
    handleClose();
    setSearchParams({ view: 'deal-detail', dealId: result.deal.id, openProposal: '1' }, { replace: true });
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && handleClose()}>
      <Modal.Header title={result ? t('crm.leads.convertSuccess') : t('crm.leads.convertTitle')} />
      <Modal.Body>
        {result && result.deal ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-lg)', padding: 'var(--spacing-xl) 0' }}>
            <CheckCircle2 size={48} color="var(--color-success)" />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', marginBottom: 4 }}>
                {result.deal.title}
              </div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                {t('crm.leads.convertDescription')}
              </div>
            </div>
          </div>
        ) : lead && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div style={{ padding: 'var(--spacing-md)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)' }}>
              <div style={{ fontWeight: 'var(--font-weight-medium)', marginBottom: 4 }}>{t('crm.leads.convertDescription')}</div>
            </div>
            <Input label={t('crm.leads.dealTitle')} value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} size="md" />
            <div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>{t('crm.leads.selectStage')}</div>
              {stages.length === 0 ? (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-error)', padding: 'var(--spacing-sm)' }}>
                  {t('crm.leads.noStagesAvailable')}
                </div>
              ) : (
                <Select
                  value={resolvedStageId}
                  onChange={(v) => setDealStageId(v)}
                  options={stages.map((s) => ({ value: s.id, label: s.name }))}
                  size="md"
                />
              )}
            </div>
            <Input label={t('crm.deals.value')} type="number" value={dealValue} onChange={(e) => setDealValue(e.target.value)} size="md" />
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        {result ? (
          <>
            <Button variant="secondary" onClick={handleClose} size="md">{t('common.close')}</Button>
            <Button variant="ghost" onClick={handleViewDeal} size="md">{t('crm.leads.viewDeal')}</Button>
            <Button variant="primary" onClick={handleCreateProposal} size="md">{t('crm.leads.createProposal')}</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={handleClose} size="md">{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleSubmit} size="md" disabled={!canSubmit}>
              {convertLead.isPending ? t('common.loading') : t('crm.leads.convert')}
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
}

// ─── Lead detail panel ──────────────────────────────────────────

function LeadDetailPanel({
  lead, onClose, onConvert,
}: { lead: CrmLead; onClose: () => void; onConvert: () => void }) {
  const { t } = useTranslation();
  const updateLead = useUpdateLead();
  const STATUS_OPTIONS = getStatusOptions(t);
  const [editingNotes, setEditingNotes] = useState(lead.notes ?? '');
  const [notesKey, setNotesKey] = useState(lead.id);

  // Reset notes when selected lead changes
  if (notesKey !== lead.id) {
    setNotesKey(lead.id);
    setEditingNotes(lead.notes ?? '');
  }

  const handleNotesSave = () => {
    const trimmed = editingNotes.trim();
    const current = (lead.notes ?? '').trim();
    if (trimmed !== current) {
      updateLead.mutate({ id: lead.id, notes: trimmed || null });
    }
  };

  const fieldLabelStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)',
    fontWeight: 'var(--font-weight-medium)', textTransform: 'uppercase',
    letterSpacing: '0.04em', fontFamily: 'var(--font-family)',
  };
  const fieldValueStyle: React.CSSProperties = {
    fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', gap: 6,
  };

  return (
    <div className="crm-detail-panel">
      {/* Header */}
      <div style={{
        padding: '12px var(--spacing-lg)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0,
      }}>
        <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'var(--font-family)' }}>
          {t('crm.leads.title')}
        </span>
        <IconButton icon={<X size={14} />} label={t('common.close')} size={28} onClick={onClose} />
      </div>

      {/* Body */}
      <div className="crm-detail-body">
        {/* Name + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-xs)' }}>
          <span style={{ width: 36, height: 36, borderRadius: '50%', background: getAvatarColor(lead.name), color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, flexShrink: 0 }}>
            {lead.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
              {lead.name}
            </div>
            <Badge variant={statusBadgeVariant(lead.status)}>{lead.status}</Badge>
          </div>
        </div>

        {/* Status selector */}
        <div className="crm-detail-field">
          <span style={fieldLabelStyle}>{t('crm.leads.status')}</span>
          <Select
            value={lead.status}
            onChange={(v) => updateLead.mutate({ id: lead.id, status: v })}
            options={STATUS_OPTIONS}
            size="sm"
          />
        </div>

        {lead.email && (
          <div className="crm-detail-field">
            <span style={fieldLabelStyle}>{t('crm.leads.email')}</span>
            <span style={fieldValueStyle}><Mail size={14} style={{ color: 'var(--color-text-tertiary)' }} />{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div className="crm-detail-field">
            <span style={fieldLabelStyle}>{t('crm.leads.phone')}</span>
            <span style={fieldValueStyle}><Phone size={14} style={{ color: 'var(--color-text-tertiary)' }} />{lead.phone}</span>
          </div>
        )}
        {lead.companyName && (
          <div className="crm-detail-field">
            <span style={fieldLabelStyle}>{t('crm.leads.companyName')}</span>
            <span style={fieldValueStyle}><Building2 size={14} style={{ color: 'var(--color-text-tertiary)' }} />{lead.companyName}</span>
          </div>
        )}
        <div className="crm-detail-field">
          <span style={fieldLabelStyle}>{t('crm.leads.source')}</span>
          <Badge variant={sourceBadgeVariant(lead.source)}>{lead.source.replace('_', ' ')}</Badge>
        </div>
        <div className="crm-detail-field">
          <span style={fieldLabelStyle}>{t('crm.leads.notes')}</span>
          <Textarea
            value={editingNotes}
            onChange={(e) => setEditingNotes(e.target.value)}
            onBlur={handleNotesSave}
            placeholder={t('crm.leads.editNotes')}
            style={{ minHeight: 80 }}
          />
        </div>
        <div className="crm-detail-field">
          <span style={fieldLabelStyle}>{t('crm.leads.createdAt')}</span>
          <span style={fieldValueStyle}>{formatDate(lead.createdAt)}</span>
        </div>

        {lead.status !== 'converted' && (
          <div style={{ marginTop: 'var(--spacing-lg)' }}>
            <Button variant="primary" onClick={onConvert} size="md" style={{ width: '100%' }}>
              <ArrowRightLeft size={14} style={{ marginRight: 6 }} />
              {t('crm.leads.convert')}
            </Button>
          </div>
        )}
        {lead.status === 'converted' && (
          <div style={{ marginTop: 'var(--spacing-lg)', padding: 'var(--spacing-md)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
            {t('crm.leads.converted')}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main leads view ────────────────────────────────────────────

export function LeadsView() {
  const { t } = useTranslation();
  const { data: perm } = useMyCrmPermission();
  const canCreateLead = canAccess(perm?.role, 'leads', 'create');
  const canUpdateLead = canAccess(perm?.role, 'leads', 'update');
  const canDeleteLead = canAccess(perm?.role, 'leads', 'delete');
  const [leadsSearchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const STATUS_OPTIONS = getStatusOptions(t);
  const SOURCE_OPTIONS = getSourceOptions(t);
  const { data: leadsData, isLoading } = useLeads({
    search: searchQuery || undefined,
    status: statusFilter || undefined,
    source: sourceFilter || undefined,
  });
  const leads = leadsData?.leads ?? [];
  const deleteLead = useDeleteLead();

  const updateLead = useUpdateLead();
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Auto-open create modal from quick action URL param
  useEffect(() => {
    if (leadsSearchParams.get('action') === 'create') {
      setShowCreateModal(true);
      const next = new URLSearchParams(leadsSearchParams);
      next.delete('action');
      setSearchParams(next, { replace: true });
    }
  }, []);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ rowId: string; column: string } | null>(null);
  const [convertingLead, setConvertingLead] = useState<CrmLead | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortState | null>(() => {
    try {
      const raw = localStorage.getItem('atlasmail_dt_sort_crm_leads');
      if (raw) return JSON.parse(raw) as SortState;
    } catch { /* ignore */ }
    return { column: 'createdAt', direction: 'desc' };
  });

  useEffect(() => {
    try {
      if (sort) {
        localStorage.setItem('atlasmail_dt_sort_crm_leads', JSON.stringify(sort));
      } else {
        localStorage.removeItem('atlasmail_dt_sort_crm_leads');
      }
    } catch { /* ignore */ }
  }, [sort]);

  const selectedLead = selectedLeadId ? leads.find((l) => l.id === selectedLeadId) ?? null : null;

  const handleCellClick = (rowId: string, column: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canUpdateLead) return;
    setEditingCell({ rowId, column });
  };

  const handleSave = (leadId: string, column: string, value: string) => {
    const updates: Record<string, unknown> = { id: leadId };
    switch (column) {
      case 'name': updates.name = value; break;
      case 'email': updates.email = value || null; break;
      case 'companyName': updates.companyName = value || null; break;
    }
    updateLead.mutate(updates as Parameters<typeof updateLead.mutate>[0]);
    setEditingCell(null);
  };

  const isEd = (id: string, col: string) => editingCell?.rowId === id && editingCell?.column === col;

  const InlineInput = ({ value, onSave, onCancel }: { value: string; onSave: (v: string) => void; onCancel: () => void }) => {
    const [val, setVal] = useState(value);
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);
    return (
      <input ref={ref} type="text" value={val} onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') onSave(val); if (e.key === 'Escape') onCancel(); }}
        onBlur={() => onSave(val)}
        style={{ width: '100%', padding: '4px 6px', border: '1px solid var(--color-border-primary)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box' }}
      />
    );
  };

  const leadColumns: DataTableColumn<CrmLead>[] = [
    {
      key: 'name', label: t('crm.leads.name'), icon: <User size={12} />, width: 180, sortable: true,
      searchValue: (lead) => lead.name,
      render: (lead) => isEd(lead.id, 'name') ? (
        <InlineInput value={lead.name} onSave={(v) => handleSave(lead.id, 'name', v)} onCancel={() => setEditingCell(null)} />
      ) : (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', cursor: 'text' }} onClick={(e) => handleCellClick(lead.id, 'name', e)}>
          <span style={{ width: 24, height: 24, borderRadius: '50%', background: getAvatarColor(lead.name), color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
            {lead.name.charAt(0).toUpperCase()}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</span>
        </span>
      ),
    },
    {
      key: 'email', label: t('crm.leads.email'), icon: <Mail size={12} />, width: 180, sortable: true,
      compare: (a, b) => (a.email ?? '').localeCompare(b.email ?? ''),
      searchValue: (lead) => lead.email || '',
      render: (lead) => isEd(lead.id, 'email') ? (
        <InlineInput value={lead.email || ''} onSave={(v) => handleSave(lead.id, 'email', v)} onCancel={() => setEditingCell(null)} />
      ) : (
        <span className="dt-cell-secondary" style={{ cursor: 'text' }} onClick={(e) => handleCellClick(lead.id, 'email', e)}>{lead.email || '-'}</span>
      ),
    },
    {
      key: 'companyName', label: t('crm.leads.companyName'), icon: <Building2 size={12} />, width: 140, sortable: true,
      compare: (a, b) => (a.companyName ?? '').localeCompare(b.companyName ?? ''),
      searchValue: (lead) => lead.companyName || '',
      render: (lead) => isEd(lead.id, 'companyName') ? (
        <InlineInput value={lead.companyName || ''} onSave={(v) => handleSave(lead.id, 'companyName', v)} onCancel={() => setEditingCell(null)} />
      ) : (
        <span className="dt-cell-secondary" style={{ cursor: 'text' }} onClick={(e) => handleCellClick(lead.id, 'companyName', e)}>{lead.companyName || '-'}</span>
      ),
    },
    {
      key: 'source', label: t('crm.leads.source'), icon: <Globe size={12} />, width: 110, sortable: true,
      compare: (a, b) => a.source.localeCompare(b.source),
      searchValue: (lead) => lead.source.replace('_', ' '),
      render: (lead) => <Badge variant={sourceBadgeVariant(lead.source)}>{lead.source.replace('_', ' ')}</Badge>,
    },
    {
      key: 'status', label: t('crm.leads.status'), icon: <Tag size={12} />, width: 100, sortable: true,
      compare: (a, b) => a.status.localeCompare(b.status),
      searchValue: (lead) => lead.status,
      render: (lead) => <Badge variant={statusBadgeVariant(lead.status)}>{lead.status}</Badge>,
    },
    {
      key: 'createdAt', label: t('crm.leads.createdAt'), icon: <Plus size={12} />, width: 100, sortable: true,
      searchValue: (lead) => formatDate(lead.createdAt),
      render: (lead) => <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>{formatDate(lead.createdAt)}</span>,
    },
    ...(canDeleteLead ? [{
      key: 'actions', label: '', width: 36,
      searchValue: () => '',
      render: (lead: CrmLead) => (
        <IconButton icon={<Trash2 size={13} />} label={t('crm.actions.delete')} size={24} destructive onClick={(e) => { e.stopPropagation(); setDeletingId(lead.id); }} />
      ),
    } as DataTableColumn<CrmLead>] : []),
  ];

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div className="crm-content-header">
          <span className="crm-content-header-title">
            {t('crm.leads.title')}
            <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 400, marginLeft: 8 }}>&middot; {leads.length}</span>
          </span>
          <div className="crm-content-header-actions">
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
              <Input
                iconLeft={<Search size={14} />}
                placeholder={t('crm.actions.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="sm"
                style={{ width: 200 }}
              />
              <Select
                value={statusFilter}
                onChange={(v) => setStatusFilter(v)}
                options={[{ value: '', label: t('crm.leads.status') }, ...STATUS_OPTIONS]}
                size="sm"
                width={140}
              />
              <Select
                value={sourceFilter}
                onChange={(v) => setSourceFilter(v)}
                options={[{ value: '', label: t('crm.leads.source') }, ...SOURCE_OPTIONS]}
                size="sm"
                width={140}
              />
              {canCreateLead && (
                <Button variant="primary" onClick={() => setShowCreateModal(true)} size="sm">
                  <UserPlus size={14} style={{ marginRight: 4 }} />
                  {t('crm.leads.newLead')}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: 40, fontFamily: 'var(--font-family)' }}>{t('common.loading')}</div>
        ) : (
          <DataTable
            data={leads}
            columns={leadColumns}
            activeRowId={selectedLeadId}
            onRowClick={(lead) => setSearchParams({ view: 'lead-detail', leadId: lead.id })}
            onAddRow={canCreateLead ? () => setShowCreateModal(true) : undefined}
            addRowLabel={t('crm.actions.addNew')}
            emptyTitle={t('crm.leads.noLeads')}
            paginated={false}
            sort={sort}
            onSortChange={setSort}
            exportable
            columnSelector
            resizableColumns
            storageKey="crm-leads"
          />
        )}
      </div>

      {/* Detail panel removed — now uses full-page LeadDetailPage */}

      {/* Modals */}
      <CreateLeadModal open={showCreateModal} onClose={() => setShowCreateModal(false)} />
      <ConvertLeadModal open={!!convertingLead} onClose={() => setConvertingLead(null)} lead={convertingLead} />
      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(open) => { if (!open) setDeletingId(null); }}
        title={t('crm.actions.delete')}
        description={t('crm.bulk.deleteDescription')}
        onConfirm={() => { if (deletingId) { deleteLead.mutate(deletingId); setDeletingId(null); if (selectedLeadId === deletingId) setSelectedLeadId(null); } }}
        destructive
      />
    </div>
  );
}
