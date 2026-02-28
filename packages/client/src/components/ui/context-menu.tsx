import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// ContextMenu — positioned fixed menu with viewport clamping
// ---------------------------------------------------------------------------

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
  minWidth?: number;
}

export function ContextMenu({ x, y, onClose, children, minWidth }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  // Clamp to viewport
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let newX = x;
    let newY = y;
    if (rect.right > window.innerWidth) newX = window.innerWidth - rect.width - 8;
    if (rect.bottom > window.innerHeight) newY = window.innerHeight - rect.height - 8;
    if (newX < 0) newX = 8;
    if (newY < 0) newY = 8;
    setPos({ x: newX, y: newY });
  }, [x, y]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        left: pos.x,
        top: pos.y,
        ...(minWidth != null ? { minWidth } : {}),
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContextMenuItem
// ---------------------------------------------------------------------------

interface ContextMenuItemProps {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
  active?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}

export function ContextMenuItem({
  icon,
  label,
  onClick,
  destructive,
  active,
  disabled,
  children,
}: ContextMenuItemProps) {
  const className = [
    'context-menu-item',
    active && 'active',
    destructive && 'destructive',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={className} onClick={onClick} disabled={disabled}>
      {icon}
      <span>{label}</span>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// ContextMenuSeparator
// ---------------------------------------------------------------------------

export function ContextMenuSeparator() {
  return <div className="context-menu-separator" />;
}
