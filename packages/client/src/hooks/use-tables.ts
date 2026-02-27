import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { queryKeys } from '../config/query-keys';
import type { Spreadsheet, CreateSpreadsheetInput, UpdateSpreadsheetInput } from '@atlasmail/shared';
import { useCallback, useRef } from 'react';

// ─── Queries ─────────────────────────────────────────────────────────

interface ListSpreadsheetsResponse {
  spreadsheets: Spreadsheet[];
}

export function useTableList(includeArchived = false, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: includeArchived ? [...queryKeys.tables.list, 'archived'] : queryKeys.tables.list,
    queryFn: async () => {
      const params = includeArchived ? '?includeArchived=true' : '';
      const { data } = await api.get(`/tables${params}`);
      return data.data as ListSpreadsheetsResponse;
    },
    staleTime: 30_000,
    enabled: options?.enabled,
  });
}

export function useTable(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tables.detail(id!),
    queryFn: async () => {
      const { data } = await api.get(`/tables/${id}`);
      return data.data as Spreadsheet;
    },
    enabled: !!id,
    staleTime: 10_000,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────

export function useCreateTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateSpreadsheetInput) => {
      const { data } = await api.post('/tables', input);
      return data.data as Spreadsheet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all });
    },
  });
}

export function useUpdateTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: UpdateSpreadsheetInput & { id: string }) => {
      const { data } = await api.patch(`/tables/${id}`, input);
      return data.data as Spreadsheet;
    },
    onSuccess: (spreadsheet) => {
      queryClient.setQueryData(queryKeys.tables.detail(spreadsheet.id), spreadsheet);
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.list });
    },
  });
}

export function useDeleteTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tables/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all });
    },
  });
}

export function useRestoreTable() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/tables/${id}/restore`);
      return data.data as Spreadsheet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all });
    },
  });
}

// ─── Auto-save hook ──────────────────────────────────────────────────

export function useAutoSaveTable(delay = 2000) {
  const updateMutation = useUpdateTable();
  const mutateRef = useRef(updateMutation.mutate);
  mutateRef.current = updateMutation.mutate;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    (id: string, input: UpdateSpreadsheetInput) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        mutateRef.current({ id, ...input });
      }, delay);
    },
    [delay],
  );

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { save, flush, isSaving: updateMutation.isPending };
}
