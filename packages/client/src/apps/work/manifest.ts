import React from 'react';
import { Briefcase, Settings, Eye, Zap } from 'lucide-react';
import type { ClientAppManifest } from '../../config/app-manifest.client';
import { WorkIcon } from '../../components/icons/app-icons';
import { WorkPage } from './page';

function PlaceholderPanel() {
  return React.createElement('div', null);
}

export const workManifest: ClientAppManifest = {
  id: 'work',
  name: 'Work',
  labelKey: 'sidebar.work',
  iconName: 'Briefcase',
  icon: WorkIcon,
  color: '#6366f1',
  minPlan: 'starter',
  category: 'productivity',
  dependencies: [],
  defaultEnabled: true,
  version: '1.0.0',
  sidebarOrder: 25,

  routes: [
    { path: '/work', component: WorkPage },
  ],

  settingsCategory: {
    id: 'work',
    label: 'Work',
    icon: Briefcase,
    color: '#6366f1',
    panels: [
      { id: 'general', label: 'General', icon: Settings, component: PlaceholderPanel, adminOnly: true },
      { id: 'appearance', label: 'Appearance', icon: Eye, component: PlaceholderPanel },
      { id: 'behavior', label: 'Behavior', icon: Zap, component: PlaceholderPanel },
    ],
  },
};
