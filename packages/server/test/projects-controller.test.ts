import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// Mock projects service
vi.mock('../src/apps/projects/service', () => ({
  listProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  listProjectMembers: vi.fn(),
  addProjectMember: vi.fn(),
  removeProjectMember: vi.fn(),
  updateProjectMemberRate: vi.fn(),
  listTimeEntries: vi.fn(),
  getTimeEntry: vi.fn(),
  createTimeEntry: vi.fn(),
  updateTimeEntry: vi.fn(),
  deleteTimeEntry: vi.fn(),
  bulkLockEntries: vi.fn(),
  getWeeklyView: vi.fn(),
  getWidgetData: vi.fn(),
  getDashboardData: vi.fn(),
}));

// Mock event service
vi.mock('../src/services/event.service', () => ({
  emitAppEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock app-permissions service to always grant access
vi.mock('../src/services/app-permissions.service', () => ({
  getAppPermission: vi.fn().mockResolvedValue({ role: 'owner' }),
  canAccess: vi.fn().mockReturnValue(true),
}));

import * as controller from '../src/apps/projects/controller';
import * as projectService from '../src/apps/projects/service';

function makeReq(overrides: Record<string, any> = {}): Request {
  return {
    auth: { userId: 'u1', accountId: 'a1', email: 'test@test.com', tenantId: 't1' },
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

// ─── Projects ──────────────────────────────────────────────────────

describe('projects controller — listProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns projects list with success:true', async () => {
    const mockProjects = [
      { id: 'p1', name: 'Website Redesign' },
      { id: 'p2', name: 'Mobile App' },
    ];
    vi.mocked(projectService.listProjects).mockResolvedValue(mockProjects as any);

    const req = makeReq({ query: {} });
    const res = makeRes();

    await controller.listProjects(req, res);

    expect(projectService.listProjects).toHaveBeenCalledWith('u1', 't1', {
      search: undefined,
      companyId: undefined,
      status: undefined,
      includeArchived: false,
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { projects: mockProjects } })
    );
  });

  it('passes query filters to service', async () => {
    vi.mocked(projectService.listProjects).mockResolvedValue([] as any);

    const req = makeReq({ query: { search: 'web', clientId: 'c1', status: 'active', includeArchived: 'true' } });
    const res = makeRes();

    await controller.listProjects(req, res);

    expect(projectService.listProjects).toHaveBeenCalledWith('u1', 't1', {
      search: 'web',
      companyId: 'c1',
      status: 'active',
      includeArchived: true,
    });
  });
});

describe('projects controller — createProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when name is missing', async () => {
    const req = makeReq({ body: {} });
    const res = makeRes();

    await controller.createProject(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Name is required' })
    );
  });

  it('returns 400 when name is whitespace only', async () => {
    const req = makeReq({ body: { name: '   ' } });
    const res = makeRes();

    await controller.createProject(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates a project and returns it', async () => {
    const mockProject = { id: 'p1', name: 'New Project', status: 'active' };
    vi.mocked(projectService.createProject).mockResolvedValue(mockProject as any);

    const req = makeReq({
      body: { name: 'New Project', clientId: 'c1', billable: true, status: 'active' },
    });
    const res = makeRes();

    await controller.createProject(req, res);

    expect(projectService.createProject).toHaveBeenCalledWith('u1', 't1', expect.objectContaining({
      name: 'New Project',
      companyId: 'c1',
      billable: true,
    }));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockProject })
    );
  });

  it('returns 500 when service throws', async () => {
    vi.mocked(projectService.createProject).mockRejectedValue(new Error('DB failure'));

    const req = makeReq({ body: { name: 'Failing Project' } });
    const res = makeRes();

    await controller.createProject(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// ─── Time Entries ──────────────────────────────────────────────────

describe('projects controller — createTimeEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when projectId is missing', async () => {
    const req = makeReq({ body: { workDate: '2026-03-30' } });
    const res = makeRes();

    await controller.createTimeEntry(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'projectId and workDate are required' })
    );
  });

  it('returns 400 when workDate is missing', async () => {
    const req = makeReq({ body: { projectId: 'p1' } });
    const res = makeRes();

    await controller.createTimeEntry(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('creates a time entry with valid data', async () => {
    const mockEntry = { id: 'te-1', projectId: 'p1', durationMinutes: 120, workDate: '2026-03-30' };
    vi.mocked(projectService.createTimeEntry).mockResolvedValue(mockEntry as any);

    const req = makeReq({
      body: { projectId: 'p1', durationMinutes: 120, workDate: '2026-03-30', billable: true, notes: 'Frontend work' },
    });
    const res = makeRes();

    await controller.createTimeEntry(req, res);

    expect(projectService.createTimeEntry).toHaveBeenCalledWith('u1', 't1', expect.objectContaining({
      projectId: 'p1',
      durationMinutes: 120,
      workDate: '2026-03-30',
      billable: true,
      notes: 'Frontend work',
    }));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockEntry })
    );
  });

  it('defaults durationMinutes to 0 when not provided', async () => {
    const mockEntry = { id: 'te-2', projectId: 'p1', durationMinutes: 0, workDate: '2026-03-30' };
    vi.mocked(projectService.createTimeEntry).mockResolvedValue(mockEntry as any);

    const req = makeReq({
      body: { projectId: 'p1', workDate: '2026-03-30' },
    });
    const res = makeRes();

    await controller.createTimeEntry(req, res);

    expect(projectService.createTimeEntry).toHaveBeenCalledWith('u1', 't1', expect.objectContaining({
      durationMinutes: 0,
    }));
  });
});
