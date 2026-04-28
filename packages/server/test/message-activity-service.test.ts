import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbSelectMock = vi.fn();
const dbInsertMock = vi.fn();
const dbDeleteMock = vi.fn();

vi.mock('../src/config/database', () => ({
  db: {
    select: () => dbSelectMock(),
    insert: () => dbInsertMock(),
    delete: () => dbDeleteMock(),
  },
}));

import { upsertActivitiesForMessage } from '../src/apps/crm/services/message-activity.service';

describe('upsertActivitiesForMessage', () => {
  beforeEach(() => {
    dbSelectMock.mockReset();
    dbInsertMock.mockReset();
    dbDeleteMock.mockReset();
    dbDeleteMock.mockReturnValue({ where: () => Promise.resolve() });
  });

  it('inserts no activities when message has no resolved contacts', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve([]) }),
    });

    await upsertActivitiesForMessage({
      messageId: 'msg-1',
      tenantId: 't-1',
      userId: 'u-1',
      direction: 'inbound',
    });

    expect(dbInsertMock).not.toHaveBeenCalled();
  });

  it('inserts one activity per linked contact (and its company + open deals)', async () => {
    dbSelectMock
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ personId: 'contact-1' }]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ id: 'contact-1', companyId: 'company-1' }]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ id: 'deal-1' }, { id: 'deal-2' }]) }) });

    let captured: any[] = [];
    dbInsertMock.mockReturnValue({
      values: (rows: any) => { captured = rows; return Promise.resolve(); },
    });

    await upsertActivitiesForMessage({
      messageId: 'msg-1',
      tenantId: 't-1',
      userId: 'u-1',
      direction: 'inbound',
    });

    expect(captured).toHaveLength(4);
    expect(captured.every((r) => r.tenantId === 't-1')).toBe(true);
    expect(captured.every((r) => r.userId === 'u-1')).toBe(true);
    expect(captured.every((r) => r.messageId === 'msg-1')).toBe(true);
    expect(captured.every((r) => r.type === 'email-received')).toBe(true);
    expect(captured.every((r) => r.externalProvider === 'gmail')).toBe(true);

    const contactRow = captured.find((r) => r.contactId === 'contact-1' && !r.dealId && !r.companyId);
    const companyRow = captured.find((r) => r.companyId === 'company-1' && !r.contactId && !r.dealId);
    const deal1Row = captured.find((r) => r.dealId === 'deal-1');
    const deal2Row = captured.find((r) => r.dealId === 'deal-2');
    expect(contactRow).toBeDefined();
    expect(companyRow).toBeDefined();
    expect(deal1Row).toBeDefined();
    expect(deal2Row).toBeDefined();
  });

  it('uses email-sent type for outbound messages', async () => {
    dbSelectMock
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ personId: 'contact-1' }]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ id: 'contact-1', companyId: null }]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) });

    let captured: any[] = [];
    dbInsertMock.mockReturnValue({
      values: (rows: any) => { captured = rows; return Promise.resolve(); },
    });

    await upsertActivitiesForMessage({
      messageId: 'msg-1',
      tenantId: 't-1',
      userId: 'u-1',
      direction: 'outbound',
    });

    expect(captured).toHaveLength(1);
    expect(captured[0].type).toBe('email-sent');
  });

  it('skips company activity when contact has no companyId', async () => {
    dbSelectMock
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ personId: 'contact-1' }]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ id: 'contact-1', companyId: null }]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) });

    let captured: any[] = [];
    dbInsertMock.mockReturnValue({
      values: (rows: any) => { captured = rows; return Promise.resolve(); },
    });

    await upsertActivitiesForMessage({
      messageId: 'msg-1',
      tenantId: 't-1',
      userId: 'u-1',
      direction: 'inbound',
    });

    expect(captured).toHaveLength(1);
    expect(captured[0].contactId).toBe('contact-1');
    expect(captured[0].companyId).toBeUndefined();
  });

  it('deletes existing activities for the message before inserting (idempotency)', async () => {
    let deleteCalled = false;
    let insertCalled = false;
    let order: string[] = [];

    dbSelectMock
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ personId: 'contact-1' }]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([{ id: 'contact-1', companyId: null }]) }) })
      .mockReturnValueOnce({ from: () => ({ where: () => Promise.resolve([]) }) });

    dbDeleteMock.mockReturnValue({
      where: () => {
        deleteCalled = true;
        order.push('delete');
        return Promise.resolve();
      },
    });
    dbInsertMock.mockReturnValue({
      values: () => {
        insertCalled = true;
        order.push('insert');
        return Promise.resolve();
      },
    });

    await upsertActivitiesForMessage({
      messageId: 'msg-1',
      tenantId: 't-1',
      userId: 'u-1',
      direction: 'inbound',
    });

    expect(deleteCalled).toBe(true);
    expect(insertCalled).toBe(true);
    expect(order).toEqual(['delete', 'insert']);
  });
});
