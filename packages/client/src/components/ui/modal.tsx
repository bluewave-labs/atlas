import { useState, type CSSProperties, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as VisuallyHidden from '@radix-ui/react-visually-hidden';
import { X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  width?: number | string;
  maxWidth?: number | string;
  height?: number | string;
  zIndex?: number;
  children: ReactNode;
  /** Accessible title for screen readers (rendered visually hidden) */
  title?: string;
  /** Additional inline styles for the content container */
  contentStyle?: React.CSSProperties;
}

function ModalRoot({
  open,
  onOpenChange,
  width = 480,
  maxWidth,
  height,
  zIndex = 200,
  children,
  title,
  contentStyle,
}: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--color-bg-overlay)',
            zIndex,
            animation: 'fadeIn 150ms ease',
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          onPointerDownOutside={(e) => e.preventDefault()}
          style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width,
            maxWidth: maxWidth ?? 'calc(100vw - 48px)',
            ...(height != null
              ? { height, maxHeight: 'calc(100vh - 48px)' }
              : {}),
            background: 'var(--color-bg-elevated)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-elevated)',
            border: '1px solid var(--color-border-primary)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: zIndex + 1,
            animation: 'scaleIn 150ms ease',
            ...contentStyle,
          }}
        >
          <VisuallyHidden.Root>
            <Dialog.Title>{title ?? ''}</Dialog.Title>
          </VisuallyHidden.Root>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Modal.Header
// ---------------------------------------------------------------------------

interface ModalHeaderProps {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}

function ModalHeader({ title, subtitle, children }: ModalHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--spacing-lg) var(--spacing-2xl)',
        borderBottom: '1px solid var(--color-border-primary)',
        flexShrink: 0,
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-family)',
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            style={{
              margin: '4px 0 0',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-family)',
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
        {children}
        <ModalCloseButton />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal.Body
// ---------------------------------------------------------------------------

interface ModalBodyProps {
  children: ReactNode;
  padding?: string;
}

function ModalBody({ children, padding = 'var(--spacing-2xl)' }: ModalBodyProps) {
  return (
    <div
      style={{
        flex: 1,
        overflowY: 'auto',
        padding,
        boxSizing: 'border-box',
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal.Footer
// ---------------------------------------------------------------------------

interface ModalFooterProps {
  children: ReactNode;
}

function ModalFooter({ children }: ModalFooterProps) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 'var(--spacing-sm)',
        padding: 'var(--spacing-lg) var(--spacing-2xl)',
        borderTop: '1px solid var(--color-border-primary)',
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Close button (internal)
// ---------------------------------------------------------------------------

function ModalCloseButton() {
  return (
    <Dialog.Close asChild>
      <button
        aria-label="Close"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          padding: 0,
          background: 'transparent',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          color: 'var(--color-text-tertiary)',
          cursor: 'pointer',
          transition: 'background var(--transition-normal), color var(--transition-normal)',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--color-surface-hover)';
          e.currentTarget.style.color = 'var(--color-text-primary)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--color-text-tertiary)';
        }}
      >
        <X size={18} />
      </button>
    </Dialog.Close>
  );
}

// ---------------------------------------------------------------------------
// ModalSidebarNavButton
// ---------------------------------------------------------------------------

export function ModalSidebarNavButton({
  isActive,
  onClick,
  label,
  icon,
}: {
  isActive: boolean;
  onClick: () => void;
  label: string;
  icon: ReactNode;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-current={isActive ? 'page' : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        width: '100%',
        padding: '7px var(--spacing-md)',
        background: isActive
          ? 'var(--color-surface-selected)'
          : hovered
            ? 'var(--color-surface-hover)'
            : 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        color: isActive ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family)',
        fontWeight: isActive
          ? ('var(--font-weight-medium)' as CSSProperties['fontWeight'])
          : ('var(--font-weight-normal)' as CSSProperties['fontWeight']),
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background var(--transition-normal), color var(--transition-normal)',
        outline: 'none',
        marginBottom: 1,
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          flexShrink: 0,
          color: isActive ? 'var(--color-accent-primary)' : 'currentColor',
        }}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Compound export
// ---------------------------------------------------------------------------

export const Modal = Object.assign(ModalRoot, {
  Header: ModalHeader,
  Body: ModalBody,
  Footer: ModalFooter,
});
