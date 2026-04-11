import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as customFieldService from '../services/custom-field.service';
import { getAppPermission, canAccess } from '../services/app-permissions.service';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

// --- Handlers (exported for unit tests) ---

export async function listFieldsHandler(req: Request, res: Response): Promise<void> {
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

    const fields = await customFieldService.listFieldDefinitions(
      tenantId,
      appId,
      req.params.recordType as string,
    );
    res.json({ success: true, data: fields });
  } catch (err) {
    logger.error({ err }, 'Failed to list custom field definitions');
    res.status(500).json({ success: false, error: 'Failed to list custom fields' });
  }
}

export async function createFieldHandler(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    const appId = req.params.appId as string;
    const perm = await getAppPermission(tenantId, req.auth!.userId, appId);
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const { name, slug, fieldType, options, isRequired, sortOrder } = req.body;
    if (!name || !slug || !fieldType) {
      res.status(400).json({ success: false, error: 'name, slug, and fieldType are required' });
      return;
    }

    const field = await customFieldService.createFieldDefinition({
      tenantId,
      appId,
      recordType: req.params.recordType as string,
      name,
      slug,
      fieldType,
      options,
      isRequired,
      sortOrder,
      createdBy: req.auth!.userId,
    });
    res.status(201).json({ success: true, data: field });
  } catch (err: any) {
    if (err?.code === '23505') {
      res.status(409).json({ success: false, error: 'A field with this slug already exists' });
      return;
    }
    logger.error({ err }, 'Failed to create custom field definition');
    res.status(500).json({ success: false, error: 'Failed to create custom field' });
  }
}

export async function updateFieldHandler(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    const existing = await customFieldService.getFieldDefinitionById(req.params.id as string);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Field not found' });
      return;
    }

    const perm = await getAppPermission(tenantId, req.auth!.userId, existing.appId);
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const { name, options, isRequired, sortOrder } = req.body;
    const updated = await customFieldService.updateFieldDefinition(req.params.id as string, {
      name,
      options,
      isRequired,
      sortOrder,
    });
    if (!updated) {
      res.status(404).json({ success: false, error: 'Field not found' });
      return;
    }
    res.json({ success: true, data: updated });
  } catch (err) {
    logger.error({ err }, 'Failed to update custom field definition');
    res.status(500).json({ success: false, error: 'Failed to update custom field' });
  }
}

export async function deleteFieldHandler(req: Request, res: Response): Promise<void> {
  try {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    const existing = await customFieldService.getFieldDefinitionById(req.params.id as string);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Field not found' });
      return;
    }

    const perm = await getAppPermission(tenantId, req.auth!.userId, existing.appId);
    if (!canAccess(perm.role, 'update')) {
      res.status(403).json({ success: false, error: 'Forbidden' });
      return;
    }

    const deleted = await customFieldService.deleteFieldDefinition(req.params.id as string);
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Field not found' });
      return;
    }
    res.json({ success: true, data: { message: 'Field deleted' } });
  } catch (err) {
    logger.error({ err }, 'Failed to delete custom field definition');
    res.status(500).json({ success: false, error: 'Failed to delete custom field' });
  }
}

router.get('/:appId/:recordType', listFieldsHandler);
router.post('/:appId/:recordType', createFieldHandler);
router.patch('/:id', updateFieldHandler);
router.delete('/:id', deleteFieldHandler);

export default router;
