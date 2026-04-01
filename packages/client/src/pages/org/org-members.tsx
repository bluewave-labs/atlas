import { useState, useMemo, useCallback } from 'react';
import { UserPlus, Mail, Search, UserMinus, User, Shield, Calendar, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ColumnHeader } from '../../components/ui/column-header';
import { useAuthStore } from '../../stores/auth-store';
import {
  useTenantUsers,
  useCreateTenantUser,
  useRemoveTenantUser,
  useUpdateTenantUserRole,
  useInviteTenantUser,
  useMyTenants,
} from '../../hooks/use-platform';
import type { TenantMemberRole } from '@atlasmail/shared';
import { Avatar } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import { Chip } from '../../components/ui/chip';
import { Select } from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { appRegistry } from '../../apps';
import {
  useUpdateAppPermission,
  useDeleteAppPermission,
  type AppRole,
  type AppRecordAccess,
} from '../../hooks/use-app-permissions';

// ---------------------------------------------------------------------------
// Role chip color map
// ---------------------------------------------------------------------------

const ROLE_COLORS: Record<string, string> = {
  owner: '#7c3aed',
  admin: '#2563eb',
  member: '#6b7280',
};

// ---------------------------------------------------------------------------
// App permission role/access options
// ---------------------------------------------------------------------------

const APP_ROLE_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
];

const APP_ACCESS_OPTIONS = [
  { value: 'all', label: 'All records' },
  { value: 'own', label: 'Own records' },
];

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 100px 100px 80px',
        gap: 'var(--spacing-sm)',
        alignItems: 'center',
        padding: 'var(--spacing-md) var(--spacing-lg)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
        <Skeleton width={32} height={32} borderRadius="50%" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Skeleton width={100} height={13} borderRadius={3} />
          <Skeleton width={40} height={10} borderRadius={3} />
        </div>
      </div>
      <Skeleton width={160} height={13} borderRadius={3} />
      <Skeleton width={56} height={20} borderRadius={10} />
      <Skeleton width={64} height={12} borderRadius={3} />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Skeleton width={60} height={26} borderRadius={4} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MemberPermissionsPanel — inline expandable per-user app permissions
// ---------------------------------------------------------------------------

function MemberPermissionsPanel({
  userId,
  userPermissions,
  onUpdatePermission,
  onDeletePermission,
}: {
  userId: string;
  userPermissions: Record<string, { role: AppRole; recordAccess: AppRecordAccess }>;
  onUpdatePermission: (appId: string, userId: string, role: AppRole, recordAccess: AppRecordAccess) => void;
  onDeletePermission: (appId: string, userId: string) => void;
}) {
  const { t } = useTranslation();
  const allApps = appRegistry.getAll();
  const [restrictAccess, setRestrictAccess] = useState(Object.keys(userPermissions).length > 0);

  return (
    <div
      style={{
        padding: 'var(--spacing-lg) var(--spacing-lg) var(--spacing-lg) 52px',
        background: 'var(--color-bg-secondary)',
        borderBottom: '1px solid var(--color-border-primary)',
      }}
    >
      {/* Restrict access checkbox */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          cursor: 'pointer',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-family)',
          marginBottom: restrictAccess ? 'var(--spacing-lg)' : 0,
        }}
      >
        <input
          type="checkbox"
          checked={restrictAccess}
          onChange={(e) => {
            setRestrictAccess(e.target.checked);
            if (!e.target.checked) {
              // Reset all explicit permissions when unchecking
              for (const app of allApps) {
                if (userPermissions[app.id]) {
                  onDeletePermission(app.id, userId);
                }
              }
            }
          }}
          style={{ accentColor: 'var(--color-accent-primary)' }}
        />
        {t('org.restrictAccess', 'Restrict app access')}
      </label>

      {/* Per-app permission grid */}
      {restrictAccess && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {/* Header */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 140px 140px',
              gap: 'var(--spacing-sm)',
              padding: '0 0 var(--spacing-xs) 0',
              borderBottom: '1px solid var(--color-border-secondary)',
            }}
          >
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-medium)', fontFamily: 'var(--font-family)' }}>
              {t('org.appAccess', 'App access')}
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-medium)', fontFamily: 'var(--font-family)' }}>
              {t('permissions.role', 'Role')}
            </span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-medium)', fontFamily: 'var(--font-family)' }}>
              {t('permissions.recordAccess', 'Record access')}
            </span>
          </div>

          {/* App rows */}
          {allApps.map((app) => {
            const Icon = app.icon;
            const perm = userPermissions[app.id];
            const hasExplicitRole = !!perm;
            const displayRole = hasExplicitRole ? perm.role : 'default';
            const currentAccess = perm?.recordAccess ?? 'all';

            return (
              <div
                key={app.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 140px 140px',
                  gap: 'var(--spacing-sm)',
                  alignItems: 'center',
                  padding: 'var(--spacing-xs) 0',
                }}
              >
                {/* App icon + name */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 'var(--radius-sm)',
                      background: app.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={13} color="#fff" />
                  </div>
                  <span style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-family)',
                  }}>
                    {app.name}
                  </span>
                </div>

                {/* Role select */}
                <Select
                  value={displayRole}
                  onChange={(val) => {
                    if (val === 'default') {
                      onDeletePermission(app.id, userId);
                    } else {
                      onUpdatePermission(app.id, userId, val as AppRole, currentAccess);
                    }
                  }}
                  options={APP_ROLE_OPTIONS}
                  size="sm"
                  width={140}
                />

                {/* Record access select */}
                <Select
                  value={currentAccess}
                  onChange={(val) => {
                    if (hasExplicitRole) {
                      onUpdatePermission(app.id, userId, perm.role, val as AppRecordAccess);
                    }
                  }}
                  options={APP_ACCESS_OPTIONS}
                  size="sm"
                  width={140}
                  disabled={!hasExplicitRole}
                />
              </div>
            );
          })}

          {/* Hint */}
          <p style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-tertiary)',
            fontFamily: 'var(--font-family)',
            margin: 'var(--spacing-xs) 0 0',
          }}>
            {t('org.defaultRoleDesc', 'Full access based on tenant role')}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OrgMembersPage
// ---------------------------------------------------------------------------

export function OrgMembersPage() {
  const { t } = useTranslation();
  const storeTenantId = useAuthStore((s) => s.tenantId);
  const { data: tenants } = useMyTenants();
  const tenantId = storeTenantId ?? tenants?.[0]?.id ?? null;
  const currentUserId = useAuthStore((s) => s.account?.userId);
  const { data: users, isLoading } = useTenantUsers(tenantId ?? undefined);
  const createUser = useCreateTenantUser(tenantId ?? '');
  const removeUser = useRemoveTenantUser(tenantId ?? '');
  const updateRole = useUpdateTenantUserRole(tenantId ?? '');
  const inviteUser = useInviteTenantUser(tenantId ?? '');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', name: '', password: '', role: 'member' as TenantMemberRole });
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'member' as TenantMemberRole });
  const [addError, setAddError] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmRemoveUser, setConfirmRemoveUser] = useState<{ userId: string; displayName: string } | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // Track user permissions per app: { [userId]: { [appId]: { role, recordAccess } } }
  const [userPermissions, setUserPermissions] = useState<
    Record<string, Record<string, { role: AppRole; recordAccess: AppRecordAccess }>>
  >({});

  // Create mutation hooks for each app (all apps at once)
  const allApps = appRegistry.getAll();
  const updateMutations = Object.fromEntries(
    allApps.map((app) => [app.id, useUpdateAppPermission(app.id)]),
  );
  const deleteMutations = Object.fromEntries(
    allApps.map((app) => [app.id, useDeleteAppPermission(app.id)]),
  );

  const handleUpdatePermission = useCallback(
    (appId: string, userId: string, role: AppRole, recordAccess: AppRecordAccess) => {
      updateMutations[appId]?.mutate({ userId, role, recordAccess });
      setUserPermissions((prev) => ({
        ...prev,
        [userId]: {
          ...(prev[userId] ?? {}),
          [appId]: { role, recordAccess },
        },
      }));
    },
    [updateMutations],
  );

  const handleDeletePermission = useCallback(
    (appId: string, userId: string) => {
      deleteMutations[appId]?.mutate(userId);
      setUserPermissions((prev) => {
        const copy = { ...prev };
        if (copy[userId]) {
          const appCopy = { ...copy[userId] };
          delete appCopy[appId];
          copy[userId] = appCopy;
        }
        return copy;
      });
    },
    [deleteMutations],
  );

  if (!tenantId) {
    return (
      <div style={{ padding: 32, fontFamily: 'var(--font-family)', color: 'var(--color-text-secondary)' }}>
        <h2 style={{ fontSize: 20, marginBottom: 12, color: 'var(--color-text-primary)' }}>Team</h2>
        <p>Team management requires a company account. Please ask your admin to add you.</p>
      </div>
    );
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setAddError('');
    try {
      await createUser.mutateAsync(addForm);
      setShowAddModal(false);
      setAddForm({ email: '', name: '', password: '', role: 'member' });
    } catch (err: any) {
      setAddError(err.response?.data?.error || 'Failed to create user');
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    try {
      await inviteUser.mutateAsync(inviteForm);
      setInviteSuccess(`Invitation sent to ${inviteForm.email}`);
      setShowInviteModal(false);
      setInviteForm({ email: '', role: 'member' });
    } catch (err: any) {
      setInviteError(err.response?.data?.error || 'Failed to send invitation');
    }
  }

  // Determine current user's role (memoized to avoid scanning on every render)
  const currentUserRole = useMemo(() => users?.find((u) => u.userId === currentUserId)?.role, [users, currentUserId]);
  const isAdminOrOwner = currentUserRole === 'owner' || currentUserRole === 'admin';

  const filteredUsers = users?.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (u.name?.toLowerCase().includes(q)) || u.email.toLowerCase().includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)', fontFamily: 'var(--font-family)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', margin: 0 }}>
            Team members
          </h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>
            {users ? `${users.length} member${users.length !== 1 ? 's' : ''}` : 'Loading...'}
          </p>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>
            {t('org.defaultAccess', 'Members have full access to all enabled apps by default.')}
          </p>
        </div>
        {isAdminOrOwner && (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            variant="secondary"
            size="sm"
            icon={<Mail size={13} />}
            onClick={() => setShowInviteModal(true)}
          >
            Invite
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<UserPlus size={13} />}
            onClick={() => setShowAddModal(true)}
          >
            Add user
          </Button>
        </div>
        )}
      </div>

      {/* Success banner */}
      {inviteSuccess && (
        <div style={{
          padding: 'var(--spacing-sm) var(--spacing-md)',
          background: 'color-mix(in srgb, var(--color-success, #16a34a) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-success, #16a34a) 25%, transparent)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--color-success, #16a34a)',
          fontSize: 'var(--font-size-xs)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {inviteSuccess}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setInviteSuccess('')}
            style={{ color: 'inherit', padding: 0, height: 'auto', minWidth: 0, fontSize: 16, lineHeight: 1 }}
          >
            &times;
          </Button>
        </div>
      )}

      {/* Search */}
      <div style={{ maxWidth: 320 }}>
        <Input
          type="text"
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          iconLeft={<Search size={14} />}
        />
      </div>

      {/* Members list */}
      <div
        style={{
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}
      >
        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 100px 100px 80px',
          gap: 'var(--spacing-sm)',
          padding: 'var(--spacing-sm) var(--spacing-lg)',
          borderBottom: '1px solid var(--color-border-primary)',
          background: 'var(--color-bg-secondary)',
        }}>
          <ColumnHeader label="User" icon={<User size={12} />} />
          <ColumnHeader label="Email" icon={<Mail size={12} />} />
          <ColumnHeader label="Role" icon={<Shield size={12} />} />
          <ColumnHeader label="Joined" icon={<Calendar size={12} />} />
          <span></span>
        </div>

        {/* Rows */}
        {isLoading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : filteredUsers?.length === 0 ? (
          <div style={{ padding: 'var(--spacing-2xl)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
            {searchQuery ? 'No members match your search.' : 'No team members yet.'}
          </div>
        ) : (
          filteredUsers?.map((user, i) => {
            const isCurrentUser = user.userId === currentUserId;
            const isExpanded = expandedUserId === user.userId;
            const isLastRow = i === (filteredUsers?.length ?? 0) - 1;

            return (
              <div key={user.userId}>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 100px 100px 80px',
                    gap: 'var(--spacing-sm)',
                    alignItems: 'center',
                    padding: 'var(--spacing-md) var(--spacing-lg)',
                    borderBottom: (!isLastRow || isExpanded) ? '1px solid var(--color-border-primary)' : 'none',
                    transition: 'background 0.1s ease',
                    cursor: isAdminOrOwner ? 'pointer' : 'default',
                  }}
                  onClick={() => {
                    if (isAdminOrOwner) {
                      setExpandedUserId(isExpanded ? null : user.userId);
                    }
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover, var(--color-bg-secondary))'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {/* User */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', minWidth: 0 }}>
                    {isAdminOrOwner && (
                      isExpanded
                        ? <ChevronDown size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                        : <ChevronRight size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                    )}
                    <Avatar name={user.name} email={user.email} size={32} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 'var(--font-weight-medium)',
                        color: 'var(--color-text-primary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {user.name || '—'}
                      </div>
                      {isCurrentUser && (
                        <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>You</span>
                      )}
                    </div>
                  </div>

                  {/* Email */}
                  <div style={{
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-secondary)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {user.email}
                  </div>

                  {/* Role */}
                  <div onClick={(e) => e.stopPropagation()}>
                    {isCurrentUser || currentUserRole !== 'owner' || user.role === 'owner' ? (
                      <Chip
                        color={ROLE_COLORS[user.role] ?? ROLE_COLORS.member}
                        height={20}
                        style={{ textTransform: 'capitalize' }}
                      >
                        {user.role}
                      </Chip>
                    ) : (
                      <Select
                        value={user.role}
                        onChange={(val) => updateRole.mutate({ userId: user.userId, role: val as TenantMemberRole })}
                        options={[
                          { value: 'owner', label: 'Owner', color: ROLE_COLORS.owner },
                          { value: 'admin', label: 'Admin', color: ROLE_COLORS.admin },
                          { value: 'member', label: 'Member', color: ROLE_COLORS.member },
                        ]}
                        size="sm"
                        width={100}
                      />
                    )}
                  </div>

                  {/* Joined */}
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </div>

                  {/* Actions */}
                  <div style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                    {!isCurrentUser && isAdminOrOwner && (
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<UserMinus size={13} />}
                        onClick={() =>
                          setConfirmRemoveUser({
                            userId: user.userId,
                            displayName: user.name || user.email,
                          })
                        }
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>

                {/* Expanded permissions panel */}
                {isExpanded && isAdminOrOwner && (
                  <MemberPermissionsPanel
                    userId={user.userId}
                    userPermissions={userPermissions[user.userId] ?? {}}
                    onUpdatePermission={handleUpdatePermission}
                    onDeletePermission={handleDeletePermission}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Remove user confirm dialog */}
      <ConfirmDialog
        open={confirmRemoveUser !== null}
        onOpenChange={(open) => { if (!open) setConfirmRemoveUser(null); }}
        title="Remove team member"
        description={`Remove ${confirmRemoveUser?.displayName ?? 'this user'} from the team? They will lose access immediately.`}
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (confirmRemoveUser) removeUser.mutate(confirmRemoveUser.userId);
        }}
      />

      {/* Add user modal */}
      <Modal
        open={showAddModal}
        onOpenChange={(open) => { if (!open) { setShowAddModal(false); setAddError(''); } }}
        width={440}
        title="Add team member"
      >
        <Modal.Header title="Add team member" />
        <form onSubmit={handleAddUser}>
          <Modal.Body>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {addError && (
                <div style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  background: 'color-mix(in srgb, var(--color-error) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-error) 25%, transparent)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-error)',
                  fontSize: 'var(--font-size-xs)',
                }}>
                  {addError}
                </div>
              )}
              <Input
                label="Email"
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                required
                placeholder="user@company.com"
              />
              <Input
                label="Name"
                type="text"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                required
                placeholder="Full name"
              />
              <Input
                label="Password"
                type="password"
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                required
                minLength={8}
                placeholder="Min. 8 characters"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
                  Role
                </label>
                <Select
                  value={addForm.role}
                  onChange={(val) => setAddForm({ ...addForm, role: val as TenantMemberRole })}
                  options={[
                    { value: 'member', label: 'Member' },
                    { value: 'admin', label: 'Admin' },
                  ]}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => { setShowAddModal(false); setAddError(''); }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={createUser.isPending}
              style={{ opacity: createUser.isPending ? 0.7 : 1 }}
            >
              {createUser.isPending ? 'Adding...' : 'Add user'}
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Invite user modal */}
      <Modal
        open={showInviteModal}
        onOpenChange={(open) => { if (!open) { setShowInviteModal(false); setInviteError(''); } }}
        width={440}
        title="Invite team member"
      >
        <Modal.Header title="Invite team member" />
        <form onSubmit={handleInvite}>
          <Modal.Body>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              {inviteError && (
                <div style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  background: 'color-mix(in srgb, var(--color-error) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-error) 25%, transparent)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-error)',
                  fontSize: 'var(--font-size-xs)',
                }}>
                  {inviteError}
                </div>
              )}
              <Input
                label="Email"
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                required
                placeholder="user@company.com"
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
                  Role
                </label>
                <Select
                  value={inviteForm.role}
                  onChange={(val) => setInviteForm({ ...inviteForm, role: val as TenantMemberRole })}
                  options={[
                    { value: 'member', label: 'Member' },
                    { value: 'admin', label: 'Admin' },
                  ]}
                />
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>
                The user will receive an invitation link to set up their account.
              </p>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => { setShowInviteModal(false); setInviteError(''); }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={inviteUser.isPending}
              style={{ opacity: inviteUser.isPending ? 0.7 : 1 }}
            >
              {inviteUser.isPending ? 'Sending...' : 'Send invitation'}
            </Button>
          </Modal.Footer>
        </form>
      </Modal>
    </div>
  );
}
