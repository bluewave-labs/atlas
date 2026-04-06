import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Check, XCircle, Trash2, Download } from 'lucide-react';
import { useLeaveTypes, useCreateLeaveType, useUpdateLeaveType, useDeleteLeaveType, useSeedLeaveTypes } from '../../hooks';
import { useMyAppPermission } from '../../../../hooks/use-app-permissions';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Badge } from '../../../../components/ui/badge';
import { IconButton } from '../../../../components/ui/icon-button';
import { Skeleton } from '../../../../components/ui/skeleton';
import { StatusDot } from '../../../../components/ui/status-dot';
import { FeatureEmptyState } from '../../../../components/ui/feature-empty-state';

export function LeaveTypesView() {
  const { t } = useTranslation();
  const { data: hrPerm } = useMyAppPermission('hr');
  const canDelete = !hrPerm || hrPerm.role === 'admin';
  const { data: leaveTypes, isLoading } = useLeaveTypes(true);
  const createLeaveType = useCreateLeaveType();
  const updateLeaveType = useUpdateLeaveType();
  const deleteLeaveType = useDeleteLeaveType();
  const seedLeaveTypes = useSeedLeaveTypes();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [days, setDays] = useState(0);
  const [carryForward, setCarryForward] = useState(0);

  const handleCreate = () => {
    if (!name.trim()) return;
    createLeaveType.mutate({
      name: name.trim(), slug: slug.trim() || name.trim().toLowerCase().replace(/\s+/g, '-'),
      color, defaultDaysPerYear: days, maxCarryForward: carryForward,
    }, { onSuccess: () => { setShowCreate(false); setName(''); setSlug(''); setDays(0); setCarryForward(0); } });
  };

  if (isLoading) return <div style={{ padding: 'var(--spacing-xl)' }}><Skeleton height={200} /></div>;

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-xl)' }}>
      {(!leaveTypes || leaveTypes.length === 0) && !showCreate && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <FeatureEmptyState
            illustration="generic"
            title={t('hr.leaveTypes.empty')}
            description={t('hr.leaveTypes.emptyDesc')}
            actionLabel={t('hr.leaveTypes.add')}
            actionIcon={<Plus size={14} />}
            onAction={() => setShowCreate(true)}
          />
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={() => seedLeaveTypes.mutate()}
            disabled={seedLeaveTypes.isPending}
            style={{ marginTop: 'var(--spacing-md)' }}
          >
            {t('hr.leaveTypes.loadDefaults')}
          </Button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {leaveTypes?.map((lt) => (
          <div key={lt.id} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', padding: 'var(--spacing-md) var(--spacing-lg)',
            borderBottom: '1px solid var(--color-border-secondary)',
          }}>
            <StatusDot color={lt.color} size={12} />
            <span style={{ flex: 1, fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
              {lt.name}
            </span>
            <span style={{ width: 80, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
              {lt.defaultDaysPerYear} {t('hr.leaveBalance.days').toLowerCase()}/{t('hr.period.yearly').toLowerCase()}
            </span>
            <span style={{ width: 80, fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
              {t('hr.leaveTypes.carry')}: {lt.maxCarryForward}
            </span>
            <Badge variant={lt.isPaid ? 'success' : 'default'}>{lt.isPaid ? t('hr.leaveTypes.paid') : t('hr.leaveTypes.unpaid')}</Badge>
            <Badge variant={lt.isActive ? 'primary' : 'default'}>{lt.isActive ? t('hr.status.active') : t('hr.leaveTypes.inactive')}</Badge>
            <IconButton
              icon={lt.isActive ? <XCircle size={14} /> : <Check size={14} />}
              label={lt.isActive ? t('hr.leaveTypes.deactivate') : t('hr.leaveTypes.activate')}
              size={26}
              onClick={() => updateLeaveType.mutate({ id: lt.id, isActive: !lt.isActive })}
            />
            {canDelete && <IconButton icon={<Trash2 size={14} />} label={t('common.delete')} size={26} destructive onClick={() => deleteLeaveType.mutate(lt.id)} />}
          </div>
        ))}
      </div>

      {showCreate && (
        <div style={{ marginTop: 'var(--spacing-lg)', padding: 'var(--spacing-lg)', border: '1px solid var(--color-border-primary)', borderRadius: 'var(--radius-lg)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
              <Input label={t('hr.fields.name')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('hr.placeholder.leaveTypeName')} style={{ flex: 1 }} autoFocus />
              <Input label={t('hr.leaveTypes.slug')} value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={t('hr.placeholder.leaveTypeSlug')} style={{ flex: 1 }} />
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
              <Input label={t('hr.leaveTypes.daysPerYear')} type="number" value={String(days)} onChange={(e) => setDays(Number(e.target.value))} style={{ flex: 1 }} />
              <Input label={t('hr.leaveTypes.maxCarry')} type="number" value={String(carryForward)} onChange={(e) => setCarryForward(Number(e.target.value))} style={{ flex: 1 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                <label className="hr-field-label">{t('hr.fields.color')}</label>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 34, height: 34, border: 'none', background: 'none', cursor: 'pointer' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end' }}>
              <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
              <Button variant="primary" size="sm" onClick={handleCreate} disabled={!name.trim()}>{t('common.save')}</Button>
            </div>
          </div>
        </div>
      )}

      {!showCreate && (
        <div style={{ marginTop: 'var(--spacing-lg)' }}>
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
            {t('hr.leaveTypes.add')}
          </Button>
        </div>
      )}
    </div>
  );
}
