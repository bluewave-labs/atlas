import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Trophy, XCircle,
  Trash2,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { Badge } from '../../../components/ui/badge';
import { IconButton } from '../../../components/ui/icon-button';
import { Textarea } from '../../../components/ui/textarea';
import { StatusDot } from '../../../components/ui/status-dot';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { EditableField } from '../../../components/ui/editable-field';
import { MarkLostModal } from './mark-lost-modal';
import { getActivityIcon } from '../utils';
import { NotesSection } from './notes-section';
import { EmailTimeline } from './email-timeline';
import {
  useDeals, useUpdateDeal, useDeleteDeal, useMarkDealWon, useMarkDealLost,
  useStages, useContacts, useCompanies,
  useActivities, useCreateActivity, useUpdateActivity, useDeleteActivity, useCompleteActivity,
  type CrmDeal, type CrmDealStage,
} from '../hooks';
import { formatDate, formatCurrency } from '../../../lib/format';

// ─── Stage pipeline with arrows ─────────────────────────────────

function StagePipeline({ stages, currentStageId, isWon, isLost, onChange }: {
  stages: CrmDealStage[];
  currentStageId: string;
  isWon: boolean;
  isLost: boolean;
  onChange: (stageId: string) => void;
}) {
  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.sequence - b.sequence), [stages]);
  const currentIdx = sortedStages.findIndex(s => s.id === currentStageId);

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {sortedStages.map((stage, i) => {
        const isActive = !isLost && i <= currentIdx;
        const isCurrent = stage.id === currentStageId;
        const stageColor = isLost ? 'var(--color-text-tertiary)' : stage.color;

        return (
          <div
            key={stage.id}
            onClick={() => !isWon && !isLost && onChange(stage.id)}
            style={{
              padding: '8px 24px 8px 16px',
              paddingLeft: i === 0 ? 16 : 24,
              background: isActive ? stageColor : 'var(--color-bg-tertiary)',
              color: isActive ? '#fff' : 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-sm)',
              fontWeight: isCurrent ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
              fontFamily: 'var(--font-family)',
              cursor: isWon || isLost ? 'default' : 'pointer',
              opacity: isLost ? 0.6 : 1,
              clipPath: i === sortedStages.length - 1
                ? 'polygon(0 0, calc(100% - 0px) 0, 100% 50%, calc(100% - 0px) 100%, 0 100%, 12px 50%)'
                : i === 0
                  ? 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)'
                  : 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)',
              transition: 'background 0.15s',
              minWidth: 80,
              textAlign: 'center',
              whiteSpace: 'nowrap',
            }}
          >
            {stage.name}
            {stage.probability > 0 && (
              <span style={{ fontSize: 'var(--font-size-xs)', opacity: 0.7, marginLeft: 4 }}>
                {stage.probability}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────

interface DealDetailPageProps {
  dealId: string;
  onBack: () => void;
  onNavigate: (dealId: string) => void;
}

export function DealDetailPage({ dealId, onBack, onNavigate }: DealDetailPageProps) {
  const { t } = useTranslation();
  const { data: dealsData } = useDeals({});
  const deals = dealsData?.deals ?? [];
  const deal = deals.find(d => d.id === dealId);
  const { data: stagesData } = useStages();
  const stages = stagesData?.stages ?? [];
  const { data: contactsData } = useContacts({});
  const contacts = contactsData?.contacts ?? [];
  const { data: companiesData } = useCompanies({});
  const companies = companiesData?.companies ?? [];
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  const markWon = useMarkDealWon();
  const markLost = useMarkDealLost();
  const { data: activitiesData } = useActivities({ dealId });
  const activities = activitiesData?.activities ?? [];
  const createActivity = useCreateActivity();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMarkLost, setShowMarkLost] = useState(false);
  const [newActivityType, setNewActivityType] = useState('note');
  const [newActivityBody, setNewActivityBody] = useState('');

  // Navigation
  const currentIdx = deals.findIndex(d => d.id === dealId);
  const canPrev = currentIdx > 0;
  const canNext = currentIdx < deals.length - 1 && currentIdx >= 0;

  const handleLogActivity = useCallback(() => {
    if (!deal || !newActivityBody.trim()) return;
    createActivity.mutate({
      type: newActivityType,
      body: newActivityBody.trim(),
      dealId: deal.id,
      contactId: deal.contactId || undefined,
    }, {
      onSuccess: () => setNewActivityBody(''),
    });
  }, [deal, newActivityType, newActivityBody, createActivity]);

  if (!deal) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
        Deal not found
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)',
        padding: 'var(--spacing-sm) var(--spacing-lg)',
        borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0,
      }}>
        <IconButton icon={<ArrowLeft size={16} />} label="Back" size={28} onClick={onBack} />
        <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
          {deal.title}
        </span>
        <div style={{ flex: 1 }} />

        {/* Won / Lost */}
        {!deal.wonAt && !deal.lostAt && (
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
            <Button variant="primary" size="sm" icon={<Trophy size={13} />} onClick={() => markWon.mutate(deal.id)}>
              Won
            </Button>
            <Button variant="danger" size="sm" icon={<XCircle size={13} />} onClick={() => setShowMarkLost(true)}>
              Lost
            </Button>
          </div>
        )}
        {deal.wonAt && <Badge variant="success">Won {formatDate(deal.wonAt)}</Badge>}
        {deal.lostAt && <Badge variant="error">Lost {formatDate(deal.lostAt)}</Badge>}

        {/* Navigation */}
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
          {currentIdx >= 0 ? `${currentIdx + 1} / ${deals.length}` : ''}
        </span>
        <IconButton icon={<ChevronLeft size={16} />} label="Previous" size={28} onClick={() => canPrev && onNavigate(deals[currentIdx - 1].id)} style={{ opacity: canPrev ? 1 : 0.3 }} />
        <IconButton icon={<ChevronRight size={16} />} label="Next" size={28} onClick={() => canNext && onNavigate(deals[currentIdx + 1].id)} style={{ opacity: canNext ? 1 : 0.3 }} />
      </div>

      {/* Stage pipeline */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--spacing-sm) var(--spacing-lg)',
        borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0,
      }}>
        <StagePipeline stages={stages} currentStageId={deal.stageId} isWon={!!deal.wonAt} isLost={!!deal.lostAt} onChange={(stageId) => updateDeal.mutate({ id: deal.id, stageId })} />
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left column — Deal info */}
        <div style={{ flex: 6, overflow: 'auto', padding: 'var(--spacing-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          {/* Deal title */}
          <h2 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', margin: 0 }}>
            {deal.title}
          </h2>

          {/* Editable field grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)' }}>
            <EditableField
              label={t('crm.deals.value')}
              value={String(deal.value)}
              type="number"
              onSave={(v) => updateDeal.mutate({ id: deal.id, value: Number(v) || 0 })}
            />
            <EditableField
              label={t('crm.deals.probability')}
              value={String(deal.probability)}
              type="number"
              suffix="%"
              onSave={(v) => updateDeal.mutate({ id: deal.id, probability: Number(v) || 0 })}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-medium)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)' }}>
                {t('crm.deals.contact')}
              </span>
              <Select
                value={deal.contactId || ''}
                onChange={(v) => updateDeal.mutate({ id: deal.id, contactId: v || null })}
                options={[{ value: '', label: 'None' }, ...contacts.map(c => ({ value: c.id, label: c.name }))]}
                size="sm"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-medium)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)' }}>
                {t('crm.deals.company')}
              </span>
              <Select
                value={deal.companyId || ''}
                onChange={(v) => updateDeal.mutate({ id: deal.id, companyId: v || null })}
                options={[{ value: '', label: 'None' }, ...companies.map(c => ({ value: c.id, label: c.name }))]}
                size="sm"
              />
            </div>
            <EditableField
              label={t('crm.deals.expectedClose')}
              value={deal.expectedCloseDate ? deal.expectedCloseDate.split('T')[0] : ''}
              type="date"
              onSave={(v) => updateDeal.mutate({ id: deal.id, expectedCloseDate: v || null })}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-medium)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)' }}>
                {t('crm.deals.stage')}
              </span>
              <Select
                value={deal.stageId}
                onChange={(v) => updateDeal.mutate({ id: deal.id, stageId: v })}
                options={stages.map(s => ({ value: s.id, label: s.name }))}
                size="sm"
              />
            </div>
          </div>

          {/* Won/Lost info */}
          {deal.lostAt && deal.lostReason && (
            <div style={{ padding: 'var(--spacing-md)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-md)', borderLeft: '3px solid var(--color-error)' }}>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-semibold)', textTransform: 'uppercase', marginBottom: 4 }}>Lost reason</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>{deal.lostReason}</div>
            </div>
          )}

          {/* Emails */}
          <div style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-lg)' }}>
            <EmailTimeline dealId={deal.id} />
          </div>

          {/* Notes */}
          <div style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-lg)' }}>
            <NotesSection dealId={deal.id} />
          </div>

          {/* Delete */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 'var(--spacing-lg)' }}>
            <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setShowDeleteConfirm(true)}>
              Delete deal
            </Button>
          </div>
        </div>

        {/* Right column — Activity */}
        <div style={{
          flex: 4, overflow: 'auto',
          borderLeft: '1px solid var(--color-border-secondary)',
          padding: 'var(--spacing-lg)',
          display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)',
        }}>
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
              placeholder="Log an activity..."
              size="sm"
              style={{ flex: 1 }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleLogActivity(); }}
            />
            <Button variant="primary" size="sm" onClick={handleLogActivity} disabled={!newActivityBody.trim()}>
              Log
            </Button>
          </div>

          {/* Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            {activities.length === 0 ? (
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', padding: 'var(--spacing-lg) 0', textAlign: 'center' }}>
                No activities yet
              </div>
            ) : (
              activities.slice(0, 20).map((activity) => (
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
      {showMarkLost && (
        <MarkLostModal open={showMarkLost} onClose={() => setShowMarkLost(false)} dealId={deal.id} />
      )}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete deal"
        description={`Are you sure you want to delete "${deal.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => { deleteDeal.mutate(deal.id); onBack(); }}
      />
    </div>
  );
}
