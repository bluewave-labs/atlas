import type { Request, Response } from 'express';
import { db } from '../../../../config/database';
import { crmDealStages } from '../../../../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../../../../utils/logger';
import { sessionStore } from './session-store';
import { buildPreview } from './preview.service';
import { commitImport } from './commit.service';

export async function previewOdoo(req: Request, res: Response) {
  const tenantId = req.auth?.tenantId;
  const userId = req.auth?.userId;
  if (!tenantId || !userId) {
    res.status(400).json({ success: false, error: 'No active tenant' });
    return;
  }

  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const partnerBuf = files?.partners?.[0]?.buffer;
  const leadBuf = files?.leads?.[0]?.buffer;
  const activityBuf = files?.activities?.[0]?.buffer;

  if (!partnerBuf) {
    res.status(400).json({ success: false, error: 'res.partner.csv is required' });
    return;
  }

  try {
    const stages = await db
      .select({ id: crmDealStages.id, name: crmDealStages.name, sequence: crmDealStages.sequence })
      .from(crmDealStages)
      .where(eq(crmDealStages.tenantId, tenantId));

    const result = buildPreview(
      { partners: partnerBuf, leads: leadBuf, activities: activityBuf },
      stages.map((s) => ({ id: s.id, name: s.name, sequence: s.sequence })),
    );

    const session = sessionStore.create(tenantId, userId);
    session.partners = result.partners;
    session.leads = result.leads;
    session.activities = result.activities;
    session.dropped = [];
    session.customFields = result.customFields;

    res.json({
      success: true,
      data: {
        sessionId: session.sessionId,
        ...result.preview,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to parse files';
    logger.error({ error }, 'Odoo importer preview failed');
    res.status(400).json({ success: false, error: msg });
  }
}

export async function commitOdoo(req: Request, res: Response) {
  const tenantId = req.auth?.tenantId;
  if (!tenantId) {
    res.status(400).json({ success: false, error: 'No active tenant' });
    return;
  }
  const { sessionId, stageMapping } = req.body as { sessionId?: string; stageMapping?: Record<string, string> };
  if (!sessionId || !stageMapping) {
    res.status(400).json({ success: false, error: 'sessionId and stageMapping are required' });
    return;
  }

  const session = sessionStore.get(sessionId);
  if (!session) {
    res.status(404).json({ success: false, error: 'Session not found or expired' });
    return;
  }
  if (session.tenantId !== tenantId) {
    res.status(403).json({ success: false, error: 'Session belongs to a different tenant' });
    return;
  }

  try {
    const summary = await commitImport({ session, stageMapping });
    sessionStore.delete(sessionId);
    res.json({ success: true, data: summary });
  } catch (error) {
    if (error instanceof Error && error.message === 'STAGE_MAPPING_STALE') {
      res.status(409).json({
        success: false,
        error: 'The stage you mapped to has been changed. Please re-run preview.',
      });
      return;
    }
    logger.error({ error }, 'Odoo importer commit failed');
    res.status(500).json({ success: false, error: 'Import failed' });
  }
}
