/**
 * TEMPORARY preview page for picking the new System app icon.
 * Renders the 5 hand-authored alternatives from app-icons.tsx side-by-side
 * at multiple sizes so the user can compare them.
 *
 * Once the user picks a winner this whole file gets deleted along with the
 * losing components in app-icons.tsx and the route in App.tsx.
 */

import {
  SystemIconA,
  SystemIconB,
  SystemIconC,
  SystemIconD,
  SystemIconE,
} from '../../components/icons/app-icons';

const VARIANTS = [
  { letter: 'A', label: 'Control Center', component: SystemIconA },
  { letter: 'B', label: 'Gear cog', component: SystemIconB },
  { letter: 'C', label: 'Sliders', component: SystemIconC },
  { letter: 'D', label: 'Power button', component: SystemIconD },
  { letter: 'E', label: 'CPU chip', component: SystemIconE },
] as const;

export function SystemIconsPreviewPage() {
  return (
    <div
      style={{
        padding: '40px',
        fontFamily: 'var(--font-family)',
        background: 'var(--color-bg-primary)',
        color: 'var(--color-text-primary)',
        minHeight: '100vh',
      }}
    >
      <h1 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 8 }}>
        System icon alternatives
      </h1>
      <p style={{ color: 'var(--color-text-secondary)', marginBottom: 32 }}>
        Five hand-authored variants in the SignIcon style. Pick one by its
        letter and tell Claude which to ship.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {VARIANTS.map(({ letter, label, component: Icon }) => (
          <div
            key={letter}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 32,
              padding: 24,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-secondary)',
            }}
          >
            {/* Letter + label */}
            <div style={{ minWidth: 180 }}>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--color-accent-primary)',
                  lineHeight: 1,
                }}
              >
                {letter}
              </div>
              <div
                style={{
                  fontSize: 'var(--font-size-md)',
                  color: 'var(--color-text-secondary)',
                  marginTop: 8,
                }}
              >
                {label}
              </div>
            </div>

            {/* Large preview */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 128,
                height: 128,
                borderRadius: 16,
                background: '#ffffff',
                boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
              }}
            >
              <Icon size={120} />
            </div>

            {/* Dock-size preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  background: '#f5f5f7',
                  boxShadow: '0 3px 10px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
                }}
              >
                <Icon size={47} />
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                Dock size (52px)
              </div>
            </div>

            {/* Sidebar-size preview */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 24,
                  height: 24,
                  borderRadius: 'var(--radius-sm)',
                  background: '#f5f5f7',
                  boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.04)',
                }}
              >
                <Icon size={28} />
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                Sidebar (24px)
              </div>
            </div>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 32, color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
        Tell Claude the letter of your pick (e.g. &quot;C&quot;). The winner becomes
        the real SystemIcon and the rest get deleted.
      </p>
    </div>
  );
}
