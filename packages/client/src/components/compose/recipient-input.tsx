import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type CSSProperties,
} from 'react';
import { MOCK_CONTACTS, type Recipient } from '../../lib/mock-contacts';
import { Chip } from '../ui/chip';

// ─── Helpers ──────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value.trim());
}

function searchContacts(query: string, existing: Recipient[]): Recipient[] {
  if (!query.trim()) return [];
  const lower = query.toLowerCase();
  const existingAddresses = new Set(existing.map((r) => r.address.toLowerCase()));

  return MOCK_CONTACTS.filter((contact) => {
    if (existingAddresses.has(contact.address.toLowerCase())) return false;
    return (
      contact.address.toLowerCase().includes(lower) ||
      (contact.name?.toLowerCase().includes(lower) ?? false)
    );
  }).slice(0, 5);
}

// ─── Recipient chip ───────────────────────────────────────────────────

interface RecipientChipProps {
  recipient: Recipient;
  onRemove: () => void;
}

function RecipientChip({ recipient, onRemove }: RecipientChipProps) {
  const label = recipient.name || recipient.address;

  return (
    <Chip
      onRemove={onRemove}
      height={24}
      title={`${label} <${recipient.address}>`}
      aria-label={`Remove ${label}`}
      style={{ maxWidth: 200, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)' }}
    >
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 150,
        }}
      >
        {label}
      </span>
    </Chip>
  );
}

// ─── Suggestion item ──────────────────────────────────────────────────

interface SuggestionItemProps {
  contact: Recipient;
  isHighlighted: boolean;
  onMouseEnter: () => void;
  onMouseDown: () => void;
}

function SuggestionItem({ contact, isHighlighted, onMouseEnter, onMouseDown }: SuggestionItemProps) {
  return (
    <div
      role="option"
      aria-selected={isHighlighted}
      onMouseEnter={onMouseEnter}
      onMouseDown={onMouseDown}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1px',
        padding: 'var(--spacing-sm) var(--spacing-md)',
        cursor: 'pointer',
        background: isHighlighted ? 'var(--color-surface-hover)' : 'transparent',
        transition: 'background var(--transition-normal)',
      }}
    >
      {contact.name && (
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-family)',
            fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
          }}
        >
          {contact.name}
        </span>
      )}
      <span
        style={{
          fontSize: 'var(--font-size-sm)',
          color: contact.name ? 'var(--color-text-tertiary)' : 'var(--color-text-primary)',
          fontFamily: 'var(--font-family)',
        }}
      >
        {contact.address}
      </span>
    </div>
  );
}

// ─── Recipient input ──────────────────────────────────────────────────

export interface RecipientInputProps {
  label: string;
  recipients: Recipient[];
  onChange: (recipients: Recipient[]) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export function RecipientInput({
  label,
  recipients,
  onChange,
  placeholder = 'Add recipients',
  autoFocus = false,
}: RecipientInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<Recipient[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-focus the internal input on mount when requested
  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update suggestions whenever the query changes
  useEffect(() => {
    const results = searchContacts(inputValue, recipients);
    setSuggestions(results);
    setHighlightedIndex(-1);
    setDropdownOpen(results.length > 0 && inputValue.trim().length > 0);
  }, [inputValue, recipients]);

  const addRecipient = useCallback(
    (recipient: Recipient) => {
      onChange([...recipients, recipient]);
      setInputValue('');
      setSuggestions([]);
      setDropdownOpen(false);
      setHighlightedIndex(-1);
      inputRef.current?.focus();
    },
    [recipients, onChange],
  );

  const removeRecipient = useCallback(
    (index: number) => {
      onChange(recipients.filter((_, i) => i !== index));
    },
    [recipients, onChange],
  );

  const commitInputValue = useCallback(
    (value: string) => {
      const trimmed = value.trim().replace(/,$/, '').trim();
      if (!trimmed) return false;
      if (isValidEmail(trimmed)) {
        // Check if already in the list
        if (!recipients.some((r) => r.address.toLowerCase() === trimmed.toLowerCase())) {
          // See if it matches a known contact for the name
          const knownContact = MOCK_CONTACTS.find(
            (c) => c.address.toLowerCase() === trimmed.toLowerCase(),
          );
          addRecipient(knownContact ?? { address: trimmed });
        } else {
          setInputValue('');
        }
        return true;
      }
      return false;
    },
    [recipients, addRecipient],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      const hasDropdown = dropdownOpen && suggestions.length > 0;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (hasDropdown) {
          setHighlightedIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (hasDropdown) {
          setHighlightedIndex((prev) => Math.max(prev - 1, -1));
        }
        return;
      }

      if (e.key === 'Escape') {
        setDropdownOpen(false);
        setHighlightedIndex(-1);
        return;
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        if (hasDropdown && highlightedIndex >= 0) {
          e.preventDefault();
          addRecipient(suggestions[highlightedIndex]);
          return;
        }
        if (e.key === 'Enter' && inputValue.trim()) {
          e.preventDefault();
          // Try to pick from suggestions if there's an exact or first match
          if (suggestions.length > 0 && highlightedIndex === -1) {
            addRecipient(suggestions[0]);
            return;
          }
          commitInputValue(inputValue);
          return;
        }
        if (e.key === 'Tab' && inputValue.trim()) {
          commitInputValue(inputValue);
          // Don't prevent default for Tab so focus moves naturally when nothing committed
        }
        return;
      }

      if ((e.key === ',' || e.key === ';') && inputValue.trim()) {
        e.preventDefault();
        commitInputValue(inputValue);
        return;
      }

      if (e.key === 'Backspace' && inputValue === '' && recipients.length > 0) {
        removeRecipient(recipients.length - 1);
      }
    },
    [
      dropdownOpen,
      suggestions,
      highlightedIndex,
      inputValue,
      addRecipient,
      commitInputValue,
      removeRecipient,
    ],
  );

  const handleBlur = useCallback(() => {
    // Small delay to allow mousedown on suggestions to fire first
    setTimeout(() => {
      commitInputValue(inputValue);
      setDropdownOpen(false);
      setHighlightedIndex(-1);
    }, 150);
  }, [inputValue, commitInputValue]);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 'var(--spacing-sm)',
        padding: 'var(--spacing-sm) var(--spacing-lg)',
        borderBottom: '1px solid var(--color-border-primary)',
        position: 'relative',
        minHeight: 40,
      }}
    >
      {/* Label */}
      <span
        style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-family)',
          width: 28,
          flexShrink: 0,
          paddingTop: 5,
          lineHeight: 'var(--line-height-normal)',
        }}
      >
        {label}
      </span>

      {/* Chips + input area */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          flex: 1,
          minWidth: 0,
          paddingTop: 2,
          paddingBottom: 2,
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {recipients.map((recipient, index) => (
          <RecipientChip
            key={`${recipient.address}-${index}`}
            recipient={recipient}
            onRemove={() => removeRecipient(index)}
          />
        ))}

        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={() => {
            if (inputValue.trim() && suggestions.length > 0) {
              setDropdownOpen(true);
            }
          }}
          placeholder={recipients.length === 0 ? placeholder : ''}
          aria-label={label}
          aria-autocomplete="list"
          aria-expanded={dropdownOpen}
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: '1 1 80px',
            minWidth: 80,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-size-md)',
            fontFamily: 'var(--font-family)',
            padding: '2px 0',
            lineHeight: 'var(--line-height-normal)',
          }}
        />
      </div>

      {/* Suggestions dropdown */}
      {dropdownOpen && suggestions.length > 0 && (
        <div
          role="listbox"
          aria-label={`${label} suggestions`}
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 100,
            overflow: 'hidden',
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          {suggestions.map((contact, index) => (
            <SuggestionItem
              key={contact.address}
              contact={contact}
              isHighlighted={index === highlightedIndex}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseDown={() => addRecipient(contact)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
