import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Clock } from 'lucide-react';
import { api } from '../../lib/api-client';
import { Button } from '../ui/button';
import { AlertBanner } from '../ui/alert-banner';
import {
  SettingsSection,
  SettingsRow,
} from './settings-primitives';

interface UpdateStatus {
  containerExists: boolean;
  autoUpdateEnabled: boolean;
  watchtowerReachable: boolean;
}

export function UpdatesPanel() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ['updates', 'status'],
    queryFn: async () => {
      const { data } = await api.get('/updates/status');
      return data.data as UpdateStatus;
    },
    staleTime: 10_000,
  });

  const toggleAutoUpdate = useMutation({
    mutationFn: async (enable: boolean) => {
      const { data } = await api.post(enable ? '/updates/enable' : '/updates/disable');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['updates', 'status'] });
    },
  });

  const checkNow = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/updates/check');
      return data;
    },
  });

  const containerExists = status?.containerExists ?? false;
  const autoUpdateEnabled = status?.autoUpdateEnabled ?? false;

  if (isLoading) return <div />;

  return (
      <SettingsSection
        title={t('settings.updates.title', 'Updates')}
        description={t('settings.updates.desc', 'Manage automatic updates for Atlas')}
      >
        {containerExists ? (
          <>
            <SettingsRow
              label={t('settings.updates.autoUpdate', 'Auto-update')}
              description={t('settings.updates.autoUpdateDesc', 'Automatically check for and install new versions nightly')}
            >
              <Button
                variant={autoUpdateEnabled ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => toggleAutoUpdate.mutate(!autoUpdateEnabled)}
                disabled={toggleAutoUpdate.isPending}
              >
                {autoUpdateEnabled
                  ? t('settings.updates.enabled', 'Enabled')
                  : t('settings.updates.disabled', 'Disabled')}
              </Button>
            </SettingsRow>

            {autoUpdateEnabled && (
              <SettingsRow
                label={t('settings.updates.schedule', 'Schedule')}
                description={t('settings.updates.scheduleDesc', 'When Atlas checks for and applies updates')}
              >
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-family)',
                }}>
                  <Clock size={14} />
                  {t('settings.updates.nightly', 'Nightly (3:00 AM)')}
                </span>
              </SettingsRow>
            )}

            {autoUpdateEnabled && (
              <SettingsRow
                label={t('settings.updates.checkNow', 'Check for updates')}
                description={t('settings.updates.checkNowDesc', 'Manually check if a newer version is available')}
              >
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<RefreshCw size={13} className={checkNow.isPending ? 'tables-spin' : undefined} />}
                  onClick={() => checkNow.mutate()}
                  disabled={checkNow.isPending}
                >
                  {checkNow.isPending
                    ? t('settings.updates.checking', 'Checking...')
                    : t('settings.updates.checkButton', 'Check now')}
                </Button>
              </SettingsRow>
            )}

            {checkNow.isSuccess && (
              <AlertBanner variant="success">
                {t('settings.updates.checkSuccess', 'Update check complete. If a new version is available it will be applied automatically.')}
              </AlertBanner>
            )}

            {checkNow.isError && (
              <AlertBanner variant="warning">
                {t('settings.updates.checkError', 'Could not reach the update service. Try enabling auto-update first.')}
              </AlertBanner>
            )}
          </>
        ) : (
          <AlertBanner variant="info">
            {t('settings.updates.notAvailable', 'Auto-updates are available when running Atlas with Docker Compose. The update service container was not found.')}
          </AlertBanner>
        )}
      </SettingsSection>
  );
}
