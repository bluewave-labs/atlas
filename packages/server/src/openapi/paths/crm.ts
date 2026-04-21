import { z } from 'zod';
import { register, envelope, Uuid, IsoDateTime, IsoDate, defineRoute } from '../_helpers';

const TAG = 'CRM';

// ============================================================
// Schemas (matched against packages/server/src/db/schema.ts)
// ============================================================
const Company = z.object({
  id: Uuid,
  tenantId: Uuid,
  userId: Uuid,
  name: z.string(),
  domain: z.string().nullable(),
  industry: z.string().nullable(),
  size: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  teamId: Uuid.nullable(),
  taxId: z.string().nullable(),
  taxOffice: z.string().nullable(),
  currency: z.string().default('USD'),
  postalCode: z.string().nullable(),
  state: z.string().nullable(),
  country: z.string().nullable(),
  logo: z.string().nullable(),
  portalToken: Uuid.nullable(),
  tags: z.array(z.string()),
  isArchived: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

const Contact = z.object({
  id: Uuid,
  tenantId: Uuid,
  userId: Uuid,
  name: z.string(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  companyId: Uuid.nullable(),
  teamId: Uuid.nullable(),
  position: z.string().nullable(),
  source: z.string().nullable(),
  tags: z.array(z.string()),
  isArchived: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

const DealStage = z.object({
  id: Uuid,
  name: z.string(),
  color: z.string(),
  probability: z.number().int(),
  sequence: z.number().int(),
  isDefault: z.boolean(),
  rottingDays: z.number().int().nullable(),
});

const Deal = z.object({
  id: Uuid,
  tenantId: Uuid,
  userId: Uuid,
  title: z.string(),
  value: z.number(),
  currency: z.string(),
  stageId: Uuid,
  contactId: Uuid.nullable(),
  companyId: Uuid.nullable(),
  assignedUserId: Uuid.nullable(),
  teamId: Uuid.nullable(),
  probability: z.number().int(),
  expectedCloseDate: IsoDateTime.nullable(),
  wonAt: IsoDateTime.nullable(),
  lostAt: IsoDateTime.nullable(),
  lostReason: z.string().nullable(),
  tags: z.array(z.string()),
  stageEnteredAt: IsoDateTime.nullable(),
  isArchived: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

const ActivityType = z.object({
  id: Uuid,
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  isDefault: z.boolean(),
  isArchived: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

const Activity = z.object({
  id: Uuid,
  tenantId: Uuid,
  userId: Uuid,
  type: z.string(),
  body: z.string(),
  dealId: Uuid.nullable(),
  contactId: Uuid.nullable(),
  companyId: Uuid.nullable(),
  assignedUserId: Uuid.nullable(),
  scheduledAt: IsoDateTime.nullable(),
  completedAt: IsoDateTime.nullable(),
  isArchived: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

const Workflow = z.object({
  id: Uuid,
  name: z.string(),
  trigger: z.string(),
  triggerConfig: z.record(z.string(), z.unknown()),
  action: z.string(),
  actionConfig: z.record(z.string(), z.unknown()),
  isActive: z.boolean(),
  executionCount: z.number().int(),
  lastExecutedAt: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

const Team = z.object({
  id: Uuid,
  name: z.string(),
  color: z.string(),
  leaderUserId: Uuid.nullable(),
  isArchived: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

const TeamMember = z.object({
  id: Uuid,
  teamId: Uuid,
  userId: Uuid,
  createdAt: IsoDateTime,
});

const Lead = z.object({
  id: Uuid,
  tenantId: Uuid,
  userId: Uuid,
  name: z.string(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  companyName: z.string().nullable(),
  source: z.string(),
  status: z.string(),
  notes: z.string().nullable(),
  convertedContactId: Uuid.nullable(),
  convertedDealId: Uuid.nullable(),
  tags: z.array(z.string()),
  expectedRevenue: z.number(),
  probability: z.number().int(),
  assignedUserId: Uuid.nullable(),
  teamId: Uuid.nullable(),
  expectedCloseDate: IsoDateTime.nullable(),
  enrichedData: z.record(z.string(), z.unknown()).nullable(),
  enrichedAt: IsoDateTime.nullable(),
  isArchived: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

const Note = z.object({
  id: Uuid,
  title: z.string(),
  content: z.record(z.string(), z.unknown()),
  dealId: Uuid.nullable(),
  contactId: Uuid.nullable(),
  companyId: Uuid.nullable(),
  isPinned: z.boolean(),
  isArchived: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

const SavedView = z.object({
  id: Uuid,
  appSection: z.string(),
  name: z.string(),
  filters: z.record(z.string(), z.unknown()),
  isPinned: z.boolean(),
  isShared: z.boolean(),
  isArchived: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

const LeadFormField = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  placeholder: z.string(),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
  mapTo: z.string().optional(),
});

const LeadForm = z.object({
  id: Uuid,
  name: z.string(),
  token: z.string(),
  fields: z.array(LeadFormField),
  isActive: z.boolean(),
  submitCount: z.number().int(),
  isArchived: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

const ProposalLineItem = z.object({
  description: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  taxRate: z.number(),
});

const Proposal = z.object({
  id: Uuid,
  dealId: Uuid.nullable(),
  contactId: Uuid.nullable(),
  companyId: Uuid.nullable(),
  title: z.string(),
  status: z.enum(['draft', 'sent', 'viewed', 'accepted', 'declined', 'expired']),
  content: z.unknown().nullable(),
  lineItems: z.array(ProposalLineItem),
  subtotal: z.number(),
  taxPercent: z.number(),
  taxAmount: z.number(),
  discountPercent: z.number(),
  discountAmount: z.number(),
  total: z.number(),
  currency: z.string(),
  validUntil: IsoDateTime.nullable(),
  publicToken: Uuid,
  sentAt: IsoDateTime.nullable(),
  viewedAt: IsoDateTime.nullable(),
  acceptedAt: IsoDateTime.nullable(),
  declinedAt: IsoDateTime.nullable(),
  notes: z.string().nullable(),
  isArchived: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

// ============================================================
// Dashboard / widget
// ============================================================
register({ method: 'get', path: '/crm/widget', tags: [TAG], summary: 'Get CRM widget data for home dashboard',
  response: envelope(z.record(z.string(), z.unknown())) });
register({ method: 'get', path: '/crm/dashboard', tags: [TAG], summary: 'Get CRM dashboard KPIs',
  response: envelope(z.object({
    totalPipelineValue: z.number(),
    dealsWonCount: z.number().int(),
    dealsWonValue: z.number(),
    dealsLostCount: z.number().int(),
    winRate: z.number().openapi({ description: '0..1' }),
    averageDealSize: z.number(),
    dealCount: z.number().int(),
    valueByStage: z.array(z.object({ stageId: Uuid, stageName: z.string(), value: z.number(), count: z.number().int() })),
    recentActivities: z.array(z.record(z.string(), z.unknown())),
    dealsClosingSoon: z.array(z.record(z.string(), z.unknown())),
    topDeals: z.array(z.record(z.string(), z.unknown())),
  })) });
register({ method: 'get', path: '/crm/dashboard/charts', tags: [TAG], summary: 'Get CRM dashboard time-series charts',
  response: envelope(z.record(z.string(), z.unknown())) });
register({ method: 'get', path: '/crm/forecast', tags: [TAG], summary: 'Get revenue forecast by stage/period',
  response: envelope(z.object({
    months: z.array(z.object({ month: z.string(), weightedValue: z.number() })),
    totalWeighted: z.number(),
    bestCase: z.number(),
    committed: z.number(),
  })) });

// ============================================================
// Companies
// ============================================================
register({ method: 'get', path: '/crm/companies/list', tags: [TAG], summary: 'List companies',
  response: envelope(z.object({ companies: z.array(Company) })) });
export const createCompany = defineRoute({ method: 'post', path: '/crm/companies', tags: [TAG], summary: 'Create a company',
  body: Company.omit({ id: true, tenantId: true, userId: true, createdAt: true, updatedAt: true, isArchived: true, portalToken: true }).partial().extend({ name: z.string().min(1) }),
  response: envelope(Company) });
register({ method: 'post', path: '/crm/companies/import', tags: [TAG], summary: 'Bulk import companies from CSV',
  body: z.object({ rows: z.array(z.record(z.string(), z.unknown())) }),
  response: envelope(z.object({ inserted: z.number().int(), skipped: z.number().int() })) });
register({ method: 'get', path: '/crm/companies/:id', tags: [TAG], summary: 'Get a company',
  params: z.object({ id: Uuid }), response: envelope(Company) });
register({ method: 'patch', path: '/crm/companies/:id', tags: [TAG], summary: 'Update a company',
  params: z.object({ id: Uuid }), body: Company.partial(), concurrency: true, response: envelope(Company) });
register({ method: 'delete', path: '/crm/companies/:id', tags: [TAG], summary: 'Delete a company',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/crm/companies/:id/regenerate-token', tags: [TAG], summary: 'Regenerate the client portal token for a company',
  params: z.object({ id: Uuid }), response: envelope(z.object({ portalToken: Uuid })) });
register({ method: 'post', path: '/crm/companies/merge', tags: [TAG], summary: 'Merge two companies',
  body: z.object({ sourceId: Uuid, targetId: Uuid }), response: envelope(Company) });

// ============================================================
// Contacts
// ============================================================
register({ method: 'get', path: '/crm/contacts/list', tags: [TAG], summary: 'List contacts',
  response: envelope(z.object({ contacts: z.array(Contact) })) });
register({ method: 'post', path: '/crm/contacts', tags: [TAG], summary: 'Create a contact',
  body: Contact.omit({ id: true, tenantId: true, userId: true, createdAt: true, updatedAt: true, isArchived: true }).partial().extend({ name: z.string() }),
  response: envelope(Contact) });
register({ method: 'post', path: '/crm/contacts/import', tags: [TAG], summary: 'Bulk import contacts from CSV',
  body: z.object({ rows: z.array(z.record(z.string(), z.unknown())) }),
  response: envelope(z.object({ inserted: z.number().int(), skipped: z.number().int() })) });
register({ method: 'get', path: '/crm/contacts/:id', tags: [TAG], summary: 'Get a contact',
  params: z.object({ id: Uuid }), response: envelope(Contact) });
register({ method: 'patch', path: '/crm/contacts/:id', tags: [TAG], summary: 'Update a contact',
  params: z.object({ id: Uuid }), body: Contact.partial(), concurrency: true, response: envelope(Contact) });
register({ method: 'delete', path: '/crm/contacts/:id', tags: [TAG], summary: 'Delete a contact',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/crm/contacts/merge', tags: [TAG], summary: 'Merge two contacts',
  body: z.object({ sourceId: Uuid, targetId: Uuid }), response: envelope(Contact) });
register({ method: 'get', path: '/crm/contacts/:id/emails', tags: [TAG], summary: 'Get Gmail threads associated with a contact',
  params: z.object({ id: Uuid }), response: envelope(z.array(z.record(z.string(), z.unknown()))) });
register({ method: 'get', path: '/crm/contacts/:id/events', tags: [TAG], summary: 'Get calendar events associated with a contact',
  params: z.object({ id: Uuid }), response: envelope(z.array(z.record(z.string(), z.unknown()))) });

// ============================================================
// Deal stages
// ============================================================
register({ method: 'get', path: '/crm/stages/list', tags: [TAG], summary: 'List deal stages',
  response: envelope(z.object({ stages: z.array(DealStage) })) });
register({ method: 'post', path: '/crm/stages', tags: [TAG], summary: 'Create a deal stage',
  body: DealStage.omit({ id: true }).partial().extend({ name: z.string() }), response: envelope(DealStage) });
register({ method: 'post', path: '/crm/stages/reorder', tags: [TAG], summary: 'Reorder deal stages',
  body: z.object({ stageIds: z.array(Uuid) }) });
register({ method: 'patch', path: '/crm/stages/:id', tags: [TAG], summary: 'Update a deal stage',
  params: z.object({ id: Uuid }), body: DealStage.partial(), concurrency: true, response: envelope(DealStage) });
register({ method: 'delete', path: '/crm/stages/:id', tags: [TAG], summary: 'Delete a deal stage',
  params: z.object({ id: Uuid }) });

// ============================================================
// Deals
// ============================================================
register({ method: 'get', path: '/crm/deals/list', tags: [TAG], summary: 'List deals',
  query: z.object({ stageId: Uuid.optional(), status: z.enum(['open', 'won', 'lost']).optional() }),
  response: envelope(z.object({ deals: z.array(Deal) })) });
register({ method: 'get', path: '/crm/deals/counts-by-stage', tags: [TAG], summary: 'Get deal counts grouped by stage',
  response: envelope(z.record(Uuid, z.number().int())) });
register({ method: 'get', path: '/crm/deals/pipeline-value', tags: [TAG], summary: 'Get total pipeline value',
  response: envelope(z.object({ total: z.number(), byStage: z.record(Uuid, z.number()) })) });
register({ method: 'post', path: '/crm/deals/import', tags: [TAG], summary: 'Bulk import deals from CSV',
  body: z.object({ rows: z.array(z.record(z.string(), z.unknown())) }),
  response: envelope(z.object({ inserted: z.number().int(), skipped: z.number().int() })) });
register({ method: 'post', path: '/crm/deals', tags: [TAG], summary: 'Create a deal',
  body: Deal.omit({ id: true, tenantId: true, userId: true, createdAt: true, updatedAt: true, isArchived: true, wonAt: true, lostAt: true, stageEnteredAt: true }).partial().extend({ title: z.string(), stageId: Uuid }),
  response: envelope(Deal) });
register({ method: 'get', path: '/crm/deals/:id', tags: [TAG], summary: 'Get a deal',
  params: z.object({ id: Uuid }), response: envelope(Deal) });
register({ method: 'patch', path: '/crm/deals/:id', tags: [TAG], summary: 'Update a deal',
  params: z.object({ id: Uuid }), body: Deal.partial(), concurrency: true, response: envelope(Deal) });
register({ method: 'delete', path: '/crm/deals/:id', tags: [TAG], summary: 'Delete a deal',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/crm/deals/:id/won', tags: [TAG], summary: 'Mark a deal as won',
  params: z.object({ id: Uuid }), response: envelope(Deal) });
register({ method: 'post', path: '/crm/deals/:id/lost', tags: [TAG], summary: 'Mark a deal as lost',
  params: z.object({ id: Uuid }), body: z.object({ reason: z.string().optional() }), response: envelope(Deal) });
register({ method: 'get', path: '/crm/deals/:id/emails', tags: [TAG], summary: 'Get Gmail threads associated with a deal',
  params: z.object({ id: Uuid }), response: envelope(z.array(z.record(z.string(), z.unknown()))) });
register({ method: 'get', path: '/crm/deals/:id/events', tags: [TAG], summary: 'Get calendar events associated with a deal',
  params: z.object({ id: Uuid }), response: envelope(z.array(z.record(z.string(), z.unknown()))) });
register({ method: 'get', path: '/crm/companies/:id/emails', tags: [TAG], summary: 'Get Gmail threads associated with a company',
  params: z.object({ id: Uuid }), response: envelope(z.array(z.record(z.string(), z.unknown()))) });

// ============================================================
// Teams
// ============================================================
register({ method: 'get', path: '/crm/teams/list', tags: [TAG], summary: 'List sales teams',
  response: envelope(z.array(Team)) });
register({ method: 'post', path: '/crm/teams', tags: [TAG], summary: 'Create a sales team',
  body: z.object({ name: z.string(), color: z.string().optional(), leaderUserId: Uuid.optional() }),
  response: envelope(Team) });
register({ method: 'patch', path: '/crm/teams/:id', tags: [TAG], summary: 'Update a sales team',
  params: z.object({ id: Uuid }), body: Team.partial(), response: envelope(Team) });
register({ method: 'delete', path: '/crm/teams/:id', tags: [TAG], summary: 'Delete a sales team',
  params: z.object({ id: Uuid }) });
register({ method: 'get', path: '/crm/teams/:id/members', tags: [TAG], summary: 'List team members',
  params: z.object({ id: Uuid }), response: envelope(z.array(TeamMember)) });
register({ method: 'post', path: '/crm/teams/:id/members', tags: [TAG], summary: 'Add a member to a team',
  params: z.object({ id: Uuid }), body: z.object({ userId: Uuid }), response: envelope(TeamMember) });
register({ method: 'delete', path: '/crm/teams/:id/members/:userId', tags: [TAG], summary: 'Remove a member from a team',
  params: z.object({ id: Uuid, userId: Uuid }) });
register({ method: 'get', path: '/crm/teams/user/:userId', tags: [TAG], summary: 'List teams a user belongs to',
  params: z.object({ userId: Uuid }), response: envelope(z.array(Team)) });

// ============================================================
// Activity types + activities
// ============================================================
register({ method: 'get', path: '/crm/activity-types/list', tags: [TAG], summary: 'List activity types',
  response: envelope(z.array(ActivityType)) });
register({ method: 'post', path: '/crm/activity-types', tags: [TAG], summary: 'Create an activity type',
  body: z.object({ name: z.string(), icon: z.string().optional(), color: z.string().optional() }),
  response: envelope(ActivityType) });
register({ method: 'post', path: '/crm/activity-types/reorder', tags: [TAG], summary: 'Reorder activity types',
  body: z.object({ typeIds: z.array(Uuid) }) });
register({ method: 'patch', path: '/crm/activity-types/:id', tags: [TAG], summary: 'Update an activity type',
  params: z.object({ id: Uuid }), body: ActivityType.partial(), response: envelope(ActivityType) });
register({ method: 'delete', path: '/crm/activity-types/:id', tags: [TAG], summary: 'Delete an activity type',
  params: z.object({ id: Uuid }) });

register({ method: 'get', path: '/crm/activities/list', tags: [TAG], summary: 'List activities',
  query: z.object({ dealId: Uuid.optional(), contactId: Uuid.optional(), companyId: Uuid.optional() }),
  response: envelope(z.array(Activity)) });
register({ method: 'post', path: '/crm/activities', tags: [TAG], summary: 'Create an activity',
  body: Activity.omit({ id: true, tenantId: true, userId: true, createdAt: true, updatedAt: true, isArchived: true, completedAt: true }).partial().extend({ type: z.string(), body: z.string() }),
  response: envelope(Activity) });
register({ method: 'post', path: '/crm/activities/:id/complete', tags: [TAG], summary: 'Mark an activity as completed',
  params: z.object({ id: Uuid }), response: envelope(Activity) });
register({ method: 'patch', path: '/crm/activities/:id', tags: [TAG], summary: 'Update an activity',
  params: z.object({ id: Uuid }), body: Activity.partial(), concurrency: true, response: envelope(Activity) });
register({ method: 'delete', path: '/crm/activities/:id', tags: [TAG], summary: 'Delete an activity',
  params: z.object({ id: Uuid }) });

// ============================================================
// Workflows (automations)
// ============================================================
register({ method: 'get', path: '/crm/workflows', tags: [TAG], summary: 'List workflow automations',
  response: envelope(z.object({ workflows: z.array(Workflow) })) });
register({ method: 'post', path: '/crm/workflows', tags: [TAG], summary: 'Create a workflow automation',
  body: Workflow.omit({ id: true, executionCount: true, lastExecutedAt: true, createdAt: true, updatedAt: true }).partial()
    .extend({ name: z.string(), trigger: z.string(), action: z.string() }),
  response: envelope(Workflow) });
register({ method: 'put', path: '/crm/workflows/:id', tags: [TAG], summary: 'Update a workflow automation',
  params: z.object({ id: Uuid }), body: Workflow.partial(), concurrency: true, response: envelope(Workflow) });
register({ method: 'delete', path: '/crm/workflows/:id', tags: [TAG], summary: 'Delete a workflow automation',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/crm/workflows/:id/toggle', tags: [TAG], summary: 'Toggle a workflow on/off',
  params: z.object({ id: Uuid }), response: envelope(Workflow) });

// ============================================================
// Leads
// ============================================================
register({ method: 'get', path: '/crm/leads/list', tags: [TAG], summary: 'List leads',
  query: z.object({ status: z.string().optional(), source: z.string().optional() }),
  response: envelope(z.object({ leads: z.array(Lead) })) });
register({ method: 'post', path: '/crm/leads', tags: [TAG], summary: 'Create a lead',
  body: Lead.omit({ id: true, tenantId: true, userId: true, createdAt: true, updatedAt: true, isArchived: true, convertedContactId: true, convertedDealId: true, enrichedData: true, enrichedAt: true }).partial().extend({ name: z.string() }),
  response: envelope(Lead) });
register({ method: 'get', path: '/crm/leads/:id', tags: [TAG], summary: 'Get a lead',
  params: z.object({ id: Uuid }), response: envelope(Lead) });
register({ method: 'patch', path: '/crm/leads/:id', tags: [TAG], summary: 'Update a lead',
  params: z.object({ id: Uuid }), body: Lead.partial(), concurrency: true, response: envelope(Lead) });
register({ method: 'delete', path: '/crm/leads/:id', tags: [TAG], summary: 'Delete a lead',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/crm/leads/:id/convert', tags: [TAG], summary: 'Convert a lead to a contact + deal',
  params: z.object({ id: Uuid }),
  response: envelope(z.object({ contactId: Uuid, dealId: Uuid.nullable() })) });
register({ method: 'post', path: '/crm/leads/:id/enrich', tags: [TAG], summary: 'Enrich a lead with third-party data',
  params: z.object({ id: Uuid }), response: envelope(Lead) });

// ============================================================
// Notes
// ============================================================
register({ method: 'get', path: '/crm/notes/list', tags: [TAG], summary: 'List notes',
  query: z.object({ dealId: Uuid.optional(), contactId: Uuid.optional(), companyId: Uuid.optional() }),
  response: envelope(z.object({ notes: z.array(Note) })) });
register({ method: 'post', path: '/crm/notes', tags: [TAG], summary: 'Create a note',
  body: Note.omit({ id: true, createdAt: true, updatedAt: true, isArchived: true, isPinned: true }).partial().extend({ title: z.string() }),
  response: envelope(Note) });
register({ method: 'patch', path: '/crm/notes/:id', tags: [TAG], summary: 'Update a note',
  params: z.object({ id: Uuid }), body: Note.partial(), concurrency: true, response: envelope(Note) });
register({ method: 'delete', path: '/crm/notes/:id', tags: [TAG], summary: 'Delete a note',
  params: z.object({ id: Uuid }) });

// ============================================================
// Saved views
// ============================================================
register({ method: 'get', path: '/crm/views', tags: [TAG], summary: 'List saved views',
  query: z.object({ appSection: z.string().optional() }),
  response: envelope(z.array(SavedView)) });
register({ method: 'post', path: '/crm/views', tags: [TAG], summary: 'Create a saved view',
  body: SavedView.omit({ id: true, createdAt: true, updatedAt: true, isArchived: true }).partial().extend({ appSection: z.string(), name: z.string() }),
  response: envelope(SavedView) });
register({ method: 'patch', path: '/crm/views/:id', tags: [TAG], summary: 'Update a saved view',
  params: z.object({ id: Uuid }), body: SavedView.partial(), response: envelope(SavedView) });
register({ method: 'delete', path: '/crm/views/:id', tags: [TAG], summary: 'Delete a saved view',
  params: z.object({ id: Uuid }) });

// ============================================================
// Lead forms
// ============================================================
register({ method: 'get', path: '/crm/forms', tags: [TAG], summary: 'List lead forms',
  response: envelope(z.array(LeadForm)) });
register({ method: 'post', path: '/crm/forms', tags: [TAG], summary: 'Create a lead form',
  body: z.object({ name: z.string(), fields: z.array(LeadFormField) }), response: envelope(LeadForm) });
register({ method: 'patch', path: '/crm/forms/:id', tags: [TAG], summary: 'Update a lead form',
  params: z.object({ id: Uuid }), body: LeadForm.partial(), response: envelope(LeadForm) });
register({ method: 'delete', path: '/crm/forms/:id', tags: [TAG], summary: 'Delete a lead form',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/crm/forms/public/:token', tags: [TAG], summary: 'Public — submit a lead form',
  public: true, params: z.object({ token: z.string() }),
  body: z.record(z.string(), z.unknown()),
  response: envelope(z.object({ leadId: Uuid })) });

// ============================================================
// Proposals
// ============================================================
register({ method: 'get', path: '/crm/proposals/list', tags: [TAG], summary: 'List proposals',
  query: z.object({ status: Proposal.shape.status.optional(), dealId: Uuid.optional() }),
  response: envelope(z.object({ proposals: z.array(Proposal) })) });
register({ method: 'post', path: '/crm/proposals', tags: [TAG], summary: 'Create a proposal',
  body: Proposal.omit({ id: true, publicToken: true, sentAt: true, viewedAt: true, acceptedAt: true, declinedAt: true, createdAt: true, updatedAt: true, isArchived: true })
    .partial().extend({ title: z.string() }),
  response: envelope(Proposal) });
register({ method: 'get', path: '/crm/proposals/:id', tags: [TAG], summary: 'Get a proposal',
  params: z.object({ id: Uuid }), response: envelope(Proposal) });
register({ method: 'patch', path: '/crm/proposals/:id', tags: [TAG], summary: 'Update a proposal',
  params: z.object({ id: Uuid }), body: Proposal.partial(), concurrency: true, response: envelope(Proposal) });
register({ method: 'delete', path: '/crm/proposals/:id', tags: [TAG], summary: 'Delete a proposal',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/crm/proposals/:id/send', tags: [TAG], summary: 'Send a proposal by email',
  params: z.object({ id: Uuid }), response: envelope(Proposal) });
register({ method: 'post', path: '/crm/proposals/:id/duplicate', tags: [TAG], summary: 'Duplicate a proposal',
  params: z.object({ id: Uuid }), response: envelope(Proposal) });
register({ method: 'get', path: '/crm/proposals/:id/revisions', tags: [TAG], summary: 'List proposal revisions',
  params: z.object({ id: Uuid }), response: envelope(z.array(z.record(z.string(), z.unknown()))) });
register({ method: 'post', path: '/crm/proposals/:id/revisions/:revisionId/restore', tags: [TAG], summary: 'Restore a previous proposal revision',
  params: z.object({ id: Uuid, revisionId: Uuid }), response: envelope(Proposal) });

// Public proposal views
register({ method: 'get', path: '/crm/proposals/public/:token', tags: [TAG], summary: 'Public — view a shared proposal',
  public: true, params: z.object({ token: z.string() }), response: envelope(Proposal) });
register({ method: 'post', path: '/crm/proposals/public/:token/accept', tags: [TAG], summary: 'Public — accept a proposal',
  public: true, params: z.object({ token: z.string() }), body: z.object({ signature: z.string().optional() }) });
register({ method: 'post', path: '/crm/proposals/public/:token/decline', tags: [TAG], summary: 'Public — decline a proposal',
  public: true, params: z.object({ token: z.string() }), body: z.object({ reason: z.string().optional() }) });

// ============================================================
// Google sync + emails
// ============================================================
register({ method: 'get', path: '/crm/google/status', tags: [TAG], summary: 'Get Google sync status',
  response: envelope(z.object({ connected: z.boolean(), lastSyncAt: IsoDateTime.nullable() })) });
register({ method: 'post', path: '/crm/google/sync/start', tags: [TAG], summary: 'Start Google sync' });
register({ method: 'post', path: '/crm/google/sync/stop', tags: [TAG], summary: 'Stop Google sync' });
register({ method: 'post', path: '/crm/emails/send', tags: [TAG], summary: 'Send an email via connected Gmail',
  body: z.object({ to: z.string().email(), subject: z.string(), body: z.string(), contactId: Uuid.optional(), dealId: Uuid.optional() }) });
register({ method: 'post', path: '/crm/events/create', tags: [TAG], summary: 'Create a calendar event linked to a CRM record',
  body: z.object({
    title: z.string(),
    start: IsoDateTime,
    end: IsoDateTime,
    contactId: Uuid.optional(),
    dealId: Uuid.optional(),
  }) });

// Permissions
register({ method: 'get', path: '/crm/permissions/me', tags: [TAG], summary: 'Get the current user’s CRM permissions',
  response: envelope(z.object({
    id: Uuid,
    tenantId: Uuid,
    userId: Uuid,
    role: z.string(),
    recordAccess: z.record(z.string(), z.unknown()),
  })) });
register({ method: 'get', path: '/crm/permissions', tags: [TAG], summary: 'Get CRM permissions for all users (admin)',
  response: envelope(z.array(z.record(z.string(), z.unknown()))) });
