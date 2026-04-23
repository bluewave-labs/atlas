import { useState, type CSSProperties, type ReactNode } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from './popover';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SelectOption {
  value: string;
  label: string;
  color?: string;
  icon?: ReactNode;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  width?: number | string;
  disabled?: boolean;
  style?: CSSProperties;
}

// ---------------------------------------------------------------------------
// Select
// ---------------------------------------------------------------------------

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  size = 'md',
  width,
  disabled = false,
  style,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  const height = size === 'sm' ? 28 : size === 'lg' ? 40 : 34;
  const isSm = size === 'sm';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--spacing-xs)',
            height,
            padding: '0 var(--spacing-sm)',
            background: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-md)',
            color: selected?.color ?? 'var(--color-text-primary)',
            fontSize: size === 'sm' ? 'var(--font-size-sm)' : size === 'lg' ? 'var(--font-size-lg)' : 'var(--font-size-md)',
            fontWeight: 'var(--font-weight-normal)' as CSSProperties['fontWeight'],
            fontFamily: 'var(--font-family)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxSizing: 'border-box',
            transition: 'border-color var(--transition-normal)',
            width: width ?? '100%',
            opacity: disabled ? 0.6 : 1,
            textAlign: 'left',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            ...style,
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border-focus)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-border-primary)';
          }}
        >
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 4 }}>
            {selected?.icon}
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown
            size={isSm ? 12 : 14}
            style={{
              flexShrink: 0,
              color: 'var(--color-text-tertiary)',
              transition: 'transform var(--transition-normal)',
              transform: open ? 'rotate(180deg)' : 'rotate(0)',
            }}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        style={{
          padding: 'var(--spacing-xs)',
          width: 'max-content',
          minWidth: 'var(--radix-popover-trigger-width)',
          maxHeight: 240,
          overflowY: 'auto',
        }}
      >
        {options.map((opt) => {
          const isSelected = opt.value === value;
          return (
            <SelectItem
              key={opt.value}
              option={opt}
              isSelected={isSelected}
              onSelect={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            />
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// SelectItem
// ---------------------------------------------------------------------------

function SelectItem({
  option,
  isSelected,
  onSelect,
}: {
  option: SelectOption;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        width: '100%',
        padding: '6px var(--spacing-sm)',
        background: isSelected ? 'var(--color-surface-selected)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        color: option.color ?? 'var(--color-text-primary)',
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background var(--transition-fast)',
        outline: 'none',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'var(--color-surface-hover)';
      }}
      onMouseLeave={(e) => {
        if (!isSelected) e.currentTarget.style.background = 'transparent';
      }}
    >
      {option.icon && (
        <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
          {option.icon}
        </span>
      )}
      <span style={{ flex: 1, textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
        {option.label}
      </span>
      {isSelected && (
        <Check
          size={14}
          style={{ flexShrink: 0, color: 'var(--color-accent-primary)' }}
        />
      )}
    </button>
  );
}
