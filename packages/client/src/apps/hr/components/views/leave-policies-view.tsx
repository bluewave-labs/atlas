import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Download, Pencil, Trash2, Check, X } from 'lucide-react';
import {
  useLeaveTypes, useLeavePolicies, useCreateLeavePolicy,
  useUpdateLeavePolicy, useDeleteLeavePolicy, useResyncPolicyBalances, useSeedLeavePolicies,
} from '../../hooks';
import { useToastStore } from '../../../../stores/toast-store';
import type { HrLeaveType } from '../../hooks';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Badge } from '../../../../components/ui/badge';
import { Skeleton } from '../../../../components/ui/skeleton';
import { StatusDot } from '../../../../components/ui/status-dot';
import { FeatureEmptyState } from '../../../../components/ui/feature-empty-state';
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog';

// ─── Allocation Editor (shared between create & edit) ────────────

interface AllocationRow {
  leaveTypeId: string;
  daysPerYear: number;
}

function AllocationEditor({
  leaveTypes,
  allocations,
  onChange,
}: {
  leaveTypes: HrLeaveType[];
  allocations: AllocationRow[];
  onChange: (allocations: AllocationRow[]) => void;
}) {
  const { t } = useTranslation();
  const allocMap = new Map(allocations.map(a => [a.leaveTypeId, a.daysPerYear]));

  const handleChange = (leaveTypeId: string, days: number) => {
    const updated = leaveTypes.map(lt => ({
      leaveTypeId: lt.id,
      daysPerYear: lt.id === leaveTypeId ? days : (allocMap.get(lt.id) ?? lt.defaultDaysPerYear),
    }));
    onChange(updated);
  };

  return (
    <div style={{
      border: '1px solid var(--color-border-secondary)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 100px 60px',
        gap: 'var(--spacing-sm)',
        padding: 'var(--spacing-sm) var(--spacing-md)',
        background: 'var(--color-bg-secondary)',
        borderBottom: '1px solid var(--color-border-secondary)',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-medium)',
        color: 'var(--color-text-tertiary)',
        fontFamily: 'var(--font-family)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
      }}>
        <span>{t('hr.policies.leaveType')}</span>
        <span>{t('hr.policies.daysPerYear')}</span>
        <span>{t('hr.policies.paidLabel')}</span>
      </div>

      {/* Rows */}
      {leaveTypes.map(lt => (
        <div key={lt.id} style={{
          display: 'grid',
          gridTemplateColumns: '1fr 100px 60px',
          gap: 'var(--spacing-sm)',
          padding: 'var(--spacing-xs) var(--spacing-md)',
          alignItems: 'center',
          borderBottom: '1px solid var(--color-border-secondary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <StatusDot color={lt.color} size={8} />
            <span style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-primary)',
              fontFamily: 'var(--font-family)',
            }}>
              {lt.name}
            </span>
          </div>
          <Input
            type="number"
            size="sm"
            value={String(allocMap.get(lt.id) ?? lt.defaultDaysPerYear)}
            onChange={(e) => handleChange(lt.id, Math.max(0, parseInt(e.target.value) || 0))}
            style={{ width: 80 }}
          />
          <div>
            {lt.isPaid ? (
              <Badge variant="success">{t('hr.policies.paid')}</Badge>
            ) : (
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>—</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Policy Card ─────────────────────────────────────────────────

function PolicyCard({
  policy,
  leaveTypes,
}: {
  policy: { id: string; name: string; description: string | null; isDefault: boolean; allocations: AllocationRow[] };
  leaveTypes: HrLeaveType[];
}) {
  const { t } = useTranslation();
  const updatePolicy = useUpdateLeavePolicy();
  const deletePolicy = useDeleteLeavePolicy();
  const resyncBalances = useResyncPolicyBalances();
  const addToast = useToastStore((s) => s.addToast);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(policy.name);
  const [editDesc, setEditDesc] = useState(policy.description ?? '');
  const [editAllocations, setEditAllocations] = useState<AllocationRow[]>(policy.allocations);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const hasChanges = editName !== policy.name
    || editDesc !== (policy.description ?? '')
    || JSON.stringify(editAllocations) !== JSON.stringify(policy.allocations);

  const startEditing = useCallback(() => {
    setEditName(policy.name);
    setEditDesc(policy.description ?? '');
    setEditAllocations(policy.allocations);
    setIsEditing(true);
  }, [policy]);

  const cancelEditing = () => {
    setIsEditing(false);
    setEditName(policy.name);
    setEditDesc(policy.description ?? '');
    setEditAllocations(policy.allocations);
  };

  const handleSave = () => {
    if (!editName.trim()) return;
    const allocationsChanged = JSON.stringify(editAllocations) !== JSON.stringify(policy.allocations);
    updatePolicy.mutate({
      id: policy.id,
      name: editName.trim(),
      description: editDesc.trim() || null,
      allocations: editAllocations,
    }, {
      onSuccess: () => {
        setIsEditing(false);
        if (allocationsChanged) {
          resyncBalances.mutate(policy.id, {
            onSuccess: (result) => {
              if (result.updated > 0) {
                addToast({ type: 'success', message: t('hr.policies.balancesUpdated', { count: result.updated }) });
              }
            },
          });
        }
      },
    });
  };

  const handleDelete = () => {
    deletePolicy.mutate(policy.id, {
      onSuccess: () => setShowDeleteConfirm(false),
    });
  };

  const getLeaveTypeName = (id: string) => leaveTypes.find(lt => lt.id === id)?.name ?? id;
  const getLeaveTypeColor = (id: string) => leaveTypes.find(lt => lt.id === id)?.color ?? '#6b7280';
  const getLeaveTypeIsPaid = (id: string) => leaveTypes.find(lt => lt.id === id)?.isPaid ?? true;

  return (
    <>
      <div style={{
        padding: 'var(--spacing-lg)',
        border: '1px solid var(--color-border-secondary)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--color-bg-primary)',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--spacing-sm)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flex: 1 }}>
            {isEditing ? (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                size="sm"
                autoFocus
                style={{ maxWidth: 300 }}
              />
            ) : (
              <span style={{
                fontSize: 'var(--font-size-md)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-family)',
              }}>
                {policy.name}
              </span>
            )}
            {policy.isDefault && <Badge variant="primary">{t('hr.policies.default')}</Badge>}
          </div>

          <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
            {!isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Pencil size={14} />}
                  onClick={startEditing}
                  aria-label={t('common.edit')}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 size={14} />}
                  onClick={() => setShowDeleteConfirm(true)}
                  aria-label={t('common.delete')}
                />
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<X size={14} />}
                  onClick={cancelEditing}
                  aria-label={t('common.cancel')}
                />
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Check size={14} />}
                  onClick={handleSave}
                  disabled={!editName.trim() || !hasChanges || updatePolicy.isPending}
                  aria-label={t('common.save')}
                >
                  {t('common.save')}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Description */}
        {isEditing ? (
          <div style={{ marginBottom: 'var(--spacing-md)', maxWidth: 400 }}>
            <Input
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              size="sm"
              placeholder={t('hr.fields.optionalDescription')}
            />
          </div>
        ) : (
          policy.description && (
            <p style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-tertiary)',
              marginBottom: 'var(--spacing-md)',
              fontFamily: 'var(--font-family)',
            }}>
              {policy.description}
            </p>
          )
        )}

        {/* Allocations */}
        {isEditing ? (
          <AllocationEditor
            leaveTypes={leaveTypes}
            allocations={editAllocations}
            onChange={setEditAllocations}
          />
        ) : (
          <div style={{
            border: '1px solid var(--color-border-secondary)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}>
            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 100px 60px',
              gap: 'var(--spacing-sm)',
              padding: 'var(--spacing-sm) var(--spacing-md)',
              background: 'var(--color-bg-secondary)',
              borderBottom: '1px solid var(--color-border-secondary)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-medium)',
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-family)',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.05em',
            }}>
              <span>{t('hr.policies.leaveType')}</span>
              <span>{t('hr.policies.daysPerYear')}</span>
              <span>{t('hr.policies.paidLabel')}</span>
            </div>

            {/* Rows */}
            {policy.allocations.map((alloc) => (
              <div key={alloc.leaveTypeId} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 100px 60px',
                gap: 'var(--spacing-sm)',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                alignItems: 'center',
                borderBottom: '1px solid var(--color-border-secondary)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                  <StatusDot color={getLeaveTypeColor(alloc.leaveTypeId)} size={8} />
                  <span style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-family)',
                  }}>
                    {getLeaveTypeName(alloc.leaveTypeId)}
                  </span>
                </div>
                <span style={{
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-medium)',
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-family)',
                }}>
                  {alloc.daysPerYear}
                </span>
                <div>
                  {getLeaveTypeIsPaid(alloc.leaveTypeId) ? (
                    <Badge variant="success">{t('hr.policies.paid')}</Badge>
                  ) : (
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>—</span>
                  )}
                </div>
              </div>
            ))}

            {policy.allocations.length === 0 && (
              <div style={{
                padding: 'var(--spacing-lg)',
                textAlign: 'center',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-family)',
              }}>
                {t('hr.policies.noAllocations')}
              </div>
            )}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('hr.policies.deleteTitle')}
        description={t('hr.policies.deleteDesc', { name: policy.name })}
        confirmLabel={t('common.delete')}
        onConfirm={handleDelete}
        destructive
      />
    </>
  );
}

// ─── Create Policy Form ──────────────────────────────────────────

function CreatePolicyForm({
  leaveTypes,
  onClose,
}: {
  leaveTypes: HrLeaveType[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const createPolicy = useCreateLeavePolicy();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [allocations, setAllocations] = useState<AllocationRow[]>(
    leaveTypes.map(lt => ({ leaveTypeId: lt.id, daysPerYear: lt.defaultDaysPerYear }))
  );

  const handleCreate = () => {
    if (!name.trim()) return;
    createPolicy.mutate({
      name: name.trim(),
      description: description.trim() || null,
      allocations,
    }, {
      onSuccess: () => {
        onClose();
      },
    });
  };

  return (
    <div style={{
      marginTop: 'var(--spacing-lg)',
      padding: 'var(--spacing-lg)',
      border: '1px solid var(--color-border-primary)',
      borderRadius: 'var(--radius-lg)',
      background: 'var(--color-bg-primary)',
    }}>
      <div style={{
        fontSize: 'var(--font-size-md)',
        fontWeight: 'var(--font-weight-semibold)',
        color: 'var(--color-text-primary)',
        fontFamily: 'var(--font-family)',
        marginBottom: 'var(--spacing-md)',
      }}>
        {t('hr.policies.createTitle')}
      </div>

      <Input
        label={t('hr.fields.name')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('hr.placeholder.policyName')}
        autoFocus
      />

      <div style={{ marginTop: 'var(--spacing-md)' }}>
        <Input
          label={t('hr.fields.description')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('hr.fields.optionalDescription')}
        />
      </div>

      <div style={{ marginTop: 'var(--spacing-lg)' }}>
        <div style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-medium)',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-family)',
          marginBottom: 'var(--spacing-sm)',
        }}>
          {t('hr.policies.allocationsLabel')}
        </div>
        <AllocationEditor
          leaveTypes={leaveTypes}
          allocations={allocations}
          onChange={setAllocations}
        />
      </div>

      <div style={{
        display: 'flex',
        gap: 'var(--spacing-sm)',
        justifyContent: 'flex-end',
        marginTop: 'var(--spacing-lg)',
      }}>
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={handleCreate}
          disabled={!name.trim() || createPolicy.isPending}
        >
          {t('common.save')}
        </Button>
      </div>
    </div>
  );
}

// ─── Main View ───────────────────────────────────────────────────

export function LeavePoliciesView() {
  const { t } = useTranslation();
  const { data: policies, isLoading } = useLeavePolicies();
  const { data: leaveTypes } = useLeaveTypes();
  const seedPolicies = useSeedLeavePolicies();
  const [showCreate, setShowCreate] = useState(false);

  // Auto-seed policies on first visit when list is empty
  const hasSeeded = useRef(false);
  useEffect(() => {
    if (!isLoading && (!policies || policies.length === 0) && !hasSeeded.current) {
      hasSeeded.current = true;
      seedPolicies.mutate();
    }
  }, [isLoading, policies, seedPolicies]);

  if (isLoading) return <div style={{ padding: 'var(--spacing-xl)' }}><Skeleton height={200} /></div>;

  const activeLeaveTypes = leaveTypes?.filter(lt => lt.isActive) ?? [];

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
          <PolicyCard key={p.id} policy={p} leaveTypes={activeLeaveTypes} />
        ))}
      </div>

      {showCreate && activeLeaveTypes.length > 0 && (
        <CreatePolicyForm
          leaveTypes={activeLeaveTypes}
          onClose={() => setShowCreate(false)}
        />
      )}

      {!showCreate && policies && policies.length > 0 && (
        <div style={{ marginTop: 'var(--spacing-lg)' }}>
          <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>
            {t('hr.policies.add')}
          </Button>
        </div>
      )}
    </div>
  );
}
