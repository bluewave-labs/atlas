import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/apps/tasks/service', () => ({
  getWidgetData: vi.fn().mockResolvedValue({}),
  listTasks: vi.fn().mockResolvedValue([]),
  getTask: vi.fn().mockResolvedValue({ id: 't-1', userId: 'u-self', title: 'Task' }),
  createTask: vi.fn().mockResolvedValue({ id: 't-1', title: 'New' }),
  updateTask: vi.fn().mockResolvedValue({ id: 't-1', title: 'Updated' }),
  deleteTask: vi.fn().mockResolvedValue(undefined),
  restoreTask: vi.fn().mockResolvedValue({ id: 't-1' }),
  reorderTasks: vi.fn().mockResolvedValue(undefined),
  searchTasks: vi.fn().mockResolvedValue([]),
  getTaskCounts: vi.fn().mockResolvedValue({}),
}));

vi.mock('../src/services/event.service', () => ({
  emitAppEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as tasksController from '../src/apps/tasks/controllers/tasks-projects.controller';
import * as taskService from '../src/apps/tasks/service';
import { makeReqWithPerm, makeRes, expectForbidden, expectSuccess, expectNotFound, SELF_USER_ID, OTHER_USER_ID } from './helpers/rbac-harness';

function req(role: 'admin' | 'editor' | 'viewer', recordAccess: 'all' | 'own' = 'all', extra: any = {}) {
  return makeReqWithPerm('tasks', role, recordAccess, extra);
}

describe('RBAC matrix — Tasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(taskService.getTask).mockResolvedValue({ id: 't-1', userId: SELF_USER_ID, title: 'Task' } as any);
  });

  it('viewer can list', async () => {
    const res = makeRes();
    await tasksController.listTasks(req('viewer'), res);
    expectSuccess(res);
  });

  it('viewer can get', async () => {
    const res = makeRes();
    await tasksController.getTask(req('viewer', 'all', { params: { id: 't-1' } }), res);
    expectSuccess(res);
  });

  it('viewer cannot create', async () => {
    const res = makeRes();
    await tasksController.createTask(req('viewer', 'all', { body: { title: 'New' } }), res);
    expectForbidden(res);
  });

  it('viewer cannot update', async () => {
    const res = makeRes();
    await tasksController.updateTask(req('viewer', 'all', { params: { id: 't-1' }, body: { title: 'X' } }), res);
    expectForbidden(res);
  });

  it('viewer cannot delete', async () => {
    const res = makeRes();
    await tasksController.deleteTask(req('viewer', 'all', { params: { id: 't-1' } }), res);
    expectForbidden(res);
  });

  it('editor can create', async () => {
    const res = makeRes();
    await tasksController.createTask(req('editor', 'all', { body: { title: 'New' } }), res);
    expectSuccess(res);
  });

  it('editor can update', async () => {
    const res = makeRes();
    await tasksController.updateTask(req('editor', 'all', { params: { id: 't-1' }, body: { title: 'X' } }), res);
    expectSuccess(res);
  });

  it('editor can delete own task', async () => {
    vi.mocked(taskService.getTask).mockResolvedValue({ id: 't-1', userId: SELF_USER_ID } as any);
    const res = makeRes();
    await tasksController.deleteTask(req('editor', 'all', { params: { id: 't-1' } }), res);
    expectSuccess(res);
  });

  it("editor cannot delete another user's task", async () => {
    vi.mocked(taskService.getTask).mockResolvedValue({ id: 't-1', userId: OTHER_USER_ID } as any);
    const res = makeRes();
    await tasksController.deleteTask(req('editor', 'all', { params: { id: 't-1' } }), res);
    // assertCanDelete returns 404 (not leaked) when ownership fails
    expectNotFound(res);
  });

  it('admin can delete any task', async () => {
    vi.mocked(taskService.getTask).mockResolvedValue({ id: 't-1', userId: OTHER_USER_ID } as any);
    const res = makeRes();
    await tasksController.deleteTask(req('admin', 'all', { params: { id: 't-1' } }), res);
    expectSuccess(res);
  });
});
