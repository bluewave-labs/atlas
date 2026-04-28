import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/services/calendar-sync.service', () => ({
  performCalendarFullSync: vi.fn(async () => undefined),
  performCalendarIncrementalSync: vi.fn(async () => undefined),
}));

vi.mock('../src/apps/crm/services/gmail-sync.service', () => ({
  performGmailFullSync: vi.fn(async () => undefined),
  performGmailIncrementalSync: vi.fn(async () => undefined),
}));

import { processSyncJob } from '../src/workers/sync.worker';
import * as calendarSync from '../src/services/calendar-sync.service';
import * as gmailSync from '../src/apps/crm/services/gmail-sync.service';

describe('sync.worker: processSyncJob', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dispatches calendar-full-sync to performCalendarFullSync', async () => {
    await processSyncJob({
      name: 'calendar-full-sync',
      data: { accountId: 'acc-1', triggeredBy: 'user', userId: 'u-1' },
    } as any);
    expect(calendarSync.performCalendarFullSync).toHaveBeenCalledWith('acc-1');
    expect(calendarSync.performCalendarIncrementalSync).not.toHaveBeenCalled();
  });

  it('dispatches calendar-incremental-sync to performCalendarIncrementalSync', async () => {
    await processSyncJob({
      name: 'calendar-incremental-sync',
      data: { accountId: 'acc-2' },
    } as any);
    expect(calendarSync.performCalendarIncrementalSync).toHaveBeenCalledWith('acc-2');
    expect(calendarSync.performCalendarFullSync).not.toHaveBeenCalled();
  });

  it('dispatches gmail-full-sync to performGmailFullSync', async () => {
    await processSyncJob({
      name: 'gmail-full-sync',
      data: { channelId: 'ch-1', triggeredBy: 'user', userId: 'u-1' },
    } as any);
    expect(gmailSync.performGmailFullSync).toHaveBeenCalledWith('ch-1');
    expect(gmailSync.performGmailIncrementalSync).not.toHaveBeenCalled();
  });

  it('dispatches gmail-incremental-sync to performGmailIncrementalSync', async () => {
    await processSyncJob({
      name: 'gmail-incremental-sync',
      data: { channelId: 'ch-2' },
    } as any);
    expect(gmailSync.performGmailIncrementalSync).toHaveBeenCalledWith('ch-2');
    expect(gmailSync.performGmailFullSync).not.toHaveBeenCalled();
  });

  it('throws on unknown job name', async () => {
    await expect(
      processSyncJob({ name: 'totally-fake-job', data: {} } as any),
    ).rejects.toThrow(/unknown sync job/i);
  });
});
