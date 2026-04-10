import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

// Mock task service
vi.mock('../src/apps/tasks/service', () => ({
  listTasks: vi.fn(),
  getTask: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  restoreTask: vi.fn(),
  getTaskCounts: vi.fn(),
  searchTasks: vi.fn(),
  reorderTasks: vi.fn(),
  listProjects: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  getWidgetData: vi.fn(),
}));

// Mock event service
vi.mock('../src/services/event.service', () => ({
  emitAppEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock app permissions so controllers pass the permission gate
vi.mock('../src/services/app-permissions.service', () => ({
  getAppPermission: vi.fn().mockResolvedValue({ role: 'admin', recordAccess: 'all', entityPermissions: null }),
  canAccess: vi.fn().mockReturnValue(true),
}));

import * as controller from '../src/apps/tasks/controller';
import * as taskService from '../src/apps/tasks/service';

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

describe('tasks controller — listTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns tasks list with success', async () => {
    const mockTasks = [
      { id: 't1', title: 'Task A', status: 'todo' },
      { id: 't2', title: 'Task B', status: 'completed' },
    ];
    vi.mocked(taskService.listTasks).mockResolvedValue(mockTasks as any);

    const req = makeReq({ query: {} });
    const res = makeRes();

    await controller.listTasks(req, res);

    expect(taskService.listTasks).toHaveBeenCalledWith('u1', expect.objectContaining({}));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: { tasks: mockTasks } })
    );
  });

  it('passes filter parameters from query', async () => {
    vi.mocked(taskService.listTasks).mockResolvedValue([] as any);

    const req = makeReq({ query: { status: 'completed', when: 'today', projectId: 'p1' } });
    const res = makeRes();

    await controller.listTasks(req, res);

    expect(taskService.listTasks).toHaveBeenCalledWith('u1', expect.objectContaining({
      status: 'completed',
      when: 'today',
      projectId: 'p1',
    }));
  });

  it('handles projectId "null" string as null', async () => {
    vi.mocked(taskService.listTasks).mockResolvedValue([] as any);

    const req = makeReq({ query: { projectId: 'null' } });
    const res = makeRes();

    await controller.listTasks(req, res);

    expect(taskService.listTasks).toHaveBeenCalledWith('u1', expect.objectContaining({
      projectId: null,
    }));
  });
});

describe('tasks controller — createTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a task and returns it', async () => {
    const mockTask = { id: 't1', title: 'New Task', status: 'todo' };
    vi.mocked(taskService.createTask).mockResolvedValue(mockTask as any);

    const req = makeReq({ body: { title: 'New Task', priority: 'high' } });
    const res = makeRes();

    await controller.createTask(req, res);

    expect(taskService.createTask).toHaveBeenCalledWith('u1', 't1', expect.objectContaining({
      title: 'New Task',
      priority: 'high',
    }));
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockTask })
    );
  });
});

describe('tasks controller — getTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns task when found', async () => {
    const mockTask = { id: 't1', title: 'Existing Task' };
    vi.mocked(taskService.getTask).mockResolvedValue(mockTask as any);

    const req = makeReq({ params: { id: 't1' } });
    const res = makeRes();

    await controller.getTask(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockTask })
    );
  });

  it('returns 404 when task is not found', async () => {
    vi.mocked(taskService.getTask).mockResolvedValue(null as any);

    const req = makeReq({ params: { id: 'nonexistent' } });
    const res = makeRes();

    await controller.getTask(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Task not found' })
    );
  });
});

describe('tasks controller — updateTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates a task and returns it', async () => {
    const updatedTask = { id: 't1', title: 'Updated', status: 'in-progress' };
    vi.mocked(taskService.updateTask).mockResolvedValue(updatedTask as any);

    const req = makeReq({
      params: { id: 't1' },
      body: { title: 'Updated', status: 'in-progress' },
    });
    const res = makeRes();

    await controller.updateTask(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: updatedTask })
    );
  });

  it('returns 404 when task to update is not found', async () => {
    vi.mocked(taskService.updateTask).mockResolvedValue(null as any);

    const req = makeReq({ params: { id: 'missing' }, body: { title: 'X' } });
    const res = makeRes();

    await controller.updateTask(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe('tasks controller — deleteTask', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes a task and returns success', async () => {
    vi.mocked(taskService.deleteTask).mockResolvedValue(undefined as any);

    const req = makeReq({ params: { id: 't1' } });
    const res = makeRes();

    await controller.deleteTask(req, res);

    expect(taskService.deleteTask).toHaveBeenCalledWith('u1', 't1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: null })
    );
  });
});

describe('tasks controller — getTaskCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns task counts', async () => {
    const mockCounts = { total: 10, completed: 5, todo: 3, inProgress: 2 };
    vi.mocked(taskService.getTaskCounts).mockResolvedValue(mockCounts as any);

    const req = makeReq();
    const res = makeRes();

    await controller.getTaskCounts(req, res);

    expect(taskService.getTaskCounts).toHaveBeenCalledWith('u1', 't1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: mockCounts })
    );
  });

  it('returns 500 when service throws', async () => {
    vi.mocked(taskService.getTaskCounts).mockRejectedValue(new Error('DB error'));

    const req = makeReq();
    const res = makeRes();

    await controller.getTaskCounts(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: 'Failed to get task counts' })
    );
  });
});
