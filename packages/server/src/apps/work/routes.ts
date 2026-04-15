import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { requireAppPermission } from '../../middleware/require-app-permission';
import { withConcurrencyCheck } from '../../middleware/concurrency-check';
import { tasks, projectProjects } from '../../db/schema';
import * as controller from './controller';

const router = Router();

router.use(authMiddleware);
router.use(requireAppPermission('work'));

// Tasks
router.get('/tasks', controller.listTasks);
router.post('/tasks', controller.createTask);
router.get('/tasks/search', controller.searchTasks);
router.get('/tasks/counts', controller.getTaskCounts);
router.get('/tasks/blocked', controller.getBlockedTaskIds);
router.get('/tasks/:id', controller.getTask);
router.patch('/tasks/:id', withConcurrencyCheck(tasks), controller.updateTask);
router.delete('/tasks/:id', controller.deleteTask);

// Task subtasks
router.get('/tasks/:id/subtasks', controller.listSubtasks);
router.post('/tasks/:id/subtasks', controller.createSubtask);
router.patch('/tasks/:id/subtasks/:subtaskId', controller.updateSubtask);
router.delete('/tasks/:id/subtasks/:subtaskId', controller.deleteSubtask);
router.post('/tasks/:id/subtasks/reorder', controller.reorderSubtasks);

// Task activities
router.get('/tasks/:id/activities', controller.listActivities);

// Task comments
router.get('/tasks/:taskId/comments', controller.listComments);
router.post('/tasks/:taskId/comments', controller.createComment);
router.delete('/tasks/:taskId/comments/:commentId', controller.deleteComment);

// Task attachments
router.get('/tasks/:taskId/attachments', controller.listAttachments);
router.post('/tasks/:taskId/attachments', controller.uploadAttachment);
router.get('/tasks/:taskId/attachments/:attachmentId/download', controller.downloadAttachment);
router.delete('/tasks/:taskId/attachments/:attachmentId', controller.deleteAttachment);

// Task dependencies
router.get('/tasks/:taskId/dependencies', controller.listDependencies);
router.post('/tasks/:taskId/dependencies', controller.addDependency);
router.delete('/tasks/:taskId/dependencies/:blockerTaskId', controller.removeDependency);

// Task templates
router.get('/templates', controller.listTemplates);
router.post('/templates', controller.createTemplate);
router.patch('/templates/:templateId', controller.updateTemplate);
router.delete('/templates/:templateId', controller.deleteTemplate);
router.post('/templates/:templateId/use', controller.createTaskFromTemplate);

// Dashboard
router.get('/projects/dashboard', controller.getDashboard);

// Projects
router.get('/projects', controller.listProjects);
router.post('/projects', controller.createProject);
router.get('/projects/:id', controller.getProject);
router.patch('/projects/:id', withConcurrencyCheck(projectProjects), controller.updateProject);
router.delete('/projects/:id', controller.deleteProject);

// Project members
router.get('/projects/:id/members', controller.listProjectMembers);
router.post('/projects/:id/members', controller.addProjectMember);
router.delete('/projects/:id/members/:memberId', controller.removeProjectMember);

// Project time entries
router.get('/projects/:id/time-entries', controller.listProjectTimeEntries);
router.post('/projects/:id/time-entries', controller.createProjectTimeEntry);
router.patch('/projects/:id/time-entries/:entryId', controller.updateProjectTimeEntry);
router.delete('/projects/:id/time-entries/:entryId', controller.deleteProjectTimeEntry);

// Project files and financials
router.get('/projects/:id/files', controller.listProjectFiles);
router.get('/projects/:id/financials', controller.getProjectFinancials);

export default router;
