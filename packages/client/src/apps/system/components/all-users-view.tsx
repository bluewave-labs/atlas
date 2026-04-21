import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { Input } from '../../../components/ui/input';

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
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async () => {
      const { data } = await api.get('/admin/users');
      return data.data as AdminUser[];
    },
    staleTime: 30_000,
  });

  const [filter, setFilter] = useState('');
  const filtered = useMemo(() => {
    if (!data) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return data;
    return data.filter((u) =>
      (u.name ?? '').toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      u.tenants.some((t) => (t.name ?? '').toLowerCase().includes(q) || (t.slug ?? '').toLowerCase().includes(q)),
    );
  }, [data, filter]);

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

      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter by name, email, or tenant…"
        size="sm"
        style={{ maxWidth: 320 }}
      />

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} style={{ height: 48 }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ color: 'var(--color-text-tertiary)', padding: 40, textAlign: 'center' }}>
          {filter ? 'No users match that filter.' : 'No users.'}
        </div>
      ) : (
        <div style={{
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background: 'var(--color-bg-primary)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-secondary)', textAlign: 'left' }}>
                <th style={th}>Name</th>
                <th style={th}>Email</th>
                <th style={th}>Provider</th>
                <th style={th}>Tenants</th>
                <th style={th}>Role</th>
                <th style={th}>Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} style={{ borderTop: '1px solid var(--color-border-secondary)' }}>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong>{u.name ?? '—'}</strong>
                      {u.isSuperAdmin && <Badge variant="primary">super-admin</Badge>}
                    </div>
                  </td>
                  <td style={{ ...td, color: 'var(--color-text-secondary)' }}>{u.email ?? '—'}</td>
                  <td style={{ ...td, color: 'var(--color-text-tertiary)' }}>{u.provider ?? '—'}</td>
                  <td style={td}>
                    {u.tenants.length === 0
                      ? <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                      : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {u.tenants.map((t) => (
                            <Badge key={t.id} variant="default">{t.name ?? t.slug}</Badge>
                          ))}
                        </div>
                    }
                  </td>
                  <td style={td}>
                    {u.tenants.length === 0
                      ? <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                      : u.tenants.length === 1
                        ? <Badge variant={u.tenants[0].role === 'owner' ? 'success' : 'default'}>{u.tenants[0].role}</Badge>
                        : <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>{u.tenants.length} memberships</span>
                    }
                  </td>
                  <td style={{ ...td, color: 'var(--color-text-tertiary)' }}>
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th = { padding: '10px 14px', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase' as const, letterSpacing: 0.3 };
const td = { padding: '10px 14px', color: 'var(--color-text-primary)', verticalAlign: 'top' as const };
