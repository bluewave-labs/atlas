import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';

// ─── Inline Types ──────────────────────────────────────────────────

export interface ProjectClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  portalToken: string | null;
  isArchived: boolean;
  sortOrder: number;
  projectCount: number;
  totalBilled: number;
  outstandingAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  clientId: string | null;
  clientName: string | null;
  status: 'active' | 'paused' | 'completed' | 'archived';
  color: string;
  hourlyRate: number;
  budgetHours: number | null;
  budgetAmount: number | null;
  isBillable: boolean;
  totalHours: number;
  totalAmount: number;
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
  isBillable: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string | null;
  status: 'draft' | 'sent' | 'viewed' | 'paid' | 'overdue' | 'waived';
  issueDate: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  lineItemCount?: number;
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  discountPercent: number;
  discountAmount: number;
  total: number;
  notes: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectsDashboard {
  hoursThisWeek: number;
  activeProjects: number;
  outstandingInvoices: number;
  overdueInvoices: number;
  totalOutstandingAmount: number;
  totalOverdueAmount: number;
}

export interface EnhancedDashboard {
  hoursThisWeek: number;
  activeProjects: number;
  outstandingInvoices: number;
  totalOutstandingAmount: number;
  overdueInvoices: number;
  totalOverdueAmount: number;
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
  invoicePrefix: string;
  defaultHourlyRate: number;
  companyName: string;
  companyAddress: string;
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

export interface PortalData {
  clientName: string;
  outstandingAmount: number;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    total: number;
    status: string;
    issueDate: string;
    dueDate: string;
    lineItems: InvoiceLineItem[];
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

// ─── Client Queries ───────────────────────────────────────────────

export function useClients(filters?: { search?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: [...queryKeys.projects.clients.all, filterKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.set('search', filters.search);
      const qs = params.toString();
      const { data } = await api.get(`/projects/clients/list${qs ? `?${qs}` : ''}`);
      return data.data as { clients: ProjectClient[] };
    },
    staleTime: 15_000,
  });
}

export function useClient(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projects.clients.detail(id!),
    queryFn: async () => {
      const { data } = await api.get(`/projects/clients/${id}`);
      return data.data as ProjectClient;
    },
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; email?: string | null; phone?: string | null; address?: string | null }) => {
      const { data } = await api.post('/projects/clients', input);
      return data.data as ProjectClient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<{ name: string; email: string | null; phone: string | null; address: string | null; isArchived: boolean }>) => {
      const { data } = await api.patch(`/projects/clients/${id}`, input);
      return data.data as ProjectClient;
    },
    onSuccess: (client) => {
      queryClient.setQueryData(queryKeys.projects.clients.detail(client.id), client);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/projects/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useRegeneratePortalToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clientId: string) => {
      const { data } = await api.post(`/projects/clients/${clientId}/regenerate-token`);
      return data.data as { portalToken: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

// ─── Project Queries ──────────────────────────────────────────────

// Transform server project response to client types
function mapProject(raw: Record<string, unknown>): Project {
  return {
    id: raw.id as string,
    name: raw.name as string,
    description: (raw.description as string) ?? null,
    clientId: (raw.clientId as string) ?? null,
    clientName: (raw.clientName as string) ?? null,
    status: (raw.status as Project['status']) ?? 'active',
    color: (raw.color as string) ?? '#6b7280',
    hourlyRate: 0, // hourly rate is per-member in server model
    budgetHours: (raw.estimatedHours as number) ?? null,
    budgetAmount: (raw.estimatedAmount as number) ?? null,
    isBillable: (raw.billable as boolean) ?? true,
    totalHours: typeof raw.totalTrackedMinutes === 'number' ? raw.totalTrackedMinutes / 60 : 0,
    totalAmount: (raw.totalBilledAmount as number) ?? 0,
    isArchived: (raw.isArchived as boolean) ?? false,
    sortOrder: (raw.sortOrder as number) ?? 0,
    createdAt: (raw.createdAt as string) ?? '',
    updatedAt: (raw.updatedAt as string) ?? '',
  };
}

export function useProjects(filters?: { search?: string; status?: string; clientId?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: [...queryKeys.projects.projects.all, filterKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.set('search', filters.search);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.clientId) params.set('clientId', filters.clientId);
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
      clientId?: string | null;
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
        clientId: input.clientId,
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
      clientId: string | null;
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
      if (input.clientId !== undefined) payload.clientId = input.clientId;
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
    isBillable: (raw.billable as boolean) ?? true,
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
      isBillable?: boolean;
    }) => {
      const { data } = await api.post('/projects/time-entries', {
        projectId: input.projectId,
        workDate: input.date,
        durationMinutes: Math.round(input.hours * 60),
        notes: input.description,
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
      isBillable: boolean;
    }>) => {
      const payload: Record<string, unknown> = {};
      if (input.projectId !== undefined) payload.projectId = input.projectId;
      if (input.date !== undefined) payload.workDate = input.date;
      if (input.hours !== undefined) payload.durationMinutes = Math.round(input.hours * 60);
      if (input.description !== undefined) payload.notes = input.description;
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

// ─── Invoice Queries ──────────────────────────────────────────────

export function useInvoices(filters?: { search?: string; status?: string; clientId?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: [...queryKeys.projects.invoices.all, filterKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.set('search', filters.search);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.clientId) params.set('clientId', filters.clientId);
      const qs = params.toString();
      const { data } = await api.get(`/projects/invoices/list${qs ? `?${qs}` : ''}`);
      return data.data as { invoices: Invoice[] };
    },
    staleTime: 15_000,
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projects.invoices.detail(id!),
    queryFn: async () => {
      const { data } = await api.get(`/projects/invoices/${id}`);
      return data.data as Invoice;
    },
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      clientId: string;
      issueDate: string;
      dueDate: string;
      lineItems: Array<{ description: string; quantity: number; unitPrice: number }>;
      taxPercent?: number;
      discountPercent?: number;
      notes?: string | null;
    }) => {
      const { data } = await api.post('/projects/invoices', input);
      return data.data as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<{
      clientId: string;
      issueDate: string;
      dueDate: string;
      lineItems: Array<{ description: string; quantity: number; unitPrice: number }>;
      taxPercent: number;
      discountPercent: number;
      notes: string | null;
      status: string;
    }>) => {
      const { data } = await api.patch(`/projects/invoices/${id}`, input);
      return data.data as Invoice;
    },
    onSuccess: (invoice) => {
      queryClient.setQueryData(queryKeys.projects.invoices.detail(invoice.id), invoice);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/projects/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useSendInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/projects/invoices/${id}/send`);
      return data.data as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useMarkInvoicePaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/projects/invoices/${id}/paid`);
      return data.data as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function useWaiveInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/projects/invoices/${id}/waive`);
      return data.data as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.projects.all });
    },
  });
}

export function usePopulateFromTimeEntries() {
  return useMutation({
    mutationFn: async (input: { clientId: string; startDate: string; endDate: string }) => {
      const { data } = await api.post('/projects/invoices/populate-from-time', input);
      return data.data as { lineItems: Array<{ description: string; quantity: number; unitPrice: number }> };
    },
  });
}

export function useDuplicateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/projects/invoices/${id}/duplicate`);
      return data.data as Invoice;
    },
    onSuccess: () => {
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

// ─── Shared Utilities ─────────────────────────────────────────────

export function getInvoiceStatusVariant(status: string): 'default' | 'primary' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'draft': return 'default';
    case 'sent': return 'primary';
    case 'viewed': return 'warning';
    case 'paid': return 'success';
    case 'overdue': return 'error';
    case 'waived': return 'default';
    default: return 'default';
  }
}

// ─── Portal (public, no auth) ─────────────────────────────────────

export function usePortalData(token: string | undefined) {
  return useQuery({
    queryKey: queryKeys.projects.portal(token!),
    queryFn: async () => {
      const { data } = await api.get(`/projects/portal/${token}`);
      return data.data as PortalData;
    },
    enabled: !!token,
    staleTime: 30_000,
  });
}
