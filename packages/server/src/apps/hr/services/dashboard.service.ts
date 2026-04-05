import { db } from '../../../config/database';
import {
  employees, departments, timeOffRequests, hrLeaveApplications,
} from '../../../db/schema';
import { eq, and, sql, gte, lte } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import { createEmployee, updateEmployee } from './employee.service';
import { createDepartment, updateDepartment } from './department.service';
import { createTimeOffRequest, updateTimeOffRequest, allocateLeave } from './time-off.service';
import { seedDefaultLeaveTypes } from './leave-config.service';
import { seedDefaultTemplate } from './onboarding.service';

const UNASSIGNED_DEPT_COLOR = '#94a3b8';

// ─── Dashboard ─────────────────────────────────────────────────────

export async function getDashboardData(userId: string, accountId: string) {
  const allEmployees = await db
    .select()
    .from(employees)
    .where(and(eq(employees.userId, userId), eq(employees.accountId, accountId), eq(employees.isArchived, false)));

  const allDepartments = await db
    .select()
    .from(departments)
    .where(and(eq(departments.userId, userId), eq(departments.accountId, accountId), eq(departments.isArchived, false)));

  const allTimeOff = await db
    .select()
    .from(timeOffRequests)
    .where(and(eq(timeOffRequests.userId, userId), eq(timeOffRequests.accountId, accountId), eq(timeOffRequests.isArchived, false)));

  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Count by status
  const statusCounts: Record<string, number> = { active: 0, 'on-leave': 0, terminated: 0 };
  for (const emp of allEmployees) {
    if (emp.status in statusCounts) statusCounts[emp.status]++;
  }

  // Count by department
  const departmentCounts: { name: string; color: string; count: number }[] = [];
  for (const dept of allDepartments) {
    const count = allEmployees.filter((e) => e.departmentId === dept.id).length;
    departmentCounts.push({ name: dept.name, color: dept.color, count });
  }
  const noDeptCount = allEmployees.filter((e) => !e.departmentId).length;
  if (noDeptCount > 0) {
    departmentCounts.push({ name: 'Unassigned', color: UNASSIGNED_DEPT_COLOR, count: noDeptCount });
  }

  // Count by employment type
  const typeCounts: Record<string, number> = {};
  for (const emp of allEmployees) {
    const t = emp.employmentType || 'full-time';
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }

  // Upcoming birthdays (next 30 days)
  const upcomingBirthdays: { id: string; name: string; dateOfBirth: string; avatarUrl: string | null }[] = [];
  for (const emp of allEmployees) {
    if (!emp.dateOfBirth) continue;
    const dob = new Date(emp.dateOfBirth);
    const thisYearBday = new Date(currentYear, dob.getMonth(), dob.getDate());
    if (thisYearBday < now) thisYearBday.setFullYear(currentYear + 1);
    if (thisYearBday <= thirtyDaysFromNow) {
      upcomingBirthdays.push({ id: emp.id, name: emp.name, dateOfBirth: emp.dateOfBirth, avatarUrl: emp.avatarUrl });
    }
  }

  // Leave stats
  const pendingRequests = allTimeOff.filter((t) => t.status === 'pending').length;
  let approvedDaysThisMonth = 0;
  for (const req of allTimeOff) {
    if (req.status !== 'approved') continue;
    const start = new Date(req.startDate);
    const end = new Date(req.endDate);
    if (start.getMonth() === currentMonth && start.getFullYear() === currentYear) {
      approvedDaysThisMonth += Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
  }

  // Recent hires (last 30 days)
  const recentHires = allEmployees
    .filter((e) => e.startDate && new Date(e.startDate) >= thirtyDaysAgo)
    .sort((a, b) => new Date(b.startDate!).getTime() - new Date(a.startDate!).getTime())
    .slice(0, 5)
    .map((e) => ({ id: e.id, name: e.name, startDate: e.startDate!, role: e.role, avatarUrl: e.avatarUrl }));

  // Tenure distribution
  const tenure = { '0-1yr': 0, '1-3yr': 0, '3-5yr': 0, '5yr+': 0 };
  for (const emp of allEmployees) {
    if (!emp.startDate) continue;
    const years = (now.getTime() - new Date(emp.startDate).getTime()) / (365.25 * 86400000);
    if (years < 1) tenure['0-1yr']++;
    else if (years < 3) tenure['1-3yr']++;
    else if (years < 5) tenure['3-5yr']++;
    else tenure['5yr+']++;
  }

  return {
    totalHeadcount: allEmployees.length,
    statusCounts,
    departmentCounts,
    typeCounts,
    upcomingBirthdays,
    pendingRequests,
    approvedDaysThisMonth,
    recentHires,
    tenure,
  };
}

// ─── Widget summary (lightweight) ──────────────────────────────────

export async function getWidgetData(userId: string, accountId: string) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Employee count (active, non-archived)
  const [empAgg] = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(employees)
    .where(and(
      eq(employees.accountId, accountId),
      eq(employees.isArchived, false),
      eq(employees.status, 'active'),
    ));

  // Department count
  const [deptAgg] = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(departments)
    .where(and(
      eq(departments.accountId, accountId),
      eq(departments.isArchived, false),
    ));

  // On leave today (approved leave applications where today falls within start-end)
  const [leaveAgg] = await db
    .select({ count: sql<number>`COUNT(*)`.as('count') })
    .from(hrLeaveApplications)
    .where(and(
      eq(hrLeaveApplications.accountId, accountId),
      eq(hrLeaveApplications.status, 'approved'),
      lte(hrLeaveApplications.startDate, today),
      gte(hrLeaveApplications.endDate, today),
    ));

  return {
    employeeCount: Number(empAgg?.count ?? 0),
    departmentCount: Number(deptAgg?.count ?? 0),
    onLeaveToday: Number(leaveAgg?.count ?? 0),
  };
}

// ─── Seed Sample Data ───────────────────────────────────────────────

export async function seedSampleData(userId: string, accountId: string) {
  // Idempotency guard — skip if data already exists
  const existing = await db.select({ id: employees.id }).from(employees)
    .where(eq(employees.userId, userId)).limit(1);
  if (existing.length > 0) return { skipped: true };

  // ── Dates ────────────────────────────────────────────────────────
  const d = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().split('T')[0];
  const today = d(0);
  const threeMonthsAgo = d(-90);
  const sixMonthsAgo = d(-180);
  const nineMonthsAgo = d(-270);
  const oneYearAgo = d(-365);
  const eighteenMonthsAgo = d(-545);
  const twoYearsAgo = d(-730);
  const threeYearsAgo = d(-1095);
  const fourYearsAgo = d(-1460);
  const fiveYearsAgo = d(-1825);
  const nextWeek = d(7);
  const inTwoWeeks = d(14);
  const inThreeWeeks = d(21);
  const inFourWeeks = d(28);

  // ── Departments (3) ──────────────────────────────────────────────
  const engineering = await createDepartment(userId, accountId, { name: 'Engineering', color: '#3b82f6', description: 'Product development and technical operations' });
  const marketing = await createDepartment(userId, accountId, { name: 'Marketing', color: '#f59e0b', description: 'Brand, growth, and demand generation' });
  const operations = await createDepartment(userId, accountId, { name: 'Operations', color: '#10b981', description: 'HR, finance, and office management' });

  // ── Employees (6) ────────────────────────────────────────────────
  // Engineering (2)
  const alice = await createEmployee(userId, accountId, {
    name: 'Alice Johnson', email: 'alice@company.com', role: 'Engineering Lead',
    departmentId: engineering.id, startDate: twoYearsAgo,
    jobTitle: 'Engineering Lead', employmentType: 'full-time',
    tags: ['leadership', 'backend'],
  });
  const carol = await createEmployee(userId, accountId, {
    name: 'Carol Davis', email: 'carol@company.com', role: 'Frontend Developer',
    departmentId: engineering.id, startDate: oneYearAgo,
    jobTitle: 'Frontend Developer', employmentType: 'full-time', managerId: alice.id,
    tags: ['frontend', 'react'],
  });
  // Marketing (2)
  const bob = await createEmployee(userId, accountId, {
    name: 'Bob Williams', email: 'bob@company.com', role: 'Marketing Director',
    departmentId: marketing.id, startDate: eighteenMonthsAgo,
    jobTitle: 'Marketing Director', employmentType: 'full-time',
    tags: ['marketing', 'leadership'],
  });
  const eva = await createEmployee(userId, accountId, {
    name: 'Eva Martinez', email: 'eva@company.com', role: 'Content Strategist',
    departmentId: marketing.id, startDate: sixMonthsAgo,
    jobTitle: 'Content Strategist', employmentType: 'full-time', managerId: bob.id,
    tags: ['content', 'seo'],
  });

  // Operations (2)
  const david = await createEmployee(userId, accountId, {
    name: 'David Brown', email: 'david@company.com', role: 'Operations Manager',
    departmentId: operations.id, startDate: threeYearsAgo,
    jobTitle: 'Operations Manager', employmentType: 'full-time',
    tags: ['operations', 'finance'],
  });
  const grace = await createEmployee(userId, accountId, {
    name: 'Grace Kim', email: 'grace@company.com', role: 'HR Coordinator',
    departmentId: operations.id, startDate: nineMonthsAgo,
    jobTitle: 'HR Coordinator', employmentType: 'full-time', managerId: david.id,
    tags: ['hr', 'recruiting'],
  });

  // ── Department heads ─────────────────────────────────────────────
  await updateDepartment(userId, accountId, engineering.id, { headEmployeeId: alice.id });
  await updateDepartment(userId, accountId, marketing.id, { headEmployeeId: bob.id });
  await updateDepartment(userId, accountId, operations.id, { headEmployeeId: david.id });

  // ── Time-off requests (2) ──────────────────────────────────────
  const t1 = await createTimeOffRequest(userId, accountId, { employeeId: alice.id, type: 'vacation', startDate: nextWeek, endDate: inTwoWeeks, notes: 'Family vacation' });
  await createTimeOffRequest(userId, accountId, { employeeId: carol.id, type: 'sick', startDate: today, endDate: today });
  await updateTimeOffRequest(userId, accountId, t1.id, { status: 'approved', approverId: david.id });

  // ── Leave balances ─────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const allEmps = [alice, carol, bob, eva, david, grace];
  for (const emp of allEmps) {
    await allocateLeave(accountId, emp.id, 'vacation', currentYear, 20);
    await allocateLeave(accountId, emp.id, 'sick', currentYear, 10);
  }

  // ── Leave types + holiday calendar ──────────────────────────────
  await seedDefaultLeaveTypes(accountId);
  await seedDefaultTemplate(accountId);

  logger.info({ userId, accountId }, 'Seeded HR sample data');
  return {
    departments: 3,
    employees: 6,
    timeOffRequests: 2,
    leaveBalances: 12,
  };
}
