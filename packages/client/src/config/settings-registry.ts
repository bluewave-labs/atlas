import type { ReactElement } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Globe,
  Settings,
  Palette,
  Clock,
  Link2,
  Database,
  Info,
  Image,
  LayoutGrid,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

import { GeneralPanel } from '../components/settings/general-panel';
import { AppearancePanel } from '../components/settings/appearance-panel';
import { FormatsPanel } from '../components/settings/formats-panel';
import { DataModelPanel } from '../components/settings/data-model-panel';
import { AboutPanel } from '../components/settings/about-panel';
import { AiSettingsPanel } from '../components/settings/ai-settings-panel';
import { UpdatesPanel } from '../components/settings/updates-panel';
import { IntegrationsPanel } from '../components/settings/integrations-panel';

import {
  HomeBackgroundPanel,
  HomeWidgetsPanel,
} from '../components/home/home-settings-modal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettingsPanel {
  id: string;
  label: string;
  icon: LucideIcon;
  component: () => ReactElement;
  adminOnly?: boolean;
  ownerOnly?: boolean;
}

export interface SettingsCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  color?: string;
  panels: SettingsPanel[];
}

// ---------------------------------------------------------------------------
// Global settings (not app-specific)
// ---------------------------------------------------------------------------

export const globalSettingsCategory: SettingsCategory = {
  id: 'global',
  label: 'Global',
  icon: Globe,
  color: '#6b7280',
  panels: [
    { id: 'general', label: 'General', icon: Settings, component: GeneralPanel },
    { id: 'appearance', label: 'Appearance', icon: Palette, component: AppearancePanel },
    { id: 'formats', label: 'Formats', icon: Clock, component: FormatsPanel, adminOnly: true },
    { id: 'data-model', label: 'Data model', icon: Database, component: DataModelPanel, ownerOnly: true },
    { id: 'home-background', label: 'Home background', icon: Image, component: HomeBackgroundPanel },
    { id: 'home-widgets', label: 'Widgets', icon: LayoutGrid, component: HomeWidgetsPanel },
    { id: 'integrations', label: 'Integrations', icon: Link2, component: IntegrationsPanel, ownerOnly: true },
    { id: 'ai', label: 'AI', icon: Sparkles, component: AiSettingsPanel, adminOnly: true },
    { id: 'updates', label: 'Updates', icon: RefreshCw, component: UpdatesPanel, ownerOnly: true },
    { id: 'about', label: 'About', icon: Info, component: AboutPanel },
  ],
};

// ---------------------------------------------------------------------------
// Build full settings categories (global + app-contributed)
// ---------------------------------------------------------------------------

export function getSettingsCategories(appCategories: SettingsCategory[] = []): SettingsCategory[] {
  return [globalSettingsCategory, ...appCategories];
}

// ---------------------------------------------------------------------------
// i18n key lookups — used by the Settings sidebar
// ---------------------------------------------------------------------------

const PANEL_I18N_KEYS: Record<string, string> = {
  general: 'settingsPanel.panels.general',
  appearance: 'settingsPanel.panels.appearance',
  formats: 'settingsPanel.panels.formats',
  'data-model': 'settingsPanel.panels.dataModel',
  'home-background': 'settingsPanel.panels.homeBackground',
  'home-widgets': 'settingsPanel.panels.widgets',
  about: 'settingsPanel.panels.about',
  stages: 'settingsPanel.panels.pipelineStages',
  integrations: 'settingsPanel.panels.integrations',
  editor: 'settingsPanel.panels.editor',
  startup: 'settingsPanel.panels.startup',
  canvas: 'settingsPanel.panels.canvas',
  export: 'settingsPanel.panels.export',
  display: 'settingsPanel.panels.display',
  files: 'settingsPanel.panels.files',
  regional: 'settingsPanel.panels.regional',
  behavior: 'settingsPanel.panels.behavior',
  updates: 'settingsPanel.panels.updates',
};

const CATEGORY_I18N_KEYS: Record<string, string> = {
  global: 'settingsPanel.categories.global',
  crm: 'settingsPanel.categories.crm',
  hr: 'settingsPanel.categories.hr',
  documents: 'settingsPanel.categories.documents',
  draw: 'settingsPanel.categories.draw',
  drive: 'settingsPanel.categories.drive',
  tables: 'settingsPanel.categories.tables',
  tasks: 'settingsPanel.categories.tasks',
  projects: 'settingsPanel.categories.projects',
  sign: 'settingsPanel.categories.sign',
  invoices: 'settingsPanel.categories.invoices',
};

export function panelI18nKey(panelId: string): string | null {
  return PANEL_I18N_KEYS[panelId] ?? null;
}

export function categoryI18nKey(categoryId: string): string | null {
  return CATEGORY_I18N_KEYS[categoryId] ?? null;
}
