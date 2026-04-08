// ─── HR types ───────────────────────────────────────────────────────

export type EmployeeStatus = 'active' | 'on-leave' | 'terminated';
export type TimeOffType = string;
export type TimeOffStatus = 'pending' | 'approved' | 'rejected';

export interface Employee {
  id: string;
  tenantId: string;
  userId: string;
  linkedUserId: string | null;
  name: string;
  email: string;
  role: string;
  departmentId: string | null;
  startDate: string | null;
  phone: string | null;
  avatarUrl: string | null;
  status: EmployeeStatus;
  tags: string[];
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  departmentName?: string;
  departmentColor?: string;
}

export interface Department {
  id: string;
  tenantId: string;
  userId: string;
  name: string;
  headEmployeeId: string | null;
  color: string;
  description: string | null;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  employeeCount?: number;
  headEmployeeName?: string;
}

export interface TimeOffRequest {
  id: string;
  tenantId: string;
  userId: string;
  employeeId: string;
  type: TimeOffType;
  startDate: string;
  endDate: string;
  status: TimeOffStatus;
  approverId: string | null;
  notes: string | null;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  employeeName?: string;
  approverName?: string;
}

// ─── Create/Update inputs ───────────────────────────────────────────

export interface CreateEmployeeInput {
  name: string;
  email: string;
  role?: string;
  departmentId?: string | null;
  startDate?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  status?: EmployeeStatus;
  linkedUserId?: string | null;
  tags?: string[];
}

export interface UpdateEmployeeInput {
  name?: string;
  email?: string;
  role?: string;
  departmentId?: string | null;
  startDate?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  status?: EmployeeStatus;
  linkedUserId?: string | null;
  tags?: string[];
  sortOrder?: number;
  isArchived?: boolean;
}

export interface CreateDepartmentInput {
  name: string;
  headEmployeeId?: string | null;
  color?: string;
  description?: string | null;
}

export interface UpdateDepartmentInput {
  name?: string;
  headEmployeeId?: string | null;
  color?: string;
  description?: string | null;
  sortOrder?: number;
  isArchived?: boolean;
}

export interface CreateTimeOffRequestInput {
  employeeId: string;
  type: TimeOffType;
  startDate: string;
  endDate: string;
  approverId?: string | null;
  notes?: string | null;
}

export interface UpdateTimeOffRequestInput {
  type?: TimeOffType;
  startDate?: string;
  endDate?: string;
  status?: TimeOffStatus;
  approverId?: string | null;
  notes?: string | null;
  sortOrder?: number;
  isArchived?: boolean;
}
