export type CrmActivityType = 'note' | 'call' | 'meeting' | 'email';

export interface CrmContact {
  id: string; accountId: string; userId: string;
  name: string; email: string | null; phone: string | null;
  companyId: string | null; position: string | null;
  source: string | null; tags: string[];
  isArchived: boolean; sortOrder: number;
  createdAt: string; updatedAt: string;
  // Joined
  companyName?: string;
}

export interface CrmCompany {
  id: string; accountId: string; userId: string;
  name: string; domain: string | null; industry: string | null;
  size: string | null; address: string | null; phone: string | null;
  tags: string[]; isArchived: boolean; sortOrder: number;
  createdAt: string; updatedAt: string;
  // Counts
  contactCount?: number; dealCount?: number;
}

export interface CrmDealStage {
  id: string; accountId: string;
  name: string; color: string; probability: number;
  sequence: number; isDefault: boolean;
  rottingDays: number | null;
}

export interface CrmDeal {
  id: string; accountId: string; userId: string;
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
  id: string; accountId: string; userId: string;
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
export interface CreateCrmCompanyInput { name: string; domain?: string; industry?: string; size?: string; address?: string; phone?: string; }
export interface CreateCrmDealInput { title: string; value: number; stageId: string; contactId?: string; companyId?: string; expectedCloseDate?: string; }
export interface CreateCrmActivityInput { type: CrmActivityType; body: string; dealId?: string; contactId?: string; companyId?: string; assignedUserId?: string; scheduledAt?: string; }

// ─── Activity Type Config ────────────────────────────────────────

export interface CrmActivityTypeConfig {
  id: string; accountId: string;
  name: string; icon: string; color: string;
  isDefault: boolean; isArchived: boolean;
  sortOrder: number;
  createdAt: string; updatedAt: string;
}

export interface CreateCrmActivityTypeInput {
  name: string; icon?: string; color?: string;
}

// ─── Workflow Automations ──────────────────────────────────────────

export type CrmWorkflowTrigger = 'deal_stage_changed' | 'deal_created' | 'deal_won' | 'deal_lost' | 'contact_created' | 'activity_logged';
export type CrmWorkflowAction = 'create_task' | 'update_field' | 'change_deal_stage' | 'add_tag' | 'assign_user' | 'log_activity' | 'send_notification';

export interface CrmWorkflow {
  id: string;
  accountId: string;
  userId: string;
  name: string;
  trigger: CrmWorkflowTrigger;
  triggerConfig: Record<string, unknown>;
  action: CrmWorkflowAction;
  actionConfig: Record<string, unknown>;
  isActive: boolean;
  executionCount: number;
  lastExecutedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCrmWorkflowInput {
  name: string;
  trigger: CrmWorkflowTrigger;
  triggerConfig?: Record<string, unknown>;
  action: CrmWorkflowAction;
  actionConfig: Record<string, unknown>;
}

// ─── CRM Permissions ─────────────────────────────────────────────

export type CrmRole = 'admin' | 'manager' | 'sales' | 'viewer';
export type CrmRecordAccess = 'all' | 'team' | 'own';

// ─── Sales Teams ────────────────────────────────────────────────

export interface CrmTeam {
  id: string; accountId: string;
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
  accountId: string;
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
  id: string; accountId: string; userId: string;
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
  id: string; accountId: string; userId: string;
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
