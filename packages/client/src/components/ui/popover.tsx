import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';

// ---------------------------------------------------------------------------
// Re-export root and trigger as-is
// ---------------------------------------------------------------------------

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

// ---------------------------------------------------------------------------
// PopoverContent — styled content with standard defaults
// ---------------------------------------------------------------------------

interface PopoverContentProps
  extends Omit<ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>, 'style'> {
  width?: number | string;
  minWidth?: number | string;
  style?: React.CSSProperties;
}

export const PopoverContent = forwardRef<HTMLDivElement, PopoverContentProps>(
  ({ width, minWidth, style, children, sideOffset = 6, ...props }, ref) => (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        sideOffset={sideOffset}
        onOpenAutoFocus={(e) => e.preventDefault()}
        style={{
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          outline: 'none',
          zIndex: 9999,
          ...(width != null ? { width } : {}),
          ...(minWidth != null ? { minWidth } : {}),
          ...style,
        }}
        {...props}
      >
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  ),
);

PopoverContent.displayName = 'PopoverContent';
