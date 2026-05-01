import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { useToastStore } from '../../../../stores/toast-store';
import { useTenantSettings, useUpdateRetention } from '../../hooks/use-tenant-settings';

export function RetentionSection() {
  const { t } = useTranslation();
  const { data: settings, isLoading } = useTenantSettings();
  const updateRetention = useUpdateRetention();
  const addToast = useToastStore((s) => s.addToast);
  const [draft, setDraft] = useState<string>('');
  // Initialize the draft only on the first non-undefined settings payload.
  // Re-firing on later refetches would clobber the user's in-progress edit.
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current && settings) {
      setDraft(
        settings.gmailRetentionDays == null ? '' : String(settings.gmailRetentionDays),
      );
      initializedRef.current = true;
    }
  }, [settings]);

  const handleSave = () => {
    const trimmed = draft.trim();
    let value: number | null;
    if (trimmed === '') {
      value = null;
    } else {
      const n = Number(trimmed);
      if (!Number.isInteger(n) || n <= 0) {
        addToast({
          type: 'error',
          message: t(
            'crm.integrations.retention.invalidValue',
            'Enter a positive integer or leave blank',
          ),
        });
        return;
      }
      value = n;
    }
    updateRetention.mutate(value, {
      onSuccess: () =>
        addToast({
          type: 'success',
          message: t('crm.integrations.retention.savedToast', 'Retention updated'),
        }),
      onError: (err: unknown) => {
        const anyErr = err as { response?: { data?: { error?: string } } };
        addToast({
          type: 'error',
          message:
            anyErr?.response?.data?.error ??
            t('crm.integrations.retention.saveError', 'Failed to update retention'),
        });
      },
    });
  };

  if (isLoading) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      <div
        style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-family)',
        }}
      >
        {t(
          'crm.integrations.retention.description',
          'Auto-delete emails older than N days. Leave blank to retain forever.',
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--spacing-sm)' }}>
        <div style={{ flex: 1 }}>
          <Input
            size="sm"
            label={t('crm.integrations.retention.label', 'Days to retain')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t(
              'crm.integrations.retention.forever',
              'Retain forever (no auto-delete)',
            )}
            inputMode="numeric"
          />
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={handleSave}
          disabled={updateRetention.isPending}
        >
          {updateRetention.isPending
            ? t('crm.integrations.retention.saving', 'Saving...')
            : t('crm.integrations.retention.save', 'Save')}
        </Button>
      </div>
    </div>
  );
}
