import { describe, it, expect, afterEach, vi } from 'vitest';

describe('config/queue', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('exports the SYNC_QUEUE_NAME constant', async () => {
    const mod = await import('../src/config/queue');
    expect(mod.SYNC_QUEUE_NAME).toBe('atlas-sync');
  });

  it('exports SyncJobName values for both calendar jobs', async () => {
    const mod = await import('../src/config/queue');
    expect(mod.SyncJobName.CalendarFullSync).toBe('calendar-full-sync');
    expect(mod.SyncJobName.CalendarIncrementalSync).toBe('calendar-incremental-sync');
  });

  it('getSyncQueue() returns null when getRedisClient() returns null', async () => {
    vi.resetModules();
    vi.doMock('../src/config/redis', () => ({
      getRedisClient: () => null,
    }));
    const mod = await import('../src/config/queue');
    expect(mod.getSyncQueue()).toBeNull();
    vi.doUnmock('../src/config/redis');
  });
});
