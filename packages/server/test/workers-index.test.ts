import { describe, it, expect, vi, beforeEach } from 'vitest';

const addMock = vi.fn(async () => ({}));
const upsertJobSchedulerMock = vi.fn(async () => ({}));

vi.mock('../src/config/queue', async () => {
  const actual = await vi.importActual<typeof import('../src/config/queue')>(
    '../src/config/queue',
  );
  return {
    ...actual,
    getSyncQueue: () => ({
      add: addMock,
      upsertJobScheduler: upsertJobSchedulerMock,
      close: vi.fn(async () => undefined),
    }),
  };
});

vi.mock('../src/config/database', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve([{ id: 'acc-1' }, { id: 'acc-2' }]),
      }),
    }),
  },
}));

import { scheduleIncrementalSyncForAllAccounts } from '../src/workers/index';

describe('workers/index: scheduleIncrementalSyncForAllAccounts', () => {
  beforeEach(() => {
    addMock.mockClear();
    upsertJobSchedulerMock.mockClear();
  });

  it('upserts one repeatable job per Google-connected account', async () => {
    await scheduleIncrementalSyncForAllAccounts();
    expect(upsertJobSchedulerMock).toHaveBeenCalledTimes(2);
    expect(upsertJobSchedulerMock).toHaveBeenCalledWith(
      'calendar-incremental-acc-1',
      expect.objectContaining({ every: 5 * 60 * 1000 }),
      expect.objectContaining({
        name: 'calendar-incremental-sync',
        data: { accountId: 'acc-1' },
      }),
    );
  });

  it('is a no-op when the queue is unavailable', async () => {
    vi.doMock('../src/config/queue', async () => {
      const actual = await vi.importActual<typeof import('../src/config/queue')>(
        '../src/config/queue',
      );
      return { ...actual, getSyncQueue: () => null };
    });
    vi.resetModules();
    const { scheduleIncrementalSyncForAllAccounts: fn } = await import(
      '../src/workers/index'
    );
    await expect(fn()).resolves.toBeUndefined();
  });
});

describe('workers/index: scheduleGmailIncrementalSyncForAllChannels', () => {
  beforeEach(() => {
    addMock.mockClear();
    upsertJobSchedulerMock.mockClear();
  });

  it('upserts one repeatable job per gmail channel with sync enabled', async () => {
    vi.resetModules();
    vi.doMock('../src/config/queue', async () => {
      const actual = await vi.importActual<typeof import('../src/config/queue')>(
        '../src/config/queue',
      );
      return {
        ...actual,
        getSyncQueue: () => ({
          add: addMock,
          upsertJobScheduler: upsertJobSchedulerMock,
          close: vi.fn(async () => undefined),
        }),
      };
    });
    vi.doMock('../src/config/database', () => ({
      db: {
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([{ id: 'ch-1' }, { id: 'ch-2' }]),
          }),
        }),
      },
    }));
    const { scheduleGmailIncrementalSyncForAllChannels: fn } = await import('../src/workers/index');
    await fn();
    expect(upsertJobSchedulerMock).toHaveBeenCalledTimes(2);
    expect(upsertJobSchedulerMock).toHaveBeenCalledWith(
      'gmail-incremental-ch-1',
      expect.objectContaining({ every: 5 * 60 * 1000 }),
      expect.objectContaining({
        name: 'gmail-incremental-sync',
        data: { channelId: 'ch-1' },
      }),
    );
    vi.doUnmock('../src/config/database');
    vi.doUnmock('../src/config/queue');
  });
});
