import { useRef, useEffect } from 'react';
import { X, ChevronUp, ChevronDown, Replace, ReplaceAll, CaseSensitive } from 'lucide-react';

interface FindReplaceBarProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  replaceTerm: string;
  onReplaceChange: (val: string) => void;
  caseSensitive: boolean;
  onCaseSensitiveToggle: () => void;
  matchCount: number;
  currentIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
}

export function FindReplaceBar({
  searchTerm,
  onSearchChange,
  replaceTerm,
  onReplaceChange,
  caseSensitive,
  onCaseSensitiveToggle,
  matchCount,
  currentIndex,
  onNext,
  onPrev,
  onReplace,
  onReplaceAll,
  onClose,
}: FindReplaceBarProps) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) onPrev();
      else onNext();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleReplaceKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="find-replace-bar">
      <div className="find-replace-row">
        <input
          ref={searchRef}
          className="find-replace-input"
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="Find..."
        />
        <span className="find-replace-count">
          {searchTerm ? `${matchCount > 0 ? currentIndex + 1 : 0}/${matchCount}` : ''}
        </span>
        <button
          className={`find-replace-btn${caseSensitive ? ' active' : ''}`}
          onClick={onCaseSensitiveToggle}
          title="Case sensitive"
        >
          <CaseSensitive size={14} />
        </button>
        <button className="find-replace-btn" onClick={onPrev} disabled={matchCount === 0} title="Previous match">
          <ChevronUp size={14} />
        </button>
        <button className="find-replace-btn" onClick={onNext} disabled={matchCount === 0} title="Next match">
          <ChevronDown size={14} />
        </button>
        <button className="find-replace-btn" onClick={onClose} title="Close">
          <X size={14} />
        </button>
      </div>
      <div className="find-replace-row">
        <input
          className="find-replace-input"
          type="text"
          value={replaceTerm}
          onChange={(e) => onReplaceChange(e.target.value)}
          onKeyDown={handleReplaceKeyDown}
          placeholder="Replace..."
        />
        <button
          className="find-replace-btn"
          onClick={onReplace}
          disabled={matchCount === 0}
          title="Replace"
        >
          <Replace size={14} />
        </button>
        <button
          className="find-replace-btn"
          onClick={onReplaceAll}
          disabled={matchCount === 0}
          title="Replace all"
        >
          <ReplaceAll size={14} />
        </button>
      </div>
    </div>
  );
}
