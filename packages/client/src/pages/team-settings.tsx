import { useState } from 'react';
import { User, Mail, Shield, Calendar, Settings } from 'lucide-react';
import { ColumnHeader } from '../components/ui/column-header';
import { useAuthStore } from '../stores/auth-store';
import {
  useTenantUsers,
  useCreateTenantUser,
  useRemoveTenantUser,
  useUpdateTenantUserRole,
  useInviteTenantUser,
} from '../hooks/use-platform';
import type { TenantMemberRole } from '@atlasmail/shared';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select } from '../components/ui/select';

export function TeamSettingsPage() {
  const tenantId = useAuthStore((s) => s.tenantId);
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
  const [error, setError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

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
    setError('');
    try {
      await createUser.mutateAsync(addForm);
      setShowAddModal(false);
      setAddForm({ email: '', name: '', password: '', role: 'member' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create user');
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInviteSuccess('');
    try {
      await inviteUser.mutateAsync(inviteForm);
      setInviteSuccess(`Invitation sent to ${inviteForm.email}`);
      setShowInviteModal(false);
      setInviteForm({ email: '', role: 'member' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send invitation');
    }
  }

  const roleBadgeColor: Record<string, string> = {
    owner: '#7c3aed',
    admin: '#2563eb',
    member: '#6b7280',
  };

  return (
    <div style={{ padding: 32, maxWidth: 800, fontFamily: 'var(--font-family)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text-primary)' }}>Team members</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" size="sm" onClick={() => setShowInviteModal(true)}>
            Invite user
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowAddModal(true)}>
            Add user
          </Button>
        </div>
      </div>

      {inviteSuccess && (
        <div style={{ padding: '8px 12px', marginBottom: 16, background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-success)', fontSize: 13 }}>
          {inviteSuccess}
        </div>
      )}

      {isLoading ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading team members...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border-primary)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}><ColumnHeader label="Name" icon={<User size={12} />} /></th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}><ColumnHeader label="Email" icon={<Mail size={12} />} /></th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}><ColumnHeader label="Role" icon={<Shield size={12} />} /></th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}><ColumnHeader label="Joined" icon={<Calendar size={12} />} /></th>
              <th style={{ textAlign: 'right', padding: '8px 12px' }}><ColumnHeader label="Actions" icon={<Settings size={12} />} /></th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr key={user.userId} style={{ borderBottom: '1px solid var(--color-border-secondary)' }}>
                <td style={{ padding: '10px 12px', color: 'var(--color-text-primary)' }}>{user.name || '—'}</td>
                <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>{user.email}</td>
                <td style={{ padding: '10px 12px' }}>
                  <Select
                    value={user.role}
                    onChange={(v) =>
                      updateRole.mutate({ userId: user.userId, role: v as TenantMemberRole })
                    }
                    disabled={user.userId === currentUserId}
                    size="sm"
                    width={100}
                    options={[
                      { value: 'owner', label: 'Owner', color: roleBadgeColor.owner },
                      { value: 'admin', label: 'Admin', color: roleBadgeColor.admin },
                      { value: 'member', label: 'Member', color: roleBadgeColor.member },
                    ]}
                  />
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  {user.userId !== currentUserId && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        if (confirm(`Remove ${user.email} from the team?`)) {
                          removeUser.mutate(user.userId);
                        }
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Add user modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
            zIndex: 1000,
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            style={{
              width: 420,
              padding: 24,
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--color-text-primary)' }}>
              Add team member
            </h3>
            {error && (
              <div style={{ padding: '8px 12px', marginBottom: 12, background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-error)', fontSize: 13 }}>
                {error}
              </div>
            )}
            <form onSubmit={handleAddUser}>
              <div style={{ marginBottom: 12 }}>
                <Input label="Email" type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} required />
              </div>
              <div style={{ marginBottom: 12 }}>
                <Input label="Name" type="text" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} required />
              </div>
              <div style={{ marginBottom: 12 }}>
                <Input label="Password" type="password" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} required minLength={8} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <Select
                  value={addForm.role}
                  onChange={(v) => setAddForm({ ...addForm, role: v as TenantMemberRole })}
                  options={[
                    { value: 'member', label: 'Member' },
                    { value: 'admin', label: 'Admin' },
                  ]}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Button variant="secondary" size="sm" type="button" onClick={() => { setShowAddModal(false); setError(''); }}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={createUser.isPending}>
                  {createUser.isPending ? 'Adding...' : 'Add user'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite user modal */}
      {showInviteModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
            zIndex: 1000,
          }}
          onClick={() => setShowInviteModal(false)}
        >
          <div
            style={{
              width: 420,
              padding: 24,
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-lg)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--color-text-primary)' }}>
              Invite team member
            </h3>
            {error && (
              <div style={{ padding: '8px 12px', marginBottom: 12, background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', borderRadius: 'var(--radius-md)', color: 'var(--color-error)', fontSize: 13 }}>
                {error}
              </div>
            )}
            <form onSubmit={handleInvite}>
              <div style={{ marginBottom: 12 }}>
                <Input label="Email" type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} required />
              </div>
              <div style={{ marginBottom: 16 }}>
                <Select
                  value={inviteForm.role}
                  onChange={(v) => setInviteForm({ ...inviteForm, role: v as TenantMemberRole })}
                  options={[
                    { value: 'member', label: 'Member' },
                    { value: 'admin', label: 'Admin' },
                  ]}
                />
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 16 }}>
                The user will receive an invitation link to set up their account.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <Button variant="secondary" size="sm" type="button" onClick={() => { setShowInviteModal(false); setError(''); }}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" disabled={inviteUser.isPending}>
                  {inviteUser.isPending ? 'Sending...' : 'Send invitation'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
