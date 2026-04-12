import { useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type ICellRendererParams,
} from 'ag-grid-community';
import {
  Plus,
  Trash2,
  RotateCcw,
  Table2,
  LayoutGrid,
  Kanban,
  Search,
  X,
  Undo2,
  Redo2,
  CheckSquare,
  ChevronDown,
  Calendar,
  Maximize2,
  LayoutTemplate,
  GalleryHorizontalEnd,
  Layers,
  Copy,
  Download,
  Group,
  Ungroup,
  Upload,
  Loader2,
  Check,
  Settings2,
} from 'lucide-react';
import type { TableRow } from '@atlas-platform/shared';
import { isGroupHeaderRow } from './hooks/use-row-grouping';
import type { MaybeGroupedRow } from './hooks/use-row-grouping';
import { isFormulaValue } from '../../lib/formula-engine';
import { Button } from '../../components/ui/button';
import { IconButton } from '../../components/ui/icon-button';
import { Select } from '../../components/ui/select';
import { FeatureEmptyState } from '../../components/ui/feature-empty-state';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Avatar } from '../../components/ui/avatar';
import { useTenantUsers } from '../../hooks/use-platform';
import { useAuthStore } from '../../stores/auth-store';

// Extracted modules
import { PLACEHOLDER_ROW_ID, ROW_HEIGHT_MAP, getTemplateIcon } from './lib/table-constants';
import { buildColDefs, type BuildColDefsSettings } from './lib/build-col-defs';
import { TABLE_TEMPLATES } from './lib/table-template-data';
import { RowNumberHeader, AddColumnHeader } from './components/renderers/row-number-renderer';
import { AddColumnPopover } from './components/AddColumnPopover';
import { TableTemplateGallery } from './components/TableTemplateGallery';
import { ImportModal } from './components/ImportModal';
import { KanbanView } from './components/views/KanbanView';
import { CalendarView } from './components/views/CalendarView';
import { GalleryView } from './components/views/GalleryView';
import { ColumnHeaderMenu } from './components/ColumnHeaderMenu';
import { TableHeaderDropdown, getTableIcon } from './components/TableHeaderDropdown';
import { RowContextMenu } from './components/RowContextMenu';
import { SortPopover } from './components/SortPopover';
import { FilterPopover } from './components/FilterPopover';
import { ExpandRowModal } from './components/ExpandRowModal';
import { RowHeightPopover } from './components/RowHeightPopover';
import { HideFieldsPopover } from './components/HideFieldsPopover';
import { RowColorPopover } from './components/RowColorPopover';
import { FindReplaceBar } from './components/FindReplaceBar';
import { BatchEditOverlay } from './components/BatchEditOverlay';
import { GroupHeaderRenderer } from './components/GroupHeaderRow';
import { FormulaBar } from './components/FormulaBar';
import { useTablesPageState } from './hooks/use-tables-page-state';

import '../../styles/tables.css';
import '../../styles/docs.css';

ModuleRegistry.registerModules([AllCommunityModule]);

export function TablesPage() {
  const state = useTablesPageState();
  const {
    t, selectedId, searchQuery, setSearchQuery, showAddColumn, setShowAddColumn,
    showTrash, setShowTrash, showTemplates, setShowTemplates, deleteConfirmId, setDeleteConfirmId,
    showSaved, isSaving,
    canEdit, canDeleteTable,
    localColumns, localRows, localViewConfig, setLocalViewConfig, localTitle,
    showSearch, setShowSearch, searchText, setSearchText,
    columnMenu, setColumnMenu, rowMenu, setRowMenu, expandedRowId, setExpandedRowId,
    selectedRowIds,
    importModalData, setImportModalData,
    attachmentInputRef,
    showAddViewDropdown, setShowAddViewDropdown, addViewBtnRef, addViewDropdownRef,
    showHeaderDropdown, setShowHeaderDropdown, headerChevronRef,
    localColor, setLocalColor, localIcon, setLocalIcon, localGuide, setLocalGuide,
    canUndo, canRedo,
    filteredRows, sortedRows, rowData, isGrouped,
    footerAgg, gridRef,
    rangeContext, handleRangeCellMouseDown,
    clearRange, rangeVersion, getSelectedCellCount,
    findReplace, fillHandle,
    showBatchEdit, setShowBatchEdit,
    focusedCellInfo, isDark,
    allTables, archivedTables, filteredTables, listLoading,
    spreadsheet, openSettings,
    getComputedValue, getCellReference,
    toggleGroup,
    pinnedBottomRowData, getRowStyle,
    hiddenColumnsSet, handleColumnMenuOpen,
    effectiveKanbanCol, selectColumns, getRowId,
    currentViews,
    triggerAutoSave,
    handleUndo, handleRedo,
    handleSelectTable, handleCreateTable, handleCreateFromTemplate,
    handleDeleteTable, confirmDeleteTable, handleRestoreTable,
    handleTitleChange, handleAddColumn, handleAddRow, handleDeleteRow,
    handleRenameColumn, handleDeleteColumn, handleDuplicateColumn,
    handleChangeColumnType, handleSortByColumn,
    handleInsertRowAbove, handleInsertRowBelow, handleDuplicateRow,
    handleCellContextMenu, handleSelectionChanged,
    handleBulkDelete, handleBulkDuplicate, handleClearSelection,
    handleUpdateRowField, handleAttachmentUpload,
    handleCellClickedWithAttachment, handleCellEditRequest,
    handleCellKeyDown, handleRowDragEnd,
    handleColumnResized, handleColumnMoved,
    handleHideColumn, handleFreezeUpTo, handleUnfreezeColumns,
    handleInsertColumnLeft, handleInsertColumnRight, handleEditColumnDescription,
    handleExportExcel, handleImportCSV, handleFileImport, handleImportConfirm,
    handleGroupByColumn, handleUngroupRows,
    handleBatchEditConfirm, handleFormulaBarEdit,
    handleViewToggle, handleAddView, handleRemoveView,
    importInputRef,
    buildColDefsParams,
  } = state;

  // Row number cell renderer
  const RowNumberRenderer = useCallback((params: ICellRendererParams) => {
    const rowId = (params.data as TableRow)?._id;
    const rowNum = params.node.rowIndex != null ? params.node.rowIndex + 1 : '';
    if (!rowId || rowId === PLACEHOLDER_ROW_ID) {
      return <span className="tables-row-number">{rowNum}</span>;
    }
    const isSelected = params.node.isSelected();
    return (
      <span className="tables-row-number-wrap">
        <span className={`tables-row-number-checkbox${isSelected ? ' is-checked' : ''}`}
          onClick={(e) => { e.stopPropagation(); params.node.setSelected(!isSelected); }}>
          <span className="tables-row-num-text">{rowNum}</span>
          <span className="tables-row-cb-icon">{isSelected ? <CheckSquare size={14} /> : <span className="tables-row-cb-empty" />}</span>
        </span>
        <button className="tables-row-expand-btn" onClick={(e) => { e.stopPropagation(); setExpandedRowId(rowId); }} title={t('tables.expandRow')}>
          <Maximize2 size={12} />
        </button>
      </span>
    );
  }, [t]);

  // Column defs
  const ROW_NUMBER_COL: ColDef = useMemo(() => ({
    colId: '__row_number__', headerName: '', headerComponent: RowNumberHeader,
    width: 80, maxWidth: 80, minWidth: 80, pinned: 'left', editable: false, sortable: false,
    resizable: false, suppressMovable: true, lockPosition: 'left', rowDrag: true,
    cellRenderer: RowNumberRenderer, cellStyle: { padding: 0 },
  }), [RowNumberRenderer]);

  const ADD_COLUMN_COL: ColDef = useMemo(() => ({
    headerName: '', width: 44, maxWidth: 44, minWidth: 44, editable: false, sortable: false,
    resizable: false, suppressMovable: true,
    headerComponent: () => <AddColumnHeader setShowAddColumn={setShowAddColumn} />,
    cellRenderer: () => null,
  }), []);

  const columnDefs = useMemo(() => {
    const { localColumns: cols, t: tFn, handleColumnMenuOpen: menuOpen, hiddenColumnsSet: hidden, frozenColumnCount, handleRangeHeaderClicked, tablesSettings: ts, linkedTablesMap: ltm, getComputedValue: gcv } = buildColDefsParams;
    const colSettings: BuildColDefsSettings = { dateFormat: ts.dateFormat, currencySymbol: ts.currencySymbol, showFieldTypeIcons: ts.showFieldTypeIcons, canEdit };
    const baseDefs = buildColDefs(cols, tFn, menuOpen, hidden, frozenColumnCount, handleRangeHeaderClicked, colSettings, ltm);
    const formulaDefs: ColDef[] = baseDefs.map((def) => {
      if (!def.field) return def;
      const fieldId = def.field;
      return { ...def, valueGetter: (params) => {
        const data = params.data as TableRow | undefined;
        if (!data) return '';
        const raw = data[fieldId];
        return isFormulaValue(raw) ? gcv(data._id, fieldId, raw) : raw;
      }} as ColDef;
    });
    return [ROW_NUMBER_COL, ...formulaDefs, ADD_COLUMN_COL];
  }, [buildColDefsParams, ROW_NUMBER_COL, ADD_COLUMN_COL, canEdit]);

  return (
    <div className="tables-page">
      {/* Sidebar */}
      <AppSidebar state={state} />

      {/* Main content */}
      <div className="tables-main">
        {showTemplates ? (
          <TableTemplateGallery onSelect={(tpl) => handleCreateFromTemplate(tpl)} onClose={() => setShowTemplates(false)} />
        ) : !selectedId || !spreadsheet ? (
          <EmptyState state={state} />
        ) : (
          <>
            <TopBar state={state} />
            <Toolbar state={state} />
            {showSearch && <SearchBar state={state} />}
            {findReplace.isOpen && <FindReplaceBar searchTerm={findReplace.searchTerm} onSearchChange={findReplace.setSearchTerm} replaceTerm={findReplace.replaceTerm} onReplaceChange={findReplace.setReplaceTerm} caseSensitive={findReplace.caseSensitive} onCaseSensitiveToggle={() => findReplace.setCaseSensitive(!findReplace.caseSensitive)} matchCount={findReplace.matches.length} currentIndex={findReplace.currentMatchIndex} onNext={findReplace.goToNext} onPrev={findReplace.goToPrev} onReplace={findReplace.replaceCurrent} onReplaceAll={findReplace.replaceAll} onClose={findReplace.close} />}
            {localViewConfig.activeView === 'grid' && <FormulaBar cellRef={focusedCellInfo ? getCellReference(focusedCellInfo.rowIndex, focusedCellInfo.colId) : ''} rawValue={focusedCellInfo ? String(localRows.find((r) => r._id === focusedCellInfo.rowId)?.[focusedCellInfo.colId] ?? '') : ''} computedValue={focusedCellInfo ? getComputedValue(focusedCellInfo.rowId, focusedCellInfo.colId, localRows.find((r) => r._id === focusedCellInfo.rowId)?.[focusedCellInfo.colId]) : ''} isFormula={focusedCellInfo ? isFormulaValue(localRows.find((r) => r._id === focusedCellInfo.rowId)?.[focusedCellInfo.colId]) : false} onEdit={handleFormulaBarEdit} />}

            {/* Grid view */}
            {localViewConfig.activeView === 'grid' && (
              <>
                <div className="tables-grid-container" onMouseDown={handleRangeCellMouseDown} onContextMenu={(e) => e.preventDefault()} style={{ position: 'relative' }}>
                  <div className={isDark ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'}>
                    <AgGridReact ref={gridRef} columnDefs={columnDefs} rowData={rowData} getRowId={getRowId}
                      rowHeight={ROW_HEIGHT_MAP[localViewConfig.rowHeight || 'medium']} readOnlyEdit={true}
                      onCellEditRequest={handleCellEditRequest} onCellKeyDown={handleCellKeyDown}
                      onCellClicked={handleCellClickedWithAttachment} onCellEditingStarted={() => clearRange()}
                      onColumnResized={handleColumnResized} onColumnMoved={handleColumnMoved}
                      rowDragManaged={false} onRowDragEnd={handleRowDragEnd} animateRows={true} undoRedoCellEditing={false}
                      suppressDragLeaveHidesColumns={true}
                      suppressMoveWhenRowDragging={true} rowSelection={{ mode: 'multiRow', checkboxes: false, headerCheckbox: false }}
                      onSelectionChanged={handleSelectionChanged}
                      ensureDomOrder={true} suppressContextMenu={true} onCellContextMenu={handleCellContextMenu}
                      pinnedBottomRowData={isGrouped ? undefined : pinnedBottomRowData} getRowStyle={getRowStyle} quickFilterText={searchText}
                      isFullWidthRow={(params) => isGroupHeaderRow(params.rowNode.data as MaybeGroupedRow)}
                      fullWidthCellRenderer={(params: ICellRendererParams) => <GroupHeaderRenderer data={params.data} context={params.context} />}
                      context={{ deleteRow: handleDeleteRow, ...rangeContext, findMatchSet: findReplace.matchSet, findCurrentMatchKey: findReplace.currentMatchKey,
                        toggleGroup, groupByColumnType: localViewConfig.groupByColumnId ? localColumns.find((c) => c.id === localViewConfig.groupByColumnId)?.type : undefined }} />
                  </div>
                  {fillHandle.handlePos && <div className="fill-handle" style={{ position: 'absolute', top: fillHandle.handlePos.top, left: fillHandle.handlePos.left, width: 8, height: 8, background: 'var(--color-accent-primary)', borderRadius: 1, cursor: 'crosshair', zIndex: 10 }} onMouseDown={fillHandle.handleMouseDown} />}
                  {showBatchEdit && <BatchEditOverlay cellCount={getSelectedCellCount()} onConfirm={handleBatchEditConfirm} onCancel={() => setShowBatchEdit(false)} />}
                  {selectedRowIds.length > 0 && (
                    <div className="tables-selection-float">
                      <span className="tables-selection-float-count">{selectedRowIds.length}</span>
                      {canEdit && <IconButton icon={<Copy size={13} />} label={t('tables.duplicateSelected')} onClick={handleBulkDuplicate} size={28} style={{ color: 'inherit' }} />}
                      {canDeleteTable && <IconButton icon={<Trash2 size={13} />} label={t('tables.deleteSelected')} onClick={handleBulkDelete} destructive size={28} />}
                      <IconButton icon={<X size={13} />} label={t('tables.clearSelection')} onClick={handleClearSelection} size={28} style={{ color: 'inherit' }} />
                    </div>
                  )}
                </div>
                <div className="tables-footer">
                  {canEdit && <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={handleAddRow} className="tables-footer-btn">{t('tables.addRow')}</Button>}
                  <span>{filteredRows.length !== localRows.length ? t('tables.filteredRowCount', { filtered: filteredRows.length, total: localRows.length }) : t('tables.rowCount', { count: localRows.length })}</span>
                  {rangeVersion > 0 && getSelectedCellCount() > 0 && <span className="tables-footer-agg">{t('tables.cellsSelected', { count: getSelectedCellCount() })}</span>}
                  {footerAgg && <span className="tables-footer-agg">{footerAgg.label}: {footerAgg.sum} {t('tables.sum')} · {footerAgg.avg} {t('tables.avg')}</span>}
                </div>
              </>
            )}

            {localViewConfig.activeView === 'kanban' && <KanbanView columns={localColumns} rows={localRows} viewConfig={localViewConfig} onViewConfigUpdate={(updated) => setLocalViewConfig(updated)} triggerAutoSave={(updates) => { if (updates.rows) state.setLocalRows(updates.rows); triggerAutoSave(updates); }} />}
            {localViewConfig.activeView === 'calendar' && <CalendarView columns={localColumns} rows={sortedRows} viewConfig={localViewConfig} onViewConfigUpdate={(updated) => setLocalViewConfig(updated)} triggerAutoSave={triggerAutoSave} onExpandRow={(rowId) => setExpandedRowId(rowId)} />}
            {localViewConfig.activeView === 'gallery' && <GalleryView columns={localColumns} rows={sortedRows} onExpandRow={(rowId) => setExpandedRowId(rowId)} />}
          </>
        )}
      </div>

      {/* Context menus & modals */}
      {columnMenu && (() => {
        const col = localColumns.find((c) => c.id === columnMenu.columnId);
        if (!col) return null;
        return <ColumnHeaderMenu columnId={columnMenu.columnId} columnName={col.name} columnType={col.type} columnDescription={col.description} columnIndex={localColumns.findIndex((c) => c.id === columnMenu.columnId)} frozenCount={localViewConfig.frozenColumnCount || 0} x={columnMenu.x} y={columnMenu.y} onClose={() => setColumnMenu(null)} onRename={handleRenameColumn} onDelete={handleDeleteColumn} onDuplicate={handleDuplicateColumn} onChangeType={handleChangeColumnType} onSortAsc={(colId) => handleSortByColumn(colId, 'asc')} onSortDesc={(colId) => handleSortByColumn(colId, 'desc')} onHide={handleHideColumn} onFreeze={handleFreezeUpTo} onUnfreeze={handleUnfreezeColumns} onInsertLeft={handleInsertColumnLeft} onInsertRight={handleInsertColumnRight} onEditDescription={handleEditColumnDescription} onGroupBy={handleGroupByColumn} onUngroup={handleUngroupRows} isGroupedBy={localViewConfig.groupByColumnId === columnMenu.columnId} canEdit={canEdit} canDelete={canDeleteTable} />;
      })()}
      {rowMenu && <RowContextMenu rowId={rowMenu.rowId} x={rowMenu.x} y={rowMenu.y} onClose={() => setRowMenu(null)} onInsertAbove={handleInsertRowAbove} onInsertBelow={handleInsertRowBelow} onDuplicate={handleDuplicateRow} onExpand={(rowId) => setExpandedRowId(rowId)} onDelete={handleDeleteRow} canEdit={canEdit} canDelete={canDeleteTable} />}
      {expandedRowId && (() => {
        const rowIdx = localRows.findIndex((r) => r._id === expandedRowId);
        const row = rowIdx >= 0 ? localRows[rowIdx] : undefined;
        if (!row) return null;
        return <ExpandRowModal row={row} columns={localColumns} spreadsheetId={selectedId || undefined} open={true} onOpenChange={(open) => { if (!open) setExpandedRowId(null); }} onUpdateField={handleUpdateRowField} onNavigateRow={(direction) => { const nextIdx = direction === 'prev' ? rowIdx - 1 : rowIdx + 1; if (nextIdx >= 0 && nextIdx < localRows.length) setExpandedRowId(localRows[nextIdx]._id); }} onAddColumn={handleAddColumn} hasPrev={rowIdx > 0} hasNext={rowIdx < localRows.length - 1} />;
      })()}

      <input type="file" ref={attachmentInputRef} style={{ display: 'none' }} onChange={handleAttachmentUpload} />
      <input type="file" ref={importInputRef} accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFileImport} />
      <style>{`.tables-sidebar-item:hover .tables-sidebar-delete-btn { opacity: 1 !important; }`}</style>
      {importModalData && <ImportModal data={importModalData} onDataChange={setImportModalData} onConfirm={handleImportConfirm} onClose={() => setImportModalData(null)} />}
      <ConfirmDialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }} title={t('tables.confirmDeleteTitle', 'Move to trash?')} description={t('tables.confirmDeleteDescription', 'This table will be moved to trash. You can restore it later.')} confirmLabel={t('tables.moveToTrash', 'Move to trash')} onConfirm={confirmDeleteTable} />
    </div>
  );
}

// ─── Inline sub-components (keep page.tsx readable) ─────────────────

import { AppSidebar as AppSidebarLayout } from '../../components/layout/app-sidebar';

function AppSidebar({ state }: { state: ReturnType<typeof useTablesPageState> }) {
  const { t, searchQuery, setSearchQuery, showTrash, setShowTrash, showTemplates, setShowTemplates, selectedId, localViewConfig, filteredTables, archivedTables, listLoading, handleSelectTable, handleCreateTable, handleDeleteTable, handleRestoreTable, handleViewToggle, openSettings, perm, currentUserId } = state;
  const canCreate = perm.canCreate;
  const tenantId = useAuthStore((s) => s.tenantId);
  const { data: tenantUsers } = useTenantUsers(tenantId ?? undefined);
  const userMap = useMemo(() => {
    const map = new Map<string, { name: string | null; email: string }>();
    for (const u of tenantUsers ?? []) map.set(u.userId, { name: u.name, email: u.email });
    return map;
  }, [tenantUsers]);
  return (
    <AppSidebarLayout storageKey="atlas_tables_sidebar" title={t('tables.title')}
      headerAction={<div style={{ display: 'flex', gap: 2 }}>{canCreate && <IconButton icon={<LayoutTemplate size={14} />} label={t('tables.browseTemplates')} onClick={() => setShowTemplates(true)} size={28} />}{canCreate && <IconButton icon={<Plus size={14} />} label={t('tables.newTable')} onClick={handleCreateTable} size={28} />}</div>}
      search={<div className="tables-sidebar-search"><input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('tables.searchTables')} /></div>}
      footer={<><div className="tables-sidebar-views">{[{ key: 'grid' as const, icon: LayoutGrid, label: t('tables.gridView', 'Grid view') }, { key: 'kanban' as const, icon: Kanban, label: t('tables.kanbanView', 'Kanban') }, { key: 'calendar' as const, icon: Calendar, label: t('tables.calendarView', 'Calendar') }, { key: 'gallery' as const, icon: GalleryHorizontalEnd, label: t('tables.galleryView', 'Gallery') }].map((v) => (<button key={v.key} className={`tables-sidebar-view-item${localViewConfig.activeView === v.key ? ' active' : ''}`} onClick={() => handleViewToggle(v.key)}><v.icon size={14} /><span>{v.label}</span></button>))}</div><button className="tables-sidebar-view-item" onClick={() => openSettings('tables')} title={t('tables.tableSettings')}><Settings2 size={14} /><span>{t('tables.tableSettings')}</span></button></>}>
      <div className="tables-sidebar-list">
        {filteredTables.length === 0 && !listLoading && <div className="tables-sidebar-empty">{t('tables.noTables')}</div>}
        {filteredTables.map((table) => { const SidebarIcon = getTableIcon(table.icon); const canDeleteThis = perm.canDelete || (perm.canDeleteOwn && table.userId === currentUserId); const owner = table.userId !== currentUserId ? userMap.get(table.userId) : null; const ownerLabel = owner ? t('tables.createdBy', { name: owner.name || owner.email, defaultValue: 'Created by {{name}}' }) : undefined; return (<div key={table.id} role="button" tabIndex={0} className={`tables-sidebar-item${selectedId === table.id ? ' active' : ''}`} onClick={() => handleSelectTable(table.id)} onKeyDown={(e) => { if (e.key === 'Enter') handleSelectTable(table.id); }}><SidebarIcon size={14} style={table.color ? { color: table.color } : undefined} /><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{table.title}</span>{owner && <span title={ownerLabel} style={{ display: 'inline-flex', flexShrink: 0 }}><Avatar name={owner.name} email={owner.email} size={16} /></span>}{canDeleteThis && <IconButton icon={<Trash2 size={12} />} label={t('tables.delete')} onClick={(e) => { e.stopPropagation(); handleDeleteTable(table.id); }} size={22} destructive tooltip={false} className="tables-sidebar-delete-btn" style={{ opacity: 0, transition: 'opacity 100ms' }} />}</div>); })}
        {archivedTables.length > 0 && (<><button className="tables-sidebar-item" onClick={() => setShowTrash(!showTrash)} style={{ marginTop: 8 }}><Trash2 size={14} /><span>{t('tables.trash')}</span><span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-tertiary)' }}>{archivedTables.length}</span></button>{showTrash && archivedTables.map((table) => (<div key={table.id} className="tables-sidebar-item archived"><Table2 size={14} /><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{table.title}</span><IconButton icon={<RotateCcw size={12} />} label={t('tables.restore')} onClick={(e) => { e.stopPropagation(); handleRestoreTable(table.id); }} size={22} /></div>))}</>)}
      </div>
    </AppSidebarLayout>
  );
}

function EmptyState({ state }: { state: ReturnType<typeof useTablesPageState> }) {
  const { t, handleCreateTable, handleCreateFromTemplate, canCreate } = state;
  return (
    <div className="tables-empty-state">
      <FeatureEmptyState illustration="table" title={t('tables.empty.title')} description={t('tables.empty.desc')}
        highlights={[{ icon: <Table2 size={14} />, title: t('tables.empty.h1Title'), description: t('tables.empty.h1Desc') }, { icon: <Layers size={14} />, title: t('tables.empty.h2Title'), description: t('tables.empty.h2Desc') }, { icon: <LayoutGrid size={14} />, title: t('tables.empty.h3Title'), description: t('tables.empty.h3Desc') }]}
        actionLabel={canCreate ? t('tables.newTable') : undefined} actionIcon={canCreate ? <Plus size={14} /> : undefined} onAction={canCreate ? handleCreateTable : undefined} />
      {canCreate && <div className="tables-templates-section">
        <div className="tables-templates-label">{t('tables.startFromTemplate')}</div>
        <div className="tables-templates-grid">{TABLE_TEMPLATES.slice(0, 6).map((tpl) => { const Icon = getTemplateIcon(tpl.icon); return (<button key={tpl.key} className="tables-template-card" onClick={() => handleCreateFromTemplate(tpl)}><Icon size={24} style={{ color: 'var(--color-text-secondary)' }} /><span className="tables-template-name">{tpl.name}</span></button>); })}</div>
      </div>}
    </div>
  );
}

function TopBar({ state }: { state: ReturnType<typeof useTablesPageState> }) {
  const { t, localTitle, localColor, localIcon, localGuide, handleTitleChange, triggerAutoSave, showHeaderDropdown, setShowHeaderDropdown, headerChevronRef, setLocalColor, setLocalIcon, setLocalGuide, setLocalTitle, canUndo, canRedo, handleUndo, handleRedo, handleExportExcel, handleImportCSV, showSearch, setShowSearch, setSearchText, isSaving, showSaved, currentViews, localViewConfig, handleViewToggle, handleRemoveView, showAddViewDropdown, setShowAddViewDropdown, addViewBtnRef, addViewDropdownRef, handleAddView, canEdit } = state;
  return (
    <div className="tables-topbar" style={localColor ? { background: localColor } : undefined}>
      <div className="tables-topbar-row">
        <input className="tables-topbar-title" value={localTitle} onChange={(e) => handleTitleChange(e.target.value)} onBlur={() => triggerAutoSave({ title: localTitle })} readOnly={!canEdit} disabled={!canEdit} />
        <IconButton ref={headerChevronRef} icon={<ChevronDown size={14} />} label={t('tables.tableSettings')} onClick={() => setShowHeaderDropdown(!showHeaderDropdown)} size={28} className="tables-topbar-chevron" style={{ color: 'inherit' }} disabled={!canEdit} />
        {showHeaderDropdown && <TableHeaderDropdown title={localTitle} color={localColor} icon={localIcon} guide={localGuide} anchorRect={headerChevronRef.current?.getBoundingClientRect() ?? null} onTitleChange={(title) => { setLocalTitle(title); triggerAutoSave({ title }); }} onColorChange={(color) => { setLocalColor(color); triggerAutoSave({ color: color ?? '' }); }} onIconChange={(icon) => { setLocalIcon(icon); triggerAutoSave({ icon: icon ?? '' }); }} onGuideChange={(guide) => { setLocalGuide(guide); triggerAutoSave({ guide }); }} onClose={() => setShowHeaderDropdown(false)} />}
        <div className="tables-topbar-spacer" />
        <IconButton icon={<Undo2 size={14} />} label={t('tables.undo')} onClick={handleUndo} disabled={!canUndo} size={28} style={{ color: 'inherit' }} />
        <IconButton icon={<Redo2 size={14} />} label={t('tables.redo')} onClick={handleRedo} disabled={!canRedo} size={28} style={{ color: 'inherit' }} />
        <IconButton icon={<Download size={14} />} label={t('tables.exportExcel')} onClick={handleExportExcel} size={28} style={{ color: 'inherit' }} />
        <IconButton icon={<Upload size={14} />} label={t('tables.importCsv')} onClick={handleImportCSV} size={28} style={{ color: 'inherit' }} />
        <IconButton icon={<Search size={14} />} label={t('tables.search')} onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchText(''); }} active={showSearch} size={28} style={{ color: 'inherit' }} />
        {isSaving && <span className="tables-topbar-saving" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Loader2 size={12} className="tables-spin" />{t('tables.saving')}</span>}
        {!isSaving && showSaved && <span className="tables-topbar-saving" style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Check size={12} />{t('tables.saved')}</span>}
      </div>
      <div className="tables-topbar-view-tabs">
        {currentViews.map((v, idx) => {
          const VIEW_ICONS: Record<string, typeof LayoutGrid> = { grid: LayoutGrid, kanban: Kanban, calendar: Calendar, gallery: GalleryHorizontalEnd };
          const Icon = VIEW_ICONS[v.key] || LayoutGrid;
          return (<button key={`${v.key}-${idx}`} className={`tables-topbar-view-tab${localViewConfig.activeView === v.key ? ' active' : ''}`} onClick={() => handleViewToggle(v.key)}><Icon size={13} /><span>{v.label}</span>{currentViews.length > 1 && <span className="tables-topbar-view-tab-close" onClick={(e) => { e.stopPropagation(); handleRemoveView(idx); }}><X size={11} /></span>}</button>);
        })}
        <button ref={addViewBtnRef} className="tables-topbar-view-tab tables-topbar-view-add" onClick={() => setShowAddViewDropdown(!showAddViewDropdown)} title={t('tables.addView')}><Plus size={13} /></button>
        {showAddViewDropdown && (() => {
          const rect = addViewBtnRef.current?.getBoundingClientRect();
          return createPortal(<div ref={addViewDropdownRef} className="tables-add-view-dropdown" style={{ position: 'fixed', top: rect ? rect.bottom + 4 : 0, left: rect ? rect.left : 0 }}>{[{ key: 'grid' as const, icon: LayoutGrid, label: t('tables.gridView') }, { key: 'kanban' as const, icon: Kanban, label: t('tables.kanbanView') }, { key: 'calendar' as const, icon: Calendar, label: t('tables.calendarView') }, { key: 'gallery' as const, icon: GalleryHorizontalEnd, label: t('tables.galleryView') }].map((v) => (<button key={v.key} className="tables-add-view-option" onClick={() => handleAddView(v.key, v.label)}><v.icon size={14} /><span>{v.label}</span></button>))}</div>, document.body);
        })()}
      </div>
    </div>
  );
}

function Toolbar({ state }: { state: ReturnType<typeof useTablesPageState> }) {
  const { t, showAddColumn, setShowAddColumn, localColumns, localViewConfig, setLocalViewConfig, allTables, triggerAutoSave, handleAddColumn, handleGroupByColumn, handleUngroupRows, effectiveKanbanCol, selectColumns, canEdit } = state;
  return (
    <div className="tables-toolbar">
      {canEdit && <div style={{ position: 'relative' }}>
        <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={() => setShowAddColumn(!showAddColumn)}>{t('tables.column')}</Button>
        {showAddColumn && <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 100 }}><AddColumnPopover onAdd={handleAddColumn} onClose={() => setShowAddColumn(false)} tables={allTables.map((t) => ({ id: t.id, title: t.title }))} /></div>}
      </div>}
      <HideFieldsPopover columns={localColumns} viewConfig={localViewConfig} onUpdate={(hiddenColumns) => { const updated = { ...localViewConfig, hiddenColumns }; setLocalViewConfig(updated); triggerAutoSave({ viewConfig: updated }); }} />
      <SortPopover columns={localColumns} viewConfig={localViewConfig} onUpdate={(sorts) => { const updated = { ...localViewConfig, sorts }; setLocalViewConfig(updated); triggerAutoSave({ viewConfig: updated }); }} />
      <FilterPopover columns={localColumns} viewConfig={localViewConfig} onUpdate={(filters) => { const updated = { ...localViewConfig, filters }; setLocalViewConfig(updated); triggerAutoSave({ viewConfig: updated }); }} />
      {localViewConfig.groupByColumnId ? (
        <Button variant="ghost" size="sm" icon={<Ungroup size={14} />} onClick={handleUngroupRows} style={{ background: 'var(--color-surface-active)' }}>{t('tables.ungroup')}</Button>
      ) : (
        <div style={{ position: 'relative' }}><Button variant="ghost" size="sm" icon={<Group size={14} />} onClick={() => { const selectCol = localColumns.find((c) => c.type === 'singleSelect'); if (selectCol) handleGroupByColumn(selectCol.id); }} disabled={!localColumns.some((c) => c.type === 'singleSelect')} style={{ opacity: localColumns.some((c) => c.type === 'singleSelect') ? 1 : 0.4 }}>{t('tables.group')}</Button></div>
      )}
      <RowHeightPopover viewConfig={localViewConfig} onUpdate={(rowHeight) => { const updated = { ...localViewConfig, rowHeight }; setLocalViewConfig(updated); triggerAutoSave({ viewConfig: updated }); }} />
      <RowColorPopover columns={localColumns} viewConfig={localViewConfig} onUpdate={(mode, columnId) => { const updated = { ...localViewConfig, rowColorMode: mode, rowColorColumnId: columnId }; setLocalViewConfig(updated); triggerAutoSave({ viewConfig: updated }); }} />
      <div className="tables-toolbar-spacer" />
      {localViewConfig.activeView === 'kanban' && selectColumns.length > 0 && <Select value={localViewConfig.kanbanGroupByColumnId || effectiveKanbanCol?.id || ''} onChange={(v) => { const updated = { ...localViewConfig, kanbanGroupByColumnId: v }; setLocalViewConfig(updated); triggerAutoSave({ viewConfig: updated }); }} options={selectColumns.map((c) => ({ value: c.id, label: c.name }))} size="sm" width={160} />}
    </div>
  );
}

function SearchBar({ state }: { state: ReturnType<typeof useTablesPageState> }) {
  const { t, searchText, setSearchText, setShowSearch } = state;
  return (
    <div className="tables-search-bar">
      <Search size={14} />
      <input autoFocus value={searchText} onChange={(e) => setSearchText(e.target.value)} placeholder={t('tables.searchPlaceholder')} onKeyDown={(e) => { if (e.key === 'Escape') { setShowSearch(false); setSearchText(''); } }} />
      <IconButton icon={<X size={14} />} label={t('tables.closeSearch')} onClick={() => { setShowSearch(false); setSearchText(''); }} size={24} tooltip={false} />
    </div>
  );
}
