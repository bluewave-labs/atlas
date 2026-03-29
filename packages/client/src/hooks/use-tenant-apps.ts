import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { useAuthStore } from '../stores/auth-store';
import { appRegistry } from '../apps';

export function useTenantApps() {
  const tenantId = useAuthStore((s) => s.tenantId);

  const { data, isLoading } = useQuery({
    queryKey: ['platform', 'tenant-apps', tenantId],
    queryFn: async () => {
      const { data } = await api.get(`/platform/tenants/${tenantId}/apps`);
      return data.data.apps as Array<{ appId: string; isEnabled: boolean }>;
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });

  // If no tenant context, all registered apps are enabled
  if (!tenantId) {
    const allIds = new Set(appRegistry.getAll().map(a => a.id));
    return { enabledAppIds: allIds, isLoading: false };
  }

  const enabledAppIds = new Set(
    (data ?? []).filter(a => a.isEnabled).map(a => a.appId),
  );

  return { enabledAppIds, isLoading };
}
