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

import { migrateMessageChannels } from '../src/db/migrations/2026-04-28-message-channels';

describe('migrateMessageChannels', () => {
  it('creates the message_channels table', async () => {
    mocks.queryMock.mockClear();
    await migrateMessageChannels();
    const calls = mocks.queryMock.mock.calls.map((c) => c[0] as string);
    expect(calls.some((sql) => /CREATE TABLE IF NOT EXISTS message_channels/i.test(sql))).toBe(true);
  });

  it('creates all five email tables', async () => {
    mocks.queryMock.mockClear();
    await migrateMessageChannels();
    const sql = mocks.queryMock.mock.calls.map((c) => c[0] as string).join('\n');
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS message_channels/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS message_threads/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS messages/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS message_participants/i);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS message_blocklist/i);
  });

  it('adds the three new crm_activities columns', async () => {
    mocks.queryMock.mockClear();
    await migrateMessageChannels();
    const sql = mocks.queryMock.mock.calls.map((c) => c[0] as string).join('\n');
    expect(sql).toMatch(/crm_activities.*ADD COLUMN IF NOT EXISTS message_id/is);
    expect(sql).toMatch(/crm_activities.*ADD COLUMN IF NOT EXISTS external_provider/is);
    expect(sql).toMatch(/crm_activities.*ADD COLUMN IF NOT EXISTS external_id/is);
  });

  it('backfills one message_channels row per Google account that has none', async () => {
    mocks.queryMock.mockClear();
    await migrateMessageChannels();
    const sql = mocks.queryMock.mock.calls.map((c) => c[0] as string).join('\n');
    expect(sql).toMatch(/INSERT INTO message_channels/i);
    expect(sql).toMatch(/SELECT.+FROM accounts/is);
    expect(sql).toMatch(/LEFT JOIN message_channels/i);
    expect(sql).toMatch(/WHERE accounts\.provider = 'google'/i);
  });

  it('creates a UNIQUE index on message_channels.account_id', async () => {
    mocks.queryMock.mockClear();
    await migrateMessageChannels();
    const sql = mocks.queryMock.mock.calls.map((c) => c[0] as string).join('\n');
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS uniq_message_channels_account ON message_channels \(account_id\)/i);
  });
});
