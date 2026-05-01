import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { queryKeys } from '../../../config/query-keys';

export interface BlocklistEntry {
  id: string;
  pattern: string;
  createdAt: string;
}

export function useBlocklist() {
  return useQuery({
    queryKey: queryKeys.crm.blocklist.all,
    queryFn: async () => {
      const { data } = await api.get('/crm/blocklist');
      return data.data as BlocklistEntry[];
    },
    staleTime: 30_000,
  });
}

export function useDeleteBlocklistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/crm/blocklist/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.blocklist.all });
    },
  });
}

export function useAddBlocklistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pattern: string): Promise<{ pattern: string }> => {
      const { data } = await api.post('/crm/blocklist', { pattern });
      return data.data as { pattern: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.blocklist.all });
    },
  });
}
