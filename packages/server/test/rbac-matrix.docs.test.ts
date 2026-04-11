import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/apps/docs/service', () => ({
  listDocuments: vi.fn().mockResolvedValue([]),
  buildDocumentTree: vi.fn().mockReturnValue([]),
  createDocument: vi.fn().mockResolvedValue({ id: 'd1', title: 'Doc' }),
  getDocument: vi.fn().mockResolvedValue({ id: 'd1', userId: 'u-self' }),
  updateDocument: vi.fn().mockResolvedValue({ id: 'd1' }),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  moveDocument: vi.fn().mockResolvedValue({ id: 'd1' }),
  restoreDocument: vi.fn().mockResolvedValue({ id: 'd1' }),
  searchDocuments: vi.fn().mockResolvedValue([]),
  listVersions: vi.fn().mockResolvedValue([]),
  createVersion: vi.fn().mockResolvedValue({ id: 'v1' }),
  restoreVersion: vi.fn().mockResolvedValue({ id: 'd1' }),
  seedSampleDocuments: vi.fn().mockResolvedValue({}),
  listComments: vi.fn().mockResolvedValue([]),
  createComment: vi.fn().mockResolvedValue({ id: 'cm1' }),
  updateComment: vi.fn().mockResolvedValue({ id: 'cm1' }),
  deleteComment: vi.fn().mockResolvedValue(undefined),
  getCommentById: vi.fn().mockResolvedValue({ id: 'cm1', userId: 'u-self' }),
  deleteCommentById: vi.fn().mockResolvedValue(undefined),
  resolveComment: vi.fn().mockResolvedValue({ id: 'cm1' }),
  getBacklinks: vi.fn().mockResolvedValue([]),
  updateDocumentVisibility: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/utils/mentions', () => ({
  parseMentionsAndNotify: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as docsController from '../src/apps/docs/controller';
import * as docService from '../src/apps/docs/service';
import { makeReqWithPerm, makeRes, expectForbidden, expectSuccess, expectNotFound, SELF_USER_ID, OTHER_USER_ID } from './helpers/rbac-harness';

function req(role: 'admin' | 'editor' | 'viewer', recordAccess: 'all' | 'own' = 'all', extra: any = {}) {
  return makeReqWithPerm('docs', role, recordAccess, extra);
}

describe('RBAC matrix — Docs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(docService.getDocument).mockResolvedValue({ id: 'd1', userId: SELF_USER_ID } as any);
  });

  it('viewer can list', async () => {
    const res = makeRes();
    await docsController.listDocuments(req('viewer'), res);
    expectSuccess(res);
  });

  it('viewer can get', async () => {
    const res = makeRes();
    await docsController.getDocument(req('viewer', 'all', { params: { id: 'd1' } }), res);
    expectSuccess(res);
  });

  it('viewer cannot create', async () => {
    const res = makeRes();
    await docsController.createDocument(req('viewer', 'all', { body: { title: 'D' } }), res);
    expectForbidden(res);
  });

  it('viewer cannot update', async () => {
    const res = makeRes();
    await docsController.updateDocument(req('viewer', 'all', { params: { id: 'd1' }, body: {} }), res);
    expectForbidden(res);
  });

  it('viewer cannot delete', async () => {
    const res = makeRes();
    await docsController.deleteDocument(req('viewer', 'all', { params: { id: 'd1' } }), res);
    expectForbidden(res);
  });

  it('editor can create', async () => {
    const res = makeRes();
    await docsController.createDocument(req('editor', 'all', { body: { title: 'D' } }), res);
    expectSuccess(res);
  });

  it('editor can update', async () => {
    const res = makeRes();
    await docsController.updateDocument(req('editor', 'all', { params: { id: 'd1' }, body: {} }), res);
    expectSuccess(res);
  });

  it('editor can delete own document', async () => {
    vi.mocked(docService.getDocument).mockResolvedValue({ id: 'd1', userId: SELF_USER_ID } as any);
    const res = makeRes();
    await docsController.deleteDocument(req('editor', 'all', { params: { id: 'd1' } }), res);
    expectSuccess(res);
  });

  it("editor cannot delete another user's document", async () => {
    vi.mocked(docService.getDocument).mockResolvedValue({ id: 'd1', userId: OTHER_USER_ID } as any);
    const res = makeRes();
    await docsController.deleteDocument(req('editor', 'all', { params: { id: 'd1' } }), res);
    expectNotFound(res);
  });

  it('admin can delete any document', async () => {
    vi.mocked(docService.getDocument).mockResolvedValue({ id: 'd1', userId: OTHER_USER_ID } as any);
    const res = makeRes();
    await docsController.deleteDocument(req('admin', 'all', { params: { id: 'd1' } }), res);
    expectSuccess(res);
  });
});
