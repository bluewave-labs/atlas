import { describe, it, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const queryMock = vi.fn(async () => ({ rows: [] }));
  const releaseMock = vi.fn();
  const connectMock = vi.fn(async () => ({ query: queryMock, release: releaseMock }));
  return { queryMock, releaseMock, connectMock };
});

vi.mock('../src/config/database', () => ({
  pool: { connect: mocks.connectMock },
  db: {},
}));

import { migrateGmailMessagePartialIndex } from '../src/db/migrations/2026-04-29-gmail-message-partial-index';

describe('migrateGmailMessagePartialIndex', () => {
  it('creates a partial index for inbound non-deleted messages', async () => {
    mocks.queryMock.mockClear();
    await migrateGmailMessagePartialIndex();
    const sql = mocks.queryMock.mock.calls.map((c) => c[0] as string).join('\n');
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_messages_tenant_inbound_active/i);
    expect(sql).toMatch(/ON messages \(tenant_id, sent_at DESC\)/i);
    expect(sql).toMatch(/WHERE direction = 'inbound' AND deleted_at IS NULL/i);
  });
});
