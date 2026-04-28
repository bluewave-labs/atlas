import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const addMock = vi.fn(async () => ({ id: 'job-1' }));
const getJobCountsMock = vi.fn(async () => ({ waiting: 2, active: 1, delayed: 0, failed: 0 }));

let getSyncQueueMock: () => any = () => ({ add: addMock, getJobCounts: getJobCountsMock });

vi.mock('../src/config/queue', () => ({
  // Closure reads the let-binding at call time so individual tests can swap behavior.
  getSyncQueue: () => getSyncQueueMock(),
  SyncJobName: { CalendarFullSync: 'calendar-full-sync', CalendarIncrementalSync: 'calendar-incremental-sync' },
  SYNC_QUEUE_NAME: 'atlas-sync',
}));

let dbSelectLimitMock: () => Promise<any[]> = () =>
  Promise.resolve([{
    id: 'acc-1',
    provider: 'google',
    syncStatus: 'idle',
    syncError: null,
    lastSync: null,
    lastFullSync: null,
  }]);

vi.mock('../src/config/database', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => dbSelectLimitMock(),
        }),
      }),
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  },
}));

vi.mock('../src/services/google-auth', () => ({ isGoogleConfigured: () => true }));
vi.mock('../src/config/redis', () => ({ getRedisClient: () => ({}) }));

import { startGoogleSync, getGoogleSyncStatus } from '../src/apps/crm/controllers/dashboard.controller';

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

const fakeReq = { auth: { userId: 'u-1', tenantId: 't-1' } } as unknown as Request;

describe('CRM startGoogleSync controller', () => {
  beforeEach(() => {
    addMock.mockClear();
    getJobCountsMock.mockClear();
    getSyncQueueMock = () => ({ add: addMock, getJobCounts: getJobCountsMock });
    // Reset to happy-path account
    dbSelectLimitMock = () =>
      Promise.resolve([{
        id: 'acc-1',
        provider: 'google',
        syncStatus: 'idle',
        syncError: null,
        lastSync: null,
        lastFullSync: null,
      }]);
  });

  it('enqueues a calendar-full-sync job with the user\'s accountId', async () => {
    const res = mockRes();

    await startGoogleSync(fakeReq, res);

    expect(addMock).toHaveBeenCalledWith(
      'calendar-full-sync',
      { accountId: 'acc-1', triggeredBy: 'user', userId: 'u-1' },
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { jobId: 'job-1', queued: true },
    });
  });

  it('returns 503 when queue is unavailable', async () => {
    getSyncQueueMock = () => null;
    const res = mockRes();

    await startGoogleSync(fakeReq, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringMatching(/redis/i) }),
    );
    expect(addMock).not.toHaveBeenCalled();
  });

  it('returns 400 when the user has no Google account', async () => {
    dbSelectLimitMock = () => Promise.resolve([]);
    const res = mockRes();

    await startGoogleSync(fakeReq, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringMatching(/no connected google account/i) }),
    );
    expect(addMock).not.toHaveBeenCalled();
  });
});

describe('CRM getGoogleSyncStatus controller', () => {
  beforeEach(() => {
    getJobCountsMock.mockClear();
    getSyncQueueMock = () => ({ add: addMock, getJobCounts: getJobCountsMock });
    dbSelectLimitMock = () =>
      Promise.resolve([{
        id: 'acc-1',
        provider: 'google',
        syncStatus: 'idle',
        syncError: null,
        lastSync: null,
        lastFullSync: null,
      }]);
  });

  it('includes queueDepth from getJobCounts', async () => {
    const res = mockRes();

    await getGoogleSyncStatus(fakeReq, res);

    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.queueDepth).toEqual({ waiting: 2, active: 1, delayed: 0, failed: 0 });
  });

  it('returns null queueDepth when queue is unavailable', async () => {
    getSyncQueueMock = () => null;
    const res = mockRes();

    await getGoogleSyncStatus(fakeReq, res);

    const payload = (res.json as any).mock.calls[0][0];
    expect(payload.data.queueDepth).toBeNull();
  });
});
