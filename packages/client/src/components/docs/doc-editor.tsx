import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useEditor, EditorContent, BubbleMenu, FloatingMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
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
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import UniqueID from '@tiptap/extension-unique-id';
import { Callout } from './extensions/callout';
import { ToggleBlock, ToggleSummary } from './extensions/toggle-block';
import { PageMention } from './extensions/page-mention';
import { ResizableImage } from './extensions/resizable-image';
import { SearchReplace } from './extensions/search-replace';
import type { SearchReplaceState } from './extensions/search-replace';
import { DrawingEmbed } from './extensions/drawing-embed';
import { TableEmbed } from './extensions/table-embed';
import { useDocSettingsStore, type DocFontStyle } from '../../stores/docs-settings-store';
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
  Search,
  Replace,
  X,
  ChevronUp,
  ChevronDown,
  Keyboard,
  CaseSensitive,
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

// Focus Extension removed — the per-transaction decoration rebuild caused
// visible shaking/jitter in the editor. The visual effect was minimal
// (rgba(0,0,0,0.018) background) and not worth the performance cost.

// ─── Types ──────────────────────────────────────────────────────────────

interface DocEditorProps {
  value: Record<string, unknown> | null;
  onChange: (value: Record<string, unknown>) => void;
  readOnly?: boolean;
  /** Flat document list used for @ mention page picker */
  documents?: Array<{ id: string; title: string; icon: string | null }>;
  /** Navigate to a document (used when clicking a page mention) */
  onNavigate?: (docId: string) => void;
  /** Available drawings for embedding via slash command */
  drawings?: Array<{ id: string; title: string }>;
  /** Available tables for embedding via slash command */
  tables?: Array<{ id: string; title: string }>;
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

// ─── Office Paste Helpers ───────────────────────────────────────────────────
// Detect and clean HTML pasted from Microsoft Office, Google Docs, etc.

function isOfficePaste(html: string): boolean {
  return (
    /class="?Mso/i.test(html) ||
    /xmlns:o="urn:schemas-microsoft-com:office/i.test(html) ||
    /docs-internal-guid/i.test(html) ||
    /<google-sheets-html-origin/i.test(html) ||
    /x:str/i.test(html)
  );
}

function cleanOfficePaste(html: string): string {
  let cleaned = html;
  // Remove everything before <body> and after </body>
  const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) cleaned = bodyMatch[1];
  // Remove XML namespaces and Office-specific tags
  cleaned = cleaned.replace(/<o:[^>]*>[\s\S]*?<\/o:[^>]*>/gi, '');
  cleaned = cleaned.replace(/<w:[^>]*>[\s\S]*?<\/w:[^>]*>/gi, '');
  cleaned = cleaned.replace(/<m:[^>]*>[\s\S]*?<\/m:[^>]*>/gi, '');
  cleaned = cleaned.replace(/<!\[if[^>]*>[\s\S]*?<!\[endif\]>/gi, '');
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  // Remove all style attributes (Office adds massive inline styles)
  cleaned = cleaned.replace(/\s+style="[^"]*"/gi, '');
  cleaned = cleaned.replace(/\s+style='[^']*'/gi, '');
  // Remove class attributes with mso-* or Office-specific classes
  cleaned = cleaned.replace(/\s+class="[^"]*"/gi, '');
  // Remove <span> tags without useful attributes (Office wraps everything in spans)
  cleaned = cleaned.replace(/<span\s*>/gi, '');
  cleaned = cleaned.replace(/<\/span>/gi, '');
  // Remove empty paragraphs
  cleaned = cleaned.replace(/<p[^>]*>\s*(&nbsp;|\u00a0)?\s*<\/p>/gi, '');
  // Clean up excessive whitespace
  cleaned = cleaned.replace(/\n\s*\n/g, '\n');
  return cleaned.trim();
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
    description: 'Upload a resizable image',
    icon: '🖼',
    command: (editor) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        const src = await readFileAsDataUrl(file);
        editor.chain().focus().setResizableImage({ src }).run();
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
      const headings: Array<{ level: number; text: string; id: string }> = [];
      editor.state.doc.descendants((node) => {
        if (node.type.name === 'heading') {
          headings.push({
            level: node.attrs.level as number,
            text: node.textContent,
            id: node.attrs.id || '',
          });
        }
      });
      if (headings.length === 0) {
        editor.chain().focus().insertContent('<p><em>No headings found in this document.</em></p>').run();
        return;
      }
      // Build nested bullet list items
      const items = headings.map((h) => {
        const padding = (h.level - 1) * 16;
        return `<li style="padding-left: ${padding}px; list-style: none;"><a href="#${h.id}" style="color: var(--color-text-secondary); text-decoration: none;">${h.text}</a></li>`;
      });
      const tocHtml = `<p><strong>Table of contents</strong></p><ul style="padding-left: 0;">${items.join('')}</ul>`;
      editor.chain().focus().insertContent(tocHtml).run();
    },
  },
];

// ─── DocEditor ──────────────────────────────────────────────────────────

const DOC_FONT_FAMILIES: Record<DocFontStyle, string> = {
  default: 'var(--font-family)',
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
};

export function DocEditor({ value, onChange, readOnly = false, documents: docList, onNavigate, drawings: drawingList, tables: tableList }: DocEditorProps) {
  const fontStyle = useDocSettingsStore((s) => s.fontStyle);
  const smallText = useDocSettingsStore((s) => s.smallText);
  const fullWidth = useDocSettingsStore((s) => s.fullWidth);
  const spellCheck = useDocSettingsStore((s) => s.spellCheck);

  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashMenuPos, setSlashMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [slashQuery, setSlashQuery] = useState('');
  const [slashSelectedIdx, setSlashSelectedIdx] = useState(0);
  const slashStartRef = useRef<number | null>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // Floating menu state for the "+" button on empty lines
  const [floatingMenuOpen, setFloatingMenuOpen] = useState(false);

  // Word and character count (computed from editor text content, debounced)
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const countTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Search & Replace bar state (derived from editor storage)
  const [searchOpen, setSearchOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);

  // Keyboard shortcuts help modal
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);

  // Drawing embed picker state
  const [drawingPickerOpen, setDrawingPickerOpen] = useState(false);
  const [drawingPickerQuery, setDrawingPickerQuery] = useState('');
  const [drawingPickerIdx, setDrawingPickerIdx] = useState(0);

  // Table embed picker state
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [tablePickerQuery, setTablePickerQuery] = useState('');
  const [tablePickerIdx, setTablePickerIdx] = useState(0);

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
      ResizableImage,
      // ── Unique ID per block (for future comments/anchoring) ──
      UniqueID.configure({
        types: ['heading', 'paragraph', 'bulletList', 'orderedList', 'taskList', 'codeBlock', 'blockquote', 'table', 'resizableImage', 'callout', 'toggleBlock', 'drawingEmbed', 'tableEmbed'],
      }),
      // ── Search & Replace (Cmd+F) ──
      SearchReplace,
      Callout,
      ToggleSummary,
      ToggleBlock,
      PageMention,
      DrawingEmbed,
      TableEmbed,
    ],
    editorProps: {
      attributes: {
        class: 'doc-editor-content',
        style: [
          'outline: none',
          'color: var(--color-text-primary)',
          `font-size: ${smallText ? '14px' : '15px'}`,
          'line-height: 1.7',
          `font-family: ${DOC_FONT_FAMILIES[fontStyle]}`,
          'min-height: 300px',
          'padding: 0',
        ].join('; '),
        spellcheck: spellCheck ? 'true' : 'false',
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
                const node = view.state.schema.nodes.resizableImage.create({ src });
                const tr = view.state.tr.insert(pos.pos, node);
                view.dispatch(tr);
              }
            });
            return true;
          }
        }
        return false;
      },
      // ── Image & Office paste from clipboard ─────────────────────────
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;

        // Office paste cleanup: intercept Word/Excel/Google Docs HTML
        const htmlData = event.clipboardData?.getData('text/html');
        if (htmlData && isOfficePaste(htmlData)) {
          event.preventDefault();
          const cleaned = cleanOfficePaste(htmlData);
          // Use ProseMirror's schema-based insertContent for safe sanitization
          const editorRef = (view as any).__tiptapEditor;
          if (editorRef) {
            editorRef.chain().focus().insertContent(cleaned).run();
          }
          return true;
        }

        for (const item of items) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (!file) return false;
            readFileAsDataUrl(file).then((src) => {
              const node = view.state.schema.nodes.resizableImage.create({ src });
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

      // Debounce word/character count updates to prevent shaking from rapid re-renders
      if (countTimerRef.current) clearTimeout(countTimerRef.current);
      countTimerRef.current = setTimeout(() => {
        const text = e.state.doc.textContent;
        setCharCount(text.length);
        setWordCount(text.trim() === '' ? 0 : text.trim().split(/\s+/).length);
      }, 300);

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

  // Dynamic slash commands (includes Drawing if drawings prop is provided)
  const allSlashCommands = useMemo(() => {
    const cmds = [...SLASH_COMMANDS];
    if (drawingList && drawingList.length > 0) {
      cmds.push({
        title: 'Drawing',
        description: 'Embed an Excalidraw drawing',
        icon: '\u270F',
        command: (_editor) => {
          // This will open the drawing picker
          setDrawingPickerOpen(true);
          setDrawingPickerQuery('');
          setDrawingPickerIdx(0);
        },
      });
    }
    if (tableList && tableList.length > 0) {
      cmds.push({
        title: 'Spreadsheet',
        description: 'Embed a linked spreadsheet',
        icon: '\u2637',
        command: (_editor) => {
          setTablePickerOpen(true);
          setTablePickerQuery('');
          setTablePickerIdx(0);
        },
      });
    }
    return cmds;
  }, [drawingList, tableList]);

  function getFilteredCommands(query: string): SlashCommandItem[] {
    if (!query) return allSlashCommands;
    const q = query.toLowerCase();
    return allSlashCommands.filter(
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

  // Drawing picker: insert the selected drawing embed
  function insertDrawingEmbed(drawing: { id: string; title: string }) {
    if (!editor) return;
    editor.chain().focus().insertDrawingEmbed({ drawingId: drawing.id, title: drawing.title }).run();
    setDrawingPickerOpen(false);
  }

  const filteredDrawings = useMemo((): Array<{ id: string; title: string }> => {
    if (!drawingList) return [];
    if (!drawingPickerQuery.trim()) return drawingList;
    const q = drawingPickerQuery.toLowerCase();
    return drawingList.filter((d: { id: string; title: string }) => d.title.toLowerCase().includes(q));
  }, [drawingList, drawingPickerQuery]);

  // Table picker: insert the selected table embed
  function insertTableEmbed(table: { id: string; title: string }) {
    if (!editor) return;
    editor.chain().focus().insertTableEmbed({ tableId: table.id, title: table.title }).run();
    setTablePickerOpen(false);
  }

  const filteredTables = useMemo((): Array<{ id: string; title: string }> => {
    if (!tableList) return [];
    if (!tablePickerQuery.trim()) return tableList;
    const q = tablePickerQuery.toLowerCase();
    return tableList.filter((t: { id: string; title: string }) => t.title.toLowerCase().includes(q));
  }, [tableList, tablePickerQuery]);

  // Sync readOnly
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  // Sync doc settings (font, text size, spell check) to the editor after mount
  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        attributes: {
          class: 'doc-editor-content',
          style: [
            'outline: none',
            'color: var(--color-text-primary)',
            `font-size: ${smallText ? '14px' : '15px'}`,
            'line-height: 1.7',
            `font-family: ${DOC_FONT_FAMILIES[fontStyle]}`,
            'min-height: 300px',
            'padding: 0',
          ].join('; '),
          spellcheck: spellCheck ? 'true' : 'false',
        },
      },
    });
  }, [editor, fontStyle, smallText, spellCheck]);

  // Store editor reference on the ProseMirror view for the Office paste handler
  useEffect(() => {
    if (editor) {
      (editor.view as any).__tiptapEditor = editor;
    }
  }, [editor]);

  // Sync search bar open state from the SearchReplace extension storage
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const s = editor.storage.searchReplace as SearchReplaceState | undefined;
      if (s) setSearchOpen(s.open);
    };
    editor.on('transaction', handler);
    return () => { editor.off('transaction', handler); };
  }, [editor]);

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
        // Only call setState if currently showing the toolbar (avoid unnecessary renders)
        setTableToolbarPos((prev) => prev === null ? prev : null);
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
          maxWidth: fullWidth ? '100%' : 800,
          margin: '0 auto',
          width: '100%',
          padding: '32px 24px',
          fontFamily: DOC_FONT_FAMILIES[fontStyle],
          transition: 'max-width 0.2s ease',
        }}
      >
        {/* Bubble menu (floating toolbar on selection) */}
        {!readOnly && (
          <BubbleMenu
            editor={editor}
            tippyOptions={{ duration: 150 }}
            shouldShow={({ editor: e, state }) => {
              const { from, to } = state.selection;
              if (from === to) return false;
              // Hide on non-text atom blocks
              if (e.isActive('image') || e.isActive('drawingEmbed') || e.isActive('tableEmbed') || e.isActive('resizableImage')) return false;
              return true;
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

        {/* Drawing embed picker */}
        {drawingPickerOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99,
            }}
            onClick={() => setDrawingPickerOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 380,
                maxHeight: 400,
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-elevated)',
                overflow: 'hidden',
                fontFamily: 'var(--font-family)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--color-border-primary)' }}>
                <input
                  autoFocus
                  value={drawingPickerQuery}
                  onChange={(e) => { setDrawingPickerQuery(e.target.value); setDrawingPickerIdx(0); }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setDrawingPickerIdx((i) => Math.min(i + 1, filteredDrawings.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setDrawingPickerIdx((i) => Math.max(i - 1, 0));
                    } else if (e.key === 'Enter' && filteredDrawings[drawingPickerIdx]) {
                      e.preventDefault();
                      insertDrawingEmbed(filteredDrawings[drawingPickerIdx]);
                    } else if (e.key === 'Escape') {
                      setDrawingPickerOpen(false);
                    }
                  }}
                  placeholder="Search drawings..."
                  style={{
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: 13,
                    fontFamily: 'var(--font-family)',
                    color: 'var(--color-text-primary)',
                    padding: 0,
                  }}
                />
              </div>
              <div style={{ overflowY: 'auto', maxHeight: 300, padding: 4 }}>
                {filteredDrawings.length === 0 ? (
                  <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                    No drawings found
                  </div>
                ) : (
                  filteredDrawings.map((d, i) => (
                    <button
                      key={d.id}
                      onClick={() => insertDrawingEmbed(d)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        padding: '6px 8px',
                        background: i === drawingPickerIdx ? 'var(--color-surface-selected)' : 'transparent',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-family)',
                        fontSize: 13,
                        color: 'var(--color-text-primary)',
                        textAlign: 'left',
                      }}
                      onMouseEnter={() => setDrawingPickerIdx(i)}
                    >
                      <span style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>{'\u270F'}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.title || 'Untitled drawing'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Table embed picker */}
        {tablePickerOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99,
            }}
            onClick={() => setTablePickerOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 380,
                maxHeight: 400,
                background: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-elevated)',
                overflow: 'hidden',
                fontFamily: 'var(--font-family)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--color-border-primary)' }}>
                <input
                  autoFocus
                  value={tablePickerQuery}
                  onChange={(e) => { setTablePickerQuery(e.target.value); setTablePickerIdx(0); }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setTablePickerIdx((i) => Math.min(i + 1, filteredTables.length - 1));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setTablePickerIdx((i) => Math.max(i - 1, 0));
                    } else if (e.key === 'Enter' && filteredTables[tablePickerIdx]) {
                      e.preventDefault();
                      insertTableEmbed(filteredTables[tablePickerIdx]);
                    } else if (e.key === 'Escape') {
                      setTablePickerOpen(false);
                    }
                  }}
                  placeholder="Search tables..."
                  style={{
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: 13,
                    fontFamily: 'var(--font-family)',
                    color: 'var(--color-text-primary)',
                    padding: 0,
                  }}
                />
              </div>
              <div style={{ overflowY: 'auto', maxHeight: 300, padding: 4 }}>
                {filteredTables.length === 0 ? (
                  <div style={{ padding: '16px 12px', textAlign: 'center', fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                    No tables found
                  </div>
                ) : (
                  filteredTables.map((t, i) => (
                    <button
                      key={t.id}
                      onClick={() => insertTableEmbed(t)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        width: '100%',
                        padding: '6px 8px',
                        background: i === tablePickerIdx ? 'var(--color-surface-selected)' : 'transparent',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-family)',
                        fontSize: 13,
                        color: 'var(--color-text-primary)',
                        textAlign: 'left',
                      }}
                      onMouseEnter={() => setTablePickerIdx(i)}
                    >
                      <span style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>{'\u2637'}</span>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.title || 'Untitled table'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
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

      {/* Search & Replace bar */}
      {searchOpen && !readOnly && (
        <SearchBar
          editor={editor}
          showReplace={showReplace}
          onToggleReplace={() => setShowReplace((v) => !v)}
          onClose={() => {
            editor.commands.closeSearch();
            setShowReplace(false);
          }}
        />
      )}

      {/* Character / word count status bar */}
      {!readOnly && (
        <div className="doc-editor-status-bar">
          <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
          <span className="doc-editor-status-bar-dot">·</span>
          <span>{charCount} {charCount === 1 ? 'character' : 'characters'}</span>
          <span style={{ flex: 1 }} />
          <button
            className="doc-editor-shortcuts-btn"
            title="Keyboard shortcuts"
            onClick={() => setShowShortcutsHelp(true)}
          >
            <Keyboard size={12} />
          </button>
        </div>
      )}

      {/* Keyboard shortcuts help modal */}
      {showShortcutsHelp && (
        <KeyboardShortcutsHelp onClose={() => setShowShortcutsHelp(false)} />
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
        icon={<Undo2 size={16} />}
        active={false}
        onClick={() => editor.chain().focus().undo().run()}
        tooltip="Undo"
      />
      <BubbleBtn
        icon={<Redo2 size={16} />}
        active={false}
        onClick={() => editor.chain().focus().redo().run()}
        tooltip="Redo"
      />
      <div className="bubble-menu-divider" />
      <BubbleBtn
        icon={<Bold size={16} />}
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        tooltip="Bold"
      />
      <BubbleBtn
        icon={<Italic size={16} />}
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        tooltip="Italic"
      />
      <BubbleBtn
        icon={<UnderlineIcon size={16} />}
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        tooltip="Underline"
      />
      <BubbleBtn
        icon={<Strikethrough size={16} />}
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        tooltip="Strikethrough"
      />
      <BubbleBtn
        icon={<Code size={16} />}
        active={editor.isActive('code')}
        onClick={() => editor.chain().focus().toggleCode().run()}
        tooltip="Code"
      />
      <div className="bubble-menu-divider" />
      <BubbleBtn
        icon={<Highlighter size={16} />}
        active={editor.isActive('highlight')}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        tooltip="Highlight"
      />
      {/* Color picker */}
      <div ref={colorRef} style={{ position: 'relative' }}>
        <BubbleBtn
          icon={<Palette size={16} />}
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
        icon={<LinkIcon size={16} />}
        active={editor.isActive('link')}
        onClick={addLink}
        tooltip="Link"
      />
      <div className="bubble-menu-divider" />
      <BubbleBtn
        icon={<Type size={16} />}
        active={editor.isActive('paragraph')}
        onClick={() => editor.chain().focus().setParagraph().run()}
        tooltip="Text"
      />
      <BubbleBtn
        icon={<Heading1 size={16} />}
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        tooltip="Heading 1"
      />
      <BubbleBtn
        icon={<Heading2 size={16} />}
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        tooltip="Heading 2"
      />
      <BubbleBtn
        icon={<Heading3 size={16} />}
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        tooltip="Heading 3"
      />
      <div className="bubble-menu-divider" />
      <BubbleBtn
        icon={<List size={16} />}
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        tooltip="Bullet list"
      />
      <BubbleBtn
        icon={<ListOrdered size={16} />}
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        tooltip="Numbered list"
      />
      <BubbleBtn
        icon={<ListChecks size={16} />}
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
            {item.icon || '\u{1F4C4}'}
          </span>
          <span style={{ fontSize: 13, color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.title || 'Untitled'}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Search & Replace bar ────────────────────────────────────────────────

function SearchBar({
  editor,
  showReplace,
  onToggleReplace,
  onClose,
}: {
  editor: NonNullable<ReturnType<typeof useEditor>>;
  showReplace: boolean;
  onToggleReplace: () => void;
  onClose: () => void;
}) {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const storage = editor.storage.searchReplace as SearchReplaceState;

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  return (
    <div className="search-replace-bar">
      <div className="search-replace-row">
        <div className="search-replace-input-wrap">
          <Search size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Find..."
            className="search-replace-input"
            value={storage.query}
            onChange={(e) => editor.commands.setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) editor.commands.previousMatch();
                else editor.commands.nextMatch();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
              }
            }}
          />
        </div>
        <span className="search-replace-count">
          {storage.matchCount > 0
            ? `${storage.activeIndex + 1} / ${storage.matchCount}`
            : storage.query ? 'No results' : ''}
        </span>
        <button
          className="search-replace-btn"
          title="Case sensitive"
          onClick={() => editor.commands.toggleCaseSensitive()}
          style={{ color: storage.caseSensitive ? 'var(--color-accent-primary, #13715B)' : undefined }}
        >
          <CaseSensitive size={14} />
        </button>
        <button className="search-replace-btn" title="Previous" onClick={() => editor.commands.previousMatch()}>
          <ChevronUp size={14} />
        </button>
        <button className="search-replace-btn" title="Next" onClick={() => editor.commands.nextMatch()}>
          <ChevronDown size={14} />
        </button>
        <button
          className="search-replace-btn"
          title={showReplace ? 'Hide replace' : 'Show replace'}
          onClick={onToggleReplace}
        >
          <Replace size={14} />
        </button>
        <button className="search-replace-btn" title="Close" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      {showReplace && (
        <div className="search-replace-row">
          <div className="search-replace-input-wrap">
            <Replace size={13} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Replace..."
              className="search-replace-input"
              value={storage.replaceText}
              onChange={(e) => editor.commands.setReplaceText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  editor.commands.replaceCurrentMatch();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  onClose();
                }
              }}
            />
          </div>
          <button
            className="search-replace-btn search-replace-action"
            onClick={() => editor.commands.replaceCurrentMatch()}
          >
            Replace
          </button>
          <button
            className="search-replace-btn search-replace-action"
            onClick={() => editor.commands.replaceAllMatches()}
          >
            All
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Keyboard shortcuts help modal ───────────────────────────────────────

const SHORTCUT_SECTIONS = [
  {
    title: 'Essentials',
    shortcuts: [
      { keys: ['Mod', 'Z'], label: 'Undo' },
      { keys: ['Mod', 'Shift', 'Z'], label: 'Redo' },
      { keys: ['Mod', 'B'], label: 'Bold' },
      { keys: ['Mod', 'I'], label: 'Italic' },
      { keys: ['Mod', 'U'], label: 'Underline' },
      { keys: ['Mod', 'Shift', 'S'], label: 'Strikethrough' },
      { keys: ['Mod', 'E'], label: 'Inline code' },
      { keys: ['Mod', 'K'], label: 'Insert link' },
    ],
  },
  {
    title: 'Text formatting',
    shortcuts: [
      { keys: ['Mod', 'Shift', 'H'], label: 'Highlight' },
      { keys: ['/'], label: 'Open slash commands' },
      { keys: ['@'], label: 'Mention a page' },
    ],
  },
  {
    title: 'Blocks',
    shortcuts: [
      { keys: ['Mod', 'Alt', '1'], label: 'Heading 1' },
      { keys: ['Mod', 'Alt', '2'], label: 'Heading 2' },
      { keys: ['Mod', 'Alt', '3'], label: 'Heading 3' },
      { keys: ['Mod', 'Shift', '7'], label: 'Numbered list' },
      { keys: ['Mod', 'Shift', '8'], label: 'Bullet list' },
      { keys: ['Mod', 'Shift', '9'], label: 'Task list' },
      { keys: ['Mod', 'Shift', 'B'], label: 'Blockquote' },
      { keys: ['---'], label: 'Horizontal rule' },
    ],
  },
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['Mod', 'F'], label: 'Find in document' },
      { keys: ['Tab'], label: 'Indent list item' },
      { keys: ['Shift', 'Tab'], label: 'Outdent list item' },
      { keys: ['Enter'], label: 'New line / split block' },
      { keys: ['Shift', 'Enter'], label: 'Line break' },
    ],
  },
];

function KeyboardShortcutsHelp({ onClose }: { onClose: () => void }) {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const modKey = isMac ? '\u2318' : 'Ctrl';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  function renderKey(key: string) {
    if (key === 'Mod') return modKey;
    if (key === 'Shift') return isMac ? '\u21E7' : 'Shift';
    if (key === 'Alt') return isMac ? '\u2325' : 'Alt';
    if (key === 'Enter') return '\u21B5';
    if (key === 'Tab') return '\u21E5';
    return key;
  }

  return (
    <div className="shortcuts-modal-backdrop" onClick={onClose}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shortcuts-modal-header">
          <span className="shortcuts-modal-title">Keyboard shortcuts</span>
          <button className="search-replace-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="shortcuts-modal-body">
          {SHORTCUT_SECTIONS.map((section) => (
            <div key={section.title} className="shortcuts-section">
              <div className="shortcuts-section-title">{section.title}</div>
              {section.shortcuts.map((s) => (
                <div key={s.label} className="shortcut-row">
                  <span className="shortcut-label">{s.label}</span>
                  <span className="shortcut-keys">
                    {s.keys.map((k, i) => (
                      <span key={i}>
                        <kbd className="shortcut-kbd">{renderKey(k)}</kbd>
                        {i < s.keys.length - 1 && <span className="shortcut-plus">+</span>}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
