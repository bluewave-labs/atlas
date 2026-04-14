import { useState, useEffect, useCallback, type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Cpu, MemoryStick, HardDrive, Clock, Server, Globe, Activity, LayoutDashboard, Mail, Send, CheckCircle2, Shield, Settings2 } from 'lucide-react';
import { AlertBanner } from '../../components/ui/alert-banner';
import { StatCard, InfoCard } from '../../components/ui/stat-card';
import { AppSidebar, SidebarSection, SidebarItem } from '../../components/layout/app-sidebar';
import { Skeleton } from '../../components/ui/skeleton';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { SettingsSection, SettingsRow, SettingsToggle } from '../../components/settings/settings-primitives';
import { useSystemMetrics } from './hooks';
import { useAuthStore } from '../../stores/auth-store';
import { useUIStore } from '../../stores/ui-store';
import { PermissionsView } from './components/permissions-view';
import { formatBytes } from '../../lib/format';
import { api } from '../../lib/api-client';
import { queryKeys } from '../../config/query-keys';

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


// ─── Disk Bar ──────────────────────────────────────────────────────

function DiskBar({ used, total, usagePercent }: { used: number; total: number; usagePercent: number }) {
  const { t } = useTranslation();
  const color = gaugeColor(usagePercent);
  return (
    <div
      style={{
        padding: 20,
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border-primary)',
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

type SystemView = 'overview' | 'email' | 'permissions';

export function SystemPage() {
  const { t } = useTranslation();
  const { data: metrics, isLoading } = useSystemMetrics();
  const [activeView, setActiveView] = useState<SystemView>('overview');
  const tenantRole = useAuthStore((s) => s.tenantRole);
  const isOwner = tenantRole === 'owner';
  const { openSettings } = useUIStore();

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
      <AppSidebar
        storageKey="atlas_system_sidebar"
        title={t('system.title')}
        footer={
          <SidebarItem
            label={t('system.settings', 'Settings')}
            icon={<Settings2 size={14} />}
            onClick={() => openSettings('system')}
          />
        }
      >
        <SidebarSection>
          <SidebarItem
            label={t('system.sidebar.overview')}
            icon={<Activity size={15} />}
            iconColor="#3b82f6"
            isActive={activeView === 'overview'}
            onClick={() => setActiveView('overview')}
          />
          <SidebarItem
            label={t('system.sidebar.email')}
            icon={<Mail size={15} />}
            iconColor="#f59e0b"
            isActive={activeView === 'email'}
            onClick={() => setActiveView('email')}
          />
          {isOwner && (
            <SidebarItem
              label={t('system.permissions.title')}
              icon={<Shield size={15} />}
              iconColor="#6b7280"
              isActive={activeView === 'permissions'}
              onClick={() => setActiveView('permissions')}
            />
          )}
        </SidebarSection>
      </AppSidebar>

      <div style={{ flex: 1, overflow: 'auto', padding: 24, paddingBottom: 'calc(24px + var(--global-dock-offset, 0px))' }}>
        {activeView === 'overview' && (
          <>
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
              <div style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', marginTop: 60, fontFamily: 'var(--font-family)' }}>
                {t('system.noData')}
              </div>
            ) : (
              <OverviewView metrics={metrics} />
            )}
          </>
        )}
        {activeView === 'email' && <EmailSettingsView />}
        {activeView === 'permissions' && isOwner && <PermissionsView />}
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

      {/* KPI Cards with background icons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
        <StatCard
          label={t('system.cpuUsage')}
          value={`${metrics.cpu.usage.toFixed(1)}%`}
          color={gaugeColor(metrics.cpu.usage)}
          icon={Cpu}
          subtitle={`${metrics.cpu.cores} ${t('system.cores')}`}
        />
        <StatCard
          label={t('system.memoryUsage')}
          value={`${metrics.memory.usagePercent.toFixed(1)}%`}
          color={gaugeColor(metrics.memory.usagePercent)}
          icon={MemoryStick}
          subtitle={`${formatBytes(metrics.memory.used)} / ${formatBytes(metrics.memory.total)}`}
        />
        <StatCard
          label={t('system.diskUsage')}
          value={`${metrics.disk.usagePercent.toFixed(1)}%`}
          color={gaugeColor(metrics.disk.usagePercent)}
          icon={HardDrive}
          subtitle={`${formatBytes(metrics.disk.used)} / ${formatBytes(metrics.disk.total)}`}
        />
        <StatCard
          label={t('system.uptime')}
          value={formatUptime(metrics.uptime.system)}
          icon={Clock}
          subtitle={t('system.systemUptime', 'System uptime')}
        />
      </div>

      {/* Gauge Charts — separate cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 20,
          padding: 20,
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <GaugeChart
            percent={metrics.cpu.usage}
            label=""
            size={100}
          />
          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', marginBottom: 4 }}>
              {t('system.cpuUsage')}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>
              {metrics.cpu.model.split(' ').slice(0, 4).join(' ')}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
              {metrics.cpu.cores} {t('system.cores')}
            </div>
          </div>
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 20,
          padding: 20,
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-lg)',
        }}>
          <GaugeChart
            percent={metrics.memory.usagePercent}
            label=""
            size={100}
          />
          <div>
            <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)', marginBottom: 4 }}>
              {t('system.memoryUsage')}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', lineHeight: 1.5 }}>
              {formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
              {formatBytes(metrics.memory.total - metrics.memory.used)} {t('system.available', 'available')}
            </div>
          </div>
        </div>
      </div>

      {/* Info Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <InfoCard
          title={t('system.osInfo')}
          icon={Server}
          rows={[
            { label: t('system.hostname'), value: metrics.os.hostname },
            { label: t('system.osType'), value: metrics.os.type },
            { label: t('system.osRelease'), value: metrics.os.release },
            { label: t('system.architecture'), value: metrics.node.arch },
          ]}
        />
        <InfoCard
          title={t('system.processInfo')}
          icon={Activity}
          rows={[
            { label: 'PID', value: String(metrics.process.pid) },
            { label: t('system.heapUsed'), value: formatBytes(metrics.process.memoryUsage.heapUsed) },
            { label: t('system.heapTotal'), value: formatBytes(metrics.process.memoryUsage.heapTotal) },
            { label: 'RSS', value: formatBytes(metrics.process.memoryUsage.rss) },
          ]}
        />
        <InfoCard
          title={t('system.nodeInfo')}
          icon={Globe}
          rows={[
            { label: t('system.nodeVersion'), value: metrics.node.version },
            { label: t('system.platform'), value: metrics.node.platform },
            { label: t('system.processUptime'), value: formatUptime(metrics.uptime.process) },
          ]}
        />
      </div>

      {/* Storage */}
      <div style={{ maxWidth: 480 }}>
        <DiskBar used={metrics.disk.used} total={metrics.disk.total} usagePercent={metrics.disk.usagePercent} />
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

// ─── Email Settings View ──────────────────────────────────────────

interface EmailSettings {
  smtpHost: string | null;
  smtpPort: number;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpFrom: string;
  smtpSecure: boolean;
  smtpEnabled: boolean;
}

function EmailSettingsView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: serverSettings, isLoading } = useQuery({
    queryKey: queryKeys.system.emailSettings,
    queryFn: async () => {
      const { data } = await api.get('/system/email-settings');
      return data.data as EmailSettings;
    },
  });

  // Local form state — only saved when user clicks Save
  const [form, setForm] = useState<EmailSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync form from server on first load
  useEffect(() => {
    if (serverSettings && !form) {
      setForm({ ...serverSettings, smtpPass: '' }); // clear masked password
    }
  }, [serverSettings]);

  const updateMutation = useMutation({
    mutationFn: async (patch: Partial<EmailSettings>) => {
      const { data } = await api.put('/system/email-settings', patch);
      return data.data as EmailSettings;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.system.emailSettings, data);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const handleTest = useCallback(async () => {
    if (!testEmail.trim()) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const { data } = await api.post('/system/email-test', { to: testEmail.trim() });
      setTestResult({ success: data.success, error: data.error });
    } catch (err: any) {
      setTestResult({ success: false, error: err?.response?.data?.error || 'Test failed' });
    } finally {
      setTestLoading(false);
    }
  }, [testEmail]);

  const setField = <K extends keyof EmailSettings>(key: K, value: EmailSettings[K]) => {
    setForm((prev) => prev ? { ...prev, [key]: value } : prev);
    setDirty(true);
    setSaved(false);
  };

  const handleSave = () => {
    if (!form) return;
    const patch: Partial<EmailSettings> = { ...form };
    // Don't send empty password (keep existing)
    if (!patch.smtpPass) delete patch.smtpPass;
    updateMutation.mutate(patch);
  };

  if (isLoading || !form) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
        <Skeleton style={{ height: 32, width: 200 }} />
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} style={{ height: 48, width: '100%' }} />)}
      </div>
    );
  }

  if (!serverSettings) {
    return (
      <div style={{ color: 'var(--color-text-tertiary)', textAlign: 'center', marginTop: 60, fontFamily: 'var(--font-family)' }}>
        {t('system.email.adminOnly')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{
          fontSize: 'var(--font-size-xl)',
          fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
          color: 'var(--color-text-primary)',
          margin: 0,
          fontFamily: 'var(--font-family)',
        }}>
          {t('system.email.title')}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
          <Badge variant={form.smtpEnabled ? 'success' : 'default'}>
            {form.smtpEnabled ? t('system.email.enabled') : t('system.email.disabled')}
          </Badge>
          <Button
            variant="primary"
            size="sm"
            icon={saved ? <CheckCircle2 size={13} /> : undefined}
            onClick={handleSave}
            disabled={!dirty || updateMutation.isPending}
            style={saved ? { background: 'var(--color-success)' } : undefined}
          >
            {saved ? t('system.email.saved') : updateMutation.isPending ? t('system.email.saving') : t('system.email.save')}
          </Button>
        </div>
      </div>

      <SettingsSection title={t('system.email.smtpConfig')}>
        <SettingsRow label={t('system.email.enable')} description={t('system.email.enableDesc')}>
          <SettingsToggle
            checked={form.smtpEnabled}
            onChange={(v) => setField('smtpEnabled', v)}
            label={t('system.email.enable')}
          />
        </SettingsRow>
        <SettingsRow label={t('system.email.host')} description={t('system.email.hostDesc')}>
          <Input
            value={form.smtpHost || ''}
            onChange={(e) => setField('smtpHost', e.target.value)}
            placeholder="smtp.gmail.com"
            size="sm"
            style={{ width: 220 }}
          />
        </SettingsRow>
        <SettingsRow label={t('system.email.port')} description={t('system.email.portDesc')}>
          <Select
            value={String(form.smtpPort)}
            onChange={(v) => setField('smtpPort', Number(v) as any)}
            options={[
              { value: '25', label: '25 (SMTP)' },
              { value: '465', label: '465 (SSL)' },
              { value: '587', label: '587 (TLS)' },
              { value: '2525', label: '2525 (Alt)' },
            ]}
            size="sm"
            width={160}
          />
        </SettingsRow>
        <SettingsRow label={t('system.email.secure')} description={t('system.email.secureDesc')}>
          <SettingsToggle
            checked={form.smtpSecure}
            onChange={(v) => setField('smtpSecure', v)}
            label="SSL/TLS"
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title={t('system.email.authentication')}>
        <SettingsRow label={t('system.email.username')} description={t('system.email.usernameDesc')}>
          <Input
            value={form.smtpUser || ''}
            onChange={(e) => setField('smtpUser', e.target.value)}
            placeholder="user@example.com"
            size="sm"
            style={{ width: 220 }}
          />
        </SettingsRow>
        <SettingsRow label={t('system.email.password')} description={t('system.email.passwordDesc')}>
          <Input
            type="password"
            value={form.smtpPass || ''}
            onChange={(e) => setField('smtpPass', e.target.value)}
            placeholder={serverSettings.smtpPass ? '••••••••' : ''}
            size="sm"
            style={{ width: 220 }}
          />
        </SettingsRow>
        <SettingsRow label={t('system.email.fromAddress')} description={t('system.email.fromAddressDesc')}>
          <Input
            value={form.smtpFrom}
            onChange={(e) => setField('smtpFrom', e.target.value)}
            placeholder="Atlas <noreply@atlas.local>"
            size="sm"
            style={{ width: 260 }}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title={t('system.email.testSection')}>
        <SettingsRow label={t('system.email.sendTest')} description={t('system.email.sendTestDesc')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <Input
              value={testEmail}
              onChange={(e) => { setTestEmail(e.target.value); setTestResult(null); }}
              placeholder="test@example.com"
              size="sm"
              style={{ width: 200 }}
              onKeyDown={(e) => e.key === 'Enter' && handleTest()}
            />
            <Button
              variant="secondary"
              size="sm"
              icon={<Send size={13} />}
              onClick={handleTest}
              disabled={testLoading || !testEmail.trim() || dirty}
            >
              {testLoading ? t('system.email.sending') : t('system.email.send')}
            </Button>
          </div>
        </SettingsRow>
        {dirty && (
          <div style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-tertiary)',
            fontFamily: 'var(--font-family)',
            padding: '0 var(--spacing-md)',
          }}>
            {t('system.email.saveBeforeTest')}
          </div>
        )}
        {testResult && (
          <AlertBanner variant={testResult.success ? 'success' : 'error'}>
            {testResult.success ? t('system.email.testSuccess') : testResult.error}
          </AlertBanner>
        )}
      </SettingsSection>
    </div>
  );
}
