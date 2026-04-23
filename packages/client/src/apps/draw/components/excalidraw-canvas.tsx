import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Excalidraw, useHandleLibrary } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import {
  Pencil,
  Loader2,
  Check,
  Maximize,
  Minimize,
  HelpCircle,
  Palette,
} from 'lucide-react';
import { IconButton } from '../../../components/ui/icon-button';
import { Popover, PopoverTrigger, PopoverContent } from '../../../components/ui/popover';
import { DrawHelpModal } from './draw-help-modal';
import { useSettingsStore } from '../../../stores/settings-store';
import { useDrawSettingsStore } from '../settings-store';
import { SmartButtonBar } from '../../../components/shared/SmartButtonBar';
import { PresenceAvatars } from '../../../components/shared/presence-avatars';
import { ExportMenu } from './export-menu';
import { InsertImageButton } from './insert-image-button';
import { pickAppState, generateThumbnailDataUrl, THUMBNAIL_DEBOUNCE_MS } from '../lib/helpers';
import { api as drawApi } from '../../../lib/api-client';
import { DEFAULT_LIBRARY_ITEMS } from '../../../config/drawing-libraries';
import type { Drawing } from '@atlas-platform/shared';

// ─── Library persistence (server-backed) ─────────────────────────────

const libraryAdapter = {
  async load() {
    try {
      const { data } = await drawApi.get('/settings');
      const serverLib = data.data?.drawLibrary;
      const userItems = Array.isArray(serverLib) ? serverLib : [];
      return { libraryItems: [...userItems, ...DEFAULT_LIBRARY_ITEMS] as any[] };
    } catch {
      return { libraryItems: DEFAULT_LIBRARY_ITEMS as any[] };
    }
  },
  async save(libraryData: { libraryItems: readonly unknown[] }) {
    const userItems = libraryData.libraryItems.filter(
      (item: any) => !item.id?.startsWith('lib-'),
    );
    try {
      await drawApi.put('/settings', { drawLibrary: userItems });
    } catch { /* save failed */ }
  },
};

// ─── Editable title header ───────────────────────────────────────────

function EditableTitle({
  title,
  onChange,
  isSaving,
  showSaved,
  excalidrawApi,
  presenceSlot,
  visibilitySlot,
  presentSlot,
  bgPickerSlot,
  helpSlot,
  canEdit = true,
}: {
  title: string;
  onChange: (title: string) => void;
  isSaving: boolean;
  showSaved?: boolean;
  excalidrawApi: ExcalidrawImperativeAPI | null;
  presenceSlot?: React.ReactNode;
  visibilitySlot?: React.ReactNode;
  presentSlot?: React.ReactNode;
  bgPickerSlot?: React.ReactNode;
  helpSlot?: React.ReactNode;
  canEdit?: boolean;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setEditValue(title);
  }, [title]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== title) {
      onChange(trimmed);
    } else {
      setEditValue(title);
    }
    setEditing(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderBottom: '1px solid var(--color-border-primary)',
        background: 'var(--color-bg-secondary)',
        flexShrink: 0,
      }}
    >
      <Pencil size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
      {editing ? (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') {
              setEditValue(title);
              setEditing(false);
            }
          }}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 'var(--font-size-md)',
            fontWeight: 600,
            fontFamily: 'var(--font-family)',
            color: 'var(--color-text-primary)',
            padding: 0,
          }}
        />
      ) : (
        <span
          onClick={() => { if (canEdit) setEditing(true); }}
          style={{
            flex: 1,
            fontSize: 'var(--font-size-md)',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            cursor: canEdit ? 'text' : 'default',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title || t('draw.untitled')}
        </span>
      )}
      {isSaving && (
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-tertiary)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Loader2 size={12} style={{ animation: 'draw-spin 1s linear infinite' }} />
          {t('draw.saving')}
        </span>
      )}
      {!isSaving && showSaved && (
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-tertiary)',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <Check size={12} />
          {t('draw.saved')}
        </span>
      )}
      {bgPickerSlot}
      {visibilitySlot}
      {presenceSlot}
      <InsertImageButton excalidrawApi={excalidrawApi} />
      <ExportMenu excalidrawApi={excalidrawApi} />
      {helpSlot}
      {presentSlot}
    </div>
  );
}

// ─── Excalidraw canvas ───────────────────────────────────────────────

export function ExcalidrawCanvas({
  drawing,
  onAutoSave,
  onThumbnailGenerated,
  isSaving,
  showSaved,
  onTitleChange,
  visibilitySlot,
  canEdit = true,
}: {
  drawing: Drawing;
  onAutoSave: (content: Record<string, unknown>) => void;
  onThumbnailGenerated: (thumbnailUrl: string) => void;
  isSaving: boolean;
  showSaved?: boolean;
  onTitleChange: (title: string) => void;
  visibilitySlot?: React.ReactNode;
  canEdit?: boolean;
}) {
  const { t, i18n } = useTranslation();
  // Map Atlas short language codes to Excalidraw's full locale codes.
  // Excalidraw supports 'en' as short but other languages need the region suffix.
  const EXCALIDRAW_LANG_MAP: Record<string, string> = {
    en: 'en',
    tr: 'tr-TR',
    de: 'de-DE',
    fr: 'fr-FR',
    it: 'it-IT',
  };
  const shortLang = i18n.language?.split('-')[0] || 'en';
  const langCode = EXCALIDRAW_LANG_MAP[shortLang] || 'en';
  const [excalidrawApi, setExcalidrawApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [bgPickerOpen, setBgPickerOpen] = useState(false);
  const [currentBgColor, setCurrentBgColor] = useState<string>('#ffffff');
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const theme = useSettingsStore((s) => s.theme);
  const { gridMode, snapToGrid, defaultBackground } = useDrawSettingsStore();
  const isInitialLoadRef = useRef(true);
  const thumbnailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onThumbnailRef = useRef(onThumbnailGenerated);
  onThumbnailRef.current = onThumbnailGenerated;

  // Library persistence
  useHandleLibrary({ excalidrawAPI: excalidrawApi, adapter: libraryAdapter } as any);

  // Determine effective theme for Excalidraw
  const effectiveTheme = useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  }, [theme]);

  // Map setting value to Excalidraw viewBackgroundColor
  const BG_COLOR_MAP: Record<string, string> = { white: '#ffffff', light: '#f5f5f5', dark: '#1e1e1e' };
  const defaultBgColor = BG_COLOR_MAP[defaultBackground] || '#ffffff';

  // Parse initial data from drawing content
  const initialData = useMemo(() => {
    const content = drawing.content as Record<string, unknown> | null;
    if (!content) {
      return {
        appState: {
          theme: effectiveTheme,
          gridModeEnabled: gridMode,
          objectsSnapModeEnabled: snapToGrid,
          viewBackgroundColor: defaultBgColor,
        },
      };
    }
    const savedAppState = (content.appState as Record<string, unknown>) || {};
    return {
      elements: (content.elements as unknown[]) || [],
      appState: {
        ...savedAppState,
        theme: effectiveTheme,
        gridModeEnabled: savedAppState.gridModeEnabled ?? gridMode,
        objectsSnapModeEnabled: savedAppState.objectsSnapModeEnabled ?? snapToGrid,
        viewBackgroundColor: savedAppState.viewBackgroundColor ?? defaultBgColor,
      },
      files: (content.files as Record<string, unknown>) || undefined,
    };
  }, [drawing.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup thumbnail timer on unmount
  useEffect(() => {
    return () => {
      if (thumbnailTimerRef.current) clearTimeout(thumbnailTimerRef.current);
    };
  }, []);

  // Presentation mode: listen for fullscreen changes
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) {
        setIsPresenting(false);
      }
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Keyboard shortcut: "?" opens help modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        const isEditable =
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          target?.isContentEditable;
        if (isEditable) return;
        e.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Sync current bg color from Excalidraw appState when it becomes available
  useEffect(() => {
    if (!excalidrawApi) return;
    const appState = excalidrawApi.getAppState();
    if (appState?.viewBackgroundColor) {
      setCurrentBgColor(appState.viewBackgroundColor);
    }
  }, [excalidrawApi]);

  const BG_PRESETS: { color: string; labelKey: string }[] = [
    { color: '#ffffff', labelKey: 'draw.bgWhite' },
    { color: '#f8f9fa', labelKey: 'draw.bgLight' },
    { color: '#f0f8ff', labelKey: 'draw.bgIce' },
    { color: '#fffcf0', labelKey: 'draw.bgCream' },
  ];

  const handleSelectBg = useCallback(
    (color: string) => {
      if (!excalidrawApi) return;
      excalidrawApi.updateScene({ appState: { viewBackgroundColor: color } } as any);
      setCurrentBgColor(color);
      setBgPickerOpen(false);
    },
    [excalidrawApi],
  );

  const handlePresent = useCallback(async () => {
    try {
      if (canvasContainerRef.current) {
        await canvasContainerRef.current.requestFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
      setIsPresenting(true);
    } catch {
      // Fullscreen not supported or denied
    }
  }, []);

  const handleExitPresent = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore
    }
    setIsPresenting(false);
  }, []);

  const handleChange = useCallback(
    (elements: readonly unknown[], appState: Record<string, unknown>, files: unknown) => {
      // Skip the initial load callback from Excalidraw
      if (isInitialLoadRef.current) {
        isInitialLoadRef.current = false;
        return;
      }

      const persistedAppState = pickAppState(appState);
      const bg = appState.viewBackgroundColor as string | undefined;
      if (bg && bg !== currentBgColor) {
        setCurrentBgColor(bg);
      }
      onAutoSave({
        elements: elements as unknown as Record<string, unknown>[],
        appState: persistedAppState,
        files: files || {},
      });

      // Debounced thumbnail generation (less frequent than auto-save)
      if (thumbnailTimerRef.current) clearTimeout(thumbnailTimerRef.current);
      thumbnailTimerRef.current = setTimeout(async () => {
        const dataUrl = await generateThumbnailDataUrl(elements, appState, files);
        if (dataUrl) onThumbnailRef.current(dataUrl);
      }, THUMBNAIL_DEBOUNCE_MS);
    },
    [onAutoSave, currentBgColor],
  );

  return (
    <div ref={canvasContainerRef} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', background: isPresenting ? '#fff' : undefined }}>
      {!isPresenting && (
        <>
          <EditableTitle
            title={drawing.title}
            onChange={onTitleChange}
            isSaving={isSaving}
            showSaved={showSaved}
            excalidrawApi={excalidrawApi}
            canEdit={canEdit}
            presenceSlot={<PresenceAvatars appId="draw" recordId={drawing.id} />}
            visibilitySlot={visibilitySlot}
            bgPickerSlot={
              <Popover open={bgPickerOpen} onOpenChange={setBgPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={t('draw.canvasBackground')}
                    title={t('draw.canvasBackground')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 6px',
                      background: 'transparent',
                      border: '1px solid var(--color-border-primary)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      color: 'var(--color-text-tertiary)',
                    }}
                  >
                    <Palette size={12} />
                    <span
                      style={{
                        display: 'inline-block',
                        width: 14,
                        height: 14,
                        borderRadius: 3,
                        border: '1px solid var(--color-border-primary)',
                        background: currentBgColor,
                      }}
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent sideOffset={6} align="start" style={{ padding: 8 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {BG_PRESETS.map((preset) => (
                      <button
                        key={preset.color}
                        type="button"
                        onClick={() => handleSelectBg(preset.color)}
                        aria-label={preset.color}
                        title={preset.color}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          background: preset.color,
                          border:
                            currentBgColor.toLowerCase() === preset.color.toLowerCase()
                              ? '2px solid var(--color-accent-primary)'
                              : '1px solid var(--color-border-primary)',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      />
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            }
            helpSlot={
              <IconButton
                icon={<HelpCircle size={14} />}
                label={t('draw.help.title')}
                tooltip
                tooltipSide="bottom"
                size={26}
                onClick={() => setHelpOpen(true)}
              />
            }
            presentSlot={
              <IconButton
                icon={<Maximize size={14} />}
                label={t('draw.present')}
                tooltip
                tooltipSide="bottom"
                size={26}
                onClick={handlePresent}
              />
            }
          />
          <SmartButtonBar appId="draw" recordId={drawing.id} />
        </>
      )}
      <div style={{ flex: 1, position: 'relative' }}>
        <Excalidraw
          excalidrawAPI={(api: ExcalidrawImperativeAPI) => {
            setExcalidrawApi(api);
          }}
          initialData={initialData as any}
          theme={effectiveTheme}
          langCode={langCode}
          viewModeEnabled={!canEdit}
          onChange={handleChange as any}
          UIOptions={{
            canvasActions: {
              loadScene: false,
            },
          }}
        />
        {/* Exit presentation button */}
        {isPresenting && (
          <button
            onClick={handleExitPresent}
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              zIndex: 999,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family)',
              cursor: 'pointer',
              opacity: 0.7,
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
          >
            <Minimize size={14} />
            {t('draw.exitPresent')}
          </button>
        )}
      </div>
      <DrawHelpModal open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}
