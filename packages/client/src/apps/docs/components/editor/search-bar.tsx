import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { useEditor } from '@tiptap/react';
import type { SearchReplaceState } from '../extensions/search-replace';
import {
  Search,
  Replace,
  X,
  ChevronUp,
  ChevronDown,
  CaseSensitive,
} from 'lucide-react';

// ─── Search & Replace bar ────────────────────────────────────────────────

export function SearchBar({
  editor,
  showReplace,
  onToggleReplace,
  onClose,
}: {
  editor: NonNullable<ReturnType<typeof useEditor>>;
  showReplace: boolean;
  onToggleReplace: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const storage = editor.storage.searchReplace as SearchReplaceState;

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  return (
    <div className="search-replace-bar">
      <div className="search-replace-row">
        <div className="search-replace-input-wrap">
          <Search size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={t('docs.find')}
            className="search-replace-input"
            value={storage.query}
            onChange={(e) => editor.commands.setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) editor.commands.previousMatch();
                else editor.commands.nextMatch();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              }
            }}
          />
        </div>
        <span className="search-replace-count">
          {storage.matchCount > 0
            ? `${storage.activeIndex + 1} / ${storage.matchCount}`
            : storage.query ? t('docs.noResults', { query: storage.query }) : ''}
        </span>
        <button
          className="search-replace-btn"
          title="Case sensitive"
          onClick={() => editor.commands.toggleCaseSensitive()}
          style={{ color: storage.caseSensitive ? 'var(--color-accent-primary, #13715B)' : undefined }}
        >
          <CaseSensitive size={14} />
        </button>
        <button className="search-replace-btn" title="Previous" onClick={() => editor.commands.previousMatch()}>
          <ChevronUp size={14} />
        </button>
        <button className="search-replace-btn" title="Next" onClick={() => editor.commands.nextMatch()}>
          <ChevronDown size={14} />
        </button>
        <button
          className="search-replace-btn"
          title={showReplace ? 'Hide replace' : 'Show replace'}
          onClick={onToggleReplace}
        >
          <Replace size={14} />
        </button>
        <button className="search-replace-btn" title="Close" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      {showReplace && (
        <div className="search-replace-row">
          <div className="search-replace-input-wrap">
            <Replace size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder={t('docs.replace')}
              className="search-replace-input"
              value={storage.replaceText}
              onChange={(e) => editor.commands.setReplaceText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  editor.commands.replaceCurrentMatch();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onClose();
                }
              }}
            />
          </div>
          <button
            className="search-replace-btn search-replace-action"
            onClick={() => editor.commands.replaceCurrentMatch()}
          >
            {t('docs.replaceBtn')}
          </button>
          <button
            className="search-replace-btn search-replace-action"
            onClick={() => editor.commands.replaceAllMatches()}
          >
            {t('docs.replaceAll')}
          </button>
        </div>
      )}
    </div>
  );
}
