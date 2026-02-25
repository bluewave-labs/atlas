import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../config/database';
import { accounts, userSettings } from '../db/schema';
import { createOAuth2Client } from '../config/google';
import { env } from '../config/env';
import { encrypt } from '../utils/crypto';
import type { AuthPayload } from '../middleware/auth';

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
    const [account] = await db.update(accounts)
      .set(updates)
      .where(eq(accounts.id, existing[0].id))
      .returning();
    return { account, isNew: false };
  }

  if (!tokens.refresh_token) {
    throw new Error('No refresh token received from Google. Please re-authenticate with full consent.');
  }

  const [account] = await db.insert(accounts).values({
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

export function generateTokens(account: { id: string; email: string }) {
  const payload: AuthPayload = { accountId: account.id, email: account.email };
  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '1h' });
  const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
  return { accessToken, refreshToken };
}

export function verifyRefreshToken(token: string): AuthPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as AuthPayload;
}
