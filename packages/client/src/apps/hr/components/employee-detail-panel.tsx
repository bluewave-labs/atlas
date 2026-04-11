import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Trash2 } from 'lucide-react';
import {
  useUpdateEmployee, useDeleteEmployee,
  type HrEmployee, type HrDepartment, type HrTimeOff,
} from '../hooks';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { IconButton } from '../../../components/ui/icon-button';
import { Badge } from '../../../components/ui/badge';
import { Avatar } from '../../../components/ui/avatar';
import { SmartButtonBar } from '../../../components/shared/SmartButtonBar';
import { CustomFieldsRenderer } from '../../../components/shared/custom-fields-renderer';
import { EditableField } from '../../../components/ui/editable-field';
import { StatusDot } from '../../../components/ui/status-dot';
import { ConfirmDialog } from '../../../components/ui/confirm-dialog';
import { useAppActions } from '../../../hooks/use-app-permissions';
import { getTimeOffTypeBadge, getTimeOffStatusBadge } from '../lib/hr-utils';
import { formatDate } from '../../../lib/format';
import { LifecycleTimeline } from './lifecycle-timeline';
import { LeaveBalanceSection } from './sections/leave-section';
import { OnboardingSection } from './sections/onboarding-section';
import { DocumentsSection } from './sections/documents-section';

// ─── Employee Detail Panel ─────────────────────────────────────────

export function EmployeeDetailPanel({
  employee,
  departments,
  employees,
  timeOffRequests,
  onClose,
}: {
  employee: HrEmployee;
  departments: HrDepartment[];
  employees: HrEmployee[];
  timeOffRequests: HrTimeOff[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { canDelete } = useAppActions('hr');
  const [activeTab, setActiveTab] = useState<'details' | 'onboarding' | 'documents' | 'timeline'>('details');
  const [status, setStatus] = useState(employee.status);
  const [departmentId, setDepartmentId] = useState(employee.departmentId || '');
  const [role, setRole] = useState(employee.role);
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const roleRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    setStatus(employee.status);
    setDepartmentId(employee.departmentId || '');
    setRole(employee.role);
  }, [employee.id, employee.status, employee.departmentId, employee.role]);

  const autoSave = useCallback(
    (updates: Record<string, unknown>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateEmployee.mutate({ id: employee.id, ...updates } as any);
      }, 500);
    },
    [employee.id, updateEmployee],
  );

  const handleDelete = () => {
    deleteEmployee.mutate(employee.id);
    onClose();
  };

  const department = departmentId ? departments.find((d) => d.id === departmentId) : null;
  const employeeTimeOff = timeOffRequests.filter((tor) => tor.employeeId === employee.id);
  const manager = employee.managerId ? employees.find((e) => e.id === employee.managerId) : null;

  const tabs = [
    { id: 'details' as const, label: t('hr.tabs.details') },
    { id: 'onboarding' as const, label: t('hr.tabs.onboarding') },
    { id: 'documents' as const, label: t('hr.tabs.documents') },
    { id: 'timeline' as const, label: t('hr.tabs.timeline') },
  ];

  return (
    <div className="hr-detail-panel" style={{ height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '12px var(--spacing-lg)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0,
      }}>
        <span className="hr-section-title" style={{ margin: 0 }}>{t('hr.detail.title')}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {canDelete && <IconButton icon={<Trash2 size={14} />} label={t('hr.actions.deleteEmployee')} size={28} destructive onClick={() => setShowDeleteConfirm(true)} />}
          <IconButton icon={<X size={14} />} label={t('common.close')} size={28} onClick={onClose} />
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('hr.actions.deleteEmployee')}
        description={t('hr.confirm.deleteEmployee', { name: employee.name })}
        confirmLabel={t('common.delete')}
        onConfirm={handleDelete}
      />

      <SmartButtonBar appId="hr" recordId={employee.id} />

      {/* Tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--color-border-secondary)', flexShrink: 0,
        padding: '0 var(--spacing-lg)',
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px var(--spacing-md)',
              fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)',
              fontWeight: activeTab === tab.id ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
              color: activeTab === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Body */}
      <div className="hr-detail-body">
        {activeTab === 'details' && (
          <>
            {/* Avatar + name header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
              <Avatar name={employee.name} size={48} />
              <div style={{ flex: 1 }}>
                <EditableField label="" value={employee.name} onSave={(v) => autoSave({ name: v })} />
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                  {employee.jobTitle || employee.role}
                </div>
              </div>
            </div>

            {/* Basic fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
              {/* Email */}
              <EditableField label={t('hr.fields.email')} value={employee.email} onSave={(v) => autoSave({ email: v })} />

              {/* Phone */}
              <EditableField label={t('hr.fields.phone')} value={employee.phone || ''} onSave={(v) => autoSave({ phone: v || null })} />

              {/* Role */}
              <div className="hr-detail-field">
                <span className="hr-detail-field-label">{t('hr.fields.role')}</span>
                <Input
                  ref={roleRef}
                  value={role}
                  aria-label={t('hr.fields.role')}
                  onChange={(e) => { setRole(e.target.value); autoSave({ role: e.target.value }); }}
                  style={{
                    fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)',
                    background: 'transparent', border: 'none', outline: 'none', padding: '4px 0',
                    borderBottom: '1px solid transparent', transition: 'border-color 0.15s',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderBottomColor = 'var(--color-border-focus)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderBottomColor = 'transparent'; }}
                />
              </div>

              {/* Department */}
              <div className="hr-detail-field">
                <span className="hr-detail-field-label">{t('hr.fields.department')}</span>
                <Select
                  value={departmentId}
                  onChange={(v) => { setDepartmentId(v); updateEmployee.mutate({ id: employee.id, departmentId: v || null }); }}
                  options={[
                    { value: '', label: t('hr.fields.none') },
                    ...departments.map((d) => ({
                      value: d.id, label: d.name,
                      icon: <StatusDot color={d.color} size={8} />,
                    })),
                  ]}
                  size="sm"
                />
              </div>

              {/* Status */}
              <div className="hr-detail-field">
                <span className="hr-detail-field-label">{t('hr.fields.status')}</span>
                <Select
                  value={status}
                  onChange={(v) => { const newStatus = v as HrEmployee['status']; setStatus(newStatus); updateEmployee.mutate({ id: employee.id, status: newStatus }); }}
                  options={[
                    { value: 'active', label: t('hr.status.active'), color: 'var(--color-success)' },
                    { value: 'on-leave', label: t('hr.status.onLeave'), color: 'var(--color-warning)' },
                    { value: 'terminated', label: t('hr.status.terminated'), color: 'var(--color-error)' },
                  ]}
                  size="sm"
                />
              </div>

              {/* Start date */}
              <div className="hr-detail-field">
                <span className="hr-detail-field-label">{t('hr.fields.startDate')}</span>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                  {formatDate(employee.startDate)}
                </div>
              </div>
            </div>

            {/* Personal section */}
            <div style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-md)' }}>
              <span className="hr-section-title">{t('hr.sections.personal')}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-sm)' }}>
                <div className="hr-detail-field">
                  <span className="hr-detail-field-label">{t('hr.fields.dateOfBirth')}</span>
                  <Input
                    type="date"
                    value={employee.dateOfBirth || ''}
                    onChange={(e) => updateEmployee.mutate({ id: employee.id, dateOfBirth: e.target.value || null })}
                    size="sm"
                  />
                </div>
                <div className="hr-detail-field">
                  <span className="hr-detail-field-label">{t('hr.fields.gender')}</span>
                  <Select
                    value={employee.gender || ''}
                    onChange={(v) => updateEmployee.mutate({ id: employee.id, gender: v || null })}
                    options={[
                      { value: '', label: t('hr.fields.none') },
                      { value: 'male', label: t('hr.gender.male') },
                      { value: 'female', label: t('hr.gender.female') },
                      { value: 'non-binary', label: t('hr.gender.nonBinary') },
                      { value: 'prefer-not-to-say', label: t('hr.gender.preferNotToSay') },
                    ]}
                    size="sm"
                  />
                </div>
                <div className="hr-detail-field">
                  <span className="hr-detail-field-label">{t('hr.fields.emergencyContact')}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                    <Input
                      placeholder={t('hr.fields.contactName')}
                      value={employee.emergencyContactName || ''}
                      onChange={(e) => autoSave({ emergencyContactName: e.target.value || null })}
                      size="sm"
                    />
                    <Input
                      placeholder={t('hr.fields.contactPhone')}
                      value={employee.emergencyContactPhone || ''}
                      onChange={(e) => autoSave({ emergencyContactPhone: e.target.value || null })}
                      size="sm"
                    />
                    <Input
                      placeholder={t('hr.fields.contactRelation')}
                      value={employee.emergencyContactRelation || ''}
                      onChange={(e) => autoSave({ emergencyContactRelation: e.target.value || null })}
                      size="sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Employment section */}
            <div style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-md)' }}>
              <span className="hr-section-title">{t('hr.sections.employment')}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-sm)' }}>
                <div className="hr-detail-field">
                  <span className="hr-detail-field-label">{t('hr.fields.employmentType')}</span>
                  <Select
                    value={employee.employmentType || 'full-time'}
                    onChange={(v) => updateEmployee.mutate({ id: employee.id, employmentType: v })}
                    options={[
                      { value: 'full-time', label: t('hr.employmentType.fullTime') },
                      { value: 'part-time', label: t('hr.employmentType.partTime') },
                      { value: 'contract', label: t('hr.employmentType.contract') },
                    ]}
                    size="sm"
                  />
                </div>
                <div className="hr-detail-field">
                  <span className="hr-detail-field-label">{t('hr.fields.jobTitle')}</span>
                  <Input
                    value={employee.jobTitle || ''}
                    onChange={(e) => autoSave({ jobTitle: e.target.value || null })}
                    placeholder={t('hr.fields.jobTitlePlaceholder')}
                    size="sm"
                  />
                </div>
                <div className="hr-detail-field">
                  <span className="hr-detail-field-label">{t('hr.fields.workLocation')}</span>
                  <Input
                    value={employee.workLocation || ''}
                    onChange={(e) => autoSave({ workLocation: e.target.value || null })}
                    placeholder={t('hr.fields.workLocationPlaceholder')}
                    size="sm"
                  />
                </div>
                <div className="hr-detail-field">
                  <span className="hr-detail-field-label">{t('hr.fields.manager')}</span>
                  <Select
                    value={employee.managerId || ''}
                    onChange={(v) => updateEmployee.mutate({ id: employee.id, managerId: v || null })}
                    options={[
                      { value: '', label: t('hr.fields.none') },
                      ...employees.filter((e) => e.id !== employee.id).map((e) => ({ value: e.id, label: e.name })),
                    ]}
                    size="sm"
                  />
                </div>
              </div>
            </div>

            {/* Compensation section */}
            <div style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-md)' }}>
              <span className="hr-section-title">{t('hr.sections.compensation')}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-sm)' }}>
                <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                  <div className="hr-detail-field" style={{ flex: 1 }}>
                    <span className="hr-detail-field-label">{t('hr.fields.salary')}</span>
                    <Input
                      type="number"
                      value={employee.salary != null ? String(employee.salary) : ''}
                      onChange={(e) => autoSave({ salary: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="0"
                      size="sm"
                    />
                  </div>
                  <div className="hr-detail-field" style={{ width: 90 }}>
                    <span className="hr-detail-field-label">{t('hr.fields.currency')}</span>
                    <Select
                      value={employee.salaryCurrency || 'USD'}
                      onChange={(v) => updateEmployee.mutate({ id: employee.id, salaryCurrency: v })}
                      options={[
                        { value: 'USD', label: 'USD' },
                        { value: 'EUR', label: 'EUR' },
                        { value: 'GBP', label: 'GBP' },
                        { value: 'TRY', label: 'TRY' },
                      ]}
                      size="sm"
                    />
                  </div>
                  <div className="hr-detail-field" style={{ width: 110 }}>
                    <span className="hr-detail-field-label">{t('hr.fields.period')}</span>
                    <Select
                      value={employee.salaryPeriod || 'yearly'}
                      onChange={(v) => updateEmployee.mutate({ id: employee.id, salaryPeriod: v })}
                      options={[
                        { value: 'yearly', label: t('hr.period.yearly') },
                        { value: 'monthly', label: t('hr.period.monthly') },
                        { value: 'hourly', label: t('hr.period.hourly') },
                      ]}
                      size="sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Leave balances */}
            <div style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-md)' }}>
              <LeaveBalanceSection employeeId={employee.id} />
            </div>

            {/* Tags */}
            {employee.tags.length > 0 && (
              <div className="hr-detail-field">
                <span className="hr-detail-field-label">{t('hr.fields.tags')}</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {employee.tags.map((tag) => (
                    <Badge key={tag} variant="default">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Time off requests for this employee */}
            {employeeTimeOff.length > 0 && (
              <div style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-md)' }}>
                <span className="hr-section-title">{t('hr.sections.timeOffRequests')}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                  {employeeTimeOff.map((req) => (
                    <div key={req.id} style={{
                      display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
                      padding: '8px var(--spacing-sm)', borderRadius: 'var(--radius-md)',
                      background: 'var(--color-bg-secondary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)',
                    }}>
                      {getTimeOffTypeBadge(req.type, t)}
                      <span style={{ flex: 1, color: 'var(--color-text-secondary)' }}>
                        {formatDate(req.startDate)} - {formatDate(req.endDate)}
                      </span>
                      {getTimeOffStatusBadge(req.status, t)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <CustomFieldsRenderer appId="hr" recordType="employees" recordId={employee.id} />
          </>
        )}

        {activeTab === 'onboarding' && (
          <OnboardingSection employeeId={employee.id} />
        )}

        {activeTab === 'documents' && (
          <DocumentsSection employeeId={employee.id} />
        )}
        {activeTab === 'timeline' && (
          <LifecycleTimeline employeeId={employee.id} departments={departments} />
        )}
      </div>
    </div>
  );
}
