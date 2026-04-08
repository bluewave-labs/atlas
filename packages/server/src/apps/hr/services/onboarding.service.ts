import { db } from '../../../config/database';
import { onboardingTasks, onboardingTemplates } from '../../../db/schema';
import { eq, and, asc, sql } from 'drizzle-orm';

// ─── Onboarding Tasks ──────────────────────────────────────────────

export async function listOnboardingTasks(tenantId: string, employeeId: string) {
  return db
    .select()
    .from(onboardingTasks)
    .where(and(
      eq(onboardingTasks.tenantId, tenantId),
      eq(onboardingTasks.employeeId, employeeId),
      eq(onboardingTasks.isArchived, false),
    ))
    .orderBy(asc(onboardingTasks.sortOrder), asc(onboardingTasks.createdAt));
}

export async function createOnboardingTask(tenantId: string, employeeId: string, input: {
  title: string;
  description?: string | null;
  category?: string;
  dueDate?: string | null;
}) {
  const now = new Date();
  const [maxSort] = await db
    .select({ max: sql<number>`COALESCE(MAX(${onboardingTasks.sortOrder}), -1)` })
    .from(onboardingTasks)
    .where(eq(onboardingTasks.employeeId, employeeId));

  const sortOrder = (maxSort?.max ?? -1) + 1;

  const [created] = await db
    .insert(onboardingTasks)
    .values({
      tenantId,
      employeeId,
      title: input.title,
      description: input.description ?? null,
      category: input.category ?? 'general',
      dueDate: input.dueDate ?? null,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

export async function updateOnboardingTask(tenantId: string, taskId: string, input: {
  title?: string;
  description?: string | null;
  category?: string;
  dueDate?: string | null;
  completedAt?: Date | null;
  completedBy?: string | null;
  sortOrder?: number;
  isArchived?: boolean;
}) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.category !== undefined) updates.category = input.category;
  if (input.dueDate !== undefined) updates.dueDate = input.dueDate;
  if (input.completedAt !== undefined) updates.completedAt = input.completedAt;
  if (input.completedBy !== undefined) updates.completedBy = input.completedBy;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;

  const [updated] = await db
    .update(onboardingTasks)
    .set(updates)
    .where(and(eq(onboardingTasks.id, taskId), eq(onboardingTasks.tenantId, tenantId)))
    .returning();

  return updated || null;
}

export async function deleteOnboardingTask(tenantId: string, taskId: string) {
  return updateOnboardingTask(tenantId, taskId, { isArchived: true });
}

export async function createTasksFromTemplate(tenantId: string, employeeId: string, templateId: string) {
  const [template] = await db
    .select()
    .from(onboardingTemplates)
    .where(and(eq(onboardingTemplates.id, templateId), eq(onboardingTemplates.tenantId, tenantId)))
    .limit(1);

  if (!template) return [];

  const created = [];
  for (const task of template.tasks) {
    const t = await createOnboardingTask(tenantId, employeeId, {
      title: task.title,
      description: task.description ?? null,
      category: task.category,
    });
    created.push(t);
  }

  return created;
}

// ─── Onboarding Templates ──────────────────────────────────────────

export async function listOnboardingTemplates(tenantId: string) {
  return db
    .select()
    .from(onboardingTemplates)
    .where(eq(onboardingTemplates.tenantId, tenantId))
    .orderBy(asc(onboardingTemplates.name));
}

export async function createOnboardingTemplate(tenantId: string, input: {
  name: string;
  tasks: Array<{ title: string; description?: string; category: string }>;
}) {
  const now = new Date();
  const [created] = await db
    .insert(onboardingTemplates)
    .values({
      tenantId,
      name: input.name,
      tasks: input.tasks,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

export async function seedDefaultTemplate(tenantId: string) {
  const existing = await db
    .select({ id: onboardingTemplates.id })
    .from(onboardingTemplates)
    .where(eq(onboardingTemplates.tenantId, tenantId))
    .limit(1);

  if (existing.length > 0) return null;

  return createOnboardingTemplate(tenantId, {
    name: 'Default onboarding',
    tasks: [
      { title: 'Set up email account', description: 'Create company email and set up mail client', category: 'IT' },
      { title: 'Complete tax forms', description: 'Fill out W-4 and state tax withholding forms', category: 'HR' },
      { title: 'Review employee handbook', description: 'Read the company handbook and sign acknowledgment', category: 'HR' },
      { title: 'Set up workstation', description: 'Configure laptop, monitors, and software', category: 'IT' },
      { title: 'Meet team members', description: 'Schedule introductions with direct team', category: 'Team' },
      { title: 'Schedule orientation', description: 'Attend company orientation session', category: 'HR' },
      { title: 'Assign mentor', description: 'Get paired with a team mentor', category: 'Team' },
      { title: 'Review benefits enrollment', description: 'Review and enroll in health, dental, and vision plans', category: 'HR' },
    ],
  });
}
