import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users, Building2, CalendarDays, Plus, Search, Settings2, X,
  User,
  LayoutDashboard, GitBranch,
  UserCheck,
  Receipt,
} from 'lucide-react';
import {
  useEmployeeList, useEmployeeCounts,
  useDepartmentList,
  useTimeOffList, useUpdateTimeOff, useDeleteTimeOff,
  useSeedHrData, useDeleteDepartment,
  usePendingApprovals,
  usePendingExpenseCount,
  useLeaveApplications,
  useMyExpenses,
  type HrDepartment,
} from './hooks';
import { AppSidebar, SidebarSection, SidebarItem } from '../../components/layout/app-sidebar';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { IconButton } from '../../components/ui/icon-button';
import { ContentArea } from '../../components/ui/content-area';
import { useUIStore } from '../../stores/ui-store';
import { useAuthStore } from '../../stores/auth-store';
import { useMyAppPermission } from '../../hooks/use-app-permissions';
import { useHrSettingsStore } from './settings-store';
import { OrgChartView } from './components/org-chart';
import { EmployeeDetailPage } from './components/employee-detail-page';
import { CreateEmployeeModal } from './components/modals/create-employee-modal';
import { CreateDepartmentModal } from './components/modals/create-department-modal';
import { RequestTimeOffModal } from './components/modals/request-time-off-modal';
import { EditDepartmentModal } from './components/modals/edit-department-modal';
import {
  DashboardView,
  EmployeesListView,
  DepartmentsView,
  TimeOffView,
  AttendanceView,
} from './components/views';
import { LeaveTabs } from './components/leave-tabs';
import { ExpensesTabs } from './components/expenses-tabs';
import '../../styles/hr.css';

// ─── Navigation ────────────────────────────────────────────────────

type NavSection = 'dashboard' | 'employees' | 'employee-detail' | 'departments' | 'org-chart' | 'time-off'
  | 'attendance' | 'my-profile'
  | 'leave' | 'expenses'
  | `dept:${string}`;

const PORTAL_VIEWS = new Set<string>(['my-profile', 'leave', 'expenses']);

// ─── Main HR Page ──────────────────────────────────────────────────

export function HrPage() {
  const { t } = useTranslation();
  const { openSettings } = useUIStore();

  // Auth
  const authAccount = useAuthStore((s) => s.account);

  // Permission gating. We intentionally read `isPending` here — until the
  // permission has loaded we can't know whether to show the admin or the
  // portal sidebar, so we render a loading shell below instead of guessing
  // (which caused a 'flash of admin view' on page load for portal users).
  const { data: hrPerm, isPending: hrPermPending } = useMyAppPermission('hr');
  const isPortalUser = hrPerm?.role === 'viewer';
  const canCreate = !hrPerm || hrPerm.role === 'admin' || hrPerm.role === 'editor';

  // Navigation state (URL-driven, falls back to user's preferred default view)
  const hrDefaultView = useHrSettingsStore((s) => s.defaultView);
  // Portal users (viewer role) land on their own profile — a safe
  // read-only view. The Leave hub currently has unresolved viewer-
  // permission bugs (see audit) so we can't default to it yet.
  const portalDefault = 'my-profile';
  const [searchParams, setSearchParams] = useSearchParams();
  // When the permission is still loading, don't commit to a default view
  // yet — otherwise admin default loads, the redirect effect fires, and
  // the user sees a visible bounce. If no ?view= is in the URL, hold
  // activeNav as an empty string until perm arrives.
  const urlView = searchParams.get('view');
  const activeNav = (urlView || (hrPermPending ? '' : (isPortalUser ? portalDefault : hrDefaultView))) as NavSection;
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

  const { data: pendingApprovalsData } = usePendingApprovals();
  const pendingApprovalCount = pendingApprovalsData?.length ?? 0;

  const { data: pendingExpenseCountData } = usePendingExpenseCount();
  const pendingExpenseCount = (pendingExpenseCountData as any)?.count || 0;

  // Portal-only: counts of the caller's own pending items (shown as sidebar
  // badges on the Leave / Expenses items in the portal sidebar).
  const { data: portalLeaveData } = useLeaveApplications();
  const { data: portalExpenseData } = useMyExpenses();
  const portalPendingLeaveCount = isPortalUser
    ? (portalLeaveData ?? []).filter((l: any) => l.status === 'pending').length
    : 0;
  const portalPendingExpenseCount = isPortalUser
    ? (portalExpenseData ?? []).filter((e: any) => e.status === 'submitted').length
    : 0;

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

  const selectedEmployee = selectedEmployeeId ? allEmployees.find((e) => e.id === selectedEmployeeId) : null;

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

  // Portal users can only access portal views — redirect if they try admin views via URL.
  // Don't fire during permission loading, otherwise the user sees a
  // visible bounce when the role resolves.
  useEffect(() => {
    if (hrPermPending) return;
    if (isPortalUser && !PORTAL_VIEWS.has(activeNav)) {
      setActiveNav('my-profile');
    }
  }, [hrPermPending, isPortalUser, activeNav, setActiveNav]);

  const sectionTitle = useMemo(() => {
    if (activeNav === 'dashboard') return t('hr.sidebar.dashboard');
    if (activeNav === 'employees' || activeNav === 'employee-detail') return t('hr.sidebar.allEmployees');
    if (activeNav === 'departments') return t('hr.sidebar.departments');
    if (activeNav === 'org-chart') return t('hr.sidebar.orgChart');
    if (activeNav === 'time-off') return t('hr.sidebar.timeOff');
    if (activeNav === 'attendance') return t('hr.sidebar.attendance');
    if (activeNav === 'my-profile') return t('hr.sidebar.myProfile');
    if (activeNav === 'leave') return t('hr.sidebar.leaveSection');
    if (activeNav === 'expenses') return t('hr.sidebar.expensesSection', 'Expenses');
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

  const showAddButton = canCreate && (activeNav === 'employees' || activeNav === 'departments' || activeNav === 'time-off');

  // Resolve the current user's employee record for the my-profile view.
  // This runs on every render when activeNav === 'my-profile' and feeds
  // the EmployeeDetailPage render block below.
  const myEmployee =
    activeNav === 'my-profile'
      ? allEmployees.find(
          (e) => e.email?.toLowerCase() === authAccount?.email?.toLowerCase(),
        )
      : undefined;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <AppSidebar
        storageKey="atlas_hr_sidebar"
        title={t('hr.title')}
        footer={!hrPermPending && !isPortalUser ? (
          <SidebarItem
            label={t('hr.sidebar.settings')}
            icon={<Settings2 size={14} />}
            iconColor="#6b7280"
            onClick={() => openSettings('hr')}
          />
        ) : undefined}
      >
        {hrPermPending ? (
          /* Permission still loading — render an empty sidebar shell so we
             don't flash the admin view and then collapse to portal (or
             vice-versa) once the real role resolves. */
          null
        ) : isPortalUser ? (
          /* ─── Portal sidebar (employees / viewers) ──────────── */
          <SidebarSection>
            <SidebarItem
              label={t('hr.sidebar.myProfile')}
              icon={<User size={14} />}
              iconColor="#14b8a6"
              isActive={activeNav === 'my-profile'}
              onClick={() => setActiveNav('my-profile')}
            />
            <SidebarItem
              label={t('hr.sidebar.leaveSection')}
              icon={<CalendarDays size={14} />}
              iconColor="#f59e0b"
              isActive={activeNav === 'leave'}
              count={portalPendingLeaveCount > 0 ? portalPendingLeaveCount : undefined}
              onClick={() => setActiveNav('leave')}
            />
            <SidebarItem
              label={t('hr.sidebar.expensesSection', 'Expenses')}
              icon={<Receipt size={15} />}
              iconColor="#f97316"
              isActive={activeNav === 'expenses'}
              count={portalPendingExpenseCount > 0 ? portalPendingExpenseCount : undefined}
              onClick={() => setActiveNav('expenses')}
            />
          </SidebarSection>
        ) : (
          /* ─── Admin sidebar (full access) ───────────────────── */
          <>
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
                isActive={activeNav === 'employees' || activeNav === 'employee-detail'}
                count={counts.totalEmployees}
                onClick={() => { setActiveNav('employees'); setSelectedEmployeeId(null); }}
              />
              <SidebarItem
                label={t('hr.sidebar.departments')}
                icon={<Building2 size={14} />}
                iconColor="#06b6d4"
                isActive={activeNav === 'departments'}
                count={counts.departments}
                onClick={() => { setActiveNav('departments'); setSelectedEmployeeId(null); }}
              />
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

            <SidebarSection>
              <SidebarItem
                label={t('hr.sidebar.leaveSection')}
                icon={<CalendarDays size={14} />}
                iconColor="#f59e0b"
                isActive={activeNav === 'leave'}
                count={pendingApprovalCount > 0 ? pendingApprovalCount : undefined}
                onClick={() => { setActiveNav('leave'); setSelectedEmployeeId(null); }}
              />
              <SidebarItem
                label={t('hr.sidebar.expensesSection', 'Expenses')}
                icon={<Receipt size={15} />}
                iconColor="#f97316"
                isActive={activeNav === 'expenses'}
                count={pendingExpenseCount > 0 ? pendingExpenseCount : undefined}
                onClick={() => { setActiveNav('expenses'); setSelectedEmployeeId(null); }}
              />
            </SidebarSection>
          </>
        )}
      </AppSidebar>

      {/* Main content */}
      {activeNav !== 'employee-detail' && activeNav !== 'my-profile' && <ContentArea
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
          <OrgChartView departments={departments} employees={allEmployees} onSelectEmployee={(id) => { setSearchParams({ view: 'employee-detail', employee: id }, { replace: true }); }} />
        )}

        {(activeNav === 'employees' || activeNav.startsWith('dept:')) && (
          <EmployeesListView
            employees={employees}
            departments={departments}
            selectedId={selectedEmployeeId}
            onSelect={(id) => setSearchParams({ view: 'employee-detail', employee: id }, { replace: true })}
            searchQuery={searchQuery}
            onAdd={handleAdd}
          />
        )}

        {activeNav === 'departments' && (
          <DepartmentsView departments={departments} employees={allEmployees} onEdit={setEditingDepartment} onDelete={handleDeleteDepartment} onSelectDepartment={(deptId) => setActiveNav(`dept:${deptId}`)} />
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
        {activeNav === 'leave' && <LeaveTabs employees={allEmployees} />}
        {activeNav === 'expenses' && <ExpensesTabs searchQuery={searchQuery} />}
      </ContentArea>}

      {/* Full-page employee detail (rendered outside ContentArea to avoid double header) */}
      {activeNav === 'employee-detail' && searchParams.get('employee') && (
        <EmployeeDetailPage
          employeeId={searchParams.get('employee')!}
          employees={allEmployees}
          departments={departments}
          onBack={() => setActiveNav('employees')}
          onNavigate={(id) => setSearchParams({ view: 'employee-detail', employee: id }, { replace: true })}
        />
      )}

      {/* Full-page my-profile — rendered next to the sidebar (not inside
          ContentArea) so there's no double header and the user still has
          the HR sidebar for navigation. EmployeeDetailPage supplies its
          own back button. */}
      {activeNav === 'my-profile' && myEmployee && (
        <EmployeeDetailPage
          employeeId={myEmployee.id}
          // Single-element array disables prev/next buttons for the
          // self-view ("view my own profile" isn't a list context).
          employees={[myEmployee]}
          departments={departments}
          onBack={() => setActiveNav(hrDefaultView as NavSection)}
          onNavigate={() => {}}
        />
      )}
      {activeNav === 'my-profile' && !myEmployee && (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-tertiary)',
            fontFamily: 'var(--font-family)',
          }}
        >
          {t('hr.sidebar.noProfile')}
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
