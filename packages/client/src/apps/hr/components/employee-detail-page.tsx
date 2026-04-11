import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Trash2,
  Building2, Briefcase, CalendarDays, Clock,
} from 'lucide-react';
import {
  useUpdateEmployee, useDeleteEmployee,
  useLeaveBalances, useTimeOffList,
  useOnboardingTasks,
  type HrEmployee, type HrDepartment,
} from '../hooks';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Select } from '../../../components/ui/select';
import { IconButton } from '../../../components/ui/icon-button';
import { Badge } from '../../../components/ui/badge';
import { Avatar } from '../../../components/ui/avatar';
import { StatCard } from '../../../components/ui/stat-card';
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

// ─── Types ────────────────────────────────────────────────────────

interface EmployeeDetailPageProps {
  employeeId: string;
  employees: HrEmployee[];
  departments: HrDepartment[];
  onBack: () => void;
  onNavigate: (employeeId: string) => void;
}

type DetailTab = 'overview' | 'leave' | 'onboarding' | 'documents' | 'timeline';

// ─── Helpers ──────────────────────────────────────────────────────

function computeTenure(startDate: string, t: ReturnType<typeof useTranslation>['t']): string {
  const start = new Date(startDate);
  const now = new Date();
  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();
  if (months < 0) { years--; months += 12; }
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? t('hr.detail.year', 'year') : t('hr.detail.years', 'years')}`);
  if (months > 0 || years === 0) parts.push(`${months} ${months === 1 ? t('hr.detail.month', 'month') : t('hr.detail.months', 'months')}`);
  return parts.join(', ');
}

function getStatusVariant(status: HrEmployee['status']): 'success' | 'warning' | 'error' {
  if (status === 'active') return 'success';
  if (status === 'on-leave') return 'warning';
  return 'error';
}

// ─── Component ────────────────────────────────────────────────────

export function EmployeeDetailPage({
  employeeId,
  employees,
  departments,
  onBack,
  onNavigate,
}: EmployeeDetailPageProps) {
  const { t } = useTranslation();
  const { canDelete } = useAppActions('hr');

  // Find employee
  const employee = employees.find((e) => e.id === employeeId);
  const currentIndex = employees.findIndex((e) => e.id === employeeId);

  // Tab state
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Data hooks
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();
  const { data: timeOffData } = useTimeOffList();
  const timeOffRequests = timeOffData?.timeOffRequests ?? [];
  const { data: onboardingTasks } = useOnboardingTasks(employeeId);

  // Auto-save debounce
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const autoSave = useCallback(
    (updates: Record<string, unknown>) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        updateEmployee.mutate({ id: employeeId, ...updates } as any);
      }, 500);
    },
    [employeeId, updateEmployee],
  );

  // Reset tab when navigating to a different employee
  useEffect(() => {
    setActiveTab('overview');
  }, [employeeId]);

  if (!employee) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
        {t('hr.detail.notFound', 'Employee not found')}
      </div>
    );
  }

  const department = employee.departmentId ? departments.find((d) => d.id === employee.departmentId) : null;
  const employeeTimeOff = timeOffRequests.filter((tor) => tor.employeeId === employee.id);
  const tenure = computeTenure(employee.startDate, t);

  const handleDelete = () => {
    deleteEmployee.mutate(employee.id);
    onBack();
  };

  const handlePrev = () => {
    if (currentIndex > 0) onNavigate(employees[currentIndex - 1].id);
  };
  const handleNext = () => {
    if (currentIndex < employees.length - 1) onNavigate(employees[currentIndex + 1].id);
  };

  const tabs: { id: DetailTab; label: string }[] = [
    { id: 'overview', label: t('hr.detail.tabOverview', 'Overview') },
    { id: 'leave', label: t('hr.detail.tabLeave', 'Leave') },
    { id: 'onboarding', label: t('hr.detail.tabOnboarding', 'Onboarding') },
    { id: 'documents', label: t('hr.detail.tabDocuments', 'Documents') },
    { id: 'timeline', label: t('hr.detail.tabTimeline', 'Timeline') },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'var(--font-family)' }}>
      {/* ─── Top bar ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)',
        padding: '12px var(--spacing-xl)',
        borderBottom: '1px solid var(--color-border-primary)',
        flexShrink: 0,
      }}>
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={onBack}>
          {t('hr.detail.back', 'Back')}
        </Button>
        <div style={{ width: 1, height: 20, background: 'var(--color-border-secondary)' }} />
        <span style={{
          fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-primary)',
        }}>
          {employee.name}
        </span>
        <Badge variant={getStatusVariant(employee.status)}>
          {t(`hr.status.${employee.status === 'on-leave' ? 'onLeave' : employee.status}`)}
        </Badge>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <IconButton
            icon={<ChevronLeft size={14} />}
            label={t('hr.detail.previous', 'Previous')}
            size={28}
            onClick={handlePrev}
            disabled={currentIndex <= 0}
          />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', minWidth: 50, textAlign: 'center' }}>
            {currentIndex + 1} / {employees.length}
          </span>
          <IconButton
            icon={<ChevronRight size={14} />}
            label={t('hr.detail.next', 'Next')}
            size={28}
            onClick={handleNext}
            disabled={currentIndex >= employees.length - 1}
          />
        </div>
        {canDelete && (
          <IconButton
            icon={<Trash2 size={14} />}
            label={t('hr.actions.deleteEmployee')}
            size={28}
            destructive
            onClick={() => setShowDeleteConfirm(true)}
          />
        )}
      </div>

      {/* ─── Tab bar ──────────────────────────────────────────── */}
      <div style={{
        display: 'flex', borderBottom: '1px solid var(--color-border-primary)',
        padding: '0 var(--spacing-xl)', flexShrink: 0,
      }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px var(--spacing-lg)',
              fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)',
              fontWeight: activeTab === tab.id ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
              color: activeTab === tab.id ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              background: 'transparent', border: 'none', cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-accent-primary)' : '2px solid transparent',
              transition: 'all 0.15s',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Content: two columns ─────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: tab content */}
        <div style={{ flex: 6, overflow: 'auto', padding: 'var(--spacing-xl)' }}>
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
              <OverviewTab
                employee={employee}
                department={department}
                tenure={tenure}
                employeeTimeOff={employeeTimeOff}
                onboardingTasks={onboardingTasks ?? []}
                t={t}
              />
              <PersonalTab
                employee={employee}
                departments={departments}
                employees={employees}
                autoSave={autoSave}
                updateEmployee={updateEmployee}
                t={t}
              />
            </div>
          )}
          {activeTab === 'leave' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
              <LeaveBalanceSection employeeId={employee.id} />
              {employeeTimeOff.length > 0 && (
                <div>
                  <span className="hr-section-title">{t('hr.sections.timeOffRequests')}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                    {employeeTimeOff.map((req) => (
                      <div key={req.id} style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
                        padding: '8px var(--spacing-sm)', borderRadius: 'var(--radius-md)',
                        background: 'var(--color-bg-secondary)', fontSize: 'var(--font-size-sm)',
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
            </div>
          )}
          {activeTab === 'onboarding' && <OnboardingSection employeeId={employee.id} />}
          {activeTab === 'documents' && <DocumentsSection employeeId={employee.id} />}
          {activeTab === 'timeline' && <LifecycleTimeline employeeId={employee.id} departments={departments} />}
        </div>

        {/* Right: identity card */}
        <div style={{
          flex: 4, maxWidth: 360, borderLeft: '1px solid var(--color-border-primary)',
          overflow: 'auto', padding: 'var(--spacing-xl)',
          display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)',
        }}>
          <IdentityCard
            employee={employee}
            department={department}
            departments={departments}
            employees={employees}
            tenure={tenure}
            autoSave={autoSave}
            updateEmployee={updateEmployee}
            t={t}
          />
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('hr.actions.deleteEmployee')}
        description={t('hr.confirm.deleteEmployee', { name: employee.name })}
        confirmLabel={t('common.delete')}
        onConfirm={handleDelete}
        destructive
      />
    </div>
  );
}

// ─── Identity Card (right column) ─────────────────────────────────

function IdentityCard({
  employee, department, departments, employees, tenure, autoSave, updateEmployee, t,
}: {
  employee: HrEmployee;
  department: HrDepartment | null | undefined;
  departments: HrDepartment[];
  employees: HrEmployee[];
  tenure: string;
  autoSave: (updates: Record<string, unknown>) => void;
  updateEmployee: ReturnType<typeof useUpdateEmployee>;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  return (
    <>
      {/* Avatar + name */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
        <Avatar name={employee.name} size={64} />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
            {employee.name}
          </div>
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>
            {employee.email}
          </div>
        </div>
      </div>

      {/* Info rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {/* Department */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>
            {t('hr.fields.department')}
          </span>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
            {department && <StatusDot color={department.color} size={8} />}
            {department?.name || '-'}
          </span>
        </div>

        {/* Role */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>
            {t('hr.fields.role')}
          </span>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
            {employee.role}
          </span>
        </div>

        {/* Manager */}
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

        {/* Start date */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>
            {t('hr.fields.startDate')}
          </span>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
            {formatDate(employee.startDate)}
          </span>
        </div>

        {/* Tenure */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>
            {t('hr.detail.tenure', 'Tenure')}
          </span>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}>
            {tenure}
          </span>
        </div>
      </div>

      {/* Smart button bar */}
      <SmartButtonBar appId="hr" recordId={employee.id} />

      {/* Custom fields */}
      <CustomFieldsRenderer appId="hr" recordType="employees" recordId={employee.id} />
    </>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────

function OverviewTab({
  employee, department, tenure, employeeTimeOff, onboardingTasks, t,
}: {
  employee: HrEmployee;
  department: HrDepartment | null | undefined;
  tenure: string;
  employeeTimeOff: any[];
  onboardingTasks: any[];
  t: ReturnType<typeof useTranslation>['t'];
}) {
  const completedCount = onboardingTasks.filter((task: any) => task.completedAt).length;
  const totalCount = onboardingTasks.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
      {/* Stat cards */}
      <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
        <StatCard
          label={t('hr.fields.department')}
          value={department?.name || '-'}
          icon={Building2}
          color={department?.color}
        />
        <StatCard
          label={t('hr.fields.role')}
          value={employee.role}
          icon={Briefcase}
        />
        <StatCard
          label={t('hr.fields.startDate')}
          value={formatDate(employee.startDate)}
          icon={CalendarDays}
        />
        <StatCard
          label={t('hr.detail.tenure', 'Tenure')}
          value={tenure}
          icon={Clock}
        />
      </div>

      {/* Recent time off */}
      {employeeTimeOff.length > 0 && (
        <div>
          <span className="hr-section-title">{t('hr.detail.recentTimeOff', 'Recent time off')}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
            {employeeTimeOff.slice(0, 5).map((req: any) => (
              <div key={req.id} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
                padding: '8px var(--spacing-sm)', borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-secondary)', fontSize: 'var(--font-size-sm)',
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

      {/* Onboarding progress summary */}
      {totalCount > 0 && (
        <div>
          <span className="hr-section-title">{t('hr.detail.onboardingProgress', 'Onboarding progress')}</span>
          <div style={{ marginTop: 'var(--spacing-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: 4 }}>
              <span>{completedCount} / {totalCount} {t('hr.onboarding.completed')}</span>
              <span>{progress}%</span>
            </div>
            <div style={{ height: 6, background: 'var(--color-bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, background: 'var(--color-success)', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Personal Tab ─────────────────────────────────────────────────

function PersonalTab({
  employee, departments, employees, autoSave, updateEmployee, t,
}: {
  employee: HrEmployee;
  departments: HrDepartment[];
  employees: HrEmployee[];
  autoSave: (updates: Record<string, unknown>) => void;
  updateEmployee: ReturnType<typeof useUpdateEmployee>;
  t: ReturnType<typeof useTranslation>['t'];
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
      {/* Basic info — two-column grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-lg)' }}>
        {/* Name */}
        <EditableField label={t('hr.fields.name', 'Name')} value={employee.name} onSave={(v) => autoSave({ name: v })} />

        {/* Email */}
        <EditableField label={t('hr.fields.email')} value={employee.email} onSave={(v) => autoSave({ email: v })} />

        {/* Phone */}
        <EditableField label={t('hr.fields.phone')} value={employee.phone || ''} onSave={(v) => autoSave({ phone: v || null })} />

        {/* Department */}
        <div className="hr-detail-field">
          <span className="hr-detail-field-label">{t('hr.fields.department')}</span>
          <Select
            value={employee.departmentId || ''}
            onChange={(v) => updateEmployee.mutate({ id: employee.id, departmentId: v || null })}
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

        {/* Role */}
        <EditableField label={t('hr.fields.role')} value={employee.role} onSave={(v) => autoSave({ role: v })} />

        {/* Manager */}
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

        {/* Start date */}
        <div className="hr-detail-field">
          <span className="hr-detail-field-label">{t('hr.fields.startDate')}</span>
          <Input
            type="date"
            value={employee.startDate || ''}
            onChange={(e) => updateEmployee.mutate({ id: employee.id, startDate: e.target.value })}
            size="sm"
          />
        </div>

        {/* Salary */}
        <div className="hr-detail-field">
          <span className="hr-detail-field-label">{t('hr.fields.salary')}</span>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <Input
              type="number"
              value={employee.salary != null ? String(employee.salary) : ''}
              onChange={(e) => autoSave({ salary: e.target.value ? parseInt(e.target.value) : null })}
              placeholder="0"
              size="sm"
              style={{ flex: 1 }}
            />
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
              width={80}
            />
          </div>
        </div>
      </div>

      {/* Personal details */}
      <div style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-lg)' }}>
        <span className="hr-section-title">{t('hr.sections.personal')}</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
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
            <span className="hr-detail-field-label">{t('hr.fields.status')}</span>
            <Select
              value={employee.status}
              onChange={(v) => updateEmployee.mutate({ id: employee.id, status: v as HrEmployee['status'] })}
              options={[
                { value: 'active', label: t('hr.status.active'), color: 'var(--color-success)' },
                { value: 'on-leave', label: t('hr.status.onLeave'), color: 'var(--color-warning)' },
                { value: 'terminated', label: t('hr.status.terminated'), color: 'var(--color-error)' },
              ]}
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* Emergency contact */}
      <div style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-lg)' }}>
        <span className="hr-section-title">{t('hr.fields.emergencyContact')}</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
          <div className="hr-detail-field">
            <span className="hr-detail-field-label">{t('hr.fields.contactName')}</span>
            <Input
              value={employee.emergencyContactName || ''}
              onChange={(e) => autoSave({ emergencyContactName: e.target.value || null })}
              size="sm"
            />
          </div>
          <div className="hr-detail-field">
            <span className="hr-detail-field-label">{t('hr.fields.contactPhone')}</span>
            <Input
              value={employee.emergencyContactPhone || ''}
              onChange={(e) => autoSave({ emergencyContactPhone: e.target.value || null })}
              size="sm"
            />
          </div>
          <div className="hr-detail-field">
            <span className="hr-detail-field-label">{t('hr.fields.contactRelation')}</span>
            <Input
              value={employee.emergencyContactRelation || ''}
              onChange={(e) => autoSave({ emergencyContactRelation: e.target.value || null })}
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* Tags */}
      {employee.tags.length > 0 && (
        <div style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-lg)' }}>
          <span className="hr-section-title">{t('hr.fields.tags')}</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 'var(--spacing-sm)' }}>
            {employee.tags.map((tag) => (
              <Badge key={tag} variant="default">{tag}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
