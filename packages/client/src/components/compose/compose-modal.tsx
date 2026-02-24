import * as Dialog from '@radix-ui/react-dialog';
import { useRef, useState, useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import {
  X, Minus, Maximize2, Send, ChevronDown,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Link as LinkIcon, Code, Paperclip,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { useEmailStore } from '../../stores/email-store';
import { useAuthStore } from '../../stores/auth-store';
import { useThread } from '../../hooks/use-threads';
import { Button } from '../ui/button';
import { formatBytes } from '../../lib/format';
import { formatFullDate } from '@atlasmail/shared';
import type { Email, EmailAddress } from '@atlasmail/shared';
import type { CSSProperties } from 'react';
import type { Editor } from '@tiptap/react';

// ─── Compose helpers ──────────────────────────────────────────────────

function addSubjectPrefix(subject: string | null, prefix: 'Re' | 'Fwd'): string {
  const s = subject || '';
  const cleaned = s.replace(/^((Re|Fwd):\s*)+/i, '');
  return `${prefix}: ${cleaned}`;
}

function formatAddr(email: Email): string {
  return email.fromName
    ? `${email.fromName} <${email.fromAddress}>`
    : email.fromAddress;
}

function formatAddressList(addresses: EmailAddress[]): string {
  return addresses.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(', ');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function sanitizeBodyHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

function buildQuotedBody(email: Email): string {
  const date = formatFullDate(email.receivedAt || email.internalDate);
  const from = formatAddr(email);
  const header = `<br><br><div style="border-left: 3px solid #e5e7eb; padding-left: 12px; color: #6b7280;">On ${date}, ${from} wrote:<br><br>`;

  if (email.bodyHtml) {
    return `${header}${sanitizeBodyHtml(email.bodyHtml)}</div>`;
  }

  return `${header}${escapeHtml(email.bodyText || '')}</div>`;
}

function buildForwardBody(email: Email): string {
  const date = formatFullDate(email.receivedAt || email.internalDate);
  const from = formatAddr(email);
  const to = formatAddressList(email.toAddresses);

  const header =
    `<br><br>---------- Forwarded message ---------<br>` +
    `From: ${from}<br>` +
    `Date: ${date}<br>` +
    `Subject: ${email.subject || '(no subject)'}<br>` +
    `To: ${to}<br><br>`;

  if (email.bodyHtml) {
    return `${header}${sanitizeBodyHtml(email.bodyHtml)}`;
  }

  return `${header}${escapeHtml(email.bodyText || '')}`;
}

// ─── Recipient field ──────────────────────────────────────────────────

interface ComposeField {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}

function RecipientField({ label, value, placeholder, onChange }: ComposeField) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-sm)',
        padding: 'var(--spacing-sm) var(--spacing-lg)',
        borderBottom: '1px solid var(--color-border-primary)',
      }}
    >
      <label
        style={{
          fontSize: 'var(--font-size-sm)',
          color: 'var(--color-text-tertiary)',
          fontFamily: 'var(--font-family)',
          width: 28,
          flexShrink: 0,
        }}
      >
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--color-text-primary)',
          fontSize: 'var(--font-size-md)',
          fontFamily: 'var(--font-family)',
          padding: '2px 0',
        }}
      />
    </div>
  );
}

// ─── Format toolbar ───────────────────────────────────────────────────

function ToolbarButton({
  icon,
  label,
  isActive,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  isActive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        border: 'none',
        borderRadius: 'var(--radius-sm)',
        background: isActive ? 'var(--color-surface-active)' : 'transparent',
        color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
        cursor: 'pointer',
        transition: 'background var(--transition-fast), color var(--transition-fast)',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--color-surface-hover)';
        e.currentTarget.style.color = 'var(--color-text-primary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isActive ? 'var(--color-surface-active)' : 'transparent';
        e.currentTarget.style.color = isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)';
      }}
    >
      {icon}
    </button>
  );
}

function FormatToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const handleLinkToggle = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt('Enter URL');
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        padding: 'var(--spacing-xs) var(--spacing-lg)',
        borderBottom: '1px solid var(--color-border-secondary)',
      }}
    >
      <ToolbarButton
        icon={<Bold size={14} />}
        label="Bold"
        isActive={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={<Italic size={14} />}
        label="Italic"
        isActive={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={<UnderlineIcon size={14} />}
        label="Underline"
        isActive={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolbarButton
        icon={<Strikethrough size={14} />}
        label="Strikethrough"
        isActive={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      />

      <div
        style={{
          width: 1,
          height: 16,
          background: 'var(--color-border-primary)',
          margin: '0 var(--spacing-xs)',
        }}
      />

      <ToolbarButton
        icon={<List size={14} />}
        label="Bullet list"
        isActive={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={<ListOrdered size={14} />}
        label="Ordered list"
        isActive={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />

      <div
        style={{
          width: 1,
          height: 16,
          background: 'var(--color-border-primary)',
          margin: '0 var(--spacing-xs)',
        }}
      />

      <ToolbarButton
        icon={<LinkIcon size={14} />}
        label="Insert link"
        isActive={editor.isActive('link')}
        onClick={handleLinkToggle}
      />
      <ToolbarButton
        icon={<Code size={14} />}
        label="Inline code"
        isActive={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />
    </div>
  );
}

// ─── Compose modal ────────────────────────────────────────────────────

export function ComposeModal() {
  const { composeMode, composeThreadId, closeCompose } = useEmailStore();
  const account = useAuthStore((s) => s.account);
  const isOpen = composeMode !== null;

  const { data: thread } = useThread(composeThreadId);

  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // We use a ref to hold the pending content so the editor can pick it up once ready
  const pendingContentRef = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
      }),
      Underline,
      TiptapLink.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          style: 'color: var(--color-text-link); text-decoration: underline;',
        },
      }),
      Placeholder.configure({
        placeholder: 'Write your email...',
      }),
    ],
    editorProps: {
      attributes: {
        style: [
          'outline: none',
          'color: var(--color-text-primary)',
          'font-size: var(--font-size-md)',
          'line-height: var(--line-height-normal)',
          'font-family: var(--font-family)',
          'min-height: 180px',
          'padding: 0',
        ].join('; '),
      },
    },
    content: '',
    onCreate: ({ editor: e }) => {
      // If content was queued before the editor was ready, apply it now
      if (pendingContentRef.current) {
        e.commands.setContent(pendingContentRef.current);
        e.commands.focus('start');
        pendingContentRef.current = null;
      }
    },
  });

  // Prefill fields when compose opens with a thread context
  // editor is intentionally excluded from deps — we use pendingContentRef for the async case
  useEffect(() => {
    if (!composeMode || composeMode === 'new' || !thread?.emails?.length) {
      return;
    }

    // Reset all fields before repopulating
    setTo('');
    setCc('');
    setSubject('');
    setShowCcBcc(false);

    const lastEmail = thread.emails[thread.emails.length - 1];
    const myEmail = account?.email || '';

    const applyBody = (body: string) => {
      pendingContentRef.current = body;
      if (editor) {
        editor.commands.setContent(body);
        editor.commands.focus('start');
        pendingContentRef.current = null;
      }
    };

    if (composeMode === 'reply') {
      const replyAddr = lastEmail.replyTo || lastEmail.fromAddress;
      if (replyAddr !== myEmail) {
        setTo(replyAddr);
      }
      setSubject(addSubjectPrefix(thread.subject, 'Re'));
      applyBody(buildQuotedBody(lastEmail));
    }

    if (composeMode === 'reply_all') {
      const replyAddr = lastEmail.replyTo || lastEmail.fromAddress;
      if (replyAddr !== myEmail) {
        setTo(replyAddr);
      }

      const allRecipients = [...lastEmail.toAddresses, ...lastEmail.ccAddresses].filter(
        (a) => a.address !== myEmail && a.address !== replyAddr,
      );

      if (allRecipients.length > 0) {
        setCc(formatAddressList(allRecipients));
        setShowCcBcc(true);
      }

      setSubject(addSubjectPrefix(thread.subject, 'Re'));
      applyBody(buildQuotedBody(lastEmail));
    }

    if (composeMode === 'forward') {
      setSubject(addSubjectPrefix(thread.subject, 'Fwd'));
      applyBody(buildForwardBody(lastEmail));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composeMode, thread, account?.email]);

  const handleClose = useCallback(() => {
    closeCompose();
    setTo('');
    setCc('');
    setBcc('');
    setSubject('');
    setShowCcBcc(false);
    setAttachments([]);
    setDragActive(false);
    pendingContentRef.current = null;
    editor?.commands.clearContent();
  }, [closeCompose, editor]);

  const handleSend = useCallback(() => {
    // TODO: wire up send mutation
    handleClose();
  }, [handleClose]);

  // Handle Cmd+Enter to send from anywhere in the modal
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleSend]);

  // File attachment handlers
  const handleFilesAdded = useCallback((files: FileList | File[]) => {
    setAttachments((prev) => [...prev, ...Array.from(files)]);
  }, []);

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        handleFilesAdded(e.target.files);
      }
      e.target.value = '';
    },
    [handleFilesAdded],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      if (e.dataTransfer.files?.length) {
        handleFilesAdded(e.dataTransfer.files);
      }
    },
    [handleFilesAdded],
  );

  const getTitle = () => {
    switch (composeMode) {
      case 'reply':
        return 'Reply';
      case 'reply_all':
        return 'Reply all';
      case 'forward':
        return 'Forward';
      default:
        return 'New message';
    }
  };

  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--color-bg-overlay)',
            zIndex: 50,
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            bottom: 'var(--spacing-xl)',
            right: 'var(--spacing-xl)',
            width: 560,
            maxHeight: '80vh',
            background: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-primary)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-elevated)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 51,
            fontFamily: 'var(--font-family)',
          }}
        >
          {/* Title bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--spacing-md) var(--spacing-lg)',
              background: 'var(--color-bg-tertiary)',
              borderBottom: '1px solid var(--color-border-primary)',
              flexShrink: 0,
            }}
          >
            <Dialog.Title
              style={{
                margin: 0,
                fontSize: 'var(--font-size-md)',
                fontWeight: 'var(--font-weight-semibold)' as CSSProperties['fontWeight'],
                color: 'var(--color-text-primary)',
              }}
            >
              {getTitle()}
            </Dialog.Title>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
              <button aria-label="Minimize" style={windowControlStyle}>
                <Minus size={13} />
              </button>
              <button aria-label="Expand" style={windowControlStyle}>
                <Maximize2 size={13} />
              </button>
              <button aria-label="Close and discard" onClick={handleClose} style={windowControlStyle}>
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Recipient fields */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <RecipientField label="To" value={to} onChange={setTo} placeholder="Recipients" />
              <button
                onClick={() => setShowCcBcc(!showCcBcc)}
                aria-label="Toggle CC and BCC fields"
                style={{
                  position: 'absolute',
                  right: 'var(--spacing-lg)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  fontSize: 'var(--font-size-xs)',
                  fontFamily: 'var(--font-family)',
                  padding: 'var(--spacing-xs)',
                }}
              >
                Cc/Bcc <ChevronDown size={12} />
              </button>
            </div>
            {showCcBcc && (
              <>
                <RecipientField label="Cc" value={cc} onChange={setCc} placeholder="CC recipients" />
                <RecipientField
                  label="Bcc"
                  value={bcc}
                  onChange={setBcc}
                  placeholder="BCC recipients"
                />
              </>
            )}
            <div
              style={{
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                borderBottom: '1px solid var(--color-border-primary)',
              }}
            >
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: 'var(--color-text-primary)',
                  fontSize: 'var(--font-size-md)',
                  fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                  fontFamily: 'var(--font-family)',
                  padding: '4px 0',
                }}
              />
            </div>
          </div>

          {/* Format toolbar */}
          <FormatToolbar editor={editor} />

          {/* Editor with drag-and-drop */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              flex: 1,
              padding: 'var(--spacing-lg)',
              overflowY: 'auto',
              cursor: 'text',
              position: 'relative',
              border: dragActive ? '2px dashed var(--color-accent-primary)' : '2px dashed transparent',
              borderRadius: 'var(--radius-md)',
              transition: 'border-color var(--transition-fast)',
            }}
            onClick={() => editor?.commands.focus()}
          >
            <EditorContent editor={editor} />
            {dragActive && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: 'var(--radius-md)',
                  color: '#fff',
                  fontSize: 'var(--font-size-md)',
                  fontWeight: 'var(--font-weight-medium)' as CSSProperties['fontWeight'],
                  pointerEvents: 'none',
                }}
              >
                Drop files to attach
              </div>
            )}
          </div>

          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 'var(--spacing-xs)',
                padding: 'var(--spacing-sm) var(--spacing-lg)',
                borderTop: '1px solid var(--color-border-secondary)',
              }}
            >
              {attachments.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    padding: '4px var(--spacing-sm)',
                    background: 'var(--color-bg-tertiary)',
                    border: '1px solid var(--color-border-primary)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--font-size-sm)',
                    color: 'var(--color-text-primary)',
                    maxWidth: 200,
                  }}
                >
                  <Paperclip size={12} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {file.name}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-tertiary)',
                      flexShrink: 0,
                    }}
                  >
                    {formatBytes(file.size)}
                  </span>
                  <button
                    onClick={() => handleRemoveAttachment(index)}
                    aria-label={`Remove ${file.name}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 16,
                      height: 16,
                      border: 'none',
                      borderRadius: 'var(--radius-full)',
                      background: 'transparent',
                      color: 'var(--color-text-tertiary)',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--color-surface-hover)';
                      e.currentTarget.style.color = 'var(--color-error)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = 'var(--color-text-tertiary)';
                    }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Bottom bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 'var(--spacing-sm) var(--spacing-lg)',
              borderTop: '1px solid var(--color-border-primary)',
              background: 'var(--color-bg-tertiary)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <Button variant="primary" size="md" icon={<Send size={14} />} onClick={handleSend}>
                Send
              </Button>

              <button
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach files"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 34,
                  height: 34,
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
                <Paperclip size={16} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                Send with
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '2px',
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                  fontFamily: 'var(--font-mono)',
                  background: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-primary)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '2px 6px',
                }}
              >
                Cmd+Enter
              </span>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const windowControlStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  border: 'none',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--color-text-tertiary)',
  cursor: 'pointer',
  transition: 'background var(--transition-fast)',
};
