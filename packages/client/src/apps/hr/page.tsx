import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Users, Building2, CalendarDays, Plus, Search, Settings2, X,
  User, ChevronDown,
  LayoutDashboard, GitBranch,
  ClipboardList, Calendar, Shield,
  UserCheck,
} from 'lucide-react';
import {
  useEmployeeList, useEmployeeCounts,
  useDepartmentList,
  useTimeOffList, useUpdateTimeOff, useDeleteTimeOff,
  useSeedHrData, useDeleteDepartment,
  type HrEmployee, type HrDepartment,
} from './hooks';
import { AppSidebar, SidebarSection, SidebarItem } from '../../components/layout/app-sidebar';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { IconButton } from '../../components/ui/icon-button';
import { StatusDot } from '../../components/ui/status-dot';
import { ContentArea } from '../../components/ui/content-area';
import { useUIStore } from '../../stores/ui-store';
import { useAuthStore } from '../../stores/auth-store';
import { useMyAppPermission } from '../../hooks/use-app-permissions';
import { useHrSettingsStore } from './settings-store';
import { OrgChartView } from './components/org-chart';
import { EmployeeDetailPanel } from './components/employee-detail-panel';
import { CreateEmployeeModal } from './components/modals/create-employee-modal';
import { CreateDepartmentModal } from './components/modals/create-department-modal';
import { RequestTimeOffModal } from './components/modals/request-time-off-modal';
import { EditDepartmentModal } from './components/modals/edit-department-modal';
import {
  DashboardView,
  EmployeesListView,
  DepartmentsView,
  TimeOffView,
  LeaveTypesView,
  LeavePoliciesView,
  HolidaysView,
  MyLeaveView,
  TeamCalendarView,
  AttendanceView,
} from './components/views';
import '../../styles/hr.css';

// ─── Navigation ────────────────────────────────────────────────────

type NavSection = 'dashboard' | 'employees' | 'departments' | 'org-chart' | 'time-off'
  | 'attendance' | 'my-leave' | 'my-profile' | 'team-calendar' | 'leave-types' | 'holidays' | 'policies'
  | `dept:${string}`;

const PORTAL_VIEWS = new Set<string>(['my-profile', 'my-leave', 'team-calendar', 'holidays']);

// ─── Main HR Page ──────────────────────────────────────────────────

export function HrPage() {
  const { t } = useTranslation();
  const { openSettings } = useUIStore();

  // Auth
  const authAccount = useAuthStore((s) => s.account);

  // Permission gating
  const { data: hrPerm } = useMyAppPermission('hr');
  const isPortalUser = hrPerm?.role === 'viewer';
  const canCreate = !hrPerm || hrPerm.role === 'admin' || hrPerm.role === 'editor';

  // Navigation state (URL-driven, falls back to user's preferred default view)
  const hrDefaultView = useHrSettingsStore((s) => s.defaultView);
  const portalDefault = 'my-profile';
  const [searchParams, setSearchParams] = useSearchParams();
  const activeNav = (searchParams.get('view') || (isPortalUser ? portalDefault : hrDefaultView)) as NavSection;
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
  const [showAllDepts, setShowAllDepts] = useState(false);
  const MAX_VISIBLE_DEPTS = 5;

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

  // Portal users can only access portal views — redirect if they try admin views via URL
  useEffect(() => {
    if (isPortalUser && !PORTAL_VIEWS.has(activeNav)) {
      setActiveNav('my-profile');
    }
  }, [isPortalUser, activeNav, setActiveNav]);

  const sectionTitle = useMemo(() => {
    if (activeNav === 'dashboard') return t('hr.sidebar.dashboard');
    if (activeNav === 'employees') return t('hr.sidebar.allEmployees');
    if (activeNav === 'departments') return t('hr.sidebar.departments');
    if (activeNav === 'org-chart') return t('hr.sidebar.orgChart');
    if (activeNav === 'time-off') return t('hr.sidebar.timeOff');
    if (activeNav === 'attendance') return t('hr.sidebar.attendance');
    if (activeNav === 'my-profile') return t('hr.sidebar.myProfile');
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

  const showAddButton = canCreate && (activeNav === 'employees' || activeNav === 'departments' || activeNav === 'time-off' || activeNav.startsWith('dept:'));

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <AppSidebar
        storageKey="atlas_hr_sidebar"
        title={t('hr.title')}
        footer={!isPortalUser ? (
          <SidebarItem
            label={t('hr.sidebar.settings')}
            icon={<Settings2 size={14} />}
            iconColor="#6b7280"
            onClick={() => openSettings('hr')}
          />
        ) : undefined}
      >
        {isPortalUser ? (
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
              label={t('hr.sidebar.myLeave')}
              icon={<CalendarDays size={14} />}
              iconColor="#f59e0b"
              isActive={activeNav === 'my-leave'}
              onClick={() => setActiveNav('my-leave')}
            />
            <SidebarItem
              label={t('hr.sidebar.teamCalendar')}
              icon={<Calendar size={14} />}
              iconColor="#f59e0b"
              isActive={activeNav === 'team-calendar'}
              onClick={() => setActiveNav('team-calendar')}
            />
            <SidebarItem
              label={t('hr.sidebar.holidays')}
              icon={<Calendar size={14} />}
              iconColor="#ef4444"
              isActive={activeNav === 'holidays'}
              onClick={() => setActiveNav('holidays')}
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
              {(showAllDepts || departments.length <= MAX_VISIBLE_DEPTS + 1
                ? departments
                : departments.slice(0, MAX_VISIBLE_DEPTS)
              ).map((dept) => (
                <SidebarItem
                  key={dept.id}
                  label={dept.name}
                  icon={<StatusDot color={dept.color} size={10} />}
                  isActive={activeNav === `dept:${dept.id}`}
                  count={deptEmployeeCounts[dept.id] ?? 0}
                  onClick={() => { setActiveNav(`dept:${dept.id}`); setSelectedEmployeeId(null); }}
                />
              ))}
              {!showAllDepts && departments.length > MAX_VISIBLE_DEPTS + 1 && (
                <SidebarItem
                  label={`${departments.length - MAX_VISIBLE_DEPTS} more`}
                  icon={<ChevronDown size={13} />}
                  onClick={() => setShowAllDepts(true)}
                  style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}
                />
              )}
              {showAllDepts && departments.length > MAX_VISIBLE_DEPTS + 1 && (
                <SidebarItem
                  label={t('common.showLess', 'Show less')}
                  icon={<ChevronDown size={13} style={{ transform: 'rotate(180deg)' }} />}
                  onClick={() => setShowAllDepts(false)}
                  style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}
                />
              )}
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
          </>
        )}
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
          <OrgChartView departments={departments} employees={allEmployees} onSelectEmployee={(id) => { setActiveNav('employees'); setSelectedEmployeeId(id); }} />
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

        {activeNav === 'my-profile' && (() => {
          const myEmployee = allEmployees.find(e => e.email?.toLowerCase() === authAccount?.email?.toLowerCase());
          return myEmployee ? (
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              <EmployeeDetailPanel
                employee={myEmployee}
                departments={departments}
                employees={allEmployees}
                timeOffRequests={timeOffRequests}
                onClose={() => {}}
              />
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
              {t('hr.sidebar.noProfile')}
            </div>
          );
        })()}
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
