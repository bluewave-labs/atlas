import { useState, useRef, useEffect } from 'react';

interface EditableFieldProps {
  label: string;
  value: string;
  onSave: (val: string) => void;
  type?: 'text' | 'number' | 'date';
  suffix?: string;
}

export function EditableField({ label, value, onSave, type = 'text', suffix }: EditableFieldProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setEditValue(value); }, [value]);
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);

  const handleSave = () => {
    setEditing(false);
    if (editValue !== value) onSave(editValue);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{
        fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)',
        fontWeight: 'var(--font-weight-medium)', textTransform: 'uppercase',
        letterSpacing: '0.04em', fontFamily: 'var(--font-family)',
      }}>
        {label}
      </span>
      {editing ? (
        <input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setEditValue(value); setEditing(false); } }}
          style={{
            padding: '4px 6px', border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-family)', background: 'var(--color-bg-primary)',
            color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box',
          }}
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          style={{
            fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-family)', cursor: 'text',
            padding: '4px 0', minHeight: 24, display: 'flex', alignItems: 'center',
          }}
        >
          {value || '-'}{suffix || ''}
        </span>
      )}
    </div>
  );
}
