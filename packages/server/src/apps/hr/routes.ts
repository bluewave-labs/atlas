import { Router } from 'express';
import * as hrController from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Departments (before /:id to avoid route conflicts)
router.get('/departments/list', hrController.listDepartments);
router.post('/departments', hrController.createDepartment);
router.patch('/departments/:id', hrController.updateDepartment);
router.delete('/departments/:id', hrController.deleteDepartment);

// Time Off (before /:id to avoid route conflicts)
router.get('/time-off/list', hrController.listTimeOffRequests);
router.post('/time-off', hrController.createTimeOffRequest);
router.patch('/time-off/:id', hrController.updateTimeOffRequest);
router.delete('/time-off/:id', hrController.deleteTimeOffRequest);

// Employees
router.get('/', hrController.listEmployees);
router.post('/', hrController.createEmployee);
router.get('/search', hrController.searchEmployees);
router.get('/counts', hrController.getEmployeeCounts);
router.get('/:id', hrController.getEmployee);
router.patch('/:id', hrController.updateEmployee);
router.delete('/:id', hrController.deleteEmployee);

// Seed sample data
router.post('/seed', hrController.seedSampleData);

export default router;
