import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, ChevronDown, ChevronRight, Paperclip } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { StatusDot } from '../../../components/ui/status-dot';
import { formatRelativeDate } from '../../../lib/format';
import {
  useContactEmails,
  useDealEmails,
  useGoogleSyncStatus,
  type CrmEmail,
} from '../hooks';
import { ComposeEmailModal } from './compose-email-modal';

// Safe HTML tag stripper — renders only plain text, no innerHTML usage
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function EmailItem({ email }: { email: CrmEmail }) {
  const [expanded, setExpanded] = useState(false);

  const bodyText = email.body || (email.bodyHtml ? stripHtml(email.bodyHtml) : null);

  return (
    <div
      style={{
        border: '1px solid var(--color-border-secondary)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--spacing-sm)',
          padding: 'var(--spacing-sm) var(--spacing-md)',
          background: expanded ? 'var(--color-bg-secondary)' : 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'var(--font-family)',
        }}
      >
        {/* Unread dot */}
        <div style={{ paddingTop: 6, flexShrink: 0 }}>
          {email.isUnread ? (
            <StatusDot color="var(--color-accent-primary)" size={8} />
          ) : (
            <div style={{ width: 8, height: 8 }} />
          )}
        </div>

        {/* Expand chevron */}
        <div style={{ paddingTop: 2, flexShrink: 0, color: 'var(--color-text-tertiary)' }}>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--spacing-sm)' }}>
            <span style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: email.isUnread ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
              color: 'var(--color-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {email.fromAddress}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', flexShrink: 0 }}>
              {email.hasAttachments && (
                <Paperclip size={12} style={{ color: 'var(--color-text-tertiary)' }} />
              )}
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', whiteSpace: 'nowrap' }}>
                {formatRelativeDate(email.internalDate)}
              </span>
            </div>
          </div>
          <div style={{
            fontSize: 'var(--font-size-sm)',
            color: email.isUnread ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            fontWeight: email.isUnread ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginTop: 2,
          }}>
            {email.subject || '(no subject)'}
          </div>
        </div>
      </button>

      {/* Expanded body — plain text only, no innerHTML */}
      {expanded && bodyText && (
        <div style={{
          padding: 'var(--spacing-md)',
          borderTop: '1px solid var(--color-border-secondary)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-family)',
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: 300,
          overflowY: 'auto',
        }}>
          {bodyText}
        </div>
      )}
    </div>
  );
}

export function EmailTimeline({
  contactId,
  dealId,
  defaultTo,
}: {
  contactId?: string;
  dealId?: string;
  defaultTo?: string;
}) {
  const { t } = useTranslation();
  const [showCompose, setShowCompose] = useState(false);

  const { data: status } = useGoogleSyncStatus();
  const { data: contactEmails, isLoading: contactLoading } = useContactEmails(contactId);
  const { data: dealEmails, isLoading: dealLoading } = useDealEmails(dealId);

  const emails = contactId ? contactEmails : dealEmails;
  const isLoading = contactId ? contactLoading : dealLoading;
  const googleConnected = status?.connected ?? false;

  if (!googleConnected) {
    return (
      <div style={{
        padding: 'var(--spacing-xl)',
        textAlign: 'center',
        color: 'var(--color-text-tertiary)',
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family)',
      }}>
        <Mail size={24} style={{ marginBottom: 'var(--spacing-sm)', opacity: 0.5 }} />
        <div>{t('crm.emails.connectToView')}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--spacing-md)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
        <span style={{
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-semibold)',
          color: 'var(--color-text-tertiary)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          fontFamily: 'var(--font-family)',
        }}>
          {t('crm.emails.title')}
        </span>
        <Button variant="secondary" size="sm" icon={<Mail size={14} />} onClick={() => setShowCompose(true)}>
          {t('crm.emails.compose')}
        </Button>
      </div>

      {/* Email list */}
      {isLoading ? (
        <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)' }}>
          Loading emails...
        </div>
      ) : !emails || emails.length === 0 ? (
        <div style={{ padding: 'var(--spacing-lg)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)' }}>
          {t('crm.emails.noEmails')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
          {emails.map((email) => (
            <EmailItem key={email.id} email={email} />
          ))}
        </div>
      )}

      {/* Compose modal */}
      <ComposeEmailModal
        open={showCompose}
        onClose={() => setShowCompose(false)}
        defaultTo={defaultTo}
        contactId={contactId}
        dealId={dealId}
      />
    </div>
  );
}
