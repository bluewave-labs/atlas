import type { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../../../config/database';
import { tenants } from '../../../db/schema';
import { logger } from '../../../utils/logger';

export async function getTenantSettings(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId!;
    const [row] = await db
      .select({ gmailRetentionDays: tenants.gmailRetentionDays })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    res.json({
      success: true,
      data: { gmailRetentionDays: row?.gmailRetentionDays ?? null },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to load tenant settings');
    res.status(500).json({ success: false, error: 'Failed to load tenant settings' });
  }
}

export async function updateRetention(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId!;
    const raw = req.body?.gmailRetentionDays;
    let value: number | null;
    if (raw === null || raw === undefined) {
      value = null;
    } else if (typeof raw === 'number' && Number.isInteger(raw) && raw > 0) {
      value = raw;
    } else {
      res.status(400).json({
        success: false,
        error: 'gmailRetentionDays must be a positive integer or null',
      });
      return;
    }
    await db
      .update(tenants)
      .set({ gmailRetentionDays: value, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));
    res.json({ success: true, data: { gmailRetentionDays: value } });
  } catch (error) {
    logger.error({ error }, 'Failed to update tenant retention');
    res.status(500).json({ success: false, error: 'Failed to update tenant retention' });
  }
}
