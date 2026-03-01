export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorThemeId =
  | 'default'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'rose'
  | 'lavender'
  | 'amber'
  | 'slate';
export type Density = 'compact' | 'default' | 'comfortable';
export type ReadingPanePosition = 'right' | 'bottom' | 'hidden';
export type AutoAdvance = 'next' | 'previous' | 'list';
export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
export type TablesDefaultView = 'grid' | 'kanban' | 'calendar' | 'gallery';
export type TablesDefaultSort = 'none' | 'createdDate' | 'alphabetical';

export interface UserSettings {
  id: string;
  accountId: string;
  theme: ThemeMode;
  density: Density;
  shortcutsPreset: 'superhuman' | 'gmail' | 'custom';
  customShortcuts: Record<string, string>;
  autoAdvance: AutoAdvance;
  readingPane: ReadingPanePosition;
  desktopNotifications: boolean;
  notificationSound: boolean;
  signatureHtml: string | null;
  trackingEnabled: boolean;
  // Global settings (shared across all apps)
  dateFormat: DateFormat;
  currencySymbol: string;
  timezone: string;
  // Tables settings
  tablesDefaultView: TablesDefaultView;
  tablesDefaultSort: TablesDefaultSort;
  tablesShowFieldTypeIcons: boolean;
  tablesDefaultRowCount: number;
  tablesIncludeRowIdsInExport: boolean;
  homeBgType: 'unsplash' | 'solid' | 'gradient' | 'custom';
  homeBgValue: string | null;
  recentItems: string; // JSON array string
}
