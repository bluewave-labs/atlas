import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbSelectMock = vi.fn();
const dbInsertMock = vi.fn();
const dbUpdateMock = vi.fn();

vi.mock('../src/config/database', () => ({
  db: {
    select: () => dbSelectMock(),
    insert: () => dbInsertMock(),
    update: () => dbUpdateMock(),
  },
}));

import {
  insertParticipants,
  matchHandleToContact,
  matchHandlesToContacts,
  isHandleBlocked,
  shouldAutoCreate,
  loadBlocklist,
} from '../src/apps/crm/services/participant-match.service';

describe('shouldAutoCreate', () => {
  it('returns false when policy is none', () => {
    expect(shouldAutoCreate('none', 'from', 'inbound')).toBe(false);
    expect(shouldAutoCreate('none', 'to', 'outbound')).toBe(false);
  });

  it('send-only allows auto-create only for outbound recipients', () => {
    expect(shouldAutoCreate('send-only', 'from', 'inbound')).toBe(false);
    expect(shouldAutoCreate('send-only', 'to', 'inbound')).toBe(false);
    expect(shouldAutoCreate('send-only', 'to', 'outbound')).toBe(true);
    expect(shouldAutoCreate('send-only', 'from', 'outbound')).toBe(false);
  });

  it('send-and-receive allows auto-create from any participant', () => {
    expect(shouldAutoCreate('send-and-receive', 'from', 'inbound')).toBe(true);
    expect(shouldAutoCreate('send-and-receive', 'to', 'outbound')).toBe(true);
  });
});

describe('isHandleBlocked', () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
  });

  it('matches an exact pattern', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([{ pattern: 'spam@x.com' }]) }),
    });
    expect(await isHandleBlocked('spam@x.com', 't-1')).toBe(true);
  });

  it('matches a wildcard domain pattern', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([{ pattern: '*@noreply.example.com' }]) }),
    });
    expect(await isHandleBlocked('bot@noreply.example.com', 't-1')).toBe(true);
  });

  it('returns false when no patterns match', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([{ pattern: '*@noreply.example.com' }]) }),
    });
    expect(await isHandleBlocked('alice@example.com', 't-1')).toBe(false);
  });

  it('does NOT match a subdomain (wildcard is exact-domain only)', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([{ pattern: '*@example.com' }]) }),
    });
    expect(await isHandleBlocked('bot@noreply.example.com', 't-1')).toBe(false);
  });
});

describe('matchHandleToContact', () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
  });

  it('returns the contact id when a match exists', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([{ id: 'contact-1' }]) }) }),
    });
    expect(await matchHandleToContact('alice@example.com', 't-1')).toBe('contact-1');
  });

  it('returns null when no contact matches', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => ({ limit: () => Promise.resolve([]) }) }),
    });
    expect(await matchHandleToContact('alice@example.com', 't-1')).toBeNull();
  });
});

describe('insertParticipants', () => {
  beforeEach(() => {
    dbInsertMock.mockReset();
  });

  it('inserts one row per participant with personId resolved if known', async () => {
    let captured: any[] = [];
    dbInsertMock.mockReturnValue({
      values: (rows: any) => { captured = rows; return Promise.resolve(); },
    });

    await insertParticipants({
      messageId: 'msg-1',
      tenantId: 't-1',
      participants: [
        { role: 'from', handle: 'alice@x.com', displayName: 'Alice', personId: 'contact-1' },
        { role: 'to',   handle: 'me@x.com',    displayName: null,    personId: null },
      ],
    });

    expect(captured).toHaveLength(2);
    expect(captured[0]).toMatchObject({ role: 'from', handle: 'alice@x.com', personId: 'contact-1' });
    expect(captured[1]).toMatchObject({ role: 'to', handle: 'me@x.com', personId: null });
  });

  it('is a no-op when participants is empty', async () => {
    await insertParticipants({ messageId: 'msg-1', tenantId: 't-1', participants: [] });
    expect(dbInsertMock).not.toHaveBeenCalled();
  });
});

describe('loadBlocklist', () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
  });

  it('returns a closure that matches exact and wildcard patterns from one DB read', async () => {
    let selectCallCount = 0;
    dbSelectMock.mockImplementation(() => {
      selectCallCount++;
      return {
        from: () => ({
          where: () => Promise.resolve([
            { pattern: 'spam@x.com' },
            { pattern: '*@noreply.example.com' },
          ]),
        }),
      };
    });

    const matcher = await loadBlocklist('t-1');
    expect(selectCallCount).toBe(1);
    expect(matcher('spam@x.com')).toBe(true);
    expect(matcher('bot@noreply.example.com')).toBe(true);
    expect(matcher('alice@example.com')).toBe(false);
    expect(matcher('bot@sub.noreply.example.com')).toBe(false);
    expect(selectCallCount).toBe(1); // No additional DB reads
  });

  it('returns a closure that always says false when blocklist is empty', async () => {
    dbSelectMock.mockReturnValue({
      from: () => ({ where: () => Promise.resolve([]) }),
    });
    const matcher = await loadBlocklist('t-1');
    expect(matcher('alice@example.com')).toBe(false);
  });
});

describe('matchHandlesToContacts', () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
  });

  it('returns a Map of lowercased handle → contact id for all matches', async () => {
    let selectCallCount = 0;
    dbSelectMock.mockImplementation(() => {
      selectCallCount++;
      return {
        from: () => ({
          where: () => Promise.resolve([
            { id: 'contact-1', email: 'alice@example.com' },
            { id: 'contact-2', email: 'BOB@example.com' },
            { id: 'contact-3', email: 'carol@example.com' },
          ]),
        }),
      };
    });

    const result = await matchHandlesToContacts(
      ['alice@example.com', 'bob@example.com', 'unmatched@x.com'],
      't-1',
    );

    expect(selectCallCount).toBe(1);
    expect(result.get('alice@example.com')).toBe('contact-1');
    expect(result.get('bob@example.com')).toBe('contact-2');
    expect(result.has('carol@example.com')).toBe(false); // not in handles list
    expect(result.has('unmatched@x.com')).toBe(false); // no contact
  });

  it('returns empty Map for empty handle list (no DB call)', async () => {
    const result = await matchHandlesToContacts([], 't-1');
    expect(result.size).toBe(0);
    expect(dbSelectMock).not.toHaveBeenCalled();
  });
});
