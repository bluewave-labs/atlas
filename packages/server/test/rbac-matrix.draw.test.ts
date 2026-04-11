import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/apps/draw/service', () => ({
  listDrawings: vi.fn().mockResolvedValue([]),
  createDrawing: vi.fn().mockResolvedValue({ id: 'dr1', title: 'D' }),
  getDrawing: vi.fn().mockResolvedValue({ id: 'dr1', userId: 'u-self' }),
  updateDrawing: vi.fn().mockResolvedValue({ id: 'dr1' }),
  deleteDrawing: vi.fn().mockResolvedValue(undefined),
  restoreDrawing: vi.fn().mockResolvedValue({ id: 'dr1' }),
  searchDrawings: vi.fn().mockResolvedValue([]),
  seedSampleDrawings: vi.fn().mockResolvedValue({}),
  updateDrawingVisibility: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as drawController from '../src/apps/draw/controller';
import * as drawService from '../src/apps/draw/service';
import { makeReqWithPerm, makeRes, expectForbidden, expectSuccess, expectNotFound, SELF_USER_ID, OTHER_USER_ID } from './helpers/rbac-harness';

function req(role: 'admin' | 'editor' | 'viewer', recordAccess: 'all' | 'own' = 'all', extra: any = {}) {
  return makeReqWithPerm('draw', role, recordAccess, extra);
}

describe('RBAC matrix — Draw', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(drawService.getDrawing).mockResolvedValue({ id: 'dr1', userId: SELF_USER_ID } as any);
  });

  it('viewer can list', async () => {
    const res = makeRes();
    await drawController.listDrawings(req('viewer'), res);
    expectSuccess(res);
  });

  it('viewer can get', async () => {
    const res = makeRes();
    await drawController.getDrawing(req('viewer', 'all', { params: { id: 'dr1' } }), res);
    expectSuccess(res);
  });

  it('viewer cannot create', async () => {
    const res = makeRes();
    await drawController.createDrawing(req('viewer', 'all', { body: { title: 'D' } }), res);
    expectForbidden(res);
  });

  it('viewer cannot update', async () => {
    const res = makeRes();
    await drawController.updateDrawing(req('viewer', 'all', { params: { id: 'dr1' }, body: {} }), res);
    expectForbidden(res);
  });

  it('viewer cannot delete', async () => {
    const res = makeRes();
    await drawController.deleteDrawing(req('viewer', 'all', { params: { id: 'dr1' } }), res);
    expectForbidden(res);
  });

  it('editor can create', async () => {
    const res = makeRes();
    await drawController.createDrawing(req('editor', 'all', { body: { title: 'D' } }), res);
    expectSuccess(res);
  });

  it('editor can update', async () => {
    const res = makeRes();
    await drawController.updateDrawing(req('editor', 'all', { params: { id: 'dr1' }, body: {} }), res);
    expectSuccess(res);
  });

  it('editor can delete own drawing', async () => {
    vi.mocked(drawService.getDrawing).mockResolvedValue({ id: 'dr1', userId: SELF_USER_ID } as any);
    const res = makeRes();
    await drawController.deleteDrawing(req('editor', 'all', { params: { id: 'dr1' } }), res);
    expectSuccess(res);
  });

  it("editor cannot delete another user's drawing", async () => {
    vi.mocked(drawService.getDrawing).mockResolvedValue({ id: 'dr1', userId: OTHER_USER_ID } as any);
    const res = makeRes();
    await drawController.deleteDrawing(req('editor', 'all', { params: { id: 'dr1' } }), res);
    expectNotFound(res);
  });

  it('admin can delete any drawing', async () => {
    vi.mocked(drawService.getDrawing).mockResolvedValue({ id: 'dr1', userId: OTHER_USER_ID } as any);
    const res = makeRes();
    await drawController.deleteDrawing(req('admin', 'all', { params: { id: 'dr1' } }), res);
    expectSuccess(res);
  });
});
