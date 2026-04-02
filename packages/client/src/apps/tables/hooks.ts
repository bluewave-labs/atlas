import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';
import type { Spreadsheet, CreateSpreadsheetInput, UpdateSpreadsheetInput } from '@atlasmail/shared';
import { useCallback, useEffect, useRef } from 'react';

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
    enabled: options?.enabled ?? true,
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
    retry: (failureCount, error) => {
      // Don't retry on 404 — the table doesn't exist
      if ((error as any)?.response?.status === 404) return false;
      return failureCount < 3;
    },
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
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.all });
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
  const lastInputRef = useRef<{ id: string } & UpdateSpreadsheetInput | null>(null);

  const save = useCallback(
    (id: string, input: UpdateSpreadsheetInput) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      lastInputRef.current = { id, ...input };
      timerRef.current = setTimeout(() => {
        if (lastInputRef.current) {
          mutateRef.current(lastInputRef.current);
          lastInputRef.current = null;
        }
      }, delay);
    },
    [delay],
  );

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (lastInputRef.current) {
      mutateRef.current(lastInputRef.current);
      lastInputRef.current = null;
    }
  }, []);

  // Cleanup on unmount — flush pending save
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (lastInputRef.current) {
        mutateRef.current(lastInputRef.current);
        lastInputRef.current = null;
      }
    };
  }, []);

  return { save, flush, isSaving: updateMutation.isPending, isSuccess: updateMutation.isSuccess };
}

// ─── Linked Records ─────────────────────────────────────────────────

export function useTableForLinking(tableId: string | undefined) {
  return useQuery({
    queryKey: [...queryKeys.tables.detail(tableId!), 'linking'],
    queryFn: async () => {
      const { data } = await api.get(`/tables/${tableId}`);
      return data.data as Spreadsheet;
    },
    enabled: !!tableId,
    staleTime: 30_000,
  });
}

// ─── Row Comments ───────────────────────────────────────────────────

interface RowComment {
  id: string;
  spreadsheetId: string;
  rowId: string;
  accountId: string;
  userId: string;
  body: string;
  userName: string | null;
  userEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export function useRowComments(spreadsheetId: string | undefined, rowId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.tables.rowComments(spreadsheetId!, rowId!),
    queryFn: async () => {
      const { data } = await api.get(`/tables/${spreadsheetId}/rows/${rowId}/comments`);
      return data.data as RowComment[];
    },
    enabled: !!spreadsheetId && !!rowId,
    staleTime: 10_000,
  });
}

export function useCreateRowComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ spreadsheetId, rowId, body }: { spreadsheetId: string; rowId: string; body: string }) => {
      const { data } = await api.post(`/tables/${spreadsheetId}/rows/${rowId}/comments`, { body });
      return data.data as RowComment;
    },
    onSuccess: (comment) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.rowComments(comment.spreadsheetId, comment.rowId) });
    },
  });
}

export function useDeleteRowComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ commentId, spreadsheetId, rowId }: { commentId: string; spreadsheetId: string; rowId: string }) => {
      await api.delete(`/tables/comments/${commentId}`);
      return { spreadsheetId, rowId };
    },
    onSuccess: ({ spreadsheetId, rowId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tables.rowComments(spreadsheetId, rowId) });
    },
  });
}
