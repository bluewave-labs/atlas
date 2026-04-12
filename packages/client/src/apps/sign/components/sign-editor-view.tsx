import { useState, useCallback, useRef, type CSSProperties, type DragEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { PenTool, Send, ArrowLeft, Trash2, Download, Ban, Users, Pencil, Tag, History, BookmarkPlus, ExternalLink, Settings } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { IconButton } from '../../../components/ui/icon-button';
import { Tooltip } from '../../../components/ui/tooltip';
import { Skeleton } from '../../../components/ui/skeleton';
import { Chip } from '../../../components/ui/chip';
import { Popover, PopoverTrigger, PopoverContent } from '../../../components/ui/popover';
import { PdfViewer } from './pdf-viewer';
import { FieldOverlay } from './field-overlay';
import { SignerPanel } from './signer-panel';
import { FieldPropertiesPanel } from './field-properties-panel';
import { SignFieldToolbar } from './sign-field-toolbar';
import { SmartButtonBar } from '../../../components/shared/SmartButtonBar';
import { STATUS_BADGE_MAP } from '../lib/helpers';
import { useAppActions } from '../../../hooks/use-app-permissions';
import { useAuthStore } from '../../../stores/auth-store';
import type { SignatureDocument, SignatureFieldType, SignatureField } from '@atlas-platform/shared';
import type { Signer } from './signer-panel';

export function SignEditorView({
  selectedDoc,
  fields,
  pdfUrl,
  uploading,
  selectedFieldId,
  selectedField,
  signers,
  activeSignerIndex,
  allFieldsAssigned,
  pageThumbnails,
  activePageNumber,
  scrollToPage,
  // State setters
  onSetSelectedFieldId,
  onSetActiveSignerIndex,
  onSetSigners,
  onSetActivePageNumber,
  onSetScrollToPage,
  onSetPageThumbnails,
  // Handlers
  onBackToList,
  onDownload,
  onRequestDelete,
  onVoidOpen,
  onAuditView,
  onSaveAsTemplate,
  onSignersModalOpen,
  onSendModalOpen,
  onSignNowClick,
  onAddField,
  onFieldMove,
  onFieldResize,
  onFieldClick,
  onFieldDelete,
  onFieldPropertyUpdate,
  onUpdateDoc,
}: {
  selectedDoc: SignatureDocument;
  fields: SignatureField[] | undefined;
  pdfUrl: string | undefined;
  uploading: boolean;
  selectedFieldId: string | undefined;
  selectedField: SignatureField | null;
  signers: Signer[];
  activeSignerIndex: number | null;
  allFieldsAssigned: boolean;
  pageThumbnails: Array<{ page: number; dataUrl: string; width: number; height: number }>;
  activePageNumber: number;
  scrollToPage: number | null;
  onSetSelectedFieldId: (id: string | undefined) => void;
  onSetActiveSignerIndex: (idx: number | null) => void;
  onSetSigners: (signers: Signer[]) => void;
  onSetActivePageNumber: (page: number) => void;
  onSetScrollToPage: (page: number | null) => void;
  onSetPageThumbnails: (thumbs: Array<{ page: number; dataUrl: string; width: number; height: number }>) => void;
  onBackToList: () => void;
  onDownload: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onVoidOpen: () => void;
  onAuditView: () => void;
  onSaveAsTemplate: () => void;
  onSignersModalOpen: () => void;
  onSendModalOpen: () => void;
  onSignNowClick: (fieldId: string) => void;
  onAddField: (type: SignatureFieldType, pageNumber?: number, x?: number, y?: number) => void;
  onFieldMove: (id: string, x: number, y: number) => void;
  onFieldResize: (id: string, width: number, height: number) => void;
  onFieldClick: (id: string) => void;
  onFieldDelete: (id: string) => void;
  onFieldPropertyUpdate: (data: Partial<SignatureField>) => void;
  onUpdateDoc: (data: Partial<SignatureDocument>) => void;
}) {
  const { t } = useTranslation();
  const { canEdit, canDelete, canDeleteOwn } = useAppActions('sign');
  const { account } = useAuthStore();
  const isOwner = !!account && selectedDoc.userId === account.userId;
  const canDeleteDoc = canDelete || (canDeleteOwn && isOwner);
  const pdfContentRef = useRef<HTMLDivElement>(null);

  // Inline title editing
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  // Tags
  const [addingTag, setAddingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  // Document settings popover
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Handle drop from toolbar onto a PDF page
  const handlePageDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (!canEdit) return;
      const fieldType = e.dataTransfer.getData('application/sign-field-type') as SignatureFieldType;
      if (!fieldType) return;

      const pdfContent = pdfContentRef.current;
      if (!pdfContent) return;

      const pageElements = pdfContent.querySelectorAll('[id^="sign-page-"]');
      let targetPage = 1;
      let relX = 25;
      let relY = 40;

      for (const pageEl of pageElements) {
        const rect = pageEl.getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          const pageNum = parseInt(pageEl.id.replace('sign-page-', ''), 10);
          if (!isNaN(pageNum)) {
            targetPage = pageNum;
            const imgEl = pageEl.querySelector('img');
            if (imgEl) {
              const imgRect = imgEl.getBoundingClientRect();
              relX = ((e.clientX - imgRect.left) / imgRect.width) * 100;
              relY = ((e.clientY - imgRect.top) / imgRect.height) * 100;
              relX = Math.max(0, Math.min(80, relX));
              relY = Math.max(0, Math.min(90, relY));
            }
          }
          break;
        }
      }

      onAddField(fieldType, targetPage, relX, relY);
    },
    [onAddField, canEdit],
  );

  const handlePageDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  return (
    <>
      {/* Editor toolbar */}
      <div className="sign-toolbar">
        <div className="sign-toolbar-left">
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={onBackToList}>
            {t('sign.editor.back')}
          </Button>
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (titleDraft.trim() && titleDraft.trim() !== selectedDoc.title) {
                    onUpdateDoc({ title: titleDraft.trim() });
                  }
                  setEditingTitle(false);
                }
                if (e.key === 'Escape') {
                  setEditingTitle(false);
                }
              }}
              onBlur={() => {
                if (titleDraft.trim() && titleDraft.trim() !== selectedDoc.title) {
                  onUpdateDoc({ title: titleDraft.trim() });
                }
                setEditingTitle(false);
              }}
              style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-family)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-sm)',
                padding: '2px 6px',
                outline: 'none',
                background: 'var(--color-bg-primary)',
                maxWidth: 240,
              }}
            />
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                color: 'var(--color-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: canEdit ? 'pointer' : 'default',
              }}
              onClick={() => { if (!canEdit) return; setTitleDraft(selectedDoc.title); setEditingTitle(true); }}
            >
              {selectedDoc.title}
              {canEdit && <Pencil size={12} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />}
            </span>
          )}
          <Badge variant={STATUS_BADGE_MAP[selectedDoc.status] ?? 'default'}>
            {selectedDoc.status}
          </Badge>
        </div>
        <div className="sign-toolbar-right">
          <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
            <PopoverTrigger asChild>
              <IconButton
                icon={<Settings size={14} />}
                label={t('sign.editor.settingsTitle')}
                size={28}
              />
            </PopoverTrigger>
            <PopoverContent width={340} align="start" side="bottom">
              <div style={{ padding: 'var(--spacing-md)' }}>
                {/* Tags section */}
                <div style={{ marginBottom: 'var(--spacing-md)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'], color: 'var(--color-text-secondary)' }}>
                    <Tag size={12} />
                    {t('sign.editor.tagsLabel')}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(selectedDoc.tags ?? []).map((tag) => (
                      <Chip
                        key={tag}
                        color="#8b5cf6"
                        onRemove={() => {
                          const next = (selectedDoc.tags ?? []).filter((tg) => tg !== tag);
                          onUpdateDoc({ tags: next });
                        }}
                      >
                        {tag}
                      </Chip>
                    ))}
                    {addingTag ? (
                      <input
                        autoFocus
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && tagDraft.trim()) {
                            const current = selectedDoc.tags ?? [];
                            if (!current.includes(tagDraft.trim())) {
                              onUpdateDoc({ tags: [...current, tagDraft.trim()] });
                            }
                            setTagDraft('');
                            setAddingTag(false);
                          }
                          if (e.key === 'Escape') {
                            setTagDraft('');
                            setAddingTag(false);
                          }
                        }}
                        onBlur={() => {
                          if (tagDraft.trim()) {
                            const current = selectedDoc.tags ?? [];
                            if (!current.includes(tagDraft.trim())) {
                              onUpdateDoc({ tags: [...current, tagDraft.trim()] });
                            }
                          }
                          setTagDraft('');
                          setAddingTag(false);
                        }}
                        placeholder={t('sign.editor.tagPlaceholder')}
                        style={{
                          fontSize: 'var(--font-size-xs)',
                          fontFamily: 'var(--font-family)',
                          border: '1px solid var(--color-border-primary)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '2px 6px',
                          outline: 'none',
                          background: 'var(--color-bg-primary)',
                          width: 100,
                          height: 22,
                        }}
                      />
                    ) : (
                      <Chip onClick={() => setAddingTag(true)} color="#6b7280">
                        + {t('sign.editor.addTag')}
                      </Chip>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'var(--color-border-secondary)', margin: 'var(--spacing-sm) 0' }} />

                {/* Redirect URL section */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--spacing-sm)', fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'], color: 'var(--color-text-secondary)' }}>
                    <ExternalLink size={12} />
                    {t('sign.editor.redirectUrl')}
                  </div>
                  <Input
                    placeholder={t('sign.editor.redirectUrlPlaceholder')}
                    value={selectedDoc.redirectUrl ?? ''}
                    onChange={(e) => onUpdateDoc({ redirectUrl: e.target.value || null })}
                    size="sm"
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <IconButton
            icon={<History size={14} />}
            label={t('sign.audit.title')}
            size={28}
            onClick={onAuditView}
          />
          {canEdit && (
            <IconButton
              icon={<BookmarkPlus size={14} />}
              label={t('sign.templates.saveAsTemplate')}
              size={28}
              onClick={onSaveAsTemplate}
            />
          )}
          <IconButton
            icon={<Users size={14} />}
            label={t('sign.editor.manageSigners')}
            size={28}
            onClick={onSignersModalOpen}
          />
          <IconButton
            icon={<Download size={14} />}
            label={t('sign.editor.downloadPdf')}
            size={28}
            onClick={() => onDownload(selectedDoc.id)}
          />
          {canDeleteDoc && (
            <IconButton
              icon={<Trash2 size={14} />}
              label={t('sign.editor.deleteDocument')}
              size={28}
              destructive
              onClick={() => onRequestDelete(selectedDoc.id)}
            />
          )}
          {canEdit && selectedDoc.status === 'pending' && (
            <IconButton
              icon={<Ban size={14} />}
              label={t('sign.editor.voidDocument')}
              size={28}
              destructive
              onClick={onVoidOpen}
            />
          )}
          <div style={{ width: 1, height: 20, background: 'var(--color-border-primary)' }} />
          {canEdit && (
            <Tooltip content={!allFieldsAssigned && fields && fields.length > 0 ? t('sign.editor.assignAllFields') : undefined}>
              <Button
                variant="secondary"
                size="sm"
                icon={<Send size={14} />}
                onClick={onSendModalOpen}
                disabled={!allFieldsAssigned && fields != null && fields.length > 0}
              >
                {t('sign.editor.sendForSigning')}
                {signers.filter((s) => s.email.trim()).length > 0 && (
                  <span style={{ marginLeft: 4, fontSize: 'var(--font-size-xs)', opacity: 0.7 }}>
                    ({signers.filter((s) => s.email.trim()).length})
                  </span>
                )}
              </Button>
            </Tooltip>
          )}
          <Button
            variant="primary"
            size="sm"
            icon={<PenTool size={14} />}
            onClick={() => {
              if (fields && fields.length > 0) {
                const firstUnsigned = fields.find((f) => !f.signatureData);
                if (firstUnsigned) {
                  onSignNowClick(firstUnsigned.id);
                }
              }
            }}
          >
            {t('sign.editor.signNow')}
          </Button>
        </div>
      </div>

      <SmartButtonBar appId="sign" recordId={selectedDoc.id} />

      {/* Field toolbar (vertical) + Page thumbnails + PDF viewer + Right sidebar */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {canEdit && <SignFieldToolbar onAddField={(type) => onAddField(type, activePageNumber)} />}

        {/* Page thumbnails sidebar */}
        {pageThumbnails.length > 1 && (
          <div className="sign-page-thumbnails">
            {pageThumbnails.map((thumb) => (
              <button
                key={thumb.page}
                className={`sign-page-thumbnail${activePageNumber === thumb.page ? ' sign-page-thumbnail--active' : ''}`}
                onClick={() => {
                  onSetActivePageNumber(thumb.page);
                  onSetScrollToPage(thumb.page);
                  setTimeout(() => onSetScrollToPage(null), 100);
                }}
              >
                <img
                  src={thumb.dataUrl}
                  alt={`Page ${thumb.page}`}
                  style={{ width: '100%', height: 'auto', display: 'block', borderRadius: 2 }}
                  draggable={false}
                />
                <span className="sign-page-thumbnail-label">{thumb.page}</span>
              </button>
            ))}
          </div>
        )}

        {/* PDF viewer + field overlay */}
        <div
          className="sign-content"
          ref={pdfContentRef}
          onDrop={handlePageDrop}
          onDragOver={handlePageDragOver}
        >
          {uploading ? (
            <div className="sign-upload-feedback">
              <Skeleton width={120} height={120} borderRadius="var(--radius-lg)" />
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 'var(--spacing-md)' }}>
                {t('sign.editor.uploading')}
              </span>
            </div>
          ) : pdfUrl ? (
            <>
              <div style={{ position: 'relative' }}>
                {(!fields || fields.length === 0) && (
                  <div className="sign-hint-banner">
                    <PenTool size={14} />
                    <span>{t('sign.editor.dragFieldsHint')}</span>
                  </div>
                )}
                <PdfViewer
                  url={pdfUrl}
                  scale={1.5}
                  scrollToPage={scrollToPage}
                  onPageImages={(images) => onSetPageThumbnails(images)}
                  onPageCount={(count) => {
                    if (selectedDoc.pageCount !== count) {
                      onUpdateDoc({ pageCount: count });
                    }
                  }}
                  renderOverlay={(pageNumber, pageWidth, pageHeight) => (
                    <FieldOverlay
                      fields={fields ?? []}
                      pageNumber={pageNumber}
                      pageWidth={pageWidth}
                      pageHeight={pageHeight}
                      onFieldMove={onFieldMove}
                      onFieldResize={onFieldResize}
                      onFieldClick={onFieldClick}
                      onFieldDelete={onFieldDelete}
                      selectedFieldId={selectedFieldId}
                      editable={canEdit}
                    />
                  )}
                />
              </div>
            </>
          ) : null}
        </div>

        {/* Right sidebar: signer panel + field properties */}
        <div className="sign-right-sidebar">
          <SignerPanel
            signers={signers}
            onSignersChange={onSetSigners}
            activeSignerIndex={activeSignerIndex}
            onActiveSignerChange={onSetActiveSignerIndex}
          />
          {canEdit && selectedField && (
            <>
              <div className="sign-right-sidebar-divider" />
              <FieldPropertiesPanel
                field={selectedField}
                signers={signers}
                onUpdateField={onFieldPropertyUpdate}
                onDeleteField={() => onFieldDelete(selectedField.id)}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
}
