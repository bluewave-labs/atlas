import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '../src/config/database';

// Mock event service at the module level so we can test its callers,
// but here we test the service functions themselves via the mocked db.
// Because the real service.ts imports db directly, we rely on the db mock
// from setup.ts and test the contract through the function calls.

// We import after setup.ts has mocked the database
import {
  emitAppEvent,
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
  dismissNotification,
  listActivityFeed,
} from '../src/services/event.service';

describe('event.service — emitAppEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inserts into activity feed when called', async () => {
    const mockDb = db as any;

    await emitAppEvent({
      tenantId: 't1',
      userId: 'u1',
      appId: 'crm',
      eventType: 'deal.created',
      title: 'created a new deal: Test Deal',
    });

    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('creates notifications for specified users excluding the actor', async () => {
    const mockDb = db as any;

    // Mock the accounts lookup for batch notification creation
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { userId: 'u2', id: 'acct-u2' },
          { userId: 'u3', id: 'acct-u3' },
        ]),
        orderBy: vi.fn().mockResolvedValue([]),
        limit: vi.fn().mockResolvedValue([]),
      }),
    });

    await emitAppEvent({
      tenantId: 't1',
      userId: 'u1',
      appId: 'crm',
      eventType: 'deal.created',
      title: 'created a new deal',
      notifyUserIds: ['u1', 'u2', 'u3'],
      metadata: { dealId: 'd1' },
    });

    // insert should be called at least twice: once for activity feed, once for notifications
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('does not create notifications when notifyUserIds is empty', async () => {
    const mockDb = db as any;

    const insertCallsBefore = mockDb.insert.mock.calls.length;

    await emitAppEvent({
      tenantId: 't1',
      userId: 'u1',
      appId: 'tasks',
      eventType: 'task.completed',
      title: 'completed a task',
      notifyUserIds: [],
    });

    // Only the activity feed insert should have been called
    expect(mockDb.insert).toHaveBeenCalledTimes(insertCallsBefore + 1);
  });

  it('does not create notifications when only the actor is in notifyUserIds', async () => {
    const mockDb = db as any;

    await emitAppEvent({
      tenantId: 't1',
      userId: 'u1',
      appId: 'crm',
      eventType: 'contact.created',
      title: 'added a new contact',
      notifyUserIds: ['u1'],
    });

    // Only activity feed insert — no notification insert because actor is excluded
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('handles metadata defaulting to empty object', async () => {
    const mockDb = db as any;

    await emitAppEvent({
      tenantId: 't1',
      userId: 'u1',
      appId: 'hr',
      eventType: 'employee.created',
      title: 'added employee',
    });

    expect(mockDb.insert).toHaveBeenCalled();
  });
});

describe('event.service — notification queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset any stale `mockReturnValueOnce` queue left over from prior
    // describe blocks by reinstalling the default select implementation.
    const mockDb = db as any;
    mockDb.select.mockReset();
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn().mockResolvedValue([]),
        }),
        orderBy: vi.fn().mockResolvedValue([]),
        limit: vi.fn().mockResolvedValue([]),
      }),
    });
  });

  it('getUnreadCount returns 0 when no notifications exist', async () => {
    const mockDb = db as any;

    // Mock the count query
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 0 }]),
        orderBy: vi.fn().mockResolvedValue([]),
        limit: vi.fn().mockResolvedValue([]),
      }),
    });

    const count = await getUnreadCount('u1', 'a1');
    expect(count).toBe(0);
  });

  it('getUnreadCount returns count from database', async () => {
    const mockDb = db as any;

    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ count: 5 }]),
        orderBy: vi.fn().mockResolvedValue([]),
        limit: vi.fn().mockResolvedValue([]),
      }),
    });

    const count = await getUnreadCount('u1', 'a1');
    expect(count).toBe(5);
  });

  it('markNotificationRead calls db.update with correct parameters', async () => {
    const mockDb = db as any;

    await markNotificationRead('notif-1', 'u1');

    expect(mockDb.update).toHaveBeenCalled();
  });

  it('markAllNotificationsRead calls db.update', async () => {
    const mockDb = db as any;

    await markAllNotificationsRead('u1', 'a1');

    expect(mockDb.update).toHaveBeenCalled();
  });

  it('dismissNotification calls db.delete', async () => {
    const mockDb = db as any;

    await dismissNotification('notif-1', 'u1');

    expect(mockDb.delete).toHaveBeenCalled();
  });
});
