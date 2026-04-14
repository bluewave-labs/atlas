import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { convertToExcalidrawElements } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import '../../styles/draw.css';
import { Plus, Pencil, Layers, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  useDrawingList,
  useDrawing,
  useCreateDrawing,
  useUpdateDrawing,
  useAutoSaveDrawing,
  useUpdateDrawingVisibility,
} from './hooks';
import { useDrawSettingsStore, useDrawSettingsSync } from './settings-store';
import { DrawSettingsModal } from './components/draw-settings-modal';
import { DrawSidebar } from './components/draw-sidebar';
import { TemplatePicker } from './components/template-picker';
import { ExcalidrawCanvas } from './components/excalidraw-canvas';
import { VisibilityToggle } from '../../components/shared/visibility-toggle';
import { useAppActions } from '../../hooks/use-app-permissions';
import { useAuthStore } from '../../stores/auth-store';
import { useUIStore } from '../../stores/ui-store';
import { FeatureEmptyState } from '../../components/ui/feature-empty-state';
import type { Drawing } from '@atlas-platform/shared';

// ─── Empty state ─────────────────────────────────────────────────────

function EmptyState({ onCreate, canCreate }: { onCreate: () => void; canCreate: boolean }) {
  const { t } = useTranslation();

  return (
    <FeatureEmptyState
      illustration="drawings"
      title={t('draw.empty.title')}
      description={t('draw.empty.desc')}
      highlights={[
        { icon: <Pencil size={14} />, title: t('draw.empty.h1Title'), description: t('draw.empty.h1Desc') },
        { icon: <Layers size={14} />, title: t('draw.empty.h2Title'), description: t('draw.empty.h2Desc') },
        { icon: <Share2 size={14} />, title: t('draw.empty.h3Title'), description: t('draw.empty.h3Desc') },
      ]}
      actionLabel={canCreate ? t('draw.newDrawing') : undefined}
      actionIcon={canCreate ? <Plus size={14} /> : undefined}
      onAction={canCreate ? onCreate : undefined}
    />
  );
}

// ─── Draw page ───────────────────────────────────────────────────────

export function DrawPage() {
  useDrawSettingsSync();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [selectedId, setSelectedId] = useState<string | undefined>(id);
  const { data: drawing, isLoading } = useDrawing(selectedId);
  const { data: listData } = useDrawingList();
  const { autoSaveInterval } = useDrawSettingsStore();
  const { save, isSaving, isSuccess: isSaveSuccess } = useAutoSaveDrawing(autoSaveInterval);
  const createDrawing = useCreateDrawing();
  const updateDrawing = useUpdateDrawing();
  const updateVisibility = useUpdateDrawingVisibility();
  const { canCreate, canEdit } = useAppActions('draw');
  const { account } = useAuthStore();
  const [showTemplates, setShowTemplates] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { openSettings } = useUIStore();

  // "Saved" indicator auto-dismiss
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isSaveSuccess && !isSaving) {
      setShowSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setShowSaved(false), 2000);
    }
  }, [isSaveSuccess, isSaving]);
  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  // Sync selectedId with URL param when it changes (browser back/forward)
  useEffect(() => {
    if (id && id !== selectedId) {
      setSelectedId(id);
    }
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select first drawing when none is selected
  useEffect(() => {
    if (!selectedId && listData?.drawings && listData.drawings.length > 0) {
      const first = listData.drawings[0];
      setSelectedId(first.id);
      navigate(`/draw/${first.id}`, { replace: true });
    }
  }, [selectedId, listData, navigate]);

  const handleSelect = useCallback(
    (drawingId: string) => {
      setSelectedId(drawingId);
      navigate(`/draw/${drawingId}`, { replace: true });
    },
    [navigate],
  );

  const handleAutoSave = useCallback(
    (content: Record<string, unknown>) => {
      if (selectedId) {
        save(selectedId, { content });
      }
    },
    [selectedId, save],
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (selectedId) {
        updateDrawing.mutate({ id: selectedId, updatedAt: drawing?.updatedAt, title });
      }
    },
    [selectedId, updateDrawing],
  );

  const handleThumbnailGenerated = useCallback(
    (thumbnailUrl: string) => {
      if (selectedId) {
        updateDrawing.mutate({ id: selectedId, updatedAt: drawing?.updatedAt, thumbnailUrl });
      }
    },
    [selectedId, updateDrawing],
  );

  const handleCreateFromTemplate = useCallback(
    (title: string, templateElements?: unknown[]) => {
      let content: Record<string, unknown> | undefined;
      if (templateElements) {
        try {
          const elements = convertToExcalidrawElements(templateElements as any);
          content = { elements, appState: {}, files: {} };
        } catch {
          content = undefined;
        }
      }
      createDrawing.mutate(
        { title, content: content as any },
        {
          onSuccess: (d) => {
            handleSelect(d.id);
          },
        },
      );
    },
    [createDrawing, handleSelect],
  );

  const handleCreateNew = useCallback(() => {
    setShowTemplates(true);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        width: '100%',
        background: 'var(--color-bg-primary)',
        fontFamily: 'var(--font-family)',
      }}
    >
      <DrawSidebar
        selectedId={selectedId}
        onSelect={handleSelect}
        onNewFromTemplate={() => setShowTemplates(true)}
        onOpenSettings={() => openSettings('draw')}
        isCreating={createDrawing.isPending}
      />

      {/*
        Draw is intentionally exempt from ContentArea because Excalidraw owns the
        full viewport and has no app-level header. We keep our own flex column
        and honor the dock-bottom reserve via padding-bottom directly here.
      */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          paddingBottom: 'var(--global-dock-offset, 0px)',
        }}
      >
        {!selectedId ? (
          <EmptyState onCreate={handleCreateNew} canCreate={canCreate} />
        ) : isLoading ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-family)',
              fontSize: 'var(--font-size-md)',
            }}
          >
            {t('common.loading')}
          </div>
        ) : drawing ? (
          <ExcalidrawCanvas
            key={drawing.id}
            drawing={drawing}
            onAutoSave={handleAutoSave}
            onThumbnailGenerated={handleThumbnailGenerated}
            isSaving={isSaving}
            showSaved={showSaved}
            onTitleChange={handleTitleChange}
            canEdit={canEdit}
            visibilitySlot={
              <VisibilityToggle
                visibility={(drawing.visibility as 'private' | 'team') || 'private'}
                onToggle={(v) => updateVisibility.mutate({ id: drawing.id, visibility: v })}
                disabled={!canEdit || drawing.userId !== account?.userId}
              />
            }
          />
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-family)',
              fontSize: 'var(--font-size-md)',
            }}
          >
            {t('draw.noDrawings')}
          </div>
        )}
      </div>

      {/* Template picker modal */}
      <TemplatePicker
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        onCreate={handleCreateFromTemplate}
      />

      {/* Settings modal */}
      <DrawSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <style>{`
        @keyframes draw-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
