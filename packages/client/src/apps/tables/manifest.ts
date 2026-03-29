import { Table2, Settings, Languages } from 'lucide-react';
import type { ClientAppManifest } from '../../config/app-manifest.client';
import { TablesPage } from './page';
import { TablesGeneralPanel, TablesRegionalPanel } from './components/tables-settings-modal';

export const tablesManifest: ClientAppManifest = {
  id: 'tables',
  name: 'Tables',
  labelKey: 'sidebar.tables',
  iconName: 'Table2',
  icon: Table2,
  color: '#2d8a6e',
  minPlan: 'starter',
  category: 'data',
  dependencies: [],
  defaultEnabled: true,
  version: '1.0.0',
  sidebarOrder: 40,

  routes: [
    { path: '/tables', component: TablesPage },
    { path: '/tables/:id', component: TablesPage },
  ],

  settingsCategory: {
    id: 'tables',
    label: 'Tables',
    icon: Table2,
    color: '#2d8a6e',
    panels: [
      { id: 'general', label: 'General', icon: Settings, component: TablesGeneralPanel },
      { id: 'regional', label: 'Regional', icon: Languages, component: TablesRegionalPanel },
    ],
  },
};
