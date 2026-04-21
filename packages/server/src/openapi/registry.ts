import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { openApiRegistry } from './_helpers';

// Register all paths (side-effect imports).
import './paths/auth';
import './paths/platform';
import './paths/misc';
import './paths/crm';
import './paths/hr';
import './paths/work';
import './paths/invoices';
import './paths/sign';
import './paths/drive';
import './paths/docs';
import './paths/draw';
import './paths/calendar';
import './paths/system';

export function buildOpenApiDocument() {
  const generator = new OpenApiGeneratorV31(openApiRegistry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Atlas API',
      version: process.env.npm_package_version ?? '2.2.0',
      description:
        'Atlas platform API. All responses follow `{ success, data | error }`. ' +
        'Authenticated endpoints require `Authorization: Bearer <token>`.',
    },
    servers: [{ url: '/api/v1' }],
    tags: [
      { name: 'Authentication' },
      { name: 'User settings' },
      { name: 'Platform' },
      { name: 'Notifications' },
      { name: 'Search' },
      { name: 'Record links' },
      { name: 'Custom fields' },
      { name: 'Exchange rates' },
      { name: 'Files' },
      { name: 'Stocks' },
      { name: 'Presence' },
      { name: 'Updates' },
      { name: 'Public share' },
      { name: 'CRM' },
      { name: 'HR' },
      { name: 'Work' },
      { name: 'Invoices' },
      { name: 'Sign' },
      { name: 'Drive' },
      { name: 'Write' },
      { name: 'Draw' },
      { name: 'Calendar' },
      { name: 'System' },
    ],
  });
}
