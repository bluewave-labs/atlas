import type { LucideIcon } from 'lucide-react';
import type { ClientAppManifest, AppRoute, ClientAppWidget } from './app-manifest.client';
import type { SettingsCategory } from './settings-registry';

class AppRegistry {
  private apps: Map<string, ClientAppManifest> = new Map();

  register(manifest: ClientAppManifest): void {
    if (this.apps.has(manifest.id)) {
      console.warn(`App "${manifest.id}" already registered`);
      return;
    }
    this.apps.set(manifest.id, manifest);
  }

  get(id: string): ClientAppManifest | undefined {
    return this.apps.get(id);
  }

  getAll(): ClientAppManifest[] {
    return Array.from(this.apps.values())
      .sort((a, b) => a.sidebarOrder - b.sidebarOrder);
  }

  getEnabled(enabledAppIds: Set<string>): ClientAppManifest[] {
    return this.getAll().filter(app => enabledAppIds.has(app.id));
  }

  getRoutes(): AppRoute[] {
    return this.getAll().flatMap(app => app.routes);
  }

  getNavItems(): Array<{ id: string; labelKey: string; icon: LucideIcon; color: string; route: string }> {
    return this.getAll().map(app => ({
      id: app.id,
      labelKey: app.labelKey,
      icon: app.icon,
      color: app.color,
      route: app.routes[0]?.path ?? `/${app.id}`,
    }));
  }

  getSettingsCategories(): SettingsCategory[] {
    return this.getAll()
      .map(app => app.settingsCategory)
      .filter((c): c is SettingsCategory => c !== undefined);
  }

  /** Collect widgets from all registered apps with app metadata attached */
  getAllWidgets(): Array<ClientAppWidget & { appId: string; appName: string; appColor: string }> {
    const result: Array<ClientAppWidget & { appId: string; appName: string; appColor: string }> = [];
    for (const app of this.getAll()) {
      if (app.widgets) {
        for (const widget of app.widgets) {
          result.push({ ...widget, appId: app.id, appName: app.name, appColor: app.color });
        }
      }
    }
    return result;
  }

  /** Get widgets registered by a specific app */
  getAppWidgets(appId: string): ClientAppWidget[] {
    return this.get(appId)?.widgets ?? [];
  }
}

export const appRegistry = new AppRegistry();
