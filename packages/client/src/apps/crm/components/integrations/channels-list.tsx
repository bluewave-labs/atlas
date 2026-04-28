import { useTranslation } from 'react-i18next';
import { useChannels } from '../../hooks/use-channels';
import { ChannelRow } from './channel-row';

export function ChannelsList() {
  const { t } = useTranslation();
  const { data: channels, isLoading, isError } = useChannels();

  if (isLoading) return null;

  if (isError) {
    return (
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-error)' }}>
        {t('crm.integrations.channels.loadError', 'Failed to load channels.')}
      </div>
    );
  }

  if (!channels || channels.length === 0) {
    return (
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>
        {t('crm.integrations.channels.empty', 'No channels yet — connect a Google account to get started.')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      {channels.map((c) => (
        <ChannelRow key={c.id} channel={c} />
      ))}
    </div>
  );
}
