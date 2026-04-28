import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '../../../../components/ui/popover';
import { Button } from '../../../../components/ui/button';
import { useChannels } from '../../hooks/use-channels';
import { EmailComposer } from './email-composer';

export interface EmailComposerPopoverProps {
  composerKey: string;
  defaultTo?: string;
  defaultSubject?: string;
  replyTo?: { inReplyTo: string; threadId: string };
  /** The trigger button label. Default: t('crm.composer.newEmail'). */
  triggerLabel?: string;
}

export function EmailComposerPopover(props: EmailComposerPopoverProps) {
  const { t } = useTranslation();
  const { data: channels } = useChannels();
  const [open, setOpen] = useState(false);

  // Pick the first owned, sync-enabled gmail channel as the default sender.
  // For Phase 2c most users have exactly one connected channel.
  const channel = channels?.find((c) => c.type === 'gmail' && c.isSyncEnabled) ?? null;

  if (!channel) {
    // No connected channel — render a disabled button so the affordance is
    // visible but unclickable. Settings > Integrations is where the user
    // connects an account.
    return (
      <Button size="sm" variant="secondary" disabled>
        {props.triggerLabel ?? t('crm.composer.newEmail', 'New email')}
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="secondary">
          {props.triggerLabel ?? t('crm.composer.newEmail', 'New email')}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={4}
        style={{
          padding: 0,
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-elevated)',
        }}
      >
        <EmailComposer
          composerKey={props.composerKey}
          channelId={channel.id}
          defaultTo={props.defaultTo}
          defaultSubject={props.defaultSubject}
          replyTo={props.replyTo}
          onSent={() => setOpen(false)}
        />
      </PopoverContent>
    </Popover>
  );
}
