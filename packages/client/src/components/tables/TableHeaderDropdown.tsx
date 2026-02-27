import { useState, useRef, useEffect, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { ChevronRight, Check } from 'lucide-react';
import {
  Table2,
  FileSpreadsheet,
  BarChart2,
  PieChart,
  Users,
  ShoppingCart,
  Briefcase,
  Calendar,
  Heart,
  Star,
  Zap,
  Globe,
  Code,
  BookOpen,
  Layers,
  Target,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// ─── Color palette ───────────────────────────────────────────────────

const COLOR_PALETTE = [
  // Row 1 — pastel
  '#f8b4c8', '#f5c6a0', '#f5e6a0', '#b8e6c8', '#a0dcc8',
  '#a8e0e8', '#a8d4f0', '#b8c4f0', '#d0b8f0', '#d0d0d0',
  // Row 2 — vivid
  '#e03050', '#e06020', '#e0a020', '#28a060', '#18908c',
  '#20a0c8', '#3070d0', '#b030a0', '#8030c0', '#505060',
];

// ─── Icon options ────────────────────────────────────────────────────

const ICON_OPTIONS: { name: string; icon: LucideIcon }[] = [
  { name: 'Table2', icon: Table2 },
  { name: 'FileSpreadsheet', icon: FileSpreadsheet },
  { name: 'BarChart2', icon: BarChart2 },
  { name: 'PieChart', icon: PieChart },
  { name: 'Users', icon: Users },
  { name: 'ShoppingCart', icon: ShoppingCart },
  { name: 'Briefcase', icon: Briefcase },
  { name: 'Calendar', icon: Calendar },
  { name: 'Heart', icon: Heart },
  { name: 'Star', icon: Star },
  { name: 'Zap', icon: Zap },
  { name: 'Globe', icon: Globe },
  { name: 'Code', icon: Code },
  { name: 'BookOpen', icon: BookOpen },
  { name: 'Layers', icon: Layers },
  { name: 'Target', icon: Target },
];

// ─── Props ───────────────────────────────────────────────────────────

interface TableHeaderDropdownProps {
  title: string;
  color: string | undefined;
  icon: string | undefined;
  guide: string | undefined;
  onTitleChange: (title: string) => void;
  onColorChange: (color: string | undefined) => void;
  onIconChange: (icon: string | undefined) => void;
  onGuideChange: (guide: string) => void;
  onClose: () => void;
  anchorRect: DOMRect | null;
}

// ─── Component ───────────────────────────────────────────────────────

export function TableHeaderDropdown({
  title,
  color,
  icon,
  guide,
  onTitleChange,
  onColorChange,
  onIconChange,
  onGuideChange,
  onClose,
  anchorRect,
}: TableHeaderDropdownProps) {
  const [localTitle, setLocalTitle] = useState(title);
  const [appearanceOpen, setAppearanceOpen] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'color' | 'icon'>('color');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const onGuideChangeRef = useRef(onGuideChange);
  onGuideChangeRef.current = onGuideChange;

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Tiptap editor for table guide
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TiptapLink.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: 'Describe this table...' }),
    ],
    content: guide || '',
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML();
      const isEmpty = html === '<p></p>' || html === '';
      onGuideChangeRef.current(isEmpty ? '' : html);
    },
    editorProps: {
      attributes: { class: 'table-guide-editor-content' },
    },
  });

  // Update editor content when guide prop changes externally
  const guideRef = useRef(guide);
  useEffect(() => {
    if (!editor) return;
    if (guide !== guideRef.current) {
      guideRef.current = guide;
      const currentHtml = editor.getHTML();
      const normalized = guide || '';
      if (currentHtml !== normalized) {
        editor.commands.setContent(normalized, false);
      }
    }
  }, [guide, editor]);

  const handleTitleBlur = useCallback(() => {
    if (localTitle !== title) {
      onTitleChange(localTitle);
    }
  }, [localTitle, title, onTitleChange]);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
  }, []);

  if (!anchorRect) return null;

  return (
    <div
      ref={dropdownRef}
      className="table-header-dropdown"
      style={{
        position: 'fixed',
        top: anchorRect.bottom + 4,
        left: anchorRect.left,
        zIndex: 9999,
      }}
    >
      {/* Title input */}
      <input
        className="table-header-dropdown-title"
        value={localTitle}
        onChange={(e) => setLocalTitle(e.target.value)}
        onBlur={handleTitleBlur}
        onKeyDown={handleTitleKeyDown}
        autoFocus
      />

      {/* Appearance section */}
      <div className="table-header-dropdown-section">
        <button
          className="table-header-dropdown-section-header"
          onClick={() => setAppearanceOpen(!appearanceOpen)}
        >
          <ChevronRight
            size={14}
            style={{
              transform: appearanceOpen ? 'rotate(90deg)' : 'none',
              transition: 'transform 150ms',
            }}
          />
          <span>Appearance</span>
        </button>

        {appearanceOpen && (
          <div className="table-header-dropdown-section-body">
            {/* Color | Icon tabs */}
            <div className="table-header-dropdown-tabs">
              <button
                className={`table-header-dropdown-tab${activeTab === 'color' ? ' active' : ''}`}
                onClick={() => setActiveTab('color')}
              >
                Color
              </button>
              <button
                className={`table-header-dropdown-tab${activeTab === 'icon' ? ' active' : ''}`}
                onClick={() => setActiveTab('icon')}
              >
                Icon
              </button>
            </div>

            {activeTab === 'color' ? (
              <div className="table-header-dropdown-colors">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    className={`table-header-dropdown-color${color === c ? ' active' : ''}`}
                    style={{ background: c }}
                    onClick={() => onColorChange(color === c ? undefined : c)}
                    title={c}
                  >
                    {color === c && <Check size={14} strokeWidth={3} />}
                  </button>
                ))}
              </div>
            ) : (
              <div className="table-header-dropdown-icons">
                {ICON_OPTIONS.map((opt) => {
                  const IconComp = opt.icon;
                  const isActive = icon === opt.name;
                  return (
                    <button
                      key={opt.name}
                      className={`table-header-dropdown-icon${isActive ? ' active' : ''}`}
                      onClick={() => onIconChange(isActive ? undefined : opt.name)}
                      title={opt.name}
                    >
                      <IconComp size={18} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table guide section */}
      <div className="table-header-dropdown-section">
        <button
          className="table-header-dropdown-section-header"
          onClick={() => setGuideOpen(!guideOpen)}
        >
          <ChevronRight
            size={14}
            style={{
              transform: guideOpen ? 'rotate(90deg)' : 'none',
              transition: 'transform 150ms',
            }}
          />
          <span>Table guide</span>
        </button>

        {guideOpen && (
          <div className="table-header-dropdown-section-body">
            <div className="table-guide-editor">
              <EditorContent editor={editor} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helper: resolve icon name to component ──────────────────────────

export function getTableIcon(iconName: string | undefined | null): LucideIcon {
  if (!iconName) return Table2;
  const found = ICON_OPTIONS.find((o) => o.name === iconName);
  return found ? found.icon : Table2;
}
