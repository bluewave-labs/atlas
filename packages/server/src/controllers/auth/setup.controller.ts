import type { Request, Response } from 'express';
import * as authService from '../../services/auth.service';
import { logger } from '../../utils/logger';
import { hashPassword, validatePasswordStrength } from '../../utils/password';
import { slugify } from '../../utils/slugify';
import * as tenantService from '../../services/platform/tenant.service';
import * as demoDataService from '../../services/platform/demo-data.service';
import { env } from '../../config/env';

// ─── Setup ──────────────────────────────────────────────────────────

export async function getSetupStatus(_req: Request, res: Response) {
  try {
    const userCount = await authService.getUserCount();
    res.json({
      success: true,
      data: {
        needsSetup: userCount === 0,
        publicSignupEnabled: !env.DISABLE_PUBLIC_SIGNUP,
      },
    });
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

    const { adminName, adminEmail, adminPassword, companyName, includeDemoData } = req.body;

    if (!adminName || !adminEmail || !adminPassword || !companyName) {
      res.status(400).json({ success: false, error: 'adminName, adminEmail, adminPassword, and companyName are required' });
      return;
    }

    const strength = validatePasswordStrength(adminPassword);
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
    const passwordHash = await hashPassword(adminPassword);
    const { user, account } = await authService.createPasswordAccount({
      email: adminEmail,
      name: adminName,
      passwordHash,
    });

    // Create the single tenant; the creating user becomes its owner, which is
    // the only level of privilege we track (no separate super-admin flag).
    const tenant = await tenantService.createTenant({ slug, name: companyName }, user.id);

    // Generate tokens (with tenant + owner tenantRole)
    const jwtTokens = await authService.generateTokens(account, tenant.id, 'owner');

    // Optional demo data — default ON so new users see a populated
    // Atlas. Failures here are non-fatal (logged, not thrown) so the
    // setup flow always completes successfully.
    if (includeDemoData !== false) {
      try {
        await demoDataService.seedDemoData(tenant.id, user.id);
      } catch (err) {
        logger.error({ err, tenantId: tenant.id }, 'Demo data seed failed during setup — continuing');
      }
    }

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
    if (error?.code === '23505' || error?.code === 'TENANT_SLUG_TAKEN') {
      res.status(409).json({ success: false, error: 'Atlas has already been set up' });
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error, message }, 'Setup failed');
    res.status(500).json({ success: false, error: message });
  }
}
