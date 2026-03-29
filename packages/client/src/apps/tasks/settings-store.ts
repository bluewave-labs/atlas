import { useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';

export type TaskDefaultView = 'inbox' | 'today' | 'anytime';
export type TaskCompletedBehavior = 'fade' | 'move' | 'hide';
export type TaskSortOrder = 'manual' | 'priority' | 'dueDate' | 'title' | 'created';
export type TaskViewMode = 'list' | 'board';

interface TasksSettings {
  defaultView: TaskDefaultView;
  confirmBeforeDelete: boolean;
  showCalendarInToday: boolean;
  showEveningSection: boolean;
  showWhenBadges: boolean;
  showProjectInList: boolean;
  showNotesIndicator: boolean;
  compactMode: boolean;
  completedBehavior: TaskCompletedBehavior;
  defaultSortOrder: TaskSortOrder;
  viewMode: TaskViewMode;
}

const DEFAULTS: TasksSettings = {
  defaultView: 'inbox',
  confirmBeforeDelete: true,
  showCalendarInToday: true,
  showEveningSection: true,
  showWhenBadges: true,
  showProjectInList: true,
  showNotesIndicator: true,
  compactMode: false,
  completedBehavior: 'fade',
  defaultSortOrder: 'manual',
  viewMode: 'list',
};

// Map from our local field names to server column names
const TO_SERVER: Record<keyof TasksSettings, string> = {
  defaultView: 'tasksDefaultView',
  confirmBeforeDelete: 'tasksConfirmDelete',
  showCalendarInToday: 'tasksShowCalendar',
  showEveningSection: 'tasksShowEvening',
  showWhenBadges: 'tasksShowWhenBadges',
  showProjectInList: 'tasksShowProject',
  showNotesIndicator: 'tasksShowNotesIndicator',
  compactMode: 'tasksCompactMode',
  completedBehavior: 'tasksCompletedBehavior',
  defaultSortOrder: 'tasksDefaultSort',
  viewMode: 'tasksViewMode',
};

// Map from server column names to our local field names
const FROM_SERVER: Record<string, keyof TasksSettings> = Object.fromEntries(
  Object.entries(TO_SERVER).map(([local, server]) => [server, local as keyof TasksSettings])
) as Record<string, keyof TasksSettings>;

function parseServerSettings(data: Record<string, unknown> | null): TasksSettings {
  if (!data) return { ...DEFAULTS };
  const result = { ...DEFAULTS };
  for (const [serverKey, localKey] of Object.entries(FROM_SERVER)) {
    if (serverKey in data && data[serverKey] !== undefined && data[serverKey] !== null) {
      (result as Record<string, unknown>)[localKey] = data[serverKey];
    }
  }
  return result;
}

export function useTasksSettingsStore() {
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

  const updateSetting = useCallback(<K extends keyof TasksSettings>(key: K, value: TasksSettings[K]) => {
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
    setDefaultView: useCallback((v: TaskDefaultView) => updateSetting('defaultView', v), [updateSetting]),
    setConfirmBeforeDelete: useCallback((v: boolean) => updateSetting('confirmBeforeDelete', v), [updateSetting]),
    setShowCalendarInToday: useCallback((v: boolean) => updateSetting('showCalendarInToday', v), [updateSetting]),
    setShowEveningSection: useCallback((v: boolean) => updateSetting('showEveningSection', v), [updateSetting]),
    setShowWhenBadges: useCallback((v: boolean) => updateSetting('showWhenBadges', v), [updateSetting]),
    setShowProjectInList: useCallback((v: boolean) => updateSetting('showProjectInList', v), [updateSetting]),
    setShowNotesIndicator: useCallback((v: boolean) => updateSetting('showNotesIndicator', v), [updateSetting]),
    setCompactMode: useCallback((v: boolean) => updateSetting('compactMode', v), [updateSetting]),
    setCompletedBehavior: useCallback((v: TaskCompletedBehavior) => updateSetting('completedBehavior', v), [updateSetting]),
    setDefaultSortOrder: useCallback((v: TaskSortOrder) => updateSetting('defaultSortOrder', v), [updateSetting]),
    setViewMode: useCallback((v: TaskViewMode) => updateSetting('viewMode', v), [updateSetting]),
  };
}
