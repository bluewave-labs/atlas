import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { queryKeys } from '../config/query-keys';
import type { ContactByEmailResponse } from '@atlasmail/shared';

export function useContactByEmail(email: string | null) {
  return useQuery({
    queryKey: queryKeys.contacts.byEmail(email!),
    queryFn: async () => {
      const { data } = await api.get(`/contacts/by-email/${encodeURIComponent(email!)}`);
      return data.data as ContactByEmailResponse;
    },
    enabled: !!email,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateContactNotes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, notes }: { email: string; notes: string }) => {
      await api.patch(`/contacts/by-email/${encodeURIComponent(email)}/notes`, { notes });
    },
    onMutate: async ({ email, notes }) => {
      const key = queryKeys.contacts.byEmail(email);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ContactByEmailResponse>(key);
      if (previous?.contact) {
        queryClient.setQueryData<ContactByEmailResponse>(key, {
          ...previous,
          contact: { ...previous.contact, notes },
        });
      }
      return { previous, key };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.contacts.byEmail(variables.email),
      });
    },
  });
}
