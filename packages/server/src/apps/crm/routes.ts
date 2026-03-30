import { Router } from 'express';
import * as crmController from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Widget (lightweight summary for home dashboard)
router.get('/widget', crmController.getWidgetData);

// Dashboard
router.get('/dashboard', crmController.getDashboard);

// Companies (before /:id to avoid route conflicts)
router.get('/companies/list', crmController.listCompanies);
router.post('/companies/import', crmController.importCompanies);
router.post('/companies', crmController.createCompany);
router.get('/companies/:id', crmController.getCompany);
router.patch('/companies/:id', crmController.updateCompany);
router.delete('/companies/:id', crmController.deleteCompany);

// Contacts
router.get('/contacts/list', crmController.listContacts);
router.post('/contacts/import', crmController.importContacts);
router.post('/contacts', crmController.createContact);
router.get('/contacts/:id', crmController.getContact);
router.patch('/contacts/:id', crmController.updateContact);
router.delete('/contacts/:id', crmController.deleteContact);

// Deal Stages
router.get('/stages/list', crmController.listDealStages);
router.post('/stages', crmController.createDealStage);
router.post('/stages/reorder', crmController.reorderDealStages);
router.post('/stages/seed', crmController.seedDefaultStages);
router.patch('/stages/:id', crmController.updateDealStage);
router.delete('/stages/:id', crmController.deleteDealStage);

// Deals
router.get('/deals/list', crmController.listDeals);
router.get('/deals/counts-by-stage', crmController.countsByStage);
router.get('/deals/pipeline-value', crmController.pipelineValue);
router.post('/deals/import', crmController.importDeals);
router.post('/deals', crmController.createDeal);
router.get('/deals/:id', crmController.getDeal);
router.patch('/deals/:id', crmController.updateDeal);
router.delete('/deals/:id', crmController.deleteDeal);
router.post('/deals/:id/won', crmController.markDealWon);
router.post('/deals/:id/lost', crmController.markDealLost);

// Activities
router.get('/activities/list', crmController.listActivities);
router.post('/activities', crmController.createActivity);
router.patch('/activities/:id', crmController.updateActivity);
router.delete('/activities/:id', crmController.deleteActivity);

// Workflow Automations
router.get('/workflows', crmController.listWorkflows);
router.post('/workflows/seed', crmController.seedExampleWorkflows);
router.post('/workflows', crmController.createWorkflow);
router.put('/workflows/:id', crmController.updateWorkflow);
router.delete('/workflows/:id', crmController.deleteWorkflow);
router.post('/workflows/:id/toggle', crmController.toggleWorkflow);

// Permissions
router.get('/permissions', crmController.listPermissions);
router.get('/permissions/me', crmController.getMyPermission);
router.put('/permissions/:userId', crmController.updatePermission);

// Leads
router.get('/leads/list', crmController.listLeads);
router.post('/leads', crmController.createLead);
router.get('/leads/:id', crmController.getLead);
router.patch('/leads/:id', crmController.updateLead);
router.delete('/leads/:id', crmController.deleteLead);
router.post('/leads/:id/convert', crmController.convertLead);

// Notes (rich text)
router.get('/notes/list', crmController.listNotes);
router.post('/notes', crmController.createNote);
router.patch('/notes/:id', crmController.updateNote);
router.delete('/notes/:id', crmController.deleteNote);

// Forecast
router.get('/forecast', crmController.getForecast);

// Merge
router.post('/contacts/merge', crmController.mergeContacts);
router.post('/companies/merge', crmController.mergeCompanies);

// Dashboard Charts (extended)
router.get('/dashboard/charts', crmController.getDashboardCharts);

// Seed sample data
router.post('/seed', crmController.seedSampleData);
router.post('/leads/seed', crmController.seedSampleLeads);

// Google sync
router.get('/google/status', crmController.getGoogleSyncStatus);
router.post('/google/sync/start', crmController.startGoogleSync);
router.post('/google/sync/stop', crmController.stopGoogleSync);

// CRM emails (linked to contacts/deals/companies)
router.get('/contacts/:id/emails', crmController.getContactEmails);
router.get('/deals/:id/emails', crmController.getDealEmails);
router.get('/companies/:id/emails', crmController.getCompanyEmails);
router.post('/emails/send', crmController.sendCrmEmail);

// CRM calendar (linked to contacts/deals)
router.get('/contacts/:id/events', crmController.getContactEvents);
router.get('/deals/:id/events', crmController.getDealEvents);
router.post('/events/create', crmController.createCrmEvent);

export default router;
