import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';

// ─── Inline Types ──────────────────────────────────────────────────

export interface HrEmployee {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  departmentId: string | null;
  status: 'active' | 'on-leave' | 'terminated';
  startDate: string;
  avatarUrl: string | null;
  tags: string[];
  notes: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  emergencyContactRelation: string | null;
  employmentType: string;
  managerId: string | null;
  jobTitle: string | null;
  workLocation: string | null;
  salary: number | null;
  salaryCurrency: string;
  salaryPeriod: string;
  departmentName?: string | null;
  departmentColor?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HrDepartment {
  id: string;
  name: string;
  description: string | null;
  color: string;
  headEmployeeId: string | null;
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface HrTimeOff {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
  status: 'pending' | 'approved' | 'rejected';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HrCounts {
  totalEmployees: number;
  activeEmployees: number;
  onLeaveEmployees: number;
  terminatedEmployees: number;
  pendingTimeOff: number;
  departments: number;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveType: string;
  year: number;
  allocated: number;
  used: number;
  carried: number;
}

export interface OnboardingTask {
  id: string;
  employeeId: string;
  title: string;
  description: string | null;
  category: string;
  dueDate: string | null;
  completedAt: string | null;
  completedBy: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface OnboardingTemplate {
  id: string;
  name: string;
  tasks: Array<{ title: string; description?: string; category: string }>;
}

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  name: string;
  type: string;
  storagePath: string;
  mimeType: string | null;
  size: number | null;
  expiresAt: string | null;
  notes: string | null;
  uploadedBy: string;
  createdAt: string;
}

export interface HrDashboardData {
  totalHeadcount: number;
  statusCounts: Record<string, number>;
  departmentCounts: { name: string; color: string; count: number }[];
  typeCounts: Record<string, number>;
  upcomingBirthdays: { id: string; name: string; dateOfBirth: string; avatarUrl: string | null }[];
  pendingRequests: number;
  approvedDaysThisMonth: number;
  recentHires: { id: string; name: string; startDate: string; role: string; avatarUrl: string | null }[];
  tenure: Record<string, number>;
}

// ─── Employee Queries ──────────────────────────────────────────────

export function useEmployeeList(
  filters?: { status?: string; departmentId?: string; includeArchived?: boolean },
  options?: { enabled?: boolean },
) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: queryKeys.hr.employees.list(filterKey),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.departmentId) params.set('departmentId', filters.departmentId);
      if (filters?.includeArchived) params.set('includeArchived', 'true');
      const qs = params.toString();
      const { data } = await api.get(`/hr${qs ? `?${qs}` : ''}`);
      return data.data as { employees: HrEmployee[] };
    },
    staleTime: 15_000,
    enabled: options?.enabled,
  });
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.hr.employees.detail(id!),
    queryFn: async () => {
      const { data } = await api.get(`/hr/${id}`);
      return data.data as HrEmployee;
    },
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useEmployeeCounts(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.hr.employees.counts,
    queryFn: async () => {
      const { data } = await api.get('/hr/counts');
      return data.data as HrCounts;
    },
    staleTime: 15_000,
    enabled: options?.enabled,
  });
}

// ─── Employee Mutations ────────────────────────────────────────────

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<HrEmployee, 'id' | 'createdAt' | 'updatedAt'>) => {
      const { data } = await api.post('/hr', input);
      return data.data as HrEmployee;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hr.all });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<HrEmployee> & { id: string }) => {
      const { data } = await api.patch(`/hr/${id}`, input);
      return data.data as HrEmployee;
    },
    onSuccess: (employee) => {
      queryClient.setQueryData(queryKeys.hr.employees.detail(employee.id), employee);
      queryClient.invalidateQueries({ queryKey: queryKeys.hr.all });
    },
  });
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hr.all });
    },
  });
}

// ─── Department Queries & Mutations ────────────────────────────────

export function useDepartmentList(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.hr.departments.list,
    queryFn: async () => {
      const { data } = await api.get('/hr/departments/list');
      return data.data as { departments: HrDepartment[] };
    },
    staleTime: 30_000,
    enabled: options?.enabled,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<HrDepartment, 'id' | 'employeeCount' | 'createdAt' | 'updatedAt'>) => {
      const { data } = await api.post('/hr/departments', input);
      return data.data as HrDepartment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hr.all });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<HrDepartment> & { id: string }) => {
      const { data } = await api.patch(`/hr/departments/${id}`, input);
      return data.data as HrDepartment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hr.all });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/departments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hr.all });
    },
  });
}

// ─── Time Off Queries & Mutations ──────────────────────────────────

export function useTimeOffList(
  filters?: { employeeId?: string; status?: string; type?: string },
  options?: { enabled?: boolean },
) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: queryKeys.hr.timeOff.list(filterKey),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.employeeId) params.set('employeeId', filters.employeeId);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.type) params.set('type', filters.type);
      const qs = params.toString();
      const { data } = await api.get(`/hr/time-off/list${qs ? `?${qs}` : ''}`);
      return data.data as { timeOffRequests: HrTimeOff[] };
    },
    staleTime: 15_000,
    enabled: options?.enabled,
  });
}

export function useCreateTimeOff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Omit<HrTimeOff, 'id' | 'employeeName' | 'createdAt' | 'updatedAt'>) => {
      const { data } = await api.post('/hr/time-off', input);
      return data.data as HrTimeOff;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hr.all });
    },
  });
}

export function useUpdateTimeOff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<HrTimeOff> & { id: string }) => {
      const { data } = await api.patch(`/hr/time-off/${id}`, input);
      return data.data as HrTimeOff;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hr.all });
    },
  });
}

export function useDeleteTimeOff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/time-off/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hr.all });
    },
  });
}

// ─── Dashboard ─────────────────────────────────────────────────────

export function useHrDashboard(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.hr.dashboard,
    queryFn: async () => {
      const { data } = await api.get('/hr/dashboard');
      return data.data as HrDashboardData;
    },
    staleTime: 30_000,
    enabled: options?.enabled,
  });
}

// ─── Leave Balances ────────────────────────────────────────────────

export function useLeaveBalances(employeeId: string | undefined, year?: number) {
  return useQuery({
    queryKey: queryKeys.hr.leaveBalances(employeeId!),
    queryFn: async () => {
      const params = year ? `?year=${year}` : '';
      const { data } = await api.get(`/hr/${employeeId}/leave-balances${params}`);
      return data.data as LeaveBalance[];
    },
    enabled: !!employeeId,
    staleTime: 15_000,
  });
}

export function useAllocateLeave() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, ...input }: { employeeId: string; leaveType: string; year: number; days: number }) => {
      const { data } = await api.post(`/hr/${employeeId}/leave-balances`, input);
      return data.data as LeaveBalance;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hr.all });
    },
  });
}

// ─── Onboarding ────────────────────────────────────────────────────

export function useOnboardingTasks(employeeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.hr.onboarding(employeeId!),
    queryFn: async () => {
      const { data } = await api.get(`/hr/${employeeId}/onboarding`);
      return data.data as OnboardingTask[];
    },
    enabled: !!employeeId,
    staleTime: 15_000,
  });
}

export function useCreateOnboardingTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, ...input }: { employeeId: string; title: string; description?: string; category?: string; dueDate?: string }) => {
      const { data } = await api.post(`/hr/${employeeId}/onboarding`, input);
      return data.data as OnboardingTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hr.all });
    },
  });
}

export function useUpdateOnboardingTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, ...input }: { taskId: string; completed?: boolean; title?: string; description?: string; isArchived?: boolean }) => {
      const { data } = await api.patch(`/hr/onboarding/${taskId}`, input);
      return data.data as OnboardingTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hr.all });
    },
  });
}

export function useDeleteOnboardingTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      await api.delete(`/hr/onboarding/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hr.all });
    },
  });
}

export function useApplyOnboardingTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, templateId }: { employeeId: string; templateId: string }) => {
      const { data } = await api.post(`/hr/${employeeId}/onboarding/from-template`, { templateId });
      return data.data as OnboardingTask[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hr.all });
    },
  });
}

export function useOnboardingTemplates() {
  return useQuery({
    queryKey: queryKeys.hr.onboardingTemplates,
    queryFn: async () => {
      const { data } = await api.get('/hr/onboarding-templates');
      return data.data as OnboardingTemplate[];
    },
    staleTime: 60_000,
  });
}

// ─── Employee Documents ────────────────────────────────────────────

export function useEmployeeDocuments(employeeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.hr.documents(employeeId!),
    queryFn: async () => {
      const { data } = await api.get(`/hr/${employeeId}/documents`);
      return data.data as EmployeeDocument[];
    },
    enabled: !!employeeId,
    staleTime: 15_000,
  });
}

export function useUploadEmployeeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, file, type, expiresAt, notes }: {
      employeeId: string; file: File; type?: string; expiresAt?: string; notes?: string;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (type) formData.append('type', type);
      if (expiresAt) formData.append('expiresAt', expiresAt);
      if (notes) formData.append('notes', notes);

      const { data } = await api.post(`/hr/${employeeId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data as EmployeeDocument;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hr.all });
    },
  });
}

export function useDeleteEmployeeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (docId: string) => {
      await api.delete(`/hr/documents/${docId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hr.all });
    },
  });
}

// ─── Leave Types ──────────────────────────────────────────────────

export interface HrLeaveType {
  id: string;
  accountId: string;
  name: string;
  slug: string;
  color: string;
  defaultDaysPerYear: number;
  maxCarryForward: number;
  requiresApproval: boolean;
  isPaid: boolean;
  isActive: boolean;
  sortOrder: number;
}

export function useLeaveTypes(includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.hr.leaveTypes,
    queryFn: async () => {
      const params = includeInactive ? '?includeInactive=true' : '';
      const { data } = await api.get(`/hr/leave-types${params}`);
      return data.data as HrLeaveType[];
    },
    staleTime: 30_000,
  });
}

export function useCreateLeaveType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<HrLeaveType>) => {
      const { data } = await api.post('/hr/leave-types', input);
      return data.data as HrLeaveType;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

export function useUpdateLeaveType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<HrLeaveType> & { id: string }) => {
      const { data } = await api.patch(`/hr/leave-types/${id}`, input);
      return data.data as HrLeaveType;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

export function useDeleteLeaveType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/hr/leave-types/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

export function useSeedLeaveTypes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/hr/leave-types/seed');
      return data.data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

// ─── Leave Policies ───────────────────────────────────────────────

export interface HrLeavePolicy {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  allocations: Array<{ leaveTypeId: string; daysPerYear: number }>;
}

export function useLeavePolicies() {
  return useQuery({
    queryKey: queryKeys.hr.leavePolicies,
    queryFn: async () => {
      const { data } = await api.get('/hr/leave-policies');
      return data.data as HrLeavePolicy[];
    },
    staleTime: 30_000,
  });
}

export function useCreateLeavePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<HrLeavePolicy>) => {
      const { data } = await api.post('/hr/leave-policies', input);
      return data.data as HrLeavePolicy;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

export function useUpdateLeavePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<HrLeavePolicy> & { id: string }) => {
      const { data } = await api.patch(`/hr/leave-policies/${id}`, input);
      return data.data as HrLeavePolicy;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

export function useResyncPolicyBalances() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (policyId: string) => {
      const { data } = await api.post(`/hr/leave-policies/${policyId}/resync`);
      return data.data as { updated: number };
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

export function useDeleteLeavePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/leave-policies/${id}`);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

export function useSeedLeavePolicies() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/hr/leave-policies/seed');
      return data.data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

export function useAssignPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, policyId, effectiveFrom }: { employeeId: string; policyId: string; effectiveFrom?: string }) => {
      const { data } = await api.post(`/hr/${employeeId}/assign-policy`, { policyId, effectiveFrom });
      return data.data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

export function useEmployeePolicy(employeeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.hr.policyAssignment(employeeId!),
    queryFn: async () => {
      const { data } = await api.get(`/hr/${employeeId}/policy`);
      return data.data as { policyId: string; policyName: string; effectiveFrom: string; allocations: Array<{ leaveTypeId: string; daysPerYear: number }> } | null;
    },
    enabled: !!employeeId,
    staleTime: 30_000,
  });
}

// ─── Holiday Calendars ────────────────────────────────────────────

export interface HrHolidayCalendar {
  id: string;
  name: string;
  year: number;
  description: string | null;
  isDefault: boolean;
}

export interface HrHoliday {
  id: string;
  calendarId: string;
  name: string;
  date: string;
  description: string | null;
  type: string;
  isRecurring: boolean;
}

export function useHolidayCalendars() {
  return useQuery({
    queryKey: queryKeys.hr.holidayCalendars,
    queryFn: async () => {
      const { data } = await api.get('/hr/holiday-calendars');
      return data.data as HrHolidayCalendar[];
    },
    staleTime: 60_000,
  });
}

export function useCreateHolidayCalendar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<HrHolidayCalendar>) => {
      const { data } = await api.post('/hr/holiday-calendars', input);
      return data.data as HrHolidayCalendar;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

export function useHolidays(calendarId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.hr.holidays(calendarId!),
    queryFn: async () => {
      const { data } = await api.get(`/hr/holiday-calendars/${calendarId}/holidays`);
      return data.data as HrHoliday[];
    },
    enabled: !!calendarId,
    staleTime: 30_000,
  });
}

export function useCreateHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<HrHoliday> & { calendarId: string }) => {
      const { data } = await api.post('/hr/holidays', input);
      return data.data as HrHoliday;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/hr/holidays/${id}`); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

export function useBulkImportHolidays() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { calendarId: string; holidays: Array<{ name: string; date: string; type: string }> }) => {
      const { data } = await api.post('/hr/holidays/bulk-import', input);
      return data.data as HrHoliday[];
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

// ─── Leave Applications ───────────────────────────────────────────

export interface HrLeaveApplication {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  halfDayDate: string | null;
  totalDays: number;
  reason: string | null;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
  approverId: string | null;
  approverComment: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  balanceBefore: number | null;
  createdAt: string;
  employeeName?: string;
  leaveTypeName?: string;
  leaveTypeColor?: string;
}

export function useLeaveApplications(filters?: { employeeId?: string; status?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: queryKeys.hr.leaveApplications(filterKey),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.employeeId) params.set('employeeId', filters.employeeId);
      if (filters?.status) params.set('status', filters.status);
      const qs = params.toString();
      const { data } = await api.get(`/hr/leave-applications${qs ? `?${qs}` : ''}`);
      return data.data as HrLeaveApplication[];
    },
    staleTime: 15_000,
  });
}

export function useCreateLeaveApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { employeeId: string; leaveTypeId: string; startDate: string; endDate: string; halfDay?: boolean; halfDayDate?: string; reason?: string }) => {
      const { data } = await api.post('/hr/leave-applications', input);
      return data.data as HrLeaveApplication;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

export function useSubmitLeaveApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/hr/leave-applications/${id}/submit`);
      return data.data as HrLeaveApplication;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

export function useApproveLeaveApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string }) => {
      const { data } = await api.post(`/hr/leave-applications/${id}/approve`, { comment });
      return data.data as HrLeaveApplication;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

export function useRejectLeaveApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, comment }: { id: string; comment?: string }) => {
      const { data } = await api.post(`/hr/leave-applications/${id}/reject`, { comment });
      return data.data as HrLeaveApplication;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

export function useCancelLeaveApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/hr/leave-applications/${id}/cancel`);
      return data.data as HrLeaveApplication;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

export function useLeaveCalendar(month: string) {
  return useQuery({
    queryKey: queryKeys.hr.leaveCalendar(month),
    queryFn: async () => {
      const { data } = await api.get(`/hr/leave-calendar?month=${month}`);
      return data.data as Array<{
        id: string; employeeId: string; startDate: string; endDate: string;
        totalDays: number; halfDay: boolean; employeeName: string;
        leaveTypeName: string; leaveTypeColor: string;
      }>;
    },
    staleTime: 30_000,
  });
}

export function usePendingApprovals() {
  return useQuery({
    queryKey: queryKeys.hr.pendingApprovals,
    queryFn: async () => {
      const { data } = await api.get('/hr/leave-applications/pending');
      return data.data as Array<{
        id: string;
        employeeId: string;
        employeeName: string;
        leaveTypeId: string;
        leaveTypeName: string;
        leaveTypeColor: string;
        startDate: string;
        endDate: string;
        totalDays: number;
        reason: string | null;
        status: string;
        createdAt: string;
      }>;
    },
    staleTime: 15_000,
  });
}

// ─── Attendance ───────────────────────────────────────────────────

export interface HrAttendanceRecord {
  id: string;
  employeeId: string;
  date: string;
  status: 'present' | 'absent' | 'half-day' | 'remote' | 'on-leave';
  checkInTime: string | null;
  checkOutTime: string | null;
  workingHours: number | null;
  notes: string | null;
  markedBy: string | null;
  employeeName?: string;
}

export function useAttendanceList(filters?: { date?: string; employeeId?: string; startDate?: string; endDate?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: queryKeys.hr.attendance(filterKey),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.date) params.set('date', filters.date);
      if (filters?.employeeId) params.set('employeeId', filters.employeeId);
      if (filters?.startDate) params.set('startDate', filters.startDate);
      if (filters?.endDate) params.set('endDate', filters.endDate);
      const qs = params.toString();
      const { data } = await api.get(`/hr/attendance${qs ? `?${qs}` : ''}`);
      return data.data as HrAttendanceRecord[];
    },
    staleTime: 10_000,
  });
}

export function useMarkAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { employeeId: string; date: string; status: string; checkInTime?: string; checkOutTime?: string; notes?: string }) => {
      const { data } = await api.post('/hr/attendance', input);
      return data.data as HrAttendanceRecord;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

export function useBulkMarkAttendance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { employeeIds: string[]; date: string; status: string }) => {
      const { data } = await api.post('/hr/attendance/bulk', input);
      return data.data as HrAttendanceRecord[];
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

export function useAttendanceToday() {
  return useQuery({
    queryKey: queryKeys.hr.attendanceToday,
    queryFn: async () => {
      const { data } = await api.get('/hr/attendance/today');
      return data.data as Record<string, number>;
    },
    staleTime: 15_000,
  });
}

export function useAttendanceReport(month: string) {
  return useQuery({
    queryKey: queryKeys.hr.attendanceReport(month),
    queryFn: async () => {
      const { data } = await api.get(`/hr/attendance/report?month=${month}`);
      return data.data as Array<{ employeeId: string; date: string; status: string; workingHours: number | null; employeeName: string }>;
    },
    staleTime: 30_000,
  });
}

// ─── Lifecycle Events ─────────────────────────────────────────────

export interface HrLifecycleEvent {
  id: string;
  employeeId: string;
  eventType: string;
  eventDate: string;
  effectiveDate: string | null;
  fromValue: string | null;
  toValue: string | null;
  fromDepartmentId: string | null;
  toDepartmentId: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
}

export function useLifecycleTimeline(employeeId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.hr.lifecycle(employeeId!),
    queryFn: async () => {
      const { data } = await api.get(`/hr/${employeeId}/lifecycle`);
      return data.data as HrLifecycleEvent[];
    },
    enabled: !!employeeId,
    staleTime: 15_000,
  });
}

export function useCreateLifecycleEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ employeeId, ...input }: { employeeId: string; eventType: string; eventDate: string; effectiveDate?: string; fromValue?: string; toValue?: string; fromDepartmentId?: string; toDepartmentId?: string; notes?: string }) => {
      const { data } = await api.post(`/hr/${employeeId}/lifecycle`, input);
      return data.data as HrLifecycleEvent;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: queryKeys.hr.all }); },
  });
}

// ─── Seed ──────────────────────────────────────────────────────────

export function useSeedHrData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/hr/seed');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.hr.all });
    },
  });
}
