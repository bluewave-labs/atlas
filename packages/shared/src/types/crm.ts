export type CrmActivityType = 'note' | 'call' | 'meeting' | 'email';

export interface CrmContact {
  id: string; tenantId: string; userId: string;
  name: string; email: string | null; phone: string | null;
  companyId: string | null; position: string | null;
  source: string | null; tags: string[];
  isArchived: boolean; sortOrder: number;
  createdAt: string; updatedAt: string;
  // Joined
  companyName?: string;
}

export interface CrmCompany {
  id: string; tenantId: string; userId: string;
  name: string; domain: string | null; industry: string | null;
  size: string | null; address: string | null; phone: string | null;
  taxId: string | null; taxOffice: string | null;
  currency: string; postalCode: string | null;
  state: string | null; country: string | null;
  logo: string | null; portalToken: string | null;
  tags: string[]; isArchived: boolean; sortOrder: number;
  createdAt: string; updatedAt: string;
  // Counts
  contactCount?: number; dealCount?: number;
}

export interface CrmDealStage {
  id: string; tenantId: string;
  name: string; color: string; probability: number;
  sequence: number; isDefault: boolean;
  rottingDays: number | null;
  createdAt: string; updatedAt: string;
}

export interface CrmDeal {
  id: string; tenantId: string; userId: string;
  title: string; value: number; stageId: string;
  contactId: string | null; companyId: string | null;
  assignedUserId: string | null;
  teamId: string | null;
  probability: number; expectedCloseDate: string | null;
  wonAt: string | null; lostAt: string | null; lostReason: string | null;
  tags: string[];
  stageEnteredAt: string | null;
  isArchived: boolean; sortOrder: number;
  createdAt: string; updatedAt: string;
  // Joined
  stageName?: string; stageColor?: string; stageRottingDays?: number | null;
  contactName?: string; companyName?: string;
}

export interface CrmActivity {
  id: string; tenantId: string; userId: string;
  type: CrmActivityType; body: string;
  dealId: string | null; contactId: string | null; companyId: string | null;
  assignedUserId: string | null;
  scheduledAt: string | null; completedAt: string | null;
  isArchived: boolean;
  createdAt: string; updatedAt: string;
  // Joined
  assignedUserName?: string;
}

// Input types for create/update
export interface CreateCrmContactInput { name: string; email?: string; phone?: string; companyId?: string; position?: string; source?: string; }
export interface CreateCrmCompanyInput { name: string; domain?: string; industry?: string; size?: string; address?: string; phone?: string; taxId?: string; taxOffice?: string; currency?: string; postalCode?: string; state?: string; country?: string; logo?: string; portalToken?: string; }
export interface CreateCrmDealInput { title: string; value: number; stageId: string; contactId?: string; companyId?: string; expectedCloseDate?: string; }
export interface CreateCrmActivityInput { type: CrmActivityType; body: string; dealId?: string; contactId?: string; companyId?: string; assignedUserId?: string; scheduledAt?: string; }

// ─── Activity Type Config ────────────────────────────────────────

export interface CrmActivityTypeConfig {
  id: string; tenantId: string;
  name: string; icon: string; color: string;
  isDefault: boolean; isArchived: boolean;
  sortOrder: number;
  createdAt: string; updatedAt: string;
}

export interface CreateCrmActivityTypeInput {
  name: string; icon?: string; color?: string;
}

// ─── CRM Permissions ─────────────────────────────────────────────

export type CrmRole = 'admin' | 'manager' | 'sales' | 'viewer';
export type CrmRecordAccess = 'all' | 'team' | 'own';

// ─── Sales Teams ────────────────────────────────────────────────

export interface CrmTeam {
  id: string; tenantId: string;
  name: string; color: string;
  leaderUserId: string | null;
  isArchived: boolean;
  createdAt: string; updatedAt: string;
}

export interface CrmTeamMember {
  id: string; teamId: string; userId: string;
  userName?: string; userEmail?: string;
  createdAt: string;
}

export type CrmEntity = 'deals' | 'contacts' | 'companies' | 'activities' | 'workflows' | 'dashboard';
export type CrmOperation = 'view' | 'create' | 'update' | 'delete';

export interface CrmPermission {
  id: string;
  tenantId: string;
  userId: string;
  role: CrmRole;
  recordAccess: CrmRecordAccess;
  createdAt: string;
  updatedAt: string;
}

export interface CrmPermissionWithUser extends CrmPermission {
  userName: string | null;
  userEmail: string;
}

// ─── Leads ──────────────────────────────────────────────────────────

export type CrmLeadStatus = 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
export type CrmLeadSource = 'website' | 'referral' | 'cold_call' | 'social_media' | 'event' | 'other';

export interface CrmLead {
  id: string; tenantId: string; userId: string;
  name: string; email: string | null; phone: string | null;
  companyName: string | null; source: CrmLeadSource;
  status: CrmLeadStatus; notes: string | null;
  expectedRevenue: number;
  probability: number;
  assignedUserId: string | null;
  expectedCloseDate: string | null;
  convertedContactId: string | null; convertedDealId: string | null;
  tags: string[];
  enrichedData: Record<string, unknown> | null;
  enrichedAt: string | null;
  isArchived: boolean; sortOrder: number;
  createdAt: string; updatedAt: string;
}

export interface CreateCrmLeadInput {
  name: string; email?: string; phone?: string;
  companyName?: string; source?: CrmLeadSource; notes?: string;
}

// ─── Notes (rich text) ──────────────────────────────────────────────

export interface CrmNote {
  id: string; tenantId: string; userId: string;
  title: string; content: Record<string, unknown>;
  dealId: string | null; contactId: string | null; companyId: string | null;
  isPinned: boolean; isArchived: boolean;
  createdAt: string; updatedAt: string;
}

export interface CreateCrmNoteInput {
  title?: string; content: Record<string, unknown>;
  dealId?: string; contactId?: string; companyId?: string;
}

// ─── Dashboard Charts ───────────────────────────────────────────────

export interface CrmDashboardCharts {
  winLossByMonth: { month: string; won: number; lost: number }[];
  revenueTrend: { month: string; revenue: number }[];
  salesCycleLength: { month: string; avgDays: number }[];
  conversionFunnel: { stage: string; stageColor: string; count: number; sequence: number }[];
  dealsBySource: { source: string; count: number; value: number }[];
}

// ─── Forecast ───────────────────────────────────────────────────────

export interface CrmForecastMonth {
  month: string; weightedValue: number;
}

export interface CrmForecast {
  months: CrmForecastMonth[];
  totalWeighted: number;
  bestCase: number;
  committed: number;
}

// ─── Workflow step conditions ──────────────────────────────────────

export const WORKFLOW_CONDITION_OPERATORS = [
  'eq', 'neq',
  'gt', 'gte', 'lt', 'lte',
  'contains', 'not_contains',
  'is_empty', 'is_not_empty',
] as const;
export type StepConditionOperator = (typeof WORKFLOW_CONDITION_OPERATORS)[number];

export type StepCondition = {
  field: string;
  operator: StepConditionOperator;
  value: string | number | null;
};

export const WORKFLOW_ACTIONS = [
  'create_task',
  'update_field',
  'change_deal_stage',
  'add_tag',
  'assign_user',
  'log_activity',
  'send_notification',
] as const;
export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number];

export const WORKFLOW_TRIGGERS = [
  'deal_stage_changed',
  'deal_created',
  'deal_won',
  'deal_lost',
  'contact_created',
  'activity_logged',
] as const;
export type WorkflowTrigger = (typeof WORKFLOW_TRIGGERS)[number];

// Condition field types — drives operator filter in UI and value validation in API.
export type ConditionFieldType = 'number' | 'string' | 'string[]';

export const CONDITION_FIELD_TYPES: Record<string, ConditionFieldType> = {
  'trigger.fromStage': 'string',
  'trigger.toStage': 'string',
  'trigger.activityType': 'string',
  'deal.value': 'number',
  'deal.probability': 'number',
  'deal.stageId': 'string',
  'deal.tags': 'string[]',
  'deal.title': 'string',
  'contact.email': 'string',
  'contact.tags': 'string[]',
  'company.tags': 'string[]',
};

// Per-trigger, which condition fields are available. Used by the UI to scope the Field
// Select and by the API to validate incoming condition payloads.
export const TRIGGER_AVAILABLE_FIELDS: Record<WorkflowTrigger, string[]> = {
  deal_stage_changed: [
    'trigger.fromStage', 'trigger.toStage',
    'deal.value', 'deal.probability', 'deal.stageId', 'deal.tags', 'deal.title',
    'contact.email', 'contact.tags', 'company.tags',
  ],
  deal_created: [
    'deal.value', 'deal.probability', 'deal.stageId', 'deal.tags', 'deal.title',
    'contact.email', 'contact.tags', 'company.tags',
  ],
  deal_won: [
    'deal.value', 'deal.probability', 'deal.stageId', 'deal.tags', 'deal.title',
    'contact.email', 'contact.tags', 'company.tags',
  ],
  deal_lost: [
    'deal.value', 'deal.probability', 'deal.stageId', 'deal.tags', 'deal.title',
    'contact.email', 'contact.tags', 'company.tags',
  ],
  contact_created: [
    'contact.email', 'contact.tags',
  ],
  activity_logged: [
    'trigger.activityType',
    'deal.value', 'deal.probability', 'deal.stageId', 'deal.tags', 'deal.title',
    'contact.email', 'contact.tags', 'company.tags',
  ],
};

// Machine-readable error codes returned by workflow step endpoints. Clients can
// match on these to surface action-specific UX instead of a generic save-failed toast.
export const WORKFLOW_ERROR_CODES = {
  LAST_STEP: 'LAST_STEP',
  MISMATCH: 'MISMATCH',
} as const;
export type WorkflowErrorCode = (typeof WORKFLOW_ERROR_CODES)[keyof typeof WORKFLOW_ERROR_CODES];
