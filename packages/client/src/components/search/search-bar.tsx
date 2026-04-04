import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search,
  X,
  User,
  AtSign,
  MessageSquare,
  Paperclip,
  Inbox,
  Send,
  Mail,
  Star,
  Clock,
  Calendar,
} from 'lucide-react';
import { useUIStore } from '../../stores/ui-store';

// ---------------------------------------------------------------------------
// Search operator definitions
// ---------------------------------------------------------------------------

interface SearchOperator {
  operator: string;
  description: string;
  example: string;
  icon: typeof Search;
  insertText: string;
}

const SEARCH_OPERATORS: SearchOperator[] = [
  {
    operator: 'from:',
    description: 'search.opFromDesc',
    example: 'from:john@example.com',
    icon: User,
    insertText: 'from:',
  },
  {
    operator: 'to:',
    description: 'search.opToDesc',
    example: 'to:jane@example.com',
    icon: AtSign,
    insertText: 'to:',
  },
  {
    operator: 'subject:',
    description: 'search.opSubjectDesc',
    example: 'subject:"project update"',
    icon: MessageSquare,
    insertText: 'subject:',
  },
  {
    operator: 'has:attachment',
    description: 'search.opHasAttachmentDesc',
    example: 'has:attachment',
    icon: Paperclip,
    insertText: 'has:attachment ',
  },
  {
    operator: 'in:inbox',
    description: 'search.opInInboxDesc',
    example: 'in:inbox',
    icon: Inbox,
    insertText: 'in:inbox ',
  },
  {
    operator: 'in:sent',
    description: 'search.opInSentDesc',
    example: 'in:sent',
    icon: Send,
    insertText: 'in:sent ',
  },
  {
    operator: 'is:unread',
    description: 'search.opIsUnreadDesc',
    example: 'is:unread',
    icon: Mail,
    insertText: 'is:unread ',
  },
  {
    operator: 'is:starred',
    description: 'search.opIsStarredDesc',
    example: 'is:starred',
    icon: Star,
    insertText: 'is:starred ',
  },
  {
    operator: 'newer_than:',
    description: 'search.opNewerThanDesc',
    example: 'newer_than:7d',
    icon: Clock,
    insertText: 'newer_than:',
  },
  {
    operator: 'older_than:',
    description: 'search.opOlderThanDesc',
    example: 'older_than:30d',
    icon: Calendar,
    insertText: 'older_than:',
  },
];

// ---------------------------------------------------------------------------
// Recent searches (server-backed)
// ---------------------------------------------------------------------------

import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';

const MAX_RECENT = 5;

function useRecentSearches() {
  const queryClient = useQueryClient();

  const { data: serverSettings } = useQuery({
    queryKey: queryKeys.settings.all,
    queryFn: async () => {
      const { data } = await api.get('/settings');
      return data.data as Record<string, unknown> | null;
    },
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { data } = await api.put('/settings', patch);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
    },
  });

  const recent: string[] = Array.isArray(serverSettings?.recentSearches)
    ? serverSettings.recentSearches as string[]
    : [];

  const addRecentSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const next = [trimmed, ...recent.filter((s) => s !== trimmed)].slice(0, MAX_RECENT);
    queryClient.setQueryData(queryKeys.settings.all, (old: Record<string, unknown> | null | undefined) => ({
      ...(old ?? {}),
      recentSearches: next,
    }));
    mutation.mutate({ recentSearches: next });
  };

  const clearRecentSearches = () => {
    queryClient.setQueryData(queryKeys.settings.all, (old: Record<string, unknown> | null | undefined) => ({
      ...(old ?? {}),
      recentSearches: [],
    }));
    mutation.mutate({ recentSearches: [] });
  };

  return { recent, addRecentSearch, clearRecentSearches };
}

// ---------------------------------------------------------------------------
// SearchBar component
// ---------------------------------------------------------------------------

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search...',
}: SearchBarProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const { recent: recentSearches, addRecentSearch, clearRecentSearches } = useRecentSearches();
  const { setSearchFocused } = useUIStore();

  // Listen for "/" shortcut event from inbox.tsx
  useEffect(() => {
    const handler = () => inputRef.current?.focus();
    document.addEventListener('atlasmail:focus_search', handler);
    return () => document.removeEventListener('atlasmail:focus_search', handler);
  }, []);

  // Filter operators based on current input
  const filteredOperators = useMemo(() => {
    if (!value.trim()) return SEARCH_OPERATORS;
    const lower = value.toLowerCase();
    // Show operators that match what the user is typing after the last space
    const lastWord = lower.split(/\s+/).pop() || '';
    if (!lastWord) return SEARCH_OPERATORS;
    return SEARCH_OPERATORS.filter(
      (op) => op.operator.startsWith(lastWord) || op.example.toLowerCase().includes(lastWord),
    );
  }, [value]);

  // Build the list of items for the dropdown (recent searches + operators)
  const dropdownItems = useMemo(() => {
    const items: Array<{ type: 'recent'; value: string } | { type: 'operator'; operator: SearchOperator }> = [];

    // Add recent searches when input is empty
    if (!value.trim() && recentSearches.length > 0) {
      for (const search of recentSearches) {
        items.push({ type: 'recent', value: search });
      }
    }

    for (const op of filteredOperators) {
      items.push({ type: 'operator', operator: op });
    }

    return items;
  }, [filteredOperators, recentSearches, value]);

  function handleFocus() {
    setIsFocused(true);
    setSearchFocused(true);
    setShowDropdown(true);
    setHighlightIndex(-1);
  }

  function handleBlur() {
    // Delay to allow click events on dropdown items to fire
    setTimeout(() => {
      setIsFocused(false);
      setSearchFocused(false);
      setShowDropdown(false);
      setHighlightIndex(-1);
    }, 200);
  }

  function handleClear() {
    onChange('');
    inputRef.current?.focus();
  }

  const handleSelectOperator = useCallback(
    (op: SearchOperator) => {
      const currentValue = value.trim();
      // If the user is typing a partial operator, replace it
      const words = currentValue.split(/\s+/);
      const lastWord = words[words.length - 1] || '';
      const isPartialMatch = lastWord && op.operator.startsWith(lastWord.toLowerCase());

      let newValue: string;
      if (isPartialMatch) {
        words[words.length - 1] = op.insertText;
        newValue = words.join(' ');
      } else {
        newValue = currentValue ? `${currentValue} ${op.insertText}` : op.insertText;
      }

      onChange(newValue);
      inputRef.current?.focus();
      // Don't close dropdown when inserting operators that need a value
      if (!op.insertText.endsWith(' ')) {
        setShowDropdown(true);
      }
    },
    [value, onChange],
  );

  const handleSelectRecent = useCallback(
    (search: string) => {
      onChange(search);
      onSubmit?.(search);
      inputRef.current?.focus();
    },
    [onChange, onSubmit],
  );

  const handleClearRecent = useCallback(() => {
    clearRecentSearches();
  }, [clearRecentSearches]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      if (showDropdown && highlightIndex >= 0 && highlightIndex < dropdownItems.length) {
        e.preventDefault();
        const item = dropdownItems[highlightIndex];
        if (item.type === 'operator') {
          handleSelectOperator(item.operator);
        } else {
          handleSelectRecent(item.value);
        }
        return;
      }
      addRecentSearch(value);
      onSubmit?.(value);
      setShowDropdown(false);
    } else if (e.key === 'Escape') {
      if (showDropdown) {
        setShowDropdown(false);
        setHighlightIndex(-1);
      } else {
        onChange('');
        inputRef.current?.blur();
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev < dropdownItems.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : dropdownItems.length - 1,
      );
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && dropdownRef.current) {
      const items = dropdownRef.current.querySelectorAll('[data-dropdown-item]');
      items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  return (
    <div style={{ position: 'relative' }}>
      <div
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          padding: '0 var(--spacing-md)',
          height: '32px',
          background: isFocused ? 'var(--color-bg-elevated)' : 'var(--color-bg-tertiary)',
          border: `1px solid ${isFocused ? 'var(--color-border-focus)' : 'var(--color-border-primary)'}`,
          borderRadius: showDropdown && isFocused ? 'var(--radius-md) var(--radius-md) 0 0' : 'var(--radius-md)',
          transition: 'border-color var(--transition-normal), background var(--transition-normal)',
          gap: 'var(--spacing-sm)',
          boxSizing: 'border-box',
        }}
      >
        <Search
          size={15}
          style={{
            color: isFocused ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)',
            flexShrink: 0,
            transition: 'color var(--transition-normal)',
          }}
        />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowDropdown(true);
            setHighlightIndex(-1);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={t('search.ariaLabel')}
          aria-expanded={showDropdown && isFocused}
          aria-haspopup="listbox"
          autoComplete="off"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-family)',
            minWidth: 0,
          }}
        />

        {/* Clear button or shortcut hint */}
        {value ? (
          <button
            onClick={handleClear}
            aria-label={t('search.clear')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              padding: 0,
              color: 'var(--color-text-tertiary)',
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        ) : (
          !isFocused && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '18px',
                height: '18px',
                background: 'var(--color-bg-tertiary)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: '3px',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-tertiary)',
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              /
            </span>
          )
        )}
      </div>

      {/* Search helper dropdown */}
      {showDropdown && isFocused && dropdownItems.length > 0 && (
        <div
          ref={dropdownRef}
          role="listbox"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 50,
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-focus)',
            borderTop: 'none',
            borderRadius: '0 0 var(--radius-md) var(--radius-md)',
            boxShadow: 'var(--shadow-elevated)',
            maxHeight: 320,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {/* Recent searches section */}
          {!value.trim() && recentSearches.length > 0 && (
            <>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px var(--spacing-md) 4px',
                }}
              >
                <span
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                    color: 'var(--color-text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  {t('search.recentSearches')}
                </span>
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={handleClearRecent}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-tertiary)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-family)',
                    padding: '0 2px',
                  }}
                >
                  {t('search.clearRecent')}
                </button>
              </div>
              {recentSearches.map((search, i) => (
                <div
                  key={`recent-${i}`}
                  data-dropdown-item
                  role="option"
                  aria-selected={highlightIndex === i}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleSelectRecent(search)}
                  onMouseEnter={() => setHighlightIndex(i)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-sm)',
                    padding: '6px var(--spacing-md)',
                    cursor: 'pointer',
                    background: highlightIndex === i ? 'var(--color-surface-hover)' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <Clock
                    size={13}
                    style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}
                  />
                  <span
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-primary)',
                      fontFamily: 'var(--font-family)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {search}
                  </span>
                </div>
              ))}
              <div
                style={{
                  height: 1,
                  background: 'var(--color-border-primary)',
                  margin: '4px var(--spacing-md)',
                }}
              />
            </>
          )}

          {/* Search operators section header */}
          <div
            style={{
              padding: '6px var(--spacing-md) 4px',
            }}
          >
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontFamily: 'var(--font-family)',
              }}
            >
              {t('search.searchOperators')}
            </span>
          </div>

          {/* Operator items */}
          {filteredOperators.map((op, i) => {
            const itemIndex = (!value.trim() ? recentSearches.length : 0) + i;
            return (
              <div
                key={op.operator}
                data-dropdown-item
                role="option"
                aria-selected={highlightIndex === itemIndex}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelectOperator(op)}
                onMouseEnter={() => setHighlightIndex(itemIndex)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                  padding: '7px var(--spacing-md)',
                  cursor: 'pointer',
                  background: highlightIndex === itemIndex ? 'var(--color-surface-hover)' : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                <op.icon
                  size={14}
                  style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}
                />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 'var(--spacing-sm)' }}>
                  <span
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 500,
                      color: 'var(--color-text-primary)',
                      fontFamily: 'var(--font-mono)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {op.operator}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-tertiary)',
                      fontFamily: 'var(--font-family)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t(op.description)}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-quaternary, var(--color-text-tertiary))',
                    fontFamily: 'var(--font-mono)',
                    whiteSpace: 'nowrap',
                    opacity: 0.7,
                  }}
                >
                  {op.example}
                </span>
              </div>
            );
          })}

          {/* Keyboard hint footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-md)',
              padding: '6px var(--spacing-md)',
              borderTop: '1px solid var(--color-border-primary)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-family)',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Kbd>↑</Kbd><Kbd>↓</Kbd> {t('search.toNavigate')}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Kbd>↵</Kbd> {t('search.toSelect')}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Kbd>esc</Kbd> {t('search.toDismiss')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Small keyboard key hint badge
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 18,
        height: 18,
        padding: '0 4px',
        background: 'var(--color-bg-tertiary)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 3,
        fontFamily: 'var(--font-mono)',
        fontSize: '10px',
        color: 'var(--color-text-tertiary)',
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  );
}
