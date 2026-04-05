import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../../../../components/ui/modal';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { useCreateEmployee, type HrDepartment } from '../../hooks';

export function CreateEmployeeModal({
  open,
  onClose,
  departments,
}: {
  open: boolean;
  onClose: () => void;
  departments: HrDepartment[];
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [startDate, setStartDate] = useState('');
  const createEmployee = useCreateEmployee();

  const reset = () => {
    setName('');
    setEmail('');
    setRole('');
    setDepartmentId('');
    setStartDate('');
  };

  const handleSubmit = () => {
    if (!name.trim() || !email.trim()) return;
    createEmployee.mutate(
      {
        name: name.trim(),
        email: email.trim(),
        phone: null,
        role: role.trim() || 'Employee',
        departmentId: departmentId || null,
        status: 'active',
        startDate: startDate || new Date().toISOString().slice(0, 10),
        avatarUrl: null,
        tags: [],
        notes: null,
        dateOfBirth: null,
        gender: null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        emergencyContactRelation: null,
        employmentType: 'full-time',
        managerId: null,
        jobTitle: null,
        workLocation: null,
        salary: null,
        salaryCurrency: 'USD',
        salaryPeriod: 'yearly',
      } as any,
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      },
    );
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()} width={440} title={t('hr.actions.addEmployee')}>
      <Modal.Header title={t('hr.actions.addEmployee')} subtitle={t('hr.actions.addEmployeeSubtitle')} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <Input label={t('hr.fields.fullName')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('hr.placeholder.fullName')} autoFocus />
          <Input label={t('hr.fields.email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('hr.placeholder.email')} />
          <Input label={t('hr.fields.role')} value={role} onChange={(e) => setRole(e.target.value)} placeholder={t('hr.placeholder.role')} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <label className="hr-field-label">{t('hr.fields.department')}</label>
            <Select
              value={departmentId}
              onChange={setDepartmentId}
              options={[
                { value: '', label: t('hr.fields.none') },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
              placeholder={t('hr.fields.selectDepartment')}
            />
          </div>
          <Input label={t('hr.fields.startDate')} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose}>{t('common.cancel')}</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={!name.trim() || !email.trim()}>
          {t('hr.actions.addEmployee')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
