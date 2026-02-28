import { useState, type CSSProperties } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import {
  X,
  ChevronLeft,
  Mail,
  Server,
  Lock,
  User,
  FlaskConical,
  ExternalLink,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { config } from '../../config/env';
import { Modal } from '../ui/modal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AccountProvider = 'gmail' | 'outlook' | 'yahoo' | 'custom';
type ModalStep = 'choose' | 'oauth' | 'imap';
type SecurityOption = 'SSL/TLS' | 'STARTTLS' | 'None';

interface ImapFormData {
  email: string;
  imapServer: string;
  imapPort: string;
  imapSecurity: SecurityOption;
  smtpServer: string;
  smtpPort: string;
  smtpSecurity: SecurityOption;
  username: string;
  password: string;
}

interface AddAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Provider config
// ---------------------------------------------------------------------------

interface ProviderConfig {
  id: AccountProvider;
  name: string;
  description: string;
  brandColor: string;
  logo: React.ReactNode;
}

function buildGoogleOAuthUrl(): string {
  const baseUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: `${window.location.origin}/auth/callback`,
    response_type: 'code',
    scope: [
      'openid',
      'email',
      'profile',
      'https://www.googleapis.com/auth/gmail.modify',
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent',
  });
  return `${baseUrl}?${params.toString()}`;
}

function GmailLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M6 10h36v28H6z" opacity="0" />
      <path
        fill="#4285F4"
        d="M44 10H4a2 2 0 0 0-2 2v24a2 2 0 0 0 2 2h40a2 2 0 0 0 2-2V12a2 2 0 0 0-2-2z"
        opacity="0"
      />
      <path
        fill="#EA4335"
        d="M4 10h40L24 28 4 10z"
      />
      <path
        fill="#FBBC05"
        d="M2 12v24l13-12L2 12z"
      />
      <path
        fill="#34A853"
        d="M46 12v24L33 24l13-12z"
      />
      <path
        fill="#4285F4"
        d="M2 36l13-12 9 8 9-8 13 12H2z"
      />
      <path
        fill="#EA4335"
        d="M4 10l20 18L44 10H4z"
      />
    </svg>
  );
}

function OutlookLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="26" height="32" x="2" y="8" rx="2" fill="#0078D4" />
      <rect width="18" height="24" x="28" y="12" rx="1" fill="#50E6FF" opacity="0.9" />
      <rect width="18" height="8" x="28" y="12" rx="1" fill="#0078D4" opacity="0.7" />
      <ellipse cx="15" cy="24" rx="7" ry="8" fill="#fff" />
      <ellipse cx="15" cy="24" rx="5" ry="6" fill="#0078D4" />
      <rect width="18" height="1.5" x="28" y="24" fill="#0078D4" opacity="0.5" />
      <rect width="18" height="1.5" x="28" y="28" fill="#0078D4" opacity="0.5" />
      <rect width="18" height="1.5" x="28" y="32" fill="#0078D4" opacity="0.5" />
    </svg>
  );
}

function YahooLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <text
        x="50%"
        y="54%"
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize="30"
        fontWeight="900"
        fontFamily="Arial, sans-serif"
        fill="#6001D2"
      >
        Y!
      </text>
    </svg>
  );
}

function useProviders(): ProviderConfig[] {
  const { t } = useTranslation();
  return [
    {
      id: 'gmail',
      name: t('settings.gmail'),
      description: t('settings.gmailDesc'),
      brandColor: '#EA4335',
      logo: <GmailLogo />,
    },
    {
      id: 'outlook',
      name: t('settings.outlook'),
      description: t('settings.outlookDesc'),
      brandColor: '#0078D4',
      logo: <OutlookLogo />,
    },
    {
      id: 'yahoo',
      name: t('settings.yahoo'),
      description: t('settings.yahooDesc'),
      brandColor: '#6001D2',
      logo: <YahooLogo />,
    },
    {
      id: 'custom',
      name: t('settings.customImap'),
      description: t('settings.customImapDesc'),
      brandColor: 'var(--color-accent-primary)',
      logo: <Server size={28} strokeWidth={1.5} />,
    },
  ];
}

const DEFAULT_IMAP_FORM: ImapFormData = {
  email: '',
  imapServer: '',
  imapPort: '993',
  imapSecurity: 'SSL/TLS',
  smtpServer: '',
  smtpPort: '587',
  smtpSecurity: 'STARTTLS',
  username: '',
  password: '',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function FormField({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label
        htmlFor={id}
        style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-family)',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function TextInput({
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        height: 34,
        padding: '0 var(--spacing-md)',
        background: 'var(--color-bg-primary)',
        border: `1px solid ${focused ? 'var(--color-border-focus)' : 'var(--color-border-primary)'}`,
        borderRadius: 'var(--radius-md)',
        color: 'var(--color-text-primary)',
        fontSize: 'var(--font-size-md)',
        fontFamily: 'var(--font-family)',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box' as CSSProperties['boxSizing'],
        transition: 'border-color var(--transition-fast)',
      }}
    />
  );
}

function SelectInput({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        height: 34,
        padding: '0 var(--spacing-md)',
        background: 'var(--color-bg-primary)',
        border: `1px solid ${focused ? 'var(--color-border-focus)' : 'var(--color-border-primary)'}`,
        borderRadius: 'var(--radius-md)',
        color: 'var(--color-text-primary)',
        fontSize: 'var(--font-size-md)',
        fontFamily: 'var(--font-family)',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box' as CSSProperties['boxSizing'],
        cursor: 'pointer',
        transition: 'border-color var(--transition-fast)',
        appearance: 'none' as CSSProperties['appearance'],
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%238c95a4' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
        paddingRight: 30,
      }}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Step 1 – Choose provider
// ---------------------------------------------------------------------------

function StepChoose({
  selectedProvider,
  onSelect,
}: {
  selectedProvider: AccountProvider | null;
  onSelect: (p: AccountProvider) => void;
}) {
  const { t } = useTranslation();
  const providers = useProviders();

  return (
    <div>
      <h2
        style={{
          margin: '0 0 var(--spacing-sm)',
          fontSize: 'var(--font-size-xl)',
          fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
          color: 'var(--color-text-primary)',
          fontFamily: 'var(--font-family)',
          lineHeight: 'var(--line-height-tight)',
        }}
      >
        {t('settings.addAccountTitle')}
      </h2>
      <p
        style={{
          margin: '0 0 var(--spacing-xl)',
          fontSize: 'var(--font-size-md)',
          color: 'var(--color-text-secondary)',
          fontFamily: 'var(--font-family)',
          lineHeight: 'var(--line-height-normal)',
        }}
      >
        {t('settings.addAccountDescription')}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 'var(--spacing-md)',
        }}
      >
        {providers.map((provider) => {
          const isSelected = selectedProvider === provider.id;
          return (
            <ProviderCard
              key={provider.id}
              provider={provider}
              isSelected={isSelected}
              onSelect={() => onSelect(provider.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  isSelected,
  onSelect,
}: {
  provider: ProviderConfig;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const active = isSelected || hovered;

  const borderColor = isSelected
    ? provider.id === 'custom'
      ? 'var(--color-accent-primary)'
      : provider.brandColor
    : hovered
      ? 'var(--color-border-focus)'
      : 'var(--color-border-primary)';

  const bg = isSelected
    ? provider.id === 'custom'
      ? 'color-mix(in srgb, var(--color-accent-primary) 5%, var(--color-bg-secondary))'
      : `color-mix(in srgb, ${provider.brandColor} 5%, var(--color-bg-secondary))`
    : hovered
      ? 'var(--color-surface-hover)'
      : 'var(--color-bg-secondary)';

  return (
    <button
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 'var(--spacing-sm)',
        padding: 'var(--spacing-lg)',
        background: bg,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 'var(--radius-lg)',
        cursor: 'pointer',
        textAlign: 'left',
        transition:
          'background var(--transition-normal), border-color var(--transition-normal)',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box' as CSSProperties['boxSizing'],
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
          borderRadius: 'var(--radius-md)',
          background: active
            ? provider.id === 'custom'
              ? 'color-mix(in srgb, var(--color-accent-primary) 12%, var(--color-bg-tertiary))'
              : `color-mix(in srgb, ${provider.brandColor} 12%, var(--color-bg-tertiary))`
            : 'var(--color-bg-tertiary)',
          color:
            provider.id === 'custom'
              ? 'var(--color-accent-primary)'
              : provider.brandColor,
          transition: 'background var(--transition-normal)',
        }}
        aria-hidden="true"
      >
        {provider.logo}
      </span>

      <div>
        <div
          style={{
            fontSize: 'var(--font-size-md)',
            fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-family)',
            marginBottom: 2,
          }}
        >
          {provider.name}
        </div>
        <div
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-text-tertiary)',
            fontFamily: 'var(--font-family)',
            lineHeight: 'var(--line-height-normal)',
          }}
        >
          {provider.description}
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Step 2a – OAuth connect
// ---------------------------------------------------------------------------

function StepOAuth({ provider }: { provider: ProviderConfig }) {
  const [hovered, setHovered] = useState(false);

  const isImplemented = provider.id === 'gmail';

  const handleConnect = () => {
    if (!isImplemented) return;
    sessionStorage.setItem('atlasmail_adding_account', 'true');
    window.location.href = buildGoogleOAuthUrl();
  };

  const buttonBg = hovered
    ? provider.id === 'custom'
      ? 'var(--color-accent-primary-hover)'
      : provider.brandColor
    : provider.id === 'custom'
      ? 'var(--color-accent-primary)'
      : provider.brandColor;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: 'var(--spacing-xl) 0',
        gap: 'var(--spacing-xl)',
      }}
    >
      <span
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 72,
          height: 72,
          borderRadius: 'var(--radius-xl)',
          background: `color-mix(in srgb, ${provider.brandColor} 10%, var(--color-bg-tertiary))`,
          color: provider.brandColor,
        }}
        aria-hidden="true"
      >
        {provider.id === 'gmail' ? (
          <GmailLogo size={40} />
        ) : provider.id === 'outlook' ? (
          <OutlookLogo size={40} />
        ) : (
          <YahooLogo size={40} />
        )}
      </span>

      <div>
        <h2
          style={{
            margin: '0 0 var(--spacing-sm)',
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-family)',
          }}
        >
          Connect {provider.name}
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--font-size-md)',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-family)',
            lineHeight: 'var(--line-height-normal)',
            maxWidth: 360,
          }}
        >
          You'll be redirected to {provider.name} to authorize AtlasMail to
          access your account. No password is stored.
        </p>
      </div>

      {!isImplemented && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--spacing-sm)',
            padding: 'var(--spacing-sm) var(--spacing-lg)',
            background: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
            border: '1px solid color-mix(in srgb, var(--color-warning) 30%, transparent)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--color-warning)',
            fontFamily: 'var(--font-family)',
          }}
        >
          {provider.name} support is coming soon. Only Gmail is available at this time.
        </div>
      )}

      <button
        onClick={handleConnect}
        disabled={!isImplemented}
        onMouseEnter={() => isImplemented && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--spacing-sm)',
          height: 40,
          padding: '0 var(--spacing-xl)',
          background: buttonBg,
          border: 'none',
          borderRadius: 'var(--radius-md)',
          color: '#ffffff',
          fontSize: 'var(--font-size-md)',
          fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
          fontFamily: 'var(--font-family)',
          cursor: !isImplemented ? 'not-allowed' : 'pointer',
          transition: 'background var(--transition-fast), opacity var(--transition-fast)',
          outline: 'none',
          opacity: !isImplemented ? 0.5 : hovered ? 0.9 : 1,
        }}
      >
        <ExternalLink size={15} strokeWidth={2} />
        Continue with {provider.name}
      </button>

      <p
        style={{
          margin: 0,
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-family)',
        }}
      >
        You'll be redirected back to AtlasMail after authorization.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2b – Custom IMAP/SMTP form
// ---------------------------------------------------------------------------

function StepImap({
  formData,
  onChange,
}: {
  formData: ImapFormData;
  onChange: (data: Partial<ImapFormData>) => void;
}) {
  const securityOptions: SecurityOption[] = ['SSL/TLS', 'STARTTLS', 'None'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
      <div>
        <h2
          style={{
            margin: '0 0 var(--spacing-xs)',
            fontSize: 'var(--font-size-xl)',
            fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
            color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-family)',
          }}
        >
          IMAP / SMTP setup
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--font-size-md)',
            color: 'var(--color-text-secondary)',
            fontFamily: 'var(--font-family)',
            lineHeight: 'var(--line-height-normal)',
          }}
        >
          Enter your email server details to connect your account.
        </p>
      </div>

      {/* Account info */}
      <FormGroup title="Account">
        <FormField label="Email address" id="imap-email">
          <div style={{ position: 'relative' }}>
            <Mail
              size={14}
              style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--color-text-tertiary)',
                pointerEvents: 'none',
              }}
            />
            <input
              id="imap-email"
              type="email"
              value={formData.email}
              onChange={(e) => onChange({ email: e.target.value })}
              placeholder="you@example.com"
              autoComplete="email"
              style={{
                height: 34,
                paddingLeft: 32,
                paddingRight: 'var(--spacing-md)',
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-md)',
                fontFamily: 'var(--font-family)',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box' as CSSProperties['boxSizing'],
                transition: 'border-color var(--transition-fast)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-focus)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-border-primary)';
              }}
            />
          </div>
        </FormField>
      </FormGroup>

      {/* IMAP settings */}
      <FormGroup title="Incoming mail (IMAP)">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            gap: 'var(--spacing-md)',
            alignItems: 'end',
          }}
        >
          <FormField label="Server" id="imap-server">
            <TextInput
              id="imap-server"
              value={formData.imapServer}
              onChange={(v) => onChange({ imapServer: v })}
              placeholder="imap.example.com"
            />
          </FormField>
          <FormField label="Port" id="imap-port">
            <div style={{ width: 72 }}>
              <TextInput
                id="imap-port"
                value={formData.imapPort}
                onChange={(v) => onChange({ imapPort: v })}
                placeholder="993"
              />
            </div>
          </FormField>
          <FormField label="Security" id="imap-security">
            <div style={{ width: 110 }}>
              <SelectInput
                id="imap-security"
                value={formData.imapSecurity}
                onChange={(v) => onChange({ imapSecurity: v as SecurityOption })}
                options={securityOptions}
              />
            </div>
          </FormField>
        </div>
      </FormGroup>

      {/* SMTP settings */}
      <FormGroup title="Outgoing mail (SMTP)">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            gap: 'var(--spacing-md)',
            alignItems: 'end',
          }}
        >
          <FormField label="Server" id="smtp-server">
            <TextInput
              id="smtp-server"
              value={formData.smtpServer}
              onChange={(v) => onChange({ smtpServer: v })}
              placeholder="smtp.example.com"
            />
          </FormField>
          <FormField label="Port" id="smtp-port">
            <div style={{ width: 72 }}>
              <TextInput
                id="smtp-port"
                value={formData.smtpPort}
                onChange={(v) => onChange({ smtpPort: v })}
                placeholder="587"
              />
            </div>
          </FormField>
          <FormField label="Security" id="smtp-security">
            <div style={{ width: 110 }}>
              <SelectInput
                id="smtp-security"
                value={formData.smtpSecurity}
                onChange={(v) => onChange({ smtpSecurity: v as SecurityOption })}
                options={securityOptions}
              />
            </div>
          </FormField>
        </div>
      </FormGroup>

      {/* Authentication */}
      <FormGroup title="Authentication">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--spacing-md)',
          }}
        >
          <FormField label="Username" id="imap-username">
            <div style={{ position: 'relative' }}>
              <User
                size={14}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-tertiary)',
                  pointerEvents: 'none',
                }}
              />
              <input
                id="imap-username"
                type="text"
                value={formData.username}
                onChange={(e) => onChange({ username: e.target.value })}
                placeholder="your@email.com"
                autoComplete="username"
                style={{
                  height: 34,
                  paddingLeft: 32,
                  paddingRight: 'var(--spacing-md)',
                  background: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-primary)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-md)',
                  fontFamily: 'var(--font-family)',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box' as CSSProperties['boxSizing'],
                  transition: 'border-color var(--transition-fast)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-focus)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                }}
              />
            </div>
          </FormField>

          <FormField label="Password" id="imap-password">
            <div style={{ position: 'relative' }}>
              <Lock
                size={14}
                style={{
                  position: 'absolute',
                  left: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-tertiary)',
                  pointerEvents: 'none',
                }}
              />
              <input
                id="imap-password"
                type="password"
                value={formData.password}
                onChange={(e) => onChange({ password: e.target.value })}
                placeholder="App password"
                autoComplete="current-password"
                style={{
                  height: 34,
                  paddingLeft: 32,
                  paddingRight: 'var(--spacing-md)',
                  background: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border-primary)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-md)',
                  fontFamily: 'var(--font-family)',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box' as CSSProperties['boxSizing'],
                  transition: 'border-color var(--transition-fast)',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-focus)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                }}
              />
            </div>
          </FormField>
        </div>
      </FormGroup>

      {/* Test connection */}
      <Tooltip.Provider delayDuration={200}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild>
            <span style={{ display: 'inline-block' }}>
              <button
                disabled
                aria-disabled="true"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                  height: 34,
                  padding: '0 var(--spacing-lg)',
                  background: 'var(--color-bg-tertiary)',
                  border: '1px solid var(--color-border-primary)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--color-text-tertiary)',
                  fontSize: 'var(--font-size-md)',
                  fontFamily: 'var(--font-family)',
                  cursor: 'not-allowed',
                  opacity: 0.6,
                  pointerEvents: 'none',
                }}
              >
                <FlaskConical size={14} strokeWidth={1.75} />
                Test connection
              </button>
            </span>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Content
              side="top"
              sideOffset={6}
              style={{
                background: 'var(--color-text-primary)',
                color: 'var(--color-text-inverse)',
                padding: '5px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family)',
                boxShadow: 'var(--shadow-md)',
                zIndex: 300,
              }}
            >
              Coming soon
              <Tooltip.Arrow style={{ fill: 'var(--color-text-primary)' }} />
            </Tooltip.Content>
          </Tooltip.Portal>
        </Tooltip.Root>
      </Tooltip.Provider>
    </div>
  );
}

function FormGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 'var(--font-size-xs)',
          fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
          color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-family)',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          marginBottom: 'var(--spacing-md)',
        }}
      >
        {title}
      </div>
      <div
        style={{
          padding: 'var(--spacing-lg)',
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-secondary)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-md)',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main modal component
// ---------------------------------------------------------------------------

export function AddAccountModal({ open, onOpenChange }: AddAccountModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<ModalStep>('choose');
  const [selectedProvider, setSelectedProvider] = useState<AccountProvider | null>(null);
  const [imapForm, setImapForm] = useState<ImapFormData>(DEFAULT_IMAP_FORM);
  const providers = useProviders();

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      // Defer reset so it happens after the close animation
      setTimeout(() => {
        setStep('choose');
        setSelectedProvider(null);
        setImapForm(DEFAULT_IMAP_FORM);
      }, 200);
    }
    onOpenChange(nextOpen);
  };

  const handleProviderSelect = (provider: AccountProvider) => {
    setSelectedProvider(provider);
  };

  const handleContinue = () => {
    if (!selectedProvider) return;
    if (selectedProvider === 'custom') {
      setStep('imap');
    } else {
      setStep('oauth');
    }
  };

  const handleBack = () => {
    setStep('choose');
  };

  const handleImapChange = (data: Partial<ImapFormData>) => {
    setImapForm((prev) => ({ ...prev, ...data }));
  };

  const isImapFormValid = (): boolean => {
    const { email, imapServer, imapPort, smtpServer, smtpPort, username, password } = imapForm;
    if (!email || !email.includes('@')) return false;
    if (!imapServer.trim()) return false;
    if (!smtpServer.trim()) return false;
    const imapPortNum = parseInt(imapPort, 10);
    const smtpPortNum = parseInt(smtpPort, 10);
    if (isNaN(imapPortNum) || imapPortNum < 1 || imapPortNum > 65535) return false;
    if (isNaN(smtpPortNum) || smtpPortNum < 1 || smtpPortNum > 65535) return false;
    if (!username.trim()) return false;
    if (!password) return false;
    return true;
  };

  const handleImapSubmit = () => {
    if (!isImapFormValid()) return;
    // TODO: Wire to backend endpoint when IMAP support is implemented
    // For now, close the modal and show that configuration was captured
    handleClose();
  };

  const activeProvider = providers.find((p) => p.id === selectedProvider) ?? null;

  const title =
    step === 'choose'
      ? t('settings.addAccount')
      : step === 'oauth' && activeProvider
        ? `Connect ${activeProvider.name}`
        : 'IMAP / SMTP setup';

  return (
    <Modal
      open={open}
      onOpenChange={handleOpenChange}
      width={640}
      height="80vh"
      title={title}
    >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--spacing-lg) var(--spacing-xl)',
              borderBottom: '1px solid var(--color-border-primary)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              {step !== 'choose' && (
                <button
                  onClick={handleBack}
                  aria-label="Go back"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 28,
                    height: 28,
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    background: 'transparent',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    flexShrink: 0,
                    marginRight: 2,
                    transition: 'background var(--transition-fast), color var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--color-surface-hover)';
                    e.currentTarget.style.color = 'var(--color-text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--color-text-secondary)';
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
              )}
              <span
                style={{
                  fontSize: 'var(--font-size-lg)',
                  fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-family)',
                }}
              >
                {title}
              </span>
            </div>

            <Dialog.Close asChild>
              <button
                aria-label="Close"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  background: 'transparent',
                  color: 'var(--color-text-tertiary)',
                  cursor: 'pointer',
                  transition: 'background var(--transition-fast), color var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-surface-hover)';
                  e.currentTarget.style.color = 'var(--color-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-tertiary)';
                }}
              >
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 'var(--spacing-xl)',
              boxSizing: 'border-box' as CSSProperties['boxSizing'],
            }}
          >
            {step === 'choose' && (
              <StepChoose
                selectedProvider={selectedProvider}
                onSelect={handleProviderSelect}
              />
            )}

            {step === 'oauth' && activeProvider && (
              <StepOAuth provider={activeProvider} />
            )}

            {step === 'imap' && (
              <StepImap formData={imapForm} onChange={handleImapChange} />
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 'var(--spacing-sm)',
              padding: 'var(--spacing-md) var(--spacing-xl)',
              borderTop: '1px solid var(--color-border-primary)',
              flexShrink: 0,
            }}
          >
            <button
              onClick={handleClose}
              style={{
                height: 34,
                padding: '0 var(--spacing-lg)',
                background: 'transparent',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-md)',
                fontFamily: 'var(--font-family)',
                cursor: 'pointer',
                transition:
                  'background var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-surface-hover)';
                e.currentTarget.style.borderColor = 'var(--color-border-focus)';
                e.currentTarget.style.color = 'var(--color-text-primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                e.currentTarget.style.color = 'var(--color-text-secondary)';
              }}
            >
              {t('common.cancel')}
            </button>

            {step === 'choose' && (
              <ContinueButton
                disabled={selectedProvider === null}
                onClick={handleContinue}
              />
            )}

            {step === 'imap' && (
              <ContinueButton
                disabled={!isImapFormValid()}
                onClick={handleImapSubmit}
              />
            )}
          </div>
    </Modal>
  );
}

function ContinueButton({
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        height: 34,
        padding: '0 var(--spacing-lg)',
        background: disabled
          ? 'var(--color-bg-tertiary)'
          : hovered
            ? 'var(--color-accent-primary-hover)'
            : 'var(--color-accent-primary)',
        border: `1px solid ${disabled ? 'var(--color-border-primary)' : 'transparent'}`,
        borderRadius: 'var(--radius-md)',
        color: disabled ? 'var(--color-text-tertiary)' : '#ffffff',
        fontSize: 'var(--font-size-md)',
        fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
        fontFamily: 'var(--font-family)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition:
          'background var(--transition-fast), color var(--transition-fast)',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      Continue
    </button>
  );
}
