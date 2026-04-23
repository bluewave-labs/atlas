import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// Mock CRM sub-services
vi.mock('../src/apps/crm/services/deal.service', () => ({
  listDeals: vi.fn(),
  getDeal: vi.fn(),
  createDeal: vi.fn(),
  updateDeal: vi.fn(),
  deleteDeal: vi.fn(),
  listDealStages: vi.fn(),
  seedDefaultStages: vi.fn(),
  markDealWon: vi.fn(),
  markDealLost: vi.fn(),
  countsByStage: vi.fn(),
  pipelineValue: vi.fn(),
  bulkCreateDeals: vi.fn(),
  getForecast: vi.fn(),
  createDealStage: vi.fn(),
  updateDealStage: vi.fn(),
  deleteDealStage: vi.fn(),
  reorderDealStages: vi.fn(),
}));

vi.mock('../src/apps/crm/services/contact.service', () => ({
  listContacts: vi.fn(),
  getContact: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
  deleteContact: vi.fn(),
  bulkCreateContacts: vi.fn(),
  mergeContacts: vi.fn(),
}));

vi.mock('../src/apps/crm/services/company.service', () => ({
  listCompanies: vi.fn(),
  getCompany: vi.fn(),
  createCompany: vi.fn(),
  updateCompany: vi.fn(),
  deleteCompany: vi.fn(),
}));

// Mock app-permissions service
vi.mock('../src/services/app-permissions.service', () => ({
  getAppPermission: vi.fn().mockResolvedValue({ role: 'admin', entityPermissions: {}, recordAccess: 'all' }),
  canAccessEntity: vi.fn().mockReturnValue(true),
}));

// Mock event service
vi.mock('../src/services/event.service', () => ({
  emitAppEvent: vi.fn().mockResolvedValue(undefined),
  getTenantMemberUserIds: vi.fn().mockResolvedValue([]),
}));

// Mock google auth
vi.mock('../src/services/google-auth', () => ({
  isGoogleConfigured: vi.fn().mockReturnValue(false),
}));

// Mock redis
vi.mock('../src/config/redis', () => ({
  getRedisClient: vi.fn().mockReturnValue(null),
}));

// Mock CRM calendar service
vi.mock('../src/apps/crm/calendar.service', () => ({}));

import * as controller from '../src/apps/crm/controller';
import * as dealService from '../src/apps/crm/services/deal.service';
import * as contactService from '../src/apps/crm/services/contact.service';
import * as companyService from '../src/apps/crm/services/company.service';
import * as appPermissions from '../src/services/app-permissions.service';

function makeReq(overrides: Record<string, any> = {}): Request {
  return {
    auth: { userId: 'u1', accountId: 'a1', email: 'test@test.com', tenantId: 't1' },
    crmPerm: { role: 'admin', recordAccess: 'all', entityPermissions: null },
    body: {},
    params: {},
    query: {},
    ...overrides,
  } as any;
}

function makeRes() {
  const res: any = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as Response;
}

function resetPermMocks() {
  vi.mocked(appPermissions.getAppPermission).mockResolvedValue({ role: 'admin', entityPermissions: {}, recordAccess: 'all' } as any);
  vi.mocked(appPermissions.canAccessEntity).mockReturnValue(true);
}

// ─── Deals ─────────────────────────────────────────────────────────

describe('crm controller — listDeals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPermMocks();
  });

  it('returns deals list with success', async () => {
    const mockDeals = [
      { id: 'd1', title: 'Deal A', value: 1000 },
      { id: 'd2', title: 'Deal B', value: 2000 },
    ];
    vi.mocked(dealService.listDeals).mockResolvedValue(mockDeals as any);

    const req = makeReq({ query: {} });
    const res = makeRes();

    await controller.listDeals(req, res);

    expect(dealService.listDeals).toHaveBeenCalledWith('u1', 't1', expect.objectContaining({
      recordAccess: 'all',
    }));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { deals: mockDeals } })
    );
  });

  it('returns 403 when user has no deals access', async () => {
    vi.mocked(appPermissions.canAccessEntity).mockReturnValue(false);

    const req = makeReq();
    const res = makeRes();

    await controller.listDeals(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'No access to deals' })
    );
  });
});

describe('crm controller — createDeal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPermMocks();
  });

  it('creates a deal and returns it', async () => {
    const mockDeal = { id: 'd1', title: 'New Deal', value: 5000 };
    vi.mocked(dealService.createDeal).mockResolvedValue(mockDeal as any);

    const req = makeReq({
      body: { title: 'New Deal', value: 5000, stageId: 'stage-1' },
    });
    const res = makeRes();

    await controller.createDeal(req, res);

    expect(dealService.createDeal).toHaveBeenCalledWith('u1', 't1', expect.objectContaining({
      title: 'New Deal',
      value: 5000,
      stageId: 'stage-1',
    }));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockDeal })
    );
  });

  it('returns 400 when title is missing', async () => {
    const req = makeReq({ body: { value: 1000, stageId: 'stage-1' } });
    const res = makeRes();

    await controller.createDeal(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Title is required' })
    );
  });

  it('returns 400 when stageId is missing', async () => {
    const req = makeReq({ body: { title: 'Deal' } });
    const res = makeRes();

    await controller.createDeal(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Stage is required' })
    );
  });
});

describe('crm controller — updateDeal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPermMocks();
  });

  it('updates a deal and returns it', async () => {
    const updatedDeal = { id: 'd1', title: 'Updated Deal', value: 7500 };
    vi.mocked(dealService.updateDeal).mockResolvedValue(updatedDeal as any);

    const req = makeReq({
      params: { id: 'd1' },
      body: { title: 'Updated Deal', value: 7500 },
    });
    const res = makeRes();

    await controller.updateDeal(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: updatedDeal })
    );
  });

  it('returns 404 when deal is not found', async () => {
    vi.mocked(dealService.updateDeal).mockResolvedValue(null as any);

    const req = makeReq({ params: { id: 'nonexistent' }, body: { title: 'X' } });
    const res = makeRes();

    await controller.updateDeal(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Deal not found' })
    );
  });
});

describe('crm controller — deleteDeal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPermMocks();
  });

  it('deletes a deal (soft delete) and returns success', async () => {
    vi.mocked(dealService.deleteDeal).mockResolvedValue(undefined as any);

    const req = makeReq({ params: { id: 'd1' } });
    const res = makeRes();

    await controller.deleteDeal(req, res);

    expect(dealService.deleteDeal).toHaveBeenCalledWith('u1', 't1', 'd1', 'all');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: null })
    );
  });
});

// ─── Contacts ──────────────────────────────────────────────────────

describe('crm controller — listContacts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPermMocks();
  });

  it('returns contacts list', async () => {
    const mockContacts = [{ id: 'c1', name: 'John Doe' }];
    vi.mocked(contactService.listContacts).mockResolvedValue(mockContacts as any);

    const req = makeReq({ query: {} });
    const res = makeRes();

    await controller.listContacts(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { contacts: mockContacts } })
    );
  });
});

// ─── Companies ─────────────────────────────────────────────────────

describe('crm controller — listCompanies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPermMocks();
  });

  it('returns companies list', async () => {
    const mockCompanies = [{ id: 'comp1', name: 'Acme Corp' }];
    vi.mocked(companyService.listCompanies).mockResolvedValue(mockCompanies as any);

    const req = makeReq({ query: {} });
    const res = makeRes();

    await controller.listCompanies(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { companies: mockCompanies } })
    );
  });

  it('returns 403 when user lacks company access', async () => {
    vi.mocked(appPermissions.canAccessEntity).mockReturnValue(false);

    const req = makeReq();
    const res = makeRes();

    await controller.listCompanies(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('crm controller — createCompany', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPermMocks();
  });

  it('returns 400 when name is missing', async () => {
    const req = makeReq({ body: { domain: 'example.com' } });
    const res = makeRes();

    await controller.createCompany(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Name is required' })
    );
  });

  it('creates a company and returns it', async () => {
    const mockCompany = { id: 'comp1', name: 'Acme Corp' };
    vi.mocked(companyService.createCompany).mockResolvedValue(mockCompany as any);

    const req = makeReq({ body: { name: 'Acme Corp', domain: 'acme.com' } });
    const res = makeRes();

    await controller.createCompany(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockCompany })
    );
  });
});
