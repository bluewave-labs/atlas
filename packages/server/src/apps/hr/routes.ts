import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import * as hrController from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();
router.use(authMiddleware);

// File upload config for employee documents
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../../uploads/hr'),
  filename: (_req, file, cb) => {
    const userId = (_req as any).auth?.userId || 'anon';
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${userId}_${timestamp}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

// Widget (lightweight summary for home dashboard)
router.get('/widget', hrController.getWidgetData);

// Dashboard
router.get('/dashboard', hrController.getDashboard);

// Leave Types (before /:id to avoid route conflicts)
router.get('/leave-types', hrController.listLeaveTypes);
router.post('/leave-types', hrController.createLeaveType);
router.patch('/leave-types/:id', hrController.updateLeaveType);
router.delete('/leave-types/:id', hrController.deleteLeaveType);

// Seed leave defaults (before /:id)
router.post('/leave-types/seed', hrController.seedLeaveTypes);
router.post('/leave-policies/seed', hrController.seedLeavePolicies);

// Leave Policies (before /:id)
router.get('/leave-policies', hrController.listLeavePolicies);
router.post('/leave-policies', hrController.createLeavePolicy);
router.patch('/leave-policies/:id', hrController.updateLeavePolicy);
router.delete('/leave-policies/:id', hrController.deleteLeavePolicy);

// Holiday Calendars (before /:id)
router.get('/holiday-calendars', hrController.listHolidayCalendars);
router.post('/holiday-calendars', hrController.createHolidayCalendar);
router.patch('/holiday-calendars/:id', hrController.updateHolidayCalendar);
router.delete('/holiday-calendars/:id', hrController.deleteHolidayCalendar);
router.get('/holiday-calendars/:id/holidays', hrController.listHolidays);

// Holidays (before /:id)
router.post('/holidays', hrController.createHoliday);
router.patch('/holidays/:id', hrController.updateHoliday);
router.delete('/holidays/:id', hrController.deleteHoliday);

// Working days calculator
router.get('/working-days', hrController.getWorkingDays);

// Leave Applications (before /:id)
router.get('/leave-applications', hrController.listLeaveApplications);
router.post('/leave-applications', hrController.createLeaveApplication);
router.get('/leave-applications/pending', hrController.getPendingApprovals);
router.patch('/leave-applications/:id', hrController.updateLeaveApplication);
router.post('/leave-applications/:id/submit', hrController.submitLeaveApplication);
router.post('/leave-applications/:id/approve', hrController.approveLeaveApplication);
router.post('/leave-applications/:id/reject', hrController.rejectLeaveApplication);
router.post('/leave-applications/:id/cancel', hrController.cancelLeaveApplication);

// Leave Calendar
router.get('/leave-calendar', hrController.getLeaveCalendar);

// Attendance (before /:id)
router.get('/attendance', hrController.listAttendance);
router.post('/attendance', hrController.markAttendance);
router.post('/attendance/bulk', hrController.bulkMarkAttendance);
router.get('/attendance/today', hrController.getAttendanceToday);
router.get('/attendance/report', hrController.getAttendanceReport);
router.patch('/attendance/:id', hrController.updateAttendanceRecord);

// Lifecycle events (before /:id)
router.delete('/lifecycle/:id', hrController.deleteLifecycleEvent);

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

// Leave balances summary (before /:id)
router.get('/leave-balances/summary', hrController.getLeaveBalancesSummary);

// Onboarding templates (before /:id)
router.get('/onboarding-templates', hrController.listOnboardingTemplates);
router.post('/onboarding-templates', hrController.createOnboardingTemplate);

// Onboarding task updates (before /:id)
router.patch('/onboarding/:taskId', hrController.updateOnboardingTask);
router.delete('/onboarding/:taskId', hrController.deleteOnboardingTask);

// Employee documents (before /:id)
router.delete('/documents/:docId', hrController.deleteEmployeeDocument);
router.get('/documents/:docId/download', hrController.downloadEmployeeDocument);

// Employees
router.get('/', hrController.listEmployees);
router.post('/', hrController.createEmployee);
router.get('/search', hrController.searchEmployees);
router.get('/counts', hrController.getEmployeeCounts);
router.get('/:id', hrController.getEmployee);
router.patch('/:id', hrController.updateEmployee);
router.delete('/:id', hrController.deleteEmployee);

// Employee leave balances
router.get('/:id/leave-balances', hrController.getLeaveBalances);
router.post('/:id/leave-balances', hrController.allocateLeave);

// Employee policy assignment
router.post('/:id/assign-policy', hrController.assignPolicyToEmployee);
router.get('/:id/policy', hrController.getEmployeePolicy);

// Employee lifecycle
router.get('/:id/lifecycle', hrController.getLifecycleTimeline);
router.post('/:id/lifecycle', hrController.createLifecycleEventHandler);

// Employee attendance
router.get('/:id/attendance', hrController.getEmployeeAttendance);

// Employee onboarding
router.get('/:id/onboarding', hrController.listOnboardingTasks);
router.post('/:id/onboarding', hrController.createOnboardingTask);
router.post('/:id/onboarding/from-template', hrController.createTasksFromTemplate);

// Employee documents
router.get('/:id/documents', hrController.listEmployeeDocuments);
router.post('/:id/documents', upload.single('file'), hrController.uploadEmployeeDocument);

// Seed sample data
router.post('/seed', hrController.seedSampleData);

export default router;
