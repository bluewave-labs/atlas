import { describe, it, expect, vi, beforeEach } from 'vitest';

const { dbInsertMock } = vi.hoisted(() => ({
  dbInsertMock: vi.fn(),
}));

vi.mock('../src/config/database', () => ({
  db: {
    insert: () => dbInsertMock(),
  },
}));

import {
  seedBlocklistForTenant,
  DEFAULT_BLOCKLIST_PATTERNS,
} from '../src/apps/crm/services/blocklist-seed.service';

beforeEach(() => {
  dbInsertMock.mockReset();
});

describe('seedBlocklistForTenant', () => {
  it('exports the four default patterns from the spec', () => {
    expect(DEFAULT_BLOCKLIST_PATTERNS).toEqual([
      '*@noreply.*',
      '*@mailer-daemon.*',
      '*@no-reply.*',
      'notifications@github.com',
    ]);
  });

  it('inserts one row per default pattern with onConflictDoNothing', async () => {
    let inserted: any = null;
    let onConflictCalled = false;
    dbInsertMock.mockReturnValue({
      values: (rows: any) => {
        inserted = rows;
        return {
          onConflictDoNothing: () => {
            onConflictCalled = true;
            return Promise.resolve();
          },
        };
      },
    });

    await seedBlocklistForTenant('t-1');

    expect(Array.isArray(inserted)).toBe(true);
    expect(inserted).toHaveLength(4);
    expect(onConflictCalled).toBe(true);
    const patterns = inserted.map((r: any) => r.pattern);
    expect(patterns).toEqual([
      '*@noreply.*',
      '*@mailer-daemon.*',
      '*@no-reply.*',
      'notifications@github.com',
    ]);
    for (const row of inserted) {
      expect(row.tenantId).toBe('t-1');
      expect(row.createdByUserId).toBeNull();
    }
  });
});
