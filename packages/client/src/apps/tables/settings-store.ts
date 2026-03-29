import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';
import type { TablesDefaultView, TablesDefaultSort, DateFormat } from '@atlasmail/shared';

export type { TablesDefaultView, TablesDefaultSort, DateFormat };

interface TablesSettings {
  // Tables-specific
  defaultView: TablesDefaultView;
  defaultSort: TablesDefaultSort;
  showFieldTypeIcons: boolean;
  defaultRowCount: number;
  includeRowIdsInExport: boolean;
  // Global (shared across apps)
  dateFormat: DateFormat;
  currencySymbol: string;
  timezone: string;
}

const DEFAULTS: TablesSettings = {
  defaultView: 'grid',
  defaultSort: 'none',
  showFieldTypeIcons: true,
  defaultRowCount: 3,
  includeRowIdsInExport: false,
  dateFormat: 'MM/DD/YYYY',
  currencySymbol: '$',
  timezone: '',
};

// Map from our local field names to server column names
const TO_SERVER: Record<keyof TablesSettings, string> = {
  defaultView: 'tablesDefaultView',
  defaultSort: 'tablesDefaultSort',
  showFieldTypeIcons: 'tablesShowFieldTypeIcons',
  defaultRowCount: 'tablesDefaultRowCount',
  includeRowIdsInExport: 'tablesIncludeRowIdsInExport',
  dateFormat: 'dateFormat',
  currencySymbol: 'currencySymbol',
  timezone: 'timezone',
};

// Reverse map
const FROM_SERVER: Record<string, keyof TablesSettings> = Object.fromEntries(
  Object.entries(TO_SERVER).map(([local, server]) => [server, local as keyof TablesSettings])
) as Record<string, keyof TablesSettings>;

function parseServerSettings(data: Record<string, unknown> | null): TablesSettings {
  if (!data) return { ...DEFAULTS };
  const result = { ...DEFAULTS };
  for (const [serverKey, localKey] of Object.entries(FROM_SERVER)) {
    if (serverKey in data && data[serverKey] !== undefined && data[serverKey] !== null) {
      (result as Record<string, unknown>)[localKey] = data[serverKey];
    }
  }
  return result;
}

export function useTablesSettingsStore() {
  const queryClient = useQueryClient();

  const { data: serverSettings } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data.data as Record<string, unknown> | null;
    },
    staleTime: 60_000,
  });

  const settings = useMemo(() => parseServerSettings(serverSettings ?? null), [serverSettings]);

  const mutation = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { data } = await api.put('/settings', patch);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
    },
  });

  const updateSetting = useCallback(<K extends keyof TablesSettings>(key: K, value: TablesSettings[K]) => {
    // Optimistic update
    queryClient.setQueryData(queryKeys.settings.all, (old: Record<string, unknown> | null | undefined) => ({
      ...(old ?? {}),
      [TO_SERVER[key]]: value,
    }));
    // Persist to server
    mutation.mutate({ [TO_SERVER[key]]: value });
  }, [queryClient, mutation]);

  return {
    ...settings,
    setDefaultView: useCallback((v: TablesDefaultView) => updateSetting('defaultView', v), [updateSetting]),
    setDefaultSort: useCallback((v: TablesDefaultSort) => updateSetting('defaultSort', v), [updateSetting]),
    setShowFieldTypeIcons: useCallback((v: boolean) => updateSetting('showFieldTypeIcons', v), [updateSetting]),
    setDefaultRowCount: useCallback((v: number) => updateSetting('defaultRowCount', v), [updateSetting]),
    setIncludeRowIdsInExport: useCallback((v: boolean) => updateSetting('includeRowIdsInExport', v), [updateSetting]),
    setDateFormat: useCallback((v: DateFormat) => updateSetting('dateFormat', v), [updateSetting]),
    setCurrencySymbol: useCallback((v: string) => updateSetting('currencySymbol', v), [updateSetting]),
    setTimezone: useCallback((v: string) => updateSetting('timezone', v), [updateSetting]),
  };
}
