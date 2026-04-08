import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { searchGlobal } from '../services/global-search.service';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || '').trim();
    if (q.length < 2) {
      res.json({ success: true, data: [] });
      return;
    }

    const results = await searchGlobal(q, req.auth!.tenantId);
    res.json({ success: true, data: results });
  } catch (err) {
    logger.error({ err }, 'Global search failed');
    res.status(500).json({ success: false, error: 'Search failed' });
  }
});

export default router;
