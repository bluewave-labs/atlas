import { useState } from 'react';
import { RefreshCw, Container } from 'lucide-react';
import { useAdminContainers } from '../../hooks/use-admin';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/skeleton';

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

export function AdminContainersPage() {
  const { data: containers, isLoading } = useAdminContainers();
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
        {/* Header skeleton */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--spacing-sm)' }}>
          <Skeleton width={100} height={20} borderRadius="var(--radius-sm)" />
          <Skeleton width={160} height={16} borderRadius="var(--radius-sm)" />
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
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} width="100%" height={44} borderRadius="var(--radius-sm)" />
          ))}
        </div>
      </div>
    );
  }

  const total = containers?.length ?? 0;

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
        <span style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
        }}>
          {total} {total === 1 ? 'container' : 'containers'}
        </span>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-tertiary)',
        }}>
          <RefreshCw size={12} strokeWidth={1.5} />
          <span>Auto-refreshes every 10s</span>
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
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Image</th>
              <th style={thStyle}>State</th>
              <th style={thStyle}>Tenant</th>
              <th style={thStyle}>App ID</th>
              <th style={thStyle}>Installation ID</th>
            </tr>
          </thead>
          <tbody>
            {containers && containers.length > 0 ? (
              containers.map((c) => (
                <tr
                  key={c.id}
                  onMouseEnter={() => setHoveredRow(c.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{
                    background: hoveredRow === c.id ? 'var(--color-surface-hover)' : 'transparent',
                    transition: 'background var(--transition-normal)',
                  }}
                >
                  <td style={{ ...tdStyle, fontWeight: 'var(--font-weight-medium)' }}>
                    {c.name}
                  </td>
                  <td style={{
                    ...tdStyle,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-tertiary)',
                    maxWidth: 280,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {c.image}
                  </td>
                  <td style={tdStyle}>
                    <Badge variant={c.state === 'running' ? 'success' : 'warning'}>
                      {c.state}
                    </Badge>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--color-text-secondary)' }}>
                    {c.tenant}
                  </td>
                  <td style={{
                    ...tdStyle,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--font-size-xs)',
                  }}>
                    {c.appId}
                  </td>
                  <td style={{
                    ...tdStyle,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-tertiary)',
                  }}>
                    {c.installationId}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 'var(--spacing-sm)',
                    padding: 'var(--spacing-3xl) var(--spacing-xl)',
                    color: 'var(--color-text-tertiary)',
                  }}>
                    <Container size={32} strokeWidth={1.5} />
                    <span style={{ fontSize: 'var(--font-size-sm)' }}>No containers found</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
