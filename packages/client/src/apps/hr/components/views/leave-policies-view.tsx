import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Download } from 'lucide-react';
import { useLeaveTypes, useLeavePolicies, useCreateLeavePolicy, useSeedLeavePolicies } from '../../hooks';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Badge } from '../../../../components/ui/badge';
import { Skeleton } from '../../../../components/ui/skeleton';
import { StatusDot } from '../../../../components/ui/status-dot';
import { FeatureEmptyState } from '../../../../components/ui/feature-empty-state';

export function LeavePoliciesView() {
  const { t } = useTranslation();
  const { data: policies, isLoading } = useLeavePolicies();
  const { data: leaveTypes } = useLeaveTypes();
  const createPolicy = useCreateLeavePolicy();
  const seedPolicies = useSeedLeavePolicies();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    createPolicy.mutate({
      name: name.trim(), description: description.trim() || null,
      allocations: leaveTypes?.map(lt => ({ leaveTypeId: lt.id, daysPerYear: lt.defaultDaysPerYear })) || [],
    }, { onSuccess: () => { setShowCreate(false); setName(''); setDescription(''); } });
  };

  const getLeaveTypeName = (id: string) => leaveTypes?.find(lt => lt.id === id)?.name ?? id;
  const getLeaveTypeColor = (id: string) => leaveTypes?.find(lt => lt.id === id)?.color ?? '#6b7280';

  if (isLoading) return <div style={{ padding: 'var(--spacing-xl)' }}><Skeleton height={200} /></div>;

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 'var(--spacing-xl)' }}>
      {(!policies || policies.length === 0) && !showCreate && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <FeatureEmptyState
            illustration="generic"
            title={t('hr.policies.empty')}
            description={t('hr.policies.emptyDesc')}
            actionLabel={t('hr.policies.add')}
            actionIcon={<Plus size={14} />}
            onAction={() => setShowCreate(true)}
          />
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={14} />}
            onClick={() => seedPolicies.mutate()}
            disabled={seedPolicies.isPending}
            style={{ marginTop: 'var(--spacing-md)' }}
          >
            {t('hr.policies.loadDefaults')}
          </Button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {policies?.map((p) => (
          <div key={p.id} style={{
            padding: 'var(--spacing-lg)', border: '1px solid var(--color-border-secondary)',
            borderRadius: 'var(--radius-lg)', background: 'var(--color-bg-primary)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
              <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
                {p.name}
              </span>
              {p.isDefault && <Badge variant="primary">{t('hr.policies.default')}</Badge>}
            </div>
            {p.description && (
              <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--spacing-md)', fontFamily: 'var(--font-family)' }}>
                {p.description}
              </p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
              {p.allocations.map((alloc, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', padding: 'var(--spacing-xs) var(--spacing-sm)', background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)' }}>
                  <StatusDot color={getLeaveTypeColor(alloc.leaveTypeId)} size={8} />
                  <span style={{ color: 'var(--color-text-secondary)' }}>{getLeaveTypeName(alloc.leaveTypeId)}</span>
                  <span style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>{alloc.daysPerYear}d</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div style={{ marginTop: 'var(--spacing-lg)', padding: 'var(--spacing-lg)', border: '1px solid var(--color-border-primary)', borderRadius: 'var(--radius-lg)' }}>
          <Input label={t('hr.fields.name')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('hr.placeholder.policyName')} autoFocus />
          <div style={{ marginTop: 'var(--spacing-md)' }}>
            <Input label={t('hr.fields.description')} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('hr.fields.optionalDescription')} />
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', justifyContent: 'flex-end', marginTop: 'var(--spacing-md)' }}>
            <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" size="sm" onClick={handleCreate} disabled={!name.trim()}>{t('common.save')}</Button>
          </div>
        </div>
      )}

      {!showCreate && (
        <div style={{ marginTop: 'var(--spacing-lg)' }}>
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
            {t('hr.policies.add')}
          </Button>
        </div>
      )}
    </div>
  );
}
