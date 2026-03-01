import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { queryKeys } from '../config/query-keys';
import type { CatalogApp, Tenant, AppInstallation, InstallAppInput, CreateTenantInput, AppUserAssignment, AppRole, TenantUser, CreateTenantUserInput, TenantMemberRole } from '@atlasmail/shared';

// ─── Catalog ─────────────────────────────────────────────────────────

export function useCatalog(category?: string) {
  return useQuery({
    queryKey: queryKeys.platform.catalog(category),
    queryFn: async () => {
      const params = category ? `?category=${category}` : '';
      const { data } = await api.get(`/platform/catalog${params}`);
      return data.data.apps as CatalogApp[];
    },
    staleTime: 60_000,
  });
}

export function useCatalogApp(manifestId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.platform.catalogApp(manifestId!),
    queryFn: async () => {
      const { data } = await api.get(`/platform/catalog/${manifestId}`);
      return data.data as CatalogApp;
    },
    enabled: !!manifestId,
    staleTime: 60_000,
  });
}

// ─── Tenants ─────────────────────────────────────────────────────────

export function useMyTenants() {
  return useQuery({
    queryKey: queryKeys.platform.tenants,
    queryFn: async () => {
      const { data } = await api.get('/platform/tenants');
      return data.data.tenants as (Tenant & { role: string })[];
    },
    staleTime: 30_000,
  });
}

export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTenantInput) => {
      const { data } = await api.post('/platform/tenants', input);
      return data.data as Tenant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.all });
    },
  });
}

// ─── Installations ──────────────────────────────────────────────────

export function useInstallations(tenantId: string | undefined, refetchInterval = 15_000) {
  return useQuery({
    queryKey: queryKeys.platform.installations(tenantId!),
    queryFn: async () => {
      const { data } = await api.get(`/platform/tenants/${tenantId}/installations`);
      return data.data.installations as AppInstallation[];
    },
    enabled: !!tenantId,
    staleTime: 10_000,
    refetchInterval,
  });
}

export function useInstallApp(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: InstallAppInput) => {
      const { data } = await api.post(`/platform/tenants/${tenantId}/installations`, input);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.installations(tenantId) });
    },
  });
}

export function useStartApp(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (installationId: string) => {
      const { data } = await api.post(`/platform/tenants/${tenantId}/installations/${installationId}/start`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.installations(tenantId) });
    },
  });
}

export function useStopApp(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (installationId: string) => {
      const { data } = await api.post(`/platform/tenants/${tenantId}/installations/${installationId}/stop`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.installations(tenantId) });
    },
  });
}

export function useUninstallApp(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (installationId: string) => {
      const { data } = await api.delete(`/platform/tenants/${tenantId}/installations/${installationId}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.installations(tenantId) });
    },
  });
}

// ─── Tenant Users ───────────────────────────────────────────────────

export function useTenantUsers(tenantId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.platform.tenantUsers(tenantId!),
    queryFn: async () => {
      const { data } = await api.get(`/platform/tenants/${tenantId}/users`);
      return data.data.users as TenantUser[];
    },
    enabled: !!tenantId,
    staleTime: 10_000,
  });
}

export function useCreateTenantUser(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTenantUserInput) => {
      const { data } = await api.post(`/platform/tenants/${tenantId}/users`, input);
      return data.data as TenantUser;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.tenantUsers(tenantId) });
    },
  });
}

export function useRemoveTenantUser(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      await api.delete(`/platform/tenants/${tenantId}/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.tenantUsers(tenantId) });
    },
  });
}

export function useUpdateTenantUserRole(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; role: TenantMemberRole }) => {
      await api.put(`/platform/tenants/${tenantId}/users/${input.userId}/role`, { role: input.role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.tenantUsers(tenantId) });
    },
  });
}

export function useInviteTenantUser(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; role?: TenantMemberRole }) => {
      const { data } = await api.post(`/platform/tenants/${tenantId}/invitations`, input);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.tenantUsers(tenantId) });
    },
  });
}

// ─── App Assignments ────────────────────────────────────────────────

export function useAppAssignments(tenantId: string, installationId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.platform.assignments(tenantId, installationId!),
    queryFn: async () => {
      const { data } = await api.get(`/platform/tenants/${tenantId}/installations/${installationId}/assignments`);
      return data.data.assignments as AppUserAssignment[];
    },
    enabled: !!installationId,
    staleTime: 10_000,
  });
}

export function useAssignUser(tenantId: string, installationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; appRole?: AppRole }) => {
      const { data } = await api.post(
        `/platform/tenants/${tenantId}/installations/${installationId}/assignments`,
        input,
      );
      return data.data as AppUserAssignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.assignments(tenantId, installationId) });
    },
  });
}

export function useUpdateAssignment(tenantId: string, installationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; appRole: AppRole }) => {
      const { data } = await api.put(
        `/platform/tenants/${tenantId}/installations/${installationId}/assignments/${input.userId}`,
        { appRole: input.appRole },
      );
      return data.data as AppUserAssignment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.assignments(tenantId, installationId) });
    },
  });
}

export function useRemoveAssignment(tenantId: string, installationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.delete(
        `/platform/tenants/${tenantId}/installations/${installationId}/assignments/${userId}`,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.assignments(tenantId, installationId) });
    },
  });
}
