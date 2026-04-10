import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// Mock docs service
vi.mock('../src/apps/docs/service', () => ({
  listDocuments: vi.fn(),
  buildDocumentTree: vi.fn(),
  seedSampleDocuments: vi.fn(),
  getDocument: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
  restoreDocument: vi.fn(),
  moveDocument: vi.fn(),
  searchDocuments: vi.fn(),
  createVersion: vi.fn(),
  listVersions: vi.fn(),
  restoreVersion: vi.fn(),
  listComments: vi.fn(),
  createComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  resolveComment: vi.fn(),
  getBacklinks: vi.fn(),
  syncDocumentLinks: vi.fn(),
}));

import * as controller from '../src/apps/docs/controller';
import * as documentService from '../src/apps/docs/service';

function makeReq(overrides: Record<string, any> = {}): Request {
  return {
    auth: { userId: 'u1', accountId: 'a1', email: 'test@test.com', tenantId: 't1' },
    body: {},
    params: {},
    query: {},
    ...overrides,
  } as any;
}

function makeRes() {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as Response;
}

describe('docs controller — listDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns documents list and tree with success', async () => {
    const mockDocs = [
      { id: 'd1', title: 'Doc A', parentId: null },
      { id: 'd2', title: 'Doc B', parentId: 'd1' },
    ];
    const mockTree = [{ id: 'd1', title: 'Doc A', children: [{ id: 'd2', title: 'Doc B' }] }];

    vi.mocked(documentService.listDocuments).mockResolvedValue(mockDocs as any);
    vi.mocked(documentService.buildDocumentTree).mockReturnValue(mockTree as any);

    const req = makeReq({ query: {} });
    const res = makeRes();

    await controller.listDocuments(req, res);

    expect(documentService.listDocuments).toHaveBeenCalledWith('u1', false, 't1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { documents: mockDocs, tree: mockTree },
      })
    );
  });

  it('passes includeArchived flag', async () => {
    vi.mocked(documentService.listDocuments).mockResolvedValue([] as any);
    vi.mocked(documentService.buildDocumentTree).mockReturnValue([] as any);

    const req = makeReq({ query: { includeArchived: 'true' } });
    const res = makeRes();

    await controller.listDocuments(req, res);

    expect(documentService.listDocuments).toHaveBeenCalledWith('u1', true, 't1');
  });
});

describe('docs controller — createDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a document and returns it', async () => {
    const mockDoc = { id: 'd1', title: 'New Document', content: null };
    vi.mocked(documentService.createDocument).mockResolvedValue(mockDoc as any);

    const req = makeReq({
      body: { title: 'New Document', parentId: null, icon: '📄' },
    });
    const res = makeRes();

    await controller.createDocument(req, res);

    expect(documentService.createDocument).toHaveBeenCalledWith('u1', 't1', expect.objectContaining({
      title: 'New Document',
      parentId: null,
      icon: '📄',
    }));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockDoc })
    );
  });
});

describe('docs controller — getDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns document when found', async () => {
    const mockDoc = { id: 'd1', title: 'Test Doc', content: { type: 'doc' } };
    vi.mocked(documentService.getDocument).mockResolvedValue(mockDoc as any);

    const req = makeReq({ params: { id: 'd1' } });
    const res = makeRes();

    await controller.getDocument(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockDoc })
    );
  });

  it('returns 404 when document is not found', async () => {
    vi.mocked(documentService.getDocument).mockResolvedValue(null as any);

    const req = makeReq({ params: { id: 'nonexistent' } });
    const res = makeRes();

    await controller.getDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Document not found' })
    );
  });
});

describe('docs controller — updateDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates a document and returns it', async () => {
    const updatedDoc = { id: 'd1', title: 'Updated Title', content: { type: 'doc' } };
    vi.mocked(documentService.updateDocument).mockResolvedValue(updatedDoc as any);

    const req = makeReq({
      params: { id: 'd1' },
      body: { title: 'Updated Title' },
    });
    const res = makeRes();

    await controller.updateDocument(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: updatedDoc })
    );
  });

  it('returns 404 when document to update is not found', async () => {
    vi.mocked(documentService.updateDocument).mockResolvedValue(null as any);

    const req = makeReq({ params: { id: 'missing' }, body: { title: 'X' } });
    const res = makeRes();

    await controller.updateDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Document not found' })
    );
  });
});

describe('docs controller — deleteDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a document (soft delete) and returns success', async () => {
    vi.mocked(documentService.deleteDocument).mockResolvedValue(undefined as any);

    const req = makeReq({ params: { id: 'd1' } });
    const res = makeRes();

    await controller.deleteDocument(req, res);

    expect(documentService.deleteDocument).toHaveBeenCalledWith('u1', 'd1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: null })
    );
  });

  it('returns 500 when service throws an error', async () => {
    vi.mocked(documentService.deleteDocument).mockRejectedValue(new Error('DB failure'));

    const req = makeReq({ params: { id: 'd1' } });
    const res = makeRes();

    await controller.deleteDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Failed to delete document' })
    );
  });
});

describe('docs controller — moveDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when sortOrder is not a number', async () => {
    const req = makeReq({
      params: { id: 'd1' },
      body: { parentId: null, sortOrder: 'not-a-number' },
    });
    const res = makeRes();

    await controller.moveDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'sortOrder must be a number' })
    );
  });
});
