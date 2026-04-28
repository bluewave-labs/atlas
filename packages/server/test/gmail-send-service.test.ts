import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  dbSelectMock,
  dbUpdateMock,
  callGoogleApiMock,
  loadBlocklistMock,
  matchHandlesToContactsMock,
  autoCreateContactIfNeededMock,
  upsertActivitiesForMessageMock,
} = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  dbUpdateMock: vi.fn(),
  callGoogleApiMock: vi.fn(),
  loadBlocklistMock: vi.fn(),
  matchHandlesToContactsMock: vi.fn(),
  autoCreateContactIfNeededMock: vi.fn(),
  upsertActivitiesForMessageMock: vi.fn(),
}));

vi.mock('../src/config/database', () => ({
  db: {
    select: () => dbSelectMock(),
    update: () => dbUpdateMock(),
  },
}));

vi.mock('../src/services/google-api-call', () => ({
  callGoogleApi: callGoogleApiMock,
}));

vi.mock('../src/apps/crm/services/participant-match.service', () => ({
  loadBlocklist: loadBlocklistMock,
  matchHandlesToContacts: matchHandlesToContactsMock,
}));

vi.mock('../src/apps/crm/services/crm-contact-create.service', () => ({
  autoCreateContactIfNeeded: autoCreateContactIfNeededMock,
}));

vi.mock('../src/apps/crm/services/message-activity.service', () => ({
  upsertActivitiesForMessage: upsertActivitiesForMessageMock,
}));

import { performGmailSend } from '../src/apps/crm/services/gmail-send.service';

beforeEach(() => {
  dbSelectMock.mockReset();
  dbUpdateMock.mockReset();
  callGoogleApiMock.mockReset();
  loadBlocklistMock.mockReset();
  matchHandlesToContactsMock.mockReset();
  autoCreateContactIfNeededMock.mockReset();
  upsertActivitiesForMessageMock.mockReset();
  dbUpdateMock.mockReturnValue({ set: () => ({ where: () => Promise.resolve() }) });
});

describe('performGmailSend', () => {
  it('throws "message not found" when the message does not exist', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    await expect(performGmailSend('msg-missing')).rejects.toThrow(/message not found/i);
  });

  it('returns early when message is not pending (idempotent on retry)', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{
        id: 'msg-1',
        channelId: 'ch-1',
        tenantId: 't-1',
        threadId: 'thr-1',
        direction: 'outbound',
        status: 'sent', // already sent
        subject: 'Hi',
        bodyText: 'body',
        inReplyTo: null,
      }]) }) }),
    });
    await performGmailSend('msg-1');
    expect(callGoogleApiMock).not.toHaveBeenCalled();
  });

  it('marks failed and rethrows on Gmail API error', async () => {
    dbSelectMock
      // First select: load message
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([{
          id: 'msg-1',
          channelId: 'ch-1',
          tenantId: 't-1',
          threadId: 'thr-1',
          direction: 'outbound',
          status: 'pending',
          subject: 'Hi',
          bodyText: 'body',
          inReplyTo: null,
        }]) }) }),
      })
      // Second select: load channel
      .mockReturnValueOnce({
        from: () => ({ where: () => ({ limit: () => Promise.resolve([{
          id: 'ch-1',
          accountId: 'a-1',
          tenantId: 't-1',
          ownerUserId: 'u-1',
          handle: 'me@example.com',
          contactAutoCreationPolicy: 'send-only',
        }]) }) }),
      })
      // Third select: load participants
      .mockReturnValueOnce({
        from: () => ({ where: () => Promise.resolve([
          { role: 'to', handle: 'alice@example.com', displayName: 'Alice' },
        ]) }),
      });

    callGoogleApiMock.mockRejectedValue(new Error('quota exceeded'));

    let updatedFields: any = null;
    dbUpdateMock.mockReturnValue({
      set: (vals: any) => { updatedFields = vals; return { where: () => Promise.resolve() }; },
    });

    await expect(performGmailSend('msg-1')).rejects.toThrow(/quota exceeded/);
    expect(updatedFields).toMatchObject({ status: 'failed' });
    // Note: no syncError column on messages — only `status: 'failed'` is asserted.
  });

  it('throws when message is not outbound', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{
        id: 'msg-1',
        channelId: 'ch-1',
        tenantId: 't-1',
        threadId: 'thr-1',
        direction: 'inbound',
        status: 'pending',
        subject: 'Hi',
        bodyText: 'body',
        inReplyTo: null,
      }]) }) }),
    });
    await expect(performGmailSend('msg-1')).rejects.toThrow(/not outbound/i);
  });
});
