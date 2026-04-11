import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../src/services/custom-field.service', () => ({
  listFieldDefinitions: vi.fn().mockResolvedValue([]),
  createFieldDefinition: vi.fn().mockResolvedValue({ id: 'f1' }),
  updateFieldDefinition: vi.fn().mockResolvedValue({ id: 'f1' }),
  deleteFieldDefinition: vi.fn().mockResolvedValue({ id: 'f1' }),
  getFieldDefinitionById: vi.fn().mockResolvedValue({
    id: 'f1',
    appId: 'crm',
    recordType: 'deal',
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

import * as handlers from '../src/routes/custom-fields.routes';
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

describe('RBAC matrix - Custom Fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------- GET list --------
  it('viewer can GET list custom fields', async () => {
    const res = makeRes();
    await handlers.listFieldsHandler(
      makeReq('viewer', { params: { appId: 'crm', recordType: 'deal' } }),
      res,
    );
    expectSuccess(res);
  });

  it('editor can GET list custom fields', async () => {
    const res = makeRes();
    await handlers.listFieldsHandler(
      makeReq('editor', { params: { appId: 'crm', recordType: 'deal' } }),
      res,
    );
    expectSuccess(res);
  });

  it('admin can GET list custom fields', async () => {
    const res = makeRes();
    await handlers.listFieldsHandler(
      makeReq('admin', { params: { appId: 'crm', recordType: 'deal' } }),
      res,
    );
    expectSuccess(res);
  });

  // -------- POST create --------
  it('viewer cannot POST create custom field', async () => {
    const res = makeRes();
    await handlers.createFieldHandler(
      makeReq('viewer', {
        params: { appId: 'crm', recordType: 'deal' },
        body: { name: 'Industry', slug: 'industry', fieldType: 'text' },
      }),
      res,
    );
    expect403(res);
  });

  it('editor can POST create custom field', async () => {
    const res = makeRes();
    await handlers.createFieldHandler(
      makeReq('editor', {
        params: { appId: 'crm', recordType: 'deal' },
        body: { name: 'Industry', slug: 'industry', fieldType: 'text' },
      }),
      res,
    );
    expectSuccess(res);
  });

  it('admin can POST create custom field', async () => {
    const res = makeRes();
    await handlers.createFieldHandler(
      makeReq('admin', {
        params: { appId: 'crm', recordType: 'deal' },
        body: { name: 'Industry', slug: 'industry', fieldType: 'text' },
      }),
      res,
    );
    expectSuccess(res);
  });

  // -------- PATCH update --------
  it('viewer cannot PATCH update custom field', async () => {
    const res = makeRes();
    await handlers.updateFieldHandler(
      makeReq('viewer', { params: { id: 'f1' }, body: { name: 'New' } }),
      res,
    );
    expect403(res);
  });

  it('editor can PATCH update custom field', async () => {
    const res = makeRes();
    await handlers.updateFieldHandler(
      makeReq('editor', { params: { id: 'f1' }, body: { name: 'New' } }),
      res,
    );
    expectSuccess(res);
  });

  it('admin can PATCH update custom field', async () => {
    const res = makeRes();
    await handlers.updateFieldHandler(
      makeReq('admin', { params: { id: 'f1' }, body: { name: 'New' } }),
      res,
    );
    expectSuccess(res);
  });

  it('PATCH returns 404 when field not found', async () => {
    const res = makeRes();
    const svc = await import('../src/services/custom-field.service');
    vi.mocked(svc.getFieldDefinitionById).mockResolvedValueOnce(null as any);
    await handlers.updateFieldHandler(
      makeReq('admin', { params: { id: 'missing' }, body: {} }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  // -------- DELETE --------
  it('viewer cannot DELETE custom field', async () => {
    const res = makeRes();
    await handlers.deleteFieldHandler(
      makeReq('viewer', { params: { id: 'f1' } }),
      res,
    );
    expect403(res);
  });

  it('editor can DELETE custom field', async () => {
    const res = makeRes();
    await handlers.deleteFieldHandler(
      makeReq('editor', { params: { id: 'f1' } }),
      res,
    );
    expectSuccess(res);
  });

  it('admin can DELETE custom field', async () => {
    const res = makeRes();
    await handlers.deleteFieldHandler(
      makeReq('admin', { params: { id: 'f1' } }),
      res,
    );
    expectSuccess(res);
  });

  it('DELETE returns 404 when field not found', async () => {
    const res = makeRes();
    const svc = await import('../src/services/custom-field.service');
    vi.mocked(svc.getFieldDefinitionById).mockResolvedValueOnce(null as any);
    await handlers.deleteFieldHandler(
      makeReq('admin', { params: { id: 'missing' } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  // -------- Tenant gating --------
  it('returns 400 when tenantId is missing', async () => {
    const res = makeRes();
    await handlers.listFieldsHandler(
      {
        auth: { userId: 'u1', accountId: 'a1', email: 't@t.com' },
        body: {},
        params: { appId: 'crm', recordType: 'deal' },
        query: {},
      } as any,
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
