import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { queryKeys } from '../../../config/query-keys';

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
