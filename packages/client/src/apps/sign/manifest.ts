import { PenTool } from 'lucide-react';
import type { ClientAppManifest } from '../../config/app-manifest.client';
import { SignPage } from './page';

export const signManifest: ClientAppManifest = {
  id: 'sign',
  name: 'Sign',
  labelKey: 'sidebar.sign',
  iconName: 'PenTool',
  icon: PenTool,
  color: '#8b5cf6',
  minPlan: 'starter',
  category: 'productivity',
  dependencies: [],
  defaultEnabled: true,
  version: '1.0.0',
  sidebarOrder: 55,
  routes: [
    { path: '/sign-app', component: SignPage },
  ],
};
