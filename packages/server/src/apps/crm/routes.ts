import { Router } from 'express';
import * as crmController from './controller';
import { authMiddleware } from '../../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Companies (before /:id to avoid route conflicts)
router.get('/companies/list', crmController.listCompanies);
router.post('/companies', crmController.createCompany);
router.get('/companies/:id', crmController.getCompany);
router.patch('/companies/:id', crmController.updateCompany);
router.delete('/companies/:id', crmController.deleteCompany);

// Contacts
router.get('/contacts/list', crmController.listContacts);
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

// Seed sample data
router.post('/seed', crmController.seedSampleData);

export default router;
