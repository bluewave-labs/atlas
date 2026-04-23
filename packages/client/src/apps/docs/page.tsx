import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  PenTool,
  Layers,
} from 'lucide-react';
import { DocSidebar } from './components/doc-sidebar';
import {
  useDocument,
  useDocumentList,
  useAutoSaveDocument,
  useUpdateDocument,
  useCreateDocument,
  useRestoreVersion,
  useUpdateDocumentVisibility,
} from './hooks';
import { DocSettingsModal } from './components/doc-settings-modal';
import { CommentSidebar } from './components/comment-sidebar';
import { urlForCategory } from '../../config/settings-url';
import { useDocSettingsStore, useDocSettingsSync } from './settings-store';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';
import { useDrawingList } from '../draw/hooks';
import { SmartButtonBar } from '../../components/shared/SmartButtonBar';
import { useAuthStore } from '../../stores/auth-store';
import { FeatureEmptyState } from '../../components/ui/feature-empty-state';
import { ContentArea } from '../../components/ui/content-area';
import { TopBar } from './components/top-bar';
import { DocumentView } from './components/document-view';
import { TemplateGallery } from './components/template-gallery';
import { VersionHistoryPanel } from './components/version-history-panel';
import type { PageTemplate } from './lib/templates';
import '../../styles/docs.css';

// ─── DocsPage ───────────────────────────────────────────────────────────

export function DocsPage() {
  useDocSettingsSync();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [selectedId, setSelectedId] = useState<string | undefined>(id);
  const { data: doc, isLoading } = useDocument(selectedId);
  const { data: listData } = useDocumentList();
  const { save, isSaving } = useAutoSaveDocument();
  const updateDoc = useUpdateDocument();
  const createDoc = useCreateDocument();
  const updateVisibility = useUpdateDocumentVisibility();
  const { account } = useAuthStore();
  const { data: drawingListData } = useDrawingList();
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showDocSettings, setShowDocSettings] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Auto-select a document when none is selected.
  // If openLastVisited is on, prefer the most recently viewed doc.
  const openLastVisited = useDocSettingsStore((s) => s.openLastVisited);
  const { data: serverSettings } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data.data as Record<string, unknown> | null;
    },
    staleTime: 60_000,
  });
  const docRecent = Array.isArray(serverSettings?.docRecent) ? serverSettings.docRecent as string[] : [];
  useEffect(() => {
    if (!selectedId && listData?.tree && listData.tree.length > 0) {
      let target: string | undefined;
      if (openLastVisited) {
        const allIds = new Set(listData.documents.map((d) => d.id));
        target = docRecent.find((rid) => allIds.has(rid));
      }
      if (!target) target = listData.tree[0].id;
      setSelectedId(target);
      navigate(`/docs/${target}`, { replace: true });
    }
  }, [selectedId, listData, navigate, openLastVisited, docRecent]);

  const handleSelect = useCallback(
    (docId: string) => {
      setSelectedId(docId);
      navigate(`/docs/${docId}`, { replace: true });
    },
    [navigate],
  );

  const handleContentChange = useCallback(
    (content: Record<string, unknown>) => {
      if (selectedId) {
        save(selectedId, { content }, doc?.updatedAt);
      }
    },
    [selectedId, save, doc?.updatedAt],
  );

  const handleTitleChange = useCallback(
    (title: string) => {
      if (selectedId) {
        save(selectedId, { title }, doc?.updatedAt);
      }
    },
    [selectedId, save, doc?.updatedAt],
  );

  const handleIconChange = useCallback(
    (icon: string | null) => {
      if (selectedId) {
        updateDoc.mutate({ id: selectedId, updatedAt: doc?.updatedAt, icon });
      }
    },
    [selectedId, updateDoc],
  );

  const handleCoverChange = useCallback(
    (coverImage: string | null) => {
      if (selectedId) {
        updateDoc.mutate({ id: selectedId, updatedAt: doc?.updatedAt, coverImage });
      }
    },
    [selectedId, updateDoc],
  );

  const handleCreateFromTemplate = useCallback(
    (template: PageTemplate) => {
      createDoc.mutate(
        {
          title: template.title,
          icon: template.icon,
          content: template.content ? { _html: template.content } : null,
        },
        {
          onSuccess: (newDoc) => {
            handleSelect(newDoc.id);
            setShowTemplates(false);
          },
        },
      );
    },
    [createDoc, handleSelect],
  );

  const restoreVersionMutation = useRestoreVersion();
  const handleRestoreVersion = useCallback(
    (versionId: string) => {
      if (selectedId) {
        restoreVersionMutation.mutate(
          { documentId: selectedId, versionId },
          {
            onSuccess: () => {
              // Re-select to refresh the doc
              handleSelect(selectedId);
              setShowVersionHistory(false);
            },
          },
        );
      }
    },
    [selectedId, handleSelect, restoreVersionMutation],
  );

  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const ext = file.name.split('.').pop()?.toLowerCase();
      let html = '';
      const title = file.name.replace(/\.(md|docx?|html?)$/i, '');

      if (ext === 'md') {
        const text = await file.text();
        html = text
          .replace(/^### (.*$)/gm, '<h3>$1</h3>')
          .replace(/^## (.*$)/gm, '<h2>$1</h2>')
          .replace(/^# (.*$)/gm, '<h1>$1</h1>')
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>')
          .replace(/\n/g, '<br>');
      } else if (ext === 'html' || ext === 'htm') {
        html = await file.text();
      } else {
        html = `<p>${t('docs.importedFrom', { filename: file.name })}</p>`;
      }

      createDoc.mutate(
        { title, content: html ? { _html: html } : null },
        {
          onSuccess: (newDoc) => {
            handleSelect(newDoc.id);
          },
        },
      );

      e.target.value = '';
    },
    [createDoc, handleSelect],
  );

  // Build breadcrumb path
  const breadcrumbs = useMemo(() => {
    if (!doc || !listData?.documents) return [];
    const docs = listData.documents;
    const path: { id: string; title: string; icon: string | null }[] = [];
    let currentId: string | null = doc.parentId ?? null;
    while (currentId) {
      const parent = docs.find((d) => d.id === currentId);
      if (parent) {
        path.unshift({ id: parent.id, title: parent.title, icon: parent.icon });
        currentId = parent.parentId;
      } else {
        break;
      }
    }
    return path;
  }, [doc, listData]);

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 48px)',
        width: '100%',
        background: 'var(--color-bg-primary)',
        fontFamily: 'var(--font-family)',
        marginLeft: 56,
        marginTop: 48,
      }}
    >
      <DocSidebar
        selectedId={selectedId}
        onSelect={handleSelect}
        onNewFromTemplate={() => setShowTemplates(true)}
        onImport={() => importInputRef.current?.click()}
      />

      <ContentArea
        headerSlot={
          doc && !showTemplates ? (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <TopBar
                doc={doc}
                breadcrumbs={breadcrumbs}
                isSaving={isSaving}
                onNavigate={handleSelect}
                onShowVersionHistory={() => setShowVersionHistory(true)}
                onOpenSettings={() => navigate(urlForCategory('documents'))}
                showComments={showComments}
                onToggleComments={() => setShowComments(!showComments)}
                visibility={(doc.visibility as 'private' | 'team') || 'private'}
                onVisibilityToggle={(v) => updateVisibility.mutate({ id: doc.id, visibility: v })}
                isOwner={doc.userId === account?.userId}
              />
              <SmartButtonBar appId="docs" recordId={doc.id} />
            </div>
          ) : undefined
        }
        title={!doc || showTemplates ? t('docs.title', 'Write') : undefined}
      >
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'row' }}>
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {showTemplates ? (
              <TemplateGallery
                onSelect={handleCreateFromTemplate}
                onClose={() => setShowTemplates(false)}
              />
            ) : !selectedId ? (
              <div style={{ flex: 1, overflow: 'auto' }}><EmptyState /></div>
            ) : isLoading ? (
              <div style={{ flex: 1, overflow: 'auto' }}><CenterText>{t('common.loading')}</CenterText></div>
            ) : doc ? (
              <div style={{ flex: 1, overflow: 'auto' }}>
                <DocumentView
                  key={doc.id}
                  doc={doc}
                  isSaving={isSaving}
                  onContentChange={handleContentChange}
                  onTitleChange={handleTitleChange}
                  onIconChange={handleIconChange}
                  onCoverChange={handleCoverChange}
                  allDocuments={listData?.documents}
                  onNavigate={handleSelect}
                  allDrawings={drawingListData?.drawings?.map((d) => ({ id: d.id, title: d.title }))}
                />
              </div>
            ) : (
              <div style={{ flex: 1, overflow: 'auto' }}><CenterText>{t('docs.documentNotFound')}</CenterText></div>
            )}
          </div>
          {selectedId && (
            <CommentSidebar docId={selectedId} isOpen={showComments} onClose={() => setShowComments(false)} />
          )}
        </div>
      </ContentArea>

      {/* Version history panel */}
      {showVersionHistory && selectedId && (
        <VersionHistoryPanel
          documentId={selectedId}
          onClose={() => setShowVersionHistory(false)}
          onRestore={handleRestoreVersion}
        />
      )}
      <DocSettingsModal open={showDocSettings} onClose={() => setShowDocSettings(false)} />
      <input
        ref={importInputRef}
        type="file"
        accept=".md,.html,.htm,.docx"
        className="hidden"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />
    </div>
  );
}

// ─── Empty and loading states ───────────────────────────────────────────

function EmptyState() {
  const { t } = useTranslation();
  return (
    <FeatureEmptyState
      illustration="documents"
      title={t('docs.empty.title')}
      description={t('docs.empty.desc')}
      highlights={[
        { icon: <PenTool size={14} />, title: t('docs.empty.h1Title'), description: t('docs.empty.h1Desc') },
        { icon: <Layers size={14} />, title: t('docs.empty.h2Title'), description: t('docs.empty.h2Desc') },
        { icon: <FileText size={14} />, title: t('docs.empty.h3Title'), description: t('docs.empty.h3Desc') },
      ]}
    />
  );
}

function CenterText({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
      {children}
    </div>
  );
}
