import { useState, useCallback, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ResizeHandle } from '../ui/resize-handle';
import { ROUTES } from '../../config/routes';
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function readStoredWidth(key: string): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return clamp(Number(raw), MIN_WIDTH, MAX_WIDTH);
  } catch { /* ignore */ }
  return DEFAULT_WIDTH;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AppSidebarProps {
  /** localStorage key for persisting width, e.g. 'atlas_docs_sidebar' */
  storageKey: string;

  /** App title shown in the header */
  title: string;

  /** Optional header action (e.g., "New document" button) */
  headerAction?: ReactNode;

  /** Optional search bar below the header */
  search?: ReactNode;

  /** Main sidebar content (sections, trees, lists) */
  children: ReactNode;

  /** Optional footer content */
  footer?: ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AppSidebar({
  storageKey,
  title,
  headerAction,
  search,
  children,
  footer,
}: AppSidebarProps) {
  const navigate = useNavigate();

  const [width, setWidth] = useState(() => readStoredWidth(storageKey));
  const widthRef = useRef(width);

  const handleResize = useCallback(
    (delta: number) => {
      setWidth((w) => {
        const next = clamp(w + delta, MIN_WIDTH, MAX_WIDTH);
        widthRef.current = next;
        return next;
      });
    },
    [],
  );

  const handleResizeEnd = useCallback(() => {
    localStorage.setItem(storageKey, String(Math.round(widthRef.current)));
  }, [storageKey]);

  return (
    <div
      style={{
        width,
        minWidth: MIN_WIDTH,
        maxWidth: MAX_WIDTH,
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        flexShrink: 0,
      }}
    >
      {/* Sidebar content */}
      <div
        className="app-sidebar"
        style={{
          flex: 1,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--sidebar-bg)',
          overflow: 'hidden',
          fontFamily: 'var(--font-family)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '12px 16px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => navigate(ROUTES.HOME)}
            title="Home"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text-tertiary)',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background 0.15s, color 0.15s',
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
            <ArrowLeft size={14} />
          </button>
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 400,
              color: 'var(--color-text-primary)',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </span>
          {headerAction}
        </div>

        {/* Search */}
        {search && (
          <div style={{ padding: '4px 12px 8px', flexShrink: 0 }}>
            {search}
          </div>
        )}

        {/* Scrollable content */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          <div style={{ padding: '4px 8px 12px' }}>
            {children}
          </div>
        </div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              borderTop: '1px solid var(--color-border-primary)',
              padding: '8px 12px',
              flexShrink: 0,
            }}
          >
            {footer}
          </div>
        )}
      </div>

      {/* Resize handle */}
      <ResizeHandle
        orientation="vertical"
        onResize={handleResize}
        onResizeEnd={handleResizeEnd}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components for sidebar content
// ---------------------------------------------------------------------------

export interface SidebarSectionProps {
  title?: string;
  /** Optional action node shown inline with the section title */
  action?: ReactNode;
  children: ReactNode;
}

export function SidebarSection({ title, action, children }: SidebarSectionProps) {
  return (
    <div className="app-sidebar-section" style={{ marginBottom: 2, paddingTop: 2 }}>
      {title && (
        <div
          style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 400,
            color: 'var(--color-text-tertiary)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '8px 8px 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{title}</span>
          {action && <span style={{ textTransform: 'none', letterSpacing: 'normal' }}>{action}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

export interface SidebarItemProps {
  label: string;
  icon?: ReactNode;
  iconColor?: string;
  isActive?: boolean;
  count?: number;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function SidebarItem({ label, icon, iconColor, isActive, count, onClick, style }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        height: 32,
        padding: '0 8px',
        borderRadius: 'var(--radius-sm)',
        border: 'none',
        background: isActive ? 'var(--sidebar-active)' : 'transparent',
        color: 'var(--sidebar-text)',
        fontSize: 13,
        fontWeight: 400,
        lineHeight: '20px',
        fontFamily: 'var(--font-family)',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.1s',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.background = 'var(--sidebar-hover)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.background = 'transparent';
      }}
    >
      {icon && (
        <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', color: 'var(--sidebar-text)' }}>
          {icon}
        </span>
      )}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {count !== undefined && (
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-tertiary)',
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
