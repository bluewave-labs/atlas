import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  searchGlobal,
  type AppPermissionsMap,
} from '../services/global-search.service';
import { getAppPermission } from '../services/app-permissions.service';
import { logger } from '../utils/logger';

const SEARCHABLE_APP_IDS = [
  'crm',
  'hr',
  'projects',
  'invoices',
  'sign',
  'tables',
  'tasks',
  'docs',
  'draw',
] as const;

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: Request, res: Response) => {
  try {
    const q = ((req.query.q as string) || '').trim();
    if (q.length < 2) {
      res.json({ success: true, data: [] });
      return;
    }

    const { userId, tenantId } = req.auth!;

    const permEntries = await Promise.all(
      SEARCHABLE_APP_IDS.map(
        async (appId) =>
          [appId, await getAppPermission(tenantId, userId, appId)] as const,
      ),
    );
    const permissions: AppPermissionsMap = new Map(permEntries);

    const results = await searchGlobal(q, tenantId, userId, permissions);
    res.json({ success: true, data: results });
  } catch (err) {
    logger.error({ err }, 'Global search failed');
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

export default router;
