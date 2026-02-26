import { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent, BubbleMenu, FloatingMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import Underline from '@tiptap/extension-underline';
import TiptapLink from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import { Callout } from './extensions/callout';
import { ToggleBlock, ToggleSummary } from './extensions/toggle-block';
import { PageMention } from './extensions/page-mention';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListChecks,
  Highlighter,
  Link as LinkIcon,
  Type,
  Undo2,
  Redo2,
  Palette,
  Trash2,
} from 'lucide-react';
import '../../styles/docs.css';

// ─── Lowlight instance ────────────────────────────────────────────────────────
const lowlight = createLowlight(common);

// ─── Trailing Node Extension ─────────────────────────────────────────────────
// Ensures there is always a paragraph at the end of the document so the
// user can always click past the last block to continue typing.
const TrailingNode = Extension.create({
  name: 'trailingNode',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (_transactions, _oldState, newState) => {
          const { doc, tr, schema } = newState;
          const lastNode = doc.lastChild;
          if (lastNode?.type.name !== 'paragraph' || lastNode.content.size !== 0) {
            // Only append if last node isn't an empty paragraph
            if (lastNode?.type.name !== 'paragraph') {
              const paragraph = schema.nodes.paragraph.create();
              return tr.insert(doc.content.size, paragraph);
            }
          }
          return null;
        },
      }),
    ];
  },
});

// ─── Focus Extension (custom — @tiptap/extension-focus v3 needs @tiptap/extensions peer) ───
const focusPluginKey = new PluginKey('focus');

const FocusExtension = Extension.create({
  name: 'focus',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: focusPluginKey,
        props: {
          decorations: (state) => {
            const { doc, selection } = state;
            const decorations: Decoration[] = [];
            const { $anchor, $head } = selection;
            const resolvedFrom = Math.min($anchor.pos, $head.pos);
            const resolvedEnd = Math.max($anchor.pos, $head.pos);

            doc.descendants((node, pos) => {
              if (!node.isBlock) return true;
              const from = pos;
              const to = pos + node.nodeSize;
              const isActive = resolvedFrom >= from && resolvedEnd <= to;
              if (isActive) {
                decorations.push(
                  Decoration.node(from, to, { class: 'has-focus' }),
                );
              }
              return true;
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

// ─── Types ──────────────────────────────────────────────────────────────

interface DocEditorProps {
  value: Record<string, unknown> | null;
  onChange: (value: Record<string, unknown>) => void;
  readOnly?: boolean;
  /** Flat document list used for @ mention page picker */
  documents?: Array<{ id: string; title: string; icon: string | null }>;
  /** Navigate to a document (used when clicking a page mention) */
  onNavigate?: (docId: string) => void;
}

// ─── Slash command items ────────────────────────────────────────────────

interface SlashCommandItem {
  title: string;
  description: string;
  icon: string;
  command: (editor: NonNullable<ReturnType<typeof useEditor>>) => void;
}

// Helper: read a File as a base64 data URL
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    title: 'Text',
    description: 'Plain text block',
    icon: 'Aa',
    command: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: 'H1',
    command: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'H2',
    command: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: 'Heading 3',
    description: 'Small section heading',
    icon: 'H3',
    command: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    title: 'To-do list',
    description: 'Track tasks with checkboxes',
    icon: '☑',
    command: (editor) => editor.chain().focus().toggleTaskList().run(),
  },
  {
    title: 'Bullet list',
    description: 'Unordered list',
    icon: '•',
    command: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: 'Numbered list',
    description: 'Ordered list with numbers',
    icon: '1.',
    command: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: 'Quote',
    description: 'Capture a quote',
    icon: '"',
    command: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    title: 'Divider',
    description: 'Horizontal separator',
    icon: '—',
    command: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    title: 'Code block',
    description: 'Code snippet',
    icon: '<>',
    command: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: 'Table',
    description: '3x3 table',
    icon: '▦',
    command: (editor) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: 'Image',
    description: 'Upload an image from your device',
    icon: '🖼',
    command: (editor) => {
      // Open a hidden file input to let the user pick a local image file
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const src = await readFileAsDataUrl(file);
        editor.chain().focus().setImage({ src }).run();
      };
      input.click();
    },
  },
  {
    title: 'Callout',
    description: 'Info callout block',
    icon: 'ℹ️',
    command: (editor) => editor.chain().focus().setCallout({ type: 'info' }).run(),
  },
  {
    title: 'Warning',
    description: 'Warning callout block',
    icon: '⚠️',
    command: (editor) => editor.chain().focus().setCallout({ type: 'warning' }).run(),
  },
  {
    title: 'Success',
    description: 'Success callout block',
    icon: '✅',
    command: (editor) => editor.chain().focus().setCallout({ type: 'success' }).run(),
  },
  {
    title: 'Error',
    description: 'Error callout block',
    icon: '🚫',
    command: (editor) => editor.chain().focus().setCallout({ type: 'error' }).run(),
  },
  {
    title: 'Toggle',
    description: 'Collapsible section',
    icon: '▶',
    command: (editor) => editor.chain().focus().setToggleBlock().run(),
  },
  {
    title: 'Table of contents',
    description: 'Insert a linked list of headings',
    icon: '≡',
    command: (editor) => {
      // Scan for all headings in the current document and insert a TOC
      const headings: Array<{ level: number; text: string }> = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'heading') {
          headings.push({ level: node.attrs.level as number, text: node.textContent });
        }
      });
      if (headings.length === 0) {
        // Insert a placeholder paragraph if no headings found
        editor.chain().focus().insertContent('<p><em>No headings found in this document.</em></p>').run();
        return;
      }
      // Build a bullet list from headings
      const lines = headings.map((h) => {
        const indent = '  '.repeat(h.level - 1);
        return `${indent}• ${h.text}`;
      });
      const content = lines.join('\n');
      editor.chain().focus().insertContent(`<p><strong>Table of contents</strong></p><pre><code>${content}</code></pre>`).run();
    },
  },
];

// ─── DocEditor ──────────────────────────────────────────────────────────

export function DocEditor({ value, onChange, readOnly = false, documents: docList, onNavigate }: DocEditorProps) {
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashSelectedIdx, setSlashSelectedIdx] = useState(0);
  const slashStartRef = useRef<number | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Floating menu state for the "+" button on empty lines
  const [floatingMenuOpen, setFloatingMenuOpen] = useState(false);

  // Word and character count (computed from editor text content)
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  // Drag-over state for the visual drop zone indicator.
  // A counter is used instead of a boolean so that nested dragenter/dragleave
  // events (fired when the pointer moves between child elements) cancel out
  // correctly and we never get a stuck "is-dragging-file" class.
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);

  // @ mention state
  const [mentionMenuOpen, setMentionMenuOpen] = useState(false);
  const [mentionMenuPos, setMentionMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionSelectedIdx, setMentionSelectedIdx] = useState(0);
  const mentionStartRef = useRef<number | null>(null);

  // Table toolbar state
  const [tableToolbarPos, setTableToolbarPos] = useState<{ top: number; left: number } | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        // Disable default codeBlock — replaced by CodeBlockLowlight
        codeBlock: false,
      }),
      // ── Syntax-highlighted code blocks ──
      CodeBlockLowlight.configure({ lowlight }),
      // ── Global drag handle (Notion-style) ──
      GlobalDragHandle.configure({
        dragHandleWidth: 20,
        scrollTreshold: 100,
      }),
      // ── Trailing paragraph ──
      TrailingNode,
      // ── Focus highlight ──
      FocusExtension,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TiptapLink.configure({
        openOnClick: false,
        autolink: true,
      }),
      Placeholder.configure({
        placeholder: ({ node }) => {
          if (node.type.name === 'heading') {
            const level = node.attrs.level;
            if (level === 1) return 'Heading 1';
            if (level === 2) return 'Heading 2';
            return 'Heading 3';
          }
          return "Type '/' for commands...";
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Image.configure({
        HTMLAttributes: {
          style: 'max-width: 100%; height: auto; border-radius: 6px;',
        },
      }),
      Callout,
      ToggleSummary,
      ToggleBlock,
      PageMention,
    ],
    editorProps: {
      attributes: {
        class: 'doc-editor-content',
        style: [
          'outline: none',
          'color: var(--color-text-primary)',
          'font-size: 15px',
          'line-height: 1.7',
          'font-family: var(--font-family)',
          'min-height: 300px',
          'padding: 0',
        ].join('; '),
      },
      handleKeyDown: (_view, event) => {
        // Slash command menu keyboard navigation
        if (slashMenuOpen) {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setSlashSelectedIdx((prev) => {
              const items = getFilteredCommands(slashQuery);
              return (prev + 1) % items.length;
            });
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setSlashSelectedIdx((prev) => {
              const items = getFilteredCommands(slashQuery);
              return (prev - 1 + items.length) % items.length;
            });
            return true;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            const items = getFilteredCommands(slashQuery);
            if (items[slashSelectedIdx]) {
              executeSlashCommand(items[slashSelectedIdx]);
            }
            return true;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            closeSlashMenu();
            return true;
          }
        }
        // @ mention menu keyboard navigation
        if (mentionMenuOpen) {
          const mentionItems = getFilteredMentions(mentionQuery);
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setMentionSelectedIdx((prev) => (prev + 1) % Math.max(mentionItems.length, 1));
            return true;
          }
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            setMentionSelectedIdx((prev) => (prev - 1 + mentionItems.length) % Math.max(mentionItems.length, 1));
            return true;
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            if (mentionItems[mentionSelectedIdx]) {
              executeMentionInsert(mentionItems[mentionSelectedIdx]);
            }
            return true;
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            closeMentionMenu();
            return true;
          }
        }
        return false;
      },
      // ── Image drag-and-drop ──────────────────────────────────────────
      handleDrop: (view, event, _slice, moved) => {
        // `moved` is true when the user is repositioning a node already in the
        // doc; let ProseMirror handle that case natively.
        if (!moved && event.dataTransfer?.files?.length) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
            event.preventDefault();
            readFileAsDataUrl(file).then((src) => {
              const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
              if (pos) {
                const node = view.state.schema.nodes.image.create({ src });
                const tr = view.state.tr.insert(pos.pos, node);
                view.dispatch(tr);
              }
            });
            return true;
          }
        }
        return false;
      },
      // ── Image paste from clipboard ───────────────────────────────────
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) return false;
            readFileAsDataUrl(file).then((src) => {
              const node = view.state.schema.nodes.image.create({ src });
              const tr = view.state.tr.replaceSelectionWith(node);
              view.dispatch(tr);
            });
            return true;
          }
        }
        return false;
      },
    },
    content: value?._html as string || '',
    editable: !readOnly,
    onUpdate: ({ editor: e }) => {
      onChange({ _html: e.getHTML() });

      // Update word and character counts
      const text = e.state.doc.textContent;
      setCharCount(text.length);
      setWordCount(text.trim() === '' ? 0 : text.trim().split(/\s+/).length);

      // Slash command detection
      if (!e.isActive('codeBlock')) {
        const { from } = e.state.selection;
        const textBefore = e.state.doc.textBetween(
          Math.max(0, from - 50),
          from,
          '\0',
        );
        const slashMatch = textBefore.match(/\/([a-zA-Z0-9 ]*)$/);

        if (slashMatch) {
          if (!slashMenuOpen) {
            slashStartRef.current = from - slashMatch[0].length;
          }
          setSlashQuery(slashMatch[1]);
          setSlashSelectedIdx(0);
          setSlashMenuOpen(true);
          updateSlashMenuPosition(e);
        } else if (slashMenuOpen) {
          closeSlashMenu();
        }

        // @ mention detection
        const atMatch = textBefore.match(/@([^@\n]*)$/);
        if (atMatch && docList && docList.length > 0) {
          if (!mentionMenuOpen) {
            mentionStartRef.current = from - atMatch[0].length;
          }
          setMentionQuery(atMatch[1]);
          setMentionSelectedIdx(0);
          setMentionMenuOpen(true);
          updateMentionMenuPosition(e);
        } else if (mentionMenuOpen) {
          closeMentionMenu();
        }
      }
    },
  });

  function updateSlashMenuPosition(e: NonNullable<ReturnType<typeof useEditor>>) {
    try {
      const { from } = e.state.selection;
      const coords = e.view.coordsAtPos(from);
      const containerRect = editorContainerRef.current?.getBoundingClientRect();
      if (containerRect) {
        setSlashMenuPos({
          top: coords.bottom - containerRect.top + 4,
          left: coords.left - containerRect.left,
        });
      }
    } catch {
      // Position may fail during transitions
    }
  }

  function closeSlashMenu() {
    setSlashMenuOpen(false);
    setSlashQuery('');
    setSlashSelectedIdx(0);
    slashStartRef.current = null;
  }

  function updateMentionMenuPosition(e: NonNullable<ReturnType<typeof useEditor>>) {
    try {
      const { from } = e.state.selection;
      const coords = e.view.coordsAtPos(from);
      const containerRect = editorContainerRef.current?.getBoundingClientRect();
      if (containerRect) {
        setMentionMenuPos({
          top: coords.bottom - containerRect.top + 4,
          left: coords.left - containerRect.left,
        });
      }
    } catch {
      // Position may fail during transitions
    }
  }

  function closeMentionMenu() {
    setMentionMenuOpen(false);
    setMentionQuery('');
    setMentionSelectedIdx(0);
    mentionStartRef.current = null;
  }

  function getFilteredMentions(query: string) {
    if (!docList) return [];
    if (!query) return docList.slice(0, 8);
    const q = query.toLowerCase();
    return docList.filter((d) => d.title.toLowerCase().includes(q)).slice(0, 8);
  }

  function executeMentionInsert(doc: { id: string; title: string; icon: string | null }) {
    if (!editor) return;
    if (mentionStartRef.current !== null) {
      const { from } = editor.state.selection;
      editor
        .chain()
        .focus()
        .deleteRange({ from: mentionStartRef.current, to: from })
        .insertPageMention({ id: doc.id, title: doc.title, icon: doc.icon })
        .insertContent(' ')
        .run();
    }
    closeMentionMenu();
  }

  function getFilteredCommands(query: string): SlashCommandItem[] {
    if (!query) return SLASH_COMMANDS;
    const q = query.toLowerCase();
    return SLASH_COMMANDS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q),
    );
  }

  function executeSlashCommand(item: SlashCommandItem) {
    if (!editor) return;
    // Delete the slash + query text
    if (slashStartRef.current !== null) {
      const { from } = editor.state.selection;
      editor
        .chain()
        .focus()
        .deleteRange({ from: slashStartRef.current, to: from })
        .run();
    }
    item.command(editor);
    closeSlashMenu();
  }

  // Sync readOnly
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  // Initialize word/char count when editor first mounts
  useEffect(() => {
    if (!editor) return;
    const text = editor.state.doc.textContent;
    setCharCount(text.length);
    setWordCount(text.trim() === '' ? 0 : text.trim().split(/\s+/).length);
  }, [editor]);

  // Close slash menu on click outside
  useEffect(() => {
    if (!slashMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.slash-command-menu')) {
        closeSlashMenu();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [slashMenuOpen]);

  // Close mention menu on click outside
  useEffect(() => {
    if (!mentionMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.mention-menu')) {
        closeMentionMenu();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mentionMenuOpen]);

  // Close floating menu on click outside
  useEffect(() => {
    if (!floatingMenuOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.floating-menu')) {
        setFloatingMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [floatingMenuOpen]);

  // Table toolbar: update position whenever the selection changes
  useEffect(() => {
    if (!editor) return;

    function updateTableToolbar() {
      if (!editor) return;
      if (!editor.isActive('table')) {
        setTableToolbarPos(null);
        return;
      }
      try {
        const { from } = editor.state.selection;
        const containerRect = editorContainerRef.current?.getBoundingClientRect();
        if (!containerRect) return;

        // Walk up the DOM from the cursor position to find the <table> element
        const domAtPos = editor.view.domAtPos(from);
        let node: Node | null = domAtPos.node;
        if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
        let tableEl: HTMLElement | null = null;
        while (node && node !== editor.view.dom) {
          if ((node as HTMLElement).tagName === 'TABLE') {
            tableEl = node as HTMLElement;
            break;
          }
          node = (node as HTMLElement).parentElement;
        }

        if (tableEl) {
          const tableRect = tableEl.getBoundingClientRect();
          setTableToolbarPos({
            top: tableRect.top - containerRect.top - 40,
            left: tableRect.left - containerRect.left,
          });
        }
      } catch {
        // Position may fail during transitions
      }
    }

    editor.on('selectionUpdate', updateTableToolbar);
    editor.on('transaction', updateTableToolbar);
    return () => {
      editor.off('selectionUpdate', updateTableToolbar);
      editor.off('transaction', updateTableToolbar);
    };
  }, [editor]);

  // Click handler for page mentions to navigate
  useEffect(() => {
    if (!onNavigate || !editorContainerRef.current) return;
    const handler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('.page-mention');
      if (target) {
        e.preventDefault();
        const docId = target.getAttribute('data-id');
        if (docId) onNavigate(docId);
      }
    };
    const container = editorContainerRef.current;
    container.addEventListener('click', handler);
    return () => container.removeEventListener('click', handler);
  }, [onNavigate]);

  // ── Drag-over handlers for the drop zone indicator ─────────────────────
  // We only show the indicator when the dragged item contains at least one
  // image file, so non-file drags (e.g. text selections) are ignored.
  function hasImageFile(dt: DataTransfer | null): boolean {
    if (!dt) return false;
    for (const item of dt.items) {
      if (item.kind === 'file' && item.type.startsWith('image/')) return true;
    }
    return false;
  }

  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
    if (!hasImageFile(e.dataTransfer)) return;
    dragCounterRef.current += 1;
    if (dragCounterRef.current === 1) setIsDraggingFile(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    if (!hasImageFile(e.dataTransfer)) return;
    dragCounterRef.current -= 1;
    if (dragCounterRef.current === 0) setIsDraggingFile(false);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    // Required to allow the drop event to fire
    if (hasImageFile(e.dataTransfer)) e.preventDefault();
  }

  function handleContainerDrop(e: React.DragEvent<HTMLDivElement>) {
    // Reset the counter; ProseMirror's handleDrop in editorProps does the
    // actual insertion, so we only need to clean up the visual state here.
    dragCounterRef.current = 0;
    setIsDraggingFile(false);
    // Do NOT call e.preventDefault() here — let the event bubble to ProseMirror
  }

  if (!editor) return null;

  return (
    <div
      className={`doc-editor${isDraggingFile ? ' is-dragging-file' : ''}`}
      ref={editorContainerRef}
      style={{ position: 'relative' }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleContainerDrop}
    >
      <div
        style={{
          maxWidth: 800,
          margin: '0 auto',
          width: '100%',
          padding: '32px 24px',
          fontFamily: 'var(--font-family)',
        }}
      >
        {/* Bubble menu (floating toolbar on selection) */}
        {!readOnly && (
          <BubbleMenu
            editor={editor}
            tippyOptions={{ duration: 150 }}
            shouldShow={({ editor: e, state }) => {
              const { from, to } = state.selection;
              return from !== to && !e.isActive('image');
            }}
          >
            <BubbleToolbar editor={editor} />
          </BubbleMenu>
        )}

        {/* Floating "+" menu on empty lines */}
        {!readOnly && (
          <FloatingMenu
            editor={editor}
            tippyOptions={{ duration: 100, placement: 'left-start' }}
            shouldShow={({ state }) => {
              const { $from } = state.selection;
              const isEmptyParagraph =
                $from.parent.type.name === 'paragraph' &&
                $from.parent.content.size === 0;
              return isEmptyParagraph;
            }}
          >
            <div className="floating-menu">
              <button
                className="floating-menu-btn"
                title="Add a block"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setFloatingMenuOpen((v) => !v);
                }}
              >
                +
              </button>
              {floatingMenuOpen && (
                <div className="floating-menu-popover">
                  {SLASH_COMMANDS.slice(0, 10).map((item) => (
                    <button
                      key={item.title}
                      className="slash-command-item"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        item.command(editor);
                        setFloatingMenuOpen(false);
                      }}
                    >
                      <div className="slash-command-item-icon">{item.icon}</div>
                      <div className="slash-command-item-text">
                        <div className="slash-command-item-title">{item.title}</div>
                        <div className="slash-command-item-description">{item.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </FloatingMenu>
        )}

        {/* Editor */}
        <EditorContent editor={editor} />

        {/* Slash command menu */}
        {slashMenuOpen && slashMenuPos && (
          <SlashCommandMenu
            items={getFilteredCommands(slashQuery)}
            selectedIndex={slashSelectedIdx}
            onSelect={executeSlashCommand}
            position={slashMenuPos}
          />
        )}

        {/* @ mention menu */}
        {mentionMenuOpen && mentionMenuPos && (
          <MentionMenu
            items={getFilteredMentions(mentionQuery)}
            selectedIndex={mentionSelectedIdx}
            onSelect={executeMentionInsert}
            position={mentionMenuPos}
          />
        )}

        {/* Table toolbar */}
        {!readOnly && tableToolbarPos && (
          <TableToolbar editor={editor} position={tableToolbarPos} />
        )}
      </div>

      {/* Drop zone overlay — only rendered while an image is being dragged */}
      {isDraggingFile && (
        <div className="doc-editor-drop-overlay">
          <div className="doc-editor-drop-label">Drop image to insert</div>
        </div>
      )}

      {/* Character / word count status bar */}
      {!readOnly && (
        <div className="doc-editor-status-bar">
          <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
          <span className="doc-editor-status-bar-dot">·</span>
          <span>{charCount} {charCount === 1 ? 'character' : 'characters'}</span>
        </div>
      )}
    </div>
  );
}

// ─── Table toolbar (appears when cursor is inside a table) ──────────────

function TableToolbar({
  editor,
  position,
}: {
  editor: NonNullable<ReturnType<typeof useEditor>>;
  position: { top: number; left: number };
}) {
  return (
    <div
      className="table-toolbar"
      style={{ top: position.top, left: position.left }}
      // Prevent the toolbar clicks from stealing focus from the editor
      onMouseDown={(e) => e.preventDefault()}
    >
      {/* Row controls */}
      <button
        className="table-toolbar-btn"
        title="Add row above"
        onClick={() => editor.chain().focus().addRowBefore().run()}
      >
        +Row ↑
      </button>
      <button
        className="table-toolbar-btn"
        title="Add row below"
        onClick={() => editor.chain().focus().addRowAfter().run()}
      >
        +Row ↓
      </button>
      <button
        className="table-toolbar-btn table-toolbar-btn--danger"
        title="Delete row"
        onClick={() => editor.chain().focus().deleteRow().run()}
      >
        −Row
      </button>

      <div className="table-toolbar-divider" />

      {/* Column controls */}
      <button
        className="table-toolbar-btn"
        title="Add column before"
        onClick={() => editor.chain().focus().addColumnBefore().run()}
      >
        +Col ←
      </button>
      <button
        className="table-toolbar-btn"
        title="Add column after"
        onClick={() => editor.chain().focus().addColumnAfter().run()}
      >
        +Col →
      </button>
      <button
        className="table-toolbar-btn table-toolbar-btn--danger"
        title="Delete column"
        onClick={() => editor.chain().focus().deleteColumn().run()}
      >
        −Col
      </button>

      <div className="table-toolbar-divider" />

      {/* Delete table */}
      <button
        className="table-toolbar-btn table-toolbar-btn--danger"
        title="Delete table"
        onClick={() => editor.chain().focus().deleteTable().run()}
      >
        <Trash2 size={12} />
        <span>Table</span>
      </button>
    </div>
  );
}

// ─── Bubble toolbar (floating on selection) ─────────────────────────────

// ─── Text color palette ──────────────────────────────────────────────────
const TEXT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Gray', value: '#6b7280' },
  { label: 'Brown', value: '#92400e' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Yellow', value: '#ca8a04' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Purple', value: '#9333ea' },
  { label: 'Pink', value: '#db2777' },
  { label: 'Teal', value: '#0d9488' },
  { label: 'Indigo', value: '#4f46e5' },
];

function BubbleToolbar({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorRef = useRef<HTMLDivElement>(null);

  const addLink = useCallback(() => {
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  }, [editor]);

  useEffect(() => {
    if (!showColorPicker) return;
    const handler = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showColorPicker]);

  return (
    <div className="bubble-menu">
      {/* Undo / Redo */}
      <BubbleBtn
        icon={<Undo2 size={14} />}
        active={false}
        onClick={() => editor.chain().focus().undo().run()}
        tooltip="Undo"
      />
      <BubbleBtn
        icon={<Redo2 size={14} />}
        active={false}
        onClick={() => editor.chain().focus().redo().run()}
        tooltip="Redo"
      />
      <div className="bubble-menu-divider" />
      <BubbleBtn
        icon={<Bold size={14} />}
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        tooltip="Bold"
      />
      <BubbleBtn
        icon={<Italic size={14} />}
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        tooltip="Italic"
      />
      <BubbleBtn
        icon={<UnderlineIcon size={14} />}
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        tooltip="Underline"
      />
      <BubbleBtn
        icon={<Strikethrough size={14} />}
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        tooltip="Strikethrough"
      />
      <BubbleBtn
        icon={<Code size={14} />}
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
        tooltip="Code"
      />
      <div className="bubble-menu-divider" />
      <BubbleBtn
        icon={<Highlighter size={14} />}
        active={editor.isActive('highlight')}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        tooltip="Highlight"
      />
      {/* Color picker */}
      <div ref={colorRef} style={{ position: 'relative' }}>
        <BubbleBtn
          icon={<Palette size={14} />}
          active={showColorPicker}
          onClick={() => setShowColorPicker((v) => !v)}
          tooltip="Text color"
        />
        {showColorPicker && (
          <div className="color-picker-popover">
            {TEXT_COLORS.map((c) => (
              <button
                key={c.label}
                className={`color-picker-swatch ${editor.isActive('textStyle', { color: c.value }) ? 'is-active' : ''}`}
                title={c.label}
                style={{ background: c.value || 'var(--color-text-primary)' }}
                onClick={() => {
                  if (c.value) {
                    editor.chain().focus().setColor(c.value).run();
                  } else {
                    editor.chain().focus().unsetColor().run();
                  }
                  setShowColorPicker(false);
                }}
              />
            ))}
          </div>
        )}
      </div>
      <BubbleBtn
        icon={<LinkIcon size={14} />}
        active={editor.isActive('link')}
        onClick={addLink}
        tooltip="Link"
      />
      <div className="bubble-menu-divider" />
      <BubbleBtn
        icon={<Type size={14} />}
        active={editor.isActive('paragraph')}
        onClick={() => editor.chain().focus().setParagraph().run()}
        tooltip="Text"
      />
      <BubbleBtn
        icon={<Heading1 size={14} />}
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        tooltip="Heading 1"
      />
      <BubbleBtn
        icon={<Heading2 size={14} />}
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        tooltip="Heading 2"
      />
      <BubbleBtn
        icon={<Heading3 size={14} />}
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        tooltip="Heading 3"
      />
      <div className="bubble-menu-divider" />
      <BubbleBtn
        icon={<List size={14} />}
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        tooltip="Bullet list"
      />
      <BubbleBtn
        icon={<ListOrdered size={14} />}
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        tooltip="Numbered list"
      />
      <BubbleBtn
        icon={<ListChecks size={14} />}
        active={editor.isActive('taskList')}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        tooltip="To-do list"
      />
    </div>
  );
}

function BubbleBtn({
  icon,
  active,
  onClick,
  tooltip,
}: {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  tooltip: string;
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`bubble-menu-btn ${active ? 'is-active' : ''}`}
    >
      {icon}
    </button>
  );
}

// ─── Slash command menu ─────────────────────────────────────────────────

function SlashCommandMenu({
  items,
  selectedIndex,
  onSelect,
  position,
}: {
  items: SlashCommandItem[];
  selectedIndex: number;
  onSelect: (item: SlashCommandItem) => void;
  position: { top: number; left: number };
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const selected = menu.querySelector('.is-selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (items.length === 0) {
    return (
      <div
        className="slash-command-menu"
        style={{
          position: 'absolute',
          top: position.top,
          left: position.left,
        }}
      >
        <div style={{ padding: '12px 16px', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
          No results
        </div>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="slash-command-menu"
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
      }}
    >
      {items.map((item, idx) => (
        <button
          key={item.title}
          className={`slash-command-item ${idx === selectedIndex ? 'is-selected' : ''}`}
          onClick={() => onSelect(item)}
          onMouseEnter={() => {}}
        >
          <div className="slash-command-item-icon">{item.icon}</div>
          <div className="slash-command-item-text">
            <div className="slash-command-item-title">{item.title}</div>
            <div className="slash-command-item-description">{item.description}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── @ Mention menu ──────────────────────────────────────────────────────

function MentionMenu({
  items,
  selectedIndex,
  onSelect,
  position,
}: {
  items: Array<{ id: string; title: string; icon: string | null }>;
  selectedIndex: number;
  onSelect: (item: { id: string; title: string; icon: string | null }) => void;
  position: { top: number; left: number };
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const selected = menu.querySelector('.is-selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (items.length === 0) {
    return (
      <div
        className="mention-menu slash-command-menu"
        style={{ position: 'absolute', top: position.top, left: position.left }}
      >
        <div style={{ padding: '12px 16px', color: 'var(--color-text-tertiary)', fontSize: 13 }}>
          No pages found
        </div>
      </div>
    );
  }

  return (
    <div
      ref={menuRef}
      className="mention-menu slash-command-menu"
      style={{ position: 'absolute', top: position.top, left: position.left }}
    >
      <div style={{ padding: '4px 10px 2px', fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Link to page
      </div>
      {items.map((item, idx) => (
        <button
          key={item.id}
          className={`slash-command-item ${idx === selectedIndex ? 'is-selected' : ''}`}
          onClick={() => onSelect(item)}
        >
          <span style={{ fontSize: 16, width: 24, textAlign: 'center', flexShrink: 0 }}>
            {item.icon || '📄'}
          </span>
          <span style={{ fontSize: 13, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.title || 'Untitled'}
          </span>
        </button>
      ))}
    </div>
  );
}
