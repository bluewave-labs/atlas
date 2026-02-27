import type { ReactElement } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Globe,
  Settings,
  Users,
  Palette,
  Bell,
  Keyboard,
  Info,
  Mail,
  PenLine,
  Sparkles,
  Inbox,
  PanelRight,
  Tag,
  CheckSquare,
  Eye,
  Zap,
  FileText,
  Type,
  Rocket,
  Pencil,
  Download,
} from 'lucide-react';

import {
  MailGeneralPanel,
  MailAccountsPanel,
  MailAppearancePanel,
  MailNotificationsPanel,
  MailComposerPanel,
  MailAIPanel,
  MailInboxPanel,
  MailReadingPanePanel,
  MailLabelsPanel,
  MailShortcutsPanel,
  MailAboutPanel,
} from '../components/settings/settings-modal';

import {
  TasksGeneralPanel,
  TasksAppearancePanel,
  TasksBehaviorPanel,
} from '../components/tasks/tasks-settings-modal';

import {
  DocsEditorPanel,
  DocsStartupPanel,
} from '../components/docs/doc-settings-modal';

import {
  DrawCanvasPanel,
  DrawExportPanel,
} from '../components/draw/draw-settings-modal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettingsPanel {
  id: string;
  label: string;
  icon: LucideIcon;
  component: () => ReactElement;
}

export interface SettingsCategory {
  id: string;
  label: string;
  icon: LucideIcon;
  panels: SettingsPanel[];
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const settingsCategories: SettingsCategory[] = [
  {
    id: 'global',
    label: 'Global',
    icon: Globe,
    panels: [
      { id: 'general', label: 'General', icon: Settings, component: MailGeneralPanel },
      { id: 'accounts', label: 'Accounts', icon: Users, component: MailAccountsPanel },
      { id: 'appearance', label: 'Appearance', icon: Palette, component: MailAppearancePanel },
      { id: 'notifications', label: 'Notifications', icon: Bell, component: MailNotificationsPanel },
      { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard, component: MailShortcutsPanel },
      { id: 'about', label: 'About', icon: Info, component: MailAboutPanel },
    ],
  },
  {
    id: 'mail',
    label: 'Mail',
    icon: Mail,
    panels: [
      { id: 'composer', label: 'Composer', icon: PenLine, component: MailComposerPanel },
      { id: 'ai', label: 'AI assistant', icon: Sparkles, component: MailAIPanel },
      { id: 'inbox', label: 'Inbox', icon: Inbox, component: MailInboxPanel },
      { id: 'reading-pane', label: 'Reading pane', icon: PanelRight, component: MailReadingPanePanel },
      { id: 'labels', label: 'Labels', icon: Tag, component: MailLabelsPanel },
    ],
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: CheckSquare,
    panels: [
      { id: 'general', label: 'General', icon: Settings, component: TasksGeneralPanel },
      { id: 'appearance', label: 'Appearance', icon: Eye, component: TasksAppearancePanel },
      { id: 'behavior', label: 'Behavior', icon: Zap, component: TasksBehaviorPanel },
    ],
  },
  {
    id: 'documents',
    label: 'Write',
    icon: FileText,
    panels: [
      { id: 'editor', label: 'Editor', icon: Type, component: DocsEditorPanel },
      { id: 'startup', label: 'Startup', icon: Rocket, component: DocsStartupPanel },
    ],
  },
  {
    id: 'draw',
    label: 'Draw',
    icon: Pencil,
    panels: [
      { id: 'canvas', label: 'Canvas', icon: Palette, component: DrawCanvasPanel },
      { id: 'export', label: 'Export', icon: Download, component: DrawExportPanel },
    ],
  },
];
