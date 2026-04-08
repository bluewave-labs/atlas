import type { Request, Response } from 'express';
import * as crmService from '../services/view.service';
import { logger } from '../../../utils/logger';

// ─── Saved Views ───────────────────────────────────────────────────

export async function listSavedViews(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const section = req.query.section as string | undefined;

    const views = await crmService.listSavedViews(userId, tenantId, section);
    res.json({ success: true, data: { views } });
  } catch (error) {
    logger.error({ error }, 'Failed to list CRM saved views');
    res.status(500).json({ success: false, error: 'Failed to list saved views' });
  }
}

export async function createSavedView(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { appSection, name, filters, isPinned, isShared } = req.body;

    if (!name?.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }
    if (!appSection?.trim()) {
      res.status(400).json({ success: false, error: 'Section is required' });
      return;
    }

    const view = await crmService.createSavedView(userId, tenantId, {
      appSection, name: name.trim(), filters: filters ?? {}, isPinned, isShared,
    });
    res.json({ success: true, data: view });
  } catch (error) {
    logger.error({ error }, 'Failed to create CRM saved view');
    res.status(500).json({ success: false, error: 'Failed to create saved view' });
  }
}

export async function updateSavedView(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;
    const { name, filters, isPinned, isShared, sortOrder } = req.body;

    const view = await crmService.updateSavedView(userId, tenantId, id, {
      name, filters, isPinned, isShared, sortOrder,
    });

    if (!view) {
      res.status(404).json({ success: false, error: 'View not found' });
      return;
    }
    res.json({ success: true, data: view });
  } catch (error) {
    logger.error({ error }, 'Failed to update CRM saved view');
    res.status(500).json({ success: false, error: 'Failed to update saved view' });
  }
}

export async function deleteSavedView(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const id = req.params.id as string;

    await crmService.deleteSavedView(userId, tenantId, id);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete CRM saved view');
    res.status(500).json({ success: false, error: 'Failed to delete saved view' });
  }
}
