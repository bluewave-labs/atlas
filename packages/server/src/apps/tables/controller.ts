import type { Request, Response } from 'express';
import * as tableService from './service';
import { logger } from '../../utils/logger';
import { getAppPermission, canAccess, decideRecordDelete } from '../../services/app-permissions.service';

// GET /api/tables
export async function listSpreadsheets(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tables');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view tables' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const includeArchived = req.query.includeArchived === 'true';

    const spreadsheets = await tableService.listSpreadsheets(userId, includeArchived);

    res.json({ success: true, data: { spreadsheets } });
  } catch (error) {
    logger.error({ error }, 'Failed to list spreadsheets');
    res.status(500).json({ success: false, error: 'Failed to list spreadsheets' });
  }
}

// POST /api/tables
export async function createSpreadsheet(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tables');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create tables' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const { title, columns, rows, viewConfig, color, icon } = req.body;

    const spreadsheet = await tableService.createSpreadsheet(userId, tenantId, {
      title,
      columns,
      rows,
      viewConfig,
      color,
      icon,
    });

    res.json({ success: true, data: spreadsheet });
  } catch (error) {
    logger.error({ error }, 'Failed to create spreadsheet');
    res.status(500).json({ success: false, error: 'Failed to create spreadsheet' });
  }
}

// GET /api/tables/:id
export async function getSpreadsheet(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tables');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view tables' });
      return;
    }

    const userId = req.auth!.userId;
    const spreadsheetId = req.params.id as string;

    const spreadsheet = await tableService.getSpreadsheet(userId, spreadsheetId);

    if (!spreadsheet) {
      res.status(404).json({ success: false, error: 'Spreadsheet not found' });
      return;
    }

    res.json({ success: true, data: spreadsheet });
  } catch (error) {
    logger.error({ error }, 'Failed to get spreadsheet');
    res.status(500).json({ success: false, error: 'Failed to get spreadsheet' });
  }
}

// PATCH /api/tables/:id
export async function updateSpreadsheet(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tables');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update tables' });
      return;
    }

    const userId = req.auth!.userId;
    const spreadsheetId = req.params.id as string;
    const { title, columns, rows, viewConfig, isArchived, color, icon, guide } = req.body;

    const spreadsheet = await tableService.updateSpreadsheet(userId, spreadsheetId, {
      title,
      columns,
      rows,
      viewConfig,
      isArchived,
      color,
      icon,
      guide,
    });

    if (!spreadsheet) {
      res.status(404).json({ success: false, error: 'Spreadsheet not found' });
      return;
    }

    res.json({ success: true, data: spreadsheet });
  } catch (error) {
    logger.error({ error }, 'Failed to update spreadsheet');
    res.status(500).json({ success: false, error: 'Failed to update spreadsheet' });
  }
}

// DELETE /api/tables/:id (soft delete)
export async function deleteSpreadsheet(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tables');
    if (!canAccess(perm.role, 'delete') && !canAccess(perm.role, 'delete_own')) {
      res.status(403).json({ success: false, error: 'No permission to delete tables' });
      return;
    }

    const userId = req.auth!.userId;
    const spreadsheetId = req.params.id as string;

    const existing = await tableService.getSpreadsheet(userId, spreadsheetId);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Spreadsheet not found' });
      return;
    }
    const decision = decideRecordDelete(perm.role, existing.userId, userId);
    if (decision === 'forbid') {
      res.status(403).json({ success: false, error: 'No permission to delete tables' });
      return;
    }
    if (decision === 'not_own') {
      res.status(404).json({ success: false, error: 'Spreadsheet not found' });
      return;
    }

    const result = await tableService.deleteSpreadsheet(existing.userId, spreadsheetId);

    if (!result) {
      res.status(404).json({ success: false, error: 'Spreadsheet not found' });
      return;
    }

    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete spreadsheet');
    res.status(500).json({ success: false, error: 'Failed to delete spreadsheet' });
  }
}

// PATCH /api/tables/:id/restore
export async function restoreSpreadsheet(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tables');
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'No permission to update tables' });
      return;
    }

    const userId = req.auth!.userId;
    const spreadsheetId = req.params.id as string;

    const spreadsheet = await tableService.restoreSpreadsheet(userId, spreadsheetId);

    if (!spreadsheet) {
      res.status(404).json({ success: false, error: 'Spreadsheet not found' });
      return;
    }

    res.json({ success: true, data: spreadsheet });
  } catch (error) {
    logger.error({ error }, 'Failed to restore spreadsheet');
    res.status(500).json({ success: false, error: 'Failed to restore spreadsheet' });
  }
}

// POST /api/tables/seed
export async function seedSampleData(req: Request, res: Response) {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const result = await tableService.seedSampleSpreadsheets(userId, tenantId);
    res.json({ success: true, data: { message: 'Seeded Tables sample data', ...result } });
  } catch (error) {
    logger.error({ error }, 'Failed to seed Tables sample data');
    res.status(500).json({ success: false, error: 'Failed to seed Tables sample data' });
  }
}

// ─── Row Comments ─────────────────────────────────────────────────

// GET /api/tables/:id/rows/:rowId/comments
export async function listRowComments(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tables');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view comments' });
      return;
    }

    const spreadsheetId = req.params.id as string;
    const rowId = req.params.rowId as string;
    const comments = await tableService.listRowComments(spreadsheetId, rowId);
    res.json({ success: true, data: comments });
  } catch (error) {
    logger.error({ error }, 'Failed to list row comments');
    res.status(500).json({ success: false, error: 'Failed to list row comments' });
  }
}

// POST /api/tables/:id/rows/:rowId/comments
export async function createRowComment(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tables');
    if (!canAccess(perm.role, 'create')) {
      res.status(403).json({ success: false, error: 'No permission to create comments' });
      return;
    }

    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const spreadsheetId = req.params.id as string;
    const rowId = req.params.rowId as string;
    const { body } = req.body;

    if (!body || !body.trim()) {
      res.status(400).json({ success: false, error: 'Comment body is required' });
      return;
    }

    const comment = await tableService.createRowComment(userId, tenantId, spreadsheetId, rowId, body.trim());
    res.json({ success: true, data: comment });
  } catch (error) {
    logger.error({ error }, 'Failed to create row comment');
    res.status(500).json({ success: false, error: 'Failed to create row comment' });
  }
}

// DELETE /api/tables/comments/:commentId
export async function deleteRowComment(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tables');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission' });
      return;
    }

    const userId = req.auth!.userId;
    const commentId = req.params.commentId as string;

    const deleted = await tableService.deleteRowComment(userId, commentId);
    if (!deleted) {
      res.status(403).json({ success: false, error: 'Comment not found or not authorized to delete' });
      return;
    }

    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to delete row comment');
    res.status(500).json({ success: false, error: 'Failed to delete row comment' });
  }
}

// GET /api/tables/search?q=...
export async function searchSpreadsheets(req: Request, res: Response) {
  try {
    const perm = await getAppPermission(req.auth?.tenantId, req.auth!.userId, 'tables');
    if (!canAccess(perm.role, 'view')) {
      res.status(403).json({ success: false, error: 'No permission to view tables' });
      return;
    }

    const userId = req.auth!.userId;
    const query = (req.query.q as string) || '';

    if (!query.trim()) {
      res.json({ success: true, data: [] });
      return;
    }

    const results = await tableService.searchSpreadsheets(userId, query.trim());
    res.json({ success: true, data: results });
  } catch (error) {
    logger.error({ error }, 'Failed to search spreadsheets');
    res.status(500).json({ success: false, error: 'Failed to search spreadsheets' });
  }
}
