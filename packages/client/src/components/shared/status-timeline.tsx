import { CheckCircle2 } from 'lucide-react';

interface StatusTimelineProps {
  steps: Array<{ label: string; timestamp?: string | null }>;
  currentIndex: number;
}

export function StatusTimeline({ steps, currentIndex }: StatusTimelineProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, padding: 'var(--spacing-sm) 0' }}>
      {steps.map((step, i) => {
        const isActive = i <= currentIndex;
        const isCurrent = i === currentIndex;

        return (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              flex: i < steps.length - 1 ? 1 : undefined,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  backgroundColor: isActive
                    ? 'var(--color-accent-primary)'
                    : 'var(--color-bg-tertiary)',
                  color: isActive ? 'var(--color-text-inverse)' : 'var(--color-text-tertiary)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: 'var(--font-weight-semibold)' as never,
                  fontFamily: 'var(--font-family)',
                  border: isCurrent
                    ? '2px solid var(--color-accent-primary)'
                    : 'none',
                }}
              >
                {isActive ? <CheckCircle2 size={12} /> : i + 1}
              </div>
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: isActive
                    ? 'var(--color-text-primary)'
                    : 'var(--color-text-tertiary)',
                  fontFamily: 'var(--font-family)',
                  marginTop: 'var(--spacing-xs)',
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                }}
              >
                {step.label}
              </span>
              {step.timestamp && (
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--color-text-tertiary)',
                    fontFamily: 'var(--font-family)',
                    marginTop: 2,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {step.timestamp}
                </span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  backgroundColor: i < currentIndex
                    ? 'var(--color-accent-primary)'
                    : 'var(--color-border-primary)',
                  margin: '0 var(--spacing-xs)',
                  alignSelf: 'flex-start',
                  marginTop: 11,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
