import type { ComponentType, LazyExoticComponent } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { AppManifestBase } from '@atlasmail/shared';
import type { SettingsCategory } from './settings-registry';

export interface AppRoute {
  path: string;
  component: ComponentType | LazyExoticComponent<ComponentType>;
}

// ─── App Widget Types ──────────────────────────────────────────────

export interface AppWidgetProps {
  width: number;
  height: number;
  appId: string;
}

export interface ClientAppWidget {
  /** Unique widget identifier within the app */
  id: string;
  /** Human-readable name */
  name: string;
  /** Short description */
  description: string;
  /** Lucide icon name (string) for server-safe reference */
  iconName: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Default grid size: sm=1col, md=2col, lg=full-row */
  defaultSize: 'sm' | 'md' | 'lg';
  /** Auto-refresh interval in ms */
  refreshInterval?: number;
  /** Whether enabled by default */
  defaultEnabled: boolean;
  /** React component to render the widget */
  component: ComponentType<AppWidgetProps>;
}

// ─── Client App Manifest ───────────────────────────────────────────

export interface ClientAppManifest extends AppManifestBase {
  /** Lucide icon component for rendering */
  icon: LucideIcon;

  /** Client routes this app registers */
  routes: AppRoute[];

  /** Settings panels this app contributes */
  settingsCategory?: SettingsCategory;

  /** Sidebar sort order (lower = higher) */
  sidebarOrder: number;

  /** Client-side widget components this app registers */
  widgets?: ClientAppWidget[];
}
