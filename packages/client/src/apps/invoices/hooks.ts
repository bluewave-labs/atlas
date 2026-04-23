import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';
import type {
  Invoice,
  InvoiceSettings,
  InvoicePayment,
  RecordPaymentInput,
  UpdateInvoiceSettingsInput,
  RecurringInvoice,
  CreateRecurringInvoiceInput,
  UpdateRecurringInvoiceInput,
} from '@atlas-platform/shared';

// ─── Dashboard ──────────────────────────────────────────────────

export function useInvoicesDashboard() {
  return useQuery({
    queryKey: queryKeys.invoices.dashboard,
    queryFn: async () => {
      const { data } = await api.get('/invoices/dashboard');
      return data.data as {
        receivables: {
          total: number;
          current: number;
          overdue1to15: number;
          overdue16to30: number;
          overdue31to45: number;
          overdue45plus: number;
        };
        monthlyActivity: Array<{
          month: string;
          invoiced: number;
          paid: number;
        }>;
        periodSummary: {
          today: { invoiced: number; received: number; due: number };
          thisWeek: { invoiced: number; received: number; due: number };
          thisMonth: { invoiced: number; received: number; due: number };
          thisQuarter: { invoiced: number; received: number; due: number };
          thisYear: { invoiced: number; received: number; due: number };
        };
      };
    },
    staleTime: 30_000,
  });
}

// ─── Invoice Queries ─────────────────────────────────────────────

export function useInvoices(filters?: {
  companyId?: string;
  dealId?: string;
  status?: string;
  search?: string;
  includeArchived?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.invoices.list(filters as Record<string, unknown> | undefined),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.companyId) params.set('companyId', filters.companyId);
      if (filters?.dealId) params.set('dealId', filters.dealId);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.includeArchived) params.set('includeArchived', 'true');
      const qs = params.toString();
      const { data } = await api.get(`/invoices/list${qs ? `?${qs}` : ''}`);
      return data.data as { invoices: Invoice[] };
    },
    staleTime: 15_000,
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.invoices.detail(id!),
    queryFn: async () => {
      const { data } = await api.get(`/invoices/${id}`);
      return data.data as Invoice;
    },
    enabled: !!id,
    staleTime: 10_000,
  });
}

// ─── Invoice Mutations ───────────────────────────────────────────

export function useCreateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      companyId: string;
      contactId?: string;
      dealId?: string;
      proposalId?: string;
      currency?: string;
      issueDate: string;
      dueDate: string;
      lineItems: Array<{ description: string; quantity: number; unitPrice: number; taxRate?: number }>;
      taxPercent?: number;
      discountPercent?: number;
      notes?: string | null;
      eFaturaType?: string;
    }) => {
      const { data } = await api.post('/invoices', input);
      return data.data as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

export function useUpdateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updatedAt, ...input }: { id: string; updatedAt?: string } & Partial<{
      companyId: string;
      contactId: string | null;
      dealId: string | null;
      currency: string;
      issueDate: string;
      dueDate: string;
      lineItems: Array<{ description: string; quantity: number; unitPrice: number; taxRate?: number }>;
      taxPercent: number;
      discountPercent: number;
      notes: string | null;
      eFaturaType: string;
      excludeFromAutoReminders: boolean;
    }>) => {
      const { data } = await api.patch(`/invoices/${id}`, input, {
        headers: updatedAt ? { 'If-Unmodified-Since': updatedAt } : undefined,
      });
      return data.data as Invoice;
    },
    onSuccess: (invoice) => {
      queryClient.setQueryData(queryKeys.invoices.detail(invoice.id), invoice);
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

export function useDeleteInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

export interface SendInvoiceBody {
  customSubject?: string;
  customMessage?: string;
  ccEmails?: string[];
  skipEmail?: boolean;
}

export interface SendInvoiceResponse {
  invoice: Invoice;
  emailSent: boolean;
  reason?: string;
  recipient?: string;
}

export function useSendInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body?: SendInvoiceBody }) => {
      const { data } = await api.post(`/invoices/${id}/send`, body ?? {});
      return data.data as SendInvoiceResponse;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.invoices.detail(result.invoice.id), result.invoice);
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

export interface EmailInvoiceBody {
  customSubject?: string;
  customMessage?: string;
  ccEmails?: string[];
  recipientOverride?: string;
}

export function useEmailInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body?: EmailInvoiceBody }) => {
      const { data } = await api.post(`/invoices/${id}/email`, body ?? {});
      return data.data as SendInvoiceResponse;
    },
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.invoices.detail(result.invoice.id), result.invoice);
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

export function useMarkInvoicePaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/invoices/${id}/paid`);
      return data.data as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

export function useWaiveInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/invoices/${id}/waive`);
      return data.data as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

export function useDuplicateInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/invoices/${id}/duplicate`);
      return data.data as Invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

// ─── Payments ────────────────────────────────────────────────────

export function useRecordPayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      invoiceId: string;
      type: 'payment' | 'refund';
      amount: number;
      paymentDate: string;
      method?: string;
      reference?: string;
      notes?: string;
    }) => {
      const { invoiceId, ...body } = input;
      const { data } = await api.post(`/invoices/${invoiceId}/payments`, body);
      return data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(variables.invoiceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

export function useInvoicePayments(invoiceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.invoices.payments(invoiceId ?? ''),
    queryFn: async () => {
      const { data } = await api.get(`/invoices/${invoiceId}/payments`);
      return data.data as InvoicePayment[];
    },
    enabled: !!invoiceId,
    staleTime: 10_000,
  });
}

export function useUpdatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { paymentId: string; invoiceId: string; body: Partial<RecordPaymentInput> }) => {
      const { data } = await api.patch(`/invoices/payments/${input.paymentId}`, input.body);
      return data.data as InvoicePayment;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.payments(variables.invoiceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(variables.invoiceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

export function useDeletePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { paymentId: string; invoiceId: string }) => {
      const { data } = await api.delete(`/invoices/payments/${input.paymentId}`);
      return data.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.payments(variables.invoiceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.detail(variables.invoiceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

// ─── Settings ────────────────────────────────────────────────────

export function useInvoiceSettings() {
  return useQuery({
    queryKey: queryKeys.invoices.settings,
    queryFn: async () => {
      const { data } = await api.get('/invoices/settings');
      return data.data as InvoiceSettings;
    },
    staleTime: 60_000,
  });
}

export function useUpdateInvoiceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateInvoiceSettingsInput) => {
      const { data } = await api.patch('/invoices/settings', input);
      return data.data as InvoiceSettings;
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.invoices.settings, settings);
    },
  });
}

// ─── Next Invoice Number ─────────────────────────────────────────

/**
 * WARNING: This hook is currently unused. Do NOT add callers without careful
 * consideration — calling GET /invoices/next-number increments the invoice
 * counter on every request, permanently burning a sequence number even if the
 * invoice is never saved. Use the server-side getNextInvoiceNumber() inside a
 * transaction at invoice-creation time instead.
 */
export function useNextInvoiceNumber() {
  return useQuery({
    queryKey: queryKeys.invoices.nextNumber,
    queryFn: async () => {
      const { data } = await api.get('/invoices/next-number');
      return data.data as { invoiceNumber: string };
    },
    staleTime: 5_000,
  });
}

// ─── E-Fatura ────────────────────────────────────────────────────

// ─── Recurring Invoices ──────────────────────────────────────────

export function useRecurringInvoicesList() {
  return useQuery({
    queryKey: queryKeys.invoices.recurringList,
    queryFn: async () => {
      const { data } = await api.get('/invoices/recurring');
      return data.data as RecurringInvoice[];
    },
    staleTime: 10_000,
  });
}

export function useRecurringInvoice(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.invoices.recurringDetail(id ?? ''),
    queryFn: async () => {
      const { data } = await api.get(`/invoices/recurring/${id}`);
      return data.data as RecurringInvoice;
    },
    enabled: !!id,
  });
}

export function useCreateRecurringInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateRecurringInvoiceInput) => {
      const { data } = await api.post('/invoices/recurring', input);
      return data.data as RecurringInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.recurringList });
    },
  });
}

export function useUpdateRecurringInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; body: UpdateRecurringInvoiceInput; updatedAt?: string }) => {
      const { data } = await api.patch(`/invoices/recurring/${input.id}`, input.body, {
        headers: input.updatedAt ? { 'If-Unmodified-Since': input.updatedAt } : undefined,
      });
      return data.data as RecurringInvoice;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.recurringList });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.recurringDetail(variables.id) });
    },
  });
}

export function useDeleteRecurringInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/invoices/recurring/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.recurringList });
    },
  });
}

export function usePauseRecurringInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/invoices/recurring/${id}/pause`);
      return data.data as RecurringInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.recurringList });
    },
  });
}

export function useResumeRecurringInvoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/invoices/recurring/${id}/resume`);
      return data.data as RecurringInvoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.recurringList });
    },
  });
}

export function useRunRecurringInvoiceNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/invoices/recurring/${id}/run-now`);
      return data.data as { invoiceId: string; emailed: boolean; deactivated: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.recurringList });
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}

export function useGenerateEFatura() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data } = await api.post(`/invoices/${invoiceId}/efatura/generate`);
      return data.data as Invoice;
    },
    onSuccess: (invoice) => {
      queryClient.setQueryData(queryKeys.invoices.detail(invoice.id), invoice);
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all });
    },
  });
}
