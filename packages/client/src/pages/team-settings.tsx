import { useState } from 'react';
import { useAuthStore } from '../stores/auth-store';
import {
  useTenantUsers,
  useCreateTenantUser,
  useRemoveTenantUser,
  useUpdateTenantUserRole,
  useInviteTenantUser,
} from '../hooks/use-platform';
import type { TenantMemberRole } from '@atlasmail/shared';

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
        <p>Team management requires a company account. Please register or ask your admin to add you.</p>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d0d5dd',
    borderRadius: 4,
    fontSize: 14,
    outline: 'none',
    background: 'var(--color-bg-primary)',
    color: 'var(--color-text-primary)',
    boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 6,
    color: 'var(--color-text-primary)',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '6px 14px',
    height: 34,
    background: '#13715B',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  };

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
          <button
            onClick={() => setShowInviteModal(true)}
            style={{ ...buttonStyle, background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', border: '1px solid #d0d5dd' }}
          >
            Invite user
          </button>
          <button onClick={() => setShowAddModal(true)} style={buttonStyle}>
            Add user
          </button>
        </div>
      </div>

      {inviteSuccess && (
        <div style={{ padding: '8px 12px', marginBottom: 16, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 4, color: '#16a34a', fontSize: 13 }}>
          {inviteSuccess}
        </div>
      )}

      {isLoading ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading team members...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #d0d5dd' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500, color: 'var(--color-text-secondary)', fontSize: 13 }}>Name</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500, color: 'var(--color-text-secondary)', fontSize: 13 }}>Email</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500, color: 'var(--color-text-secondary)', fontSize: 13 }}>Role</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 500, color: 'var(--color-text-secondary)', fontSize: 13 }}>Joined</th>
              <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 500, color: 'var(--color-text-secondary)', fontSize: 13 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => (
              <tr key={user.userId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 12px', color: 'var(--color-text-primary)' }}>{user.name || '—'}</td>
                <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>{user.email}</td>
                <td style={{ padding: '10px 12px' }}>
                  <select
                    value={user.role}
                    onChange={(e) =>
                      updateRole.mutate({ userId: user.userId, role: e.target.value as TenantMemberRole })
                    }
                    disabled={user.userId === currentUserId}
                    style={{
                      padding: '2px 8px',
                      fontSize: 12,
                      fontWeight: 500,
                      border: '1px solid #d0d5dd',
                      borderRadius: 4,
                      background: 'var(--color-bg-primary)',
                      color: roleBadgeColor[user.role] || '#6b7280',
                      cursor: user.userId === currentUserId ? 'default' : 'pointer',
                    }}
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </select>
                </td>
                <td style={{ padding: '10px 12px', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                  {user.userId !== currentUserId && (
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${user.email} from the team?`)) {
                          removeUser.mutate(user.userId);
                        }
                      }}
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        background: 'transparent',
                        color: '#dc2626',
                        border: '1px solid #fecaca',
                        borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      Remove
                    </button>
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
              border: '1px solid #d0d5dd',
              borderRadius: 8,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--color-text-primary)' }}>
              Add team member
            </h3>
            {error && (
              <div style={{ padding: '8px 12px', marginBottom: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, color: '#dc2626', fontSize: 13 }}>
                {error}
              </div>
            )}
            <form onSubmit={handleAddUser}>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Email</label>
                <input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} required style={inputStyle} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Name</label>
                <input type="text" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} required style={inputStyle} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Password</label>
                <input type="password" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} required minLength={8} style={inputStyle} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Role</label>
                <select value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value as TenantMemberRole })} style={inputStyle}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowAddModal(false); setError(''); }} style={{ ...buttonStyle, background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', border: '1px solid #d0d5dd' }}>
                  Cancel
                </button>
                <button type="submit" disabled={createUser.isPending} style={buttonStyle}>
                  {createUser.isPending ? 'Adding...' : 'Add user'}
                </button>
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
              border: '1px solid #d0d5dd',
              borderRadius: 8,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--color-text-primary)' }}>
              Invite team member
            </h3>
            {error && (
              <div style={{ padding: '8px 12px', marginBottom: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, color: '#dc2626', fontSize: 13 }}>
                {error}
              </div>
            )}
            <form onSubmit={handleInvite}>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>Email</label>
                <input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} required style={inputStyle} />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Role</label>
                <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as TenantMemberRole })} style={inputStyle}>
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <p style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 16 }}>
                The user will receive an invitation link to set up their account.
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowInviteModal(false); setError(''); }} style={{ ...buttonStyle, background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', border: '1px solid #d0d5dd' }}>
                  Cancel
                </button>
                <button type="submit" disabled={inviteUser.isPending} style={buttonStyle}>
                  {inviteUser.isPending ? 'Sending...' : 'Send invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
