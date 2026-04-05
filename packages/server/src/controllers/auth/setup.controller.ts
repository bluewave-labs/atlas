import type { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import * as authService from '../../services/auth.service';
import { db } from '../../config/database';
import { users } from '../../db/schema';
import { logger } from '../../utils/logger';
import { hashPassword, validatePasswordStrength } from '../../utils/password';
import * as tenantService from '../../services/platform/tenant.service';

// ─── Setup ──────────────────────────────────────────────────────────

export async function getSetupStatus(_req: Request, res: Response) {
  try {
    const userCount = await authService.getUserCount();
    res.json({ success: true, data: { needsSetup: userCount === 0 } });
  } catch (error) {
    logger.error({ error }, 'Failed to check setup status');
    res.status(500).json({ success: false, error: 'Failed to check setup status' });
  }
}

export async function setup(req: Request, res: Response) {
  try {
    const userCount = await authService.getUserCount();
    if (userCount > 0) {
      res.status(409).json({ success: false, error: 'Atlas has already been set up' });
      return;
    }

    const { adminName, adminEmail, adminPassword, companyName } = req.body;

    if (!adminName || !adminEmail || !adminPassword || !companyName) {
      res.status(400).json({ success: false, error: 'adminName, adminEmail, adminPassword, and companyName are required' });
      return;
    }

    const strength = validatePasswordStrength(adminPassword);
    if (!strength.valid) {
      res.status(400).json({ success: false, error: strength.error });
      return;
    }

    // Generate slug from company name
    const slug = companyName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 63);

    if (!slug) {
      res.status(400).json({ success: false, error: 'Company name must contain at least one alphanumeric character' });
      return;
    }

    // Create user + account
    const passwordHash = await hashPassword(adminPassword);
    const { user, account } = await authService.createPasswordAccount({
      email: adminEmail,
      name: adminName,
      passwordHash,
    });

    // Mark as super admin
    await db.update(users).set({ isSuperAdmin: true }).where(eq(users.id, user.id));

    // Create the single tenant
    const tenant = await tenantService.createTenant({ slug, name: companyName }, user.id);

    // Generate tokens (with tenant + superAdmin + tenantRole)
    const jwtTokens = authService.generateTokens(account, tenant.id, true, 'owner');

    logger.info({ userId: user.id, tenantId: tenant.id, email: adminEmail }, 'Atlas initial setup completed');

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
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        },
        tenant,
      },
    });
  } catch (error: any) {
    // Race condition: another request completed setup first
    if (error?.code === '23505') {
      res.status(409).json({ success: false, error: 'Atlas has already been set up' });
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error, message }, 'Setup failed');
    res.status(500).json({ success: false, error: message });
  }
}
