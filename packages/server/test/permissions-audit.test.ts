import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Unit tests for the permission audit log.
 *
 * The service uses drizzle-orm builders against `db`. We replace
 * `db.select / db.insert / db.update / db.delete` with per-test stubs
 * that capture payloads and return fixtures. This keeps the tests
 * DB-free while exercising the real service logic.
 */

// ─── Mocks ──────────────────────────────────────────────────────────

vi.mock('../src/config/database', () => {
  const db: any = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return { db };
});

import { db as _db } from '../src/config/database';
const dbMock = _db as any;

import {
  setAppPermission,
  deleteAppPermission,
  listPermissionAudit,
} from '../src/services/app-permissions.service';
import { appPermissions, appPermissionAudit, accounts } from '../src/db/schema';

// ─── Helpers ────────────────────────────────────────────────────────

function selectReturning(rows: any[]) {
  const chain: any = {};
  const methods = ['from', 'where', 'orderBy', 'limit', 'offset'];
  for (const m of methods) chain[m] = vi.fn(() => chain);
  chain.then = (resolve: any) => resolve(rows);
  return chain;
}

function insertCapture(capture: { table?: any; payload?: any }) {
  const chain: any = {};
  chain.values = vi.fn((payload: any) => {
    capture.payload = payload;
    return chain;
  });
  chain.returning = vi.fn(() => Promise.resolve([{ id: 'new-id', ...capture.payload }]));
  chain.then = (resolve: any) => resolve(undefined);
  return chain;
}

function updateCapture() {
  const chain: any = {};
  chain.set = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.returning = vi.fn(() => Promise.resolve([{ id: 'updated-id' }]));
  return chain;
}

function deleteCapture() {
  const chain: any = {};
  chain.where = vi.fn(() => Promise.resolve(undefined));
  return chain;
}

// ─── setAppPermission ─────────────────────────────────────────────

describe('setAppPermission — audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.select.mockReset();
    dbMock.insert.mockReset();
    dbMock.update.mockReset();
    dbMock.delete.mockReset();
  });

  it('writes a grant audit row when no prior permission exists', async () => {
    // First select: existing lookup → empty
    dbMock.select.mockReturnValueOnce(selectReturning([]));

    const insertCaptures: any[] = [];
    dbMock.insert.mockImplementation((table: any) => {
      const cap: any = { table };
      const chain = insertCapture(cap);
      insertCaptures.push(cap);
      return chain;
    });

    await setAppPermission('t-1', 'u-target', 'tasks', 'editor', 'all', 'u-actor');

    // Two inserts: one into appPermissions, one into audit.
    expect(insertCaptures.length).toBe(2);
    const permInsert = insertCaptures.find((c) => c.table === appPermissions);
    const auditInsert = insertCaptures.find((c) => c.table === appPermissionAudit);
    expect(permInsert).toBeTruthy();
    expect(auditInsert).toBeTruthy();

    expect(auditInsert!.payload).toMatchObject({
      tenantId: 't-1',
      targetUserId: 'u-target',
      actorUserId: 'u-actor',
      actorType: 'user',
      appId: 'tasks',
      action: 'grant',
      beforeRole: null,
      beforeRecordAccess: null,
      afterRole: 'editor',
      afterRecordAccess: 'all',
    });
  });

  it('writes an update audit row when permission already exists', async () => {
    // First select: existing lookup returns a prior row.
    dbMock.select.mockReturnValueOnce(
      selectReturning([
        { id: 'p-1', tenantId: 't-1', userId: 'u-target', appId: 'tasks', role: 'viewer', recordAccess: 'own' },
      ]),
    );

    dbMock.update.mockReturnValue(updateCapture());

    const insertCaptures: any[] = [];
    dbMock.insert.mockImplementation((table: any) => {
      const cap: any = { table };
      const chain = insertCapture(cap);
      insertCaptures.push(cap);
      return chain;
    });

    await setAppPermission('t-1', 'u-target', 'tasks', 'editor', 'all', 'u-actor');

    // Only the audit insert should run (perm path went through update).
    expect(insertCaptures.length).toBe(1);
    expect(insertCaptures[0].table).toBe(appPermissionAudit);
    expect(insertCaptures[0].payload).toMatchObject({
      action: 'update',
      beforeRole: 'viewer',
      beforeRecordAccess: 'own',
      afterRole: 'editor',
      afterRecordAccess: 'all',
      actorUserId: 'u-actor',
      actorType: 'user',
    });
  });

  it('accepts a null actor and records actorType=system', async () => {
    dbMock.select.mockReturnValueOnce(selectReturning([]));
    const captures: any[] = [];
    dbMock.insert.mockImplementation((table: any) => {
      const cap: any = { table };
      captures.push(cap);
      return insertCapture(cap);
    });

    await setAppPermission('t-1', 'u-target', 'tasks', 'editor', 'all', null);

    const audit = captures.find((c) => c.table === appPermissionAudit)!;
    expect(audit.payload.actorUserId).toBeNull();
    expect(audit.payload.actorType).toBe('system');
  });
});

// ─── deleteAppPermission ──────────────────────────────────────────

describe('deleteAppPermission — audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.select.mockReset();
    dbMock.insert.mockReset();
    dbMock.update.mockReset();
    dbMock.delete.mockReset();
  });

  it('writes a revoke audit row with null after fields', async () => {
    dbMock.select.mockReturnValueOnce(
      selectReturning([
        { id: 'p-1', role: 'editor', recordAccess: 'all' },
      ]),
    );
    dbMock.delete.mockReturnValue(deleteCapture());

    const captures: any[] = [];
    dbMock.insert.mockImplementation((table: any) => {
      const cap: any = { table };
      captures.push(cap);
      return insertCapture(cap);
    });

    await deleteAppPermission('t-1', 'u-target', 'tasks', 'u-actor');

    expect(captures.length).toBe(1);
    expect(captures[0].table).toBe(appPermissionAudit);
    expect(captures[0].payload).toMatchObject({
      action: 'revoke',
      beforeRole: 'editor',
      beforeRecordAccess: 'all',
      afterRole: null,
      afterRecordAccess: null,
      actorUserId: 'u-actor',
      actorType: 'user',
    });
  });
});

// ─── listPermissionAudit ──────────────────────────────────────────

describe('listPermissionAudit — filters + pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMock.select.mockReset();
    dbMock.insert.mockReset();
    dbMock.update.mockReset();
    dbMock.delete.mockReset();
  });

  function wireSelect(rows: any[]) {
    // listPermissionAudit calls db.select() twice:
    //   1. audit rows
    //   2. accounts for joining display names
    const auditChain = selectReturning(rows);
    const accountsChain = selectReturning([]);
    dbMock.select
      .mockReturnValueOnce(auditChain)
      .mockReturnValueOnce(accountsChain);
    return { auditChain, accountsChain };
  }

  it('respects targetUserId filter and returns normalized rows', async () => {
    const fakeRow = {
      id: 'a-1',
      tenantId: 't-1',
      targetUserId: 'u-target',
      actorUserId: 'u-actor',
      actorType: 'user',
      appId: 'tasks',
      action: 'grant',
      beforeRole: null,
      beforeRecordAccess: null,
      afterRole: 'editor',
      afterRecordAccess: 'all',
      createdAt: new Date('2024-01-01T00:00:00Z'),
    };

    const { auditChain } = wireSelect([fakeRow]);

    const rows = await listPermissionAudit('t-1', { targetUserId: 'u-target' });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'a-1',
      targetUserId: 'u-target',
      actorUserId: 'u-actor',
      appId: 'tasks',
      action: 'grant',
      afterRole: 'editor',
    });
    // where() was called with the composed filter.
    expect(auditChain.where).toHaveBeenCalled();
  });

  it('passes limit + offset through to the query builder', async () => {
    const { auditChain } = wireSelect([]);

    await listPermissionAudit('t-1', { limit: 25, offset: 50 });

    expect(auditChain.limit).toHaveBeenCalledWith(25);
    expect(auditChain.offset).toHaveBeenCalledWith(50);
  });

  it('defaults to limit 100 when not provided', async () => {
    const { auditChain } = wireSelect([]);

    await listPermissionAudit('t-1');

    expect(auditChain.limit).toHaveBeenCalledWith(100);
    expect(auditChain.offset).toHaveBeenCalledWith(0);
  });
});
