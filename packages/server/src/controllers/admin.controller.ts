import type { Request, Response } from 'express';
import { env } from '../config/env';
import { db } from '../config/database';
import { tenants, tenantMembers, appInstallations, appCatalog, appUserAssignments } from '../db/schema';
import { eq, count } from 'drizzle-orm';
import { listAtlasContainers } from '../services/platform/docker.service';
import { startApp, stopApp, restartApp } from '../services/platform/install.service';
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

    // Check slug uniqueness
    const existingTenant = await tenantService.getTenantBySlug(slug);
    if (existingTenant) {
      res.status(409).json({ success: false, error: 'Slug already taken' });
      return;
    }

    // If owner details provided, create a user for this tenant
    let ownerId: string;
    if (ownerName && ownerPassword) {
      const email = `${slug.replace(/[^a-z0-9]/g, '')}@${slug}.local`;
      const passwordHash = await hashPassword(ownerPassword);
      const { user } = await createPasswordAccount({ email, name: ownerName, passwordHash });
      ownerId = user.id;
    } else {
      // Use the super admin as the owner
      ownerId = req.auth!.userId;
    }

    const tenant = await tenantService.createTenant({ slug, name }, ownerId);

    res.status(201).json({ success: true, data: tenant });
  } catch (err: any) {
    if (err?.code === '23505') {
      res.status(409).json({ success: false, error: 'Slug already taken' });
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
    const statusCounts = await db
      .select({
        status: appInstallations.status,
        count: count(),
      })
      .from(appInstallations)
      .groupBy(appInstallations.status);

    const statusMap: Record<string, number> = {};
    for (const row of statusCounts) {
      statusMap[row.status] = row.count;
    }

    let containerCount = 0;
    if (env.PLATFORM_RUNTIME === 'docker') {
      try {
        const containers = await listAtlasContainers();
        containerCount = containers.length;
      } catch {
        // Docker may not be available
      }
    }

    res.json({
      success: true,
      data: {
        tenants: tenantCount.count,
        installations: {
          running: statusMap['running'] ?? 0,
          stopped: statusMap['stopped'] ?? 0,
          error: statusMap['error'] ?? 0,
          installing: statusMap['installing'] ?? 0,
          total: Object.values(statusMap).reduce((a, b) => a + b, 0),
        },
        containers: containerCount,
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

    const installCounts = await db
      .select({ tenantId: appInstallations.tenantId, count: count() })
      .from(appInstallations)
      .groupBy(appInstallations.tenantId);

    const memberMap = new Map(memberCounts.map((r) => [r.tenantId, r.count]));
    const installMap = new Map(installCounts.map((r) => [r.tenantId, r.count]));

    res.json({
      success: true,
      data: allTenants.map((t) => ({
        ...t,
        memberCount: memberMap.get(t.id) ?? 0,
        installationCount: installMap.get(t.id) ?? 0,
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
    const installations = await db
      .select({
        installation: appInstallations,
        appName: appCatalog.name,
        manifestId: appCatalog.manifestId,
      })
      .from(appInstallations)
      .leftJoin(appCatalog, eq(appInstallations.catalogAppId, appCatalog.id))
      .where(eq(appInstallations.tenantId, id));

    // Get assignment counts per installation
    const assignmentCounts = await db
      .select({ installationId: appUserAssignments.installationId, count: count() })
      .from(appUserAssignments)
      .groupBy(appUserAssignments.installationId);
    const assignmentMap = new Map(assignmentCounts.map((r) => [r.installationId, r.count]));

    res.json({
      success: true,
      data: {
        ...tenant,
        members,
        installations: installations.map((i) => ({
          ...i.installation,
          appName: i.appName,
          manifestId: i.manifestId,
          assignedCount: assignmentMap.get(i.installation.id) ?? 0,
        })),
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

// ─── Installations ──────────────────────────────────────────────────────────

export async function listAllInstallations(_req: Request, res: Response) {
  try {


    const rows = await db
      .select({
        installation: appInstallations,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
        appName: appCatalog.name,
        manifestId: appCatalog.manifestId,
      })
      .from(appInstallations)
      .leftJoin(tenants, eq(appInstallations.tenantId, tenants.id))
      .leftJoin(appCatalog, eq(appInstallations.catalogAppId, appCatalog.id))
      .orderBy(appInstallations.createdAt);

    res.json({
      success: true,
      data: rows.map((r) => ({
        ...r.installation,
        tenantName: r.tenantName,
        tenantSlug: r.tenantSlug,
        appName: r.appName,
        manifestId: r.manifestId,
      })),
    });
  } catch (err) {
    logger.error({ err }, 'Failed to list all installations');
    res.status(500).json({ success: false, error: 'Failed to list installations' });
  }
}

export async function startInstallation(req: Request, res: Response) {
  try {
    await startApp(req.params.id as string);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Failed to start installation');
    res.status(500).json({ success: false, error: 'Failed to start installation' });
  }
}

export async function stopInstallation(req: Request, res: Response) {
  try {
    await stopApp(req.params.id as string);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Failed to stop installation');
    res.status(500).json({ success: false, error: 'Failed to stop installation' });
  }
}

export async function restartInstallation(req: Request, res: Response) {
  try {
    await restartApp(req.params.id as string);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Failed to restart installation');
    res.status(500).json({ success: false, error: 'Failed to restart installation' });
  }
}

// ─── Containers ─────────────────────────────────────────────────────────────

export async function listContainers(_req: Request, res: Response) {
  try {
    if (env.PLATFORM_RUNTIME !== 'docker') {
      res.json({ success: true, data: [] });
      return;
    }

    const containers = await listAtlasContainers();
    res.json({ success: true, data: containers });
  } catch (err) {
    logger.error({ err }, 'Failed to list containers');
    res.status(500).json({ success: false, error: 'Failed to list containers' });
  }
}
