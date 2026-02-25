import { useState, useRef, useCallback, useEffect, type CSSProperties } from 'react';
import {
  Phone, Mail, Building2, Paperclip, Copy, Pencil, Check,
  MailPlus, Clock, ArrowUpRight, ArrowDownLeft,
  Linkedin, Github, Twitter, Facebook, Globe,
} from 'lucide-react';
import { Avatar } from '../ui/avatar';
import { useContactByEmail, useUpdateContactNotes, useEnrichContact } from '../../hooks/use-contacts';
import { useEmailStore } from '../../stores/email-store';
import { formatRelativeTime } from '@atlasmail/shared';
import type { ContactThread, ContactAttachment, InteractionStats, SocialProfile } from '@atlasmail/shared';

// ─── Helpers ─────────────────────────────────────────────────────────

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDateShort(isoDate: string): string {
  const d = new Date(isoDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return 'today';
  if (diffDays < 30) return `${diffDays}d ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

function formatDuration(firstDate: string): string {
  const start = new Date(firstDate);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth();
  if (months < 1) return 'less than a month';
  if (months < 12) return `${months} month${months > 1 ? 's' : ''}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} year${years > 1 ? 's' : ''}`;
  return `${years}y ${rem}mo`;
}

// ─── Sub-components ──────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h4
      style={{
        margin: 0,
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
        color: 'var(--color-text-tertiary)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
        fontFamily: 'var(--font-family)',
        marginBottom: 'var(--spacing-xs)',
      }}
    >
      {children}
    </h4>
  );
}

function DetailRow({ icon, label, href }: { icon: React.ReactNode; label: string; href?: string }) {
  const inner = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        padding: '3px 0',
        fontSize: 'var(--font-size-sm)',
        color: href ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
        fontFamily: 'var(--font-family)',
      }}
    >
      <span style={{ color: 'var(--color-text-tertiary)', flexShrink: 0, display: 'flex' }}>{icon}</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );

  if (href) {
    return <a href={href} style={{ textDecoration: 'none' }} target="_blank" rel="noopener noreferrer">{inner}</a>;
  }
  return inner;
}

function IconButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={label}
      aria-label={label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        padding: 'var(--spacing-sm)',
        background: hovered ? 'var(--color-surface-hover)' : 'transparent',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        color: hovered ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        fontFamily: 'var(--font-family)',
        fontSize: 'var(--font-size-xs)',
        transition: 'all var(--transition-normal)',
        flex: 1,
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ThreadLink({ thread }: { thread: ContactThread }) {
  const { setActiveThread } = useEmailStore();
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={() => setActiveThread(thread.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: 'var(--spacing-xs) var(--spacing-sm)',
        background: hovered ? 'var(--color-surface-hover)' : 'transparent',
        border: 'none',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        fontFamily: 'var(--font-family)',
        transition: 'background var(--transition-normal)',
      }}
    >
      <div
        style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-primary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: thread.unreadCount > 0 ? 600 : 400,
        }}
      >
        {thread.subject || '(no subject)'}
      </div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 2 }}>
        {formatRelativeTime(thread.lastMessageAt)}
      </div>
    </button>
  );
}

function AttachmentRow({ attachment }: { attachment: ContactAttachment }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        padding: '3px 0',
        fontSize: 'var(--font-size-sm)',
        fontFamily: 'var(--font-family)',
      }}
    >
      <Paperclip size={12} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
      <span
        style={{
          color: 'var(--color-text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}
        title={attachment.filename}
      >
        {attachment.filename}
      </span>
      <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', flexShrink: 0 }}>
        {formatFileSize(attachment.size)}
      </span>
    </div>
  );
}

// ─── Notes editor ────────────────────────────────────────────────────

function NotesEditor({ email, initialNotes }: { email: string; initialNotes: string }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialNotes);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const updateNotes = useUpdateContactNotes();

  // Sync initial value when contact data changes
  useEffect(() => {
    if (!editing) setValue(initialNotes);
  }, [initialNotes, editing]);

  const handleSave = useCallback(() => {
    const trimmed = value.trim();
    updateNotes.mutate({ email, notes: trimmed });
    setEditing(false);
  }, [email, value, updateNotes]);

  const handleCancel = useCallback(() => {
    setValue(initialNotes);
    setEditing(false);
  }, [initialNotes]);

  if (!editing) {
    return (
      <button
        onClick={() => {
          setEditing(true);
          setTimeout(() => textareaRef.current?.focus(), 0);
        }}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 'var(--spacing-sm)',
          width: '100%',
          padding: 'var(--spacing-sm)',
          background: 'var(--color-bg-tertiary)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          fontFamily: 'var(--font-family)',
          fontSize: 'var(--font-size-sm)',
          color: value ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)',
          textAlign: 'left',
          minHeight: 32,
          transition: 'border-color var(--transition-normal)',
        }}
      >
        {value ? (
          <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', flex: 1 }}>{value}</span>
        ) : (
          <>
            <Pencil size={12} style={{ marginTop: 2, flexShrink: 0 }} />
            <span>Add a note...</span>
          </>
        )}
      </button>
    );
  }

  return (
    <div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSave();
          }
          if (e.key === 'Escape') handleCancel();
        }}
        placeholder="Add a note about this person..."
        rows={3}
        style={{
          width: '100%',
          padding: 'var(--spacing-sm)',
          background: 'var(--color-bg-primary)',
          border: '1px solid var(--color-accent-primary)',
          borderRadius: 'var(--radius-md)',
          fontFamily: 'var(--font-family)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-primary)',
          resize: 'vertical',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', gap: 'var(--spacing-xs)', marginTop: 'var(--spacing-xs)', justifyContent: 'flex-end' }}>
        <button
          onClick={handleCancel}
          style={{
            padding: '3px var(--spacing-sm)',
            background: 'transparent',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--font-size-xs)',
            fontFamily: 'var(--font-family)',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          style={{
            padding: '3px var(--spacing-sm)',
            background: 'var(--color-accent-primary)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            color: '#fff',
            fontSize: 'var(--font-size-xs)',
            fontFamily: 'var(--font-family)',
            cursor: 'pointer',
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}

// ─── Stats display ───────────────────────────────────────────────────

function StatsSection({ stats }: { stats: InteractionStats }) {
  if (stats.totalEmails === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
      {/* Email counts */}
      <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArrowDownLeft size={12} style={{ color: 'var(--color-accent-primary)' }} />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
            {stats.fromThem} received
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArrowUpRight size={12} style={{ color: 'var(--color-text-tertiary)' }} />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-family)' }}>
            {stats.fromYou} sent
          </span>
        </div>
      </div>
      {/* Duration */}
      {stats.firstEmailDate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Clock size={12} style={{ color: 'var(--color-text-tertiary)' }} />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family)' }}>
            In touch for {formatDuration(stats.firstEmailDate)}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Social links ────────────────────────────────────────────────────

const SOCIAL_ICONS: Record<SocialProfile['type'], React.ReactNode> = {
  linkedin: <Linkedin size={13} />,
  twitter: <Twitter size={13} />,
  github: <Github size={13} />,
  facebook: <Facebook size={13} />,
  other: <Globe size={13} />,
};

function SocialLinks({ profiles }: { profiles: SocialProfile[] }) {
  if (!profiles.length) return null;

  return (
    <div style={{ display: 'flex', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
      {profiles.map((profile, i) => (
        <a
          key={i}
          href={profile.url}
          target="_blank"
          rel="noopener noreferrer"
          title={profile.label || profile.type}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border-primary)',
            color: 'var(--color-text-secondary)',
            textDecoration: 'none',
            transition: 'all var(--transition-normal)',
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
          {SOCIAL_ICONS[profile.type]}
        </a>
      ))}
    </div>
  );
}

// ─── Contact panel ───────────────────────────────────────────────────

interface ContactPanelProps {
  senderEmail: string | null;
  senderName: string | null;
}

export function ContactPanel({ senderEmail, senderName }: ContactPanelProps) {
  const { data, isLoading } = useContactByEmail(senderEmail);
  const { openCompose } = useEmailStore();
  const [copied, setCopied] = useState(false);
  const enrichContact = useEnrichContact();
  const enrichAttemptedRef = useRef<string | null>(null);

  // Trigger lazy enrichment when contact panel loads for a new email
  useEffect(() => {
    if (!senderEmail || isLoading || !data) return;
    if (enrichAttemptedRef.current === senderEmail) return;
    // Skip if already enriched recently (within 30 days)
    if (data.contact?.enrichedAt) {
      const daysSince = (Date.now() - new Date(data.contact.enrichedAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < 30) return;
    }
    enrichAttemptedRef.current = senderEmail;
    enrichContact.mutate(senderEmail);
  }, [senderEmail, isLoading, data]);

  const handleCopyEmail = useCallback(() => {
    if (!senderEmail) return;
    navigator.clipboard.writeText(senderEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [senderEmail]);

  const handleComposeNew = useCallback(() => {
    if (!senderEmail) return;
    openCompose('new', undefined, senderEmail);
  }, [senderEmail, openCompose]);

  if (!senderEmail) return null;

  const contact = data?.contact;
  const recentThreads = data?.recentThreads || [];
  const sharedAttachments = data?.sharedAttachments || [];
  const stats = data?.stats || { totalEmails: 0, fromThem: 0, fromYou: 0, firstEmailDate: null, lastEmailDate: null };
  const displayName = contact?.name || senderName || senderEmail;
  const allEmails = contact?.emails?.length ? contact.emails : [senderEmail];

  return (
    <div
      style={{
        width: 260,
        flexShrink: 0,
        borderLeft: '1px solid var(--color-border-primary)',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: 'var(--color-bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'var(--font-family)',
      }}
    >
      {/* Loading */}
      {isLoading && (
        <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
          Loading...
        </div>
      )}

      {!isLoading && (
        <>
          {/* ── Avatar + name header ── */}
          <div
            style={{
              padding: 'var(--spacing-lg)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--spacing-sm)',
            }}
          >
            <Avatar src={contact?.photoUrl} name={displayName} email={senderEmail} size={56} />
            <div style={{ textAlign: 'center', minWidth: 0, width: '100%' }}>
              <div
                style={{
                  fontSize: 'var(--font-size-md)',
                  fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                  color: 'var(--color-text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {displayName}
              </div>
              {contact?.jobTitle && contact?.organization ? (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {contact.jobTitle} at {contact.organization}
                </div>
              ) : contact?.jobTitle ? (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  {contact.jobTitle}
                </div>
              ) : contact?.organization ? (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  {contact.organization}
                </div>
              ) : null}
            </div>

            {/* Quick actions */}
            <div style={{ display: 'flex', gap: 'var(--spacing-xs)', width: '100%', marginTop: 'var(--spacing-xs)' }}>
              <IconButton
                icon={<MailPlus size={14} />}
                label="Email"
                onClick={handleComposeNew}
              />
              <IconButton
                icon={copied ? <Check size={14} /> : <Copy size={14} />}
                label={copied ? 'Copied' : 'Copy'}
                onClick={handleCopyEmail}
              />
            </div>
          </div>

          {/* ── Contact details ── */}
          <div style={{ padding: 'var(--spacing-sm) var(--spacing-lg)', borderTop: '1px solid var(--color-border-primary)' }}>
            <SectionHeader>Contact</SectionHeader>
            {allEmails.map((em) => (
              <DetailRow key={em} icon={<Mail size={13} />} label={em} href={`mailto:${em}`} />
            ))}
            {contact?.phoneNumbers?.map((phone, i) => (
              <DetailRow key={i} icon={<Phone size={13} />} label={phone} href={`tel:${phone}`} />
            ))}
            {contact?.organization && !contact?.jobTitle && (
              <DetailRow icon={<Building2 size={13} />} label={contact.organization} />
            )}
            {/* Social links */}
            {contact?.socialProfiles && contact.socialProfiles.length > 0 && (
              <div style={{ marginTop: 'var(--spacing-xs)' }}>
                <SocialLinks profiles={contact.socialProfiles} />
              </div>
            )}
          </div>

          {/* ── Interaction stats ── */}
          {stats.totalEmails > 0 && (
            <div style={{ padding: 'var(--spacing-sm) var(--spacing-lg)', borderTop: '1px solid var(--color-border-primary)' }}>
              <SectionHeader>Activity</SectionHeader>
              <StatsSection stats={stats} />
            </div>
          )}

          {/* ── Notes ── */}
          <div style={{ padding: 'var(--spacing-sm) var(--spacing-lg)', borderTop: '1px solid var(--color-border-primary)' }}>
            <SectionHeader>Notes</SectionHeader>
            <NotesEditor email={senderEmail} initialNotes={contact?.notes || ''} />
          </div>

          {/* ── Recent conversations ── */}
          {recentThreads.length > 0 && (
            <div style={{ padding: 'var(--spacing-sm) var(--spacing-lg)', borderTop: '1px solid var(--color-border-primary)' }}>
              <SectionHeader>Conversations</SectionHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {recentThreads.map((thread) => (
                  <ThreadLink key={thread.id} thread={thread} />
                ))}
              </div>
            </div>
          )}

          {/* ── Shared attachments ── */}
          {sharedAttachments.length > 0 && (
            <div style={{ padding: 'var(--spacing-sm) var(--spacing-lg)', borderTop: '1px solid var(--color-border-primary)' }}>
              <SectionHeader>Shared files</SectionHeader>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {sharedAttachments.map((att) => (
                  <AttachmentRow key={att.id} attachment={att} />
                ))}
              </div>
            </div>
          )}

          {/* ── Not in contacts hint ── */}
          {!contact && (
            <div style={{ padding: 'var(--spacing-sm) var(--spacing-lg)', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textAlign: 'center' }}>
              Not in your contacts
            </div>
          )}
        </>
      )}
    </div>
  );
}
