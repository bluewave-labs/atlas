import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as valueService from '../services/custom-field-value.service';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

// GET /:appId/:recordType/:recordId — get field definitions + values for a record
router.get('/:appId/:recordType/:recordId', async (req: Request, res: Response) => {
  try {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    const fields = await valueService.getFieldsWithValues(
      tenantId,
      req.params.appId as string,
      req.params.recordType as string,
      req.params.recordId as string,
    );
    res.json({ success: true, data: fields });
  } catch (err) {
    logger.error({ err }, 'Failed to get custom field values');
    res.status(500).json({ success: false, error: 'Failed to get custom field values' });
  }
});

// PUT /:recordId — bulk upsert values for a record
router.put('/:recordId', async (req: Request, res: Response) => {
  try {
    const { values } = req.body as { values: Array<{ fieldDefinitionId: string; value: unknown }> };
    if (!values || !Array.isArray(values)) {
      res.status(400).json({ success: false, error: 'values array is required' });
      return;
    }

    await valueService.upsertValues(
      req.auth!.tenantId,
      req.params.recordId as string,
      values,
    );
    res.json({ success: true, data: { message: 'Values saved' } });
  } catch (err) {
    logger.error({ err }, 'Failed to save custom field values');
    res.status(500).json({ success: false, error: 'Failed to save custom field values' });
  }
});

export default router;
