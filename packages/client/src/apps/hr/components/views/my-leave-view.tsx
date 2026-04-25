import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Check, XCircle, X, Send } from 'lucide-react';
import {
  useLeaveTypes, useLeaveApplications, useCreateLeaveApplication,
  useSubmitLeaveApplication, useApproveLeaveApplication,
  useRejectLeaveApplication, useCancelLeaveApplication,
  type HrEmployee,
} from '../../hooks';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { Badge } from '../../../../components/ui/badge';
import { IconButton } from '../../../../components/ui/icon-button';
import { Skeleton } from '../../../../components/ui/skeleton';
import { QueryErrorState } from '../../../../components/ui/query-error-state';
import { Modal } from '../../../../components/ui/modal';
import { StatusDot } from '../../../../components/ui/status-dot';
import { FeatureEmptyState } from '../../../../components/ui/feature-empty-state';
import { formatDate } from '../../../../lib/format';
import { useMyAppPermission } from '../../../../hooks/use-app-permissions';
import { useAuthStore } from '../../../../stores/auth-store';
import { useToastStore } from '../../../../stores/toast-store';

export function MyLeaveView({ employees }: { employees: HrEmployee[] }) {
  const { t } = useTranslation();
  const { data: applications, isLoading, isError, refetch } = useLeaveApplications();
  const { data: leaveTypes } = useLeaveTypes();
  const createApp = useCreateLeaveApplication();
  const submitApp = useSubmitLeaveApplication();
  const cancelApp = useCancelLeaveApplication();
  const approveApp = useApproveLeaveApplication();
  const rejectApp = useRejectLeaveApplication();

  // Permission + self-identification used to gate the approve/reject
  // icon buttons. Viewers can never approve; even privileged roles
  // should never approve their own records.
  const addToast = useToastStore((s) => s.addToast);
  const { data: hrPerm } = useMyAppPermission('hr');
  const canApprove = hrPerm?.role === 'admin' || hrPerm?.role === 'editor';
  const authAccount = useAuthStore((s) => s.account);
  const myEmployee = employees.find(
    (e) => e.email?.toLowerCase() === authAccount?.email?.toLowerCase(),
  );

  const [showRequest, setShowRequest] = useState(false);
  const [reqEmployeeId, setReqEmployeeId] = useState('');
  const [reqLeaveTypeId, setReqLeaveTypeId] = useState('');
  const [reqStartDate, setReqStartDate] = useState('');
  const [reqEndDate, setReqEndDate] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [reqHalfDay, setReqHalfDay] = useState(false);

  // Auto-fill reqEmployeeId with the current user's employee record
  // when the modal opens. For viewers this is the only employee they
  // can submit for anyway; for admins it's a sensible default they
  // can change via the dropdown.
  useEffect(() => {
    if (showRequest && !reqEmployeeId && myEmployee) {
      setReqEmployeeId(myEmployee.id);
    }
  }, [showRequest, reqEmployeeId, myEmployee]);

  const handleRequest = () => {
    if (!reqEmployeeId || !reqLeaveTypeId || !reqStartDate || !reqEndDate) return;
    createApp.mutate({
      employeeId: reqEmployeeId, leaveTypeId: reqLeaveTypeId,
      startDate: reqStartDate, endDate: reqEndDate,
      reason: reqReason || undefined, halfDay: reqHalfDay,
    }, {
      onSuccess: (data) => {
        setShowRequest(false);
        setReqEmployeeId(''); setReqLeaveTypeId(''); setReqStartDate(''); setReqEndDate(''); setReqReason(''); setReqHalfDay(false);
        if (data?.id) submitApp.mutate(data.id, {
          onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : t('hr.myLeave.submitFailed');
            addToast({ type: 'error', message: msg });
          },
        });
      },
    });
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
      draft: 'default', pending: 'warning', approved: 'success', rejected: 'error', cancelled: 'default',
    };
    return <Badge variant={variants[status] || 'default'}>{t(`hr.leaveAppStatus.${status}`)}</Badge>;
  };

  if (isError) return <QueryErrorState onRetry={refetch} />;
  if (isLoading) return <div style={{ padding: 'var(--spacing-xl)' }}><Skeleton height={200} /></div>;

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-xl)' }}>
      {(!applications || applications.length === 0) && !showRequest && (
        <FeatureEmptyState
          illustration="calendar"
          title={t('hr.myLeave.empty')}
          description={t('hr.myLeave.emptyDesc')}
          actionLabel={t('hr.myLeave.request')}
          actionIcon={<Plus size={14} />}
          onAction={() => setShowRequest(true)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {applications?.map((app) => (
          <div key={app.id} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: 'var(--spacing-md) var(--spacing-lg)',
            borderBottom: '1px solid var(--color-border-secondary)',
          }}>
            <StatusDot color={app.leaveTypeColor || 'var(--color-text-tertiary)'} size={10} />
            <span style={{ width: 140, flexShrink: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
              {app.employeeName}
            </span>
            <span style={{ width: 100, flexShrink: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              {app.leaveTypeName}
            </span>
            <span style={{ width: 180, flexShrink: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              {formatDate(app.startDate)} - {formatDate(app.endDate)}
            </span>
            <span style={{ width: 50, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
              {app.totalDays}d
            </span>
            <span style={{ width: 80, flexShrink: 0 }}>{statusBadge(app.status)}</span>
            <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {app.reason || '-'}
            </span>
            <div style={{ width: 80, flexShrink: 0, display: 'flex', gap: 2 }}>
              {/* Approve/reject buttons only for privileged roles on records
                  that belong to someone OTHER than the current user. Viewers
                  never see these, and no one can approve their own leave. */}
              {app.status === 'pending' && canApprove && app.employeeId !== myEmployee?.id && (
                <>
                  <IconButton icon={<Check size={14} />} label={t('hr.actions.approve')} size={26} onClick={() => approveApp.mutate({ id: app.id })} style={{ color: 'var(--color-success)' }} />
                  <IconButton icon={<XCircle size={14} />} label={t('hr.actions.reject')} size={26} destructive onClick={() => rejectApp.mutate({ id: app.id })} />
                </>
              )}
              {app.status === 'draft' && app.employeeId === myEmployee?.id && (
                <IconButton icon={<Send size={14} />} label={t('hr.myLeave.retrySubmit')} size={26} onClick={() => submitApp.mutate(app.id, {
                  onError: (err: unknown) => {
                    const msg = err instanceof Error ? err.message : t('hr.myLeave.submitFailed');
                    addToast({ type: 'error', message: msg });
                  },
                })} />
              )}
              {app.status === 'approved' && app.employeeId === myEmployee?.id && (
                <IconButton icon={<X size={14} />} label={t('hr.myLeave.cancel')} size={26} destructive onClick={() => cancelApp.mutate(app.id)} />
              )}
            </div>
          </div>
        ))}
      </div>

      {showRequest && (
        <Modal open={showRequest} onOpenChange={(o) => !o && setShowRequest(false)} width={480} title={t('hr.myLeave.requestLeave')}>
          <Modal.Header title={t('hr.myLeave.requestLeave')} />
          <Modal.Body>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                <label className="hr-field-label">{t('hr.fields.employee')}</label>
                <Select value={reqEmployeeId} onChange={setReqEmployeeId}
                  options={[{ value: '', label: t('hr.fields.selectEmployee') }, ...employees.map(e => ({ value: e.id, label: e.name }))]}
                  size="sm" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                <label className="hr-field-label">{t('hr.fields.type')}</label>
                <Select value={reqLeaveTypeId} onChange={setReqLeaveTypeId}
                  options={[{ value: '', label: t('hr.myLeave.selectType') }, ...(leaveTypes?.map(lt => ({ value: lt.id, label: lt.name })) || [])]}
                  size="sm" />
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                <Input label={t('hr.fields.startDate')} type="date" value={reqStartDate} onChange={(e) => setReqStartDate(e.target.value)} style={{ flex: 1 }} />
                <Input label={t('hr.fields.endDate')} type="date" value={reqEndDate} onChange={(e) => setReqEndDate(e.target.value)} style={{ flex: 1 }} />
              </div>
              <Input label={t('hr.myLeave.reason')} value={reqReason} onChange={(e) => setReqReason(e.target.value)} placeholder={t('hr.fields.optionalNotes')} />
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="ghost" onClick={() => setShowRequest(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleRequest} disabled={!reqEmployeeId || !reqLeaveTypeId || !reqStartDate || !reqEndDate}>
              {t('hr.myLeave.submit')}
            </Button>
          </Modal.Footer>
        </Modal>
      )}
    </div>
  );
}
