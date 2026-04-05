import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SmilePlus,
  ImageIcon,
  X,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { IconButton } from '../../../components/ui/icon-button';
import { DocEditor } from './doc-editor';
import { EmojiPicker } from '../../../components/shared/emoji-picker';
import { CoverPicker, isCoverGradient } from '../../../components/shared/cover-picker';
import { BacklinksSection } from './backlinks-section';
import { useDocSettingsStore } from '../settings-store';

// ─── Document view with inline title, cover, icon ───────────────────────

interface DocumentViewProps {
  doc: {
    id: string;
    title: string;
    content: Record<string, unknown> | null;
    icon: string | null;
    coverImage?: string | null;
    parentId?: string | null;
  };
  isSaving: boolean;
  onContentChange: (content: Record<string, unknown>) => void;
  onTitleChange: (title: string) => void;
  onIconChange: (icon: string | null) => void;
  onCoverChange: (coverImage: string | null) => void;
  /** All documents for @ mention picker */
  allDocuments?: Array<{ id: string; title: string; icon: string | null }>;
  onNavigate?: (docId: string) => void;
  /** All drawings for embed picker */
  allDrawings?: Array<{ id: string; title: string }>;
  /** All tables for embed picker */
  allTables?: Array<{ id: string; title: string }>;
}

export function DocumentView({
  doc,
  isSaving,
  onContentChange,
  onTitleChange,
  onIconChange,
  onCoverChange,
  allDocuments,
  onNavigate,
  allDrawings,
  allTables,
}: DocumentViewProps) {
  const { t } = useTranslation();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const docFullWidth = useDocSettingsStore((s) => s.fullWidth);

  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = 'auto';
      titleRef.current.style.height = titleRef.current.scrollHeight + 'px';
    }
  }, [doc.title]);

  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      {/* Cover image or gradient */}
      {doc.coverImage && (
        <div className="doc-cover-image" style={{ position: 'relative' }}>
          {isCoverGradient(doc.coverImage) ? (
            <div style={{ width: '100%', height: '100%', background: doc.coverImage }} />
          ) : (
            <img src={doc.coverImage} alt="" />
          )}
          <div className="doc-cover-image-actions">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowCoverPicker(true)}
              style={{
                background: 'var(--color-bg-elevated)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border-secondary)',
                fontSize: 12,
              }}
            >
              {t('docs.changeCover')}
            </Button>
            <IconButton
              icon={<X size={12} />}
              label={t('docs.removeCover')}
              size={26}
              onClick={() => onCoverChange(null)}
              style={{
                background: 'var(--color-bg-elevated)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border-secondary)',
              }}
            />
          </div>
        </div>
      )}

      {/* Header area */}
      <div
        className="doc-header"
        style={{
          maxWidth: docFullWidth ? '100%' : 800,
          margin: '0 auto',
          width: '100%',
          padding: doc.coverImage ? '24px 24px 0' : '80px 24px 0',
          transition: 'max-width 0.2s ease',
        }}
      >
        {/* Icon */}
        {doc.icon && (
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: 8 }}>
            <IconButton
              icon={<span style={{ fontSize: 48, lineHeight: 1 }}>{doc.icon}</span>}
              label={t('docs.changeIcon')}
              size={56}
              tooltip
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              style={{ borderRadius: 8 }}
            />
            {showEmojiPicker && (
              <EmojiPicker
                onSelect={(emoji) => { onIconChange(emoji); setShowEmojiPicker(false); }}
                onRemove={() => { onIconChange(null); setShowEmojiPicker(false); }}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>
        )}

        {/* Meta action buttons */}
        <div className="doc-meta-actions">
          {!doc.icon && (
            <div style={{ position: 'relative' }}>
              <button className="doc-meta-action-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                <SmilePlus size={14} />
                {t('docs.addIcon')}
              </button>
              {showEmojiPicker && (
                <EmojiPicker
                  onSelect={(emoji) => { onIconChange(emoji); setShowEmojiPicker(false); }}
                  onRemove={() => { onIconChange(null); setShowEmojiPicker(false); }}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
            </div>
          )}
          {!doc.coverImage && (
            <button className="doc-meta-action-btn" onClick={() => setShowCoverPicker(!showCoverPicker)}>
              <ImageIcon size={14} />
              {t('docs.addCover')}
            </button>
          )}
        </div>

        {/* Inline title */}
        <textarea
          ref={titleRef}
          className="doc-inline-title"
          value={doc.title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder={t('docs.untitled')}
          rows={1}
          style={{ resize: 'none' }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const editorEl = document.querySelector('.doc-editor-content') as HTMLElement;
              if (editorEl) editorEl.focus();
            }
          }}
        />

        <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 8, visibility: isSaving ? 'visible' : 'hidden' }}>
          {t('docs.saving')}
        </div>
      </div>

      <DocEditor
        key={doc.id}
        value={doc.content}
        onChange={onContentChange}
        documents={allDocuments}
        onNavigate={onNavigate}
        drawings={allDrawings}
        tables={allTables}
      />

      <BacklinksSection docId={doc.id} />

      {showCoverPicker && (
        <CoverPicker
          onSelect={(url) => { onCoverChange(url); setShowCoverPicker(false); }}
          onClose={() => setShowCoverPicker(false)}
        />
      )}
    </div>
  );
}
