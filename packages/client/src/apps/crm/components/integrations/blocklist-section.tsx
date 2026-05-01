import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { useToastStore } from '../../../../stores/toast-store';
import {
  useBlocklist,
  useAddBlocklistEntry,
  useDeleteBlocklistEntry,
} from '../../hooks/use-blocklist';

export function BlocklistSection() {
  const { t } = useTranslation();
  const { data: entries, isLoading } = useBlocklist();
  const addEntry = useAddBlocklistEntry();
  const deleteEntry = useDeleteBlocklistEntry();
  const addToast = useToastStore((s) => s.addToast);
  const [draft, setDraft] = useState('');

  const handleAdd = () => {
    const pattern = draft.trim();
    if (!pattern) {
      addToast({
        type: 'error',
        message: t('crm.integrations.blocklist.patternRequired', 'Pattern is required'),
      });
      return;
    }
    addEntry.mutate(pattern, {
      onSuccess: () => {
        addToast({
          type: 'success',
          message: t('crm.integrations.blocklist.addedToast', 'Pattern added'),
        });
        setDraft('');
      },
      onError: (err: unknown) => {
        const anyErr = err as { response?: { data?: { error?: string } } };
        addToast({
          type: 'error',
          message:
            anyErr?.response?.data?.error ??
            t('crm.integrations.blocklist.addError', 'Failed to add pattern'),
        });
      },
    });
  };

  const handleRemove = (id: string) => {
    deleteEntry.mutate(id, {
      onSuccess: () =>
        addToast({
          type: 'success',
          message: t('crm.integrations.blocklist.removedToast', 'Pattern removed'),
        }),
      onError: (err: unknown) => {
        const anyErr = err as { response?: { data?: { error?: string } } };
        addToast({
          type: 'error',
          message:
            anyErr?.response?.data?.error ??
            t('crm.integrations.blocklist.removeError', 'Failed to remove pattern'),
        });
      },
    });
  };

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
          'crm.integrations.blocklist.description',
          'Patterns that prevent contact auto-creation.',
        )}
      </div>

      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <Input
            size="sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('crm.integrations.blocklist.addPlaceholder', 'pattern')}
          />
        </div>
        <Button
          size="sm"
          variant="primary"
          onClick={handleAdd}
          disabled={addEntry.isPending || !draft.trim()}
        >
          {t('crm.integrations.blocklist.add', 'Add')}
        </Button>
      </div>

      {isLoading ? null : entries && entries.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
          {entries.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--spacing-xs) var(--spacing-sm)',
                background: 'var(--color-bg-secondary)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border-secondary)',
              }}
            >
              <span
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-family)',
                }}
              >
                {entry.pattern}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleRemove(entry.id)}
                disabled={deleteEntry.isPending}
              >
                {t('crm.integrations.blocklist.remove', 'Remove')}
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-tertiary)',
            fontFamily: 'var(--font-family)',
          }}
        >
          {t('crm.integrations.blocklist.empty', 'No patterns yet.')}
        </div>
      )}
    </div>
  );
}
