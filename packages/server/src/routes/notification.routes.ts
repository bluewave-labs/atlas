import { Router, type Request, type Response } from 'express';
import * as notificationService from '../services/notification.service';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: Request, res: Response) => {
  try {
    const data = await notificationService.listNotifications(req.auth!.userId);
    res.json({ success: true, data });
  } catch (error) {
    logger.error({ error }, 'Failed to list notifications');
    res.status(500).json({ success: false, error: 'Failed to list notifications' });
  }
});

router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const count = await notificationService.getUnreadCount(req.auth!.userId);
    res.json({ success: true, data: { count } });
  } catch (error) {
    logger.error({ error }, 'Failed to get unread count');
    res.status(500).json({ success: false, error: 'Failed to get unread count' });
  }
});

router.patch('/:id/read', async (req: Request, res: Response) => {
  try {
    await notificationService.markAsRead(req.auth!.userId, req.params.id as string);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to mark notification as read');
    res.status(500).json({ success: false, error: 'Failed to mark as read' });
  }
});

router.patch('/read-all', async (req: Request, res: Response) => {
  try {
    await notificationService.markAllAsRead(req.auth!.userId);
    res.json({ success: true, data: null });
  } catch (error) {
    logger.error({ error }, 'Failed to mark all as read');
    res.status(500).json({ success: false, error: 'Failed to mark all as read' });
  }
});

router.post('/push-subscribe', async (req: Request, res: Response) => {
  try {
    const { endpoint, p256dh, auth } = req.body;
    const sub = await notificationService.subscribePush(req.auth!.userId, endpoint, p256dh, auth);
    res.json({ success: true, data: sub });
  } catch (error) {
    logger.error({ error }, 'Failed to subscribe push');
    res.status(500).json({ success: false, error: 'Failed to subscribe' });
  }
});

export default router;
