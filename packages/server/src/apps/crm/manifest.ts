import crmRouter from './routes';
import type { ServerAppManifest } from '../../config/app-manifest.server';

export const crmServerManifest: ServerAppManifest = {
  id: 'crm',
  name: 'CRM',
  labelKey: 'sidebar.crm',
  iconName: 'Briefcase',
  color: '#f97316',
  minPlan: 'starter',
  category: 'data',
  dependencies: [],
  defaultEnabled: true,
  version: '1.0.0',
  router: crmRouter,
  routePrefix: '/crm',
  tables: ['crm_companies', 'crm_contacts', 'crm_deal_stages', 'crm_deals', 'crm_activities'],
};
