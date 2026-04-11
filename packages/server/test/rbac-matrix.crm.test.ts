import { describe, it, expect, vi, beforeEach } from 'vitest';

// CRM uses services/*.service.ts split files. Mock each service file that
// the controllers import from.
vi.mock('../src/apps/crm/services/company.service', () => ({
  listCompanies: vi.fn().mockResolvedValue([]),
  getCompany: vi.fn().mockResolvedValue({ id: 'c1', userId: 'u-self', name: 'Acme' }),
  createCompany: vi.fn().mockResolvedValue({ id: 'c1', name: 'Acme' }),
  updateCompany: vi.fn().mockResolvedValue({ id: 'c1', name: 'Acme' }),
  deleteCompany: vi.fn().mockResolvedValue(undefined),
  bulkCreateCompanies: vi.fn().mockResolvedValue({ inserted: 0 }),
  regeneratePortalToken: vi.fn(),
  mergeCompanies: vi.fn(),
}));

vi.mock('../src/services/event.service', () => ({
  emitAppEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as companyController from '../src/apps/crm/controllers/company.controller';
import {
  makeReqWithPerm,
  makeRes,
  expectForbidden,
  expectSuccess,
} from './helpers/rbac-harness';

function req(role: 'admin' | 'editor' | 'viewer', recordAccess: 'all' | 'own' = 'all', extra: any = {}) {
  return makeReqWithPerm('crm', role, recordAccess, extra);
}

describe('RBAC matrix — CRM companies', () => {
  beforeEach(() => vi.clearAllMocks());

  // ─── viewer ─────────────────────────────────────────
  it('viewer can list companies', async () => {
    const r = req('viewer');
    const res = makeRes();
    await companyController.listCompanies(r, res);
    expectSuccess(res);
  });

  it('viewer can get a company', async () => {
    const r = req('viewer', 'all', { params: { id: 'c1' } });
    const res = makeRes();
    await companyController.getCompany(r, res);
    expectSuccess(res);
  });

  it('viewer cannot create', async () => {
    const r = req('viewer', 'all', { body: { name: 'Acme' } });
    const res = makeRes();
    await companyController.createCompany(r, res);
    expectForbidden(res);
  });

  it('viewer cannot update', async () => {
    const r = req('viewer', 'all', { params: { id: 'c1' }, body: { name: 'Renamed' } });
    const res = makeRes();
    await companyController.updateCompany(r, res);
    expectForbidden(res);
  });

  it('viewer cannot delete', async () => {
    const r = req('viewer', 'all', { params: { id: 'c1' } });
    const res = makeRes();
    await companyController.deleteCompany(r, res);
    expectForbidden(res);
  });

  // ─── editor ─────────────────────────────────────────
  it('editor can create', async () => {
    const r = req('editor', 'all', { body: { name: 'Acme' } });
    const res = makeRes();
    await companyController.createCompany(r, res);
    expectSuccess(res);
  });

  it('editor can update', async () => {
    const r = req('editor', 'all', { params: { id: 'c1' }, body: { name: 'Acme' } });
    const res = makeRes();
    await companyController.updateCompany(r, res);
    expectSuccess(res);
  });

  // NOTE: CRM deleteCompany uses canAccessEntity(...'delete') which does NOT
  // fall back to delete_own. Editors cannot delete CRM companies at all —
  // admin-only operation. Documenting the current behaviour.
  it('editor cannot delete (CRM uses entity-level delete, no delete_own fallback)', async () => {
    const r = req('editor', 'all', { params: { id: 'c1' } });
    const res = makeRes();
    await companyController.deleteCompany(r, res);
    expectForbidden(res);
  });

  // ─── admin ──────────────────────────────────────────
  it('admin can delete any company', async () => {
    const r = req('admin', 'all', { params: { id: 'c1' } });
    const res = makeRes();
    await companyController.deleteCompany(r, res);
    expectSuccess(res);
  });

  // ─── recordAccess scoping ───────────────────────────
  it('list passes recordAccess=own for editor scoped to own records', async () => {
    const service = await import('../src/apps/crm/services/company.service');
    const r = req('editor', 'own');
    const res = makeRes();
    await companyController.listCompanies(r, res);
    expect(service.listCompanies).toHaveBeenCalledWith(
      'u-self',
      't1',
      expect.objectContaining({ recordAccess: 'own' }),
    );
  });

  it('list passes recordAccess=all for admin', async () => {
    const service = await import('../src/apps/crm/services/company.service');
    const r = req('admin', 'all');
    const res = makeRes();
    await companyController.listCompanies(r, res);
    expect(service.listCompanies).toHaveBeenCalledWith(
      'u-self',
      't1',
      expect.objectContaining({ recordAccess: 'all' }),
    );
  });
});
