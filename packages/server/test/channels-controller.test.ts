import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const {
  listChannelsForUserMock,
  updateChannelSettingsMock,
  getChannelByIdMock,
  queueAddMock,
  upsertJobSchedulerMock,
} = vi.hoisted(() => ({
  listChannelsForUserMock: vi.fn(),
  updateChannelSettingsMock: vi.fn(),
  getChannelByIdMock: vi.fn(),
  queueAddMock: vi.fn(async () => ({ id: 'job-1' })),
  upsertJobSchedulerMock: vi.fn(async () => undefined),
}));

let getSyncQueueMock: () => any = () => ({ add: queueAddMock, upsertJobScheduler: upsertJobSchedulerMock });

vi.mock('../src/apps/crm/services/channel.service', () => ({
  listChannelsForUser: listChannelsForUserMock,
  updateChannelSettings: updateChannelSettingsMock,
  getChannelById: getChannelByIdMock,
}));

vi.mock('../src/config/queue', () => ({
  getSyncQueue: () => getSyncQueueMock(),
  SyncJobName: {
    CalendarFullSync: 'calendar-full-sync',
    CalendarIncrementalSync: 'calendar-incremental-sync',
    GmailFullSync: 'gmail-full-sync',
    GmailIncrementalSync: 'gmail-incremental-sync',
  },
}));

import {
  listChannels,
  updateChannel,
  syncChannel,
} from '../src/apps/crm/controllers/channels.controller';

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

const fakeReq = { auth: { userId: 'u-1', tenantId: 't-1' }, params: {}, body: {} } as unknown as Request;

describe('channels.controller: listChannels', () => {
  beforeEach(() => {
    listChannelsForUserMock.mockReset();
  });

  it('returns the service result wrapped in success envelope', async () => {
    listChannelsForUserMock.mockResolvedValue([{ id: 'c1', handle: 'a@b.com' }]);
    const res = mockRes();
    await listChannels(fakeReq, res);
    expect(listChannelsForUserMock).toHaveBeenCalledWith({ userId: 'u-1', tenantId: 't-1' });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { channels: [{ id: 'c1', handle: 'a@b.com' }] },
    });
  });

  it('returns 500 on service error', async () => {
    listChannelsForUserMock.mockRejectedValue(new Error('boom'));
    const res = mockRes();
    await listChannels(fakeReq, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });
});

describe('channels.controller: updateChannel', () => {
  beforeEach(() => {
    updateChannelSettingsMock.mockReset();
  });

  it('passes the patch fields to the service', async () => {
    updateChannelSettingsMock.mockResolvedValue(undefined);
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'c1' },
      body: { visibility: 'shared-with-tenant', isSyncEnabled: false },
    } as unknown as Request;
    const res = mockRes();
    await updateChannel(req, res);
    expect(updateChannelSettingsMock).toHaveBeenCalledWith({
      channelId: 'c1',
      userId: 'u-1',
      tenantId: 't-1',
      patch: { visibility: 'shared-with-tenant', isSyncEnabled: false },
    });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: null });
  });

  it('returns 403 on forbidden errors from service', async () => {
    updateChannelSettingsMock.mockRejectedValue(new Error('forbidden: not the owner of channel c1'));
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'c1' },
      body: { isSyncEnabled: false },
    } as unknown as Request;
    const res = mockRes();
    await updateChannel(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 404 on not found errors', async () => {
    updateChannelSettingsMock.mockRejectedValue(new Error('channel not found: c-missing'));
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'c-missing' },
      body: { isSyncEnabled: false },
    } as unknown as Request;
    const res = mockRes();
    await updateChannel(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 on invalid value errors', async () => {
    updateChannelSettingsMock.mockRejectedValue(new Error('invalid visibility: public'));
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'c1' },
      body: { visibility: 'public' },
    } as unknown as Request;
    const res = mockRes();
    await updateChannel(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('channels.controller: syncChannel', () => {
  beforeEach(() => {
    queueAddMock.mockClear();
    upsertJobSchedulerMock.mockClear();
    getChannelByIdMock.mockReset();
    getSyncQueueMock = () => ({ add: queueAddMock, upsertJobScheduler: upsertJobSchedulerMock });
  });

  it('returns 404 if the channel is not visible to the user', async () => {
    getChannelByIdMock.mockResolvedValue(null);
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'c-missing' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await syncChannel(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it('enqueues a gmail-full-sync job and returns the job id', async () => {
    getChannelByIdMock.mockResolvedValue({
      id: 'c1', accountId: 'a1', ownerUserId: 'u-1', visibility: 'private',
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'c1' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await syncChannel(req, res);
    expect(queueAddMock).toHaveBeenCalledWith(
      'gmail-full-sync',
      expect.objectContaining({ channelId: 'c1', triggeredBy: 'user', userId: 'u-1' }),
    );
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { jobId: 'job-1', queued: true },
    });
  });

  it('returns 503 when queue is unavailable', async () => {
    getChannelByIdMock.mockResolvedValue({
      id: 'c1', accountId: 'a1', ownerUserId: 'u-1', visibility: 'private',
    });
    getSyncQueueMock = () => null;
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'c1' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await syncChannel(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.stringMatching(/redis/i) }),
    );
    expect(queueAddMock).not.toHaveBeenCalled();
  });
});
