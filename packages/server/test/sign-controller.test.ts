import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// Mock sign service
vi.mock('../src/apps/sign/service', () => ({
  listDocuments: vi.fn(),
  createDocument: vi.fn(),
  getDocument: vi.fn(),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
  listFields: vi.fn(),
  createField: vi.fn(),
  updateField: vi.fn(),
  deleteField: vi.fn(),
  createSigningToken: vi.fn(),
  listSigningTokens: vi.fn(),
  getSigningToken: vi.fn(),
  signField: vi.fn(),
  completeSigningToken: vi.fn(),
  declineSigningToken: vi.fn(),
  voidDocument: vi.fn(),
  checkDocumentComplete: vi.fn(),
  generateSignedPDF: vi.fn(),
  getWidgetData: vi.fn(),
}));

// Mock event service
vi.mock('../src/services/event.service', () => ({
  emitAppEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock app permissions — always allow in tests
vi.mock('../src/services/app-permissions.service', () => ({
  getAppPermission: vi.fn().mockResolvedValue({ role: 'owner' }),
  canAccess: vi.fn().mockReturnValue(true),
  canAccessEntity: vi.fn().mockReturnValue(true),
}));

// Mock reminder module (imported by documents.controller)
vi.mock('../src/apps/sign/reminder', () => ({
  sendPendingReminders: vi.fn().mockResolvedValue(undefined),
}));

// Mock node:fs to prevent real filesystem access
vi.mock('node:fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  createReadStream: vi.fn(),
  statSync: vi.fn(),
}));

import * as controller from '../src/apps/sign/controller';
import * as signService from '../src/apps/sign/service';

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
    setHeader: vi.fn(),
    end: vi.fn(),
  };
  return res as Response;
}

describe('sign controller — createDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when required fields are missing', async () => {
    const req = makeReq({ body: { title: 'Test' } });
    const res = makeRes();

    await controller.createDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'title, fileName, and storagePath are required' })
    );
  });

  it('creates a document when all required fields are provided', async () => {
    const mockDoc = { id: 'doc-1', title: 'Contract', fileName: 'contract.pdf', storagePath: 'abc.pdf' };
    vi.mocked(signService.createDocument).mockResolvedValue(mockDoc as any);

    const req = makeReq({
      body: { title: 'Contract', fileName: 'contract.pdf', storagePath: 'abc.pdf', pageCount: 3 },
    });
    const res = makeRes();

    await controller.createDocument(req, res);

    expect(signService.createDocument).toHaveBeenCalledWith('u1', 't1', expect.objectContaining({
      title: 'Contract',
      fileName: 'contract.pdf',
      storagePath: 'abc.pdf',
      pageCount: 3,
    }));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockDoc })
    );
  });

  it('returns 500 when service throws', async () => {
    vi.mocked(signService.createDocument).mockRejectedValue(new Error('DB error'));

    const req = makeReq({
      body: { title: 'Test', fileName: 'test.pdf', storagePath: 'path.pdf' },
    });
    const res = makeRes();

    await controller.createDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });
});

describe('sign controller — listDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns documents list with success:true', async () => {
    const mockDocs = [
      { id: 'doc-1', title: 'Contract A' },
      { id: 'doc-2', title: 'Contract B' },
    ];
    vi.mocked(signService.listDocuments).mockResolvedValue(mockDocs as any);

    const req = makeReq();
    const res = makeRes();

    await controller.listDocuments(req, res);

    expect(signService.listDocuments).toHaveBeenCalledWith('u1', 't1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { documents: mockDocs } })
    );
  });
});

describe('sign controller — getDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when document is not found', async () => {
    vi.mocked(signService.getDocument).mockResolvedValue(null as any);

    const req = makeReq({ params: { id: 'nonexistent' } });
    const res = makeRes();

    await controller.getDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Document not found' })
    );
  });

  it('returns the document when found', async () => {
    const mockDoc = { id: 'doc-1', title: 'NDA', fileName: 'nda.pdf', status: 'draft' };
    vi.mocked(signService.getDocument).mockResolvedValue(mockDoc as any);

    const req = makeReq({ params: { id: 'doc-1' } });
    const res = makeRes();

    await controller.getDocument(req, res);

    expect(signService.getDocument).toHaveBeenCalledWith('u1', 'doc-1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockDoc })
    );
  });
});

describe('sign controller — createField (addSignatureField)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when position fields are missing', async () => {
    const req = makeReq({ params: { id: 'doc-1' }, body: { type: 'signature' } });
    const res = makeRes();

    await controller.createField(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'x, y, width, and height are required' })
    );
  });

  it('creates a signature field with valid position data', async () => {
    const mockField = { id: 'field-1', documentId: 'doc-1', type: 'signature', x: 100, y: 200, width: 200, height: 50 };
    vi.mocked(signService.createField).mockResolvedValue(mockField as any);

    const req = makeReq({
      params: { id: 'doc-1' },
      body: { type: 'signature', pageNumber: 1, x: 100, y: 200, width: 200, height: 50, signerEmail: 'signer@test.com' },
    });
    const res = makeRes();

    await controller.createField(req, res);

    expect(signService.createField).toHaveBeenCalledWith(expect.objectContaining({
      documentId: 'doc-1',
      type: 'signature',
      x: 100,
      y: 200,
      width: 200,
      height: 50,
      signerEmail: 'signer@test.com',
    }));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockField })
    );
  });
});

describe('sign controller — createSigningToken (sendForSignature)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when email is not provided', async () => {
    const req = makeReq({ params: { id: 'doc-1' }, body: {} });
    const res = makeRes();

    await controller.createSigningToken(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'email is required' })
    );
  });

  it('creates a signing token and emits an event', async () => {
    const mockToken = { id: 'token-1', signerEmail: 'signer@example.com', token: 'abc-def' };
    vi.mocked(signService.createSigningToken).mockResolvedValue(mockToken as any);
    vi.mocked(signService.getDocument).mockResolvedValue({ id: 'doc-1', title: 'Agreement' } as any);

    const req = makeReq({
      params: { id: 'doc-1' },
      body: { email: 'signer@example.com', name: 'Jane Doe', expiresInDays: 14 },
    });
    const res = makeRes();

    await controller.createSigningToken(req, res);

    expect(signService.createSigningToken).toHaveBeenCalledWith(
      'doc-1', 'signer@example.com', 'Jane Doe', 14, 0, 'signer', undefined, undefined,
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockToken })
    );
  });

  it('uses default values for optional name and expiresInDays', async () => {
    const mockToken = { id: 'token-2', signerEmail: 'other@test.com' };
    vi.mocked(signService.createSigningToken).mockResolvedValue(mockToken as any);
    vi.mocked(signService.getDocument).mockResolvedValue({ id: 'doc-1', title: 'Doc' } as any);

    const req = makeReq({
      params: { id: 'doc-1' },
      body: { email: 'other@test.com' },
    });
    const res = makeRes();

    await controller.createSigningToken(req, res);

    expect(signService.createSigningToken).toHaveBeenCalledWith(
      'doc-1', 'other@test.com', null, 30, 0, 'signer', undefined, undefined,
    );
  });
});

describe('sign controller — voidDocument', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when document does not exist', async () => {
    vi.mocked(signService.getDocument).mockResolvedValue(null as any);

    const req = makeReq({ params: { id: 'nonexistent' } });
    const res = makeRes();

    await controller.voidDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 when document is not pending', async () => {
    vi.mocked(signService.getDocument).mockResolvedValue({ id: 'doc-1', status: 'completed' } as any);

    const req = makeReq({ params: { id: 'doc-1' } });
    const res = makeRes();

    await controller.voidDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Only pending documents can be voided' })
    );
  });
});
