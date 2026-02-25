import { useEffect, useRef, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { useQuickReplies } from '../../hooks/use-ai';

interface QuickAIRepliesProps {
  threadId: string;
  onSelectReply: (body: string) => void;
}

export function QuickAIReplies({ threadId, onSelectReply }: QuickAIRepliesProps) {
  const { replies, loading, error, generate, clear, enabled } = useQuickReplies();
  const prevThreadIdRef = useRef<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Auto-generate when thread changes
  useEffect(() => {
    if (!enabled) return;
    if (prevThreadIdRef.current === threadId) return;
    prevThreadIdRef.current = threadId;
    setSelectedIndex(null);
    generate(threadId);
  }, [enabled, threadId, generate]);

  useEffect(() => {
    return () => clear();
  }, [threadId, clear]);

  if (!enabled) return null;
  if (!loading && replies.length === 0 && !error) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        padding: '0 var(--spacing-lg)',
        marginTop: 8,
        marginBottom: 'var(--spacing-sm)',
        flexWrap: 'wrap',
      }}
    >
      <Sparkles
        size={12}
        style={{
          color: 'var(--color-accent-primary)',
          flexShrink: 0,
          animation: loading ? 'pulse 1.5s ease-in-out infinite' : undefined,
        }}
      />

      {loading && (
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-tertiary)',
            fontFamily: 'var(--font-family)',
            fontStyle: 'italic',
          }}
        >
          Generating replies...
        </span>
      )}

      {error && (
        <span
          style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-error, #ef4444)',
            fontFamily: 'var(--font-family)',
          }}
        >
          {error}
        </span>
      )}

      {replies.map((reply, i) => (
        <button
          key={i}
          onClick={() => {
            setSelectedIndex(i);
            onSelectReply(reply.body);
          }}
          style={{
            padding: '4px 12px',
            fontSize: 'var(--font-size-xs)',
            fontFamily: 'var(--font-family)',
            fontWeight: 500,
            borderRadius: 'var(--radius-full)',
            border: selectedIndex === i
              ? '1px solid var(--color-accent-primary)'
              : '1px solid var(--color-border-secondary)',
            background: selectedIndex === i
              ? 'color-mix(in srgb, var(--color-accent-primary) 10%, transparent)'
              : 'var(--color-bg-tertiary)',
            color: selectedIndex === i
              ? 'var(--color-accent-primary)'
              : 'var(--color-text-secondary)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (selectedIndex !== i) {
              e.currentTarget.style.borderColor = 'var(--color-accent-primary)';
              e.currentTarget.style.color = 'var(--color-accent-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedIndex !== i) {
              e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }
          }}
        >
          {reply.label}
        </button>
      ))}

      {replies.length > 0 && !loading && (
        <button
          onClick={() => {
            setSelectedIndex(null);
            clear();
            generate(threadId);
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
          aria-label="Regenerate replies"
        >
          <RefreshCw size={11} />
        </button>
      )}
    </div>
  );
}
