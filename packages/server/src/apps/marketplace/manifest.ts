import type { ServerAppManifest } from '../../config/app-manifest.server';
import { marketplaceRouter } from './routes';

export const marketplaceServerManifest: ServerAppManifest = {
  id: 'marketplace',
  name: 'Marketplace',
  labelKey: 'sidebar.marketplace',
  iconName: 'Store',
  color: '#8b5cf6',
  minPlan: 'starter',
  category: 'other',
  dependencies: [],
  defaultEnabled: true,
  version: '1.0.0',
  router: marketplaceRouter,
  routePrefix: '/marketplace',
  tables: ['marketplace_apps'],
};
