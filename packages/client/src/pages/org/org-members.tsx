import { useState } from 'react';
import { UserPlus, Mail, Search } from 'lucide-react';
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

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  border: '1px solid var(--color-border-primary)',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--font-size-sm)',
  outline: 'none',
  background: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
  boxSizing: 'border-box',
  fontFamily: 'var(--font-family)',
  transition: 'border-color 0.15s ease',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-medium)',
  marginBottom: 6,
  color: 'var(--color-text-primary)',
};

const primaryBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '0 14px',
  height: 34,
  background: 'var(--color-accent-primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-medium)',
  cursor: 'pointer',
  fontFamily: 'var(--font-family)',
  transition: 'opacity 0.15s ease',
};

const secondaryBtnStyle: React.CSSProperties = {
  ...primaryBtnStyle,
  background: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
  border: '1px solid var(--color-border-primary)',
};

// ---------------------------------------------------------------------------
// Role badge
// ---------------------------------------------------------------------------

const ROLE_STYLES: Record<string, { bg: string; text: string }> = {
  owner: { bg: 'color-mix(in srgb, #7c3aed 10%, transparent)', text: '#7c3aed' },
  admin: { bg: 'color-mix(in srgb, #2563eb 10%, transparent)', text: '#2563eb' },
  member: { bg: 'color-mix(in srgb, #6b7280 10%, transparent)', text: '#6b7280' },
};

function RoleBadge({ role }: { role: string }) {
  const s = ROLE_STYLES[role] ?? ROLE_STYLES.member;
  return (
    <span style={{
      display: 'inline-flex',
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 500,
      borderRadius: 10,
      background: s.bg,
      color: s.text,
      textTransform: 'capitalize',
    }}>
      {role}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

function UserAvatar({ name, email }: { name: string | null; email: string }) {
  const initials = (name || email)
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div style={{
      width: 32,
      height: 32,
      borderRadius: '50%',
      background: 'color-mix(in srgb, var(--color-accent-primary) 12%, transparent)',
      color: 'var(--color-accent-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 12,
      fontWeight: 600,
      flexShrink: 0,
      letterSpacing: '0.02em',
      userSelect: 'none',
    }}>
      {initials}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--spacing-md)',
      padding: 'var(--spacing-md) var(--spacing-lg)',
    }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-border-primary)', opacity: 0.5 }} />
      <div style={{ flex: 1 }}>
        <div style={{ width: 120, height: 14, borderRadius: 'var(--radius-sm)', background: 'var(--color-border-primary)', opacity: 0.5, marginBottom: 4 }} />
        <div style={{ width: 180, height: 12, borderRadius: 'var(--radius-sm)', background: 'var(--color-border-primary)', opacity: 0.3 }} />
      </div>
      <div style={{ width: 50, height: 20, borderRadius: 10, background: 'var(--color-border-primary)', opacity: 0.3 }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// OrgMembersPage
// ---------------------------------------------------------------------------

export function OrgMembersPage() {
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
  const [error, setError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  if (!tenantId) {
    return (
      <div style={{ padding: 32, fontFamily: 'var(--font-family)', color: 'var(--color-text-secondary)' }}>
        <h2 style={{ fontSize: 20, marginBottom: 12, color: 'var(--color-text-primary)' }}>Team</h2>
        <p>Team management requires a company account. Please register or ask your admin to add you.</p>
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

  const filteredUsers = users?.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (u.name?.toLowerCase().includes(q)) || u.email.toLowerCase().includes(q);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)', fontFamily: 'var(--font-family)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-primary)', margin: 0 }}>
            Team members
          </h2>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>
            {users ? `${users.length} member${users.length !== 1 ? 's' : ''}` : 'Loading...'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowInviteModal(true)} style={secondaryBtnStyle}>
            <Mail size={14} />
            Invite
          </button>
          <button onClick={() => setShowAddModal(true)} style={primaryBtnStyle}>
            <UserPlus size={14} />
            Add user
          </button>
        </div>
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
          <button
            onClick={() => setInviteSuccess('')}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 320 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', pointerEvents: 'none' }} />
        <input
          type="text"
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ ...inputStyle, paddingLeft: 32 }}
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
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-tertiary)' }}>User</span>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-tertiary)' }}>Email</span>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-tertiary)' }}>Role</span>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-tertiary)' }}>Joined</span>
          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-tertiary)', textAlign: 'right' }}></span>
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
            return (
              <div
                key={user.userId}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 100px 100px 80px',
                  gap: 'var(--spacing-sm)',
                  alignItems: 'center',
                  padding: 'var(--spacing-md) var(--spacing-lg)',
                  borderBottom: i < (filteredUsers?.length ?? 0) - 1 ? '1px solid var(--color-border-primary)' : 'none',
                  transition: 'background 0.1s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover, var(--color-bg-secondary))'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                {/* User */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', minWidth: 0 }}>
                  <UserAvatar name={user.name} email={user.email} />
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
                <div>
                  {isCurrentUser ? (
                    <RoleBadge role={user.role} />
                  ) : (
                    <select
                      value={user.role}
                      onChange={(e) => updateRole.mutate({ userId: user.userId, role: e.target.value as TenantMemberRole })}
                      style={{
                        padding: '2px 6px',
                        fontSize: 11,
                        fontWeight: 500,
                        border: '1px solid var(--color-border-primary)',
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-bg-primary)',
                        color: (ROLE_STYLES[user.role] ?? ROLE_STYLES.member).text,
                        cursor: 'pointer',
                        fontFamily: 'var(--font-family)',
                        outline: 'none',
                      }}
                    >
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </select>
                  )}
                </div>

                {/* Joined */}
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                  {new Date(user.createdAt).toLocaleDateString()}
                </div>

                {/* Actions */}
                <div style={{ textAlign: 'right' }}>
                  {!isCurrentUser && (
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${user.name || user.email} from the team?`)) {
                          removeUser.mutate(user.userId);
                        }
                      }}
                      style={{
                        padding: '3px 10px',
                        fontSize: 11,
                        fontWeight: 500,
                        background: 'transparent',
                        color: '#dc2626',
                        border: '1px solid color-mix(in srgb, #dc2626 25%, transparent)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-family)',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, #dc2626 8%, transparent)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add user modal */}
      {showAddModal && (
        <ModalOverlay onClose={() => { setShowAddModal(false); setError(''); }}>
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-lg)', color: 'var(--color-text-primary)' }}>
            Add team member
          </h3>
          {error && <ErrorBanner message={error} />}
          <form onSubmit={handleAddUser}>
            <FormField label="Email">
              <input type="email" value={addForm.email} onChange={(e) => setAddForm({ ...addForm, email: e.target.value })} required style={inputStyle} placeholder="user@company.com" />
            </FormField>
            <FormField label="Name">
              <input type="text" value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} required style={inputStyle} placeholder="Full name" />
            </FormField>
            <FormField label="Password">
              <input type="password" value={addForm.password} onChange={(e) => setAddForm({ ...addForm, password: e.target.value })} required minLength={8} style={inputStyle} placeholder="Min. 8 characters" />
            </FormField>
            <FormField label="Role" last>
              <select value={addForm.role} onChange={(e) => setAddForm({ ...addForm, role: e.target.value as TenantMemberRole })} style={inputStyle}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </FormField>
            <ModalActions
              onCancel={() => { setShowAddModal(false); setError(''); }}
              submitLabel={createUser.isPending ? 'Adding...' : 'Add user'}
              disabled={createUser.isPending}
            />
          </form>
        </ModalOverlay>
      )}

      {/* Invite user modal */}
      {showInviteModal && (
        <ModalOverlay onClose={() => { setShowInviteModal(false); setError(''); }}>
          <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 'var(--font-weight-semibold)', marginBottom: 'var(--spacing-lg)', color: 'var(--color-text-primary)' }}>
            Invite team member
          </h3>
          {error && <ErrorBanner message={error} />}
          <form onSubmit={handleInvite}>
            <FormField label="Email">
              <input type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} required style={inputStyle} placeholder="user@company.com" />
            </FormField>
            <FormField label="Role">
              <select value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as TenantMemberRole })} style={inputStyle}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </FormField>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: 'var(--spacing-lg)' }}>
              The user will receive an invitation link to set up their account.
            </p>
            <ModalActions
              onCancel={() => { setShowInviteModal(false); setError(''); }}
              submitLabel={inviteUser.isPending ? 'Sending...' : 'Send invitation'}
              disabled={inviteUser.isPending}
            />
          </form>
        </ModalOverlay>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable modal helpers
// ---------------------------------------------------------------------------

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 420,
          padding: 24,
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function FormField({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 'var(--spacing-lg)' : 'var(--spacing-md)' }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function ModalActions({ onCancel, submitLabel, disabled }: { onCancel: () => void; submitLabel: string; disabled?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <button type="button" onClick={onCancel} style={secondaryBtnStyle}>Cancel</button>
      <button type="submit" disabled={disabled} style={{ ...primaryBtnStyle, opacity: disabled ? 0.7 : 1 }}>{submitLabel}</button>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div style={{
      padding: 'var(--spacing-sm) var(--spacing-md)',
      marginBottom: 'var(--spacing-md)',
      background: 'color-mix(in srgb, #dc2626 8%, transparent)',
      border: '1px solid color-mix(in srgb, #dc2626 25%, transparent)',
      borderRadius: 'var(--radius-sm)',
      color: '#dc2626',
      fontSize: 'var(--font-size-xs)',
    }}>
      {message}
    </div>
  );
}
