import { describe, it, expect, vi, beforeEach } from 'vitest';

const { dbSelectMock, dbUpdateMock, upsertActivitiesForMessageMock } = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  dbUpdateMock: vi.fn(),
  upsertActivitiesForMessageMock: vi.fn(),
}));

vi.mock('../src/config/database', () => ({
  db: {
    select: () => dbSelectMock(),
    update: () => dbUpdateMock(),
  },
}));

vi.mock('../src/apps/crm/services/message-activity.service', () => ({
  upsertActivitiesForMessage: upsertActivitiesForMessageMock,
}));

import { backfillContactMessages } from '../src/apps/crm/services/contact-message-backfill.service';

beforeEach(() => {
  dbSelectMock.mockReset();
  dbUpdateMock.mockReset();
  upsertActivitiesForMessageMock.mockReset();
  upsertActivitiesForMessageMock.mockResolvedValue(undefined);
  dbUpdateMock.mockReturnValue({
    set: () => ({ where: () => Promise.resolve({ rowCount: 0 }) }),
  });
});

describe('backfillContactMessages', () => {
  it('returns 0 when the contact has no email', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ email: null }]) }) }),
    });
    const result = await backfillContactMessages('t-1', 'c-1', 'u-1');
    expect(result).toBe(0);
    expect(dbUpdateMock).not.toHaveBeenCalled();
    expect(upsertActivitiesForMessageMock).not.toHaveBeenCalled();
  });

  it('returns 0 when contact does not exist', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    const result = await backfillContactMessages('t-1', 'c-missing', 'u-1');
    expect(result).toBe(0);
  });

  it('links matching participant rows and re-runs activity upsert per affected message', async () => {
    // First select: load contact email
    dbSelectMock
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([{ email: 'jane@example.com' }]) }) }),
      })
      // Second select: find affected messages by handle (lowercased) where personId IS NULL.
      // The service joins messageParticipants → messages, so the chain includes innerJoin.
      .mockReturnValueOnce({
        from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([
          { messageId: 'msg-1', direction: 'inbound' },
          { messageId: 'msg-2', direction: 'outbound' },
        ]) }) }),
      });

    let updateRan = false;
    dbUpdateMock.mockReturnValue({
      set: () => ({
        where: () => {
          updateRan = true;
          return Promise.resolve({ rowCount: 2 });
        },
      }),
    });

    const result = await backfillContactMessages('t-1', 'c-1', 'u-1');

    expect(result).toBe(2);
    expect(updateRan).toBe(true);
    expect(upsertActivitiesForMessageMock).toHaveBeenCalledTimes(2);
    expect(upsertActivitiesForMessageMock).toHaveBeenCalledWith({
      messageId: 'msg-1',
      tenantId: 't-1',
      userId: 'u-1',
      direction: 'inbound',
    });
    expect(upsertActivitiesForMessageMock).toHaveBeenCalledWith({
      messageId: 'msg-2',
      tenantId: 't-1',
      userId: 'u-1',
      direction: 'outbound',
    });
  });

  it('returns 0 when no participant rows match the email', async () => {
    dbSelectMock
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([{ email: 'nobody@example.com' }]) }) }),
      })
      .mockReturnValueOnce({
        from: () => ({ innerJoin: () => ({ where: () => Promise.resolve([]) }) }),
      });

    const result = await backfillContactMessages('t-1', 'c-1', 'u-1');
    expect(result).toBe(0);
    expect(upsertActivitiesForMessageMock).not.toHaveBeenCalled();
  });
});
