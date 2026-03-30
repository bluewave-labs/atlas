import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { queryKeys } from '../config/query-keys';
import { appRegistry } from '../config/app-registry';
import type { ClientAppWidget } from '../config/app-manifest.client';

interface AppWidgetConfig {
  enabledIds: string[];
  order: string[];
}

/**
 * Returns the ordered, enabled widgets for a given app.
 * Falls back to widgets with defaultEnabled=true if no user config exists.
 */
export function useAppWidgets(appId: string): {
  widgets: ClientAppWidget[];
  isLoading: boolean;
} {
  const { data: settings, isLoading } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data.data as Record<string, unknown> | null;
    },
    staleTime: 60_000,
  });

  const widgets = useMemo(() => {
    const available = appRegistry.getAppWidgets(appId);
    if (available.length === 0) return [];

    const raw = settings?.appWidgets as Record<string, AppWidgetConfig> | null | undefined;
    const config = raw?.[appId];

    if (!config) {
      // No user config -- return default-enabled widgets
      return available.filter((w) => w.defaultEnabled);
    }

    const enabledSet = new Set(config.enabledIds);
    const enabled = available.filter((w) => enabledSet.has(w.id));

    // Sort by user's order preference
    const orderMap = new Map(config.order.map((id, idx) => [id, idx]));
    return enabled.sort((a, b) => {
      const ai = orderMap.get(a.id) ?? Infinity;
      const bi = orderMap.get(b.id) ?? Infinity;
      return ai - bi;
    });
  }, [appId, settings]);

  return { widgets, isLoading };
}

/**
 * Mutation to update the enabled IDs and order for an app's widgets.
 */
export function useUpdateAppWidgets(appId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: { enabledIds: string[]; order: string[] }) => {
      // Read current appWidgets, merge, and save
      const { data: res } = await api.get('/settings');
      const current = (res.data as Record<string, unknown> | null) ?? {};
      const existing = (current.appWidgets as Record<string, AppWidgetConfig> | null) ?? {};

      const updated = {
        ...existing,
        [appId]: config,
      };

      await api.put('/settings', { appWidgets: updated });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
    },
  });
}
