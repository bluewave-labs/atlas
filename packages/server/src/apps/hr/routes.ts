import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import * as hrController from './controller';
import { authMiddleware } from '../../middleware/auth';
import { requireAppPermission } from '../../middleware/require-app-permission';
import { withConcurrencyCheck } from '../../middleware/concurrency-check';
import { employees } from '../../db/schema';
import { isTenantAdmin } from '@atlas-platform/shared';

function requireSeedAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isTenantAdmin(req.auth?.tenantRole)) {
    res.status(403).json({ success: false, error: 'Only organization admins can seed demo data' });
    return;
  }
  next();
}

const router = Router();
router.use(authMiddleware);
router.use(requireAppPermission('hr'));

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
router.post('/leave-types/seed', requireSeedAdmin, hrController.seedLeaveTypes);
router.post('/leave-policies/seed', requireSeedAdmin, hrController.seedLeavePolicies);

// Leave Policies (before /:id)
router.get('/leave-policies', hrController.listLeavePolicies);
router.post('/leave-policies', hrController.createLeavePolicy);
router.patch('/leave-policies/:id', hrController.updateLeavePolicy);
router.post('/leave-policies/:id/resync', hrController.resyncPolicyBalances);
router.delete('/leave-policies/:id', hrController.deleteLeavePolicy);

// Holiday Calendars (before /:id)
router.get('/holiday-calendars', hrController.listHolidayCalendars);
router.post('/holiday-calendars', hrController.createHolidayCalendar);
router.patch('/holiday-calendars/:id', hrController.updateHolidayCalendar);
router.delete('/holiday-calendars/:id', hrController.deleteHolidayCalendar);
router.get('/holiday-calendars/:id/holidays', hrController.listHolidays);

// Holidays (before /:id)
router.post('/holidays', hrController.createHoliday);
router.post('/holidays/bulk-import', hrController.bulkImportHolidays);
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
router.post('/leave-balances/allocate', hrController.triggerBalanceAllocation);

// Onboarding templates (before /:id)
router.get('/onboarding-templates', hrController.listOnboardingTemplates);
router.post('/onboarding-templates', hrController.createOnboardingTemplate);

// Onboarding task updates (before /:id)
router.patch('/onboarding/:taskId', hrController.updateOnboardingTask);
router.delete('/onboarding/:taskId', hrController.deleteOnboardingTask);

// Employee documents (before /:id)
router.delete('/documents/:docId', hrController.deleteEmployeeDocument);
router.get('/documents/:docId/download', hrController.downloadEmployeeDocument);

// ─── Expense Categories ─────────────────────────────────────────
router.get('/expense-categories/list', hrController.listExpenseCategories);
router.post('/expense-categories', hrController.createExpenseCategory);
router.post('/expense-categories/seed', requireSeedAdmin, hrController.seedExpenseCategories);
router.post('/expense-categories/reorder', hrController.reorderExpenseCategories);
router.patch('/expense-categories/:id', hrController.updateExpenseCategory);
router.delete('/expense-categories/:id', hrController.deleteExpenseCategory);

// ─── Expense Policies ───────────────────────────────────────────
router.get('/expense-policies/list', hrController.listExpensePolicies);
router.post('/expense-policies', hrController.createExpensePolicy);
router.get('/expense-policies/:id', hrController.getExpensePolicy);
router.patch('/expense-policies/:id', hrController.updateExpensePolicy);
router.delete('/expense-policies/:id', hrController.deleteExpensePolicy);
router.post('/expense-policies/:id/assign', hrController.assignPolicy);
router.delete('/expense-policies/:id/assign/:assignmentId', hrController.removeAssignment);

// ─── Expenses ───────────────────────────────────────────────────
router.get('/expenses/list', hrController.listExpenses);
router.get('/expenses/my', hrController.listMyExpenses);
router.get('/expenses/pending', hrController.getPendingExpenses);
router.get('/expenses/pending/count', hrController.getPendingExpenseCount);
router.get('/expenses/dashboard', hrController.getExpenseDashboard);
router.post('/expenses', hrController.createExpense);
router.post('/expenses/bulk-pay', hrController.bulkPayExpenses);
router.get('/expenses/:id', hrController.getExpense);
router.patch('/expenses/:id', hrController.updateExpense);
router.delete('/expenses/:id', hrController.deleteExpense);
router.post('/expenses/:id/submit', hrController.submitExpense);
router.post('/expenses/:id/recall', hrController.recallExpense);
router.post('/expenses/:id/approve', hrController.approveExpense);
router.post('/expenses/:id/refuse', hrController.refuseExpense);

// ─── Expense Reports ────────────────────────────────────────────
router.get('/expense-reports/list', hrController.listExpenseReports);
router.get('/expense-reports/my', hrController.listMyExpenseReports);
router.post('/expense-reports', hrController.createExpenseReport);
router.get('/expense-reports/:id', hrController.getExpenseReport);
router.patch('/expense-reports/:id', hrController.updateExpenseReport);
router.delete('/expense-reports/:id', hrController.deleteExpenseReport);
router.post('/expense-reports/:id/submit', hrController.submitExpenseReport);
router.post('/expense-reports/:id/approve', hrController.approveExpenseReport);
router.post('/expense-reports/:id/refuse', hrController.refuseExpenseReport);

// Employees
router.get('/', hrController.listEmployees);
router.post('/', hrController.createEmployee);
router.get('/search', hrController.searchEmployees);
router.get('/counts', hrController.getEmployeeCounts);
router.get('/:id', hrController.getEmployee);
router.patch('/:id', withConcurrencyCheck(employees), hrController.updateEmployee);
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
router.post('/seed', requireSeedAdmin, hrController.seedSampleData);

export default router;
