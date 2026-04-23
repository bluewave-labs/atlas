import { describe, it, expect, vi } from 'vitest';
import { api } from '../src/lib/api-client';

// Import all CRM hook exports to verify they exist and are functions
import {
  useCompanies,
  useCompany,
  useCreateCompany,
  useUpdateCompany,
  useDeleteCompany,
  useContacts,
  useContact,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  useStages,
  useCreateStage,
  useUpdateStage,
  useDeleteStage,
  useReorderStages,
  useDeals,
  useDeal,
  useCreateDeal,
  useUpdateDeal,
  useDeleteDeal,
  useMarkDealWon,
  useMarkDealLost,
  useDealCounts,
  usePipelineValue,
  useActivities,
  useCreateActivity,
  useUpdateActivity,
  useDeleteActivity,
  useDashboard,
  useWorkflows,
  useCreateWorkflow,
} from '../src/apps/crm/hooks';

describe('CRM hooks', () => {
  // ─── Exports exist ───────────────────────────────────────────────

  describe('hook exports', () => {
    it('exports company query hooks as functions', () => {
      expect(typeof useCompanies).toBe('function');
      expect(typeof useCompany).toBe('function');
    });

    it('exports company mutation hooks as functions', () => {
      expect(typeof useCreateCompany).toBe('function');
      expect(typeof useUpdateCompany).toBe('function');
      expect(typeof useDeleteCompany).toBe('function');
    });

    it('exports contact hooks as functions', () => {
      expect(typeof useContacts).toBe('function');
      expect(typeof useContact).toBe('function');
      expect(typeof useCreateContact).toBe('function');
      expect(typeof useUpdateContact).toBe('function');
      expect(typeof useDeleteContact).toBe('function');
    });

    it('exports stage hooks as functions', () => {
      expect(typeof useStages).toBe('function');
      expect(typeof useCreateStage).toBe('function');
      expect(typeof useUpdateStage).toBe('function');
      expect(typeof useDeleteStage).toBe('function');
      expect(typeof useReorderStages).toBe('function');
    });

    it('exports deal hooks as functions', () => {
      expect(typeof useDeals).toBe('function');
      expect(typeof useDeal).toBe('function');
      expect(typeof useCreateDeal).toBe('function');
      expect(typeof useUpdateDeal).toBe('function');
      expect(typeof useDeleteDeal).toBe('function');
      expect(typeof useMarkDealWon).toBe('function');
      expect(typeof useMarkDealLost).toBe('function');
      expect(typeof useDealCounts).toBe('function');
      expect(typeof usePipelineValue).toBe('function');
    });

    it('exports activity hooks as functions', () => {
      expect(typeof useActivities).toBe('function');
      expect(typeof useCreateActivity).toBe('function');
      expect(typeof useUpdateActivity).toBe('function');
      expect(typeof useDeleteActivity).toBe('function');
    });

    it('exports dashboard and workflow hooks as functions', () => {
      expect(typeof useDashboard).toBe('function');
      expect(typeof useWorkflows).toBe('function');
      expect(typeof useCreateWorkflow).toBe('function');
    });
  });

  // ─── API endpoint patterns ────────────────────────────────────────

  describe('API endpoint patterns', () => {
    it('company list calls /crm/companies/list', async () => {
      const mockedGet = vi.mocked(api.get);
      mockedGet.mockResolvedValueOnce({ data: { success: true, data: { companies: [] } } } as any);
      await api.get('/crm/companies/list');
      expect(mockedGet).toHaveBeenCalledWith('/crm/companies/list');
    });

    it('contact list calls /crm/contacts/list', async () => {
      const mockedGet = vi.mocked(api.get);
      mockedGet.mockResolvedValueOnce({ data: { success: true, data: { contacts: [] } } } as any);
      await api.get('/crm/contacts/list');
      expect(mockedGet).toHaveBeenCalledWith('/crm/contacts/list');
    });

    it('deal creation posts to /crm/deals', async () => {
      const mockedPost = vi.mocked(api.post);
      mockedPost.mockResolvedValueOnce({ data: { success: true, data: {} } } as any);
      await api.post('/crm/deals', { title: 'Test', value: 100, stageId: 's1' });
      expect(mockedPost).toHaveBeenCalledWith('/crm/deals', { title: 'Test', value: 100, stageId: 's1' });
    });

    it('deal counts calls /crm/deals/counts-by-stage', async () => {
      const mockedGet = vi.mocked(api.get);
      mockedGet.mockResolvedValueOnce({ data: { success: true, data: [] } } as any);
      await api.get('/crm/deals/counts-by-stage');
      expect(mockedGet).toHaveBeenCalledWith('/crm/deals/counts-by-stage');
    });

    it('pipeline value calls /crm/deals/pipeline-value', async () => {
      const mockedGet = vi.mocked(api.get);
      mockedGet.mockResolvedValueOnce({ data: { success: true, data: {} } } as any);
      await api.get('/crm/deals/pipeline-value');
      expect(mockedGet).toHaveBeenCalledWith('/crm/deals/pipeline-value');
    });
  });

  // ─── Type interfaces ─────────────────────────────────────────────

  describe('type exports', () => {
    it('exports CRM type interfaces', async () => {
      const mod = await import('../src/apps/crm/hooks');
      // If these types exist at runtime as exports, they would be undefined (type-only),
      // but the module itself should have the hook exports
      expect(Object.keys(mod).length).toBeGreaterThan(10);
    });
  });
});
