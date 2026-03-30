// ─── Project Client ─────────────────────────────────────────────────

export interface ProjectClient {
  id: string;
  accountId: string;
  userId: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  currency: string | null;
  logo: string | null;
  portalToken: string | null;
  notes: string | null;
  isArchived: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  // Computed
  projectCount?: number;
  totalBilled?: number;
}

export interface CreateProjectClientInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  currency?: string;
  logo?: string;
  notes?: string;
}

export interface UpdateProjectClientInput extends Partial<CreateProjectClientInput> {
  sortOrder?: number;
  isArchived?: boolean;
}

// ─── Project ────────────────────────────────────────────────────────

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface Project {
  id: string;
  accountId: string;
  userId: string;
  clientId: string | null;
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
  clientName?: string;
  totalTrackedMinutes?: number;
  totalBilledAmount?: number;
}

export interface CreateProjInput {
  name: string;
  clientId?: string;
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

export type ProjectMemberRole = 'manager' | 'member';

export interface ProjectMember {
  id: string;
  userId: string;
  projectId: string;
  hourlyRate: number | null;
  role: ProjectMemberRole;
  createdAt: string;
  updatedAt: string;
  // Joined
  userName?: string;
  userEmail?: string;
}

// ─── Time Entry ─────────────────────────────────────────────────────

export interface TimeEntry {
  id: string;
  accountId: string;
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

// ─── Invoice ────────────────────────────────────────────────────────

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'overdue' | 'paid' | 'waived';

export interface Invoice {
  id: string;
  accountId: string;
  userId: string;
  clientId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  amount: number;
  tax: number;
  taxAmount: number;
  discount: number;
  discountAmount: number;
  currency: string;
  issueDate: string | null;
  dueDate: string | null;
  notes: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  paidAt: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  // Joined
  clientName?: string;
  lineItems?: InvoiceLineItem[];
}

export interface CreateInvoiceInput {
  clientId: string;
  invoiceNumber?: string;
  status?: InvoiceStatus;
  amount?: number;
  tax?: number;
  taxAmount?: number;
  discount?: number;
  discountAmount?: number;
  currency?: string;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
}

export interface UpdateInvoiceInput extends Partial<CreateInvoiceInput> {
  isArchived?: boolean;
}

// ─── Invoice Line Item ──────────────────────────────────────────────

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  timeEntryId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceLineItemInput {
  invoiceId: string;
  timeEntryId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface UpdateInvoiceLineItemInput extends Partial<Omit<CreateInvoiceLineItemInput, 'invoiceId'>> {}

// ─── Project Settings ───────────────────────────────────────────────

export interface ProjectSettings {
  id: string;
  accountId: string;
  invoicePrefix: string;
  defaultHourlyRate: number;
  companyName: string | null;
  companyAddress: string | null;
  companyLogo: string | null;
  nextInvoiceNumber: number;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProjectSettingsInput {
  invoicePrefix?: string;
  defaultHourlyRate?: number;
  companyName?: string;
  companyAddress?: string;
  companyLogo?: string;
  nextInvoiceNumber?: number;
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
