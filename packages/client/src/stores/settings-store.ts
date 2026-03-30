import { create } from 'zustand';
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import i18n from '../i18n';
import { api } from '../lib/api-client';
import { queryKeys } from '../config/query-keys';
import type { ThemeMode, Density, ColorThemeId } from '@atlasmail/shared';

export type FontFamilyId = 'inter' | 'geist' | 'system' | 'roboto' | 'open-sans' | 'lato';

export type AIProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'openrouter'
  | 'groq'
  | 'mistral'
  | 'deepseek'
  | 'xai'
  | 'perplexity'
  | 'fireworks'
  | 'together'
  | 'cohere'
  | 'custom';

interface CustomAIProvider {
  name: string;
  baseUrl: string;
  apiKey: string;
}

interface SettingsState {
  theme: ThemeMode;
  density: Density;
  language: string;
  fontFamily: FontFamilyId;
  customShortcuts: Record<string, string>;
  readingPane: 'right' | 'bottom' | 'hidden';
  autoAdvance: 'next' | 'previous' | 'list';
  desktopNotifications: boolean;
  soundNotifications: boolean;
  showBadgeCount: boolean;
  notificationLevel: 'all' | 'smart' | 'priority' | 'none';
  composeMode: 'plain' | 'rich';
  signature: string;
  signatureHtml: string;
  includeSignatureInReplies: boolean;
  undoSendDelay: 5 | 10 | 20 | 30;
  sendAnimation: boolean;
  themeTransition: boolean;
  colorTheme: ColorThemeId;
  trackingEnabled: boolean;
  // AI settings
  aiEnabled: boolean;
  aiProvider: AIProvider;
  aiApiKeys: Partial<Record<AIProvider, string>>;
  aiCustomProvider: CustomAIProvider;
  aiWritingAssistant: boolean;
  aiQuickReplies: boolean;
  aiThreadSummary: boolean;
  aiTranslation: boolean;
  // Format settings
  dateFormat: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
  timezone: string;
  currencySymbol: string;
  timeFormat: '12h' | '24h';
  numberFormat: 'comma-period' | 'period-comma' | 'space-comma';
  calendarStartDay: 'sunday' | 'monday';
  setDateFormat: (value: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD') => void;
  setTimezone: (value: string) => void;
  setCurrencySymbol: (value: string) => void;
  setTimeFormat: (value: '12h' | '24h') => void;
  setNumberFormat: (value: 'comma-period' | 'period-comma' | 'space-comma') => void;
  setCalendarStartDay: (value: 'sunday' | 'monday') => void;
  _hydrated: boolean;
  setTheme: (theme: ThemeMode) => void;
  setColorTheme: (colorTheme: ColorThemeId) => void;
  setDensity: (density: Density) => void;
  setFontFamily: (fontFamily: FontFamilyId) => void;
  setCustomShortcut: (id: string, keys: string) => void;
  setReadingPane: (pane: 'right' | 'bottom' | 'hidden') => void;
  setAutoAdvance: (advance: 'next' | 'previous' | 'list') => void;
  setDesktopNotifications: (value: boolean) => void;
  setSoundNotifications: (value: boolean) => void;
  setShowBadgeCount: (value: boolean) => void;
  setNotificationLevel: (level: 'all' | 'smart' | 'priority' | 'none') => void;
  setComposeMode: (mode: 'plain' | 'rich') => void;
  setSignature: (signature: string) => void;
  setSignatureHtml: (signatureHtml: string) => void;
  setIncludeSignatureInReplies: (value: boolean) => void;
  setUndoSendDelay: (delay: 5 | 10 | 20 | 30) => void;
  setSendAnimation: (value: boolean) => void;
  setThemeTransition: (value: boolean) => void;
  setTrackingEnabled: (value: boolean) => void;
  setLanguage: (language: string) => void;
  // AI setters
  setAIEnabled: (value: boolean) => void;
  setAIProvider: (provider: AIProvider) => void;
  setAIApiKey: (provider: AIProvider, key: string) => void;
  setAICustomProvider: (custom: Partial<CustomAIProvider>) => void;
  setAIWritingAssistant: (value: boolean) => void;
  setAIQuickReplies: (value: boolean) => void;
  setAIThreadSummary: (value: boolean) => void;
  setAITranslation: (value: boolean) => void;
  _hydrateFromServer: (data: Record<string, unknown>) => void;
}

// Map from local field names to server column names
const TO_SERVER: Record<string, string> = {
  theme: 'theme',
  density: 'density',
  language: 'language',
  fontFamily: 'fontFamily',
  customShortcuts: 'customShortcuts',
  readingPane: 'readingPane',
  autoAdvance: 'autoAdvance',
  desktopNotifications: 'desktopNotifications',
  soundNotifications: 'notificationSound',
  showBadgeCount: 'showBadgeCount',
  notificationLevel: 'notificationLevel',
  composeMode: 'composeMode',
  signature: 'signature',
  signatureHtml: 'signatureHtml',
  includeSignatureInReplies: 'includeSignatureInReplies',
  undoSendDelay: 'undoSendDelay',
  sendAnimation: 'sendAnimation',
  themeTransition: 'themeTransition',
  colorTheme: 'colorTheme',
  trackingEnabled: 'trackingEnabled',
  aiEnabled: 'aiEnabled',
  aiProvider: 'aiProvider',
  aiApiKeys: 'aiApiKeys',
  aiCustomProvider: 'aiCustomProvider',
  aiWritingAssistant: 'aiWritingAssistant',
  aiQuickReplies: 'aiQuickReplies',
  aiThreadSummary: 'aiThreadSummary',
  aiTranslation: 'aiTranslation',
  dateFormat: 'dateFormat',
  timezone: 'timezone',
  currencySymbol: 'currencySymbol',
  timeFormat: 'timeFormat',
  numberFormat: 'numberFormat',
  calendarStartDay: 'calendarStartDay',
};

const FROM_SERVER: Record<string, string> = Object.fromEntries(
  Object.entries(TO_SERVER).map(([local, server]) => [server, local])
);

// Persist to server (fire-and-forget)
function persistToServer(serverKey: string, value: unknown) {
  api.put('/settings', { [serverKey]: value }).catch(() => {});
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  theme: 'dark',
  density: 'default',
  fontFamily: 'inter',
  language: i18n.language?.split('-')[0] || 'en',
  customShortcuts: {},
  readingPane: 'right',
  autoAdvance: 'next',
  desktopNotifications: true,
  soundNotifications: false,
  showBadgeCount: true,
  notificationLevel: 'smart',
  composeMode: 'rich',
  signature: '',
  signatureHtml: '',
  includeSignatureInReplies: true,
  undoSendDelay: 5,
  sendAnimation: true,
  themeTransition: true,
  colorTheme: 'default',
  trackingEnabled: false,
  // AI defaults
  aiEnabled: false,
  aiProvider: 'openai',
  aiApiKeys: {},
  aiCustomProvider: { name: '', baseUrl: '', apiKey: '' },
  aiWritingAssistant: true,
  aiQuickReplies: true,
  aiThreadSummary: true,
  aiTranslation: true,
  // Format defaults
  dateFormat: 'MM/DD/YYYY',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  currencySymbol: '$',
  timeFormat: '12h',
  numberFormat: 'comma-period',
  calendarStartDay: 'sunday',
  _hydrated: false,
  setTheme: (theme) => { set({ theme }); persistToServer('theme', theme); },
  setColorTheme: (colorTheme) => { set({ colorTheme }); persistToServer('colorTheme', colorTheme); },
  setDensity: (density) => { set({ density }); persistToServer('density', density); },
  setFontFamily: (fontFamily) => { set({ fontFamily }); persistToServer('fontFamily', fontFamily); },
  setCustomShortcut: (id, keys) =>
    set((s) => {
      const customShortcuts = { ...s.customShortcuts, [id]: keys };
      persistToServer('customShortcuts', customShortcuts);
      return { customShortcuts };
    }),
  setReadingPane: (readingPane) => { set({ readingPane }); persistToServer('readingPane', readingPane); },
  setAutoAdvance: (autoAdvance) => { set({ autoAdvance }); persistToServer('autoAdvance', autoAdvance); },
  setDesktopNotifications: (desktopNotifications) => { set({ desktopNotifications }); persistToServer('desktopNotifications', desktopNotifications); },
  setSoundNotifications: (soundNotifications) => { set({ soundNotifications }); persistToServer('notificationSound', soundNotifications); },
  setShowBadgeCount: (showBadgeCount) => { set({ showBadgeCount }); persistToServer('showBadgeCount', showBadgeCount); },
  setNotificationLevel: (notificationLevel) => { set({ notificationLevel }); persistToServer('notificationLevel', notificationLevel); },
  setComposeMode: (composeMode) => { set({ composeMode }); persistToServer('composeMode', composeMode); },
  setSignature: (signature) => { set({ signature }); persistToServer('signature', signature); },
  setSignatureHtml: (signatureHtml) => { set({ signatureHtml }); persistToServer('signatureHtml', signatureHtml); },
  setIncludeSignatureInReplies: (includeSignatureInReplies) => { set({ includeSignatureInReplies }); persistToServer('includeSignatureInReplies', includeSignatureInReplies); },
  setUndoSendDelay: (undoSendDelay) => { set({ undoSendDelay }); persistToServer('undoSendDelay', undoSendDelay); },
  setSendAnimation: (sendAnimation) => { set({ sendAnimation }); persistToServer('sendAnimation', sendAnimation); },
  setThemeTransition: (themeTransition) => { set({ themeTransition }); persistToServer('themeTransition', themeTransition); },
  setTrackingEnabled: (trackingEnabled) => { set({ trackingEnabled }); persistToServer('trackingEnabled', trackingEnabled); },
  setLanguage: (language) => {
    i18n.changeLanguage(language);
    set({ language });
    persistToServer('language', language);
  },
  // AI setters
  setAIEnabled: (aiEnabled) => { set({ aiEnabled }); persistToServer('aiEnabled', aiEnabled); },
  setAIProvider: (aiProvider) => { set({ aiProvider }); persistToServer('aiProvider', aiProvider); },
  setAIApiKey: (provider, key) =>
    set((s) => {
      const aiApiKeys = { ...s.aiApiKeys, [provider]: key };
      persistToServer('aiApiKeys', aiApiKeys);
      return { aiApiKeys };
    }),
  setAICustomProvider: (partial) =>
    set((s) => {
      const aiCustomProvider = { ...s.aiCustomProvider, ...partial };
      persistToServer('aiCustomProvider', aiCustomProvider);
      return { aiCustomProvider };
    }),
  setAIWritingAssistant: (aiWritingAssistant) => { set({ aiWritingAssistant }); persistToServer('aiWritingAssistant', aiWritingAssistant); },
  setAIQuickReplies: (aiQuickReplies) => { set({ aiQuickReplies }); persistToServer('aiQuickReplies', aiQuickReplies); },
  setAIThreadSummary: (aiThreadSummary) => { set({ aiThreadSummary }); persistToServer('aiThreadSummary', aiThreadSummary); },
  setAITranslation: (aiTranslation) => { set({ aiTranslation }); persistToServer('aiTranslation', aiTranslation); },
  // Format setters
  setDateFormat: (dateFormat) => { set({ dateFormat }); persistToServer('dateFormat', dateFormat); },
  setTimezone: (timezone) => { set({ timezone }); persistToServer('timezone', timezone); },
  setCurrencySymbol: (currencySymbol) => { set({ currencySymbol }); persistToServer('currencySymbol', currencySymbol); },
  setTimeFormat: (timeFormat) => { set({ timeFormat }); persistToServer('timeFormat', timeFormat); },
  setNumberFormat: (numberFormat) => { set({ numberFormat }); persistToServer('numberFormat', numberFormat); },
  setCalendarStartDay: (calendarStartDay) => { set({ calendarStartDay }); persistToServer('calendarStartDay', calendarStartDay); },
  _hydrateFromServer: (data: Record<string, unknown>) => {
    const patch: Record<string, unknown> = {};
    for (const [serverKey, localKey] of Object.entries(FROM_SERVER)) {
      if (serverKey in data && data[serverKey] !== undefined && data[serverKey] !== null) {
        patch[localKey] = data[serverKey];
      }
    }
    if (data.language && typeof data.language === 'string') {
      i18n.changeLanguage(data.language);
    }
    set({ ...patch, _hydrated: true } as Partial<SettingsState>);
  },
}));

/**
 * Hook to sync settings store from server on mount.
 * Call this once near the app root (e.g. in App.tsx or a layout provider).
 */
export function useSettingsSync() {
  const hydrateFromServer = useSettingsStore((s) => s._hydrateFromServer);
  const hydrated = useSettingsStore((s) => s._hydrated);

  const hasToken = !!localStorage.getItem('atlasmail_token');

  const { data: serverSettings } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data.data as Record<string, unknown> | null;
    },
    staleTime: 60_000,
    enabled: hasToken,
  });

  useEffect(() => {
    if (serverSettings && !hydrated) {
      hydrateFromServer(serverSettings);
    }
  }, [serverSettings, hydrated, hydrateFromServer]);
}
