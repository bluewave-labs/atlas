import type { Request, Response } from 'express';
import { db } from '../config/database';
import { tenants, tenantMembers, users, accounts } from '../db/schema';
import { eq, count, desc } from 'drizzle-orm';
import { logger } from '../utils/logger';
import * as tenantService from '../services/platform/tenant.service';
import { createPasswordAccount } from '../services/auth.service';
import { hashPassword } from '../utils/password';

// ─── Create tenant ──────────────────────────────────────────────────────────

export async function createTenant(req: Request, res: Response) {
  try {
    const { name, slug, ownerName, ownerPassword } = req.body;

    if (!name || !slug) {
      res.status(400).json({ success: false, error: 'name and slug are required' });
      return;
    }

    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug) || slug.length > 63) {
      res.status(400).json({ success: false, error: 'Slug must be lowercase alphanumeric with hyphens, max 63 chars' });
      return;
    }

    const existingTenant = await tenantService.getTenantBySlug(slug);
    if (existingTenant) {
      res.status(409).json({ success: false, error: 'Slug already taken' });
      return;
    }

    let ownerId: string;
    if (ownerName && ownerPassword) {
      const { validatePasswordStrength } = await import('../utils/password');
      const strength = validatePasswordStrength(ownerPassword);
      if (!strength.valid) {
        res.status(400).json({ success: false, error: strength.error });
        return;
      }
      const email = `${slug.replace(/[^a-z0-9]/g, '')}@${slug}.local`;
      const passwordHash = await hashPassword(ownerPassword);
      const { user } = await createPasswordAccount({ email, name: ownerName, passwordHash });
      ownerId = user.id;
    } else {
      ownerId = req.auth!.userId;
    }

    const tenant = await tenantService.createTenant({ slug, name }, ownerId);

    res.status(201).json({ success: true, data: tenant });
  } catch (err: any) {
    if (err?.code === 'TENANT_SLUG_TAKEN' || err?.code === '23505') {
      res.status(409).json({ success: false, error: err?.code === 'TENANT_SLUG_TAKEN' ? err.message : 'Slug already taken' });
      return;
    }
    logger.error({ err }, 'Failed to create tenant');
    res.status(500).json({ success: false, error: 'Failed to create tenant' });
  }
}

// ─── Overview ───────────────────────────────────────────────────────────────

export async function getOverview(_req: Request, res: Response) {
  try {
    const [tenantCount] = await db.select({ count: count() }).from(tenants);

    res.json({
      success: true,
      data: {
        tenants: tenantCount.count,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to get admin overview');
    res.status(500).json({ success: false, error: 'Failed to get overview' });
  }
}

// ─── Tenants ────────────────────────────────────────────────────────────────

export async function listTenants(_req: Request, res: Response) {
  try {
    const allTenants = await db.select().from(tenants).orderBy(tenants.createdAt);

    const memberCounts = await db
      .select({ tenantId: tenantMembers.tenantId, count: count() })
      .from(tenantMembers)
      .groupBy(tenantMembers.tenantId);

    const memberMap = new Map(memberCounts.map((r) => [r.tenantId, r.count]));

    res.json({
      success: true,
      data: allTenants.map((t) => ({
        ...t,
        memberCount: memberMap.get(t.id) ?? 0,
      })),
    });
  } catch (err) {
    logger.error({ err }, 'Failed to list tenants');
    res.status(500).json({ success: false, error: 'Failed to list tenants' });
  }
}

export async function getTenant(req: Request, res: Response) {
  try {
    const id = req.params.id as string;

    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
    if (!tenant) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    const members = await db.select().from(tenantMembers).where(eq(tenantMembers.tenantId, id));

    res.json({
      success: true,
      data: {
        ...tenant,
        members,
      },
    });
  } catch (err) {
    logger.error({ err }, 'Failed to get tenant');
    res.status(500).json({ success: false, error: 'Failed to get tenant' });
  }
}

export async function updateTenantStatus(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { status } = req.body;

    if (!['active', 'suspended'].includes(status)) {
      res.status(400).json({ success: false, error: 'Status must be "active" or "suspended"' });
      return;
    }

    const [updated] = await db
      .update(tenants)
      .set({ status, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error({ err }, 'Failed to update tenant status');
    res.status(500).json({ success: false, error: 'Failed to update tenant status' });
  }
}

// ─── Update tenant storage quota ──────────────────────────────────────────────

export async function updateTenantStorageQuota(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { storageQuotaBytes } = req.body;

    if (typeof storageQuotaBytes !== 'number' || storageQuotaBytes < 0) {
      res.status(400).json({ success: false, error: 'storageQuotaBytes must be a non-negative number' });
      return;
    }

    const [updated] = await db
      .update(tenants)
      .set({ storageQuotaBytes, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error({ err }, 'Failed to update tenant storage quota');
    res.status(500).json({ success: false, error: 'Failed to update tenant storage quota' });
  }
}

const VALID_PLANS = ['starter', 'pro', 'enterprise'];

export async function updateTenantPlanHandler(req: Request, res: Response) {
  try {
    const id = req.params.id as string;
    const { plan } = req.body;

    if (!plan || !VALID_PLANS.includes(plan)) {
      res.status(400).json({ success: false, error: `Plan must be one of: ${VALID_PLANS.join(', ')}` });
      return;
    }

    const [updated] = await db
      .update(tenants)
      .set({ plan, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error({ err }, 'Failed to update tenant plan');
    res.status(500).json({ success: false, error: 'Failed to update tenant plan' });
  }
}

// ─── List all users across all tenants ──────────────────────────────────────

export async function listAllUsers(_req: Request, res: Response) {
  try {
    // Users (identity layer, 1 per person). Super-admin view.
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        isSuperAdmin: users.isSuperAdmin,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    // Collect primary account email + provider per user (first one wins).
    const allAccounts = await db
      .select({
        userId: accounts.userId,
        email: accounts.email,
        provider: accounts.provider,
        pictureUrl: accounts.pictureUrl,
      })
      .from(accounts);
    const accountByUser = new Map<string, typeof allAccounts[number]>();
    for (const a of allAccounts) {
      if (!accountByUser.has(a.userId)) accountByUser.set(a.userId, a);
    }

    // Tenant memberships per user.
    const memberships = await db
      .select({
        userId: tenantMembers.userId,
        tenantId: tenantMembers.tenantId,
        role: tenantMembers.role,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
      })
      .from(tenantMembers)
      .leftJoin(tenants, eq(tenantMembers.tenantId, tenants.id));
    const tenantsByUser = new Map<string, Array<typeof memberships[number]>>();
    for (const m of memberships) {
      if (!tenantsByUser.has(m.userId)) tenantsByUser.set(m.userId, []);
      tenantsByUser.get(m.userId)!.push(m);
    }

    const data = allUsers.map((u) => {
      const acct = accountByUser.get(u.id);
      return {
        id: u.id,
        name: u.name,
        email: acct?.email ?? null,
        provider: acct?.provider ?? null,
        pictureUrl: acct?.pictureUrl ?? null,
        isSuperAdmin: u.isSuperAdmin,
        createdAt: u.createdAt,
        tenants: (tenantsByUser.get(u.id) ?? []).map((m) => ({
          id: m.tenantId,
          name: m.tenantName,
          slug: m.tenantSlug,
          role: m.role,
        })),
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    logger.error({ err }, 'Failed to list all users');
    res.status(500).json({ success: false, error: 'Failed to list users' });
  }
}
