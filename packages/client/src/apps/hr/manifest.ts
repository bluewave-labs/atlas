import { Users, Settings, Eye } from 'lucide-react';
import type { ClientAppManifest } from '../../config/app-manifest.client';
import { HrPage } from './page';
import { HrGeneralPanel, HrAppearancePanel } from './components/hr-settings-modal';

export const hrManifest: ClientAppManifest = {
  id: 'hr',
  name: 'HR',
  labelKey: 'sidebar.hr',
  iconName: 'Users',
  icon: Users,
  color: '#10b981',
  minPlan: 'starter',
  category: 'productivity',
  dependencies: [],
  defaultEnabled: true,
  version: '1.0.0',
  sidebarOrder: 35,
  routes: [
    { path: '/hr', component: HrPage },
  ],
  settingsCategory: {
    id: 'hr',
    label: 'HR',
    icon: Users,
    color: '#10b981',
    panels: [
      { id: 'general', label: 'General', icon: Settings, component: HrGeneralPanel },
      { id: 'appearance', label: 'Appearance', icon: Eye, component: HrAppearancePanel },
    ],
  },
};
