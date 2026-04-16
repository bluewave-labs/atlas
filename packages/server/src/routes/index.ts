import { Router } from 'express';
import authRoutes from './auth.routes';
import settingsRoutes from './settings.routes';
import aiRoutes from './ai.routes';
import uploadRoutes from './upload.routes';
import platformRoutes from './platform.routes';
import adminRoutes from './admin.routes';
import customFieldsRoutes from './custom-fields.routes';
import customFieldValuesRoutes from './custom-field-values.routes';
import recordLinksRoutes from './record-links.routes';
import searchRoutes from './search.routes';
import dataModelRoutes from './data-model.routes';
import notificationsRoutes from './notifications.routes';
import appPermissionsRoutes from './app-permissions.routes';
import stocksRoutes from './stocks.routes';
import presenceRoutes from './presence.routes';
import calendarRoutes from './calendar.routes';
import updatesRoutes from './updates.routes';
import { exchangeRateRoutes } from './exchange-rate.routes';
import { adminLimiter } from '../middleware/rate-limit';
import { serverAppRegistry } from '../apps';

const router = Router();

// Platform routes (non-app)
router.use('/admin', adminLimiter, adminRoutes);
router.use('/auth', authRoutes);
router.use('/settings', settingsRoutes);
router.use('/ai', aiRoutes);
router.use('/upload', uploadRoutes);
router.use('/platform', adminLimiter, platformRoutes);
router.use('/custom-fields', customFieldsRoutes);
router.use('/custom-field-values', customFieldValuesRoutes);
router.use('/links', recordLinksRoutes);
router.use('/search', searchRoutes);
router.use('/data-model', dataModelRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/permissions', appPermissionsRoutes);
router.use('/stocks', stocksRoutes);
router.use('/presence', presenceRoutes);
router.use('/calendar', calendarRoutes);
router.use('/updates', updatesRoutes);
router.use('/exchange-rates', exchangeRateRoutes);

// App routes mounted dynamically from registry
serverAppRegistry.mountAll(router);

export default router;
