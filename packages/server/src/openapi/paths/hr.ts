import { z } from 'zod';
import { register, envelope, Uuid, IsoDateTime, IsoDate } from '../_helpers';

const TAG = 'HR';

const Employee = z.object({
  id: Uuid,
  tenantId: Uuid,
  linkedUserId: Uuid.nullable(),
  name: z.string(),
  email: z.string().email(),
  role: z.string(),
  departmentId: Uuid.nullable(),
  startDate: z.string().nullable(),
  phone: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  status: z.enum(['active', 'onboarding', 'offboarded', 'on_leave']),
  tags: z.array(z.string()),
  dateOfBirth: z.string().nullable(),
  gender: z.string().nullable(),
  emergencyContactName: z.string().nullable(),
  emergencyContactPhone: z.string().nullable(),
  emergencyContactRelation: z.string().nullable(),
  employmentType: z.enum(['full-time', 'part-time', 'contractor', 'intern']),
  managerId: Uuid.nullable(),
  jobTitle: z.string().nullable(),
  workLocation: z.string().nullable(),
  salary: z.number().int().nullable(),
  salaryCurrency: z.string(),
  salaryPeriod: z.enum(['hourly', 'monthly', 'yearly']),
  isArchived: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

const Department = z.object({
  id: Uuid,
  tenantId: Uuid,
  name: z.string(),
  description: z.string().nullable(),
  color: z.string().nullable(),
  headEmployeeId: Uuid.nullable(),
  sortOrder: z.number().int(),
  isArchived: z.boolean(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

const LeaveType = z.object({
  id: Uuid,
  name: z.string(),
  slug: z.string(),
  color: z.string(),
  defaultDaysPerYear: z.number().int(),
  maxCarryForward: z.number().int(),
  requiresApproval: z.boolean(),
  isPaid: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

const LeavePolicy = z.object({
  id: Uuid,
  name: z.string(),
  description: z.string().nullable(),
  isDefault: z.boolean(),
  allocations: z.array(z.object({ leaveTypeId: Uuid, daysPerYear: z.number() })),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

const HolidayCalendar = z.object({
  id: Uuid,
  name: z.string(),
  year: z.number().int(),
  description: z.string().nullable(),
  isDefault: z.boolean(),
  createdAt: IsoDateTime,
});

const Holiday = z.object({
  id: Uuid,
  calendarId: Uuid,
  name: z.string(),
  date: IsoDate,
  description: z.string().nullable(),
  type: z.string(),
  isRecurring: z.boolean(),
});

const LeaveApplication = z.object({
  id: Uuid,
  employeeId: Uuid,
  leaveTypeId: Uuid,
  startDate: IsoDate,
  endDate: IsoDate,
  halfDay: z.boolean(),
  halfDayDate: IsoDate.nullable(),
  totalDays: z.number(),
  reason: z.string().nullable(),
  status: z.enum(['draft', 'pending', 'approved', 'rejected', 'cancelled']),
  approverId: Uuid.nullable(),
  approverComment: z.string().nullable(),
  approvedAt: IsoDateTime.nullable(),
  rejectedAt: IsoDateTime.nullable(),
  balanceBefore: z.number().nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
});

const Attendance = z.object({
  id: Uuid,
  employeeId: Uuid,
  date: IsoDate,
  status: z.enum(['present', 'absent', 'late', 'half_day', 'leave', 'holiday']),
  checkInTime: z.string().nullable(),
  checkOutTime: z.string().nullable(),
  workingHours: z.number().nullable(),
  notes: z.string().nullable(),
});

const OnboardingTask = z.object({
  id: Uuid,
  employeeId: Uuid,
  title: z.string(),
  description: z.string().nullable(),
  category: z.string(),
  dueDate: IsoDate.nullable(),
  completedAt: IsoDateTime.nullable(),
  completedBy: Uuid.nullable(),
  sortOrder: z.number().int(),
});

// Widget / dashboard
register({ method: 'get', path: '/hr/widget', tags: [TAG], summary: 'Get HR widget data for home',
  response: envelope(z.record(z.string(), z.unknown())) });
register({ method: 'get', path: '/hr/dashboard', tags: [TAG], summary: 'Get HR dashboard KPIs',
  response: envelope(z.object({
    totalHeadcount: z.number().int(),
    statusCounts: z.record(z.string(), z.number().int()),
    departmentCounts: z.array(z.object({ departmentId: Uuid.nullable(), name: z.string(), count: z.number().int() })),
    typeCounts: z.record(z.string(), z.number().int()),
    upcomingBirthdays: z.array(z.record(z.string(), z.unknown())),
    pendingRequests: z.number().int(),
    approvedDaysThisMonth: z.number().int(),
    recentHires: z.array(z.record(z.string(), z.unknown())),
    tenure: z.record(z.string(), z.unknown()),
  })) });

// Employees
// NOTE: the HR app mounts employees at the app root — the concrete URLs are
// `GET /api/v1/hr/` and `POST /api/v1/hr/` (Express matches both with and
// without the trailing slash). Historical quirk, not the cleaner
// /hr/employees path one would expect.
register({ method: 'get', path: '/hr', tags: [TAG], summary: 'List employees',
  query: z.object({ status: Employee.shape.status.optional(), departmentId: Uuid.optional() }),
  response: envelope(z.object({ employees: z.array(Employee) })) });
register({ method: 'post', path: '/hr', tags: [TAG], summary: 'Create an employee',
  body: Employee.omit({ id: true, tenantId: true, createdAt: true, updatedAt: true, isArchived: true }).partial()
    .extend({ name: z.string(), email: z.string().email() }),
  response: envelope(Employee) });
register({ method: 'get', path: '/hr/:id', tags: [TAG], summary: 'Get an employee',
  params: z.object({ id: Uuid }), response: envelope(Employee) });
register({ method: 'patch', path: '/hr/:id', tags: [TAG], summary: 'Update an employee',
  params: z.object({ id: Uuid }), body: Employee.partial(), concurrency: true, response: envelope(Employee) });
register({ method: 'delete', path: '/hr/:id', tags: [TAG], summary: 'Delete (archive) an employee',
  params: z.object({ id: Uuid }) });

// Departments
register({ method: 'get', path: '/hr/departments/list', tags: [TAG], summary: 'List departments',
  response: envelope(z.object({ departments: z.array(Department.extend({
    userId: Uuid,
    headEmployeeId: Uuid.nullable(),
    color: z.string().nullable(),
    sortOrder: z.number().int(),
    isArchived: z.boolean(),
    updatedAt: IsoDateTime,
    employeeCount: z.number().int(),
  })) })) });
register({ method: 'post', path: '/hr/departments', tags: [TAG], summary: 'Create a department',
  body: z.object({ name: z.string(), description: z.string().optional(), color: z.string().optional() }),
  response: envelope(Department) });
register({ method: 'patch', path: '/hr/departments/:id', tags: [TAG], summary: 'Update a department',
  params: z.object({ id: Uuid }), body: Department.partial(), response: envelope(Department) });
register({ method: 'delete', path: '/hr/departments/:id', tags: [TAG], summary: 'Delete a department',
  params: z.object({ id: Uuid }) });

// Leave types
register({ method: 'get', path: '/hr/leave-types', tags: [TAG], summary: 'List leave types',
  response: envelope(z.array(LeaveType)) });
register({ method: 'post', path: '/hr/leave-types', tags: [TAG], summary: 'Create a leave type',
  body: LeaveType.omit({ id: true, createdAt: true, updatedAt: true }).partial()
    .extend({ name: z.string(), slug: z.string() }),
  response: envelope(LeaveType) });
register({ method: 'patch', path: '/hr/leave-types/:id', tags: [TAG], summary: 'Update a leave type',
  params: z.object({ id: Uuid }), body: LeaveType.partial(), concurrency: true, response: envelope(LeaveType) });
register({ method: 'delete', path: '/hr/leave-types/:id', tags: [TAG], summary: 'Delete a leave type',
  params: z.object({ id: Uuid }) });

// Leave policies
register({ method: 'get', path: '/hr/leave-policies', tags: [TAG], summary: 'List leave policies',
  response: envelope(z.array(LeavePolicy)) });
register({ method: 'post', path: '/hr/leave-policies', tags: [TAG], summary: 'Create a leave policy',
  body: LeavePolicy.omit({ id: true, createdAt: true, updatedAt: true }).partial().extend({ name: z.string() }),
  response: envelope(LeavePolicy) });
register({ method: 'patch', path: '/hr/leave-policies/:id', tags: [TAG], summary: 'Update a leave policy',
  params: z.object({ id: Uuid }), body: LeavePolicy.partial(), concurrency: true, response: envelope(LeavePolicy) });
register({ method: 'delete', path: '/hr/leave-policies/:id', tags: [TAG], summary: 'Delete a leave policy',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/hr/leave-policies/:id/resync', tags: [TAG], summary: 'Resync balances for employees on this policy',
  params: z.object({ id: Uuid }) });

// Holiday calendars
register({ method: 'get', path: '/hr/holiday-calendars', tags: [TAG], summary: 'List holiday calendars',
  response: envelope(z.array(HolidayCalendar)) });
register({ method: 'post', path: '/hr/holiday-calendars', tags: [TAG], summary: 'Create a holiday calendar',
  body: z.object({ name: z.string(), year: z.number().int(), description: z.string().optional() }),
  response: envelope(HolidayCalendar) });
register({ method: 'patch', path: '/hr/holiday-calendars/:id', tags: [TAG], summary: 'Update a holiday calendar',
  params: z.object({ id: Uuid }), body: HolidayCalendar.partial(), response: envelope(HolidayCalendar) });
register({ method: 'delete', path: '/hr/holiday-calendars/:id', tags: [TAG], summary: 'Delete a holiday calendar',
  params: z.object({ id: Uuid }) });
register({ method: 'get', path: '/hr/holiday-calendars/:id/holidays', tags: [TAG], summary: 'List holidays in a calendar',
  params: z.object({ id: Uuid }), response: envelope(z.array(Holiday)) });
register({ method: 'post', path: '/hr/holidays', tags: [TAG], summary: 'Create a holiday',
  body: Holiday.omit({ id: true }).partial().extend({
    calendarId: Uuid, name: z.string(), date: IsoDate,
  }),
  response: envelope(Holiday) });
register({ method: 'post', path: '/hr/holidays/bulk-import', tags: [TAG], summary: 'Bulk import holidays',
  body: z.object({ calendarId: Uuid, holidays: z.array(Holiday.omit({ id: true, calendarId: true })) }) });
register({ method: 'patch', path: '/hr/holidays/:id', tags: [TAG], summary: 'Update a holiday',
  params: z.object({ id: Uuid }), body: Holiday.partial(), response: envelope(Holiday) });
register({ method: 'delete', path: '/hr/holidays/:id', tags: [TAG], summary: 'Delete a holiday',
  params: z.object({ id: Uuid }) });

// Leave applications
register({ method: 'get', path: '/hr/leave-applications', tags: [TAG], summary: 'List leave applications',
  query: z.object({ employeeId: Uuid.optional(), status: LeaveApplication.shape.status.optional() }),
  response: envelope(z.array(LeaveApplication)) });
register({ method: 'post', path: '/hr/leave-applications', tags: [TAG], summary: 'Submit a leave application',
  body: LeaveApplication.omit({
    id: true, status: true, approverId: true, approverComment: true, approvedAt: true, rejectedAt: true,
    balanceBefore: true, totalDays: true, createdAt: true, updatedAt: true,
  }).partial().extend({ employeeId: Uuid, leaveTypeId: Uuid, startDate: IsoDate, endDate: IsoDate }),
  response: envelope(LeaveApplication) });
register({ method: 'patch', path: '/hr/leave-applications/:id', tags: [TAG], summary: 'Update a leave application',
  params: z.object({ id: Uuid }), body: LeaveApplication.partial(), concurrency: true, response: envelope(LeaveApplication) });
register({ method: 'post', path: '/hr/leave-applications/:id/approve', tags: [TAG], summary: 'Approve a leave application',
  params: z.object({ id: Uuid }), body: z.object({ comment: z.string().optional() }) });
register({ method: 'post', path: '/hr/leave-applications/:id/reject', tags: [TAG], summary: 'Reject a leave application',
  params: z.object({ id: Uuid }), body: z.object({ comment: z.string().optional() }) });
register({ method: 'post', path: '/hr/leave-applications/:id/cancel', tags: [TAG], summary: 'Cancel a leave application',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/hr/leave-applications/:id/submit', tags: [TAG], summary: 'Submit a draft leave application',
  params: z.object({ id: Uuid }) });
register({ method: 'get', path: '/hr/leave-applications/pending', tags: [TAG], summary: 'List leave applications awaiting my approval',
  response: envelope(z.array(LeaveApplication)) });

register({ method: 'get', path: '/hr/leave-balances/summary', tags: [TAG], summary: 'Summarize leave balances across all employees (admin)',
  response: envelope(z.record(z.string(), z.unknown())) });
register({ method: 'post', path: '/hr/leave-balances/allocate', tags: [TAG], summary: 'Bulk-allocate leave balances (admin)',
  body: z.object({
    year: z.number().int(),
    leaveTypeId: Uuid,
    employeeIds: z.array(Uuid).optional(),
    amount: z.number().int(),
  }) });

register({ method: 'get', path: '/hr/leave-calendar', tags: [TAG], summary: 'Team leave calendar for a date range',
  query: z.object({ from: IsoDate, to: IsoDate }),
  response: envelope(z.array(z.record(z.string(), z.unknown()))) });

// Balances — per-employee only (there's no flat /hr/leave-balances route)
register({ method: 'get', path: '/hr/:id/leave-balances', tags: [TAG], summary: 'Get leave balances for an employee',
  params: z.object({ id: Uuid }),
  response: envelope(z.array(z.object({
    id: Uuid, employeeId: Uuid, leaveTypeId: Uuid.nullable(),
    year: z.number().int(), allocated: z.number().int(),
    used: z.number().int(), carried: z.number().int(),
  }))) });
register({ method: 'post', path: '/hr/:id/leave-balances', tags: [TAG], summary: 'Allocate a leave balance for an employee',
  params: z.object({ id: Uuid }),
  body: z.object({ leaveTypeId: Uuid, year: z.number().int(), allocated: z.number().int() }) });

// Attendance
register({ method: 'get', path: '/hr/attendance', tags: [TAG], summary: 'List attendance records',
  query: z.object({ employeeId: Uuid.optional(), from: IsoDate.optional(), to: IsoDate.optional() }),
  response: envelope(z.array(Attendance)) });
register({ method: 'post', path: '/hr/attendance', tags: [TAG], summary: 'Create/update an attendance record',
  body: Attendance.omit({ id: true }).partial().extend({ employeeId: Uuid, date: IsoDate }),
  response: envelope(Attendance) });
register({ method: 'post', path: '/hr/attendance/bulk', tags: [TAG], summary: 'Bulk upsert attendance records',
  body: z.object({ records: z.array(Attendance.omit({ id: true }).partial().extend({ employeeId: Uuid, date: IsoDate })) }) });
register({ method: 'patch', path: '/hr/attendance/:id', tags: [TAG], summary: 'Update an attendance record',
  params: z.object({ id: Uuid }), body: Attendance.partial(),
  response: envelope(Attendance) });
register({ method: 'get', path: '/hr/attendance/today', tags: [TAG], summary: 'Get today’s attendance roll-up',
  response: envelope(z.array(Attendance)) });
register({ method: 'get', path: '/hr/attendance/report', tags: [TAG], summary: 'Attendance report by date range',
  query: z.object({ from: IsoDate, to: IsoDate }),
  response: envelope(z.record(z.string(), z.unknown())) });
register({ method: 'get', path: '/hr/:id/attendance', tags: [TAG], summary: 'Get attendance records for an employee',
  params: z.object({ id: Uuid }),
  response: envelope(z.array(Attendance)) });

// Onboarding — nested under /:id (employee)
register({ method: 'get', path: '/hr/:id/onboarding', tags: [TAG], summary: 'List onboarding tasks for an employee',
  params: z.object({ id: Uuid }),
  response: envelope(z.array(OnboardingTask)) });
register({ method: 'post', path: '/hr/:id/onboarding', tags: [TAG], summary: 'Create an onboarding task for an employee',
  params: z.object({ id: Uuid }),
  body: OnboardingTask.omit({ id: true, employeeId: true, completedAt: true, completedBy: true }).partial().extend({ title: z.string() }),
  response: envelope(OnboardingTask) });
register({ method: 'post', path: '/hr/:id/onboarding/from-template', tags: [TAG], summary: 'Seed onboarding tasks from a template',
  params: z.object({ id: Uuid }),
  body: z.object({ templateId: Uuid }) });
register({ method: 'patch', path: '/hr/onboarding/:taskId', tags: [TAG], summary: 'Update an onboarding task',
  params: z.object({ taskId: Uuid }), body: OnboardingTask.partial(),
  response: envelope(OnboardingTask) });
register({ method: 'delete', path: '/hr/onboarding/:taskId', tags: [TAG], summary: 'Delete an onboarding task',
  params: z.object({ taskId: Uuid }) });

// Onboarding templates (tenant-level)
const OnboardingTemplate = z.object({
  id: Uuid, tenantId: Uuid, name: z.string(),
  tasks: z.array(z.record(z.string(), z.unknown())),
  createdAt: IsoDateTime,
});
register({ method: 'get', path: '/hr/onboarding-templates', tags: [TAG], summary: 'List onboarding templates',
  response: envelope(z.array(OnboardingTemplate)) });
register({ method: 'post', path: '/hr/onboarding-templates', tags: [TAG], summary: 'Create an onboarding template',
  body: z.object({ name: z.string(), tasks: z.array(z.record(z.string(), z.unknown())) }),
  response: envelope(OnboardingTemplate) });

// Time-off (distinct from leave-applications — this is the simpler "book time off" flow)
const TimeOff = z.object({
  id: Uuid, tenantId: Uuid, employeeId: Uuid,
  startDate: IsoDate, endDate: IsoDate,
  type: z.string(), reason: z.string().nullable(),
  status: z.enum(['pending', 'approved', 'rejected']),
  createdAt: IsoDateTime,
});
register({ method: 'get', path: '/hr/time-off/list', tags: [TAG], summary: 'List time-off requests',
  query: z.object({ employeeId: Uuid.optional(), status: TimeOff.shape.status.optional() }),
  response: envelope(z.array(TimeOff)) });
register({ method: 'post', path: '/hr/time-off', tags: [TAG], summary: 'Create a time-off request',
  body: TimeOff.omit({ id: true, tenantId: true, status: true, createdAt: true }).partial()
    .extend({ employeeId: Uuid, startDate: IsoDate, endDate: IsoDate, type: z.string() }),
  response: envelope(TimeOff) });
register({ method: 'patch', path: '/hr/time-off/:id', tags: [TAG], summary: 'Update a time-off request',
  params: z.object({ id: Uuid }), body: TimeOff.partial(),
  response: envelope(TimeOff) });
register({ method: 'delete', path: '/hr/time-off/:id', tags: [TAG], summary: 'Delete a time-off request',
  params: z.object({ id: Uuid }) });

// Employee document download
register({ method: 'get', path: '/hr/documents/:docId/download', tags: [TAG], summary: 'Download an HR document',
  params: z.object({ docId: Uuid }),
  extraResponses: { 200: { description: 'File binary', schema: z.string().openapi({ format: 'binary' }) } } });

// Seed routes (admin-only — populate demo data)
for (const [path, what] of [
  ['/hr/seed', 'all HR demo data'],
  ['/hr/leave-types/seed', 'default leave types'],
  ['/hr/leave-policies/seed', 'default leave policies'],
  ['/hr/expense-categories/seed', 'default expense categories'],
] as const) {
  register({ method: 'post', path, tags: [TAG], summary: `Seed ${what} (admin only)` });
}

// Employee documents
register({ method: 'get', path: '/hr/:id/documents', tags: [TAG], summary: 'List HR documents attached to an employee',
  params: z.object({ id: Uuid }),
  response: envelope(z.array(z.record(z.string(), z.unknown()))) });
register({ method: 'post', path: '/hr/:id/documents', tags: [TAG], summary: 'Upload an HR document (multipart/form-data)',
  params: z.object({ id: Uuid }),
  response: envelope(z.record(z.string(), z.unknown())) });
register({ method: 'delete', path: '/hr/documents/:docId', tags: [TAG], summary: 'Delete an HR document',
  params: z.object({ docId: Uuid }) });

// Employee lifecycle events
register({ method: 'get', path: '/hr/:id/lifecycle', tags: [TAG], summary: 'Get lifecycle timeline for an employee',
  params: z.object({ id: Uuid }),
  response: envelope(z.array(z.record(z.string(), z.unknown()))) });
register({ method: 'post', path: '/hr/:id/lifecycle', tags: [TAG], summary: 'Add a lifecycle event for an employee',
  params: z.object({ id: Uuid }),
  body: z.record(z.string(), z.unknown()) });
register({ method: 'delete', path: '/hr/lifecycle/:id', tags: [TAG], summary: 'Delete a lifecycle event',
  params: z.object({ id: Uuid }) });

// Employee policy assignment
register({ method: 'post', path: '/hr/:id/assign-policy', tags: [TAG], summary: 'Assign a leave policy to an employee',
  params: z.object({ id: Uuid }),
  body: z.object({ policyId: Uuid, effectiveFrom: IsoDate.optional() }) });
register({ method: 'get', path: '/hr/:id/policy', tags: [TAG], summary: 'Get the currently assigned leave policy for an employee',
  params: z.object({ id: Uuid }),
  response: envelope(LeavePolicy.nullable()) });

// Employee helpers
register({ method: 'get', path: '/hr/search', tags: [TAG], summary: 'Search employees by name/email',
  query: z.object({ q: z.string().min(1) }),
  response: envelope(z.array(Employee)) });
register({ method: 'get', path: '/hr/counts', tags: [TAG], summary: 'Employee counts by status/department/type',
  response: envelope(z.record(z.string(), z.unknown())) });
register({ method: 'get', path: '/hr/working-days', tags: [TAG], summary: 'Compute working-day count for a date range',
  query: z.object({ from: IsoDate, to: IsoDate }),
  response: envelope(z.object({ workingDays: z.number().int() })) });

// Expenses
const Expense = z.object({
  id: Uuid, tenantId: Uuid, employeeId: Uuid,
  categoryId: Uuid.nullable(), reportId: Uuid.nullable(),
  amount: z.number(), currency: z.string(),
  expenseDate: IsoDate,
  description: z.string().nullable(),
  status: z.enum(['draft', 'submitted', 'approved', 'refused', 'paid']),
  receiptUrl: z.string().nullable(),
  createdAt: IsoDateTime, updatedAt: IsoDateTime,
});

register({ method: 'get', path: '/hr/expenses/list', tags: [TAG], summary: 'List expenses',
  query: z.object({ employeeId: Uuid.optional(), status: Expense.shape.status.optional() }),
  response: envelope(z.array(Expense)) });
register({ method: 'get', path: '/hr/expenses/my', tags: [TAG], summary: 'List my own expenses',
  response: envelope(z.array(Expense)) });
register({ method: 'get', path: '/hr/expenses/pending', tags: [TAG], summary: 'List expenses awaiting my approval',
  response: envelope(z.array(Expense)) });
register({ method: 'get', path: '/hr/expenses/pending/count', tags: [TAG], summary: 'Count of expenses awaiting my approval',
  response: envelope(z.object({ count: z.number().int() })) });
register({ method: 'get', path: '/hr/expenses/dashboard', tags: [TAG], summary: 'Expense dashboard KPIs',
  response: envelope(z.record(z.string(), z.unknown())) });
register({ method: 'post', path: '/hr/expenses', tags: [TAG], summary: 'Create an expense',
  body: Expense.omit({ id: true, tenantId: true, createdAt: true, updatedAt: true, status: true }).partial()
    .extend({ employeeId: Uuid, amount: z.number(), currency: z.string().length(3), expenseDate: IsoDate }),
  response: envelope(Expense) });
register({ method: 'post', path: '/hr/expenses/bulk-pay', tags: [TAG], summary: 'Bulk-mark expenses as paid',
  body: z.object({ expenseIds: z.array(Uuid) }) });
register({ method: 'get', path: '/hr/expenses/:id', tags: [TAG], summary: 'Get an expense',
  params: z.object({ id: Uuid }), response: envelope(Expense) });
register({ method: 'patch', path: '/hr/expenses/:id', tags: [TAG], summary: 'Update an expense',
  params: z.object({ id: Uuid }), body: Expense.partial(), concurrency: true, response: envelope(Expense) });
register({ method: 'delete', path: '/hr/expenses/:id', tags: [TAG], summary: 'Delete an expense',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/hr/expenses/:id/submit', tags: [TAG], summary: 'Submit an expense for approval',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/hr/expenses/:id/recall', tags: [TAG], summary: 'Recall a submitted expense',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/hr/expenses/:id/approve', tags: [TAG], summary: 'Approve an expense',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/hr/expenses/:id/refuse', tags: [TAG], summary: 'Refuse an expense',
  params: z.object({ id: Uuid }), body: z.object({ reason: z.string().optional() }) });

// Expense categories
const ExpenseCategory = z.object({
  id: Uuid, tenantId: Uuid, name: z.string(), description: z.string().nullable(),
  isArchived: z.boolean(), createdAt: IsoDateTime,
});
register({ method: 'get', path: '/hr/expense-categories/list', tags: [TAG], summary: 'List expense categories',
  response: envelope(z.array(ExpenseCategory)) });
register({ method: 'post', path: '/hr/expense-categories/reorder', tags: [TAG], summary: 'Reorder expense categories',
  body: z.object({ categoryIds: z.array(Uuid) }) });
register({ method: 'post', path: '/hr/expense-categories', tags: [TAG], summary: 'Create an expense category',
  body: z.object({ name: z.string(), description: z.string().optional() }),
  response: envelope(ExpenseCategory) });
register({ method: 'patch', path: '/hr/expense-categories/:id', tags: [TAG], summary: 'Update an expense category',
  params: z.object({ id: Uuid }), body: ExpenseCategory.partial(),
  response: envelope(ExpenseCategory) });
register({ method: 'delete', path: '/hr/expense-categories/:id', tags: [TAG], summary: 'Delete an expense category',
  params: z.object({ id: Uuid }) });

// Expense policies
const ExpensePolicy = z.object({
  id: Uuid, tenantId: Uuid, name: z.string(),
  rules: z.record(z.string(), z.unknown()),
  isArchived: z.boolean(), createdAt: IsoDateTime, updatedAt: IsoDateTime,
});
register({ method: 'get', path: '/hr/expense-policies/list', tags: [TAG], summary: 'List expense policies',
  response: envelope(z.array(ExpensePolicy)) });
register({ method: 'post', path: '/hr/expense-policies', tags: [TAG], summary: 'Create an expense policy',
  body: z.object({ name: z.string(), rules: z.record(z.string(), z.unknown()).optional() }),
  response: envelope(ExpensePolicy) });
register({ method: 'get', path: '/hr/expense-policies/:id', tags: [TAG], summary: 'Get an expense policy',
  params: z.object({ id: Uuid }), response: envelope(ExpensePolicy) });
register({ method: 'patch', path: '/hr/expense-policies/:id', tags: [TAG], summary: 'Update an expense policy',
  params: z.object({ id: Uuid }), body: ExpensePolicy.partial(),
  concurrency: true, response: envelope(ExpensePolicy) });
register({ method: 'delete', path: '/hr/expense-policies/:id', tags: [TAG], summary: 'Delete an expense policy',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/hr/expense-policies/:id/assign', tags: [TAG], summary: 'Assign an expense policy to employees',
  params: z.object({ id: Uuid }),
  body: z.object({ employeeIds: z.array(Uuid) }) });
register({ method: 'delete', path: '/hr/expense-policies/:id/assign/:assignmentId', tags: [TAG], summary: 'Remove an expense policy assignment',
  params: z.object({ id: Uuid, assignmentId: Uuid }) });

// Expense reports
const ExpenseReport = z.object({
  id: Uuid, tenantId: Uuid, employeeId: Uuid,
  title: z.string(), status: z.enum(['draft', 'submitted', 'approved', 'refused']),
  totalAmount: z.number(), currency: z.string(),
  createdAt: IsoDateTime, updatedAt: IsoDateTime,
});
register({ method: 'get', path: '/hr/expense-reports/list', tags: [TAG], summary: 'List expense reports',
  query: z.object({ employeeId: Uuid.optional(), status: ExpenseReport.shape.status.optional() }),
  response: envelope(z.array(ExpenseReport)) });
register({ method: 'get', path: '/hr/expense-reports/my', tags: [TAG], summary: 'List my own expense reports',
  response: envelope(z.array(ExpenseReport)) });
register({ method: 'post', path: '/hr/expense-reports', tags: [TAG], summary: 'Create an expense report',
  body: z.object({ title: z.string(), currency: z.string().length(3), expenseIds: z.array(Uuid).optional() }),
  response: envelope(ExpenseReport) });
register({ method: 'get', path: '/hr/expense-reports/:id', tags: [TAG], summary: 'Get an expense report',
  params: z.object({ id: Uuid }), response: envelope(ExpenseReport) });
register({ method: 'patch', path: '/hr/expense-reports/:id', tags: [TAG], summary: 'Update an expense report',
  params: z.object({ id: Uuid }), body: ExpenseReport.partial(), concurrency: true,
  response: envelope(ExpenseReport) });
register({ method: 'delete', path: '/hr/expense-reports/:id', tags: [TAG], summary: 'Delete an expense report',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/hr/expense-reports/:id/submit', tags: [TAG], summary: 'Submit an expense report',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/hr/expense-reports/:id/approve', tags: [TAG], summary: 'Approve an expense report',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/hr/expense-reports/:id/refuse', tags: [TAG], summary: 'Refuse an expense report',
  params: z.object({ id: Uuid }), body: z.object({ reason: z.string().optional() }) });
