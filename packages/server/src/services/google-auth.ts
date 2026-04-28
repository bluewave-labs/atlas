import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { db } from '../config/database';
import { accounts } from '../db/schema';
import { eq } from 'drizzle-orm';
import { encrypt, decrypt } from '../utils/crypto';
import { logger } from '../utils/logger';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
];

const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
];

export function isGoogleConfigured(): boolean {
  return !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function createOAuth2Client(): OAuth2Client {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error('Google OAuth is not configured');
  }
  return new OAuth2Client(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI ?? `${env.SERVER_PUBLIC_URL}/api/v1/auth/google/callback`,
  );
}

export function getAuthUrl(state: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });
}

export async function exchangeCode(code: string) {
  const client = createOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

export async function getAuthenticatedClient(accountId: string): Promise<OAuth2Client> {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!account) throw new Error(`Account ${accountId} not found`);
  if (account.provider !== 'google') throw new Error('Account is not connected to Google');

  const accessToken = decrypt(account.accessToken);
  const refreshToken = decrypt(account.refreshToken);

  if (accessToken === 'password-placeholder') {
    throw new Error('Account is not connected to Google');
  }

  const client = createOAuth2Client();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: account.tokenExpiresAt?.getTime(),
  });

  // Auto-refresh if expired
  const now = Date.now();
  if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() < now + 60_000) {
    try {
      const { credentials } = await client.refreshAccessToken();
      client.setCredentials(credentials);

      // Store refreshed tokens
      const updates: Record<string, unknown> = {
        accessToken: encrypt(credentials.access_token!),
        tokenExpiresAt: new Date(credentials.expiry_date!),
        updatedAt: new Date(),
      };
      if (credentials.refresh_token) {
        updates.refreshToken = encrypt(credentials.refresh_token);
      }
      await db.update(accounts).set(updates).where(eq(accounts.id, accountId));
      logger.info({ accountId }, 'Refreshed Google access token');
    } catch (err) {
      logger.error({ err, accountId }, 'Failed to refresh Google token');
      await db.update(accounts).set({
        syncStatus: 'error',
        syncError: 'Token refresh failed',
        updatedAt: new Date(),
      }).where(eq(accounts.id, accountId));
      throw err;
    }
  }

  return client;
}

/**
 * Force a token refresh and return a freshly-credentialed client. Used by
 * `callGoogleApi` to recover from a 401 mid-call without depending on the
 * proactive expiry check. Persists the refreshed credentials.
 */
export async function forceRefreshClient(accountId: string): Promise<OAuth2Client> {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
  if (!account) throw new Error(`Account ${accountId} not found`);
  if (account.provider !== 'google') throw new Error('Account is not connected to Google');

  const refreshToken = decrypt(account.refreshToken);

  if (refreshToken === 'password-placeholder') {
    throw new Error('Account is not connected to Google');
  }

  const client = createOAuth2Client();
  client.setCredentials({ refresh_token: refreshToken });

  try {
    const { credentials } = await client.refreshAccessToken();
    client.setCredentials(credentials);

    const updates: Record<string, unknown> = {
      accessToken: encrypt(credentials.access_token!),
      tokenExpiresAt: new Date(credentials.expiry_date!),
      updatedAt: new Date(),
    };
    if (credentials.refresh_token) {
      updates.refreshToken = encrypt(credentials.refresh_token);
    }
    await db.update(accounts).set(updates).where(eq(accounts.id, accountId));
    logger.info({ accountId }, 'Force-refreshed Google access token');

    return client;
  } catch (err) {
    logger.error({ err, accountId }, 'Failed to force-refresh Google token');
    await db.update(accounts).set({
      syncStatus: 'error',
      syncError: 'Token refresh failed',
      updatedAt: new Date(),
    }).where(eq(accounts.id, accountId));
    throw err;
  }
}

// ─── Google Drive scope helpers ──────────────────────────────────────

/**
 * Generate an OAuth URL that requests Drive scopes incrementally
 * (preserves existing Gmail/Calendar grants).
 */
export function getDriveConnectUrl(state: string): string {
  const client = createOAuth2Client();
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [...SCOPES, ...DRIVE_SCOPES],
    state,
    include_granted_scopes: true,
  });
}

/**
 * Check if account has Google Drive scopes granted.
 * Returns true if the stored token includes drive scopes.
 */
export async function hasDriveScope(accountId: string): Promise<boolean> {
  try {
    const client = await getAuthenticatedClient(accountId);
    const tokenInfo = await client.getTokenInfo(client.credentials.access_token!);
    const grantedScopes = tokenInfo.scopes || [];
    return DRIVE_SCOPES.every((s) => grantedScopes.includes(s));
  } catch {
    return false;
  }
}
