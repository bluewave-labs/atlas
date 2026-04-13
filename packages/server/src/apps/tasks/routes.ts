import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import * as taskController from './controller';
import { authMiddleware } from '../../middleware/auth';
import { requireAppPermission } from '../../middleware/require-app-permission';
import { withConcurrencyCheck } from '../../middleware/concurrency-check';
import { tasks, taskProjects } from '../../db/schema';
import { isTenantAdmin } from '@atlas-platform/shared';

function requireSeedAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isTenantAdmin(req.auth?.tenantRole)) {
    res.status(403).json({ success: false, error: 'Only organization admins can seed demo data' });
    return;
  }
  next();
}

const uploadsDir = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const userId = (_req as any).auth?.userId || 'anon';
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `task_${userId}_${timestamp}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB per file
});

function handleMulterError(err: any, _req: Request, res: Response, next: NextFunction) {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ success: false, error: 'File too large. Maximum size is 50 MB.' });
      return;
    }
    res.status(400).json({ success: false, error: err.message });
    return;
  }
  if (err) {
    res.status(500).json({ success: false, error: 'Upload failed' });
    return;
  }
  next();
}

const router = Router();
router.use(authMiddleware);
router.use(requireAppPermission('tasks'));

// Widget (lightweight summary for home dashboard)
router.get('/widget', taskController.getWidgetData);

// Templates (must be before /:id to avoid route conflicts)
router.get('/templates/list', taskController.listTemplates);
router.post('/templates', taskController.createTemplate);
router.patch('/templates/:templateId', taskController.updateTemplate);
router.delete('/templates/:templateId', taskController.deleteTemplate);

// Email-to-task (must be before /:id to avoid route conflicts)
router.post('/from-email', taskController.createTaskFromEmail);
router.post('/from-template/:templateId', taskController.createTaskFromTemplate);

// Comment standalone routes (must be before /:id to avoid route conflicts)
router.delete('/comments/:commentId', taskController.deleteComment);

// Attachment standalone routes (must be before /:id to avoid route conflicts)
router.delete('/attachments/:attachmentId', taskController.deleteAttachment);
router.get('/attachments/:attachmentId/download', taskController.downloadAttachment);

// Blocked task IDs (for showing blocked badges)
router.get('/blocked-ids', taskController.getBlockedTaskIds);

// Subtask standalone routes (must be before /:id to avoid route conflicts)
router.patch('/subtasks/:subtaskId', taskController.updateSubtask);
router.delete('/subtasks/:subtaskId', taskController.deleteSubtask);

// Tasks
router.get('/', taskController.listTasks);
router.post('/', taskController.createTask);
router.get('/search', taskController.searchTasks);
router.get('/counts', taskController.getTaskCounts);
router.patch('/reorder', taskController.reorderTasks);
router.get('/:id', taskController.getTask);
router.patch('/:id', withConcurrencyCheck(tasks), taskController.updateTask);
router.patch('/:id/visibility', taskController.updateTaskVisibility);
router.delete('/:id', taskController.deleteTask);
router.patch('/:id/restore', taskController.restoreTask);

// Seed sample data
router.post('/seed', requireSeedAdmin, taskController.seedSampleTasks);

// Projects
router.get('/projects/list', taskController.listProjects);
router.post('/projects', taskController.createProject);
router.patch('/projects/:id', withConcurrencyCheck(taskProjects), taskController.updateProject);
router.patch('/projects/:id/visibility', taskController.updateProjectVisibility);
router.delete('/projects/:id', taskController.deleteProject);

// Subtasks (nested under task)
router.get('/:id/subtasks', taskController.listSubtasks);
router.post('/:id/subtasks', taskController.createSubtask);
router.patch('/:id/subtasks/reorder', taskController.reorderSubtasks);

// Comments (nested under task)
router.get('/:taskId/comments', taskController.listComments);
router.post('/:taskId/comments', taskController.createComment);

// Activities
router.get('/:id/activities', taskController.listActivities);

// Attachments (nested under task)
router.get('/:taskId/attachments', taskController.listAttachments);
router.post('/:taskId/attachments', upload.single('file'), handleMulterError, taskController.uploadAttachment);

// Dependencies (nested under task)
router.get('/:taskId/dependencies', taskController.listDependencies);
router.post('/:taskId/dependencies', taskController.addDependency);
router.delete('/:taskId/dependencies/:blockerTaskId', taskController.removeDependency);

export default router;
