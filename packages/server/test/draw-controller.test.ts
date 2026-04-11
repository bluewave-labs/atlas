import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// Mock draw service
vi.mock('../src/apps/draw/service', () => ({
  listDrawings: vi.fn(),
  createDrawing: vi.fn(),
  getDrawing: vi.fn(),
  updateDrawing: vi.fn(),
  deleteDrawing: vi.fn(),
  restoreDrawing: vi.fn(),
  searchDrawings: vi.fn(),
  seedSampleDrawings: vi.fn(),
  updateDrawingVisibility: vi.fn(),
}));

// Mock app-permissions service so canAccess always returns true
vi.mock('../src/services/app-permissions.service', () => ({
  getAppPermission: vi.fn().mockResolvedValue({ role: 'owner' }),
  canAccess: vi.fn().mockReturnValue(true),
  decideRecordDelete: vi.fn().mockReturnValue('allow'),
}));

import * as controller from '../src/apps/draw/controller';
import * as drawingService from '../src/apps/draw/service';

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

describe('draw controller - listDrawings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns drawings list with success:true', async () => {
    const mockDrawings = [
      { id: 'd1', title: 'Wireframe' },
      { id: 'd2', title: 'Flowchart' },
    ];
    vi.mocked(drawingService.listDrawings).mockResolvedValue(mockDrawings as any);

    const req = makeReq();
    const res = makeRes();

    await controller.listDrawings(req, res);

    expect(drawingService.listDrawings).toHaveBeenCalledWith('u1', false, 't1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { drawings: mockDrawings } })
    );
  });

  it('passes includeArchived=true when query param is set', async () => {
    vi.mocked(drawingService.listDrawings).mockResolvedValue([]);

    const req = makeReq({ query: { includeArchived: 'true' } });
    const res = makeRes();

    await controller.listDrawings(req, res);

    expect(drawingService.listDrawings).toHaveBeenCalledWith('u1', true, 't1');
  });

  it('returns 500 when service throws', async () => {
    vi.mocked(drawingService.listDrawings).mockRejectedValue(new Error('DB error'));

    const req = makeReq();
    const res = makeRes();

    await controller.listDrawings(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Failed to list drawings' })
    );
  });
});

describe('draw controller - createDrawing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a drawing with title and content', async () => {
    const mockDrawing = { id: 'd1', title: 'New Drawing', content: '{}' };
    vi.mocked(drawingService.createDrawing).mockResolvedValue(mockDrawing as any);

    const req = makeReq({
      body: { title: 'New Drawing', content: '{}' },
    });
    const res = makeRes();

    await controller.createDrawing(req, res);

    expect(drawingService.createDrawing).toHaveBeenCalledWith('u1', 't1', {
      title: 'New Drawing',
      content: '{}',
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockDrawing })
    );
  });

  it('returns 500 when service throws', async () => {
    vi.mocked(drawingService.createDrawing).mockRejectedValue(new Error('Insert failed'));

    const req = makeReq({ body: { title: 'Test' } });
    const res = makeRes();

    await controller.createDrawing(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Failed to create drawing' })
    );
  });
});

describe('draw controller - getDrawing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when drawing is not found', async () => {
    vi.mocked(drawingService.getDrawing).mockResolvedValue(null as any);

    const req = makeReq({ params: { id: 'nonexistent' } });
    const res = makeRes();

    await controller.getDrawing(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Drawing not found' })
    );
  });

  it('returns the drawing when found', async () => {
    const mockDrawing = { id: 'd1', title: 'Wireframe', content: '{"elements":[]}' };
    vi.mocked(drawingService.getDrawing).mockResolvedValue(mockDrawing as any);

    const req = makeReq({ params: { id: 'd1' } });
    const res = makeRes();

    await controller.getDrawing(req, res);

    expect(drawingService.getDrawing).toHaveBeenCalledWith('u1', 'd1', 't1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockDrawing })
    );
  });
});

describe('draw controller - updateDrawing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when drawing to update is not found', async () => {
    vi.mocked(drawingService.updateDrawing).mockResolvedValue(null as any);

    const req = makeReq({ params: { id: 'missing' }, body: { title: 'Updated' } });
    const res = makeRes();

    await controller.updateDrawing(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Drawing not found' })
    );
  });

  it('updates the drawing successfully', async () => {
    const mockDrawing = { id: 'd1', title: 'Updated Title', content: '{}' };
    vi.mocked(drawingService.updateDrawing).mockResolvedValue(mockDrawing as any);

    const req = makeReq({
      params: { id: 'd1' },
      body: { title: 'Updated Title', content: '{}', isArchived: false },
    });
    const res = makeRes();

    await controller.updateDrawing(req, res);

    expect(drawingService.updateDrawing).toHaveBeenCalledWith('u1', 'd1', {
      title: 'Updated Title',
      content: '{}',
      isArchived: false,
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockDrawing })
    );
  });
});

describe('draw controller - deleteDrawing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes the drawing successfully', async () => {
    vi.mocked(drawingService.getDrawing).mockResolvedValue({ id: 'd1', userId: 'u1' } as any);
    vi.mocked(drawingService.deleteDrawing).mockResolvedValue(undefined as any);

    const req = makeReq({ params: { id: 'd1' } });
    const res = makeRes();

    await controller.deleteDrawing(req, res);

    expect(drawingService.deleteDrawing).toHaveBeenCalledWith('u1', 'd1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: null })
    );
  });

  it('returns 500 when service throws on delete', async () => {
    vi.mocked(drawingService.getDrawing).mockResolvedValue({ id: 'd1', userId: 'u1' } as any);
    vi.mocked(drawingService.deleteDrawing).mockRejectedValue(new Error('DB error'));

    const req = makeReq({ params: { id: 'd1' } });
    const res = makeRes();

    await controller.deleteDrawing(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Failed to delete drawing' })
    );
  });
});

describe('draw controller - restoreDrawing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 404 when drawing to restore is not found', async () => {
    // Controller now short-circuits on the pre-flight getDrawing call.
    vi.mocked(drawingService.getDrawing).mockResolvedValue(null as any);

    const req = makeReq({ params: { id: 'missing' } });
    const res = makeRes();

    await controller.restoreDrawing(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Drawing not found' })
    );
  });
});

describe('draw controller - searchDrawings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when query is blank', async () => {
    const req = makeReq({ query: { q: '   ' } });
    const res = makeRes();

    await controller.searchDrawings(req, res);

    expect(drawingService.searchDrawings).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: [] })
    );
  });

  it('searches drawings and returns results', async () => {
    const mockResults = [{ id: 'd1', title: 'Wireframe v2' }];
    vi.mocked(drawingService.searchDrawings).mockResolvedValue(mockResults as any);

    const req = makeReq({ query: { q: 'wireframe' } });
    const res = makeRes();

    await controller.searchDrawings(req, res);

    expect(drawingService.searchDrawings).toHaveBeenCalledWith('u1', 'wireframe');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockResults })
    );
  });
});
