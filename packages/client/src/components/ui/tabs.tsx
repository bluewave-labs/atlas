import type { ReactNode, CSSProperties } from 'react';

/**
 * Shared horizontal tab bar component.
 *
 * Renders a row of tab buttons with an underline indicator on the active
 * tab in the brand accent colour. Matches the inline tab pattern used in
 * `apps/hr/components/employee-detail-page.tsx`.
 *
 * Tab state lives in the parent. Use `useTabsUrlState` (also exported
 * here) to bind it to a URL search param + localStorage if you want
 * routing + persistence.
 */

export interface TabItem {
  /** Stable id used for active comparison and URL routing. */
  id: string;
  /** Human-readable label rendered in the button. */
  label: string;
  /** Optional left icon. */
  icon?: ReactNode;
  /** Optional badge count rendered on the right of the label. */
  count?: number;
  /** Hide the tab entirely (e.g. for permission gating). Default false. */
  hidden?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  /** Padding-x of the tab strip. Default `var(--spacing-xl)` (matches the
   * existing employee detail page tabs). */
  paddingX?: string;
  /** Extra style applied to the tab strip container. */
  style?: CSSProperties;
}

export function Tabs({ tabs, activeTab, onChange, paddingX = 'var(--spacing-xl)', style }: TabsProps) {
  const visible = tabs.filter(t => !t.hidden);
  // If the URL / parent state points at a tab that's been filtered out
  // (e.g. permissions revoked, feature flag flipped), fall back to the
  // first visible tab so the user always sees *something* highlighted.
  const effectiveActive = visible.some(t => t.id === activeTab)
    ? activeTab
    : visible[0]?.id ?? activeTab;
  return (
    <div
      role="tablist"
      style={{
        display: 'flex',
        borderBottom: '1px solid var(--color-border-primary)',
        padding: `0 ${paddingX}`,
        flexShrink: 0,
        ...style,
      }}
    >
      {visible.map(tab => {
        const isActive = effectiveActive === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '10px var(--spacing-lg)',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family)',
              fontWeight: isActive ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
              color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              borderBottom: isActive
                ? '2px solid var(--color-accent-primary)'
                : '2px solid transparent',
              transition: 'color 0.15s, border-color 0.15s',
              marginBottom: -1,
              outline: 'none',
            }}
          >
            {tab.icon && (
              <span style={{ display: 'inline-flex', alignItems: 'center' }}>{tab.icon}</span>
            )}
            <span>{tab.label}</span>
            {tab.count != null && tab.count > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 9,
                  fontSize: 10,
                  fontWeight: 'var(--font-weight-semibold)',
                  background: isActive
                    ? 'var(--color-accent-primary)'
                    : 'var(--color-bg-tertiary)',
                  color: isActive ? '#fff' : 'var(--color-text-secondary)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
