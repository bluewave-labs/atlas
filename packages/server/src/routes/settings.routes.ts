import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { authMiddleware } from '../middleware/auth';
import { db } from '../config/database';
import { userSettings } from '../db/schema';
import { settingsSchema } from '@atlasmail/shared';
import { encrypt, decrypt } from '../utils/crypto';
import { testApiKey } from '../services/ai.service';
import { logger } from '../utils/logger';

import type { Request, Response } from 'express';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: Request, res: Response) => {
  const [settings] = await db.select().from(userSettings)
    .where(eq(userSettings.accountId, req.auth!.accountId)).limit(1);
  res.json({ success: true, data: settings || null });
});

router.put('/', async (req: Request, res: Response) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, error: parsed.error.message });
    return;
  }
  const existing = await db.select().from(userSettings)
    .where(eq(userSettings.accountId, req.auth!.accountId)).limit(1);
  if (existing.length > 0) {
    const [updated] = await db.update(userSettings).set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(userSettings.accountId, req.auth!.accountId)).returning();
    res.json({ success: true, data: updated });
  } else {
    const [created] = await db.insert(userSettings).values({ accountId: req.auth!.accountId, ...parsed.data }).returning();
    res.json({ success: true, data: created });
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
      .where(eq(userSettings.accountId, req.auth!.accountId)).limit(1);

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
    const accountId = req.auth!.accountId;

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
    const accountId = req.auth!.accountId;
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

export default router;
