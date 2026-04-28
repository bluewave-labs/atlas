import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { formatDate, formatCurrency } from '../../../../lib/format';
import { Building2, Users, X, Trash2, Trophy, XCircle } from 'lucide-react';
import {
  useUpdateDeal, useDeleteDeal, useActivities, useCompanies,
  useMyCrmPermission, canAccess,
  type CrmDeal, type CrmDealStage,
} from '../../hooks';
import { ActivityTimeline } from '../activity-timeline';
import { Button } from '../../../../components/ui/button';
import { Select } from '../../../../components/ui/select';
import { IconButton } from '../../../../components/ui/icon-button';
import { Badge } from '../../../../components/ui/badge';
import { SmartButtonBar } from '../../../../components/shared/SmartButtonBar';
import { PresenceAvatars } from '../../../../components/shared/presence-avatars';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';
import { StatusDot } from '../../../../components/ui/status-dot';
import { CalendarEvents } from '../calendar-events';
import { NotesSection } from '../notes-section';
import { CompanyLogo } from '../../lib/crm-helpers';

export function DealDetailPanel({
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
  const { data: perm } = useMyCrmPermission();
  const canUpdate = canAccess(perm?.role, 'deals', 'update');
  const canDelete = canAccess(perm?.role, 'deals', 'delete');
  const [stageId, setStageId] = useState(deal.stageId);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const updateDeal = useUpdateDeal();
  const deleteDeal = useDeleteDeal();
  const { data: activitiesData } = useActivities({ dealId: deal.id });
  const activities = activitiesData?.activities ?? [];
  const { data: companiesData } = useCompanies();
  const companyDomain = deal.companyId ? companiesData?.companies?.find((c) => c.id === deal.companyId)?.domain : null;

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
          {canDelete && <IconButton icon={<Trash2 size={14} />} label={t('crm.deals.deleteDeal')} size={28} destructive onClick={() => setShowDeleteConfirm(true)} />}
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
              {formatCurrency(deal.value, deal.currency)}
            </div>
          </div>

          <div className="crm-detail-field">
            <span className="crm-detail-field-label">{t('crm.deals.stage')}</span>
            <Select
              value={stageId}
              disabled={!canUpdate}
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
                {companyDomain ? <CompanyLogo domain={companyDomain} size={20} /> : <Building2 size={14} style={{ color: 'var(--color-text-tertiary)' }} />}
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

          {!deal.wonAt && !deal.lostAt && canUpdate && (
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

        {/* Calendar */}
        <div style={{ marginTop: 'var(--spacing-lg)', borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-lg)' }}>
          <CalendarEvents dealId={deal.id} />
        </div>

        {/* Notes */}
        <div style={{ marginTop: 'var(--spacing-lg)', borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-lg)' }}>
          <NotesSection dealId={deal.id} />
        </div>
      </div>
    </div>
  );
}
