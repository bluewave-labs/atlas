import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';
import type {
  SignatureDocument,
  SignatureField,
  SigningToken,
} from '@atlasmail/shared';
import axios from 'axios';
import { config } from '../../config/env';

// ─── Queries ─────────────────────────────────────────────────────────

export function useSignDocuments() {
  return useQuery({
    queryKey: queryKeys.sign.list,
    queryFn: async () => {
      const { data } = await api.get('/sign');
      return data.data.documents as SignatureDocument[];
    },
    staleTime: 10_000,
  });
}

export function useSignDocument(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.sign.detail(id!),
    queryFn: async () => {
      const { data } = await api.get(`/sign/${id}`);
      return data.data as SignatureDocument;
    },
    enabled: !!id,
    staleTime: 10_000,
  });
}

export function useSignFields(docId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.sign.fields(docId!),
    queryFn: async () => {
      const { data } = await api.get(`/sign/${docId}/fields`);
      return data.data.fields as SignatureField[];
    },
    enabled: !!docId,
    staleTime: 10_000,
  });
}

export function useSigningLinks(docId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.sign.tokens(docId!),
    queryFn: async () => {
      const { data } = await api.get(`/sign/${docId}/tokens`);
      return data.data.tokens as SigningToken[];
    },
    enabled: !!docId,
    staleTime: 10_000,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────

export function useCreateSignDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post('/sign/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data as SignatureDocument;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sign.all });
    },
  });
}

export function useUpdateSignDoc(id: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Partial<Pick<SignatureDocument, 'title' | 'status' | 'tags' | 'pageCount'>>) => {
      const { data } = await api.put(`/sign/${id}`, input);
      return data.data as SignatureDocument;
    },
    onSuccess: (doc) => {
      queryClient.setQueryData(queryKeys.sign.detail(doc.id), doc);
      queryClient.invalidateQueries({ queryKey: queryKeys.sign.list });
    },
  });
}

export function useDeleteSignDoc() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/sign/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sign.all });
    },
  });
}

export function useCreateField(docId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<SignatureField, 'id' | 'documentId' | 'signedAt' | 'signatureData' | 'createdAt' | 'updatedAt'> & { documentId?: string }) => {
      const { data } = await api.post(`/sign/${docId}/fields`, input);
      return data.data as SignatureField;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sign.fields(docId!) });
    },
  });
}

export function useUpdateField(docId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fieldId, ...input }: { fieldId: string } & Partial<SignatureField>) => {
      const { data } = await api.put(`/sign/fields/${fieldId}`, input);
      return data.data as SignatureField;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sign.fields(docId!) });
    },
  });
}

export function useDeleteField(docId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fieldId: string) => {
      await api.delete(`/sign/fields/${fieldId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sign.fields(docId!) });
    },
  });
}

export function useCreateSigningLink(docId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { email: string; name?: string; expiresInDays?: number }) => {
      const { data } = await api.post(`/sign/${docId}/tokens`, input);
      return data.data as SigningToken;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sign.tokens(docId!) });
    },
  });
}

// ─── Public (no auth) ────────────────────────────────────────────────

export function usePublicSignDoc(token: string | undefined) {
  return useQuery({
    queryKey: ['sign', 'public', token],
    queryFn: async () => {
      const { data } = await axios.get(`${config.apiUrl}/sign/public/${token}`);
      return data.data as {
        token: {
          id: string;
          signerEmail: string;
          signerName: string | null;
          status: string;
          expiresAt: string;
        };
        document: {
          id: string;
          title: string;
          fileName: string;
          pageCount: number;
          status: string;
        };
        fields: SignatureField[];
      };
    },
    enabled: !!token,
    staleTime: 30_000,
    retry: false,
  });
}

export async function submitPublicSign(
  token: string,
  fieldId: string,
  signatureData: string,
) {
  const { data } = await axios.post(`${config.apiUrl}/sign/public/${token}/sign`, {
    fieldId,
    signatureData,
  });
  return data.data as { field: SignatureField; documentComplete: boolean };
}
