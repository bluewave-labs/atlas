import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/apps/tables/service', () => ({
  listSpreadsheets: vi.fn().mockResolvedValue([]),
  createSpreadsheet: vi.fn().mockResolvedValue({ id: 's1', title: 'T' }),
  getSpreadsheet: vi.fn().mockResolvedValue({ id: 's1', userId: 'u-self' }),
  updateSpreadsheet: vi.fn().mockResolvedValue({ id: 's1' }),
  deleteSpreadsheet: vi.fn().mockResolvedValue({ id: 's1' }),
  restoreSpreadsheet: vi.fn().mockResolvedValue({ id: 's1' }),
  searchSpreadsheets: vi.fn().mockResolvedValue([]),
  seedSampleSpreadsheets: vi.fn().mockResolvedValue({}),
  listRowComments: vi.fn().mockResolvedValue([]),
  createRowComment: vi.fn().mockResolvedValue({ id: 'c1' }),
  deleteRowComment: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as tablesController from '../src/apps/tables/controller';
import * as tableService from '../src/apps/tables/service';
import { makeReqWithPerm, makeRes, expectForbidden, expectSuccess, expectNotFound, SELF_USER_ID, OTHER_USER_ID } from './helpers/rbac-harness';

function req(role: 'admin' | 'editor' | 'viewer', recordAccess: 'all' | 'own' = 'all', extra: any = {}) {
  return makeReqWithPerm('tables', role, recordAccess, extra);
}

describe('RBAC matrix — Tables', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(tableService.getSpreadsheet).mockResolvedValue({ id: 's1', userId: SELF_USER_ID } as any);
  });

  it('viewer can list', async () => {
    const res = makeRes();
    await tablesController.listSpreadsheets(req('viewer'), res);
    expectSuccess(res);
  });

  it('viewer can get', async () => {
    const res = makeRes();
    await tablesController.getSpreadsheet(req('viewer', 'all', { params: { id: 's1' } }), res);
    expectSuccess(res);
  });

  it('viewer cannot create', async () => {
    const res = makeRes();
    await tablesController.createSpreadsheet(req('viewer', 'all', { body: { title: 'T' } }), res);
    expectForbidden(res);
  });

  it('viewer cannot update', async () => {
    const res = makeRes();
    await tablesController.updateSpreadsheet(req('viewer', 'all', { params: { id: 's1' }, body: {} }), res);
    expectForbidden(res);
  });

  it('viewer cannot delete', async () => {
    const res = makeRes();
    await tablesController.deleteSpreadsheet(req('viewer', 'all', { params: { id: 's1' } }), res);
    expectForbidden(res);
  });

  it('editor can create', async () => {
    const res = makeRes();
    await tablesController.createSpreadsheet(req('editor', 'all', { body: { title: 'T' } }), res);
    expectSuccess(res);
  });

  it('editor can update', async () => {
    const res = makeRes();
    await tablesController.updateSpreadsheet(req('editor', 'all', { params: { id: 's1' }, body: {} }), res);
    expectSuccess(res);
  });

  it('editor can delete own spreadsheet', async () => {
    vi.mocked(tableService.getSpreadsheet).mockResolvedValue({ id: 's1', userId: SELF_USER_ID } as any);
    const res = makeRes();
    await tablesController.deleteSpreadsheet(req('editor', 'all', { params: { id: 's1' } }), res);
    expectSuccess(res);
  });

  it("editor cannot delete another user's spreadsheet", async () => {
    vi.mocked(tableService.getSpreadsheet).mockResolvedValue({ id: 's1', userId: OTHER_USER_ID } as any);
    const res = makeRes();
    await tablesController.deleteSpreadsheet(req('editor', 'all', { params: { id: 's1' } }), res);
    expectNotFound(res);
  });

  it('admin can delete any spreadsheet', async () => {
    vi.mocked(tableService.getSpreadsheet).mockResolvedValue({ id: 's1', userId: OTHER_USER_ID } as any);
    const res = makeRes();
    await tablesController.deleteSpreadsheet(req('admin', 'all', { params: { id: 's1' } }), res);
    expectSuccess(res);
  });

  // ─── recordAccess scoping ───────────────────────────
  it('editor+own list is scoped to own userId', async () => {
    const res = makeRes();
    await tablesController.listSpreadsheets(req('editor', 'own'), res);
    expect(tableService.listSpreadsheets).toHaveBeenCalledWith('t1', false, SELF_USER_ID);
  });

  it('admin+all list passes undefined (tenant-wide)', async () => {
    const res = makeRes();
    await tablesController.listSpreadsheets(req('admin', 'all'), res);
    expect(tableService.listSpreadsheets).toHaveBeenCalledWith('t1', false, undefined);
  });
});
