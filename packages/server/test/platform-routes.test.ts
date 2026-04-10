import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// Mock platform services
vi.mock('../src/services/platform/tenant.service', () => ({
  createTenant: vi.fn(),
  listTenantsForUser: vi.fn(),
  getTenantById: vi.fn(),
  getTenantBySlug: vi.fn(),
  getTenantMembership: vi.fn(),
  addTenantMember: vi.fn(),
}));

vi.mock('../src/services/platform/tenant-user.service', () => ({
  listTenantUsers: vi.fn(),
  createTenantUser: vi.fn(),
  removeTenantUser: vi.fn(),
  updateTenantUserRole: vi.fn(),
  inviteUser: vi.fn(),
}));

vi.mock('../src/services/platform/tenant-app.service', () => ({
  listTenantApps: vi.fn(),
  enableApp: vi.fn(),
  disableApp: vi.fn(),
}));

vi.mock('../src/services/event.service', () => ({
  emitAppEvent: vi.fn().mockResolvedValue(undefined),
  getTenantMemberUserIds: vi.fn().mockResolvedValue(['u1']),
}));

vi.mock('../src/utils/password', () => ({
  validatePasswordStrength: vi.fn().mockReturnValue({ valid: true }),
}));

import * as ctrl from '../src/controllers/platform.controller';
import * as tenantService from '../src/services/platform/tenant.service';
import * as tenantUserService from '../src/services/platform/tenant-user.service';
import * as tenantAppService from '../src/services/platform/tenant-app.service';

function makeReq(overrides: Record<string, any> = {}): Request {
  return {
    auth: { userId: 'u1', accountId: 'a1', email: 'test@test.com', isSuperAdmin: false, tenantId: 't1' },
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

describe('platform controller - listMyTenants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns tenant list with success:true', async () => {
    const mockTenants = [{ id: 't1', name: 'Acme Corp', slug: 'acme' }];
    vi.mocked(tenantService.listTenantsForUser).mockResolvedValue(mockTenants as any);

    const req = makeReq();
    const res = makeRes();

    await ctrl.listMyTenants(req, res);

    expect(tenantService.listTenantsForUser).toHaveBeenCalledWith('u1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { tenants: mockTenants } })
    );
  });

  it('returns 500 when service throws', async () => {
    vi.mocked(tenantService.listTenantsForUser).mockRejectedValue(new Error('DB error'));

    const req = makeReq();
    const res = makeRes();

    await ctrl.listMyTenants(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Failed to list tenants' })
    );
  });
});

describe('platform controller - listTenantUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when caller is not a member', async () => {
    vi.mocked(tenantService.getTenantMembership).mockResolvedValue(null as any);

    const req = makeReq({ params: { id: 't1' } });
    const res = makeRes();

    await ctrl.listTenantUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Not a member of this tenant' })
    );
  });

  it('returns users list when caller is a member', async () => {
    vi.mocked(tenantService.getTenantMembership).mockResolvedValue({ role: 'member' } as any);
    const mockUsers = [{ id: 'u1', email: 'test@test.com', name: 'Test User' }];
    vi.mocked(tenantUserService.listTenantUsers).mockResolvedValue(mockUsers as any);

    const req = makeReq({ params: { id: 't1' } });
    const res = makeRes();

    await ctrl.listTenantUsers(req, res);

    expect(tenantUserService.listTenantUsers).toHaveBeenCalledWith('t1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { users: mockUsers } })
    );
  });
});

describe('platform controller - inviteTenantUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when email is invalid', async () => {
    vi.mocked(tenantService.getTenantMembership).mockResolvedValue({ role: 'owner' } as any);

    const req = makeReq({ params: { id: 't1' }, body: { email: 'not-an-email' } });
    const res = makeRes();

    await ctrl.inviteTenantUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('returns 403 when caller is not owner or admin', async () => {
    vi.mocked(tenantService.getTenantMembership).mockResolvedValue({ role: 'member' } as any);

    const req = makeReq({ params: { id: 't1' }, body: { email: 'new@test.com' } });
    const res = makeRes();

    await ctrl.inviteTenantUser(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Only owners and admins can invite users' })
    );
  });

  it('invites a user successfully', async () => {
    vi.mocked(tenantService.getTenantMembership).mockResolvedValue({ role: 'admin' } as any);
    const mockInvitation = { id: 'inv-1', email: 'new@test.com', role: 'member' };
    vi.mocked(tenantUserService.inviteUser).mockResolvedValue(mockInvitation as any);

    const req = makeReq({ params: { id: 't1' }, body: { email: 'new@test.com', role: 'member' } });
    const res = makeRes();

    await ctrl.inviteTenantUser(req, res);

    expect(tenantUserService.inviteUser).toHaveBeenCalledWith('t1', 'new@test.com', 'member', 'u1', {
      appPermissions: undefined,
      crmTeamId: undefined,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockInvitation })
    );
  });
});

describe('platform controller - enableTenantApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when caller is a regular member', async () => {
    vi.mocked(tenantService.getTenantMembership).mockResolvedValue({ role: 'member' } as any);

    const req = makeReq({ params: { id: 't1', appId: 'crm' } });
    const res = makeRes();

    await ctrl.enableTenantApp(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Only owners and admins can manage apps' })
    );
  });

  it('enables an app successfully', async () => {
    vi.mocked(tenantService.getTenantMembership).mockResolvedValue({ role: 'owner' } as any);
    const mockApp = { tenantId: 't1', appId: 'crm', enabledAt: new Date() };
    vi.mocked(tenantAppService.enableApp).mockResolvedValue(mockApp as any);

    const req = makeReq({ params: { id: 't1', appId: 'crm' } });
    const res = makeRes();

    await ctrl.enableTenantApp(req, res);

    expect(tenantAppService.enableApp).toHaveBeenCalledWith('t1', 'crm', 'u1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockApp })
    );
  });
});

describe('platform controller - removeTenantUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when caller lacks admin/owner role', async () => {
    vi.mocked(tenantService.getTenantMembership).mockResolvedValue({ role: 'member' } as any);

    const req = makeReq({ params: { id: 't1', userId: 'u2' } });
    const res = makeRes();

    await ctrl.removeTenantUser(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Only owners and admins can remove users' })
    );
  });

  it('returns 400 when trying to remove self', async () => {
    vi.mocked(tenantService.getTenantMembership).mockResolvedValue({ role: 'owner' } as any);

    const req = makeReq({ params: { id: 't1', userId: 'u1' } });
    const res = makeRes();

    await ctrl.removeTenantUser(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Cannot remove yourself from the tenant' })
    );
  });

  it('removes a user successfully', async () => {
    vi.mocked(tenantService.getTenantMembership).mockResolvedValue({ role: 'owner' } as any);
    vi.mocked(tenantUserService.removeTenantUser).mockResolvedValue(undefined as any);

    const req = makeReq({ params: { id: 't1', userId: 'u2' } });
    const res = makeRes();

    await ctrl.removeTenantUser(req, res);

    expect(tenantUserService.removeTenantUser).toHaveBeenCalledWith('t1', 'u2');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { message: 'User removed' } })
    );
  });
});

describe('platform controller - disableTenantApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('disables an app successfully when caller is admin', async () => {
    vi.mocked(tenantService.getTenantMembership).mockResolvedValue({ role: 'admin' } as any);
    vi.mocked(tenantAppService.disableApp).mockResolvedValue(undefined as any);

    const req = makeReq({ params: { id: 't1', appId: 'crm' } });
    const res = makeRes();

    await ctrl.disableTenantApp(req, res);

    expect(tenantAppService.disableApp).toHaveBeenCalledWith('t1', 'crm');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { message: 'App disabled' } })
    );
  });
});
