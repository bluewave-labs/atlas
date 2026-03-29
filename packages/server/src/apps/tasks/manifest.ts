import tasksRouter from './routes';
import type { ServerAppManifest } from '../../config/app-manifest.server';

export const tasksServerManifest: ServerAppManifest = {
  id: 'tasks',
  name: 'Tasks',
  labelKey: 'sidebar.tasks',
  iconName: 'CheckSquare',
  color: '#6366f1',
  minPlan: 'starter',
  category: 'productivity',
  dependencies: [],
  defaultEnabled: true,
  version: '1.0.0',
  router: tasksRouter,
  routePrefix: '/tasks',
  tables: ['tasks', 'task_activities', 'task_projects'],
};
