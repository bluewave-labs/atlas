import { type CSSProperties, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * Dev-only Ghost-card iterations. Four stylish takes on the transparent
 * card treatment, each with a slightly different header block design.
 *
 *   /dev/card-g1 — Subtle header band
 *   /dev/card-g2 — Inset header with divider
 *   /dev/card-g3 — Floating header label (fieldset-style)
 *   /dev/card-g4 — Gradient header strip
 *
 * Public routes, no auth required. Remove once the user picks a winner.
 */

type Variant = 'g1' | 'g2' | 'g3' | 'g4';

const VARIANT_META: Record<Variant, { label: string; name: string; note: string }> = {
  g1: { label: 'G1', name: 'Subtle band', note: 'Faint secondary-bg header strip that reads as a label zone.' },
  g2: { label: 'G2', name: 'Inset divider', note: 'No header fill — a hairline rule separates title from body.' },
  g3: { label: 'G3', name: 'Floating label', note: 'Title sits on the top edge, cutting the border like a fieldset legend.' },
  g4: { label: 'G4', name: 'Gradient strip', note: 'Whisper of accent colour in the header band, fading into transparent.' },
};

// ─── Variant styles ─────────────────────────────────────────────────

function shellStyle(variant: Variant): CSSProperties {
  const common: CSSProperties = {
    background: 'transparent',
    border: '1px solid var(--color-border-secondary)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
    position: 'relative',
  };
  switch (variant) {
    case 'g3':
      // G3 needs visible overflow so the floating label can poke out.
      return { ...common, overflow: 'visible', marginTop: 12 };
    default:
      return common;
  }
}

function headerStyle(variant: Variant): CSSProperties {
  const base: CSSProperties = {
    padding: '12px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  };
  switch (variant) {
    case 'g1':
      return {
        ...base,
        background: 'color-mix(in srgb, var(--color-bg-secondary) 55%, transparent)',
        borderBottom: '1px solid var(--color-border-secondary)',
      };
    case 'g2':
      return {
        ...base,
        borderBottom: '1px solid var(--color-border-secondary)',
      };
    case 'g3':
      // Rendered *outside* the card shell via absolute positioning below.
      return { ...base, padding: 0 };
    case 'g4':
      return {
        ...base,
        background:
          'linear-gradient(180deg, color-mix(in srgb, var(--color-accent-primary) 5%, transparent) 0%, transparent 100%)',
        borderBottom: '1px solid var(--color-border-secondary)',
      };
  }
}

function bodyStyle(variant: Variant): CSSProperties {
  switch (variant) {
    case 'g3':
      return { padding: '24px 20px 16px' };
    default:
      return { padding: '16px 20px 12px' };
  }
}

// ─── Header block components ────────────────────────────────────────

function HeaderTitle({ title }: { title: string }) {
  return (
    <h3
      style={{
        margin: 0,
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--color-text-primary)',
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        fontFamily: 'var(--font-family)',
      }}
    >
      {title}
    </h3>
  );
}

function HeaderDescription({ text }: { text: string }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 12.5,
        color: 'var(--color-text-tertiary)',
        fontFamily: 'var(--font-family)',
        lineHeight: 1.45,
      }}
    >
      {text}
    </p>
  );
}

function GhostCard({
  variant,
  title,
  description,
  children,
}: {
  variant: Variant;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  if (variant === 'g3') {
    return (
      <section style={shellStyle(variant)}>
        {/* Floating legend — positioned to overlap the top border. */}
        <div
          style={{
            position: 'absolute',
            top: -9,
            left: 16,
            padding: '0 10px',
            background: 'var(--color-bg-primary)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              background: 'var(--color-accent-primary)',
            }}
          />
          <HeaderTitle title={title} />
        </div>
        <div style={bodyStyle(variant)}>
          {description && (
            <p
              style={{
                margin: '0 0 12px',
                fontSize: 12.5,
                color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-family)',
                lineHeight: 1.45,
              }}
            >
              {description}
            </p>
          )}
          {children}
        </div>
      </section>
    );
  }

  return (
    <section style={shellStyle(variant)}>
      <header style={headerStyle(variant)}>
        <HeaderTitle title={title} />
        {description && <HeaderDescription text={description} />}
      </header>
      <div style={bodyStyle(variant)}>{children}</div>
    </section>
  );
}

// ─── Sample rows ────────────────────────────────────────────────────

function MockRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 0',
        borderTop: '1px solid var(--color-border-secondary)',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 13,
          padding: '4px 10px',
          borderRadius: 6,
          background: 'var(--color-bg-tertiary)',
          border: '1px solid var(--color-border-primary)',
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-family)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

function RowGroup({ children }: { children: ReactNode }) {
  // Strip the top border off the first row so it aligns with the header divider.
  return <div style={{ marginTop: -1 }}>{children}</div>;
}

// ─── Page chrome ────────────────────────────────────────────────────

function VariantNav({ current }: { current: Variant }) {
  const order: Variant[] = ['g1', 'g2', 'g3', 'g4'];
  return (
    <nav
      style={{
        display: 'flex',
        gap: 6,
        padding: '8px 10px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-secondary)',
        width: 'fit-content',
        marginBottom: 24,
      }}
    >
      {order.map((v) => {
        const isActive = v === current;
        return (
          <Link
            key={v}
            to={`/dev/card-${v}`}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              background: isActive ? 'var(--color-accent-primary)' : 'transparent',
              color: isActive ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
              fontSize: 12,
              fontWeight: 500,
              textDecoration: 'none',
              fontFamily: 'var(--font-family)',
            }}
          >
            {VARIANT_META[v].label} — {VARIANT_META[v].name}
          </Link>
        );
      })}
    </nav>
  );
}

function PageHeader({ variant }: { variant: Variant }) {
  const meta = VARIANT_META[variant];
  return (
    <div
      style={{
        paddingBottom: 16,
        borderBottom: '1px solid var(--color-border-secondary)',
        marginBottom: 32,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--color-accent-primary)',
            color: 'var(--color-text-inverse)',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'var(--font-family)',
          }}
        >
          {meta.label}
        </span>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, fontFamily: 'var(--font-family)' }}>
          {meta.name}
        </h1>
      </div>
      <p
        style={{
          margin: '8px 0 0 48px',
          fontSize: 13,
          color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-family)',
        }}
      >
        {meta.note}
      </p>
    </div>
  );
}

function PreviewPage({ variant }: { variant: Variant }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-bg-primary)',
        padding: '40px 48px',
        fontFamily: 'var(--font-family)',
        color: 'var(--color-text-primary)',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <VariantNav current={variant} />
        <PageHeader variant={variant} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <GhostCard
            variant={variant}
            title="Organization defaults"
            description="Override individual user preferences"
          >
            <RowGroup>
              <MockRow label="Default currency" value="USD — US Dollar" />
            </RowGroup>
          </GhostCard>

          <GhostCard
            variant={variant}
            title="Date & time"
            description="How dates and times appear across the app"
          >
            <RowGroup>
              <MockRow label="Date format" value="DD/MM/YYYY" />
              <MockRow label="Time format" value="24h" />
              <MockRow label="Timezone" value="Europe/Istanbul" />
            </RowGroup>
          </GhostCard>

          <GhostCard variant={variant} title="Numbers & currency">
            <RowGroup>
              <MockRow label="Number format" value="1,234.56" />
              <MockRow label="Currency" value="USD" />
            </RowGroup>
          </GhostCard>
        </div>
      </div>
    </div>
  );
}

export function DevCardG1Page() { return <PreviewPage variant="g1" />; }
export function DevCardG2Page() { return <PreviewPage variant="g2" />; }
export function DevCardG3Page() { return <PreviewPage variant="g3" />; }
export function DevCardG4Page() { return <PreviewPage variant="g4" />; }
