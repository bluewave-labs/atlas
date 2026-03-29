import { CheckSquare, Settings, Eye, Zap } from 'lucide-react';
import type { ClientAppManifest } from '../../config/app-manifest.client';
import { TasksPage } from './page';
import { TasksGeneralPanel, TasksAppearancePanel, TasksBehaviorPanel } from './components/tasks-settings-modal';

export const tasksManifest: ClientAppManifest = {
  id: 'tasks',
  name: 'Tasks',
  labelKey: 'sidebar.tasks',
  iconName: 'CheckSquare',
  icon: CheckSquare,
  color: '#6366f1',
  minPlan: 'starter',
  category: 'productivity',
  dependencies: [],
  defaultEnabled: true,
  version: '1.0.0',
  sidebarOrder: 30,

  routes: [
    { path: '/tasks', component: TasksPage },
  ],

  settingsCategory: {
    id: 'tasks',
    label: 'Tasks',
    icon: CheckSquare,
    color: '#6366f1',
    panels: [
      { id: 'general', label: 'General', icon: Settings, component: TasksGeneralPanel },
      { id: 'appearance', label: 'Appearance', icon: Eye, component: TasksAppearancePanel },
      { id: 'behavior', label: 'Behavior', icon: Zap, component: TasksBehaviorPanel },
    ],
  },
};
