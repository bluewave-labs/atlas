import { useState, useEffect, useCallback, useRef, type CSSProperties } from 'react';
import {
  LogOut,
  Save,
  Camera,
  CheckCircle2,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { Avatar } from '../ui/avatar';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ConfirmDialog } from '../ui/confirm-dialog';
import {
  SettingsSection,
  SettingsRow,
} from './settings-primitives';

// ---------------------------------------------------------------------------
// Inline save button
// ---------------------------------------------------------------------------

function SaveButton({ onClick, saved }: { onClick: () => void; saved: boolean }) {
  return (
    <Button
      variant="primary"
      size="sm"
      onClick={onClick}
      icon={saved ? <CheckCircle2 size={13} /> : <Save size={13} />}
      style={saved ? { background: 'var(--color-success)' } : undefined}
    >
      {saved ? 'Saved' : 'Save'}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// GeneralPanel
// ---------------------------------------------------------------------------

export function GeneralPanel() {
  const account = useAuthStore((s) => s.account);
  const updateAccount = useAuthStore((s) => s.updateAccount);
  const [displayName, setDisplayName] = useState(account?.name ?? '');
  const [saved, setSaved] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarHovered, setAvatarHovered] = useState(false);

  // Reset saved state when display name changes
  useEffect(() => {
    setSaved(false);
  }, [displayName]);

  const handleSaveName = useCallback(() => {
    if (!account) return;
    updateAccount({ ...account, name: displayName.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [account, displayName, updateAccount]);

  const handleAvatarUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !account) return;

    // Validate file type and size (max 2MB)
    if (!file.type.startsWith('image/')) return;
    if (file.size > 2 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      updateAccount({ ...account, pictureUrl: dataUrl });
    };
    reader.readAsDataURL(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  }, [account, updateAccount]);

  const handleRemoveAvatar = useCallback(() => {
    if (!account) return;
    updateAccount({ ...account, pictureUrl: null });
  }, [account, updateAccount]);

  return (
    <div>
      <SettingsSection title="Profile">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-xl)',
            padding: 'var(--spacing-xl)',
            background: 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--spacing-lg)',
            border: '1px solid var(--color-border-secondary)',
          }}
        >
          {/* Avatar with upload overlay */}
          <div
            style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }}
            onMouseEnter={() => setAvatarHovered(true)}
            onMouseLeave={() => setAvatarHovered(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            <Avatar
              src={account?.pictureUrl}
              name={account?.name ?? ''}
              email={account?.email ?? ''}
              size={56}
            />
            {/* Camera overlay on hover */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: avatarHovered ? 1 : 0,
                transition: 'opacity var(--transition-normal)',
              }}
            >
              <Camera size={18} color="#ffffff" />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              style={{ display: 'none' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 'var(--font-size-lg)',
                fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-family)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {account?.name || 'No name set'}
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: 'var(--font-size-md)',
                color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-family)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {account?.email}
            </div>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                style={{ height: 24, padding: '0 8px', fontSize: 'var(--font-size-xs)' }}
              >
                Upload photo
              </Button>
              {account?.pictureUrl && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleRemoveAvatar(); }}
                  style={{ height: 24, padding: '0 8px', fontSize: 'var(--font-size-xs)' }}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

        <SettingsRow label="Display name" description="How your name appears when you send emails">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              style={{ width: 220 }}
            />
            <SaveButton onClick={handleSaveName} saved={saved} />
          </div>
        </SettingsRow>

        <SettingsRow label="Email address" description="Your Google account email">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 34,
              padding: '0 var(--spacing-md)',
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border-secondary)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-tertiary)',
              fontSize: 'var(--font-size-md)',
              fontFamily: 'var(--font-family)',
              userSelect: 'none',
              minWidth: 220,
            }}
          >
            {account?.email || '—'}
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Account">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: 'var(--spacing-md) var(--spacing-lg)',
            background: 'var(--color-surface-primary)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 'var(--font-size-md)',
                fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                color: 'var(--color-text-primary)',
                fontFamily: 'var(--font-family)',
              }}
            >
              Sign out
            </div>
            <div
              style={{
                marginTop: 2,
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-tertiary)',
                fontFamily: 'var(--font-family)',
              }}
            >
              Sign out of your current account
            </div>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={() => setShowLogoutConfirm(true)}
            icon={<LogOut size={14} />}
            style={{ fontSize: 'var(--font-size-sm)' }}
          >
            Sign out
          </Button>
        </div>
      </SettingsSection>

      <ConfirmDialog
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        title="Sign out?"
        description="You will be signed out of your current account. You can sign back in at any time."
        confirmLabel="Sign out"
        onConfirm={() => useAuthStore.getState().logout()}
      />
    </div>
  );
}
