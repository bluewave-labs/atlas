import { db } from '../../../config/database';
import {
  hrExpenses, hrExpenseCategories,
  employees, projectProjects,
  appPermissions, tenantMembers,
} from '../../../db/schema';
import { eq, and, desc, sql, ilike, gte, lte, inArray, ne, or } from 'drizzle-orm';
import { logger } from '../../../utils/logger';
import { sendEmail } from '../../../services/email.service';
import { getEmployeePolicy } from './expense-policy.service';
import type { CreateExpenseInput, UpdateExpenseInput } from '@atlas-platform/shared';

// ─── Email helper ───────────────────────────────────────────────

async function notifyEmployee(employeeId: string, subject: string, text: string) {
  try {
    const [emp] = await db.select({ email: employees.email }).from(employees).where(eq(employees.id, employeeId));
    if (emp?.email) {
      await sendEmail({ to: emp.email, subject, text });
    }
  } catch (err) {
    logger.warn({ err, employeeId }, 'Failed to send expense notification');
  }
}

// ─── Shared select fields & joins ────────────────────────────────

const expenseSelectFields = {
  id: hrExpenses.id,
  tenantId: hrExpenses.tenantId,
  userId: hrExpenses.userId,
  employeeId: hrExpenses.employeeId,
  categoryId: hrExpenses.categoryId,
  projectId: hrExpenses.projectId,
  reportId: hrExpenses.reportId,
  description: hrExpenses.description,
  notes: hrExpenses.notes,
  amount: hrExpenses.amount,
  taxAmount: hrExpenses.taxAmount,
  currency: hrExpenses.currency,
  quantity: hrExpenses.quantity,
  expenseDate: hrExpenses.expenseDate,
  merchantName: hrExpenses.merchantName,
  paymentMethod: hrExpenses.paymentMethod,
  receiptPath: hrExpenses.receiptPath,
  status: hrExpenses.status,
  submittedAt: hrExpenses.submittedAt,
  approvedAt: hrExpenses.approvedAt,
  refusedAt: hrExpenses.refusedAt,
  paidAt: hrExpenses.paidAt,
  approverId: hrExpenses.approverId,
  approverComment: hrExpenses.approverComment,
  policyViolation: hrExpenses.policyViolation,
  isArchived: hrExpenses.isArchived,
  createdAt: hrExpenses.createdAt,
  updatedAt: hrExpenses.updatedAt,
  // Joined fields
  categoryName: hrExpenseCategories.name,
  categoryIcon: hrExpenseCategories.icon,
  categoryColor: hrExpenseCategories.color,
  projectName: projectProjects.name,
  employeeName: employees.name,
  employeeAvatar: employees.avatarUrl,
};

function applyJoins(query: any) {
  return query
    .leftJoin(hrExpenseCategories, eq(hrExpenses.categoryId, hrExpenseCategories.id))
    .leftJoin(projectProjects, eq(hrExpenses.projectId, projectProjects.id))
    .leftJoin(employees, eq(hrExpenses.employeeId, employees.id));
}

// ─── List Expenses ──────────────────────────────────────────────

export async function listExpenses(tenantId: string, filters?: {
  status?: string;
  employeeId?: string;
  categoryId?: string;
  projectId?: string;
  reportId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}) {
  const conditions = [
    eq(hrExpenses.tenantId, tenantId),
    eq(hrExpenses.isArchived, false),
  ];

  if (filters?.status) conditions.push(eq(hrExpenses.status, filters.status));
  if (filters?.employeeId) conditions.push(eq(hrExpenses.employeeId, filters.employeeId));
  if (filters?.categoryId) conditions.push(eq(hrExpenses.categoryId, filters.categoryId));
  if (filters?.projectId) conditions.push(eq(hrExpenses.projectId, filters.projectId));
  if (filters?.reportId) conditions.push(eq(hrExpenses.reportId, filters.reportId));
  if (filters?.startDate) conditions.push(gte(hrExpenses.expenseDate, new Date(filters.startDate)));
  if (filters?.endDate) conditions.push(lte(hrExpenses.expenseDate, new Date(filters.endDate)));
  if (filters?.search) conditions.push(ilike(hrExpenses.description, `%${filters.search}%`));

  const query = db.select(expenseSelectFields).from(hrExpenses);
  return applyJoins(query)
    .where(and(...conditions))
    .orderBy(desc(hrExpenses.expenseDate));
}

// ─── List My Expenses ───────────────────────────────────────────

export async function listMyExpenses(tenantId: string, userId: string, filters?: {
  status?: string;
  categoryId?: string;
  projectId?: string;
  reportId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}) {
  const conditions = [
    eq(hrExpenses.tenantId, tenantId),
    eq(hrExpenses.userId, userId),
    eq(hrExpenses.isArchived, false),
  ];

  if (filters?.status) conditions.push(eq(hrExpenses.status, filters.status));
  if (filters?.categoryId) conditions.push(eq(hrExpenses.categoryId, filters.categoryId));
  if (filters?.projectId) conditions.push(eq(hrExpenses.projectId, filters.projectId));
  if (filters?.reportId) conditions.push(eq(hrExpenses.reportId, filters.reportId));
  if (filters?.startDate) conditions.push(gte(hrExpenses.expenseDate, new Date(filters.startDate)));
  if (filters?.endDate) conditions.push(lte(hrExpenses.expenseDate, new Date(filters.endDate)));
  if (filters?.search) conditions.push(ilike(hrExpenses.description, `%${filters.search}%`));

  const query = db.select(expenseSelectFields).from(hrExpenses);
  return applyJoins(query)
    .where(and(...conditions))
    .orderBy(desc(hrExpenses.expenseDate));
}

// ─── Get Single Expense ─────────────────────────────────────────

export async function getExpense(tenantId: string, id: string) {
  const query = db.select(expenseSelectFields).from(hrExpenses);
  const [expense] = await applyJoins(query)
    .where(and(eq(hrExpenses.id, id), eq(hrExpenses.tenantId, tenantId)))
    .limit(1);
  return expense || null;
}

// ─── Create Expense ─────────────────────────────────────────────

export async function createExpense(
  userId: string,
  tenantId: string,
  employeeId: string,
  input: CreateExpenseInput,
) {
  const now = new Date();
  const [created] = await db.insert(hrExpenses).values({
    tenantId,
    userId,
    employeeId,
    categoryId: input.categoryId ?? null,
    projectId: input.projectId ?? null,
    reportId: input.reportId ?? null,
    description: input.description,
    notes: input.notes ?? null,
    amount: input.amount,
    taxAmount: input.taxAmount ?? 0,
    currency: input.currency ?? 'USD',
    quantity: input.quantity ?? 1,
    expenseDate: new Date(input.expenseDate),
    merchantName: input.merchantName ?? null,
    paymentMethod: input.paymentMethod ?? 'personal_card',
    receiptPath: input.receiptPath ?? null,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  }).returning();

  return created;
}

// ─── Update Expense ─────────────────────────────────────────────

export async function updateExpense(tenantId: string, id: string, input: UpdateExpenseInput) {
  const now = new Date();

  // Only allow editing if status is draft or refused
  const [existing] = await db.select({ status: hrExpenses.status })
    .from(hrExpenses)
    .where(and(eq(hrExpenses.id, id), eq(hrExpenses.tenantId, tenantId)))
    .limit(1);

  if (!existing || (existing.status !== 'draft' && existing.status !== 'refused')) {
    return null;
  }

  const updates: Record<string, unknown> = { updatedAt: now };
  if (input.categoryId !== undefined) updates.categoryId = input.categoryId;
  if (input.projectId !== undefined) updates.projectId = input.projectId;
  if (input.reportId !== undefined) updates.reportId = input.reportId;
  if (input.description !== undefined) updates.description = input.description;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.amount !== undefined) updates.amount = input.amount;
  if (input.taxAmount !== undefined) updates.taxAmount = input.taxAmount;
  if (input.currency !== undefined) updates.currency = input.currency;
  if (input.quantity !== undefined) updates.quantity = input.quantity;
  if (input.expenseDate !== undefined) updates.expenseDate = new Date(input.expenseDate);
  if (input.merchantName !== undefined) updates.merchantName = input.merchantName;
  if (input.paymentMethod !== undefined) updates.paymentMethod = input.paymentMethod;
  if (input.receiptPath !== undefined) updates.receiptPath = input.receiptPath;

  // Reset status to draft if currently refused (so it can be resubmitted)
  if (existing.status === 'refused') {
    updates.status = 'draft';
    updates.policyViolation = null;
    updates.approverComment = null;
    updates.refusedAt = null;
    updates.approverId = null;
  }

  const [updated] = await db.update(hrExpenses).set(updates)
    .where(and(eq(hrExpenses.id, id), eq(hrExpenses.tenantId, tenantId)))
    .returning();

  return updated || null;
}

// ─── Delete Expense (soft) ──────────────────────────────────────

export async function deleteExpense(tenantId: string, id: string) {
  const [deleted] = await db.update(hrExpenses).set({
    isArchived: true,
    updatedAt: new Date(),
  }).where(and(
    eq(hrExpenses.id, id),
    eq(hrExpenses.tenantId, tenantId),
    eq(hrExpenses.status, 'draft'),
  )).returning();

  return deleted || null;
}

// ─── Submit Expense ─────────────────────────────────────────────

/**
 * Resolve an approver when the employee has no direct manager set.
 * Tries in order:
 *   1. Another employee in the same tenant whose linked user has an
 *      explicit HR 'admin' app permission row.
 *   2. Another employee in the same tenant whose linked user is the
 *      tenant owner or tenant-level admin.
 * Returns the employeeId to use as approver, or null if nothing matches.
 * Excludes the submitter's own employeeId so they can't end up as their
 * own approver through this path — that case is handled by the caller
 * (auto-approve when the submitter IS an HR admin).
 */
async function findFallbackApprover(
  tenantId: string,
  excludeEmployeeId: string,
): Promise<string | null> {
  // 1. Try explicit HR admin app permission
  const [viaAppPerm] = await db
    .select({ id: employees.id })
    .from(employees)
    .innerJoin(
      appPermissions,
      and(
        eq(appPermissions.userId, employees.linkedUserId),
        eq(appPermissions.tenantId, tenantId),
        eq(appPermissions.appId, 'hr'),
        eq(appPermissions.role, 'admin'),
      ),
    )
    .where(and(
      eq(employees.tenantId, tenantId),
      eq(employees.isArchived, false),
      ne(employees.id, excludeEmployeeId),
    ))
    .limit(1);
  if (viaAppPerm?.id) return viaAppPerm.id;

  // 2. Try tenant owner/admin
  const [viaTenantRole] = await db
    .select({ id: employees.id })
    .from(employees)
    .innerJoin(
      tenantMembers,
      and(
        eq(tenantMembers.userId, employees.linkedUserId),
        eq(tenantMembers.tenantId, tenantId),
        or(eq(tenantMembers.role, 'owner'), eq(tenantMembers.role, 'admin')),
      ),
    )
    .where(and(
      eq(employees.tenantId, tenantId),
      eq(employees.isArchived, false),
      ne(employees.id, excludeEmployeeId),
    ))
    .limit(1);
  return viaTenantRole?.id ?? null;
}

/**
 * Determine whether the submitter has an HR admin role. Used as the
 * self-approval fallback when a top-of-hierarchy user (e.g. the CEO)
 * submits an expense and has no one above them.
 */
async function isHrAdmin(tenantId: string, linkedUserId: string | null | undefined): Promise<boolean> {
  if (!linkedUserId) return false;
  const [perm] = await db
    .select({ role: appPermissions.role })
    .from(appPermissions)
    .where(and(
      eq(appPermissions.tenantId, tenantId),
      eq(appPermissions.userId, linkedUserId),
      eq(appPermissions.appId, 'hr'),
    ))
    .limit(1);
  if (perm?.role === 'admin') return true;
  // Fall back to tenant-level role (tenant owner/admin is always HR admin)
  const [member] = await db
    .select({ role: tenantMembers.role })
    .from(tenantMembers)
    .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, linkedUserId)))
    .limit(1);
  return member?.role === 'owner' || member?.role === 'admin';
}

export async function submitExpense(tenantId: string, id: string, employeeId: string) {
  const now = new Date();

  // a. Fetch expense — must be draft or refused
  const [expense] = await db.select().from(hrExpenses)
    .where(and(eq(hrExpenses.id, id), eq(hrExpenses.tenantId, tenantId)))
    .limit(1);

  if (!expense || (expense.status !== 'draft' && expense.status !== 'refused')) {
    return null;
  }

  // b. Fetch employee to get managerId and departmentId
  const [employee] = await db.select().from(employees)
    .where(eq(employees.id, employeeId)).limit(1);
  if (!employee) throw new Error('Employee not found');

  // c. Get applicable policy
  const policy = await getEmployeePolicy(tenantId, employeeId, employee.departmentId);

  let policyViolation: string | null = null;
  let autoApproved = false;

  if (policy) {
    // d-i. Check category maxAmount
    if (expense.categoryId) {
      const [category] = await db.select().from(hrExpenseCategories)
        .where(eq(hrExpenseCategories.id, expense.categoryId)).limit(1);
      if (category?.maxAmount && expense.amount > category.maxAmount) {
        policyViolation = `Amount ${expense.amount} exceeds category limit of ${category.maxAmount} for ${category.name}`;
      }
    }

    // d-ii. Check requireReceiptAbove
    if (policy.requireReceiptAbove && expense.amount > policy.requireReceiptAbove && !expense.receiptPath) {
      throw new Error(`Receipt required for expenses above ${policy.requireReceiptAbove} ${expense.currency}`);
    }

    // d-iii. Check monthlyLimit
    if (policy.monthlyLimit) {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const [monthTotal] = await db.select({
        total: sql<number>`COALESCE(SUM(${hrExpenses.amount}), 0)`,
      }).from(hrExpenses)
        .where(and(
          eq(hrExpenses.tenantId, tenantId),
          eq(hrExpenses.employeeId, employeeId),
          ne(hrExpenses.status, 'draft'),
          ne(hrExpenses.id, id),
          eq(hrExpenses.isArchived, false),
          gte(hrExpenses.expenseDate, monthStart),
          lte(hrExpenses.expenseDate, monthEnd),
        ));

      const currentTotal = Number(monthTotal?.total ?? 0);
      if (currentTotal + expense.amount > policy.monthlyLimit) {
        policyViolation = (policyViolation ? policyViolation + '; ' : '')
          + `Monthly limit exceeded: ${currentTotal + expense.amount} / ${policy.monthlyLimit} ${expense.currency}`;
      }
    }

    // d-iv. Check autoApproveBelow
    if (policy.autoApproveBelow && expense.amount < policy.autoApproveBelow && !policyViolation) {
      autoApproved = true;
    }
  }

  if (autoApproved) {
    // Auto-approve
    const [updated] = await db.update(hrExpenses).set({
      status: 'approved',
      approvedAt: now,
      submittedAt: now,
      policyViolation,
      updatedAt: now,
    }).where(eq(hrExpenses.id, id)).returning();

    return updated;
  }

  // e. Set status to submitted with approver. Normal path: employee.managerId.
  //    Fallback chain for employees at the top of the hierarchy (CEO,
  //    tenant owner with no manager assigned, single-user tenants):
  //      i.  If the submitter is themselves an HR admin → auto-approve
  //          (they are trusted to sign off on their own expenses).
  //      ii. Otherwise find another employee in the tenant who is an
  //          HR admin or tenant owner/admin, and route to them.
  //      iii. If none exists → throw the original "no manager" error
  //          (genuine misconfiguration).
  let approverId = employee.managerId ?? null;

  if (!approverId) {
    const submitterIsAdmin = await isHrAdmin(tenantId, employee.linkedUserId);
    if (submitterIsAdmin) {
      // Auto-approve — the submitter is trusted to sign off on their own.
      const [autoApproved2] = await db.update(hrExpenses).set({
        status: 'approved',
        approvedAt: now,
        approverId: employee.id,
        submittedAt: now,
        policyViolation,
        updatedAt: now,
      }).where(eq(hrExpenses.id, id)).returning();
      return autoApproved2;
    }
    // Try to route to any other admin in the tenant.
    approverId = await findFallbackApprover(tenantId, employeeId);
  }

  if (!approverId) {
    throw new Error('Cannot submit expense: no manager assigned to approve. Please contact your HR admin.');
  }
  const [updated] = await db.update(hrExpenses).set({
    status: 'submitted',
    approverId,
    submittedAt: now,
    policyViolation,
    updatedAt: now,
  }).where(eq(hrExpenses.id, id)).returning();

  // f. Send email to approver
  await notifyEmployee(
    approverId,
    `New expense to review: ${expense.description}`,
    `${employee.name} submitted an expense of ${expense.amount} ${expense.currency} for "${expense.description}". Please review it in Atlas.`,
  );

  return updated;
}

// ─── Recall Expense ─────────────────────────────────────────────

export async function recallExpense(tenantId: string, id: string, userId: string) {
  const [updated] = await db.update(hrExpenses).set({
    status: 'draft',
    approverId: null,
    submittedAt: null,
    policyViolation: null,
    updatedAt: new Date(),
  }).where(and(
    eq(hrExpenses.id, id),
    eq(hrExpenses.tenantId, tenantId),
    eq(hrExpenses.userId, userId),
    eq(hrExpenses.status, 'submitted'),
  )).returning();

  return updated || null;
}

// ─── Approve Expense ────────────────────────────────────────────

export async function approveExpense(tenantId: string, id: string, approverId: string) {
  const now = new Date();

  const [expense] = await db.select().from(hrExpenses)
    .where(and(eq(hrExpenses.id, id), eq(hrExpenses.tenantId, tenantId), eq(hrExpenses.status, 'submitted')))
    .limit(1);
  if (!expense) return null;

  const [updated] = await db.update(hrExpenses).set({
    status: 'approved',
    approverId,
    approvedAt: now,
    updatedAt: now,
  }).where(eq(hrExpenses.id, id)).returning();

  // Send email to employee
  await notifyEmployee(
    expense.employeeId,
    `Expense approved: ${expense.description}`,
    `Your expense of ${expense.amount} ${expense.currency} for "${expense.description}" has been approved.`,
  );

  return updated;
}

// ─── Refuse Expense ─────────────────────────────────────────────

export async function refuseExpense(tenantId: string, id: string, approverId: string, comment?: string) {
  const now = new Date();

  const [expense] = await db.select().from(hrExpenses)
    .where(and(eq(hrExpenses.id, id), eq(hrExpenses.tenantId, tenantId), eq(hrExpenses.status, 'submitted')))
    .limit(1);
  if (!expense) return null;

  const [updated] = await db.update(hrExpenses).set({
    status: 'refused',
    approverId,
    approverComment: comment ?? null,
    refusedAt: now,
    updatedAt: now,
  }).where(eq(hrExpenses.id, id)).returning();

  // Send email to employee
  await notifyEmployee(
    expense.employeeId,
    `Expense refused: ${expense.description}`,
    `Your expense of ${expense.amount} ${expense.currency} for "${expense.description}" has been refused.${comment ? ` Reason: ${comment}` : ''}`,
  );

  return updated;
}

// ─── Bulk Pay Expenses ──────────────────────────────────────────

export async function bulkPayExpenses(tenantId: string, expenseIds: string[]) {
  const now = new Date();

  // Only update expenses that are currently approved
  const updated = await db.update(hrExpenses).set({
    status: 'paid',
    paidAt: now,
    updatedAt: now,
  }).where(and(
    eq(hrExpenses.tenantId, tenantId),
    eq(hrExpenses.status, 'approved'),
    inArray(hrExpenses.id, expenseIds),
  )).returning();

  // Send email to each affected employee
  for (const expense of updated) {
    await notifyEmployee(
      expense.employeeId,
      `Expense paid: ${expense.description}`,
      `Your expense of ${expense.amount} ${expense.currency} for "${expense.description}" has been marked as paid.`,
    );
  }

  return updated;
}

// ─── Pending Expenses (for approver) ────────────────────────────

export async function getPendingExpenses(tenantId: string, approverId: string) {
  const query = db.select(expenseSelectFields).from(hrExpenses);
  return applyJoins(query)
    .where(and(
      eq(hrExpenses.tenantId, tenantId),
      eq(hrExpenses.approverId, approverId),
      eq(hrExpenses.status, 'submitted'),
      eq(hrExpenses.isArchived, false),
    ))
    .orderBy(desc(hrExpenses.expenseDate));
}

// ─── Pending Expense Count ──────────────────────────────────────

export async function getPendingExpenseCount(tenantId: string, approverId: string) {
  const [result] = await db.select({
    count: sql<number>`COUNT(*)`,
  }).from(hrExpenses)
    .where(and(
      eq(hrExpenses.tenantId, tenantId),
      eq(hrExpenses.approverId, approverId),
      eq(hrExpenses.status, 'submitted'),
      eq(hrExpenses.isArchived, false),
    ));

  return Number(result?.count ?? 0);
}
