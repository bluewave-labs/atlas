import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Send } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Badge } from '../../../../components/ui/badge';
import { useToastStore } from '../../../../stores/toast-store';
import { useMessage, useRetryMessage } from '../../hooks/use-send-message';
import { EmailComposerPopover } from '../email-composer/email-composer-popover';

export interface EmailActivityRowProps {
  activity: {
    id: string;
    type: string;
    messageId: string | null;
    createdAt: string;
  };
}

export function EmailActivityRow({ activity }: EmailActivityRowProps) {
  const { t } = useTranslation();
  const retry = useRetryMessage();
  const addToast = useToastStore((s) => s.addToast);
  const [showFullBody, setShowFullBody] = useState(false);

  const { data: message } = useMessage(activity.messageId);

  if (!message) {
    return (
      <div
        style={{
          padding: 'var(--spacing-sm)',
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'var(--font-family)',
        }}
      >
        ...
      </div>
    );
  }

  const isOutbound = activity.type === 'email-sent';
  const Icon = isOutbound ? Send : Mail;

  const statusBadge = (() => {
    if (!isOutbound) return null;
    if (message.status === 'pending')
      return <Badge variant="warning">{t('crm.composer.statusPending', 'Sending')}</Badge>;
    if (message.status === 'failed')
      return <Badge variant="error">{t('crm.composer.statusFailed', 'Failed')}</Badge>;
    if (message.status === 'sent')
      return <Badge variant="success">{t('crm.composer.statusSent', 'Sent')}</Badge>;
    return null;
  })();

  const handleRetry = () => {
    retry.mutate(message.id, {
      onSuccess: () =>
        addToast({ type: 'success', message: t('crm.composer.retryToast', 'Send retried') }),
      onError: (err: unknown) => {
        const anyErr = err as { response?: { data?: { error?: string } } };
        addToast({
          type: 'error',
          message: anyErr?.response?.data?.error ?? t('crm.composer.retryError', 'Failed to retry message'),
        });
      },
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-xs)',
        padding: 'var(--spacing-md)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-primary)',
        fontFamily: 'var(--font-family)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
        <Icon size={14} style={{ color: 'var(--color-text-secondary)' }} />
        <span
          style={{
            fontWeight: 'var(--font-weight-semibold)' as React.CSSProperties['fontWeight'],
            fontSize: 'var(--font-size-sm)',
          }}
        >
          {message.subject ?? t('crm.composer.noSubject', '(no subject)')}
        </span>
        {statusBadge}
      </div>

      <div
        style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
          whiteSpace: showFullBody ? 'pre-wrap' : 'nowrap',
          overflow: showFullBody ? 'visible' : 'hidden',
          textOverflow: 'ellipsis',
        }}
        onClick={() => setShowFullBody((v) => !v)}
      >
        {showFullBody ? (message.bodyText ?? message.snippet ?? '') : (message.snippet ?? '')}
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
        {message.status === 'failed' && (
          <Button size="sm" variant="secondary" onClick={handleRetry} disabled={retry.isPending}>
            {retry.isPending
              ? t('crm.composer.retrying', 'Retrying...')
              : t('crm.composer.retry', 'Retry')}
          </Button>
        )}
        {message.headerMessageId && (
          <EmailComposerPopover
            composerKey={`thread-${message.threadId}`}
            replyTo={{ inReplyTo: message.headerMessageId, threadId: message.threadId }}
            defaultSubject={
              message.subject?.startsWith('Re: ')
                ? message.subject
                : `Re: ${message.subject ?? ''}`
            }
            triggerLabel={t('crm.composer.reply', 'Reply')}
          />
        )}
      </div>
    </div>
  );
}
