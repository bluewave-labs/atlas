import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { queryKeys } from '../config/query-keys';
import type { Drawing, CreateDrawingInput, UpdateDrawingInput } from '@atlasmail/shared';
import { useCallback, useRef } from 'react';

// ─── Queries ─────────────────────────────────────────────────────────

interface ListDrawingsResponse {
  drawings: Drawing[];
}

export function useDrawingList(includeArchived = false, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: includeArchived ? [...queryKeys.drawings.list, 'archived'] : queryKeys.drawings.list,
    queryFn: async () => {
      const params = includeArchived ? '?includeArchived=true' : '';
      const { data } = await api.get(`/drawings${params}`);
      return data.data as ListDrawingsResponse;
    },
    staleTime: 30_000,
    enabled: options?.enabled,
  });
}

export function useDrawing(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.drawings.detail(id!),
    queryFn: async () => {
      const { data } = await api.get(`/drawings/${id}`);
      return data.data as Drawing;
    },
    enabled: !!id,
    staleTime: 10_000,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────

export function useCreateDrawing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateDrawingInput) => {
      const { data } = await api.post('/drawings', input);
      return data.data as Drawing;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drawings.all });
    },
  });
}

export function useUpdateDrawing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: UpdateDrawingInput & { id: string }) => {
      const { data } = await api.patch(`/drawings/${id}`, input);
      return data.data as Drawing;
    },
    onSuccess: (drawing) => {
      queryClient.setQueryData(queryKeys.drawings.detail(drawing.id), drawing);
      queryClient.invalidateQueries({ queryKey: queryKeys.drawings.list });
    },
  });
}

export function useDeleteDrawing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/drawings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drawings.all });
    },
  });
}

export function useRestoreDrawing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/drawings/${id}/restore`);
      return data.data as Drawing;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drawings.all });
    },
  });
}

export function useDuplicateDrawing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data: original } = await api.get(`/drawings/${id}`);
      const drawing = original.data as Drawing;
      const { data: created } = await api.post('/drawings', {
        title: `${drawing.title} (copy)`,
        content: drawing.content,
      });
      return created.data as Drawing;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drawings.all });
    },
  });
}

// ─── Auto-save hook ──────────────────────────────────────────────────

/**
 * Returns a debounced save function that auto-saves drawing updates.
 * Calls are debounced by `delay` ms (default 2000ms for larger payloads).
 */
export function useAutoSaveDrawing(delay = 2000) {
  const updateMutation = useUpdateDrawing();
  const mutateRef = useRef(updateMutation.mutate);
  mutateRef.current = updateMutation.mutate;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    (id: string, input: UpdateDrawingInput) => {
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
