import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../../components/ui/modal';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { useCreateDepartment } from '../../hooks';

const DEPARTMENT_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

export function CreateDepartmentModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(DEPARTMENT_COLORS[0]);
  const createDepartment = useCreateDepartment();

  const reset = () => {
    setName('');
    setDescription('');
    setColor(DEPARTMENT_COLORS[0]);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    createDepartment.mutate(
      {
        name: name.trim(),
        description: description.trim() || null,
        color,
        headEmployeeId: null,
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} width={440} title={t('hr.actions.addDepartment')}>
      <Modal.Header title={t('hr.actions.addDepartment')} subtitle={t('hr.actions.addDepartmentSubtitle')} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <Input label={t('hr.fields.departmentName')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('hr.placeholder.departmentName')} autoFocus />
          <Input label={t('hr.fields.description')} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('hr.fields.optionalDescription')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label className="hr-field-label">{t('hr.fields.color')}</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {DEPARTMENT_COLORS.map((c) => (
                <Button
                  key={c}
                  variant="ghost"
                  aria-label={`Select color ${c}`}
                  onClick={() => setColor(c)}
                  style={{
                    width: 28, height: 28, minWidth: 28, padding: 0,
                    borderRadius: 'var(--radius-md)', background: c,
                    border: color === c ? '2px solid var(--color-text-primary)' : '2px solid transparent',
                    cursor: 'pointer', transition: 'border-color 0.1s',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!name.trim()}>
          {t('hr.actions.addDepartment')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
