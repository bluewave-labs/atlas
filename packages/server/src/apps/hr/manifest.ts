import hrRouter from './routes';
import type { ServerAppManifest } from '../../config/app-manifest.server';

export const hrServerManifest: ServerAppManifest = {
  id: 'hr',
  name: 'HR',
  labelKey: 'sidebar.hr',
  iconName: 'Users',
  color: '#10b981',
  minPlan: 'starter',
  category: 'productivity',
  dependencies: [],
  defaultEnabled: true,
  version: '1.0.0',
  router: hrRouter,
  routePrefix: '/hr',
  tables: ['employees', 'departments', 'time_off_requests'],
};
