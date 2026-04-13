import { useTranslation } from 'react-i18next';
import { CalendarDays, Check, XCircle, Trash2, CheckCircle, BarChart3 } from 'lucide-react';
import { type HrTimeOff } from '../../hooks';
import { useAppActions } from '../../../../hooks/use-app-permissions';
import { IconButton } from '../../../../components/ui/icon-button';
import { getTimeOffTypeBadge, getTimeOffStatusBadge } from '../../lib/hr-utils';
import { formatDate } from '../../../../lib/format';
import { FeatureEmptyState } from '../../../../components/ui/feature-empty-state';

export function TimeOffView({
  timeOffRequests,
  onApprove,
  onReject,
  onDelete,
}: {
  timeOffRequests: HrTimeOff[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { canDelete } = useAppActions('hr');
  if (timeOffRequests.length === 0) {
    return (
      <FeatureEmptyState
        illustration="calendar"
        title={t('hr.leave.noRequests', 'No leave requests')}
        description={t('hr.leave.noRequestsDesc', 'Leave requests from your team will appear here.')}
        highlights={[
          { icon: <CalendarDays size={14} />, title: t('hr.leave.requestLeave', 'Request time off'), description: t('hr.leave.requestLeaveDesc', 'Submit vacation, sick leave, or personal days') },
          { icon: <CheckCircle size={14} />, title: t('hr.leave.approvals', 'Approval workflow'), description: t('hr.leave.approvalsDesc', 'Managers review and approve requests') },
          { icon: <BarChart3 size={14} />, title: t('hr.leave.balances', 'Track balances'), description: t('hr.leave.balancesDesc', 'See remaining days for each leave type') },
        ]}
      />
    );
  }

  const sorted = [...timeOffRequests].sort((a, b) => {
    if (a.status === 'pending' && b.status !== 'pending') return -1;
    if (a.status !== 'pending' && b.status === 'pending') return 1;
    return a.startDate.localeCompare(b.startDate);
  });

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)',
        padding: '8px var(--spacing-lg)', borderBottom: '1px solid var(--color-border-secondary)',
        fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--color-text-tertiary)', textTransform: 'uppercase',
        letterSpacing: '0.04em', fontFamily: 'var(--font-family)', flexShrink: 0,
      }}>
        <span style={{ width: 160, flexShrink: 0 }}>{t('hr.columns.employee')}</span>
        <span style={{ width: 80, flexShrink: 0 }}>{t('hr.columns.type')}</span>
        <span style={{ width: 200, flexShrink: 0 }}>{t('hr.columns.dates')}</span>
        <span style={{ width: 80, flexShrink: 0 }}>{t('hr.columns.status')}</span>
        <span style={{ flex: 1 }}>{t('hr.columns.notes')}</span>
        <span style={{ width: 80, flexShrink: 0 }}>{t('hr.columns.actions')}</span>
      </div>

      {sorted.map((req) => (
        <div key={req.id} className="hr-time-off-row">
          <span style={{ width: 160, flexShrink: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {req.employeeName}
          </span>
          <span style={{ width: 80, flexShrink: 0 }}>{getTimeOffTypeBadge(req.type, t)}</span>
          <span style={{ width: 200, flexShrink: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
            {formatDate(req.startDate)} - {formatDate(req.endDate)}
          </span>
          <span style={{ width: 80, flexShrink: 0 }}>{getTimeOffStatusBadge(req.status, t)}</span>
          <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {req.notes || '-'}
          </span>
          <div style={{ width: 80, flexShrink: 0, display: 'flex', gap: 2 }}>
            {req.status === 'pending' ? (
              <>
                <IconButton icon={<Check size={14} />} label={t('hr.actions.approve')} size={26} onClick={() => onApprove(req.id)} style={{ color: 'var(--color-success)' }} />
                <IconButton icon={<XCircle size={14} />} label={t('hr.actions.reject')} size={26} destructive onClick={() => onReject(req.id)} />
              </>
            ) : (
              canDelete ? <IconButton icon={<Trash2 size={14} />} label={t('common.delete')} size={26} destructive onClick={() => onDelete(req.id)} /> : null
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
