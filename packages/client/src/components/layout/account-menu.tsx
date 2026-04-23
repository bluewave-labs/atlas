import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LogOut, Check } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { Avatar } from '../ui/avatar';
import { Tooltip } from '../ui/tooltip';
import { ConfirmDialog } from '../ui/confirm-dialog';
import type { Account } from '@atlas-platform/shared';

export function AccountMenu() {
  const { t } = useTranslation();
  const { account, accounts, switchAccount, removeAccount, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const handleSwitch = (accountId: string) => {
    switchAccount(accountId);
    setOpen(false);
  };

  const executeRemove = (accountId: string) => {
    const isActive = account?.id === accountId;
    if (isActive && accounts.length <= 1) {
      logout();
    } else {
      removeAccount(accountId);
    }
  };

  if (!account) return null;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <Tooltip content={account.name || account.email} side="right">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Switch account"
          aria-haspopup="menu"
          aria-expanded={open}
          style={{
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <Avatar src={account.pictureUrl} name={account.name} email={account.email} size={26} />
        </button>
      </Tooltip>

      {open && (
        <div
          role="menu"
          aria-label="Account switcher"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 'calc(100% + 10px)',
            width: 240,
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-elevated)',
            padding: 6,
            zIndex: 200,
          }}
        >
          {accounts.map((acc: Account) => {
            const isActive = acc.id === account.id;
            return (
              <div
                key={acc.id}
                role="menuitem"
                onClick={() => handleSwitch(acc.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--spacing-sm)',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  background: isActive ? 'var(--color-surface-selected)' : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--color-surface-hover)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <Avatar src={acc.pictureUrl} name={acc.name} email={acc.email} size={28} />
                <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: 'var(--font-size-sm)',
                      fontWeight: 'var(--font-weight-medium)',
                      color: 'var(--color-text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {acc.name || acc.email}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-tertiary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {acc.email}
                  </div>
                </div>
                {isActive && <Check size={14} style={{ color: 'var(--color-accent-primary)' }} />}
              </div>
            );
          })}

          <div
            aria-hidden="true"
            style={{
              height: 1,
              background: 'var(--color-border-primary)',
              margin: '6px 0',
            }}
          />

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setConfirmRemoveId(account.id);
            }}
            role="menuitem"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
              padding: '8px 10px',
              border: 'none',
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family)',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <LogOut size={14} />
            {t('common.signOut', 'Sign out')}
          </button>
        </div>
      )}

      {confirmRemoveId && (
        <ConfirmDialog
          open={!!confirmRemoveId}
          onOpenChange={(open) => { if (!open) setConfirmRemoveId(null); }}
          title={t('account.signOutConfirmTitle', 'Sign out?')}
          description={t('account.signOutConfirmDescription', 'You will be signed out of this account.')}
          confirmLabel={t('common.signOut', 'Sign out')}
          onConfirm={() => {
            const id = confirmRemoveId;
            setConfirmRemoveId(null);
            executeRemove(id);
          }}
        />
      )}
    </div>
  );
}
