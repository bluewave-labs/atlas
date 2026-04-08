import { Router, type Request, type Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as eventService from '../services/event.service';
import { logger } from '../utils/logger';

const router = Router();

router.use(authMiddleware);

const MAX_LIMIT = 100;

// GET /notifications
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, MAX_LIMIT);
    const before = req.query.before as string | undefined;

    const data = await eventService.listNotifications(userId, tenantId, limit, before);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to list notifications');
    res.status(500).json({ success: false, error: 'Failed to list notifications' });
  }
});

// GET /notifications/unread-count
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    const count = await eventService.getUnreadCount(userId, tenantId);
    res.json({ success: true, data: { count } });
  } catch (error) {
    logger.error({ error }, 'Failed to get unread count');
    res.status(500).json({ success: false, error: 'Failed to get unread count' });
  }
});

// POST /notifications/read-all (must be before /:id routes)
router.post('/read-all', async (req: Request, res: Response) => {
  try {
    const userId = req.auth!.userId;
    const tenantId = req.auth!.tenantId;

    await eventService.markAllNotificationsRead(userId, tenantId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to mark all notifications as read');
    res.status(500).json({ success: false, error: 'Failed to mark all notifications as read' });
  }
});

// GET /notifications/activity-feed (must be before /:id routes)
router.get('/activity-feed', async (req: Request, res: Response) => {
  try {
    const tenantId = req.auth!.tenantId;
    if (!tenantId) {
      res.status(400).json({ success: false, error: 'Tenant context required' });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, MAX_LIMIT);
    const before = req.query.before as string | undefined;
    if (before && isNaN(new Date(before).getTime())) {
      res.status(400).json({ success: false, error: 'Invalid before cursor' });
      return;
    }

    const data = await eventService.listActivityFeed(tenantId, limit, before);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to list activity feed');
    res.status(500).json({ success: false, error: 'Failed to list activity feed' });
  }
});

// POST /notifications/:id/read
router.post('/:id/read', async (req: Request, res: Response) => {
  try {
    const userId = req.auth!.userId;
    const notificationId = req.params.id as string;

    await eventService.markNotificationRead(notificationId, userId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to mark notification as read');
    res.status(500).json({ success: false, error: 'Failed to mark notification as read' });
  }
});

// DELETE /notifications/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.auth!.userId;
    const notificationId = req.params.id as string;

    await eventService.dismissNotification(notificationId, userId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to dismiss notification');
    res.status(500).json({ success: false, error: 'Failed to dismiss notification' });
  }
});

export default router;
