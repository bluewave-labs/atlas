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
  name: z.string(),
  description: z.string().nullable(),
  createdAt: IsoDateTime,
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
  response: envelope(z.record(z.string(), z.unknown())) });

// Employees
register({ method: 'get', path: '/hr/employees', tags: [TAG], summary: 'List employees',
  query: z.object({ status: Employee.shape.status.optional(), departmentId: Uuid.optional() }),
  response: envelope(z.array(Employee)) });
register({ method: 'post', path: '/hr/employees', tags: [TAG], summary: 'Create an employee',
  body: Employee.omit({ id: true, tenantId: true, createdAt: true, updatedAt: true, isArchived: true }).partial()
    .extend({ name: z.string(), email: z.string().email() }),
  response: envelope(Employee) });
register({ method: 'get', path: '/hr/employees/:id', tags: [TAG], summary: 'Get an employee',
  params: z.object({ id: Uuid }), response: envelope(Employee) });
register({ method: 'patch', path: '/hr/employees/:id', tags: [TAG], summary: 'Update an employee',
  params: z.object({ id: Uuid }), body: Employee.partial(), concurrency: true, response: envelope(Employee) });
register({ method: 'delete', path: '/hr/employees/:id', tags: [TAG], summary: 'Delete (archive) an employee',
  params: z.object({ id: Uuid }) });

// Departments
register({ method: 'get', path: '/hr/departments', tags: [TAG], summary: 'List departments',
  response: envelope(z.array(Department)) });
register({ method: 'post', path: '/hr/departments', tags: [TAG], summary: 'Create a department',
  body: z.object({ name: z.string(), description: z.string().optional() }),
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

// Balances
register({ method: 'get', path: '/hr/leave-balances', tags: [TAG], summary: 'List leave balances',
  query: z.object({ employeeId: Uuid.optional(), year: z.coerce.number().int().optional() }),
  response: envelope(z.array(z.object({
    id: Uuid, employeeId: Uuid, leaveTypeId: Uuid.nullable(),
    year: z.number().int(), allocated: z.number().int(),
    used: z.number().int(), carried: z.number().int(),
  }))) });

// Attendance
register({ method: 'get', path: '/hr/attendance', tags: [TAG], summary: 'List attendance records',
  query: z.object({ employeeId: Uuid.optional(), from: IsoDate.optional(), to: IsoDate.optional() }),
  response: envelope(z.array(Attendance)) });
register({ method: 'post', path: '/hr/attendance', tags: [TAG], summary: 'Create/update an attendance record',
  body: Attendance.omit({ id: true }).partial().extend({ employeeId: Uuid, date: IsoDate }),
  response: envelope(Attendance) });
register({ method: 'patch', path: '/hr/attendance/:id', tags: [TAG], summary: 'Update an attendance record',
  params: z.object({ id: Uuid }), body: Attendance.partial(), response: envelope(Attendance) });
register({ method: 'delete', path: '/hr/attendance/:id', tags: [TAG], summary: 'Delete an attendance record',
  params: z.object({ id: Uuid }) });

// Onboarding
register({ method: 'get', path: '/hr/onboarding/:employeeId', tags: [TAG], summary: 'List onboarding tasks for an employee',
  params: z.object({ employeeId: Uuid }), response: envelope(z.array(OnboardingTask)) });
register({ method: 'post', path: '/hr/onboarding', tags: [TAG], summary: 'Create an onboarding task',
  body: OnboardingTask.omit({ id: true, completedAt: true, completedBy: true }).partial().extend({
    employeeId: Uuid, title: z.string(),
  }),
  response: envelope(OnboardingTask) });
register({ method: 'patch', path: '/hr/onboarding/:id', tags: [TAG], summary: 'Update an onboarding task',
  params: z.object({ id: Uuid }), body: OnboardingTask.partial(), response: envelope(OnboardingTask) });
register({ method: 'post', path: '/hr/onboarding/:id/complete', tags: [TAG], summary: 'Mark an onboarding task as complete',
  params: z.object({ id: Uuid }) });
register({ method: 'delete', path: '/hr/onboarding/:id', tags: [TAG], summary: 'Delete an onboarding task',
  params: z.object({ id: Uuid }) });

// Expenses (summary — full policy surface intentionally omitted)
register({ method: 'get', path: '/hr/expenses', tags: [TAG], summary: 'List expense reports',
  query: z.object({ employeeId: Uuid.optional(), status: z.string().optional() }),
  response: envelope(z.array(z.record(z.string(), z.unknown()))) });
register({ method: 'post', path: '/hr/expenses', tags: [TAG], summary: 'Create an expense report',
  body: z.record(z.string(), z.unknown()),
  response: envelope(z.record(z.string(), z.unknown())) });
register({ method: 'post', path: '/hr/expenses/:id/submit', tags: [TAG], summary: 'Submit an expense report for approval',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/hr/expenses/:id/approve', tags: [TAG], summary: 'Approve an expense report',
  params: z.object({ id: Uuid }) });
register({ method: 'post', path: '/hr/expenses/:id/reject', tags: [TAG], summary: 'Reject an expense report',
  params: z.object({ id: Uuid }) });
