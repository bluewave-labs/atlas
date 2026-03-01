import { useState } from 'react';
import { Play, Square, RotateCw, AppWindow } from 'lucide-react';
import { useAdminInstallations, useInstallationAction } from '../../hooks/use-admin';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Chip } from '../../components/ui/chip';
import { Skeleton } from '../../components/ui/skeleton';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';

const STATUS_FILTERS = ['all', 'running', 'stopped', 'error', 'installing'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

function statusVariant(status: string): 'success' | 'error' | 'warning' | 'default' {
  if (status === 'running') return 'success';
  if (status === 'error') return 'error';
  if (status === 'stopped') return 'warning';
  return 'default';
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: 'var(--spacing-sm) var(--spacing-md)',
  fontSize: 'var(--font-size-xs)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--color-text-tertiary)',
  borderBottom: '1px solid var(--color-border-primary)',
  whiteSpace: 'nowrap',
  userSelect: 'none',
};

const tdStyle: React.CSSProperties = {
  padding: 'var(--spacing-sm) var(--spacing-md)',
  fontSize: 'var(--font-size-sm)',
  borderBottom: '1px solid var(--color-border-secondary)',
  whiteSpace: 'nowrap',
  color: 'var(--color-text-primary)',
};

export function AdminInstallationsPage() {
  const { data: installations, isLoading } = useAdminInstallations();
  const installAction = useInstallationAction();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [confirmStopId, setConfirmStopId] = useState<string | null>(null);
  const confirmStopInst = installations?.find((i) => i.id === confirmStopId);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
        {/* Header skeleton */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
          <Skeleton width={100} height={20} borderRadius="var(--radius-sm)" />
          <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} width={60} height={22} borderRadius="var(--radius-lg)" />
            ))}
          </div>
        </div>
        {/* Table skeleton */}
        <div style={{
          background: 'var(--color-bg-primary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border-primary)',
          padding: 'var(--spacing-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-sm)',
        }}>
          <Skeleton width="100%" height={36} borderRadius="var(--radius-sm)" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={44} borderRadius="var(--radius-sm)" />
          ))}
        </div>
      </div>
    );
  }

  const filtered = filter === 'all'
    ? installations
    : installations?.filter((i) => i.status === filter);

  const total = installations?.length ?? 0;

  return (
    <div>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--spacing-lg)',
        gap: 'var(--spacing-md)',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <span style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
          }}>
            {total} {total === 1 ? 'installation' : 'installations'}
          </span>
        </div>

        {/* Status filter chips */}
        <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map((s) => (
            <Chip
              key={s}
              active={filter === s}
              onClick={() => setFilter(s)}
              aria-pressed={filter === s}
              style={{ textTransform: 'capitalize' }}
            >
              {s}
            </Chip>
          ))}
        </div>
      </div>

      {/* Table card */}
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
              <th style={thStyle}>Tenant</th>
              <th style={thStyle}>Subdomain</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Health</th>
              <th style={thStyle}>Created</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered && filtered.length > 0 ? (
              filtered.map((inst) => (
                <tr
                  key={inst.id}
                  onMouseEnter={() => setHoveredRow(inst.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    background: hoveredRow === inst.id ? 'var(--color-surface-hover)' : 'transparent',
                    transition: 'background var(--transition-normal)',
                  }}
                >
                  <td style={{ ...tdStyle, fontWeight: 'var(--font-weight-medium)' }}>
                    {inst.appName ?? inst.catalogAppId}
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--color-text-secondary)' }}>
                    {inst.tenantName ?? inst.tenantId}
                  </td>
                  <td style={{
                    ...tdStyle,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-tertiary)',
                  }}>
                    {inst.subdomain}
                  </td>
                  <td style={tdStyle}>
                    <Badge variant={statusVariant(inst.status)}>
                      {inst.status}
                    </Badge>
                  </td>
                  <td style={tdStyle}>
                    {inst.lastHealthStatus
                      ? <Badge variant={statusVariant(inst.lastHealthStatus)}>{inst.lastHealthStatus}</Badge>
                      : <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>
                    }
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--color-text-tertiary)' }}>
                    {new Date(inst.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ ...tdStyle, padding: 'var(--spacing-xs) var(--spacing-md)' }}>
                    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', alignItems: 'center' }}>
                      {inst.status === 'stopped' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          icon={<Play size={12} />}
                          onClick={() => installAction.mutate({ id: inst.id, action: 'start' })}
                          disabled={installAction.isPending}
                          aria-label={`Start ${inst.appName ?? inst.catalogAppId}`}
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
                            onClick={() => setConfirmStopId(inst.id)}
                            disabled={installAction.isPending}
                            aria-label={`Stop ${inst.appName ?? inst.catalogAppId}`}
                          >
                            Stop
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            icon={<RotateCw size={12} />}
                            onClick={() => installAction.mutate({ id: inst.id, action: 'restart' })}
                            disabled={installAction.isPending}
                            aria-label={`Restart ${inst.appName ?? inst.catalogAppId}`}
                          >
                            Restart
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--spacing-sm)',
                    padding: 'var(--spacing-3xl) var(--spacing-xl)',
                    color: 'var(--color-text-tertiary)',
                  }}>
                    <AppWindow size={32} strokeWidth={1.5} />
                    <span style={{ fontSize: 'var(--font-size-sm)' }}>No installations found</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Confirm stop */}
      <ConfirmDialog
        open={!!confirmStopId}
        onOpenChange={(open) => { if (!open) setConfirmStopId(null); }}
        title="Stop installation"
        description={`Stop ${confirmStopInst?.appName ?? confirmStopInst?.catalogAppId ?? 'this installation'}? The app will become unavailable until restarted.`}
        confirmLabel="Stop"
        destructive
        onConfirm={() => {
          if (confirmStopId) {
            installAction.mutate({ id: confirmStopId, action: 'stop' });
            setConfirmStopId(null);
          }
        }}
      />
    </div>
  );
}
