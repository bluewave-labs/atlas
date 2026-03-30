import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, HardDrive } from 'lucide-react';
import { AppSidebar, SidebarSection, SidebarItem } from '../../components/layout/app-sidebar';
import { Skeleton } from '../../components/ui/skeleton';
import { useSystemMetrics } from './hooks';
import { formatBytes } from '../../lib/format';

type View = 'overview' | 'storage';

// ─── Gauge Color Logic ─────────────────────────────────────────────

function gaugeColor(percent: number): string {
  if (percent >= 85) return '#ef4444';
  if (percent >= 60) return '#f59e0b';
  return '#10b981';
}

// ─── Uptime Formatter ──────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── CSS Conic Gradient Gauge ──────────────────────────────────────

function GaugeChart({ percent, label, sublabel, size = 140 }: { percent: number; label: string; sublabel?: string; size?: number }) {
  const color = gaugeColor(percent);
  const clampedPercent = Math.min(100, Math.max(0, percent));
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: '50%',
          background: `conic-gradient(${color} ${clampedPercent * 3.6}deg, var(--color-bg-tertiary) 0deg)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: size - strokeWidth * 2,
            height: size - strokeWidth * 2,
            borderRadius: '50%',
            background: 'var(--color-bg-primary)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: size > 120 ? 'var(--font-size-2xl)' : 'var(--font-size-lg)',
              fontWeight: 700,
              color,
              lineHeight: 1,
            }}
          >
            {clampedPercent.toFixed(1)}%
          </span>
        </div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {label}
        </div>
        {sublabel && (
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
            {sublabel}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── KPI Card ──────────────────────────────────────────────────────

function KpiCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        padding: 16,
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-secondary)',
        borderRadius: 'var(--radius-lg)',
        flex: 1,
        minWidth: 160,
      }}
    >
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: color ?? 'var(--color-text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

// ─── Info Card ─────────────────────────────────────────────────────

function InfoCard({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <div
      style={{
        padding: 16,
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-secondary)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 10 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((row) => (
          <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>{row.label}</span>
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono, monospace)' }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Disk Bar ──────────────────────────────────────────────────────

function DiskBar({ used, total, usagePercent }: { used: number; total: number; usagePercent: number }) {
  const { t } = useTranslation();
  const color = gaugeColor(usagePercent);
  return (
    <div
      style={{
        padding: 20,
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-secondary)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {t('system.diskUsage')}
        </span>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
          {formatBytes(used)} / {formatBytes(total)}
        </span>
      </div>
      <div
        style={{
          height: 20,
          background: 'var(--color-bg-tertiary)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(100, usagePercent)}%`,
            background: color,
            borderRadius: 'var(--radius-md)',
            transition: 'width 0.5s ease, background 0.3s ease',
          }}
        />
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 6, textAlign: 'right' }}>
        {usagePercent.toFixed(1)}% {t('system.used')}
      </div>
    </div>
  );
}

// ─── Refresh Indicator ─────────────────────────────────────────────

function RefreshDot() {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: '#10b981',
        animation: 'pulse 2s ease-in-out infinite',
        marginLeft: 6,
      }}
    />
  );
}

// ─── Main Page ─────────────────────────────────────────────────────

export function SystemPage() {
  const { t } = useTranslation();
  const [view, setView] = useState<View>('overview');
  const { data: metrics, isLoading } = useSystemMetrics();

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
      <AppSidebar storageKey="atlas_system_sidebar" title={t('system.title')}>
        <SidebarSection>
          <SidebarItem
            label={t('system.sidebar.overview')}
            icon={<LayoutDashboard size={15} />}
            isActive={view === 'overview'}
            onClick={() => setView('overview')}
          />
          <SidebarItem
            label={t('system.sidebar.storage')}
            icon={<HardDrive size={15} />}
            isActive={view === 'storage'}
            onClick={() => setView('storage')}
          />
        </SidebarSection>
      </AppSidebar>

      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Skeleton style={{ height: 32, width: 200 }} />
            <div style={{ display: 'flex', gap: 16 }}>
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} style={{ height: 80, flex: 1 }} />)}
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              {[1, 2].map((i) => <Skeleton key={i} style={{ height: 200, flex: 1 }} />)}
            </div>
          </div>
        ) : !metrics ? (
          <div style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', marginTop: 60 }}>
            {t('system.noData')}
          </div>
        ) : view === 'overview' ? (
          <OverviewView metrics={metrics} />
        ) : (
          <StorageView metrics={metrics} />
        )}
      </div>
    </div>
  );
}

// ─── Overview View ─────────────────────────────────────────────────

function OverviewView({ metrics }: { metrics: NonNullable<ReturnType<typeof useSystemMetrics>['data']> }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('system.sidebar.overview')}
        </h2>
        <RefreshDot />
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginLeft: 6 }}>
          {t('system.autoRefresh')}
        </span>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <KpiCard
          label={t('system.cpuUsage')}
          value={`${metrics.cpu.usage}%`}
          color={gaugeColor(metrics.cpu.usage)}
        />
        <KpiCard
          label={t('system.memoryUsed')}
          value={`${formatBytes(metrics.memory.used)} / ${formatBytes(metrics.memory.total)}`}
          color={gaugeColor(metrics.memory.usagePercent)}
        />
        <KpiCard
          label={t('system.diskUsed')}
          value={`${formatBytes(metrics.disk.used)} / ${formatBytes(metrics.disk.total)}`}
          color={gaugeColor(metrics.disk.usagePercent)}
        />
        <KpiCard
          label={t('system.uptime')}
          value={formatUptime(metrics.uptime.system)}
        />
      </div>

      {/* Gauge Charts */}
      <div
        style={{
          display: 'flex',
          gap: 24,
          justifyContent: 'center',
          padding: 24,
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border-secondary)',
          borderRadius: 'var(--radius-lg)',
        }}
      >
        <GaugeChart
          percent={metrics.cpu.usage}
          label={t('system.cpuUsage')}
          sublabel={`${metrics.cpu.cores} ${t('system.cores')}`}
        />
        <GaugeChart
          percent={metrics.memory.usagePercent}
          label={t('system.memoryUsage')}
          sublabel={formatBytes(metrics.memory.total)}
        />
      </div>

      {/* Info Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <InfoCard
          title={t('system.osInfo')}
          rows={[
            { label: t('system.hostname'), value: metrics.os.hostname },
            { label: t('system.osType'), value: metrics.os.type },
            { label: t('system.osRelease'), value: metrics.os.release },
            { label: t('system.architecture'), value: metrics.node.arch },
          ]}
        />
        <InfoCard
          title={t('system.processInfo')}
          rows={[
            { label: 'PID', value: String(metrics.process.pid) },
            { label: t('system.heapUsed'), value: formatBytes(metrics.process.memoryUsage.heapUsed) },
            { label: t('system.heapTotal'), value: formatBytes(metrics.process.memoryUsage.heapTotal) },
            { label: 'RSS', value: formatBytes(metrics.process.memoryUsage.rss) },
          ]}
        />
        <InfoCard
          title={t('system.nodeInfo')}
          rows={[
            { label: t('system.nodeVersion'), value: metrics.node.version },
            { label: t('system.platform'), value: metrics.node.platform },
            { label: t('system.processUptime'), value: formatUptime(metrics.uptime.process) },
          ]}
        />
      </div>
    </div>
  );
}

// ─── Storage View ──────────────────────────────────────────────────

function StorageView({ metrics }: { metrics: NonNullable<ReturnType<typeof useSystemMetrics>['data']> }) {
  const { t } = useTranslation();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 700 }}>
      <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
        {t('system.sidebar.storage')}
      </h2>
      <DiskBar used={metrics.disk.used} total={metrics.disk.total} usagePercent={metrics.disk.usagePercent} />
      <InfoCard
        title={t('system.diskDetails')}
        rows={[
          { label: t('system.totalSpace'), value: formatBytes(metrics.disk.total) },
          { label: t('system.usedSpace'), value: formatBytes(metrics.disk.used) },
          { label: t('system.freeSpace'), value: formatBytes(metrics.disk.free) },
          { label: t('system.usagePercent'), value: `${metrics.disk.usagePercent}%` },
        ]}
      />
    </div>
  );
}
