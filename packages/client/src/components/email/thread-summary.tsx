import { useState, useEffect, useRef } from 'react';
import { Sparkles, ChevronDown, ChevronUp, RefreshCw, X } from 'lucide-react';
import { useThreadSummary } from '../../hooks/use-ai';
import { injectAISparkle } from '../../lib/animations';

const injectShimmer = (() => {
  let injected = false;
  return () => {
    if (injected || typeof document === 'undefined') return;
    injected = true;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes atlasmail-ai-shimmer {
        0%   { background-position: -200% center; }
        100% { background-position: 200% center; }
      }
    `;
    document.head.appendChild(style);
  };
})();

interface ThreadSummaryProps {
  threadId: string;
  messageCount: number;
}

export function ThreadSummary({ threadId, messageCount }: ThreadSummaryProps) {
  const { summary, loading, error, summarize, clear, enabled } = useThreadSummary();
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const prevThreadIdRef = useRef<string | null>(null);

  // Auto-summarize when thread changes (3+ messages)
  useEffect(() => {
    if (!enabled || messageCount < 3) return;
    if (prevThreadIdRef.current === threadId) return;
    prevThreadIdRef.current = threadId;
    setDismissed(false);
    setCollapsed(false);
    summarize(threadId);
  }, [enabled, threadId, messageCount, summarize]);

  // Clear when thread changes
  useEffect(() => {
    return () => clear();
  }, [threadId, clear]);

  // Inject animation keyframes
  useEffect(() => {
    injectAISparkle();
    injectShimmer();
  }, []);

  if (!enabled || messageCount < 3 || dismissed) return null;
  if (!summary && !loading && !error) return null;

  return (
    <div
      style={{
        margin: 'var(--spacing-md) var(--spacing-lg) 0',
        padding: 'var(--spacing-md) var(--spacing-lg)',
        background: 'color-mix(in srgb, var(--color-accent-primary) 5%, var(--color-bg-tertiary))',
        border: '1px solid color-mix(in srgb, var(--color-accent-primary) 15%, var(--color-border-secondary))',
        borderRadius: 'var(--radius-lg)',
        fontFamily: 'var(--font-family)',
        transition: 'all var(--transition-normal)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          cursor: summary ? 'pointer' : 'default',
          userSelect: 'none',
        }}
        onClick={() => summary && setCollapsed(!collapsed)}
      >
        <Sparkles
          size={14}
          style={{
            flexShrink: 0,
            color: loading ? undefined : 'var(--color-accent-primary)',
            animation: loading
              ? 'atlasmail-ai-sparkle-color 2s ease-in-out infinite, atlasmail-ai-sparkle-rotate 0.8s ease-in-out infinite'
              : undefined,
          }}
        />
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            ...(loading
              ? {
                  background: 'linear-gradient(90deg, #f59e0b, #ec4899, #8b5cf6, #3b82f6, #10b981, #f59e0b)',
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  animation: 'atlasmail-ai-shimmer 2s linear infinite',
                } as React.CSSProperties
              : { color: 'var(--color-accent-primary)' }),
          }}
        >
          {loading ? 'Summarizing...' : 'AI summary'}
        </span>
        <div style={{ flex: 1 }} />
        {summary && !loading && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              clear();
              summarize(threadId);
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
              color: 'var(--color-text-tertiary)',
              display: 'flex',
              alignItems: 'center',
            }}
            aria-label="Regenerate summary"
          >
            <RefreshCw size={12} />
          </button>
        )}
        {summary && (
          collapsed
            ? <ChevronDown size={14} style={{ color: 'var(--color-text-tertiary)' }} />
            : <ChevronUp size={14} style={{ color: 'var(--color-text-tertiary)' }} />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDismissed(true);
            clear();
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 2,
            color: 'var(--color-text-tertiary)',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Dismiss summary"
        >
          <X size={12} />
        </button>
      </div>

      {/* Content */}
      {!collapsed && (
        <div style={{ marginTop: 'var(--spacing-sm)' }}>
          {loading && (
            <div
              style={{
                display: 'flex',
                gap: 6,
                alignItems: 'center',
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: 'color-mix(in srgb, var(--color-accent-primary) 15%, var(--color-bg-tertiary))',
                    animation: `pulse 1.5s ease-in-out ${i * 0.2}s infinite`,
                    width: [80, 120, 60][i],
                  }}
                />
              ))}
            </div>
          )}
          {error && (
            <div
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-error, #ef4444)',
              }}
            >
              {error}
            </div>
          )}
          {summary && (
            <div
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                lineHeight: 'var(--line-height-normal)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {summary}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
