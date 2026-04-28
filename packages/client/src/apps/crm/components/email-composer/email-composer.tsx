import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Textarea } from '../../../../components/ui/textarea';
import { useToastStore } from '../../../../stores/toast-store';
import { useSendMessage } from '../../hooks/use-send-message';
import { useComposerStore } from './use-composer-state';

export interface EmailComposerProps {
  /** Stable key — typically `contact-{contactId}` or `thread-{threadId}`. */
  composerKey: string;
  channelId: string;
  /** Initial value for `to` if the draft is empty (e.g. contact's email). */
  defaultTo?: string;
  /** Initial value for `subject` if the draft is empty. */
  defaultSubject?: string;
  /** Reply context, if this composer is replying to a message. */
  replyTo?: { inReplyTo: string; threadId: string };
  /** Called after a successful send (so the parent can close the popover). */
  onSent?: () => void;
}

function splitAddressList(s: string): string[] {
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export function EmailComposer(props: EmailComposerProps) {
  const { t } = useTranslation();
  const draft = useComposerStore((s) => s.getDraft(props.composerKey));
  const updateDraft = useComposerStore((s) => s.updateDraft);
  const clearDraft = useComposerStore((s) => s.clearDraft);
  const sendMessage = useSendMessage();
  const addToast = useToastStore((s) => s.addToast);

  const [showCc, setShowCc] = useState(draft.cc.length > 0 || draft.bcc.length > 0);

  const to = draft.to || props.defaultTo || '';
  const subject = draft.subject || props.defaultSubject || '';

  const handleSend = () => {
    sendMessage.mutate(
      {
        channelId: props.channelId,
        to: splitAddressList(to),
        cc: splitAddressList(draft.cc),
        bcc: splitAddressList(draft.bcc),
        subject,
        body: draft.body,
        inReplyTo: props.replyTo?.inReplyTo,
        threadId: props.replyTo?.threadId,
      },
      {
        onSuccess: () => {
          addToast({
            type: 'success',
            message: t('crm.composer.sentToast', 'Message queued for sending'),
          });
          clearDraft(props.composerKey);
          props.onSent?.();
        },
        onError: (err: any) => {
          addToast({
            type: 'error',
            message:
              err?.response?.data?.error ??
              t('crm.composer.sendError', 'Failed to send message'),
          });
        },
      },
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-sm)',
        padding: 'var(--spacing-md)',
        width: 480,
      }}
    >
      <Input
        size="sm"
        label={t('crm.composer.to', 'To')}
        value={to}
        onChange={(e) => updateDraft(props.composerKey, { to: e.target.value })}
        placeholder="alice@example.com, bob@example.com"
      />

      {showCc ? (
        <>
          <Input
            size="sm"
            label={t('crm.composer.cc', 'Cc')}
            value={draft.cc}
            onChange={(e) => updateDraft(props.composerKey, { cc: e.target.value })}
          />
          <Input
            size="sm"
            label={t('crm.composer.bcc', 'Bcc')}
            value={draft.bcc}
            onChange={(e) => updateDraft(props.composerKey, { bcc: e.target.value })}
          />
        </>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setShowCc(true)}>
          {t('crm.composer.addCcBcc', 'Add Cc / Bcc')}
        </Button>
      )}

      <Input
        size="sm"
        label={t('crm.composer.subject', 'Subject')}
        value={subject}
        onChange={(e) => updateDraft(props.composerKey, { subject: e.target.value })}
      />

      <Textarea
        label={t('crm.composer.body', 'Message')}
        value={draft.body}
        onChange={(e) => updateDraft(props.composerKey, { body: e.target.value })}
        rows={8}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
        <Button
          size="sm"
          variant="primary"
          onClick={handleSend}
          disabled={sendMessage.isPending || !to.trim() || !draft.body.trim()}
        >
          {sendMessage.isPending
            ? t('crm.composer.sending', 'Sending...')
            : t('crm.composer.send', 'Send')}
        </Button>
      </div>
    </div>
  );
}
