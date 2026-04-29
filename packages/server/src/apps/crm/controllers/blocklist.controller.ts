import type { Request, Response } from 'express';
import { db } from '../../../config/database';
import { messageBlocklist } from '../../../db/schema';
import { logger } from '../../../utils/logger';

export async function addBlocklistEntry(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId!;
    const raw = (req.body?.pattern ?? '') as string;
    const pattern = raw.trim().toLowerCase();

    if (!pattern) {
      res.status(400).json({ success: false, error: 'pattern is required' });
      return;
    }

    await db
      .insert(messageBlocklist)
      .values({
        tenantId,
        pattern,
        createdByUserId: userId,
      })
      .onConflictDoNothing();

    res.json({ success: true, data: { pattern } });
  } catch (error) {
    logger.error({ error }, 'Failed to add blocklist entry');
    res.status(500).json({ success: false, error: 'Failed to add blocklist entry' });
  }
}
