import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../src/services/record-link.service', () => ({
  getLinkCounts: vi.fn().mockResolvedValue([]),
  getLinksWithTitles: vi.fn().mockResolvedValue([]),
  getLinksForRecord: vi.fn().mockResolvedValue([]),
  createLink: vi.fn().mockResolvedValue({ id: 'l1' }),
  deleteLink: vi.fn().mockResolvedValue({ id: 'l1' }),
  getLinkById: vi.fn().mockResolvedValue({
    id: 'l1',
    sourceAppId: 'crm',
    sourceRecordId: 'r1',
    targetAppId: 'tasks',
    targetRecordId: 'r2',
  }),
}));

vi.mock('../src/services/app-permissions.service', () => ({
  getAppPermission: vi.fn(),
  canAccess: (role: string, op: string) => {
    const matrix: Record<string, Set<string>> = {
      admin: new Set(['view', 'create', 'update', 'delete', 'delete_own']),
      editor: new Set(['view', 'create', 'update', 'delete_own']),
      viewer: new Set(['view']),
    };
    return matrix[role]?.has(op) ?? false;
  },
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../src/middleware/auth', () => ({
  authMiddleware: (_req: any, _res: any, next: any) => next(),
}));

import * as handlers from '../src/routes/record-links.routes';
import * as perms from '../src/services/app-permissions.service';

type Role = 'admin' | 'editor' | 'viewer';

function makeReq(role: Role, overrides: Record<string, any> = {}): Request {
  vi.mocked(perms.getAppPermission).mockResolvedValue({
    role,
    recordAccess: 'all',
    entityPermissions: null,
  } as any);
  return {
    auth: { userId: 'u1', accountId: 'a1', email: 't@t.com', tenantId: 't1' },
    body: {},
    params: {},
    query: {},
    ...overrides,
  } as any;
}

function makeRes(): Response {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as Response;
}

function expect403(res: any) {
  expect(res.status).toHaveBeenCalledWith(403);
}
function expectSuccess(res: any) {
  const statusCalls = (res.status as any).mock.calls;
  for (const call of statusCalls) expect(call[0]).toBeLessThan(400);
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
}

describe('RBAC matrix - Record Links', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------- GET /counts --------
  it('viewer can GET link counts', async () => {
    const res = makeRes();
    await handlers.getLinkCountsHandler(
      makeReq('viewer', { params: { appId: 'crm', recordId: 'r1' } }),
      res,
    );
    expectSuccess(res);
  });

  it('editor can GET link counts', async () => {
    const res = makeRes();
    await handlers.getLinkCountsHandler(
      makeReq('editor', { params: { appId: 'crm', recordId: 'r1' } }),
      res,
    );
    expectSuccess(res);
  });

  it('admin can GET link counts', async () => {
    const res = makeRes();
    await handlers.getLinkCountsHandler(
      makeReq('admin', { params: { appId: 'crm', recordId: 'r1' } }),
      res,
    );
    expectSuccess(res);
  });

  // -------- GET /details --------
  it('viewer can GET link details', async () => {
    const res = makeRes();
    await handlers.getLinkDetailsHandler(
      makeReq('viewer', { params: { appId: 'crm', recordId: 'r1' } }),
      res,
    );
    expectSuccess(res);
  });

  // -------- GET /:appId/:recordId --------
  it('viewer can GET links list', async () => {
    const res = makeRes();
    await handlers.getLinksForRecordHandler(
      makeReq('viewer', { params: { appId: 'crm', recordId: 'r1' } }),
      res,
    );
    expectSuccess(res);
  });

  // -------- POST / --------
  it('viewer cannot POST create link', async () => {
    const res = makeRes();
    await handlers.createLinkHandler(
      makeReq('viewer', {
        body: { sourceAppId: 'crm', sourceRecordId: 'r1', targetAppId: 'tasks', targetRecordId: 'r2' },
      }),
      res,
    );
    expect403(res);
  });

  it('editor can POST create link (update on both sides)', async () => {
    const res = makeRes();
    vi.mocked(perms.getAppPermission).mockResolvedValue({
      role: 'editor',
      recordAccess: 'all',
      entityPermissions: null,
    } as any);
    await handlers.createLinkHandler(
      {
        auth: { userId: 'u1', accountId: 'a1', email: 't@t.com', tenantId: 't1' },
        body: { sourceAppId: 'crm', sourceRecordId: 'r1', targetAppId: 'tasks', targetRecordId: 'r2' },
        params: {},
        query: {},
      } as any,
      res,
    );
    expectSuccess(res);
  });

  it('admin can POST create link', async () => {
    const res = makeRes();
    vi.mocked(perms.getAppPermission).mockResolvedValue({
      role: 'admin',
      recordAccess: 'all',
      entityPermissions: null,
    } as any);
    await handlers.createLinkHandler(
      {
        auth: { userId: 'u1', accountId: 'a1', email: 't@t.com', tenantId: 't1' },
        body: { sourceAppId: 'crm', sourceRecordId: 'r1', targetAppId: 'tasks', targetRecordId: 'r2' },
        params: {},
        query: {},
      } as any,
      res,
    );
    expectSuccess(res);
  });

  it('POST create link fails if caller lacks update on source side', async () => {
    const res = makeRes();
    vi.mocked(perms.getAppPermission).mockImplementation(async (_t, _u, appId) => {
      if (appId === 'crm') return { role: 'viewer', recordAccess: 'all', entityPermissions: null } as any;
      return { role: 'admin', recordAccess: 'all', entityPermissions: null } as any;
    });
    await handlers.createLinkHandler(
      {
        auth: { userId: 'u1', accountId: 'a1', email: 't@t.com', tenantId: 't1' },
        body: { sourceAppId: 'crm', sourceRecordId: 'r1', targetAppId: 'tasks', targetRecordId: 'r2' },
        params: {},
        query: {},
      } as any,
      res,
    );
    expect403(res);
  });

  it('POST create link fails if caller lacks update on target side', async () => {
    const res = makeRes();
    vi.mocked(perms.getAppPermission).mockImplementation(async (_t, _u, appId) => {
      if (appId === 'crm') return { role: 'admin', recordAccess: 'all', entityPermissions: null } as any;
      return { role: 'viewer', recordAccess: 'all', entityPermissions: null } as any;
    });
    await handlers.createLinkHandler(
      {
        auth: { userId: 'u1', accountId: 'a1', email: 't@t.com', tenantId: 't1' },
        body: { sourceAppId: 'crm', sourceRecordId: 'r1', targetAppId: 'tasks', targetRecordId: 'r2' },
        params: {},
        query: {},
      } as any,
      res,
    );
    expect403(res);
  });

  // -------- DELETE /:id --------
  it('viewer cannot DELETE link', async () => {
    const res = makeRes();
    await handlers.deleteLinkHandler(
      makeReq('viewer', { params: { id: 'l1' } }),
      res,
    );
    expect403(res);
  });

  it('editor can DELETE link (has update on source)', async () => {
    const res = makeRes();
    await handlers.deleteLinkHandler(
      makeReq('editor', { params: { id: 'l1' } }),
      res,
    );
    expectSuccess(res);
  });

  it('admin can DELETE link', async () => {
    const res = makeRes();
    await handlers.deleteLinkHandler(
      makeReq('admin', { params: { id: 'l1' } }),
      res,
    );
    expectSuccess(res);
  });

  it('DELETE returns 404 when link not found', async () => {
    const res = makeRes();
    const recordLinkService = await import('../src/services/record-link.service');
    vi.mocked(recordLinkService.getLinkById).mockResolvedValueOnce(null as any);
    await handlers.deleteLinkHandler(
      makeReq('admin', { params: { id: 'missing' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  // -------- Tenant gating --------
  it('returns 400 when tenantId is missing', async () => {
    const res = makeRes();
    await handlers.getLinkCountsHandler(
      {
        auth: { userId: 'u1', accountId: 'a1', email: 't@t.com' },
        body: {},
        params: { appId: 'crm', recordId: 'r1' },
        query: {},
      } as any,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
