import tablesRouter from './routes';
import type { ServerAppManifest } from '../../config/app-manifest.server';

export const tablesServerManifest: ServerAppManifest = {
  id: 'tables',
  name: 'Tables',
  labelKey: 'sidebar.tables',
  iconName: 'Table2',
  color: '#2d8a6e',
  minPlan: 'starter',
  category: 'data',
  dependencies: [],
  defaultEnabled: true,
  version: '1.0.0',
  router: tablesRouter,
  routePrefix: '/tables',
  tables: ['spreadsheets', 'spreadsheet_columns', 'spreadsheet_rows'],
};
