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
  Calendar,
  Table2,
  Languages,
  HardDrive,
  File,
  Home,
  Image,
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

import {
  TablesGeneralPanel,
  TablesRegionalPanel,
} from '../components/tables/tables-settings-modal';

import {
  CalendarGeneralPanel,
  CalendarAppearancePanel,
} from '../components/calendar/calendar-settings-modal';

import {
  DriveGeneralPanel,
  DriveDisplayPanel,
  DriveFilesPanel,
} from '../components/drive/drive-settings-modal';

import {
  HomeBackgroundPanel,
} from '../components/home/home-settings-modal';

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
  color?: string;
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
    color: '#6b7280',
    panels: [
      { id: 'general', label: 'General', icon: Settings, component: MailGeneralPanel },
      { id: 'accounts', label: 'Accounts', icon: Users, component: MailAccountsPanel },
      { id: 'appearance', label: 'Appearance', icon: Palette, component: MailAppearancePanel },
      { id: 'notifications', label: 'Notifications', icon: Bell, component: MailNotificationsPanel },
      { id: 'home-background', label: 'Home background', icon: Image, component: HomeBackgroundPanel },
      { id: 'about', label: 'About', icon: Info, component: MailAboutPanel },
    ],
  },
  {
    id: 'mail',
    label: 'Mail',
    icon: Mail,
    color: '#4a9e8f',
    panels: [
      { id: 'composer', label: 'Composer', icon: PenLine, component: MailComposerPanel },
      { id: 'ai', label: 'AI assistant in Mail', icon: Sparkles, component: MailAIPanel },
      { id: 'inbox', label: 'Inbox', icon: Inbox, component: MailInboxPanel },
      { id: 'reading-pane', label: 'Reading pane', icon: PanelRight, component: MailReadingPanePanel },
      { id: 'labels', label: 'Labels', icon: Tag, component: MailLabelsPanel },
      { id: 'shortcuts', label: 'Shortcuts', icon: Keyboard, component: MailShortcutsPanel },
    ],
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: Calendar,
    color: '#7c6fbd',
    panels: [
      { id: 'general', label: 'General', icon: Settings, component: CalendarGeneralPanel },
      { id: 'appearance', label: 'Appearance', icon: Palette, component: CalendarAppearancePanel },
    ],
  },
  {
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
  {
    id: 'documents',
    label: 'Write',
    icon: FileText,
    color: '#c4856c',
    panels: [
      { id: 'editor', label: 'Editor', icon: Type, component: DocsEditorPanel },
      { id: 'startup', label: 'Startup', icon: Rocket, component: DocsStartupPanel },
    ],
  },
  {
    id: 'draw',
    label: 'Draw',
    icon: Pencil,
    color: '#e06c9f',
    panels: [
      { id: 'canvas', label: 'Canvas', icon: Palette, component: DrawCanvasPanel },
      { id: 'export', label: 'Export', icon: Download, component: DrawExportPanel },
    ],
  },
  {
    id: 'tables',
    label: 'Tables',
    icon: Table2,
    color: '#2d8a6e',
    panels: [
      { id: 'general', label: 'General', icon: Settings, component: TablesGeneralPanel },
      { id: 'regional', label: 'Regional', icon: Languages, component: TablesRegionalPanel },
    ],
  },
  {
    id: 'drive',
    label: 'Drive',
    icon: HardDrive,
    color: '#64748b',
    panels: [
      { id: 'general', label: 'General', icon: Settings, component: DriveGeneralPanel },
      { id: 'display', label: 'Display', icon: Eye, component: DriveDisplayPanel },
      { id: 'files', label: 'Files', icon: File, component: DriveFilesPanel },
    ],
  },
];
