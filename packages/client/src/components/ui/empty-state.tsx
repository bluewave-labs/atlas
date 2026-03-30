import { useState, useEffect, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settings-store';
import { injectKeyframes, injectInboxZero } from '../../lib/animations';

injectInboxZero();
injectKeyframes('empty-fade-in', `
@keyframes atlasmail-empty-fade-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}`);

// ─── SVG Illustrations ────────────────────────────────────────────────

function InboxIllustration() {
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Envelope body */}
      <rect
        x="8"
        y="18"
        width="56"
        height="38"
        rx="4"
        fill="var(--color-bg-tertiary)"
        stroke="var(--color-text-tertiary)"
        strokeWidth="2"
      />
      {/* Envelope flap (V shape) */}
      <polyline
        points="8,18 36,40 64,18"
        stroke="var(--color-text-tertiary)"
        strokeWidth="2"
        fill="none"
        strokeLinejoin="round"
      />
      {/* Checkmark circle — bottom right badge */}
      <circle
        cx="52"
        cy="52"
        r="11"
        fill="var(--color-bg-primary)"
        stroke="var(--color-text-tertiary)"
        strokeWidth="2"
      />
      <polyline
        points="46,52 50,56 58,47"
        stroke="var(--color-text-tertiary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function SearchIllustration() {
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Magnifying glass circle */}
      <circle
        cx="30"
        cy="30"
        r="18"
        fill="var(--color-bg-tertiary)"
        stroke="var(--color-text-tertiary)"
        strokeWidth="2"
      />
      {/* Handle */}
      <line
        x1="43"
        y1="43"
        x2="60"
        y2="60"
        stroke="var(--color-text-tertiary)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {/* Question mark stem */}
      <path
        d="M26 34 C26 30 30 30 30 27 C30 24 34 24 34 27 C34 29.5 30 30 30 33"
        stroke="var(--color-text-tertiary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Question mark dot */}
      <circle
        cx="30"
        cy="36.5"
        r="1.25"
        fill="var(--color-text-tertiary)"
      />
    </svg>
  );
}

function ArchiveIllustration() {
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Archive lid */}
      <rect
        x="8"
        y="16"
        width="56"
        height="12"
        rx="3"
        fill="var(--color-bg-tertiary)"
        stroke="var(--color-text-tertiary)"
        strokeWidth="2"
      />
      {/* Archive box body */}
      <path
        d="M12 28 L12 54 C12 55.1 12.9 56 14 56 L58 56 C59.1 56 60 55.1 60 54 L60 28 Z"
        fill="var(--color-bg-tertiary)"
        stroke="var(--color-text-tertiary)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Inner flap line */}
      <path
        d="M26 38 L46 38"
        stroke="var(--color-text-tertiary)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Down arrow into box */}
      <path
        d="M36 30 L36 36 M33 33.5 L36 36 L39 33.5"
        stroke="var(--color-text-tertiary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function TrashIllustration() {
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Lid handle */}
      <path
        d="M28 16 C28 14 30 12 36 12 C42 12 44 14 44 16"
        stroke="var(--color-text-tertiary)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      {/* Lid bar */}
      <rect
        x="12"
        y="18"
        width="48"
        height="8"
        rx="3"
        fill="var(--color-bg-tertiary)"
        stroke="var(--color-text-tertiary)"
        strokeWidth="2"
      />
      {/* Bin body */}
      <path
        d="M18 26 L20 57 C20 58.1 20.9 59 22 59 L50 59 C51.1 59 52 58.1 52 57 L54 26 Z"
        fill="var(--color-bg-tertiary)"
        stroke="var(--color-text-tertiary)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Vertical lines inside bin */}
      <line
        x1="30"
        y1="32"
        x2="30"
        y2="53"
        stroke="var(--color-text-tertiary)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="36"
        y1="32"
        x2="36"
        y2="53"
        stroke="var(--color-text-tertiary)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="42"
        y1="32"
        x2="42"
        y2="53"
        stroke="var(--color-text-tertiary)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Default content per type ─────────────────────────────────────────

const EMPTY_STATE_ILLUSTRATIONS = {
  inbox: InboxIllustration,
  search: SearchIllustration,
  archive: ArchiveIllustration,
  trash: TrashIllustration,
} as const;

// ─── Component ────────────────────────────────────────────────────────

interface EmptyStateProps {
  type: 'inbox' | 'search' | 'archive' | 'trash';
  title?: string;
  description?: string;
}

// Keyframes injected via injectKeyframes() at module level above

// Celebration particle colors
const CELEBRATION_COLORS = [
  'var(--color-accent-primary)',
  'var(--color-star)',
  '#34d399',
  '#fb7185',
  '#a78bfa',
  '#fbbf24',
];

// Pre-compute particle layout once at module level (stable across renders)
const CELEBRATION_PARTICLES = Array.from({ length: 24 }, (_, i) => {
  const angle = (i / 24) * Math.PI * 2;
  const distance = 40 + (((i * 7 + 3) % 11) / 11) * 50;
  const x = Math.cos(angle) * distance;
  const y = Math.sin(angle) * distance - 20;
  const size = 4 + (((i * 13 + 5) % 9) / 9) * 5;
  const delay = ((i * 3 + 1) % 8) / 8 * 0.3;
  const color = CELEBRATION_COLORS[i % CELEBRATION_COLORS.length];
  const shape = i % 3 === 0 ? '50%' : i % 3 === 1 ? '2px' : '0';
  return { x, y, size, delay, color, shape, key: i };
});

function CelebrationParticles() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 0,
        height: 0,
        pointerEvents: 'none',
      }}
    >
      {CELEBRATION_PARTICLES.map((p) => (
        <div
          key={p.key}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            borderRadius: p.shape,
            background: p.color,
            left: 0,
            top: 0,
            transform: `translate(${p.x}px, ${p.y}px)`,
            animation: `atlasmail-inbox-zero-rise 800ms ${p.delay}s ease-out forwards`,
          }}
        />
      ))}
    </div>
  );
}

export function EmptyState({ type, title, description }: EmptyStateProps) {
  const { t } = useTranslation();
  const animationsEnabled = useSettingsStore((s) => s.sendAnimation);
  const Illustration = EMPTY_STATE_ILLUSTRATIONS[type];
  const [showCelebration, setShowCelebration] = useState(false);

  // Show celebration only once when inbox empty state mounts
  useEffect(() => {
    if (type === 'inbox' && animationsEnabled) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [type, animationsEnabled]);

  const defaultsByType = {
    inbox: { title: t('inbox.allCaughtUp'), description: t('inbox.noConversations') },
    search: { title: t('inbox.noResults'), description: t('inbox.tryDifferent') },
    archive: { title: t('inbox.noArchived'), description: t('inbox.archivedAppearHere') },
    trash: { title: t('inbox.trashEmpty'), description: t('inbox.deletedAppearHere') },
  };

  const resolvedTitle = title ?? defaultsByType[type].title;
  const resolvedDescription = description ?? defaultsByType[type].description;

  return (
    <div
      role="status"
      aria-label={resolvedTitle}
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
      }}
    >
      <div
        style={{
          color: 'var(--color-text-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 'var(--spacing-xs)',
          position: 'relative',
        }}
      >
        <div style={{
          animation: showCelebration ? 'atlasmail-inbox-zero-check 500ms ease both' : undefined,
        }}>
          <Illustration />
        </div>
        {showCelebration && <CelebrationParticles />}
      </div>

      <span
        style={{
          fontSize: 'var(--font-size-lg)',
          fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
          color: 'var(--color-text-secondary)',
          textAlign: 'center',
        }}
      >
        {resolvedTitle}
      </span>

      <span
        style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-tertiary)',
          textAlign: 'center',
          maxWidth: 260,
          lineHeight: 'var(--line-height-normal)',
        }}
      >
        {resolvedDescription}
      </span>

      {type === 'inbox' && (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-tertiary)',
            marginTop: 'var(--spacing-sm)',
          }}
        >
          {t('inbox.press')}{' '}
          <kbd
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-sm)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--font-size-xs)',
              lineHeight: 1,
              padding: '2px 5px',
              color: 'var(--color-text-secondary)',
            }}
          >
            C
          </kbd>{' '}
          {t('inbox.toComposeNew')}
        </span>
      )}
    </div>
  );
}
