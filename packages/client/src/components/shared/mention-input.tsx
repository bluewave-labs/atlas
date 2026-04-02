import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar } from '../ui/avatar';
import { useAuthStore } from '../../stores/auth-store';
import { useTenantUsers } from '../../hooks/use-platform';
import type { TenantUser } from '@atlasmail/shared';

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onSubmit?: () => void;
  style?: React.CSSProperties;
}

/**
 * A text input that detects @mentions and shows an autocomplete dropdown
 * of tenant members. When a member is selected, inserts @Name into the text.
 */
export function MentionInput({ value, onChange, placeholder, onSubmit, style }: MentionInputProps) {
  const { t } = useTranslation();
  const tenantId = useAuthStore((s) => s.tenantId);
  const { data: tenantUsers } = useTenantUsers(tenantId ?? undefined);

  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter users based on the mention query
  const filteredUsers: TenantUser[] = (tenantUsers ?? []).filter((user) => {
    if (!mentionQuery) return true;
    const q = mentionQuery.toLowerCase();
    const nameMatch = user.name?.toLowerCase().includes(q);
    const emailMatch = user.email.toLowerCase().includes(q);
    return nameMatch || emailMatch;
  }).slice(0, 8);

  // Detect @ trigger and track the mention query
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart ?? newValue.length;
    onChange(newValue);

    // Look backwards from cursor for an @ character
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex >= 0) {
      // Check that @ is at start or preceded by a space
      const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      if (charBefore === ' ' || charBefore === '\n' || lastAtIndex === 0) {
        const query = textBeforeCursor.substring(lastAtIndex + 1);
        // Only show dropdown if query doesn't contain spaces beyond the name pattern
        if (!/\s{2,}/.test(query) && query.length <= 30) {
          setShowDropdown(true);
          setMentionQuery(query);
          setMentionStartIndex(lastAtIndex);
          setSelectedIndex(0);
          return;
        }
      }
    }

    setShowDropdown(false);
    setMentionQuery('');
    setMentionStartIndex(-1);
  }, [onChange]);

  // Insert the selected user's name
  const insertMention = useCallback((user: TenantUser) => {
    const name = user.name || user.email.split('@')[0];
    const before = value.substring(0, mentionStartIndex);
    const after = value.substring(mentionStartIndex + 1 + mentionQuery.length);
    const newValue = `${before}@${name}${after ? after : ' '}`;
    onChange(newValue);
    setShowDropdown(false);
    setMentionQuery('');
    setMentionStartIndex(-1);

    // Refocus the input
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const pos = before.length + 1 + name.length + 1;
        inputRef.current.setSelectionRange(pos, pos);
      }
    }, 0);
  }, [value, mentionStartIndex, mentionQuery, onChange]);

  // Keyboard navigation in the dropdown
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showDropdown && filteredUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredUsers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredUsers.length) % filteredUsers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredUsers[selectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
        return;
      }
    }

    // Normal Enter submits the comment
    if (e.key === 'Enter' && !e.shiftKey && !showDropdown) {
      e.preventDefault();
      onSubmit?.();
    }
  }, [showDropdown, filteredUsers, selectedIndex, insertMention, onSubmit]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    if (showDropdown && dropdownRef.current) {
      const selectedEl = dropdownRef.current.children[selectedIndex] as HTMLElement;
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, showDropdown]);

  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <input
        ref={inputRef}
        style={{
          width: '100%',
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'var(--font-family)',
          padding: '6px var(--spacing-sm)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--color-bg-tertiary)',
          color: 'var(--color-text-primary)',
          outline: 'none',
          ...style,
        }}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || t('mentions.typeToMention')}
      />

      {showDropdown && filteredUsers.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            marginBottom: 4,
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            maxHeight: 200,
            overflowY: 'auto',
            zIndex: 1000,
          }}
        >
          {filteredUsers.map((user, index) => (
            <div
              key={user.userId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-sm)',
                padding: '6px var(--spacing-sm)',
                cursor: 'pointer',
                background: index === selectedIndex ? 'var(--color-surface-hover)' : 'transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault(); // prevent blur
                insertMention(user);
              }}
            >
              <Avatar name={user.name} email={user.email} size={22} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-medium)' as any,
                  color: 'var(--color-text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {user.name || user.email.split('@')[0]}
                </div>
                {user.name && (
                  <div style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-tertiary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {user.email}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
