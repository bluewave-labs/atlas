import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';
import type {
  MarketplaceCatalogItem,
  MarketplaceInstalledApp,
  MarketplaceAppStatus,
} from '@atlasmail/shared';

// ─── Catalog ──────────────────────────────────────────────────────

export function useMarketplaceCatalog() {
  return useQuery({
    queryKey: queryKeys.marketplace.catalog,
    queryFn: async () => {
      const { data } = await api.get('/marketplace/catalog');
      return data.data as {
        items: MarketplaceCatalogItem[];
        dockerAvailable: boolean;
      };
    },
    staleTime: 30_000,
  });
}

// ─── Installed Apps ───────────────────────────────────────────────

export function useMarketplaceInstalled() {
  return useQuery({
    queryKey: queryKeys.marketplace.installed,
    queryFn: async () => {
      const { data } = await api.get('/marketplace/installed');
      return data.data as MarketplaceInstalledApp[];
    },
    staleTime: 10_000,
  });
}

// ─── App Status ───────────────────────────────────────────────────

export function useMarketplaceStatus(appId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.marketplace.status(appId),
    queryFn: async () => {
      const { data } = await api.get(`/marketplace/${appId}/status`);
      return data.data as MarketplaceAppStatus;
    },
    enabled,
    refetchInterval: 10_000,
    staleTime: 5_000,
  });
}

// ─── App Logs ─────────────────────────────────────────────────────

export function useMarketplaceLogs(appId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.marketplace.logs(appId),
    queryFn: async () => {
      const { data } = await api.get(`/marketplace/${appId}/logs`);
      return data.data as { appId: string; logs: string };
    },
    enabled,
    staleTime: 5_000,
  });
}

// ─── Deploy ───────────────────────────────────────────────────────

export function useDeployApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      appId,
      envOverrides,
    }: {
      appId: string;
      envOverrides?: Record<string, string>;
    }) => {
      const { data } = await api.post(`/marketplace/${appId}/deploy`, { envOverrides });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.catalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.installed });
    },
  });
}

// ─── Start ────────────────────────────────────────────────────────

export function useStartApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appId: string) => {
      const { data } = await api.post(`/marketplace/${appId}/start`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.catalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.installed });
    },
  });
}

// ─── Stop ─────────────────────────────────────────────────────────

export function useStopApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appId: string) => {
      const { data } = await api.post(`/marketplace/${appId}/stop`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.catalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.installed });
    },
  });
}

// ─── Update ───────────────────────────────────────────────────────

export function useUpdateApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appId: string) => {
      const { data } = await api.post(`/marketplace/${appId}/update`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.catalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.installed });
    },
  });
}

// ─── Remove ───────────────────────────────────────────────────────

export function useRemoveApp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (appId: string) => {
      const { data } = await api.delete(`/marketplace/${appId}`);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.catalog });
      queryClient.invalidateQueries({ queryKey: queryKeys.marketplace.installed });
    },
  });
}
