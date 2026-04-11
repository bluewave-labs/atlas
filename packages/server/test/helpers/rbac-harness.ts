import { expect, vi } from 'vitest';
import type { Request, Response } from 'express';
import type {
  AppRole,
  AppRecordAccess,
} from '../../src/services/app-permissions.service';

/**
 * Build a mocked Request object that mimics what requireAppPermission()
 * would have attached for a given appId + role + recordAccess combo.
 *
 * This is a harness for RBAC role-matrix regression tests. Individual
 * per-app test files mock the service layer themselves; this helper
 * only produces the Express plumbing (req/res) + the resolved perm.
 */
export function makeReqWithPerm(
  appId: string,
  role: AppRole,
  recordAccess: AppRecordAccess,
  overrides: Record<string, any> = {},
): Request {
  const permKey = `${appId}Perm`;
  const base: Record<string, any> = {
    auth: {
      userId: 'u-self',
      accountId: 'a1',
      email: 'self@test.com',
      tenantId: 't1',
    },
    body: {},
    params: {},
    query: {},
    [permKey]: { role, recordAccess, entityPermissions: null },
  };
  return { ...base, ...overrides } as unknown as Request;
}

export function makeRes(): Response {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  };
  return res as Response;
}

export function expectForbidden(res: any): void {
  expect(res.status).toHaveBeenCalledWith(403);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ success: false }),
  );
}

export function expectNotFound(res: any): void {
  expect(res.status).toHaveBeenCalledWith(404);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ success: false }),
  );
}

export function expectSuccess(res: any): void {
  // Controllers use res.json() (no explicit status) on success.
  // Assert that status was never called with a 4xx/5xx code and json
  // was called with success:true.
  const statusCalls = (res.status as any).mock.calls;
  for (const call of statusCalls) {
    const code = call[0];
    expect(code).toBeLessThan(400);
  }
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({ success: true }),
  );
}

export const SELF_USER_ID = 'u-self';
export const OTHER_USER_ID = 'u-other';
