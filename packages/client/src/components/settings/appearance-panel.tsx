import { type CSSProperties } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, type FontFamilyId } from '../../stores/settings-store';
import {
  SettingsSection,
  SettingsRow,
  SettingsToggle,
  SelectableCard,
  SettingsSelect,
} from './settings-primitives';
import { SUPPORTED_LANGUAGES } from '../../i18n';

// ---------------------------------------------------------------------------
// AppearancePanel
// ---------------------------------------------------------------------------

export function AppearancePanel() {
  const { t } = useTranslation();
  const {
    theme,
    fontFamily,
    language,
    themeTransition,
    setTheme,
    setFontFamily,
    setLanguage,
    setThemeTransition,
  } = useSettingsStore();

  const themeOptions: Array<{ value: typeof theme; label: string; icon: typeof Sun; desc: string }> = [
    { value: 'light', label: t('settings.light'), icon: Sun, desc: t('settings.lightDesc') },
    { value: 'dark', label: t('settings.dark'), icon: Moon, desc: t('settings.darkDesc') },
    { value: 'system', label: t('settings.system'), icon: Monitor, desc: t('settings.systemDesc') },
  ];

  const fontOptions: Array<{ value: FontFamilyId; label: string; css: string }> = [
    { value: 'inter', label: 'Inter', css: "'Inter', sans-serif" },
    { value: 'geist', label: 'Geist', css: "'Geist', sans-serif" },
    { value: 'roboto', label: 'Roboto', css: "'Roboto', sans-serif" },
    { value: 'open-sans', label: 'Open Sans', css: "'Open Sans', sans-serif" },
    { value: 'lato', label: 'Lato', css: "'Lato', sans-serif" },
    { value: 'system', label: 'System default', css: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  ];

  const languageOptions = SUPPORTED_LANGUAGES.map((lang) => ({
    value: lang.code,
    label: lang.label,
  }));

  return (
    <div>
      <SettingsSection title={t('settings.theme')} description={t('settings.themeDescription')}>
        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
          {themeOptions.map(({ value, label, icon: Icon, desc }) => (
            <SelectableCard
              key={value}
              selected={theme === value}
              onClick={() => setTheme(value)}
              style={{ flex: 1, minHeight: 100 }}
            >
              <Icon
                size={24}
                style={{
                  color: theme === value ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  transition: 'color var(--transition-normal)',
                }}
              />
              <span
                style={{
                  fontSize: 'var(--font-size-md)',
                  fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                  color: theme === value ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                }}
              >
                {label}
              </span>
              <span
                style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                {desc}
              </span>
            </SelectableCard>
          ))}
        </div>
      </SettingsSection>


      <SettingsSection title={t('settings.language')} description={t('settings.languageDescription')}>
        <SettingsSelect
          value={language}
          options={languageOptions}
          onChange={(v) => setLanguage(v as string)}
        />
      </SettingsSection>

      <SettingsSection title={t('settings.font')} description={t('settings.fontDescription')}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--spacing-sm)',
        }}>
          {fontOptions.map((font) => {
            const isActive = fontFamily === font.value;
            return (
              <button
                key={font.value}
                onClick={() => setFontFamily(font.value)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: 'var(--spacing-md) var(--spacing-sm)',
                  background: isActive
                    ? 'var(--color-accent-subtle)'
                    : 'transparent',
                  border: isActive
                    ? '1.5px solid var(--color-accent-primary)'
                    : '1px solid var(--color-border-secondary)',
                  borderRadius: 'var(--radius-lg)',
                  cursor: 'pointer',
                  fontFamily: font.css,
                  transition: 'border-color var(--transition-normal), background var(--transition-normal)',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                    e.currentTarget.style.background = 'var(--color-surface-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <span style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                }}>
                  Aa
                </span>
                <span style={{
                  fontSize: 'var(--font-size-xs)',
                  color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  fontWeight: isActive ? 'var(--font-weight-medium)' as CSSProperties['fontWeight'] : 'var(--font-weight-normal)' as CSSProperties['fontWeight'],
                }}>
                  {font.label}
                </span>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection title={t('settings.animations')} description={t('settings.animationsDescription')}>
        <SettingsRow
          label={t('settings.themeTransition')}
          description={t('settings.themeTransitionDesc')}
        >
          <SettingsToggle
            checked={themeTransition}
            onChange={setThemeTransition}
            label={t('settings.themeTransition')}
          />
        </SettingsRow>
      </SettingsSection>

    </div>
  );
}
