import { Router, Request, Response, NextFunction } from 'express';
import * as crmController from './controller';
import { authMiddleware } from '../../middleware/auth';
import { requireAppPermission } from '../../middleware/require-app-permission';
import { withConcurrencyCheck } from '../../middleware/concurrency-check';
import { createCompany as createCompanySpec } from '../../openapi/paths/crm';
import { isTenantAdmin } from '@atlas-platform/shared';
import { db } from '../../config/database';
import {
  accounts,
  tenantMembers,
  crmCompanies,
  crmContacts,
  crmDeals,
  crmDealStages,
  crmLeads,
  crmActivities,
  crmNotes,
  crmProposals,
  crmWorkflows,
  crmWorkflowSteps,
} from '../../db/schema';
import { eq, inArray } from 'drizzle-orm';

function requireSeedAdmin(req: Request, res: Response, next: NextFunction) {
  if (!isTenantAdmin(req.auth?.tenantRole)) {
    res.status(403).json({ success: false, error: 'Only organization admins can seed demo data' });
    return;
  }
  next();
}

const router = Router();

// ─── Public routes (no auth) — defined BEFORE authMiddleware ────────
router.post('/forms/public/:token', crmController.submitLeadForm);
router.get('/proposals/public/:token', crmController.getPublicProposal);
router.post('/proposals/public/:token/accept', crmController.acceptPublicProposal);
router.post('/proposals/public/:token/decline', crmController.declinePublicProposal);

// ─── Auth middleware for all routes below ────────────────────────────
router.use(authMiddleware);
router.use(requireAppPermission('crm'));

// Widget (lightweight summary for home dashboard)
router.get('/widget', crmController.getWidgetData);

// Dashboard
router.get('/dashboard', crmController.getDashboard);

// Companies (before /:id to avoid route conflicts)
router.get('/companies/list', crmController.listCompanies);
router.post('/companies/import', crmController.importCompanies);
router.post('/companies', createCompanySpec.validate, crmController.createCompany);
router.get('/companies/:id', crmController.getCompany);
router.patch('/companies/:id', withConcurrencyCheck(crmCompanies), crmController.updateCompany);
router.delete('/companies/:id', crmController.deleteCompany);
router.post('/companies/:id/regenerate-token', crmController.regeneratePortalToken);

// Contacts
router.get('/contacts/list', crmController.listContacts);
router.post('/contacts/import', crmController.importContacts);
router.post('/contacts', crmController.createContact);
router.get('/contacts/:id', crmController.getContact);
router.patch('/contacts/:id', withConcurrencyCheck(crmContacts), crmController.updateContact);
router.delete('/contacts/:id', crmController.deleteContact);

// Deal Stages
router.get('/stages/list', crmController.listDealStages);
router.post('/stages', crmController.createDealStage);
router.post('/stages/reorder', crmController.reorderDealStages);
router.post('/stages/seed', requireSeedAdmin, crmController.seedDefaultStages);
router.patch('/stages/:id', withConcurrencyCheck(crmDealStages), crmController.updateDealStage);
router.delete('/stages/:id', crmController.deleteDealStage);

// Deals
router.get('/deals/list', crmController.listDeals);
router.get('/deals/counts-by-stage', crmController.countsByStage);
router.get('/deals/pipeline-value', crmController.pipelineValue);
router.post('/deals/import', crmController.importDeals);
router.post('/deals', crmController.createDeal);
router.get('/deals/:id', crmController.getDeal);
router.patch('/deals/:id', withConcurrencyCheck(crmDeals), crmController.updateDeal);
router.delete('/deals/:id', crmController.deleteDeal);
router.post('/deals/:id/won', crmController.markDealWon);
router.post('/deals/:id/lost', crmController.markDealLost);

// Sales Teams
router.get('/teams/list', crmController.listTeams);
router.post('/teams', crmController.createTeam);
router.patch('/teams/:id', crmController.updateTeam);
router.delete('/teams/:id', crmController.deleteTeam);
router.get('/teams/:id/members', crmController.listTeamMembers);
router.post('/teams/:id/members', crmController.addTeamMember);
router.delete('/teams/:id/members/:userId', crmController.removeTeamMember);
router.get('/teams/user/:userId', crmController.getUserTeams);

// Activity Types
router.get('/activity-types/list', crmController.listActivityTypes);
router.post('/activity-types', crmController.createActivityType);
router.post('/activity-types/seed', requireSeedAdmin, crmController.seedActivityTypes);
router.post('/activity-types/reorder', crmController.reorderActivityTypes);
router.patch('/activity-types/:id', crmController.updateActivityType);
router.delete('/activity-types/:id', crmController.deleteActivityType);

// Activities
router.get('/activities/list', crmController.listActivities);
router.post('/activities', crmController.createActivity);
router.post('/activities/:id/complete', crmController.completeActivity);
router.patch('/activities/:id', withConcurrencyCheck(crmActivities), crmController.updateActivity);
router.delete('/activities/:id', crmController.deleteActivity);

// Workflow Automations
router.get('/workflows', crmController.listWorkflows);
router.get('/workflows/:id', crmController.getWorkflow);
router.post('/workflows/seed', requireSeedAdmin, crmController.seedExampleWorkflows);
router.post('/workflows', crmController.createWorkflow);
router.put('/workflows/:id', withConcurrencyCheck(crmWorkflows), crmController.updateWorkflow);
router.delete('/workflows/:id', crmController.deleteWorkflow);
router.post('/workflows/:id/toggle', crmController.toggleWorkflow);

// Workflow steps
router.post('/workflows/:id/steps', crmController.appendStep);
router.patch('/workflows/:id/steps/:stepId', withConcurrencyCheck(crmWorkflowSteps), crmController.updateStep);
router.delete('/workflows/:id/steps/:stepId', crmController.deleteStep);
router.post('/workflows/:id/steps/reorder', crmController.reorderSteps);

// Leads
router.get('/leads/list', crmController.listLeads);
router.post('/leads', crmController.createLead);
router.get('/leads/:id', crmController.getLead);
router.patch('/leads/:id', withConcurrencyCheck(crmLeads), crmController.updateLead);
router.delete('/leads/:id', crmController.deleteLead);
router.post('/leads/:id/convert', crmController.convertLead);
router.post('/leads/:id/enrich', crmController.enrichLead);

// Notes (rich text)
router.get('/notes/list', crmController.listNotes);
router.post('/notes', crmController.createNote);
router.patch('/notes/:id', withConcurrencyCheck(crmNotes), crmController.updateNote);
router.delete('/notes/:id', crmController.deleteNote);

// Forecast
router.get('/forecast', crmController.getForecast);

// Merge
router.post('/contacts/merge', crmController.mergeContacts);
router.post('/companies/merge', crmController.mergeCompanies);

// Dashboard Charts (extended)
router.get('/dashboard/charts', crmController.getDashboardCharts);

// Seed sample data
router.post('/seed', requireSeedAdmin, crmController.seedSampleData);
router.post('/leads/seed', requireSeedAdmin, crmController.seedSampleLeads);

// Saved Views
router.get('/views', crmController.listSavedViews);
router.post('/views', crmController.createSavedView);
router.patch('/views/:id', crmController.updateSavedView);
router.delete('/views/:id', crmController.deleteSavedView);

// Lead Forms
router.get('/forms', crmController.listLeadForms);
router.post('/forms', crmController.createLeadForm);
router.patch('/forms/:id', crmController.updateLeadForm);
router.delete('/forms/:id', crmController.deleteLeadForm);

// Proposals
router.get('/proposals/list', crmController.listProposals);
router.post('/proposals', crmController.createProposal);
router.get('/proposals/:id', crmController.getProposal);
router.patch('/proposals/:id', withConcurrencyCheck(crmProposals), crmController.updateProposal);
router.delete('/proposals/:id', crmController.deleteProposal);
router.post('/proposals/:id/send', crmController.sendProposal);
router.post('/proposals/:id/duplicate', crmController.duplicateProposal);
router.get('/proposals/:id/revisions', crmController.listProposalRevisions);
router.post('/proposals/:id/revisions/:revisionId/restore', crmController.restoreProposalRevision);

// Read-only helpers for the CRM client. Write/admin endpoints for per-app
// permissions now live under /system/permissions (owner-only unified grid).
router.get('/permissions/me', (req, res) => {
  const perm = req.crmPerm!;
  res.json({
    success: true,
    data: {
      id: null,
      tenantId: req.auth?.tenantId ?? null,
      userId: req.auth!.userId,
      role: perm.role,
      recordAccess: perm.recordAccess,
    },
  });
});

// Legacy team-member list — the log-activity modal's assignee picker still
// reads this. Returns member info only; no RBAC data.
router.get('/permissions', async (req, res) => {
  try {
    const tenantId = req.auth?.tenantId;
    if (!tenantId) {
      res.json({ success: true, data: { permissions: [] } });
      return;
    }
    const members = await db
      .select()
      .from(tenantMembers)
      .where(eq(tenantMembers.tenantId, tenantId));
    if (members.length === 0) {
      res.json({ success: true, data: { permissions: [] } });
      return;
    }
    const userIds = members.map((m) => m.userId);
    const acctRows = await db
      .select({ userId: accounts.userId, email: accounts.email, name: accounts.name })
      .from(accounts)
      .where(inArray(accounts.userId, userIds));
    const acctMap = new Map(acctRows.map((a) => [a.userId, a]));
    const permissions = members.map((m) => {
      const acct = acctMap.get(m.userId);
      return {
        id: null,
        tenantId,
        userId: m.userId,
        role: 'editor',
        recordAccess: 'all',
        userName: acct?.name ?? null,
        userEmail: acct?.email ?? 'unknown',
        createdAt: null,
        updatedAt: null,
      };
    });
    res.json({ success: true, data: { permissions } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to list team members' });
  }
});

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
