import type { Request, Response } from 'express';
import * as drawingService from './service';
import { logger } from '../../utils/logger';
import { canAccess } from '../../services/app-permissions.service';
import { assertCanDelete } from '../../middleware/assert-can-delete';

// POST /api/drawings/seed
export async function seedSampleData(req: Request, res: Response) {
  try {
    if (!canAccess(req.drawPerm!.role, 'create')) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const result = await drawingService.seedSampleDrawings(userId, tenantId);
    res.json({ success: true, data: { message: 'Seeded Draw sample data', ...result } });
  } catch (error) {
    logger.error({ error }, 'Failed to seed Draw sample data');
    res.status(500).json({ success: false, error: 'Failed to seed Draw sample data' });
  }
}

// GET /api/drawings
export async function listDrawings(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const includeArchived = req.query.includeArchived === 'true';

    const drawings = await drawingService.listDrawings(userId, includeArchived, req.auth!.tenantId ?? null);

    res.json({ success: true, data: { drawings } });
  } catch (error) {
    logger.error({ error }, 'Failed to list drawings');
    res.status(500).json({ success: false, error: 'Failed to list drawings' });
  }
}

// POST /api/drawings
export async function createDrawing(req: Request, res: Response) {
  try {
    const perm = req.drawPerm!;
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create drawings' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { title, content } = req.body;

    const drawing = await drawingService.createDrawing(userId, tenantId, {
      title,
      content,
    });

    res.json({ success: true, data: drawing });
  } catch (error) {
    logger.error({ error }, 'Failed to create drawing');
    res.status(500).json({ success: false, error: 'Failed to create drawing' });
  }
}

// GET /api/drawings/:id
export async function getDrawing(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const drawingId = req.params.id as string;

    const drawing = await drawingService.getDrawing(userId, drawingId, req.auth!.tenantId ?? null);

    if (!drawing) {
      res.status(404).json({ success: false, error: 'Drawing not found' });
      return;
    }

    res.json({ success: true, data: drawing });
  } catch (error) {
    logger.error({ error }, 'Failed to get drawing');
    res.status(500).json({ success: false, error: 'Failed to get drawing' });
  }
}

// PATCH /api/drawings/:id
export async function updateDrawing(req: Request, res: Response) {
  try {
    const perm = req.drawPerm!;
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update drawings' });
      return;
    }

    const userId = req.auth!.userId;
    const drawingId = req.params.id as string;
    const { title, content, isArchived, thumbnailUrl } = req.body;

    const drawing = await drawingService.updateDrawing(userId, drawingId, {
      title,
      content,
      isArchived,
      thumbnailUrl,
    });

    if (!drawing) {
      res.status(404).json({ success: false, error: 'Drawing not found' });
      return;
    }

    res.json({ success: true, data: drawing });
  } catch (error) {
    logger.error({ error }, 'Failed to update drawing');
    res.status(500).json({ success: false, error: 'Failed to update drawing' });
  }
}

// DELETE /api/drawings/:id (soft delete)
export async function deleteDrawing(req: Request, res: Response) {
  try {
    const perm = req.drawPerm!;
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete drawings' });
      return;
    }

    const userId = req.auth!.userId;
    const drawingId = req.params.id as string;

    const existing = await drawingService.getDrawing(userId, drawingId, req.auth!.tenantId ?? null);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Drawing not found' });
      return;
    }
    if (!assertCanDelete(res, perm.role, existing.userId, userId)) return;

    await drawingService.deleteDrawing(existing.userId, drawingId);

    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete drawing');
    res.status(500).json({ success: false, error: 'Failed to delete drawing' });
  }
}

// PATCH /api/drawings/:id/restore
export async function restoreDrawing(req: Request, res: Response) {
  try {
    const perm = req.drawPerm!;
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete drawings' });
      return;
    }

    const userId = req.auth!.userId;
    const drawingId = req.params.id as string;

    const existing = await drawingService.getDrawing(userId, drawingId, req.auth!.tenantId ?? null);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Drawing not found' });
      return;
    }
    if (!assertCanDelete(res, perm.role, existing.userId, userId)) return;

    const drawing = await drawingService.restoreDrawing(existing.userId, drawingId);

    if (!drawing) {
      res.status(404).json({ success: false, error: 'Drawing not found' });
      return;
    }

    res.json({ success: true, data: drawing });
  } catch (error) {
    logger.error({ error }, 'Failed to restore drawing');
    res.status(500).json({ success: false, error: 'Failed to restore drawing' });
  }
}

// GET /api/drawings/search?q=...
export async function searchDrawings(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const query = (req.query.q as string) || '';

    if (!query.trim()) {
      res.json({ success: true, data: [] });
      return;
    }

    const results = await drawingService.searchDrawings(userId, query.trim());
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error({ error }, 'Failed to search drawings');
    res.status(500).json({ success: false, error: 'Failed to search drawings' });
  }
}

// PATCH /api/drawings/:id/visibility
export async function updateDrawingVisibility(req: Request, res: Response) {
  try {
    if (!canAccess(req.drawPerm!.role, 'update')) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    const userId = req.auth!.userId;
    const drawingId = req.params.id as string;
    const { visibility } = req.body;

    if (visibility !== 'private' && visibility !== 'team') {
      res.status(400).json({ success: false, error: 'Visibility must be "private" or "team"' });
      return;
    }

    await drawingService.updateDrawingVisibility(userId, drawingId, visibility);
    res.json({ success: true, data: null });
  } catch (error: any) {
    if (error.message === 'Tenant required for team visibility') {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    logger.error({ error }, 'Failed to update drawing visibility');
    res.status(500).json({ success: false, error: 'Failed to update drawing visibility' });
  }
}
