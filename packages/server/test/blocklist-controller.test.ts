import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const { dbInsertMock, dbSelectMock, dbDeleteMock } = vi.hoisted(() => ({
  dbInsertMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbDeleteMock: vi.fn(),
}));

vi.mock('../src/config/database', () => ({
  db: {
    insert: () => dbInsertMock(),
    select: () => dbSelectMock(),
    delete: () => dbDeleteMock(),
  },
}));

import {
  addBlocklistEntry,
  listBlocklist,
  deleteBlocklistEntry,
} from '../src/apps/crm/controllers/blocklist.controller';

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => {
  dbInsertMock.mockReset();
  dbSelectMock.mockReset();
  dbDeleteMock.mockReset();
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

describe('blocklist.controller: listBlocklist', () => {
  it('returns blocklist patterns for the tenant', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ orderBy: () => Promise.resolve([
        { id: 'b-1', pattern: '*@noreply.*', createdAt: new Date('2026-01-01T00:00:00Z') },
        { id: 'b-2', pattern: 'spam@x.com', createdAt: new Date('2026-04-30T00:00:00Z') },
      ]) }) }),
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: {},
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await listBlocklist(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({ id: 'b-1', pattern: '*@noreply.*' }),
          expect.objectContaining({ id: 'b-2', pattern: 'spam@x.com' }),
        ]),
      }),
    );
  });
});

describe('blocklist.controller: deleteBlocklistEntry', () => {
  it('returns 400 when id is missing', async () => {
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: {},
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await deleteBlocklistEntry(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(dbDeleteMock).not.toHaveBeenCalled();
  });

  it('deletes the entry scoped to the tenant', async () => {
    dbDeleteMock.mockReturnValue({
      where: () => Promise.resolve({ rowCount: 1 }),
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'b-1' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await deleteBlocklistEntry(req, res);
    expect(dbDeleteMock).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { deleted: true },
    });
  });
});
