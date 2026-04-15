import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';
import type {
  Task, TaskProject,
  CreateTaskInput, UpdateTaskInput,
  Subtask, TaskActivity, TaskTemplate, TaskComment,
  CreateTaskTemplateInput,
  TaskAttachment, TaskDependency,
  ProjectRate, CreateRateInput, UpdateRateInput,
} from '@atlas-platform/shared';

// ─── Inline Types ──────────────────────────────────────────────────

interface ListTasksResponse { tasks: Task[]; }
interface ListProjectsResponse { projects: TaskProject[]; }

export interface WorkProject {
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

export interface ProjectFinancials {
  projectId: string;
  budgetHours: number | null;
  budgetAmount: number | null;
  totalHours: number;
  billableHours: number;
  billedHours: number;
  totalAmount: number;
  unbilledHours: number;
  unbilledAmount: number;
  invoicedAmount: number;
  paidAmount: number;
}

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

export interface TimeEntryLineItemPreview {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  projectId: string;
  projectName: string;
  workDate: string;
}

// ─── Project transform helper ──────────────────────────────────────

function mapWorkProject(raw: Record<string, unknown>): WorkProject {
  return {
    id: raw.id as string,
    name: raw.name as string,
    description: (raw.description as string) ?? null,
    companyId: (raw.companyId as string) ?? (raw.clientId as string) ?? null,
    companyName: (raw.companyName as string) ?? (raw.clientName as string) ?? null,
    status: (raw.status as WorkProject['status']) ?? 'active',
    color: (raw.color as string) ?? '#6b7280',
    hourlyRate: 0,
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

// ─── Task Queries ───────────────────────────────────────────────────

export function useTaskList(filters?: {
  status?: string;
  when?: string;
  projectId?: string | null;
  assigneeId?: string;
  includeArchived?: boolean;
  visibility?: 'private' | 'team';
}, options?: { enabled?: boolean }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: queryKeys.work.tasks.list(filterKey),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.when) params.set('when', filters.when);
      if (filters?.projectId !== undefined) params.set('projectId', filters.projectId === null ? 'null' : filters.projectId);
      if (filters?.assigneeId) params.set('assigneeId', filters.assigneeId);
      if (filters?.includeArchived) params.set('includeArchived', 'true');
      if (filters?.visibility) params.set('visibility', filters.visibility);
      const qs = params.toString();
      const { data } = await api.get(`/work/tasks${qs ? `?${qs}` : ''}`);
      return data.data as ListTasksResponse;
    },
    staleTime: 15_000,
    enabled: options?.enabled,
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.work.tasks.detail(id!),
    queryFn: async () => {
      const { data } = await api.get(`/work/tasks/${id}`);
      return data.data as Task;
    },
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useTaskCounts(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.work.tasks.counts,
    queryFn: async () => {
      const { data } = await api.get('/work/tasks/counts');
      return data.data as {
        inbox: number;
        today: number;
        upcoming: number;
        anytime: number;
        someday: number;
        logbook: number;
        total: number;
        team: number;
      };
    },
    staleTime: 15_000,
    enabled: options?.enabled,
  });
}

// ─── Task Mutations ─────────────────────────────────────────────────

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskInput) => {
      const { data } = await api.post('/work/tasks', input);
      return data.data as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.all });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updatedAt, ...input }: UpdateTaskInput & { id: string; updatedAt?: string }) => {
      const { data } = await api.patch(`/work/tasks/${id}`, input, {
        headers: updatedAt ? { 'If-Unmodified-Since': updatedAt } : undefined,
      });
      return data.data as Task;
    },
    onSuccess: (task) => {
      queryClient.setQueryData(queryKeys.work.tasks.detail(task.id), task);
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.all });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/work/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.all });
    },
  });
}

export function useRestoreTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/work/tasks/${id}/restore`);
      return data.data as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.all });
    },
  });
}

// ─── Task Project Queries & Mutations ──────────────────────────────

export function useTaskProjectList(includeArchived = false) {
  return useQuery({
    queryKey: includeArchived ? [...queryKeys.work.tasks.projects, 'archived'] : queryKeys.work.tasks.projects,
    queryFn: async () => {
      const params = includeArchived ? '?includeArchived=true' : '';
      const { data } = await api.get(`/work/tasks/projects/list${params}`);
      return data.data as ListProjectsResponse;
    },
    staleTime: 30_000,
  });
}

export function useCreateTaskProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string }) => {
      const { data } = await api.post('/work/tasks/projects', input);
      return data.data as TaskProject;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.projects });
    },
  });
}

export function useUpdateTaskProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name?: string; description?: string }) => {
      const { data } = await api.patch(`/work/tasks/projects/${id}`, input);
      return data.data as TaskProject;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.projects });
    },
  });
}

export function useDeleteTaskProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/work/tasks/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.all });
    },
  });
}

// ─── Reorder Mutation ──────────────────────────────────────────────

export function useReorderTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (taskIds: string[]) => {
      await api.patch('/work/tasks/reorder', { taskIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.all });
    },
  });
}

// ─── Subtask Hooks ──────────────────────────────────────────────────

export function useSubtasks(taskId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.work.tasks.subtasks(taskId!),
    queryFn: async () => {
      const { data } = await api.get(`/work/tasks/${taskId}/subtasks`);
      return data.data as Subtask[];
    },
    enabled: !!taskId,
    staleTime: 10_000,
  });
}

export function useCreateSubtask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, title }: { taskId: string; title: string }) => {
      const { data } = await api.post(`/work/tasks/${taskId}/subtasks`, { title });
      return data.data as Subtask;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.subtasks(vars.taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.all });
    },
  });
}

export function useUpdateSubtask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ subtaskId, taskId, ...input }: { subtaskId: string; taskId: string; title?: string; isCompleted?: boolean }) => {
      const { data } = await api.patch(`/work/tasks/subtasks/${subtaskId}`, input);
      return data.data as Subtask;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.subtasks(vars.taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.all });
    },
  });
}

export function useDeleteSubtask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ subtaskId, taskId }: { subtaskId: string; taskId: string }) => {
      await api.delete(`/work/tasks/subtasks/${subtaskId}`);
      return taskId;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.subtasks(vars.taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.all });
    },
  });
}

// ─── Comment Hooks ──────────────────────────────────────────────────

export function useTaskComments(taskId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.work.tasks.comments(taskId!),
    queryFn: async () => {
      const { data } = await api.get(`/work/tasks/${taskId}/comments`);
      return data.data as TaskComment[];
    },
    enabled: !!taskId,
    staleTime: 10_000,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, body }: { taskId: string; body: string }) => {
      const { data } = await api.post(`/work/tasks/${taskId}/comments`, { body });
      return data.data as TaskComment;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.comments(vars.taskId) });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, taskId }: { commentId: string; taskId: string }) => {
      await api.delete(`/work/tasks/comments/${commentId}`);
      return taskId;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.comments(vars.taskId) });
    },
  });
}

// ─── Activity Hooks ─────────────────────────────────────────────────

export function useTaskActivities(taskId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.work.tasks.activities(taskId!),
    queryFn: async () => {
      const { data } = await api.get(`/work/tasks/${taskId}/activities`);
      return data.data as TaskActivity[];
    },
    enabled: !!taskId,
    staleTime: 30_000,
  });
}

// ─── Template Hooks ─────────────────────────────────────────────────

export function useTaskTemplates() {
  return useQuery({
    queryKey: queryKeys.work.tasks.templates,
    queryFn: async () => {
      const { data } = await api.get('/work/tasks/templates/list');
      return data.data as TaskTemplate[];
    },
    staleTime: 60_000,
  });
}

export function useCreateTaskTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTaskTemplateInput) => {
      const { data } = await api.post('/work/tasks/templates', input);
      return data.data as TaskTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.templates });
    },
  });
}

export function useDeleteTaskTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      await api.delete(`/work/tasks/templates/${templateId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.templates });
    },
  });
}

export function useCreateTaskFromTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (templateId: string) => {
      const { data } = await api.post(`/work/tasks/from-template/${templateId}`);
      return data.data as Task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.all });
    },
  });
}

// ─── Visibility ────────────────────────────────────────────────────

export function useUpdateTaskVisibility() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, visibility }: { id: string; visibility: 'private' | 'team' }) => {
      await api.patch(`/work/tasks/${id}/visibility`, { visibility });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.all });
    },
  });
}

// ─── Attachment Hooks ──────────────────────────────────────────────

export function useTaskAttachments(taskId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.work.tasks.attachments(taskId!),
    queryFn: async () => {
      const { data } = await api.get(`/work/tasks/${taskId}/attachments`);
      return data.data as TaskAttachment[];
    },
    enabled: !!taskId,
    staleTime: 10_000,
  });
}

export function useAddAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, file }: { taskId: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await api.post(`/work/tasks/${taskId}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data as TaskAttachment;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.attachments(vars.taskId) });
    },
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ attachmentId, taskId }: { attachmentId: string; taskId: string }) => {
      await api.delete(`/work/tasks/attachments/${attachmentId}`);
      return taskId;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.attachments(vars.taskId) });
    },
  });
}

// ─── Dependency Hooks ──────────────────────────────────────────────

export function useTaskDependencies(taskId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.work.tasks.dependencies(taskId!),
    queryFn: async () => {
      const { data } = await api.get(`/work/tasks/${taskId}/dependencies`);
      return data.data as TaskDependency[];
    },
    enabled: !!taskId,
    staleTime: 10_000,
  });
}

export function useAddDependency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, blockedByTaskId }: { taskId: string; blockedByTaskId: string }) => {
      const { data } = await api.post(`/work/tasks/${taskId}/dependencies`, { blockedByTaskId });
      return data.data as TaskDependency;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.dependencies(vars.taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.blockedIds });
    },
  });
}

export function useRemoveDependency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, blockerTaskId }: { taskId: string; blockerTaskId: string }) => {
      await api.delete(`/work/tasks/${taskId}/dependencies/${blockerTaskId}`);
      return taskId;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.dependencies(vars.taskId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.work.tasks.blockedIds });
    },
  });
}

export function useBlockedTaskIds() {
  return useQuery({
    queryKey: queryKeys.work.tasks.blockedIds,
    queryFn: async () => {
      const { data } = await api.get('/work/tasks/blocked-ids');
      return data.data as string[];
    },
    staleTime: 15_000,
  });
}

// ─── Work Project (Projects app) Queries ─────────────────────────

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.work.projects.dashboard,
    queryFn: async () => {
      const { data } = await api.get('/work/projects/dashboard');
      return data.data as EnhancedDashboard;
    },
    staleTime: 15_000,
  });
}

export function useProjects(filters?: { search?: string; status?: string; companyId?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: [...queryKeys.work.projects.projects.all, filterKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.set('search', filters.search);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.companyId) params.set('companyId', filters.companyId);
      const qs = params.toString();
      const { data } = await api.get(`/work/projects/projects/list${qs ? `?${qs}` : ''}`);
      const raw = data.data as { projects: Record<string, unknown>[] };
      return { projects: raw.projects.map(mapWorkProject) };
    },
    staleTime: 15_000,
  });
}

export function useWorkProject(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.work.projects.projects.detail(id!),
    queryFn: async () => {
      const { data } = await api.get(`/work/projects/projects/${id}`);
      return mapWorkProject(data.data as Record<string, unknown>);
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
      const { data } = await api.post('/work/projects/projects', {
        name: input.name,
        description: input.description,
        companyId: input.companyId,
        status: input.status,
        color: input.color,
        billable: input.isBillable,
        estimatedHours: input.budgetHours,
        estimatedAmount: input.budgetAmount,
      });
      return data.data as WorkProject;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.all });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updatedAt, ...input }: { id: string; updatedAt?: string } & Partial<{
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
      const { data } = await api.patch(`/work/projects/projects/${id}`, payload, {
        headers: updatedAt ? { 'If-Unmodified-Since': updatedAt } : undefined,
      });
      return data.data as WorkProject;
    },
    onSuccess: (project) => {
      queryClient.setQueryData(queryKeys.work.projects.projects.detail(project.id), project);
      queryClient.invalidateQueries({ queryKey: queryKeys.work.all });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/work/projects/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.all });
    },
  });
}

// ─── Project Financials ───────────────────────────────────────────

export function useProjectFinancials(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.work.projects.financials(id!),
    queryFn: async () => {
      const { data } = await api.get(`/work/projects/projects/${id}/financials`);
      return data.data as ProjectFinancials;
    },
    enabled: !!id,
    staleTime: 30_000,
  });
}

// ─── Project Members ─────────────────────────────────────────────

export function useProjectMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: ['work', 'projects', 'members', projectId],
    queryFn: async () => {
      const { data } = await api.get(`/work/projects/projects/${projectId}/members`);
      const result = data.data;
      return (result?.members ?? result) as ProjectMember[];
    },
    enabled: !!projectId,
    staleTime: 10_000,
  });
}

// ─── Time Entry Queries ───────────────────────────────────────────

export function useTimeEntriesWeekly(weekStart: string) {
  return useQuery({
    queryKey: queryKeys.work.projects.timeEntries.weekly(weekStart),
    queryFn: async () => {
      const { data } = await api.get(`/work/projects/time-entries/weekly?weekStart=${weekStart}`);
      const raw = data.data as { entries: Record<string, unknown>[] };
      return { entries: raw.entries.map(mapTimeEntry) };
    },
    staleTime: 10_000,
  });
}

export function useTimeEntries(filters?: { projectId?: string; startDate?: string; endDate?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: queryKeys.work.projects.timeEntries.list(filterKey),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.projectId) params.set('projectId', filters.projectId);
      if (filters?.startDate) params.set('startDate', filters.startDate);
      if (filters?.endDate) params.set('endDate', filters.endDate);
      const qs = params.toString();
      const { data } = await api.get(`/work/projects/time-entries/list${qs ? `?${qs}` : ''}`);
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
      const { data } = await api.post('/work/projects/time-entries', {
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
      queryClient.invalidateQueries({ queryKey: queryKeys.work.all });
    },
  });
}

export function useUpdateTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updatedAt, ...input }: { id: string; updatedAt?: string } & Partial<{
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
      const { data } = await api.patch(`/work/projects/time-entries/${id}`, payload, {
        headers: updatedAt ? { 'If-Unmodified-Since': updatedAt } : undefined,
      });
      return data.data as TimeEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.all });
    },
  });
}

export function useDeleteTimeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/work/projects/time-entries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.all });
    },
  });
}

export function useBulkSaveTimeEntries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entries: Array<{ projectId: string; date: string; hours: number; description?: string | null; isBillable?: boolean }>) => {
      const { data } = await api.post('/work/projects/time-entries/bulk', { entries });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.all });
    },
  });
}

export function useCopyLastWeek() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (weekStart: string) => {
      const { data } = await api.post('/work/projects/time-entries/copy-last-week', { weekStart });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.work.all });
    },
  });
}

// ─── Time Billing ──────────────────────────────────────────────────

export function usePreviewTimeEntries() {
  return useMutation({
    mutationFn: async (input: {
      companyId: string;
      startDate: string;
      endDate: string;
      timeEntryIds?: string[];
    }) => {
      const { data } = await api.post('/work/projects/time-billing/preview', input);
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
      const { data } = await api.post('/work/projects/time-billing/populate', input);
      return data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(variables.invoiceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.work.all });
    },
  });
}

// ─── Report Queries ───────────────────────────────────────────────

export function useTimeReport(filters?: { startDate?: string; endDate?: string; groupBy?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: queryKeys.work.projects.reports.time(filterKey),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.set('startDate', filters.startDate);
      if (filters?.endDate) params.set('endDate', filters.endDate);
      if (filters?.groupBy) params.set('groupBy', filters.groupBy);
      const qs = params.toString();
      const { data } = await api.get(`/work/projects/reports/time${qs ? `?${qs}` : ''}`);
      return data.data as TimeReport;
    },
    staleTime: 30_000,
  });
}

export function useRevenueReport(filters?: { startDate?: string; endDate?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: queryKeys.work.projects.reports.revenue(filterKey),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.set('startDate', filters.startDate);
      if (filters?.endDate) params.set('endDate', filters.endDate);
      const qs = params.toString();
      const { data } = await api.get(`/work/projects/reports/revenue${qs ? `?${qs}` : ''}`);
      return data.data as RevenueReport;
    },
    staleTime: 30_000,
  });
}

export function useProfitabilityReport() {
  return useQuery({
    queryKey: queryKeys.work.projects.reports.profitability,
    queryFn: async () => {
      const { data } = await api.get('/work/projects/reports/profitability');
      return data.data as ProfitabilityReport;
    },
    staleTime: 30_000,
  });
}

export function useUtilizationReport(filters?: { startDate?: string; endDate?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: queryKeys.work.projects.reports.utilization(filterKey),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.set('startDate', filters.startDate);
      if (filters?.endDate) params.set('endDate', filters.endDate);
      const qs = params.toString();
      const { data } = await api.get(`/work/projects/reports/utilization${qs ? `?${qs}` : ''}`);
      return data.data as UtilizationReport;
    },
    staleTime: 30_000,
  });
}

// ─── Rates ───────────────────────────────────────────────────────

export function useRates() {
  return useQuery({
    queryKey: queryKeys.work.projects.rates.all,
    queryFn: async () => {
      const { data } = await api.get('/work/projects/rates');
      return data.data as ProjectRate[];
    },
  });
}

export function useCreateRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRateInput) => {
      const { data } = await api.post('/work/projects/rates', input);
      return data.data as ProjectRate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.work.projects.rates.all }),
  });
}

export function useUpdateRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & UpdateRateInput) => {
      const { data } = await api.patch(`/work/projects/rates/${id}`, input);
      return data.data as ProjectRate;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.work.projects.rates.all }),
  });
}

export function useDeleteRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/work/projects/rates/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.work.projects.rates.all }),
  });
}

// ─── Settings ─────────────────────────────────────────────────────

export function useProjectSettings() {
  return useQuery({
    queryKey: queryKeys.work.projects.settings,
    queryFn: async () => {
      const { data } = await api.get('/work/projects/settings');
      return data.data as ProjectSettings;
    },
    staleTime: 60_000,
  });
}

export function useUpdateProjectSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ProjectSettings>) => {
      const { data } = await api.patch('/work/projects/settings', input);
      return data.data as ProjectSettings;
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.work.projects.settings, settings);
    },
  });
}
