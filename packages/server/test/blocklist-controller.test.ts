import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const { dbInsertMock } = vi.hoisted(() => ({
  dbInsertMock: vi.fn(),
}));

vi.mock('../src/config/database', () => ({
  db: {
    insert: () => dbInsertMock(),
  },
}));

import { addBlocklistEntry } from '../src/apps/crm/controllers/blocklist.controller';

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => {
  dbInsertMock.mockReset();
});

describe('blocklist.controller: addBlocklistEntry', () => {
  it('returns 400 when pattern is missing', async () => {
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await addBlocklistEntry(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('returns 400 when pattern is empty/whitespace', async () => {
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { pattern: '   ' },
    } as unknown as Request;
    const res = mockRes();
    await addBlocklistEntry(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('inserts the pattern with onConflictDoNothing and returns success', async () => {
    let captured: any = null;
    dbInsertMock.mockReturnValue({
      values: (row: any) => {
        captured = row;
        return { onConflictDoNothing: () => Promise.resolve() };
      },
    });

    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { pattern: 'spam@example.com' },
    } as unknown as Request;
    const res = mockRes();
    await addBlocklistEntry(req, res);

    expect(captured).toMatchObject({
      tenantId: 't-1',
      pattern: 'spam@example.com',
      createdByUserId: 'u-1',
    });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { pattern: 'spam@example.com' },
    });
  });

  it('lowercases and trims the pattern before insert', async () => {
    let captured: any = null;
    dbInsertMock.mockReturnValue({
      values: (row: any) => {
        captured = row;
        return { onConflictDoNothing: () => Promise.resolve() };
      },
    });

    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { pattern: '  Spam@Example.COM  ' },
    } as unknown as Request;
    const res = mockRes();
    await addBlocklistEntry(req, res);

    expect(captured.pattern).toBe('spam@example.com');
  });
});
