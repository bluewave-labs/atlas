import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Store,
  ExternalLink,
  Play,
  Square,
  RefreshCw,
  Trash2,
  FileText,
  MoreHorizontal,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Download,
  MemoryStick,
  HardDrive,
  ArrowLeft,
  Activity,
  BarChart3,
  PieChart,
  Workflow,
  ClipboardList,
  KeyRound,
  Mail,
  CalendarCheck,
  MessageSquare,
  MessagesSquare,
  type LucideIcon,
} from 'lucide-react';
import type { MarketplaceCatalogItem } from '@atlasmail/shared';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Modal } from '../../components/ui/modal';
import { Skeleton } from '../../components/ui/skeleton';
import { Popover, PopoverTrigger, PopoverContent } from '../../components/ui/popover';
import { Tooltip } from '../../components/ui/tooltip';
import { useAuthStore } from '../../stores/auth-store';
import {
  useMarketplaceCatalog,
  useDeployApp,
  useStartApp,
  useStopApp,
  useUpdateApp,
  useRemoveApp,
  useMarketplaceLogs,
} from './hooks';

// ─── Icon Map ────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  Activity, BarChart3, PieChart, Workflow, ClipboardList,
  KeyRound, Mail, CalendarCheck, MessageSquare, MessagesSquare,
  Store,
};

function getAppIcon(iconName: string): LucideIcon {
  return ICON_MAP[iconName] ?? Store;
}

// ─── Helpers ──────────────────────────────────────────────────────


function getStatusVariant(status: string | null | undefined): 'default' | 'success' | 'warning' | 'error' {
  switch (status) {
    case 'running': return 'success';
    case 'stopped': return 'warning';
    case 'failed': return 'error';
    case 'installing': return 'primary' as 'warning';
    default: return 'default';
  }
}

// ─── Status Badge ─────────────────────────────────────────────────

function StatusBadge({ status, t }: { status: string | null | undefined; t: (key: string) => string }) {
  const label = (() => {
    switch (status) {
      case 'running': return t('marketplace.statusRunning');
      case 'stopped': return t('marketplace.statusStopped');
      case 'failed': return t('marketplace.statusFailed');
      case 'installing': return t('marketplace.statusInstalling');
      default: return t('marketplace.statusNotInstalled');
    }
  })();

  return <Badge variant={getStatusVariant(status)}>{label}</Badge>;
}

// ─── Docker Status Indicator ──────────────────────────────────────

function DockerStatus({ available, t }: { available: boolean; t: (key: string) => string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: available ? 'var(--color-success)' : 'var(--color-error)',
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-family)',
        }}
      >
        {available ? t('marketplace.dockerAvailable') : t('marketplace.dockerUnavailable')}
      </span>
    </div>
  );
}

// ─── Deploy Confirm Modal ─────────────────────────────────────────

function DeployConfirmModal({
  app,
  open,
  onOpenChange,
  onConfirm,
  isDeploying,
  t,
}: {
  app: MarketplaceCatalogItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeploying: boolean;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} width={460} title={t('marketplace.deployConfirmTitle')}>
      <Modal.Header title={t('marketplace.deployConfirmTitle')} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--font-size-md)',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-family)',
              lineHeight: 'var(--line-height-normal)',
            }}
          >
            {t('marketplace.deployConfirmDesc', { name: app.name })}
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--spacing-md)',
              padding: 'var(--spacing-lg)',
              background: 'var(--color-bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-secondary)',
            }}
          >
            <InfoRow label={t('marketplace.ram')} value={app.resources.minRam} />
            <InfoRow label={t('marketplace.disk')} value={app.resources.estimatedDisk} />
            <InfoRow label={t('marketplace.license')} value={app.license} />
            <InfoRow label={t('marketplace.category')} value={app.category} />
          </div>

          {app.defaultCredentials && (
            <div
              style={{
                padding: 'var(--spacing-md)',
                background: 'color-mix(in srgb, var(--color-warning) 8%, transparent)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid color-mix(in srgb, var(--color-warning) 20%, transparent)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-xs)',
                  marginBottom: 'var(--spacing-xs)',
                }}
              >
                <Info size={14} style={{ color: 'var(--color-warning)' }} />
                <span
                  style={{
                    fontSize: 'var(--font-size-sm)',
                    fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-family)',
                  }}
                >
                  {t('marketplace.defaultCredentials')}
                </span>
              </div>
              <div
                style={{
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-family-mono, monospace)',
                }}
              >
                {app.defaultCredentials.username} / {app.defaultCredentials.password}
              </div>
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          onClick={onConfirm}
          disabled={isDeploying}
          icon={isDeploying ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
        >
          {isDeploying ? t('marketplace.statusInstalling') : t('marketplace.deploy')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontSize: 'var(--font-size-xs)',
          color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-family)',
          marginBottom: 2,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-family)',
          fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Remove Confirm Modal ─────────────────────────────────────────

function RemoveConfirmModal({
  app,
  open,
  onOpenChange,
  onConfirm,
  isRemoving,
  t,
}: {
  app: MarketplaceCatalogItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isRemoving: boolean;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  const [typedName, setTypedName] = useState('');
  const canConfirm = typedName.toLowerCase() === app.name.toLowerCase();

  return (
    <Modal open={open} onOpenChange={(v) => { setTypedName(''); onOpenChange(v); }} width={460} title={t('marketplace.removeConfirmTitle')}>
      <Modal.Header title={t('marketplace.removeConfirmTitle')} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
          <div style={{ display: 'flex', gap: 'var(--spacing-md)', alignItems: 'flex-start' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-lg)',
                background: 'color-mix(in srgb, var(--color-error) 10%, transparent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={20} style={{ color: 'var(--color-error)' }} />
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--font-size-md)',
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-family)',
                lineHeight: 'var(--line-height-normal)',
              }}
            >
              {t('marketplace.removeConfirmDesc', { name: app.name })}
            </p>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-family)',
                marginBottom: 'var(--spacing-xs)',
              }}
            >
              {t('marketplace.typeNameToConfirm', { name: app.name })}
            </label>
            <input
              type="text"
              value={typedName}
              onChange={e => setTypedName(e.target.value)}
              placeholder={app.name}
              style={{
                width: '100%',
                height: 34,
                padding: '0 var(--spacing-md)',
                fontSize: 'var(--font-size-md)',
                fontFamily: 'var(--font-family)',
                color: 'var(--color-text-primary)',
                background: 'var(--color-bg-tertiary)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-md)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={() => { setTypedName(''); onOpenChange(false); }}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="danger"
          onClick={onConfirm}
          disabled={!canConfirm || isRemoving}
          icon={isRemoving ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
        >
          {t('marketplace.remove')}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

// ─── Logs Modal ───────────────────────────────────────────────────

function LogsModal({
  appId,
  appName,
  open,
  onOpenChange,
  t,
}: {
  appId: string;
  appName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  t: (key: string) => string;
}) {
  const { data, isLoading } = useMarketplaceLogs(appId, open);

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={700} height="70vh" title={`${t('marketplace.logs')} - ${appName}`}>
      <Modal.Header title={`${t('marketplace.logs')} - ${appName}`} />
      <Modal.Body padding="0">
        {isLoading ? (
          <div style={{ padding: 'var(--spacing-xl)' }}>
            <Skeleton width="100%" height={200} />
          </div>
        ) : (
          <pre
            style={{
              margin: 0,
              padding: 'var(--spacing-lg)',
              fontSize: 'var(--font-size-xs)',
              fontFamily: 'var(--font-family-mono, monospace)',
              color: 'var(--color-text-secondary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              overflow: 'auto',
              height: '100%',
              background: 'var(--color-bg-secondary)',
            }}
          >
            {data?.logs || t('marketplace.noLogs')}
          </pre>
        )}
      </Modal.Body>
    </Modal>
  );
}

// ─── App Card ─────────────────────────────────────────────────────

function AppCard({
  app,
  isAdmin,
  t,
}: {
  app: MarketplaceCatalogItem;
  isAdmin: boolean;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const deployMutation = useDeployApp();
  const startMutation = useStartApp();
  const stopMutation = useStopApp();
  const updateMutation = useUpdateApp();
  const removeMutation = useRemoveApp();

  const status = app.status;
  const isInstalled = app.installed;
  const isRunning = status === 'running';
  const isStopped = status === 'stopped';
  const isFailed = status === 'failed';
  const isInstalling = status === 'installing' || deployMutation.isPending;
  const isCompatible = app.platformCompatible !== false;

  const handleDeploy = () => {
    deployMutation.mutate({ appId: app.id });
    setDeployModalOpen(false);
  };

  const handleStart = () => {
    startMutation.mutate(app.id, {
      onSuccess: () => navigate(`/marketplace/startup/${app.id}`),
    });
  };
  const handleStop = () => stopMutation.mutate(app.id);
  const handleUpdate = () => updateMutation.mutate(app.id);
  const handleRemove = () => {
    removeMutation.mutate(app.id);
    setRemoveModalOpen(false);
  };

  const AppIcon = getAppIcon(app.icon);

  return (
    <>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          background: 'var(--gradient-card-subtle)',
          border: `1px solid ${isInstalled ? app.color + '33' : 'var(--color-border-primary)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--spacing-xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-md)',
          overflow: 'hidden',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          ...(hovered ? { borderColor: app.color + '55', boxShadow: `0 0 0 1px ${app.color}22` } : {}),
        }}
      >
        {/* Background icon */}
        <AppIcon
          size={100}
          strokeWidth={0.5}
          style={{
            position: 'absolute',
            right: -12,
            bottom: -12,
            color: app.color,
            opacity: 0.07,
            pointerEvents: 'none',
            transform: 'rotate(-12deg)',
          }}
        />

        {/* Header row: icon + name + status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', position: 'relative', zIndex: 1 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 'var(--radius-md)',
              background: app.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <AppIcon size={18} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 'var(--font-size-md)',
                fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-family)',
              }}
            >
              {app.name}
            </div>
            <div
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-tertiary)',
                textTransform: 'capitalize',
              }}
            >
              {app.category}
            </div>
          </div>
          <StatusBadge status={status} t={t} />
        </div>

        {/* Description */}
        <p
          style={{
            margin: 0,
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-family)',
            lineHeight: 'var(--line-height-normal)',
            flex: 1,
            position: 'relative',
            zIndex: 1,
          }}
        >
          {app.description}
        </p>

        {/* Meta row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flexWrap: 'wrap', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', position: 'relative', zIndex: 1 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <MemoryStick size={12} /> {app.resources.minRam}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <HardDrive size={12} /> {app.resources.estimatedDisk}
          </span>
          <Badge>{app.license}</Badge>
          {app.updateAvailable && (
            <Badge variant="warning">{t('marketplace.updateAvailable')}</Badge>
          )}
          {isInstalled && app.assignedPort && (
            <span
              style={{
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-family-mono, monospace)',
              }}
            >
              :{app.assignedPort}
            </span>
          )}
        </div>

        {/* Action buttons row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
          }}
        >
          {/* Not installed: Deploy button */}
          {!isInstalled && !isInstalling && isAdmin && isCompatible && (
            <Button
              variant="primary"
              size="sm"
              icon={<Download size={14} />}
              onClick={() => setDeployModalOpen(true)}
            >
              {t('marketplace.deploy')}
            </Button>
          )}

          {/* Not compatible with this platform */}
          {!isInstalled && !isInstalling && !isCompatible && (
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-family)',
              }}
            >
              {t('marketplace.platformIncompatible')}
            </span>
          )}

          {/* Not installed, not admin */}
          {!isInstalled && !isInstalling && !isAdmin && isCompatible && (
            <span
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-family)',
              }}
            >
              {t('marketplace.adminRequired')}
            </span>
          )}

          {/* Installing */}
          {isInstalling && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--spacing-xs)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family)',
              }}
            >
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              {t('marketplace.statusInstalling')}
            </div>
          )}

          {/* Running: Open + Stop + overflow */}
          {isRunning && (
            <>
              <a
                href={`http://${window.location.hostname}:${app.assignedPort}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <Button variant="primary" size="sm" icon={<ExternalLink size={14} />}>
                  {t('marketplace.open')}
                </Button>
              </a>
              {isAdmin && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={stopMutation.isPending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Square size={12} />}
                  onClick={handleStop}
                  disabled={stopMutation.isPending}
                >
                  {stopMutation.isPending ? t('marketplace.stopping') : t('marketplace.stop')}
                </Button>
              )}
            </>
          )}

          {/* Stopped: Start + overflow */}
          {isStopped && isAdmin && (
            <Button
              variant="primary"
              size="sm"
              icon={startMutation.isPending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}
              onClick={handleStart}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? t('marketplace.starting') : t('marketplace.start')}
            </Button>
          )}

          {/* Failed: retry */}
          {isFailed && isAdmin && (
            <Button
              variant="secondary"
              size="sm"
              icon={startMutation.isPending ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
              onClick={handleStart}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? t('marketplace.starting') : t('common.retry')}
            </Button>
          )}

          {/* Spacer to push overflow right */}
          <div style={{ flex: 1 }} />

          {/* Website link */}
          <Tooltip content={app.website}>
            <a href={app.website} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
              <Button variant="ghost" size="sm" icon={<ExternalLink size={14} />} />
            </a>
          </Tooltip>

          {/* Overflow menu for installed apps */}
          {isInstalled && isAdmin && (
            <Popover open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" icon={<MoreHorizontal size={14} />} />
              </PopoverTrigger>
              <PopoverContent width={180} style={{ padding: 'var(--spacing-xs)' }}>
                {app.updateAvailable && (
                  <MenuItemButton
                    icon={<RefreshCw size={14} />}
                    label={t('marketplace.update')}
                    onClick={() => { handleUpdate(); setMenuOpen(false); }}
                    disabled={updateMutation.isPending}
                  />
                )}
                <MenuItemButton
                  icon={<FileText size={14} />}
                  label={t('marketplace.logs')}
                  onClick={() => { setLogsModalOpen(true); setMenuOpen(false); }}
                />
                <MenuItemButton
                  icon={<Trash2 size={14} />}
                  label={t('marketplace.remove')}
                  onClick={() => { setRemoveModalOpen(true); setMenuOpen(false); }}
                  destructive
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Modals */}
      <DeployConfirmModal
        app={app}
        open={deployModalOpen}
        onOpenChange={setDeployModalOpen}
        onConfirm={handleDeploy}
        isDeploying={deployMutation.isPending}
        t={t}
      />
      <RemoveConfirmModal
        app={app}
        open={removeModalOpen}
        onOpenChange={setRemoveModalOpen}
        onConfirm={handleRemove}
        isRemoving={removeMutation.isPending}
        t={t}
      />
      <LogsModal
        appId={app.id}
        appName={app.name}
        open={logsModalOpen}
        onOpenChange={setLogsModalOpen}
        t={t}
      />
    </>
  );
}

// ─── Menu Item Button ─────────────────────────────────────────────

function MenuItemButton({
  icon,
  label,
  onClick,
  disabled,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        width: '100%',
        padding: 'var(--spacing-sm) var(--spacing-md)',
        background: hovered ? 'var(--color-surface-hover)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        color: destructive ? 'var(--color-error)' : 'var(--color-text-primary)',
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        textAlign: 'left',
      }}
    >
      <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────

function CatalogSkeleton() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 'var(--spacing-xl)',
      }}
    >
      {Array.from({ length: 4 }, (_, i) => (
        <div
          key={i}
          style={{
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--spacing-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--spacing-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
            <Skeleton width={40} height={40} borderRadius={8} />
            <div style={{ flex: 1 }}>
              <Skeleton width="60%" height={18} />
            </div>
            <Skeleton width={70} height={20} borderRadius={10} />
          </div>
          <Skeleton width="100%" height={14} />
          <Skeleton width="80%" height={14} />
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
            <Skeleton width={50} height={20} borderRadius={10} />
            <Skeleton width={60} height={20} borderRadius={10} />
          </div>
          <Skeleton width="100%" height={1} />
          <Skeleton width={80} height={28} borderRadius={6} />
        </div>
      ))}
    </div>
  );
}

// ─── Docker Unavailable Banner ────────────────────────────────────

function DockerUnavailableBanner({ t }: { t: (key: string) => string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-md)',
        padding: 'var(--spacing-lg) var(--spacing-xl)',
        background: 'color-mix(in srgb, var(--color-warning) 8%, transparent)',
        border: '1px solid color-mix(in srgb, var(--color-warning) 20%, transparent)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      <AlertTriangle size={20} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
      <div>
        <div
          style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-family)',
          }}
        >
          {t('marketplace.dockerUnavailable')}
        </div>
        <div
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-family)',
            marginTop: 2,
          }}
        >
          {t('marketplace.dockerUnavailableDesc')}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────

export function MarketplacePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, error } = useMarketplaceCatalog();
  const isSuperAdmin = useAuthStore(s => s.isSuperAdmin);
  const tenantRole = useAuthStore(s => s.tenantRole);
  const isAdmin = isSuperAdmin || tenantRole === 'owner' || tenantRole === 'admin';

  const items = data?.items ?? [];
  const dockerAvailable = data?.dockerAvailable ?? false;

  return (
    <div
      style={{
        height: '100vh',
        overflow: 'auto',
        background: 'var(--color-bg-primary)',
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: 'var(--spacing-2xl) var(--spacing-2xl)',
        }}
      >
        {/* Page header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 'var(--spacing-2xl)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xs)' }}>
              <button
                onClick={() => navigate('/')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                  border: 'none', background: 'transparent', color: 'var(--color-text-tertiary)',
                  cursor: 'pointer', flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; e.currentTarget.style.color = 'var(--color-text-primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--color-text-tertiary)'; }}
              >
                <ArrowLeft size={16} />
              </button>
              <h1
                style={{
                  margin: 0,
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 'var(--font-weight-bold)' as CSSProperties['fontWeight'],
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-family)',
                }}
              >
                {t('marketplace.title')}
              </h1>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: 'var(--font-size-md)',
                color: 'var(--color-text-secondary)',
                fontFamily: 'var(--font-family)',
              }}
            >
              {t('marketplace.subtitle')}
            </p>
          </div>
          {!isLoading && <DockerStatus available={dockerAvailable} t={t} />}
        </div>

        {/* Docker unavailable banner */}
        {!isLoading && !dockerAvailable && (
          <div style={{ marginBottom: 'var(--spacing-xl)' }}>
            <DockerUnavailableBanner t={t} />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-md)',
              padding: 'var(--spacing-lg)',
              background: 'color-mix(in srgb, var(--color-error) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-error) 20%, transparent)',
              borderRadius: 'var(--radius-lg)',
              marginBottom: 'var(--spacing-xl)',
            }}
          >
            <XCircle size={20} style={{ color: 'var(--color-error)' }} />
            <span style={{ fontSize: 'var(--font-size-md)', color: 'var(--color-text-primary)', fontFamily: 'var(--font-family)' }}>
              {t('marketplace.loadError')}
            </span>
          </div>
        )}

        {/* Loading */}
        {isLoading && <CatalogSkeleton />}

        {/* Grid */}
        {!isLoading && items.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 'var(--spacing-xl)',
            }}
          >
            {items.map(app => (
              <AppCard key={app.id} app={app} isAdmin={!!isAdmin} t={t} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && items.length === 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--spacing-2xl)',
              color: 'var(--color-text-tertiary)',
              fontFamily: 'var(--font-family)',
            }}
          >
            <Store size={48} style={{ marginBottom: 'var(--spacing-lg)', opacity: 0.3 }} />
            <span style={{ fontSize: 'var(--font-size-lg)' }}>{t('marketplace.noApps')}</span>
          </div>
        )}
      </div>

    </div>
  );
}
