import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';

interface TaskNotesEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

function normalizeContent(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  // If it doesn't start with an HTML tag, treat as plain text
  if (trimmed && !trimmed.startsWith('<')) {
    return `<p>${trimmed.replace(/\n/g, '</p><p>')}</p>`;
  }
  return trimmed;
}

export function TaskNotesEditor({ content, onChange, placeholder }: TaskNotesEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      TiptapLink.configure({
        openOnClick: false,
        autolink: true,
      }),
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: normalizeContent(content),
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      // Don't fire for empty editor
      const isEmpty = html === '<p></p>' || html === '';
      onChangeRef.current(isEmpty ? '' : html);
    },
    editorProps: {
      attributes: {
        class: 'task-notes-editor',
      },
    },
  });

  // Update content when task changes (different task selected)
  const contentRef = useRef(content);
  useEffect(() => {
    if (!editor) return;
    const normalized = normalizeContent(content);
    if (content !== contentRef.current) {
      contentRef.current = content;
      const currentHtml = editor.getHTML();
      if (currentHtml !== normalized) {
        editor.commands.setContent(normalized, false);
      }
    }
  }, [content, editor]);

  return <EditorContent editor={editor} />;
}
