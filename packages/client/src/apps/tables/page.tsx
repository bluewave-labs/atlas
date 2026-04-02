import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AgGridReact } from 'ag-grid-react';
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type CellEditRequestEvent,
  type RowDragEndEvent,
  type ICellRendererParams,
  type CellKeyDownEvent,
  type ColumnResizedEvent,
  type ColumnMovedEvent,
  type SelectionChangedEvent,
} from 'ag-grid-community';
import {
  Plus,
  ArrowLeft,
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
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Group,
  Ungroup,
  ExternalLink,
  Paperclip,
  FileIcon,
  Settings2,
  GanttChart,
  Upload,
  Loader2,
  Check,
} from 'lucide-react';
import * as XLSX from 'xlsx';
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
import {
  useTableList,
  useTable,
  useCreateTable,
  useDeleteTable,
  useRestoreTable,
  useAutoSaveTable,
} from './hooks';
import { ROUTES } from '../../config/routes';
import { AppSidebar } from '../../components/layout/app-sidebar';
import type { TableColumn, TableRow, TableFieldType, TableViewConfig, TableAttachment, TableViewTab } from '@atlasmail/shared';
import { api } from '../../lib/api-client';
import { TableCustomHeader } from './components/TableCustomHeader';
import { useCellRangeSelection, isCellInRange } from './hooks/use-cell-range-selection';
import { ColumnHeaderMenu } from './components/ColumnHeaderMenu';
import { TableHeaderDropdown, getTableIcon } from './components/TableHeaderDropdown';
import { RowContextMenu } from './components/RowContextMenu';
import { SortPopover } from './components/SortPopover';
import { FilterPopover } from './components/FilterPopover';
import { ExpandRowModal } from './components/ExpandRowModal';
import { MultiSelectCellEditor } from './components/MultiSelectCellEditor';
import { RichSelectCellEditor } from './components/RichSelectCellEditor';
import { RowHeightPopover } from './components/RowHeightPopover';
import { HideFieldsPopover } from './components/HideFieldsPopover';
import { RowColorPopover } from './components/RowColorPopover';
import { useTablesSettingsStore } from './settings-store';
import { useUIStore } from '../../stores/ui-store';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Modal } from '../../components/ui/modal';
import { useToastStore } from '../../stores/toast-store';
import { FindReplaceBar } from './components/FindReplaceBar';
import { BatchEditOverlay } from './components/BatchEditOverlay';
import { GroupHeaderRenderer } from './components/GroupHeaderRow';
import { FormulaBar } from './components/FormulaBar';
import { useFindReplace } from './hooks/use-find-replace';
import { useFillHandle } from './hooks/use-fill-handle';
import { useRowGrouping, isGroupHeaderRow } from './hooks/use-row-grouping';
import type { MaybeGroupedRow } from './hooks/use-row-grouping';
import { useFormulas } from './hooks/use-formulas';
import { isFormulaValue } from '../../lib/formula-engine';
import { getTagColor } from '../../lib/tag-colors';
import { FIELD_TYPE_ICONS } from '../../lib/field-type-icons';
import { GanttView } from './components/gantt-view';
import { Button } from '../../components/ui/button';
import { IconButton } from '../../components/ui/icon-button';
import { Select } from '../../components/ui/select';
import { FeatureEmptyState } from '../../components/ui/feature-empty-state';
import '../../styles/tables.css';
import '../../styles/docs.css'; // Re-use .tg-* template gallery styles

// ─── AG Grid module registration ────────────────────────────────────

ModuleRegistry.registerModules([AllCommunityModule]);

// ─── Constants ──────────────────────────────────────────────────────

const PLACEHOLDER_ROW_ID = '__placeholder__';
const ROW_HEIGHT_MAP: Record<string, number> = { short: 28, medium: 36, tall: 52, extraTall: 72 };
const LAST_TABLE_KEY = 'atlasmail_tables_last_selected';

const FIELD_TYPES: { value: TableFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'singleSelect', label: 'Single select' },
  { value: 'multiSelect', label: 'Multi select' },
  { value: 'date', label: 'Date' },
  { value: 'url', label: 'URL' },
  { value: 'email', label: 'Email' },
  { value: 'currency', label: 'Currency' },
  { value: 'phone', label: 'Phone' },
  { value: 'rating', label: 'Rating' },
  { value: 'percent', label: 'Percent' },
  { value: 'longText', label: 'Long text' },
  { value: 'attachment', label: 'Attachment' },
  { value: 'linkedRecord', label: 'Linked record' },
  { value: 'lookup', label: 'Lookup' },
  { value: 'rollup', label: 'Rollup' },
];

// ─── Field type icons ───────────────────────────────────────────────

// ─── Default columns/rows for new tables ────────────────────────────

function createDefaultColumns(): TableColumn[] {
  return [
    { id: crypto.randomUUID(), name: 'Name', type: 'text', width: 250 },
    { id: crypto.randomUUID(), name: 'Notes', type: 'longText', width: 300 },
    {
      id: crypto.randomUUID(),
      name: 'Status',
      type: 'singleSelect',
      width: 180,
      options: ['Todo', 'In progress', 'Done'],
    },
  ];
}

function createDefaultRows(count = 3): TableRow[] {
  return Array.from({ length: count }, () => ({
    _id: crypto.randomUUID(),
    _createdAt: new Date().toISOString(),
  }));
}

// ─── Table template types & categories ───────────────────────────────

type TableTemplateCategory = 'Business' | 'Engineering' | 'Marketing' | 'HR & People' | 'Personal' | 'General';

const TABLE_TEMPLATE_CATEGORIES: TableTemplateCategory[] = [
  'Business', 'Engineering', 'Marketing', 'HR & People', 'Personal', 'General',
];

const TABLE_CATEGORY_COLORS: Record<TableTemplateCategory, string> = {
  Business: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  Engineering: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  Marketing: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  'HR & People': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  Personal: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  General: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
};

interface TableTemplate {
  key: string;
  name: string;
  icon: string;
  description: string;
  category: TableTemplateCategory;
  tags: string[];
  createData: () => { title: string; columns: TableColumn[]; rows: TableRow[] };
}

const TABLE_TEMPLATES: TableTemplate[] = [
  // ── Business ──────────────────────────────────────────────────────
  {
    key: 'projectTracker',
    name: 'Project tracker',
    icon: '📋',
    description: 'Tasks, assignees, priorities, due dates, progress',
    category: 'Business',
    tags: ['project', 'tasks', 'management'],
    createData: () => {
      const cols: TableColumn[] = [
        { id: crypto.randomUUID(), name: 'Task', type: 'text', width: 250 },
        { id: crypto.randomUUID(), name: 'Assignee', type: 'text', width: 150 },
        { id: crypto.randomUUID(), name: 'Status', type: 'singleSelect', width: 140, options: ['Not started', 'In progress', 'Done', 'Blocked'] },
        { id: crypto.randomUUID(), name: 'Priority', type: 'singleSelect', width: 120, options: ['Low', 'Medium', 'High', 'Critical'] },
        { id: crypto.randomUUID(), name: 'Due date', type: 'date', width: 130 },
        { id: crypto.randomUUID(), name: 'Progress', type: 'percent', width: 120 },
      ];
      const rows: TableRow[] = [
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Design homepage wireframe', [cols[1].id]: 'Alice', [cols[2].id]: 'In progress', [cols[3].id]: 'High', [cols[5].id]: 60 },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Set up CI/CD pipeline', [cols[1].id]: 'Bob', [cols[2].id]: 'Done', [cols[3].id]: 'Critical', [cols[5].id]: 100 },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Write API documentation', [cols[1].id]: 'Carol', [cols[2].id]: 'Not started', [cols[3].id]: 'Medium', [cols[5].id]: 0 },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'User authentication', [cols[1].id]: 'Alice', [cols[2].id]: 'In progress', [cols[3].id]: 'High', [cols[5].id]: 40 },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Database migration', [cols[1].id]: 'Bob', [cols[2].id]: 'Blocked', [cols[3].id]: 'Critical', [cols[5].id]: 20 },
      ];
      return { title: 'Project tracker', columns: cols, rows };
    },
  },
  {
    key: 'crmContacts',
    name: 'CRM contacts',
    icon: '👥',
    description: 'Leads, deals, pipeline stages, contact info',
    category: 'Business',
    tags: ['crm', 'sales', 'contacts', 'pipeline'],
    createData: () => {
      const cols: TableColumn[] = [
        { id: crypto.randomUUID(), name: 'Name', type: 'text', width: 180 },
        { id: crypto.randomUUID(), name: 'Email', type: 'email', width: 220 },
        { id: crypto.randomUUID(), name: 'Company', type: 'text', width: 160 },
        { id: crypto.randomUUID(), name: 'Phone', type: 'phone', width: 150 },
        { id: crypto.randomUUID(), name: 'Stage', type: 'singleSelect', width: 140, options: ['Lead', 'Qualified', 'Proposal', 'Closed won', 'Closed lost'] },
        { id: crypto.randomUUID(), name: 'Deal value', type: 'currency', width: 120 },
      ];
      const rows: TableRow[] = [
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Jane Cooper', [cols[1].id]: 'jane@acme.com', [cols[2].id]: 'Acme Corp', [cols[3].id]: '(555) 123-4567', [cols[4].id]: 'Qualified', [cols[5].id]: 15000 },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Marcus Chen', [cols[1].id]: 'marcus@globex.com', [cols[2].id]: 'Globex Inc', [cols[3].id]: '(555) 987-6543', [cols[4].id]: 'Proposal', [cols[5].id]: 42000 },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Sarah Miller', [cols[1].id]: 'sarah@initech.com', [cols[2].id]: 'Initech', [cols[3].id]: '(555) 246-8135', [cols[4].id]: 'Lead', [cols[5].id]: 8500 },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Tom Wilson', [cols[1].id]: 'tom@wayne.com', [cols[2].id]: 'Wayne Enterprises', [cols[3].id]: '(555) 369-1478', [cols[4].id]: 'Closed won', [cols[5].id]: 75000 },
      ];
      return { title: 'CRM contacts', columns: cols, rows };
    },
  },
  {
    key: 'inventory',
    name: 'Inventory',
    icon: '📦',
    description: 'Products, SKUs, quantities, prices, stock status',
    category: 'Business',
    tags: ['inventory', 'stock', 'products', 'warehouse'],
    createData: () => {
      const cols: TableColumn[] = [
        { id: crypto.randomUUID(), name: 'Product', type: 'text', width: 220 },
        { id: crypto.randomUUID(), name: 'SKU', type: 'text', width: 120 },
        { id: crypto.randomUUID(), name: 'Category', type: 'singleSelect', width: 140, options: ['Electronics', 'Clothing', 'Food', 'Office supplies'] },
        { id: crypto.randomUUID(), name: 'Quantity', type: 'number', width: 100 },
        { id: crypto.randomUUID(), name: 'Price', type: 'currency', width: 110 },
        { id: crypto.randomUUID(), name: 'In stock', type: 'checkbox', width: 100 },
      ];
      const rows: TableRow[] = [
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Wireless keyboard', [cols[1].id]: 'WK-001', [cols[2].id]: 'Electronics', [cols[3].id]: 45, [cols[4].id]: 59.99, [cols[5].id]: true },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Cotton t-shirt (M)', [cols[1].id]: 'TS-024', [cols[2].id]: 'Clothing', [cols[3].id]: 120, [cols[4].id]: 19.99, [cols[5].id]: true },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Organic coffee beans (1kg)', [cols[1].id]: 'CB-100', [cols[2].id]: 'Food', [cols[3].id]: 0, [cols[4].id]: 24.50, [cols[5].id]: false },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Sticky notes (pack of 12)', [cols[1].id]: 'SN-050', [cols[2].id]: 'Office supplies', [cols[3].id]: 200, [cols[4].id]: 8.99, [cols[5].id]: true },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'USB-C hub', [cols[1].id]: 'UH-003', [cols[2].id]: 'Electronics', [cols[3].id]: 12, [cols[4].id]: 34.99, [cols[5].id]: true },
      ];
      return { title: 'Inventory', columns: cols, rows };
    },
  },
  {
    key: 'expenseTracker',
    name: 'Expense tracker',
    icon: '💰',
    description: 'Track spending by category, date, and status',
    category: 'Business',
    tags: ['expenses', 'finance', 'budget', 'spending'],
    createData: () => {
      const cols: TableColumn[] = [
        { id: crypto.randomUUID(), name: 'Description', type: 'text', width: 240 },
        { id: crypto.randomUUID(), name: 'Amount', type: 'currency', width: 120 },
        { id: crypto.randomUUID(), name: 'Category', type: 'singleSelect', width: 140, options: ['Travel', 'Software', 'Office', 'Meals', 'Marketing', 'Other'] },
        { id: crypto.randomUUID(), name: 'Date', type: 'date', width: 130 },
        { id: crypto.randomUUID(), name: 'Status', type: 'singleSelect', width: 130, options: ['Pending', 'Approved', 'Rejected', 'Reimbursed'] },
        { id: crypto.randomUUID(), name: 'Receipt', type: 'checkbox', width: 90 },
      ];
      const rows: TableRow[] = [
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Flight to NYC', [cols[1].id]: 450, [cols[2].id]: 'Travel', [cols[4].id]: 'Approved', [cols[5].id]: true },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Figma annual license', [cols[1].id]: 144, [cols[2].id]: 'Software', [cols[4].id]: 'Reimbursed', [cols[5].id]: true },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Team lunch', [cols[1].id]: 87.50, [cols[2].id]: 'Meals', [cols[4].id]: 'Pending', [cols[5].id]: false },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Standing desk', [cols[1].id]: 599, [cols[2].id]: 'Office', [cols[4].id]: 'Approved', [cols[5].id]: true },
      ];
      return { title: 'Expense tracker', columns: cols, rows };
    },
  },
  {
    key: 'meetingNotes',
    name: 'Meeting notes',
    icon: '🗓️',
    description: 'Meeting log with attendees, decisions, action items',
    category: 'Business',
    tags: ['meetings', 'notes', 'agenda', 'decisions'],
    createData: () => {
      const cols: TableColumn[] = [
        { id: crypto.randomUUID(), name: 'Meeting', type: 'text', width: 240 },
        { id: crypto.randomUUID(), name: 'Date', type: 'date', width: 130 },
        { id: crypto.randomUUID(), name: 'Attendees', type: 'text', width: 200 },
        { id: crypto.randomUUID(), name: 'Type', type: 'singleSelect', width: 130, options: ['Standup', '1-on-1', 'Planning', 'Review', 'All-hands'] },
        { id: crypto.randomUUID(), name: 'Notes', type: 'longText', width: 300 },
        { id: crypto.randomUUID(), name: 'Action items', type: 'longText', width: 280 },
      ];
      const rows: TableRow[] = [
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Sprint planning', [cols[2].id]: 'Alice, Bob, Carol', [cols[3].id]: 'Planning', [cols[4].id]: 'Scoped Q2 features, assigned stories', [cols[5].id]: 'Alice: finalize designs by Friday' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Weekly standup', [cols[2].id]: 'Full team', [cols[3].id]: 'Standup', [cols[4].id]: 'All on track, no blockers', [cols[5].id]: 'Bob: deploy staging build' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Product review', [cols[2].id]: 'PM, Design, Eng leads', [cols[3].id]: 'Review', [cols[4].id]: 'Approved new dashboard mockups', [cols[5].id]: 'Carol: share updated specs' },
      ];
      return { title: 'Meeting notes', columns: cols, rows };
    },
  },

  // ── Engineering ───────────────────────────────────────────────────
  {
    key: 'bugTracker',
    name: 'Bug tracker',
    icon: '🐛',
    description: 'Bugs, severity, status, descriptions, reporters',
    category: 'Engineering',
    tags: ['bugs', 'issues', 'qa', 'testing'],
    createData: () => {
      const cols: TableColumn[] = [
        { id: crypto.randomUUID(), name: 'Bug title', type: 'text', width: 260 },
        { id: crypto.randomUUID(), name: 'Severity', type: 'singleSelect', width: 120, options: ['Low', 'Medium', 'High', 'Critical'] },
        { id: crypto.randomUUID(), name: 'Status', type: 'singleSelect', width: 130, options: ['Open', 'Investigating', 'Fix in progress', 'Resolved', 'Closed'] },
        { id: crypto.randomUUID(), name: 'Reported by', type: 'text', width: 140 },
        { id: crypto.randomUUID(), name: 'Description', type: 'longText', width: 300 },
        { id: crypto.randomUUID(), name: 'Created', type: 'date', width: 130 },
      ];
      const rows: TableRow[] = [
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Login page crash on Safari', [cols[1].id]: 'Critical', [cols[2].id]: 'Fix in progress', [cols[3].id]: 'QA Team', [cols[4].id]: 'Page crashes when clicking sign in on Safari 17' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Misaligned button on mobile', [cols[1].id]: 'Low', [cols[2].id]: 'Open', [cols[3].id]: 'Jane', [cols[4].id]: 'Submit button overlaps footer on iPhone SE' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Email notifications not sent', [cols[1].id]: 'High', [cols[2].id]: 'Investigating', [cols[3].id]: 'Support', [cols[4].id]: 'Users not receiving password reset emails' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'CSV export missing headers', [cols[1].id]: 'Medium', [cols[2].id]: 'Resolved', [cols[3].id]: 'Tom', [cols[4].id]: 'Exported CSV files are missing the header row' },
      ];
      return { title: 'Bug tracker', columns: cols, rows };
    },
  },
  {
    key: 'apiEndpoints',
    name: 'API endpoints',
    icon: '🔌',
    description: 'Document REST endpoints, methods, auth, status',
    category: 'Engineering',
    tags: ['api', 'rest', 'documentation', 'endpoints'],
    createData: () => {
      const cols: TableColumn[] = [
        { id: crypto.randomUUID(), name: 'Endpoint', type: 'text', width: 240 },
        { id: crypto.randomUUID(), name: 'Method', type: 'singleSelect', width: 100, options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
        { id: crypto.randomUUID(), name: 'Auth required', type: 'checkbox', width: 110 },
        { id: crypto.randomUUID(), name: 'Status', type: 'singleSelect', width: 120, options: ['Stable', 'Beta', 'Deprecated', 'Planned'] },
        { id: crypto.randomUUID(), name: 'Description', type: 'longText', width: 280 },
        { id: crypto.randomUUID(), name: 'Rate limit', type: 'text', width: 120 },
      ];
      const rows: TableRow[] = [
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: '/api/v1/users', [cols[1].id]: 'GET', [cols[2].id]: true, [cols[3].id]: 'Stable', [cols[4].id]: 'List all users with pagination', [cols[5].id]: '100/min' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: '/api/v1/users', [cols[1].id]: 'POST', [cols[2].id]: true, [cols[3].id]: 'Stable', [cols[4].id]: 'Create a new user account', [cols[5].id]: '20/min' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: '/api/v1/auth/login', [cols[1].id]: 'POST', [cols[2].id]: false, [cols[3].id]: 'Stable', [cols[4].id]: 'Authenticate and receive JWT tokens', [cols[5].id]: '10/min' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: '/api/v2/search', [cols[1].id]: 'GET', [cols[2].id]: true, [cols[3].id]: 'Beta', [cols[4].id]: 'Full-text search across resources', [cols[5].id]: '30/min' },
      ];
      return { title: 'API endpoints', columns: cols, rows };
    },
  },
  {
    key: 'releaseLog',
    name: 'Release log',
    icon: '🚀',
    description: 'Track releases, versions, changelog, deploy status',
    category: 'Engineering',
    tags: ['releases', 'changelog', 'deploys', 'versions'],
    createData: () => {
      const cols: TableColumn[] = [
        { id: crypto.randomUUID(), name: 'Version', type: 'text', width: 120 },
        { id: crypto.randomUUID(), name: 'Release date', type: 'date', width: 130 },
        { id: crypto.randomUUID(), name: 'Type', type: 'singleSelect', width: 120, options: ['Major', 'Minor', 'Patch', 'Hotfix'] },
        { id: crypto.randomUUID(), name: 'Status', type: 'singleSelect', width: 120, options: ['Planned', 'In QA', 'Deployed', 'Rolled back'] },
        { id: crypto.randomUUID(), name: 'Changes', type: 'longText', width: 320 },
        { id: crypto.randomUUID(), name: 'Owner', type: 'text', width: 140 },
      ];
      const rows: TableRow[] = [
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'v2.4.0', [cols[2].id]: 'Minor', [cols[3].id]: 'Deployed', [cols[4].id]: 'New dashboard widgets, performance improvements', [cols[5].id]: 'Alice' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'v2.4.1', [cols[2].id]: 'Patch', [cols[3].id]: 'In QA', [cols[4].id]: 'Fix calendar timezone bug, update deps', [cols[5].id]: 'Bob' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'v3.0.0', [cols[2].id]: 'Major', [cols[3].id]: 'Planned', [cols[4].id]: 'New editor, redesigned settings, API v2', [cols[5].id]: 'Carol' },
      ];
      return { title: 'Release log', columns: cols, rows };
    },
  },
  {
    key: 'techDebt',
    name: 'Tech debt',
    icon: '🔧',
    description: 'Track technical debt, effort, impact, ownership',
    category: 'Engineering',
    tags: ['tech debt', 'refactoring', 'maintenance'],
    createData: () => {
      const cols: TableColumn[] = [
        { id: crypto.randomUUID(), name: 'Item', type: 'text', width: 260 },
        { id: crypto.randomUUID(), name: 'Area', type: 'singleSelect', width: 130, options: ['Frontend', 'Backend', 'Database', 'Infra', 'Testing'] },
        { id: crypto.randomUUID(), name: 'Impact', type: 'singleSelect', width: 110, options: ['Low', 'Medium', 'High'] },
        { id: crypto.randomUUID(), name: 'Effort', type: 'singleSelect', width: 110, options: ['Small', 'Medium', 'Large', 'XL'] },
        { id: crypto.randomUUID(), name: 'Owner', type: 'text', width: 130 },
        { id: crypto.randomUUID(), name: 'Notes', type: 'longText', width: 280 },
      ];
      const rows: TableRow[] = [
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Migrate to React 19', [cols[1].id]: 'Frontend', [cols[2].id]: 'High', [cols[3].id]: 'Large', [cols[5].id]: 'Needed for concurrent features' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Add database indexes', [cols[1].id]: 'Database', [cols[2].id]: 'High', [cols[3].id]: 'Small', [cols[5].id]: 'Query times > 500ms on user table' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Remove legacy auth module', [cols[1].id]: 'Backend', [cols[2].id]: 'Medium', [cols[3].id]: 'Medium', [cols[5].id]: 'Dead code after OAuth migration' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Set up E2E test suite', [cols[1].id]: 'Testing', [cols[2].id]: 'Medium', [cols[3].id]: 'Large', [cols[5].id]: 'Currently only unit tests' },
      ];
      return { title: 'Tech debt', columns: cols, rows };
    },
  },

  // ── Marketing ─────────────────────────────────────────────────────
  {
    key: 'contentCalendar',
    name: 'Content calendar',
    icon: '📅',
    description: 'Plan blog posts, social media, newsletters',
    category: 'Marketing',
    tags: ['content', 'calendar', 'social media', 'blog'],
    createData: () => {
      const cols: TableColumn[] = [
        { id: crypto.randomUUID(), name: 'Title', type: 'text', width: 240 },
        { id: crypto.randomUUID(), name: 'Type', type: 'singleSelect', width: 130, options: ['Blog post', 'Social media', 'Newsletter', 'Video'] },
        { id: crypto.randomUUID(), name: 'Status', type: 'singleSelect', width: 130, options: ['Idea', 'Drafting', 'Review', 'Scheduled', 'Published'] },
        { id: crypto.randomUUID(), name: 'Author', type: 'text', width: 140 },
        { id: crypto.randomUUID(), name: 'Publish date', type: 'date', width: 130 },
        { id: crypto.randomUUID(), name: 'URL', type: 'url', width: 200 },
      ];
      const rows: TableRow[] = [
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: '10 tips for productivity', [cols[1].id]: 'Blog post', [cols[2].id]: 'Published', [cols[3].id]: 'Alex' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Product launch announcement', [cols[1].id]: 'Social media', [cols[2].id]: 'Scheduled', [cols[3].id]: 'Jamie' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Monthly newsletter - March', [cols[1].id]: 'Newsletter', [cols[2].id]: 'Drafting', [cols[3].id]: 'Pat' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Feature deep-dive video', [cols[1].id]: 'Video', [cols[2].id]: 'Idea', [cols[3].id]: 'Alex' },
      ];
      return { title: 'Content calendar', columns: cols, rows };
    },
  },
  {
    key: 'campaignTracker',
    name: 'Campaign tracker',
    icon: '📣',
    description: 'Marketing campaigns, budgets, channels, KPIs',
    category: 'Marketing',
    tags: ['campaigns', 'ads', 'budget', 'performance'],
    createData: () => {
      const cols: TableColumn[] = [
        { id: crypto.randomUUID(), name: 'Campaign', type: 'text', width: 220 },
        { id: crypto.randomUUID(), name: 'Channel', type: 'singleSelect', width: 130, options: ['Google Ads', 'Facebook', 'Email', 'LinkedIn', 'Twitter/X', 'TikTok'] },
        { id: crypto.randomUUID(), name: 'Budget', type: 'currency', width: 120 },
        { id: crypto.randomUUID(), name: 'Status', type: 'singleSelect', width: 120, options: ['Draft', 'Active', 'Paused', 'Completed'] },
        { id: crypto.randomUUID(), name: 'Start date', type: 'date', width: 130 },
        { id: crypto.randomUUID(), name: 'Conversions', type: 'number', width: 110 },
      ];
      const rows: TableRow[] = [
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Spring sale 2025', [cols[1].id]: 'Google Ads', [cols[2].id]: 5000, [cols[3].id]: 'Active', [cols[5].id]: 342 },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Product launch email', [cols[1].id]: 'Email', [cols[2].id]: 500, [cols[3].id]: 'Completed', [cols[5].id]: 1280 },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Brand awareness', [cols[1].id]: 'LinkedIn', [cols[2].id]: 3000, [cols[3].id]: 'Active', [cols[5].id]: 89 },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Summer promo', [cols[1].id]: 'Facebook', [cols[2].id]: 2000, [cols[3].id]: 'Draft', [cols[5].id]: 0 },
      ];
      return { title: 'Campaign tracker', columns: cols, rows };
    },
  },
  {
    key: 'competitorAnalysis',
    name: 'Competitor analysis',
    icon: '🔍',
    description: 'Compare competitors by features, pricing, positioning',
    category: 'Marketing',
    tags: ['competitors', 'analysis', 'research', 'market'],
    createData: () => {
      const cols: TableColumn[] = [
        { id: crypto.randomUUID(), name: 'Competitor', type: 'text', width: 180 },
        { id: crypto.randomUUID(), name: 'Website', type: 'url', width: 200 },
        { id: crypto.randomUUID(), name: 'Pricing', type: 'text', width: 140 },
        { id: crypto.randomUUID(), name: 'Strength', type: 'longText', width: 240 },
        { id: crypto.randomUUID(), name: 'Weakness', type: 'longText', width: 240 },
        { id: crypto.randomUUID(), name: 'Threat level', type: 'singleSelect', width: 120, options: ['Low', 'Medium', 'High'] },
      ];
      const rows: TableRow[] = [
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Acme Software', [cols[2].id]: '$29/mo', [cols[3].id]: 'Large user base, strong brand', [cols[4].id]: 'Slow to ship new features', [cols[5].id]: 'High' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Startup XYZ', [cols[2].id]: '$19/mo', [cols[3].id]: 'Modern UI, fast iteration', [cols[4].id]: 'Limited integrations', [cols[5].id]: 'Medium' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Legacy Corp', [cols[2].id]: '$99/mo', [cols[3].id]: 'Enterprise features, compliance', [cols[4].id]: 'Poor UX, expensive', [cols[5].id]: 'Low' },
      ];
      return { title: 'Competitor analysis', columns: cols, rows };
    },
  },

  // ── HR & People ───────────────────────────────────────────────────
  {
    key: 'hiringPipeline',
    name: 'Hiring pipeline',
    icon: '🎯',
    description: 'Track candidates, roles, interview stages',
    category: 'HR & People',
    tags: ['hiring', 'recruiting', 'candidates', 'interviews'],
    createData: () => {
      const cols: TableColumn[] = [
        { id: crypto.randomUUID(), name: 'Candidate', type: 'text', width: 180 },
        { id: crypto.randomUUID(), name: 'Role', type: 'text', width: 180 },
        { id: crypto.randomUUID(), name: 'Stage', type: 'singleSelect', width: 140, options: ['Applied', 'Phone screen', 'Technical', 'On-site', 'Offer', 'Hired', 'Rejected'] },
        { id: crypto.randomUUID(), name: 'Email', type: 'email', width: 220 },
        { id: crypto.randomUUID(), name: 'Rating', type: 'rating', width: 120 },
        { id: crypto.randomUUID(), name: 'Notes', type: 'longText', width: 280 },
      ];
      const rows: TableRow[] = [
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Alex Rivera', [cols[1].id]: 'Senior Frontend Engineer', [cols[2].id]: 'Technical', [cols[3].id]: 'alex@email.com', [cols[4].id]: 4, [cols[5].id]: 'Strong React experience, good system design' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Maya Patel', [cols[1].id]: 'Product Designer', [cols[2].id]: 'On-site', [cols[3].id]: 'maya@email.com', [cols[4].id]: 5, [cols[5].id]: 'Exceptional portfolio, great culture fit' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'James Kim', [cols[1].id]: 'Backend Engineer', [cols[2].id]: 'Phone screen', [cols[3].id]: 'james@email.com', [cols[4].id]: 3, [cols[5].id]: 'Good experience but needs follow-up on system design' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Sofia Lund', [cols[1].id]: 'Senior Frontend Engineer', [cols[2].id]: 'Offer', [cols[3].id]: 'sofia@email.com', [cols[4].id]: 5, [cols[5].id]: 'Excellent across all interviews, offer sent' },
      ];
      return { title: 'Hiring pipeline', columns: cols, rows };
    },
  },
  {
    key: 'teamDirectory',
    name: 'Team directory',
    icon: '🏢',
    description: 'Employee list with roles, departments, contacts',
    category: 'HR & People',
    tags: ['team', 'directory', 'employees', 'org chart'],
    createData: () => {
      const cols: TableColumn[] = [
        { id: crypto.randomUUID(), name: 'Name', type: 'text', width: 180 },
        { id: crypto.randomUUID(), name: 'Role', type: 'text', width: 200 },
        { id: crypto.randomUUID(), name: 'Department', type: 'singleSelect', width: 140, options: ['Engineering', 'Design', 'Product', 'Marketing', 'Sales', 'Operations'] },
        { id: crypto.randomUUID(), name: 'Email', type: 'email', width: 220 },
        { id: crypto.randomUUID(), name: 'Phone', type: 'phone', width: 150 },
        { id: crypto.randomUUID(), name: 'Start date', type: 'date', width: 130 },
      ];
      const rows: TableRow[] = [
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Emma Johnson', [cols[1].id]: 'Engineering Manager', [cols[2].id]: 'Engineering', [cols[3].id]: 'emma@company.com', [cols[4].id]: '(555) 100-2001' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Liam Chen', [cols[1].id]: 'Product Designer', [cols[2].id]: 'Design', [cols[3].id]: 'liam@company.com', [cols[4].id]: '(555) 100-2002' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Olivia Davis', [cols[1].id]: 'Head of Marketing', [cols[2].id]: 'Marketing', [cols[3].id]: 'olivia@company.com', [cols[4].id]: '(555) 100-2003' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Noah Williams', [cols[1].id]: 'Full Stack Developer', [cols[2].id]: 'Engineering', [cols[3].id]: 'noah@company.com', [cols[4].id]: '(555) 100-2004' },
      ];
      return { title: 'Team directory', columns: cols, rows };
    },
  },
  {
    key: 'onboardingChecklist',
    name: 'Onboarding checklist',
    icon: '✅',
    description: 'New hire tasks, deadlines, owners, completion',
    category: 'HR & People',
    tags: ['onboarding', 'checklist', 'new hire'],
    createData: () => {
      const cols: TableColumn[] = [
        { id: crypto.randomUUID(), name: 'Task', type: 'text', width: 260 },
        { id: crypto.randomUUID(), name: 'Week', type: 'singleSelect', width: 100, options: ['Week 1', 'Week 2', 'Week 3', 'Week 4'] },
        { id: crypto.randomUUID(), name: 'Owner', type: 'text', width: 140 },
        { id: crypto.randomUUID(), name: 'Done', type: 'checkbox', width: 80 },
        { id: crypto.randomUUID(), name: 'Notes', type: 'longText', width: 280 },
      ];
      const rows: TableRow[] = [
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Set up laptop and accounts', [cols[1].id]: 'Week 1', [cols[2].id]: 'IT', [cols[3].id]: true },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Read company handbook', [cols[1].id]: 'Week 1', [cols[2].id]: 'New hire', [cols[3].id]: false },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Meet with team lead', [cols[1].id]: 'Week 1', [cols[2].id]: 'Manager', [cols[3].id]: false },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Complete first small task', [cols[1].id]: 'Week 2', [cols[2].id]: 'Buddy', [cols[3].id]: false },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: '30-day check-in with manager', [cols[1].id]: 'Week 4', [cols[2].id]: 'Manager', [cols[3].id]: false },
      ];
      return { title: 'Onboarding checklist', columns: cols, rows };
    },
  },

  // ── Personal ──────────────────────────────────────────────────────
  {
    key: 'habitTracker',
    name: 'Habit tracker',
    icon: '🎯',
    description: 'Daily habits with frequency, streaks, categories',
    category: 'Personal',
    tags: ['habits', 'goals', 'daily', 'health'],
    createData: () => {
      const cols: TableColumn[] = [
        { id: crypto.randomUUID(), name: 'Habit', type: 'text', width: 220 },
        { id: crypto.randomUUID(), name: 'Category', type: 'singleSelect', width: 130, options: ['Health', 'Learning', 'Productivity', 'Mindfulness', 'Social'] },
        { id: crypto.randomUUID(), name: 'Frequency', type: 'singleSelect', width: 120, options: ['Daily', '3x/week', 'Weekly'] },
        { id: crypto.randomUUID(), name: 'Streak', type: 'number', width: 90 },
        { id: crypto.randomUUID(), name: 'Done today', type: 'checkbox', width: 100 },
        { id: crypto.randomUUID(), name: 'Notes', type: 'longText', width: 240 },
      ];
      const rows: TableRow[] = [
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Morning run', [cols[1].id]: 'Health', [cols[2].id]: '3x/week', [cols[3].id]: 12, [cols[4].id]: true },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Read 30 minutes', [cols[1].id]: 'Learning', [cols[2].id]: 'Daily', [cols[3].id]: 45, [cols[4].id]: false },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Meditate', [cols[1].id]: 'Mindfulness', [cols[2].id]: 'Daily', [cols[3].id]: 20, [cols[4].id]: true },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Write journal', [cols[1].id]: 'Mindfulness', [cols[2].id]: 'Daily', [cols[3].id]: 8, [cols[4].id]: false },
      ];
      return { title: 'Habit tracker', columns: cols, rows };
    },
  },
  {
    key: 'readingList',
    name: 'Reading list',
    icon: '📚',
    description: 'Books, status, ratings, genres, notes',
    category: 'Personal',
    tags: ['books', 'reading', 'library'],
    createData: () => {
      const cols: TableColumn[] = [
        { id: crypto.randomUUID(), name: 'Title', type: 'text', width: 240 },
        { id: crypto.randomUUID(), name: 'Author', type: 'text', width: 160 },
        { id: crypto.randomUUID(), name: 'Genre', type: 'singleSelect', width: 130, options: ['Fiction', 'Non-fiction', 'Business', 'Science', 'Self-help', 'Biography'] },
        { id: crypto.randomUUID(), name: 'Status', type: 'singleSelect', width: 120, options: ['Want to read', 'Reading', 'Finished', 'Abandoned'] },
        { id: crypto.randomUUID(), name: 'Rating', type: 'rating', width: 120 },
        { id: crypto.randomUUID(), name: 'Notes', type: 'longText', width: 260 },
      ];
      const rows: TableRow[] = [
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Thinking, Fast and Slow', [cols[1].id]: 'Daniel Kahneman', [cols[2].id]: 'Non-fiction', [cols[3].id]: 'Finished', [cols[4].id]: 5 },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'The Pragmatic Programmer', [cols[1].id]: 'David Thomas', [cols[2].id]: 'Business', [cols[3].id]: 'Reading', [cols[4].id]: 4 },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Project Hail Mary', [cols[1].id]: 'Andy Weir', [cols[2].id]: 'Fiction', [cols[3].id]: 'Want to read' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Atomic Habits', [cols[1].id]: 'James Clear', [cols[2].id]: 'Self-help', [cols[3].id]: 'Finished', [cols[4].id]: 5 },
      ];
      return { title: 'Reading list', columns: cols, rows };
    },
  },
  {
    key: 'travelPlanner',
    name: 'Travel planner',
    icon: '✈️',
    description: 'Trips, destinations, dates, budgets, bookings',
    category: 'Personal',
    tags: ['travel', 'trips', 'vacation', 'planning'],
    createData: () => {
      const cols: TableColumn[] = [
        { id: crypto.randomUUID(), name: 'Destination', type: 'text', width: 200 },
        { id: crypto.randomUUID(), name: 'Dates', type: 'text', width: 160 },
        { id: crypto.randomUUID(), name: 'Budget', type: 'currency', width: 120 },
        { id: crypto.randomUUID(), name: 'Status', type: 'singleSelect', width: 120, options: ['Dreaming', 'Planning', 'Booked', 'Completed'] },
        { id: crypto.randomUUID(), name: 'Flights booked', type: 'checkbox', width: 120 },
        { id: crypto.randomUUID(), name: 'Notes', type: 'longText', width: 280 },
      ];
      const rows: TableRow[] = [
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Tokyo, Japan', [cols[1].id]: 'Apr 15 - Apr 28', [cols[2].id]: 4500, [cols[3].id]: 'Booked', [cols[4].id]: true, [cols[5].id]: 'Cherry blossom season, Airbnb in Shibuya' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Barcelona, Spain', [cols[1].id]: 'Jul 1 - Jul 10', [cols[2].id]: 3000, [cols[3].id]: 'Planning', [cols[4].id]: false, [cols[5].id]: 'Need to book hotel near La Rambla' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Iceland road trip', [cols[1].id]: 'Sep 2025', [cols[2].id]: 6000, [cols[3].id]: 'Dreaming', [cols[4].id]: false, [cols[5].id]: 'Ring road, northern lights, hot springs' },
      ];
      return { title: 'Travel planner', columns: cols, rows };
    },
  },

  // ── General ───────────────────────────────────────────────────────
  {
    key: 'eventPlanner',
    name: 'Event planner',
    icon: '🎉',
    description: 'Plan events with tasks, vendors, timelines',
    category: 'General',
    tags: ['events', 'planning', 'coordination'],
    createData: () => {
      const cols: TableColumn[] = [
        { id: crypto.randomUUID(), name: 'Task', type: 'text', width: 240 },
        { id: crypto.randomUUID(), name: 'Category', type: 'singleSelect', width: 130, options: ['Venue', 'Catering', 'Entertainment', 'Logistics', 'Marketing', 'Other'] },
        { id: crypto.randomUUID(), name: 'Owner', type: 'text', width: 140 },
        { id: crypto.randomUUID(), name: 'Due date', type: 'date', width: 130 },
        { id: crypto.randomUUID(), name: 'Status', type: 'singleSelect', width: 120, options: ['Todo', 'In progress', 'Done'] },
        { id: crypto.randomUUID(), name: 'Cost', type: 'currency', width: 110 },
      ];
      const rows: TableRow[] = [
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Book venue', [cols[1].id]: 'Venue', [cols[2].id]: 'Sarah', [cols[4].id]: 'Done', [cols[5].id]: 2500 },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Order catering', [cols[1].id]: 'Catering', [cols[2].id]: 'Mike', [cols[4].id]: 'In progress', [cols[5].id]: 1800 },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Send invitations', [cols[1].id]: 'Marketing', [cols[2].id]: 'Sarah', [cols[4].id]: 'Todo' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Hire DJ', [cols[1].id]: 'Entertainment', [cols[2].id]: 'Mike', [cols[4].id]: 'Todo', [cols[5].id]: 800 },
      ];
      return { title: 'Event planner', columns: cols, rows };
    },
  },
  {
    key: 'prosAndCons',
    name: 'Decision matrix',
    icon: '⚖️',
    description: 'Compare options with weighted criteria and scores',
    category: 'General',
    tags: ['decisions', 'comparison', 'evaluation'],
    createData: () => {
      const cols: TableColumn[] = [
        { id: crypto.randomUUID(), name: 'Option', type: 'text', width: 200 },
        { id: crypto.randomUUID(), name: 'Cost', type: 'rating', width: 120 },
        { id: crypto.randomUUID(), name: 'Quality', type: 'rating', width: 120 },
        { id: crypto.randomUUID(), name: 'Speed', type: 'rating', width: 120 },
        { id: crypto.randomUUID(), name: 'Risk', type: 'singleSelect', width: 110, options: ['Low', 'Medium', 'High'] },
        { id: crypto.randomUUID(), name: 'Notes', type: 'longText', width: 280 },
      ];
      const rows: TableRow[] = [
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Option A - Build in-house', [cols[1].id]: 2, [cols[2].id]: 5, [cols[3].id]: 2, [cols[4].id]: 'Medium', [cols[5].id]: 'Full control, higher cost' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Option B - Buy SaaS', [cols[1].id]: 4, [cols[2].id]: 3, [cols[3].id]: 5, [cols[4].id]: 'Low', [cols[5].id]: 'Fast to deploy, vendor lock-in' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Option C - Open source', [cols[1].id]: 5, [cols[2].id]: 3, [cols[3].id]: 3, [cols[4].id]: 'Medium', [cols[5].id]: 'Free, but requires maintenance' },
      ];
      return { title: 'Decision matrix', columns: cols, rows };
    },
  },
  {
    key: 'resourceLibrary',
    name: 'Resource library',
    icon: '🔗',
    description: 'Curated links, tools, articles by topic',
    category: 'General',
    tags: ['resources', 'links', 'bookmarks', 'tools'],
    createData: () => {
      const cols: TableColumn[] = [
        { id: crypto.randomUUID(), name: 'Resource', type: 'text', width: 220 },
        { id: crypto.randomUUID(), name: 'URL', type: 'url', width: 260 },
        { id: crypto.randomUUID(), name: 'Category', type: 'singleSelect', width: 130, options: ['Design', 'Development', 'Marketing', 'Business', 'Learning'] },
        { id: crypto.randomUUID(), name: 'Rating', type: 'rating', width: 120 },
        { id: crypto.randomUUID(), name: 'Notes', type: 'longText', width: 260 },
      ];
      const rows: TableRow[] = [
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Tailwind CSS', [cols[2].id]: 'Development', [cols[3].id]: 5, [cols[4].id]: 'Utility-first CSS framework' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Figma', [cols[2].id]: 'Design', [cols[3].id]: 5, [cols[4].id]: 'Collaborative design tool' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Notion', [cols[2].id]: 'Business', [cols[3].id]: 4, [cols[4].id]: 'All-in-one workspace' },
        { _id: crypto.randomUUID(), _createdAt: new Date().toISOString(), [cols[0].id]: 'Coursera', [cols[2].id]: 'Learning', [cols[3].id]: 4, [cols[4].id]: 'Online courses from top universities' },
      ];
      return { title: 'Resource library', columns: cols, rows };
    },
  },
];

// ─── Table template gallery ──────────────────────────────────────────

function CardPreviewLines() {
  return (
    <div className="tg-card-preview">
      <div className="tg-card-preview-line is-heading" />
      <div className="tg-card-preview-line w-90" />
      <div className="tg-card-preview-line w-70" />
      <div className="tg-card-preview-line w-80" />
      <div className="tg-card-preview-line w-55" />
    </div>
  );
}

function TableTemplateCard({
  template,
  onClick,
}: {
  template: TableTemplate;
  onClick: () => void;
}) {
  return (
    <button className="tg-card" onClick={onClick}>
      <div className="tg-card-header" style={{ background: TABLE_CATEGORY_COLORS[template.category] }}>
        <CardPreviewLines />
        <div className="tg-card-overlay">
          <span className="tg-card-use-btn">Use template</span>
        </div>
      </div>
      <div className="tg-card-body">
        <div className="tg-card-name-row">
          <span className="tg-card-icon">{template.icon}</span>
          <span className="tg-card-name">{template.name}</span>
        </div>
        <p className="tg-card-desc">{template.description}</p>
        {template.tags.length > 0 && (
          <div className="tg-card-tags">
            {template.tags.map((tag) => (
              <span key={tag} className="tg-tag">#{tag}</span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

function TableTemplateGallery({
  onSelect,
  onClose,
}: {
  onSelect: (template: TableTemplate) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'All' | TableTemplateCategory>('All');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return TABLE_TEMPLATES.filter((tpl) => {
      const matchesCategory = activeCategory === 'All' || tpl.category === activeCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        tpl.name.toLowerCase().includes(q) ||
        tpl.description.toLowerCase().includes(q) ||
        tpl.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [query, activeCategory]);

  const grouped = useMemo(() => {
    const map: Partial<Record<TableTemplateCategory, TableTemplate[]>> = {};
    for (const tpl of filtered) {
      (map[tpl.category] ??= []).push(tpl);
    }
    return map;
  }, [filtered]);

  return (
    <div className="tg-root">
      {/* Header */}
      <div className="tg-header">
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={14} />} onClick={onClose} className="tg-back-btn">
          {t('tables.backToTables')}
        </Button>
        <div className="tg-header-spacer" />
        <div className="tg-search">
          <Search size={14} />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('tables.searchTemplates')}
          />
        </div>
      </div>

      {/* Body */}
      <div className="tg-body">
        <div className="tg-hero">
          <h2 className="tg-hero-title">{t('tables.templateGalleryTitle')}</h2>
          <p className="tg-hero-sub">{t('tables.templateGallerySub')}</p>
        </div>

        {/* Category pills */}
        <div className="tg-pills">
          <button
            className={`tg-pill${activeCategory === 'All' ? ' is-active' : ''}`}
            onClick={() => setActiveCategory('All')}
          >
            {t('tables.templateCategoryAll')}
          </button>
          {TABLE_TEMPLATE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`tg-pill${activeCategory === cat ? ' is-active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Blank card + template groups */}
        {filtered.length === 0 ? (
          <div className="tg-empty">
            <span>{t('tables.noTemplatesFound')}</span>
          </div>
        ) : activeCategory === 'All' ? (
          <>
            {/* Blank table card */}
            {!query && (
              <div className="tg-category-section">
                <h3 className="tg-category-label">{t('tables.startFresh')}</h3>
                <div className="tg-grid">
                  <button className="tg-card is-blank" onClick={() => onClose()}>
                    <div className="tg-blank-header">
                      <span className="tg-blank-plus">+</span>
                    </div>
                    <div className="tg-card-body">
                      <div className="tg-card-name-row">
                        <span className="tg-card-icon">📄</span>
                        <span className="tg-card-name">{t('tables.blankTable')}</span>
                      </div>
                      <p className="tg-card-desc">{t('tables.blankTableDesc')}</p>
                    </div>
                  </button>
                </div>
              </div>
            )}
            {TABLE_TEMPLATE_CATEGORIES.map((cat) => {
              const items = grouped[cat];
              if (!items?.length) return null;
              return (
                <div key={cat} className="tg-category-section">
                  <h3 className="tg-category-label">{cat}</h3>
                  <div className="tg-grid">
                    {items.map((tpl) => (
                      <TableTemplateCard key={tpl.key} template={tpl} onClick={() => onSelect(tpl)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div className="tg-category-section">
            <div className="tg-grid">
              {filtered.map((tpl) => (
                <TableTemplateCard key={tpl.key} template={tpl} onClick={() => onSelect(tpl)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Cell renderers ─────────────────────────────────────────────────

function TagRenderer(params: ICellRendererParams) {
  if (!params.value) return null;
  const c = getTagColor(String(params.value));
  return (
    <span className="tables-cell-tag" style={{ background: c.bg, color: c.text }}>
      {String(params.value)}
    </span>
  );
}

function MultiTagRenderer(params: ICellRendererParams) {
  const values = Array.isArray(params.value) ? params.value : [];
  if (values.length === 0) return null;
  return (
    <div className="tables-cell-multi-tags">
      {values.map((v: string, i: number) => {
        const c = getTagColor(v);
        return (
          <span key={i} className="tables-cell-tag" style={{ background: c.bg, color: c.text }}>
            {v}
          </span>
        );
      })}
    </div>
  );
}

function LinkRenderer(params: ICellRendererParams) {
  if (!params.value) return null;
  const url = String(params.value);
  let href: string;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return <span>{url}</span>;
    href = parsed.href;
  } catch {
    return <span>{url}</span>;
  }
  return (
    <span className="tables-cell-url">
      <span className="tables-cell-url-text">{url}</span>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="tables-cell-url-open"
        title="Open link"
        onClick={(e) => e.stopPropagation()}
      >
        <ExternalLink size={12} />
      </a>
    </span>
  );
}

function EmailRenderer(params: ICellRendererParams) {
  if (!params.value) return null;
  return (
    <a href={`mailto:${params.value}`} className="tables-cell-link" onClick={(e) => e.stopPropagation()}>
      {String(params.value)}
    </a>
  );
}

function CurrencyRenderer(params: ICellRendererParams) {
  if (params.value == null || params.value === '') return null;
  const num = Number(params.value);
  if (isNaN(num)) return <span>{String(params.value)}</span>;
  const symbol = (params.colDef as ColDef & { cellRendererParams?: { currencySymbol?: string } })?.cellRendererParams?.currencySymbol || '$';
  return <span>{symbol}{num.toFixed(2)}</span>;
}

function StarRenderer(params: ICellRendererParams) {
  const val = Number(params.value) || 0;
  return (
    <div className="tables-cell-stars">
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={`tables-cell-star ${i <= val ? '' : 'empty'}`}>&#9733;</span>
      ))}
    </div>
  );
}

function PercentRenderer(params: ICellRendererParams) {
  if (params.value == null || params.value === '') return null;
  const val = Math.min(100, Math.max(0, Number(params.value) || 0));
  return (
    <div className="tables-cell-percent">
      <div className="tables-cell-percent-bar">
        <div className="tables-cell-percent-fill" style={{ width: `${val}%` }} />
      </div>
      <span>{val}%</span>
    </div>
  );
}

function AttachmentCellRenderer(params: ICellRendererParams) {
  const attachments: TableAttachment[] = Array.isArray(params.value) ? params.value : [];
  if (attachments.length === 0) {
    return (
      <span className="tables-cell-attachment tables-cell-attachment-empty">
        <Paperclip size={13} />
      </span>
    );
  }
  const isImage = (type: string) => type.startsWith('image/');
  const token = localStorage.getItem('atlasmail_token') || '';
  return (
    <div className="tables-cell-attachment">
      {attachments.map((att, i) => (
        <a
          key={i}
          className="tables-cell-attachment-chip"
          href={`${att.url}?token=${token}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title={att.name}
        >
          {isImage(att.type) ? (
            <img className="tables-cell-attachment-img" src={`${att.url}?token=${token}`} alt={att.name} />
          ) : (
            <FileIcon size={12} />
          )}
          <span className="tables-cell-attachment-name">{att.name}</span>
        </a>
      ))}
    </div>
  );
}

function formatDateByPattern(d: Date, pattern: string): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = String(d.getFullYear());
  switch (pattern) {
    case 'DD/MM/YYYY': return `${dd}/${mm}/${yyyy}`;
    case 'YYYY-MM-DD': return `${yyyy}-${mm}-${dd}`;
    default: return `${mm}/${dd}/${yyyy}`;
  }
}

function DateRenderer(params: ICellRendererParams) {
  if (!params.value) return null;
  const d = new Date(String(params.value));
  if (isNaN(d.getTime())) return <span>{String(params.value)}</span>;
  const fmt = (params.colDef as ColDef & { cellRendererParams?: { dateFormat?: string } })?.cellRendererParams?.dateFormat || 'MM/DD/YYYY';
  return <span>{formatDateByPattern(d, fmt)}</span>;
}

// ─── Linked record cell renderer ────────────────────────────────────

function LinkedRecordRenderer(params: ICellRendererParams) {
  const linkedRows = params.colDef?.cellRendererParams?.linkedRows as Array<{ _id: string; [key: string]: unknown }> | undefined;
  const linkedColumns = params.colDef?.cellRendererParams?.linkedColumns as Array<{ id: string; name: string }> | undefined;
  const value = params.value;
  if (!value || !Array.isArray(value) || value.length === 0) return null;
  const firstCol = linkedColumns?.[0];
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', padding: '2px 0' }}>
      {value.map((rowId: string) => {
        const row = linkedRows?.find((r) => r._id === rowId);
        const label = row && firstCol ? String(row[firstCol.id] ?? '') : rowId.slice(0, 8);
        return (
          <span
            key={rowId}
            style={{
              display: 'inline-block',
              padding: '1px 8px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border-secondary)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-primary)',
              maxWidth: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {label || rowId.slice(0, 8)}
          </span>
        );
      })}
    </div>
  );
}

// ─── Linked record cell editor ──────────────────────────────────────

function LinkedRecordEditor(props: {
  value: string[];
  onValueChange: (val: string[]) => void;
  stopEditing: () => void;
  colDef: { cellRendererParams?: { linkedRows?: Array<{ _id: string; [key: string]: unknown }>; linkedColumns?: Array<{ id: string; name: string }> } };
}) {
  const { value: initialValue, onValueChange, stopEditing, colDef } = props;
  const linkedRows = colDef?.cellRendererParams?.linkedRows ?? [];
  const linkedColumns = colDef?.cellRendererParams?.linkedColumns ?? [];
  const firstCol = linkedColumns[0];
  const [selected, setSelected] = useState<string[]>(initialValue ?? []);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onValueChange(selected);
        stopEditing();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [selected, onValueChange, stopEditing]);

  const filtered = linkedRows.filter((row) => {
    if (!search.trim()) return true;
    const label = firstCol ? String(row[firstCol.id] ?? '') : row._id;
    return label.toLowerCase().includes(search.toLowerCase());
  });

  const toggle = (rowId: string) => {
    const next = selected.includes(rowId)
      ? selected.filter((id) => id !== rowId)
      : [...selected, rowId];
    setSelected(next);
    onValueChange(next);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        zIndex: 100,
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border-primary)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-md)',
        width: 240,
        maxHeight: 260,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <input
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search..."
        style={{
          padding: '6px 8px',
          border: 'none',
          borderBottom: '1px solid var(--color-border-secondary)',
          outline: 'none',
          fontSize: 'var(--font-size-sm)',
          fontFamily: 'var(--font-family)',
          background: 'transparent',
          color: 'var(--color-text-primary)',
        }}
      />
      <div style={{ overflowY: 'auto', maxHeight: 220, padding: 4 }}>
        {filtered.map((row) => {
          const label = firstCol ? String(row[firstCol.id] ?? '') : row._id.slice(0, 8);
          const isSelected = selected.includes(row._id);
          return (
            <button
              key={row._id}
              onClick={() => toggle(row._id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                width: '100%',
                padding: '4px 8px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: isSelected ? 'var(--color-surface-selected)' : 'transparent',
                cursor: 'pointer',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family)',
                color: 'var(--color-text-primary)',
                textAlign: 'left',
              }}
            >
              <span style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isSelected ? <Check size={14} style={{ color: 'var(--color-accent-primary)' }} /> : null}
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {label || row._id.slice(0, 8)}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ padding: '8px', color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)', textAlign: 'center' }}>
            No rows found
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Row number header (select-all checkbox) ───────────────────────

function RowNumberHeader(props: { api: { selectAll: () => void; deselectAll: () => void; getSelectedRows: () => unknown[] } }) {
  const [allSelected, setAllSelected] = useState(false);
  const toggle = () => {
    if (allSelected) {
      props.api.deselectAll();
    } else {
      props.api.selectAll();
    }
    setAllSelected(!allSelected);
  };
  return (
    <span className="tables-row-number-header" onClick={toggle}>
      {allSelected ? <CheckSquare size={14} /> : <span className="tables-row-cb-empty" />}
    </span>
  );
}

// ─── Add column header ("+") ────────────────────────────────────────

function AddColumnHeader(props: { setShowAddColumn: (v: boolean) => void }) {
  return (
    <div
      className="tables-add-column-header"
      onClick={() => props.setShowAddColumn(true)}
    >
      <Plus size={16} />
    </div>
  );
}

// ─── Build AG Grid column defs ──────────────────────────────────────

interface BuildColDefsSettings {
  dateFormat: string;
  currencySymbol: string;
  showFieldTypeIcons: boolean;
}

function buildColDefs(
  columns: TableColumn[],
  t: (key: string) => string,
  onMenuOpen?: (columnId: string, x: number, y: number) => void,
  hiddenColumns?: Set<string>,
  frozenColumnCount?: number,
  onHeaderClicked?: (colId: string) => void,
  settings?: BuildColDefsSettings,
  linkedTableData?: Map<string, { rows: Array<{ _id: string; [key: string]: unknown }>; columns: Array<{ id: string; name: string }> }>,
): ColDef[] {
  return columns.map((col, idx) => {
    const TypeIcon = settings?.showFieldTypeIcons !== false ? FIELD_TYPE_ICONS[col.type] : undefined;
    const base: ColDef = {
      field: col.id,
      headerName: col.name,
      editable: true,
      width: col.width || 180,
      resizable: true,
      sortable: true,
      hide: hiddenColumns?.has(col.id),
      headerComponent: TableCustomHeader,
      headerComponentParams: {
        fieldType: col.type,
        fieldTypeIcon: TypeIcon,
        fieldDescription: col.description,
        onMenuOpen,
        onHeaderClicked,
      },
      cellClassRules: {
        'cell-range-selected': (params: { context: Record<string, unknown>; colDef: { field?: string }; node: { rowIndex: number | null; rowPinned?: string | null } }) => {
          const { cellRangeRef, colIndexMapRef } = params.context as {
            cellRangeRef?: { current: import('./hooks/use-cell-range-selection').CellRange | null };
            colIndexMapRef?: { current: Map<string, number> };
          };
          if (!cellRangeRef?.current || !params.colDef.field) return false;
          const rowIndex = params.node.rowIndex;
          if (rowIndex == null || params.node.rowPinned === 'bottom') return false;
          return isCellInRange(rowIndex, params.colDef.field, cellRangeRef.current, colIndexMapRef!.current);
        },
        'cell-find-match': (params: { context: Record<string, unknown>; colDef: { field?: string }; node: { rowIndex: number | null; rowPinned?: string | null } }) => {
          const { findMatchSet } = params.context as { findMatchSet?: Set<string> };
          if (!findMatchSet?.size || !params.colDef.field) return false;
          const rowIndex = params.node.rowIndex;
          if (rowIndex == null || params.node.rowPinned === 'bottom') return false;
          return findMatchSet.has(`${rowIndex}:${params.colDef.field}`);
        },
        'cell-find-current': (params: { context: Record<string, unknown>; colDef: { field?: string }; node: { rowIndex: number | null; rowPinned?: string | null } }) => {
          const { findCurrentMatchKey } = params.context as { findCurrentMatchKey?: string };
          if (!findCurrentMatchKey || !params.colDef.field) return false;
          const rowIndex = params.node.rowIndex;
          if (rowIndex == null || params.node.rowPinned === 'bottom') return false;
          return `${rowIndex}:${params.colDef.field}` === findCurrentMatchKey;
        },
        'cell-formula': (params: { data: Record<string, unknown>; colDef: { field?: string } }) => {
          if (!params.colDef.field || !params.data) return false;
          const val = params.data[params.colDef.field];
          return typeof val === 'string' && val.startsWith('=');
        },
      },
    };

    // Freeze columns
    if (frozenColumnCount && idx < frozenColumnCount) {
      base.pinned = 'left';
      base.lockPosition = 'left';
    }

    switch (col.type) {
      case 'text':
      case 'phone':
        base.cellEditor = 'agTextCellEditor';
        break;
      case 'number':
        base.cellEditor = 'agNumberCellEditor';
        base.cellEditorParams = { precision: 2 };
        base.cellStyle = { textAlign: 'right' };
        break;
      case 'checkbox':
        base.cellRenderer = 'agCheckboxCellRenderer';
        base.cellEditor = 'agCheckboxCellEditor';
        break;
      case 'singleSelect':
        base.cellEditor = RichSelectCellEditor;
        base.cellEditorPopup = true;
        base.cellEditorParams = { options: col.options || [] };
        base.cellRenderer = TagRenderer;
        break;
      case 'multiSelect':
        base.cellRenderer = MultiTagRenderer;
        base.cellEditor = MultiSelectCellEditor;
        base.cellEditorPopup = true;
        base.cellEditorParams = { options: col.options || [] };
        break;
      case 'date':
        base.cellEditor = 'agDateCellEditor';
        base.cellRenderer = DateRenderer;
        base.cellRendererParams = { dateFormat: settings?.dateFormat || 'MM/DD/YYYY' };
        break;
      case 'url':
        base.cellEditor = 'agTextCellEditor';
        base.cellRenderer = LinkRenderer;
        break;
      case 'attachment':
        base.cellRenderer = AttachmentCellRenderer;
        base.editable = false;
        break;
      case 'email':
        base.cellEditor = 'agTextCellEditor';
        base.cellRenderer = EmailRenderer;
        break;
      case 'currency':
        base.cellEditor = 'agNumberCellEditor';
        base.cellEditorParams = { precision: 2 };
        base.cellRenderer = CurrencyRenderer;
        base.cellRendererParams = { currencySymbol: settings?.currencySymbol || '$' };
        base.cellStyle = { textAlign: 'right' };
        break;
      case 'rating':
        base.cellEditor = 'agNumberCellEditor';
        base.cellEditorParams = { min: 0, max: 5, precision: 0 };
        base.cellRenderer = StarRenderer;
        break;
      case 'percent':
        base.cellEditor = 'agNumberCellEditor';
        base.cellEditorParams = { min: 0, max: 100, precision: 0 };
        base.cellRenderer = PercentRenderer;
        break;
      case 'longText':
        base.cellEditor = 'agLargeTextCellEditor';
        base.cellEditorPopup = true;
        base.cellEditorParams = { maxLength: 5000, rows: 6, cols: 50 };
        break;
      case 'linkedRecord': {
        const linked = col.linkedTableId ? linkedTableData?.get(col.linkedTableId) : undefined;
        base.cellRenderer = LinkedRecordRenderer;
        base.cellRendererParams = {
          linkedRows: linked?.rows ?? [],
          linkedColumns: linked?.columns ?? [],
        };
        base.cellEditor = LinkedRecordEditor;
        base.cellEditorPopup = true;
        base.editable = true;
        break;
      }
    }

    return base;
  });
}

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

// ─── Add column popover ─────────────────────────────────────────────

function AddColumnPopover({
  onAdd,
  onClose,
  tables,
}: {
  onAdd: (name: string, type: TableFieldType, options?: string[], linkedTableId?: string) => void;
  onClose: () => void;
  tables?: Array<{ id: string; title: string }>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [type, setType] = useState<TableFieldType>('text');
  const [options, setOptions] = useState('');
  const [linkedTableId, setLinkedTableId] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close type dropdown on Escape
  useEffect(() => {
    if (!showTypeDropdown) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); setShowTypeDropdown(false); }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showTypeDropdown]);

  const needsOptions = type === 'singleSelect' || type === 'multiSelect';
  const needsLinkedTable = type === 'linkedRecord';
  const selectedFieldType = FIELD_TYPES.find((ft) => ft.value === type);
  const TypeIcon = FIELD_TYPE_ICONS[type];

  const handleSubmit = () => {
    if (!name.trim()) return;
    if (needsLinkedTable && !linkedTableId) return;
    const opts = needsOptions
      ? options.split(',').map((o) => o.trim()).filter(Boolean)
      : undefined;
    onAdd(name.trim(), type, opts, needsLinkedTable ? linkedTableId : undefined);
    onClose();
  };

  return (
    <div ref={popoverRef} className="tables-add-col-popover" onClick={(e) => e.stopPropagation()}>
      <div>
        <label>{t('tables.columnName')}</label>
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('tables.columnNamePlaceholder')}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        />
      </div>
      <div style={{ position: 'relative' }} ref={typeDropdownRef}>
        <label>{t('tables.fieldType')}</label>
        <button
          className="tables-field-type-trigger"
          onClick={() => setShowTypeDropdown(!showTypeDropdown)}
          type="button"
        >
          <TypeIcon size={14} />
          <span>{selectedFieldType?.label}</span>
          <ChevronDown size={14} />
        </button>
        {showTypeDropdown && (
          <div className="tables-field-type-dropdown">
            {FIELD_TYPES.map((ft) => {
              const Icon = FIELD_TYPE_ICONS[ft.value];
              return (
                <button
                  key={ft.value}
                  className={`tables-field-type-option${ft.value === type ? ' selected' : ''}`}
                  onClick={() => { setType(ft.value); setShowTypeDropdown(false); }}
                  type="button"
                >
                  <Icon size={14} />
                  <span>{ft.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      {needsOptions && (
        <div>
          <label>{t('tables.options')}</label>
          <input
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            placeholder={t('tables.optionsPlaceholder')}
          />
        </div>
      )}
      {needsLinkedTable && (
        <div>
          <label>{t('tables.fields.selectTable')}</label>
          <select
            value={linkedTableId}
            onChange={(e) => setLinkedTableId(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 8px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border-primary)',
              background: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family)',
            }}
          >
            <option value="">{t('tables.fields.selectTable')}</option>
            {(tables ?? []).map((tbl) => (
              <option key={tbl.id} value={tbl.id}>{tbl.title}</option>
            ))}
          </select>
        </div>
      )}
      <div className="tables-add-col-actions">
        <Button variant="secondary" size="sm" onClick={onClose}>{t('tables.cancel')}</Button>
        <Button variant="primary" size="sm" onClick={handleSubmit}>{t('tables.addColumn')}</Button>
      </div>
    </div>
  );
}

// ─── Tables page ────────────────────────────────────────────────────

export function TablesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: paramId } = useParams<{ id: string }>();
  const { data: listData, isLoading: listLoading } = useTableList();
  const { data: archivedData } = useTableList(true);
  const createTable = useCreateTable();
  const deleteTable = useDeleteTable();
  const restoreTable = useRestoreTable();
  const { save: autoSave, isSaving, isSuccess: isSaveSuccess } = useAutoSaveTable();
  const tablesSettings = useTablesSettingsStore();
  const { openSettings } = useUIStore();

  const [selectedId, setSelectedId] = useState<string | null>(
    paramId ?? localStorage.getItem(LAST_TABLE_KEY) ?? null,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // "Saved" indicator auto-dismiss
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isSaveSuccess && !isSaving) {
      setShowSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setShowSaved(false), 2000);
    }
  }, [isSaveSuccess, isSaving]);
  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  // Local state for the active spreadsheet (optimistic)
  const [localColumns, setLocalColumns] = useState<TableColumn[]>([]);
  const [localRows, setLocalRows] = useState<TableRow[]>([]);
  const [localViewConfig, setLocalViewConfig] = useState<TableViewConfig>({ activeView: 'grid' });
  const [localTitle, setLocalTitle] = useState('');

  // Linked record: collect all unique linkedTableIds from columns
  const linkedTableIds = useMemo(() => {
    const ids = new Set<string>();
    for (const col of localColumns) {
      if (col.type === 'linkedRecord' && col.linkedTableId) {
        ids.add(col.linkedTableId);
      }
    }
    return Array.from(ids);
  }, [localColumns]);

  // Fetch each linked table's full data for cell renderer/editor
  const [linkedTablesMap, setLinkedTablesMap] = useState<Map<string, { rows: Array<{ _id: string; [key: string]: unknown }>; columns: Array<{ id: string; name: string }> }>>(new Map());

  useEffect(() => {
    if (linkedTableIds.length === 0) return;
    let cancelled = false;
    const fetchLinked = async () => {
      const newMap = new Map(linkedTablesMap);
      for (const tableId of linkedTableIds) {
        if (newMap.has(tableId)) continue;
        try {
          const { data: resp } = await api.get(`/tables/${tableId}`);
          const tbl = resp.data;
          newMap.set(tableId, {
            rows: tbl.rows ?? [],
            columns: (tbl.columns ?? []).map((c: any) => ({ id: c.id, name: c.name })),
          });
        } catch {
          // ignore
        }
      }
      if (!cancelled) setLinkedTablesMap(newMap);
    };
    fetchLinked();
    return () => { cancelled = true; };
  }, [linkedTableIds.join(',')]);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Context menu states
  const [columnMenu, setColumnMenu] = useState<{ columnId: string; x: number; y: number } | null>(null);
  const [rowMenu, setRowMenu] = useState<{ rowId: string; x: number; y: number } | null>(null);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

  // Import modal state
  const [importModalData, setImportModalData] = useState<{
    fileName: string;
    allRows: unknown[][];
    firstRowHeader: boolean;
    columnMappings: { name: string; type: TableFieldType }[];
  } | null>(null);

  // Attachment upload
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const pendingAttachmentCellRef = useRef<{ rowId: string; colId: string } | null>(null);

  // View tabs
  const [showAddViewDropdown, setShowAddViewDropdown] = useState(false);
  const addViewBtnRef = useRef<HTMLButtonElement>(null);
  const addViewDropdownRef = useRef<HTMLDivElement>(null);

  // Header dropdown (color, icon, guide)
  const [showHeaderDropdown, setShowHeaderDropdown] = useState(false);
  const headerChevronRef = useRef<HTMLButtonElement>(null);
  const [localColor, setLocalColor] = useState<string | undefined>(undefined);
  const [localIcon, setLocalIcon] = useState<string | undefined>(undefined);
  const [localGuide, setLocalGuide] = useState<string | undefined>(undefined);

  // Close add-view dropdown on outside click
  useEffect(() => {
    if (!showAddViewDropdown) return;
    const handler = (e: MouseEvent) => {
      if (
        addViewBtnRef.current?.contains(e.target as Node) ||
        addViewDropdownRef.current?.contains(e.target as Node)
      ) return;
      setShowAddViewDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAddViewDropdown]);

  // Calendar view state
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Undo/redo
  const undoPastRef = useRef<Array<{ columns: TableColumn[]; rows: TableRow[] }>>([]);
  const undoFutureRef = useRef<Array<{ columns: TableColumn[]; rows: TableRow[] }>>([]);
  const [undoCounter, setUndoCounter] = useState(0); // triggers re-render for canUndo/canRedo

  // Fetch selected spreadsheet
  const { data: spreadsheet, error: tableError } = useTable(selectedId ?? undefined);

  // Sync remote → local when spreadsheet loads
  useEffect(() => {
    if (spreadsheet) {
      setLocalColumns(spreadsheet.columns || []);
      setLocalRows(spreadsheet.rows || []);
      setLocalViewConfig(spreadsheet.viewConfig || { activeView: 'grid' });
      setLocalTitle(spreadsheet.title || '');
      setLocalColor(spreadsheet.color ?? undefined);
      setLocalIcon(spreadsheet.icon ?? undefined);
      setLocalGuide(spreadsheet.guide ?? undefined);
    }
  }, [spreadsheet]);

  // When URL param changes
  useEffect(() => {
    if (paramId) setSelectedId(paramId);
  }, [paramId]);

  // Sync URL when restored from localStorage (no paramId but selectedId exists)
  useEffect(() => {
    if (!paramId && selectedId) {
      navigate(`/tables/${selectedId}`, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // If the selected table doesn't exist (404), clear selection and go back to list
  useEffect(() => {
    if (tableError && (tableError as any)?.response?.status === 404) {
      setSelectedId(null);
      localStorage.removeItem(LAST_TABLE_KEY);
      navigate(ROUTES.TABLES, { replace: true });
    }
  }, [tableError, navigate]);

  // Theme detection for AG Grid
  const [isDark, setIsDark] = useState(
    document.documentElement.getAttribute('data-theme') === 'dark'
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Tables list
  const allTables = listData?.spreadsheets ?? [];
  const archivedTables = useMemo(() => {
    const archived = archivedData?.spreadsheets ?? [];
    return archived.filter((s) => s.isArchived);
  }, [archivedData]);

  const filteredTables = useMemo(() => {
    if (!searchQuery.trim()) return allTables;
    const q = searchQuery.toLowerCase();
    return allTables.filter((s) => s.title.toLowerCase().includes(q));
  }, [allTables, searchQuery]);

  // Auto-save trigger
  const triggerAutoSave = useCallback(
    (updates: { columns?: TableColumn[]; rows?: TableRow[]; viewConfig?: TableViewConfig; title?: string; color?: string; icon?: string; guide?: string }) => {
      if (!selectedId) return;
      autoSave(selectedId, updates);
    },
    [selectedId, autoSave],
  );

  // ─── Undo/redo helpers ─────────────────────────────────────────────

  const pushUndoState = useCallback(() => {
    undoPastRef.current = [...undoPastRef.current.slice(-49), { columns: localColumns, rows: localRows }];
    undoFutureRef.current = [];
    setUndoCounter((c) => c + 1);
  }, [localColumns, localRows]);

  const handleUndo = useCallback(() => {
    if (undoPastRef.current.length === 0) return;
    const prev = undoPastRef.current.pop()!;
    undoFutureRef.current.push({ columns: localColumns, rows: localRows });
    setLocalColumns(prev.columns);
    setLocalRows(prev.rows);
    triggerAutoSave({ columns: prev.columns, rows: prev.rows });
    setUndoCounter((c) => c + 1);
  }, [localColumns, localRows, triggerAutoSave]);

  const handleRedo = useCallback(() => {
    if (undoFutureRef.current.length === 0) return;
    const next = undoFutureRef.current.pop()!;
    undoPastRef.current.push({ columns: localColumns, rows: localRows });
    setLocalColumns(next.columns);
    setLocalRows(next.rows);
    triggerAutoSave({ columns: next.columns, rows: next.rows });
    setUndoCounter((c) => c + 1);
  }, [localColumns, localRows, triggerAutoSave]);

  // undoCounter is referenced to ensure re-renders update canUndo/canRedo
  const canUndo = undoCounter >= 0 && undoPastRef.current.length > 0;
  const canRedo = undoCounter >= 0 && undoFutureRef.current.length > 0;

  // Placeholder row style + conditional row coloring
  const getRowStyle = useCallback((params: { data?: { _id?: string; [key: string]: unknown } }) => {
    if (params.data?._id === PLACEHOLDER_ROW_ID) {
      return { opacity: '0.4', fontStyle: 'italic' } as Record<string, string>;
    }
    if (
      localViewConfig.rowColorMode === 'bySelectField' &&
      localViewConfig.rowColorColumnId &&
      params.data
    ) {
      const val = params.data[localViewConfig.rowColorColumnId];
      if (val != null && String(val) !== '') {
        const color = getTagColor(String(val));
        return { borderLeft: `3px solid ${color.bg}`, background: `${color.bg}33` } as Record<string, string>;
      }
    }
    return undefined;
  }, [localViewConfig.rowColorMode, localViewConfig.rowColorColumnId]);

  // ─── Data pipeline: filter → setFilter → sort → group → rowData ──

  const filteredRows = useMemo(() => {
    let result = localRows;

    // Standard filters
    const filters = localViewConfig.filters;
    if (filters && filters.length > 0) {
      result = result.filter((row) => {
        return filters.every((f) => {
          const val = row[f.columnId];
          const strVal = val != null ? String(val) : '';
          const filterVal = f.value != null ? String(f.value) : '';

          switch (f.operator) {
            case 'contains': return strVal.toLowerCase().includes(filterVal.toLowerCase());
            case 'doesNotContain': return !strVal.toLowerCase().includes(filterVal.toLowerCase());
            case 'is': return strVal === filterVal;
            case 'isNot': return strVal !== filterVal;
            case 'isEmpty': return val == null || strVal === '';
            case 'isNotEmpty': return val != null && strVal !== '';
            case 'greaterThan': return Number(val) > Number(f.value);
            case 'lessThan': return Number(val) < Number(f.value);
            case 'isBefore': return new Date(strVal) < new Date(filterVal);
            case 'isAfter': return new Date(strVal) > new Date(filterVal);
            case 'isChecked': return val === true;
            case 'isNotChecked': return val !== true;
            case 'isAnyOf': {
              const opts = Array.isArray(f.value) ? f.value : [];
              return opts.includes(strVal);
            }
            case 'isNoneOf': {
              const opts = Array.isArray(f.value) ? f.value : [];
              return !opts.includes(strVal);
            }
            default: return true;
          }
        });
      });
    }

    // Set filters (Excel-style checkbox filters)
    const setFilters = localViewConfig.setFilters;
    if (setFilters && Object.keys(setFilters).length > 0) {
      result = result.filter((row) => {
        return Object.entries(setFilters).every(([colId, allowedValues]) => {
          const val = row[colId];
          const strVal = val != null ? String(val) : '';
          // For multi-select, check if any selected value is in the allowed list
          if (Array.isArray(val)) {
            return (val as string[]).some((v) => allowedValues.includes(String(v)));
          }
          return allowedValues.includes(strVal);
        });
      });
    }

    return result;
  }, [localRows, localViewConfig.filters, localViewConfig.setFilters]);

  const sortedRows = useMemo(() => {
    const sorts = localViewConfig.sorts;
    if (!sorts || sorts.length === 0) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      for (const sort of sorts) {
        const aVal = a[sort.columnId];
        const bVal = b[sort.columnId];
        const aStr = aVal != null ? String(aVal) : '';
        const bStr = bVal != null ? String(bVal) : '';
        const dir = sort.direction === 'desc' ? -1 : 1;

        // Numeric comparison if both are numbers
        const aNum = Number(aStr);
        const bNum = Number(bStr);
        if (!isNaN(aNum) && !isNaN(bNum) && aStr !== '' && bStr !== '') {
          if (aNum !== bNum) return (aNum - bNum) * dir;
          continue;
        }

        const cmp = aStr.localeCompare(bStr);
        if (cmp !== 0) return cmp * dir;
      }
      return 0;
    });
  }, [filteredRows, localViewConfig.sorts]);

  // ─── Row grouping ──────────────────────────────────────────────
  const { groupedRows, toggleGroup, clearGrouping, isGrouped } = useRowGrouping({
    rows: sortedRows,
    groupByColumnId: localViewConfig.groupByColumnId ?? null,
    columns: localColumns,
  });

  const rowData = isGrouped ? groupedRows : sortedRows;

  // ─── Formulas ────────────────────────────────────────────────
  const { getComputedValue, getCellReference } = useFormulas({
    rows: localRows,
    columns: localColumns,
    hiddenColumns: localViewConfig.hiddenColumns,
  });

  // Footer aggregation: sum/avg for first numeric column
  const footerAgg = useMemo(() => {
    const numCol = localColumns.find((c) =>
      c.type === 'number' || c.type === 'currency' || c.type === 'percent',
    );
    if (!numCol) return null;
    const values = sortedRows
      .map((r) => Number(r[numCol.id]))
      .filter((n) => !isNaN(n));
    if (values.length === 0) return null;
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const isCurrency = numCol.type === 'currency';
    const isPercent = numCol.type === 'percent';
    const cs = tablesSettings.currencySymbol || '$';
    return {
      label: numCol.name,
      sum: isCurrency ? `${cs}${sum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : isPercent ? `${sum}%` : sum.toLocaleString(),
      avg: isCurrency ? `${cs}${avg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : isPercent ? `${avg.toFixed(1)}%` : avg.toLocaleString(undefined, { maximumFractionDigits: 1 }),
    };
  }, [localColumns, sortedRows, tablesSettings.currencySymbol]);

  // Calendar: effective date column + date→rows mapping
  const effectiveCalendarDateCol = useMemo(() => {
    if (localViewConfig.calendarDateColumnId) {
      return localColumns.find((c) => c.id === localViewConfig.calendarDateColumnId) || null;
    }
    return localColumns.find((c) => c.type === 'date') || null;
  }, [localColumns, localViewConfig.calendarDateColumnId]);

  const calendarDateMap = useMemo(() => {
    const map: Record<string, TableRow[]> = {};
    if (!effectiveCalendarDateCol) return map;
    for (const row of sortedRows) {
      const val = row[effectiveCalendarDateCol.id];
      if (!val) continue;
      const dateStr = String(val);
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map[key]) map[key] = [];
      map[key].push(row);
    }
    return map;
  }, [sortedRows, effectiveCalendarDateCol]);

  // Gallery: title column (first text col)
  const galleryTitleCol = useMemo(
    () => localColumns.find((c) => c.type === 'text') || localColumns[0],
    [localColumns],
  );

  // ─── Gantt column auto-detection ──────────────────────────────
  const ganttColumns = useMemo(() => {
    const dateColumns = localColumns.filter((c) => c.type === 'date');
    const textColumns = localColumns.filter((c) => c.type === 'text');
    return {
      start: localViewConfig.ganttStartColumnId || dateColumns[0]?.id || null,
      end: localViewConfig.ganttEndColumnId || dateColumns[1]?.id || dateColumns[0]?.id || null,
      label: localViewConfig.ganttLabelColumnId || textColumns[0]?.id || null,
    };
  }, [localColumns, localViewConfig.ganttStartColumnId, localViewConfig.ganttEndColumnId, localViewConfig.ganttLabelColumnId]);

  // AG Grid ref (needed early for keyboard shortcuts)
  const gridRef = useRef<AgGridReact>(null);

  // ─── Cell range selection ───────────────────────────────────────
  const {
    rangeContext,
    handleCellClicked: handleRangeCellClicked,
    handleCellMouseDown: handleRangeCellMouseDown,
    handleHeaderClicked: handleRangeHeaderClicked,
    handleRangeKeyDown,
    handleGlobalKeyDown: handleRangeGlobalKeyDown,
    clearRange,
    rebuildColIndexMap,
    rangeVersion,
    getSelectedCellCount,
    getCellsInRange,
  } = useCellRangeSelection(gridRef);

  // Rebuild column index map when columns / hidden columns change
  useEffect(() => {
    rebuildColIndexMap();
  }, [localColumns, localViewConfig.hiddenColumns, rebuildColIndexMap]);

  // ─── Find & replace ──────────────────────────────────────────
  const handleUpdateRowsDirect = useCallback((updatedRows: TableRow[]) => {
    setLocalRows(updatedRows);
    triggerAutoSave({ rows: updatedRows });
  }, [triggerAutoSave]);

  const findReplace = useFindReplace({
    gridRef,
    rows: localRows,
    columns: localColumns,
    hiddenColumns: localViewConfig.hiddenColumns,
    onUpdateRows: handleUpdateRowsDirect,
    pushUndoState,
  });

  // ─── Fill handle ─────────────────────────────────────────────
  const fillHandle = useFillHandle({
    gridRef,
    rows: localRows,
    onUpdateRows: handleUpdateRowsDirect,
    pushUndoState,
  });

  // ─── Batch edit state ────────────────────────────────────────
  const [showBatchEdit, setShowBatchEdit] = useState(false);

  // ─── Formula bar state ───────────────────────────────────────
  const [focusedCellInfo, setFocusedCellInfo] = useState<{ rowId: string; colId: string; rowIndex: number } | null>(null);

  // Track focused cell for formula bar
  useEffect(() => {
    const api = gridRef.current?.api;
    if (!api) return;

    const onCellFocused = () => {
      const focused = api.getFocusedCell();
      if (focused && focused.rowPinned == null) {
        const rowNode = api.getDisplayedRowAtIndex(focused.rowIndex);
        if (rowNode) {
          const rowId = (rowNode.data as TableRow)?._id;
          if (rowId && rowId !== PLACEHOLDER_ROW_ID) {
            setFocusedCellInfo({ rowId, colId: focused.column.getColId(), rowIndex: focused.rowIndex });
            return;
          }
        }
      }
      setFocusedCellInfo(null);
    };

    api.addEventListener('cellFocused', onCellFocused);
    return () => {
      api.removeEventListener('cellFocused', onCellFocused);
    };
  }, [gridRef, localRows]);

  // ── Clipboard paste handler ──────────────────────────────────────
  const handlePaste = useCallback(async () => {
    const api = gridRef.current?.api;
    if (!api) return;

    // Don't intercept paste while a cell is being edited
    const isEditing = api.getEditingCells()?.length ?? 0;
    if (isEditing > 0) return false;

    let text: string;
    try {
      text = await navigator.clipboard.readText();
    } catch {
      return false;
    }
    if (!text) return false;

    // Parse TSV (tab-separated columns, newline-separated rows)
    const pastedRows = text.split('\n').map((line) => line.split('\t'));
    if (pastedRows.length === 0 || (pastedRows.length === 1 && pastedRows[0].length === 1 && pastedRows[0][0] === '')) {
      return false;
    }

    // Determine paste origin: top-left of selected range, or focused cell
    let startRow: number;
    let startColId: string;

    const range = rangeContext.cellRangeRef.current;
    if (range) {
      startRow = Math.min(range.anchor.rowIndex, range.end.rowIndex);
      const anchorColIdx = rangeContext.colIndexMapRef.current.get(range.anchor.colId) ?? 0;
      const endColIdx = rangeContext.colIndexMapRef.current.get(range.end.colId) ?? 0;
      const minColIdx = Math.min(anchorColIdx, endColIdx);
      // Find the colId at minColIdx
      const sortedEntries = Array.from(rangeContext.colIndexMapRef.current.entries()).sort((a, b) => a[1] - b[1]);
      const found = sortedEntries.find(([, idx]) => idx === minColIdx);
      startColId = found ? found[0] : range.anchor.colId;
    } else {
      const focused = api.getFocusedCell();
      if (!focused || focused.rowPinned != null) return false;
      startRow = focused.rowIndex;
      startColId = focused.column.getColId();
    }

    // Get ordered data columns
    const sortedCols = Array.from(rangeContext.colIndexMapRef.current.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id);
    const startColIdx = sortedCols.indexOf(startColId);
    if (startColIdx < 0) return false;

    pushUndoState();

    const updatedRows = [...localRows];

    for (let r = 0; r < pastedRows.length; r++) {
      const targetRowIdx = startRow + r;
      const rowNode = api.getDisplayedRowAtIndex(targetRowIdx);
      if (!rowNode || rowNode.rowPinned === 'bottom') continue;
      const rowId = (rowNode.data as TableRow)?._id;
      if (!rowId || rowId === PLACEHOLDER_ROW_ID) continue;

      const localIdx = updatedRows.findIndex((lr) => lr._id === rowId);
      if (localIdx < 0) continue;

      const rowCopy = { ...updatedRows[localIdx] };
      for (let c = 0; c < pastedRows[r].length; c++) {
        const targetColId = sortedCols[startColIdx + c];
        if (!targetColId) break;
        rowCopy[targetColId] = pastedRows[r][c];
      }
      updatedRows[localIdx] = rowCopy;
    }

    setLocalRows(updatedRows);
    triggerAutoSave({ rows: updatedRows });
    api.refreshCells({ force: true });
    return true;
  }, [localRows, triggerAutoSave, pushUndoState, rangeContext]);

  // Global keyboard shortcuts (undo, redo, search, find-replace, paste)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cell range selection shortcuts (Ctrl+C, Escape to clear range)
      if (handleRangeGlobalKeyDown(e)) return;

      const mod = e.metaKey || e.ctrlKey;

      // Ctrl/Cmd+V → paste from clipboard
      if (mod && e.key === 'v') {
        const api = gridRef.current?.api;
        const isEditing = api?.getEditingCells()?.length ?? 0;
        if (isEditing === 0) {
          e.preventDefault();
          handlePaste();
          return;
        }
      }

      // Ctrl/Cmd+Z → undo
      if (mod && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      // Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z → redo
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
        return;
      }
      // Ctrl/Cmd+F → open find & replace
      if (mod && e.key === 'f' && selectedId) {
        e.preventDefault();
        findReplace.open();
        return;
      }
      // Ctrl/Cmd+H → open find & replace (with replace focus)
      if (mod && e.key === 'h' && selectedId) {
        e.preventDefault();
        findReplace.open();
        return;
      }
      // Escape → close find/replace, close search, or clear selection
      if (e.key === 'Escape') {
        if (findReplace.isOpen) {
          findReplace.close();
        } else if (showBatchEdit) {
          setShowBatchEdit(false);
        } else if (showSearch) {
          setShowSearch(false);
          setSearchText('');
        } else if (selectedRowIds.length > 0) {
          gridRef.current?.api?.deselectAll();
          setSelectedRowIds([]);
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo, handlePaste, selectedId, showSearch, showBatchEdit, selectedRowIds, handleRangeGlobalKeyDown, findReplace]);

  // ─── Handlers ──────────────────────────────────────────────────────

  const handleSelectTable = useCallback(
    (id: string) => {
      setSelectedId(id);
      setShowTemplates(false);
      localStorage.setItem(LAST_TABLE_KEY, id);
      navigate(`/tables/${id}`, { replace: true });
    },
    [navigate],
  );

  const handleCreateTable = useCallback(async () => {
    const columns = createDefaultColumns();
    const rows = createDefaultRows(tablesSettings.defaultRowCount);
    const created = await createTable.mutateAsync({ columns, rows });
    handleSelectTable(created.id);
  }, [createTable, handleSelectTable, tablesSettings.defaultRowCount]);

  const handleCreateFromTemplate = useCallback(
    async (tplOrKey: TableTemplate | string) => {
      const tpl = typeof tplOrKey === 'string'
        ? TABLE_TEMPLATES.find((t) => t.key === tplOrKey)
        : tplOrKey;
      if (!tpl) return;
      const { title, columns, rows } = tpl.createData();
      const created = await createTable.mutateAsync({ title, columns, rows });
      handleSelectTable(created.id);
      setShowTemplates(false);
    },
    [createTable, handleSelectTable],
  );

  const handleDeleteTable = useCallback(
    (id: string) => {
      setDeleteConfirmId(id);
    },
    [],
  );

  const confirmDeleteTable = useCallback(() => {
    if (!deleteConfirmId) return;
    deleteTable.mutate(deleteConfirmId);
    if (selectedId === deleteConfirmId) {
      setSelectedId(null);
      localStorage.removeItem(LAST_TABLE_KEY);
      navigate(ROUTES.TABLES, { replace: true });
    }
    setDeleteConfirmId(null);
  }, [deleteConfirmId, deleteTable, selectedId, navigate]);

  const handleRestoreTable = useCallback(
    (id: string) => {
      restoreTable.mutate(id);
    },
    [restoreTable],
  );

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setLocalTitle(newTitle);
      triggerAutoSave({ title: newTitle });
    },
    [triggerAutoSave],
  );

  const handleAddColumn = useCallback(
    (name: string, type: TableFieldType, options?: string[], linkedTableId?: string) => {
      pushUndoState();
      const newCol: TableColumn = {
        id: crypto.randomUUID(),
        name,
        type,
        width: 180,
        options: options?.length ? options : undefined,
        linkedTableId: linkedTableId || undefined,
      };
      const updated = [...localColumns, newCol];
      setLocalColumns(updated);
      triggerAutoSave({ columns: updated });
    },
    [localColumns, triggerAutoSave, pushUndoState],
  );

  const handleAddRow = useCallback(() => {
    pushUndoState();
    const newRow: TableRow = {
      _id: crypto.randomUUID(),
      _createdAt: new Date().toISOString(),
    };
    const updated = [...localRows, newRow];
    setLocalRows(updated);
    triggerAutoSave({ rows: updated });
  }, [localRows, triggerAutoSave, pushUndoState]);

  const handleDeleteRow = useCallback(
    (rowId: string) => {
      pushUndoState();
      const updated = localRows.filter((r) => r._id !== rowId);
      setLocalRows(updated);
      triggerAutoSave({ rows: updated });
    },
    [localRows, triggerAutoSave, pushUndoState],
  );

  // ─── Column context menu handlers ─────────────────────────────────

  const handleRenameColumn = useCallback(
    (colId: string, newName: string) => {
      pushUndoState();
      const updated = localColumns.map((c) =>
        c.id === colId ? { ...c, name: newName } : c,
      );
      setLocalColumns(updated);
      triggerAutoSave({ columns: updated });
    },
    [localColumns, triggerAutoSave, pushUndoState],
  );

  const handleDeleteColumn = useCallback(
    (colId: string) => {
      pushUndoState();
      const updatedCols = localColumns.filter((c) => c.id !== colId);
      const updatedRows = localRows.map((r) => {
        const copy = { ...r };
        delete copy[colId];
        return copy;
      });
      setLocalColumns(updatedCols);
      setLocalRows(updatedRows);
      triggerAutoSave({ columns: updatedCols, rows: updatedRows });
    },
    [localColumns, localRows, triggerAutoSave, pushUndoState],
  );

  const handleDuplicateColumn = useCallback(
    (colId: string) => {
      pushUndoState();
      const source = localColumns.find((c) => c.id === colId);
      if (!source) return;
      const newId = crypto.randomUUID();
      const newCol: TableColumn = { ...source, id: newId, name: `${source.name} (copy)` };
      const idx = localColumns.findIndex((c) => c.id === colId);
      const updatedCols = [...localColumns];
      updatedCols.splice(idx + 1, 0, newCol);
      // Copy data from all rows
      const updatedRows = localRows.map((r) => ({ ...r, [newId]: r[colId] }));
      setLocalColumns(updatedCols);
      setLocalRows(updatedRows);
      triggerAutoSave({ columns: updatedCols, rows: updatedRows });
    },
    [localColumns, localRows, triggerAutoSave, pushUndoState],
  );

  const handleChangeColumnType = useCallback(
    (colId: string, newType: TableFieldType) => {
      pushUndoState();
      const updated = localColumns.map((c) => {
        if (c.id !== colId) return c;
        const newCol: TableColumn = { ...c, type: newType };
        // Add default options for select types
        if ((newType === 'singleSelect' || newType === 'multiSelect') && !newCol.options?.length) {
          newCol.options = ['Option 1', 'Option 2', 'Option 3'];
        }
        // Clear options for non-select types
        if (newType !== 'singleSelect' && newType !== 'multiSelect') {
          delete newCol.options;
        }
        return newCol;
      });
      setLocalColumns(updated);
      triggerAutoSave({ columns: updated });
    },
    [localColumns, triggerAutoSave, pushUndoState],
  );

  const handleSortByColumn = useCallback(
    (colId: string, direction: 'asc' | 'desc') => {
      const sorts = [{ columnId: colId, direction }];
      const updated = { ...localViewConfig, sorts };
      setLocalViewConfig(updated);
      triggerAutoSave({ viewConfig: updated });
    },
    [localViewConfig, triggerAutoSave],
  );

  // ─── Row context menu handlers ────────────────────────────────────

  const handleInsertRowAbove = useCallback(
    (rowId: string) => {
      pushUndoState();
      const idx = localRows.findIndex((r) => r._id === rowId);
      if (idx < 0) return;
      const newRow: TableRow = { _id: crypto.randomUUID(), _createdAt: new Date().toISOString() };
      const updated = [...localRows];
      updated.splice(idx, 0, newRow);
      setLocalRows(updated);
      triggerAutoSave({ rows: updated });
    },
    [localRows, triggerAutoSave, pushUndoState],
  );

  const handleInsertRowBelow = useCallback(
    (rowId: string) => {
      pushUndoState();
      const idx = localRows.findIndex((r) => r._id === rowId);
      if (idx < 0) return;
      const newRow: TableRow = { _id: crypto.randomUUID(), _createdAt: new Date().toISOString() };
      const updated = [...localRows];
      updated.splice(idx + 1, 0, newRow);
      setLocalRows(updated);
      triggerAutoSave({ rows: updated });
    },
    [localRows, triggerAutoSave, pushUndoState],
  );

  const handleDuplicateRow = useCallback(
    (rowId: string) => {
      pushUndoState();
      const idx = localRows.findIndex((r) => r._id === rowId);
      if (idx < 0) return;
      const source = localRows[idx];
      const newRow: TableRow = { ...source, _id: crypto.randomUUID(), _createdAt: new Date().toISOString() };
      const updated = [...localRows];
      updated.splice(idx + 1, 0, newRow);
      setLocalRows(updated);
      triggerAutoSave({ rows: updated });
    },
    [localRows, triggerAutoSave, pushUndoState],
  );

  // Handle row context menu event from AG Grid
  const handleCellContextMenu = useCallback(
    (event: { data?: TableRow; event?: Event | null }) => {
      const mouseEvent = event.event as MouseEvent | undefined;
      if (!mouseEvent || !event.data) return;
      if (event.data._id === PLACEHOLDER_ROW_ID) return;
      mouseEvent.preventDefault();
      setRowMenu({ rowId: event.data._id, x: mouseEvent.clientX, y: mouseEvent.clientY });
    },
    [],
  );

  // Track selected rows for bulk actions
  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent) => {
      const rows = event.api.getSelectedRows() as TableRow[];
      const ids = rows.map((r) => r._id).filter((id) => id !== PLACEHOLDER_ROW_ID);
      setSelectedRowIds(ids);
      // Mutual exclusion: clear cell range when rows are selected via checkbox
      if (ids.length > 0) clearRange();
      // Refresh row number column so checkbox state updates
      event.api.refreshCells({ columns: ['__row_number__'], force: true });
    },
    [clearRange],
  );

  // Bulk delete selected rows
  const handleBulkDelete = useCallback(() => {
    if (selectedRowIds.length === 0) return;
    pushUndoState();
    const idSet = new Set(selectedRowIds);
    const updated = localRows.filter((r) => !idSet.has(r._id));
    setLocalRows(updated);
    triggerAutoSave({ rows: updated });
    gridRef.current?.api?.deselectAll();
    setSelectedRowIds([]);
  }, [selectedRowIds, localRows, triggerAutoSave, pushUndoState]);

  // Bulk duplicate selected rows
  const handleBulkDuplicate = useCallback(() => {
    if (selectedRowIds.length === 0) return;
    pushUndoState();
    const idSet = new Set(selectedRowIds);
    const updated: TableRow[] = [];
    for (const row of localRows) {
      updated.push(row);
      if (idSet.has(row._id)) {
        updated.push({ ...row, _id: crypto.randomUUID(), _createdAt: new Date().toISOString() });
      }
    }
    setLocalRows(updated);
    triggerAutoSave({ rows: updated });
    gridRef.current?.api?.deselectAll();
    setSelectedRowIds([]);
  }, [selectedRowIds, localRows, triggerAutoSave, pushUndoState]);

  // Clear selection helper
  const handleClearSelection = useCallback(() => {
    gridRef.current?.api?.deselectAll();
    setSelectedRowIds([]);
  }, []);

  // Handle row field update (for expand modal)
  const handleUpdateRowField = useCallback(
    (rowId: string, colId: string, value: unknown) => {
      const updatedRows = localRows.map((r) =>
        r._id === rowId ? { ...r, [colId]: value } : r,
      );
      setLocalRows(updatedRows);
      triggerAutoSave({ rows: updatedRows });
    },
    [localRows, triggerAutoSave],
  );

  // Attachment file upload handler
  const handleAttachmentUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      const pending = pendingAttachmentCellRef.current;
      if (!file || !pending) return;

      const formData = new FormData();
      formData.append('file', file);
      try {
        const { data: resp } = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const attachment: TableAttachment = resp.data;
        const row = localRows.find((r) => r._id === pending.rowId);
        const existing: TableAttachment[] = Array.isArray(row?.[pending.colId]) ? (row![pending.colId] as TableAttachment[]) : [];
        const updated = [...existing, attachment];
        handleUpdateRowField(pending.rowId, pending.colId, updated);
      } catch {
        useToastStore.getState().addToast({ message: t('tables.uploadFailed', 'File upload failed'), type: 'error' });
      }
      // Reset file input
      if (attachmentInputRef.current) attachmentInputRef.current.value = '';
      pendingAttachmentCellRef.current = null;
    },
    [localRows, handleUpdateRowField],
  );

  // Handle cell click for attachment, singleSelect, and multiSelect columns
  const handleCellClickedWithAttachment = useCallback(
    (event: any) => {
      const colId = event.colDef?.field;
      const col = localColumns.find((c) => c.id === colId);

      // Attachment columns → open file picker
      if (col?.type === 'attachment') {
        const rowId = event.data?._id;
        if (rowId && rowId !== PLACEHOLDER_ROW_ID) {
          pendingAttachmentCellRef.current = { rowId, colId };
          attachmentInputRef.current?.click();
          return;
        }
      }

      // Single/multi select → open editor on single click
      if (col?.type === 'singleSelect' || col?.type === 'multiSelect') {
        const rowId = event.data?._id;
        if (rowId && rowId !== PLACEHOLDER_ROW_ID) {
          const api = gridRef.current?.api;
          if (api && api.getEditingCells().length === 0) {
            api.startEditingCell({
              rowIndex: event.rowIndex,
              colKey: colId,
            });
          }
        }
      }

      // Fall through to range selection handler
      handleRangeCellClicked(event);
    },
    [localColumns, handleRangeCellClicked],
  );

  // Placeholder row for inline "add row"
  const pinnedBottomRowData = useMemo(() => [{ _id: PLACEHOLDER_ROW_ID, _createdAt: '' }], []);

  // AG Grid cell edit (controlled / read-only edit)
  const handleCellEditRequest = useCallback(
    (event: CellEditRequestEvent) => {
      const rowId = (event.data as TableRow)._id;
      const colId = event.colDef.field!;
      const newValue = event.newValue;

      pushUndoState();

      // If editing the placeholder row, create a real row first
      if (rowId === PLACEHOLDER_ROW_ID) {
        const newRow: TableRow = {
          _id: crypto.randomUUID(),
          _createdAt: new Date().toISOString(),
          [colId]: newValue,
        };
        const updated = [...localRows, newRow];
        setLocalRows(updated);
        triggerAutoSave({ rows: updated });
        return;
      }

      const updatedRows = localRows.map((r) =>
        r._id === rowId ? { ...r, [colId]: newValue } : r,
      );
      setLocalRows(updatedRows);
      triggerAutoSave({ rows: updatedRows });
    },
    [localRows, triggerAutoSave, pushUndoState],
  );

  // AG Grid cell keyboard handling
  const handleCellKeyDown = useCallback(
    (event: CellKeyDownEvent) => {
      const kbEvent = event.event as KeyboardEvent | undefined;
      if (!kbEvent) return;

      // Shift+Arrow / Arrow → cell range selection
      handleRangeKeyDown(event);

      // Typing with range selection → open batch edit
      const isEditing = gridRef.current?.api?.getEditingCells()?.length ?? 0;
      if (
        isEditing === 0 &&
        getSelectedCellCount() > 1 &&
        kbEvent.key.length === 1 &&
        !kbEvent.metaKey &&
        !kbEvent.ctrlKey &&
        !kbEvent.altKey
      ) {
        kbEvent.preventDefault();
        setShowBatchEdit(true);
        return;
      }

      // Delete/Backspace clears cell value (only when not in edit mode)
      if ((kbEvent.key === 'Delete' || kbEvent.key === 'Backspace') && isEditing === 0) {
        // If a range is active, bulk-clear all cells in the range
        const rangeCells = getCellsInRange();
        if (rangeCells.length > 0) {
          pushUndoState();
          const api = gridRef.current?.api;
          if (!api) return;
          // Collect row IDs and col IDs to clear
          const clearMap = new Map<string, Set<string>>();
          for (const cell of rangeCells) {
            const rowNode = api.getDisplayedRowAtIndex(cell.rowIndex);
            if (!rowNode || rowNode.rowPinned === 'bottom') continue;
            const rowId = (rowNode.data as TableRow)?._id;
            if (!rowId || rowId === PLACEHOLDER_ROW_ID) continue;
            if (!clearMap.has(rowId)) clearMap.set(rowId, new Set());
            clearMap.get(rowId)!.add(cell.colId);
          }
          const updatedRows = localRows.map((r) => {
            const colIds = clearMap.get(r._id);
            if (!colIds) return r;
            const copy = { ...r };
            for (const cid of colIds) copy[cid] = undefined;
            return copy;
          });
          setLocalRows(updatedRows);
          triggerAutoSave({ rows: updatedRows });
          clearRange();
          return;
        }

        // Single cell clear
        const colId = event.colDef.field;
        if (!colId) return;
        const rowId = (event.data as TableRow)?._id;
        if (!rowId || rowId === PLACEHOLDER_ROW_ID) return;

        pushUndoState();
        const updatedRows = localRows.map((r) =>
          r._id === rowId ? { ...r, [colId]: undefined } : r,
        );
        setLocalRows(updatedRows);
        triggerAutoSave({ rows: updatedRows });
      }
    },
    [localRows, triggerAutoSave, pushUndoState, handleRangeKeyDown, getCellsInRange, clearRange],
  );

  // AG Grid row drag reorder
  const handleRowDragEnd = useCallback(
    (event: RowDragEndEvent) => {
      const movedData = event.node.data as TableRow;
      const overIndex = event.overIndex;
      if (overIndex < 0) return;

      pushUndoState();
      const copy = localRows.filter((r) => r._id !== movedData._id);
      copy.splice(overIndex, 0, movedData);
      setLocalRows(copy);
      triggerAutoSave({ rows: copy });
    },
    [localRows, triggerAutoSave, pushUndoState],
  );

  // Column resize persistence
  const handleColumnResized = useCallback(
    (event: ColumnResizedEvent) => {
      if (!event.finished || !event.column) return;
      const colId = event.column.getColId();
      // Skip row number column (no colId match in localColumns)
      const colIndex = localColumns.findIndex((c) => c.id === colId);
      if (colIndex < 0) return;
      const newWidth = event.column.getActualWidth();
      const updated = localColumns.map((c, i) =>
        i === colIndex ? { ...c, width: newWidth } : c,
      );
      setLocalColumns(updated);
      triggerAutoSave({ columns: updated });
    },
    [localColumns, triggerAutoSave],
  );

  // Column reorder via drag
  const handleColumnMoved = useCallback(
    (event: ColumnMovedEvent) => {
      if (!event.finished || !event.column) return;
      const api = gridRef.current?.api;
      if (!api) return;
      const hidden = new Set(localViewConfig.hiddenColumns || []);
      // Read new column order from AG Grid (only visible columns)
      const allDisplayedCols = api.getAllDisplayedColumns();
      const visibleOrder: string[] = [];
      for (const agCol of allDisplayedCols) {
        const id = agCol.getColId();
        if (localColumns.some((c) => c.id === id)) {
          visibleOrder.push(id);
        }
      }
      // Only update if visible order actually changed
      const currentVisibleOrder = localColumns.filter((c) => !hidden.has(c.id)).map((c) => c.id);
      if (JSON.stringify(visibleOrder) === JSON.stringify(currentVisibleOrder)) return;
      // Rebuild full column list: visible columns in new order, then hidden columns preserving original order
      const visibleSet = new Set(visibleOrder);
      const reordered = [
        ...visibleOrder.map((id) => localColumns.find((c) => c.id === id)!),
        ...localColumns.filter((c) => !visibleSet.has(c.id)),
      ];
      setLocalColumns(reordered);
      triggerAutoSave({ columns: reordered });
    },
    [localColumns, localViewConfig.hiddenColumns, triggerAutoSave],
  );

  // ─── New column/row handlers for P3 ──────────────────────────────

  const handleHideColumn = useCallback(
    (colId: string) => {
      const hidden = new Set(localViewConfig.hiddenColumns || []);
      hidden.add(colId);
      const updated = { ...localViewConfig, hiddenColumns: Array.from(hidden) };
      setLocalViewConfig(updated);
      triggerAutoSave({ viewConfig: updated });
    },
    [localViewConfig, triggerAutoSave],
  );

  const handleFreezeUpTo = useCallback(
    (colId: string) => {
      const idx = localColumns.findIndex((c) => c.id === colId);
      if (idx < 0) return;
      const count = Math.min(idx + 1, 3);
      const updated = { ...localViewConfig, frozenColumnCount: count };
      setLocalViewConfig(updated);
      triggerAutoSave({ viewConfig: updated });
    },
    [localColumns, localViewConfig, triggerAutoSave],
  );

  const handleUnfreezeColumns = useCallback(() => {
    const updated = { ...localViewConfig, frozenColumnCount: 0 };
    setLocalViewConfig(updated);
    triggerAutoSave({ viewConfig: updated });
  }, [localViewConfig, triggerAutoSave]);

  const handleInsertColumnLeft = useCallback(
    (colId: string) => {
      pushUndoState();
      const idx = localColumns.findIndex((c) => c.id === colId);
      if (idx < 0) return;
      const newCol: TableColumn = { id: crypto.randomUUID(), name: t('tables.newColumnName'), type: 'text', width: 180 };
      const updated = [...localColumns];
      updated.splice(idx, 0, newCol);
      setLocalColumns(updated);
      triggerAutoSave({ columns: updated });
    },
    [localColumns, triggerAutoSave, pushUndoState, t],
  );

  const handleInsertColumnRight = useCallback(
    (colId: string) => {
      pushUndoState();
      const idx = localColumns.findIndex((c) => c.id === colId);
      if (idx < 0) return;
      const newCol: TableColumn = { id: crypto.randomUUID(), name: t('tables.newColumnName'), type: 'text', width: 180 };
      const updated = [...localColumns];
      updated.splice(idx + 1, 0, newCol);
      setLocalColumns(updated);
      triggerAutoSave({ columns: updated });
    },
    [localColumns, triggerAutoSave, pushUndoState, t],
  );

  const handleEditColumnDescription = useCallback(
    (colId: string, description: string) => {
      const updated = localColumns.map((c) =>
        c.id === colId ? { ...c, description: description || undefined } : c,
      );
      setLocalColumns(updated);
      triggerAutoSave({ columns: updated });
    },
    [localColumns, triggerAutoSave],
  );

  // ─── Excel export ──────────────────────────────────────────────
  const handleExportExcel = useCallback(() => {
    const hidden = new Set(localViewConfig.hiddenColumns || []);
    const visibleCols = localColumns.filter((c) => !hidden.has(c.id));

    const exportData = sortedRows.map((row) => {
      const obj: Record<string, unknown> = {};
      if (tablesSettings.includeRowIdsInExport) {
        obj['_id'] = row._id;
      }
      for (const col of visibleCols) {
        let val = row[col.id];
        // For formula cells, use computed value
        if (isFormulaValue(val)) {
          val = getComputedValue(row._id, col.id, val);
        }
        // Format arrays
        if (Array.isArray(val)) val = val.join(', ');
        obj[col.name] = val ?? '';
      }
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    XLSX.writeFile(wb, `${localTitle || 'table'}.xlsx`);
  }, [localColumns, sortedRows, localViewConfig.hiddenColumns, localTitle, getComputedValue, tablesSettings.includeRowIdsInExport]);

  // ─── CSV/Excel import ──────────────────────────────────────────
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleImportCSV = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleFileImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) { useToastStore.getState().addToast({ type: 'error', message: 'File must be under 50 MB' }); return; }

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

      if (jsonData.length < 1) return;

      // Auto-detect if first row looks like headers
      const firstRow = jsonData[0] as unknown[];
      const allStrings = firstRow.every((v) => typeof v === 'string' && v.trim().length > 0);
      const hasHeader = allStrings;

      const headerRow = hasHeader ? firstRow.map((h) => String(h || 'Column')) : firstRow.map((_, i) => `Column ${i + 1}`);
      const dataRows = hasHeader ? jsonData.slice(1) : jsonData;

      // Infer column types from sample data
      const columnMappings = headerRow.map((name, idx) => {
        const sampleValues = dataRows.slice(0, 10).map((r) => r[idx]).filter(Boolean);
        let type: TableFieldType = 'text';
        if (sampleValues.length > 0 && sampleValues.every((v) => typeof v === 'number' || !isNaN(Number(v)))) {
          type = 'number';
        } else if (sampleValues.length > 0 && sampleValues.every((v) => typeof v === 'boolean' || v === 'true' || v === 'false')) {
          type = 'checkbox';
        }
        return { name: String(name), type };
      });

      setImportModalData({
        fileName: file.name.replace(/\.(csv|xlsx?|xls)$/i, ''),
        allRows: jsonData,
        firstRowHeader: hasHeader,
        columnMappings,
      });
    } catch (error) {
      console.error('Import failed:', error);
    }

    // Reset input
    e.target.value = '';
  }, []);

  const handleImportConfirm = useCallback(async () => {
    if (!importModalData) return;

    const { fileName, allRows, firstRowHeader, columnMappings } = importModalData;
    const dataRows = firstRowHeader ? allRows.slice(1) : allRows;

    const columns: TableColumn[] = columnMappings.map((col) => ({
      id: crypto.randomUUID(),
      name: col.name,
      type: col.type,
      width: 150,
    }));

    const rows: TableRow[] = dataRows.map((row) => {
      const cells: Record<string, unknown> = {
        _id: crypto.randomUUID(),
        _createdAt: new Date().toISOString(),
      };
      columns.forEach((col, idx) => {
        cells[col.id] = (row as unknown[])[idx] ?? '';
      });
      return cells as TableRow;
    });

    try {
      const created = await createTable.mutateAsync({ title: fileName, columns, rows });
      handleSelectTable(created.id);
    } catch (error) {
      console.error('Import failed:', error);
    }

    setImportModalData(null);
  }, [importModalData, createTable, handleSelectTable]);

  // ─── Row grouping handlers ────────────────────────────────────
  const handleGroupByColumn = useCallback(
    (colId: string) => {
      const updated = { ...localViewConfig, groupByColumnId: colId };
      setLocalViewConfig(updated);
      triggerAutoSave({ viewConfig: updated });
    },
    [localViewConfig, triggerAutoSave],
  );

  const handleUngroupRows = useCallback(() => {
    const updated = { ...localViewConfig, groupByColumnId: null };
    setLocalViewConfig(updated);
    triggerAutoSave({ viewConfig: updated });
    clearGrouping();
  }, [localViewConfig, triggerAutoSave, clearGrouping]);



  // ─── Batch edit handler ──────────────────────────────────────
  const handleBatchEditConfirm = useCallback(
    (value: string) => {
      const cells = getCellsInRange();
      if (cells.length === 0) return;

      const api = gridRef.current?.api;
      if (!api) return;

      pushUndoState();

      const updateMap = new Map<string, Record<string, unknown>>();
      for (const cell of cells) {
        const rowNode = api.getDisplayedRowAtIndex(cell.rowIndex);
        if (!rowNode || rowNode.rowPinned === 'bottom') continue;
        const rowId = (rowNode.data as TableRow)?._id;
        if (!rowId || rowId === PLACEHOLDER_ROW_ID) continue;
        if (!updateMap.has(rowId)) updateMap.set(rowId, {});
        updateMap.get(rowId)![cell.colId] = value;
      }

      const updatedRows = localRows.map((r) => {
        const updates = updateMap.get(r._id);
        if (!updates) return r;
        return { ...r, ...updates };
      });

      setLocalRows(updatedRows);
      triggerAutoSave({ rows: updatedRows });
      setShowBatchEdit(false);
      clearRange();
    },
    [localRows, getCellsInRange, pushUndoState, triggerAutoSave, clearRange],
  );

  // ─── Formula bar edit handler ──────────────────────────────────
  const handleFormulaBarEdit = useCallback(
    (value: string) => {
      if (!focusedCellInfo) return;
      pushUndoState();
      const updatedRows = localRows.map((r) =>
        r._id === focusedCellInfo.rowId ? { ...r, [focusedCellInfo.colId]: value } : r,
      );
      setLocalRows(updatedRows);
      triggerAutoSave({ rows: updatedRows });
    },
    [focusedCellInfo, localRows, pushUndoState, triggerAutoSave],
  );

  // Computed views list (default to just Grid view)
  const currentViews: TableViewTab[] = useMemo(
    () => localViewConfig.views?.length ? localViewConfig.views : [{ key: 'grid', label: 'Grid view' }],
    [localViewConfig.views],
  );

  // View toggle
  const handleViewToggle = useCallback(
    (view: TableViewConfig['activeView']) => {
      const updated = { ...localViewConfig, activeView: view };
      setLocalViewConfig(updated);
      triggerAutoSave({ viewConfig: updated });
    },
    [localViewConfig, triggerAutoSave],
  );

  // Add a new view tab
  const handleAddView = useCallback(
    (key: TableViewTab['key'], label: string) => {
      const views = [...currentViews, { key, label }];
      const updated = { ...localViewConfig, views, activeView: key };
      setLocalViewConfig(updated);
      triggerAutoSave({ viewConfig: updated });
      setShowAddViewDropdown(false);
    },
    [currentViews, localViewConfig, triggerAutoSave],
  );

  // Remove a view tab (can't remove if only 1 left)
  const handleRemoveView = useCallback(
    (index: number) => {
      if (currentViews.length <= 1) return;
      const views = currentViews.filter((_, i) => i !== index);
      const removedView = currentViews[index];
      // If we removed the active view, switch to the first view
      const activeView = removedView.key === localViewConfig.activeView
        ? views[0].key
        : localViewConfig.activeView;
      const updated = { ...localViewConfig, views, activeView };
      setLocalViewConfig(updated);
      triggerAutoSave({ viewConfig: updated });
    },
    [currentViews, localViewConfig, triggerAutoSave],
  );

  // Row number cell renderer: [AG-drag-handle] | row number (checkbox on hover) | expand
  const RowNumberRenderer = useCallback((params: ICellRendererParams) => {
    const rowId = (params.data as TableRow)?._id;
    const rowNum = params.node.rowIndex != null ? params.node.rowIndex + 1 : '';
    if (!rowId || rowId === PLACEHOLDER_ROW_ID) {
      return <span className="tables-row-number">{rowNum}</span>;
    }
    const isSelected = params.node.isSelected();
    return (
      <span className="tables-row-number-wrap">
        <span
          className={`tables-row-number-checkbox${isSelected ? ' is-checked' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            params.node.setSelected(!isSelected);
          }}
        >
          <span className="tables-row-num-text">{rowNum}</span>
          <span className="tables-row-cb-icon">
            {isSelected ? <CheckSquare size={14} /> : <span className="tables-row-cb-empty" />}
          </span>
        </span>
        <button
          className="tables-row-expand-btn"
          onClick={(e) => { e.stopPropagation(); setExpandedRowId(rowId); }}
          title={t('tables.expandRow')}
        >
          <Maximize2 size={12} />
        </button>
      </span>
    );
  }, [t]);

  // AG Grid column defs
  const ROW_NUMBER_COL: ColDef = useMemo(() => ({
    colId: '__row_number__',
    headerName: '',
    headerComponent: RowNumberHeader,
    width: 80,
    maxWidth: 80,
    minWidth: 80,
    pinned: 'left',
    editable: false,
    sortable: false,
    resizable: false,
    suppressMovable: true,
    lockPosition: 'left',
    rowDrag: true,
    cellRenderer: RowNumberRenderer,
    cellStyle: { padding: 0 },
  }), [RowNumberRenderer]);

  const ADD_COLUMN_COL: ColDef = useMemo(() => ({
    headerName: '',
    width: 44,
    maxWidth: 44,
    minWidth: 44,
    editable: false,
    sortable: false,
    resizable: false,
    suppressMovable: true,
    headerComponent: () => <AddColumnHeader setShowAddColumn={setShowAddColumn} />,
    cellRenderer: () => null,
  }), []);

  const handleColumnMenuOpen = useCallback((columnId: string, x: number, y: number) => {
    setColumnMenu({ columnId, x, y });
  }, []);

  const hiddenColumnsSet = useMemo(
    () => new Set(localViewConfig.hiddenColumns || []),
    [localViewConfig.hiddenColumns],
  );

  const columnDefs = useMemo(() => {
    const colSettings: BuildColDefsSettings = {
      dateFormat: tablesSettings.dateFormat,
      currencySymbol: tablesSettings.currencySymbol,
      showFieldTypeIcons: tablesSettings.showFieldTypeIcons,
    };
    const baseDefs = buildColDefs(localColumns, t, handleColumnMenuOpen, hiddenColumnsSet, localViewConfig.frozenColumnCount, handleRangeHeaderClicked, colSettings, linkedTablesMap);
    // Add formula valueGetter to each data column
    const formulaDefs: ColDef[] = baseDefs.map((def) => {
      if (!def.field) return def;
      const fieldId = def.field;
      return {
        ...def,
        valueGetter: (params) => {
          const data = params.data as TableRow | undefined;
          if (!data) return '';
          const raw = data[fieldId];
          if (isFormulaValue(raw)) {
            return getComputedValue(data._id, fieldId, raw);
          }
          return raw;
        },
      } as ColDef;
    });
    return [ROW_NUMBER_COL, ...formulaDefs, ADD_COLUMN_COL];
  }, [localColumns, t, ROW_NUMBER_COL, ADD_COLUMN_COL, handleColumnMenuOpen, hiddenColumnsSet, localViewConfig.frozenColumnCount, handleRangeHeaderClicked, getComputedValue, tablesSettings.dateFormat, tablesSettings.currencySymbol, tablesSettings.showFieldTypeIcons]);

  // Kanban DnD
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const kanbanGroupCol = localColumns.find(
    (c) => c.id === localViewConfig.kanbanGroupByColumnId && c.type === 'singleSelect',
  );

  // If no kanban group column is set, try to auto-pick the first singleSelect
  const effectiveKanbanCol = kanbanGroupCol ?? localColumns.find((c) => c.type === 'singleSelect');

  const kanbanGroups = useMemo(() => {
    if (!effectiveKanbanCol) return null;
    const opts = effectiveKanbanCol.options || [];
    const grouped: Record<string, TableRow[]> = {};
    for (const opt of opts) {
      grouped[opt] = [];
    }
    grouped[''] = []; // uncategorized
    for (const row of localRows) {
      const val = String(row[effectiveKanbanCol.id] || '');
      if (!grouped[val]) grouped[val] = [];
      grouped[val].push(row);
    }
    return grouped;
  }, [effectiveKanbanCol, localRows]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggedRowId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggedRowId(null);
      if (!event.over || !effectiveKanbanCol) return;

      const rowId = event.active.id as string;
      const newValue = event.over.id as string;

      const updatedRows = localRows.map((r) =>
        r._id === rowId ? { ...r, [effectiveKanbanCol.id]: newValue } : r,
      );
      setLocalRows(updatedRows);
      triggerAutoSave({ rows: updatedRows });
    },
    [effectiveKanbanCol, localRows, triggerAutoSave],
  );

  const draggedRow = draggedRowId ? localRows.find((r) => r._id === draggedRowId) : null;

  // Row data for AG Grid (with getRowId)
  const getRowId = useCallback((params: { data: TableRow }) => params.data._id, []);

  // Select columns for kanban group-by
  const selectColumns = localColumns.filter((c) => c.type === 'singleSelect');

  return (
    <div className="tables-page">
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <AppSidebar
        storageKey="atlas_tables_sidebar"
        title={t('tables.title')}
        headerAction={
          <div style={{ display: 'flex', gap: 2 }}>
            <IconButton
              icon={<LayoutTemplate size={14} />}
              label={t('tables.browseTemplates')}
              onClick={() => setShowTemplates(true)}
              size={28}
            />
            <IconButton
              icon={<Plus size={14} />}
              label={t('tables.newTable')}
              onClick={handleCreateTable}
              size={28}
            />
          </div>
        }
        search={
          <div className="tables-sidebar-search">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('tables.searchTables')}
            />
          </div>
        }
        footer={
          <>
            <div className="tables-sidebar-views">
              {[
                { key: 'grid' as const, icon: LayoutGrid, label: t('tables.gridView', 'Grid view') },
                { key: 'kanban' as const, icon: Kanban, label: t('tables.kanbanView', 'Kanban') },
                { key: 'calendar' as const, icon: Calendar, label: t('tables.calendarView', 'Calendar') },
                { key: 'gallery' as const, icon: GalleryHorizontalEnd, label: t('tables.galleryView', 'Gallery') },
                { key: 'gantt' as const, icon: GanttChart, label: t('tables.ganttView', 'Gantt') },
              ].map((v) => (
                <button
                  key={v.key}
                  className={`tables-sidebar-view-item${localViewConfig.activeView === v.key ? ' active' : ''}`}
                  onClick={() => handleViewToggle(v.key)}
                >
                  <v.icon size={14} />
                  <span>{v.label}</span>
                </button>
              ))}
            </div>
            <button
              className="tables-sidebar-view-item"
              onClick={() => openSettings('tables')}
              title="Tables settings"
            >
              <Settings2 size={14} />
              <span>Settings</span>
            </button>
          </>
        }
      >
        <div className="tables-sidebar-list">
          {filteredTables.length === 0 && !listLoading && (
            <div className="tables-sidebar-empty">{t('tables.noTables')}</div>
          )}

          {filteredTables.map((table) => {
            const SidebarIcon = getTableIcon(table.icon);
            return (
            <div
              key={table.id}
              role="button"
              tabIndex={0}
              className={`tables-sidebar-item${selectedId === table.id ? ' active' : ''}`}
              onClick={() => handleSelectTable(table.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSelectTable(table.id); }}
            >
              <SidebarIcon size={14} style={table.color ? { color: table.color } : undefined} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {table.title}
              </span>
              <IconButton
                icon={<Trash2 size={12} />}
                label={t('tables.delete')}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteTable(table.id);
                }}
                size={22}
                destructive
                tooltip={false}
                className="tables-sidebar-delete-btn"
                style={{ opacity: 0, transition: 'opacity 100ms' }}
              />
            </div>
            );
          })}

          {/* Trash section */}
          {archivedTables.length > 0 && (
            <>
              <button
                className="tables-sidebar-item"
                onClick={() => setShowTrash(!showTrash)}
                style={{ marginTop: 8 }}
              >
                <Trash2 size={14} />
                <span>{t('tables.trash')}</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                  {archivedTables.length}
                </span>
              </button>
              {showTrash &&
                archivedTables.map((table) => (
                  <div
                    key={table.id}
                    className="tables-sidebar-item archived"
                  >
                    <Table2 size={14} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {table.title}
                    </span>
                    <IconButton
                      icon={<RotateCcw size={12} />}
                      label={t('tables.restore')}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRestoreTable(table.id);
                      }}
                      size={22}
                    />
                  </div>
                ))}
            </>
          )}
        </div>
      </AppSidebar>

      {/* ── Main content ──────────────────────────────────────────── */}
      <div className="tables-main">
        {showTemplates ? (
          <TableTemplateGallery
            onSelect={(tpl) => handleCreateFromTemplate(tpl)}
            onClose={() => setShowTemplates(false)}
          />
        ) : !selectedId || !spreadsheet ? (
          <div className="tables-empty-state">
            <FeatureEmptyState
              illustration="table"
              title={t('tables.empty.title')}
              description={t('tables.empty.desc')}
              highlights={[
                { icon: <Table2 size={14} />, title: t('tables.empty.h1Title'), description: t('tables.empty.h1Desc') },
                { icon: <Layers size={14} />, title: t('tables.empty.h2Title'), description: t('tables.empty.h2Desc') },
                { icon: <LayoutGrid size={14} />, title: t('tables.empty.h3Title'), description: t('tables.empty.h3Desc') },
              ]}
              actionLabel={t('tables.newTable')}
              actionIcon={<Plus size={14} />}
              onAction={handleCreateTable}
            />
            <div className="tables-templates-section">
              <div className="tables-templates-label">{t('tables.startFromTemplate')}</div>
              <div className="tables-templates-grid">
                {TABLE_TEMPLATES.slice(0, 6).map((tpl) => (
                  <button
                    key={tpl.key}
                    className="tables-template-card"
                    onClick={() => handleCreateFromTemplate(tpl)}
                  >
                    <span className="tables-template-icon">{tpl.icon}</span>
                    <span className="tables-template-name">{tpl.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Purple topbar */}
            <div className="tables-topbar" style={localColor ? { background: localColor } : undefined}>
              {/* Row 1: Title + actions */}
              <div className="tables-topbar-row">
                <input
                  className="tables-topbar-title"
                  value={localTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  onBlur={() => triggerAutoSave({ title: localTitle })}
                />
                <IconButton
                  ref={headerChevronRef}
                  icon={<ChevronDown size={14} />}
                  label="Table settings"
                  onClick={() => setShowHeaderDropdown(!showHeaderDropdown)}
                  size={28}
                  className="tables-topbar-chevron"
                  style={{ color: 'inherit' }}
                />

                {showHeaderDropdown && (
                  <TableHeaderDropdown
                    title={localTitle}
                    color={localColor}
                    icon={localIcon}
                    guide={localGuide}
                    anchorRect={headerChevronRef.current?.getBoundingClientRect() ?? null}
                    onTitleChange={(title) => {
                      setLocalTitle(title);
                      triggerAutoSave({ title });
                    }}
                    onColorChange={(color) => {
                      setLocalColor(color);
                      triggerAutoSave({ color: color ?? '' });
                    }}
                    onIconChange={(icon) => {
                      setLocalIcon(icon);
                      triggerAutoSave({ icon: icon ?? '' });
                    }}
                    onGuideChange={(guide) => {
                      setLocalGuide(guide);
                      triggerAutoSave({ guide });
                    }}
                    onClose={() => setShowHeaderDropdown(false)}
                  />
                )}

                <div className="tables-topbar-spacer" />

                <IconButton
                  icon={<Undo2 size={14} />}
                  label={t('tables.undo')}
                  onClick={handleUndo}
                  disabled={!canUndo}
                  size={28}
                  style={{ color: 'inherit' }}
                />
                <IconButton
                  icon={<Redo2 size={14} />}
                  label={t('tables.redo')}
                  onClick={handleRedo}
                  disabled={!canRedo}
                  size={28}
                  style={{ color: 'inherit' }}
                />

                <IconButton
                  icon={<Download size={14} />}
                  label="Export to Excel"
                  onClick={handleExportExcel}
                  size={28}
                  style={{ color: 'inherit' }}
                />

                <IconButton
                  icon={<Upload size={14} />}
                  label="Import CSV/Excel"
                  onClick={handleImportCSV}
                  size={28}
                  style={{ color: 'inherit' }}
                />

                <IconButton
                  icon={<Search size={14} />}
                  label={t('tables.search')}
                  onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchText(''); }}
                  active={showSearch}
                  size={28}
                  style={{ color: 'inherit' }}
                />

                {isSaving && (
                  <span className="tables-topbar-saving" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Loader2 size={12} className="tables-spin" />
                    {t('tables.saving')}
                  </span>
                )}
                {!isSaving && showSaved && (
                  <span className="tables-topbar-saving" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Check size={12} />
                    {t('tables.saved')}
                  </span>
                )}
              </div>

              {/* Row 2: View tabs */}
              <div className="tables-topbar-view-tabs">
                {currentViews.map((v, idx) => {
                  const VIEW_ICONS: Record<string, typeof LayoutGrid> = {
                    grid: LayoutGrid,
                    kanban: Kanban,
                    calendar: Calendar,
                    gallery: GalleryHorizontalEnd,
                  };
                  const Icon = VIEW_ICONS[v.key] || LayoutGrid;
                  return (
                    <button
                      key={`${v.key}-${idx}`}
                      className={`tables-topbar-view-tab${localViewConfig.activeView === v.key ? ' active' : ''}`}
                      onClick={() => handleViewToggle(v.key)}
                    >
                      <Icon size={13} />
                      <span>{v.label}</span>
                      {currentViews.length > 1 && (
                        <span
                          className="tables-topbar-view-tab-close"
                          onClick={(e) => { e.stopPropagation(); handleRemoveView(idx); }}
                        >
                          <X size={11} />
                        </span>
                      )}
                    </button>
                  );
                })}
                <button
                  ref={addViewBtnRef}
                  className="tables-topbar-view-tab tables-topbar-view-add"
                  onClick={() => setShowAddViewDropdown(!showAddViewDropdown)}
                  title="Add view"
                >
                  <Plus size={13} />
                </button>
                {showAddViewDropdown && (() => {
                  const rect = addViewBtnRef.current?.getBoundingClientRect();
                  return createPortal(
                    <div
                      ref={addViewDropdownRef}
                      className="tables-add-view-dropdown"
                      style={{
                        position: 'fixed',
                        top: rect ? rect.bottom + 4 : 0,
                        left: rect ? rect.left : 0,
                      }}
                    >
                      {[
                        { key: 'grid' as const, icon: LayoutGrid, label: 'Grid view' },
                        { key: 'kanban' as const, icon: Kanban, label: 'Kanban' },
                        { key: 'calendar' as const, icon: Calendar, label: 'Calendar' },
                        { key: 'gallery' as const, icon: GalleryHorizontalEnd, label: 'Gallery' },
                        { key: 'gantt' as const, icon: GanttChart, label: 'Gantt' },
                      ].map((v) => (
                        <button
                          key={v.key}
                          className="tables-add-view-option"
                          onClick={() => handleAddView(v.key, v.label)}
                        >
                          <v.icon size={14} />
                          <span>{v.label}</span>
                        </button>
                      ))}
                    </div>,
                    document.body,
                  );
                })()}
              </div>
            </div>
            {/* Tools row */}
            <div className="tables-toolbar">
              <div style={{ position: 'relative' }}>
                <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={() => setShowAddColumn(!showAddColumn)}>
                  {t('tables.column')}
                </Button>
                {showAddColumn && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 100 }}>
                    <AddColumnPopover onAdd={handleAddColumn} onClose={() => setShowAddColumn(false)} tables={allTables.map((t) => ({ id: t.id, title: t.title }))} />
                  </div>
                )}
              </div>

              <HideFieldsPopover
                columns={localColumns}
                viewConfig={localViewConfig}
                onUpdate={(hiddenColumns) => {
                  const updated = { ...localViewConfig, hiddenColumns };
                  setLocalViewConfig(updated);
                  triggerAutoSave({ viewConfig: updated });
                }}
              />

              <SortPopover
                columns={localColumns}
                viewConfig={localViewConfig}
                onUpdate={(sorts) => {
                  const updated = { ...localViewConfig, sorts };
                  setLocalViewConfig(updated);
                  triggerAutoSave({ viewConfig: updated });
                }}
              />

              <FilterPopover
                columns={localColumns}
                viewConfig={localViewConfig}
                onUpdate={(filters) => {
                  const updated = { ...localViewConfig, filters };
                  setLocalViewConfig(updated);
                  triggerAutoSave({ viewConfig: updated });
                }}
              />

              {/* Group by button */}
              {localViewConfig.groupByColumnId ? (
                <Button variant="ghost" size="sm" icon={<Ungroup size={14} />} onClick={handleUngroupRows}
                  style={{ background: 'var(--color-surface-active)' }}
                >
                  Ungroup
                </Button>
              ) : (
                <div style={{ position: 'relative' }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Group size={14} />}
                    onClick={() => {
                      // Auto-group by first select column
                      const selectCol = localColumns.find((c) => c.type === 'singleSelect');
                      if (selectCol) handleGroupByColumn(selectCol.id);
                    }}
                    disabled={!localColumns.some((c) => c.type === 'singleSelect')}
                    style={{ opacity: localColumns.some((c) => c.type === 'singleSelect') ? 1 : 0.4 }}
                  >
                    {t('tables.group')}
                  </Button>
                </div>
              )}

              <RowHeightPopover
                viewConfig={localViewConfig}
                onUpdate={(rowHeight) => {
                  const updated = { ...localViewConfig, rowHeight };
                  setLocalViewConfig(updated);
                  triggerAutoSave({ viewConfig: updated });
                }}
              />

              <RowColorPopover
                columns={localColumns}
                viewConfig={localViewConfig}
                onUpdate={(mode, columnId) => {
                  const updated = { ...localViewConfig, rowColorMode: mode, rowColorColumnId: columnId };
                  setLocalViewConfig(updated);
                  triggerAutoSave({ viewConfig: updated });
                }}
              />

              <div className="tables-toolbar-spacer" />

              {/* Kanban group-by selector */}
              {localViewConfig.activeView === 'kanban' && selectColumns.length > 0 && (
                <Select
                  value={localViewConfig.kanbanGroupByColumnId || effectiveKanbanCol?.id || ''}
                  onChange={(v) => {
                    const updated = { ...localViewConfig, kanbanGroupByColumnId: v };
                    setLocalViewConfig(updated);
                    triggerAutoSave({ viewConfig: updated });
                  }}
                  options={selectColumns.map((c) => ({ value: c.id, label: c.name }))}
                  size="sm"
                  width={160}
                />
              )}
            </div>

            {/* Search bar */}
            {showSearch && (
              <div className="tables-search-bar">
                <Search size={14} />
                <input
                  autoFocus
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder={t('tables.searchPlaceholder')}
                  onKeyDown={(e) => { if (e.key === 'Escape') { setShowSearch(false); setSearchText(''); } }}
                />
                <IconButton
                  icon={<X size={14} />}
                  label="Close search"
                  onClick={() => { setShowSearch(false); setSearchText(''); }}
                  size={24}
                  tooltip={false}
                />
              </div>
            )}

            {/* Find & replace bar */}
            {findReplace.isOpen && (
              <FindReplaceBar
                searchTerm={findReplace.searchTerm}
                onSearchChange={findReplace.setSearchTerm}
                replaceTerm={findReplace.replaceTerm}
                onReplaceChange={findReplace.setReplaceTerm}
                caseSensitive={findReplace.caseSensitive}
                onCaseSensitiveToggle={() => findReplace.setCaseSensitive(!findReplace.caseSensitive)}
                matchCount={findReplace.matches.length}
                currentIndex={findReplace.currentMatchIndex}
                onNext={findReplace.goToNext}
                onPrev={findReplace.goToPrev}
                onReplace={findReplace.replaceCurrent}
                onReplaceAll={findReplace.replaceAll}
                onClose={findReplace.close}
              />
            )}

            {/* Formula bar */}
            {localViewConfig.activeView === 'grid' && (
              <FormulaBar
                cellRef={focusedCellInfo ? getCellReference(focusedCellInfo.rowIndex, focusedCellInfo.colId) : ''}
                rawValue={focusedCellInfo ? String(localRows.find((r) => r._id === focusedCellInfo.rowId)?.[focusedCellInfo.colId] ?? '') : ''}
                computedValue={focusedCellInfo ? getComputedValue(focusedCellInfo.rowId, focusedCellInfo.colId, localRows.find((r) => r._id === focusedCellInfo.rowId)?.[focusedCellInfo.colId]) : ''}
                isFormula={focusedCellInfo ? isFormulaValue(localRows.find((r) => r._id === focusedCellInfo.rowId)?.[focusedCellInfo.colId]) : false}
                onEdit={handleFormulaBarEdit}
              />
            )}

            {/* Grid view */}
            {localViewConfig.activeView === 'grid' && (
              <>
                <div className="tables-grid-container" onMouseDown={handleRangeCellMouseDown} onContextMenu={(e) => e.preventDefault()} style={{ position: 'relative' }}>
                  <div className={isDark ? 'ag-theme-quartz-dark' : 'ag-theme-quartz'}>
                    <AgGridReact
                      ref={gridRef}
                      columnDefs={columnDefs}
                      rowData={rowData}
                      getRowId={getRowId}
                      rowHeight={ROW_HEIGHT_MAP[localViewConfig.rowHeight || 'medium']}
                      readOnlyEdit={true}
                      onCellEditRequest={handleCellEditRequest}
                      onCellKeyDown={handleCellKeyDown}
                      onCellClicked={handleCellClickedWithAttachment}
                      onCellEditingStarted={() => clearRange()}
                      onColumnResized={handleColumnResized}
                      onColumnMoved={handleColumnMoved}
                      rowDragManaged={false}
                      onRowDragEnd={handleRowDragEnd}
                      animateRows={true}
                      undoRedoCellEditing={false}
                      suppressMoveWhenRowDragging={true}
                      rowSelection={{ mode: 'multiRow', checkboxes: false, headerCheckbox: false }}
                      onSelectionChanged={handleSelectionChanged}
                      enterNavigatesVertically={true}
                      enterNavigatesVerticallyAfterEdit={true}
                      ensureDomOrder={true}
                      suppressContextMenu={true}
                      onCellContextMenu={handleCellContextMenu}
                      pinnedBottomRowData={isGrouped ? undefined : pinnedBottomRowData}
                      getRowStyle={getRowStyle}
                      quickFilterText={searchText}
                      isFullWidthRow={(params) => {
                        return isGroupHeaderRow(params.rowNode.data as MaybeGroupedRow);
                      }}
                      fullWidthCellRenderer={(params: ICellRendererParams) => (
                        <GroupHeaderRenderer data={params.data} context={params.context} />
                      )}
                      context={{
                        deleteRow: handleDeleteRow,
                        ...rangeContext,
                        findMatchSet: findReplace.matchSet,
                        findCurrentMatchKey: findReplace.currentMatchKey,
                        toggleGroup,
                        groupByColumnType: localViewConfig.groupByColumnId
                          ? localColumns.find((c) => c.id === localViewConfig.groupByColumnId)?.type
                          : undefined,
                      }}
                    />
                  </div>
                  {/* Fill handle overlay */}
                  {fillHandle.handlePos && (
                    <div
                      className="fill-handle"
                      style={{
                        position: 'absolute',
                        top: fillHandle.handlePos.top,
                        left: fillHandle.handlePos.left,
                        width: 8,
                        height: 8,
                        background: 'var(--color-accent-primary)',
                        borderRadius: 1,
                        cursor: 'crosshair',
                        zIndex: 10,
                      }}
                      onMouseDown={fillHandle.handleMouseDown}
                    />
                  )}
                  {/* Batch edit overlay */}
                  {showBatchEdit && (
                    <BatchEditOverlay
                      cellCount={getSelectedCellCount()}
                      onConfirm={handleBatchEditConfirm}
                      onCancel={() => setShowBatchEdit(false)}
                    />
                  )}
                  {/* Floating selection bar */}
                  {selectedRowIds.length > 0 && (
                    <div className="tables-selection-float">
                      <span className="tables-selection-float-count">
                        {selectedRowIds.length}
                      </span>
                      <IconButton
                        icon={<Copy size={13} />}
                        label={t('tables.duplicateSelected')}
                        onClick={handleBulkDuplicate}
                        size={28}
                        style={{ color: 'inherit' }}
                      />
                      <IconButton
                        icon={<Trash2 size={13} />}
                        label={t('tables.deleteSelected')}
                        onClick={handleBulkDelete}
                        destructive
                        size={28}
                      />
                      <IconButton
                        icon={<X size={13} />}
                        label={t('tables.clearSelection')}
                        onClick={handleClearSelection}
                        size={28}
                        style={{ color: 'inherit' }}
                      />
                    </div>
                  )}
                </div>
                <div className="tables-footer">
                  <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={handleAddRow} className="tables-footer-btn">
                    {t('tables.addRow')}
                  </Button>
                  <span>
                    {filteredRows.length !== localRows.length
                      ? t('tables.filteredRowCount', { filtered: filteredRows.length, total: localRows.length })
                      : t('tables.rowCount', { count: localRows.length })}
                  </span>
                  {rangeVersion > 0 && getSelectedCellCount() > 0 && (
                    <span className="tables-footer-agg">
                      {getSelectedCellCount()} cells selected
                    </span>
                  )}
                  {footerAgg && (
                    <span className="tables-footer-agg">
                      {footerAgg.label}: {footerAgg.sum} {t('tables.sum')} · {footerAgg.avg} {t('tables.avg')}
                    </span>
                  )}
                </div>
              </>
            )}

            {/* Kanban view */}
            {localViewConfig.activeView === 'kanban' && (
              <>
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
                        Object.entries(kanbanGroups).map(([option, rows]) => (
                          <KanbanColumn
                            key={option}
                            option={option}
                            rows={rows}
                            columns={localColumns}
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
                              const titleCol = localColumns.find((c) => c.type === 'text' && c.id !== effectiveKanbanCol?.id);
                              return titleCol ? String(draggedRow[titleCol.id] || 'Untitled') : 'Untitled';
                            })()}
                          </div>
                        </div>
                      ) : null}
                    </DragOverlay>
                  </DndContext>
                )}
              </>
            )}

            {/* Calendar view */}
            {localViewConfig.activeView === 'calendar' && (
              <div className="tables-calendar-view">
                {!effectiveCalendarDateCol ? (
                  <div className="tables-kanban-no-group">
                    <Calendar size={36} style={{ opacity: 0.3 }} />
                    <div>{t('tables.noDateColumn')}</div>
                  </div>
                ) : (
                  <>
                    {/* Date column selector */}
                    {localColumns.filter((c) => c.type === 'date').length > 1 && (
                      <div className="tables-calendar-date-selector">
                        <span>{t('tables.calendarDateColumn')}:</span>
                        <Select
                          value={effectiveCalendarDateCol.id}
                          onChange={(v) => {
                            const updated = { ...localViewConfig, calendarDateColumnId: v };
                            setLocalViewConfig(updated);
                            triggerAutoSave({ viewConfig: updated });
                          }}
                          options={localColumns.filter((c) => c.type === 'date').map((c) => ({ value: c.id, label: c.name }))}
                          size="sm"
                          width={140}
                        />
                      </div>
                    )}
                    {/* Month navigation */}
                    <div className="tables-calendar-header">
                      <IconButton
                        icon={<ChevronLeft size={16} />}
                        label="Previous month"
                        onClick={() => setCalendarMonth((prev) => {
                          const d = new Date(prev.year, prev.month - 1, 1);
                          return { year: d.getFullYear(), month: d.getMonth() };
                        })}
                        size={28}
                      />
                      <span className="tables-calendar-month-label">
                        {new Date(calendarMonth.year, calendarMonth.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </span>
                      <IconButton
                        icon={<ChevronRight size={16} />}
                        label="Next month"
                        onClick={() => setCalendarMonth((prev) => {
                          const d = new Date(prev.year, prev.month + 1, 1);
                          return { year: d.getFullYear(), month: d.getMonth() };
                        })}
                        size={28}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const now = new Date();
                          setCalendarMonth({ year: now.getFullYear(), month: now.getMonth() });
                        }}
                        style={{ marginLeft: 8 }}
                      >
                        {t('tables.today')}
                      </Button>
                    </div>
                    {/* Weekday header */}
                    <div className="tables-calendar-grid">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                        <div key={d} className="tables-calendar-weekday">{d}</div>
                      ))}
                      {/* Day cells */}
                      {(() => {
                        const firstDay = new Date(calendarMonth.year, calendarMonth.month, 1);
                        const startOffset = firstDay.getDay();
                        const daysInMonth = new Date(calendarMonth.year, calendarMonth.month + 1, 0).getDate();
                        const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
                        const today = new Date();
                        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                        const cells: React.ReactNode[] = [];
                        for (let i = 0; i < totalCells; i++) {
                          const dayNum = i - startOffset + 1;
                          const isCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;
                          const dateKey = isCurrentMonth
                            ? `${calendarMonth.year}-${String(calendarMonth.month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                            : '';
                          const dayRows = isCurrentMonth ? (calendarDateMap[dateKey] || []) : [];
                          const isToday = dateKey === todayKey;
                          cells.push(
                            <div
                              key={i}
                              className={`tables-calendar-cell${isCurrentMonth ? '' : ' outside'}${isToday ? ' today' : ''}`}
                            >
                              {isCurrentMonth && (
                                <>
                                  <span className={`tables-calendar-day-number${isToday ? ' today' : ''}`}>{dayNum}</span>
                                  <div className="tables-calendar-cell-pills">
                                    {dayRows.slice(0, 3).map((row) => {
                                      const titleCol = localColumns.find((c) => c.type === 'text');
                                      const title = titleCol ? String(row[titleCol.id] || '') : row._id.slice(0, 8);
                                      return (
                                        <button
                                          key={row._id}
                                          className="tables-calendar-pill"
                                          onClick={() => setExpandedRowId(row._id)}
                                          title={title}
                                        >
                                          {title || 'Untitled'}
                                        </button>
                                      );
                                    })}
                                    {dayRows.length > 3 && (
                                      <span className="tables-calendar-more">+{dayRows.length - 3}</span>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>,
                          );
                        }
                        return cells;
                      })()}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Gallery view */}
            {localViewConfig.activeView === 'gallery' && (
              <div className="tables-gallery-view">
                {sortedRows.map((row) => {
                  const title = galleryTitleCol ? String(row[galleryTitleCol.id] || '') : row._id.slice(0, 8);
                  const displayCols = localColumns
                    .filter((c) => c.id !== galleryTitleCol?.id && row[c.id] != null && row[c.id] !== '')
                    .slice(0, 5);
                  return (
                    <button
                      key={row._id}
                      className="tables-gallery-card"
                      onClick={() => setExpandedRowId(row._id)}
                    >
                      <div className="tables-gallery-card-title">{title || 'Untitled'}</div>
                      <div className="tables-gallery-card-fields">
                        {displayCols.map((col) => {
                          const val = row[col.id];
                          let rendered: React.ReactNode = String(val);
                          if (col.type === 'singleSelect') {
                            const c = getTagColor(String(val));
                            rendered = <span className="tables-cell-tag" style={{ background: c.bg, color: c.text }}>{String(val)}</span>;
                          } else if (col.type === 'currency') {
                            const num = Number(val);
                            rendered = !isNaN(num) ? `$${num.toFixed(2)}` : String(val);
                          } else if (col.type === 'percent') {
                            rendered = `${val}%`;
                          } else if (col.type === 'multiSelect' && Array.isArray(val)) {
                            rendered = (
                              <div className="tables-cell-multi-tags">
                                {(val as string[]).map((v, i) => {
                                  const c = getTagColor(v);
                                  return <span key={i} className="tables-cell-tag" style={{ background: c.bg, color: c.text }}>{v}</span>;
                                })}
                              </div>
                            );
                          }
                          return (
                            <div key={col.id} className="tables-gallery-card-field">
                              <span className="tables-gallery-card-label">{col.name}</span>
                              <span className="tables-gallery-card-value">{rendered}</span>
                            </div>
                          );
                        })}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Gantt view */}
            {localViewConfig.activeView === 'gantt' && (
              <GanttView
                columns={localColumns}
                rows={sortedRows as TableRow[]}
                startColumnId={ganttColumns.start}
                endColumnId={ganttColumns.end}
                labelColumnId={ganttColumns.label}
              />
            )}
          </>
        )}
      </div>

      {/* Column header context menu */}
      {columnMenu && (() => {
        const col = localColumns.find((c) => c.id === columnMenu.columnId);
        if (!col) return null;
        const colIdx = localColumns.findIndex((c) => c.id === columnMenu.columnId);
        return (
          <ColumnHeaderMenu
            columnId={columnMenu.columnId}
            columnName={col.name}
            columnType={col.type}
            columnDescription={col.description}
            columnIndex={colIdx}
            frozenCount={localViewConfig.frozenColumnCount || 0}
            x={columnMenu.x}
            y={columnMenu.y}
            onClose={() => setColumnMenu(null)}
            onRename={handleRenameColumn}
            onDelete={handleDeleteColumn}
            onDuplicate={handleDuplicateColumn}
            onChangeType={handleChangeColumnType}
            onSortAsc={(colId) => handleSortByColumn(colId, 'asc')}
            onSortDesc={(colId) => handleSortByColumn(colId, 'desc')}
            onHide={handleHideColumn}
            onFreeze={handleFreezeUpTo}
            onUnfreeze={handleUnfreezeColumns}
            onInsertLeft={handleInsertColumnLeft}
            onInsertRight={handleInsertColumnRight}
            onEditDescription={handleEditColumnDescription}
            onGroupBy={handleGroupByColumn}
            onUngroup={handleUngroupRows}
            isGroupedBy={localViewConfig.groupByColumnId === columnMenu.columnId}
          />
        );
      })()}

      {/* Row context menu */}
      {rowMenu && (
        <RowContextMenu
          rowId={rowMenu.rowId}
          x={rowMenu.x}
          y={rowMenu.y}
          onClose={() => setRowMenu(null)}
          onInsertAbove={handleInsertRowAbove}
          onInsertBelow={handleInsertRowBelow}
          onDuplicate={handleDuplicateRow}
          onExpand={(rowId) => setExpandedRowId(rowId)}
          onDelete={handleDeleteRow}
        />
      )}

      {/* Expand row modal */}
      {expandedRowId && (() => {
        const rowIdx = localRows.findIndex((r) => r._id === expandedRowId);
        const row = rowIdx >= 0 ? localRows[rowIdx] : undefined;
        if (!row) return null;
        return (
          <ExpandRowModal
            row={row}
            columns={localColumns}
            spreadsheetId={selectedId || undefined}
            open={true}
            onOpenChange={(open) => { if (!open) setExpandedRowId(null); }}
            onUpdateField={handleUpdateRowField}
            onNavigateRow={(direction) => {
              const nextIdx = direction === 'prev' ? rowIdx - 1 : rowIdx + 1;
              if (nextIdx >= 0 && nextIdx < localRows.length) {
                setExpandedRowId(localRows[nextIdx]._id);
              }
            }}
            onAddColumn={handleAddColumn}
            hasPrev={rowIdx > 0}
            hasNext={rowIdx < localRows.length - 1}
          />
        );
      })()}

      {/* Hidden file input for attachment uploads */}
      <input
        type="file"
        ref={attachmentInputRef}
        style={{ display: 'none' }}
        onChange={handleAttachmentUpload}
      />

      {/* Hidden file input for CSV/Excel import */}
      <input
        type="file"
        ref={importInputRef}
        accept=".csv,.xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleFileImport}
      />

      {/* Hover effect for sidebar delete buttons */}
      <style>{`
        .tables-sidebar-item:hover .tables-sidebar-delete-btn {
          opacity: 1 !important;
        }
      `}</style>

      {/* Import modal */}
      {importModalData && (
        <Modal
          open={true}
          onOpenChange={(open) => { if (!open) setImportModalData(null); }}
          width="90vw"
          maxWidth={800}
          title={t('tables.import.title')}
        >
          <div style={{ padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
            {/* First row is header toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={importModalData.firstRowHeader}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setImportModalData((prev) => {
                    if (!prev) return prev;
                    const headerRow = checked
                      ? (prev.allRows[0] as unknown[]).map((h) => String(h || 'Column'))
                      : (prev.allRows[0] as unknown[]).map((_, i) => `Column ${i + 1}`);
                    const dataRows = checked ? prev.allRows.slice(1) : prev.allRows;
                    const columnMappings = headerRow.map((name, idx) => {
                      const sampleValues = dataRows.slice(0, 10).map((r) => (r as unknown[])[idx]).filter(Boolean);
                      let type = prev.columnMappings[idx]?.type ?? ('text' as TableFieldType);
                      if (sampleValues.length > 0 && sampleValues.every((v) => typeof v === 'number' || !isNaN(Number(v)))) {
                        type = 'number';
                      }
                      return { name: String(name), type };
                    });
                    return { ...prev, firstRowHeader: checked, columnMappings };
                  });
                }}
                style={{ width: 16, height: 16 }}
              />
              {t('tables.import.firstRowHeader')}
            </label>

            {/* Column mappings */}
            <div style={{ border: '1px solid var(--color-border-primary)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-sm)', fontFamily: 'var(--font-family)' }}>
                <thead>
                  <tr style={{ background: 'var(--color-bg-secondary)' }}>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--color-border-primary)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{t('tables.column')}</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--color-border-primary)', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{t('tables.fieldType')}</th>
                  </tr>
                </thead>
                <tbody>
                  {importModalData.columnMappings.map((col, idx) => (
                    <tr key={idx}>
                      <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--color-border-secondary)', color: 'var(--color-text-primary)' }}>{col.name}</td>
                      <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--color-border-secondary)' }}>
                        <Select
                          value={col.type}
                          onChange={(val) => {
                            setImportModalData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.columnMappings];
                              updated[idx] = { ...updated[idx], type: val as TableFieldType };
                              return { ...prev, columnMappings: updated };
                            });
                          }}
                          options={[
                            { value: 'text', label: 'Text' },
                            { value: 'number', label: 'Number' },
                            { value: 'checkbox', label: 'Checkbox' },
                            { value: 'date', label: 'Date' },
                            { value: 'url', label: 'URL' },
                            { value: 'email', label: 'Email' },
                          ]}
                          size="sm"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Preview (first 5 rows) */}
            <div>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
                {t('tables.import.preview')} &mdash; {t('tables.import.rowCount', { count: importModalData.firstRowHeader ? importModalData.allRows.length - 1 : importModalData.allRows.length })}
              </div>
              <div style={{ border: '1px solid var(--color-border-primary)', borderRadius: 'var(--radius-md)', overflow: 'auto', maxHeight: 200 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-family)' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-secondary)' }}>
                      {importModalData.columnMappings.map((col, idx) => (
                        <th key={idx} style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--color-border-primary)', color: 'var(--color-text-secondary)', fontWeight: 500, whiteSpace: 'nowrap' }}>{col.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(importModalData.firstRowHeader ? importModalData.allRows.slice(1, 6) : importModalData.allRows.slice(0, 5)).map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {importModalData.columnMappings.map((_, colIdx) => (
                          <td key={colIdx} style={{ padding: '4px 8px', borderBottom: '1px solid var(--color-border-secondary)', color: 'var(--color-text-primary)', whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {(row as unknown[])[colIdx] != null ? String((row as unknown[])[colIdx]) : ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
              <Button variant="secondary" size="md" onClick={() => setImportModalData(null)}>{t('tables.cancel')}</Button>
              <Button variant="primary" size="md" onClick={handleImportConfirm}>{t('tables.import.import')}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete table confirmation */}
      <ConfirmDialog
        open={deleteConfirmId !== null}
        onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
        title={t('tables.confirmDeleteTitle', 'Move to trash?')}
        description={t('tables.confirmDeleteDescription', 'This table will be moved to trash. You can restore it later.')}
        confirmLabel={t('tables.moveToTrash', 'Move to trash')}
        onConfirm={confirmDeleteTable}
      />
    </div>
  );
}
