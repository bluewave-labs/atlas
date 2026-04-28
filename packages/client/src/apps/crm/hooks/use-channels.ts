import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ifUnmodifiedSince } from '../../../lib/api-client';
import { queryKeys } from '../../../config/query-keys';

export interface ChannelDTO {
  id: string;
  accountId: string;
  tenantId: string;
  ownerUserId: string;
  type: string;
  handle: string;
  visibility: 'private' | 'shared-with-tenant';
  isSyncEnabled: boolean;
  contactAutoCreationPolicy: 'none' | 'send-only' | 'send-and-receive';
  syncStage: string;
  syncStatus: string | null;
  syncError: string | null;
  lastIncrementalSyncAt: string | null;
  throttleRetryAfter: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateChannelPatch {
  visibility?: ChannelDTO['visibility'];
  isSyncEnabled?: boolean;
  contactAutoCreationPolicy?: ChannelDTO['contactAutoCreationPolicy'];
}

export function useChannels() {
  return useQuery({
    queryKey: queryKeys.crm.channels.all,
    queryFn: async () => {
      const { data } = await api.get('/crm/channels');
      return (data.data?.channels ?? []) as ChannelDTO[];
    },
    staleTime: 10_000,
  });
}

export function useUpdateChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; updatedAt?: string; patch: UpdateChannelPatch }) => {
      const { data } = await api.patch(`/crm/channels/${args.id}`, args.patch, ifUnmodifiedSince(args.updatedAt));
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.channels.all });
    },
  });
}

export function useSyncChannel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/crm/channels/${id}/sync`, {});
      return data.data as { jobId: string; queued: boolean };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.channels.all });
    },
  });
}
