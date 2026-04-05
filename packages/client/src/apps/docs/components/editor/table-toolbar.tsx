import type { useEditor } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';

// ─── Table toolbar (appears when cursor is inside a table) ──────────────

export function TableToolbar({
  editor,
  position,
}: {
  editor: NonNullable<ReturnType<typeof useEditor>>;
  position: { top: number; left: number };
}) {
  const { t } = useTranslation();
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
        title={t('docs.tableAddRowAbove')}
        onClick={() => editor.chain().focus().addRowBefore().run()}
      >
        {t('docs.tableAddRowAbove')}
      </button>
      <button
        className="table-toolbar-btn"
        title={t('docs.tableAddRowBelow')}
        onClick={() => editor.chain().focus().addRowAfter().run()}
      >
        {t('docs.tableAddRowBelow')}
      </button>
      <button
        className="table-toolbar-btn table-toolbar-btn--danger"
        title={t('docs.tableDeleteRow')}
        onClick={() => editor.chain().focus().deleteRow().run()}
      >
        {t('docs.tableDeleteRow')}
      </button>

      <div className="table-toolbar-divider" />

      {/* Column controls */}
      <button
        className="table-toolbar-btn"
        title={t('docs.tableAddColBefore')}
        onClick={() => editor.chain().focus().addColumnBefore().run()}
      >
        {t('docs.tableAddColBefore')}
      </button>
      <button
        className="table-toolbar-btn"
        title={t('docs.tableAddColAfter')}
        onClick={() => editor.chain().focus().addColumnAfter().run()}
      >
        {t('docs.tableAddColAfter')}
      </button>
      <button
        className="table-toolbar-btn table-toolbar-btn--danger"
        title={t('docs.tableDeleteCol')}
        onClick={() => editor.chain().focus().deleteColumn().run()}
      >
        {t('docs.tableDeleteCol')}
      </button>

      <div className="table-toolbar-divider" />

      {/* Delete table */}
      <button
        className="table-toolbar-btn table-toolbar-btn--danger"
        title={t('docs.tableDelete')}
        onClick={() => editor.chain().focus().deleteTable().run()}
      >
        <Trash2 size={12} />
        <span>{t('docs.tableDelete')}</span>
      </button>
    </div>
  );
}
