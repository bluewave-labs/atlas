import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { db } from '../config/database';
import { userSettings, tenantFormatSettings, crmDeals, crmContacts, crmCompanies, crmLeads, crmActivities, crmNotes, crmWorkflows, crmLeadForms } from '../db/schema';
import { employees, departments } from '../db/schema';
import { settingsSchema, isTenantAdmin } from '@atlas-platform/shared';
import { encrypt, decrypt } from '../utils/crypto';
import { testApiKey } from '../services/ai.service';
import { logger } from '../utils/logger';
import { getAccountIdForUser } from '../utils/account-lookup';

import type { Request, Response } from 'express';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: Request, res: Response) => {
  try {
    const accountId = await getAccountIdForUser(req.auth!.userId);
    if (!accountId) { res.status(404).json({ success: false, error: 'Account not found' }); return; }

    let [settings] = await db.select().from(userSettings)
      .where(eq(userSettings.accountId, accountId)).limit(1);

    // Auto-create settings row with defaults if none exists
    if (!settings) {
      [settings] = await db.insert(userSettings).values({ accountId }).returning();
    }

    res.json({ success: true, data: settings });
  } catch (error: any) {
    // FK violation means the account doesn't exist (stale JWT)
    if (error?.code === '23503') {
      res.status(401).json({ success: false, error: 'Account not found' });
      return;
    }
    throw error;
  }
});

router.put('/', async (req: Request, res: Response) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message });
    return;
  }
  const accountId = await getAccountIdForUser(req.auth!.userId);
  if (!accountId) { res.status(404).json({ success: false, error: 'Account not found' }); return; }

  const existing = await db.select().from(userSettings)
    .where(eq(userSettings.accountId, accountId)).limit(1);
  if (existing.length > 0) {
    const [updated] = await db.update(userSettings).set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(userSettings.accountId, accountId)).returning();
    res.json({ success: true, data: updated });
  } else {
    const [created] = await db.insert(userSettings).values({ accountId, ...parsed.data }).returning();
    res.json({ success: true, data: created });
  }
});

// ─── Clear Demo Data ──────────────────────────────────────────────

router.post('/clear-demo', async (req: Request, res: Response) => {
  try {
    const tenantId = req.auth!.tenantId;
    const accountId = await getAccountIdForUser(req.auth!.userId);

    // Delete CRM data
    await db.delete(crmActivities).where(eq(crmActivities.tenantId, tenantId));
    await db.delete(crmNotes).where(eq(crmNotes.tenantId, tenantId));
    await db.delete(crmLeads).where(eq(crmLeads.tenantId, tenantId));
    await db.delete(crmDeals).where(eq(crmDeals.tenantId, tenantId));
    await db.delete(crmContacts).where(eq(crmContacts.tenantId, tenantId));
    await db.delete(crmCompanies).where(eq(crmCompanies.tenantId, tenantId));
    await db.delete(crmWorkflows).where(eq(crmWorkflows.tenantId, tenantId));
    await db.delete(crmLeadForms).where(eq(crmLeadForms.tenantId, tenantId));

    // Delete HR data
    await db.delete(employees).where(eq(employees.tenantId, tenantId));
    await db.delete(departments).where(eq(departments.tenantId, tenantId));

    // Update settings flag
    if (accountId) {
      await db.update(userSettings).set({ homeDemoDataActive: false, updatedAt: new Date() })
        .where(eq(userSettings.accountId, accountId));
    }

    logger.info({ tenantId }, 'Demo data cleared');
    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to clear demo data');
    res.status(500).json({ success: false, error: 'Failed to clear demo data' });
  }
});

// ─── AI Settings ──────────────────────────────────────────────────

const AI_PROVIDERS = ['openai', 'anthropic', 'openrouter'];

function maskKey(encryptedKey: string): string {
  try {
    const raw = decrypt(encryptedKey);
    return raw.length > 8 ? raw.slice(0, 4) + '****' + raw.slice(-4) : '****';
  } catch {
    return '****';
  }
}

router.get('/ai', async (req: Request, res: Response) => {
  try {
    const [settings] = await db.select().from(userSettings)
      .where(eq(userSettings.accountId, await getAccountIdForUser(req.auth!.userId) as string)).limit(1);

    const aiApiKeys = (settings?.aiApiKeys as Record<string, string>) || {};
    const keys: Record<string, { hasKey: boolean; maskedKey: string | null }> = {};
    for (const p of AI_PROVIDERS) {
      keys[p] = aiApiKeys[p]
        ? { hasKey: true, maskedKey: maskKey(aiApiKeys[p]) }
        : { hasKey: false, maskedKey: null };
    }

    res.json({
      success: true,
      data: {
        enabled: settings?.aiEnabled ?? false,
        provider: settings?.aiProvider ?? 'openai',
        keys,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get AI settings');
    res.status(500).json({ success: false, error: 'Failed to get AI settings' });
  }
});

router.put('/ai', async (req: Request, res: Response) => {
  try {
    const { enabled, provider, apiKey } = req.body;
    const accountId = await getAccountIdForUser(req.auth!.userId) as string;

    const [existing] = await db.select().from(userSettings)
      .where(eq(userSettings.accountId, accountId)).limit(1);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (enabled !== undefined) updates.aiEnabled = enabled;
    if (provider !== undefined && AI_PROVIDERS.includes(provider)) updates.aiProvider = provider;

    if (apiKey?.provider && apiKey?.key) {
      if (!AI_PROVIDERS.includes(apiKey.provider)) {
        res.status(400).json({ success: false, error: `Invalid provider: ${apiKey.provider}` });
        return;
      }
      const currentKeys = (existing?.aiApiKeys as Record<string, string>) || {};
      currentKeys[apiKey.provider] = encrypt(apiKey.key);
      updates.aiApiKeys = currentKeys;
    }

    if (existing) {
      await db.update(userSettings).set(updates).where(eq(userSettings.accountId, accountId));
    } else {
      await db.insert(userSettings).values({ accountId, ...updates });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to update AI settings');
    res.status(500).json({ success: false, error: 'Failed to update AI settings' });
  }
});

router.delete('/ai/key/:provider', async (req: Request, res: Response) => {
  try {
    const accountId = await getAccountIdForUser(req.auth!.userId) as string;
    const provider = req.params.provider as string;

    const [existing] = await db.select().from(userSettings)
      .where(eq(userSettings.accountId, accountId)).limit(1);

    if (existing) {
      const currentKeys = (existing.aiApiKeys as Record<string, string>) || {};
      delete currentKeys[provider as string];
      await db.update(userSettings).set({ aiApiKeys: currentKeys, updatedAt: new Date() })
        .where(eq(userSettings.accountId, accountId));
    }

    res.json({ success: true });
  } catch (error) {
    logger.error({ error }, 'Failed to remove AI key');
    res.status(500).json({ success: false, error: 'Failed to remove AI key' });
  }
});

router.post('/ai/test', async (req: Request, res: Response) => {
  try {
    const { provider, apiKey } = req.body;
    if (!provider || !apiKey) {
      res.status(400).json({ success: false, error: 'Provider and API key required' });
      return;
    }
    const result = await testApiKey({ provider, apiKey });
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error({ error }, 'Failed to test AI key');
    res.status(500).json({ success: false, error: 'Failed to test AI key' });
  }
});

// ─── Tenant-wide Format Settings ───────────────────────────────────
// Shared across apps. defaultCurrency is read by Projects, Invoices, etc.
// Read: any authenticated tenant member. Write: tenant admin or owner.

async function getOrCreateTenantFormatSettings(tenantId: string) {
  const [existing] = await db.select().from(tenantFormatSettings)
    .where(eq(tenantFormatSettings.tenantId, tenantId)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(tenantFormatSettings)
    .values({ tenantId }).returning();
  return created;
}

router.get('/formats-tenant', async (req: Request, res: Response) => {
  try {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) { res.status(400).json({ success: false, error: 'Tenant context required' }); return; }
    const settings = await getOrCreateTenantFormatSettings(tenantId);
    res.json({ success: true, data: settings });
  } catch (error) {
    logger.error({ error }, 'Failed to get tenant format settings');
    res.status(500).json({ success: false, error: 'Failed to get tenant format settings' });
  }
});

router.put('/formats-tenant', async (req: Request, res: Response) => {
  try {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) { res.status(400).json({ success: false, error: 'Tenant context required' }); return; }
    if (!isTenantAdmin(req.auth?.tenantRole)) {
      res.status(403).json({ success: false, error: 'Admin access required' });
      return;
    }
    const { defaultCurrency } = req.body;
    if (typeof defaultCurrency !== 'string' || defaultCurrency.length > 10) {
      res.status(400).json({ success: false, error: 'defaultCurrency required' });
      return;
    }
    await getOrCreateTenantFormatSettings(tenantId);
    const [updated] = await db.update(tenantFormatSettings)
      .set({ defaultCurrency, updatedAt: new Date() })
      .where(eq(tenantFormatSettings.tenantId, tenantId))
      .returning();
    res.json({ success: true, data: updated });
  } catch (error) {
    logger.error({ error }, 'Failed to update tenant format settings');
    res.status(500).json({ success: false, error: 'Failed to update tenant format settings' });
  }
});

export default router;
