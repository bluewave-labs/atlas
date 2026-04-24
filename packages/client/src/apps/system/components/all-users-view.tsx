import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShieldPlus, ShieldMinus, Copy, Check } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { Button } from '../../../components/ui/button';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { useAuthStore } from '../../../stores/auth-store';
import { useToastStore } from '../../../stores/toast-store';

function CopyableEmail({ email }: { email: string | null }) {
  const [copied, setCopied] = useState(false);
  const addToast = useToastStore((s) => s.addToast);
  if (!email) return <span style={{ color: 'var(--color-text-secondary)' }}>—</span>;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(email);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = email;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    addToast({ message: 'Email copied', type: 'success', duration: 1500 });
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <span
      className="copyable-email"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--color-text-secondary)' }}
    >
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{email}</span>
      <button
        type="button"
        onClick={handleCopy}
        title={copied ? 'Copied' : 'Copy email'}
        aria-label={copied ? 'Email copied' : 'Copy email'}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 2,
          cursor: 'pointer',
          color: copied ? 'var(--color-success)' : 'var(--color-text-tertiary)',
          display: 'inline-flex',
          alignItems: 'center',
          opacity: copied ? 1 : 0,
          transition: 'opacity 120ms ease',
        }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </span>
  );
}

interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  provider: string | null;
  pictureUrl: string | null;
  isSuperAdmin: boolean;
  createdAt: string;
  tenants: Array<{ id: string; name: string | null; slug: string | null; role: 'owner' | 'admin' | 'member' }>;
}

export function AllUsersView() {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.account?.userId);
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const { data } = await api.get('/admin/users');
      return data.data as AdminUser[];
    },
    staleTime: 30_000,
  });

  const toggleSuperAdmin = useMutation({
    mutationFn: async ({ userId, isSuperAdmin }: { userId: string; isSuperAdmin: boolean }) => {
      const { data } = await api.put(`/admin/users/${userId}/super-admin`, { isSuperAdmin });
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });

  const columns: DataTableColumn<AdminUser>[] = [
    {
      key: 'name',
      label: 'Name',
      minWidth: 160,
      hideable: false,
      render: (u) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <strong>{u.name ?? '—'}</strong>
          {u.isSuperAdmin && <Badge variant="primary">super-admin</Badge>}
        </div>
      ),
      searchValue: (u) => u.name ?? '',
      compare: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''),
    },
    {
      key: 'email',
      label: 'Email',
      minWidth: 200,
      render: (u) => <CopyableEmail email={u.email} />,
      searchValue: (u) => u.email ?? '',
      compare: (a, b) => (a.email ?? '').localeCompare(b.email ?? ''),
    },
    {
      key: 'provider',
      label: 'Provider',
      width: 100,
      render: (u) => (
        <span style={{ color: 'var(--color-text-tertiary)' }}>{u.provider ?? '—'}</span>
      ),
      searchValue: (u) => u.provider ?? '',
    },
    {
      key: 'tenants',
      label: 'Tenants',
      minWidth: 160,
      render: (u) =>
        u.tenants.length === 0 ? (
          <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {u.tenants.map((t) => (
              <Badge key={t.id} variant="default">{t.name ?? t.slug}</Badge>
            ))}
          </div>
        ),
      searchValue: (u) => u.tenants.map((t) => t.name ?? t.slug ?? '').join(' '),
    },
    {
      key: 'role',
      label: 'Role',
      width: 140,
      render: (u) =>
        u.tenants.length === 0 ? (
          <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
        ) : u.tenants.length === 1 ? (
          <Badge variant={u.tenants[0].role === 'owner' ? 'success' : 'default'}>{u.tenants[0].role}</Badge>
        ) : (
          <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
            {u.tenants.length} memberships
          </span>
        ),
      searchValue: (u) => u.tenants.map((t) => t.role).join(' '),
    },
    {
      key: 'createdAt',
      label: 'Created',
      width: 120,
      render: (u) => (
        <span style={{ color: 'var(--color-text-tertiary)' }}>
          {new Date(u.createdAt).toLocaleDateString()}
        </span>
      ),
      searchValue: (u) => new Date(u.createdAt).toLocaleDateString(),
      compare: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      key: 'actions',
      label: '',
      width: 200,
      hideable: false,
      resizable: false,
      align: 'right',
      render: (u) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          <Button
            variant={u.isSuperAdmin ? 'danger' : 'secondary'}
            size="sm"
            disabled={u.id === currentUserId || toggleSuperAdmin.isPending}
            onClick={() => toggleSuperAdmin.mutate({ userId: u.id, isSuperAdmin: !u.isSuperAdmin })}
            title={u.id === currentUserId ? 'You cannot change your own super-admin status' : undefined}
          >
            {u.isSuperAdmin
              ? <ShieldMinus size={14} style={{ marginRight: 6 }} />
              : <ShieldPlus size={14} style={{ marginRight: 6 }} />}
            {u.isSuperAdmin ? 'Revoke super-admin' : 'Grant super-admin'}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100 }}>
      <div>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          All users
        </h2>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>
          Every user across every tenant on this instance.
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} style={{ height: 48 }} />)}
        </div>
      ) : (
        <DataTable
          data={data ?? []}
          columns={columns}
          storageKey="system_all_users"
          searchable
          searchPlaceholder="Filter by name, email, or tenant…"
          paginated={false}
          emptyTitle="No users"
          emptyDescription="No users match that filter."
        />
      )}
    </div>
  );
}
