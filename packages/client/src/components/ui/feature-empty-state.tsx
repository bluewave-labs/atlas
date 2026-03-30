import { useState, type ReactNode, type CSSProperties } from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from './button';
import { injectKeyframes } from '../../lib/animations';

// Reuse the same fade-in keyframe from empty-state.tsx
injectKeyframes('empty-fade-in', `
@keyframes atlasmail-empty-fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}`);

// ─── Accent palettes (VerifyWise-inspired rotating colors) ──────────

const ACCENT_PALETTES = [
  { bg: 'color-mix(in srgb, var(--color-success) 10%, transparent)', icon: 'var(--color-success)', border: 'color-mix(in srgb, var(--color-success) 30%, transparent)' },
  { bg: 'color-mix(in srgb, var(--color-accent-primary) 10%, transparent)', icon: 'var(--color-accent-primary)', border: 'color-mix(in srgb, var(--color-accent-primary) 30%, transparent)' },
  { bg: 'color-mix(in srgb, var(--color-warning) 10%, transparent)', icon: 'var(--color-warning)', border: 'color-mix(in srgb, var(--color-warning) 30%, transparent)' },
];

// ─── SVG Illustrations (80x80) ──────────────────────────────────────

function PipelineIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Column 1 */}
      <rect x="6" y="14" width="20" height="52" rx="3" fill="var(--color-bg-tertiary)" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
      <rect x="9" y="22" width="14" height="10" rx="2" fill="var(--color-bg-primary)" stroke="var(--color-text-tertiary)" strokeWidth="1" />
      <rect x="9" y="35" width="14" height="10" rx="2" fill="var(--color-bg-primary)" stroke="var(--color-text-tertiary)" strokeWidth="1" />
      <line x1="10" y1="17" x2="22" y2="17" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Column 2 */}
      <rect x="30" y="14" width="20" height="52" rx="3" fill="var(--color-bg-tertiary)" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
      <rect x="33" y="22" width="14" height="10" rx="2" fill="var(--color-bg-primary)" stroke="var(--color-text-tertiary)" strokeWidth="1" />
      <rect x="33" y="35" width="14" height="10" rx="2" fill="var(--color-bg-primary)" stroke="var(--color-text-tertiary)" strokeWidth="1" />
      <rect x="33" y="48" width="14" height="10" rx="2" fill="var(--color-bg-primary)" stroke="var(--color-text-tertiary)" strokeWidth="1" />
      <line x1="34" y1="17" x2="46" y2="17" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Column 3 */}
      <rect x="54" y="14" width="20" height="52" rx="3" fill="var(--color-bg-tertiary)" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
      <rect x="57" y="22" width="14" height="10" rx="2" fill="var(--color-bg-primary)" stroke="var(--color-text-tertiary)" strokeWidth="1" />
      <line x1="58" y1="17" x2="70" y2="17" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ContactsIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Card background */}
      <rect x="10" y="16" width="60" height="48" rx="4" fill="var(--color-bg-tertiary)" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
      {/* Person 1 */}
      <circle cx="30" cy="36" r="8" fill="var(--color-bg-primary)" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
      <circle cx="30" cy="33" r="3" stroke="var(--color-text-tertiary)" strokeWidth="1.5" fill="none" />
      <path d="M24 41 C24 38 27 37 30 37 C33 37 36 38 36 41" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Person 2 (offset) */}
      <circle cx="50" cy="36" r="8" fill="var(--color-bg-primary)" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
      <circle cx="50" cy="33" r="3" stroke="var(--color-text-tertiary)" strokeWidth="1.5" fill="none" />
      <path d="M44 41 C44 38 47 37 50 37 C53 37 56 38 56 41" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Name lines below */}
      <line x1="20" y1="52" x2="38" y2="52" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="42" y1="52" x2="60" y2="52" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="22" y1="56" x2="36" y2="56" stroke="var(--color-text-tertiary)" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <line x1="44" y1="56" x2="58" y2="56" stroke="var(--color-text-tertiary)" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function DocumentsIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Document body */}
      <rect x="16" y="10" width="48" height="60" rx="4" fill="var(--color-bg-tertiary)" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
      {/* Text lines */}
      <line x1="24" y1="22" x2="56" y2="22" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="24" y1="29" x2="52" y2="29" stroke="var(--color-text-tertiary)" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <line x1="24" y1="36" x2="48" y2="36" stroke="var(--color-text-tertiary)" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <line x1="24" y1="43" x2="54" y2="43" stroke="var(--color-text-tertiary)" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      {/* Signature line at bottom */}
      <line x1="24" y1="58" x2="44" y2="58" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Signature squiggle */}
      <path d="M26 54 C28 50 30 56 32 52 C34 48 36 55 38 52" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function TasksIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Checklist box */}
      <rect x="14" y="12" width="52" height="56" rx="4" fill="var(--color-bg-tertiary)" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
      {/* Item 1 — checked */}
      <rect x="22" y="22" width="12" height="12" rx="2" stroke="var(--color-text-tertiary)" strokeWidth="1.5" fill="none" />
      <polyline points="25,28 28,31 33,25" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="40" y1="28" x2="58" y2="28" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Item 2 — checked */}
      <rect x="22" y="38" width="12" height="12" rx="2" stroke="var(--color-text-tertiary)" strokeWidth="1.5" fill="none" />
      <polyline points="25,44 28,47 33,41" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="40" y1="44" x2="54" y2="44" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Item 3 — unchecked */}
      <rect x="22" y="54" width="12" height="12" rx="2" stroke="var(--color-text-tertiary)" strokeWidth="1.5" fill="none" />
      <line x1="40" y1="60" x2="56" y2="60" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function TableIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Grid border */}
      <rect x="10" y="14" width="60" height="52" rx="4" fill="var(--color-bg-tertiary)" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
      {/* Header row */}
      <line x1="10" y1="26" x2="70" y2="26" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
      {/* Row separators */}
      <line x1="10" y1="40" x2="70" y2="40" stroke="var(--color-text-tertiary)" strokeWidth="1" opacity="0.5" />
      <line x1="10" y1="53" x2="70" y2="53" stroke="var(--color-text-tertiary)" strokeWidth="1" opacity="0.5" />
      {/* Column separators */}
      <line x1="30" y1="14" x2="30" y2="66" stroke="var(--color-text-tertiary)" strokeWidth="1" opacity="0.5" />
      <line x1="52" y1="14" x2="52" y2="66" stroke="var(--color-text-tertiary)" strokeWidth="1" opacity="0.5" />
      {/* Header text lines */}
      <line x1="14" y1="20" x2="26" y2="20" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="34" y1="20" x2="48" y2="20" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="56" y1="20" x2="66" y2="20" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function FilesIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Folder body */}
      <path d="M10 28 L10 62 C10 64.2 11.8 66 14 66 L66 66 C68.2 66 70 64.2 70 62 L70 28 C70 25.8 68.2 24 66 24 L14 24 C11.8 24 10 25.8 10 28 Z" fill="var(--color-bg-tertiary)" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
      {/* Folder tab */}
      <path d="M10 28 L10 20 C10 17.8 11.8 16 14 16 L30 16 L36 24 L14 24" fill="var(--color-bg-tertiary)" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinejoin="round" />
      {/* File peeking out */}
      <rect x="28" y="10" width="28" height="36" rx="2" fill="var(--color-bg-primary)" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
      {/* File corner fold */}
      <path d="M48 10 L56 18 L48 18 Z" fill="var(--color-bg-tertiary)" stroke="var(--color-text-tertiary)" strokeWidth="1" strokeLinejoin="round" />
      {/* File text lines */}
      <line x1="32" y1="24" x2="44" y2="24" stroke="var(--color-text-tertiary)" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <line x1="32" y1="30" x2="42" y2="30" stroke="var(--color-text-tertiary)" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function DrawingsIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Canvas */}
      <rect x="10" y="10" width="52" height="52" rx="4" fill="var(--color-bg-tertiary)" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
      {/* Canvas content — simple shape */}
      <circle cx="30" cy="32" r="10" stroke="var(--color-text-tertiary)" strokeWidth="1.5" fill="none" />
      <rect x="38" y="38" width="16" height="16" rx="2" stroke="var(--color-text-tertiary)" strokeWidth="1.5" fill="none" />
      {/* Pencil */}
      <g transform="translate(52, 14) rotate(45)">
        <rect x="0" y="0" width="6" height="32" rx="1" fill="var(--color-bg-primary)" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
        <path d="M0 32 L3 38 L6 32" fill="var(--color-text-tertiary)" stroke="var(--color-text-tertiary)" strokeWidth="1" strokeLinejoin="round" />
        <line x1="0" y1="4" x2="6" y2="4" stroke="var(--color-text-tertiary)" strokeWidth="1" />
      </g>
    </svg>
  );
}

function EmployeesIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* ID badge card */}
      <rect x="16" y="12" width="48" height="56" rx="4" fill="var(--color-bg-tertiary)" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
      {/* Badge clip */}
      <rect x="34" y="8" width="12" height="8" rx="2" fill="var(--color-bg-primary)" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
      {/* Person avatar */}
      <circle cx="40" cy="34" r="9" fill="var(--color-bg-primary)" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
      <circle cx="40" cy="31" r="3.5" stroke="var(--color-text-tertiary)" strokeWidth="1.5" fill="none" />
      <path d="M33 40 C33 37 36 35.5 40 35.5 C44 35.5 47 37 47 40" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Name line */}
      <line x1="28" y1="50" x2="52" y2="50" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Role line */}
      <line x1="30" y1="56" x2="50" y2="56" stroke="var(--color-text-tertiary)" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <line x1="32" y1="61" x2="48" y2="61" stroke="var(--color-text-tertiary)" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

function CalendarIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Calendar body */}
      <rect x="10" y="16" width="60" height="52" rx="4" fill="var(--color-bg-tertiary)" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
      {/* Top bar */}
      <line x1="10" y1="30" x2="70" y2="30" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
      {/* Binding rings */}
      <line x1="28" y1="12" x2="28" y2="20" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" />
      <line x1="52" y1="12" x2="52" y2="20" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" />
      {/* Date grid — dots */}
      {[0, 1, 2, 3, 4].map((col) =>
        [0, 1, 2].map((row) => (
          <circle
            key={`${col}-${row}`}
            cx={20 + col * 10}
            cy={38 + row * 10}
            r="2"
            fill="var(--color-text-tertiary)"
            opacity={col === 2 && row === 1 ? 1 : 0.3}
          />
        ))
      )}
      {/* Highlight on one date */}
      <circle cx="40" cy="48" r="5" stroke="var(--color-text-tertiary)" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function GenericIllustration() {
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Box */}
      <rect x="14" y="14" width="52" height="52" rx="6" fill="var(--color-bg-tertiary)" stroke="var(--color-text-tertiary)" strokeWidth="1.5" />
      {/* Plus sign */}
      <line x1="40" y1="30" x2="40" y2="50" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" />
      <line x1="30" y1="40" x2="50" y2="40" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ─── Illustration registry ──────────────────────────────────────────

const ILLUSTRATIONS = {
  pipeline: PipelineIllustration,
  contacts: ContactsIllustration,
  documents: DocumentsIllustration,
  tasks: TasksIllustration,
  table: TableIllustration,
  files: FilesIllustration,
  drawings: DrawingsIllustration,
  employees: EmployeesIllustration,
  calendar: CalendarIllustration,
  generic: GenericIllustration,
} as const;

// ─── Types ──────────────────────────────────────────────────────────

export interface FeatureHighlight {
  icon: ReactNode;
  title: string;
  description: string;
}

export interface FeatureEmptyStateProps {
  illustration: keyof typeof ILLUSTRATIONS;
  title: string;
  description?: string;
  highlights?: FeatureHighlight[];
  actionLabel?: string;
  actionIcon?: ReactNode;
  onAction?: () => void;
}

// ─── Collapsible Feature Tip ────────────────────────────────────────

function FeatureTip({ highlight, palette }: { highlight: FeatureHighlight; palette: typeof ACCENT_PALETTES[0] }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-md)',
          padding: 'var(--spacing-md)',
          background: open ? palette.bg : 'transparent',
          border: `1px solid ${open ? palette.border : 'var(--color-border-secondary)'}`,
          borderRadius: open ? 'var(--radius-lg) var(--radius-lg) 0 0' : 'var(--radius-lg)',
          cursor: 'pointer',
          fontFamily: 'var(--font-family)',
          textAlign: 'left',
          transition: 'background var(--transition-normal), border-color var(--transition-normal)',
          outline: 'none',
          width: '100%',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            borderRadius: 'var(--radius-md)',
            background: palette.bg,
            color: palette.icon,
            flexShrink: 0,
          }}
        >
          {highlight.icon}
        </span>
        <span
          style={{
            flex: 1,
            fontSize: 'var(--font-size-sm)',
            fontWeight: 'var(--font-weight-normal)' as CSSProperties['fontWeight'],
            color: 'var(--color-text-primary)',
            minWidth: 0,
          }}
        >
          {highlight.title}
        </span>
        <ChevronRight
          size={14}
          style={{
            color: 'var(--color-text-tertiary)',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform var(--transition-normal)',
            flexShrink: 0,
          }}
        />
      </button>
      {open && (
        <div
          style={{
            padding: 'var(--spacing-sm) var(--spacing-md) var(--spacing-md) calc(30px + var(--spacing-md) + var(--spacing-md))',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-tertiary)',
            lineHeight: 'var(--line-height-normal)',
            fontFamily: 'var(--font-family)',
            background: palette.bg,
            border: `1px solid ${palette.border}`,
            borderTop: 'none',
            borderRadius: '0 0 var(--radius-lg) var(--radius-lg)',
          }}
        >
          {highlight.description}
        </div>
      )}
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────

export function FeatureEmptyState({
  illustration,
  title,
  description,
  highlights,
  actionLabel,
  actionIcon,
  onAction,
}: FeatureEmptyStateProps) {
  const Illustration = ILLUSTRATIONS[illustration];

  return (
    <div
      role="status"
      aria-label={title}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        gap: 'var(--spacing-md)',
        fontFamily: 'var(--font-family)',
        userSelect: 'none',
        animation: 'atlasmail-empty-fade-in 220ms ease both',
        padding: 'var(--spacing-2xl)',
      }}
    >
      {/* Illustration */}
      <div
        style={{
          color: 'var(--color-text-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--spacing-xs)',
        }}
      >
        <Illustration />
      </div>

      {/* Title */}
      <span
        style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
          color: 'var(--color-text-secondary)',
          textAlign: 'center',
          fontFamily: 'var(--font-family)',
        }}
      >
        {title}
      </span>

      {/* Description */}
      {description && (
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-tertiary)',
            textAlign: 'center',
            maxWidth: 320,
            lineHeight: 'var(--line-height-normal)',
            fontFamily: 'var(--font-family)',
          }}
        >
          {description}
        </span>
      )}

      {/* Feature tips (collapsible, VerifyWise-inspired) */}
      {highlights && highlights.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-sm)',
            maxWidth: 440,
            width: '100%',
            marginTop: 'var(--spacing-md)',
          }}
        >
          {highlights.map((h, i) => (
            <FeatureTip key={i} highlight={h} palette={ACCENT_PALETTES[i % ACCENT_PALETTES.length]} />
          ))}
        </div>
      )}

      {/* CTA button */}
      {actionLabel && onAction && (
        <div style={{ marginTop: 'var(--spacing-sm)' }}>
          <Button variant="primary" size="md" icon={actionIcon} onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
