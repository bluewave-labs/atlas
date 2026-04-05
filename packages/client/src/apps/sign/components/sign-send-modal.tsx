import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Link2,
  Copy,
  Plus,
  X,
  ListOrdered,
  Bell,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { Select } from '../../../components/ui/select';
import { IconButton } from '../../../components/ui/icon-button';
import { Tooltip } from '../../../components/ui/tooltip';
import { Modal } from '../../../components/ui/modal';
import { SIGNER_COLORS, type Signer } from './signer-panel';
import { StatusDot } from '../../../components/ui/status-dot';
import { formatDate } from '../../../lib/format';

interface SigningLink {
  id: string;
  signerEmail: string;
  signerName: string | null;
  status: string;
  role?: string;
  signingOrder: number;
  lastReminderAt?: string | null;
}

export function SignSendModal({
  open,
  onOpenChange,
  signers,
  onSignersChange,
  emailSubject,
  onEmailSubjectChange,
  emailMessage,
  onEmailMessageChange,
  expiryDate,
  onExpiryDateChange,
  signInOrder,
  onSignInOrderChange,
  generatedLink,
  generatedLinks,
  linkCopied,
  onCopyLink,
  signingLinks,
  onSendForSigning,
  onSendReminder,
  isSending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signers: Signer[];
  onSignersChange: (signers: Signer[]) => void;
  emailSubject: string;
  onEmailSubjectChange: (v: string) => void;
  emailMessage: string;
  onEmailMessageChange: (v: string) => void;
  expiryDate: string;
  onExpiryDateChange: (v: string) => void;
  signInOrder: boolean;
  onSignInOrderChange: (v: boolean) => void;
  generatedLink: string | null;
  generatedLinks: { email: string; link: string }[];
  linkCopied: boolean;
  onCopyLink: (link: string) => void;
  signingLinks: SigningLink[] | undefined;
  onSendForSigning: () => void;
  onSendReminder: (linkId: string) => void;
  isSending: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={520} title={t('sign.editor.sendForSigning')}>
      <Modal.Header title={t('sign.editor.sendForSigning')} />
      <Modal.Body>
        {!generatedLink ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Input
              label={t('sign.send.emailSubject')}
              placeholder={t('sign.send.emailSubjectPlaceholder')}
              value={emailSubject}
              onChange={(e) => onEmailSubjectChange(e.target.value)}
              size="md"
            />
            <Textarea
              label={t('sign.send.emailMessage')}
              placeholder={t('sign.send.emailMessagePlaceholder')}
              value={emailMessage}
              onChange={(e) => onEmailMessageChange(e.target.value)}
              rows={3}
            />
            {signers.map((signer, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-end',
                  padding: '8px 0',
                  borderLeft: `3px solid ${SIGNER_COLORS[idx % SIGNER_COLORS.length]}`,
                  paddingLeft: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <Input
                    label={idx === 0 ? t('sign.send.signerEmail') : undefined}
                    placeholder={t('sign.send.emailPlaceholder')}
                    value={signer.email}
                    onChange={(e) => {
                      const updated = [...signers];
                      updated[idx] = { ...updated[idx], email: e.target.value };
                      onSignersChange(updated);
                    }}
                    size="md"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Input
                    label={idx === 0 ? t('sign.send.signerName') : undefined}
                    placeholder={t('sign.send.namePlaceholder')}
                    value={signer.name}
                    onChange={(e) => {
                      const updated = [...signers];
                      updated[idx] = { ...updated[idx], name: e.target.value };
                      onSignersChange(updated);
                    }}
                    size="md"
                  />
                </div>
                <div style={{ width: 110, flexShrink: 0 }}>
                  {idx === 0 && (
                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'], color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                      {t('sign.send.role')}
                    </div>
                  )}
                  <Select
                    value={signer.role || 'signer'}
                    onChange={(val) => {
                      const updated = [...signers];
                      updated[idx] = { ...updated[idx], role: val as Signer['role'] };
                      onSignersChange(updated);
                    }}
                    options={[
                      { value: 'signer', label: t('sign.roles.signer') },
                      { value: 'viewer', label: t('sign.roles.viewer') },
                      { value: 'approver', label: t('sign.roles.approver') },
                      { value: 'cc', label: t('sign.roles.cc') },
                    ]}
                    size="md"
                  />
                </div>
                <div style={{ width: 120, flexShrink: 0 }}>
                  {idx === 0 && (
                    <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'], color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                      {t('sign.send.signerExpiry')}
                    </div>
                  )}
                  <Input
                    type="date"
                    value={signer.expiryDate || ''}
                    onChange={(e) => {
                      const updated = [...signers];
                      updated[idx] = { ...updated[idx], expiryDate: e.target.value || undefined };
                      onSignersChange(updated);
                    }}
                    placeholder={t('sign.send.defaultExpiry')}
                    size="md"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                {signers.length > 1 && (
                  <IconButton
                    icon={<X size={14} />}
                    label={t('sign.send.removeSigner')}
                    size={28}
                    destructive
                    onClick={() => {
                      onSignersChange(signers.filter((_, i) => i !== idx));
                    }}
                  />
                )}
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => onSignersChange([...signers, { email: '', name: '', role: 'signer', expiryDate: undefined }])}
              style={{ alignSelf: 'flex-start' }}
            >
              {t('sign.send.addSigner')}
            </Button>
            <Input
              label={t('sign.send.expiresOn')}
              type="date"
              value={expiryDate}
              onChange={(e) => onExpiryDateChange(e.target.value)}
              size="md"
              min={new Date().toISOString().split('T')[0]}
            />
            {/* Sign in order toggle */}
            {signers.filter((s) => s.email.trim()).length > 1 && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: signInOrder ? 'rgba(139, 92, 246, 0.06)' : 'var(--color-bg-tertiary)',
                  border: `1px solid ${signInOrder ? 'rgba(139, 92, 246, 0.3)' : 'var(--color-border-secondary)'}`,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                <input
                  type="checkbox"
                  checked={signInOrder}
                  onChange={(e) => onSignInOrderChange(e.target.checked)}
                  style={{ accentColor: '#8b5cf6' }}
                />
                <ListOrdered size={14} style={{ color: signInOrder ? '#8b5cf6' : 'var(--color-text-tertiary)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'], color: 'var(--color-text-primary)' }}>
                    {t('sign.send.signInOrder')}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 1 }}>
                    {t('sign.send.signInOrderDesc')}
                  </div>
                </div>
              </label>
            )}
            {/* Existing links */}
            {signingLinks && signingLinks.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                    color: 'var(--color-text-tertiary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: 6,
                  }}
                >
                  {t('sign.send.existingLinks')}
                </div>
                {signingLinks.map((link) => (
                  <div
                    key={link.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 0',
                      borderBottom: '1px solid var(--color-border-secondary)',
                      fontSize: 'var(--font-size-sm)',
                      gap: 8,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {link.signingOrder > 0 && (
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'] }}>
                            #{link.signingOrder + 1}
                          </span>
                        )}
                        <span style={{ color: 'var(--color-text-primary)' }}>
                          {link.signerEmail}
                        </span>
                        {link.role && link.role !== 'signer' && (
                          <Badge variant="default">
                            {t(`sign.roles.${link.role}`)}
                          </Badge>
                        )}
                      </div>
                      {link.status === 'pending' && link.lastReminderAt && (
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                          {t('sign.reminders.lastSent', { date: formatDate(link.lastReminderAt) })}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {link.status === 'pending' && (
                        <Tooltip content={t('sign.reminders.sendReminder')}>
                          <IconButton
                            icon={<Bell size={13} />}
                            label={t('sign.reminders.sendReminder')}
                            size={24}
                            onClick={() => onSendReminder(link.id)}
                          />
                        </Tooltip>
                      )}
                      <Badge variant={link.status === 'signed' ? 'success' : link.status === 'expired' || link.status === 'declined' ? 'error' : 'warning'}>
                        {link.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--color-text-secondary)',
                marginBottom: 4,
              }}
            >
              {generatedLinks.length > 1
                ? t('sign.send.linksGenerated')
                : t('sign.send.linkGenerated')}
            </div>
            {generatedLinks.map((gl, idx) => (
              <div key={idx}>
                {generatedLinks.length > 1 && (
                  <div
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: SIGNER_COLORS[idx % SIGNER_COLORS.length],
                      fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                      marginBottom: 4,
                    }}
                  >
                    {gl.email}
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: 'var(--color-bg-tertiary)',
                    border: '1px solid var(--color-border-primary)',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <Link2 size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 'var(--font-size-sm)',
                      color: 'var(--color-text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {gl.link}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Copy size={13} />}
                    onClick={() => onCopyLink(gl.link)}
                  >
                    {t('sign.send.copy')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>
          {generatedLink ? t('sign.send.done') : t('sign.send.cancel')}
        </Button>
        {!generatedLink && (
          <Button
            variant="primary"
            onClick={onSendForSigning}
            disabled={!signers.some((s) => s.email.trim()) || isSending}
          >
            {isSending ? t('sign.send.generating') : signers.filter((s) => s.email.trim()).length > 1 ? t('sign.send.generateLinks') : t('sign.send.generateLink')}
          </Button>
        )}
      </Modal.Footer>
    </Modal>
  );
}
