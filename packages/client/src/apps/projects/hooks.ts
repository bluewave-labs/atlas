import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';
import type { ProjectRate, CreateRateInput, UpdateRateInput } from '@atlas-platform/shared';

// ─── Inline Types ──────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  description: string | null;
  companyId: string | null;
  companyName: string | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
  color: string;
  hourlyRate: number;
  budgetHours: number | null;
  budgetAmount: number | null;
  isBillable: boolean;
  totalHours: number;
  billableHours: number;
  billedHours: number;
  totalAmount: number;
  unbilledHours: number;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  projectId: string;
  projectName: string | null;
  projectColor: string | null;
  userId: string;
  date: string;
  hours: number;
  description: string | null;
  tags: string[];
  isBillable: boolean;
  billingStatus: 'unbilled' | 'billed' | 'paid';
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EnhancedDashboard {
  hoursThisWeek: number;
  activeProjects: number;
  outstandingInvoices: number;
  totalOutstandingAmount: number;
  overdueInvoices: number;
  totalOverdueAmount: number;
  unbilledHours: number;
  revenue: {
    invoiced: number;
    paid: number;
    outstanding: number;
  };
  hoursByDay: Array<{ date: string; hours: number }>;
  recentTimeEntries: Array<{
    id: string;
    projectName: string;
    projectColor: string;
    hours: number;
    date: string;
    description: string | null;
    createdAt: string;
  }>;
  recentInvoiceActions: Array<{
    id: string;
    invoiceNumber: string;
    clientName: string | null;
    status: string;
    amount: number;
    updatedAt: string;
  }>;
}

export interface ProjectSettings {
  defaultHourlyRate: number;
  companyName: string;
  companyAddress: string;
  weekStartDay: 'monday' | 'sunday';
  defaultProjectVisibility: 'team' | 'private';
  defaultBillable: boolean;
  timeRounding: number;
}

export interface TimeReport {
  entries: Array<{
    label: string;
    hours: number;
    color: string;
  }>;
  total: number;
}

export interface RevenueReport {
  invoiced: number;
  outstanding: number;
  overdue: number;
  byClient: Array<{
    clientId: string;
    clientName: string;
    invoiced: number;
    outstanding: number;
  }>;
}

export interface ProfitabilityReport {
  projects: Array<{
    projectId: string;
    projectName: string;
    hours: number;
    cost: number;
    revenue: number;
    margin: number;
  }>;
}

export interface UtilizationReport {
  members: Array<{
    userId: string;
    userName: string;
    hoursLogged: number;
    capacity: number;
    utilization: number;
    billableRatio: number;
  }>;
}

// ─── Dashboard ────────────────────────────────────────────────────

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.projects.dashboard,
    queryFn: async () => {
      const { data } = await api.get('/projects/dashboard');
      return data.data as EnhancedDashboard;
    },
    staleTime: 15_000,
  });
}

// ─── Project Queries ──────────────────────────────────────────────

// Transform server project response to client types
function mapProject(raw: Record<string, unknown>): Project {
  return {
    id: raw.id as string,
    name: raw.name as string,
    description: (raw.description as string) ?? null,
    companyId: (raw.companyId as string) ?? (raw.clientId as string) ?? null,
    companyName: (raw.companyName as string) ?? (raw.clientName as string) ?? null,
    status: (raw.status as Project['status']) ?? 'active',
    color: (raw.color as string) ?? '#6b7280',
    hourlyRate: 0, // hourly rate is per-member in server model
    budgetHours: (raw.estimatedHours as number) ?? null,
    budgetAmount: (raw.estimatedAmount as number) ?? null,
    isBillable: (raw.billable as boolean) ?? true,
    totalHours: typeof raw.totalTrackedMinutes === 'number' ? raw.totalTrackedMinutes / 60 : 0,
    billableHours: typeof raw.billableMinutes === 'number' ? raw.billableMinutes / 60 : 0,
    billedHours: typeof raw.billedMinutes === 'number' ? raw.billedMinutes / 60 : 0,
    totalAmount: (raw.totalBilledAmount as number) ?? 0,
    unbilledHours: typeof raw.unbilledMinutes === 'number' ? raw.unbilledMinutes / 60 : 0,
    isArchived: (raw.isArchived as boolean) ?? false,
    sortOrder: (raw.sortOrder as number) ?? 0,
    createdAt: (raw.createdAt as string) ?? '',
    updatedAt: (raw.updatedAt as string) ?? '',
  };
}

export function useProjects(filters?: { search?: string; status?: string; companyId?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: [...queryKeys.projects.projects.all, filterKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.set('search', filters.search);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.companyId) params.set('companyId', filters.companyId);
      const qs = params.toString();
      const { data } = await api.get(`/projects/projects/list${qs ? `?${qs}` : ''}`);
      const raw = data.data as { projects: Record<string, unknown>[] };
      return { projects: raw.projects.map(mapProject) };
    },
    staleTime: 15_000,
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projects.projects.detail(id!),
    queryFn: async () => {
      const { data } = await api.get(`/projects/projects/${id}`);
      return mapProject(data.data as Record<string, unknown>);
    },
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string | null;
      companyId?: string | null;
      status?: string;
      color?: string;
      hourlyRate?: number;
      budgetHours?: number | null;
      budgetAmount?: number | null;
      isBillable?: boolean;
    }) => {
      const { data } = await api.post('/projects/projects', {
        name: input.name,
        description: input.description,
        companyId: input.companyId,
        status: input.status,
        color: input.color,
        billable: input.isBillable,
        estimatedHours: input.budgetHours,
        estimatedAmount: input.budgetAmount,
      });
      return data.data as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<{
      name: string;
      description: string | null;
      companyId: string | null;
      status: string;
      color: string;
      hourlyRate: number;
      budgetHours: number | null;
      budgetAmount: number | null;
      isBillable: boolean;
      isArchived: boolean;
    }>) => {
      const payload: Record<string, unknown> = {};
      if (input.name !== undefined) payload.name = input.name;
      if (input.description !== undefined) payload.description = input.description;
      if (input.companyId !== undefined) payload.companyId = input.companyId;
      if (input.status !== undefined) payload.status = input.status;
      if (input.color !== undefined) payload.color = input.color;
      if (input.isBillable !== undefined) payload.billable = input.isBillable;
      if (input.budgetHours !== undefined) payload.estimatedHours = input.budgetHours;
      if (input.budgetAmount !== undefined) payload.estimatedAmount = input.budgetAmount;
      if (input.isArchived !== undefined) payload.isArchived = input.isArchived;
      const { data } = await api.patch(`/projects/projects/${id}`, payload);
      return data.data as Project;
    },
    onSuccess: (project) => {
      queryClient.setQueryData(queryKeys.projects.projects.detail(project.id), project);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/projects/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

// ─── Project Members ─────────────────────────────────────────────

export interface ProjectMember {
  id: string;
  userId: string;
  projectId: string;
  hourlyRate: number | null;
  userName?: string;
  userEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: ['projects', 'members', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/projects/projects/${projectId}/members`);
      const result = data.data;
      return (result?.members ?? result) as ProjectMember[];
    },
    enabled: !!projectId,
    staleTime: 10_000,
  });
}

// ─── Time Entry Queries ───────────────────────────────────────────

// Transform server time entry response (durationMinutes, workDate) to client types (hours, date)
function mapTimeEntry(raw: Record<string, unknown>): TimeEntry {
  return {
    id: raw.id as string,
    projectId: raw.projectId as string,
    projectName: (raw.projectName as string) ?? null,
    projectColor: (raw.projectColor as string) ?? null,
    userId: raw.userId as string,
    date: (raw.workDate as string) ?? (raw.date as string) ?? '',
    hours: typeof raw.durationMinutes === 'number' ? raw.durationMinutes / 60 : (raw.hours as number) ?? 0,
    description: (raw.notes as string) ?? (raw.description as string) ?? null,
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : [],
    isBillable: (raw.billable as boolean) ?? true,
    billingStatus: (raw.billingStatus as TimeEntry['billingStatus']) ?? 'unbilled',
    isArchived: (raw.isArchived as boolean) ?? false,
    createdAt: (raw.createdAt as string) ?? '',
    updatedAt: (raw.updatedAt as string) ?? '',
  };
}

export function useTimeEntriesWeekly(weekStart: string) {
  return useQuery({
    queryKey: queryKeys.projects.timeEntries.weekly(weekStart),
    queryFn: async () => {
      const { data } = await api.get(`/projects/time-entries/weekly?weekStart=${weekStart}`);
      const raw = data.data as { entries: Record<string, unknown>[] };
      return { entries: raw.entries.map(mapTimeEntry) };
    },
    staleTime: 10_000,
  });
}

export function useTimeEntries(filters?: { projectId?: string; startDate?: string; endDate?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: queryKeys.projects.timeEntries.list(filterKey),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.projectId) params.set('projectId', filters.projectId);
      if (filters?.startDate) params.set('startDate', filters.startDate);
      if (filters?.endDate) params.set('endDate', filters.endDate);
      const qs = params.toString();
      const { data } = await api.get(`/projects/time-entries/list${qs ? `?${qs}` : ''}`);
      const raw = data.data as { entries: Record<string, unknown>[] };
      return { entries: raw.entries.map(mapTimeEntry) };
    },
    staleTime: 10_000,
  });
}

export function useCreateTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      projectId: string;
      date: string;
      hours: number;
      description?: string | null;
      tags?: string[];
      isBillable?: boolean;
    }) => {
      const { data } = await api.post('/projects/time-entries', {
        projectId: input.projectId,
        workDate: input.date,
        durationMinutes: Math.round(input.hours * 60),
        notes: input.description,
        tags: input.tags,
        billable: input.isBillable,
      });
      return data.data as TimeEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useUpdateTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<{
      projectId: string;
      date: string;
      hours: number;
      description: string | null;
      tags: string[];
      isBillable: boolean;
    }>) => {
      const payload: Record<string, unknown> = {};
      if (input.projectId !== undefined) payload.projectId = input.projectId;
      if (input.date !== undefined) payload.workDate = input.date;
      if (input.hours !== undefined) payload.durationMinutes = Math.round(input.hours * 60);
      if (input.description !== undefined) payload.notes = input.description;
      if (input.tags !== undefined) payload.tags = input.tags;
      if (input.isBillable !== undefined) payload.billable = input.isBillable;
      const { data } = await api.patch(`/projects/time-entries/${id}`, payload);
      return data.data as TimeEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/projects/time-entries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useBulkSaveTimeEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entries: Array<{ projectId: string; date: string; hours: number; description?: string | null; isBillable?: boolean }>) => {
      const { data } = await api.post('/projects/time-entries/bulk', { entries });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useCopyLastWeek() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (weekStart: string) => {
      const { data } = await api.post('/projects/time-entries/copy-last-week', { weekStart });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

// ─── Time Billing (populate invoices from time entries) ──────────

export interface TimeEntryLineItemPreview {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  projectId: string;
  projectName: string;
  workDate: string;
}

export function usePreviewTimeEntries() {
  return useMutation({
    mutationFn: async (input: {
      companyId: string;
      startDate: string;
      endDate: string;
      timeEntryIds?: string[];
    }) => {
      const { data } = await api.post('/projects/time-billing/preview', input);
      return (data.data?.lineItems ?? []) as TimeEntryLineItemPreview[];
    },
  });
}

export function usePopulateFromTimeEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      invoiceId: string;
      companyId: string;
      startDate: string;
      endDate: string;
      timeEntryIds?: string[];
    }) => {
      const { data } = await api.post('/projects/time-billing/populate', input);
      return data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(variables.invoiceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

// ─── Report Queries ───────────────────────────────────────────────

export function useTimeReport(filters?: { startDate?: string; endDate?: string; groupBy?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: queryKeys.projects.reports.time(filterKey),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.set('startDate', filters.startDate);
      if (filters?.endDate) params.set('endDate', filters.endDate);
      if (filters?.groupBy) params.set('groupBy', filters.groupBy);
      const qs = params.toString();
      const { data } = await api.get(`/projects/reports/time${qs ? `?${qs}` : ''}`);
      return data.data as TimeReport;
    },
    staleTime: 30_000,
  });
}

export function useRevenueReport(filters?: { startDate?: string; endDate?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: queryKeys.projects.reports.revenue(filterKey),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.set('startDate', filters.startDate);
      if (filters?.endDate) params.set('endDate', filters.endDate);
      const qs = params.toString();
      const { data } = await api.get(`/projects/reports/revenue${qs ? `?${qs}` : ''}`);
      return data.data as RevenueReport;
    },
    staleTime: 30_000,
  });
}

export function useProfitabilityReport() {
  return useQuery({
    queryKey: queryKeys.projects.reports.profitability,
    queryFn: async () => {
      const { data } = await api.get('/projects/reports/profitability');
      return data.data as ProfitabilityReport;
    },
    staleTime: 30_000,
  });
}

export function useUtilizationReport(filters?: { startDate?: string; endDate?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: queryKeys.projects.reports.utilization(filterKey),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.set('startDate', filters.startDate);
      if (filters?.endDate) params.set('endDate', filters.endDate);
      const qs = params.toString();
      const { data } = await api.get(`/projects/reports/utilization${qs ? `?${qs}` : ''}`);
      return data.data as UtilizationReport;
    },
    staleTime: 30_000,
  });
}

// ─── Rates ───────────────────────────────────────────────────────

export function useRates() {
  return useQuery({
    queryKey: queryKeys.projects.rates.all,
    queryFn: async () => {
      const { data } = await api.get('/projects/rates');
      return data.data as ProjectRate[];
    },
  });
}

export function useCreateRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRateInput) => {
      const { data } = await api.post('/projects/rates', input);
      return data.data as ProjectRate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projects.rates.all }),
  });
}

export function useUpdateRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & UpdateRateInput) => {
      const { data } = await api.patch(`/projects/rates/${id}`, input);
      return data.data as ProjectRate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projects.rates.all }),
  });
}

export function useDeleteRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/projects/rates/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projects.rates.all }),
  });
}

// ─── Settings ─────────────────────────────────────────────────────

export function useProjectSettings() {
  return useQuery({
    queryKey: queryKeys.projects.settings,
    queryFn: async () => {
      const { data } = await api.get('/projects/settings');
      return data.data as ProjectSettings;
    },
    staleTime: 60_000,
  });
}

export function useUpdateProjectSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ProjectSettings>) => {
      const { data } = await api.patch('/projects/settings', input);
      return data.data as ProjectSettings;
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.projects.settings, settings);
    },
  });
}
