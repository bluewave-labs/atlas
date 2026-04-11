import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/apps/invoices/services/invoice.service', () => ({
  listInvoices: vi.fn().mockResolvedValue([]),
  getInvoice: vi.fn().mockResolvedValue({ id: 'i1', userId: 'u-self' }),
  getNextInvoiceNumber: vi.fn().mockResolvedValue('INV-0001'),
  createInvoice: vi.fn().mockResolvedValue({ id: 'i1' }),
  updateInvoice: vi.fn().mockResolvedValue({ id: 'i1' }),
  deleteInvoice: vi.fn().mockResolvedValue(true),
  sendInvoice: vi.fn().mockResolvedValue({ id: 'i1' }),
}));

vi.mock('../src/apps/invoices/services/invoice-email.service', () => ({
  sendInvoiceEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/services/event.service', () => ({
  emitAppEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as invoiceController from '../src/apps/invoices/controllers/invoice.controller';
import * as invoiceService from '../src/apps/invoices/services/invoice.service';
import { makeReqWithPerm, makeRes, expectForbidden, expectSuccess, expectNotFound, SELF_USER_ID, OTHER_USER_ID } from './helpers/rbac-harness';

function req(role: 'admin' | 'editor' | 'viewer', recordAccess: 'all' | 'own' = 'all', extra: any = {}) {
  return makeReqWithPerm('invoices', role, recordAccess, extra);
}

describe('RBAC matrix — Invoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoiceService.getInvoice).mockResolvedValue({ id: 'i1', userId: SELF_USER_ID } as any);
  });

  it('viewer can list', async () => {
    const res = makeRes();
    await invoiceController.listInvoices(req('viewer'), res);
    expectSuccess(res);
  });

  it('viewer can get', async () => {
    const res = makeRes();
    await invoiceController.getInvoice(req('viewer', 'all', { params: { id: 'i1' } }), res);
    expectSuccess(res);
  });

  it('viewer cannot create', async () => {
    const res = makeRes();
    await invoiceController.createInvoice(req('viewer', 'all', { body: { companyId: 'co1' } }), res);
    expectForbidden(res);
  });

  it('viewer cannot update', async () => {
    const res = makeRes();
    await invoiceController.updateInvoice(req('viewer', 'all', { params: { id: 'i1' }, body: {} }), res);
    expectForbidden(res);
  });

  it('viewer cannot delete', async () => {
    const res = makeRes();
    await invoiceController.deleteInvoice(req('viewer', 'all', { params: { id: 'i1' } }), res);
    expectForbidden(res);
  });

  it('editor can create', async () => {
    const res = makeRes();
    await invoiceController.createInvoice(req('editor', 'all', { body: { companyId: 'co1' } }), res);
    expectSuccess(res);
  });

  it('editor can update', async () => {
    const res = makeRes();
    await invoiceController.updateInvoice(req('editor', 'all', { params: { id: 'i1' }, body: {} }), res);
    expectSuccess(res);
  });

  it('editor can delete own invoice (service returns truthy under ownership filter)', async () => {
    vi.mocked(invoiceService.deleteInvoice).mockResolvedValue(true as any);
    const res = makeRes();
    await invoiceController.deleteInvoice(req('editor', 'all', { params: { id: 'i1' } }), res);
    expectSuccess(res);
    // Non-admin should have been passed its own userId as the ownership filter
    expect(invoiceService.deleteInvoice).toHaveBeenCalledWith('u-self', 't1', 'i1', 'u-self');
  });

  it("editor cannot delete another user's invoice (service returns null under ownership filter)", async () => {
    vi.mocked(invoiceService.deleteInvoice).mockResolvedValue(false as any);
    const res = makeRes();
    await invoiceController.deleteInvoice(req('editor', 'all', { params: { id: 'i1' } }), res);
    expectNotFound(res);
  });

  it('admin can delete any invoice (service called with undefined ownership filter)', async () => {
    vi.mocked(invoiceService.deleteInvoice).mockResolvedValue(true as any);
    const res = makeRes();
    await invoiceController.deleteInvoice(req('admin', 'all', { params: { id: 'i1' } }), res);
    expectSuccess(res);
    expect(invoiceService.deleteInvoice).toHaveBeenCalledWith('u-self', 't1', 'i1', undefined);
  });

  // ─── recordAccess scoping ───────────────────────────
  it('editor list passes isAdmin=false', async () => {
    const res = makeRes();
    await invoiceController.listInvoices(req('editor', 'all'), res);
    expect(invoiceService.listInvoices).toHaveBeenCalledWith(
      'u-self',
      't1',
      expect.objectContaining({ isAdmin: false }),
    );
  });

  it('admin list passes isAdmin=true', async () => {
    const res = makeRes();
    await invoiceController.listInvoices(req('admin', 'all'), res);
    expect(invoiceService.listInvoices).toHaveBeenCalledWith(
      'u-self',
      't1',
      expect.objectContaining({ isAdmin: true }),
    );
  });
});
