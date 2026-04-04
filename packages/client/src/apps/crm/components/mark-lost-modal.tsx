import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/button';
import { Modal } from '../../../components/ui/modal';
import { Textarea } from '../../../components/ui/textarea';
import { useMarkDealLost } from '../hooks';

export function MarkLostModal({
  open, onClose, dealId,
}: {
  open: boolean;
  onClose: () => void;
  dealId: string;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const markLost = useMarkDealLost();

  const handleSubmit = () => {
    markLost.mutate({ id: dealId, reason: reason.trim() || undefined }, {
      onSuccess: () => { setReason(''); onClose(); },
    });
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} width={400} title={t('crm.deals.markAsLost')}>
      <Modal.Header title={t('crm.deals.markDealAsLost')} subtitle={t('crm.deals.markDealAsLostSubtitle')} />
      <Modal.Body>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('crm.deals.lostReasonPlaceholder')} rows={3} autoFocus />
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>{t('crm.actions.cancel')}</Button>
        <Button variant="danger" onClick={handleSubmit}>{t('crm.deals.markAsLost')}</Button>
      </Modal.Footer>
    </Modal>
  );
}
