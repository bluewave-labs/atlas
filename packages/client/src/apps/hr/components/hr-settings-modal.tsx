import {
  SettingsSection,
  SettingsRow,
} from '../../../components/settings/settings-primitives';

// ---------------------------------------------------------------------------
// Panel: General
// ---------------------------------------------------------------------------

export function HrGeneralPanel() {
  return (
    <div>
      <SettingsSection title="General">
        <SettingsRow label="Default view" description="Which section to show when opening HR">
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>Employees</span>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel: Appearance
// ---------------------------------------------------------------------------

export function HrAppearancePanel() {
  return (
    <div>
      <SettingsSection title="Display">
        <SettingsRow label="Show department in list" description="Display department column in employee list">
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)' }}>Enabled</span>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
