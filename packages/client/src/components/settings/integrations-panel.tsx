import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api-client';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { AlertBanner } from '../ui/alert-banner';
import {
  SettingsSection,
  SettingsRow,
} from './settings-primitives';
import { useAuthStore } from '../../stores/auth-store';
import { useToastStore } from '../../stores/toast-store';
import { useGoogleDriveStatus } from '../../apps/drive/hooks';

export function IntegrationsPanel() {
  const { t } = useTranslation();
  const tenantRole = useAuthStore((s) => s.tenantRole);
  const isAdmin = tenantRole === 'owner' || tenantRole === 'admin';
  const [connectingDrive, setConnectingDrive] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['integrations', 'google-status'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/crm/google/status');
        return data.data as {
          googleConfigured: boolean;
          connected: boolean;
          email?: string;
          syncStatus?: string;
          lastSync?: string;
        };
      } catch {
        return { googleConfigured: false, connected: false };
      }
    },
    staleTime: 30_000,
  });

  const driveStatus = useGoogleDriveStatus();

  const handleConnect = async () => {
    try {
      const { data } = await api.get('/auth/google/connect');
      window.open(data.data.url, '_blank', 'width=600,height=700');
    } catch {
      addToast({ type: 'error', message: t('settings.integrations.connectError', 'Failed to connect Google account') });
    }
  };

  const handleConnectDrive = async () => {
    setConnectingDrive(true);
    try {
      const { data } = await api.get('/drive/google/connect');
      window.open(data.data.url, '_blank', 'width=600,height=700');
    } catch {
      addToast({ type: 'error', message: t('settings.integrations.driveConnectError', 'Failed to connect Google Drive') });
    } finally {
      setConnectingDrive(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.post('/auth/google/disconnect');
      refetch();
    } catch {
      addToast({ type: 'error', message: t('settings.integrations.disconnectError', 'Failed to disconnect Google account') });
    }
  };

  if (isLoading) return <div />;

  return (
      <SettingsSection
        title={t('settings.integrations.google', 'Google')}
        description={t('settings.integrations.googleDesc', 'Connect Google for email sync, calendar sync, and Drive file import/export')}
      >
        {!status?.googleConfigured ? (
          // ─── Google not configured (show setup instructions for admins) ──
          isAdmin ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <AlertBanner variant="info">
                {t('settings.integrations.notConfigured', 'Google integration is not configured. Set up OAuth credentials to enable Gmail sync, Calendar sync, and Drive import/export.')}
              </AlertBanner>

              <div style={{
                padding: 'var(--spacing-lg)',
                background: 'var(--color-bg-tertiary)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border-secondary)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family)',
                color: 'var(--color-text-secondary)',
                lineHeight: 'var(--line-height-normal)',
              }}>
                <div style={{ fontWeight: 'var(--font-weight-semibold)' as React.CSSProperties['fontWeight'], color: 'var(--color-text-primary)', marginBottom: 'var(--spacing-sm)' }}>
                  {t('settings.integrations.setupTitle', 'Setup instructions')}
                </div>
                <ol style={{ margin: 0, paddingLeft: 'var(--spacing-xl)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                  <li>{t('settings.integrations.step1', 'Go to Google Cloud Console → APIs & Services → Credentials')}</li>
                  <li>{t('settings.integrations.step2', 'Create an OAuth 2.0 Client ID (type: Web application)')}</li>
                  <li>{t('settings.integrations.step3', 'Set the redirect URI to:')}
                    <code style={{
                      display: 'block',
                      marginTop: 4,
                      padding: '4px 8px',
                      background: 'var(--color-bg-primary)',
                      borderRadius: 'var(--radius-sm)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--font-size-xs)',
                      wordBreak: 'break-all',
                    }}>
                      {`${window.location.origin}/api/v1/auth/google/callback`}
                    </code>
                  </li>
                  <li>{t('settings.integrations.step4', 'Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your .env file')}</li>
                  <li>{t('settings.integrations.step5', 'Enable Gmail API, Google Calendar API, and Google Drive API in APIs & Services → Library')}</li>
                  <li>{t('settings.integrations.step6', 'Restart Atlas to apply the changes')}</li>
                </ol>
              </div>
            </div>
          ) : (
            <AlertBanner variant="info">
              {t('settings.integrations.contactAdmin', 'Google integration is not set up. Contact your administrator to enable it.')}
            </AlertBanner>
          )
        ) : !status?.connected ? (
          // ─── Google configured but not connected ──
          <SettingsRow
            label={t('settings.integrations.googleAccount', 'Google account')}
            description={t('settings.integrations.connectDesc', 'Connect to enable email sync, calendar sync, and Drive import/export')}
          >
            <Button variant="primary" size="sm" onClick={handleConnect}>
              {t('settings.integrations.connect', 'Connect Google')}
            </Button>
          </SettingsRow>
        ) : (
          // ─── Google connected ──
          <>
            <SettingsRow
              label={t('settings.integrations.googleAccount', 'Google account')}
              description={status.email || ''}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                <Badge variant="success">
                  <CheckCircle2 size={11} style={{ marginRight: 3 }} />
                  {t('settings.integrations.connected', 'Connected')}
                </Badge>
                <Button variant="danger" size="sm" onClick={handleDisconnect}>
                  {t('settings.integrations.disconnect', 'Disconnect')}
                </Button>
              </div>
            </SettingsRow>

            <SettingsRow
              label={t('settings.integrations.emailCalendar', 'Email & Calendar')}
              description={t('settings.integrations.emailCalendarDesc', 'Gmail and Google Calendar sync')}
            >
              <Badge variant="success">{t('settings.integrations.active', 'Active')}</Badge>
            </SettingsRow>

            <SettingsRow
              label={t('settings.integrations.googleDrive', 'Google Drive')}
              description={t('settings.integrations.googleDriveDesc', 'Import and export files between Atlas Drive and Google Drive')}
            >
              {driveStatus.data?.driveScoped ? (
                <Badge variant="success">{t('settings.integrations.active', 'Active')}</Badge>
              ) : (
                <Button variant="secondary" size="sm" onClick={handleConnectDrive} disabled={connectingDrive}>
                  {t('settings.integrations.enableDrive', 'Enable Drive access')}
                </Button>
              )}
            </SettingsRow>
          </>
        )}
      </SettingsSection>
  );
}
