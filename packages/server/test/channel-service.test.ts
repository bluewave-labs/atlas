import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbSelectMock = vi.fn();
const dbUpdateMock = vi.fn();

vi.mock('../src/config/database', () => ({
  db: {
    select: () => dbSelectMock(),
    update: () => dbUpdateMock(),
    transaction: async (fn: (tx: { select: () => any; update: () => any }) => Promise<unknown>) =>
      fn({ select: () => dbSelectMock(), update: () => dbUpdateMock() }),
  },
}));

import {
  listChannelsForUser,
  updateChannelSettings,
} from '../src/apps/crm/services/channel.service';

describe('channel.service: listChannelsForUser', () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
  });

  it('returns shared-with-tenant channels and channels owned by the user', async () => {
    const fakeRows = [
      { id: 'c1', visibility: 'shared-with-tenant', ownerUserId: 'u-other', tenantId: 't-1', accountId: 'a1', handle: 'sales@x.com', isSyncEnabled: true, contactAutoCreationPolicy: 'send-only', syncStage: 'incremental', syncStatus: null, syncError: null, lastIncrementalSyncAt: null, throttleRetryAfter: null, createdAt: new Date(), updatedAt: new Date() },
      { id: 'c2', visibility: 'private',           ownerUserId: 'u-1',     tenantId: 't-1', accountId: 'a2', handle: 'gorkem@x.com', isSyncEnabled: true, contactAutoCreationPolicy: 'send-only', syncStage: 'incremental', syncStatus: null, syncError: null, lastIncrementalSyncAt: null, throttleRetryAfter: null, createdAt: new Date(), updatedAt: new Date() },
    ];
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ orderBy: () => Promise.resolve(fakeRows) }) }),
    });

    const result = await listChannelsForUser({ userId: 'u-1', tenantId: 't-1' });
    expect(result).toHaveLength(2);
    expect(result.map((c) => c.id)).toEqual(['c1', 'c2']);
  });

});

describe('channel.service: updateChannelSettings', () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
    dbUpdateMock.mockReset();
  });

  it('updates only the fields supplied', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'c1', ownerUserId: 'u-1', tenantId: 't-1' }]) }) }),
    });
    let capturedSet: any = null;
    dbUpdateMock.mockReturnValue({
      set: (vals: any) => { capturedSet = vals; return { where: () => Promise.resolve() }; },
    });

    await updateChannelSettings({
      channelId: 'c1',
      userId: 'u-1',
      tenantId: 't-1',
      patch: { visibility: 'shared-with-tenant', isSyncEnabled: false },
    });

    expect(capturedSet).toMatchObject({
      visibility: 'shared-with-tenant',
      isSyncEnabled: false,
    });
    expect(capturedSet.contactAutoCreationPolicy).toBeUndefined();
  });

  it('rejects updates from a non-owner', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'c1', ownerUserId: 'u-other', tenantId: 't-1' }]) }) }),
    });

    await expect(
      updateChannelSettings({
        channelId: 'c1',
        userId: 'u-1',
        tenantId: 't-1',
        patch: { visibility: 'shared-with-tenant' },
      }),
    ).rejects.toThrow(/forbidden|not the owner/i);
  });

  it('throws on unknown channel', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });

    await expect(
      updateChannelSettings({
        channelId: 'c-missing',
        userId: 'u-1',
        tenantId: 't-1',
        patch: { isSyncEnabled: false },
      }),
    ).rejects.toThrow(/not found/i);
  });

  it('rejects invalid visibility values', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'c1', ownerUserId: 'u-1', tenantId: 't-1' }]) }) }),
    });

    await expect(
      updateChannelSettings({
        channelId: 'c1',
        userId: 'u-1',
        tenantId: 't-1',
        patch: { visibility: 'public' as any },
      }),
    ).rejects.toThrow(/invalid visibility/i);
  });

  it('rejects invalid contactAutoCreationPolicy values', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'c1', ownerUserId: 'u-1', tenantId: 't-1' }]) }) }),
    });

    await expect(
      updateChannelSettings({
        channelId: 'c1',
        userId: 'u-1',
        tenantId: 't-1',
        patch: { contactAutoCreationPolicy: 'aggressive' as any },
      }),
    ).rejects.toThrow(/invalid contactAutoCreationPolicy/i);
  });
});
