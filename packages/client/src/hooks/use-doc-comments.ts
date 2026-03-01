import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { queryKeys } from '../config/query-keys';
import type { DocumentComment, CreateDocCommentInput, Backlink } from '@atlasmail/shared';

export function useDocComments(docId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.docs.comments(docId!),
    queryFn: async () => {
      const { data } = await api.get(`/docs/${docId}/comments`);
      return data.data as DocumentComment[];
    },
    enabled: !!docId,
    staleTime: 15_000,
  });
}

export function useCreateDocComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ docId, ...input }: CreateDocCommentInput & { docId: string }) => {
      const { data } = await api.post(`/docs/${docId}/comments`, input);
      return data.data as DocumentComment;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.docs.comments(vars.docId) });
    },
  });
}

export function useUpdateDocComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, docId, ...input }: { commentId: string; docId: string; content?: string; isResolved?: boolean }) => {
      const { data } = await api.patch(`/docs/comments/${commentId}`, input);
      return data.data as DocumentComment;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.docs.comments(vars.docId) });
    },
  });
}

export function useDeleteDocComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, docId }: { commentId: string; docId: string }) => {
      await api.delete(`/docs/comments/${commentId}`);
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.docs.comments(vars.docId) });
    },
  });
}

export function useResolveDocComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, docId }: { commentId: string; docId: string }) => {
      const { data } = await api.patch(`/docs/comments/${commentId}/resolve`);
      return data.data as DocumentComment;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.docs.comments(vars.docId) });
    },
  });
}

export function useDocBacklinks(docId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.docs.backlinks(docId!),
    queryFn: async () => {
      const { data } = await api.get(`/docs/${docId}/backlinks`);
      return data.data as Backlink[];
    },
    enabled: !!docId,
    staleTime: 60_000,
  });
}
