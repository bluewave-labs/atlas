import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SettingsSection,
  SettingsRow,
} from './settings-primitives';

export function AboutPanel() {
  const { t } = useTranslation();
  return (
    <div>
      <SettingsSection title={t('settings.aboutAtlas')}>
        <div
          style={{
            padding: 'var(--spacing-xl)',
            background: 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-secondary)',
            marginBottom: 'var(--spacing-xl)',
          }}
        >
          <div
            style={{
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-family)',
            }}
          >
            Atlas
          </div>
          <div
            style={{
              marginTop: 'var(--spacing-md)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-family)',
              lineHeight: 'var(--line-height-normal)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-sm)',
            }}
          >
            <p style={{ margin: 0 }}>{t('settings.aboutParagraph1')}</p>
            <p style={{ margin: 0 }}>{t('settings.aboutParagraph2')}</p>
          </div>
        </div>

        <SettingsRow label={t('settings.version')} description={t('settings.currentAppVersion')}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-secondary)',
              background: 'var(--color-bg-tertiary)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border-secondary)',
            }}
          >
            1.9.2
          </span>
        </SettingsRow>

      </SettingsSection>

    </div>
  );
}
