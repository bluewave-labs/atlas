import { useState, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { useTenantUsers, useMyTenants } from '../../hooks/use-platform';
import type { TenantMemberRole } from '@atlasmail/shared';
import { Avatar } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import { Select } from '../../components/ui/select';
import { Skeleton } from '../../components/ui/skeleton';
import { appRegistry } from '../../apps';
import {
  useAllTenantPermissions,
  type AppRole,
  type AppRecordAccess,
} from '../../hooks/use-app-permissions';
import { api } from '../../lib/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../config/query-keys';
import { useToastStore } from '../../stores/toast-store';
import { useCrmTeams } from '../../apps/crm/hooks';
import { ROLE_COLORS } from '../../config/role-colors';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: 'Full control. Can manage members, change roles, enable apps, and access everything.',
  admin: 'Can manage members, enable apps, and access everything. Cannot change roles.',
  member: 'Access only the apps and data you assign below.',
};

// ---------------------------------------------------------------------------
// OrgMemberEditPage
// ---------------------------------------------------------------------------

export function OrgMemberEditPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const storeTenantId = useAuthStore((s) => s.tenantId);
  const { data: tenants } = useMyTenants();
  const tenantId = storeTenantId ?? tenants?.[0]?.id ?? null;
  const { data: users, isLoading: usersLoading } = useTenantUsers(tenantId ?? undefined);
  const { data: allPermsData } = useAllTenantPermissions();
  const { data: crmTeams } = useCrmTeams();
  const allApps = appRegistry.getAll();

  // Find the member
  const member = useMemo(() => users?.find((u) => u.userId === userId), [users, userId]);

  // Build server permissions map for this user
  const serverPermissions = useMemo(() => {
    const map: Record<string, { role: AppRole; recordAccess: AppRecordAccess }> = {};
    if (!allPermsData || !userId) return map;
    for (const p of allPermsData) {
      if (p.userId === userId) {
        map[p.appId] = { role: p.role, recordAccess: p.recordAccess };
      }
    }
    return map;
  }, [allPermsData, userId]);

  // Draft state
  const [draftRole, setDraftRole] = useState<TenantMemberRole>('member');
  const [draftPerms, setDraftPerms] = useState<Record<string, { role: AppRole; recordAccess: AppRecordAccess }>>({});
  const [draftCrmTeamId, setDraftCrmTeamId] = useState<string>('');
  const initialCrmTeamId = useRef<string>('');
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initialize draft from server data
  useEffect(() => {
    if (!member || initialized) return;
    setDraftRole(member.role as TenantMemberRole);
    setDraftPerms({ ...serverPermissions });
    setInitialized(true);
  }, [member, serverPermissions, initialized]);

  // Fetch CRM team membership
  useEffect(() => {
    if (!userId) return;
    api.get(`/crm/teams/user/${userId}`).then(({ data }) => {
      const teamIds = data.data as string[];
      const tid = teamIds[0] ?? '';
      setDraftCrmTeamId(tid);
      initialCrmTeamId.current = tid;
    }).catch(() => {});
  }, [userId]);

  const isPrivileged = draftRole === 'owner' || draftRole === 'admin';
  const hasCrmAccess = !!draftPerms['crm'];

  // Presets
  const PRESETS = [
    {
      label: 'Sales team',
      apply: () => {
        setDraftPerms({
          crm: { role: 'editor' as AppRole, recordAccess: 'team' as AppRecordAccess },
          tasks: { role: 'editor' as AppRole, recordAccess: 'all' as AppRecordAccess },
          drive: { role: 'editor' as AppRole, recordAccess: 'all' as AppRecordAccess },
          docs: { role: 'editor' as AppRole, recordAccess: 'all' as AppRecordAccess },
          sign: { role: 'editor' as AppRole, recordAccess: 'all' as AppRecordAccess },
        });
      },
    },
    {
      label: 'HR admin',
      apply: () => {
        setDraftPerms({
          hr: { role: 'admin' as AppRole, recordAccess: 'all' as AppRecordAccess },
          tasks: { role: 'editor' as AppRole, recordAccess: 'all' as AppRecordAccess },
          drive: { role: 'editor' as AppRole, recordAccess: 'all' as AppRecordAccess },
          docs: { role: 'editor' as AppRole, recordAccess: 'all' as AppRecordAccess },
        });
      },
    },
    {
      label: 'Full access',
      apply: () => {
        const perms: Record<string, { role: AppRole; recordAccess: AppRecordAccess }> = {};
        for (const app of allApps) {
          perms[app.id] = { role: 'editor', recordAccess: 'all' };
        }
        setDraftPerms(perms);
      },
    },
    {
      label: 'Reset to default',
      apply: () => {
        const defaults: Record<string, { role: AppRole; recordAccess: AppRecordAccess }> = {};
        const defaultApps = ['tasks', 'drive', 'docs', 'draw', 'tables', 'sign', 'projects'];
        for (const id of defaultApps) {
          defaults[id] = { role: 'editor', recordAccess: 'all' };
        }
        setDraftPerms(defaults);
      },
    },
  ];

  // Detect changes
  const hasChanges = useMemo(() => {
    if (!member) return false;
    if (draftRole !== member.role) return true;
    if (draftCrmTeamId !== initialCrmTeamId.current) return true;
    const sKeys = Object.keys(serverPermissions);
    const dKeys = Object.keys(draftPerms);
    if (sKeys.length !== dKeys.length) return true;
    for (const k of dKeys) {
      if (!serverPermissions[k]) return true;
      if (draftPerms[k].role !== serverPermissions[k].role) return true;
      if (draftPerms[k].recordAccess !== serverPermissions[k].recordAccess) return true;
    }
    for (const k of sKeys) {
      if (!draftPerms[k]) return true;
    }
    return false;
  }, [draftRole, draftPerms, draftCrmTeamId, member, serverPermissions]);

  async function handleSave() {
    if (!member || !tenantId) return;
    setSaving(true);
    try {
      const promises: Promise<unknown>[] = [];

      if (draftRole !== member.role) {
        promises.push(api.put(`/platform/tenants/${tenantId}/users/${member.userId}/role`, { role: draftRole }));
      }

      const sKeys = new Set(Object.keys(serverPermissions));
      const dKeys = new Set(Object.keys(draftPerms));

      for (const appId of sKeys) {
        if (!dKeys.has(appId)) {
          promises.push(api.delete(`/permissions/${appId}/${member.userId}`));
        }
      }
      for (const appId of dKeys) {
        const prev = serverPermissions[appId];
        const next = draftPerms[appId];
        if (!prev || prev.role !== next.role || prev.recordAccess !== next.recordAccess) {
          promises.push(api.put(`/permissions/${appId}/${member.userId}`, { role: next.role, recordAccess: next.recordAccess }));
        }
      }

      if (draftCrmTeamId !== initialCrmTeamId.current) {
        if (initialCrmTeamId.current) {
          promises.push(api.delete(`/crm/teams/${initialCrmTeamId.current}/members/${member.userId}`));
        }
        if (draftCrmTeamId) {
          promises.push(api.post(`/crm/teams/${draftCrmTeamId}/members`, { userId: member.userId }));
        }
      }

      await Promise.all(promises);
      queryClient.invalidateQueries({ queryKey: queryKeys.permissions.allTenant });
      queryClient.invalidateQueries({ queryKey: queryKeys.platform.tenantUsers(tenantId) });
      addToast({ type: 'success', message: `Updated ${member.name || member.email}` });
      navigate('/org/members');
    } catch (err: any) {
      addToast({ type: 'error', message: err?.response?.data?.error || 'Failed to save changes' });
    } finally {
      setSaving(false);
    }
  }

  // Loading
  if (usersLoading || !initialized) {
    return (
      <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
        <Skeleton width={200} height={24} borderRadius="var(--radius-sm)" />
        <Skeleton width="100%" height={80} borderRadius="var(--radius-md)" />
        <Skeleton width="100%" height={300} borderRadius="var(--radius-md)" />
      </div>
    );
  }

  if (!member) {
    return (
      <div style={{ fontFamily: 'var(--font-family)', color: 'var(--color-text-secondary)', padding: 'var(--spacing-xl)' }}>
        Member not found.{' '}
        <button onClick={() => navigate('/org/members')} style={{ color: 'var(--color-accent-primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
          Back to members
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 640, fontFamily: 'var(--font-family)' }}>
      {/* Back link + save bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--spacing-lg)',
      }}>
        <button
          onClick={() => navigate('/org/members')}
          style={{
            display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)',
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-family)', fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
          }}
        >
          <ArrowLeft size={14} />
          Back to members
        </button>
        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
          <Button variant="secondary" size="sm" onClick={() => navigate('/org/members')}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving}
            style={{ opacity: (!hasChanges || saving) ? 0.6 : 1 }}
          >
            {saving ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
        {/* Member info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
          <Avatar name={member.name} email={member.email} size={48} />
          <div>
            <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
              {member.name || '—'}
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
              {member.email}
            </div>
          </div>
        </div>

        {/* Role */}
        <div style={{
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--spacing-lg)',
        }}>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', marginBottom: 'var(--spacing-md)' }}>
            Role
          </div>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            {(['owner', 'admin', 'member'] as TenantMemberRole[]).map((role) => (
              <button
                key={role}
                onClick={() => setDraftRole(role)}
                style={{
                  flex: 1,
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  border: `1.5px solid ${draftRole === role ? ROLE_COLORS[role] : 'var(--color-border-primary)'}`,
                  borderRadius: 'var(--radius-md)',
                  background: draftRole === role ? `color-mix(in srgb, ${ROLE_COLORS[role]} 8%, transparent)` : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-family)',
                }}
              >
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: draftRole === role ? ROLE_COLORS[role] : 'var(--color-text-primary)', textTransform: 'capitalize' }}>
                  {role}
                </div>
              </button>
            ))}
          </div>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', margin: 'var(--spacing-sm) 0 0', lineHeight: 1.4 }}>
            {ROLE_DESCRIPTIONS[draftRole]}
          </p>
        </div>

        {/* App permissions — only for members */}
        {!isPrivileged && (
          <div style={{
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-lg)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
              <div>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)' }}>
                  App access
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                  Choose which apps this person can use and what they can do.
                </div>
              </div>
            </div>

            {/* Presets */}
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)' }}>
              {PRESETS.map((preset) => (
                <Button key={preset.label} variant="secondary" size="sm" onClick={preset.apply}>
                  {preset.label}
                </Button>
              ))}
            </div>

            {/* App grid */}
            <div style={{
              border: '1px solid var(--color-border-secondary)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 130px 130px',
                gap: 'var(--spacing-sm)',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                background: 'var(--color-bg-secondary)',
                borderBottom: '1px solid var(--color-border-secondary)',
              }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-medium)' }}>App</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-medium)' }}>What they can do</span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-medium)' }}>Which data</span>
              </div>

              {allApps.map((app, i) => {
                const Icon = app.icon;
                const perm = draftPerms[app.id];
                const hasAccess = !!perm;
                const displayRole = hasAccess ? perm.role : 'no-access';
                const currentAccess = perm?.recordAccess ?? 'all';
                const isLast = i === allApps.length - 1;

                return (
                  <div
                    key={app.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 130px 130px',
                      gap: 'var(--spacing-sm)',
                      alignItems: 'center',
                      padding: 'var(--spacing-sm) var(--spacing-md)',
                      borderBottom: isLast ? 'none' : '1px solid var(--color-border-secondary)',
                      background: hasAccess ? `color-mix(in srgb, ${app.color} 4%, transparent)` : 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: 'var(--radius-sm)',
                        background: hasAccess ? app.color : 'var(--color-bg-tertiary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        transition: 'background 0.15s',
                      }}>
                        <Icon size={12} color={hasAccess ? '#fff' : 'var(--color-text-tertiary)'} />
                      </div>
                      <span style={{
                        fontSize: 'var(--font-size-sm)',
                        color: hasAccess ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                        fontWeight: hasAccess ? 'var(--font-weight-medium)' : 'var(--font-weight-normal)',
                      }}>
                        {app.name}
                      </span>
                    </div>

                    <Select
                      value={displayRole}
                      onChange={(val) => {
                        if (val === 'no-access') {
                          setDraftPerms((prev) => { const c = { ...prev }; delete c[app.id]; return c; });
                        } else {
                          setDraftPerms((prev) => ({ ...prev, [app.id]: { role: val as AppRole, recordAccess: currentAccess } }));
                        }
                      }}
                      options={[
                        { value: 'no-access', label: 'No access' },
                        { value: 'viewer', label: 'View only' },
                        { value: 'editor', label: 'Can edit' },
                        { value: 'manager', label: 'Manager' },
                        { value: 'admin', label: 'Full control' },
                      ]}
                      size="sm"
                      width={130}
                    />

                    <Select
                      value={currentAccess}
                      onChange={(val) => {
                        if (hasAccess) {
                          setDraftPerms((prev) => ({ ...prev, [app.id]: { ...prev[app.id], recordAccess: val as AppRecordAccess } }));
                        }
                      }}
                      options={[
                        { value: 'all', label: 'Everything' },
                        { value: 'own', label: 'Only theirs' },
                      ]}
                      size="sm"
                      width={130}
                      disabled={!hasAccess}
                    />
                  </div>
                );
              })}
            </div>

            {/* CRM team */}
            {hasCrmAccess && crmTeams && crmTeams.length > 0 && (
              <div style={{ marginTop: 'var(--spacing-lg)' }}>
                <label style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', display: 'block', marginBottom: 'var(--spacing-xs)' }}>
                  CRM sales team
                </label>
                <Select
                  value={draftCrmTeamId || '__none__'}
                  onChange={(val) => setDraftCrmTeamId(val === '__none__' ? '' : val)}
                  options={[
                    { value: '__none__', label: 'No team assigned' },
                    ...crmTeams.map((team) => ({ value: team.id, label: team.name })),
                  ]}
                  width={240}
                />
                <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>
                  When "Which data" is set to "Only theirs", this person can also see their team's CRM records.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Privileged role info */}
        {isPrivileged && (
          <div style={{
            padding: 'var(--spacing-lg)',
            background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-secondary)',
          }}>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.5 }}>
              {draftRole === 'owner'
                ? 'Owners have full access to all apps and settings. They can manage members, change roles, and configure the organization.'
                : 'Admins have full access to all apps. They can manage members and configure apps, but cannot change member roles.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
