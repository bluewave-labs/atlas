import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Mail, Search, UserMinus, User, Shield, Calendar, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/auth-store';
import {
  useTenantUsers,
  useCreateTenantUser,
  useRemoveTenantUser,
  useInviteTenantUser,
  useMyTenants,
} from '../../hooks/use-platform';
import type { TenantMemberRole } from '@atlas-platform/shared';
import { Avatar } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import { Chip } from '../../components/ui/chip';
import { Select } from '../../components/ui/select';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/modal';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { DataTable, type DataTableColumn } from '../../components/ui/data-table';
import { appRegistry } from '../../apps';
import {
  useAllTenantPermissions,
  type AppRole,
  type AppRecordAccess,
} from '../../hooks/use-app-permissions';
import { ROLE_COLORS } from '../../config/role-colors';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASE_ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
];

const DEFAULT_APP_PERMS = [
  { appId: 'work', enabled: true, role: 'editor', recordAccess: 'all' },
  { appId: 'drive', enabled: true, role: 'editor', recordAccess: 'all' },
  { appId: 'docs', enabled: true, role: 'editor', recordAccess: 'all' },
  { appId: 'draw', enabled: true, role: 'editor', recordAccess: 'all' },
  { appId: 'sign', enabled: true, role: 'editor', recordAccess: 'all' },
  { appId: 'crm', enabled: false, role: 'editor', recordAccess: 'own' },
  { appId: 'hr', enabled: false, role: 'viewer', recordAccess: 'own' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MemberRow {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  role: TenantMemberRole;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// OrgMembersPage
// ---------------------------------------------------------------------------

export function OrgMembersPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const storeTenantId = useAuthStore((s) => s.tenantId);
  const { data: tenants } = useMyTenants();
  const tenantId = storeTenantId ?? tenants?.[0]?.id ?? null;
  const currentUserId = useAuthStore((s) => s.account?.userId);
  const { data: users } = useTenantUsers(tenantId ?? undefined);
  const createUser = useCreateTenantUser(tenantId ?? '');
  const removeUser = useRemoveTenantUser(tenantId ?? '');
  const inviteUser = useInviteTenantUser(tenantId ?? '');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [addForm, setAddForm] = useState({ email: '', name: '', password: '', role: 'member' as TenantMemberRole });
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'member' as TenantMemberRole,
    appPermissions: DEFAULT_APP_PERMS.map(p => ({ ...p })),
    crmTeamId: '',
    managerId: '' as string,
  });
  const [addError, setAddError] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmRemoveUser, setConfirmRemoveUser] = useState<{ userId: string; displayName: string } | null>(null);

  const managerOptions = useMemo(() => {
    if (!users) return [{ value: '', label: t('org.managerNone') }];
    return [
      { value: '', label: t('org.managerNone') },
      ...users.map((u) => ({ value: u.userId, label: u.name || u.email })),
    ];
  }, [users, t]);

  const allApps = appRegistry.getAll();
  const appsMap = useMemo(() => new Map(allApps.map(a => [a.id, a])), [allApps]);

  const currentUserRole = useMemo(() => users?.find((u) => u.userId === currentUserId)?.role, [users, currentUserId]);
  const isAdminOrOwner = currentUserRole === 'owner' || currentUserRole === 'admin';

  // Bulk-fetch all tenant permissions (admin-only endpoint)
  const { data: allPermsData } = useAllTenantPermissions(isAdminOrOwner);

  const userPermissions = useMemo(() => {
    const map: Record<string, Record<string, { role: AppRole; recordAccess: AppRecordAccess }>> = {};
    if (!allPermsData) return map;
    for (const p of allPermsData) {
      if (!map[p.userId]) map[p.userId] = {};
      map[p.userId][p.appId] = { role: p.role, recordAccess: p.recordAccess };
    }
    return map;
  }, [allPermsData]);

  const tableData: MemberRow[] = useMemo(() => {
    if (!users) return [];
    let filtered = users;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = users.filter((u) => (u.name?.toLowerCase().includes(q)) || u.email.toLowerCase().includes(q));
    }
    return filtered.map((u) => ({
      id: u.userId,
      userId: u.userId,
      name: u.name,
      email: u.email,
      role: u.role as TenantMemberRole,
      createdAt: u.createdAt,
    }));
  }, [users, searchQuery]);

  const columns: DataTableColumn<MemberRow>[] = useMemo(() => {
    const cols: DataTableColumn<MemberRow>[] = [
      {
        key: 'name',
        label: t('org.members.columnUser'),
        icon: <User size={12} />,
        sortable: true,
        compare: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
        searchValue: (item) => item.name ?? '',
        render: (item) => {
          const isCurrentUser = item.userId === currentUserId;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', minWidth: 0 }}>
              <Avatar name={item.name} email={item.email} size={24} />
              <span style={{
                fontSize: 'var(--font-size-sm)',
                fontWeight: 'var(--font-weight-medium)',
                color: 'var(--color-text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {item.name || '—'}
                {isCurrentUser && (
                  <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginLeft: 4 }}>{t('org.members.you')}</span>
                )}
              </span>
            </div>
          );
        },
      },
      {
        key: 'email',
        label: t('org.members.columnEmail'),
        icon: <Mail size={12} />,
        sortable: true,
        compare: (a, b) => a.email.localeCompare(b.email),
        searchValue: (item) => item.email,
        render: (item) => (
          <span style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {item.email}
          </span>
        ),
      },
      {
        key: 'apps',
        label: t('org.members.columnApps'),
        icon: <Shield size={12} />,
        width: 180,
        searchValue: (item) => {
          if (item.role === 'owner' || item.role === 'admin') return t('org.members.allApps');
          const perms = userPermissions[item.userId];
          if (!perms) return '';
          return Object.keys(perms).map((id) => appsMap.get(id)?.name || id).join(' ');
        },
        render: (item) => {
          if (item.role === 'owner' || item.role === 'admin') {
            return (
              <span style={{
                fontSize: 10, fontWeight: 600, fontFamily: 'var(--font-family)',
                padding: '1px 6px', borderRadius: 'var(--radius-sm)',
                background: 'color-mix(in srgb, var(--color-accent-primary) 12%, transparent)',
                color: 'var(--color-accent-primary)', whiteSpace: 'nowrap',
              }}>
                {t('org.members.allApps')}
              </span>
            );
          }
          const perms = userPermissions[item.userId];
          const appIds = perms ? Object.keys(perms) : [];
          if (appIds.length === 0) {
            return (
              <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
                {t('org.members.defaultApps')}
              </span>
            );
          }
          return (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
              {appIds.map((appId) => {
                const app = appsMap.get(appId);
                if (!app) return null;
                return (
                  <span
                    key={appId}
                    title={`${app.name} (${perms[appId].role})`}
                    style={{
                      fontSize: 10, fontWeight: 500, fontFamily: 'var(--font-family)',
                      padding: '1px 5px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-bg-tertiary)',
                      color: 'var(--color-text-secondary)', whiteSpace: 'nowrap',
                    }}
                  >
                    {app.name}
                  </span>
                );
              })}
            </div>
          );
        },
      },
      {
        key: 'role',
        label: t('org.members.columnRole'),
        icon: <Shield size={12} />,
        width: 110,
        sortable: true,
        compare: (a, b) => a.role.localeCompare(b.role),
        searchValue: (item) => item.role,
        render: (item) => (
          <Chip
            color={ROLE_COLORS[item.role] ?? ROLE_COLORS.member}
            height={20}
            style={{ textTransform: 'capitalize' }}
          >
            {item.role}
          </Chip>
        ),
      },
      {
        key: 'createdAt',
        label: t('org.members.columnJoined'),
        icon: <Calendar size={12} />,
        width: 100,
        sortable: true,
        compare: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        searchValue: (item) => new Date(item.createdAt).toLocaleDateString(),
        render: (item) => (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
            {new Date(item.createdAt).toLocaleDateString()}
          </span>
        ),
      },
    ];

    if (isAdminOrOwner) {
      cols.push({
        key: 'actions',
        label: '',
        width: 100,
        searchValue: () => '',
        render: (item) => {
          const isCurrentUser = item.userId === currentUserId;
          if (isCurrentUser) return null;
          return (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
              <Button
                variant="danger"
                size="sm"
                icon={<UserMinus size={13} />}
                onClick={() => setConfirmRemoveUser({ userId: item.userId, displayName: item.name || item.email })}
              >
                {t('org.members.remove')}
              </Button>
            </div>
          );
        },
      });
    }

    return cols;
  }, [currentUserId, isAdminOrOwner, appsMap, userPermissions, t]);

  const handleRowClick = useCallback((item: MemberRow) => {
    if (!isAdminOrOwner) return;
    if (item.userId === currentUserId) return;
    navigate(`/org/members/${item.userId}`);
  }, [isAdminOrOwner, currentUserId, navigate]);

  if (!tenantId) {
    return (
      <div style={{ padding: 32, fontFamily: 'var(--font-family)', color: 'var(--color-text-secondary)' }}>
        <h2 style={{ fontSize: 20, marginBottom: 12, color: 'var(--color-text-primary)' }}>{t('org.members.title')}</h2>
        <p>{t('org.members.teamRequires')}</p>
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
      setAddError(err.response?.data?.error || t('org.members.createFailed'));
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    try {
      await inviteUser.mutateAsync({
        email: inviteForm.email,
        role: inviteForm.role,
        appPermissions: inviteForm.appPermissions.filter(p => p.enabled),
        crmTeamId: inviteForm.crmTeamId || undefined,
      });
      setInviteSuccess(t('org.members.inviteSent', { email: inviteForm.email }));
      setShowInviteModal(false);
      setInviteForm({ email: '', role: 'member', appPermissions: DEFAULT_APP_PERMS.map(p => ({ ...p })), crmTeamId: '', managerId: '' });
    } catch (err: any) {
      setInviteError(err.response?.data?.error || t('org.members.inviteFailed'));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)', fontFamily: 'var(--font-family)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', margin: 0 }}>
            {t('org.members.title')}
          </h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>
            {users ? t('org.members.summary', { count: users.length }) : t('org.members.loading')}
            {isAdminOrOwner && t('org.members.editHint')}
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
            {t('org.members.invite')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<UserPlus size={13} />}
            onClick={() => setShowAddModal(true)}
          >
            {t('org.members.addUser')}
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

      {/* Members table */}
      <DataTable
        data={tableData}
        columns={columns}
        searchable
        exportable
        columnSelector
        resizableColumns
        storageKey="org-members"
        paginated={tableData.length > 25}
        defaultPageSize={25}
        onRowClick={isAdminOrOwner ? handleRowClick : undefined}
        emptyIcon={<User size={40} />}
        emptyTitle={searchQuery ? t('org.members.noMatches') : t('org.members.noMembers')}
        emptyDescription={isAdminOrOwner ? t('org.members.noMembersHelp') : undefined}
        toolbar={{
          left: (
            <div style={{ maxWidth: 280 }}>
              <Input
                type="text"
                placeholder={t('org.members.searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                iconLeft={<Search size={14} />}
                size="sm"
              />
            </div>
          ),
        }}
      />

      {/* Remove user confirm dialog */}
      <ConfirmDialog
        open={confirmRemoveUser !== null}
        onOpenChange={(open) => { if (!open) setConfirmRemoveUser(null); }}
        title={t('org.members.confirmRemoveTitle')}
        description={t('org.members.confirmRemoveDesc', { name: confirmRemoveUser?.displayName ?? t('org.members.confirmRemoveFallback') })}
        confirmLabel={t('org.members.remove')}
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
        title={t('org.members.addModalTitle')}
      >
        <Modal.Header title={t('org.members.addModalTitle')} />
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
                label={t('org.members.emailLabel')}
                type="email"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                required
                placeholder={t('org.members.emailPlaceholder')}
              />
              <Input
                label={t('org.members.nameLabel')}
                type="text"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                required
                placeholder={t('org.members.namePlaceholder')}
              />
              <Input
                label={t('org.members.passwordLabel')}
                type="password"
                value={addForm.password}
                onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                required
                minLength={8}
                placeholder={t('org.members.passwordPlaceholder')}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
                  {t('org.members.roleLabel')}
                </label>
                <Select
                  value={addForm.role}
                  onChange={(val) => setAddForm({ ...addForm, role: val as TenantMemberRole })}
                  options={[
                    { value: 'member', label: t('org.members.roleMember') },
                    { value: 'admin', label: t('org.members.roleAdmin') },
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
              {t('org.settings.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={createUser.isPending}
              style={{ opacity: createUser.isPending ? 0.7 : 1 }}
            >
              {createUser.isPending ? t('org.members.adding') : t('org.members.addUser')}
            </Button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* Invite user modal */}
      <Modal
        open={showInviteModal}
        onOpenChange={(open) => { if (!open) { setShowInviteModal(false); setInviteError(''); } }}
        width={520}
        title={t('org.members.inviteModalTitle')}
      >
        <Modal.Header title={t('org.members.inviteModalTitle')} />
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
                label={t('org.members.emailLabel')}
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                required
                placeholder={t('org.members.emailPlaceholder')}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
                  {t('org.members.roleLabel')}
                </label>
                <Select
                  value={inviteForm.role}
                  onChange={(val) => setInviteForm({ ...inviteForm, role: val as TenantMemberRole })}
                  options={[
                    { value: 'member', label: t('org.members.roleMember') },
                    { value: 'admin', label: t('org.members.roleAdmin') },
                  ]}
                />
              </div>
              {/* Manager select */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
                  {t('org.manager')}
                </label>
                <Select
                  value={inviteForm.managerId}
                  onChange={(val) => setInviteForm({ ...inviteForm, managerId: val })}
                  options={managerOptions}
                />
              </div>
              {/* App access section */}
              <div style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 'var(--spacing-md)' }}>
                <label style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: 'var(--font-family)', display: 'block', marginBottom: 'var(--spacing-sm)' }}>
                  {t('org.members.appAccessSection')}
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                  {inviteForm.appPermissions.map((perm, i) => {
                    const app = appsMap.get(perm.appId);
                    return (
                      <div key={perm.appId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', padding: '4px 0' }}>
                        <input
                          type="checkbox"
                          checked={perm.enabled}
                          onChange={(e) => {
                            const next = [...inviteForm.appPermissions];
                            next[i] = { ...next[i], enabled: e.target.checked };
                            setInviteForm({ ...inviteForm, appPermissions: next });
                          }}
                          style={{ width: 14, height: 14, accentColor: 'var(--color-accent-primary)' }}
                        />
                        <span style={{ width: 70, fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)', color: 'var(--color-text-primary)' }}>
                          {app?.name || perm.appId}
                        </span>
                        {perm.enabled && (
                          <Select
                            value={perm.role}
                            onChange={(v) => {
                              const next = [...inviteForm.appPermissions];
                              next[i] = { ...next[i], role: v };
                              setInviteForm({ ...inviteForm, appPermissions: next });
                            }}
                            options={BASE_ROLE_OPTIONS}
                            size="sm"
                            width={110}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>
                {t('org.inviteLinkNote')}
              </p>
              {/* App access nudge */}
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--spacing-sm)',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'color-mix(in srgb, var(--color-accent-primary) 6%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-accent-primary) 15%, transparent)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <Info size={14} style={{ color: 'var(--color-accent-primary)', flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  {t('org.appAccessNudge')}
                </span>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => { setShowInviteModal(false); setInviteError(''); }}
            >
              {t('org.settings.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={inviteUser.isPending}
              style={{ opacity: inviteUser.isPending ? 0.7 : 1 }}
            >
              {inviteUser.isPending ? t('org.members.sending') : t('org.members.sendInvitation')}
            </Button>
          </Modal.Footer>
        </form>
      </Modal>
    </div>
  );
}
