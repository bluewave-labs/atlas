import type { Request, Response } from 'express';
import * as taskService from './service';
import { logger } from '../../utils/logger';
import { emitAppEvent } from '../../services/event.service';
import { getAppPermission, canAccess } from '../../services/app-permissions.service';

// ─── Widget ─────────────────────────────────────────────────────────

export async function getWidgetData(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view tasks' });
      return;
    }

    const userId = req.auth!.userId;
    const data = await taskService.getWidgetData(userId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to get tasks widget data');
    res.status(500).json({ success: false, error: 'Failed to get tasks widget data' });
  }
}

// ─── Tasks ──────────────────────────────────────────────────────────

export async function listTasks(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view tasks' });
      return;
    }

    const userId = req.auth!.userId;
    const { status, when, projectId, includeArchived } = req.query;

    const tasks = await taskService.listTasks(userId, {
      status: status as string | undefined,
      when: when as string | undefined,
      projectId: projectId === 'null' ? null : (projectId as string | undefined),
      includeArchived: includeArchived === 'true',
    });

    res.json({ success: true, data: { tasks } });
  } catch (error) {
    logger.error({ error }, 'Failed to list tasks');
    res.status(500).json({ success: false, error: 'Failed to list tasks' });
  }
}

export async function getTask(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view tasks' });
      return;
    }

    const userId = req.auth!.userId;
    const taskId = req.params.id as string;

    const task = await taskService.getTask(userId, taskId);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    res.json({ success: true, data: task });
  } catch (error) {
    logger.error({ error }, 'Failed to get task');
    res.status(500).json({ success: false, error: 'Failed to get task' });
  }
}

export async function createTask(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create tasks' });
      return;
    }

    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { title, notes, description, icon, type, headingId, projectId, when, priority, dueDate, tags, recurrenceRule } = req.body;

    const task = await taskService.createTask(userId, accountId, {
      title, notes, description, icon, type, headingId, projectId, when, priority, dueDate, tags, recurrenceRule,
    });

    res.json({ success: true, data: task });
  } catch (error) {
    logger.error({ error }, 'Failed to create task');
    res.status(500).json({ success: false, error: 'Failed to create task' });
  }
}

export async function updateTask(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update tasks' });
      return;
    }

    const userId = req.auth!.userId;
    const taskId = req.params.id as string;
    const { title, notes, description, icon, type, headingId, projectId, status, when, priority, dueDate, tags, recurrenceRule, sortOrder, isArchived } = req.body;

    const task = await taskService.updateTask(userId, taskId, {
      title, notes, description, icon, type, headingId, projectId, status, when, priority, dueDate, tags, recurrenceRule, sortOrder, isArchived,
    });

    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Emit event when task is completed
    if (status === 'completed' && req.auth!.tenantId) {
      emitAppEvent({
        tenantId: req.auth!.tenantId,
        userId,
        appId: 'tasks',
        eventType: 'task.completed',
        title: `completed task: ${task.title}`,
        metadata: { taskId: task.id },
      }).catch(() => {});
    }

    res.json({ success: true, data: task });
  } catch (error) {
    logger.error({ error }, 'Failed to update task');
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
}

export async function deleteTask(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete' });
      return;
    }

    const userId = req.auth!.userId;
    const taskId = req.params.id as string;

    await taskService.deleteTask(userId, taskId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete task');
    res.status(500).json({ success: false, error: 'Failed to delete task' });
  }
}

export async function restoreTask(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update tasks' });
      return;
    }

    const userId = req.auth!.userId;
    const taskId = req.params.id as string;

    const task = await taskService.restoreTask(userId, taskId);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    res.json({ success: true, data: task });
  } catch (error) {
    logger.error({ error }, 'Failed to restore task');
    res.status(500).json({ success: false, error: 'Failed to restore task' });
  }
}

export async function reorderTasks(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to reorder tasks' });
      return;
    }

    const userId = req.auth!.userId;
    const { taskIds } = req.body;

    if (!Array.isArray(taskIds)) {
      res.status(400).json({ success: false, error: 'taskIds must be an array' });
      return;
    }

    await taskService.reorderTasks(userId, taskIds);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to reorder tasks');
    res.status(500).json({ success: false, error: 'Failed to reorder tasks' });
  }
}

export async function searchTasks(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view tasks' });
      return;
    }

    const userId = req.auth!.userId;
    const query = (req.query.q as string) || '';

    if (!query.trim()) {
      res.json({ success: true, data: [] });
      return;
    }

    const results = await taskService.searchTasks(userId, query.trim());
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error({ error }, 'Failed to search tasks');
    res.status(500).json({ success: false, error: 'Failed to search tasks' });
  }
}

export async function getTaskCounts(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view tasks' });
      return;
    }

    const userId = req.auth!.userId;
    const counts = await taskService.getTaskCounts(userId);
    res.json({ success: true, data: counts });
  } catch (error) {
    logger.error({ error }, 'Failed to get task counts');
    res.status(500).json({ success: false, error: 'Failed to get task counts' });
  }
}

// ─── Projects ───────────────────────────────────────────────────────

export async function listProjects(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view projects' });
      return;
    }

    const userId = req.auth!.userId;
    const includeArchived = req.query.includeArchived === 'true';

    const projects = await taskService.listProjects(userId, includeArchived);
    res.json({ success: true, data: { projects } });
  } catch (error) {
    logger.error({ error }, 'Failed to list projects');
    res.status(500).json({ success: false, error: 'Failed to list projects' });
  }
}

export async function createProject(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create projects' });
      return;
    }

    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { title, color, description, icon } = req.body;

    const project = await taskService.createProject(userId, accountId, { title, color, description, icon });
    res.json({ success: true, data: project });
  } catch (error) {
    logger.error({ error }, 'Failed to create project');
    res.status(500).json({ success: false, error: 'Failed to create project' });
  }
}

export async function updateProject(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update projects' });
      return;
    }

    const userId = req.auth!.userId;
    const projectId = req.params.id as string;
    const { title, color, description, icon, sortOrder, isArchived } = req.body;

    const project = await taskService.updateProject(userId, projectId, {
      title, color, description, icon, sortOrder, isArchived,
    });

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    res.json({ success: true, data: project });
  } catch (error) {
    logger.error({ error }, 'Failed to update project');
    res.status(500).json({ success: false, error: 'Failed to update project' });
  }
}

export async function deleteProject(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete' });
      return;
    }

    const userId = req.auth!.userId;
    const projectId = req.params.id as string;

    await taskService.deleteProject(userId, projectId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete project');
    res.status(500).json({ success: false, error: 'Failed to delete project' });
  }
}

// ─── Seed sample tasks ──────────────────────────────────────────────

export async function seedSampleTasks(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;

    // Create projects
    const work = await taskService.createProject(userId, accountId, { title: 'Work', color: '#3b82f6' });
    const personal = await taskService.createProject(userId, accountId, { title: 'Personal', color: '#10b981' });
    await taskService.createProject(userId, accountId, { title: 'Health', color: '#ef4444' });

    // Inbox
    await taskService.createTask(userId, accountId, { title: 'Review team updates', when: 'inbox' });

    // Today
    await taskService.createTask(userId, accountId, { title: 'Plan this week\'s priorities', when: 'today', projectId: work.id });

    // Anytime
    await taskService.createTask(userId, accountId, { title: 'Organize shared drive folders', when: 'anytime', projectId: work.id });

    // Someday
    await taskService.createTask(userId, accountId, { title: 'Learn a new skill', when: 'someday', projectId: personal.id });

    // Completed
    const completed = await taskService.createTask(userId, accountId, { title: 'Set up Atlas', when: 'today', projectId: work.id });
    await taskService.updateTask(userId, completed.id, { status: 'completed' });

    res.json({ success: true, data: { message: 'Seeded sample tasks and projects' } });
  } catch (error) {
    logger.error({ error }, 'Failed to seed sample tasks');
    res.status(500).json({ success: false, error: 'Failed to seed sample tasks' });
  }
}

// ─── Subtasks ────────────────────────────────────────────────────────

export async function listSubtasks(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view subtasks' });
      return;
    }

    const taskId = req.params.id as string;
    const subtasks = await taskService.listSubtasks(taskId);
    res.json({ success: true, data: subtasks });
  } catch (error) {
    logger.error({ error }, 'Failed to list subtasks');
    res.status(500).json({ success: false, error: 'Failed to list subtasks' });
  }
}

export async function createSubtask(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create subtasks' });
      return;
    }

    const userId = req.auth!.userId;
    const taskId = req.params.id as string;
    const { title } = req.body;
    const subtask = await taskService.createSubtask(userId, taskId, title || '');
    res.json({ success: true, data: subtask });
  } catch (error) {
    logger.error({ error }, 'Failed to create subtask');
    res.status(500).json({ success: false, error: 'Failed to create subtask' });
  }
}

export async function updateSubtask(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update subtasks' });
      return;
    }

    const userId = req.auth!.userId;
    const subtaskId = req.params.subtaskId as string;
    const { title, isCompleted } = req.body;
    const subtask = await taskService.updateSubtask(userId, subtaskId, { title, isCompleted });
    if (!subtask) { res.status(404).json({ success: false, error: 'Subtask not found' }); return; }
    res.json({ success: true, data: subtask });
  } catch (error) {
    logger.error({ error }, 'Failed to update subtask');
    res.status(500).json({ success: false, error: 'Failed to update subtask' });
  }
}

export async function deleteSubtask(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete' });
      return;
    }

    await taskService.deleteSubtask(req.params.subtaskId as string);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete subtask');
    res.status(500).json({ success: false, error: 'Failed to delete subtask' });
  }
}

export async function reorderSubtasks(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to reorder subtasks' });
      return;
    }

    const taskId = req.params.id as string;
    const { subtaskIds } = req.body;
    await taskService.reorderSubtasks(taskId, subtaskIds);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to reorder subtasks');
    res.status(500).json({ success: false, error: 'Failed to reorder subtasks' });
  }
}

// ─── Activities ──────────────────────────────────────────────────────

export async function listActivities(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view activities' });
      return;
    }

    const taskId = req.params.id as string;
    const activities = await taskService.listActivities(taskId);
    res.json({ success: true, data: activities });
  } catch (error) {
    logger.error({ error }, 'Failed to list activities');
    res.status(500).json({ success: false, error: 'Failed to list activities' });
  }
}

// ─── Templates ───────────────────────────────────────────────────────

export async function listTemplates(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view templates' });
      return;
    }

    const templates = await taskService.listTemplates(req.auth!.userId);
    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error({ error }, 'Failed to list templates');
    res.status(500).json({ success: false, error: 'Failed to list templates' });
  }
}

export async function createTemplate(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create templates' });
      return;
    }

    const template = await taskService.createTemplate(req.auth!.userId, req.auth!.accountId, req.body);
    res.json({ success: true, data: template });
  } catch (error) {
    logger.error({ error }, 'Failed to create template');
    res.status(500).json({ success: false, error: 'Failed to create template' });
  }
}

export async function updateTemplate(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update templates' });
      return;
    }

    const template = await taskService.updateTemplate(req.auth!.userId, req.params.templateId as string, req.body);
    if (!template) { res.status(404).json({ success: false, error: 'Template not found' }); return; }
    res.json({ success: true, data: template });
  } catch (error) {
    logger.error({ error }, 'Failed to update template');
    res.status(500).json({ success: false, error: 'Failed to update template' });
  }
}

export async function deleteTemplate(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete' });
      return;
    }

    await taskService.deleteTemplate(req.auth!.userId, req.params.templateId as string);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete template');
    res.status(500).json({ success: false, error: 'Failed to delete template' });
  }
}

export async function createTaskFromTemplate(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create tasks' });
      return;
    }

    const task = await taskService.createTaskFromTemplate(req.auth!.userId, req.auth!.accountId, req.params.templateId as string);
    if (!task) { res.status(404).json({ success: false, error: 'Template not found' }); return; }
    res.json({ success: true, data: task });
  } catch (error) {
    logger.error({ error }, 'Failed to create task from template');
    res.status(500).json({ success: false, error: 'Failed to create task from template' });
  }
}

// ─── Email-to-Task ──────────────────────────────────────────────────

export async function createTaskFromEmail(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create tasks' });
      return;
    }

    const userId = req.auth!.userId;
    const accountId = req.auth!.accountId;
    const { emailId, subject, snippet } = req.body;
    const task = await taskService.createTask(userId, accountId, {
      title: subject || snippet || 'Task from email',
      sourceEmailId: emailId,
      sourceEmailSubject: subject || null,
    } as any);
    res.json({ success: true, data: task });
  } catch (error) {
    logger.error({ error }, 'Failed to create task from email');
    res.status(500).json({ success: false, error: 'Failed to create task from email' });
  }
}
