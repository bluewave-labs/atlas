import type { Request, Response } from 'express';
import { and, eq, desc } from 'drizzle-orm';
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

export async function listBlocklist(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId!;
    const rows = await db
      .select({
        id: messageBlocklist.id,
        pattern: messageBlocklist.pattern,
        createdAt: messageBlocklist.createdAt,
      })
      .from(messageBlocklist)
      .where(eq(messageBlocklist.tenantId, tenantId))
      .orderBy(desc(messageBlocklist.createdAt));
    res.json({ success: true, data: rows });
  } catch (error) {
    logger.error({ error }, 'Failed to list blocklist');
    res.status(500).json({ success: false, error: 'Failed to list blocklist' });
  }
}

export async function deleteBlocklistEntry(req: Request, res: Response) {
  try {
    const tenantId = req.auth!.tenantId!;
    const id = req.params.id as string | undefined;
    if (!id) {
      res.status(400).json({ success: false, error: 'id is required' });
      return;
    }
    await db
      .delete(messageBlocklist)
      .where(and(eq(messageBlocklist.id, id), eq(messageBlocklist.tenantId, tenantId)));
    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    logger.error({ error }, 'Failed to delete blocklist entry');
    res.status(500).json({ success: false, error: 'Failed to delete blocklist entry' });
  }
}
