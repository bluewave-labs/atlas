import type { ReactNode, CSSProperties } from 'react';
import type { EmailCategory } from '@atlasmail/shared';
import { Chip } from './chip';

// Category-specific badge
interface CategoryBadgeProps {
  category: EmailCategory;
}

const CATEGORY_LABELS: Record<EmailCategory, string> = {
  all: 'All mail',
  important: 'Important',
  other: 'Other',
  newsletters: 'Newsletters',
  notifications: 'Notifications',
};

const CATEGORY_COLORS: Record<EmailCategory, string> = {
  all: 'var(--color-category-important)',
  important: 'var(--color-category-important)',
  other: 'var(--color-category-other)',
  newsletters: 'var(--color-category-newsletters)',
  notifications: 'var(--color-category-notifications)',
};

export function CategoryBadge({ category }: CategoryBadgeProps) {
  const color = CATEGORY_COLORS[category];

  return (
    <Chip
      color={color}
      height={18}
      style={{
        padding: '0 var(--spacing-xs)',
        fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
      }}
    >
      {CATEGORY_LABELS[category]}
    </Chip>
  );
}

// Generic badge
interface BadgeProps {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
  children: ReactNode;
}

const VARIANT_COLORS: Record<NonNullable<BadgeProps['variant']>, string | undefined> = {
  default: undefined,
  primary: 'var(--color-accent-primary)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)',
};

export function Badge({ variant = 'default', children }: BadgeProps) {
  const color = VARIANT_COLORS[variant];

  return (
    <Chip
      color={color}
      height={20}
      style={{
        padding: '0 var(--spacing-xs)',
        fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
        // Default variant uses elevated bg instead of color-mix
        ...(variant === 'default' && {
          background: 'var(--color-bg-elevated)',
          color: 'var(--color-text-secondary)',
          borderColor: 'var(--color-border-primary)',
        }),
      }}
    >
      {children}
    </Chip>
  );
}
