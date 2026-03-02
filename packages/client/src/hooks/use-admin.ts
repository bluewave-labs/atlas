import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { queryKeys } from '../config/query-keys';

// ─── Overview ───────────────────────────────────────────────────────────────

export function useAdminOverview() {
  return useQuery({
    queryKey: queryKeys.admin.overview,
    queryFn: async () => {
      const { data } = await api.get('/admin/overview');
      return data.data as {
        tenants: number;
        installations: { running: number; stopped: number; error: number; installing: number; total: number };
        containers: number;
      };
    },
    refetchInterval: 30_000,
  });
}

// ─── Tenants ────────────────────────────────────────────────────────────────

export interface AdminTenant {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
  ownerId: string;
  k8sNamespace: string;
  quotaCpu: number;
  quotaMemoryMb: number;
  quotaStorageMb: number;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  installationCount: number;
}

export function useAdminTenants() {
  return useQuery({
    queryKey: queryKeys.admin.tenants,
    queryFn: async () => {
      const { data } = await api.get('/admin/tenants');
      return data.data as AdminTenant[];
    },
  });
}

export interface AdminTenantDetail extends Omit<AdminTenant, 'memberCount' | 'installationCount'> {
  members: Array<{ tenantId: string; userId: string; role: string; createdAt: string }>;
  installations: Array<{
    id: string;
    tenantId: string;
    catalogAppId: string;
    installedVersion: string;
    status: string;
    subdomain: string;
    lastHealthStatus: string | null;
    createdAt: string;
    appName: string | null;
    manifestId: string | null;
    assignedCount: number;
  }>;
}

export function useAdminTenant(id: string) {
  return useQuery({
    queryKey: queryKeys.admin.tenant(id),
    queryFn: async () => {
      const { data } = await api.get(`/admin/tenants/${id}`);
      return data.data as AdminTenantDetail;
    },
    enabled: !!id,
  });
}

export function useUpdateTenantStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data } = await api.put(`/admin/tenants/${id}/status`, { status });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.tenants });
    },
  });
}

export function useUpdateTenantPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, plan }: { id: string; plan: string }) => {
      const { data } = await api.put(`/admin/tenants/${id}/plan`, { plan });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.tenants });
    },
  });
}

export function useCreateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; slug: string; ownerName?: string; ownerPassword?: string }) => {
      const { data } = await api.post('/admin/tenants', payload);
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.tenants });
      qc.invalidateQueries({ queryKey: queryKeys.admin.overview });
    },
  });
}

// ─── Installations ──────────────────────────────────────────────────────────

export interface AdminInstallation {
  id: string;
  tenantId: string;
  catalogAppId: string;
  installedVersion: string;
  status: string;
  subdomain: string;
  lastHealthStatus: string | null;
  createdAt: string;
  tenantName: string | null;
  tenantSlug: string | null;
  appName: string | null;
  manifestId: string | null;
}

export function useAdminInstallations() {
  return useQuery({
    queryKey: queryKeys.admin.installations,
    queryFn: async () => {
      const { data } = await api.get('/admin/installations');
      return data.data as AdminInstallation[];
    },
  });
}

export function useInstallationAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'start' | 'stop' | 'restart' }) => {
      const { data } = await api.post(`/admin/installations/${id}/${action}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.installations });
      qc.invalidateQueries({ queryKey: queryKeys.admin.overview });
    },
  });
}

// ─── Containers ─────────────────────────────────────────────────────────────

export interface AdminContainer {
  id: string;
  name: string;
  state: string;
  installationId: string;
  appId: string;
  tenant: string;
  image: string;
}

export function useAdminContainers() {
  return useQuery({
    queryKey: queryKeys.admin.containers,
    queryFn: async () => {
      const { data } = await api.get('/admin/containers');
      return data.data as AdminContainer[];
    },
    refetchInterval: 10_000,
  });
}
