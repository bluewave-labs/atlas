import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { useConflictStore } from '../../stores/conflict-store';
import { api } from '../../lib/api-client';

/**
 * Global dialog that prompts the user when a 409 STALE_RESOURCE conflict is
 * detected by the axios interceptor. Offers three paths:
 *   - Refresh: reject the pending promise and invalidate all React Query caches
 *   - Override: retry with If-Unmodified-Since header set to the server's
 *     current updatedAt, forcing the save
 *   - Cancel: close the dialog and reject the pending promise
 */
export function ConflictDialog() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const open = useConflictStore((s) => s.open);
  const pending = useConflictStore((s) => s.pending);
  const close = useConflictStore((s) => s.close);

  const handleCancel = () => {
    if (pending) {
      pending.reject({ code: 'CONFLICT_CANCELLED' });
    }
    close();
  };

  const handleRefresh = () => {
    if (pending) {
      pending.reject({ code: 'CONFLICT_REFRESHED' });
    }
    // Broad invalidation is safer than URL-derived key guessing.
    queryClient.invalidateQueries();
    close();
  };

  const handleOverride = async () => {
    if (!pending) {
      close();
      return;
    }
    const { request, currentUpdatedAt, resolve, reject } = pending;
    try {
      const retryRequest = {
        ...request,
        headers: {
          ...(request.headers ?? {}),
          'If-Unmodified-Since': currentUpdatedAt,
        },
      };
      const response = await api(retryRequest);
      resolve(response);
    } catch (err) {
      reject(err);
    } finally {
      close();
    }
  };

  // Only render when we have a pending conflict so the dialog state is
  // fully controlled by the store.
  const onOpenChange = (next: boolean) => {
    if (!next) handleCancel();
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      width={480}
      title={t('common.conflict.title', 'Conflicting changes')}
    >
      <Modal.Header title={t('common.conflict.title', 'Conflicting changes')} />
      <Modal.Body>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            lineHeight: 1.5,
            fontFamily: 'var(--font-family)',
          }}
        >
          {t(
            'common.conflict.description',
            'This record was modified by someone else while you were editing. Your changes are based on an older version.',
          )}
        </p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={handleRefresh}>
          {t('common.conflict.refresh', 'Refresh')}
        </Button>
        <Button variant="secondary" onClick={handleCancel}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button variant="danger" onClick={handleOverride}>
          {t('common.conflict.override', 'Override')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
