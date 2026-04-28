import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../../config/database';
import { accounts, messageChannels, tenantMembers } from '../../db/schema';
import { logger } from '../../utils/logger';
import { isGoogleConfigured, getAuthUrl, exchangeCode, createOAuth2Client } from '../../services/google-auth';
import { encrypt, decrypt } from '../../utils/crypto';
import { env } from '../../config/env';
import { getAccountIdForUser } from '../../utils/account-lookup';

// ─── Google OAuth (CRM email/calendar sync) ────────────────────────

export async function googleConnect(req: Request, res: Response) {
  try {
    if (!isGoogleConfigured()) {
      res.status(501).json({ success: false, error: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' });
      return;
    }

    const accountId = await getAccountIdForUser(req.auth!.userId);
    if (!accountId) {
      res.status(404).json({ success: false, error: 'Account not found' });
      return;
    }

    const state = jwt.sign(
      { userId: req.auth!.userId, accountId },
      env.JWT_SECRET,
      { expiresIn: '10m' },
    );

    res.json({ success: true, data: { url: getAuthUrl(state) } });
  } catch (error) {
    logger.error({ error }, 'Failed to generate Google connect URL');
    res.status(500).json({ success: false, error: 'Failed to generate Google connect URL' });
  }
}

export async function googleCallback(req: Request, res: Response) {
  try {
    const stateParam = req.query.state as string;
    const code = req.query.code as string;

    if (!stateParam || !code) {
      res.redirect(`${env.CLIENT_PUBLIC_URL}/crm?google_error=true`);
      return;
    }

    // Verify state JWT
    const payload = jwt.verify(stateParam, env.JWT_SECRET) as { userId: string; accountId: string };
    const { accountId } = payload;

    // Exchange authorization code for tokens
    const tokens = await exchangeCode(code);

    // Encrypt tokens and update account
    await db.update(accounts).set({
      accessToken: encrypt(tokens.access_token!),
      refreshToken: encrypt(tokens.refresh_token!),
      tokenExpiresAt: new Date(tokens.expiry_date!),
      provider: 'google',
      syncStatus: 'pending',
      syncError: null,
      updatedAt: new Date(),
    }).where(eq(accounts.id, accountId));

    // Create the message channel if this is the user's first connection.
    // Idempotent: if a channel already exists for this account (either from
    // a prior connect or from the bootstrap migration backfill), skip.
    // Failure here is logged but does not block the OAuth callback — the
    // user's tokens are already saved; an operator can manually repair the
    // channel via the migration's backfill SELECT or via re-connect.
    try {
      const [account] = await db
        .select({ id: accounts.id, email: accounts.email, userId: accounts.userId })
        .from(accounts)
        .where(eq(accounts.id, accountId))
        .limit(1);

      if (account) {
        const [existingChannel] = await db
          .select({ id: messageChannels.id })
          .from(messageChannels)
          .where(eq(messageChannels.accountId, account.id))
          .limit(1);

        if (!existingChannel) {
          // Find the user's tenant via tenant_members. Pick the earliest
          // membership (deterministic) — same rule as the migration backfill.
          const [membership] = await db
            .select({ tenantId: tenantMembers.tenantId })
            .from(tenantMembers)
            .where(eq(tenantMembers.userId, account.userId))
            .orderBy(tenantMembers.createdAt)
            .limit(1);

          if (membership) {
            await db.insert(messageChannels).values({
              accountId: account.id,
              tenantId: membership.tenantId,
              ownerUserId: account.userId,
              type: 'gmail',
              handle: account.email.toLowerCase(),
              visibility: 'private',
              isSyncEnabled: true,
              contactAutoCreationPolicy: 'send-only',
              syncStage: 'pending',
            });
            logger.info({ accountId: account.id, handle: account.email.toLowerCase(), tenantId: membership.tenantId }, 'Created message channel on connect');
          } else {
            logger.warn({ accountId: account.id, userId: account.userId }, 'No tenant_member found for user; channel not created');
          }
        }
      }
    } catch (err) {
      logger.error({ err, accountId }, 'Failed to create message channel on connect');
    }

    logger.info({ accountId }, 'Google account connected successfully');
    res.redirect(`${env.CLIENT_PUBLIC_URL}/crm?google_connected=true`);
  } catch (error) {
    logger.error({ error }, 'Google OAuth callback failed');
    res.redirect(`${env.CLIENT_PUBLIC_URL}/crm?google_error=true`);
  }
}

export async function googleDisconnect(req: Request, res: Response) {
  try {
    const accountId = await getAccountIdForUser(req.auth!.userId);
    if (!accountId) {
      res.status(404).json({ success: false, error: 'Account not found' });
      return;
    }

    // Best effort: revoke the token
    try {
      const [account] = await db.select({ accessToken: accounts.accessToken })
        .from(accounts).where(eq(accounts.id, accountId)).limit(1);
      if (account) {
        const token = decrypt(account.accessToken);
        if (token && token !== 'password-placeholder') {
          const client = createOAuth2Client();
          await client.revokeToken(token);
        }
      }
    } catch (revokeErr) {
      logger.warn({ revokeErr, accountId }, 'Failed to revoke Google token (best effort)');
    }

    // Reset account to password-only state
    await db.update(accounts).set({
      accessToken: encrypt('password-placeholder'),
      refreshToken: encrypt('password-placeholder'),
      provider: 'password',
      historyId: null,
      lastFullSync: null,
      syncStatus: 'idle',
      syncError: null,
      updatedAt: new Date(),
    }).where(eq(accounts.id, accountId));

    logger.info({ accountId }, 'Google account disconnected');
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to disconnect Google account');
    res.status(500).json({ success: false, error: 'Failed to disconnect Google account' });
  }
}
