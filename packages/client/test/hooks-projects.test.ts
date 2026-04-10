import { describe, it, expect } from 'vitest';

import {
  useDashboard,
  useProjects,
  useProject,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useTimeEntriesWeekly,
  useTimeEntries,
  useCreateTimeEntry,
  useUpdateTimeEntry,
  useDeleteTimeEntry,
  useBulkSaveTimeEntries,
  useCopyLastWeek,
  usePreviewTimeEntries,
  usePopulateFromTimeEntries,
  useTimeReport,
  useRevenueReport,
  useProfitabilityReport,
  useUtilizationReport,
  useProjectSettings,
  useUpdateProjectSettings,
} from '../src/apps/projects/hooks';

// Client, invoice, and portal hooks were moved out of apps/projects in commit
// 29141cc (client → CRM companies, invoices → apps/invoices, portal → apps/invoices).
// This file only asserts what still lives in apps/projects/hooks.ts.

describe('Projects hooks', () => {
  describe('dashboard hook', () => {
    it('exports useDashboard as a function', () => {
      expect(typeof useDashboard).toBe('function');
    });
  });

  describe('project hook exports', () => {
    it('exports project query hooks', () => {
      expect(typeof useProjects).toBe('function');
      expect(typeof useProject).toBe('function');
    });

    it('exports project mutation hooks', () => {
      expect(typeof useCreateProject).toBe('function');
      expect(typeof useUpdateProject).toBe('function');
      expect(typeof useDeleteProject).toBe('function');
    });
  });

  describe('time entry hook exports', () => {
    it('exports time entry query hooks', () => {
      expect(typeof useTimeEntriesWeekly).toBe('function');
      expect(typeof useTimeEntries).toBe('function');
      expect(typeof usePreviewTimeEntries).toBe('function');
    });

    it('exports time entry mutation hooks', () => {
      expect(typeof useCreateTimeEntry).toBe('function');
      expect(typeof useUpdateTimeEntry).toBe('function');
      expect(typeof useDeleteTimeEntry).toBe('function');
      expect(typeof useBulkSaveTimeEntries).toBe('function');
      expect(typeof useCopyLastWeek).toBe('function');
      expect(typeof usePopulateFromTimeEntries).toBe('function');
    });
  });

  describe('report hook exports', () => {
    it('exports report query hooks', () => {
      expect(typeof useTimeReport).toBe('function');
      expect(typeof useRevenueReport).toBe('function');
      expect(typeof useProfitabilityReport).toBe('function');
      expect(typeof useUtilizationReport).toBe('function');
    });
  });

  describe('settings hook exports', () => {
    it('exports settings hooks', () => {
      expect(typeof useProjectSettings).toBe('function');
      expect(typeof useUpdateProjectSettings).toBe('function');
    });
  });

  describe('module structure', () => {
    it('exports project-related hooks', async () => {
      const mod = await import('../src/apps/projects/hooks');
      const exportedFns = Object.values(mod).filter((v) => typeof v === 'function');
      // Guard rail: ensure the file continues to export its project hook surface.
      expect(exportedFns.length).toBeGreaterThanOrEqual(20);
    });
  });
});
