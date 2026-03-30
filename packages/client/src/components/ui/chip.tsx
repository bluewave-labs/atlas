import { useState, type ReactNode, type CSSProperties } from 'react';
import { X } from 'lucide-react';

export const CHIP_RADIUS = 'var(--radius-lg)';

export interface ChipProps {
  children: ReactNode;
  /** Optional color — drives background tint, border, and text */
  color?: string;
  /** Show a remove (X) button */
  onRemove?: () => void;
  /** Click handler (makes the chip a button) */
  onClick?: () => void;
  /** Active / selected state */
  active?: boolean;
  /** Chip height in px */
  height?: number;
  /** Extra inline styles */
  style?: CSSProperties;
  /** Accessible label override */
  'aria-label'?: string;
  /** aria-pressed for toggle chips */
  'aria-pressed'?: boolean;
  title?: string;
}

export function Chip({
  children,
  color,
  onRemove,
  onClick,
  active = false,
  height = 22,
  style,
  title,
  ...ariaProps
}: ChipProps) {
  const [removeHovered, setRemoveHovered] = useState(false);

  const background = color
    ? `color-mix(in srgb, ${color} ${active ? '14%' : '12%'}, transparent)`
    : active
      ? 'color-mix(in srgb, var(--color-accent-primary) 10%, transparent)'
      : 'transparent';

  const borderColor = color
    ? `color-mix(in srgb, ${color} 30%, transparent)`
    : active
      ? 'var(--color-accent-primary)'
      : 'var(--color-border-primary)';

  const textColor = color
    ? color
    : active
      ? 'var(--color-accent-primary)'
      : 'var(--color-text-secondary)';

  const baseStyles: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    height,
    padding: onRemove ? '0 6px 0 8px' : '0 8px',
    background,
    border: `1px solid ${borderColor}`,
    borderRadius: CHIP_RADIUS,
    fontSize: 'var(--font-size-xs)',
    fontFamily: 'var(--font-family)',
    fontWeight: (active ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)') as CSSProperties['fontWeight'],
    color: textColor,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    cursor: onClick ? 'pointer' : undefined,
    transition: 'all var(--transition-normal)',
    ...style,
  };

  const Tag = onClick ? 'button' : 'span';

  return (
    <Tag
      onClick={onClick}
      title={title}
      style={Tag === 'button' ? { ...baseStyles, lineHeight: 1 } : baseStyles}
      {...ariaProps}
    >
      {children}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          onMouseEnter={() => setRemoveHovered(true)}
          onMouseLeave={() => setRemoveHovered(false)}
          aria-label="Remove"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: textColor,
            opacity: removeHovered ? 1 : 0.7,
            lineHeight: 1,
            transition: 'opacity var(--transition-normal)',
          }}
        >
          <X size={11} />
        </button>
      )}
    </Tag>
  );
}
