import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToastStore } from '../../../stores/toast-store';
import { OdooImportUploader } from './odoo-import-uploader';
import { OdooImportPreviewView } from './odoo-import-preview';
import { OdooImportSummaryView } from './odoo-import-summary';
import { useOdooImportPreview, useOdooImportCommit } from './hooks';
import type { OdooImportPreview, OdooImportSummary } from '@atlas-platform/shared';

export function OdooImportWizard({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const [preview, setPreview] = useState<OdooImportPreview | null>(null);
  const [summary, setSummary] = useState<OdooImportSummary | null>(null);

  const previewMutation = useOdooImportPreview();
  const commitMutation = useOdooImportCommit();

  const handleUpload = (input: { partners: File; leads?: File; activities?: File }) => {
    previewMutation.mutate(input, {
      onSuccess: (data) => setPreview(data),
      onError: (err) => {
        addToast({ type: 'error', message: err instanceof Error ? err.message : t('import.odoo.previewFailed') });
      },
    });
  };

  const handleCommit = (stageMapping: Record<string, string>) => {
    if (!preview) return;
    commitMutation.mutate(
      { sessionId: preview.sessionId, stageMapping },
      {
        onSuccess: (data) => {
          setSummary(data);
          addToast({ type: 'success', message: t('import.odoo.commitSucceeded') });
        },
        onError: (err) => {
          addToast({ type: 'error', message: err instanceof Error ? err.message : t('import.odoo.commitFailed') });
        },
      },
    );
  };

  if (summary) {
    return <OdooImportSummaryView summary={summary} onDone={onClose} />;
  }
  if (preview) {
    return (
      <OdooImportPreviewView
        preview={preview}
        busy={commitMutation.isPending}
        onCommit={handleCommit}
        onCancel={() => setPreview(null)}
      />
    );
  }
  return <OdooImportUploader busy={previewMutation.isPending} onSubmit={handleUpload} />;
}
