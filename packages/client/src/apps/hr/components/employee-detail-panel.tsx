import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, X, Check, Trash2, Upload, Download, FileText,
} from 'lucide-react';
import {
  useUpdateEmployee, useDeleteEmployee,
  useLeaveBalances, useAllocateLeave,
  useOnboardingTasks, useCreateOnboardingTask, useUpdateOnboardingTask, useDeleteOnboardingTask,
  useApplyOnboardingTemplate, useOnboardingTemplates,
  useEmployeeDocuments, useUploadEmployeeDocument, useDeleteEmployeeDocument,
  type HrEmployee, type HrDepartment, type HrTimeOff,
  type OnboardingTask, type EmployeeDocument,
} from '../hooks';
import { Button } from '../../../components/ui/button';
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
import { useMyAppPermission } from '../../../hooks/use-app-permissions';
import { getTimeOffTypeBadge, getTimeOffStatusBadge, getCategoryBadge, getDocTypeBadge } from '../lib/hr-utils';
import { formatDate } from '../../../lib/format';
import { LifecycleTimeline } from './lifecycle-timeline';

// ─── Leave Balance Section ────────────────────────────────────────

function LeaveBalanceSection({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation();
  const { data: balances } = useLeaveBalances(employeeId);
  const allocateLeave = useAllocateLeave();
  const [showAllocate, setShowAllocate] = useState(false);
  const [allocType, setAllocType] = useState('vacation');
  const [allocDays, setAllocDays] = useState('');

  const year = new Date().getFullYear();

  const handleAllocate = () => {
    if (!allocDays) return;
    allocateLeave.mutate(
      { employeeId, leaveType: allocType, year, days: parseInt(allocDays) },
      { onSuccess: () => { setShowAllocate(false); setAllocDays(''); } },
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
        <span className="hr-section-title">{t('hr.leaveBalance.title')}</span>
        <IconButton icon={<Plus size={12} />} label={t('hr.leaveBalance.allocate')} size={24} onClick={() => setShowAllocate(!showAllocate)} />
      </div>

      {showAllocate && (
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)', alignItems: 'flex-end' }}>
          <Select
            value={allocType}
            onChange={setAllocType}
            options={[
              { value: 'vacation', label: t('hr.leaveType.vacation') },
              { value: 'sick', label: t('hr.leaveType.sick') },
              { value: 'personal', label: t('hr.leaveType.personal') },
            ]}
            size="sm"
          />
          <Input
            value={allocDays}
            onChange={(e) => setAllocDays(e.target.value)}
            placeholder={t('hr.leaveBalance.days')}
            type="number"
            size="sm"
            style={{ width: 80 }}
          />
          <Button variant="primary" size="sm" onClick={handleAllocate} disabled={!allocDays}>
            {t('common.save')}
          </Button>
        </div>
      )}

      {(!balances || balances.length === 0) ? (
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
          {t('hr.leaveBalance.noBalances')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
          {balances.map((b) => {
            const remaining = b.allocated + b.carried - b.used;
            return (
              <div key={b.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px var(--spacing-sm)', borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-secondary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)',
              }}>
                <span style={{ textTransform: 'capitalize', color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' }}>
                  {b.leaveType}
                </span>
                <div style={{ display: 'flex', gap: 'var(--spacing-md)', color: 'var(--color-text-secondary)' }}>
                  <span>{b.allocated} {t('hr.leaveBalance.allocated')}</span>
                  <span>{b.used} {t('hr.leaveBalance.used')}</span>
                  <span style={{ color: remaining > 0 ? 'var(--color-success)' : 'var(--color-error)', fontWeight: 'var(--font-weight-semibold)' }}>
                    {remaining} {t('hr.leaveBalance.remaining')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Onboarding Section ───────────────────────────────────────────

function OnboardingSection({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation();
  const { data: hrPerm } = useMyAppPermission('hr');
  const canCreate = !hrPerm || hrPerm.role === 'admin' || hrPerm.role === 'editor';
  const canDelete = !hrPerm || hrPerm.role === 'admin';
  const { data: tasks } = useOnboardingTasks(employeeId);
  const { data: templates } = useOnboardingTemplates();
  const createTask = useCreateOnboardingTask();
  const updateTask = useUpdateOnboardingTask();
  const deleteTask = useDeleteOnboardingTask();
  const applyTemplate = useApplyOnboardingTemplate();
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('general');

  const completedCount = tasks?.filter((t) => t.completedAt).length ?? 0;
  const totalCount = tasks?.length ?? 0;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleAddTask = () => {
    if (!newTitle.trim()) return;
    createTask.mutate(
      { employeeId, title: newTitle.trim(), category: newCategory },
      { onSuccess: () => { setNewTitle(''); setShowAddTask(false); } },
    );
  };

  const handleToggleComplete = (task: OnboardingTask) => {
    updateTask.mutate({ taskId: task.id, completed: !task.completedAt });
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
        <span className="hr-section-title">{t('hr.onboarding.title')}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {templates && templates.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => applyTemplate.mutate({ employeeId, templateId: templates[0].id })}
            >
              {t('hr.onboarding.applyTemplate')}
            </Button>
          )}
          <IconButton icon={<Plus size={12} />} label={t('hr.onboarding.addTask')} size={24} onClick={() => setShowAddTask(!showAddTask)} />
        </div>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div style={{ marginBottom: 'var(--spacing-sm)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: 4, fontFamily: 'var(--font-family)' }}>
            <span>{completedCount} / {totalCount} {t('hr.onboarding.completed')}</span>
            <span>{progress}%</span>
          </div>
          <div style={{ height: 4, background: 'var(--color-bg-tertiary)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--color-success)', borderRadius: 2, transition: 'width 0.3s' }} />
          </div>
        </div>
      )}

      {showAddTask && (
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)', alignItems: 'flex-end' }}>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={t('hr.onboarding.taskTitle')}
            size="sm"
            style={{ flex: 1 }}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
          />
          <Select
            value={newCategory}
            onChange={setNewCategory}
            options={[
              { value: 'general', label: t('hr.onboardingCategory.general') },
              { value: 'IT', label: t('hr.onboardingCategory.it') },
              { value: 'HR', label: t('hr.onboardingCategory.hr') },
              { value: 'Team', label: t('hr.onboardingCategory.team') },
              { value: 'Admin', label: t('hr.onboardingCategory.admin') },
            ]}
            size="sm"
          />
          <Button variant="primary" size="sm" onClick={handleAddTask} disabled={!newTitle.trim()}>
            {t('common.save')}
          </Button>
        </div>
      )}

      {(!tasks || tasks.length === 0) ? (
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
          {t('hr.onboarding.noTasks')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {tasks.map((task) => (
            <div key={task.id} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
              padding: '6px var(--spacing-sm)', borderRadius: 'var(--radius-sm)',
              background: task.completedAt ? 'var(--color-bg-secondary)' : 'transparent',
              fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)',
            }}>
              <button
                onClick={() => handleToggleComplete(task)}
                style={{
                  width: 18, height: 18, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                  border: task.completedAt ? 'none' : '2px solid var(--color-border-primary)',
                  background: task.completedAt ? 'var(--color-success)' : 'transparent',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {task.completedAt && <Check size={12} style={{ color: 'white' }} />}
              </button>
              <span style={{
                flex: 1, color: task.completedAt ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
                textDecoration: task.completedAt ? 'line-through' : 'none',
              }}>
                {task.title}
              </span>
              {getCategoryBadge(task.category, t)}
              {canDelete && <IconButton icon={<Trash2 size={12} />} label={t('common.delete')} size={20} destructive onClick={() => deleteTask.mutate(task.id)} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Documents Section ────────────────────────────────────────────

function DocumentsSection({ employeeId }: { employeeId: string }) {
  const { t } = useTranslation();
  const { data: hrPerm } = useMyAppPermission('hr');
  const canDelete = !hrPerm || hrPerm.role === 'admin';
  const { data: docs } = useEmployeeDocuments(employeeId);
  const uploadDoc = useUploadEmployeeDocument();
  const deleteDoc = useDeleteEmployeeDocument();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState('other');

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadDoc.mutate({ employeeId, file, type: docType });
    e.target.value = '';
  };

  const handleDownload = (doc: EmployeeDocument) => {
    window.open(`/api/hr/documents/${doc.id}/download`, '_blank');
  };

  const formatSize = (size: number | null) => {
    if (!size) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
        <span className="hr-section-title">{t('hr.documents.title')}</span>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
          <Select
            value={docType}
            onChange={setDocType}
            options={[
              { value: 'contract', label: t('hr.documents.types.contract') },
              { value: 'certificate', label: t('hr.documents.types.certificate') },
              { value: 'ID', label: t('hr.documents.types.id') },
              { value: 'resume', label: t('hr.documents.types.resume') },
              { value: 'policy-acknowledgment', label: t('hr.documents.types.policy') },
              { value: 'other', label: t('hr.documents.types.other') },
            ]}
            size="sm"
          />
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleUpload} />
          <Button variant="primary" size="sm" icon={<Upload size={14} />} onClick={() => fileInputRef.current?.click()}>
            {t('hr.documents.upload')}
          </Button>
        </div>
      </div>

      {(!docs || docs.length === 0) ? (
        <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
          {t('hr.documents.noDocuments')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
          {docs.map((doc) => (
            <div key={doc.id} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
              padding: '8px var(--spacing-sm)', borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-secondary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)',
            }}>
              <FileText size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
              <span style={{ flex: 1, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {doc.name}
              </span>
              {getDocTypeBadge(doc.type, t)}
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
                {formatSize(doc.size)}
              </span>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
                {formatDate(doc.createdAt)}
              </span>
              <IconButton icon={<Download size={12} />} label={t('hr.documents.download')} size={20} onClick={() => handleDownload(doc)} />
              {canDelete && <IconButton icon={<Trash2 size={12} />} label={t('common.delete')} size={20} destructive onClick={() => deleteDoc.mutate(doc.id)} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const { data: hrPerm } = useMyAppPermission('hr');
  const canDelete = !hrPerm || hrPerm.role === 'admin';
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
