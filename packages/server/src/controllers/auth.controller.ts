import type { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import * as authService from '../services/auth.service';
import { triggerInitialSync } from '../services/sync.service';
import { db } from '../config/database';
import { accounts, users, userSettings } from '../db/schema';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { encrypt } from '../utils/crypto';

export async function getAuthUrl(req: Request, res: Response) {
  const redirectUri = req.query.redirect_uri as string || `${req.protocol}://${req.get('host')}/api/v1/auth/callback`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${env.GOOGLE_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent('openid email profile https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/contacts.readonly https://www.googleapis.com/auth/calendar')}` +
    `&access_type=offline` +
    `&prompt=consent`;

  res.json({ success: true, data: { url } });
}

export async function handleCallback(req: Request, res: Response) {
  try {
    const { code, redirectUri, existingToken } = req.body;
    logger.info({ hasCode: !!code, redirectUri, hasExistingToken: !!existingToken }, 'Auth callback received');

    if (!code) {
      res.status(400).json({ success: false, error: 'Missing authorization code' });
      return;
    }

    // If the client sent an existing JWT, extract the userId so the new account
    // is linked under the same user (multi-account "add account" flow).
    let existingUserId: string | undefined;
    if (existingToken) {
      try {
        const payload = authService.verifyRefreshToken(existingToken);
        existingUserId = payload.userId;
        // Backwards compat: old refresh tokens lack userId — look it up
        if (!existingUserId) {
          const [acct] = await db.select({ userId: accounts.userId })
            .from(accounts)
            .where(eq(accounts.id, payload.accountId))
            .limit(1);
          existingUserId = acct?.userId;
        }
      } catch {
        // Token invalid/expired — ignore and create a new user
      }
    }

    logger.info('Exchanging code for tokens...');
    const tokens = await authService.exchangeCodeForTokens(code, redirectUri);
    logger.info({ hasAccessToken: !!tokens.access_token }, 'Tokens received');

    const userInfo = await authService.getGoogleUserInfo(tokens.access_token!);
    logger.info({ email: userInfo.email }, 'User info fetched');

    const { account, isNew } = await authService.findOrCreateAccount(userInfo, tokens, existingUserId);
    logger.info({ accountId: account.id, isNew }, 'Account ready');

    const jwtTokens = authService.generateTokens(account);

    // Enqueue a full sync for brand-new accounts so their mailbox is populated.
    // Existing accounts are kept up to date by the periodic incremental sync.
    if (isNew) {
      triggerInitialSync(account.id).catch((err) =>
        logger.error({ err, accountId: account.id }, 'Failed to enqueue initial sync'),
      );
    }

    res.json({
      success: true,
      data: {
        accessToken: jwtTokens.accessToken,
        refreshToken: jwtTokens.refreshToken,
        account: {
          id: account.id,
          userId: account.userId,
          email: account.email,
          name: account.name,
          pictureUrl: account.pictureUrl,
          provider: account.provider,
          providerId: account.providerId,
          historyId: account.historyId ?? null,
          lastSync: account.lastSync ?? null,
          syncStatus: account.syncStatus as 'idle' | 'syncing' | 'error',
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const detail = (error as any)?.response?.data || (error as any)?.code || '';
    console.error('AUTH CALLBACK ERROR:', message, detail);
    logger.error({ error, message, detail }, 'Auth callback failed');
    res.status(500).json({ success: false, error: message });
  }
}

export async function refreshToken(req: Request, res: Response) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ success: false, error: 'Missing refresh token' });
      return;
    }

    const payload = authService.verifyRefreshToken(refreshToken);

    // Backwards compatibility: old refresh tokens won't have userId.
    // Look it up from the database so the new token pair includes it.
    let userId = payload.userId;
    if (!userId) {
      const [acct] = await db.select({ userId: accounts.userId })
        .from(accounts)
        .where(eq(accounts.id, payload.accountId))
        .limit(1);
      userId = acct?.userId;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Account not found' });
        return;
      }
    }

    const newTokens = authService.generateTokens({
      id: payload.accountId,
      email: payload.email,
      userId,
    });

    res.json({
      success: true,
      data: { accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken },
    });
  } catch {
    res.status(401).json({ success: false, error: 'Invalid refresh token' });
  }
}

export async function getMe(req: Request, res: Response) {
  try {
    const [account] = await db.select({
      id: accounts.id,
      email: accounts.email,
      name: accounts.name,
      pictureUrl: accounts.pictureUrl,
      provider: accounts.provider,
      syncStatus: accounts.syncStatus,
    })
      .from(accounts)
      .where(eq(accounts.id, req.auth!.accountId))
      .limit(1);

    if (!account) {
      res.status(404).json({ success: false, error: 'Account not found' });
      return;
    }

    res.json({ success: true, data: account });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch account');
    res.status(500).json({ success: false, error: 'Failed to fetch account' });
  }
}

// GET /api/auth/accounts — list all accounts for the current user
export async function listAccounts(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const userAccounts = await authService.listUserAccounts(userId);
    res.json({ success: true, data: userAccounts });
  } catch (error) {
    logger.error({ error }, 'Failed to list user accounts');
    res.status(500).json({ success: false, error: 'Failed to list accounts' });
  }
}

// POST /api/auth/local — create a local (offline) identity for non-email features
export async function createLocalUser(req: Request, res: Response) {
  try {
    const now = new Date().toISOString();

    // Create user
    const [user] = await db.insert(users).values({
      createdAt: now,
      updatedAt: now,
    }).returning();

    const localEmail = `local-${user.id}@atlasmail.local`;

    // Create account with placeholder tokens
    const [account] = await db.insert(accounts).values({
      userId: user.id,
      email: localEmail,
      name: null,
      pictureUrl: null,
      provider: 'local',
      providerId: user.id,
      accessToken: encrypt('local-placeholder'),
      refreshToken: encrypt('local-placeholder'),
      tokenExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    }).returning();

    // Create default user settings (same as Google flow)
    await db.insert(userSettings).values({ accountId: account.id });

    // Issue JWT
    const jwtTokens = authService.generateTokens(account);

    res.json({
      success: true,
      data: {
        accessToken: jwtTokens.accessToken,
        refreshToken: jwtTokens.refreshToken,
        account: {
          id: account.id,
          userId: account.userId,
          email: account.email,
          name: account.name,
          pictureUrl: account.pictureUrl,
          provider: account.provider,
          providerId: account.providerId,
          historyId: account.historyId ?? null,
          lastSync: account.lastSync ?? null,
          syncStatus: account.syncStatus as 'idle' | 'syncing' | 'error',
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error, message }, 'Failed to create local user');
    res.status(500).json({ success: false, error: message });
  }
}
