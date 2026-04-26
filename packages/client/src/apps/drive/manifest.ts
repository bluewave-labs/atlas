import { HardDrive, Settings, Eye, File } from 'lucide-react';
import type { ClientAppManifest } from '../../config/app-manifest.client';
import { DrivePage } from './page';
import { DriveGeneralPanel, DriveDisplayPanel, DriveFilesPanel } from './components/drive-settings-modal';

export const driveManifest: ClientAppManifest = {
  id: 'drive',
  name: 'Drive',
  labelKey: 'sidebar.drive',
  iconName: 'HardDrive',
  icon: HardDrive,
  color: '#64748b',
  minPlan: 'starter',
  category: 'storage',
  dependencies: [],
  defaultEnabled: true,
  version: '1.0.0',
  sidebarOrder: 40,

  routes: [
    { path: '/drive', component: DrivePage },
    { path: '/drive/folder/:id', component: DrivePage },
  ],

  settingsCategory: {
    id: 'drive',
    label: 'Drive',
    icon: HardDrive,
    color: '#64748b',
    panels: [
      { id: 'general', label: 'General', icon: Settings, component: DriveGeneralPanel, adminOnly: true },
      { id: 'display', label: 'Display', icon: Eye, component: DriveDisplayPanel },
      { id: 'files', label: 'Files', icon: File, component: DriveFilesPanel },
    ],
  },
  tour: {
    variant: 'list',
    illustrationData: {
      rows: [
        { initials: 'PD', avatarColor: '#0ea5e9', primary: 'Q4 Roadmap.pdf', secondary: 'updated 2 min ago · 2.4 MB' },
        { initials: 'XL', avatarColor: '#10b981', primary: 'Sales pipeline.xlsx', secondary: 'shared with Sales' },
        { initials: 'PN', avatarColor: '#f59e0b', primary: 'Brand assets.zip', secondary: '128 MB · folder' },
        { initials: 'DR', avatarColor: '#a78bfa', primary: 'Demo recordings/', secondary: '42 items' },
      ],
      fadeFrom: 2,
      collaborator: { name: 'Tom', color: '#6366f1', targetRowIndex: 0 },
    },
  },
};
