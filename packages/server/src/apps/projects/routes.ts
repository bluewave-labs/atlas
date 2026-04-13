import { Router, Request, Response, NextFunction } from 'express';
import * as projectsController from './controller';
import { authMiddleware } from '../../middleware/auth';
import { requireAppPermission } from '../../middleware/require-app-permission';
import { withConcurrencyCheck } from '../../middleware/concurrency-check';
import { projectProjects, projectTimeEntries } from '../../db/schema';
import { isTenantAdmin } from '@atlas-platform/shared';

function requireSeedAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isTenantAdmin(req.auth?.tenantRole)) {
    res.status(403).json({ success: false, error: 'Only organization admins can seed demo data' });
    return;
  }
  next();
}

const router = Router();

// ─── All routes require auth ──────────────────────────────────────
router.use(authMiddleware);
router.use(requireAppPermission('projects'));

// Widget (lightweight summary for home dashboard)
router.get('/widget', projectsController.getWidgetData);

// Dashboard (rich data for in-app dashboard view)
router.get('/dashboard', projectsController.getDashboardData);

// Projects
router.get('/projects/list', projectsController.listProjects);
router.post('/projects', projectsController.createProject);
router.get('/projects/:id', projectsController.getProject);
router.patch('/projects/:id', withConcurrencyCheck(projectProjects), projectsController.updateProject);
router.delete('/projects/:id', projectsController.deleteProject);

// Members
router.get('/projects/:projectId/members', projectsController.listProjectMembers);
router.post('/projects/:projectId/members', projectsController.addProjectMember);
router.delete('/projects/:projectId/members/:memberId', projectsController.removeProjectMember);
router.patch('/projects/:projectId/members/:memberId', projectsController.updateProjectMemberRate);

// Time Entries
router.get('/time-entries/list', projectsController.listTimeEntries);
router.get('/time-entries/weekly', projectsController.getWeeklyView);
router.post('/time-entries/bulk-lock', projectsController.bulkLockEntries);
router.post('/time-entries/bulk', projectsController.bulkSaveTimeEntries);
router.post('/time-entries/copy-last-week', projectsController.copyLastWeek);
router.post('/time-entries', projectsController.createTimeEntry);
router.get('/time-entries/:id', projectsController.getTimeEntry);
router.patch('/time-entries/:id', withConcurrencyCheck(projectTimeEntries), projectsController.updateTimeEntry);
router.delete('/time-entries/:id', projectsController.deleteTimeEntry);

// Time Billing (populate invoices from time entries)
router.post('/time-billing/preview', projectsController.previewTimeBillingLineItems);
router.post('/time-billing/populate', projectsController.populateTimeBilling);

// Reports
router.get('/reports/time', projectsController.getTimeReport);
router.get('/reports/revenue', projectsController.getRevenueReport);
router.get('/reports/profitability', projectsController.getProjectProfitability);
router.get('/reports/utilization', projectsController.getTeamUtilization);

// Rates
router.get('/rates', projectsController.listRates);
router.post('/rates', projectsController.createRate);
router.patch('/rates/:id', projectsController.updateRate);
router.delete('/rates/:id', projectsController.deleteRate);

// Settings
router.get('/settings', projectsController.getSettings);
router.patch('/settings', projectsController.updateSettings);

// Seed
router.post('/seed', requireSeedAdmin, projectsController.seedSampleData);

export default router;
