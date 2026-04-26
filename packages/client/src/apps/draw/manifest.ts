import { Pencil, Palette, Download, PenTool } from 'lucide-react';
import type { ClientAppManifest } from '../../config/app-manifest.client';
import { DrawPage } from './page';
import { DrawCanvasPanel, DrawExportPanel } from './components/draw-settings-modal';

export const drawManifest: ClientAppManifest = {
  id: 'draw',
  name: 'Draw',
  labelKey: 'sidebar.draw',
  iconName: 'Pencil',
  icon: PenTool,
  color: '#e06c9f',
  minPlan: 'starter',
  category: 'productivity',
  dependencies: [],
  defaultEnabled: true,
  version: '1.0.0',
  sidebarOrder: 80,

  routes: [
    { path: '/draw', component: DrawPage },
    { path: '/draw/:id', component: DrawPage },
  ],

  settingsCategory: {
    id: 'draw',
    label: 'Draw',
    icon: Pencil,
    color: '#e06c9f',
    panels: [
      { id: 'canvas', label: 'Canvas', icon: Palette, component: DrawCanvasPanel },
      { id: 'export', label: 'Export', icon: Download, component: DrawExportPanel },
    ],
  },
  tour: {
    variant: 'list',
    illustrationData: {
      rows: [
        { initials: 'WB', avatarColor: '#e06c9f', primary: 'Onboarding flow', secondary: 'edited just now' },
        { initials: 'AR', avatarColor: '#a78bfa', primary: 'Architecture v2', secondary: '12 shapes · 3 collaborators' },
        { initials: 'WF', avatarColor: '#0ea5e9', primary: 'Wireframes — settings', secondary: 'shared with Design' },
        { initials: 'BR', avatarColor: '#f97316', primary: 'Brainstorm — Q4', secondary: '24 sticky notes' },
      ],
      fadeFrom: 2,
      collaborator: { name: 'Sam', color: '#e06c9f', targetRowIndex: 0 },
    },
  },
};
