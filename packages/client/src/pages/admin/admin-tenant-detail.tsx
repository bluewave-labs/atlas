import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, AppWindow, Play, Square, RotateCw, Cpu, HardDrive, MemoryStick } from 'lucide-react';
import { useAdminTenant, useUpdateTenantStatus, useUpdateTenantPlan, useInstallationAction } from '../../hooks/use-admin';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../config/query-keys';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Chip } from '../../components/ui/chip';
import { Skeleton } from '../../components/ui/skeleton';

const PLANS = ['starter', 'pro', 'enterprise'];

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 12px',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-tertiary)',
  borderBottom: '1px solid var(--color-border-primary)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 'var(--font-size-sm)',
  borderBottom: '1px solid var(--color-border-secondary)',
  whiteSpace: 'nowrap',
};

type BadgeVariant = 'success' | 'error' | 'warning' | 'default';

function statusVariant(status: string): BadgeVariant {
  if (['running', 'active', 'healthy'].includes(status)) return 'success';
  if (['stopped', 'error', 'unhealthy', 'suspended'].includes(status)) return 'error';
  if (status === 'installing') return 'warning';
  return 'default';
}

const PLAN_COLORS: Record<string, string> = {
  starter: 'var(--color-text-tertiary)',
  pro: 'var(--color-accent-primary)',
  enterprise: 'var(--color-warning)',
};

export function AdminTenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: tenant, isLoading } = useAdminTenant(id!);
  const statusMutation = useUpdateTenantStatus();
  const planMutation = useUpdateTenantPlan();
  const installAction = useInstallationAction();
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: queryKeys.admin.tenant(id!) });
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
        {/* Back button placeholder */}
        <Skeleton width={140} height={28} borderRadius="var(--radius-md)" />
        {/* Header card */}
        <div style={{
          background: 'var(--color-bg-primary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-primary)',
          padding: 'var(--spacing-xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-lg)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
            <Skeleton width={200} height={24} borderRadius="var(--radius-sm)" />
            <Skeleton width={64} height={20} borderRadius="var(--radius-lg)" />
            <Skeleton width={52} height={20} borderRadius="var(--radius-lg)" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--spacing-md)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid var(--color-border-secondary)' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                <Skeleton width={80} height={12} borderRadius={3} />
                <Skeleton width={100} height={16} borderRadius={3} />
              </div>
            ))}
          </div>
        </div>
        {/* Table placeholders */}
        {[0, 1].map((section) => (
          <div key={section} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <Skeleton width={120} height={20} borderRadius="var(--radius-sm)" />
            <div style={{ background: 'var(--color-bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-primary)', padding: 'var(--spacing-md)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} width="100%" height={36} borderRadius="var(--radius-sm)" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!tenant) {
    return (
      <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
        Tenant not found
      </div>
    );
  }

  const isSuspended = tenant.status === 'suspended';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>

      {/* Back button */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          icon={<ArrowLeft size={14} />}
          onClick={() => navigate('/admin/tenants')}
        >
          Back to tenants
        </Button>
      </div>

      {/* Header info card */}
      <div style={{
        background: 'var(--color-bg-primary)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border-primary)',
        padding: 'var(--spacing-xl)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-lg)',
      }}>
        {/* Top row: name + status + actions */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 'var(--spacing-md)',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 'var(--font-size-xl)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-text-primary)',
              }}>
                {tenant.name}
              </span>
              <Badge variant={statusVariant(tenant.status)}>{tenant.status}</Badge>
              <Chip color={PLAN_COLORS[tenant.plan] ?? 'var(--color-accent-primary)'} height={20}>
                {tenant.plan}
              </Chip>
            </div>
            <span style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-mono)',
            }}>
              {tenant.slug}
            </span>
          </div>

          {/* Status action */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', flexShrink: 0 }}>
            <Button
              variant={isSuspended ? 'secondary' : 'danger'}
              size="sm"
              disabled={statusMutation.isPending}
              onClick={() => {
                statusMutation.mutate(
                  { id: tenant.id, status: isSuspended ? 'active' : 'suspended' },
                  { onSuccess: invalidate },
                );
              }}
            >
              {isSuspended ? 'Activate' : 'Suspend'}
            </Button>
          </div>
        </div>

        {/* Quota + plan grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 'var(--spacing-md)',
          paddingTop: 'var(--spacing-md)',
          borderTop: '1px solid var(--color-border-secondary)',
        }}>
          {/* Plan selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <span style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              fontWeight: 'var(--font-weight-medium)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              Plan
            </span>
            <select
              value={tenant.plan}
              onChange={(e) => {
                planMutation.mutate({ id: tenant.id, plan: e.target.value }, { onSuccess: invalidate });
              }}
              style={{
                padding: '5px 8px',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg-elevated)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family)',
                cursor: 'pointer',
                outline: 'none',
                width: '100%',
                maxWidth: 140,
              }}
            >
              {PLANS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* CPU */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <span style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              fontWeight: 'var(--font-weight-medium)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <Cpu size={11} />
              CPU quota
            </span>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' }}>
              {tenant.quotaCpu}m
            </span>
          </div>

          {/* Memory */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <span style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              fontWeight: 'var(--font-weight-medium)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <MemoryStick size={11} />
              Memory quota
            </span>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' }}>
              {tenant.quotaMemoryMb} MB
            </span>
          </div>

          {/* Storage */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
            <span style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
              fontWeight: 'var(--font-weight-medium)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <HardDrive size={11} />
              Storage quota
            </span>
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', fontWeight: 'var(--font-weight-medium)' }}>
              {tenant.quotaStorageMb} MB
            </span>
          </div>
        </div>
      </div>

      {/* Members section */}
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          marginBottom: 'var(--spacing-md)',
        }}>
          <Users size={15} style={{ color: 'var(--color-text-tertiary)' }} />
          <span style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
          }}>
            Members
          </span>
          <Chip height={18} style={{ padding: '0 var(--spacing-xs)' }}>
            {tenant.members.length}
          </Chip>
        </div>

        <div style={{
          background: 'var(--color-bg-primary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-primary)',
          overflow: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>User ID</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {tenant.members.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                    No members
                  </td>
                </tr>
              )}
              {tenant.members.map((m) => (
                <tr key={m.userId}>
                  <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                    {m.userId}
                  </td>
                  <td style={tdStyle}>
                    <Badge variant={m.role === 'owner' ? 'primary' : 'default'}>{m.role}</Badge>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--color-text-tertiary)' }}>
                    {new Date(m.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Installations section */}
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          marginBottom: 'var(--spacing-md)',
        }}>
          <AppWindow size={15} style={{ color: 'var(--color-text-tertiary)' }} />
          <span style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-text-primary)',
          }}>
            Installations
          </span>
          <Chip height={18} style={{ padding: '0 var(--spacing-xs)' }}>
            {tenant.installations.length}
          </Chip>
        </div>

        <div style={{
          background: 'var(--color-bg-primary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-primary)',
          overflow: 'auto',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={thStyle}>App</th>
                <th style={thStyle}>Subdomain</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Health</th>
                <th style={thStyle}>Assigned</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenant.installations.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                    No installations
                  </td>
                </tr>
              )}
              {tenant.installations.map((inst) => (
                <tr key={inst.id}>
                  <td style={{ ...tdStyle, fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
                    {inst.appName ?? inst.catalogAppId}
                  </td>
                  <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                    {inst.subdomain}
                  </td>
                  <td style={tdStyle}>
                    <Badge variant={statusVariant(inst.status)}>{inst.status}</Badge>
                  </td>
                  <td style={tdStyle}>
                    {inst.lastHealthStatus
                      ? <Badge variant={statusVariant(inst.lastHealthStatus)}>{inst.lastHealthStatus}</Badge>
                      : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--color-text-tertiary)' }}>
                    {inst.assignedCount ?? '—'}
                  </td>
                  <td style={{ ...tdStyle }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                      {inst.status === 'stopped' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Play size={12} />}
                          disabled={installAction.isPending}
                          onClick={() => installAction.mutate({ id: inst.id, action: 'start' }, { onSuccess: invalidate })}
                        >
                          Start
                        </Button>
                      )}
                      {inst.status === 'running' && (
                        <>
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<Square size={12} />}
                            disabled={installAction.isPending}
                            onClick={() => installAction.mutate({ id: inst.id, action: 'stop' }, { onSuccess: invalidate })}
                          >
                            Stop
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<RotateCw size={12} />}
                            disabled={installAction.isPending}
                            onClick={() => installAction.mutate({ id: inst.id, action: 'restart' }, { onSuccess: invalidate })}
                          >
                            Restart
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
