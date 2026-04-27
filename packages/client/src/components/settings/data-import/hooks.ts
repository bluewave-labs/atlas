import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import type { OdooImportPreview, OdooImportSummary } from '@atlas-platform/shared';

export interface OdooImportPreviewInput {
  partners: File;
  leads?: File;
  activities?: File;
}

export function useOdooImportPreview() {
  return useMutation({
    mutationFn: async (input: OdooImportPreviewInput): Promise<OdooImportPreview> => {
      const form = new FormData();
      form.append('partners', input.partners);
      if (input.leads) form.append('leads', input.leads);
      if (input.activities) form.append('activities', input.activities);
      const { data } = await api.post('/system/importers/odoo/preview', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data.data as OdooImportPreview;
    },
  });
}

export interface OdooImportCommitInput {
  sessionId: string;
  stageMapping: Record<string, string>;
}

export function useOdooImportCommit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: OdooImportCommitInput): Promise<OdooImportSummary> => {
      const { data } = await api.post('/system/importers/odoo/commit', input);
      return data.data as OdooImportSummary;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm'] });
    },
  });
}
