import { db } from '../../config/database';
import { hrAttendance, employees } from '../../db/schema';
import { eq, and, asc, desc, sql, gte, lte } from 'drizzle-orm';
import { logger } from '../../utils/logger';

// ─── Attendance Tracking ──────────────────────────────────────────

export async function markAttendance(accountId: string, input: {
  employeeId: string; date: string; status: string;
  checkInTime?: string | null; checkOutTime?: string | null;
  notes?: string | null; markedBy?: string | null;
}) {
  const now = new Date();

  // Auto-calculate working hours
  let workingHours: number | null = null;
  if (input.checkInTime && input.checkOutTime) {
    const [inH, inM] = input.checkInTime.split(':').map(Number);
    const [outH, outM] = input.checkOutTime.split(':').map(Number);
    workingHours = Math.round(((outH * 60 + outM) - (inH * 60 + inM)) / 60 * 100) / 100;
    if (workingHours < 0) workingHours = 0;
  }

  // Upsert - check if record exists for this employee+date
  const existing = await db.select().from(hrAttendance)
    .where(and(eq(hrAttendance.employeeId, input.employeeId), eq(hrAttendance.date, input.date)))
    .limit(1);

  if (existing.length > 0) {
    const [updated] = await db.update(hrAttendance).set({
      status: input.status, checkInTime: input.checkInTime ?? null,
      checkOutTime: input.checkOutTime ?? null, workingHours,
      notes: input.notes ?? existing[0].notes, markedBy: input.markedBy ?? null, updatedAt: now,
    }).where(eq(hrAttendance.id, existing[0].id)).returning();
    return updated;
  }

  const [created] = await db.insert(hrAttendance).values({
    accountId, employeeId: input.employeeId, date: input.date,
    status: input.status, checkInTime: input.checkInTime ?? null,
    checkOutTime: input.checkOutTime ?? null, workingHours,
    notes: input.notes ?? null, markedBy: input.markedBy ?? null,
    createdAt: now, updatedAt: now,
  }).returning();

  return created;
}

export async function bulkMarkAttendance(accountId: string, input: {
  employeeIds: string[]; date: string; status: string; markedBy?: string;
}) {
  const results = [];
  for (const employeeId of input.employeeIds) {
    const result = await markAttendance(accountId, {
      employeeId, date: input.date, status: input.status,
      markedBy: input.markedBy ?? null,
    });
    results.push(result);
  }
  return results;
}

export async function listAttendance(accountId: string, filters?: {
  employeeId?: string; date?: string; startDate?: string; endDate?: string; status?: string;
}) {
  const conditions = [eq(hrAttendance.accountId, accountId), eq(hrAttendance.isArchived, false)];

  if (filters?.employeeId) conditions.push(eq(hrAttendance.employeeId, filters.employeeId));
  if (filters?.date) conditions.push(eq(hrAttendance.date, filters.date));
  if (filters?.startDate) conditions.push(gte(hrAttendance.date, filters.startDate));
  if (filters?.endDate) conditions.push(lte(hrAttendance.date, filters.endDate));
  if (filters?.status) conditions.push(eq(hrAttendance.status, filters.status));

  return db.select({
    id: hrAttendance.id,
    accountId: hrAttendance.accountId,
    employeeId: hrAttendance.employeeId,
    date: hrAttendance.date,
    status: hrAttendance.status,
    checkInTime: hrAttendance.checkInTime,
    checkOutTime: hrAttendance.checkOutTime,
    workingHours: hrAttendance.workingHours,
    notes: hrAttendance.notes,
    markedBy: hrAttendance.markedBy,
    createdAt: hrAttendance.createdAt,
    employeeName: employees.name,
  })
    .from(hrAttendance)
    .leftJoin(employees, eq(hrAttendance.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(desc(hrAttendance.date), asc(employees.name));
}

export async function updateAttendance(accountId: string, id: string, input: Partial<{
  status: string; checkInTime: string | null; checkOutTime: string | null;
  notes: string | null; markedBy: string | null;
}>) {
  const now = new Date();
  const updates: Record<string, unknown> = { updatedAt: now };
  for (const [k, v] of Object.entries(input)) { if (v !== undefined) updates[k] = v; }

  // Recalculate working hours if times are provided
  if (input.checkInTime !== undefined && input.checkOutTime !== undefined && input.checkInTime && input.checkOutTime) {
    const [inH, inM] = input.checkInTime.split(':').map(Number);
    const [outH, outM] = input.checkOutTime.split(':').map(Number);
    let hours = Math.round(((outH * 60 + outM) - (inH * 60 + inM)) / 60 * 100) / 100;
    if (hours < 0) hours = 0;
    updates.workingHours = hours;
  }

  const [updated] = await db.update(hrAttendance).set(updates)
    .where(and(eq(hrAttendance.id, id), eq(hrAttendance.accountId, accountId))).returning();
  return updated || null;
}

export async function getTodaySummary(accountId: string) {
  const today = new Date().toISOString().slice(0, 10);

  const records = await db.select({ status: hrAttendance.status })
    .from(hrAttendance)
    .where(and(eq(hrAttendance.accountId, accountId), eq(hrAttendance.date, today), eq(hrAttendance.isArchived, false)));

  const counts: Record<string, number> = { present: 0, absent: 0, 'half-day': 0, remote: 0, 'on-leave': 0 };
  for (const r of records) {
    counts[r.status] = (counts[r.status] || 0) + 1;
  }
  counts.total = records.length;

  return counts;
}

export async function getMonthlyReport(accountId: string, month: string) {
  // month format: "2026-03"
  const startDate = `${month}-01`;
  // Get last day of month
  const [year, mon] = month.split('-').map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;

  const records = await db.select({
    id: hrAttendance.id,
    employeeId: hrAttendance.employeeId,
    date: hrAttendance.date,
    status: hrAttendance.status,
    workingHours: hrAttendance.workingHours,
    employeeName: employees.name,
  })
    .from(hrAttendance)
    .leftJoin(employees, eq(hrAttendance.employeeId, employees.id))
    .where(and(
      eq(hrAttendance.accountId, accountId), eq(hrAttendance.isArchived, false),
      gte(hrAttendance.date, startDate), lte(hrAttendance.date, endDate),
    ))
    .orderBy(asc(employees.name), asc(hrAttendance.date));

  return records;
}

export async function getEmployeeAttendance(accountId: string, employeeId: string, month?: string) {
  const conditions = [
    eq(hrAttendance.accountId, accountId),
    eq(hrAttendance.employeeId, employeeId),
    eq(hrAttendance.isArchived, false),
  ];

  if (month) {
    const startDate = `${month}-01`;
    const [year, mon] = month.split('-').map(Number);
    const lastDay = new Date(year, mon, 0).getDate();
    const endDate = `${month}-${String(lastDay).padStart(2, '0')}`;
    conditions.push(gte(hrAttendance.date, startDate));
    conditions.push(lte(hrAttendance.date, endDate));
  }

  return db.select().from(hrAttendance)
    .where(and(...conditions))
    .orderBy(desc(hrAttendance.date));
}
