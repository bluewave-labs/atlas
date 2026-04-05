import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateClient } from '../../hooks';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Textarea } from '../../../../components/ui/textarea';
import { Modal } from '../../../../components/ui/modal';

export function CreateClientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const createClient = useCreateClient();

  const reset = () => { setName(''); setEmail(''); setPhone(''); setAddress(''); };

  const handleSubmit = () => {
    if (!name.trim()) return;
    createClient.mutate({
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
    }, {
      onSuccess: () => { reset(); onClose(); },
    });
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} width={440} title={t('projects.clients.newClient')}>
      <Modal.Header title={t('projects.clients.newClient')} subtitle={t('projects.clients.newClientSubtitle')} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <Input label={t('projects.clients.clientName')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('projects.clients.clientNamePlaceholder')} autoFocus />
          <Input label={t('projects.clients.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('projects.placeholder.email')} />
          <Input label={t('projects.clients.phone')} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('projects.placeholder.phone')} />
          <Textarea label={t('projects.clients.address')} value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>{t('projects.actions.cancel')}</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!name.trim()}>{t('projects.clients.addClient')}</Button>
      </Modal.Footer>
    </Modal>
  );
}
