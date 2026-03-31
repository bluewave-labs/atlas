import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  shortcutHelpOpen: boolean;
  searchFocused: boolean;
  settingsOpen: boolean;
  settingsApp: string | null;
  settingsPanel: string | null;
  toggleSidebar: () => void;
  toggleCommandPalette: () => void;
  toggleShortcutHelp: () => void;
  setSearchFocused: (focused: boolean) => void;
  toggleSettings: () => void;
  openSettings: (app?: string, panel?: string) => void;
  closeSettings: () => void;
}

// Persist last settings position to localStorage
function loadSettingsPosition(): { settingsApp: string | null; settingsPanel: string | null } {
  try {
    const raw = localStorage.getItem('atlas_settings_position');
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { settingsApp: null, settingsPanel: null };
}

function saveSettingsPosition(app: string | null, panel: string | null) {
  localStorage.setItem('atlas_settings_position', JSON.stringify({ settingsApp: app, settingsPanel: panel }));
}

const savedPos = loadSettingsPosition();

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  commandPaletteOpen: false,
  shortcutHelpOpen: false,
  searchFocused: false,
  settingsOpen: false,
  settingsApp: savedPos.settingsApp,
  settingsPanel: savedPos.settingsPanel,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  toggleCommandPalette: () => set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  toggleShortcutHelp: () => set((s) => ({ shortcutHelpOpen: !s.shortcutHelpOpen })),
  setSearchFocused: (focused) => set({ searchFocused: focused }),
  toggleSettings: () => set((s) => ({ settingsOpen: !s.settingsOpen })),
  openSettings: (app, panel) => {
    const a = app ?? null;
    const p = panel ?? null;
    saveSettingsPosition(a, p);
    set({ settingsOpen: true, settingsApp: a, settingsPanel: p });
  },
  closeSettings: () => set({ settingsOpen: false }),
}));
