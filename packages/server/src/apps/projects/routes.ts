import { Router } from 'express';
import * as projectsController from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

// ─── Portal routes (public, no auth) ───────────────────────────────
router.get('/portal/:token', projectsController.portalGetClient);
router.get('/portal/:token/invoices', projectsController.portalListInvoices);
router.get('/portal/:token/invoices/:invoiceId', projectsController.portalGetInvoiceDetail);

// ─── All other routes require auth ─────────────────────────────────
router.use(authMiddleware);

// Widget (lightweight summary for home dashboard)
router.get('/widget', projectsController.getWidgetData);

// Dashboard (rich data for in-app dashboard view)
router.get('/dashboard', projectsController.getDashboardData);

// Clients
router.get('/clients/list', projectsController.listClients);
router.post('/clients', projectsController.createClient);
router.get('/clients/:id', projectsController.getClient);
router.patch('/clients/:id', projectsController.updateClient);
router.delete('/clients/:id', projectsController.deleteClient);
router.post('/clients/:id/regenerate-token', projectsController.regeneratePortalToken);

// Projects
router.get('/projects/list', projectsController.listProjects);
router.post('/projects', projectsController.createProject);
router.get('/projects/:id', projectsController.getProject);
router.patch('/projects/:id', projectsController.updateProject);
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
router.patch('/time-entries/:id', projectsController.updateTimeEntry);
router.delete('/time-entries/:id', projectsController.deleteTimeEntry);

// Invoices
router.post('/invoices/populate-from-time', projectsController.previewTimeEntryLineItems);
router.get('/invoices/list', projectsController.listInvoices);
router.get('/invoices/next-number', projectsController.getNextInvoiceNumber);
router.post('/invoices', projectsController.createInvoice);
router.get('/invoices/:id', projectsController.getInvoice);
router.patch('/invoices/:id', projectsController.updateInvoice);
router.delete('/invoices/:id', projectsController.deleteInvoice);
router.post('/invoices/:id/send', projectsController.sendInvoice);
router.post('/invoices/:id/paid', projectsController.markInvoicePaid);
router.post('/invoices/:id/duplicate', projectsController.duplicateInvoice);
router.post('/invoices/:id/waive', projectsController.waiveInvoice);

// Line Items
router.get('/invoices/:invoiceId/line-items', projectsController.listLineItems);
router.post('/invoices/:invoiceId/line-items', projectsController.createLineItem);
router.post('/invoices/:invoiceId/populate', projectsController.populateFromTimeEntries);
router.patch('/line-items/:id', projectsController.updateLineItem);
router.delete('/line-items/:id', projectsController.deleteLineItem);

// Reports
router.get('/reports/time', projectsController.getTimeReport);
router.get('/reports/revenue', projectsController.getRevenueReport);
router.get('/reports/profitability', projectsController.getProjectProfitability);
router.get('/reports/utilization', projectsController.getTeamUtilization);

// Settings
router.get('/settings', projectsController.getSettings);
router.patch('/settings', projectsController.updateSettings);

// Seed
router.post('/seed', projectsController.seedSampleData);

export default router;
