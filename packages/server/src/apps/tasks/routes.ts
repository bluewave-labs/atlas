import { Router } from 'express';
import * as taskController from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();
router.use(authMiddleware);

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
router.patch('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);
router.patch('/:id/restore', taskController.restoreTask);

// Seed sample data
router.post('/seed', taskController.seedSampleTasks);

// Projects
router.get('/projects/list', taskController.listProjects);
router.post('/projects', taskController.createProject);
router.patch('/projects/:id', taskController.updateProject);
router.delete('/projects/:id', taskController.deleteProject);

// Subtasks (nested under task)
router.get('/:id/subtasks', taskController.listSubtasks);
router.post('/:id/subtasks', taskController.createSubtask);
router.patch('/:id/subtasks/reorder', taskController.reorderSubtasks);

// Activities
router.get('/:id/activities', taskController.listActivities);

export default router;
