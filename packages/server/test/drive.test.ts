import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// Mock drive service
vi.mock('../src/apps/drive/service', () => ({
  listItems: vi.fn(),
  uploadFile: vi.fn(),
  deleteItem: vi.fn(),
  searchItems: vi.fn(),
  getItem: vi.fn(),
  listTrash: vi.fn(),
  listFavourites: vi.fn(),
  getWidgetData: vi.fn(),
  batchDelete: vi.fn(),
  logDriveActivity: vi.fn().mockResolvedValue(undefined),
}));

// Mock event service
vi.mock('../src/services/event.service', () => ({
  emitAppEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock app permissions — always grant admin access
vi.mock('../src/services/app-permissions.service', () => ({
  getAppPermission: vi.fn().mockResolvedValue({ role: 'admin', recordAccess: 'all' }),
  canAccess: vi.fn().mockReturnValue(true),
  canAccessEntity: vi.fn().mockReturnValue(true),
  getRecordFilter: vi.fn().mockReturnValue(undefined),
  decideRecordDelete: vi.fn().mockReturnValue('allow'),
}));

import * as controller from '../src/apps/drive/controller';
import * as driveService from '../src/apps/drive/service';

function makeReq(overrides: Record<string, any> = {}): Request {
  return {
    auth: { userId: 'u1', accountId: 'a1', email: 'test@test.com', tenantId: 't1' },
    body: {},
    params: {},
    query: {},
    files: undefined,
    file: undefined,
    ...overrides,
  } as any;
}

function makeRes() {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
  };
  return res as Response;
}

describe('drive controller — uploadFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when no files are provided', async () => {
    const req = makeReq({ files: [] });
    const res = makeRes();

    await controller.uploadFiles(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'No files uploaded' })
    );
  });

  it('returns 400 when files is undefined', async () => {
    const req = makeReq({ files: undefined });
    const res = makeRes();

    await controller.uploadFiles(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'No files uploaded' })
    );
  });

  it('successfully uploads files and returns created items', async () => {
    const mockItem = { id: 'item-1', name: 'test.txt', type: 'file' };
    vi.mocked(driveService.uploadFile).mockResolvedValue(mockItem as any);

    const mockFile = {
      originalname: 'test.txt',
      mimetype: 'text/plain',
      size: 1024,
      filename: 'abc123.txt',
    };

    const req = makeReq({ files: [mockFile], body: { parentId: null } });
    const res = makeRes();

    await controller.uploadFiles(req, res);

    expect(driveService.uploadFile).toHaveBeenCalledWith('u1', 't1', expect.objectContaining({
      name: 'test.txt',
      type: 'file',
      mimeType: 'text/plain',
      size: 1024,
    }));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { items: [mockItem] } })
    );
  });
});

describe('drive controller — listItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns items list with success:true', async () => {
    const mockItems = [
      { id: '1', name: 'folder1', type: 'folder' },
      { id: '2', name: 'file1.txt', type: 'file' },
    ];
    vi.mocked(driveService.listItems).mockResolvedValue(mockItems as any);

    const req = makeReq({ query: {} });
    const res = makeRes();

    await controller.listItems(req, res);

    expect(driveService.listItems).toHaveBeenCalledWith('u1', null, false, undefined, undefined, 't1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { items: mockItems } })
    );
  });

  it('passes parentId from query parameter', async () => {
    vi.mocked(driveService.listItems).mockResolvedValue([] as any);

    const req = makeReq({ query: { parentId: 'folder-123' } });
    const res = makeRes();

    await controller.listItems(req, res);

    expect(driveService.listItems).toHaveBeenCalledWith('u1', 'folder-123', false, undefined, undefined, 't1');
  });
});

describe('drive controller — deleteItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls driveService.deleteItem and returns success', async () => {
    // Controller now loads the item first to enforce ownership for delete_own.
    vi.mocked(driveService.getItem).mockResolvedValue({ id: 'item-to-delete', userId: 'u1' } as any);
    vi.mocked(driveService.deleteItem).mockResolvedValue(undefined as any);
    vi.mocked(driveService.logDriveActivity).mockResolvedValue(undefined as any);

    const req = makeReq({ params: { id: 'item-to-delete' } });
    const res = makeRes();

    await controller.deleteItem(req, res);

    expect(driveService.deleteItem).toHaveBeenCalledWith('u1', 'item-to-delete');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: null })
    );
  });
});

describe('drive controller — searchItems', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty items when query is empty', async () => {
    const req = makeReq({ query: { q: '' } });
    const res = makeRes();

    await controller.searchItems(req, res);

    expect(driveService.searchItems).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { items: [] } })
    );
  });

  it('returns empty items when query is only whitespace', async () => {
    const req = makeReq({ query: { q: '   ' } });
    const res = makeRes();

    await controller.searchItems(req, res);

    expect(driveService.searchItems).not.toHaveBeenCalled();
  });

  it('searches items when query is provided', async () => {
    const mockResults = [{ id: '1', name: 'matching-file.txt' }];
    vi.mocked(driveService.searchItems).mockResolvedValue(mockResults as any);

    const req = makeReq({ query: { q: 'matching' } });
    const res = makeRes();

    await controller.searchItems(req, res);

    expect(driveService.searchItems).toHaveBeenCalledWith('u1', 'matching');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { items: mockResults } })
    );
  });
});

describe('drive controller — batchDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when itemIds is not provided', async () => {
    const req = makeReq({ body: {} });
    const res = makeRes();

    await controller.batchDelete(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'itemIds required' })
    );
  });

  it('returns 400 when itemIds is empty array', async () => {
    const req = makeReq({ body: { itemIds: [] } });
    const res = makeRes();

    await controller.batchDelete(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
