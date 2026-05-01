import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { queryKeys } from '../../../config/query-keys';

export interface TenantSettings {
  gmailRetentionDays: number | null;
}

export function useTenantSettings() {
  return useQuery({
    queryKey: queryKeys.crm.tenantSettings.all,
    queryFn: async () => {
      const { data } = await api.get('/crm/settings');
      return data.data as TenantSettings;
    },
    staleTime: 30_000,
  });
}

export function useUpdateRetention() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (gmailRetentionDays: number | null): Promise<TenantSettings> => {
      const { data } = await api.patch('/crm/settings/retention', { gmailRetentionDays });
      return data.data as TenantSettings;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.tenantSettings.all });
    },
  });
}
