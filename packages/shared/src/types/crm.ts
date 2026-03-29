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
}

export interface CrmDeal {
  id: string; accountId: string; userId: string;
  title: string; value: number; stageId: string;
  contactId: string | null; companyId: string | null;
  assignedUserId: string | null;
  probability: number; expectedCloseDate: string | null;
  wonAt: string | null; lostAt: string | null; lostReason: string | null;
  tags: string[]; isArchived: boolean; sortOrder: number;
  createdAt: string; updatedAt: string;
  // Joined
  stageName?: string; stageColor?: string;
  contactName?: string; companyName?: string;
}

export interface CrmActivity {
  id: string; accountId: string; userId: string;
  type: CrmActivityType; body: string;
  dealId: string | null; contactId: string | null; companyId: string | null;
  scheduledAt: string | null; completedAt: string | null;
  isArchived: boolean;
  createdAt: string; updatedAt: string;
}

// Input types for create/update
export interface CreateCrmContactInput { name: string; email?: string; phone?: string; companyId?: string; position?: string; source?: string; }
export interface CreateCrmCompanyInput { name: string; domain?: string; industry?: string; size?: string; address?: string; phone?: string; }
export interface CreateCrmDealInput { title: string; value: number; stageId: string; contactId?: string; companyId?: string; expectedCloseDate?: string; }
export interface CreateCrmActivityInput { type: CrmActivityType; body: string; dealId?: string; contactId?: string; companyId?: string; scheduledAt?: string; }
