import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../config/database';
import { accounts, users, userSettings } from '../db/schema';
import { createOAuth2Client } from '../config/google';
import { env } from '../config/env';
import { encrypt } from '../utils/crypto';
import type { AuthPayload } from '../middleware/auth';
import crypto from 'node:crypto';

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const oauth2Client = createOAuth2Client(redirectUri);
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function getGoogleUserInfo(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error('Failed to fetch user info');
  return response.json() as Promise<{ id: string; email: string; name: string; picture: string }>;
}

export async function findOrCreateAccount(
  userInfo: { id: string; email: string; name: string; picture: string },
  tokens: any,
  existingUserId?: string,
): Promise<{ account: typeof accounts.$inferSelect; isNew: boolean }> {
  const existing = await db.select().from(accounts).where(eq(accounts.email, userInfo.email)).limit(1);

  if (existing.length > 0) {
    const updates: Record<string, string> = {
      name: userInfo.name,
      pictureUrl: userInfo.picture,
      accessToken: encrypt(tokens.access_token),
      tokenExpiresAt: new Date(tokens.expiry_date || Date.now() + 3600000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
    // Only overwrite refresh token if Google returned a new one — re-auth
    // flows with prompt=consent always do, but silent re-auth may not.
    if (tokens.refresh_token) {
      updates.refreshToken = encrypt(tokens.refresh_token);
    }
    // If this account is being added under a different user, re-link it
    if (existingUserId && existing[0].userId !== existingUserId) {
      (updates as any).userId = existingUserId;
    }
    const [account] = await db.update(accounts)
      .set(updates)
      .where(eq(accounts.id, existing[0].id))
      .returning();
    return { account, isNew: false };
  }

  if (!tokens.refresh_token) {
    throw new Error('No refresh token received from Google. Please re-authenticate with full consent.');
  }

  // Determine which user this account belongs to
  let userId = existingUserId;
  if (!userId) {
    // Create a new user for this account
    const now = new Date().toISOString();
    const [user] = await db.insert(users).values({
      createdAt: now,
      updatedAt: now,
    }).returning();
    userId = user.id;
  }

  const [account] = await db.insert(accounts).values({
    userId,
    email: userInfo.email,
    name: userInfo.name,
    pictureUrl: userInfo.picture,
    provider: 'google',
    providerId: userInfo.id,
    accessToken: encrypt(tokens.access_token),
    refreshToken: encrypt(tokens.refresh_token),
    tokenExpiresAt: new Date(tokens.expiry_date || Date.now() + 3600000).toISOString(),
  }).returning();

  await db.insert(userSettings).values({ accountId: account.id });

  return { account, isNew: true };
}

export function generateTokens(account: { id: string; email: string; userId: string }, tenantId?: string) {
  const payload: AuthPayload = { userId: account.userId, accountId: account.id, email: account.email };
  if (tenantId) payload.tenantId = tenantId;
  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h' });
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken };
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
  const now = new Date().toISOString();

  let userId = opts.userId;
  let user: typeof users.$inferSelect;

  if (userId) {
    const [existing] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!existing) throw new Error('User not found');
    user = existing;
    // Update name/email on the user row
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
    tokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
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
      syncStatus: accounts.syncStatus,
      historyId: accounts.historyId,
      lastSync: accounts.lastSync,
      createdAt: accounts.createdAt,
      updatedAt: accounts.updatedAt,
    })
    .from(accounts)
    .where(eq(accounts.userId, userId));
}
