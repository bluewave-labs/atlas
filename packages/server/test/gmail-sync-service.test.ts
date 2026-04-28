import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  dbSelectMock,
  dbInsertMock,
  dbUpdateMock,
  dbTransactionMock,
  callGoogleApiMock,
  matchHandleToContactMock,
  isHandleBlockedMock,
  insertParticipantsMock,
  loadBlocklistMock,
  matchHandlesToContactsMock,
  upsertActivitiesForMessageMock,
} = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  dbInsertMock: vi.fn(),
  dbUpdateMock: vi.fn(),
  dbTransactionMock: vi.fn(),
  callGoogleApiMock: vi.fn(),
  matchHandleToContactMock: vi.fn(),
  isHandleBlockedMock: vi.fn(),
  insertParticipantsMock: vi.fn(),
  loadBlocklistMock: vi.fn(),
  matchHandlesToContactsMock: vi.fn(),
  upsertActivitiesForMessageMock: vi.fn(),
}));

vi.mock('../src/config/database', () => ({
  db: {
    select: () => dbSelectMock(),
    insert: () => dbInsertMock(),
    update: () => dbUpdateMock(),
    transaction: (fn: any) => dbTransactionMock(fn),
  },
}));

vi.mock('../src/services/google-api-call', () => ({
  callGoogleApi: callGoogleApiMock,
}));

vi.mock('../src/apps/crm/services/participant-match.service', () => ({
  matchHandleToContact: matchHandleToContactMock,
  isHandleBlocked: isHandleBlockedMock,
  insertParticipants: insertParticipantsMock,
  loadBlocklist: loadBlocklistMock,
  matchHandlesToContacts: matchHandlesToContactsMock,
  shouldAutoCreate: () => false,
}));

vi.mock('../src/apps/crm/services/message-activity.service', () => ({
  upsertActivitiesForMessage: upsertActivitiesForMessageMock,
}));

import {
  performGmailFullSync,
  performGmailIncrementalSync,
} from '../src/apps/crm/services/gmail-sync.service';

beforeEach(() => {
  dbSelectMock.mockReset();
  dbInsertMock.mockReset();
  dbUpdateMock.mockReset();
  dbTransactionMock.mockReset();
  callGoogleApiMock.mockReset();
  matchHandleToContactMock.mockReset();
  isHandleBlockedMock.mockReset();
  insertParticipantsMock.mockReset();
  loadBlocklistMock.mockReset();
  matchHandlesToContactsMock.mockReset();
  upsertActivitiesForMessageMock.mockReset();
  // Provide a default update mock that won't crash when callers .set().where() chain
  dbUpdateMock.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) });
});

describe('performGmailFullSync', () => {
  it('throws "channel not found" when the channel does not exist', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    await expect(performGmailFullSync('c-missing')).rejects.toThrow(/channel not found/i);
  });

  it('returns early when the channel is throttled', async () => {
    const future = new Date(Date.now() + 60_000);
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'c1', accountId: 'a1', tenantId: 't1', ownerUserId: 'u1', isSyncEnabled: true, throttleRetryAfter: future }]) }) }),
    });
    await performGmailFullSync('c1');
    expect(callGoogleApiMock).not.toHaveBeenCalled();
  });

  it('returns early when the channel sync is disabled', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'c1', accountId: 'a1', tenantId: 't1', ownerUserId: 'u1', isSyncEnabled: false, throttleRetryAfter: null }]) }) }),
    });
    await performGmailFullSync('c1');
    expect(callGoogleApiMock).not.toHaveBeenCalled();
  });
});

describe('performGmailIncrementalSync', () => {
  it('throws "channel not found" when the channel does not exist', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    await expect(performGmailIncrementalSync('c-missing')).rejects.toThrow(/channel not found/i);
  });

  it('returns early when channel is throttled', async () => {
    const future = new Date(Date.now() + 60_000);
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'c1', accountId: 'a1', tenantId: 't1', ownerUserId: 'u1', isSyncEnabled: true, syncCursor: 'cursor-123', throttleRetryAfter: future }]) }) }),
    });
    await performGmailIncrementalSync('c1');
    expect(callGoogleApiMock).not.toHaveBeenCalled();
  });

  it('returns early when channel has no syncCursor (full sync needed)', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'c1', accountId: 'a1', tenantId: 't1', ownerUserId: 'u1', isSyncEnabled: true, syncCursor: null, throttleRetryAfter: null }]) }) }),
    });
    await performGmailIncrementalSync('c1');
    expect(callGoogleApiMock).not.toHaveBeenCalled();
  });
});
