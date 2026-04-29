import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { queryKeys } from '../../../config/query-keys';

export function useBlockSender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (pattern: string): Promise<{ pattern: string }> => {
      const { data } = await api.post('/crm/blocklist', { pattern });
      return data.data as { pattern: string };
    },
    onSuccess: () => {
      // Future inbound from this sender won't auto-create contacts; refresh
      // the activity feed in case the user re-checks immediately.
      qc.invalidateQueries({ queryKey: queryKeys.crm.activities.all });
    },
  });
}
