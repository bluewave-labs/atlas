import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users, UserX, Link2, Copy, Trash2, Lock,
} from 'lucide-react';
import { Modal } from '../../../../components/ui/modal';
import { Button } from '../../../../components/ui/button';
import { IconButton } from '../../../../components/ui/icon-button';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { Avatar } from '../../../../components/ui/avatar';
import { Badge } from '../../../../components/ui/badge';
import { Tooltip } from '../../../../components/ui/tooltip';
import { formatRelativeDate } from '../../../../lib/drive-utils';
import type { DriveItem, DriveShareLink, TenantUser } from '@atlasmail/shared';

interface ShareModalProps {
  shareModalItem: DriveItem | null;
  setShareModalItem: (item: DriveItem | null) => void;
  tenantUsersData: TenantUser[];
  itemSharesData: Array<{ id: string; sharedWithUserId: string; permission: string }> | undefined;
  shareLinksData: { links: DriveShareLink[] } | undefined;
  shareItem: { mutate: (args: { itemId: string; userId: string; permission: string }, opts?: any) => void; isPending: boolean };
  revokeShare: { mutate: (args: { itemId: string; userId: string }, opts?: any) => void };
  createShareLink: { mutate: (args: { itemId: string; expiresAt?: string; password?: string }, opts?: any) => void };
  deleteShareLink: { mutate: (id: string, opts?: any) => void };
  addToast: (toast: { type: 'success' | 'error' | 'info' | 'undo'; message: string }) => void;
  defaultExpiry: string;
}

export function ShareModal({
  shareModalItem,
  setShareModalItem,
  tenantUsersData,
  itemSharesData,
  shareLinksData,
  shareItem,
  revokeShare,
  createShareLink,
  deleteShareLink,
  addToast,
  defaultExpiry,
}: ShareModalProps) {
  const { t } = useTranslation();
  const [shareUserId, setShareUserId] = useState<string>('');
  const [sharePermission, setSharePermission] = useState<string>('view');
  const [shareExpiry, setShareExpiry] = useState<string>(defaultExpiry || 'never');
  const [sharePassword, setSharePassword] = useState('');
  const [sharePasswordEnabled, setSharePasswordEnabled] = useState(false);

  return (
    <Modal
      open={!!shareModalItem}
      onOpenChange={() => {
        setShareModalItem(null);
        setShareUserId('');
        setSharePermission('view');
        setSharePassword('');
        setSharePasswordEnabled(false);
      }}
      width={480}
      title={t('drive.sharing.shareTitle', { name: shareModalItem?.name || '' })}
    >
      <div style={{ padding: 'var(--spacing-xl)' }}>
        {/* Share with team member section */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>
            {t('drive.sharing.shareWithUser')}
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Select
              value={shareUserId}
              onChange={(v) => setShareUserId(v)}
              size="sm"
              options={[
                { value: '', label: t('drive.sharing.selectUser') },
                ...(tenantUsersData ?? [])
                  .filter((u) => {
                    const alreadyShared = (itemSharesData ?? []).map((s) => s.sharedWithUserId);
                    return !alreadyShared.includes(u.userId);
                  })
                  .map((u) => ({ value: u.userId, label: u.name || u.email })),
              ]}
              style={{ flex: 1 }}
            />
            <Select
              value={sharePermission}
              onChange={(v) => setSharePermission(v)}
              size="sm"
              options={[
                { value: 'view', label: t('drive.sharing.shareView') },
                { value: 'edit', label: t('drive.sharing.shareEdit') },
              ]}
              style={{ width: 120 }}
            />
            <Button
              variant="primary"
              size="sm"
              icon={<Users size={14} />}
              disabled={!shareUserId || shareItem.isPending}
              onClick={() => {
                if (!shareModalItem || !shareUserId) return;
                shareItem.mutate({ itemId: shareModalItem.id, userId: shareUserId, permission: sharePermission }, {
                  onSuccess: () => {
                    addToast({ type: 'success', message: t('drive.sharing.shareSuccess') });
                    setShareUserId('');
                    setSharePermission('view');
                  },
                });
              }}
              style={{ whiteSpace: 'nowrap' }}
            >
              {t('drive.sharing.shareAction')}
            </Button>
          </div>

          {/* Current internal shares list */}
          {itemSharesData && itemSharesData.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {itemSharesData.map((share) => {
                const user = (tenantUsersData ?? []).find((u) => u.userId === share.sharedWithUserId);
                return (
                  <div
                    key={share.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border-secondary)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', minWidth: 0, flex: 1 }}>
                      <Avatar name={user?.name || user?.email || null} email={user?.email} size={24} />
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {user?.name || user?.email || share.sharedWithUserId}
                      </span>
                      <Select
                        value={share.permission}
                        size="sm"
                        onChange={(v) => {
                          if (shareModalItem) {
                            shareItem.mutate({ itemId: shareModalItem.id, userId: share.sharedWithUserId, permission: v });
                          }
                        }}
                        options={[
                          { value: 'view', label: t('drive.sharing.shareView') },
                          { value: 'edit', label: t('drive.sharing.shareEdit') },
                        ]}
                        style={{ width: 110, flexShrink: 0 }}
                      />
                    </div>
                    <IconButton
                      icon={<UserX size={13} />}
                      label={t('drive.sharing.shareRevoke')}
                      size={22}
                      tooltip={false}
                      destructive
                      onClick={() => revokeShare.mutate({ itemId: shareModalItem!.id, userId: share.sharedWithUserId }, {
                        onSuccess: () => addToast({ type: 'success', message: t('drive.sharing.revokeSuccess') }),
                      })}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', textAlign: 'center', padding: '8px 0' }}>
              {t('drive.sharing.shareNoShares')}
            </div>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--color-border-secondary)', margin: '16px 0' }} />

        {/* Public link section */}
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 8 }}>
          {t('drive.sharing.publicLink')}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <Select
            value={shareExpiry}
            onChange={(v) => setShareExpiry(v)}
            size="sm"
            options={[
              { value: 'never', label: t('drive.sharing.expiryNever') },
              { value: '1', label: t('drive.sharing.expiry1Day') },
              { value: '7', label: t('drive.sharing.expiry7Days') },
              { value: '30', label: t('drive.sharing.expiry30Days') },
            ]}
            style={{ flex: 1 }}
          />
          <Button
            variant="primary"
            size="sm"
            icon={<Link2 size={14} />}
            onClick={() => {
              if (!shareModalItem) return;
              const expiresAt = shareExpiry === 'never' ? undefined : new Date(Date.now() + parseInt(shareExpiry) * 86400000).toISOString();
              createShareLink.mutate({
                itemId: shareModalItem.id,
                expiresAt,
                password: sharePasswordEnabled && sharePassword ? sharePassword : undefined,
              }, {
                onSuccess: () => {
                  addToast({ type: 'success', message: t('drive.actions.shareLinkCreated') });
                  setSharePassword('');
                  setSharePasswordEnabled(false);
                },
              });
            }}
            style={{ whiteSpace: 'nowrap' }}
          >
            {t('drive.sharing.createLink')}
          </Button>
        </div>
        {/* Password protection */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)' }}>
            <input
              type="checkbox"
              checked={sharePasswordEnabled}
              onChange={(e) => { setSharePasswordEnabled(e.target.checked); if (!e.target.checked) setSharePassword(''); }}
              style={{ accentColor: 'var(--color-accent-primary)' }}
            />
            <Lock size={12} />
            {t('drive.sharing.passwordProtect')}
          </label>
          {sharePasswordEnabled && (
            <div style={{ marginTop: 'var(--spacing-sm)' }}>
              <Input
                type="password"
                size="sm"
                value={sharePassword}
                onChange={(e) => setSharePassword(e.target.value)}
                placeholder={t('drive.sharing.passwordPlaceholder')}
                iconLeft={<Lock size={12} />}
              />
            </div>
          )}
        </div>
        {shareLinksData && shareLinksData.links.length > 0 && (
          <div className="drive-share-links-list">
            {shareLinksData.links.map((link) => {
              const shareUrl = `${window.location.origin}/api/v1/share/${link.shareToken}/download`;
              return (
                <div key={link.id} className="drive-share-link-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Input
                      size="sm"
                      readOnly
                      value={shareUrl}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      iconLeft={<Link2 size={12} />}
                      style={{ fontSize: 'var(--font-size-xs)' }}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 'var(--spacing-xs)' }}>
                      <span>{t('drive.sharing.linkCreated', { date: formatRelativeDate(link.createdAt) })}</span>
                      <span>{link.expiresAt ? t('drive.sharing.linkExpires', { date: formatRelativeDate(link.expiresAt) }) : t('drive.sharing.linkNoExpiry')}</span>
                      {link.passwordHash && (
                        <Badge variant="warning">
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10 }}><Lock size={8} /> {t('drive.sharing.protected')}</span>
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexShrink: 0 }}>
                    <Tooltip content={t('drive.sharing.copyLink')}>
                      <span>
                        <IconButton
                          icon={<Copy size={13} />}
                          label={t('drive.sharing.copyLink')}
                          size={22}
                          tooltip={false}
                          onClick={() => { navigator.clipboard.writeText(shareUrl); addToast({ type: 'success', message: t('drive.sharing.linkCopied') }); }}
                        />
                      </span>
                    </Tooltip>
                    <Tooltip content={t('drive.sharing.deleteLink')}>
                      <span>
                        <IconButton
                          icon={<Trash2 size={13} />}
                          label={t('drive.sharing.deleteLink')}
                          size={22}
                          tooltip={false}
                          destructive
                          onClick={() => deleteShareLink.mutate(link.id, { onSuccess: () => addToast({ type: 'success', message: t('drive.sharing.linkDeleted') }) })}
                        />
                      </span>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
