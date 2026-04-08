import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { queryKeys } from '../config/query-keys';

export type AppRole = 'admin' | 'manager' | 'editor' | 'viewer';
export type AppRecordAccess = 'all' | 'own';

export interface AppPermission {
  role: AppRole;
  recordAccess: AppRecordAccess;
}

export interface AppPermissionWithUser {
  id: string | null;
  tenantId: string;
  userId: string;
  role: AppRole;
  recordAccess: AppRecordAccess;
  userName: string | null;
  userEmail: string;
  createdAt: string | null;
  updatedAt: string | null;
}

// ─── Permission action flags (convenience) ─────────────────────────

export function useAppActions(appId: string) {
  const { data: perm } = useMyAppPermission(appId);
  return {
    canView: !perm || perm.role === 'admin' || perm.role === 'editor' || perm.role === 'viewer',
    canCreate: !perm || perm.role === 'admin' || perm.role === 'editor',
    canEdit: !perm || perm.role === 'admin' || perm.role === 'editor',
    canDelete: !perm || perm.role === 'admin' || perm.role === 'manager',
    canDeleteOwn: !perm || perm.role === 'admin' || perm.role === 'manager' || perm.role === 'editor',
    role: perm?.role ?? null,
  };
}

// ─── My permission (raw) ───────────────────────────────────────────

export function useMyAppPermission(appId: string) {
  return useQuery({
    queryKey: queryKeys.permissions.me(appId),
    queryFn: async () => {
      const { data } = await api.get(`/permissions/${appId}/me`);
      return data.data as AppPermission;
    },
    staleTime: 60_000,
  });
}

// ─── My accessible apps (sidebar filtering) ──────────────────────

export function useMyAccessibleApps() {
  return useQuery({
    queryKey: queryKeys.permissions.myApps,
    queryFn: async () => {
      const { data } = await api.get('/permissions/my-apps');
      return data.data as { appIds: string[] | '__all__'; role: string | null };
    },
    staleTime: 60_000,
  });
}

// ─── All permissions for the tenant (all apps, all users) ─────────

export function useAllTenantPermissions(enabled = true) {
  return useQuery({
    queryKey: queryKeys.permissions.allTenant,
    enabled,
    queryFn: async () => {
      const { data } = await api.get('/permissions/all');
      return data.data.permissions as Array<{
        id: string;
        tenantId: string;
        userId: string;
        appId: string;
        role: AppRole;
        recordAccess: AppRecordAccess;
      }>;
    },
    staleTime: 30_000,
  });
}

// ─── All permissions for an app ────────────────────────────────────

export function useAppPermissions(appId: string) {
  return useQuery({
    queryKey: queryKeys.permissions.app(appId),
    queryFn: async () => {
      const { data } = await api.get(`/permissions/${appId}`);
      return data.data as { permissions: AppPermissionWithUser[] };
    },
    staleTime: 30_000,
  });
}

// ─── Update a user's permission ────────────────────────────────────

export function useUpdateAppPermission(appId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      role,
      recordAccess,
    }: {
      userId: string;
      role: AppRole;
      recordAccess: AppRecordAccess;
    }) => {
      const { data } = await api.put(`/permissions/${appId}/${userId}`, { role, recordAccess });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.permissions.app(appId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.permissions.me(appId) });
    },
  });
}

// ─── Delete (reset) a user's permission ────────────────────────────

export function useDeleteAppPermission(appId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data } = await api.delete(`/permissions/${appId}/${userId}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.permissions.app(appId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.permissions.me(appId) });
    },
  });
}
