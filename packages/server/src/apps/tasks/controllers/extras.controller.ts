import type { Request, Response } from 'express';
import * as taskService from '../service';
import { logger } from '../../../utils/logger';
import { getAppPermission, canAccess } from '../../../services/app-permissions.service';
import { parseMentionsAndNotify } from '../../../utils/mentions';

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

    const template = await taskService.createTemplate(req.auth!.userId, req.auth!.tenantId, req.body);
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

    const task = await taskService.createTaskFromTemplate(req.auth!.userId, req.auth!.tenantId, req.params.templateId as string);
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
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view comments' });
      return;
    }

    const taskId = req.params.taskId as string;
    const comments = await taskService.listComments(taskId);
    res.json({ success: true, data: comments });
  } catch (error) {
    logger.error({ error }, 'Failed to list task comments');
    res.status(500).json({ success: false, error: 'Failed to list task comments' });
  }
}

export async function createComment(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
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

    const comment = await taskService.createComment(userId, tenantId, taskId, body.trim());
    res.json({ success: true, data: comment });

    if (req.auth?.tenantId) {
      parseMentionsAndNotify({
        body: body.trim(),
        tenantId: req.auth.tenantId,
        authorUserId: userId,
        authorName: comment.userName || comment.userEmail || 'Someone',
        sourceApp: 'tasks',
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
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission' });
      return;
    }

    const userId = req.auth!.userId;
    const commentId = req.params.commentId as string;

    const deleted = await taskService.deleteComment(userId, commentId);
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
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view attachments' });
      return;
    }

    const taskId = req.params.taskId as string;
    const attachments = await taskService.listAttachments(taskId);
    res.json({ success: true, data: attachments });
  } catch (error) {
    logger.error({ error }, 'Failed to list task attachments');
    res.status(500).json({ success: false, error: 'Failed to list task attachments' });
  }
}

export async function uploadAttachment(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
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

    const attachment = await taskService.addAttachment(userId, tenantId, taskId, file as any);
    res.json({ success: true, data: attachment });
  } catch (error) {
    logger.error({ error }, 'Failed to upload task attachment');
    res.status(500).json({ success: false, error: 'Failed to upload task attachment' });
  }
}

export async function deleteAttachment(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission' });
      return;
    }

    const userId = req.auth!.userId;
    const attachmentId = req.params.attachmentId as string;

    const deleted = await taskService.deleteAttachment(userId, attachmentId);
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
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission' });
      return;
    }

    const attachmentId = req.params.attachmentId as string;
    const attachment = await taskService.getAttachment(attachmentId);

    if (!attachment) {
      res.status(404).json({ success: false, error: 'Attachment not found' });
      return;
    }

    const filePath = require('path').join(__dirname, '../../../../uploads', attachment.storagePath);
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
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view dependencies' });
      return;
    }

    const taskId = req.params.taskId as string;
    const deps = await taskService.listDependencies(taskId);
    res.json({ success: true, data: deps });
  } catch (error) {
    logger.error({ error }, 'Failed to list task dependencies');
    res.status(500).json({ success: false, error: 'Failed to list task dependencies' });
  }
}

export async function addDependency(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
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

    const dep = await taskService.addDependency(taskId, blockedByTaskId);
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
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to remove dependencies' });
      return;
    }

    const taskId = req.params.taskId as string;
    const blockerTaskId = req.params.blockerTaskId as string;

    await taskService.removeDependency(taskId, blockerTaskId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to remove task dependency');
    res.status(500).json({ success: false, error: 'Failed to remove task dependency' });
  }
}

export async function getBlockedTaskIds(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tasks');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission' });
      return;
    }

    const ids = await taskService.getBlockedTaskIds(req.auth!.userId);
    res.json({ success: true, data: ids });
  } catch (error) {
    logger.error({ error }, 'Failed to get blocked task IDs');
    res.status(500).json({ success: false, error: 'Failed to get blocked task IDs' });
  }
}
