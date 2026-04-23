import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ifUnmodifiedSince } from '../../lib/api-client';
import type { StepCondition, StepConditionOperator } from '@atlas-platform/shared';
import { queryKeys } from '../../config/query-keys';

// ─── Inline Types ──────────────────────────────────────────────────

export interface CrmCompany {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  address: string | null;
  phone: string | null;
  taxId: string | null;
  taxOffice: string | null;
  currency: string;
  postalCode: string | null;
  state: string | null;
  country: string | null;
  logo: string | null;
  portalToken: string | null;
  tags: string[];
  isArchived: boolean;
  sortOrder: number;
  contactCount: number;
  dealCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrmContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  companyId: string | null;
  position: string | null;
  source: string | null;
  tags: string[];
  isArchived: boolean;
  sortOrder: number;
  companyName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmDealStage {
  id: string;
  tenantId: string;
  name: string;
  color: string;
  probability: number;
  sequence: number;
  isDefault: boolean;
  rottingDays: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmDeal {
  id: string;
  title: string;
  value: number;
  stageId: string;
  contactId: string | null;
  companyId: string | null;
  assignedUserId: string | null;
  probability: number;
  expectedCloseDate: string | null;
  wonAt: string | null;
  lostAt: string | null;
  lostReason: string | null;
  tags: string[];
  stageEnteredAt: string | null;
  isArchived: boolean;
  sortOrder: number;
  stageName: string | null;
  stageColor: string | null;
  stageRottingDays: number | null;
  contactName: string | null;
  companyName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmActivity {
  id: string;
  type: string;
  body: string;
  dealId: string | null;
  contactId: string | null;
  companyId: string | null;
  assignedUserId: string | null;
  scheduledAt: string | null;
  completedAt: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  assignedUserName?: string;
}

export interface CrmEmail {
  id: string;
  gmailMessageId: string;
  threadId: string;
  fromAddress: string;
  toAddresses: Array<{ name?: string; address: string }>;
  ccAddresses: Array<{ name?: string; address: string }>;
  subject: string | null;
  body: string | null;
  bodyHtml: string | null;
  internalDate: string;
  isUnread: boolean;
  isStarred: boolean;
  hasAttachments?: boolean;
}

export interface CrmCalendarEvent {
  id: string;
  googleEventId: string;
  summary: string | null;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  status: string;
  htmlLink: string | null;
  attendees: Array<{ email: string; displayName?: string; responseStatus?: string }> | null;
  organizer: { email: string; displayName?: string } | null;
}

export interface CrmDashboard {
  totalPipelineValue: number;
  dealsWonCount: number;
  dealsWonValue: number;
  dealsLostCount: number;
  winRate: number;
  averageDealSize: number;
  dealCount: number;
  valueByStage: { stageId: string; stageName: string | null; stageColor: string | null; value: number; count: number }[];
  recentActivities: CrmActivity[];
  dealsClosingSoon: CrmDeal[];
  topDeals: CrmDeal[];
}

export interface CrmDealCounts {
  stageId: string;
  stageName: string | null;
  stageColor: string | null;
  count: number;
  totalValue: number;
}

export interface CrmPipelineValue {
  totalValue: number;
  dealCount: number;
  weightedValue: number;
}

// ─── Company Queries ───────────────────────────────────────────────

export function useCompanies(filters?: { search?: string; industry?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: [...queryKeys.crm.companies.all, filterKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.set('search', filters.search);
      if (filters?.industry) params.set('industry', filters.industry);
      const qs = params.toString();
      const { data } = await api.get(`/crm/companies/list${qs ? `?${qs}` : ''}`);
      return data.data as { companies: CrmCompany[] };
    },
    staleTime: 15_000,
  });
}

export function useCompany(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.crm.companies.detail(id!),
    queryFn: async () => {
      const { data } = await api.get(`/crm/companies/${id}`);
      return data.data as CrmCompany;
    },
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useCreateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; domain?: string | null; industry?: string | null; size?: string | null; address?: string | null; phone?: string | null; taxId?: string | null; taxOffice?: string | null; currency?: string; postalCode?: string | null; state?: string | null; country?: string | null; logo?: string | null; tags?: string[] }) => {
      const { data } = await api.post('/crm/companies', input);
      return data.data as CrmCompany;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

export function useUpdateCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updatedAt, ...input }: { id: string; updatedAt?: string } & Partial<{ name: string; domain: string | null; industry: string | null; size: string | null; address: string | null; phone: string | null; taxId: string | null; taxOffice: string | null; currency: string; postalCode: string | null; state: string | null; country: string | null; logo: string | null; portalToken: string | null; tags: string[]; sortOrder: number; isArchived: boolean }>) => {
      const { data } = await api.patch(`/crm/companies/${id}`, input, {
        headers: updatedAt ? { 'If-Unmodified-Since': updatedAt } : undefined,
      });
      return data.data as CrmCompany;
    },
    onSuccess: (company) => {
      queryClient.setQueryData(queryKeys.crm.companies.detail(company.id), company);
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

export function useDeleteCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/crm/companies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

export function useRegeneratePortalToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/crm/companies/${id}/regenerate-token`);
      return data.data as CrmCompany;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

// ─── Contact Queries ───────────────────────────────────────────────

export function useContacts(filters?: { search?: string; companyId?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: [...queryKeys.crm.contacts.all, filterKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.search) params.set('search', filters.search);
      if (filters?.companyId) params.set('companyId', filters.companyId);
      const qs = params.toString();
      const { data } = await api.get(`/crm/contacts/list${qs ? `?${qs}` : ''}`);
      return data.data as { contacts: CrmContact[] };
    },
    staleTime: 15_000,
  });
}

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.crm.contacts.detail(id!),
    queryFn: async () => {
      const { data } = await api.get(`/crm/contacts/${id}`);
      return data.data as CrmContact;
    },
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useCreateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; email?: string | null; phone?: string | null; companyId?: string | null; position?: string | null; source?: string | null; tags?: string[] }) => {
      const { data } = await api.post('/crm/contacts', input);
      return data.data as CrmContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

export function useUpdateContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updatedAt, ...input }: { id: string; updatedAt?: string } & Partial<{ name: string; email: string | null; phone: string | null; companyId: string | null; position: string | null; source: string | null; tags: string[]; sortOrder: number; isArchived: boolean }>) => {
      const { data } = await api.patch(`/crm/contacts/${id}`, input, {
        headers: updatedAt ? { 'If-Unmodified-Since': updatedAt } : undefined,
      });
      return data.data as CrmContact;
    },
    onSuccess: (contact) => {
      queryClient.setQueryData(queryKeys.crm.contacts.detail(contact.id), contact);
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/crm/contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

// ─── Stage Queries ─────────────────────────────────────────────────

export function useStages() {
  return useQuery({
    queryKey: queryKeys.crm.stages,
    queryFn: async () => {
      const { data } = await api.get('/crm/stages/list');
      return data.data as { stages: CrmDealStage[] };
    },
    staleTime: 30_000,
  });
}

export function useCreateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; color?: string; probability?: number; sequence?: number; isDefault?: boolean }) => {
      const { data } = await api.post('/crm/stages', input);
      return data.data as CrmDealStage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

export function useUpdateStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updatedAt, ...input }: { id: string; updatedAt?: string } & Partial<{ name: string; color: string; probability: number; sequence: number; isDefault: boolean; rottingDays: number | null }>) => {
      const { data } = await api.patch(`/crm/stages/${id}`, input, {
        headers: updatedAt ? { 'If-Unmodified-Since': updatedAt } : undefined,
      });
      return data.data as CrmDealStage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

export function useDeleteStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/crm/stages/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

export function useReorderStages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stageIds: string[]) => {
      const { data } = await api.post('/crm/stages/reorder', { stageIds });
      return data.data as { stages: CrmDealStage[] };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

// ─── Deal Queries ──────────────────────────────────────────────────

export function useDeals(filters?: { stageId?: string; contactId?: string; companyId?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: [...queryKeys.crm.deals.all, filterKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.stageId) params.set('stageId', filters.stageId);
      if (filters?.contactId) params.set('contactId', filters.contactId);
      if (filters?.companyId) params.set('companyId', filters.companyId);
      const qs = params.toString();
      const { data } = await api.get(`/crm/deals/list${qs ? `?${qs}` : ''}`);
      return data.data as { deals: CrmDeal[] };
    },
    staleTime: 15_000,
  });
}

export function useDeal(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.crm.deals.detail(id!),
    queryFn: async () => {
      const { data } = await api.get(`/crm/deals/${id}`);
      return data.data as CrmDeal;
    },
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; value: number; stageId: string; contactId?: string | null; companyId?: string | null; assignedUserId?: string | null; probability?: number; expectedCloseDate?: string | null; tags?: string[] }) => {
      const { data } = await api.post('/crm/deals', input);
      return data.data as CrmDeal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updatedAt, ...input }: { id: string; updatedAt?: string } & Partial<{ title: string; value: number; stageId: string; contactId: string | null; companyId: string | null; assignedUserId: string | null; probability: number; expectedCloseDate: string | null; tags: string[]; sortOrder: number; isArchived: boolean }>) => {
      const { data } = await api.patch(`/crm/deals/${id}`, input, {
        headers: updatedAt ? { 'If-Unmodified-Since': updatedAt } : undefined,
      });
      return data.data as CrmDeal;
    },
    onSuccess: (deal) => {
      queryClient.setQueryData(queryKeys.crm.deals.detail(deal.id), deal);
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

export function useDeleteDeal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/crm/deals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

export function useMarkDealWon() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/crm/deals/${id}/won`);
      return data.data as CrmDeal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

export function useMarkDealLost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data } = await api.post(`/crm/deals/${id}/lost`, { reason });
      return data.data as CrmDeal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

export function useDealCounts() {
  return useQuery({
    queryKey: queryKeys.crm.deals.counts,
    queryFn: async () => {
      const { data } = await api.get('/crm/deals/counts-by-stage');
      return data.data as CrmDealCounts[];
    },
    staleTime: 15_000,
  });
}

export function usePipelineValue() {
  return useQuery({
    queryKey: queryKeys.crm.deals.pipeline,
    queryFn: async () => {
      const { data } = await api.get('/crm/deals/pipeline-value');
      return data.data as CrmPipelineValue;
    },
    staleTime: 15_000,
  });
}

// ─── Activity Queries ──────────────────────────────────────────────

export function useActivities(filters?: { dealId?: string; contactId?: string; companyId?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: [...queryKeys.crm.activities.all, filterKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.dealId) params.set('dealId', filters.dealId);
      if (filters?.contactId) params.set('contactId', filters.contactId);
      if (filters?.companyId) params.set('companyId', filters.companyId);
      const qs = params.toString();
      const { data } = await api.get(`/crm/activities/list${qs ? `?${qs}` : ''}`);
      return data.data as { activities: CrmActivity[] };
    },
    staleTime: 15_000,
  });
}

export function useCreateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { type: string; body: string; dealId?: string | null; contactId?: string | null; companyId?: string | null; assignedUserId?: string | null; scheduledAt?: string | null }) => {
      const { data } = await api.post('/crm/activities', input);
      return data.data as CrmActivity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

export function useUpdateActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updatedAt, ...input }: { id: string; updatedAt?: string } & Partial<{ type: string; body: string; dealId: string | null; contactId: string | null; companyId: string | null; assignedUserId: string | null; scheduledAt: string | null; completedAt: string | null; isArchived: boolean }>) => {
      const { data } = await api.patch(`/crm/activities/${id}`, input, {
        headers: updatedAt ? { 'If-Unmodified-Since': updatedAt } : undefined,
      });
      return data.data as CrmActivity;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

export function useDeleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/crm/activities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

// ─── Activity Types ──────────────────────────────────────────────

export interface CrmActivityTypeConfig {
  id: string;
  tenantId: string;
  name: string;
  icon: string;
  color: string;
  isDefault: boolean;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function useActivityTypes() {
  return useQuery({
    queryKey: queryKeys.crm.activityTypes.all,
    queryFn: async () => {
      const { data } = await api.get('/crm/activity-types/list');
      return data.data as CrmActivityTypeConfig[];
    },
    staleTime: 30_000,
  });
}

export function useCreateActivityType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; icon?: string; color?: string }) => {
      const { data } = await api.post('/crm/activity-types', input);
      return data.data as CrmActivityTypeConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.activityTypes.all });
    },
  });
}

export function useUpdateActivityType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<{ name: string; icon: string; color: string; sortOrder: number; isArchived: boolean }>) => {
      const { data } = await api.patch(`/crm/activity-types/${id}`, input);
      return data.data as CrmActivityTypeConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.activityTypes.all });
    },
  });
}

export function useDeleteActivityType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/crm/activity-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.activityTypes.all });
    },
  });
}

export function useReorderActivityTypes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (typeIds: string[]) => {
      await api.post('/crm/activity-types/reorder', { typeIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.activityTypes.all });
    },
  });
}

export function useSeedActivityTypes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/crm/activity-types/seed');
      return data.data as CrmActivityTypeConfig[];
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.activityTypes.all });
    },
  });
}

export function useCompleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, scheduleNext }: { id: string; scheduleNext?: { type: string; body?: string; scheduledAt: string } }) => {
      const { data } = await api.post(`/crm/activities/${id}/complete`, { scheduleNext });
      return data.data as { completed: CrmActivity; next?: CrmActivity };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

// ─── Dashboard ────────────────────────────────────────────────────

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.crm.dashboard,
    queryFn: async () => {
      const { data } = await api.get('/crm/dashboard');
      return data.data as CrmDashboard;
    },
    staleTime: 15_000,
  });
}

// ─── Workflow Types ───────────────────────────────────────────────

export type { StepCondition, StepConditionOperator };

export interface CrmWorkflowStep {
  id: string;
  workflowId: string;
  position: number;
  action: string;
  actionConfig: Record<string, unknown>;
  condition: StepCondition | null;
  createdAt: string;
  updatedAt: string;
}

export interface CrmWorkflow {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  trigger: string;
  triggerConfig: Record<string, unknown>;
  isActive: boolean;
  executionCount: number;
  lastExecutedAt: string | null;
  createdAt: string;
  updatedAt: string;
  steps: CrmWorkflowStep[];
}

// ─── Workflow Queries ─────────────────────────────────────────────

export function useWorkflows() {
  return useQuery({
    queryKey: queryKeys.crm.workflows.all,
    queryFn: async () => {
      const { data } = await api.get('/crm/workflows');
      return data.data as { workflows: CrmWorkflow[] };
    },
    staleTime: 15_000,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      trigger: string;
      triggerConfig?: Record<string, unknown>;
      steps: Array<{ action: string; actionConfig: Record<string, unknown>; condition?: StepCondition | null }>;
    }) => {
      const { data } = await api.post('/crm/workflows', input);
      return data.data as CrmWorkflow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.workflows.all });
    },
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updatedAt, ...input }: {
      id: string;
      name?: string;
      trigger?: string;
      triggerConfig?: Record<string, unknown>;
      isActive?: boolean;
      updatedAt?: string;
    }) => {
      const { data } = await api.put(`/crm/workflows/${id}`, input, ifUnmodifiedSince(updatedAt));
      return data.data as CrmWorkflow;
    },
    onSuccess: (data, vars) => {
      // Seed the detail cache with the fresh server response instead of invalidating —
      // avoids a refetch round-trip on every debounced autosave keystroke.
      queryClient.setQueryData(queryKeys.crm.workflow(vars.id), data);
      // The list view summary depends on name, trigger, isActive, and step count.
      // Only invalidate the list when those could have changed.
      if (vars.name !== undefined || vars.trigger !== undefined || vars.isActive !== undefined) {
        queryClient.invalidateQueries({ queryKey: queryKeys.crm.workflows.all });
      }
    },
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/crm/workflows/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.workflows.all });
    },
  });
}

export function useToggleWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/crm/workflows/${id}/toggle`);
      return data.data as CrmWorkflow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.workflows.all });
    },
  });
}

export function useWorkflow(id: string | null) {
  return useQuery({
    queryKey: id ? queryKeys.crm.workflow(id) : ['crm', 'workflow', 'null'],
    queryFn: async () => {
      const { data } = await api.get(`/crm/workflows/${id}`);
      return data.data as CrmWorkflow;
    },
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useAddStep(workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (step: { action: string; actionConfig: Record<string, unknown>; condition?: StepCondition | null }) => {
      const { data } = await api.post(`/crm/workflows/${workflowId}/steps`, step);
      return data.data as CrmWorkflowStep;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.workflow(workflowId) });
      qc.invalidateQueries({ queryKey: queryKeys.crm.workflows.all });
    },
  });
}

export function useUpdateStep(workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ stepId, patch }: { stepId: string; patch: Partial<{ action: string; actionConfig: Record<string, unknown>; condition: StepCondition | null }> }) => {
      const { data } = await api.patch(`/crm/workflows/${workflowId}/steps/${stepId}`, patch);
      return data.data as CrmWorkflowStep;
    },
    onSuccess: (_step, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.workflow(workflowId) });
      // Step action changes affect the first-step row summary in the list view.
      // actionConfig changes do not — skip the list refetch then.
      if (vars.patch.action !== undefined) {
        qc.invalidateQueries({ queryKey: queryKeys.crm.workflows.all });
      }
    },
  });
}

export function useDeleteStep(workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stepId: string) => {
      await api.delete(`/crm/workflows/${workflowId}/steps/${stepId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.workflow(workflowId) });
      qc.invalidateQueries({ queryKey: queryKeys.crm.workflows.all });
    },
  });
}

export { WORKFLOW_ERROR_CODES } from '@atlas-platform/shared';
export type { WorkflowErrorCode } from '@atlas-platform/shared';

export function useReorderSteps(workflowId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (stepIds: string[]) => {
      await api.post(`/crm/workflows/${workflowId}/steps/reorder`, { stepIds });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.workflow(workflowId) });
    },
  });
}

// ─── Permission Types ────────────────────────────────────────────

// Canonical CRM roles — match the generic app_permissions roles.
// Legacy 'manager' and 'sales' values have been collapsed into
// 'admin' and 'editor' respectively.
export type CrmRole = 'admin' | 'editor' | 'viewer';
export type CrmRecordAccess = 'all' | 'own';
export type CrmEntity = 'deals' | 'contacts' | 'companies' | 'activities' | 'workflows' | 'dashboard' | 'leads' | 'notes' | 'proposals';
export type CrmOperation = 'view' | 'create' | 'update' | 'delete' | 'delete_own';

export interface CrmPermissionWithUser {
  id: string | null;
  tenantId: string;
  userId: string;
  role: CrmRole;
  recordAccess: CrmRecordAccess;
  userName: string | null;
  userEmail: string;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface MyCrmPermission {
  id: string | null;
  tenantId: string;
  userId: string;
  role: CrmRole;
  recordAccess: CrmRecordAccess;
}

// Client-side permission matrix (mirrors the server's app_permissions
// ROLE_MATRIX in packages/server/src/services/app-permissions.service.ts).
// The semantics are:
//   admin  — full CRUD on everything
//   editor — view/create/update/delete_own on records, view-only on
//            dashboard and workflows (workflows are admin-managed)
//   viewer — view only
const ADMIN_OPS: CrmOperation[] = ['view', 'create', 'update', 'delete', 'delete_own'];
const EDITOR_OPS: CrmOperation[] = ['view', 'create', 'update', 'delete_own'];
const VIEW_ONLY: CrmOperation[] = ['view'];

const ROLE_MATRIX: Record<CrmRole, Record<CrmEntity, Set<CrmOperation>>> = {
  admin: {
    deals: new Set(ADMIN_OPS),
    contacts: new Set(ADMIN_OPS),
    companies: new Set(ADMIN_OPS),
    activities: new Set(ADMIN_OPS),
    leads: new Set(ADMIN_OPS),
    notes: new Set(ADMIN_OPS),
    proposals: new Set(ADMIN_OPS),
    workflows: new Set(ADMIN_OPS),
    dashboard: new Set(VIEW_ONLY),
  },
  editor: {
    deals: new Set(EDITOR_OPS),
    contacts: new Set(EDITOR_OPS),
    companies: new Set(EDITOR_OPS),
    activities: new Set(EDITOR_OPS),
    leads: new Set(EDITOR_OPS),
    notes: new Set(EDITOR_OPS),
    proposals: new Set(EDITOR_OPS),
    workflows: new Set(VIEW_ONLY),
    dashboard: new Set(VIEW_ONLY),
  },
  viewer: {
    deals: new Set(VIEW_ONLY),
    contacts: new Set(VIEW_ONLY),
    companies: new Set(VIEW_ONLY),
    activities: new Set(VIEW_ONLY),
    leads: new Set(VIEW_ONLY),
    notes: new Set(VIEW_ONLY),
    proposals: new Set(VIEW_ONLY),
    workflows: new Set(VIEW_ONLY),
    dashboard: new Set(VIEW_ONLY),
  },
};

export function canAccess(role: CrmRole | undefined, entity: CrmEntity, operation: CrmOperation): boolean {
  if (!role) return false;
  return ROLE_MATRIX[role]?.[entity]?.has(operation) ?? false;
}

// ─── Permission Queries ─────────────────────────────────────────

export function useCrmPermissions() {
  return useQuery({
    queryKey: queryKeys.crm.permissions.all,
    queryFn: async () => {
      const { data } = await api.get('/crm/permissions');
      return data.data as { permissions: CrmPermissionWithUser[] };
    },
    staleTime: 30_000,
  });
}

export function useMyCrmPermission() {
  return useQuery({
    queryKey: queryKeys.crm.permissions.me,
    queryFn: async () => {
      const { data } = await api.get('/crm/permissions/me');
      return data.data as MyCrmPermission;
    },
    staleTime: 30_000,
  });
}

// ─── Seed ──────────────────────────────────────────────────────────

export function useSeedCrmData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/crm/seed');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

export function useSeedExampleWorkflows() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/crm/workflows/seed');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.workflows.all });
    },
  });
}

// ─── Lead Types ──────────────────────────────────────────────────

export type CrmLeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
export type CrmLeadSource = 'website' | 'referral' | 'cold_call' | 'social_media' | 'event' | 'other';

export interface CrmLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  companyName: string | null;
  source: CrmLeadSource;
  status: CrmLeadStatus;
  notes: string | null;
  expectedRevenue: number;
  probability: number;
  assignedUserId: string | null;
  expectedCloseDate: string | null;
  convertedContactId: string | null;
  convertedDealId: string | null;
  convertedDealTitle: string | null;
  tags: string[];
  enrichedData: Record<string, unknown> | null;
  enrichedAt: string | null;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Lead Queries ────────────────────────────────────────────────

export function useLeads(filters?: { status?: string; source?: string; search?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: [...queryKeys.crm.leads.all, filterKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.source) params.set('source', filters.source);
      if (filters?.search) params.set('search', filters.search);
      const qs = params.toString();
      const { data } = await api.get(`/crm/leads/list${qs ? `?${qs}` : ''}`);
      return data.data as { leads: CrmLead[] };
    },
    staleTime: 15_000,
  });
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.crm.leads.detail(id!),
    queryFn: async () => {
      const { data } = await api.get(`/crm/leads/${id}`);
      return data.data as CrmLead;
    },
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; email?: string; phone?: string; companyName?: string; source?: CrmLeadSource; notes?: string }) => {
      const { data } = await api.post('/crm/leads', input);
      return data.data as CrmLead;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updatedAt, ...input }: { id: string; updatedAt?: string } & Partial<{ name: string; email: string | null; phone: string | null; companyName: string | null; source: string; status: string; notes: string | null; tags: string[]; expectedRevenue: number; probability: number; assignedUserId: string | null; expectedCloseDate: string | null; sortOrder: number; isArchived: boolean }>) => {
      const { data } = await api.patch(`/crm/leads/${id}`, input, {
        headers: updatedAt ? { 'If-Unmodified-Since': updatedAt } : undefined,
      });
      return data.data as CrmLead;
    },
    onSuccess: (lead) => {
      queryClient.setQueryData(queryKeys.crm.leads.detail(lead.id), lead);
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/crm/leads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

export function useEnrichLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/crm/leads/${id}/enrich`);
      return data.data as Record<string, unknown>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.leads.all });
    },
  });
}

export function useConvertLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { leadId: string; dealTitle: string; dealStageId: string; dealValue?: number }) => {
      const { data } = await api.post(`/crm/leads/${input.leadId}/convert`, {
        dealTitle: input.dealTitle, dealStageId: input.dealStageId, dealValue: input.dealValue,
      });
      return data.data as { contact: CrmContact; company?: CrmCompany; deal: CrmDeal };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

// ─── Note Types ──────────────────────────────────────────────────

export interface CrmNote {
  id: string;
  title: string;
  content: Record<string, unknown>;
  dealId: string | null;
  contactId: string | null;
  companyId: string | null;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Note Queries ────────────────────────────────────────────────

export function useNotes(filters?: { dealId?: string; contactId?: string; companyId?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: [...queryKeys.crm.notes.all, filterKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.dealId) params.set('dealId', filters.dealId);
      if (filters?.contactId) params.set('contactId', filters.contactId);
      if (filters?.companyId) params.set('companyId', filters.companyId);
      const qs = params.toString();
      const { data } = await api.get(`/crm/notes/list${qs ? `?${qs}` : ''}`);
      return data.data as { notes: CrmNote[] };
    },
    staleTime: 10_000,
    enabled: !!(filters?.dealId || filters?.contactId || filters?.companyId),
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title?: string; content: Record<string, unknown>; dealId?: string; contactId?: string; companyId?: string }) => {
      const { data } = await api.post('/crm/notes', input);
      return data.data as CrmNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.notes.all });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updatedAt, ...input }: { id: string; updatedAt?: string } & Partial<{ title: string; content: Record<string, unknown>; isPinned: boolean; isArchived: boolean }>) => {
      const { data } = await api.patch(`/crm/notes/${id}`, input, {
        headers: updatedAt ? { 'If-Unmodified-Since': updatedAt } : undefined,
      });
      return data.data as CrmNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.notes.all });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/crm/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.notes.all });
    },
  });
}

// ─── Forecast ────────────────────────────────────────────────────

export interface CrmForecastMonth {
  month: string;
  weightedValue: number;
}

export interface CrmForecast {
  months: CrmForecastMonth[];
  totalWeighted: number;
  bestCase: number;
  committed: number;
}

export function useForecast() {
  return useQuery({
    queryKey: queryKeys.crm.forecast,
    queryFn: async () => {
      const { data } = await api.get('/crm/forecast');
      return data.data as CrmForecast;
    },
    staleTime: 30_000,
  });
}

// ─── Dashboard Charts ────────────────────────────────────────────

export interface CrmDashboardCharts {
  winLossByMonth: { month: string; won: number; lost: number }[];
  revenueTrend: { month: string; revenue: number }[];
  salesCycleLength: { month: string; avgDays: number }[];
  conversionFunnel: { stage: string; stageColor: string; count: number; sequence: number }[];
  dealsBySource: { source: string; count: number; value: number }[];
}

export function useDashboardCharts() {
  return useQuery({
    queryKey: queryKeys.crm.dashboardCharts,
    queryFn: async () => {
      const { data } = await api.get('/crm/dashboard/charts');
      return data.data as CrmDashboardCharts;
    },
    staleTime: 30_000,
  });
}

// ─── Merge Records ───────────────────────────────────────────────

export function useMergeContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { primaryId: string; secondaryId: string }) => {
      const { data } = await api.post('/crm/contacts/merge', input);
      return data.data as CrmContact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

export function useMergeCompanies() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { primaryId: string; secondaryId: string }) => {
      const { data } = await api.post('/crm/companies/merge', input);
      return data.data as CrmCompany;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.all });
    },
  });
}

// ─── Google Sync ─────────────────────────────────────────────────

export function useGoogleSyncStatus() {
  return useQuery({
    queryKey: queryKeys.crm.google.status,
    queryFn: async () => {
      const { data } = await api.get('/crm/google/status');
      return data.data as {
        googleConfigured: boolean;
        connected: boolean;
        syncStatus: string;
        syncError: string | null;
        lastSync: string | null;
        lastFullSync: string | null;
        redisAvailable: boolean;
      };
    },
    staleTime: 30_000,
  });
}

export function useStartGoogleSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/crm/google/sync/start');
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.crm.google.status }),
  });
}

export function useStopGoogleSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/crm/google/sync/stop');
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.crm.google.status }),
  });
}

export function useContactEvents(contactId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.crm.events.byContact(contactId ?? ''),
    queryFn: async () => {
      const { data } = await api.get(`/crm/contacts/${contactId}/events`);
      return data.data.events as CrmCalendarEvent[];
    },
    enabled: !!contactId,
    staleTime: 30_000,
  });
}

export function useDealEvents(dealId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.crm.events.byDeal(dealId ?? ''),
    queryFn: async () => {
      const { data } = await api.get(`/crm/deals/${dealId}/events`);
      return data.data.events as CrmCalendarEvent[];
    },
    enabled: !!dealId,
    staleTime: 30_000,
  });
}

export function useSendEmail() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { to: string; subject: string; body: string; contactId?: string; dealId?: string }) => {
      const { data } = await api.post('/crm/emails/send', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'emails'] });
      qc.invalidateQueries({ queryKey: queryKeys.crm.activities.all });
    },
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { summary: string; startTime: string; endTime: string; attendees: string[]; location?: string; description?: string; contactId?: string; dealId?: string }) => {
      const { data } = await api.post('/crm/events/create', payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm', 'events'] });
      qc.invalidateQueries({ queryKey: queryKeys.crm.activities.all });
    },
  });
}

// ─── Saved Views ────────────────────────────────────────────────────

export interface CrmSavedView {
  id: string;
  tenantId: string;
  userId: string;
  appSection: string;
  name: string;
  filters: Record<string, unknown>;
  isPinned: boolean;
  isShared: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function useSavedViews(appSection?: string) {
  return useQuery({
    queryKey: appSection
      ? queryKeys.crm.savedViews.bySection(appSection)
      : queryKeys.crm.savedViews.all,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (appSection) params.set('section', appSection);
      const qs = params.toString();
      const { data } = await api.get(`/crm/views${qs ? `?${qs}` : ''}`);
      return data.data as { views: CrmSavedView[] };
    },
    staleTime: 15_000,
  });
}

export function useCreateSavedView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { appSection: string; name: string; filters: Record<string, unknown>; isPinned?: boolean; isShared?: boolean }) => {
      const { data } = await api.post('/crm/views', input);
      return data.data as CrmSavedView;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.savedViews.all });
    },
  });
}

export function useUpdateSavedView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<{ name: string; filters: Record<string, unknown>; isPinned: boolean; isShared: boolean; sortOrder: number }>) => {
      const { data } = await api.patch(`/crm/views/${id}`, input);
      return data.data as CrmSavedView;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.savedViews.all });
    },
  });
}

export function useDeleteSavedView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/crm/views/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.savedViews.all });
    },
  });
}

// ─── Lead Forms ─────────────────────────────────────────────────────

export type LeadFormFieldType = 'text' | 'email' | 'phone' | 'textarea' | 'select';

export interface LeadFormField {
  id: string;
  type: LeadFormFieldType;
  label: string;
  placeholder: string;
  required: boolean;
  options?: string[]; // for select type
  mapTo?: string; // maps to lead field: name, email, phone, companyName, message
}

export interface CrmLeadForm {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  token: string;
  fields: LeadFormField[];
  isActive: boolean;
  submitCount: number;
  createdAt: string;
  updatedAt: string;
}

export function useLeadForms() {
  return useQuery({
    queryKey: queryKeys.crm.leadForms.all,
    queryFn: async () => {
      const { data } = await api.get('/crm/forms');
      return data.data as { forms: CrmLeadForm[] };
    },
    staleTime: 15_000,
  });
}

export function useCreateLeadForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const { data } = await api.post('/crm/forms', input);
      return data.data as CrmLeadForm;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.leadForms.all });
    },
  });
}

export function useUpdateLeadForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Partial<{ name: string; fields: LeadFormField[]; isActive: boolean }>) => {
      const { data } = await api.patch(`/crm/forms/${id}`, input);
      return data.data as CrmLeadForm;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.leadForms.all });
    },
  });
}

export function useDeleteLeadForm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/crm/forms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.leadForms.all });
    },
  });
}

// ─── Sales Teams ──────────────────────────────────────────────────

export interface CrmTeam {
  id: string;
  name: string;
  color: string | null;
  leaderUserId: string | null;
  isArchived: boolean;
  createdAt: string;
}

export function useCrmTeams() {
  return useQuery({
    queryKey: queryKeys.crm.teams,
    queryFn: async () => {
      const { data } = await api.get('/crm/teams/list');
      return data.data as CrmTeam[];
    },
    staleTime: 30_000,
  });
}

// ─── Proposal Types (from shared package) ───────────────────────
import type { Proposal, ProposalStatus, ProposalLineItem, CreateProposalInput, UpdateProposalInput } from '@atlas-platform/shared';
export type { Proposal, ProposalStatus, ProposalLineItem, CreateProposalInput, UpdateProposalInput };

// ─── Proposal Queries ───────────────────────────────────────────

export function useProposals(filters?: { dealId?: string; companyId?: string; contactId?: string; status?: string }) {
  const filterKey = filters ? JSON.stringify(filters) : '';
  return useQuery({
    queryKey: [...(queryKeys.crm.proposals.list(filters as Record<string, unknown> | undefined) as readonly unknown[]), filterKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.dealId) params.set('dealId', filters.dealId);
      if (filters?.companyId) params.set('companyId', filters.companyId);
      if (filters?.contactId) params.set('contactId', filters.contactId);
      if (filters?.status) params.set('status', filters.status);
      const qs = params.toString();
      const { data } = await api.get(`/crm/proposals/list${qs ? `?${qs}` : ''}`);
      return data.data as { proposals: Proposal[] };
    },
    staleTime: 15_000,
  });
}

export function useProposal(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.crm.proposals.detail(id!),
    queryFn: async () => {
      const { data } = await api.get(`/crm/proposals/${id}`);
      return data.data as Proposal;
    },
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useCreateProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateProposalInput) => {
      const { data } = await api.post('/crm/proposals', input);
      return data.data as Proposal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.proposals.all });
    },
  });
}

export function useUpdateProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updatedAt, ...input }: { id: string; updatedAt?: string } & UpdateProposalInput) => {
      const { data } = await api.patch(`/crm/proposals/${id}`, input, {
        headers: updatedAt ? { 'If-Unmodified-Since': updatedAt } : undefined,
      });
      return data.data as Proposal;
    },
    onSuccess: (proposal) => {
      queryClient.setQueryData(queryKeys.crm.proposals.detail(proposal.id), proposal);
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.proposals.all });
    },
  });
}

export function useDeleteProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/crm/proposals/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.proposals.all });
    },
  });
}

export function useSendProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/crm/proposals/${id}/send`);
      return data.data as Proposal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.proposals.all });
    },
  });
}

export function useDuplicateProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/crm/proposals/${id}/duplicate`);
      return data.data as Proposal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.proposals.all });
    },
  });
}

// ─── Proposal Revision Types ─────────────────────────────────────

export interface ProposalRevision {
  id: string;
  proposalId: string;
  revisionNumber: number;
  snapshotJson: {
    title: string;
    status: string;
    currency: string;
    lineItems: Array<{ description: string; quantity: number; unitPrice: number; taxRate: number }>;
    subtotal: number;
    taxPercent: number;
    taxAmount: number;
    discountPercent: number;
    discountAmount: number;
    total: number;
    notes: string | null;
    validUntil: string | null;
    content: unknown;
  };
  changedBy: string;
  changeReason: string | null;
  createdAt: string;
}

// ─── Proposal Revision Queries ───────────────────────────────────

export function useProposalRevisions(proposalId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.crm.proposals.revisions(proposalId!),
    queryFn: async () => {
      const { data } = await api.get(`/crm/proposals/${proposalId}/revisions`);
      return data.data as ProposalRevision[];
    },
    enabled: !!proposalId,
    staleTime: 30_000,
  });
}

export function useRestoreProposalRevision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ proposalId, revisionId }: { proposalId: string; revisionId: string }) => {
      const { data } = await api.post(`/crm/proposals/${proposalId}/revisions/${revisionId}/restore`);
      return data.data as Proposal;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.proposals.detail(vars.proposalId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.proposals.revisions(vars.proposalId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.crm.proposals.all });
    },
  });
}

/** Checks whether a proposal already has a linked invoice (to disable duplicate conversion). */
export function useProposalInvoices(proposalId: string | undefined) {
  return useQuery({
    queryKey: ['invoices', 'by-proposal', proposalId],
    queryFn: async () => {
      const { data } = await api.get(`/invoices/list?proposalId=${proposalId}`);
      return (data.data as { invoices: Array<{ id: string }> }).invoices;
    },
    enabled: !!proposalId,
    staleTime: 15_000,
  });
}

export function useConvertProposalToInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (proposalId: string) => {
      const { data } = await api.post(`/crm/proposals/${proposalId}/convert-to-invoice`);
      return data.data as { invoiceId: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}
