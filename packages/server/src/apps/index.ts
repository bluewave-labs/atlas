import { serverAppRegistry } from '../config/app-registry.server';
import { crmServerManifest } from './crm/manifest';
import { hrServerManifest } from './hr/manifest';
import { signServerManifest } from './sign/manifest';
import { driveServerManifest } from './drive/manifest';
import { tablesServerManifest } from './tables/manifest';
import { tasksServerManifest } from './tasks/manifest';
import { docsServerManifest } from './docs/manifest';
import { drawServerManifest } from './draw/manifest';
import { systemServerManifest } from './system/manifest';

serverAppRegistry.register(crmServerManifest);
serverAppRegistry.register(hrServerManifest);
serverAppRegistry.register(signServerManifest);
serverAppRegistry.register(driveServerManifest);
serverAppRegistry.register(tablesServerManifest);
serverAppRegistry.register(tasksServerManifest);
serverAppRegistry.register(docsServerManifest);
serverAppRegistry.register(drawServerManifest);
serverAppRegistry.register(systemServerManifest);

export { serverAppRegistry };
