import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/apps/projects/service', () => ({
  listProjects: vi.fn().mockResolvedValue([]),
  getProject: vi.fn().mockResolvedValue({ id: 'p1', userId: 'u-self', name: 'P' }),
  createProject: vi.fn().mockResolvedValue({ id: 'p1', name: 'P' }),
  updateProject: vi.fn().mockResolvedValue({ id: 'p1' }),
  deleteProject: vi.fn().mockResolvedValue(undefined),
  userCanAccessProject: vi.fn().mockResolvedValue(true),
}));

vi.mock('../src/services/event.service', () => ({
  emitAppEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as projectController from '../src/apps/projects/controllers/project.controller';
import * as projectService from '../src/apps/projects/service';
import { makeReqWithPerm, makeRes, expectForbidden, expectSuccess } from './helpers/rbac-harness';

function req(role: 'admin' | 'editor' | 'viewer', recordAccess: 'all' | 'own' = 'all', extra: any = {}) {
  return makeReqWithPerm('projects', role, recordAccess, extra);
}

describe('RBAC matrix — Projects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(projectService.getProject).mockResolvedValue({ id: 'p1', userId: 'u-self', name: 'P' } as any);
    vi.mocked(projectService.userCanAccessProject).mockResolvedValue(true);
  });

  it('viewer can list', async () => {
    const res = makeRes();
    await projectController.listProjects(req('viewer'), res);
    expectSuccess(res);
  });

  it('viewer can get when userCanAccessProject true', async () => {
    const res = makeRes();
    await projectController.getProject(req('viewer', 'all', { params: { id: 'p1' } }), res);
    expectSuccess(res);
  });

  it('viewer denied get when not a member', async () => {
    vi.mocked(projectService.userCanAccessProject).mockResolvedValue(false);
    const res = makeRes();
    await projectController.getProject(req('viewer', 'all', { params: { id: 'p1' } }), res);
    expectForbidden(res);
  });

  it('viewer cannot create', async () => {
    const res = makeRes();
    await projectController.createProject(req('viewer', 'all', { body: { name: 'P' } }), res);
    expectForbidden(res);
  });

  it('viewer cannot update', async () => {
    const res = makeRes();
    await projectController.updateProject(req('viewer', 'all', { params: { id: 'p1' }, body: {} }), res);
    expectForbidden(res);
  });

  it('viewer cannot delete', async () => {
    const res = makeRes();
    await projectController.deleteProject(req('viewer', 'all', { params: { id: 'p1' } }), res);
    expectForbidden(res);
  });

  it('editor can create', async () => {
    const res = makeRes();
    await projectController.createProject(req('editor', 'all', { body: { name: 'P' } }), res);
    expectSuccess(res);
  });

  it('editor can update', async () => {
    const res = makeRes();
    await projectController.updateProject(req('editor', 'all', { params: { id: 'p1' }, body: {} }), res);
    expectSuccess(res);
  });

  it('editor can delete own project (userCanAccessProject=true)', async () => {
    vi.mocked(projectService.userCanAccessProject).mockResolvedValue(true);
    const res = makeRes();
    await projectController.deleteProject(req('editor', 'all', { params: { id: 'p1' } }), res);
    expectSuccess(res);
  });

  it("editor cannot delete project they don't own/belong to", async () => {
    vi.mocked(projectService.userCanAccessProject).mockResolvedValue(false);
    const res = makeRes();
    await projectController.deleteProject(req('editor', 'all', { params: { id: 'p1' } }), res);
    expectForbidden(res);
  });

  it('admin can delete any project (bypasses ownership check)', async () => {
    vi.mocked(projectService.userCanAccessProject).mockResolvedValue(false);
    const res = makeRes();
    await projectController.deleteProject(req('admin', 'all', { params: { id: 'p1' } }), res);
    expectSuccess(res);
  });

  // ─── recordAccess scoping ───────────────────────────
  it('editor list passes isAdmin=false', async () => {
    const res = makeRes();
    await projectController.listProjects(req('editor', 'all'), res);
    expect(projectService.listProjects).toHaveBeenCalledWith(
      'u-self',
      't1',
      expect.objectContaining({ isAdmin: false }),
    );
  });

  it('admin list passes isAdmin=true', async () => {
    const res = makeRes();
    await projectController.listProjects(req('admin', 'all'), res);
    expect(projectService.listProjects).toHaveBeenCalledWith(
      'u-self',
      't1',
      expect.objectContaining({ isAdmin: true }),
    );
  });
});
