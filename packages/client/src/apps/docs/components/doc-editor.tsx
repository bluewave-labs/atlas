import { useState, useRef, useEffect } from 'react';
import { useUIStore } from '../../../stores/ui-store';
import { useEditor, EditorContent, BubbleMenu, FloatingMenu } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
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
import { PageMention } from './extensions/page-mention';
import { ResizableImage } from './extensions/resizable-image';
import { SearchReplace } from './extensions/search-replace';
import { DrawingEmbed } from './extensions/drawing-embed';
import { useDocSettingsStore, type DocFontStyle } from '../settings-store';
import { Keyboard } from 'lucide-react';
import '../../../styles/docs.css';

// Extracted sub-components and hooks
import { TrailingNode } from './editor/trailing-node';
import { isOfficePaste, cleanOfficePaste } from './editor/office-paste';
import { SLASH_COMMANDS, readFileAsDataUrl } from './editor/slash-commands';
import { BubbleToolbar } from './editor/bubble-toolbar';
import { SlashCommandMenu } from './editor/slash-command-menu';
import { MentionMenu } from './editor/mention-menu';
import { TableToolbar } from './editor/table-toolbar';
import { SearchBar } from './editor/search-bar';
import { DrawingPicker } from './editor/embed-pickers';
import { useEditorEffects } from './editor/use-editor-effects';
import { useEditorMenus } from './editor/use-editor-menus';

// ─── Lowlight instance ────────────────────────────────────────────────────────
const lowlight = createLowlight(common);

// ─── Types ──────────────────────────────────────────────────────────────

interface DocEditorProps {
  value: Record<string, unknown> | null;
  onChange: (value: Record<string, unknown>) => void;
  readOnly?: boolean;
  documents?: Array<{ id: string; title: string; icon: string | null }>;
  onNavigate?: (docId: string) => void;
  drawings?: Array<{ id: string; title: string }>;
}

const DOC_FONT_FAMILIES: Record<DocFontStyle, string> = {
  default: 'var(--font-family)',
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
};

// ─── DocEditor ──────────────────────────────────────────────────────────

export function DocEditor({ value, onChange, readOnly = false, documents: docList, onNavigate, drawings: drawingList }: DocEditorProps) {
  const fontStyle = useDocSettingsStore((s) => s.fontStyle);
  const smallText = useDocSettingsStore((s) => s.smallText);
  const fullWidth = useDocSettingsStore((s) => s.fullWidth);
  const spellCheck = useDocSettingsStore((s) => s.spellCheck);
  const toggleShortcutHelp = useUIStore((s) => s.toggleShortcutHelp);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const [floatingMenuOpen, setFloatingMenuOpen] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const countTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);
  const [tableToolbarPos, setTableToolbarPos] = useState<{ top: number; left: number } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [showReplace, setShowReplace] = useState(false);

  // Single menu hook instance using editorRef — ref is populated after useEditor
  const menus = useEditorMenus({
    editorRef,
    docList,
    drawingList,
    editorContainerRef,
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: false }),
      CodeBlockLowlight.configure({ lowlight }),
      GlobalDragHandle.configure({ dragHandleWidth: 20, scrollTreshold: 100 }),
      TrailingNode, Underline, TextStyle, Color,
      Highlight.configure({ multicolor: true }),
      TiptapLink.configure({ openOnClick: false, autolink: true }),
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
      TaskList, TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }), TableRow, TableCell, TableHeader,
      ResizableImage,
      UniqueID.configure({
        types: ['heading', 'paragraph', 'bulletList', 'orderedList', 'taskList', 'codeBlock', 'blockquote', 'table', 'resizableImage', 'callout', 'drawingEmbed'],
      }),
      SearchReplace, Callout, PageMention, DrawingEmbed,
    ],
    editorProps: {
      attributes: {
        class: 'doc-editor-content',
        style: [
          'outline: none', 'color: var(--color-text-primary)',
          `font-size: ${smallText ? '14px' : '15px'}`, 'line-height: 1.7',
          `font-family: ${DOC_FONT_FAMILIES[fontStyle]}`, 'min-height: 300px', 'padding: 0',
        ].join('; '),
        spellcheck: spellCheck ? 'true' : 'false',
      },
      handleKeyDown: (_view, event) => menus.handleMenuKeyDown(event),
      handleDrop: (view, event, _slice, moved) => {
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
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        const htmlData = event.clipboardData?.getData('text/html');
        if (htmlData && isOfficePaste(htmlData)) {
          event.preventDefault();
          const cleaned = cleanOfficePaste(htmlData);
          const editorRef = (view as any).__tiptapEditor;
          if (editorRef) editorRef.chain().focus().insertContent(cleaned).run();
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
      if (countTimerRef.current) clearTimeout(countTimerRef.current);
      countTimerRef.current = setTimeout(() => {
        const text = e.state.doc.textContent;
        setCharCount(text.length);
        setWordCount(text.trim() === '' ? 0 : text.trim().split(/\s+/).length);
      }, 300);
      menus.handleEditorUpdate(e);
    },
  });

  // Populate editorRef after useEditor so the single menus hook can access it
  editorRef.current = editor;

  // Cleanup pending word-count timer on unmount
  useEffect(() => {
    return () => {
      if (countTimerRef.current) {
        clearTimeout(countTimerRef.current);
      }
    };
  }, []);

  // All editor side-effects
  useEditorEffects({
    editor, readOnly, fontStyle, smallText, spellCheck, onNavigate,
    editorContainerRef,
    slashMenuOpen: menus.slashMenuOpen,
    closeSlashMenu: menus.closeSlashMenu,
    mentionMenuOpen: menus.mentionMenuOpen,
    closeMentionMenu: menus.closeMentionMenu,
    floatingMenuOpen, setFloatingMenuOpen,
    setTableToolbarPos, setSearchOpen, setWordCount, setCharCount,
  });

  // ── Drag-over handlers ──
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
    if (hasImageFile(e.dataTransfer)) e.preventDefault();
  }

  function handleContainerDrop(_e: React.DragEvent<HTMLDivElement>) {
    dragCounterRef.current = 0;
    setIsDraggingFile(false);
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
          margin: '0 auto', width: '100%', padding: '32px 24px',
          fontFamily: DOC_FONT_FAMILIES[fontStyle], transition: 'max-width 0.2s ease',
        }}
      >
        {!readOnly && (
          <BubbleMenu
            editor={editor}
            tippyOptions={{ duration: 150, maxWidth: 'none' }}
            shouldShow={({ editor: e, state }) => {
              const { from, to } = state.selection;
              if (from === to) return false;
              if (e.isActive('image') || e.isActive('drawingEmbed') || e.isActive('resizableImage')) return false;
              return true;
            }}
          >
            <BubbleToolbar editor={editor} />
          </BubbleMenu>
        )}

        {!readOnly && (
          <FloatingMenu
            editor={editor}
            tippyOptions={{ duration: 100, placement: 'left-start' }}
            shouldShow={({ state }) => {
              const { $from } = state.selection;
              return $from.parent.type.name === 'paragraph' && $from.parent.content.size === 0;
            }}
          >
            <div className="floating-menu">
              <button className="floating-menu-btn" title="Add a block" onMouseDown={(e) => { e.preventDefault(); setFloatingMenuOpen((v) => !v); }}>+</button>
              {floatingMenuOpen && (
                <div className="floating-menu-popover">
                  {SLASH_COMMANDS.slice(0, 10).map((item) => (
                    <button key={item.title} className="slash-command-item" onMouseDown={(e) => { e.preventDefault(); item.command(editor); setFloatingMenuOpen(false); }}>
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

        <EditorContent editor={editor} />

        {menus.slashMenuOpen && menus.slashMenuPos && (
          <SlashCommandMenu items={menus.getFilteredCommands(menus.slashQuery)} selectedIndex={menus.slashSelectedIdx} onSelect={menus.executeSlashCommand} position={menus.slashMenuPos} />
        )}

        {menus.mentionMenuOpen && menus.mentionMenuPos && (
          <MentionMenu items={menus.getFilteredMentions(menus.mentionQuery)} selectedIndex={menus.mentionSelectedIdx} onSelect={menus.executeMentionInsert} position={menus.mentionMenuPos} />
        )}

        {menus.drawingPickerOpen && drawingList && (
          <DrawingPicker drawings={drawingList} onSelect={menus.insertDrawingEmbed} onClose={() => menus.setDrawingPickerOpen(false)} />
        )}

        {!readOnly && tableToolbarPos && <TableToolbar editor={editor} position={tableToolbarPos} />}
      </div>

      {isDraggingFile && (
        <div className="doc-editor-drop-overlay"><div className="doc-editor-drop-label">Drop image to insert</div></div>
      )}

      {searchOpen && !readOnly && (
        <SearchBar editor={editor} showReplace={showReplace} onToggleReplace={() => setShowReplace((v) => !v)} onClose={() => { editor.commands.closeSearch(); setShowReplace(false); }} />
      )}

      {!readOnly && (
        <div className="doc-editor-status-bar">
          <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
          <span className="doc-editor-status-bar-dot">·</span>
          <span>{charCount} {charCount === 1 ? 'character' : 'characters'}</span>
          <span style={{ flex: 1 }} />
          <button className="doc-editor-shortcuts-btn" title="Keyboard shortcuts" onClick={() => toggleShortcutHelp()}><Keyboard size={12} /></button>
        </div>
      )}

    </div>
  );
}
