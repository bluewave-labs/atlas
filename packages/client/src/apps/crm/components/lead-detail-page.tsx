import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Trophy, XCircle,
  Mail, Phone, Tag, Sparkles, Loader2,
  ArrowRightLeft, Trash2, Check, RefreshCw,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Chip } from '../../../components/ui/chip';
import { EditableField } from '../../../components/ui/editable-field';
import { getActivityIcon, timeAgo } from '../utils';
import { IconButton } from '../../../components/ui/icon-button';
import { Textarea } from '../../../components/ui/textarea';
import { Popover, PopoverTrigger, PopoverContent } from '../../../components/ui/popover';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import {
  useLeads, useUpdateLead, useDeleteLead, useConvertLead, useEnrichLead, useStages,
  useActivities, useCreateActivity, useUpdateActivity, useDeleteActivity, useCompleteActivity,
  useMyCrmPermission, canAccess,
  type CrmLead, type CrmLeadStatus, type CrmLeadSource,
} from '../hooks';
import { ConvertLeadModal } from './leads-view';
import { formatDate } from '../../../lib/format';
import { AlertBanner } from '../../../components/ui/alert-banner';

// ─── Status pipeline ────────────────────────────────────────────

const LEAD_STATUSES: CrmLeadStatus[] = ['new', 'contacted', 'qualified', 'converted'];

function StatusPipeline({ status, onChange, updatedAt }: { status: CrmLeadStatus; onChange: (s: CrmLeadStatus) => void; updatedAt?: string }) {
  const { t } = useTranslation();
  const labels: Record<CrmLeadStatus, string> = {
    new: t('crm.leads.new'),
    contacted: t('crm.leads.contacted'),
    qualified: t('crm.leads.qualified'),
    converted: t('crm.leads.converted'),
    lost: t('crm.leads.lost'),
  };

  const currentIdx = LEAD_STATUSES.indexOf(status);

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {LEAD_STATUSES.map((s, i) => {
        const isActive = i <= currentIdx && status !== 'lost';
        const isCurrent = s === status;
        const activeBg = 'var(--color-accent-primary)';
        const inactiveBg = 'var(--color-bg-tertiary)';
        const bg = isActive ? activeBg : inactiveBg;
        const nextIsActive = i < LEAD_STATUSES.length - 1 && (i + 1) <= currentIdx && status !== 'lost';

        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
            <div
              onClick={() => onChange(s)}
              style={{
                position: 'relative',
                padding: '8px 24px 8px 16px',
                paddingLeft: i === 0 ? 16 : 24,
                background: bg,
                color: isActive ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-sm)',
                fontWeight: isCurrent ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
                fontFamily: 'var(--font-family)',
                cursor: 'pointer',
                clipPath: i === LEAD_STATUSES.length - 1
                  ? 'polygon(0 0, calc(100% - 0px) 0, 100% 50%, calc(100% - 0px) 100%, 0 100%, 12px 50%)'
                  : i === 0
                    ? 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)'
                    : 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)',
                transition: 'background 0.15s',
                minWidth: 100,
                textAlign: 'center',
              }}
            >
              {labels[s]}
              {isCurrent && updatedAt && (
                <span style={{ fontSize: 'var(--font-size-xs)', opacity: 0.7, marginLeft: 4 }}>
                  {timeAgo(updatedAt)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────

interface LeadDetailPageProps {
  leadId: string;
  onBack: () => void;
  onNavigate: (leadId: string) => void;
}

export function LeadDetailPage({ leadId, onBack, onNavigate }: LeadDetailPageProps) {
  const { t } = useTranslation();
  const [, setSearchParams] = useSearchParams();
  const { data: perm } = useMyCrmPermission();
  const canUpdateLead = canAccess(perm?.role, 'leads', 'update');
  const canDeleteLead = canAccess(perm?.role, 'leads', 'delete');
  const canCreateContact = canAccess(perm?.role, 'contacts', 'create');
  const canCreateActivityPerm = canAccess(perm?.role, 'activities', 'create');
  const { data: leadsData } = useLeads({});
  const leads = leadsData?.leads ?? [];
  const lead = leads.find(l => l.id === leadId);
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const enrichLead = useEnrichLead();
  const { data: activitiesData } = useActivities({ contactId: lead?.convertedContactId || undefined });
  const createActivity = useCreateActivity();

  const [activeTab, setActiveTab] = useState<'notes' | 'extra'>('notes');
  const [showConvert, setShowConvert] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [editingNotes, setEditingNotes] = useState('');
  const [notesKey, setNotesKey] = useState('');
  const [newActivityType, setNewActivityType] = useState('note');
  const [newActivityBody, setNewActivityBody] = useState('');

  // Sync notes with lead
  if (lead && notesKey !== lead.id) {
    setNotesKey(lead.id);
    setEditingNotes(lead.notes ?? '');
  }

  // Navigation
  const currentIdx = leads.findIndex(l => l.id === leadId);
  const canPrev = currentIdx > 0;
  const canNext = currentIdx < leads.length - 1 && currentIdx >= 0;

  const handleNotesSave = useCallback(() => {
    if (!lead) return;
    const trimmed = editingNotes.trim();
    if (trimmed !== (lead.notes ?? '').trim()) {
      updateLead.mutate({ id: lead.id, updatedAt: lead.updatedAt, notes: trimmed || null });
    }
  }, [lead, editingNotes, updateLead]);

  const handleLogActivity = useCallback(() => {
    if (!lead || !newActivityBody.trim()) return;
    createActivity.mutate({
      type: newActivityType,
      body: newActivityBody.trim(),
      contactId: lead.convertedContactId || undefined,
    }, {
      onSuccess: () => setNewActivityBody(''),
    });
  }, [lead, newActivityType, newActivityBody, createActivity]);

  if (!lead) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
        {t('crm.leads.notFound')}
      </div>
    );
  }

  const enrichedData = lead.enrichedData as Record<string, unknown> | null;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)',
        padding: 'var(--spacing-sm) var(--spacing-lg)',
        borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0,
      }}>
        <IconButton icon={<ArrowLeft size={16} />} label={t('common.previous')} size={28} onClick={onBack} />
        <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
          {lead.name}
        </span>
        <div style={{ flex: 1 }} />

        {/* Won / Lost */}
        {lead.status !== 'converted' && lead.status !== 'lost' && canUpdateLead && (
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
            <Button variant="primary" size="sm" icon={<Trophy size={13} />} onClick={() => updateLead.mutate({ id: lead.id, updatedAt: lead.updatedAt, status: 'converted' })}>
              {t('crm.deals.markWon')}
            </Button>
            <Button variant="danger" size="sm" icon={<XCircle size={13} />} onClick={() => updateLead.mutate({ id: lead.id, updatedAt: lead.updatedAt, status: 'lost' })}>
              {t('crm.deals.markLost')}
            </Button>
          </div>
        )}

        {/* Navigation */}
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
          {currentIdx >= 0 ? `${currentIdx + 1} / ${leads.length}` : ''}
        </span>
        <IconButton icon={<ChevronLeft size={16} />} label={t('common.previous')} size={28} onClick={() => canPrev && onNavigate(leads[currentIdx - 1].id)} style={{ opacity: canPrev ? 1 : 0.3 }} />
        <IconButton icon={<ChevronRight size={16} />} label={t('common.next')} size={28} onClick={() => canNext && onNavigate(leads[currentIdx + 1].id)} style={{ opacity: canNext ? 1 : 0.3 }} />
      </div>

      {/* Status pipeline */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--spacing-sm) var(--spacing-lg)',
        borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0,
      }}>
        <StatusPipeline status={lead.status} onChange={(s) => { if (canUpdateLead) updateLead.mutate({ id: lead.id, updatedAt: lead.updatedAt, status: s }); }} updatedAt={lead.updatedAt} />
      </div>

      {/* Converted banner */}
      {lead.status === 'converted' && lead.convertedDealId && (
        <div style={{ padding: 'var(--spacing-sm) var(--spacing-lg)', flexShrink: 0 }}>
          <AlertBanner variant="success">
            {t('crm.leads.convertedBanner')}{' '}
            <button
              onClick={() => setSearchParams({ view: 'deal-detail', dealId: lead.convertedDealId! }, { replace: true })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent-primary)', fontSize: 'inherit', fontFamily: 'inherit', padding: 0 }}
            >
              {t('crm.leads.viewConvertedDeal')} →
            </button>
          </AlertBanner>
        </div>
      )}

      {/* Main content */}
      <div className="crm-detail-split">
        {/* Left column — Lead info */}
        <div className="crm-detail-main">
          {/* Lead name */}
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', margin: 0 }}>
            {lead.name}
          </h2>

          {/* Field grid — all editable */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
            <EditableField label={t('crm.leads.expectedRevenue')} value={String(lead.expectedRevenue || 0)} type="number" onSave={(v) => updateLead.mutate({ id: lead.id, updatedAt: lead.updatedAt, expectedRevenue: Number(v) || 0 })} />
            <EditableField label={t('crm.deals.probability')} value={String(lead.probability || 0)} type="number" suffix="%" onSave={(v) => updateLead.mutate({ id: lead.id, updatedAt: lead.updatedAt, probability: Number(v) || 0 })} />
            <EditableField label={t('crm.deals.contact')} value={lead.name} onSave={(v) => updateLead.mutate({ id: lead.id, updatedAt: lead.updatedAt, name: v })} />
            <EditableField label={t('crm.leads.salesperson')} value={lead.assignedUserId || ''} onSave={() => {}} />
            <EditableField label={t('crm.leads.email')} value={lead.email || ''} onSave={(v) => updateLead.mutate({ id: lead.id, updatedAt: lead.updatedAt, email: v || null })} />
            <EditableField label={t('crm.leads.expectedClosing')} value={lead.expectedCloseDate ? lead.expectedCloseDate.split('T')[0] : ''} type="date" onSave={(v) => updateLead.mutate({ id: lead.id, updatedAt: lead.updatedAt, expectedCloseDate: v || null })} />
            <EditableField label={t('crm.leads.phone')} value={lead.phone || ''} onSave={(v) => updateLead.mutate({ id: lead.id, updatedAt: lead.updatedAt, phone: v || null })} />
            <EditableField label={t('crm.leads.companyName')} value={lead.companyName || ''} onSave={(v) => updateLead.mutate({ id: lead.id, updatedAt: lead.updatedAt, companyName: v || null })} />
          </div>

          {/* Tags */}
          {lead.tags && lead.tags.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
              <Tag size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
              {lead.tags.map((tag, i) => (
                <Chip key={i}>{tag}</Chip>
              ))}
            </div>
          )}

          {/* Tabs: Notes / Extra Info */}
          <div>
            <div style={{
              display: 'flex', gap: 0,
              borderBottom: '1px solid var(--color-border-secondary)',
            }}>
              <TabButton label={t('crm.leads.notes')} active={activeTab === 'notes'} onClick={() => setActiveTab('notes')} />
              <TabButton label={t('crm.leads.extraInfo')} active={activeTab === 'extra'} onClick={() => setActiveTab('extra')} />
            </div>

            {activeTab === 'notes' && (
              <div style={{ padding: 'var(--spacing-md) 0' }}>
                <Textarea
                  value={editingNotes}
                  onChange={(e) => setEditingNotes(e.target.value)}
                  onBlur={handleNotesSave}
                  placeholder={t('crm.leads.editNotes')}
                  style={{ minHeight: 150 }}
                />
              </div>
            )}

            {activeTab === 'extra' && (
              <div style={{ padding: 'var(--spacing-md) 0' }}>
                {enrichedData ? (
                  <EnrichmentResults
                    data={enrichedData}
                    enrichedAt={lead.enrichedAt}
                    onRefresh={() => enrichLead.mutate(lead.id)}
                    isRefreshing={enrichLead.isPending}
                    leadTags={lead.tags || []}
                    onAddTag={(tag) => updateLead.mutate({ id: lead.id, updatedAt: lead.updatedAt, tags: [...(lead.tags || []), tag] })}
                  />
                ) : (
                  <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                    <Sparkles size={32} style={{ marginBottom: 'var(--spacing-sm)', opacity: 0.3 }} />
                    <p style={{ fontSize: 'var(--font-size-sm)', margin: '0 0 var(--spacing-md) 0' }}>
                      {t('crm.leads.noEnrichmentData')}
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={enrichLead.isPending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
                      onClick={() => enrichLead.mutate(lead.id)}
                      disabled={enrichLead.isPending}
                    >
                      {enrichLead.isPending ? t('crm.leads.enriching') : t('crm.leads.enrichWithAI')}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'auto', paddingTop: 'var(--spacing-lg)' }}>
            {!enrichedData && (
              <Button
                variant="secondary"
                size="sm"
                icon={enrichLead.isPending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={14} />}
                onClick={() => enrichLead.mutate(lead.id)}
                disabled={enrichLead.isPending}
              >
                {enrichLead.isPending ? t('crm.leads.enriching') : t('crm.leads.enrichWithAI')}
              </Button>
            )}
            {lead.status !== 'converted' && canCreateContact && (
              <Button variant="primary" size="sm" icon={<ArrowRightLeft size={14} />} onClick={() => setShowConvert(true)}>
                {t('crm.leads.convert')}
              </Button>
            )}
            <div style={{ flex: 1 }} />
            {canDeleteLead && (
              <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setShowDelete(true)}>
                {t('common.delete')}
              </Button>
            )}
          </div>
        </div>

        {/* Right column — Activity */}
        <div className="crm-detail-side">
          <div style={{
            fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-tertiary)', textTransform: 'uppercase',
            letterSpacing: '0.04em', fontFamily: 'var(--font-family)',
          }}>
            {t('crm.sidebar.activities')}
          </div>

          {/* Log activity */}
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'flex-end' }}>
            <Select
              value={newActivityType}
              onChange={setNewActivityType}
              options={[
                { value: 'note', label: t('crm.activities.note') },
                { value: 'call', label: t('crm.activities.call') },
                { value: 'email', label: t('crm.activities.email') },
                { value: 'meeting', label: t('crm.activities.meeting') },
              ]}
              size="sm"
              width={100}
            />
            <Input
              value={newActivityBody}
              onChange={(e) => setNewActivityBody(e.target.value)}
              placeholder={t('crm.activities.logActivity')}
              size="sm"
              style={{ flex: 1 }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLogActivity(); }}
            />
            <Button variant="primary" size="sm" onClick={handleLogActivity} disabled={!newActivityBody.trim() || !canCreateActivityPerm}>
              {t('crm.activities.logActivity')}
            </Button>
          </div>

          {/* Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            {(activitiesData?.activities ?? []).length === 0 ? (
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', padding: 'var(--spacing-lg) 0', textAlign: 'center' }}>
                {t('crm.activities.noActivities')}
              </div>
            ) : (
              (activitiesData?.activities ?? []).slice(0, 20).map((activity) => (
                <div key={activity.id} style={{
                  display: 'flex', gap: 'var(--spacing-sm)', padding: 'var(--spacing-sm) 0',
                  borderBottom: '1px solid var(--color-border-secondary)',
                }}>
                  <span style={{ color: 'var(--color-text-tertiary)', flexShrink: 0, marginTop: 2 }}>
                    {getActivityIcon(activity.type)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                      {activity.body}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', marginTop: 2 }}>
                      {activity.type} &middot; {formatDate(activity.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showConvert && (
        <ConvertLeadModal open={showConvert} onClose={() => setShowConvert(false)} lead={lead} />
      )}
      <ConfirmDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        title={t('crm.leads.deleteLead')}
        description={t('crm.confirm.deleteContact', { name: lead.name })}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={() => { deleteLead.mutate(lead.id); onBack(); }}
      />
    </div>
  );
}

// ─── Helper components ──────────────────────────────────────────

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
        fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)',
        fontWeight: active ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
        borderBottom: active ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
        marginBottom: -1,
        transition: 'color 0.1s, border-color 0.1s',
      }}
    >
      {label}
    </button>
  );
}

function EnrichmentResults({ data, enrichedAt, onRefresh, isRefreshing, leadTags, onAddTag }: {
  data: Record<string, unknown>;
  enrichedAt: string | null | undefined;
  onRefresh: () => void;
  isRefreshing: boolean;
  leadTags: string[];
  onAddTag: (tag: string) => void;
}) {
  const { t } = useTranslation();
  const industry = data.companyIndustry as string | null;
  const compSize = data.companySize as string | null;
  const compDesc = data.companyDescription as string | null;
  const linkedin = data.linkedinUrl as string | null;
  const score = typeof data.leadScore === 'number' ? data.leadScore : null;
  const scoreReason = data.scoreReason as string | null;
  const tags = Array.isArray(data.suggestedTags) ? (data.suggestedTags as string[]) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
      {industry && (
        <div className="crm-detail-field">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-medium)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)' }}>{t('crm.companies.industry')}</span>
          <span><Chip>{industry}</Chip></span>
        </div>
      )}
      {compSize && (
        <div className="crm-detail-field">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-medium)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)' }}>{t('crm.companies.size')}</span>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>{compSize}</span>
        </div>
      )}
      {compDesc && (
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)', lineHeight: 1.5 }}>
          {compDesc}
        </div>
      )}
      {linkedin && (
        <div className="crm-detail-field">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-medium)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)' }}>LinkedIn</span>
          <a href={linkedin.startsWith('http') ? linkedin : `https://${linkedin}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-accent-primary)', fontFamily: 'var(--font-family)', textDecoration: 'none' }}>
            {linkedin}
          </a>
        </div>
      )}
      {score !== null && (
        <div className="crm-detail-field">
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-medium)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)' }}>
            {t('crm.leads.leadScore')}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 36, height: 36, borderRadius: '50%',
              background: score >= 70 ? 'var(--color-success)' : score >= 40 ? 'var(--color-warning)' : 'var(--color-error)',
              color: 'var(--color-text-inverse)', fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-bold)', fontFamily: 'var(--font-family)',
            }}>
              {score}
            </span>
            {scoreReason && (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', fontStyle: 'italic', flex: 1 }}>
                {scoreReason}
              </span>
            )}
          </div>
        </div>
      )}
      {tags.length > 0 && (
        <div>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-medium)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)', display: 'block', marginBottom: 4 }}>
            {t('crm.leads.suggestedTags')}
          </span>
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
            {tags.map((tag, i) => {
              const alreadyAdded = leadTags.includes(tag);
              return (
                <span
                  key={i}
                  onClick={() => !alreadyAdded && onAddTag(tag)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '2px 8px', borderRadius: 'var(--radius-sm)',
                    fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-family)',
                    background: alreadyAdded ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
                    color: alreadyAdded ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                    cursor: alreadyAdded ? 'default' : 'pointer',
                    border: '1px solid transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  {alreadyAdded && <Check size={10} />}
                  {tag}
                </span>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', paddingTop: 'var(--spacing-sm)', borderTop: '1px solid var(--color-border-secondary)' }}>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
          {enrichedAt ? `${t('crm.leads.enriched')} ${formatDate(enrichedAt)}` : t('crm.leads.enriched')}
        </span>
        <Button
          variant="ghost"
          size="sm"
          icon={isRefreshing ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          {isRefreshing ? t('crm.leads.refreshing') : t('crm.leads.refresh')}
        </Button>
      </div>
    </div>
  );
}
