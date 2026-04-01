import { Store } from 'lucide-react';
import type { ClientAppManifest } from '../../config/app-manifest.client';
import { MarketplacePage } from './page';

export const marketplaceManifest: ClientAppManifest = {
  id: 'marketplace',
  name: 'Marketplace',
  labelKey: 'sidebar.marketplace',
  iconName: 'Store',
  icon: Store,
  color: '#8b5cf6',
  minPlan: 'starter',
  category: 'other',
  dependencies: [],
  defaultEnabled: true,
  version: '1.0.0',
  sidebarOrder: 85,
  routes: [{ path: '/marketplace', component: MarketplacePage }],
};
