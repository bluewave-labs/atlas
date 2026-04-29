import { describe, it, expect, vi, beforeEach } from 'vitest';

const { dbSelectMock, dbUpdateMock, dbDeleteMock } = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  dbUpdateMock: vi.fn(),
  dbDeleteMock: vi.fn(),
}));

vi.mock('../src/config/database', () => ({
  db: {
    select: () => dbSelectMock(),
    update: () => dbUpdateMock(),
    delete: () => dbDeleteMock(),
  },
}));

import {
  performGmailMessageCleaner,
  HARD_DELETE_GRACE_DAYS,
} from '../src/apps/crm/services/gmail-message-cleaner.service';

beforeEach(() => {
  dbSelectMock.mockReset();
  dbUpdateMock.mockReset();
  dbDeleteMock.mockReset();
  dbUpdateMock.mockReturnValue({
    set: () => ({ where: () => Promise.resolve({ rowCount: 0 }) }),
  });
  dbDeleteMock.mockReturnValue({
    where: () => Promise.resolve({ rowCount: 0 }),
  });
});

describe('performGmailMessageCleaner', () => {
  it('exports a 30-day hard-delete grace window', () => {
    expect(HARD_DELETE_GRACE_DAYS).toBe(30);
  });

  it('skips soft-delete for tenants with null gmailRetentionDays', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => Promise.resolve([
        { id: 't-1', gmailRetentionDays: null },
        { id: 't-2', gmailRetentionDays: null },
      ]),
    });

    await performGmailMessageCleaner();

    // No tenant has retention set — no UPDATE for soft-delete should run.
    expect(dbUpdateMock).not.toHaveBeenCalled();
    // Hard-delete pass still runs (even when no retention is configured,
    // any pre-existing soft-deleted rows past the grace window get cleaned).
    expect(dbDeleteMock).toHaveBeenCalled();
  });

  it('soft-deletes per tenant with retention set', async () => {
    let updateSetVals: any = null;
    dbSelectMock.mockReturnValueOnce({
      from: () => Promise.resolve([{ id: 't-1', gmailRetentionDays: 7 }]),
    });
    dbUpdateMock.mockReturnValue({
      set: (vals: any) => {
        updateSetVals = vals;
        return { where: () => Promise.resolve({ rowCount: 3 }) };
      },
    });

    await performGmailMessageCleaner();

    expect(dbUpdateMock).toHaveBeenCalled();
    expect(updateSetVals).toMatchObject({ deletedAt: expect.any(Date) });
  });

  it('hard-deletes regardless of retention setting', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => Promise.resolve([{ id: 't-1', gmailRetentionDays: null }]),
    });

    await performGmailMessageCleaner();

    expect(dbDeleteMock).toHaveBeenCalled();
  });
});
