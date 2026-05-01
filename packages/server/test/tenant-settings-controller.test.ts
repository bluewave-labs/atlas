import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const { dbSelectMock, dbUpdateMock } = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  dbUpdateMock: vi.fn(),
}));

vi.mock('../src/config/database', () => ({
  db: {
    select: () => dbSelectMock(),
    update: () => dbUpdateMock(),
  },
}));

import {
  getTenantSettings,
  updateRetention,
} from '../src/apps/crm/controllers/tenant-settings.controller';

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => {
  dbSelectMock.mockReset();
  dbUpdateMock.mockReset();
});

describe('tenant-settings.controller: getTenantSettings', () => {
  it('returns gmailRetentionDays for the tenant', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ gmailRetentionDays: 30 }]) }) }),
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: {},
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await getTenantSettings(req, res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { gmailRetentionDays: 30 },
    });
  });

  it('returns null gmailRetentionDays when unset', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ gmailRetentionDays: null }]) }) }),
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: {},
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await getTenantSettings(req, res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { gmailRetentionDays: null },
    });
  });
});

describe('tenant-settings.controller: updateRetention', () => {
  it('returns 400 when value is not null and not a positive integer', async () => {
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { gmailRetentionDays: -5 },
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await updateRetention(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(dbUpdateMock).not.toHaveBeenCalled();
  });

  it('returns 400 when value is not an integer', async () => {
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { gmailRetentionDays: 1.5 },
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await updateRetention(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('persists null for "retain forever"', async () => {
    let updateSet: any = null;
    dbUpdateMock.mockReturnValue({
      set: (vals: any) => {
        updateSet = vals;
        return { where: () => Promise.resolve() };
      },
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { gmailRetentionDays: null },
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await updateRetention(req, res);
    expect(updateSet.gmailRetentionDays).toBeNull();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { gmailRetentionDays: null },
    });
  });

  it('persists a valid positive integer', async () => {
    let updateSet: any = null;
    dbUpdateMock.mockReturnValue({
      set: (vals: any) => {
        updateSet = vals;
        return { where: () => Promise.resolve() };
      },
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { gmailRetentionDays: 30 },
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await updateRetention(req, res);
    expect(updateSet.gmailRetentionDays).toBe(30);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { gmailRetentionDays: 30 },
    });
  });
});
