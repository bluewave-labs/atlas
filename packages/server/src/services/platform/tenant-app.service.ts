import { eq, and } from 'drizzle-orm';
import { db } from '../../config/database';
import { tenantApps } from '../../db/schema';
import { logger } from '../../utils/logger';
import { serverAppRegistry } from '../../apps';

export async function listTenantApps(tenantId: string) {
  return db.select().from(tenantApps).where(eq(tenantApps.tenantId, tenantId));
}

export async function getEnabledAppIds(tenantId: string): Promise<string[]> {
  const rows = await db.select({ appId: tenantApps.appId })
    .from(tenantApps)
    .where(and(eq(tenantApps.tenantId, tenantId), eq(tenantApps.isEnabled, true)));
  return rows.map(r => r.appId);
}

export async function isAppEnabled(tenantId: string, appId: string): Promise<boolean> {
  const [row] = await db.select({ isEnabled: tenantApps.isEnabled })
    .from(tenantApps)
    .where(and(eq(tenantApps.tenantId, tenantId), eq(tenantApps.appId, appId)))
    .limit(1);
  return row?.isEnabled ?? false;
}

export async function enableApp(tenantId: string, appId: string, userId: string) {
  const manifest = serverAppRegistry.get(appId);
  if (!manifest) throw new Error(`Unknown app: ${appId}`);

  const [existing] = await db.select().from(tenantApps)
    .where(and(eq(tenantApps.tenantId, tenantId), eq(tenantApps.appId, appId)))
    .limit(1);

  if (existing) {
    const [updated] = await db.update(tenantApps)
      .set({ isEnabled: true, enabledBy: userId, enabledAt: new Date(), updatedAt: new Date() })
      .where(eq(tenantApps.id, existing.id))
      .returning();
    logger.info({ tenantId, appId }, 'App re-enabled for tenant');
    return updated;
  }

  const [created] = await db.insert(tenantApps).values({
    tenantId,
    appId,
    isEnabled: true,
    enabledBy: userId,
  }).returning();

  logger.info({ tenantId, appId }, 'App enabled for tenant');
  return created;
}

export async function disableApp(tenantId: string, appId: string) {
  const [existing] = await db.select().from(tenantApps)
    .where(and(eq(tenantApps.tenantId, tenantId), eq(tenantApps.appId, appId)))
    .limit(1);

  if (!existing) throw new Error(`App ${appId} is not configured for this tenant`);

  await db.update(tenantApps)
    .set({ isEnabled: false, updatedAt: new Date() })
    .where(eq(tenantApps.id, existing.id));

  logger.info({ tenantId, appId }, 'App disabled for tenant');
}

export async function seedDefaultApps(tenantId: string, userId: string) {
  const allApps = serverAppRegistry.getAll();
  const defaultApps = allApps.filter(app => app.defaultEnabled);

  for (const app of defaultApps) {
    const [existing] = await db.select().from(tenantApps)
      .where(and(eq(tenantApps.tenantId, tenantId), eq(tenantApps.appId, app.id)))
      .limit(1);

    if (!existing) {
      await db.insert(tenantApps).values({
        tenantId,
        appId: app.id,
        isEnabled: true,
        enabledBy: userId,
      });
    }
  }

  logger.info({ tenantId, count: defaultApps.length }, 'Default apps seeded for tenant');
}
