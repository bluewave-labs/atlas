import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Send, Maximize2, Reply, ReplyAll, Forward, Sparkles } from 'lucide-react';
import DOMPurify from 'dompurify';
import { Avatar } from '../ui/avatar';
import { Button } from '../ui/button';
import { AIWritingAssist } from '../compose/ai-writing-assist';
import { useEmailStore } from '../../stores/email-store';
import { useAuthStore } from '../../stores/auth-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useAIConfig } from '../../hooks/use-ai';
import { useSendEmail } from '../../hooks/use-threads';
import { injectAISparkle } from '../../lib/animations';
import { formatFullDate } from '@atlasmail/shared';
import type { Email } from '@atlasmail/shared';
import type { CSSProperties } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────

function addReSubjectPrefix(subject: string | null): string {
  const s = subject || '';
  const cleaned = s.replace(/^((Re|Fwd):\s*)+/i, '');
  return `Re: ${cleaned}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function formatAddr(email: Email): string {
  const name = escapeHtml(email.fromName || '');
  const addr = escapeHtml(email.fromAddress);
  return name ? `${name} &lt;${addr}&gt;` : addr;
}

function buildQuotedBody(email: Email): string {
  const date = formatFullDate(email.receivedAt || email.internalDate);
  const from = formatAddr(email);
  const attribution = `<p class="gmail_attr">On ${date}, ${from} wrote:</p>`;
  const sanitized = email.bodyHtml
    ? DOMPurify.sanitize(email.bodyHtml, { USE_PROFILES: { html: true } })
    : escapeHtml(email.bodyText || '');
  return `<p></p><blockquote>${attribution}${sanitized}</blockquote>`;
}

// ─── Icon button used for reply / reply-all / forward in compact state ─

function CompactIconButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        background: 'transparent',
        color: 'var(--color-text-tertiary)',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background var(--transition-normal), color var(--transition-normal)',
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
      {icon}
    </button>
  );
}

// ─── Props ────────────────────────────────────────────────────────────

interface InlineReplyProps {
  threadId: string;
  threadSubject: string | null;
  lastEmail: Email;
  /** AI quick reply prefill body — when set, expands the reply and pre-fills the editor */
  prefillBody?: string | null;
  /** Called after the prefill has been consumed so parent can reset */
  onPrefillConsumed?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────

export function InlineReply({ threadId, threadSubject, lastEmail, prefillBody, onPrefillConsumed }: InlineReplyProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [toAddress, setToAddress] = useState('');
  const [toName, setToName] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const account = useAuthStore((s) => s.account);
  const { openCompose } = useEmailStore();
  const trackingEnabled = useSettingsStore((s) => s.trackingEnabled);
  const sendEmail = useSendEmail();
  const aiConfig = useAIConfig();
  const aiEnabled = aiConfig.isConfigured && aiConfig.features.writingAssistant;
  const [showAIAssist, setShowAIAssist] = useState(false);
  const [aiSparkleActive, setAiSparkleActive] = useState(false);

  const myEmail = account?.email || '';

  // Derive the reply-to address from the last email.
  // If the sender is yourself, reply to the original recipients instead.
  const rawReplyAddr = lastEmail.replyTo || lastEmail.fromAddress;
  const isSentByMe = rawReplyAddr.toLowerCase() === myEmail.toLowerCase();
  const firstOriginalTo = isSentByMe ? lastEmail.toAddresses.find((a) => a.address !== myEmail) : null;
  const replyToAddress = isSentByMe && firstOriginalTo ? firstOriginalTo.address : rawReplyAddr;
  const replyToName = isSentByMe && firstOriginalTo ? (firstOriginalTo.name || '') : (lastEmail.fromName || '');

  // Build quoted content from the original email (memoised on stable scalars)
  const quotedHtml = useMemo(
    () => buildQuotedBody(lastEmail),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lastEmail.id, lastEmail.bodyHtml, lastEmail.bodyText, lastEmail.receivedAt, lastEmail.internalDate],
  );

  // Initialise the To field whenever the last email changes
  useEffect(() => {
    setToAddress(replyToAddress);
    setToName(replyToName);
  }, [replyToAddress, replyToName]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false }),
      Placeholder.configure({ placeholder: t('compose.replyPlaceholder') }),
    ],
    editorProps: {
      attributes: {
        style: [
          'outline: none',
          'color: var(--color-text-primary)',
          'font-size: var(--font-size-md)',
          'line-height: var(--line-height-normal)',
          'font-family: var(--font-family)',
          'min-height: 80px',
          'padding: 0',
        ].join('; '),
      },
    },
    content: quotedHtml,
  });

  // Sync editor content when the quoted email changes (e.g. navigating threads)
  useEffect(() => {
    if (editor && !isExpanded) {
      editor.commands.setContent(quotedHtml);
    }
  }, [editor, quotedHtml, isExpanded]);

  // Handle AI quick reply prefill
  useEffect(() => {
    if (!prefillBody || !editor) return;
    const prefillHtml = `<p>${prefillBody.replace(/\n/g, '<br>')}</p>${quotedHtml}`;
    editor.commands.setContent(prefillHtml);
    editor.commands.focus('start');
    setIsExpanded(true);
    onPrefillConsumed?.();
  }, [prefillBody, editor, quotedHtml, onPrefillConsumed]);

  // Collapse when clicking outside the reply box
  useEffect(() => {
    if (!isExpanded) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Only collapse if the user hasn't typed anything (content is just the quoted block)
        const currentHtml = editor?.getHTML() ?? '';
        const hasUserContent = currentHtml !== quotedHtml && !editor?.isEmpty;
        if (!hasUserContent) {
          setIsExpanded(false);
        }
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isExpanded, editor, quotedHtml]);

  const handleExpand = useCallback(() => {
    setIsExpanded(true);
    setShowAIAssist(false);
    // Trigger sparkle animation when expanding
    if (aiEnabled) {
      injectAISparkle();
      setAiSparkleActive(true);
      setTimeout(() => setAiSparkleActive(false), 3000);
    }
    // Focus the editor at the start (before the quoted content)
    requestAnimationFrame(() => {
      editor?.commands.focus('start');
    });
  }, [editor, aiEnabled]);

  const handleCollapse = useCallback(() => {
    setIsExpanded(false);
    // Reset to just the quoted content (remove any user-typed text)
    editor?.commands.setContent(quotedHtml);
  }, [editor, quotedHtml]);

  const handleSend = useCallback(() => {
    if (sendEmail.isPending) return;
    if (!toAddress.trim()) return;
    const bodyHtml = editor?.getHTML() ?? '';
    // Prevent sending if the user hasn't typed anything above the quoted block
    const userText = editor?.getText()?.trim() ?? '';
    if (!userText || bodyHtml === quotedHtml) return;

    sendEmail.mutate({
      to: [toAddress],
      subject: addReSubjectPrefix(threadSubject),
      bodyHtml,
      threadId,
      inReplyTo: lastEmail.messageIdHeader ?? undefined,
      referencesHeader: lastEmail.referencesHeader ?? undefined,
      trackingEnabled,
    });

    handleCollapse();
    document.dispatchEvent(new CustomEvent('atlasmail:email_sent'));
  }, [toAddress, editor, sendEmail, sendEmail.isPending, threadSubject, threadId, lastEmail.messageIdHeader, lastEmail.referencesHeader, handleCollapse, trackingEnabled, quotedHtml]);

  // Cmd/Ctrl+Enter to send
  useEffect(() => {
    if (!isExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isExpanded, handleSend]);

  const handleOpenFullModal = useCallback(
    (mode: 'reply' | 'reply_all' | 'forward') => {
      openCompose(mode, threadId);
    },
    [openCompose, threadId],
  );

  const myName = account?.name || account?.email || 'You';

  // ── Compact state ────────────────────────────────────────────────────────
  if (!isExpanded) {
    return (
      <div
        style={{
          margin: 'var(--spacing-md) var(--spacing-lg) var(--spacing-xl)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-bg-elevated)',
          boxShadow: 'var(--shadow-sm)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
            padding: 'var(--spacing-sm) var(--spacing-md)',
          }}
        >
          <Avatar name={myName} email={account?.email ?? ''} size={28} />

          {/* Fake input that expands on click */}
          <div
            role="button"
            tabIndex={0}
            aria-label={t('compose.writeReply')}
            onClick={handleExpand}
            onKeyDown={(e) => e.key === 'Enter' && handleExpand()}
            style={{
              flex: 1,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              padding: '0 var(--spacing-md)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-tertiary)',
              fontSize: 'var(--font-size-md)',
              fontFamily: 'var(--font-family)',
              cursor: 'text',
              userSelect: 'none',
              transition: 'border-color var(--transition-normal), background var(--transition-normal)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border-focus)';
              e.currentTarget.style.background = 'var(--color-bg-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-border-primary)';
              e.currentTarget.style.background = 'var(--color-bg-secondary)';
            }}
          >
            {t('compose.replyPlaceholder')}
          </div>

          {/* Quick-action icon buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
            <CompactIconButton
              icon={<Reply size={15} />}
              label={t('compose.reply')}
              onClick={(e) => {
                e.stopPropagation();
                handleExpand();
              }}
            />
            <CompactIconButton
              icon={<ReplyAll size={15} />}
              label={t('compose.replyAll')}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenFullModal('reply_all');
              }}
            />
            <CompactIconButton
              icon={<Forward size={15} />}
              label={t('compose.forward')}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenFullModal('forward');
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Expanded state ───────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{
        margin: 'var(--spacing-md) var(--spacing-lg) var(--spacing-xl)',
        border: '1px solid var(--color-border-focus)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--color-bg-elevated)',
        boxShadow: 'var(--shadow-md)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* To field */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          padding: 'var(--spacing-sm) var(--spacing-md)',
          borderBottom: '1px solid var(--color-border-secondary)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-tertiary)',
            fontFamily: 'var(--font-family)',
            flexShrink: 0,
            width: 20,
          }}
        >
          {t('common.to')}
        </span>
        <input
          type="email"
          value={toAddress}
          onChange={(e) => setToAddress(e.target.value)}
          aria-label={t('common.to')}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--color-text-primary)',
            fontSize: 'var(--font-size-sm)',
            fontFamily: 'var(--font-family)',
            padding: '2px 0',
          }}
          placeholder={t('compose.recipients')}
        />
        {toName && (
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-family)',
              flexShrink: 0,
              maxWidth: 180,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {toName}
          </span>
        )}
      </div>

      {/* Subject (read-only, for context) */}
      <div
        style={{
          padding: 'var(--spacing-xs) var(--spacing-md)',
          borderBottom: '1px solid var(--color-border-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-tertiary)',
            fontFamily: 'var(--font-family)',
            flexShrink: 0,
            width: 20,
          }}
        >
          {t('common.re')}
        </span>
        <span
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-family)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {addReSubjectPrefix(threadSubject)}
        </span>
      </div>

      {/* AI writing assistant panel */}
      {showAIAssist && (
        <div style={{ padding: 'var(--spacing-sm) var(--spacing-md) 0' }}>
          <AIWritingAssist
            subject={addReSubjectPrefix(threadSubject)}
            existingDraft={editor?.getText() || undefined}
            onAccept={(text) => {
              if (editor) {
                const html = `<p>${text.replace(/\n/g, '<br>')}</p>${quotedHtml}`;
                editor.commands.setContent(html);
                editor.commands.focus('start');
              }
            }}
            onClose={() => setShowAIAssist(false)}
          />
        </div>
      )}

      {/* TipTap editor area */}
      <div
        style={{
          padding: 'var(--spacing-md) var(--spacing-md)',
          minHeight: 100,
          cursor: 'text',
        }}
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Bottom action bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--spacing-sm) var(--spacing-md)',
          borderTop: '1px solid var(--color-border-secondary)',
          background: 'var(--color-bg-tertiary)',
          gap: 'var(--spacing-sm)',
        }}
      >
        {/* Left: Send */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <Button
            variant="primary"
            size="sm"
            icon={<Send size={13} />}
            onClick={handleSend}
            disabled={sendEmail.isPending}
            aria-label="Send reply"
          >
            {sendEmail.isPending ? t('common.sending') : t('common.send')}
          </Button>

          {/* AI writing assist button */}
          {aiEnabled && (
            <button
              type="button"
              onClick={() => setShowAIAssist((v) => !v)}
              aria-label="AI writing assist"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: showAIAssist ? 'var(--color-surface-active)' : 'transparent',
                color: aiSparkleActive ? undefined : (showAIAssist ? 'var(--color-accent-primary)' : 'var(--color-text-tertiary)'),
                cursor: 'pointer',
                transition: 'background var(--transition-normal), color var(--transition-normal)',
                animation: aiSparkleActive
                  ? 'atlasmail-ai-sparkle-color 3s ease-in-out forwards, atlasmail-ai-sparkle-rotate 0.6s ease-in-out 3'
                  : undefined,
              }}
              onMouseEnter={(e) => {
                if (!aiSparkleActive) {
                  e.currentTarget.style.background = 'var(--color-surface-hover)';
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!aiSparkleActive) {
                  e.currentTarget.style.background = showAIAssist ? 'var(--color-surface-active)' : 'transparent';
                  e.currentTarget.style.color = showAIAssist ? 'var(--color-accent-primary)' : 'var(--color-text-tertiary)';
                }
              }}
            >
              <Sparkles size={13} />
            </button>
          )}

          {/* Keyboard hint */}
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-mono)',
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-sm)',
              padding: '2px 6px',
              userSelect: 'none',
            }}
          >
            Cmd+Enter
          </span>
        </div>

        {/* Right: Expand + Discard */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
          <button
            type="button"
            aria-label={t('compose.openFullCompose')}
            onClick={() => handleOpenFullModal('reply')}
            style={ghostButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-surface-hover)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--color-text-tertiary)';
            }}
          >
            <Maximize2 size={13} />
            <span style={{ marginLeft: 4 }}>{t('common.expand')}</span>
          </button>

          <button
            type="button"
            aria-label={t('compose.discardReply')}
            onClick={handleCollapse}
            style={ghostButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--color-surface-hover)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--color-text-tertiary)';
            }}
          >
            {t('common.discard')}
          </button>
        </div>
      </div>
    </div>
  );
}

const ghostButtonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: 28,
  padding: '0 var(--spacing-sm)',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--color-text-tertiary)',
  fontSize: 'var(--font-size-sm)',
  fontFamily: 'var(--font-family)',
  cursor: 'pointer',
  transition: 'background var(--transition-normal), color var(--transition-normal)',
  whiteSpace: 'nowrap',
};
