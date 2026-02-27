import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes';
import trackingRoutes from './routes/tracking.routes';
import pushRoutes from './routes/push.routes';
import { errorHandler } from './middleware/error-handler';
import { apiLimiter } from './middleware/rate-limit';
import { authMiddleware } from './middleware/auth';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '10mb' }));

  // Health check — lightweight, no auth
  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Public tracking endpoints — short /t prefix, no auth
  app.use('/t', trackingRoutes);

  // Gmail push notification webhook — no auth (Pub/Sub can't send JWTs)
  app.use('/webhooks/push', pushRoutes);

  // Serve uploaded files (auth via query token)
  app.use('/api/v1/uploads', authMiddleware, express.static(path.join(__dirname, '../uploads')));

  app.use('/api/v1', apiLimiter);
  app.use('/api/v1', routes);
  app.use(errorHandler);

  return app;
}
