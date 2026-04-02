import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, Search, ChevronRight, Trash2, ArrowRightLeft, User, Mail, Building2, Globe, Tag, Plus } from 'lucide-react';
import {
  useLeads, useCreateLead, useUpdateLead, useDeleteLead, useConvertLead, useStages,
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
import { ColumnHeader } from '../../../components/ui/column-header';
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

function ConvertLeadModal({
  open, onClose, lead,
}: { open: boolean; onClose: () => void; lead: CrmLead | null }) {
  const { t } = useTranslation();
  const convertLead = useConvertLead();
  const { data: stagesData } = useStages();
  const stages = stagesData?.stages ?? [];
  const [dealTitle, setDealTitle] = useState('');
  const [dealStageId, setDealStageId] = useState('');
  const [dealValue, setDealValue] = useState('0');

  const defaultStage = stages.find((s) => s.isDefault) ?? stages[0];

  const handleSubmit = () => {
    if (!lead || !dealTitle.trim()) return;
    const stageId = dealStageId || defaultStage?.id;
    if (!stageId) return;

    convertLead.mutate({
      leadId: lead.id,
      dealTitle: dealTitle.trim(),
      dealStageId: stageId,
      dealValue: Number(dealValue) || 0,
    }, { onSuccess: () => { onClose(); } });
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <Modal.Header title={t('crm.leads.convertTitle')} />
      <Modal.Body>
        {lead && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div style={{ padding: 'var(--spacing-md)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-size-sm)' }}>
              <div style={{ fontWeight: 'var(--font-weight-medium)', marginBottom: 4 }}>{t('crm.leads.convertDescription')}</div>
            </div>
            <Input label={t('crm.leads.dealTitle')} value={dealTitle} onChange={(e) => setDealTitle(e.target.value)} size="md" />
            <div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginBottom: 4 }}>{t('crm.leads.selectStage')}</div>
              <Select
                value={dealStageId || defaultStage?.id || ''}
                onChange={(v) => setDealStageId(v)}
                options={stages.map((s) => ({ value: s.id, label: s.name }))}
                size="md"
              />
            </div>
            <Input label={t('crm.deals.value')} type="number" value={dealValue} onChange={(e) => setDealValue(e.target.value)} size="md" />
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onClose} size="md">{t('common.cancel')}</Button>
        <Button variant="primary" onClick={handleSubmit} size="md" disabled={!dealTitle.trim() || convertLead.isPending}>
          {convertLead.isPending ? t('common.loading') : t('crm.leads.convert')}
        </Button>
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

  return (
    <div className="crm-detail-panel">
      <div className="crm-detail-panel-header">
        <span className="crm-detail-panel-title">{lead.name}</span>
        <IconButton icon={<ChevronRight size={14} />} label="Close" onClick={onClose} />
      </div>
      <div className="crm-detail-panel-body">
        <div className="crm-detail-field">
          <span className="crm-detail-label">{t('crm.leads.status')}</span>
          <Select
            value={lead.status}
            onChange={(v) => updateLead.mutate({ id: lead.id, status: v })}
            options={STATUS_OPTIONS}
            size="sm"
          />
        </div>
        {lead.email && (
          <div className="crm-detail-field">
            <span className="crm-detail-label">{t('crm.leads.email')}</span>
            <span className="crm-detail-value">{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div className="crm-detail-field">
            <span className="crm-detail-label">{t('crm.leads.phone')}</span>
            <span className="crm-detail-value">{lead.phone}</span>
          </div>
        )}
        {lead.companyName && (
          <div className="crm-detail-field">
            <span className="crm-detail-label">{t('crm.leads.companyName')}</span>
            <span className="crm-detail-value">{lead.companyName}</span>
          </div>
        )}
        <div className="crm-detail-field">
          <span className="crm-detail-label">{t('crm.leads.source')}</span>
          <Badge variant={sourceBadgeVariant(lead.source)}>{lead.source.replace('_', ' ')}</Badge>
        </div>
        <div className="crm-detail-field">
          <span className="crm-detail-label">{t('crm.leads.notes')}</span>
          <Textarea
            value={editingNotes}
            onChange={(e) => setEditingNotes(e.target.value)}
            onBlur={handleNotesSave}
            placeholder={t('crm.leads.editNotes')}
            style={{ minHeight: 80 }}
          />
        </div>
        <div className="crm-detail-field">
          <span className="crm-detail-label">Created</span>
          <span className="crm-detail-value">{formatDate(lead.createdAt)}</span>
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

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [convertingLead, setConvertingLead] = useState<CrmLead | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const selectedLead = selectedLeadId ? leads.find((l) => l.id === selectedLeadId) ?? null : null;

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
              <Button variant="primary" onClick={() => setShowCreateModal(true)} size="sm">
                <UserPlus size={14} style={{ marginRight: 4 }} />
                {t('crm.leads.newLead')}
              </Button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-lg)' }}>
          {isLoading ? (
            <div style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: 40 }}>{t('common.loading')}</div>
          ) : leads.length === 0 ? (
            <div style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', padding: 40 }}>
              {t('crm.leads.noLeads')}
            </div>
          ) : (
            <table className="crm-table">
              <thead>
                <tr>
                  <th><ColumnHeader label={t('crm.leads.name')} icon={<User size={12} />} /></th>
                  <th><ColumnHeader label={t('crm.leads.email')} icon={<Mail size={12} />} /></th>
                  <th><ColumnHeader label={t('crm.leads.companyName')} icon={<Building2 size={12} />} /></th>
                  <th><ColumnHeader label={t('crm.leads.source')} icon={<Globe size={12} />} /></th>
                  <th><ColumnHeader label={t('crm.leads.status')} icon={<Tag size={12} />} /></th>
                  <th>{t('crm.deals.closeDate')}</th>
                  <th style={{ width: 60 }}>{t('crm.actions.delete')}</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className={selectedLeadId === lead.id ? 'crm-row-selected' : ''}
                    onClick={() => setSelectedLeadId(lead.id)}
                    style={{ cursor: 'pointer' }}
                    role="button"
                    tabIndex={0}
                    aria-label={t('crm.leads.name') + ': ' + lead.name}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedLeadId(lead.id); } }}
                  >
                    <td className="crm-cell-primary">
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 24, height: 24, borderRadius: '50%', background: getAvatarColor(lead.name), color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                          {lead.name.charAt(0).toUpperCase()}
                        </span>
                        {lead.name}
                      </span>
                    </td>
                    <td>{lead.email || '--'}</td>
                    <td>{lead.companyName || '--'}</td>
                    <td><Badge variant={sourceBadgeVariant(lead.source)}>{lead.source.replace('_', ' ')}</Badge></td>
                    <td><Badge variant={statusBadgeVariant(lead.status)}>{lead.status}</Badge></td>
                    <td>{formatDate(lead.createdAt)}</td>
                    <td>
                      <IconButton
                        icon={<Trash2 size={13} />}
                        label={t('crm.actions.delete')}
                        destructive
                        aria-label={t('crm.actions.delete') + ' ' + lead.name}
                        onClick={(e) => { e.stopPropagation(); setDeletingId(lead.id); }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!isLoading && (
            <div className="crm-add-row" onClick={() => setShowCreateModal(true)}>
              <Plus size={14} /> {t('crm.actions.addNew')}
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLeadId(null)}
          onConvert={() => setConvertingLead(selectedLead)}
        />
      )}

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
