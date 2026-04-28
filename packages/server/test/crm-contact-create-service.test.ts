import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbInsertMock = vi.fn();

vi.mock('../src/config/database', () => ({
  db: {
    insert: () => dbInsertMock(),
  },
}));

import { autoCreateContactIfNeeded } from '../src/apps/crm/services/crm-contact-create.service';

beforeEach(() => {
  dbInsertMock.mockReset();
});

describe('autoCreateContactIfNeeded', () => {
  it('returns null and inserts nothing when policy is none', async () => {
    const result = await autoCreateContactIfNeeded({
      handle: 'alice@example.com',
      displayName: 'Alice',
      role: 'to',
      direction: 'outbound',
      policy: 'none',
      tenantId: 't-1',
      userId: 'u-1',
      isBlocked: false,
    });
    expect(result).toBeNull();
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('returns null and inserts nothing when handle is blocked', async () => {
    const result = await autoCreateContactIfNeeded({
      handle: 'spam@x.com',
      displayName: null,
      role: 'from',
      direction: 'inbound',
      policy: 'send-and-receive',
      tenantId: 't-1',
      userId: 'u-1',
      isBlocked: true,
    });
    expect(result).toBeNull();
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('returns null when shouldAutoCreate decides no (e.g. send-only + inbound)', async () => {
    const result = await autoCreateContactIfNeeded({
      handle: 'someone@x.com',
      displayName: null,
      role: 'from',
      direction: 'inbound',
      policy: 'send-only',
      tenantId: 't-1',
      userId: 'u-1',
      isBlocked: false,
    });
    expect(result).toBeNull();
    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('creates a contact with name from displayName when policy permits (send-only + outbound + recipient)', async () => {
    let captured: any = null;
    dbInsertMock.mockReturnValue({
      values: (row: any) => ({
        returning: () => {
          captured = row;
          return Promise.resolve([{ id: 'new-contact-1' }]);
        },
      }),
    });

    const result = await autoCreateContactIfNeeded({
      handle: 'jane@example.com',
      displayName: 'Jane Doe',
      role: 'to',
      direction: 'outbound',
      policy: 'send-only',
      tenantId: 't-1',
      userId: 'u-1',
      isBlocked: false,
    });

    expect(result).toBe('new-contact-1');
    expect(captured).toMatchObject({
      tenantId: 't-1',
      userId: 'u-1',
      email: 'jane@example.com',
      name: 'Jane Doe',
    });
  });

  it('uses email local-part as name when displayName is null', async () => {
    let captured: any = null;
    dbInsertMock.mockReturnValue({
      values: (row: any) => ({
        returning: () => {
          captured = row;
          return Promise.resolve([{ id: 'new-contact-2' }]);
        },
      }),
    });

    await autoCreateContactIfNeeded({
      handle: 'jane.smith@example.com',
      displayName: null,
      role: 'to',
      direction: 'outbound',
      policy: 'send-and-receive',
      tenantId: 't-1',
      userId: 'u-1',
      isBlocked: false,
    });

    expect(captured.name).toBe('jane.smith');
  });

  it('uses email local-part as name when displayName is empty/whitespace', async () => {
    let captured: any = null;
    dbInsertMock.mockReturnValue({
      values: (row: any) => ({
        returning: () => {
          captured = row;
          return Promise.resolve([{ id: 'new-contact-3' }]);
        },
      }),
    });

    await autoCreateContactIfNeeded({
      handle: 'cher@example.com',
      displayName: '   ',
      role: 'to',
      direction: 'outbound',
      policy: 'send-and-receive',
      tenantId: 't-1',
      userId: 'u-1',
      isBlocked: false,
    });

    expect(captured.name).toBe('cher');
  });

  it('lowercases the email handle', async () => {
    let captured: any = null;
    dbInsertMock.mockReturnValue({
      values: (row: any) => ({
        returning: () => {
          captured = row;
          return Promise.resolve([{ id: 'new-contact-4' }]);
        },
      }),
    });

    await autoCreateContactIfNeeded({
      handle: 'JANE@Example.COM',
      displayName: 'Jane',
      role: 'to',
      direction: 'outbound',
      policy: 'send-and-receive',
      tenantId: 't-1',
      userId: 'u-1',
      isBlocked: false,
    });

    expect(captured.email).toBe('jane@example.com');
  });
});
