import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToastStore } from '../../../stores/toast-store';
import { OdooImportUploader } from './odoo-import-uploader';
import { OdooImportPreviewView } from './odoo-import-preview';
import { OdooImportProgressModal } from './odoo-import-progress';
import { useOdooImportPreview, useOdooImportCommit } from './hooks';
import type { OdooImportPreview, OdooImportSummary } from '@atlas-platform/shared';
import './data-import.css';

export function OdooImportWizard({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);
  const [preview, setPreview] = useState<OdooImportPreview | null>(null);
  const [summary, setSummary] = useState<OdooImportSummary | null>(null);
  const [progressOpen, setProgressOpen] = useState(false);

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
    setProgressOpen(true);
    commitMutation.mutate(
      { sessionId: preview.sessionId, stageMapping },
      {
        onSuccess: (data) => {
          setSummary(data);
          // Toast suppressed — the modal already celebrates the success.
        },
        onError: (err) => {
          setProgressOpen(false);
          addToast({ type: 'error', message: err instanceof Error ? err.message : t('import.odoo.commitFailed') });
        },
      },
    );
  };

  const handleOpenCrm = () => {
    setProgressOpen(false);
    onClose();
  };

  return (
    <>
      {preview ? (
        <OdooImportPreviewView
          preview={preview}
          busy={commitMutation.isPending}
          onCommit={handleCommit}
          onCancel={() => setPreview(null)}
        />
      ) : (
        <OdooImportUploader busy={previewMutation.isPending} onSubmit={handleUpload} />
      )}
      {preview && (
        <OdooImportProgressModal
          open={progressOpen}
          preview={preview}
          serverDone={!commitMutation.isPending && summary !== null}
          summary={summary}
          onOpenCrm={handleOpenCrm}
        />
      )}
    </>
  );
}
