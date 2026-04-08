import { db } from '../../../config/database';
import { crmTeams, crmTeamMembers, users } from '../../../db/schema';
import { eq, and, asc } from 'drizzle-orm';

// ─── Sales Teams ──────────────────────────────────────────────────

export async function listTeams(tenantId: string) {
  return db.select().from(crmTeams)
    .where(and(eq(crmTeams.tenantId, tenantId), eq(crmTeams.isArchived, false)))
    .orderBy(asc(crmTeams.createdAt));
}

export async function createTeam(tenantId: string, input: { name: string; color?: string; leaderUserId?: string }) {
  const now = new Date();
  const [created] = await db.insert(crmTeams).values({
    tenantId, name: input.name, color: input.color ?? '#3b82f6',
    leaderUserId: input.leaderUserId ?? null,
    createdAt: now, updatedAt: now,
  }).returning();
  return created;
}

export async function updateTeam(tenantId: string, id: string, input: Partial<{ name: string; color: string; leaderUserId: string | null; isArchived: boolean }>) {
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.color !== undefined) updates.color = input.color;
  if (input.leaderUserId !== undefined) updates.leaderUserId = input.leaderUserId;
  if (input.isArchived !== undefined) updates.isArchived = input.isArchived;
  await db.update(crmTeams).set(updates).where(and(eq(crmTeams.id, id), eq(crmTeams.tenantId, tenantId)));
  const [updated] = await db.select().from(crmTeams).where(and(eq(crmTeams.id, id), eq(crmTeams.tenantId, tenantId))).limit(1);
  return updated || null;
}

export async function deleteTeam(tenantId: string, id: string) {
  return updateTeam(tenantId, id, { isArchived: true });
}

async function verifyTeamOwnership(teamId: string, tenantId: string) {
  const [team] = await db.select({ id: crmTeams.id }).from(crmTeams)
    .where(and(eq(crmTeams.id, teamId), eq(crmTeams.tenantId, tenantId))).limit(1);
  return team ?? null;
}

export async function listTeamMembers(teamId: string, tenantId: string) {
  if (!await verifyTeamOwnership(teamId, tenantId)) return [];

  return db.select({
    id: crmTeamMembers.id,
    teamId: crmTeamMembers.teamId,
    userId: crmTeamMembers.userId,
    userName: users.name,
    userEmail: users.email,
    createdAt: crmTeamMembers.createdAt,
  }).from(crmTeamMembers)
    .leftJoin(users, eq(crmTeamMembers.userId, users.id))
    .where(eq(crmTeamMembers.teamId, teamId));
}

export async function addTeamMember(teamId: string, userId: string, tenantId: string) {
  if (!await verifyTeamOwnership(teamId, tenantId)) throw new Error('Team not found');
  const [created] = await db.insert(crmTeamMembers).values({ teamId, userId }).returning();
  return created;
}

export async function removeTeamMember(teamId: string, userId: string, tenantId: string) {
  if (!await verifyTeamOwnership(teamId, tenantId)) return;
  await db.delete(crmTeamMembers).where(and(eq(crmTeamMembers.teamId, teamId), eq(crmTeamMembers.userId, userId)));
}

export async function getUserTeamIds(userId: string, tenantId: string): Promise<string[]> {
  const memberships = await db.select({ teamId: crmTeamMembers.teamId })
    .from(crmTeamMembers)
    .innerJoin(crmTeams, eq(crmTeamMembers.teamId, crmTeams.id))
    .where(and(eq(crmTeamMembers.userId, userId), eq(crmTeams.tenantId, tenantId), eq(crmTeams.isArchived, false)));
  return memberships.map(m => m.teamId);
}
