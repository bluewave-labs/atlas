import type { Request, Response } from 'express';
import * as workService from '../service';
import { logger } from '../../../utils/logger';
import { canAccess } from '../../../services/app-permissions.service';
import { emitAppEvent } from '../../../services/event.service';
import { parseMentionsAndNotify } from '../../../utils/mentions';
import { assertCanDelete } from '../../../middleware/assert-can-delete';
import type { TaskView } from '../services/task.service';

// ─── Tasks ──────────────────────────────────────────────────────────

export async function listTasks(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const { status, when, projectId, includeArchived, assigneeId, view } = req.query;

    const tasks = await workService.listTasks(userId, {
      status: status as string | undefined,
      when: when as string | undefined,
      projectId: projectId === 'null' ? null : (projectId as string | undefined),
      assigneeId: assigneeId as string | undefined,
      includeArchived: includeArchived === 'true',
      view: view as TaskView | undefined,
    });

    res.json({ success: true, data: { tasks } });
  } catch (error) {
    logger.error({ error }, 'Failed to list work tasks');
    res.status(500).json({ success: false, error: 'Failed to list tasks' });
  }
}

export async function getTask(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const taskId = req.params.id as string;

    const task = await workService.getTask(userId, taskId);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    // Private task not owned by this user
    if (task.isPrivate && task.userId !== userId) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    res.json({ success: true, data: task });
  } catch (error) {
    logger.error({ error }, 'Failed to get work task');
    res.status(500).json({ success: false, error: 'Failed to get task' });
  }
}

export async function createTask(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create tasks' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { title, notes, description, icon, type, headingId, projectId, when, priority, dueDate, tags, recurrenceRule, assigneeId } = req.body;

    const task = await workService.createTask(userId, tenantId, {
      title, notes, description, icon, type, headingId, projectId, when, priority, dueDate, tags, recurrenceRule, assigneeId,
    });

    res.json({ success: true, data: task });
  } catch (error) {
    logger.error({ error }, 'Failed to create work task');
    res.status(500).json({ success: false, error: 'Failed to create task' });
  }
}

export async function updateTask(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update tasks' });
      return;
    }

    const userId = req.auth!.userId;
    const taskId = req.params.id as string;
    const { title, notes, description, icon, type, headingId, projectId, status, when, priority, dueDate, tags, recurrenceRule, assigneeId, sortOrder, isArchived } = req.body;

    const existingTask = assigneeId !== undefined
      ? await workService.getTask(userId, taskId)
      : null;

    const task = await workService.updateTask(userId, taskId, {
      title, notes, description, icon, type, headingId, projectId, status, when, priority, dueDate, tags, recurrenceRule, assigneeId, sortOrder, isArchived,
    });

    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    if (status === 'completed' && req.auth!.tenantId) {
      emitAppEvent({
        tenantId: req.auth!.tenantId, userId, appId: 'work',
        eventType: 'task.completed', title: `completed task: ${task.title}`,
        metadata: { taskId: task.id },
      }).catch(() => {});
    }

    if (assigneeId && assigneeId !== existingTask?.assigneeId && req.auth!.tenantId) {
      emitAppEvent({
        tenantId: req.auth!.tenantId, userId, appId: 'work',
        eventType: 'task.assigned', title: `assigned you a task: ${task.title}`,
        metadata: { taskId: task.id, assigneeId },
        notifyUserIds: [assigneeId],
      }).catch(() => {});
    }

    res.json({ success: true, data: task });
  } catch (error) {
    logger.error({ error }, 'Failed to update work task');
    res.status(500).json({ success: false, error: 'Failed to update task' });
  }
}

export async function deleteTask(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete' });
      return;
    }

    const userId = req.auth!.userId;
    const taskId = req.params.id as string;

    const existing = await workService.getTask(userId, taskId);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }
    if (!assertCanDelete(res, perm.role, existing.userId, userId)) return;

    await workService.deleteTask(existing.userId, taskId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete work task');
    res.status(500).json({ success: false, error: 'Failed to delete task' });
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

    const results = await workService.searchTasks(userId, query.trim());
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error({ error }, 'Failed to search work tasks');
    res.status(500).json({ success: false, error: 'Failed to search tasks' });
  }
}

export async function getTaskCounts(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const counts = await workService.getTaskCounts(userId);
    res.json({ success: true, data: counts });
  } catch (error) {
    logger.error({ error }, 'Failed to get work task counts');
    res.status(500).json({ success: false, error: 'Failed to get task counts' });
  }
}

export async function reorderTasks(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
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

    await workService.reorderTasks(userId, taskIds);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to reorder work tasks');
    res.status(500).json({ success: false, error: 'Failed to reorder tasks' });
  }
}

// ─── Subtasks ────────────────────────────────────────────────────────

export async function listSubtasks(req: Request, res: Response) {
  try {
    const taskId = req.params.id as string;
    const subtasks = await workService.listSubtasks(taskId);
    res.json({ success: true, data: subtasks });
  } catch (error) {
    logger.error({ error }, 'Failed to list subtasks');
    res.status(500).json({ success: false, error: 'Failed to list subtasks' });
  }
}

export async function createSubtask(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create subtasks' });
      return;
    }

    const userId = req.auth!.userId;
    const taskId = req.params.id as string;
    const { title } = req.body;
    const subtask = await workService.createSubtask(userId, taskId, title || '');
    res.json({ success: true, data: subtask });
  } catch (error) {
    logger.error({ error }, 'Failed to create subtask');
    res.status(500).json({ success: false, error: 'Failed to create subtask' });
  }
}

export async function updateSubtask(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update subtasks' });
      return;
    }

    const userId = req.auth!.userId;
    const subtaskId = req.params.subtaskId as string;
    const { title, isCompleted } = req.body;
    const subtask = await workService.updateSubtask(userId, subtaskId, { title, isCompleted });
    if (!subtask) { res.status(404).json({ success: false, error: 'Subtask not found' }); return; }
    res.json({ success: true, data: subtask });
  } catch (error) {
    logger.error({ error }, 'Failed to update subtask');
    res.status(500).json({ success: false, error: 'Failed to update subtask' });
  }
}

export async function deleteSubtask(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete' });
      return;
    }

    const userId = req.auth!.userId;
    const subtaskId = req.params.subtaskId as string;

    const subtask = await workService.getSubtaskById(subtaskId);
    if (!subtask) {
      res.status(404).json({ success: false, error: 'Subtask not found' });
      return;
    }
    const parentTask = await workService.getTask(userId, subtask.taskId);
    if (!parentTask) {
      res.status(404).json({ success: false, error: 'Subtask not found' });
      return;
    }
    if (!assertCanDelete(res, perm.role, parentTask.userId, userId)) return;

    await workService.deleteSubtask(subtaskId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete subtask');
    res.status(500).json({ success: false, error: 'Failed to delete subtask' });
  }
}

export async function reorderSubtasks(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to reorder subtasks' });
      return;
    }

    const taskId = req.params.id as string;
    const { subtaskIds } = req.body;
    await workService.reorderSubtasks(taskId, subtaskIds);
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
    const activities = await workService.listActivities(taskId);
    res.json({ success: true, data: activities });
  } catch (error) {
    logger.error({ error }, 'Failed to list activities');
    res.status(500).json({ success: false, error: 'Failed to list activities' });
  }
}

// ─── Templates ───────────────────────────────────────────────────────

export async function listTemplates(req: Request, res: Response) {
  try {
    const templates = await workService.listTemplates(req.auth!.userId);
    res.json({ success: true, data: templates });
  } catch (error) {
    logger.error({ error }, 'Failed to list templates');
    res.status(500).json({ success: false, error: 'Failed to list templates' });
  }
}

export async function createTemplate(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create templates' });
      return;
    }

    const template = await workService.createTemplate(req.auth!.userId, req.auth!.tenantId, req.body);
    res.json({ success: true, data: template });
  } catch (error) {
    logger.error({ error }, 'Failed to create template');
    res.status(500).json({ success: false, error: 'Failed to create template' });
  }
}

export async function updateTemplate(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update templates' });
      return;
    }

    const template = await workService.updateTemplate(req.auth!.userId, req.params.templateId as string, req.body);
    if (!template) { res.status(404).json({ success: false, error: 'Template not found' }); return; }
    res.json({ success: true, data: template });
  } catch (error) {
    logger.error({ error }, 'Failed to update template');
    res.status(500).json({ success: false, error: 'Failed to update template' });
  }
}

export async function deleteTemplate(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete' });
      return;
    }

    const userId = req.auth!.userId;
    const templateId = req.params.templateId as string;

    const existing = await workService.getTemplateById(templateId);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Template not found' });
      return;
    }
    if (!assertCanDelete(res, perm.role, existing.userId, userId)) return;

    await workService.deleteTemplateById(templateId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete template');
    res.status(500).json({ success: false, error: 'Failed to delete template' });
  }
}

export async function createTaskFromTemplate(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create tasks' });
      return;
    }

    const task = await workService.createTaskFromTemplate(req.auth!.userId, req.auth!.tenantId, req.params.templateId as string);
    if (!task) { res.status(404).json({ success: false, error: 'Template not found' }); return; }
    res.json({ success: true, data: task });
  } catch (error) {
    logger.error({ error }, 'Failed to create task from template');
    res.status(500).json({ success: false, error: 'Failed to create task from template' });
  }
}

// ─── Task Comments ─────────────────────────────────────────────────

export async function listComments(req: Request, res: Response) {
  try {
    const taskId = req.params.taskId as string;
    const comments = await workService.listComments(taskId);
    res.json({ success: true, data: comments });
  } catch (error) {
    logger.error({ error }, 'Failed to list task comments');
    res.status(500).json({ success: false, error: 'Failed to list task comments' });
  }
}

export async function createComment(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create comments' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const taskId = req.params.taskId as string;
    const { body } = req.body;

    if (!body || !body.trim()) {
      res.status(400).json({ success: false, error: 'Comment body is required' });
      return;
    }

    const comment = await workService.createComment(userId, tenantId, taskId, body.trim());
    res.json({ success: true, data: comment });

    if (req.auth?.tenantId) {
      parseMentionsAndNotify({
        body: body.trim(),
        tenantId: req.auth.tenantId,
        authorUserId: userId,
        authorName: comment.userName || comment.userEmail || 'Someone',
        sourceApp: 'work',
        sourceRecordId: taskId,
      }).catch(() => {});
    }
  } catch (error) {
    logger.error({ error }, 'Failed to create task comment');
    res.status(500).json({ success: false, error: 'Failed to create task comment' });
  }
}

export async function deleteComment(req: Request, res: Response) {
  try {
    if (!canAccess(req.workPerm!.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    const userId = req.auth!.userId;
    const commentId = req.params.commentId as string;

    const deleted = await workService.deleteComment(userId, commentId);
    if (!deleted) {
      res.status(403).json({ success: false, error: 'Comment not found or not authorized to delete' });
      return;
    }

    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete task comment');
    res.status(500).json({ success: false, error: 'Failed to delete task comment' });
  }
}

// ─── Task Attachments ─────────────────────────────────────────────

export async function listAttachments(req: Request, res: Response) {
  try {
    const taskId = req.params.taskId as string;
    const attachments = await workService.listAttachments(taskId);
    res.json({ success: true, data: attachments });
  } catch (error) {
    logger.error({ error }, 'Failed to list task attachments');
    res.status(500).json({ success: false, error: 'Failed to list task attachments' });
  }
}

export async function uploadAttachment(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to upload attachments' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const taskId = req.params.taskId as string;
    const file = req.file;

    if (!file) {
      res.status(400).json({ success: false, error: 'No file provided' });
      return;
    }

    const attachment = await workService.addAttachment(userId, tenantId, taskId, file as any);
    res.json({ success: true, data: attachment });
  } catch (error) {
    logger.error({ error }, 'Failed to upload task attachment');
    res.status(500).json({ success: false, error: 'Failed to upload task attachment' });
  }
}

export async function deleteAttachment(req: Request, res: Response) {
  try {
    if (!canAccess(req.workPerm!.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    const userId = req.auth!.userId;
    const attachmentId = req.params.attachmentId as string;

    const deleted = await workService.deleteAttachment(userId, attachmentId);
    if (!deleted) {
      res.status(403).json({ success: false, error: 'Attachment not found or not authorized to delete' });
      return;
    }

    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete task attachment');
    res.status(500).json({ success: false, error: 'Failed to delete task attachment' });
  }
}

export async function downloadAttachment(req: Request, res: Response) {
  try {
    const attachmentId = req.params.attachmentId as string;
    const attachment = await workService.getAttachment(attachmentId);

    if (!attachment) {
      res.status(404).json({ success: false, error: 'Attachment not found' });
      return;
    }

    const filePath = require('path').join(__dirname, '../../../../../uploads', attachment.storagePath);
    if (!require('fs').existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'File not found on disk' });
      return;
    }

    res.download(filePath, attachment.fileName);
  } catch (error) {
    logger.error({ error }, 'Failed to download task attachment');
    res.status(500).json({ success: false, error: 'Failed to download task attachment' });
  }
}

// ─── Task Dependencies ────────────────────────────────────────────

export async function listDependencies(req: Request, res: Response) {
  try {
    const taskId = req.params.taskId as string;
    const deps = await workService.listDependencies(taskId);
    res.json({ success: true, data: deps });
  } catch (error) {
    logger.error({ error }, 'Failed to list task dependencies');
    res.status(500).json({ success: false, error: 'Failed to list task dependencies' });
  }
}

export async function addDependency(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to add dependencies' });
      return;
    }

    const taskId = req.params.taskId as string;
    const { blockedByTaskId } = req.body;

    if (!blockedByTaskId) {
      res.status(400).json({ success: false, error: 'blockedByTaskId is required' });
      return;
    }

    const dep = await workService.addDependency(taskId, blockedByTaskId);
    res.json({ success: true, data: dep });
  } catch (error: any) {
    if (error.message?.includes('Circular dependency') || error.message?.includes('cannot block itself')) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    if (error.code === '23505') {
      res.status(409).json({ success: false, error: 'This dependency already exists' });
      return;
    }
    logger.error({ error }, 'Failed to add task dependency');
    res.status(500).json({ success: false, error: 'Failed to add task dependency' });
  }
}

export async function removeDependency(req: Request, res: Response) {
  try {
    const perm = req.workPerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to remove dependencies' });
      return;
    }

    const taskId = req.params.taskId as string;
    const blockerTaskId = req.params.blockerTaskId as string;

    await workService.removeDependency(taskId, blockerTaskId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to remove task dependency');
    res.status(500).json({ success: false, error: 'Failed to remove task dependency' });
  }
}

export async function getBlockedTaskIds(req: Request, res: Response) {
  try {
    const ids = await workService.getBlockedTaskIds(req.auth!.userId);
    res.json({ success: true, data: ids });
  } catch (error) {
    logger.error({ error }, 'Failed to get blocked task IDs');
    res.status(500).json({ success: false, error: 'Failed to get blocked task IDs' });
  }
}
