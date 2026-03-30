import systemRouter from './routes';
import type { ServerAppManifest } from '../../config/app-manifest.server';

export const systemServerManifest: ServerAppManifest = {
  id: 'system',
  name: 'System',
  labelKey: 'sidebar.system',
  iconName: 'Monitor',
  color: '#6b7280',
  minPlan: 'starter',
  category: 'other',
  dependencies: [],
  defaultEnabled: true,
  version: '1.0.0',
  router: systemRouter,
  routePrefix: '/system',
  tables: [],
};
