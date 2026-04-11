import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as recordLinkService from '../services/record-link.service';
import { getAppPermission, canAccess } from '../services/app-permissions.service';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

// --- Handlers (exported for unit tests) ---

export async function getLinkCountsHandler(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }
    const appId = req.params.appId as string;
    const perm = await getAppPermission(tenantId, req.auth!.userId, appId);
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }
    const counts = await recordLinkService.getLinkCounts(appId, req.params.recordId as string);
    res.json({ success: true, data: counts });
  } catch (err) {
    logger.error({ err }, 'Failed to get link counts');
    res.status(500).json({ success: false, error: 'Failed to get link counts' });
  }
}

export async function getLinkDetailsHandler(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }
    const appId = req.params.appId as string;
    const perm = await getAppPermission(tenantId, req.auth!.userId, appId);
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }
    const links = await recordLinkService.getLinksWithTitles(appId, req.params.recordId as string);
    res.json({ success: true, data: links });
  } catch (err) {
    logger.error({ err }, 'Failed to get linked records');
    res.status(500).json({ success: false, error: 'Failed to get linked records' });
  }
}

export async function getLinksForRecordHandler(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }
    const appId = req.params.appId as string;
    const perm = await getAppPermission(tenantId, req.auth!.userId, appId);
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }
    const links = await recordLinkService.getLinksForRecord(appId, req.params.recordId as string);
    res.json({ success: true, data: links });
  } catch (err) {
    logger.error({ err }, 'Failed to get record links');
    res.status(500).json({ success: false, error: 'Failed to get record links' });
  }
}

export async function createLinkHandler(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    const { sourceAppId, sourceRecordId, targetAppId, targetRecordId, linkType, metadata } = req.body;

    if (!sourceAppId || !sourceRecordId || !targetAppId || !targetRecordId) {
      res.status(400).json({ success: false, error: 'sourceAppId, sourceRecordId, targetAppId, and targetRecordId are required' });
      return;
    }

    // Require 'update' on BOTH sides — creating a link is a mutation on both apps.
    const sourcePerm = await getAppPermission(tenantId, req.auth!.userId, sourceAppId);
    if (!canAccess(sourcePerm.role, 'update')) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }
    const targetPerm = await getAppPermission(tenantId, req.auth!.userId, targetAppId);
    if (!canAccess(targetPerm.role, 'update')) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const link = await recordLinkService.createLink({
      tenantId,
      sourceAppId,
      sourceRecordId,
      targetAppId,
      targetRecordId,
      linkType,
      metadata,
      createdBy: req.auth!.userId,
    });
    res.status(201).json({ success: true, data: link });
  } catch (err: any) {
    if (err?.code === '23505') {
      res.status(409).json({ success: false, error: 'This link already exists' });
      return;
    }
    logger.error({ err }, 'Failed to create record link');
    res.status(500).json({ success: false, error: 'Failed to create link' });
  }
}

export async function deleteLinkHandler(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    const link = await recordLinkService.getLinkById(req.params.id as string);
    if (!link) {
      res.status(404).json({ success: false, error: 'Link not found' });
      return;
    }

    const perm = await getAppPermission(tenantId, req.auth!.userId, link.sourceAppId);
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const deleted = await recordLinkService.deleteLink(req.params.id as string);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Link not found' });
      return;
    }
    res.json({ success: true, data: { message: 'Link deleted' } });
  } catch (err) {
    logger.error({ err }, 'Failed to delete record link');
    res.status(500).json({ success: false, error: 'Failed to delete link' });
  }
}

router.get('/:appId/:recordId/counts', getLinkCountsHandler);
router.get('/:appId/:recordId/details', getLinkDetailsHandler);
router.get('/:appId/:recordId', getLinksForRecordHandler);
router.post('/', createLinkHandler);
router.delete('/:id', deleteLinkHandler);

export default router;
