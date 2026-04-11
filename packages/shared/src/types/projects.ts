// ─── Project ────────────────────────────────────────────────────────

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface Project {
  id: string;
  tenantId: string;
  userId: string;
  companyId: string | null;
  name: string;
  description: string | null;
  billable: boolean;
  status: ProjectStatus;
  estimatedHours: number | null;
  estimatedAmount: number | null;
  startDate: string | null;
  endDate: string | null;
  color: string | null;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  // Joined
  companyName?: string;
  totalTrackedMinutes?: number;
  totalBilledAmount?: number;
}

export interface CreateProjInput {
  name: string;
  companyId?: string;
  description?: string;
  billable?: boolean;
  status?: ProjectStatus;
  estimatedHours?: number;
  estimatedAmount?: number;
  startDate?: string;
  endDate?: string;
  color?: string;
}

export interface UpdateProjInput extends Partial<CreateProjInput> {
  sortOrder?: number;
  isArchived?: boolean;
}

// ─── Project Member ─────────────────────────────────────────────────

export interface ProjectMember {
  id: string;
  userId: string;
  projectId: string;
  hourlyRate: number | null;
  createdAt: string;
  updatedAt: string;
  // Joined
  userName?: string;
  userEmail?: string;
}

// ─── Time Entry ─────────────────────────────────────────────────────

export interface TimeEntry {
  id: string;
  tenantId: string;
  userId: string;
  projectId: string;
  durationMinutes: number;
  workDate: string;
  startTime: string | null;
  endTime: string | null;
  billable: boolean;
  billed: boolean;
  locked: boolean;
  invoiceLineItemId: string | null;
  notes: string | null;
  taskDescription: string | null;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  // Joined
  projectName?: string;
  projectColor?: string;
  userName?: string;
}

export interface CreateTimeEntryInput {
  projectId: string;
  durationMinutes: number;
  workDate: string;
  startTime?: string;
  endTime?: string;
  billable?: boolean;
  notes?: string;
  taskDescription?: string;
}

export interface UpdateTimeEntryInput extends Partial<CreateTimeEntryInput> {
  billed?: boolean;
  locked?: boolean;
  sortOrder?: number;
  isArchived?: boolean;
}

// ─── Project Settings ───────────────────────────────────────────────

export interface ProjectSettings {
  id: string;
  tenantId: string;
  defaultHourlyRate: number;
  companyName: string | null;
  companyAddress: string | null;
  companyLogo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProjectSettingsInput {
  defaultHourlyRate?: number;
  companyName?: string;
  companyAddress?: string;
  companyLogo?: string;
}

// ─── Reports ────────────────────────────────────────────────────────

export interface TimeReport {
  totalMinutes: number;
  billableMinutes: number;
  nonBillableMinutes: number;
  byProject: { projectId: string; projectName: string; minutes: number; billableMinutes: number }[];
  byUser: { userId: string; userName: string; minutes: number; billableMinutes: number }[];
  byDay: { date: string; minutes: number }[];
}

export interface RevenueReport {
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  byMonth: { month: string; invoiced: number; paid: number }[];
  byClient: { clientId: string; clientName: string; invoiced: number; paid: number }[];
}

export interface ProjectProfitability {
  projectId: string;
  projectName: string;
  totalHours: number;
  billableHours: number;
  estimatedAmount: number;
  billedAmount: number;
  paidAmount: number;
}

export interface TeamUtilization {
  userId: string;
  userName: string;
  totalMinutes: number;
  billableMinutes: number;
  utilizationRate: number;
}

// ─── Widget ─────────────────────────────────────────────────────────

export interface ProjectWidgetData {
  activeProjects: number;
  totalTrackedHoursThisWeek: number;
  pendingInvoiceAmount: number;
  overdueInvoiceCount: number;
}
