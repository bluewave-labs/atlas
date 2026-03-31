import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api-client';

export interface AppPermission {
  role: 'admin' | 'editor' | 'viewer';
  recordAccess: 'all' | 'own';
}

export function useMyAppPermission(appId: string) {
  return useQuery({
    queryKey: ['permissions', appId, 'me'],
    queryFn: async () => {
      const { data } = await api.get(`/permissions/${appId}/me`);
      return data.data as AppPermission;
    },
    staleTime: 60_000,
  });
}
