import type { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import * as authService from '../../services/auth.service';
import { db } from '../../config/database';
import { accounts } from '../../db/schema';
import { logger } from '../../utils/logger';
import { hashPassword, validatePasswordStrength } from '../../utils/password';
import { slugify } from '../../utils/slugify';
import * as tenantService from '../../services/platform/tenant.service';
import { env } from '../../config/env';

export async function register(req: Request, res: Response) {
  try {
    if (env.DISABLE_PUBLIC_SIGNUP) {
      res.status(403).json({ success: false, error: 'Public registration is disabled on this instance' });
      return;
    }

    const { name, email, password, companyName } = req.body;

    if (!name || !email || !password || !companyName) {
      res.status(400).json({ success: false, error: 'name, email, password, and companyName are required' });
      return;
    }

    // Check if email already exists
    const existing = await db.select().from(accounts).where(eq(accounts.email, email)).limit(1);
    if (existing.length > 0) {
      res.status(409).json({ success: false, error: 'An account with this email already exists' });
      return;
    }

    const strength = validatePasswordStrength(password);
    if (!strength.valid) {
      res.status(400).json({ success: false, error: strength.error });
      return;
    }

    const slug = slugify(companyName);

    if (!slug) {
      res.status(400).json({ success: false, error: 'Company name must contain at least one alphanumeric character' });
      return;
    }

    // Create user + account
    const passwordHash = await hashPassword(password);
    const { user, account } = await authService.createPasswordAccount({
      email,
      name,
      passwordHash,
    });

    // Create tenant + add user as owner
    const tenant = await tenantService.createTenant({ slug, name: companyName }, user.id);

    // Generate tokens with tenantId
    const tokens = await authService.generateTokens(account, tenant.id, 'owner');

    logger.info({ userId: user.id, tenantId: tenant.id, email }, 'New registration completed');

    res.status(201).json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
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
        tenant,
      },
    });
  } catch (error: any) {
    if (error?.code === 'TENANT_SLUG_TAKEN') {
      res.status(409).json({ success: false, error: error.message });
      return;
    }
    if (error?.code === '23505') {
      res.status(409).json({ success: false, error: 'An account with this email already exists' });
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error, message }, 'Registration failed');
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
}
