import type { ColorThemeId } from '@atlasmail/shared';

export interface ColorThemeVariant {
  accentPrimary: string;
  accentPrimaryHover: string;
  accentPrimaryActive: string;
  borderFocus: string;
  unreadIndicator: string;
  textLink: string;
  info: string;
  surfaceSelected: string;
  categoryImportant: string;
  categoryOther: string;
  categoryNewsletters: string;
  categoryNotifications: string;
}

export interface ColorTheme {
  id: ColorThemeId;
  name: string;
  swatch: string;
  light: ColorThemeVariant;
  dark: ColorThemeVariant;
}

// ---------------------------------------------------------------------------
// 8 built-in color themes
// ---------------------------------------------------------------------------

export const COLOR_THEMES: ColorTheme[] = [
  {
    id: 'default',
    name: 'Default',
    swatch: '#5a7fa0',
    light: {
      accentPrimary: '#5a7fa0',
      accentPrimaryHover: '#4d6e8c',
      accentPrimaryActive: '#3f5c78',
      borderFocus: '#7a9ab8',
      unreadIndicator: '#5a7fa0',
      textLink: '#5a7fa0',
      info: '#5a7fa0',
      surfaceSelected: '#c8d4e0',
      categoryImportant: '#5a7fa0',
      categoryOther: '#7a8495',
      categoryNewsletters: '#8b6cc4',
      categoryNotifications: '#c47a3a',
    },
    dark: {
      accentPrimary: '#7a9ab8',
      accentPrimaryHover: '#8dadc8',
      accentPrimaryActive: '#6889a5',
      borderFocus: '#7a9ab8',
      unreadIndicator: '#7a9ab8',
      textLink: '#7a9ab8',
      info: '#7a9ab8',
      surfaceSelected: '#1e2a3d',
      categoryImportant: '#7a9ab8',
      categoryOther: '#9ba2b0',
      categoryNewsletters: '#a48bd4',
      categoryNotifications: '#d4954a',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    swatch: '#0d9488',
    light: {
      accentPrimary: '#0d9488',
      accentPrimaryHover: '#0a7a70',
      accentPrimaryActive: '#076059',
      borderFocus: '#2dd4bf',
      unreadIndicator: '#0d9488',
      textLink: '#0d9488',
      info: '#0d9488',
      surfaceSelected: '#c2ddd6',
      categoryImportant: '#0d9488',
      categoryOther: '#7a8495',
      categoryNewsletters: '#6366f1',
      categoryNotifications: '#d97706',
    },
    dark: {
      accentPrimary: '#2dd4bf',
      accentPrimaryHover: '#5eead4',
      accentPrimaryActive: '#14b8a6',
      borderFocus: '#2dd4bf',
      unreadIndicator: '#2dd4bf',
      textLink: '#5eead4',
      info: '#2dd4bf',
      surfaceSelected: '#0f2e2a',
      categoryImportant: '#2dd4bf',
      categoryOther: '#9ba2b0',
      categoryNewsletters: '#a5b4fc',
      categoryNotifications: '#fbbf24',
    },
  },
  {
    id: 'forest',
    name: 'Forest',
    swatch: '#059669',
    light: {
      accentPrimary: '#059669',
      accentPrimaryHover: '#047857',
      accentPrimaryActive: '#065f46',
      borderFocus: '#34d399',
      unreadIndicator: '#059669',
      textLink: '#059669',
      info: '#059669',
      surfaceSelected: '#bcddd0',
      categoryImportant: '#059669',
      categoryOther: '#7a8495',
      categoryNewsletters: '#8b5cf6',
      categoryNotifications: '#ea580c',
    },
    dark: {
      accentPrimary: '#34d399',
      accentPrimaryHover: '#6ee7b7',
      accentPrimaryActive: '#10b981',
      borderFocus: '#34d399',
      unreadIndicator: '#34d399',
      textLink: '#6ee7b7',
      info: '#34d399',
      surfaceSelected: '#0f2d1f',
      categoryImportant: '#34d399',
      categoryOther: '#9ba2b0',
      categoryNewsletters: '#c4b5fd',
      categoryNotifications: '#fb923c',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    swatch: '#ea580c',
    light: {
      accentPrimary: '#ea580c',
      accentPrimaryHover: '#c2410c',
      accentPrimaryActive: '#9a3412',
      borderFocus: '#fb923c',
      unreadIndicator: '#ea580c',
      textLink: '#ea580c',
      info: '#ea580c',
      surfaceSelected: '#e4cfc0',
      categoryImportant: '#ea580c',
      categoryOther: '#7a8495',
      categoryNewsletters: '#7c3aed',
      categoryNotifications: '#0d9488',
    },
    dark: {
      accentPrimary: '#fb923c',
      accentPrimaryHover: '#fdba74',
      accentPrimaryActive: '#f97316',
      borderFocus: '#fb923c',
      unreadIndicator: '#fb923c',
      textLink: '#fdba74',
      info: '#fb923c',
      surfaceSelected: '#2d1f0f',
      categoryImportant: '#fb923c',
      categoryOther: '#9ba2b0',
      categoryNewsletters: '#a78bfa',
      categoryNotifications: '#2dd4bf',
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    swatch: '#e11d48',
    light: {
      accentPrimary: '#e11d48',
      accentPrimaryHover: '#be123c',
      accentPrimaryActive: '#9f1239',
      borderFocus: '#fb7185',
      unreadIndicator: '#e11d48',
      textLink: '#e11d48',
      info: '#e11d48',
      surfaceSelected: '#e4c4c8',
      categoryImportant: '#e11d48',
      categoryOther: '#7a8495',
      categoryNewsletters: '#6366f1',
      categoryNotifications: '#d97706',
    },
    dark: {
      accentPrimary: '#fb7185',
      accentPrimaryHover: '#fda4af',
      accentPrimaryActive: '#f43f5e',
      borderFocus: '#fb7185',
      unreadIndicator: '#fb7185',
      textLink: '#fda4af',
      info: '#fb7185',
      surfaceSelected: '#2d0f14',
      categoryImportant: '#fb7185',
      categoryOther: '#9ba2b0',
      categoryNewsletters: '#a5b4fc',
      categoryNotifications: '#fbbf24',
    },
  },
  {
    id: 'lavender',
    name: 'Lavender',
    swatch: '#7c3aed',
    light: {
      accentPrimary: '#7c3aed',
      accentPrimaryHover: '#6d28d9',
      accentPrimaryActive: '#5b21b6',
      borderFocus: '#a78bfa',
      unreadIndicator: '#7c3aed',
      textLink: '#7c3aed',
      info: '#7c3aed',
      surfaceSelected: '#d4c8ee',
      categoryImportant: '#7c3aed',
      categoryOther: '#7a8495',
      categoryNewsletters: '#0d9488',
      categoryNotifications: '#ea580c',
    },
    dark: {
      accentPrimary: '#a78bfa',
      accentPrimaryHover: '#c4b5fd',
      accentPrimaryActive: '#8b5cf6',
      borderFocus: '#a78bfa',
      unreadIndicator: '#a78bfa',
      textLink: '#c4b5fd',
      info: '#a78bfa',
      surfaceSelected: '#1f0f2d',
      categoryImportant: '#a78bfa',
      categoryOther: '#9ba2b0',
      categoryNewsletters: '#2dd4bf',
      categoryNotifications: '#fb923c',
    },
  },
  {
    id: 'amber',
    name: 'Amber',
    swatch: '#d97706',
    light: {
      accentPrimary: '#d97706',
      accentPrimaryHover: '#b45309',
      accentPrimaryActive: '#92400e',
      borderFocus: '#fbbf24',
      unreadIndicator: '#d97706',
      textLink: '#d97706',
      info: '#d97706',
      surfaceSelected: '#e4d5b4',
      categoryImportant: '#d97706',
      categoryOther: '#7a8495',
      categoryNewsletters: '#7c3aed',
      categoryNotifications: '#0d9488',
    },
    dark: {
      accentPrimary: '#fbbf24',
      accentPrimaryHover: '#fcd34d',
      accentPrimaryActive: '#f59e0b',
      borderFocus: '#fbbf24',
      unreadIndicator: '#fbbf24',
      textLink: '#fcd34d',
      info: '#fbbf24',
      surfaceSelected: '#2d250f',
      categoryImportant: '#fbbf24',
      categoryOther: '#9ba2b0',
      categoryNewsletters: '#a78bfa',
      categoryNotifications: '#2dd4bf',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    swatch: '#64748b',
    light: {
      accentPrimary: '#64748b',
      accentPrimaryHover: '#475569',
      accentPrimaryActive: '#334155',
      borderFocus: '#94a3b8',
      unreadIndicator: '#64748b',
      textLink: '#64748b',
      info: '#64748b',
      surfaceSelected: '#c8d0da',
      categoryImportant: '#64748b',
      categoryOther: '#7a8495',
      categoryNewsletters: '#8b5cf6',
      categoryNotifications: '#ea580c',
    },
    dark: {
      accentPrimary: '#94a3b8',
      accentPrimaryHover: '#cbd5e1',
      accentPrimaryActive: '#7c8ba0',
      borderFocus: '#94a3b8',
      unreadIndicator: '#94a3b8',
      textLink: '#cbd5e1',
      info: '#94a3b8',
      surfaceSelected: '#1e2330',
      categoryImportant: '#94a3b8',
      categoryOther: '#9ba2b0',
      categoryNewsletters: '#c4b5fd',
      categoryNotifications: '#fb923c',
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CSS_VAR_MAP: Record<keyof ColorThemeVariant, string> = {
  accentPrimary: '--color-accent-primary',
  accentPrimaryHover: '--color-accent-primary-hover',
  accentPrimaryActive: '--color-accent-primary-active',
  borderFocus: '--color-border-focus',
  unreadIndicator: '--color-unread-indicator',
  textLink: '--color-text-link',
  info: '--color-info',
  surfaceSelected: '--color-surface-selected',
  categoryImportant: '--color-category-important',
  categoryOther: '--color-category-other',
  categoryNewsletters: '--color-category-newsletters',
  categoryNotifications: '--color-category-notifications',
};

export function getColorTheme(id: ColorThemeId): ColorTheme {
  return COLOR_THEMES.find((t) => t.id === id) ?? COLOR_THEMES[0];
}

export function applyColorTheme(themeId: ColorThemeId, mode: 'light' | 'dark'): void {
  const theme = getColorTheme(themeId);
  const variant = theme[mode];
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) {
    root.style.setProperty(cssVar, variant[key as keyof ColorThemeVariant]);
  }
}
