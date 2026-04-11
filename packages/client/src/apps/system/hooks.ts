import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';
import { useAuthStore } from '../../stores/auth-store';

// ─── App Permissions Types ─────────────────────────────────────────

export type AppPermissionRole = 'admin' | 'editor' | 'viewer';
export type AppPermissionRecordAccess = 'all' | 'own';

export interface AppPermissionUser {
  userId: string;
  userName: string | null;
  userEmail: string;
  tenantRole: string;
}

export interface AppPermissionApp {
  id: string;
  name: string;
}

export interface AppPermissionCell {
  userId: string;
  userName: string | null;
  userEmail: string;
  tenantRole: string;
  appId: string;
  role: AppPermissionRole;
  recordAccess: AppPermissionRecordAccess;
  inherited: boolean;
}

export interface AppPermissionsResponse {
  users: AppPermissionUser[];
  apps: AppPermissionApp[];
  cells: AppPermissionCell[];
}

// ─── Types ─────────────────────────────────────────────────────────

export interface SystemMetrics {
  cpu: { usage: number; model: string; cores: number };
  memory: { total: number; used: number; free: number; usagePercent: number };
  disk: { total: number; used: number; free: number; usagePercent: number };
  uptime: { system: number; process: number };
  node: { version: string; platform: string; arch: string };
  os: { type: string; release: string; hostname: string };
  process: { pid: number; memoryUsage: { rss: number; heapTotal: number; heapUsed: number; external: number } };
  timestamp: string;
}

// ─── Hooks ─────────────────────────────────────────────────────────

export function useSystemMetrics() {
  const tenantRole = useAuthStore((s) => s.tenantRole);
  const isAdmin = tenantRole === 'owner' || tenantRole === 'admin';
  return useQuery({
    queryKey: queryKeys.system.metrics,
    queryFn: async () => {
      const { data } = await api.get('/system/metrics');
      return data.data as SystemMetrics;
    },
    enabled: isAdmin,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

// ─── App Permissions Hooks ─────────────────────────────────────────

export function useAppPermissions() {
  const tenantRole = useAuthStore((s) => s.tenantRole);
  return useQuery({
    queryKey: queryKeys.system.permissions,
    queryFn: async () => {
      const { data } = await api.get('/system/permissions');
      return data.data as AppPermissionsResponse;
    },
    enabled: tenantRole === 'owner',
    staleTime: 10_000,
  });
}

export function useSetAppPermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      appId,
      role,
      recordAccess,
    }: {
      userId: string;
      appId: string;
      role: AppPermissionRole;
      recordAccess: AppPermissionRecordAccess;
    }) => {
      const { data } = await api.put(`/system/permissions/${userId}/${appId}`, {
        role,
        recordAccess,
      });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.system.permissions });
    },
  });
}

export function useRevertAppPermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, appId }: { userId: string; appId: string }) => {
      const { data } = await api.delete(`/system/permissions/${userId}/${appId}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.system.permissions });
    },
  });
}
