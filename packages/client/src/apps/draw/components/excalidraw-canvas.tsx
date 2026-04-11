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
} from 'lucide-react';
import { IconButton } from '../../../components/ui/icon-button';
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
      {visibilitySlot}
      {presenceSlot}
      <InsertImageButton excalidrawApi={excalidrawApi} />
      <ExportMenu excalidrawApi={excalidrawApi} />
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
  const { t } = useTranslation();
  const [excalidrawApi, setExcalidrawApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const [isPresenting, setIsPresenting] = useState(false);
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
    [onAutoSave],
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
    </div>
  );
}
