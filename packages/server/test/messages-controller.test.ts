import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const {
  queueAddMock,
  getChannelByIdMock,
  dbInsertMock,
  dbSelectMock,
  dbUpdateMock,
} = vi.hoisted(() => ({
  queueAddMock: vi.fn(async () => ({ id: 'job-1' })),
  getChannelByIdMock: vi.fn(),
  dbInsertMock: vi.fn(),
  dbSelectMock: vi.fn(),
  dbUpdateMock: vi.fn(),
}));

let getSyncQueueMock: () => any = () => ({ add: queueAddMock });

vi.mock('../src/config/queue', () => ({
  getSyncQueue: () => getSyncQueueMock(),
  SyncJobName: {
    CalendarFullSync: 'calendar-full-sync',
    CalendarIncrementalSync: 'calendar-incremental-sync',
    GmailFullSync: 'gmail-full-sync',
    GmailIncrementalSync: 'gmail-incremental-sync',
    GmailSend: 'gmail-send',
  },
}));

vi.mock('../src/apps/crm/services/channel.service', () => ({
  getChannelById: getChannelByIdMock,
}));

vi.mock('../src/config/database', () => ({
  db: {
    insert: () => dbInsertMock(),
    select: () => dbSelectMock(),
    update: () => dbUpdateMock(),
  },
}));

import {
  sendMessage,
  retryMessage,
  getMessage,
} from '../src/apps/crm/controllers/messages.controller';

function mockRes() {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => {
  queueAddMock.mockClear();
  getChannelByIdMock.mockReset();
  dbInsertMock.mockReset();
  dbSelectMock.mockReset();
  dbUpdateMock.mockReset();
  getSyncQueueMock = () => ({ add: queueAddMock });
});

describe('messages.controller: sendMessage', () => {
  it('returns 400 when channelId is missing', async () => {
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { to: ['a@x.com'], subject: 'Hi', body: 'body' },
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await sendMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when no recipient is given', async () => {
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { channelId: 'ch-1', subject: 'Hi', body: 'body' },
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await sendMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when channel is not visible to the user', async () => {
    getChannelByIdMock.mockResolvedValue(null);
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { channelId: 'ch-missing', to: ['a@x.com'], subject: 'Hi', body: 'b' },
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await sendMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it('returns 403 when channel exists but caller is not the owner', async () => {
    getChannelByIdMock.mockResolvedValue({
      id: 'ch-1',
      accountId: 'a-1',
      ownerUserId: 'someone-else',
      visibility: 'shared-with-tenant',
      handle: 'me@x.com',
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { channelId: 'ch-1', to: ['a@x.com'], subject: 'Hi', body: 'b' },
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await sendMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 503 when queue is unavailable', async () => {
    getChannelByIdMock.mockResolvedValue({
      id: 'ch-1',
      accountId: 'a-1',
      ownerUserId: 'u-1',
      visibility: 'private',
      handle: 'me@x.com',
    });
    getSyncQueueMock = () => null;
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: { channelId: 'ch-1', to: ['a@x.com'], subject: 'Hi', body: 'b' },
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await sendMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('inserts thread + message + participants and enqueues a gmail-send job', async () => {
    getChannelByIdMock.mockResolvedValue({
      id: 'ch-1',
      accountId: 'a-1',
      ownerUserId: 'u-1',
      visibility: 'private',
      handle: 'me@x.com',
    });

    let insertedMessage: any = null;
    let insertedParticipants: any = null;
    let insertCallNumber = 0;
    dbInsertMock.mockImplementation(() => ({
      values: (rowOrRows: any) => {
        insertCallNumber++;
        if (insertCallNumber === 1) {
          // First call: thread
          return { returning: () => Promise.resolve([{ id: 'thr-1' }]) };
        }
        if (insertCallNumber === 2) {
          // Second call: message
          insertedMessage = rowOrRows;
          return { returning: () => Promise.resolve([{ id: 'msg-1' }]) };
        }
        // Third call: participants (no .returning chain)
        insertedParticipants = rowOrRows;
        return Promise.resolve();
      },
    }));

    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: {
        channelId: 'ch-1',
        to: ['Alice <alice@example.com>'],
        cc: ['bob@example.com'],
        subject: 'Hello',
        body: 'Hi Alice',
      },
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await sendMessage(req, res);

    expect(insertedMessage).toMatchObject({
      channelId: 'ch-1',
      tenantId: 't-1',
      direction: 'outbound',
      status: 'pending',
      subject: 'Hello',
      bodyText: 'Hi Alice',
    });
    // gmailMessageId must be non-null (placeholder), schema is NOT NULL
    expect(typeof insertedMessage.gmailMessageId).toBe('string');
    expect(insertedMessage.gmailMessageId.length).toBeGreaterThan(0);

    expect(Array.isArray(insertedParticipants)).toBe(true);
    expect(insertedParticipants).toHaveLength(3); // from + to + cc

    const fromRow = insertedParticipants.find((r: any) => r.role === 'from');
    const toRow = insertedParticipants.find((r: any) => r.role === 'to');
    const ccRow = insertedParticipants.find((r: any) => r.role === 'cc');
    expect(fromRow).toMatchObject({ handle: 'me@x.com' });
    expect(toRow).toMatchObject({ handle: 'alice@example.com', displayName: 'Alice' });
    expect(ccRow).toMatchObject({ handle: 'bob@example.com' });

    expect(queueAddMock).toHaveBeenCalledWith('gmail-send', { messageId: 'msg-1' });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { messageId: 'msg-1', status: 'pending' },
    });
  });

  it('skips malformed recipients (no `@`, multi-`@`)', async () => {
    getChannelByIdMock.mockResolvedValue({
      id: 'ch-1', accountId: 'a-1', ownerUserId: 'u-1', visibility: 'private', handle: 'me@x.com',
    });
    let insertedParticipants: any = null;
    let n = 0;
    dbInsertMock.mockImplementation(() => ({
      values: (rowOrRows: any) => {
        n++;
        if (n === 1) return { returning: () => Promise.resolve([{ id: 'thr-1' }]) };
        if (n === 2) return { returning: () => Promise.resolve([{ id: 'msg-1' }]) };
        insertedParticipants = rowOrRows;
        return Promise.resolve();
      },
    }));

    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      body: {
        channelId: 'ch-1',
        to: ['valid@x.com', 'noatsign', '<a@b@c>'],
        subject: 'Hi',
        body: 'b',
      },
      params: {},
    } as unknown as Request;
    const res = mockRes();
    await sendMessage(req, res);

    // Should have: 1 from + 1 valid to recipient = 2 rows
    expect(insertedParticipants).toHaveLength(2);
    const handles = insertedParticipants.map((r: any) => r.handle);
    expect(handles).toContain('me@x.com');
    expect(handles).toContain('valid@x.com');
    expect(handles).not.toContain('noatsign');
    expect(handles.some((h: string) => h.includes('a@b'))).toBe(false);
  });
});

describe('messages.controller: retryMessage', () => {
  it('returns 404 when the message does not exist or is wrong tenant', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'msg-missing' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await retryMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 400 when retrying an inbound message', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{
        id: 'msg-1',
        tenantId: 't-1',
        channelId: 'ch-1',
        direction: 'inbound',
        status: 'failed',
      }]) }) }),
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'msg-1' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await retryMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(queueAddMock).not.toHaveBeenCalled();
  });

  it('returns 400 when the message is not in failed state', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{
        id: 'msg-1',
        tenantId: 't-1',
        channelId: 'ch-1',
        direction: 'outbound',
        status: 'sent',
      }]) }) }),
    });
    getChannelByIdMock.mockResolvedValue({
      id: 'ch-1',
      accountId: 'a-1',
      ownerUserId: 'u-1',
      visibility: 'private',
      handle: 'me@x.com',
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'msg-1' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await retryMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('flips a failed message back to pending and re-enqueues', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{
        id: 'msg-1',
        tenantId: 't-1',
        channelId: 'ch-1',
        direction: 'outbound',
        status: 'failed',
      }]) }) }),
    });
    getChannelByIdMock.mockResolvedValue({
      id: 'ch-1',
      accountId: 'a-1',
      ownerUserId: 'u-1',
      visibility: 'private',
      handle: 'me@x.com',
    });
    let updated: any = null;
    dbUpdateMock.mockReturnValue({
      set: (vals: any) => { updated = vals; return { where: () => Promise.resolve() }; },
    });

    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'msg-1' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await retryMessage(req, res);

    expect(updated).toMatchObject({ status: 'pending' });
    expect(queueAddMock).toHaveBeenCalledWith('gmail-send', { messageId: 'msg-1' });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { messageId: 'msg-1', queued: true },
    });
  });
});

describe('messages.controller: getMessage', () => {
  it('returns 404 when message does not exist', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'msg-missing' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await getMessage(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns the message when visible to the user', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{
        id: 'msg-1',
        channelId: 'ch-1',
        subject: 'Hi',
        snippet: 'preview',
        bodyText: 'body',
        status: 'sent',
        threadId: 'thr-1',
        headerMessageId: '<abc@mail.com>',
        direction: 'outbound',
        sentAt: new Date('2026-04-28T10:00:00Z'),
      }]) }) }),
    });
    getChannelByIdMock.mockResolvedValue({
      id: 'ch-1',
      accountId: 'a-1',
      ownerUserId: 'u-1',
      visibility: 'private',
      handle: 'me@x.com',
    });
    const req = {
      auth: { userId: 'u-1', tenantId: 't-1' },
      params: { id: 'msg-1' },
      body: {},
    } as unknown as Request;
    const res = mockRes();
    await getMessage(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 'msg-1', status: 'sent' }),
      }),
    );
  });
});
