import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api-client';
import { Badge } from '../../../components/ui/badge';
import { Skeleton } from '../../../components/ui/skeleton';
import { formatBytes } from '../../../lib/format';

interface AdminTenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: 'active' | 'suspended' | 'trial';
  storageQuotaBytes: number;
  memberCount: number;
  createdAt: string;
}

export function TenantsView() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: async () => {
      const { data } = await api.get('/admin/tenants');
      return data.data as AdminTenant[];
    },
    staleTime: 30_000,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100 }}>
      <div>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          All tenants
        </h2>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>
          Every organization on this Atlas instance. Super-admin view.
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} style={{ height: 44 }} />)}
        </div>
      ) : !data || data.length === 0 ? (
        <div style={{ color: 'var(--color-text-tertiary)', padding: 40, textAlign: 'center' }}>No tenants.</div>
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
                <th style={th}>Slug</th>
                <th style={th}>Plan</th>
                <th style={th}>Status</th>
                <th style={th}>Members</th>
                <th style={th}>Storage quota</th>
                <th style={th}>Created</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t) => (
                <tr key={t.id} style={{ borderTop: '1px solid var(--color-border-secondary)' }}>
                  <td style={td}><strong>{t.name}</strong></td>
                  <td style={{ ...td, color: 'var(--color-text-secondary)' }}>{t.slug}</td>
                  <td style={td}><Badge variant="default">{t.plan}</Badge></td>
                  <td style={td}>
                    <Badge variant={t.status === 'active' ? 'success' : t.status === 'suspended' ? 'error' : 'warning'}>
                      {t.status}
                    </Badge>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>{t.memberCount}</td>
                  <td style={{ ...td, color: 'var(--color-text-secondary)' }}>{formatBytes(t.storageQuotaBytes)}</td>
                  <td style={{ ...td, color: 'var(--color-text-tertiary)' }}>
                    {new Date(t.createdAt).toLocaleDateString()}
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
const td = { padding: '10px 14px', color: 'var(--color-text-primary)' };
