import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { queryKeys } from '../../../config/query-keys';

export interface MessageDTO {
  id: string;
  channelId: string;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  status: string;
  threadId: string;
  headerMessageId: string | null;
  direction: 'inbound' | 'outbound';
  sentAt: string | null;
  fromHandle: string | null;
}

export function useMessage(messageId: string | null) {
  return useQuery({
    queryKey: queryKeys.crm.messages.detail(messageId ?? 'none'),
    queryFn: async () => {
      if (!messageId) return null;
      const { data } = await api.get(`/crm/messages/${messageId}`);
      return data.data as MessageDTO;
    },
    enabled: !!messageId,
    staleTime: 30_000,
  });
}

export interface SendMessageInput {
  channelId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  inReplyTo?: string;
  threadId?: string;
}

export interface SendMessageResult {
  messageId: string;
  status: 'pending' | 'sent' | 'failed';
}

export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendMessageInput): Promise<SendMessageResult> => {
      const { data } = await api.post('/crm/messages/send', input);
      return data.data as SendMessageResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.activities.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.messages.all });
    },
  });
}

export function useRetryMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string): Promise<{ messageId: string; queued: boolean }> => {
      const { data } = await api.post(`/crm/messages/${messageId}/retry`, {});
      return data.data as { messageId: string; queued: boolean };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.activities.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.messages.all });
    },
  });
}
