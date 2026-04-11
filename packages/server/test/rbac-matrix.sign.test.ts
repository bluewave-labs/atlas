import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/apps/sign/service', () => ({
  listDocuments: vi.fn().mockResolvedValue([]),
  createDocument: vi.fn().mockResolvedValue({ id: 'sd1' }),
  getDocument: vi.fn().mockResolvedValue({ id: 'sd1', userId: 'u-self' }),
  updateDocument: vi.fn().mockResolvedValue({ id: 'sd1' }),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  getWidgetData: vi.fn().mockResolvedValue({}),
}));

vi.mock('../src/apps/sign/reminder', () => ({
  sendPendingReminders: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/services/event.service', () => ({
  emitAppEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  createReadStream: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as signController from '../src/apps/sign/controllers/documents.controller';
import * as signService from '../src/apps/sign/service';
import { makeReqWithPerm, makeRes, expectForbidden, expectSuccess, expectNotFound, SELF_USER_ID, OTHER_USER_ID } from './helpers/rbac-harness';

function req(role: 'admin' | 'editor' | 'viewer', recordAccess: 'all' | 'own' = 'all', extra: any = {}) {
  return makeReqWithPerm('sign', role, recordAccess, extra);
}

describe('RBAC matrix — Sign documents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(signService.getDocument).mockResolvedValue({ id: 'sd1', userId: SELF_USER_ID } as any);
  });

  it('viewer can list', async () => {
    const res = makeRes();
    await signController.listDocuments(req('viewer'), res);
    expectSuccess(res);
  });

  it('viewer can get', async () => {
    const res = makeRes();
    await signController.getDocument(req('viewer', 'all', { params: { id: 'sd1' } }), res);
    expectSuccess(res);
  });

  it('viewer cannot create', async () => {
    const res = makeRes();
    await signController.createDocument(req('viewer', 'all', { body: { title: 'D', fileName: 'f.pdf', storagePath: 'p' } }), res);
    expectForbidden(res);
  });

  it('viewer cannot update', async () => {
    const res = makeRes();
    await signController.updateDocument(req('viewer', 'all', { params: { id: 'sd1' }, body: {} }), res);
    expectForbidden(res);
  });

  it('viewer cannot delete', async () => {
    const res = makeRes();
    await signController.deleteDocument(req('viewer', 'all', { params: { id: 'sd1' } }), res);
    expectForbidden(res);
  });

  it('editor can create', async () => {
    const res = makeRes();
    await signController.createDocument(req('editor', 'all', { body: { title: 'D', fileName: 'f.pdf', storagePath: 'p' } }), res);
    expectSuccess(res);
  });

  it('editor can update', async () => {
    const res = makeRes();
    await signController.updateDocument(req('editor', 'all', { params: { id: 'sd1' }, body: {} }), res);
    expectSuccess(res);
  });

  it('editor can delete own document', async () => {
    vi.mocked(signService.getDocument).mockResolvedValue({ id: 'sd1', userId: SELF_USER_ID } as any);
    const res = makeRes();
    await signController.deleteDocument(req('editor', 'all', { params: { id: 'sd1' } }), res);
    expectSuccess(res);
  });

  it("editor cannot delete another user's document", async () => {
    // editor+all in sign: isAdminCaller() is false → getDocument is called
    // with ownership filter, which returns null → 404 before assertCanDelete.
    vi.mocked(signService.getDocument).mockResolvedValue(null as any);
    const res = makeRes();
    await signController.deleteDocument(req('editor', 'all', { params: { id: 'sd1' } }), res);
    expectNotFound(res);
  });

  it('admin can delete any document', async () => {
    vi.mocked(signService.getDocument).mockResolvedValue({ id: 'sd1', userId: OTHER_USER_ID } as any);
    const res = makeRes();
    await signController.deleteDocument(req('admin', 'all', { params: { id: 'sd1' } }), res);
    expectSuccess(res);
  });

  it('editor+all list is scoped to own userId (non-admin caller)', async () => {
    const res = makeRes();
    await signController.listDocuments(req('editor', 'all'), res);
    expect(signService.listDocuments).toHaveBeenCalledWith('t1', SELF_USER_ID);
  });

  it('admin+all list passes undefined (tenant-wide)', async () => {
    const res = makeRes();
    await signController.listDocuments(req('admin', 'all'), res);
    expect(signService.listDocuments).toHaveBeenCalledWith('t1', undefined);
  });
});
