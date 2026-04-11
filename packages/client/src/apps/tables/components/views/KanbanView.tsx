import { useCallback, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppActions } from '../../../../hooks/use-app-permissions';
import {
  DndContext,
  DragOverlay,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Kanban } from 'lucide-react';
import type { TableColumn, TableRow, TableViewConfig } from '@atlas-platform/shared';
import { getTagColor } from '../../../../lib/tag-colors';
import { Select } from '../../../../components/ui/select';

// ─── Kanban card (draggable) ────────────────────────────────────────

function KanbanCard({
  row,
  columns,
  groupColumnId,
}: {
  row: TableRow;
  columns: TableColumn[];
  groupColumnId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: row._id,
    data: { row },
  });

  // First text column as title
  const titleCol = columns.find((c) => c.type === 'text' && c.id !== groupColumnId);
  const title = titleCol ? String(row[titleCol.id] || '') : row._id;

  // Meta fields (up to 3, excluding title and group column)
  const metaFields = columns
    .filter((c) => c.id !== groupColumnId && c.id !== titleCol?.id && row[c.id] != null && row[c.id] !== '')
    .slice(0, 3);

  const style: React.CSSProperties = {
    ...(transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : {}),
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      className={`tables-kanban-card${isDragging ? ' drag-overlay' : ''}`}
      style={style}
      {...listeners}
      {...attributes}
    >
      <div className="tables-kanban-card-title">{title || 'Untitled'}</div>
      {metaFields.length > 0 && (
        <div className="tables-kanban-card-meta">
          {metaFields.map((col) => {
            const val = String(row[col.id]);
            if (col.type === 'singleSelect' || col.type === 'multiSelect') {
              const c = getTagColor(val);
              return (
                <span key={col.id} className="tables-kanban-card-meta-tag" style={{ background: c.bg, color: c.text }}>
                  {val}
                </span>
              );
            }
            return (
              <span key={col.id} className="tables-kanban-card-meta-tag">
                {val}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Kanban column (droppable) ──────────────────────────────────────

function KanbanColumn({
  option,
  rows,
  columns,
  groupColumnId,
}: {
  option: string;
  rows: TableRow[];
  columns: TableColumn[];
  groupColumnId: string;
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: option });

  return (
    <div
      ref={setNodeRef}
      className={`tables-kanban-column${isOver ? ' drop-target' : ''}`}
    >
      <div className="tables-kanban-column-header">
        <span className="tables-kanban-column-title">{option || t('tables.noValue')}</span>
        <span className="tables-kanban-column-count">{rows.length}</span>
      </div>
      <div className="tables-kanban-column-body">
        {rows.length === 0 ? (
          <div className="tables-kanban-column-empty">{t('tables.noItems')}</div>
        ) : (
          rows.map((row) => (
            <KanbanCard key={row._id} row={row} columns={columns} groupColumnId={groupColumnId} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── KanbanView ─────────────────────────────────────────────────────

export function KanbanView({
  columns,
  rows,
  viewConfig,
  onViewConfigUpdate,
  triggerAutoSave,
}: {
  columns: TableColumn[];
  rows: TableRow[];
  viewConfig: TableViewConfig;
  onViewConfigUpdate: (updated: TableViewConfig) => void;
  triggerAutoSave: (updates: { rows?: TableRow[]; viewConfig?: TableViewConfig }) => void;
}) {
  const { t } = useTranslation();
  const { canEdit } = useAppActions('tables');
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const kanbanGroupCol = columns.find(
    (c) => c.id === viewConfig.kanbanGroupByColumnId && c.type === 'singleSelect',
  );

  // If no kanban group column is set, try to auto-pick the first singleSelect
  const effectiveKanbanCol = kanbanGroupCol ?? columns.find((c) => c.type === 'singleSelect');

  const selectColumns = columns.filter((c) => c.type === 'singleSelect');

  const kanbanGroups = useMemo(() => {
    if (!effectiveKanbanCol) return null;
    const opts = effectiveKanbanCol.options || [];
    const grouped: Record<string, TableRow[]> = {};
    for (const opt of opts) {
      grouped[opt] = [];
    }
    grouped[''] = []; // uncategorized
    for (const row of rows) {
      const val = String(row[effectiveKanbanCol.id] || '');
      if (!grouped[val]) grouped[val] = [];
      grouped[val].push(row);
    }
    return grouped;
  }, [effectiveKanbanCol, rows]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (!canEdit) return;
    setDraggedRowId(event.active.id as string);
  }, [canEdit]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggedRowId(null);
      if (!canEdit) return;
      if (!event.over || !effectiveKanbanCol) return;

      const rowId = event.active.id as string;
      const newValue = event.over.id as string;

      const updatedRows = rows.map((r) =>
        r._id === rowId ? { ...r, [effectiveKanbanCol.id]: newValue } : r,
      );
      triggerAutoSave({ rows: updatedRows });
    },
    [effectiveKanbanCol, rows, triggerAutoSave, canEdit],
  );

  const draggedRow = draggedRowId ? rows.find((r) => r._id === draggedRowId) : null;

  return (
    <>
      {/* Kanban group-by selector in toolbar - rendered by parent */}

      {!effectiveKanbanCol ? (
        <div className="tables-kanban-no-group">
          <Kanban size={36} style={{ opacity: 0.3 }} />
          <div>{t('tables.kanbanNoSelectColumn')}</div>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="tables-kanban-board">
            {kanbanGroups &&
              Object.entries(kanbanGroups).map(([option, groupRows]) => (
                <KanbanColumn
                  key={option}
                  option={option}
                  rows={groupRows}
                  columns={columns}
                  groupColumnId={effectiveKanbanCol.id}
                />
              ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {draggedRow ? (
              <div
                className="tables-kanban-card"
                style={{
                  transform: 'rotate(3deg)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                  cursor: 'grabbing',
                }}
              >
                <div className="tables-kanban-card-title">
                  {(() => {
                    const titleCol = columns.find((c) => c.type === 'text' && c.id !== effectiveKanbanCol?.id);
                    return titleCol ? String(draggedRow[titleCol.id] || 'Untitled') : 'Untitled';
                  })()}
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </>
  );
}

// Export for toolbar use
export function KanbanToolbarSelector({
  columns,
  viewConfig,
  effectiveKanbanColId,
  onViewConfigUpdate,
  triggerAutoSave,
}: {
  columns: TableColumn[];
  viewConfig: TableViewConfig;
  effectiveKanbanColId: string | undefined;
  onViewConfigUpdate: (updated: TableViewConfig) => void;
  triggerAutoSave: (updates: { viewConfig?: TableViewConfig }) => void;
}) {
  const selectColumns = columns.filter((c) => c.type === 'singleSelect');
  if (viewConfig.activeView !== 'kanban' || selectColumns.length === 0) return null;

  return (
    <Select
      value={viewConfig.kanbanGroupByColumnId || effectiveKanbanColId || ''}
      onChange={(v) => {
        const updated = { ...viewConfig, kanbanGroupByColumnId: v };
        onViewConfigUpdate(updated);
        triggerAutoSave({ viewConfig: updated });
      }}
      options={selectColumns.map((c) => ({ value: c.id, label: c.name }))}
      size="sm"
      width={160}
    />
  );
}
