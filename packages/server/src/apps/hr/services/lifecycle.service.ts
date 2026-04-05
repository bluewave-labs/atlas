import { db } from '../../../config/database';
import { hrLifecycleEvents } from '../../../db/schema';
import { eq, and, desc } from 'drizzle-orm';

// ─── Lifecycle Events ─────────────────────────────────────────────

export async function getLifecycleTimeline(accountId: string, employeeId: string) {
  return db.select().from(hrLifecycleEvents)
    .where(and(eq(hrLifecycleEvents.accountId, accountId), eq(hrLifecycleEvents.employeeId, employeeId), eq(hrLifecycleEvents.isArchived, false)))
    .orderBy(desc(hrLifecycleEvents.eventDate), desc(hrLifecycleEvents.createdAt));
}

export async function createLifecycleEvent(accountId: string, input: {
  employeeId: string; eventType: string; eventDate: string; effectiveDate?: string | null;
  fromValue?: string | null; toValue?: string | null;
  fromDepartmentId?: string | null; toDepartmentId?: string | null;
  notes?: string | null; createdBy?: string | null;
}) {
  const now = new Date();
  const [created] = await db.insert(hrLifecycleEvents).values({
    accountId, employeeId: input.employeeId, eventType: input.eventType,
    eventDate: input.eventDate, effectiveDate: input.effectiveDate ?? null,
    fromValue: input.fromValue ?? null, toValue: input.toValue ?? null,
    fromDepartmentId: input.fromDepartmentId ?? null, toDepartmentId: input.toDepartmentId ?? null,
    notes: input.notes ?? null, createdBy: input.createdBy ?? null,
    createdAt: now, updatedAt: now,
  }).returning();
  return created;
}

export async function deleteLifecycleEvent(accountId: string, id: string) {
  const now = new Date();
  const [updated] = await db.update(hrLifecycleEvents)
    .set({ isArchived: true, updatedAt: now })
    .where(and(eq(hrLifecycleEvents.id, id), eq(hrLifecycleEvents.accountId, accountId))).returning();
  return updated || null;
}
