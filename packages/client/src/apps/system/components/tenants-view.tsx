import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { UserCog } from 'lucide-react';
import { api } from '../../../lib/api-client';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { Modal } from '../../../components/ui/modal';
import { Tooltip } from '../../../components/ui/tooltip';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { formatBytes } from '../../../lib/format';
import { startImpersonation } from '../impersonation';

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

interface TenantMember {
  userId: string;
  name: string | null;
  email: string | null;
  provider: string | null;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
  isSuperAdmin: boolean;
}

interface TenantDetail extends AdminTenant {
  members: TenantMember[];
}

export function TenantsView() {
  const { t } = useTranslation();
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'tenants'],
    queryFn: async () => {
      const { data } = await api.get('/admin/tenants');
      return data.data as AdminTenant[];
    },
    staleTime: 30_000,
  });

  const detail = useQuery({
    queryKey: ['admin', 'tenant-detail', detailId],
    enabled: !!detailId,
    queryFn: async () => {
      const { data } = await api.get(`/admin/tenants/${detailId}/detail`);
      return data.data as TenantDetail;
    },
  });

  const impersonate = useMutation({
    mutationFn: async (tenantId: string) => {
      const { data } = await api.post(`/admin/tenants/${tenantId}/impersonate`);
      return data.data as { token: string; tenantName: string; tenantSlug: string };
    },
    onSuccess: (d) => {
      startImpersonation(d.token, { name: d.tenantName, slug: d.tenantSlug });
      window.location.href = '/';
    },
  });

  const columns: DataTableColumn<AdminTenant>[] = [
    {
      key: 'name',
      label: t('system.adminTenants.colName'),
      minWidth: 160,
      hideable: false,
      render: (row) => row.name,
      searchValue: (row) => row.name,
      compare: (a, b) => a.name.localeCompare(b.name),
    },
    {
      key: 'slug',
      label: t('system.adminTenants.colSlug'),
      minWidth: 120,
      render: (row) => <span style={{ color: 'var(--color-text-secondary)' }}>{row.slug}</span>,
      searchValue: (row) => row.slug,
      compare: (a, b) => a.slug.localeCompare(b.slug),
    },
    {
      key: 'plan',
      label: t('system.adminTenants.colPlan'),
      width: 100,
      render: (row) => <Badge variant="default">{row.plan}</Badge>,
      searchValue: (row) => row.plan,
    },
    {
      key: 'status',
      label: t('system.adminTenants.colStatus'),
      width: 110,
      render: (row) => (
        <Badge variant={row.status === 'active' ? 'success' : row.status === 'suspended' ? 'error' : 'warning'}>
          {row.status}
        </Badge>
      ),
      searchValue: (row) => row.status,
    },
    {
      key: 'memberCount',
      label: t('system.adminTenants.colMembers'),
      width: 90,
      align: 'right',
      render: (row) => <span>{row.memberCount}</span>,
      compare: (a, b) => a.memberCount - b.memberCount,
    },
    {
      key: 'storageQuotaBytes',
      label: t('system.adminTenants.colStorage'),
      width: 130,
      render: (row) => <span style={{ color: 'var(--color-text-secondary)' }}>{formatBytes(row.storageQuotaBytes)}</span>,
      compare: (a, b) => a.storageQuotaBytes - b.storageQuotaBytes,
    },
    {
      key: 'createdAt',
      label: t('system.adminTenants.colCreated'),
      width: 120,
      render: (row) => (
        <span style={{ color: 'var(--color-text-tertiary)' }}>
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
      searchValue: (row) => new Date(row.createdAt).toLocaleDateString(),
      compare: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    },
    {
      key: 'actions',
      label: '',
      width: 170,
      hideable: false,
      resizable: false,
      align: 'right',
      render: (row) => (
        <div style={{ whiteSpace: 'nowrap' }}>
          <Tooltip content={t('system.adminTenants.impersonateTooltip')}>
            <Button
              variant="secondary"
              size="sm"
              disabled={impersonate.isPending}
              onClick={(e) => { e.stopPropagation(); impersonate.mutate(row.id); }}
            >
              <UserCog size={14} style={{ marginRight: 6 }} />
              {t('system.adminTenants.impersonate')}
            </Button>
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100 }}>
      <div>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('system.adminTenants.title')}
        </h2>
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', margin: '4px 0 0' }}>
          {t('system.adminTenants.description')}
        </p>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} style={{ height: 44 }} />)}
        </div>
      ) : (
        <DataTable
          data={data ?? []}
          columns={columns}
          storageKey="system_tenants"
          searchable
          onRowClick={(row) => setDetailId(row.id)}
          emptyTitle={t('system.adminTenants.emptyTitle')}
        />
      )}

      <Modal open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)} width={720} title={t('system.adminTenants.detailTitle')}>
        <Modal.Header
          title={detail.data?.name ?? t('system.adminTenants.loading')}
          subtitle={detail.data ? `${detail.data.slug} · ${detail.data.plan} · ${detail.data.status}` : undefined}
        />
        <Modal.Body>
          {detail.isLoading || !detail.data ? (
            <Skeleton style={{ height: 200 }} />
          ) : (
            <>
              <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, margin: '0 0 8px', color: 'var(--color-text-secondary)' }}>
                {t('system.adminTenants.membersTitle', { count: detail.data.members.length })}
              </h3>
              {/* NOTE: This members sub-table inside the tenant detail modal is left as raw HTML
                  because it is a simple read-only display within a small modal. */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-secondary)', textAlign: 'left' }}>
                    <th style={th}>{t('system.adminTenants.memberName')}</th>
                    <th style={th}>{t('system.adminTenants.memberEmail')}</th>
                    <th style={th}>{t('system.adminTenants.memberRole')}</th>
                    <th style={th}>{t('system.adminTenants.memberJoined')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.data.members.map((m) => (
                    <tr key={m.userId} style={{ borderTop: '1px solid var(--color-border-secondary)' }}>
                      <td style={td}>
                        {m.name ?? '—'}
                        {m.isSuperAdmin && <span style={{ marginLeft: 8 }}><Badge variant="primary">super-admin</Badge></span>}
                      </td>
                      <td style={{ ...td, color: 'var(--color-text-secondary)' }}>{m.email ?? '—'}</td>
                      <td style={td}>
                        <Badge variant={m.role === 'owner' ? 'success' : 'default'}>{m.role}</Badge>
                      </td>
                      <td style={{ ...td, color: 'var(--color-text-tertiary)' }}>
                        {new Date(m.joinedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}

const th = { padding: '10px 14px', fontWeight: 600, color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)', textTransform: 'uppercase' as const, letterSpacing: 0.3 };
const td = { padding: '10px 14px', color: 'var(--color-text-primary)' };
