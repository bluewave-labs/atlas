import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users, Building2, CalendarDays, Plus, Search, Settings2, X,
  Check, XCircle, Mail, Phone,
  ChevronRight, Trash2, Edit3,
  User, Briefcase, Tag,
  LayoutDashboard, GitBranch, Upload, Download, FileText,
  Cake, Clock, ClipboardList, Calendar, Shield, Activity,
  UserCheck, ArrowRight, DollarSign, Star, AlertCircle,
  ChevronLeft,
} from 'lucide-react';
import {
  useEmployeeList, useEmployeeCounts, useCreateEmployee, useUpdateEmployee, useDeleteEmployee,
  useDepartmentList, useCreateDepartment, useUpdateDepartment, useDeleteDepartment,
  useTimeOffList, useCreateTimeOff, useUpdateTimeOff, useDeleteTimeOff,
  useSeedHrData, useHrDashboard, useLeaveBalances, useAllocateLeave,
  useOnboardingTasks, useCreateOnboardingTask, useUpdateOnboardingTask, useDeleteOnboardingTask,
  useApplyOnboardingTemplate, useOnboardingTemplates,
  useEmployeeDocuments, useUploadEmployeeDocument, useDeleteEmployeeDocument,
  useLeaveTypes, useCreateLeaveType, useUpdateLeaveType, useDeleteLeaveType,
  useLeavePolicies, useCreateLeavePolicy, useUpdateLeavePolicy,
  useHolidayCalendars, useCreateHolidayCalendar, useHolidays, useCreateHoliday, useDeleteHoliday,
  useLeaveApplications, useCreateLeaveApplication, useSubmitLeaveApplication,
  useApproveLeaveApplication, useRejectLeaveApplication, useCancelLeaveApplication,
  useLeaveCalendar,
  useAttendanceList, useMarkAttendance, useBulkMarkAttendance, useAttendanceToday,
  useLifecycleTimeline, useCreateLifecycleEvent,
  type HrEmployee, type HrDepartment, type HrTimeOff, type HrDashboardData,
  type OnboardingTask, type EmployeeDocument, type LeaveBalance,
  type HrLeaveType, type HrLeavePolicy, type HrLeaveApplication,
  type HrHolidayCalendar, type HrHoliday,
  type HrAttendanceRecord, type HrLifecycleEvent,
} from './hooks';
import { AppSidebar, SidebarSection, SidebarItem } from '../../components/layout/app-sidebar';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Modal } from '../../components/ui/modal';
import { IconButton } from '../../components/ui/icon-button';
import { Badge } from '../../components/ui/badge';
import { Avatar } from '../../components/ui/avatar';
import { Skeleton } from '../../components/ui/skeleton';
import { SmartButtonBar } from '../../components/shared/SmartButtonBar';
import { ColumnHeader } from '../../components/ui/column-header';
import { FeatureEmptyState } from '../../components/ui/feature-empty-state';
import { StatusDot } from '../../components/ui/status-dot';
import { ContentArea } from '../../components/ui/content-area';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { useUIStore } from '../../stores/ui-store';
import { useHrSettingsStore } from './settings-store';
import { StatCard } from '../../components/ui/stat-card';
import { formatDate } from '../../lib/format';
import '../../styles/hr.css';

// ─── Navigation ────────────────────────────────────────────────────

type NavSection = 'dashboard' | 'employees' | 'departments' | 'org-chart' | 'time-off'
  | 'attendance' | 'my-leave' | 'team-calendar' | 'leave-types' | 'holidays' | 'policies'
  | `dept:${string}`;

// ─── Status helpers ────────────────────────────────────────────────

function getStatusBadge(status: HrEmployee['status'], t: (k: string) => string) {
  switch (status) {
    case 'active':
      return <Badge variant="success">{t('hr.status.active')}</Badge>;
    case 'on-leave':
      return <Badge variant="warning">{t('hr.status.onLeave')}</Badge>;
    case 'terminated':
      return <Badge variant="error">{t('hr.status.terminated')}</Badge>;
  }
}

function getTimeOffTypeBadge(type: HrTimeOff['type'], t: (k: string) => string) {
  switch (type) {
    case 'vacation':
      return <Badge variant="primary">{t('hr.leaveType.vacation')}</Badge>;
    case 'sick':
      return <Badge variant="warning">{t('hr.leaveType.sick')}</Badge>;
    case 'personal':
      return <Badge variant="default">{t('hr.leaveType.personal')}</Badge>;
  }
}

function getTimeOffStatusBadge(status: HrTimeOff['status'], t: (k: string) => string) {
  switch (status) {
    case 'pending':
      return <Badge variant="warning">{t('hr.timeOffStatus.pending')}</Badge>;
    case 'approved':
      return <Badge variant="success">{t('hr.timeOffStatus.approved')}</Badge>;
    case 'rejected':
      return <Badge variant="error">{t('hr.timeOffStatus.rejected')}</Badge>;
  }
}

function getCategoryBadge(category: string) {
  const variants: Record<string, 'primary' | 'success' | 'warning' | 'error' | 'default'> = {
    IT: 'primary', HR: 'success', Team: 'warning', Admin: 'error',
  };
  return <Badge variant={variants[category] || 'default'}>{category}</Badge>;
}

function getDocTypeBadge(type: string) {
  const variants: Record<string, 'primary' | 'success' | 'warning' | 'error' | 'default'> = {
    contract: 'primary', certificate: 'success', ID: 'warning', resume: 'default', 'policy-acknowledgment': 'error',
  };
  return <Badge variant={variants[type] || 'default'}>{type}</Badge>;
}

// ─── Color Presets ─────────────────────────────────────────────────

const DEPARTMENT_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

// ─── Create Employee Modal ─────────────────────────────────────────

function CreateEmployeeModal({
  open,
  onClose,
  departments,
}: {
  open: boolean;
  onClose: () => void;
  departments: HrDepartment[];
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [startDate, setStartDate] = useState('');
  const createEmployee = useCreateEmployee();

  const reset = () => {
    setName('');
    setEmail('');
    setRole('');
    setDepartmentId('');
    setStartDate('');
  };

  const handleSubmit = () => {
    if (!name.trim() || !email.trim()) return;
    createEmployee.mutate(
      {
        name: name.trim(),
        email: email.trim(),
        phone: null,
        role: role.trim() || 'Employee',
        departmentId: departmentId || null,
        status: 'active',
        startDate: startDate || new Date().toISOString().slice(0, 10),
        avatarUrl: null,
        tags: [],
        notes: null,
        dateOfBirth: null,
        gender: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        emergencyContactRelation: null,
        employmentType: 'full-time',
        managerId: null,
        jobTitle: null,
        workLocation: null,
        salary: null,
        salaryCurrency: 'USD',
        salaryPeriod: 'yearly',
      } as any,
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} width={440} title={t('hr.actions.addEmployee')}>
      <Modal.Header title={t('hr.actions.addEmployee')} subtitle={t('hr.actions.addEmployeeSubtitle')} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <Input label={t('hr.fields.fullName')} value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" autoFocus />
          <Input label={t('hr.fields.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="john@company.com" />
          <Input label={t('hr.fields.role')} value={role} onChange={(e) => setRole(e.target.value)} placeholder="Software Engineer" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label className="hr-field-label">{t('hr.fields.department')}</label>
            <Select
              value={departmentId}
              onChange={setDepartmentId}
              options={[
                { value: '', label: t('hr.fields.none') },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
              placeholder={t('hr.fields.selectDepartment')}
            />
          </div>
          <Input label={t('hr.fields.startDate')} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!name.trim() || !email.trim()}>
          {t('hr.actions.addEmployee')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// ─── Create Department Modal ───────────────────────────────────────

function CreateDepartmentModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(DEPARTMENT_COLORS[0]);
  const createDepartment = useCreateDepartment();

  const reset = () => {
    setName('');
    setDescription('');
    setColor(DEPARTMENT_COLORS[0]);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    createDepartment.mutate(
      {
        name: name.trim(),
        description: description.trim() || null,
        color,
        headEmployeeId: null,
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} width={440} title={t('hr.actions.addDepartment')}>
      <Modal.Header title={t('hr.actions.addDepartment')} subtitle={t('hr.actions.addDepartmentSubtitle')} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <Input label={t('hr.fields.departmentName')} value={name} onChange={(e) => setName(e.target.value)} placeholder="Engineering" autoFocus />
          <Input label={t('hr.fields.description')} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('hr.fields.optionalDescription')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label className="hr-field-label">{t('hr.fields.color')}</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DEPARTMENT_COLORS.map((c) => (
                <Button
                  key={c}
                  variant="ghost"
                  aria-label={`Select color ${c}`}
                  onClick={() => setColor(c)}
                  style={{
                    width: 28, height: 28, minWidth: 28, padding: 0,
                    borderRadius: 'var(--radius-md)', background: c,
                    border: color === c ? '2px solid var(--color-text-primary)' : '2px solid transparent',
                    cursor: 'pointer', transition: 'border-color 0.1s',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!name.trim()}>
          {t('hr.actions.addDepartment')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// ─── Request Time Off Modal ────────────────────────────────────────

function RequestTimeOffModal({
  open,
  onClose,
  employees,
}: {
  open: boolean;
  onClose: () => void;
  employees: HrEmployee[];
}) {
  const { t } = useTranslation();
  const [employeeId, setEmployeeId] = useState('');
  const [type, setType] = useState<'vacation' | 'sick' | 'personal'>('vacation');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const createTimeOff = useCreateTimeOff();

  const reset = () => {
    setEmployeeId('');
    setType('vacation');
    setStartDate('');
    setEndDate('');
    setNotes('');
  };

  const handleSubmit = () => {
    if (!employeeId || !startDate || !endDate) return;
    createTimeOff.mutate(
      { employeeId, type, startDate, endDate, status: 'pending', notes: notes.trim() || null },
      { onSuccess: () => { reset(); onClose(); } },
    );
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} width={440} title={t('hr.actions.requestTimeOff')}>
      <Modal.Header title={t('hr.actions.requestTimeOff')} subtitle={t('hr.actions.requestTimeOffSubtitle')} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label className="hr-field-label">{t('hr.fields.employee')}</label>
            <Select
              value={employeeId}
              onChange={setEmployeeId}
              options={employees.filter((e) => e.status === 'active').map((e) => ({ value: e.id, label: e.name }))}
              placeholder={t('hr.fields.selectEmployee')}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label className="hr-field-label">{t('hr.fields.type')}</label>
            <Select
              value={type}
              onChange={(v) => setType(v as typeof type)}
              options={[
                { value: 'vacation', label: t('hr.leaveType.vacation') },
                { value: 'sick', label: t('hr.leaveType.sick') },
                { value: 'personal', label: t('hr.leaveType.personal') },
              ]}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
            <Input label={t('hr.fields.startDate')} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <Input label={t('hr.fields.endDate')} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Input label={t('hr.fields.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('hr.fields.optionalNotes')} />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!employeeId || !startDate || !endDate}>
          {t('hr.actions.submitRequest')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// ─── Edit Department Modal ─────────────────────────────────────────

function EditDepartmentModal({
  open,
  onClose,
  department,
}: {
  open: boolean;
  onClose: () => void;
  department: HrDepartment;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(department.name);
  const [description, setDescription] = useState(department.description || '');
  const [color, setColor] = useState(department.color);
  const updateDepartment = useUpdateDepartment();

  useEffect(() => {
    setName(department.name);
    setDescription(department.description || '');
    setColor(department.color);
  }, [department]);

  const handleSubmit = () => {
    if (!name.trim()) return;
    updateDepartment.mutate(
      { id: department.id, name: name.trim(), description: description.trim() || null, color },
      { onSuccess: () => onClose() },
    );
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} width={440} title={t('hr.actions.editDepartment')}>
      <Modal.Header title={t('hr.actions.editDepartment')} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <Input label={t('hr.fields.departmentName')} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Input label={t('hr.fields.description')} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('hr.fields.optionalDescription')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label className="hr-field-label">{t('hr.fields.color')}</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DEPARTMENT_COLORS.map((c) => (
                <Button
                  key={c}
                  variant="ghost"
                  aria-label={`Select color ${c}`}
                  onClick={() => setColor(c)}
                  style={{
                    width: 28, height: 28, minWidth: 28, padding: 0,
                    borderRadius: 'var(--radius-md)', background: c,
                    border: color === c ? '2px solid var(--color-text-primary)' : '2px solid transparent',
                    cursor: 'pointer', transition: 'border-color 0.1s',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!name.trim()}>
          {t('common.save')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

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
              { value: 'general', label: 'General' },
              { value: 'IT', label: 'IT' },
              { value: 'HR', label: 'HR' },
              { value: 'Team', label: 'Team' },
              { value: 'Admin', label: 'Admin' },
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
              {getCategoryBadge(task.category)}
              <IconButton icon={<Trash2 size={12} />} label={t('common.delete')} size={20} destructive onClick={() => deleteTask.mutate(task.id)} />
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
              {getDocTypeBadge(doc.type)}
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
                {formatSize(doc.size)}
              </span>
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
                {formatDate(doc.createdAt)}
              </span>
              <IconButton icon={<Download size={12} />} label={t('hr.documents.download')} size={20} onClick={() => handleDownload(doc)} />
              <IconButton icon={<Trash2 size={12} />} label={t('common.delete')} size={20} destructive onClick={() => deleteDoc.mutate(doc.id)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Employee Detail Panel ─────────────────────────────────────────

function EmployeeDetailPanel({
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
          <IconButton icon={<Trash2 size={14} />} label={t('hr.actions.deleteEmployee')} size={28} destructive onClick={() => setShowDeleteConfirm(true)} />
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
              <div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                  {employee.name}
                </div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                  {employee.jobTitle || employee.role}
                </div>
              </div>
            </div>

            {/* Basic fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
              {/* Email */}
              <div className="hr-detail-field">
                <span className="hr-detail-field-label">{t('hr.fields.email')}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                  <Mail size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                  {employee.email}
                </div>
              </div>

              {/* Phone */}
              {employee.phone && (
                <div className="hr-detail-field">
                  <span className="hr-detail-field-label">{t('hr.fields.phone')}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                    <Phone size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                    {employee.phone}
                  </div>
                </div>
              )}

              {/* Role */}
              <div className="hr-detail-field">
                <span className="hr-detail-field-label">{t('hr.fields.role')}</span>
                <Input
                  ref={roleRef}
                  value={role}
                  aria-label="Employee role"
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

// ─── Dashboard View ───────────────────────────────────────────────

function DashboardView() {
  const { t } = useTranslation();
  const { data, isLoading } = useHrDashboard();

  if (isLoading || !data) {
    return (
      <div style={{ padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--spacing-md)' }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} style={{ height: 90, borderRadius: 'var(--radius-lg)' }} />)}
        </div>
        <Skeleton style={{ height: 300, borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  const maxDeptCount = Math.max(...data.departmentCounts.map((d) => d.count), 1);

  return (
    <div style={{ padding: 'var(--spacing-lg)', overflow: 'auto', flex: 1 }}>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xl)' }}>
        <StatCard label={t('hr.dashboard.totalEmployees')} value={String(data.totalHeadcount)} icon={Users} color="var(--color-accent-primary)" />
        <StatCard label={t('hr.dashboard.onLeave')} value={String(data.statusCounts['on-leave'] || 0)} icon={CalendarDays} color="var(--color-warning)" />
        <StatCard label={t('hr.dashboard.pendingRequests')} value={String(data.pendingRequests)} icon={Clock} color="var(--color-error)" />
        <StatCard label={t('hr.dashboard.recentHires')} value={String(data.recentHires.length)} icon={Plus} color="var(--color-success)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-lg)' }}>
        {/* Department distribution */}
        <div style={{
          padding: 'var(--spacing-lg)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-primary)', background: 'var(--color-bg-primary)',
        }}>
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', marginBottom: 'var(--spacing-md)', fontFamily: 'var(--font-family)' }}>
            {t('hr.dashboard.byDepartment')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {data.departmentCounts.map((dept) => (
              <div key={dept.name} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <span style={{
                  width: 100, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {dept.name}
                </span>
                <div style={{ flex: 1, height: 8, background: 'var(--color-bg-tertiary)', borderRadius: 4 }}>
                  <div style={{
                    height: '100%', width: `${Math.max((dept.count / maxDeptCount) * 100, dept.count > 0 ? 4 : 0)}%`,
                    background: dept.color, borderRadius: 4, transition: 'width 0.3s',
                  }} />
                </div>
                <span style={{ minWidth: 24, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', textAlign: 'right' }}>
                  {dept.count}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tenure distribution */}
        <div style={{
          padding: 'var(--spacing-lg)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-primary)', background: 'var(--color-bg-primary)',
        }}>
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', marginBottom: 'var(--spacing-md)', fontFamily: 'var(--font-family)' }}>
            {t('hr.dashboard.tenureDistribution')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            {Object.entries(data.tenure).map(([range, count]) => {
              const maxTenure = Math.max(...Object.values(data.tenure), 1);
              return (
                <div key={range} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                  <span style={{ width: 60, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
                    {range}
                  </span>
                  <div style={{ flex: 1, height: 8, background: 'var(--color-bg-tertiary)', borderRadius: 4 }}>
                    <div style={{
                      height: '100%', width: `${Math.max((count / maxTenure) * 100, count > 0 ? 4 : 0)}%`,
                      background: 'var(--color-accent-primary)', borderRadius: 4, transition: 'width 0.3s',
                    }} />
                  </div>
                  <span style={{ minWidth: 24, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', textAlign: 'right' }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent hires */}
        <div style={{
          padding: 'var(--spacing-lg)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-primary)', background: 'var(--color-bg-primary)',
        }}>
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', marginBottom: 'var(--spacing-md)', fontFamily: 'var(--font-family)' }}>
            {t('hr.dashboard.recentHiresTitle')}
          </h3>
          {data.recentHires.length === 0 ? (
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
              {t('hr.dashboard.noRecentHires')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {data.recentHires.map((hire) => (
                <div key={hire.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                  <Avatar name={hire.name} size={28} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                      {hire.name}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                      {hire.role}
                    </div>
                  </div>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                    {formatDate(hire.startDate)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming birthdays */}
        <div style={{
          padding: 'var(--spacing-lg)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-primary)', background: 'var(--color-bg-primary)',
        }}>
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', marginBottom: 'var(--spacing-md)', fontFamily: 'var(--font-family)' }}>
            {t('hr.dashboard.upcomingBirthdays')}
          </h3>
          {data.upcomingBirthdays.length === 0 ? (
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
              {t('hr.dashboard.noBirthdays')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {data.upcomingBirthdays.map((b) => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                  <Cake size={14} style={{ color: 'var(--color-text-tertiary)' }} />
                  <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                    {b.name}
                  </span>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                    {formatDate(b.dateOfBirth)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Org Chart View ───────────────────────────────────────────────

function OrgChartView({
  departments,
  employees,
}: {
  departments: HrDepartment[];
  employees: HrEmployee[];
}) {
  const { t } = useTranslation();

  // Build tree: departments with employees grouped under them
  const deptTree = useMemo(() => {
    return departments.map((dept) => {
      const head = dept.headEmployeeId ? employees.find((e) => e.id === dept.headEmployeeId) : null;
      const members = employees.filter((e) => e.departmentId === dept.id && e.id !== dept.headEmployeeId);

      // Group by manager
      const managerGroups: Record<string, HrEmployee[]> = {};
      const directMembers: HrEmployee[] = [];
      for (const m of members) {
        if (m.managerId && m.managerId !== dept.headEmployeeId) {
          if (!managerGroups[m.managerId]) managerGroups[m.managerId] = [];
          managerGroups[m.managerId].push(m);
        } else {
          directMembers.push(m);
        }
      }

      return { dept, head, directMembers, managerGroups };
    });
  }, [departments, employees]);

  const unassigned = employees.filter((e) => !e.departmentId);

  if (departments.length === 0) {
    return (
      <div className="hr-empty-state">
        <GitBranch size={48} className="hr-empty-state-icon" />
        <div className="hr-empty-state-title">{t('hr.orgChart.empty')}</div>
        <div className="hr-empty-state-desc">{t('hr.orgChart.emptyDesc')}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--spacing-lg)', overflow: 'auto', flex: 1 }}>
      {/* Company root */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-lg)' }}>
        <div style={{
          padding: 'var(--spacing-md) var(--spacing-xl)',
          borderRadius: 'var(--radius-lg)', border: '2px solid var(--color-accent-primary)',
          background: 'var(--color-bg-primary)', textAlign: 'center',
        }}>
          <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
            {t('hr.orgChart.organization')}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
            {employees.length} {t('hr.orgChart.employees')}
          </div>
        </div>

        {/* Connector line */}
        <div style={{ width: 2, height: 24, background: 'var(--color-border-primary)' }} />

        {/* Department level */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-xl)', justifyContent: 'center' }}>
          {deptTree.map(({ dept, head, directMembers, managerGroups }) => (
            <div key={dept.id} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-sm)',
              minWidth: 200,
            }}>
              {/* Department node */}
              <div style={{
                padding: 'var(--spacing-md)', borderRadius: 'var(--radius-lg)',
                border: `2px solid ${dept.color}`, background: 'var(--color-bg-primary)',
                textAlign: 'center', width: '100%',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-xs)', marginBottom: 4 }}>
                  <StatusDot color={dept.color} size={10} />
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                    {dept.name}
                  </span>
                </div>
                {head && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-xs)' }}>
                    <Avatar name={head.name} size={22} />
                    <div>
                      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                        {head.name}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                        {head.jobTitle || head.role}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Connector */}
              {directMembers.length > 0 && (
                <div style={{ width: 2, height: 12, background: 'var(--color-border-secondary)' }} />
              )}

              {/* Members */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
                {directMembers.map((emp) => (
                  <div key={emp.id} style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)',
                    padding: '6px var(--spacing-sm)', borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-bg-secondary)', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-family)',
                  }}>
                    <Avatar name={emp.name} size={20} />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {emp.name}
                      </div>
                      <div style={{ color: 'var(--color-text-tertiary)', fontSize: '10px' }}>
                        {emp.jobTitle || emp.role}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Unassigned employees */}
          {unassigned.length > 0 && (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--spacing-sm)',
              minWidth: 200,
            }}>
              <div style={{
                padding: 'var(--spacing-md)', borderRadius: 'var(--radius-lg)',
                border: '2px dashed var(--color-border-primary)', background: 'var(--color-bg-primary)',
                textAlign: 'center', width: '100%',
              }}>
                <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                  {t('hr.orgChart.unassigned')}
                </span>
              </div>
              <div style={{ width: 2, height: 12, background: 'var(--color-border-secondary)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
                {unassigned.map((emp) => (
                  <div key={emp.id} style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)',
                    padding: '6px var(--spacing-sm)', borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-bg-secondary)', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-family)',
                  }}>
                    <Avatar name={emp.name} size={20} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' }}>{emp.name}</div>
                      <div style={{ color: 'var(--color-text-tertiary)', fontSize: '10px' }}>{emp.jobTitle || emp.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Employees List View ───────────────────────────────────────────

function EmployeesListView({
  employees,
  departments,
  selectedId,
  onSelect,
  searchQuery,
  onAdd,
}: {
  employees: HrEmployee[];
  departments: HrDepartment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const showDept = useHrSettingsStore((s) => s.showDepartmentInList);
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase();
    return employees.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q),
    );
  }, [employees, searchQuery]);

  if (filtered.length === 0) {
    if (searchQuery) {
      return (
        <div className="hr-empty-state">
          <Users size={48} className="hr-empty-state-icon" />
          <div className="hr-empty-state-title">{t('hr.employees.noMatch')}</div>
          <div className="hr-empty-state-desc">{t('hr.employees.noMatchDesc')}</div>
        </div>
      );
    }
    return (
      <FeatureEmptyState
        illustration="employees"
        title={t('hr.empty.title')}
        description={t('hr.empty.desc')}
        highlights={[
          { icon: <Users size={14} />, title: t('hr.empty.h1Title'), description: t('hr.empty.h1Desc') },
          { icon: <Building2 size={14} />, title: t('hr.empty.h2Title'), description: t('hr.empty.h2Desc') },
          { icon: <CalendarDays size={14} />, title: t('hr.empty.h3Title'), description: t('hr.empty.h3Desc') },
        ]}
        actionLabel={t('hr.actions.addEmployee')}
        actionIcon={<Plus size={14} />}
        onAction={onAdd}
      />
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {/* Table header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)',
        padding: '8px var(--spacing-lg)', borderBottom: '1px solid var(--color-border-secondary)',
        fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--color-text-tertiary)', textTransform: 'uppercase',
        letterSpacing: '0.04em', fontFamily: 'var(--font-family)', flexShrink: 0,
      }}>
        <span style={{ width: 220, flexShrink: 0 }}><ColumnHeader label={t('hr.columns.name')} icon={<User size={12} />} /></span>
        <span style={{ width: 180, flexShrink: 0 }}><ColumnHeader label={t('hr.columns.email')} icon={<Mail size={12} />} /></span>
        <span style={{ width: 140, flexShrink: 0 }}><ColumnHeader label={t('hr.columns.role')} icon={<Briefcase size={12} />} /></span>
        {showDept && <span style={{ width: 120, flexShrink: 0 }}><ColumnHeader label={t('hr.columns.department')} icon={<Building2 size={12} />} /></span>}
        <span style={{ width: 80, flexShrink: 0 }}><ColumnHeader label={t('hr.columns.status')} icon={<Tag size={12} />} /></span>
        <span style={{ flex: 1 }}><ColumnHeader label={t('hr.columns.started')} icon={<CalendarDays size={12} />} /></span>
      </div>

      {filtered.map((emp) => {
        const dept = emp.departmentId ? departments.find((d) => d.id === emp.departmentId) : null;
        return (
          <div key={emp.id} className={`hr-employee-row${selectedId === emp.id ? ' selected' : ''}`} onClick={() => onSelect(emp.id)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', width: 220, flexShrink: 0 }}>
              <Avatar name={emp.name} size={28} />
              <span style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {emp.name}
              </span>
            </div>
            <span style={{ width: 180, flexShrink: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {emp.email}
            </span>
            <span style={{ width: 140, flexShrink: 0, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {emp.role}
            </span>
            {showDept && (
              <span style={{ width: 120, flexShrink: 0 }}>
                {dept ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-family)', color: 'var(--color-text-secondary)' }}>
                    <StatusDot color={dept.color} size={8} />
                    {dept.name}
                  </span>
                ) : (
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>-</span>
                )}
              </span>
            )}
            <span style={{ width: 80, flexShrink: 0 }}>{getStatusBadge(emp.status, t)}</span>
            <span style={{ flex: 1, fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
              {formatDate(emp.startDate)}
            </span>
            {selectedId === emp.id && <ChevronRight size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Departments View ──────────────────────────────────────────────

function DepartmentsView({
  departments,
  employees,
  onEdit,
  onDelete,
}: {
  departments: HrDepartment[];
  employees: HrEmployee[];
  onEdit: (dept: HrDepartment) => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (departments.length === 0) {
    return (
      <div className="hr-empty-state">
        <Building2 size={48} className="hr-empty-state-icon" />
        <div className="hr-empty-state-title">{t('hr.departments.empty')}</div>
        <div className="hr-empty-state-desc">{t('hr.departments.emptyDesc')}</div>
      </div>
    );
  }

  return (
    <div className="hr-dept-grid">
      {departments.map((dept) => {
        const deptEmployees = employees.filter((e) => e.departmentId === dept.id);
        const headEmployee = dept.headEmployeeId ? employees.find((e) => e.id === dept.headEmployeeId) : null;

        return (
          <div key={dept.id} className="hr-dept-card">
            <div style={{ height: 4, background: dept.color }} />
            <div style={{ padding: 'var(--spacing-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', marginBottom: 4 }}>
                    {dept.name}
                  </div>
                  {dept.description && (
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                      {dept.description}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                  <IconButton icon={<Edit3 size={14} />} label={t('hr.actions.editDepartment')} size={28} onClick={() => onEdit(dept)} />
                  <IconButton icon={<Trash2 size={14} />} label={t('hr.actions.deleteDepartment')} size={28} destructive onClick={() => onDelete(dept.id)} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'var(--spacing-sm)', borderTop: '1px solid var(--color-border-secondary)' }}>
                {headEmployee ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
                    <Avatar name={headEmployee.name} size={20} />
                    {headEmployee.name}
                  </div>
                ) : (
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                    {t('hr.departments.noHead')}
                  </span>
                )}
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', fontVariantNumeric: 'tabular-nums' }}>
                  {deptEmployees.length} {deptEmployees.length === 1 ? t('hr.departments.member') : t('hr.departments.members')}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Time Off View ─────────────────────────────────────────────────

function TimeOffView({
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
  if (timeOffRequests.length === 0) {
    return (
      <div className="hr-empty-state">
        <CalendarDays size={48} className="hr-empty-state-icon" />
        <div className="hr-empty-state-title">{t('hr.timeOff.empty')}</div>
        <div className="hr-empty-state-desc">{t('hr.timeOff.emptyDesc')}</div>
      </div>
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
              <IconButton icon={<Trash2 size={14} />} label={t('common.delete')} size={26} destructive onClick={() => onDelete(req.id)} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Leave Types View ─────────────────────────────────────────────

function LeaveTypesView() {
  const { t } = useTranslation();
  const { data: leaveTypes, isLoading } = useLeaveTypes(true);
  const createLeaveType = useCreateLeaveType();
  const updateLeaveType = useUpdateLeaveType();
  const deleteLeaveType = useDeleteLeaveType();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [days, setDays] = useState(0);
  const [carryForward, setCarryForward] = useState(0);

  const handleCreate = () => {
    if (!name.trim()) return;
    createLeaveType.mutate({
      name: name.trim(), slug: slug.trim() || name.trim().toLowerCase().replace(/\s+/g, '-'),
      color, defaultDaysPerYear: days, maxCarryForward: carryForward,
    }, { onSuccess: () => { setShowCreate(false); setName(''); setSlug(''); setDays(0); setCarryForward(0); } });
  };

  if (isLoading) return <div style={{ padding: 'var(--spacing-xl)' }}><Skeleton height={200} /></div>;

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-xl)' }}>
      {(!leaveTypes || leaveTypes.length === 0) && !showCreate && (
        <FeatureEmptyState
          illustration="generic"
          title={t('hr.leaveTypes.empty')}
          description={t('hr.leaveTypes.emptyDesc')}
          actionLabel={t('hr.leaveTypes.add')}
          actionIcon={<Plus size={14} />}
          onAction={() => setShowCreate(true)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {leaveTypes?.map((lt) => (
          <div key={lt.id} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: 'var(--spacing-md) var(--spacing-lg)',
            borderBottom: '1px solid var(--color-border-secondary)',
          }}>
            <StatusDot color={lt.color} size={12} />
            <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
              {lt.name}
            </span>
            <span style={{ width: 80, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              {lt.defaultDaysPerYear} {t('hr.leaveBalance.days').toLowerCase()}/{t('hr.period.yearly').toLowerCase()}
            </span>
            <span style={{ width: 80, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
              {t('hr.leaveTypes.carry')}: {lt.maxCarryForward}
            </span>
            <Badge variant={lt.isPaid ? 'success' : 'default'}>{lt.isPaid ? t('hr.leaveTypes.paid') : t('hr.leaveTypes.unpaid')}</Badge>
            <Badge variant={lt.isActive ? 'primary' : 'default'}>{lt.isActive ? t('hr.status.active') : t('hr.leaveTypes.inactive')}</Badge>
            <IconButton
              icon={lt.isActive ? <XCircle size={14} /> : <Check size={14} />}
              label={lt.isActive ? t('hr.leaveTypes.deactivate') : t('hr.leaveTypes.activate')}
              size={26}
              onClick={() => updateLeaveType.mutate({ id: lt.id, isActive: !lt.isActive })}
            />
            <IconButton icon={<Trash2 size={14} />} label={t('common.delete')} size={26} destructive onClick={() => deleteLeaveType.mutate(lt.id)} />
          </div>
        ))}
      </div>

      {showCreate && (
        <div style={{ marginTop: 'var(--spacing-lg)', padding: 'var(--spacing-lg)', border: '1px solid var(--color-border-primary)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
              <Input label={t('hr.fields.name')} value={name} onChange={(e) => setName(e.target.value)} placeholder="Vacation" style={{ flex: 1 }} autoFocus />
              <Input label={t('hr.leaveTypes.slug')} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="vacation" style={{ flex: 1 }} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
              <Input label={t('hr.leaveTypes.daysPerYear')} type="number" value={String(days)} onChange={(e) => setDays(Number(e.target.value))} style={{ flex: 1 }} />
              <Input label={t('hr.leaveTypes.maxCarry')} type="number" value={String(carryForward)} onChange={(e) => setCarryForward(Number(e.target.value))} style={{ flex: 1 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                <label className="hr-field-label">{t('hr.fields.color')}</label>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 34, height: 34, border: 'none', background: 'none', cursor: 'pointer' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
              <Button variant="primary" size="sm" onClick={handleCreate} disabled={!name.trim()}>{t('common.save')}</Button>
            </div>
          </div>
        </div>
      )}

      {!showCreate && (
        <div style={{ marginTop: 'var(--spacing-lg)' }}>
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
            {t('hr.leaveTypes.add')}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Leave Policies View ──────────────────────────────────────────

function LeavePoliciesView() {
  const { t } = useTranslation();
  const { data: policies, isLoading } = useLeavePolicies();
  const { data: leaveTypes } = useLeaveTypes();
  const createPolicy = useCreateLeavePolicy();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    createPolicy.mutate({
      name: name.trim(), description: description.trim() || null,
      allocations: leaveTypes?.map(lt => ({ leaveTypeId: lt.id, daysPerYear: lt.defaultDaysPerYear })) || [],
    }, { onSuccess: () => { setShowCreate(false); setName(''); setDescription(''); } });
  };

  const getLeaveTypeName = (id: string) => leaveTypes?.find(lt => lt.id === id)?.name ?? id;
  const getLeaveTypeColor = (id: string) => leaveTypes?.find(lt => lt.id === id)?.color ?? '#6b7280';

  if (isLoading) return <div style={{ padding: 'var(--spacing-xl)' }}><Skeleton height={200} /></div>;

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-xl)' }}>
      {(!policies || policies.length === 0) && !showCreate && (
        <FeatureEmptyState
          illustration="generic"
          title={t('hr.policies.empty')}
          description={t('hr.policies.emptyDesc')}
          actionLabel={t('hr.policies.add')}
          actionIcon={<Plus size={14} />}
          onAction={() => setShowCreate(true)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {policies?.map((p) => (
          <div key={p.id} style={{
            padding: 'var(--spacing-lg)', border: '1px solid var(--color-border-secondary)',
            borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-primary)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
              <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {p.name}
              </span>
              {p.isDefault && <Badge variant="primary">{t('hr.policies.default')}</Badge>}
            </div>
            {p.description && (
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--spacing-md)', fontFamily: 'var(--font-family)' }}>
                {p.description}
              </p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
              {p.allocations.map((alloc, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', padding: 'var(--spacing-xs) var(--spacing-sm)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)' }}>
                  <StatusDot color={getLeaveTypeColor(alloc.leaveTypeId)} size={8} />
                  <span style={{ color: 'var(--color-text-secondary)' }}>{getLeaveTypeName(alloc.leaveTypeId)}</span>
                  <span style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>{alloc.daysPerYear}d</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div style={{ marginTop: 'var(--spacing-lg)', padding: 'var(--spacing-lg)', border: '1px solid var(--color-border-primary)', borderRadius: 'var(--radius-lg)' }}>
          <Input label={t('hr.fields.name')} value={name} onChange={(e) => setName(e.target.value)} placeholder="Standard" autoFocus />
          <div style={{ marginTop: 'var(--spacing-md)' }}>
            <Input label={t('hr.fields.description')} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('hr.fields.optionalDescription')} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={handleCreate} disabled={!name.trim()}>{t('common.save')}</Button>
          </div>
        </div>
      )}

      {!showCreate && (
        <div style={{ marginTop: 'var(--spacing-lg)' }}>
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
            {t('hr.policies.add')}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Holidays View ────────────────────────────────────────────────

function HolidaysView() {
  const { t } = useTranslation();
  const { data: calendars } = useHolidayCalendars();
  const createCalendar = useCreateHolidayCalendar();
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const { data: holidays } = useHolidays(selectedCalendarId ?? undefined);
  const createHoliday = useCreateHoliday();
  const deleteHoliday = useDeleteHoliday();
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  const [hName, setHName] = useState('');
  const [hDate, setHDate] = useState('');
  const [hType, setHType] = useState('public');

  // Auto-select first calendar
  useEffect(() => {
    if (calendars?.length && !selectedCalendarId) setSelectedCalendarId(calendars[0].id);
  }, [calendars, selectedCalendarId]);

  const handleCreateCalendar = () => {
    const year = new Date().getFullYear();
    createCalendar.mutate({ name: `${t('hr.holidays.calendar')} ${year}`, year, isDefault: true });
  };

  const handleAddHoliday = () => {
    if (!hName.trim() || !hDate || !selectedCalendarId) return;
    createHoliday.mutate({ calendarId: selectedCalendarId, name: hName.trim(), date: hDate, type: hType }, {
      onSuccess: () => { setShowAddHoliday(false); setHName(''); setHDate(''); },
    });
  };

  const typeColors: Record<string, string> = { public: 'var(--color-error)', company: 'var(--color-accent-primary)', optional: 'var(--color-warning)' };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-xl)' }}>
      {/* Calendar selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xl)' }}>
        {calendars && calendars.length > 0 ? (
          <Select
            value={selectedCalendarId || ''}
            onChange={(v) => setSelectedCalendarId(v)}
            options={calendars.map(c => ({ value: c.id, label: `${c.name} (${c.year})` }))}
            size="sm"
          />
        ) : (
          <Button variant="secondary" size="sm" onClick={handleCreateCalendar}>{t('hr.holidays.createCalendar')}</Button>
        )}
      </div>

      {/* Holiday list */}
      {selectedCalendarId && (
        <>
          {(!holidays || holidays.length === 0) && !showAddHoliday && (
            <FeatureEmptyState
              illustration="calendar"
              title={t('hr.holidays.empty')}
              description={t('hr.holidays.emptyDesc')}
              actionLabel={t('hr.holidays.add')}
              actionIcon={<Plus size={14} />}
              onAction={() => setShowAddHoliday(true)}
            />
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {holidays?.map((h) => (
              <div key={h.id} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: 'var(--spacing-md) var(--spacing-lg)',
                borderBottom: '1px solid var(--color-border-secondary)',
              }}>
                <div style={{ width: 4, height: 24, borderRadius: 2, background: typeColors[h.type] || 'var(--color-text-tertiary)', flexShrink: 0 }} />
                <span style={{ width: 100, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
                  {formatDate(h.date)}
                </span>
                <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                  {h.name}
                </span>
                <Badge variant={h.type === 'public' ? 'error' : h.type === 'company' ? 'primary' : 'warning'}>{h.type}</Badge>
                <IconButton icon={<Trash2 size={14} />} label={t('common.delete')} size={26} destructive onClick={() => deleteHoliday.mutate(h.id)} />
              </div>
            ))}
          </div>

          {showAddHoliday && (
            <div style={{ marginTop: 'var(--spacing-lg)', padding: 'var(--spacing-lg)', border: '1px solid var(--color-border-primary)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                <Input label={t('hr.holidays.name')} value={hName} onChange={(e) => setHName(e.target.value)} placeholder="New Year's Day" style={{ flex: 1 }} autoFocus />
                <Input label={t('hr.holidays.date')} type="date" value={hDate} onChange={(e) => setHDate(e.target.value)} style={{ flex: 1 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', flex: 1 }}>
                  <label className="hr-field-label">{t('hr.fields.type')}</label>
                  <Select value={hType} onChange={setHType} options={[
                    { value: 'public', label: t('hr.holidays.typePublic') },
                    { value: 'company', label: t('hr.holidays.typeCompany') },
                    { value: 'optional', label: t('hr.holidays.typeOptional') },
                  ]} size="sm" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
                <Button variant="ghost" size="sm" onClick={() => setShowAddHoliday(false)}>{t('common.cancel')}</Button>
                <Button variant="primary" size="sm" onClick={handleAddHoliday} disabled={!hName.trim() || !hDate}>{t('common.save')}</Button>
              </div>
            </div>
          )}

          {!showAddHoliday && (
            <div style={{ marginTop: 'var(--spacing-lg)' }}>
              <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setShowAddHoliday(true)}>
                {t('hr.holidays.add')}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── My Leave View ────────────────────────────────────────────────

function MyLeaveView({ employees }: { employees: HrEmployee[] }) {
  const { t } = useTranslation();
  const { data: applications, isLoading } = useLeaveApplications();
  const { data: leaveTypes } = useLeaveTypes();
  const createApp = useCreateLeaveApplication();
  const submitApp = useSubmitLeaveApplication();
  const cancelApp = useCancelLeaveApplication();
  const approveApp = useApproveLeaveApplication();
  const rejectApp = useRejectLeaveApplication();
  const [showRequest, setShowRequest] = useState(false);
  const [reqEmployeeId, setReqEmployeeId] = useState('');
  const [reqLeaveTypeId, setReqLeaveTypeId] = useState('');
  const [reqStartDate, setReqStartDate] = useState('');
  const [reqEndDate, setReqEndDate] = useState('');
  const [reqReason, setReqReason] = useState('');
  const [reqHalfDay, setReqHalfDay] = useState(false);

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
        // Auto-submit
        if (data?.id) submitApp.mutate(data.id);
      },
    });
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
      draft: 'default', pending: 'warning', approved: 'success', rejected: 'error', cancelled: 'default',
    };
    return <Badge variant={variants[status] || 'default'}>{t(`hr.leaveAppStatus.${status}`)}</Badge>;
  };

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
            <StatusDot color={app.leaveTypeColor || '#6b7280'} size={10} />
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
              {app.status === 'pending' && (
                <>
                  <IconButton icon={<Check size={14} />} label={t('hr.actions.approve')} size={26} onClick={() => approveApp.mutate({ id: app.id })} style={{ color: 'var(--color-success)' }} />
                  <IconButton icon={<XCircle size={14} />} label={t('hr.actions.reject')} size={26} destructive onClick={() => rejectApp.mutate({ id: app.id })} />
                </>
              )}
              {app.status === 'approved' && (
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

      <div style={{ marginTop: 'var(--spacing-lg)' }}>
        <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={() => setShowRequest(true)}>
          {t('hr.myLeave.requestLeave')}
        </Button>
      </div>
    </div>
  );
}

// ─── Team Calendar View ───────────────────────────────────────────

function TeamCalendarView() {
  const { t } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const { data: calendarData } = useLeaveCalendar(currentMonth);

  const [year, month] = currentMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const monthName = new Date(year, month - 1).toLocaleDateString('en', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1);
    setCurrentMonth(d.toISOString().slice(0, 7));
  };
  const nextMonth = () => {
    const d = new Date(year, month, 1);
    setCurrentMonth(d.toISOString().slice(0, 7));
  };

  // Group by employee
  const byEmployee = useMemo(() => {
    const map: Record<string, { name: string; leaves: typeof calendarData }> = {};
    for (const entry of calendarData || []) {
      if (!map[entry.employeeId]) map[entry.employeeId] = { name: entry.employeeName, leaves: [] };
      map[entry.employeeId].leaves!.push(entry);
    }
    return Object.entries(map);
  }, [calendarData]);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-xl)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xl)' }}>
        <IconButton icon={<ChevronLeft size={14} />} label={t('common.previous')} size={28} onClick={prevMonth} />
        <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)', minWidth: 180, textAlign: 'center' }}>
          {monthName}
        </span>
        <IconButton icon={<ChevronRight size={14} />} label={t('common.next')} size={28} onClick={nextMonth} />
      </div>

      {byEmployee.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)', color: 'var(--color-text-tertiary)' }}>
          <Calendar size={40} style={{ marginBottom: 'var(--spacing-md)', opacity: 0.5 }} />
          <p style={{ fontFamily: 'var(--font-family)', fontSize: 'var(--font-size-md)' }}>{t('hr.teamCalendar.noLeaves')}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {byEmployee.map(([empId, { name, leaves }]) => (
            <div key={empId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: 'var(--spacing-sm) 0' }}>
              <span style={{ width: 140, flexShrink: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>{name}</span>
              <div style={{ flex: 1, display: 'flex', gap: 2, position: 'relative', height: 24 }}>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
                  const dateStr = `${currentMonth}-${String(day).padStart(2, '0')}`;
                  const leave = leaves?.find(l => l.startDate <= dateStr && l.endDate >= dateStr);
                  return (
                    <div key={day} style={{
                      flex: 1, height: 24, borderRadius: 'var(--radius-sm)',
                      background: leave ? leave.leaveTypeColor : 'var(--color-bg-secondary)',
                      opacity: leave ? 0.7 : 0.3, minWidth: 4,
                    }} title={leave ? `${leave.leaveTypeName} (${formatDate(leave.startDate)} - ${formatDate(leave.endDate)})` : dateStr} />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Attendance View ──────────────────────────────────────────────

function AttendanceView({ employees }: { employees: HrEmployee[] }) {
  const { t } = useTranslation();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const { data: records, isLoading } = useAttendanceList({ date: selectedDate });
  const { data: todaySummary } = useAttendanceToday();
  const markAttendance = useMarkAttendance();
  const bulkMark = useBulkMarkAttendance();

  const activeEmployees = employees.filter(e => e.status === 'active');

  // Map records by employeeId
  const recordMap = useMemo(() => {
    const map: Record<string, HrAttendanceRecord> = {};
    for (const r of records || []) map[r.employeeId] = r;
    return map;
  }, [records]);

  const handleMarkAll = () => {
    const unmarked = activeEmployees.filter(e => !recordMap[e.id]).map(e => e.id);
    if (unmarked.length === 0) return;
    bulkMark.mutate({ employeeIds: unmarked, date: selectedDate, status: 'present' });
  };

  const statusOptions = [
    { value: 'present', label: t('hr.attendance.present') },
    { value: 'absent', label: t('hr.attendance.absent') },
    { value: 'half-day', label: t('hr.attendance.halfDay') },
    { value: 'remote', label: t('hr.attendance.remote') },
    { value: 'on-leave', label: t('hr.attendance.onLeave') },
  ];

  const statusColors: Record<string, string> = {
    present: 'var(--color-success)', absent: 'var(--color-error)',
    'half-day': 'var(--color-warning)', remote: 'var(--color-accent-primary)', 'on-leave': 'var(--color-warning)',
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-xl)' }}>
      {/* Summary cards */}
      {selectedDate === today && todaySummary && (
        <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xl)' }}>
          {['present', 'absent', 'remote', 'on-leave'].map(s => (
            <div key={s} style={{ flex: 1, padding: 'var(--spacing-md)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)', textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)', color: statusColors[s] || 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {todaySummary[s] || 0}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', textTransform: 'capitalize' }}>
                {t(`hr.attendance.${s === 'half-day' ? 'halfDay' : s === 'on-leave' ? 'onLeave' : s}`)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Date picker + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
        <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} size="sm" style={{ width: 180 }} />
        <Button variant="secondary" size="sm" onClick={handleMarkAll}>{t('hr.attendance.markAllPresent')}</Button>
      </div>

      {/* Employee list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {activeEmployees.map((emp) => {
          const record = recordMap[emp.id];
          return (
            <div key={emp.id} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: 'var(--spacing-sm) var(--spacing-lg)',
              borderBottom: '1px solid var(--color-border-secondary)',
            }}>
              <Avatar name={emp.name} src={emp.avatarUrl} size={28} />
              <span style={{ width: 180, flexShrink: 0, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {emp.name}
              </span>
              <span style={{ width: 120, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                {emp.departmentName || '-'}
              </span>
              <div style={{ width: 140 }}>
                <Select
                  value={record?.status || ''}
                  onChange={(v) => markAttendance.mutate({ employeeId: emp.id, date: selectedDate, status: v })}
                  options={[{ value: '', label: '-' }, ...statusOptions]}
                  size="sm"
                />
              </div>
              {record && (
                <StatusDot color={statusColors[record.status] || 'var(--color-text-tertiary)'} size={10} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Lifecycle Timeline View ──────────────────────────────────────

function LifecycleTimeline({ employeeId, departments }: { employeeId: string; departments: HrDepartment[] }) {
  const { t } = useTranslation();
  const { data: events, isLoading } = useLifecycleTimeline(employeeId);
  const createEvent = useCreateLifecycleEvent();
  const [showAdd, setShowAdd] = useState(false);
  const [evtType, setEvtType] = useState('other');
  const [evtDate, setEvtDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [evtNotes, setEvtNotes] = useState('');

  const eventIcons: Record<string, typeof Activity> = {
    hired: UserCheck, promoted: Star, transferred: ArrowRight, resigned: AlertCircle,
    terminated: XCircle, 'salary-change': DollarSign, 'role-change': Briefcase, other: Activity,
  };

  const handleAdd = () => {
    createEvent.mutate({ employeeId, eventType: evtType, eventDate: evtDate, notes: evtNotes || undefined }, {
      onSuccess: () => { setShowAdd(false); setEvtNotes(''); },
    });
  };

  const getDeptName = (id: string | null) => departments.find(d => d.id === id)?.name || '-';

  if (isLoading) return <Skeleton height={100} />;

  return (
    <div style={{ padding: 'var(--spacing-md)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
          {t('hr.lifecycle.title')}
        </span>
        <Button variant="ghost" size="sm" icon={<Plus size={12} />} onClick={() => setShowAdd(true)}>{t('hr.lifecycle.addEvent')}</Button>
      </div>

      {showAdd && (
        <div style={{ marginBottom: 'var(--spacing-md)', padding: 'var(--spacing-md)', border: '1px solid var(--color-border-primary)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
            <Select value={evtType} onChange={setEvtType} options={[
              { value: 'hired', label: t('hr.lifecycle.hired') }, { value: 'promoted', label: t('hr.lifecycle.promoted') },
              { value: 'transferred', label: t('hr.lifecycle.transferred') }, { value: 'salary-change', label: t('hr.lifecycle.salaryChange') },
              { value: 'role-change', label: t('hr.lifecycle.roleChange') }, { value: 'resigned', label: t('hr.lifecycle.resigned') },
              { value: 'terminated', label: t('hr.lifecycle.terminated') }, { value: 'other', label: t('hr.lifecycle.other') },
            ]} size="sm" />
            <Input type="date" value={evtDate} onChange={(e) => setEvtDate(e.target.value)} size="sm" />
          </div>
          <Input value={evtNotes} onChange={(e) => setEvtNotes(e.target.value)} placeholder={t('hr.fields.optionalNotes')} size="sm" />
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)', justifyContent: 'flex-end', marginTop: 'var(--spacing-sm)' }}>
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={handleAdd}>{t('common.save')}</Button>
          </div>
        </div>
      )}

      {(!events || events.length === 0) && (
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
          {t('hr.lifecycle.empty')}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {events?.map((evt, i) => {
          const Icon = eventIcons[evt.eventType] || Activity;
          return (
            <div key={evt.id} style={{ display: 'flex', gap: 'var(--spacing-md)', paddingBottom: 'var(--spacing-md)', position: 'relative' }}>
              {i < (events.length - 1) && (
                <div style={{ position: 'absolute', left: 11, top: 24, bottom: 0, width: 1, background: 'var(--color-border-secondary)' }} />
              )}
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--color-bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 }}>
                <Icon size={12} style={{ color: 'var(--color-text-secondary)' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                    {t(`hr.lifecycle.${evt.eventType.replace('-', '')}`, evt.eventType)}
                  </span>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                    {formatDate(evt.eventDate)}
                  </span>
                </div>
                {(evt.fromValue || evt.toValue) && (
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)', marginTop: 2 }}>
                    {evt.fromValue} {evt.fromValue && evt.toValue ? '→' : ''} {evt.toValue}
                  </div>
                )}
                {(evt.fromDepartmentId || evt.toDepartmentId) && (
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)', marginTop: 2 }}>
                    {getDeptName(evt.fromDepartmentId)} → {getDeptName(evt.toDepartmentId)}
                  </div>
                )}
                {evt.notes && (
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)', marginTop: 2 }}>
                    {evt.notes}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main HR Page ──────────────────────────────────────────────────

export function HrPage() {
  const { t } = useTranslation();
  const isDesktop = !!('atlasDesktop' in window);
  const { openSettings } = useUIStore();

  // Navigation state (URL-driven, falls back to user's preferred default view)
  const hrDefaultView = useHrSettingsStore((s) => s.defaultView);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeNav = (searchParams.get('view') || hrDefaultView) as NavSection;
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const setActiveNav = useCallback((nav: NavSection) => {
    setSearchParams({ view: nav });
    setSelectedEmployeeId(null);
  }, [setSearchParams]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Modal state
  const [showCreateEmployee, setShowCreateEmployee] = useState(false);
  const [showCreateDepartment, setShowCreateDepartment] = useState(false);
  const [showCreateTimeOff, setShowCreateTimeOff] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<HrDepartment | null>(null);

  // Data
  const { data: countsData } = useEmployeeCounts();
  const counts = countsData ?? {
    totalEmployees: 0, activeEmployees: 0, onLeaveEmployees: 0,
    terminatedEmployees: 0, pendingTimeOff: 0, departments: 0,
  };

  const employeeFilters = useMemo(() => {
    if (activeNav === 'employees') return {};
    if (activeNav.startsWith('dept:')) return { departmentId: activeNav.replace('dept:', '') };
    return {};
  }, [activeNav]);

  const { data: employeesData, isLoading: loadingEmployees } = useEmployeeList(employeeFilters);
  const employees = employeesData?.employees ?? [];

  // We also need all employees for the org chart and detail panel manager dropdown
  const { data: allEmployeesData } = useEmployeeList({});
  const allEmployees = allEmployeesData?.employees ?? [];

  const { data: departmentsData } = useDepartmentList();
  const departments = departmentsData?.departments ?? [];

  const { data: timeOffData } = useTimeOffList();
  const timeOffRequests = timeOffData?.timeOffRequests ?? [];

  const updateTimeOff = useUpdateTimeOff();
  const deleteTimeOff = useDeleteTimeOff();
  const deleteDepartment = useDeleteDepartment();
  const seedHr = useSeedHrData();

  // Auto-seed on first visit
  const hasSeeded = useRef(false);
  useEffect(() => {
    if (
      !loadingEmployees && employees.length === 0 && departments.length === 0 &&
      !hasSeeded.current && countsData !== undefined && counts.totalEmployees === 0
    ) {
      hasSeeded.current = true;
      seedHr.mutate();
    }
  }, [loadingEmployees, employees.length, departments.length, countsData, counts.totalEmployees, seedHr]);

  const deptEmployeeCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const dept of departments) {
      map[dept.id] = allEmployees.filter((e) => e.departmentId === dept.id).length;
    }
    return map;
  }, [departments, allEmployees]);

  const selectedEmployee = selectedEmployeeId ? (activeNav.startsWith('dept:') ? employees : allEmployees).find((e) => e.id === selectedEmployeeId) : null;

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showSearch) { setShowSearch(false); setSearchQuery(''); }
        else if (selectedEmployeeId) setSelectedEmployeeId(null);
      }
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEmployeeId, showSearch]);

  const sectionTitle = useMemo(() => {
    if (activeNav === 'dashboard') return t('hr.sidebar.dashboard');
    if (activeNav === 'employees') return t('hr.sidebar.allEmployees');
    if (activeNav === 'departments') return t('hr.sidebar.departments');
    if (activeNav === 'org-chart') return t('hr.sidebar.orgChart');
    if (activeNav === 'time-off') return t('hr.sidebar.timeOff');
    if (activeNav === 'attendance') return t('hr.sidebar.attendance');
    if (activeNav === 'my-leave') return t('hr.sidebar.myLeave');
    if (activeNav === 'team-calendar') return t('hr.sidebar.teamCalendar');
    if (activeNav === 'leave-types') return t('hr.sidebar.leaveTypes');
    if (activeNav === 'holidays') return t('hr.sidebar.holidays');
    if (activeNav === 'policies') return t('hr.sidebar.policies');
    if (activeNav.startsWith('dept:')) {
      const dept = departments.find((d) => d.id === activeNav.replace('dept:', ''));
      return dept?.name || t('hr.sidebar.department');
    }
    return t('hr.title');
  }, [activeNav, departments, t]);

  const handleAdd = () => {
    if (activeNav === 'departments') setShowCreateDepartment(true);
    else if (activeNav === 'time-off') setShowCreateTimeOff(true);
    else setShowCreateEmployee(true);
  };

  const handleApproveTimeOff = (id: string) => { updateTimeOff.mutate({ id, status: 'approved' }); };
  const handleRejectTimeOff = (id: string) => { updateTimeOff.mutate({ id, status: 'rejected' }); };
  const handleDeleteTimeOff = (id: string) => { deleteTimeOff.mutate(id); };
  const handleDeleteDepartment = (id: string) => { deleteDepartment.mutate(id); };

  const showAddButton = activeNav === 'employees' || activeNav === 'departments' || activeNav === 'time-off' || activeNav.startsWith('dept:');

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <AppSidebar
        storageKey="atlas_hr_sidebar"
        title={t('hr.title')}
        footer={
          <SidebarItem
            label={t('hr.sidebar.settings')}
            icon={<Settings2 size={14} />}
            iconColor="#6b7280"
            onClick={() => openSettings('hr')}
          />
        }
      >
        <SidebarSection>
          <SidebarItem
            label={t('hr.sidebar.dashboard')}
            icon={<LayoutDashboard size={14} />}
            iconColor="#14b8a6"
            isActive={activeNav === 'dashboard'}
            onClick={() => { setActiveNav('dashboard'); setSelectedEmployeeId(null); }}
          />
          <SidebarItem
            label={t('hr.sidebar.allEmployees')}
            icon={<Users size={14} />}
            iconColor="#14b8a6"
            isActive={activeNav === 'employees'}
            count={counts.totalEmployees}
            onClick={() => { setActiveNav('employees'); setSelectedEmployeeId(null); }}
          />
        </SidebarSection>

        <SidebarSection title={t('hr.sidebar.departmentsTitle')}>
          <SidebarItem
            label={t('hr.sidebar.allDepartments')}
            icon={<Building2 size={14} />}
            iconColor="#06b6d4"
            isActive={activeNav === 'departments'}
            count={counts.departments}
            onClick={() => { setActiveNav('departments'); setSelectedEmployeeId(null); }}
          />
          {departments.map((dept) => (
            <SidebarItem
              key={dept.id}
              label={dept.name}
              icon={<StatusDot color={dept.color} size={10} />}
              isActive={activeNav === `dept:${dept.id}`}
              count={deptEmployeeCounts[dept.id] ?? 0}
              onClick={() => { setActiveNav(`dept:${dept.id}`); setSelectedEmployeeId(null); }}
            />
          ))}
        </SidebarSection>

        <SidebarSection>
          <SidebarItem
            label={t('hr.sidebar.orgChart')}
            icon={<GitBranch size={14} />}
            iconColor="#06b6d4"
            isActive={activeNav === 'org-chart'}
            onClick={() => { setActiveNav('org-chart'); setSelectedEmployeeId(null); }}
          />
          <SidebarItem
            label={t('hr.sidebar.attendance')}
            icon={<UserCheck size={14} />}
            iconColor="#10b981"
            isActive={activeNav === 'attendance'}
            onClick={() => { setActiveNav('attendance'); setSelectedEmployeeId(null); }}
          />
        </SidebarSection>

        <SidebarSection title={t('hr.sidebar.leaveSection')}>
          <SidebarItem
            label={t('hr.sidebar.myLeave')}
            icon={<CalendarDays size={14} />}
            iconColor="#f59e0b"
            isActive={activeNav === 'my-leave'}
            onClick={() => { setActiveNav('my-leave'); setSelectedEmployeeId(null); }}
          />
          <SidebarItem
            label={t('hr.sidebar.teamCalendar')}
            icon={<Calendar size={14} />}
            iconColor="#f59e0b"
            isActive={activeNav === 'team-calendar'}
            onClick={() => { setActiveNav('team-calendar'); setSelectedEmployeeId(null); }}
          />
          <SidebarItem
            label={t('hr.sidebar.leaveTypes')}
            icon={<ClipboardList size={14} />}
            iconColor="#8b5cf6"
            isActive={activeNav === 'leave-types'}
            onClick={() => { setActiveNav('leave-types'); setSelectedEmployeeId(null); }}
          />
          <SidebarItem
            label={t('hr.sidebar.holidays')}
            icon={<Calendar size={14} />}
            iconColor="#ef4444"
            isActive={activeNav === 'holidays'}
            onClick={() => { setActiveNav('holidays'); setSelectedEmployeeId(null); }}
          />
          <SidebarItem
            label={t('hr.sidebar.policies')}
            icon={<Shield size={14} />}
            iconColor="#06b6d4"
            isActive={activeNav === 'policies'}
            onClick={() => { setActiveNav('policies'); setSelectedEmployeeId(null); }}
          />
        </SidebarSection>
      </AppSidebar>

      {/* Main content */}
      <ContentArea
        title={sectionTitle}
        actions={
          <>
            {(activeNav === 'employees' || activeNav.startsWith('dept:')) && (
              <IconButton
                icon={<Search size={14} />}
                label={t('hr.actions.search')}
                size={28}
                active={showSearch}
                onClick={() => { setShowSearch(!showSearch); if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 50); }}
              />
            )}
            {showAddButton && (
              <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={handleAdd}>
                {activeNav === 'departments' ? t('hr.actions.addDepartment') : activeNav === 'time-off' ? t('hr.actions.requestTimeOff') : t('hr.actions.addEmployee')}
              </Button>
            )}
          </>
        }
      >
        {/* Search bar */}
        {showSearch && (activeNav === 'employees' || activeNav.startsWith('dept:')) && (
          <div className="hr-search-bar">
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('hr.actions.searchPlaceholder')}
              iconLeft={<Search size={14} />}
              size="sm"
              style={{ border: 'none', background: 'transparent' }}
            />
            <IconButton icon={<X size={14} />} label={t('common.close')} size={24} onClick={() => { setShowSearch(false); setSearchQuery(''); }} />
          </div>
        )}

        {/* Content area */}
        {activeNav === 'dashboard' && <DashboardView />}

        {activeNav === 'org-chart' && (
          <OrgChartView departments={departments} employees={allEmployees} />
        )}

        {(activeNav === 'employees' || activeNav.startsWith('dept:')) && (
          <EmployeesListView
            employees={employees}
            departments={departments}
            selectedId={selectedEmployeeId}
            onSelect={setSelectedEmployeeId}
            searchQuery={searchQuery}
            onAdd={handleAdd}
          />
        )}

        {activeNav === 'departments' && (
          <DepartmentsView departments={departments} employees={allEmployees} onEdit={setEditingDepartment} onDelete={handleDeleteDepartment} />
        )}

        {activeNav === 'time-off' && (
          <TimeOffView
            timeOffRequests={timeOffRequests}
            onApprove={handleApproveTimeOff}
            onReject={handleRejectTimeOff}
            onDelete={handleDeleteTimeOff}
          />
        )}

        {activeNav === 'attendance' && <AttendanceView employees={allEmployees} />}
        {activeNav === 'my-leave' && <MyLeaveView employees={allEmployees} />}
        {activeNav === 'team-calendar' && <TeamCalendarView />}
        {activeNav === 'leave-types' && <LeaveTypesView />}
        {activeNav === 'holidays' && <HolidaysView />}
        {activeNav === 'policies' && <LeavePoliciesView />}
      </ContentArea>

      {/* Detail panel */}
      {selectedEmployee && (activeNav === 'employees' || activeNav.startsWith('dept:')) && (
        <div style={{
          width: 400, borderLeft: '1px solid var(--color-border-primary)',
          flexShrink: 0, overflow: 'hidden', height: '100%',
        }}>
          <EmployeeDetailPanel
            employee={selectedEmployee}
            departments={departments}
            employees={allEmployees}
            timeOffRequests={timeOffRequests}
            onClose={() => setSelectedEmployeeId(null)}
          />
        </div>
      )}

      {/* Modals */}
      <CreateEmployeeModal open={showCreateEmployee} onClose={() => setShowCreateEmployee(false)} departments={departments} />
      <CreateDepartmentModal open={showCreateDepartment} onClose={() => setShowCreateDepartment(false)} />
      <RequestTimeOffModal open={showCreateTimeOff} onClose={() => setShowCreateTimeOff(false)} employees={allEmployees} />
      {editingDepartment && (
        <EditDepartmentModal open={!!editingDepartment} onClose={() => setEditingDepartment(null)} department={editingDepartment} />
      )}
    </div>
  );
}
