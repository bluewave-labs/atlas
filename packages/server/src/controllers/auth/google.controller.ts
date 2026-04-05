import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { db } from '../../config/database';
import { accounts } from '../../db/schema';
import { logger } from '../../utils/logger';
import { isGoogleConfigured, getAuthUrl, exchangeCode, createOAuth2Client } from '../../services/google-auth';
import { encrypt, decrypt } from '../../utils/crypto';
import { env } from '../../config/env';

// ─── Google OAuth (CRM email/calendar sync) ────────────────────────

export async function googleConnect(req: Request, res: Response) {
  try {
    if (!isGoogleConfigured()) {
      res.status(501).json({ success: false, error: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' });
      return;
    }

    const state = jwt.sign(
      { userId: req.auth!.userId, accountId: req.auth!.accountId },
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

    logger.info({ accountId }, 'Google account connected successfully');
    res.redirect(`${env.CLIENT_PUBLIC_URL}/crm?google_connected=true`);
  } catch (error) {
    logger.error({ error }, 'Google OAuth callback failed');
    res.redirect(`${env.CLIENT_PUBLIC_URL}/crm?google_error=true`);
  }
}

export async function googleDisconnect(req: Request, res: Response) {
  try {
    const accountId = req.auth!.accountId;

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
