import type { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import * as authService from '../services/auth.service';
import { triggerInitialSync } from '../services/sync.service';
import { db } from '../config/database';
import { accounts, users, userSettings } from '../db/schema';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import { encrypt } from '../utils/crypto';
import { hashPassword, verifyPassword, validatePasswordStrength } from '../utils/password';
import * as tenantService from '../services/platform/tenant.service';

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

export async function register(req: Request, res: Response) {
  try {
    const { companyName, companySlug, userName, email, password } = req.body;

    if (!companyName || !companySlug || !userName || !email || !password) {
      res.status(400).json({ success: false, error: 'All fields are required: companyName, companySlug, userName, email, password' });
      return;
    }

    // Validate slug format
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(companySlug) || companySlug.length > 63) {
      res.status(400).json({ success: false, error: 'Slug must be lowercase alphanumeric with hyphens, max 63 chars' });
      return;
    }

    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      res.status(400).json({ success: false, error: strength.error });
      return;
    }

    // Check email uniqueness
    const existing = await authService.findAccountByEmail(email);
    if (existing) {
      res.status(409).json({ success: false, error: 'An account with this email already exists' });
      return;
    }

    // Create user + account
    const passwordHash = await hashPassword(password);
    const { user, account } = await authService.createPasswordAccount({ email, name: userName, passwordHash });

    // Create tenant and add owner
    let tenant = null;
    let tenantId: string | undefined;
    try {
      if (env.DATABASE_PLATFORM_URL) {
        tenant = await tenantService.createTenant({ slug: companySlug, name: companyName }, user.id);
        tenantId = tenant.id;
      }
    } catch (err: any) {
      if (err?.code === '23505') {
        res.status(409).json({ success: false, error: 'Company slug already taken' });
        return;
      }
      throw err;
    }

    const jwtTokens = authService.generateTokens(account, tenantId);

    res.status(201).json({
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
        tenant,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error, message }, 'Registration failed');
    res.status(500).json({ success: false, error: message });
  }
}

export async function loginWithPassword(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required' });
      return;
    }

    const account = await authService.findAccountByEmail(email);
    if (!account || !account.passwordHash) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const isValid = await verifyPassword(password, account.passwordHash);
    if (!isValid) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    // Look up tenant membership
    let tenantId: string | undefined;
    try {
      if (env.DATABASE_PLATFORM_URL) {
        const tenants = await tenantService.listTenantsForUser(account.userId);
        if (tenants.length > 0) {
          tenantId = tenants[0].id;
        }
      }
    } catch {
      // Platform DB may not be configured — proceed without tenantId
    }

    const jwtTokens = authService.generateTokens(account, tenantId);

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
    logger.error({ error, message }, 'Login failed');
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

    // Include tenantId in refreshed tokens
    let tenantId: string | undefined;
    try {
      if (env.DATABASE_PLATFORM_URL) {
        const tenants = await tenantService.listTenantsForUser(userId);
        if (tenants.length > 0) {
          tenantId = tenants[0].id;
        }
      }
    } catch {
      // Platform DB may not be configured
    }

    const newTokens = authService.generateTokens({
      id: payload.accountId,
      email: payload.email,
      userId,
    }, tenantId);

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

// GET /api/auth/invitation/:token — get invitation details (public)
export async function getInvitationDetails(req: Request, res: Response) {
  try {
    const tenantUserService = await import('../services/platform/tenant-user.service');

    const token = (req.params as any).token;
    const invitation = await tenantUserService.getInvitation(token);
    if (!invitation) {
      res.status(404).json({ success: false, error: 'Invitation not found' });
      return;
    }

    if (invitation.acceptedAt) {
      res.status(410).json({ success: false, error: 'Invitation already accepted' });
      return;
    }

    if (new Date(invitation.expiresAt) < new Date()) {
      res.status(410).json({ success: false, error: 'Invitation expired' });
      return;
    }

    // Get tenant name for display
    const tenant = await tenantService.getTenantById(invitation.tenantId);

    res.json({
      success: true,
      data: {
        email: invitation.email,
        role: invitation.role,
        tenantName: tenant?.name ?? 'Unknown',
        expiresAt: invitation.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get invitation details');
    res.status(500).json({ success: false, error: 'Failed to get invitation details' });
  }
}

// POST /api/auth/invitation/:token/accept — accept an invitation (public)
export async function acceptInvitation(req: Request, res: Response) {
  try {
    const tenantUserService = await import('../services/platform/tenant-user.service');

    const token = (req.params as any).token;
    const { name, password } = req.body;

    if (!name || !password) {
      res.status(400).json({ success: false, error: 'name and password are required' });
      return;
    }

    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      res.status(400).json({ success: false, error: strength.error });
      return;
    }

    const result = await tenantUserService.acceptInvitation(token, { name, password });
    const jwtTokens = authService.generateTokens(result.account, result.tenantId);

    res.json({
      success: true,
      data: {
        accessToken: jwtTokens.accessToken,
        refreshToken: jwtTokens.refreshToken,
        account: {
          id: result.account.id,
          userId: result.account.userId,
          email: result.account.email,
          name: result.account.name,
          pictureUrl: result.account.pictureUrl,
          provider: result.account.provider,
          providerId: result.account.providerId,
          historyId: result.account.historyId ?? null,
          lastSync: result.account.lastSync ?? null,
          syncStatus: result.account.syncStatus as 'idle' | 'syncing' | 'error',
          createdAt: result.account.createdAt,
          updatedAt: result.account.updatedAt,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error, message }, 'Failed to accept invitation');
    res.status(400).json({ success: false, error: message });
  }
}

// POST /api/auth/link-google — link a Google account to a password-based user (authenticated)
export async function linkGoogleAccount(req: Request, res: Response) {
  try {
    const { code, redirectUri } = req.body;
    if (!code) {
      res.status(400).json({ success: false, error: 'Missing authorization code' });
      return;
    }

    const tokens = await authService.exchangeCodeForTokens(code, redirectUri);
    const userInfo = await authService.getGoogleUserInfo(tokens.access_token!);

    // Link under the existing user
    const { account } = await authService.findOrCreateAccount(userInfo, tokens, req.auth!.userId);

    res.json({
      success: true,
      data: {
        id: account.id,
        email: account.email,
        name: account.name,
        provider: account.provider,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error, message }, 'Failed to link Google account');
    res.status(500).json({ success: false, error: message });
  }
}

// POST /api/auth/local — find or create a local (offline) identity for non-email features
// The client sends a persistent `clientId` stored in localStorage. If a local account
// already exists for that clientId we return it; otherwise we create one.
export async function createLocalUser(req: Request, res: Response) {
  try {
    const clientId: string | undefined = req.body.clientId;

    // If the client sent a clientId, look for an existing local account whose
    // providerId matches. This prevents creating duplicate identities.
    if (clientId) {
      const [existing] = await db
        .select()
        .from(accounts)
        .where(eq(accounts.providerId, clientId))
        .limit(1);

      if (existing) {
        const jwtTokens = authService.generateTokens(existing);
        res.json({
          success: true,
          data: {
            accessToken: jwtTokens.accessToken,
            refreshToken: jwtTokens.refreshToken,
            account: {
              id: existing.id,
              userId: existing.userId,
              email: existing.email,
              name: existing.name,
              pictureUrl: existing.pictureUrl,
              provider: existing.provider,
              providerId: existing.providerId,
              historyId: existing.historyId ?? null,
              lastSync: existing.lastSync ?? null,
              syncStatus: existing.syncStatus as 'idle' | 'syncing' | 'error',
              createdAt: existing.createdAt,
              updatedAt: existing.updatedAt,
            },
          },
        });
        return;
      }
    }

    const now = new Date().toISOString();

    // Create user
    const [user] = await db.insert(users).values({
      createdAt: now,
      updatedAt: now,
    }).returning();

    // Use clientId as the stable providerId so subsequent calls find this account
    const stableId = clientId || user.id;
    const localEmail = `local-${stableId}@atlasmail.local`;

    // Create account with placeholder tokens
    const [account] = await db.insert(accounts).values({
      userId: user.id,
      email: localEmail,
      name: null,
      pictureUrl: null,
      provider: 'local',
      providerId: stableId,
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
