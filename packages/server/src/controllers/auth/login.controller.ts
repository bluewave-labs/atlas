import type { Request, Response } from 'express';
import { eq, and } from 'drizzle-orm';
import * as authService from '../../services/auth.service';
import { db } from '../../config/database';
import { accounts, tenantMembers } from '../../db/schema';
import { logger } from '../../utils/logger';
import { verifyPassword } from '../../utils/password';
import * as tenantService from '../../services/platform/tenant.service';

// ─── Login ──────────────────────────────────────────────────────────

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

    const tenants = await tenantService.listTenantsForUser(account.userId);
    if (tenants.length === 0) {
      res.status(403).json({ success: false, error: 'No organization found for this account' });
      return;
    }
    const tenantId = tenants[0].id;

    const [member] = await db.select({ role: tenantMembers.role })
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, account.userId)))
      .limit(1);
    const tenantRole = member?.role;

    const jwtTokens = authService.generateTokens(account, tenantId, tenantRole);

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
    const userId = payload.userId;

    const tenants = await tenantService.listTenantsForUser(userId);
    if (tenants.length === 0) {
      res.status(403).json({ success: false, error: 'No organization found for this account' });
      return;
    }
    const tenantId = tenants[0].id;

    const [member] = await db.select({ role: tenantMembers.role })
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, tenantId), eq(tenantMembers.userId, userId)))
      .limit(1);
    const tenantRole = member?.role;

    const newTokens = authService.generateTokens({
      id: tenantId,
      email: payload.email,
      userId,
    }, tenantId, tenantRole);

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
    })
      .from(accounts)
      .where(eq(accounts.userId, req.auth!.userId))
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

export async function getInvitationDetails(req: Request, res: Response) {
  try {
    const tenantUserService = await import('../../services/platform/tenant-user.service');

    const token = req.params.token as string;
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

export async function acceptInvitation(req: Request, res: Response) {
  try {
    const tenantUserService = await import('../../services/platform/tenant-user.service');

    const token = req.params.token as string;
    const { name, password } = req.body;

    if (!name || !password) {
      res.status(400).json({ success: false, error: 'name and password are required' });
      return;
    }

    const { validatePasswordStrength } = await import('../../utils/password');
    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      res.status(400).json({ success: false, error: strength.error });
      return;
    }

    const result = await tenantUserService.acceptInvitation(token, { name, password });

    if (!result.tenantId) {
      res.status(500).json({ success: false, error: 'No organization associated with this invitation' });
      return;
    }

    const [member] = await db.select({ role: tenantMembers.role })
      .from(tenantMembers)
      .where(and(eq(tenantMembers.tenantId, result.tenantId), eq(tenantMembers.userId, result.account.userId)))
      .limit(1);
    const tenantRole = member?.role;

    const jwtTokens = authService.generateTokens(result.account, result.tenantId, tenantRole);

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
