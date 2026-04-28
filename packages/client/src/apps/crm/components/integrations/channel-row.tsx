import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/button';
import { Select } from '../../../../components/ui/select';
import { Badge } from '../../../../components/ui/badge';
import { useToastStore } from '../../../../stores/toast-store';
import {
  type ChannelDTO,
  useUpdateChannel,
  useSyncChannel,
} from '../../hooks/use-channels';

export function ChannelRow({ channel }: { channel: ChannelDTO }) {
  const { t } = useTranslation();
  const updateChannel = useUpdateChannel();
  const syncChannel = useSyncChannel();
  const addToast = useToastStore((s) => s.addToast);

  const onChange = (patch: Parameters<typeof updateChannel.mutate>[0]['patch']) => {
    updateChannel.mutate(
      { id: channel.id, updatedAt: channel.updatedAt, patch },
      {
        onError: (err: any) => {
          addToast({
            type: 'error',
            message: err?.response?.data?.error ?? t('crm.integrations.channels.updateError', 'Failed to update channel'),
          });
        },
      },
    );
  };

  const onSync = () => {
    syncChannel.mutate(channel.id, {
      onSuccess: () => {
        addToast({
          type: 'success',
          message: t('crm.integrations.channels.syncQueued', 'Sync queued'),
        });
      },
      onError: (err: any) => {
        addToast({
          type: 'error',
          message: err?.response?.data?.error ?? t('crm.integrations.channels.syncError', 'Failed to start sync'),
        });
      },
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-md)',
        padding: 'var(--spacing-md)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-primary)',
      }}
    >
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <span style={{ fontWeight: 'var(--font-weight-semibold)' as React.CSSProperties['fontWeight'] }}>{channel.handle}</span>
          <Badge variant={channel.syncStage === 'failed' ? 'error' : channel.syncStage === 'incremental' ? 'success' : 'default'}>
            {t(`crm.integrations.channels.stage.${channel.syncStage}`, channel.syncStage)}
          </Badge>
        </div>
        {channel.syncError && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-error)' }}>
            {channel.syncError}
          </div>
        )}
      </div>

      <Select
        size="sm"
        width="160px"
        value={channel.visibility}
        onChange={(v) => onChange({ visibility: v as ChannelDTO['visibility'] })}
        options={[
          { value: 'private', label: t('crm.integrations.channels.visibility.private', 'Private') },
          { value: 'shared-with-tenant', label: t('crm.integrations.channels.visibility.shared', 'Shared with team') },
        ]}
      />

      <Select
        size="sm"
        width="180px"
        value={channel.contactAutoCreationPolicy}
        onChange={(v) => onChange({ contactAutoCreationPolicy: v as ChannelDTO['contactAutoCreationPolicy'] })}
        options={[
          { value: 'none', label: t('crm.integrations.channels.policy.none', 'No auto-create') },
          { value: 'send-only', label: t('crm.integrations.channels.policy.sendOnly', 'From sent emails') },
          { value: 'send-and-receive', label: t('crm.integrations.channels.policy.sendAndReceive', 'From all emails') },
        ]}
      />

      <Button
        size="sm"
        variant={channel.isSyncEnabled ? 'secondary' : 'primary'}
        onClick={() => onChange({ isSyncEnabled: !channel.isSyncEnabled })}
      >
        {channel.isSyncEnabled
          ? t('crm.integrations.channels.pause', 'Pause sync')
          : t('crm.integrations.channels.resume', 'Resume sync')}
      </Button>

      <Button size="sm" variant="ghost" onClick={onSync} disabled={syncChannel.isPending}>
        {t('crm.integrations.channels.syncNow', 'Sync now')}
      </Button>
    </div>
  );
}
