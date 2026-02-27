import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { queryKeys } from '../config/query-keys';
import type {
  Document,
  DocumentTreeNode,
  CreateDocumentInput,
  UpdateDocumentInput,
  MoveDocumentInput,
} from '@atlasmail/shared';
import { useCallback, useRef } from 'react';

// ─── Queries ─────────────────────────────────────────────────────────

interface ListDocsResponse {
  documents: Array<{
    id: string;
    parentId: string | null;
    title: string;
    icon: string | null;
    sortOrder: number;
    isArchived: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  tree: DocumentTreeNode[];
}

export function useDocumentList(includeArchived = false, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: includeArchived ? [...queryKeys.docs.list, 'archived'] : queryKeys.docs.list,
    queryFn: async () => {
      const params = includeArchived ? '?includeArchived=true' : '';
      const { data } = await api.get(`/docs${params}`);
      return data.data as ListDocsResponse;
    },
    staleTime: 30_000,
    enabled: options?.enabled,
  });
}

export function useDocument(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.docs.detail(id!),
    queryFn: async () => {
      const { data } = await api.get(`/docs/${id}`);
      return data.data as Document;
    },
    enabled: !!id,
    staleTime: 10_000,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────

export function useCreateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateDocumentInput) => {
      const { data } = await api.post('/docs', input);
      return data.data as Document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.docs.all });
    },
  });
}

export function useUpdateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: UpdateDocumentInput & { id: string }) => {
      const { data } = await api.patch(`/docs/${id}`, input);
      return data.data as Document;
    },
    onSuccess: (doc) => {
      queryClient.setQueryData(queryKeys.docs.detail(doc.id), doc);
      queryClient.invalidateQueries({ queryKey: queryKeys.docs.list });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/docs/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.docs.all });
    },
  });
}

export function useMoveDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: MoveDocumentInput & { id: string }) => {
      const { data } = await api.patch(`/docs/${id}/move`, input);
      return data.data as Document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.docs.all });
    },
  });
}

export function useDuplicateDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Fetch the original document, then create a copy
      const { data: original } = await api.get(`/docs/${id}`);
      const doc = original.data as Document;
      const { data: created } = await api.post('/docs', {
        parentId: doc.parentId,
        title: `${doc.title} (copy)`,
        icon: doc.icon,
        content: doc.content,
      });
      return created.data as Document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.docs.all });
    },
  });
}

export function useRestoreDocument() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/docs/${id}/restore`);
      return data.data as Document;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.docs.all });
    },
  });
}

// ─── Search ─────────────────────────────────────────────────────────

export function useDocumentSearch(query: string) {
  return useQuery({
    queryKey: ['docs', 'search', query],
    queryFn: async () => {
      const { data } = await api.get(`/docs/search?q=${encodeURIComponent(query)}`);
      return data.data as Array<{
        id: string;
        parentId: string | null;
        title: string;
        icon: string | null;
        sortOrder: number;
        isArchived: boolean;
        createdAt: string;
        updatedAt: string;
      }>;
    },
    enabled: query.trim().length >= 2,
    staleTime: 5_000,
  });
}

// ─── Version history ────────────────────────────────────────────────

interface DocumentVersion {
  id: string;
  documentId: string;
  accountId: string;
  title: string;
  content: Record<string, unknown> | null;
  createdAt: string;
}

export function useDocumentVersions(documentId: string | undefined) {
  return useQuery({
    queryKey: ['docs', 'versions', documentId],
    queryFn: async () => {
      const { data } = await api.get(`/docs/${documentId}/versions`);
      return data.data as DocumentVersion[];
    },
    enabled: !!documentId,
    staleTime: 10_000,
  });
}

export function useCreateVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (documentId: string) => {
      const { data } = await api.post(`/docs/${documentId}/versions`);
      return data.data as DocumentVersion;
    },
    onSuccess: (version) => {
      queryClient.invalidateQueries({ queryKey: ['docs', 'versions', version.documentId] });
    },
  });
}

export function useRestoreVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ documentId, versionId }: { documentId: string; versionId: string }) => {
      const { data } = await api.post(`/docs/${documentId}/versions/${versionId}/restore`);
      return data.data as Document;
    },
    onSuccess: (doc) => {
      queryClient.setQueryData(queryKeys.docs.detail(doc.id), doc);
      queryClient.invalidateQueries({ queryKey: queryKeys.docs.all });
      queryClient.invalidateQueries({ queryKey: ['docs', 'versions', doc.id] });
    },
  });
}

// ─── Auto-save hook ──────────────────────────────────────────────────

/**
 * Returns a debounced save function that auto-saves document updates.
 * Calls are debounced by `delay` ms (default 1000ms).
 */
export function useAutoSaveDocument(delay = 1000) {
  const updateMutation = useUpdateDocument();
  const mutateRef = useRef(updateMutation.mutate);
  mutateRef.current = updateMutation.mutate;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(
    (id: string, input: UpdateDocumentInput) => {
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
