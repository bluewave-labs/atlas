import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle, Clock, CheckSquare } from 'lucide-react';
import {
  usePendingApprovals,
  useApproveLeaveApplication,
  useRejectLeaveApplication,
} from '../../hooks';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { Avatar } from '../../../../components/ui/avatar';
import { StatusDot } from '../../../../components/ui/status-dot';
import { Skeleton } from '../../../../components/ui/skeleton';
import { Input } from '../../../../components/ui/input';
import { formatDate } from '../../../../lib/format';
import { useToastStore } from '../../../../stores/toast-store';

export function ApprovalsView() {
  const { t } = useTranslation();
  const { data: approvals, isLoading } = usePendingApprovals();
  const approveApp = useApproveLeaveApplication();
  const rejectApp = useRejectLeaveApplication();
  const addToast = useToastStore((s) => s.addToast);

  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  const handleApprove = (id: string) => {
    approveApp.mutate({ id }, {
      onSuccess: () => {
        addToast({ type: 'success', message: t('hr.approvals.approved') });
        setRejectingId(null);
        setRejectComment('');
      },
      onError: () => {
        addToast({ type: 'error', message: t('hr.approvals.approveFailed') });
      },
    });
  };

  const handleReject = (id: string) => {
    rejectApp.mutate({ id, comment: rejectComment || undefined }, {
      onSuccess: () => {
        addToast({ type: 'success', message: t('hr.approvals.rejected') });
        setRejectingId(null);
        setRejectComment('');
      },
      onError: () => {
        addToast({ type: 'error', message: t('hr.approvals.rejectFailed') });
      },
    });
  };

  const handleCancelReject = () => {
    setRejectingId(null);
    setRejectComment('');
  };

  if (isLoading) {
    return (
      <div style={{ padding: 'var(--spacing-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        <Skeleton height={80} />
        <Skeleton height={80} />
        <Skeleton height={80} />
      </div>
    );
  }

  if (!approvals || approvals.length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 'var(--spacing-md)',
        color: 'var(--color-text-tertiary)',

        padding: 'var(--spacing-2xl)',
      }}>
        <CheckSquare size={40} strokeWidth={1.2} />
        <span style={{ fontSize: 'var(--font-size-md)' }}>{t('hr.approvals.empty')}</span>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--spacing-xl)', maxWidth: 800 }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        marginBottom: 'var(--spacing-xl)',
      }}>
        <h2 style={{
          margin: 0,
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-primary)',
  
        }}>
          {t('hr.approvals.title')}
        </h2>
        <Badge variant="warning">{approvals.length}</Badge>
      </div>

      {/* Approval cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {approvals.map((approval) => (
          <div
            key={approval.id}
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-secondary)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--spacing-lg)',
              transition: 'border-color 0.15s ease',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 'var(--spacing-lg)',
            }}>
              {/* Left: employee info */}
              <div style={{ display: 'flex', gap: 'var(--spacing-md)', flex: 1, minWidth: 0 }}>
                <Avatar name={approval.employeeName} size={36} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 'var(--font-weight-medium)',
                    fontSize: 'var(--font-size-md)',
                    color: 'var(--color-text-primary)',
            
                    marginBottom: 2,
                  }}>
                    {approval.employeeName}
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)',
                    flexWrap: 'wrap',
                    marginBottom: 'var(--spacing-xs)',
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                      <StatusDot color={approval.leaveTypeColor} size={8} />
                      <span style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-text-secondary)',
                
                      }}>
                        {approval.leaveTypeName}
                      </span>
                    </span>

                    <span style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-tertiary)',
              
                    }}>
                      {formatDate(approval.startDate)} — {formatDate(approval.endDate)}
                    </span>

                    <Badge variant="default">
                      {t('hr.approvals.days', { count: approval.totalDays })}
                    </Badge>
                  </div>

                  {approval.reason && (
                    <div style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-tertiary)',
              
                      marginTop: 'var(--spacing-xs)',
                    }}>
                      {approval.reason}
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    marginTop: 'var(--spacing-xs)',
                  }}>
                    <Clock size={12} style={{ color: 'var(--color-text-tertiary)' }} />
                    <span style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-tertiary)',
              
                    }}>
                      {formatDate(approval.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: action buttons */}
              {rejectingId !== approval.id && (
                <div style={{
                  display: 'flex',
                  gap: 'var(--spacing-sm)',
                  flexShrink: 0,
                  alignItems: 'center',
                }}>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<CheckCircle size={14} />}
                    onClick={() => handleApprove(approval.id)}
                    disabled={approveApp.isPending}
                    style={{ background: 'var(--color-success)', borderColor: 'var(--color-success)' }}
                  >
                    {t('hr.approvals.approve')}
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    icon={<XCircle size={14} />}
                    onClick={() => setRejectingId(approval.id)}
                    disabled={rejectApp.isPending}
                  >
                    {t('hr.approvals.reject')}
                  </Button>
                </div>
              )}
            </div>

            {/* Inline reject comment */}
            {rejectingId === approval.id && (
              <div style={{
                marginTop: 'var(--spacing-md)',
                display: 'flex',
                gap: 'var(--spacing-sm)',
                alignItems: 'flex-end',
              }}>
                <div style={{ flex: 1 }}>
                  <Input
                    value={rejectComment}
                    onChange={(e) => setRejectComment(e.target.value)}
                    placeholder={t('hr.approvals.rejectComment')}
                    size="sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleReject(approval.id);
                      if (e.key === 'Escape') handleCancelReject();
                    }}
                  />
                </div>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleReject(approval.id)}
                  disabled={rejectApp.isPending}
                >
                  {t('hr.approvals.reject')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelReject}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
