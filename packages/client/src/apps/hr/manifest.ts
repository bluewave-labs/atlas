import { Users, Settings, Eye, UserCog } from 'lucide-react';
import type { ClientAppManifest } from '../../config/app-manifest.client';
import { HrPage } from './page';
import { HrGeneralPanel, HrAppearancePanel } from './components/hr-settings-modal';
import { TeamWidget } from './widgets/team-widget';

export const hrManifest: ClientAppManifest = {
  id: 'hr',
  name: 'HR',
  labelKey: 'sidebar.hr',
  iconName: 'Users',
  icon: UserCog,
  color: '#10b981',
  minPlan: 'starter',
  category: 'productivity',
  dependencies: [],
  defaultEnabled: true,
  version: '1.0.0',
  sidebarOrder: 20,
  routes: [
    { path: '/hr', component: HrPage },
  ],
  widgets: [
    {
      id: 'team',
      name: 'Team',
      description: 'Employee headcount and department overview',
      iconName: 'Users',
      icon: Users,
      defaultSize: 'sm',
      defaultEnabled: true,
      component: TeamWidget,
    },
  ],
  settingsCategory: {
    id: 'hr',
    label: 'HR',
    icon: Users,
    color: '#10b981',
    panels: [
      { id: 'general', label: 'General', icon: Settings, component: HrGeneralPanel, adminOnly: true },
      { id: 'appearance', label: 'Appearance', icon: Eye, component: HrAppearancePanel },
    ],
  },
  tour: {
    variant: 'activity',
    illustrationData: {
      contact: { initials: 'AS', avatarColor: '#10b981', name: 'Anna Schmidt', meta: 'Engineering · Senior Engineer', badge: { label: 'Active', tone: 'success' } },
      events: [
        { text: 'Promotion approved by manager', timestamp: 'just now', isLive: true },
        { text: 'PTO request — 5 days · approved', timestamp: '2h ago' },
        { text: 'Quarterly review submitted', timestamp: 'yesterday' },
        { text: 'Onboarding completed', timestamp: '14d ago' },
      ],
    },
  },
};
