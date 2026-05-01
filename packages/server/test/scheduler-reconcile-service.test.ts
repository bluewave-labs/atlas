import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  getSyncQueueMock,
  getJobSchedulersMock,
  removeJobSchedulerMock,
  dbSelectMock,
} = vi.hoisted(() => ({
  getSyncQueueMock: vi.fn(),
  getJobSchedulersMock: vi.fn(),
  removeJobSchedulerMock: vi.fn(),
  dbSelectMock: vi.fn(),
}));

vi.mock('../src/config/queue', () => ({
  getSyncQueue: () => getSyncQueueMock(),
}));

vi.mock('../src/config/database', () => ({
  db: {
    select: () => dbSelectMock(),
  },
}));

import { reconcileGmailIncrementalSchedulers } from '../src/apps/crm/services/scheduler-reconcile.service';

beforeEach(() => {
  getSyncQueueMock.mockReset();
  getJobSchedulersMock.mockReset();
  removeJobSchedulerMock.mockReset();
  dbSelectMock.mockReset();
  getSyncQueueMock.mockReturnValue({
    getJobSchedulers: getJobSchedulersMock,
    removeJobScheduler: removeJobSchedulerMock,
  });
});

describe('reconcileGmailIncrementalSchedulers', () => {
  it('does nothing when queue is unavailable', async () => {
    getSyncQueueMock.mockReturnValue(null);
    await reconcileGmailIncrementalSchedulers();
    expect(getJobSchedulersMock).not.toHaveBeenCalled();
  });

  it('skips non-gmail-incremental keys', async () => {
    getJobSchedulersMock.mockResolvedValue([
      { key: 'calendar-incremental-acc-1', name: 'calendar-incremental-sync' },
      { key: 'gmail-message-cleaner', name: 'gmail-message-cleaner' },
    ]);
    await reconcileGmailIncrementalSchedulers();
    expect(removeJobSchedulerMock).not.toHaveBeenCalled();
  });

  it('removes schedulers whose channel is missing', async () => {
    getJobSchedulersMock.mockResolvedValue([
      { key: 'gmail-incremental-ch-1', name: 'gmail-incremental-sync' },
      { key: 'gmail-incremental-ch-2', name: 'gmail-incremental-sync' },
    ]);
    // ch-1 exists and is enabled. ch-2 doesn't exist.
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([{ id: 'ch-1', isSyncEnabled: true }]) }),
    });
    await reconcileGmailIncrementalSchedulers();
    expect(removeJobSchedulerMock).toHaveBeenCalledWith('gmail-incremental-ch-2');
    expect(removeJobSchedulerMock).not.toHaveBeenCalledWith('gmail-incremental-ch-1');
  });

  it('removes schedulers whose channel is sync-disabled', async () => {
    getJobSchedulersMock.mockResolvedValue([
      { key: 'gmail-incremental-ch-1', name: 'gmail-incremental-sync' },
    ]);
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([{ id: 'ch-1', isSyncEnabled: false }]) }),
    });
    await reconcileGmailIncrementalSchedulers();
    expect(removeJobSchedulerMock).toHaveBeenCalledWith('gmail-incremental-ch-1');
  });

  it('removes nothing and short-circuits the channel SELECT when no gmail-incremental schedulers exist', async () => {
    getJobSchedulersMock.mockResolvedValue([
      { key: 'calendar-incremental-acc-1', name: 'calendar-incremental-sync' },
    ]);
    await reconcileGmailIncrementalSchedulers();
    expect(removeJobSchedulerMock).not.toHaveBeenCalled();
    // The channel SELECT should NOT fire when there are no candidate keys.
    expect(dbSelectMock).not.toHaveBeenCalled();
  });
});
