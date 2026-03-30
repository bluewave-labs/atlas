import type { Request, Response } from 'express';
import * as taskService from './service';
import { logger } from '../../utils/logger';
import { emitAppEvent } from '../../services/event.service';

// ─── Widget ─────────────────────────────────────────────────────────

export async function getWidgetData(req: Request, res: Response) {
  try {
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
    const health = await taskService.createProject(userId, accountId, { title: 'Health & fitness', color: '#ef4444' });

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Inbox tasks
    await taskService.createTask(userId, accountId, { title: 'Review pull request from Alex', when: 'inbox', priority: 'high', projectId: work.id });
    await taskService.createTask(userId, accountId, { title: 'Reply to landlord about lease renewal', when: 'inbox', priority: 'medium' });
    await taskService.createTask(userId, accountId, { title: 'Look into new podcast recommendations', when: 'inbox' });
    await taskService.createTask(userId, accountId, { title: 'Schedule dentist appointment', when: 'inbox', projectId: health.id });

    // Today tasks
    await taskService.createTask(userId, accountId, { title: 'Prepare slides for team standup', when: 'today', priority: 'high', projectId: work.id, dueDate: today });
    await taskService.createTask(userId, accountId, { title: 'Morning run — 5K', when: 'today', projectId: health.id });
    await taskService.createTask(userId, accountId, { title: 'Buy groceries for the week', when: 'today', projectId: personal.id });
    await taskService.createTask(userId, accountId, { title: 'Send invoice to client', when: 'today', priority: 'medium', projectId: work.id, dueDate: today });
    await taskService.createTask(userId, accountId, { title: 'Call mom', when: 'today', projectId: personal.id });

    // Anytime tasks
    await taskService.createTask(userId, accountId, { title: 'Refactor authentication module', when: 'anytime', projectId: work.id, tags: ['code'] });
    await taskService.createTask(userId, accountId, { title: 'Organize photo library', when: 'anytime', projectId: personal.id });
    await taskService.createTask(userId, accountId, { title: 'Research standing desk options', when: 'anytime', projectId: health.id, tags: ['shopping'] });
    await taskService.createTask(userId, accountId, { title: 'Write blog post about TypeScript patterns', when: 'anytime', projectId: work.id, tags: ['writing'] });
    await taskService.createTask(userId, accountId, { title: 'Update resume and LinkedIn profile', when: 'anytime' });
    await taskService.createTask(userId, accountId, { title: 'Clean up email subscriptions', when: 'anytime' });

    // Someday tasks
    await taskService.createTask(userId, accountId, { title: 'Learn Rust basics', when: 'someday', tags: ['learning'] });
    await taskService.createTask(userId, accountId, { title: 'Plan weekend trip to the coast', when: 'someday', projectId: personal.id });
    await taskService.createTask(userId, accountId, { title: 'Build a personal dashboard app', when: 'someday', tags: ['code'] });
    await taskService.createTask(userId, accountId, { title: 'Read "Designing Data-Intensive Applications"', when: 'someday', tags: ['reading'] });

    // Tasks with due dates (upcoming)
    await taskService.createTask(userId, accountId, { title: 'Submit quarterly report', when: 'anytime', priority: 'high', projectId: work.id, dueDate: tomorrow });
    await taskService.createTask(userId, accountId, { title: 'Renew gym membership', when: 'anytime', projectId: health.id, dueDate: nextWeek });
    await taskService.createTask(userId, accountId, { title: 'Prepare presentation for conference', when: 'anytime', priority: 'medium', projectId: work.id, dueDate: nextWeek });
    await taskService.createTask(userId, accountId, { title: 'Pay car insurance', when: 'anytime', priority: 'high', projectId: personal.id, dueDate: nextMonth });
    await taskService.createTask(userId, accountId, { title: 'File tax documents', when: 'today', priority: 'high', dueDate: yesterday });

    // Completed tasks (logbook)
    const completed1 = await taskService.createTask(userId, accountId, { title: 'Set up CI/CD pipeline', when: 'anytime', projectId: work.id });
    await taskService.updateTask(userId, completed1.id, { status: 'completed' });

    const completed2 = await taskService.createTask(userId, accountId, { title: 'Fix login page bug', when: 'today', priority: 'high', projectId: work.id });
    await taskService.updateTask(userId, completed2.id, { status: 'completed' });

    const completed3 = await taskService.createTask(userId, accountId, { title: 'Order birthday gift for Sarah', when: 'today', projectId: personal.id });
    await taskService.updateTask(userId, completed3.id, { status: 'completed' });

    const completed4 = await taskService.createTask(userId, accountId, { title: 'Complete React course module 5', when: 'anytime', tags: ['learning'] });
    await taskService.updateTask(userId, completed4.id, { status: 'completed' });

    const completed5 = await taskService.createTask(userId, accountId, { title: 'Weekly meal prep', when: 'today', projectId: health.id });
    await taskService.updateTask(userId, completed5.id, { status: 'completed' });

    res.json({ success: true, data: { message: 'Seeded sample tasks and projects' } });
  } catch (error) {
    logger.error({ error }, 'Failed to seed sample tasks');
    res.status(500).json({ success: false, error: 'Failed to seed sample tasks' });
  }
}

// ─── Subtasks ────────────────────────────────────────────────────────

export async function listSubtasks(req: Request, res: Response) {
  try {
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
    await taskService.deleteSubtask(req.params.subtaskId as string);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete subtask');
    res.status(500).json({ success: false, error: 'Failed to delete subtask' });
  }
}

export async function reorderSubtasks(req: Request, res: Response) {
  try {
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
    const templates = await taskService.listTemplates(req.auth!.userId);
    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error({ error }, 'Failed to list templates');
    res.status(500).json({ success: false, error: 'Failed to list templates' });
  }
}

export async function createTemplate(req: Request, res: Response) {
  try {
    const template = await taskService.createTemplate(req.auth!.userId, req.auth!.accountId, req.body);
    res.json({ success: true, data: template });
  } catch (error) {
    logger.error({ error }, 'Failed to create template');
    res.status(500).json({ success: false, error: 'Failed to create template' });
  }
}

export async function updateTemplate(req: Request, res: Response) {
  try {
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
    await taskService.deleteTemplate(req.auth!.userId, req.params.templateId as string);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete template');
    res.status(500).json({ success: false, error: 'Failed to delete template' });
  }
}

export async function createTaskFromTemplate(req: Request, res: Response) {
  try {
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
