import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pin, PinOff, Trash2, Save } from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TiptapLink from '@tiptap/extension-link';
import {
  useNotes, useCreateNote, useUpdateNote, useDeleteNote,
  type CrmNote,
} from '../hooks';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { IconButton } from '../../../components/ui/icon-button';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ─── Tiptap note editor ─────────────────────────────────────────

function NoteEditor({
  note,
  onSave,
  onCancel,
  isSaving,
}: {
  note?: CrmNote;
  onSave: (title: string, content: Record<string, unknown>) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const { t } = useTranslation();
  const editorContainerRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TiptapLink.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: t('crm.notes.placeholder') }),
    ],
    content: note?.content && Object.keys(note.content).length > 0 ? note.content : '',
    editorProps: {
      attributes: {
        class: 'crm-note-tiptap-editor',
        style: 'min-height: 100px; outline: none; padding: 8px 12px; font-size: 13px; line-height: 1.5;',
      },
    },
  });

  useEffect(() => {
    if (!note && editor) editor.commands.focus();
  }, [note, editor]);

  const handleSave = useCallback(() => {
    if (!editor) return;
    const content = editor.getJSON();
    onSave('', content as Record<string, unknown>);
  }, [editor, onSave]);

  return (
    <div style={{
      border: '1px solid var(--color-border-primary)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
      background: 'var(--color-bg-primary)',
    }}>
      <EditorContent editor={editor} />
      <div style={{
        display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)',
        padding: 'var(--spacing-sm)', borderTop: '1px solid var(--color-border-secondary)',
      }}>
        <Button variant="secondary" size="sm" onClick={onCancel}>{t('common.cancel')}</Button>
        <Button variant="primary" size="sm" onClick={handleSave} disabled={isSaving}>
          <Save size={13} style={{ marginRight: 4 }} />
          {isSaving ? t('common.loading') : t('common.save')}
        </Button>
      </div>
    </div>
  );
}

// ─── Single note card ───────────────────────────────────────────

function NoteCard({ note }: { note: CrmNote }) {
  const { t } = useTranslation();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <NoteEditor
        note={note}
        onSave={(title, content) => {
          updateNote.mutate({ id: note.id, title, content }, {
            onSuccess: () => setIsEditing(false),
          });
        }}
        onCancel={() => setIsEditing(false)}
        isSaving={updateNote.isPending}
      />
    );
  }

  // Extract plain text from content for display
  const textContent = extractText(note.content);

  return (
    <div
      className="crm-note-card"
      onClick={() => setIsEditing(true)}
      role="button"
      tabIndex={0}
      aria-label={t('crm.notes.title') + ': ' + (note.title || extractText(note.content).slice(0, 50))}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsEditing(true); } }}
      style={{
        padding: 'var(--spacing-md)',
        border: '1px solid var(--color-border-secondary)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        background: note.isPinned ? 'var(--color-bg-secondary)' : 'var(--color-bg-primary)',
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-surface-hover)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = note.isPinned ? 'var(--color-bg-secondary)' : 'var(--color-bg-primary)')}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {textContent || t('crm.notes.noNotes')}
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', marginTop: 4 }}>
            {timeAgo(note.updatedAt)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2, marginLeft: 'var(--spacing-sm)' }} onClick={(e) => e.stopPropagation()}>
          <IconButton
            icon={note.isPinned ? <PinOff size={12} /> : <Pin size={12} />}
            label={note.isPinned ? t('crm.notes.unpin') : t('crm.notes.pin')}
            aria-label={note.isPinned ? t('crm.notes.unpin') : t('crm.notes.pin')}
            onClick={() => updateNote.mutate({ id: note.id, isPinned: !note.isPinned })}
          />
          <IconButton
            icon={<Trash2 size={12} />}
            label={t('crm.notes.delete')}
            aria-label={t('crm.notes.delete')}
            destructive
            onClick={() => deleteNote.mutate(note.id)}
          />
        </div>
      </div>
    </div>
  );
}

function extractText(content: Record<string, unknown>): string {
  if (!content || typeof content !== 'object') return '';
  const walk = (node: unknown): string => {
    if (!node || typeof node !== 'object') return '';
    const n = node as Record<string, unknown>;
    if (n.type === 'text' && typeof n.text === 'string') return n.text;
    if (Array.isArray(n.content)) return n.content.map(walk).join(' ');
    return '';
  };
  return walk(content).slice(0, 200);
}

// ─── Main notes section ─────────────────────────────────────────

export function NotesSection({
  dealId, contactId, companyId,
}: { dealId?: string; contactId?: string; companyId?: string }) {
  const { t } = useTranslation();
  const { data: notesData, isLoading } = useNotes({ dealId, contactId, companyId });
  const notes = notesData?.notes ?? [];
  const createNote = useCreateNote();
  const [showEditor, setShowEditor] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>
          {t('crm.notes.title')}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setShowEditor(true)}>
          <Plus size={13} style={{ marginRight: 4 }} />
          {t('crm.notes.newNote')}
        </Button>
      </div>

      {showEditor && (
        <NoteEditor
          onSave={(title, content) => {
            createNote.mutate({ title, content, dealId, contactId, companyId }, {
              onSuccess: () => setShowEditor(false),
            });
          }}
          onCancel={() => setShowEditor(false)}
          isSaving={createNote.isPending}
        />
      )}

      {isLoading ? (
        <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', padding: 'var(--spacing-md)', textAlign: 'center' }}>{t('common.loading')}</div>
      ) : notes.length === 0 && !showEditor ? (
        <div style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', padding: 'var(--spacing-md)', textAlign: 'center' }}>{t('crm.notes.noNotes')}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  );
}
