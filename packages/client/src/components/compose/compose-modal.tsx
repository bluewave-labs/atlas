import * as Dialog from '@radix-ui/react-dialog';
import { useRef, useState, useCallback, useEffect, forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import {
  X, Minus, Maximize2, Send, ChevronDown,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Link as LinkIcon, Code, Paperclip,
  Eye, EyeOff, Type, Highlighter, Clock,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { useEmailStore } from '../../stores/email-store';
import { useAuthStore } from '../../stores/auth-store';
import { useDraftStore } from '../../stores/draft-store';
import { useSettingsStore } from '../../stores/settings-store';
import { useThread, useSendEmail, useScheduleSend } from '../../hooks/use-threads';
import { useToastStore } from '../../stores/toast-store';
import { Button } from '../ui/button';
import { ConfirmDialog } from '../ui/confirm-dialog';
import { RecipientInput } from './recipient-input';
import { SendLaterPopover } from './send-later-popover';
import { ColorPickerPopover } from './color-picker-popover';
import { formatBytes } from '../../lib/format';
import { bodyMentionsAttachments } from '../../lib/attachment-check';
import { injectComposeTransition } from '../../lib/animations';
import { formatFullDate } from '@atlasmail/shared';
import type { Email, EmailAddress } from '@atlasmail/shared';
import type { Recipient } from '../../lib/mock-contacts';
import type { CSSProperties } from 'react';
import type { Editor } from '@tiptap/react';

injectComposeTransition();

// ─── Compose helpers ──────────────────────────────────────────────────

function addSubjectPrefix(subject: string | null, prefix: 'Re' | 'Fwd'): string {
  const s = subject || '';
  const cleaned = s.replace(/^((Re|Fwd):\s*)+/i, '');
  return `${prefix}: ${cleaned}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function formatAddr(email: Email): string {
  const name = escapeHtml(email.fromName || '');
  const addr = escapeHtml(email.fromAddress);
  return name ? `${name} &lt;${addr}&gt;` : addr;
}

function formatAddressList(addresses: EmailAddress[]): string {
  return addresses.map((a) => {
    const name = escapeHtml(a.name || '');
    const addr = escapeHtml(a.address);
    return name ? `${name} &lt;${addr}&gt;` : addr;
  }).join(', ');
}

function sanitizeBodyHtml(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}

function buildQuotedBody(email: Email): string {
  const date = formatFullDate(email.receivedAt || email.internalDate);
  const from = formatAddr(email);
  const attribution = `<p class="gmail_attr">On ${date}, ${from} wrote:</p>`;
  const quotedContent = email.bodyHtml
    ? sanitizeBodyHtml(email.bodyHtml)
    : escapeHtml(email.bodyText || '');

  return `<p></p><blockquote>${attribution}${quotedContent}</blockquote>`;
}

function buildForwardBody(email: Email): string {
  const date = formatFullDate(email.receivedAt || email.internalDate);
  const from = formatAddr(email);
  const to = formatAddressList(email.toAddresses);

  const header =
    `<p>---------- Forwarded message ---------</p>` +
    `<p>From: ${from}<br>` +
    `Date: ${date}<br>` +
    `Subject: ${email.subject || '(no subject)'}<br>` +
    `To: ${to}</p>`;

  const forwardedContent = email.bodyHtml
    ? sanitizeBodyHtml(email.bodyHtml)
    : escapeHtml(email.bodyText || '');

  return `<p></p><blockquote>${header}${forwardedContent}</blockquote>`;
}

// Convert a plain email address string into a Recipient object
function addressToRecipient(address: string, name?: string): Recipient {
  return name ? { name, address } : { address };
}

// ─── Format toolbar ───────────────────────────────────────────────────

const ToolbarButton = forwardRef<
  HTMLButtonElement,
  {
    icon: React.ReactNode;
    label: string;
    isActive?: boolean;
    onClick?: () => void;
  }
>(function ToolbarButton({ icon, label, isActive, onClick, ...rest }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={isActive}
      {...rest}
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
        transition: 'background var(--transition-normal), color var(--transition-normal)',
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
});

function LinkPopover({
  isOpen,
  onSubmit,
  onCancel,
}: {
  isOpen: boolean;
  onSubmit: (url: string) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setUrl('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-xs)',
        padding: 'var(--spacing-xs) var(--spacing-sm)',
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        zIndex: 100,
        whiteSpace: 'nowrap',
      }}
    >
      <input
        ref={inputRef}
        type="url"
        placeholder={t('compose.urlPlaceholder')}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && url.trim()) {
            e.preventDefault();
            onSubmit(url.trim());
          }
        }}
        style={{
          width: 220,
          height: 28,
          padding: '0 var(--spacing-sm)',
          border: '1px solid var(--color-border-primary)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'var(--font-family)',
          background: 'var(--color-bg-primary)',
          color: 'var(--color-text-primary)',
          outline: 'none',
        }}
      />
      <button
        onClick={() => url.trim() && onSubmit(url.trim())}
        disabled={!url.trim()}
        style={{
          height: 28,
          padding: '0 var(--spacing-sm)',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          background: url.trim() ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
          color: url.trim() ? '#ffffff' : 'var(--color-text-tertiary)',
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'var(--font-family)',
          cursor: url.trim() ? 'pointer' : 'default',
          transition: 'background var(--transition-normal)',
        }}
      >
        {t('common.apply')}
      </button>
      <button
        onClick={onCancel}
        style={{
          height: 28,
          padding: '0 var(--spacing-xs)',
          border: 'none',
          borderRadius: 'var(--radius-sm)',
          background: 'transparent',
          color: 'var(--color-text-tertiary)',
          fontSize: 'var(--font-size-sm)',
          cursor: 'pointer',
        }}
      >
        {t('common.cancel')}
      </button>
    </div>
  );
}

function FormatToolbar({ editor }: { editor: Editor | null }) {
  const { t } = useTranslation();
  const [showLinkPopover, setShowLinkPopover] = useState(false);

  if (!editor) return null;

  const handleLinkToggle = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    setShowLinkPopover(true);
  };

  const handleLinkSubmit = (url: string) => {
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    setShowLinkPopover(false);
  };

  const handleLinkCancel = () => {
    setShowLinkPopover(false);
    editor.chain().focus().run();
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
        label={t('compose.bold')}
        isActive={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={<Italic size={14} />}
        label={t('compose.italic')}
        isActive={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={<UnderlineIcon size={14} />}
        label={t('compose.underline')}
        isActive={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      />
      <ToolbarButton
        icon={<Strikethrough size={14} />}
        label={t('compose.strikethrough')}
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
        label={t('compose.bulletList')}
        isActive={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={<ListOrdered size={14} />}
        label={t('compose.orderedList')}
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

      <div style={{ position: 'relative', display: 'inline-flex' }}>
        <ToolbarButton
          icon={<LinkIcon size={14} />}
          label={t('compose.insertLink')}
          isActive={editor.isActive('link')}
          onClick={handleLinkToggle}
        />
        <LinkPopover
          isOpen={showLinkPopover}
          onSubmit={handleLinkSubmit}
          onCancel={handleLinkCancel}
        />
      </div>
      <ToolbarButton
        icon={<Code size={14} />}
        label={t('compose.inlineCode')}
        isActive={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
      />

      <div
        style={{
          width: 1,
          height: 16,
          background: 'var(--color-border-primary)',
          margin: '0 var(--spacing-xs)',
        }}
      />

      <ColorPickerPopover mode="text" editor={editor}>
        <ToolbarButton
          icon={<Type size={14} />}
          label={t('compose.textColor')}
          isActive={!!editor.getAttributes('textStyle').color}
        />
      </ColorPickerPopover>

      <ColorPickerPopover mode="highlight" editor={editor}>
        <ToolbarButton
          icon={<Highlighter size={14} />}
          label={t('compose.highlightColor')}
          isActive={editor.isActive('highlight')}
        />
      </ColorPickerPopover>
    </div>
  );
}

// ─── Draft saved indicator ────────────────────────────────────────────

function DraftSavedBadge({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      aria-live="polite"
      style={{
        fontSize: 'var(--font-size-xs)',
        color: 'var(--color-text-tertiary)',
        fontFamily: 'var(--font-family)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 400ms ease',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {t('compose.draftSaved')}
    </span>
  );
}

// ─── Compose modal ────────────────────────────────────────────────────

export function ComposeModal() {
  const { t } = useTranslation();
  const { composeMode, composeThreadId, composeInitialTo, closeCompose } = useEmailStore();
  const account = useAuthStore((s) => s.account);
  const { saveDraft, updateDraft, deleteDraft, setActiveDraftId } = useDraftStore();
  const sendEmail = useSendEmail();
  const scheduleSend = useScheduleSend();
  const addToast = useToastStore((s) => s.addToast);
  const isOpen = composeMode !== null;

  const { data: thread } = useThread(composeThreadId);

  const [toRecipients, setToRecipients] = useState<Recipient[]>([]);
  const [ccRecipients, setCcRecipients] = useState<Recipient[]>([]);
  const [bccRecipients, setBccRecipients] = useState<Recipient[]>([]);
  const [subject, setSubject] = useState('');
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [draftSavedVisible, setDraftSavedVisible] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showAttachmentReminder, setShowAttachmentReminder] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const globalTrackingEnabled = useSettingsStore((s) => s.trackingEnabled);
  const [trackingEnabled, setTrackingEnabled] = useState(globalTrackingEnabled);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSavedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks whether we have created a draft entry for this compose session
  const draftIdRef = useRef<string | null>(null);

  // We use a ref to hold the pending content so the editor can pick it up once ready
  const pendingContentRef = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
      }),
      Underline,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      TextStyle as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Color as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (Highlight as any).configure({ multicolor: true }),
      TiptapLink.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: {
          style: 'color: var(--color-text-link); text-decoration: underline;',
        },
      }),
      Placeholder.configure({
        placeholder: t('compose.writeEmail'),
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
          'min-height: 240px',
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

  // ─── Auto-save logic ──────────────────────────────────────────────

  const showDraftSavedIndicator = useCallback(() => {
    setDraftSavedVisible(true);
    if (draftSavedTimerRef.current) clearTimeout(draftSavedTimerRef.current);
    draftSavedTimerRef.current = setTimeout(() => setDraftSavedVisible(false), 2000);
  }, []);

  const persistDraft = useCallback(() => {
    if (!composeMode) return;
    const bodyHtml = editor?.getHTML() ?? '';
    const draftData = {
      composeMode,
      threadId: composeThreadId,
      toRecipients,
      ccRecipients,
      bccRecipients,
      subject,
      bodyHtml,
    };

    if (draftIdRef.current) {
      updateDraft(draftIdRef.current, draftData);
    } else {
      const id = saveDraft(draftData);
      draftIdRef.current = id;
      setActiveDraftId(id);
    }
    showDraftSavedIndicator();
  }, [
    composeMode,
    composeThreadId,
    toRecipients,
    ccRecipients,
    bccRecipients,
    subject,
    editor,
    updateDraft,
    saveDraft,
    setActiveDraftId,
    showDraftSavedIndicator,
  ]);

  // Schedule a debounced auto-save whenever recipient/subject state changes
  useEffect(() => {
    if (!isOpen) return;
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(persistDraft, 3000);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
    // persistDraft is stable thanks to useCallback — excluding it to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, toRecipients, ccRecipients, bccRecipients, subject]);

  // Also debounce auto-save on editor content changes
  useEffect(() => {
    if (!editor || !isOpen) return;
    const handler = () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(persistDraft, 3000);
    };
    editor.on('update', handler);
    return () => {
      editor.off('update', handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, isOpen]);

  // ─── Prefill fields when compose opens with a thread context ──────
  // editor is intentionally excluded from deps — we use pendingContentRef for the async case
  useEffect(() => {
    if (!composeMode || composeMode === 'new' || !thread?.emails?.length) {
      return;
    }

    // Reset all fields before repopulating
    setToRecipients([]);
    setCcRecipients([]);
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
        setToRecipients([addressToRecipient(replyAddr, lastEmail.fromName ?? undefined)]);
      }
      setSubject(addSubjectPrefix(thread.subject, 'Re'));
      applyBody(buildQuotedBody(lastEmail));
    }

    if (composeMode === 'reply_all') {
      const replyAddr = lastEmail.replyTo || lastEmail.fromAddress;
      if (replyAddr !== myEmail) {
        setToRecipients([addressToRecipient(replyAddr, lastEmail.fromName ?? undefined)]);
      }

      const allRecipients = [...lastEmail.toAddresses, ...lastEmail.ccAddresses].filter(
        (a) => a.address !== myEmail && a.address !== replyAddr,
      );

      if (allRecipients.length > 0) {
        setCcRecipients(allRecipients.map((a) => addressToRecipient(a.address, a.name ?? undefined)));
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

  // ─── Prefill To field when composing from contact panel ──────────
  useEffect(() => {
    if (composeMode === 'new' && composeInitialTo && isOpen) {
      setToRecipients([{ address: composeInitialTo }]);
    }
  }, [composeMode, composeInitialTo, isOpen]);

  // ─── Close / send ─────────────────────────────────────────────────

  const handleClose = useCallback(() => {
    // Cancel any pending auto-save timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    // Keep the draft in the store — the user can resume later
    setActiveDraftId(null);
    draftIdRef.current = null;

    closeCompose();
    setToRecipients([]);
    setCcRecipients([]);
    setBccRecipients([]);
    setSubject('');
    setShowCcBcc(false);
    setAttachments([]);
    setDragActive(false);
    setDraftSavedVisible(false);
    pendingContentRef.current = null;
    editor?.commands.clearContent();
  }, [closeCompose, editor, setActiveDraftId]);

  const doSend = useCallback(() => {
    const bodyHtml = editor?.getHTML() ?? '';
    const to = toRecipients.map((r) => r.address);
    const cc = ccRecipients.length > 0 ? ccRecipients.map((r) => r.address) : undefined;
    const bcc = bccRecipients.length > 0 ? bccRecipients.map((r) => r.address) : undefined;

    if (to.length === 0) return;

    // Capture the draft id before closing so the onSuccess callback can clean it
    // up even after draftIdRef is cleared by handleClose.
    const draftId = draftIdRef.current;

    sendEmail.mutate(
      {
        to,
        cc,
        bcc,
        subject,
        bodyHtml,
        threadId: composeThreadId ?? undefined,
        trackingEnabled,
      },
      {
        onSuccess: () => {
          // Delete the draft only after the send has been confirmed, so the
          // user still has it available if the network request fails.
          if (draftId) {
            deleteDraft(draftId);
          }
        },
      },
    );

    handleClose();

    // Trigger the paper plane send animation
    document.dispatchEvent(new CustomEvent('atlasmail:email_sent'));
    // Use sendEmail.mutate (stable function ref) rather than the entire
    // sendEmail mutation object to avoid a dep that changes every render.
  }, [handleClose, deleteDraft, sendEmail.mutate, editor, toRecipients, ccRecipients, bccRecipients, subject, composeThreadId, trackingEnabled]);

  const handleSend = useCallback(() => {
    const bodyText = editor?.getText() ?? '';
    if (attachments.length === 0 && bodyMentionsAttachments(bodyText)) {
      setShowAttachmentReminder(true);
      return;
    }
    doSend();
  }, [editor, attachments.length, doSend]);

  const handleScheduleSend = useCallback(
    (date: Date) => {
      const bodyHtml = editor?.getHTML() ?? '';
      const to = toRecipients.map((r) => r.address);
      const cc = ccRecipients.length > 0 ? ccRecipients.map((r) => r.address) : undefined;
      const bcc = bccRecipients.length > 0 ? bccRecipients.map((r) => r.address) : undefined;
      if (to.length === 0) return;
      const draftId = draftIdRef.current;
      scheduleSend.mutate(
        {
          to,
          cc,
          bcc,
          subject,
          bodyHtml,
          threadId: composeThreadId ?? undefined,
          trackingEnabled,
          scheduledFor: date.toISOString(),
        },
        {
          onSuccess: () => {
            if (draftId) deleteDraft(draftId);
            addToast({
              type: 'success',
              message: `${t('compose.emailScheduled')} — ${date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`,
              duration: 4000,
            });
          },
        },
      );
      handleClose();
    },
    [editor, toRecipients, ccRecipients, bccRecipients, subject, composeThreadId, trackingEnabled, scheduleSend, handleClose, deleteDraft, addToast, t],
  );

  // Reset the draft tracking ref whenever the modal opens fresh
  useEffect(() => {
    if (isOpen) {
      draftIdRef.current = null;
    }
  }, [isOpen]);

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

  // For 'new' mode: focus the To field after the dialog animation settles
  const toInputFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (composeMode === 'new' && isOpen) {
      toInputFocusTimerRef.current = setTimeout(() => {
        const toInput = document.querySelector<HTMLInputElement>('[data-compose-field="to"] input');
        toInput?.focus();
      }, 100);
    }
    return () => {
      if (toInputFocusTimerRef.current) clearTimeout(toInputFocusTimerRef.current);
    };
  }, [composeMode, isOpen]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      if (draftSavedTimerRef.current) clearTimeout(draftSavedTimerRef.current);
      if (toInputFocusTimerRef.current) clearTimeout(toInputFocusTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── File attachment handlers ─────────────────────────────────────

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
        return t('compose.reply');
      case 'reply_all':
        return t('compose.replyAll');
      case 'forward':
        return t('compose.forward');
      default:
        return t('compose.newMessage');
    }
  };

  function handleOpenChange(next: boolean) {
    if (!next) {
      const hasContent =
        (editor?.getText().trim().length ?? 0) > 0 ||
        toRecipients.length > 0 ||
        subject.trim().length > 0;

      if (hasContent) {
        setShowDiscardConfirm(true);
        return;
      }
      handleClose();
    }
  }

  function handleConfirmDiscard() {
    setShowDiscardConfirm(false);
    handleClose();
  }

  function handleCancelDiscard() {
    setShowDiscardConfirm(false);
  }

  return (
    <>
    <Dialog.Root
      open={isOpen}
      onOpenChange={handleOpenChange}
    >
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--color-bg-overlay)',
            zIndex: 50,
            animation: 'atlasmail-compose-overlay-enter 200ms ease',
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            bottom: isMaximized ? 0 : 'var(--spacing-xl)',
            right: isMaximized ? 0 : 'var(--spacing-xl)',
            left: isMaximized ? 0 : undefined,
            top: isMaximized ? 0 : undefined,
            width: isMaximized ? '100%' : isMinimized ? 320 : 780,
            maxHeight: isMaximized ? '100%' : isMinimized ? 'auto' : '85vh',
            background: 'var(--color-bg-elevated)',
            border: isMaximized ? 'none' : '1px solid var(--color-border-primary)',
            borderRadius: isMaximized ? 0 : 'var(--radius-xl)',
            boxShadow: isMaximized ? 'none' : 'var(--shadow-elevated)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 51,
            fontFamily: 'var(--font-family)',
            transition: 'width var(--transition-normal), max-height var(--transition-normal), bottom var(--transition-normal), right var(--transition-normal), border-radius var(--transition-normal)',
            animation: 'atlasmail-compose-enter 280ms cubic-bezier(0.16, 1, 0.3, 1)',
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
              <button
                aria-label={isMinimized ? t('compose.restore') : t('compose.minimize')}
                onClick={() => { setIsMinimized(!isMinimized); setIsMaximized(false); }}
                style={windowControlStyle}
              >
                <Minus size={13} />
              </button>
              <button
                aria-label={isMaximized ? t('compose.restore') : t('common.expand')}
                onClick={() => { setIsMaximized(!isMaximized); setIsMinimized(false); }}
                style={windowControlStyle}
              >
                <Maximize2 size={13} />
              </button>
              <button aria-label={t('compose.closeAndDiscard')} onClick={handleClose} style={windowControlStyle}>
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Body — hidden when minimized */}
          {!isMinimized && <>
          {/* Recipient fields */}
          <div style={{ flexShrink: 0 }}>
            <div style={{ position: 'relative' }} data-compose-field="to">
              <RecipientInput
                label={t('common.to')}
                recipients={toRecipients}
                onChange={setToRecipients}
                placeholder={t('compose.recipients')}
              />
              <button
                onClick={() => setShowCcBcc(!showCcBcc)}
                aria-label="Toggle CC and BCC fields"
                style={{
                  position: 'absolute',
                  right: 'var(--spacing-lg)',
                  top: 10,
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
                {t('compose.ccBcc')} <ChevronDown size={12} />
              </button>
            </div>
            {showCcBcc && (
              <>
                <RecipientInput
                  label={t('common.cc')}
                  recipients={ccRecipients}
                  onChange={setCcRecipients}
                  placeholder={t('compose.ccRecipients')}
                />
                <RecipientInput
                  label={t('common.bcc')}
                  recipients={bccRecipients}
                  onChange={setBccRecipients}
                  placeholder={t('compose.bccRecipients')}
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
                placeholder={t('compose.subject')}
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
              padding: '20px var(--spacing-lg) var(--spacing-lg)',
              overflowY: 'auto',
              cursor: 'text',
              position: 'relative',
              border: dragActive ? '2px dashed var(--color-accent-primary)' : '2px dashed transparent',
              borderRadius: 'var(--radius-md)',
              transition: 'border-color var(--transition-normal)',
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
                {t('compose.dropFilesToAttach')}
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
                {t('common.send')}
              </Button>

              <SendLaterPopover onSchedule={handleScheduleSend}>
                <button
                  aria-label={t('compose.sendLater')}
                  title={t('compose.sendLater')}
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
                    transition: 'background var(--transition-normal), color var(--transition-normal)',
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
                  <Clock size={16} />
                </button>
              </SendLaterPopover>

              <button
                onClick={() => fileInputRef.current?.click()}
                aria-label={t('compose.attachFiles')}
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
                  transition: 'background var(--transition-normal), color var(--transition-normal)',
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

              <button
                onClick={() => setTrackingEnabled((v) => !v)}
                aria-label={trackingEnabled ? t('compose.disableReadReceipts') : t('compose.enableReadReceipts')}
                title={trackingEnabled ? t('compose.readReceiptsOn') : t('compose.readReceiptsOff')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 34,
                  height: 34,
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  background: 'transparent',
                  color: trackingEnabled ? 'var(--color-accent-primary)' : 'var(--color-text-tertiary)',
                  cursor: 'pointer',
                  transition: 'background var(--transition-normal), color var(--transition-normal)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--color-surface-hover)';
                  if (!trackingEnabled) e.currentTarget.style.color = 'var(--color-text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  if (!trackingEnabled) e.currentTarget.style.color = 'var(--color-text-tertiary)';
                }}
              >
                {trackingEnabled ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />

              {/* Attachment summary badge */}
              {attachments.length > 0 && (
                <span
                  style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-tertiary)',
                    fontFamily: 'var(--font-family)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t('common.file', { count: attachments.length })} ({formatBytes(attachments.reduce((sum, f) => sum + f.size, 0))})
                </span>
              )}

              {/* Draft saved indicator */}
              <DraftSavedBadge visible={draftSavedVisible} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                {t('compose.sendWith')}
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
          </>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>

      {/* Attachment reminder dialog */}
      <ConfirmDialog
        open={showAttachmentReminder}
        onOpenChange={setShowAttachmentReminder}
        title={t('compose.forgotAttachment')}
        description={t('compose.forgotAttachmentDescription')}
        confirmLabel={t('compose.sendAnyway')}
        destructive={false}
        onConfirm={doSend}
      />

      {/* Discard confirmation modal */}
      <ConfirmDialog
        open={showDiscardConfirm}
        onOpenChange={(open) => { if (!open) handleCancelDiscard(); }}
        title={t('compose.discardDraft')}
        description={t('compose.unsavedChanges')}
        confirmLabel={t('common.discard')}
        cancelLabel={t('compose.keepEditing')}
        destructive
        onConfirm={handleConfirmDiscard}
      />
    </>
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
  transition: 'background var(--transition-normal)',
};
