import { useState } from 'react';
import DOMPurify from 'dompurify';
import { ChevronDown, ChevronUp, Paperclip } from 'lucide-react';
import { Avatar } from '../ui/avatar';
import { formatFullDate, formatRelativeTime } from '@atlasmail/shared';
import { formatBytes } from '../../lib/format';
import type { Email } from '@atlasmail/shared';
import type { CSSProperties } from 'react';

// Configure DOMPurify: allow safe HTML, strip dangerous elements
// USE_PROFILES: { html: true } already strips all event handler attributes
const PURIFY_CONFIG = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['target'],
  FORBID_TAGS: ['style', 'form', 'input', 'script'],
};

// Force all links to open in new tab
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

function separateQuotedContent(html: string): { main: string; quoted: string | null } {
  // Gmail-style quoted blocks
  const gmailQuoteMatch = html.match(/<div[^>]*class="gmail_quote"[^>]*>[\s\S]*$/i);
  if (gmailQuoteMatch) {
    return {
      main: html.slice(0, gmailQuoteMatch.index!),
      quoted: html.slice(gmailQuoteMatch.index!),
    };
  }

  // Blockquote at the end
  const blockquoteMatch = html.match(/<blockquote[^>]*>[\s\S]*$/i);
  if (blockquoteMatch) {
    return {
      main: html.slice(0, blockquoteMatch.index!),
      quoted: html.slice(blockquoteMatch.index!),
    };
  }

  // "On ... wrote:" pattern
  const onWroteMatch = html.match(/<(?:div|p|br)[^>]*>(?:\s|&nbsp;)*On .+? wrote:[\s\S]*$/i);
  if (onWroteMatch) {
    return {
      main: html.slice(0, onWroteMatch.index!),
      quoted: html.slice(onWroteMatch.index!),
    };
  }

  return { main: html, quoted: null };
}

function separateQuotedText(text: string): { main: string; quoted: string | null } {
  const lines = text.split('\n');

  // Find "On ... wrote:" line
  for (let i = 0; i < lines.length; i++) {
    if (/^On .+? wrote:$/.test(lines[i].trim())) {
      return {
        main: lines.slice(0, i).join('\n').trimEnd(),
        quoted: lines.slice(i).join('\n'),
      };
    }
  }

  // Find block of "> " prefixed lines (3+ consecutive)
  let consecutiveQuoted = 0;
  let quoteStartIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('> ') || lines[i] === '>') {
      if (consecutiveQuoted === 0) quoteStartIndex = i;
      consecutiveQuoted++;
      if (consecutiveQuoted >= 3) {
        return {
          main: lines.slice(0, quoteStartIndex).join('\n').trimEnd(),
          quoted: lines.slice(quoteStartIndex).join('\n'),
        };
      }
    } else {
      consecutiveQuoted = 0;
      quoteStartIndex = -1;
    }
  }

  return { main: text, quoted: null };
}

const textBodyStyle: CSSProperties = {
  fontSize: 'var(--font-size-md)',
  color: 'var(--color-text-primary)',
  lineHeight: 'var(--line-height-normal)',
  whiteSpace: 'pre-wrap',
  fontFamily: 'var(--font-family)',
  margin: 0,
  overflowWrap: 'break-word',
};

const emailHtmlBodyStyle: CSSProperties = {
  fontSize: 'var(--font-size-md)',
  color: 'var(--color-text-primary)',
  lineHeight: 'var(--line-height-normal)',
  fontFamily: 'var(--font-family)',
  overflowWrap: 'break-word',
  wordBreak: 'break-word',
};

const quotedToggleStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  margin: 'var(--spacing-sm) 0',
  padding: '2px var(--spacing-sm)',
  fontSize: 'var(--font-size-sm)',
  color: 'var(--color-text-tertiary)',
  background: 'var(--color-bg-tertiary)',
  border: '1px solid var(--color-border-primary)',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontFamily: 'var(--font-family)',
  letterSpacing: '1px',
};

function SafeEmailBody({ bodyHtml, bodyText }: { bodyHtml: string | null; bodyText: string | null }) {
  const [showQuoted, setShowQuoted] = useState(false);

  // Prefer HTML rendering when available
  if (bodyHtml) {
    const sanitized = DOMPurify.sanitize(bodyHtml, PURIFY_CONFIG);
    const { main, quoted } = separateQuotedContent(sanitized);

    return (
      <div>
        <div
          className="email-html-body"
          style={emailHtmlBodyStyle}
          dangerouslySetInnerHTML={{ __html: main }}
        />
        {quoted && (
          <>
            <button onClick={() => setShowQuoted(!showQuoted)} style={quotedToggleStyle}>
              {showQuoted ? 'Hide quoted text' : '\u2026'}
            </button>
            {showQuoted && (
              <div
                className="email-html-body"
                style={{ ...emailHtmlBodyStyle, opacity: 0.7 }}
                dangerouslySetInnerHTML={{ __html: quoted }}
              />
            )}
          </>
        )}
      </div>
    );
  }

  if (bodyText) {
    const { main, quoted } = separateQuotedText(bodyText);

    return (
      <div>
        <pre style={textBodyStyle}>{main}</pre>
        {quoted && (
          <>
            <button onClick={() => setShowQuoted(!showQuoted)} style={quotedToggleStyle}>
              {showQuoted ? 'Hide quoted text' : '\u2026'}
            </button>
            {showQuoted && (
              <pre style={{ ...textBodyStyle, opacity: 0.7 }}>{quoted}</pre>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-md)', margin: 0 }}>
      (no content)
    </p>
  );
}

interface EmailMessageProps {
  email: Email;
  isLatest?: boolean;
}

export function EmailMessage({ email, isLatest = false }: EmailMessageProps) {
  const [expanded, setExpanded] = useState(isLatest);

  const senderName = email.fromName || email.fromAddress;
  const recipientList = email.toAddresses.map((a) => a.name || a.address).join(', ');
  const ccList = email.ccAddresses.map((a) => a.name || a.address).join(', ');

  return (
    <div
      style={{
        borderBottom: '1px solid var(--color-border-primary)',
        background: 'var(--color-bg-primary)',
      }}
    >
      {/* Message header — clickable to expand/collapse */}
      <div
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--spacing-md)',
          padding: 'var(--spacing-lg)',
          cursor: 'pointer',
          transition: 'background var(--transition-fast)',
        }}
        onMouseEnter={(e) => {
          if (!expanded) e.currentTarget.style.background = 'var(--color-surface-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
        }}
      >
        <Avatar name={email.fromName} email={email.fromAddress} size={36} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--spacing-sm)',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: 'var(--font-size-md)',
                fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                color: 'var(--color-text-primary)',
              }}
            >
              {senderName}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              {email.attachments.length > 0 && (
                <Paperclip size={13} style={{ color: 'var(--color-text-tertiary)' }} />
              )}
              <span
                title={formatFullDate(email.receivedAt || email.internalDate)}
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                {formatRelativeTime(email.receivedAt || email.internalDate)}
              </span>
              {expanded ? (
                <ChevronUp size={14} style={{ color: 'var(--color-text-tertiary)' }} />
              ) : (
                <ChevronDown size={14} style={{ color: 'var(--color-text-tertiary)' }} />
              )}
            </div>
          </div>

          {expanded ? (
            <div
              style={{
                marginTop: 'var(--spacing-xs)',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-tertiary)',
              }}
            >
              <span>To: {recipientList || '(no recipients)'}</span>
              {ccList && <span style={{ marginLeft: 'var(--spacing-sm)' }}>CC: {ccList}</span>}
            </div>
          ) : (
            <div
              style={{
                marginTop: '2px',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-tertiary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {email.snippet || email.bodyText?.slice(0, 120) || ''}
            </div>
          )}
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: '0 var(--spacing-lg) var(--spacing-lg)' }}>
          <div style={{ marginLeft: `calc(36px + var(--spacing-md))` }}>
            <SafeEmailBody bodyHtml={email.bodyHtml} bodyText={email.bodyText} />

            {/* Attachments */}
            {email.attachments.filter((a) => !a.isInline).length > 0 && (
              <div
                style={{
                  marginTop: 'var(--spacing-lg)',
                  paddingTop: 'var(--spacing-md)',
                  borderTop: '1px solid var(--color-border-primary)',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 'var(--spacing-sm)',
                }}
              >
                {email.attachments
                  .filter((a) => !a.isInline)
                  .map((attachment) => (
                    <div
                      key={attachment.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 'var(--spacing-sm)',
                        padding: 'var(--spacing-sm) var(--spacing-md)',
                        background: 'var(--color-bg-elevated)',
                        border: '1px solid var(--color-border-primary)',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                      }}
                    >
                      <Paperclip size={13} style={{ color: 'var(--color-text-tertiary)' }} />
                      <div>
                        <div
                          style={{
                            fontSize: 'var(--font-size-sm)',
                            color: 'var(--color-text-primary)',
                            fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                          }}
                        >
                          {attachment.filename}
                        </div>
                        <div
                          style={{
                            fontSize: 'var(--font-size-xs)',
                            color: 'var(--color-text-tertiary)',
                          }}
                        >
                          {formatBytes(attachment.size || 0)}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
