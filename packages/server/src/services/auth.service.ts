import jwt from 'jsonwebtoken';
import { eq, count } from 'drizzle-orm';
import type { TenantMemberRole } from '@atlas-platform/shared';
import { db } from '../config/database';
import { accounts, users, userSettings } from '../db/schema';
import { env } from '../config/env';
import { encrypt } from '../utils/crypto';
import type { AuthPayload } from '../middleware/auth';
import crypto from 'node:crypto';

export async function generateTokens(account: { id: string; email: string; userId: string }, tenantId: string, tenantRole?: TenantMemberRole) {
  const [user] = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, account.userId))
    .limit(1);
  const payload: AuthPayload = {
    userId: account.userId,
    tenantId,
    email: account.email,
    isSuperAdmin: user?.isSuperAdmin === true,
  };
  if (tenantRole) payload.tenantRole = tenantRole;
  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h' });
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken };
}

export async function getUserCount(): Promise<number> {
  const [row] = await db.select({ count: count() }).from(users);
  return row?.count ?? 0;
}

export function verifyRefreshToken(token: string): AuthPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as AuthPayload;
}

export async function findAccountByEmail(email: string) {
  const [account] = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
  return account ?? null;
}

export async function createPasswordAccount(opts: {
  email: string;
  name: string;
  passwordHash: string;
  userId?: string;
}): Promise<{ user: typeof users.$inferSelect; account: typeof accounts.$inferSelect }> {
  const now = new Date();

  let userId = opts.userId;
  let user: typeof users.$inferSelect;

  if (userId) {
    const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!existing) throw new Error('User not found');
    user = existing;
    [user] = await db.update(users).set({ name: opts.name, email: opts.email, updatedAt: now }).where(eq(users.id, userId)).returning();
  } else {
    [user] = await db.insert(users).values({
      name: opts.name,
      email: opts.email,
      createdAt: now,
      updatedAt: now,
    }).returning();
    userId = user.id;
  }

  const [account] = await db.insert(accounts).values({
    userId: userId!,
    email: opts.email,
    name: opts.name,
    pictureUrl: null,
    provider: 'password',
    providerId: `password-${crypto.randomUUID()}`,
    passwordHash: opts.passwordHash,
    accessToken: encrypt('password-placeholder'),
    refreshToken: encrypt('password-placeholder'),
    tokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  }).returning();

  await db.insert(userSettings).values({ accountId: account.id });

  return { user, account };
}

export async function listUserAccounts(userId: string) {
  return db
    .select({
      id: accounts.id,
      userId: accounts.userId,
      email: accounts.email,
      name: accounts.name,
      pictureUrl: accounts.pictureUrl,
      provider: accounts.provider,
      providerId: accounts.providerId,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId));
}
