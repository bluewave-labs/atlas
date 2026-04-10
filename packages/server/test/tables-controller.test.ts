import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// Mock tables service
vi.mock('../src/apps/tables/service', () => ({
  listSpreadsheets: vi.fn(),
  createSpreadsheet: vi.fn(),
  getSpreadsheet: vi.fn(),
  updateSpreadsheet: vi.fn(),
  deleteSpreadsheet: vi.fn(),
  restoreSpreadsheet: vi.fn(),
  searchSpreadsheets: vi.fn(),
  seedSampleSpreadsheets: vi.fn(),
}));

// Mock app permissions — always allow access in tests
vi.mock('../src/services/app-permissions.service', () => ({
  getAppPermission: vi.fn().mockResolvedValue({ role: 'owner' }),
  canAccess: vi.fn().mockReturnValue(true),
}));

// Mock logger to keep test output clean
vi.mock('../src/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import * as controller from '../src/apps/tables/controller';
import * as tableService from '../src/apps/tables/service';

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

describe('tables controller - listSpreadsheets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns spreadsheets list with success:true', async () => {
    const mockSheets = [
      { id: 's1', title: 'Budget' },
      { id: 's2', title: 'Inventory' },
    ];
    vi.mocked(tableService.listSpreadsheets).mockResolvedValue(mockSheets as any);

    const req = makeReq();
    const res = makeRes();

    await controller.listSpreadsheets(req, res);

    expect(tableService.listSpreadsheets).toHaveBeenCalledWith('u1', false);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { spreadsheets: mockSheets } })
    );
  });

  it('passes includeArchived=true when query param is set', async () => {
    vi.mocked(tableService.listSpreadsheets).mockResolvedValue([]);

    const req = makeReq({ query: { includeArchived: 'true' } });
    const res = makeRes();

    await controller.listSpreadsheets(req, res);

    expect(tableService.listSpreadsheets).toHaveBeenCalledWith('u1', true);
  });

  it('returns 500 when service throws', async () => {
    vi.mocked(tableService.listSpreadsheets).mockRejectedValue(new Error('DB error'));

    const req = makeReq();
    const res = makeRes();

    await controller.listSpreadsheets(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Failed to list spreadsheets' })
    );
  });
});

describe('tables controller - createSpreadsheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a spreadsheet with provided fields', async () => {
    const mockSheet = { id: 's1', title: 'New Sheet', columns: [], rows: [] };
    vi.mocked(tableService.createSpreadsheet).mockResolvedValue(mockSheet as any);

    const req = makeReq({
      body: { title: 'New Sheet', columns: [], rows: [], color: '#ff0000', icon: 'table' },
    });
    const res = makeRes();

    await controller.createSpreadsheet(req, res);

    expect(tableService.createSpreadsheet).toHaveBeenCalledWith('u1', 't1', expect.objectContaining({
      title: 'New Sheet',
      columns: [],
      rows: [],
      color: '#ff0000',
      icon: 'table',
    }));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockSheet })
    );
  });

  it('returns 500 when service throws', async () => {
    vi.mocked(tableService.createSpreadsheet).mockRejectedValue(new Error('Insert failed'));

    const req = makeReq({ body: { title: 'Test' } });
    const res = makeRes();

    await controller.createSpreadsheet(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Failed to create spreadsheet' })
    );
  });
});

describe('tables controller - getSpreadsheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when spreadsheet is not found', async () => {
    vi.mocked(tableService.getSpreadsheet).mockResolvedValue(null as any);

    const req = makeReq({ params: { id: 'nonexistent' } });
    const res = makeRes();

    await controller.getSpreadsheet(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Spreadsheet not found' })
    );
  });

  it('returns the spreadsheet when found', async () => {
    const mockSheet = { id: 's1', title: 'Budget', columns: [], rows: [] };
    vi.mocked(tableService.getSpreadsheet).mockResolvedValue(mockSheet as any);

    const req = makeReq({ params: { id: 's1' } });
    const res = makeRes();

    await controller.getSpreadsheet(req, res);

    expect(tableService.getSpreadsheet).toHaveBeenCalledWith('u1', 's1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockSheet })
    );
  });
});

describe('tables controller - updateSpreadsheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when spreadsheet to update is not found', async () => {
    vi.mocked(tableService.updateSpreadsheet).mockResolvedValue(null as any);

    const req = makeReq({ params: { id: 'missing' }, body: { title: 'Updated' } });
    const res = makeRes();

    await controller.updateSpreadsheet(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Spreadsheet not found' })
    );
  });

  it('updates the spreadsheet successfully', async () => {
    const mockSheet = { id: 's1', title: 'Updated Title' };
    vi.mocked(tableService.updateSpreadsheet).mockResolvedValue(mockSheet as any);

    const req = makeReq({ params: { id: 's1' }, body: { title: 'Updated Title', color: '#00ff00' } });
    const res = makeRes();

    await controller.updateSpreadsheet(req, res);

    expect(tableService.updateSpreadsheet).toHaveBeenCalledWith('u1', 's1', expect.objectContaining({
      title: 'Updated Title',
      color: '#00ff00',
    }));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockSheet })
    );
  });
});

describe('tables controller - deleteSpreadsheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when spreadsheet to delete is not found', async () => {
    vi.mocked(tableService.deleteSpreadsheet).mockResolvedValue(null as any);

    const req = makeReq({ params: { id: 'missing' } });
    const res = makeRes();

    await controller.deleteSpreadsheet(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Spreadsheet not found' })
    );
  });

  it('deletes the spreadsheet successfully', async () => {
    vi.mocked(tableService.deleteSpreadsheet).mockResolvedValue({ id: 's1' } as any);

    const req = makeReq({ params: { id: 's1' } });
    const res = makeRes();

    await controller.deleteSpreadsheet(req, res);

    expect(tableService.deleteSpreadsheet).toHaveBeenCalledWith('u1', 's1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: null })
    );
  });
});

describe('tables controller - searchSpreadsheets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when query is blank', async () => {
    const req = makeReq({ query: { q: '   ' } });
    const res = makeRes();

    await controller.searchSpreadsheets(req, res);

    expect(tableService.searchSpreadsheets).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: [] })
    );
  });

  it('searches spreadsheets and returns results', async () => {
    const mockResults = [{ id: 's1', title: 'Budget 2025' }];
    vi.mocked(tableService.searchSpreadsheets).mockResolvedValue(mockResults as any);

    const req = makeReq({ query: { q: 'budget' } });
    const res = makeRes();

    await controller.searchSpreadsheets(req, res);

    expect(tableService.searchSpreadsheets).toHaveBeenCalledWith('u1', 'budget');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockResults })
    );
  });
});
