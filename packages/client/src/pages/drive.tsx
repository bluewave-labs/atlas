import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Plus, Search, Upload, FolderPlus, ArrowLeft, Trash2, RotateCcw,
  Star, MoreHorizontal, Pencil, Download, FolderInput, ChevronRight,
  LayoutGrid, LayoutList, Home, Clock, Heart, HardDrive, Upload as UploadIcon,
  Copy, X, Check, ChevronDown, Tag, FileArchive, Share2, History,
  FileImage, FileText, FileVideo, FileAudio, Link2, Trash, Music, Settings,
  ExternalLink, Table2,
} from 'lucide-react';
import {
  useDriveItems, useDriveBreadcrumbs, useDriveFavourites, useDriveRecent,
  useDriveTrash, useDriveSearch, useCreateFolder, useUploadFiles,
  useUpdateDriveItem, useDeleteDriveItem, useRestoreDriveItem,
  usePermanentDeleteDriveItem, useDriveStorage, useDriveFolders,
  useDuplicateDriveItem, useBatchDeleteDriveItems, useBatchMoveDriveItems,
  useBatchFavouriteDriveItems, useFilePreview, useFileVersions,
  useReplaceFile, useRestoreVersion, useShareLinks, useCreateShareLink,
  useDeleteShareLink, useDriveItemsByType,
  useCreateLinkedDocument, useCreateLinkedDrawing, useCreateLinkedSpreadsheet,
} from '../hooks/use-drive';
import { api } from '../lib/api-client';
import { useToastStore } from '../stores/toast-store';
import { ContextMenu, ContextMenuItem, ContextMenuSeparator } from '../components/ui/context-menu';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { Modal } from '../components/ui/modal';
import { Chip } from '../components/ui/chip';
import { EmojiPicker } from '../components/shared/emoji-picker';
import { getFileTypeIcon, formatBytes, formatRelativeDate, isImageFile } from '../lib/drive-utils';
import { ROUTES } from '../config/routes';
import { useDriveSettingsStore, useDriveSettingsSync } from '../stores/drive-settings-store';
import { useUIStore } from '../stores/ui-store';
import { useQuery } from '@tanstack/react-query';
import type { DriveItem, DriveShareLink } from '@atlasmail/shared';
import '../styles/drive.css';

// ─── Helpers ─────────────────────────────────────────────────────────

/** Extract plain text from TipTap/ProseMirror JSON content */
function extractTextFromContent(content: Record<string, unknown> | null): string {
  if (!content) return '';
  const lines: string[] = [];
  function walk(node: any) {
    if (!node) return;
    if (node.type === 'text' && typeof node.text === 'string') {
      lines.push(node.text);
    }
    if (Array.isArray(node.content)) {
      node.content.forEach(walk);
      // Add newline after block nodes
      if (['paragraph', 'heading', 'blockquote', 'listItem', 'bulletList', 'orderedList'].includes(node.type)) {
        lines.push('\n');
      }
    }
  }
  walk(content);
  return lines.join('').trim();
}

// ─── Constants ───────────────────────────────────────────────────────

const SIDEBAR_WIDTH_KEY = 'atlasmail_drive_sidebar_width';
const DEFAULT_SIDEBAR_WIDTH = 240;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 400;
const VIEW_MODE_KEY = 'atlasmail_drive_view_mode';

type ViewMode = 'list' | 'grid';
type SidebarView = 'files' | 'favourites' | 'recent' | 'trash' | 'images' | 'documents' | 'videos' | 'audio';
type SortBy = 'default' | 'name' | 'size' | 'date' | 'type';
type TypeFilter = 'all' | 'folders' | 'documents' | 'spreadsheets' | 'presentations' | 'photos' | 'pdfs' | 'videos' | 'archives' | 'audio' | 'drawings' | 'word' | 'excel' | 'powerpoint' | 'code' | 'text';
type ModifiedFilter = 'any' | 'today' | '7days' | '30days' | 'thisYear' | 'lastYear';

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'name', label: 'Name' },
  { value: 'size', label: 'Size' },
  { value: 'date', label: 'Date modified' },
  { value: 'type', label: 'Type' },
];

const TYPE_FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Any type' },
  { value: 'folders', label: 'Folders' },
  { value: 'documents', label: 'Documents' },
  { value: 'word', label: 'Word' },
  { value: 'spreadsheets', label: 'Spreadsheets' },
  { value: 'excel', label: 'Excel' },
  { value: 'presentations', label: 'Presentations' },
  { value: 'powerpoint', label: 'PowerPoint' },
  { value: 'photos', label: 'Photos & images' },
  { value: 'pdfs', label: 'PDFs' },
  { value: 'videos', label: 'Videos' },
  { value: 'audio', label: 'Audio' },
  { value: 'archives', label: 'Archives' },
  { value: 'code', label: 'Code' },
  { value: 'text', label: 'Text files' },
  { value: 'drawings', label: 'Drawings' },
];

function getModifiedFilterOptions(): { value: ModifiedFilter; label: string }[] {
  const now = new Date();
  const thisYear = now.getFullYear();
  return [
    { value: 'any', label: 'Any time' },
    { value: 'today', label: 'Today' },
    { value: '7days', label: 'Last 7 days' },
    { value: '30days', label: 'Last 30 days' },
    { value: 'thisYear', label: `This year (${thisYear})` },
    { value: 'lastYear', label: `Last year (${thisYear - 1})` },
  ];
}

function matchesTypeFilter(item: DriveItem, filter: TypeFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'folders') return item.type === 'folder';
  const mime = (item.mimeType || '').toLowerCase();
  const name = (item.name || '').toLowerCase();
  switch (filter) {
    case 'documents':
      return mime === 'application/vnd.atlasmail.document' || (/word|document|\.docx?$|\.odt$|\.rtf$|text\/plain/.test(mime + name) && !mime.startsWith('application/pdf'));
    case 'word':
      return /word|\.docx?$|\.odt$|\.rtf$/.test(mime + name);
    case 'spreadsheets':
      return mime === 'application/vnd.atlasmail.spreadsheet' || /spreadsheet|excel|\.xlsx?$|\.csv$|\.ods$/.test(mime + name);
    case 'excel':
      return /excel|\.xlsx?$|\.ods$/.test(mime + name);
    case 'presentations':
      return /presentation|powerpoint|\.pptx?$|\.odp$/.test(mime + name);
    case 'powerpoint':
      return /powerpoint|\.pptx?$/.test(mime + name);
    case 'photos':
      return mime.startsWith('image/') && mime !== 'image/svg+xml';
    case 'pdfs':
      return mime === 'application/pdf' || name.endsWith('.pdf');
    case 'videos':
      return mime.startsWith('video/');
    case 'archives':
      return /zip|rar|7z|tar|gz|bz2|archive|compressed/.test(mime + name);
    case 'audio':
      return mime.startsWith('audio/');
    case 'code':
      return /javascript|typescript|json|xml|html|css|\.jsx?$|\.tsx?$|\.py$|\.rb$|\.go$|\.rs$|\.java$|\.php$|\.sh$|\.yaml$|\.yml$|\.toml$|\.sql$/.test(mime + name);
    case 'text':
      return mime.startsWith('text/') || /\.txt$|\.md$|\.log$|\.ini$|\.env$|\.cfg$/.test(name);
    case 'drawings':
      return mime === 'application/vnd.atlasmail.drawing' || /drawing|\.svg$|\.sketch$|\.fig$/.test(mime + name) || mime === 'image/svg+xml';
    default:
      return true;
  }
}

function matchesModifiedFilter(item: DriveItem, filter: ModifiedFilter): boolean {
  if (filter === 'any') return true;
  const itemDate = new Date(item.updatedAt);
  const now = new Date();
  switch (filter) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return itemDate >= start;
    }
    case '7days': {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return itemDate >= start;
    }
    case '30days': {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return itemDate >= start;
    }
    case 'thisYear':
      return itemDate.getFullYear() === now.getFullYear();
    case 'lastYear':
      return itemDate.getFullYear() === now.getFullYear() - 1;
    default:
      return true;
  }
}

const TAG_COLORS = [
  { name: 'red', hex: '#ef4444' },
  { name: 'blue', hex: '#3b82f6' },
  { name: 'green', hex: '#22c55e' },
  { name: 'orange', hex: '#f97316' },
  { name: 'purple', hex: '#8b5cf6' },
  { name: 'gray', hex: '#6b7280' },
];

function getSavedSidebarWidth(): number {
  try {
    const w = parseInt(localStorage.getItem(SIDEBAR_WIDTH_KEY) || '', 10);
    if (w >= MIN_SIDEBAR_WIDTH && w <= MAX_SIDEBAR_WIDTH) return w;
  } catch { /* ignore */ }
  return DEFAULT_SIDEBAR_WIDTH;
}

function getSavedViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    if (v === 'list' || v === 'grid') return v;
  } catch { /* ignore */ }
  return 'list';
}

function getTokenParam(): string {
  const token = localStorage.getItem('atlasmail_token');
  return token ? `?token=${encodeURIComponent(token)}` : '';
}

function parseTag(tag: string): { color: string; label: string } {
  const idx = tag.indexOf(':');
  if (idx > 0) return { color: tag.slice(0, idx), label: tag.slice(idx + 1) };
  return { color: '#6b7280', label: tag };
}

function isTextPreviewable(mimeType: string | null, name: string): boolean {
  if (!mimeType && !name) return false;
  if (mimeType) {
    if (mimeType.startsWith('text/')) return true;
    if (['application/json', 'application/xml', 'application/javascript', 'application/csv', 'application/x-yaml'].some((m) => mimeType.includes(m))) return true;
  }
  const ext = name.split('.').pop()?.toLowerCase();
  return ['csv', 'md', 'json', 'txt', 'xml', 'yaml', 'yml', 'sh', 'js', 'ts', 'html', 'css', 'log', 'ini', 'toml', 'sql'].includes(ext || '');
}

function getFileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

function getFriendlyTypeName(mimeType: string | null, name: string): string {
  if (!mimeType) return 'File';
  const ext = getFileExtension(name);
  // By extension first for accuracy
  const extMap: Record<string, string> = {
    pdf: 'PDF document',
    doc: 'MS Word document',
    docx: 'MS Word document',
    xls: 'MS Excel spreadsheet',
    xlsx: 'MS Excel spreadsheet',
    ppt: 'MS PowerPoint presentation',
    pptx: 'MS PowerPoint presentation',
    csv: 'CSV file',
    json: 'JSON file',
    xml: 'XML file',
    html: 'HTML file',
    css: 'CSS file',
    js: 'JavaScript file',
    ts: 'TypeScript file',
    md: 'Markdown file',
    txt: 'Plain text file',
    rtf: 'Rich text document',
    odt: 'OpenDocument text',
    ods: 'OpenDocument spreadsheet',
    odp: 'OpenDocument presentation',
    zip: 'ZIP archive',
    gz: 'GZip archive',
    tar: 'TAR archive',
    rar: 'RAR archive',
    '7z': '7-Zip archive',
    sql: 'SQL file',
    yaml: 'YAML file',
    yml: 'YAML file',
    toml: 'TOML file',
    ini: 'Configuration file',
    log: 'Log file',
    sh: 'Shell script',
    svg: 'SVG image',
    png: 'PNG image',
    jpg: 'JPEG image',
    jpeg: 'JPEG image',
    gif: 'GIF image',
    webp: 'WebP image',
    bmp: 'Bitmap image',
    ico: 'Icon file',
    mp3: 'MP3 audio',
    wav: 'WAV audio',
    ogg: 'OGG audio',
    flac: 'FLAC audio',
    mp4: 'MP4 video',
    mov: 'QuickTime video',
    avi: 'AVI video',
    mkv: 'MKV video',
    webm: 'WebM video',
  };
  if (ext && extMap[ext]) return extMap[ext];
  // By MIME type patterns
  if (mimeType.includes('pdf')) return 'PDF document';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'MS Word document';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'MS Excel spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'MS PowerPoint presentation';
  if (mimeType.startsWith('image/')) return `${mimeType.split('/')[1].toUpperCase()} image`;
  if (mimeType.startsWith('video/')) return `${mimeType.split('/')[1].toUpperCase()} video`;
  if (mimeType.startsWith('audio/')) return `${mimeType.split('/')[1].toUpperCase()} audio`;
  if (mimeType.startsWith('text/')) return 'Text file';
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) return 'Archive';
  return 'File';
}

function renderBasicMarkdown(md: string): string {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3 style="margin:12px 0 4px;font-size:14px;font-weight:600">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="margin:14px 0 4px;font-size:15px;font-weight:600">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="margin:16px 0 6px;font-size:17px;font-weight:700">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:var(--color-bg-tertiary);padding:1px 4px;border-radius:3px;font-size:12px">$1</code>')
    .replace(/^- (.+)$/gm, '<li style="margin-left:16px;list-style:disc">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:16px;list-style:decimal">$1</li>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--color-border-secondary);margin:12px 0">')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

function parseCsvToRows(content: string): string[][] {
  const rows: string[][] = [];
  const lines = content.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    // Simple CSV parsing — handles quoted fields
    const row: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else current += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { row.push(current.trim()); current = ''; }
        else current += ch;
      }
    }
    row.push(current.trim());
    rows.push(row);
  }
  return rows;
}

function stripExtension(name: string, type: string): string {
  if (type !== 'file') return name;
  const lastDot = name.lastIndexOf('.');
  return lastDot > 0 ? name.slice(0, lastDot) : name;
}

// ─── Drawing SVG preview ─────────────────────────────────────────────

function DrawingPreviewThumbnail({ content }: { content: Record<string, unknown> | null }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!content || !containerRef.current) return;
    const elements = Array.isArray((content as any).elements) ? (content as any).elements : [];
    if (elements.length === 0) {
      setError(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { exportToSvg } = await import('@excalidraw/excalidraw');
        const appState = (content as any).appState || {};
        const files = (content as any).files || {};
        const svg = await exportToSvg({
          elements,
          appState: { ...appState, exportBackground: true, viewBackgroundColor: appState.viewBackgroundColor || '#ffffff' },
          files,
        });
        if (cancelled || !containerRef.current) return;
        svg.style.width = '100%';
        svg.style.height = 'auto';
        svg.style.maxHeight = '300px';
        svg.style.display = 'block';
        // Clear existing children safely
        while (containerRef.current.firstChild) {
          containerRef.current.removeChild(containerRef.current.firstChild);
        }
        containerRef.current.appendChild(svg);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => { cancelled = true; };
  }, [content]);

  if (error || !content) {
    return (
      <div className="drive-preview-icon" style={{ gap: 8, padding: 24 }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>(empty canvas)</span>
      </div>
    );
  }

  return <div ref={containerRef} style={{ padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 100 }} />;
}

// ─── Drive page ──────────────────────────────────────────────────────

export function DrivePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id: folderId } = useParams<{ id: string }>();
  const addToast = useToastStore((s) => s.addToast);
  const openSettings = useUIStore((s) => s.openSettings);

  // Drive settings (persisted to server)
  useDriveSettingsSync();
  const driveSettings = useDriveSettingsStore();

  // State
  const [sidebarWidth, setSidebarWidth] = useState(getSavedSidebarWidth);
  const [viewMode, setViewMode] = useState<ViewMode>(() => driveSettings.defaultView as ViewMode || getSavedViewMode());
  const [sidebarView, setSidebarView] = useState<SidebarView>(() => driveSettings.sidebarDefault as SidebarView || 'files');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: DriveItem } | null>(null);
  const [newDropdownOpen, setNewDropdownOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<DriveItem | null>(null);
  const [confirmPermanent, setConfirmPermanent] = useState<DriveItem | null>(null);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveItem, setMoveItem] = useState<DriveItem | null>(null);
  const [moveTargetId, setMoveTargetId] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>(() => driveSettings.defaultSort as SortBy || 'default');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [modifiedFilter, setModifiedFilter] = useState<ModifiedFilter>('any');
  const [modifiedDropdownOpen, setModifiedDropdownOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<DriveItem | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [tagModalItem, setTagModalItem] = useState<DriveItem | null>(null);
  const [tagLabel, setTagLabel] = useState('');
  const [tagColor, setTagColor] = useState(TAG_COLORS[0].hex);
  const [iconPickerItem, setIconPickerItem] = useState<DriveItem | null>(null);
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [batchMoveOpen, setBatchMoveOpen] = useState(false);
  const [batchMoveTargetId, setBatchMoveTargetId] = useState<string | null>(null);
  const [shareModalItem, setShareModalItem] = useState<DriveItem | null>(null);
  const [shareExpiry, setShareExpiry] = useState<string>(() => driveSettings.shareDefaultExpiry || 'never');
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const resizingRef = useRef(false);
  const newDropdownRef = useRef<HTMLDivElement>(null);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);
  const modifiedDropdownRef = useRef<HTMLDivElement>(null);

  // Queries
  const currentParentId = folderId || null;
  const { data: itemsData, isLoading: itemsLoading } = useDriveItems(sidebarView === 'files' ? currentParentId : undefined, sortBy, driveSettings.sortOrder);
  const { data: breadcrumbsData } = useDriveBreadcrumbs(folderId);
  const { data: favouritesData } = useDriveFavourites();
  const { data: recentData } = useDriveRecent();
  const { data: trashData } = useDriveTrash();
  const { data: searchData } = useDriveSearch(searchQuery);
  const { data: storageData } = useDriveStorage();
  const { data: foldersData } = useDriveFolders();
  const previewFileId = previewItem && previewItem.type === 'file' && isTextPreviewable(previewItem.mimeType, previewItem.name) ? previewItem.id : undefined;
  const { data: filePreviewData, isLoading: previewLoading } = useFilePreview(previewFileId);

  // Linked resource content previews
  const linkedDocId = previewItem?.linkedResourceType === 'document' ? previewItem.linkedResourceId : undefined;
  const { data: linkedDocData } = useQuery({
    queryKey: ['docs', 'detail', linkedDocId],
    queryFn: async () => {
      const { data } = await api.get(`/docs/${linkedDocId}`);
      return data.data as { id: string; title: string; content: Record<string, unknown> | null };
    },
    enabled: !!linkedDocId,
  });

  const linkedDrawingId = previewItem?.linkedResourceType === 'drawing' ? previewItem.linkedResourceId : undefined;
  const { data: linkedDrawingData } = useQuery({
    queryKey: ['drawings', 'detail', linkedDrawingId],
    queryFn: async () => {
      const { data } = await api.get(`/drawings/${linkedDrawingId}`);
      return data.data as { id: string; title: string; content: Record<string, unknown> | null };
    },
    enabled: !!linkedDrawingId,
  });

  const linkedTableId = previewItem?.linkedResourceType === 'spreadsheet' ? previewItem.linkedResourceId : undefined;
  const { data: linkedTableData } = useQuery({
    queryKey: ['tables', 'detail', linkedTableId],
    queryFn: async () => {
      const { data } = await api.get(`/tables/${linkedTableId}`);
      return data.data as { id: string; title: string; columns: Array<{ id: string; name: string; type: string }>; rows: Array<Record<string, unknown>> };
    },
    enabled: !!linkedTableId,
  });

  // Type filter queries
  const typeCategory = ['images', 'documents', 'videos', 'audio'].includes(sidebarView) ? sidebarView : undefined;
  const { data: typeData } = useDriveItemsByType(typeCategory);

  // Version & share queries
  const versionItemId = previewItem?.type === 'file' ? previewItem.id : undefined;
  const { data: versionsData } = useFileVersions(versionHistoryOpen ? versionItemId : undefined);
  const { data: shareLinksData } = useShareLinks(shareModalItem?.id);

  // Mutations
  const createFolder = useCreateFolder();
  const uploadFiles = useUploadFiles();
  const updateItem = useUpdateDriveItem();
  const deleteItem = useDeleteDriveItem();
  const restoreItem = useRestoreDriveItem();
  const permanentDelete = usePermanentDeleteDriveItem();
  const duplicateItem = useDuplicateDriveItem();
  const batchDelete = useBatchDeleteDriveItems();
  const batchMove = useBatchMoveDriveItems();
  const batchFavourite = useBatchFavouriteDriveItems();
  const replaceFile = useReplaceFile();
  const restoreVersion = useRestoreVersion();
  const createShareLink = useCreateShareLink();
  const deleteShareLink = useDeleteShareLink();
  const createLinkedDocument = useCreateLinkedDocument();
  const createLinkedDrawing = useCreateLinkedDrawing();
  const createLinkedSpreadsheet = useCreateLinkedSpreadsheet();

  // Determine which items to show
  const displayItems = useMemo(() => {
    let items: DriveItem[];
    if (searchQuery.trim()) items = searchData?.items ?? [];
    else if (sidebarView === 'favourites') items = favouritesData?.items ?? [];
    else if (sidebarView === 'recent') items = recentData?.items ?? [];
    else if (sidebarView === 'trash') items = trashData?.items ?? [];
    else if (['images', 'documents', 'videos', 'audio'].includes(sidebarView)) items = typeData?.items ?? [];
    else items = itemsData?.items ?? [];

    // Apply toolbar filters
    if (typeFilter !== 'all') {
      items = items.filter((item) => matchesTypeFilter(item, typeFilter));
    }
    if (modifiedFilter !== 'any') {
      items = items.filter((item) => matchesModifiedFilter(item, modifiedFilter));
    }
    return items;
  }, [sidebarView, searchQuery, itemsData, favouritesData, recentData, trashData, searchData, typeData, typeFilter, modifiedFilter]);

  const isLoading = sidebarView === 'files' && itemsLoading;
  const breadcrumbs = breadcrumbsData?.breadcrumbs ?? [];
  const hasSelection = selectedIds.size > 0;

  // Save view mode
  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  // Close dropdowns on click outside
  useEffect(() => {
    if (!sortDropdownOpen && !typeDropdownOpen && !modifiedDropdownOpen && !newDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (newDropdownOpen && newDropdownRef.current && !newDropdownRef.current.contains(target)) {
        setNewDropdownOpen(false);
      }
      if (sortDropdownOpen && sortDropdownRef.current && !sortDropdownRef.current.contains(target)) {
        setSortDropdownOpen(false);
      }
      if (typeDropdownOpen && typeDropdownRef.current && !typeDropdownRef.current.contains(target)) {
        setTypeDropdownOpen(false);
      }
      if (modifiedDropdownOpen && modifiedDropdownRef.current && !modifiedDropdownRef.current.contains(target)) {
        setModifiedDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sortDropdownOpen, typeDropdownOpen, modifiedDropdownOpen, newDropdownOpen]);

  // Close preview on Escape
  useEffect(() => {
    if (!previewItem) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewItem(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [previewItem]);

  // Auto-dismiss upload progress
  useEffect(() => {
    if (uploadProgress && uploadProgress.loaded >= uploadProgress.total) {
      const timer = setTimeout(() => setUploadProgress(null), 1500);
      return () => clearTimeout(timer);
    }
  }, [uploadProgress]);

  // Clear selection when navigating
  useEffect(() => {
    setSelectedIds(new Set());
    setPreviewItem(null);
  }, [folderId, sidebarView]);

  // ─── Sidebar resize ────────────────────────────────────────────────

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = ev.clientX - startX;
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, startWidth + delta));
      setSidebarWidth(newWidth);
    };

    const onUp = () => {
      resizingRef.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [sidebarWidth]);

  // ─── Selection helpers ─────────────────────────────────────────────

  const handleItemClick = useCallback((item: DriveItem, e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Toggle selection
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(item.id)) next.delete(item.id);
        else next.add(item.id);
        return next;
      });
      setLastClickedId(item.id);
    } else if (e.shiftKey && lastClickedId) {
      // Range select
      const items = displayItems;
      const lastIdx = items.findIndex((i) => i.id === lastClickedId);
      const curIdx = items.findIndex((i) => i.id === item.id);
      if (lastIdx >= 0 && curIdx >= 0) {
        const start = Math.min(lastIdx, curIdx);
        const end = Math.max(lastIdx, curIdx);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          for (let i = start; i <= end; i++) next.add(items[i].id);
          return next;
        });
      }
    } else {
      // Single click → select + show preview if applicable
      setSelectedIds(new Set([item.id]));
      if (driveSettings.showPreviewPanel && (item.type === 'file' || item.linkedResourceType)) {
        setPreviewItem(item);
      }
      setLastClickedId(item.id);
    }
  }, [lastClickedId, displayItems]);

  const handleItemDoubleClick = useCallback((item: DriveItem) => {
    if (item.type === 'folder') {
      navigate(`/drive/folder/${item.id}`);
      setSidebarView('files');
      setSearchQuery('');
      return;
    }
    // Open linked resources in their native editor
    if (item.linkedResourceType && item.linkedResourceId) {
      if (item.linkedResourceType === 'document') navigate(`/docs/${item.linkedResourceId}`);
      else if (item.linkedResourceType === 'drawing') navigate(`/draw/${item.linkedResourceId}`);
      else if (item.linkedResourceType === 'spreadsheet') navigate(`/tables/${item.linkedResourceId}`);
      return;
    }
    // For regular files, open preview panel
    if (driveSettings.showPreviewPanel) setPreviewItem(item);
  }, [navigate]);

  // ─── File operations ──────────────────────────────────────────────

  const handleCreateFolder = useCallback(() => {
    if (!newFolderName.trim()) return;
    createFolder.mutate(
      { name: newFolderName.trim(), parentId: currentParentId },
      {
        onSuccess: () => {
          setNewFolderOpen(false);
          setNewFolderName('');
          addToast({ type: 'success', message: 'Folder created' });
        },
      },
    );
  }, [newFolderName, currentParentId, createFolder, addToast]);

  const handleUpload = useCallback((fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setUploadProgress({ loaded: 0, total: 1 });

    uploadFiles.mutate(
      {
        files,
        parentId: currentParentId,
        onProgress: (progress) => setUploadProgress(progress),
      },
      {
        onSuccess: (data) => {
          setUploadProgress(null);
          addToast({ type: 'success', message: `${data.items.length} file${data.items.length > 1 ? 's' : ''} uploaded` });
        },
        onError: () => {
          addToast({ type: 'error', message: 'Upload failed' });
          setUploadProgress(null);
        },
      },
    );
  }, [currentParentId, uploadFiles, addToast]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleUpload(e.target.files);
      e.target.value = '';
    }
  }, [handleUpload]);

  const handleRename = useCallback((item: DriveItem) => {
    setRenameId(item.id);
    setRenameValue(item.name);
    setContextMenu(null);
  }, []);

  const handleRenameSubmit = useCallback(() => {
    if (!renameId || !renameValue.trim()) return;
    const trimmedName = renameValue.trim();

    // Find the item to check for linked resource
    const item = displayItems.find((i) => i.id === renameId);

    updateItem.mutate(
      { id: renameId, name: trimmedName },
      {
        onSuccess: () => {
          setRenameId(null);
          addToast({ type: 'success', message: 'Renamed' });

          // Sync title to linked resource
          if (item?.linkedResourceType && item?.linkedResourceId) {
            if (item.linkedResourceType === 'document') {
              api.patch(`/docs/${item.linkedResourceId}`, { title: trimmedName }).catch(() => {});
            } else if (item.linkedResourceType === 'drawing') {
              api.patch(`/drawings/${item.linkedResourceId}`, { title: trimmedName }).catch(() => {});
            } else if (item.linkedResourceType === 'spreadsheet') {
              api.patch(`/tables/${item.linkedResourceId}`, { title: trimmedName }).catch(() => {});
            }
          }
        },
      },
    );
  }, [renameId, renameValue, updateItem, addToast, displayItems]);

  const handleToggleFavourite = useCallback((item: DriveItem) => {
    updateItem.mutate(
      { id: item.id, isFavourite: !item.isFavourite },
      {
        onSuccess: () => {
          addToast({ type: 'success', message: item.isFavourite ? 'Removed from favourites' : 'Added to favourites' });
        },
      },
    );
    setContextMenu(null);
  }, [updateItem, addToast]);

  const handleMoveToTrash = useCallback((item: DriveItem) => {
    if (driveSettings.confirmDelete) {
      setConfirmDelete(item);
    } else {
      deleteItem.mutate(item.id, {
        onSuccess: () => {
          addToast({ type: 'success', message: `"${item.name}" moved to trash` });
          if (previewItem?.id === item.id) setPreviewItem(null);
        },
      });
    }
    setContextMenu(null);
  }, [driveSettings.confirmDelete, deleteItem, addToast, previewItem]);

  const confirmMoveToTrash = useCallback(() => {
    if (!confirmDelete) return;
    deleteItem.mutate(confirmDelete.id, {
      onSuccess: () => {
        addToast({ type: 'success', message: 'Moved to trash' });
        setConfirmDelete(null);
        setSelectedIds((prev) => { const n = new Set(prev); n.delete(confirmDelete.id); return n; });
      },
    });
  }, [confirmDelete, deleteItem, addToast]);

  const handleRestore = useCallback((item: DriveItem) => {
    restoreItem.mutate(item.id, {
      onSuccess: () => {
        addToast({ type: 'success', message: 'Restored' });
      },
    });
    setContextMenu(null);
  }, [restoreItem, addToast]);

  const handlePermanentDelete = useCallback((item: DriveItem) => {
    setConfirmPermanent(item);
    setContextMenu(null);
  }, []);

  const confirmPermanentDelete = useCallback(() => {
    if (!confirmPermanent) return;
    permanentDelete.mutate(confirmPermanent.id, {
      onSuccess: () => {
        addToast({ type: 'success', message: 'Permanently deleted' });
        setConfirmPermanent(null);
      },
    });
  }, [confirmPermanent, permanentDelete, addToast]);

  const handleDownload = useCallback((item: DriveItem) => {
    if (item.type !== 'file') return;
    const token = localStorage.getItem('atlasmail_token');
    window.open(`/api/v1/drive/${item.id}/download${token ? `?token=${encodeURIComponent(token)}` : ''}`, '_blank');
    setContextMenu(null);
  }, []);

  const handleDownloadZip = useCallback((item: DriveItem) => {
    if (item.type !== 'folder') return;
    const token = localStorage.getItem('atlasmail_token');
    window.open(`/api/v1/drive/${item.id}/download-zip${token ? `?token=${encodeURIComponent(token)}` : ''}`, '_blank');
    setContextMenu(null);
  }, []);

  const handleMove = useCallback((item: DriveItem) => {
    setMoveItem(item);
    setMoveTargetId(null);
    setMoveModalOpen(true);
    setContextMenu(null);
  }, []);

  const handleMoveSubmit = useCallback(() => {
    if (!moveItem) return;
    updateItem.mutate(
      { id: moveItem.id, parentId: moveTargetId },
      {
        onSuccess: () => {
          addToast({ type: 'success', message: 'Moved' });
          setMoveModalOpen(false);
          setMoveItem(null);
        },
      },
    );
  }, [moveItem, moveTargetId, updateItem, addToast]);

  const handleDuplicate = useCallback((item: DriveItem) => {
    duplicateItem.mutate(item.id, {
      onSuccess: () => {
        addToast({ type: 'success', message: 'Duplicated' });
      },
    });
    setContextMenu(null);
  }, [duplicateItem, addToast]);

  const handleContextMenu = useCallback((e: React.MouseEvent, item: DriveItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  }, []);

  // ─── Folder icon ───────────────────────────────────────────────────

  const handleSetIcon = useCallback((item: DriveItem) => {
    setIconPickerItem(item);
    setContextMenu(null);
  }, []);

  const handleIconSelect = useCallback((emoji: string) => {
    if (!iconPickerItem) return;
    updateItem.mutate(
      { id: iconPickerItem.id, icon: emoji },
      {
        onSuccess: () => {
          addToast({ type: 'success', message: 'Icon updated' });
          setIconPickerItem(null);
        },
      },
    );
  }, [iconPickerItem, updateItem, addToast]);

  const handleIconRemove = useCallback(() => {
    if (!iconPickerItem) return;
    updateItem.mutate(
      { id: iconPickerItem.id, icon: null },
      {
        onSuccess: () => {
          addToast({ type: 'success', message: 'Icon removed' });
          setIconPickerItem(null);
        },
      },
    );
  }, [iconPickerItem, updateItem, addToast]);

  // ─── Tags ──────────────────────────────────────────────────────────

  const handleAddTag = useCallback((item: DriveItem) => {
    setTagModalItem(item);
    setTagLabel('');
    setTagColor(TAG_COLORS[0].hex);
    setContextMenu(null);
  }, []);

  const handleTagSubmit = useCallback(() => {
    if (!tagModalItem || !tagLabel.trim()) return;
    const tag = `${tagColor}:${tagLabel.trim()}`;
    const newTags = [...(tagModalItem.tags || []), tag];
    updateItem.mutate(
      { id: tagModalItem.id, tags: newTags },
      {
        onSuccess: () => {
          addToast({ type: 'success', message: 'Tag added' });
          setTagModalItem(null);
        },
      },
    );
  }, [tagModalItem, tagLabel, tagColor, updateItem, addToast]);

  const handleRemoveTag = useCallback((item: DriveItem, tagIndex: number) => {
    const newTags = item.tags.filter((_, i) => i !== tagIndex);
    updateItem.mutate({ id: item.id, tags: newTags });
  }, [updateItem]);

  // ─── Bulk operations ──────────────────────────────────────────────

  const handleBulkDelete = useCallback(() => {
    const ids = Array.from(selectedIds);
    batchDelete.mutate(ids, {
      onSuccess: () => {
        addToast({ type: 'success', message: `${ids.length} item${ids.length > 1 ? 's' : ''} moved to trash` });
        setSelectedIds(new Set());
      },
    });
  }, [selectedIds, batchDelete, addToast]);

  const handleBulkFavourite = useCallback(() => {
    const ids = Array.from(selectedIds);
    batchFavourite.mutate(
      { itemIds: ids, isFavourite: true },
      {
        onSuccess: () => {
          addToast({ type: 'success', message: 'Added to favourites' });
          setSelectedIds(new Set());
        },
      },
    );
  }, [selectedIds, batchFavourite, addToast]);

  const handleBulkMoveSubmit = useCallback(() => {
    const ids = Array.from(selectedIds);
    batchMove.mutate(
      { itemIds: ids, parentId: batchMoveTargetId },
      {
        onSuccess: () => {
          addToast({ type: 'success', message: 'Moved' });
          setBatchMoveOpen(false);
          setSelectedIds(new Set());
        },
      },
    );
  }, [selectedIds, batchMoveTargetId, batchMove, addToast]);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(displayItems.map((i) => i.id)));
  }, [displayItems]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ─── Drag & drop (file upload from OS) ────────────────────────────

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only handle file drops from OS, not internal drags
    if (dragItemId) return;
    dragCounter.current++;
    if (dragCounter.current === 1) setIsDraggingOver(true);
  }, [dragItemId]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (dragItemId) return;
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDraggingOver(false);
  }, [dragItemId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDraggingOver(false);
    if (dragItemId) return; // internal drag, not file upload
    if (e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files);
    }
  }, [handleUpload, dragItemId]);

  // ─── Drag & drop (internal move) ──────────────────────────────────

  const handleItemDragStart = useCallback((e: React.DragEvent, item: DriveItem) => {
    e.dataTransfer.setData('text/plain', item.id);
    e.dataTransfer.effectAllowed = 'move';
    setDragItemId(item.id);
  }, []);

  const handleItemDragEnd = useCallback(() => {
    setDragItemId(null);
    setDragOverFolderId(null);
  }, []);

  const handleFolderDragOver = useCallback((e: React.DragEvent, folderId: string) => {
    if (!dragItemId || dragItemId === folderId) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverFolderId(folderId);
  }, [dragItemId]);

  const handleFolderDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOverFolderId(null);
  }, []);

  const handleFolderDrop = useCallback((e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const itemId = e.dataTransfer.getData('text/plain');
    if (!itemId || itemId === targetFolderId) return;

    // If we have multiple selected and the dragged item is among them, move all
    if (selectedIds.has(itemId) && selectedIds.size > 1) {
      batchMove.mutate(
        { itemIds: Array.from(selectedIds), parentId: targetFolderId },
        {
          onSuccess: () => {
            addToast({ type: 'success', message: `${selectedIds.size} items moved` });
            setSelectedIds(new Set());
          },
        },
      );
    } else {
      updateItem.mutate(
        { id: itemId, parentId: targetFolderId },
        {
          onSuccess: () => addToast({ type: 'success', message: 'Moved' }),
        },
      );
    }
    setDragItemId(null);
    setDragOverFolderId(null);
  }, [selectedIds, batchMove, updateItem, addToast]);

  // Drag to sidebar trash = delete
  const handleSidebarTrashDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');
    if (!itemId) return;

    if (selectedIds.has(itemId) && selectedIds.size > 1) {
      batchDelete.mutate(Array.from(selectedIds), {
        onSuccess: () => {
          addToast({ type: 'success', message: `${selectedIds.size} items moved to trash` });
          setSelectedIds(new Set());
        },
      });
    } else {
      deleteItem.mutate(itemId, {
        onSuccess: () => addToast({ type: 'success', message: 'Moved to trash' }),
      });
    }
    setDragItemId(null);
    setDragOverFolderId(null);
  }, [selectedIds, batchDelete, deleteItem, addToast]);

  // Drag to sidebar "My drive" = move to root
  const handleSidebarRootDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');
    if (!itemId) return;

    if (selectedIds.has(itemId) && selectedIds.size > 1) {
      batchMove.mutate(
        { itemIds: Array.from(selectedIds), parentId: null },
        {
          onSuccess: () => {
            addToast({ type: 'success', message: 'Moved to root' });
            setSelectedIds(new Set());
          },
        },
      );
    } else {
      updateItem.mutate(
        { id: itemId, parentId: null },
        {
          onSuccess: () => addToast({ type: 'success', message: 'Moved to root' }),
        },
      );
    }
    setDragItemId(null);
    setDragOverFolderId(null);
  }, [selectedIds, batchMove, updateItem, addToast]);

  // ─── Title for the view ────────────────────────────────────────────

  const viewTitle = useMemo(() => {
    if (searchQuery.trim()) return `Search: "${searchQuery}"`;
    if (sidebarView === 'favourites') return 'Favourites';
    if (sidebarView === 'recent') return 'Recent';
    if (sidebarView === 'trash') return 'Trash';
    return '';
  }, [sidebarView, searchQuery]);

  // ─── Build folder tree for move modal ──────────────────────────────

  const folderTree = useMemo(() => {
    const folders = foldersData?.folders ?? [];
    const tree: Array<{ id: string; name: string; depth: number }> = [];

    function buildLevel(parentId: string | null, depth: number) {
      const children = folders.filter((f) => f.parentId === parentId);
      for (const child of children) {
        if (moveItem && child.id === moveItem.id) continue;
        tree.push({ id: child.id, name: child.name, depth });
        buildLevel(child.id, depth + 1);
      }
    }

    buildLevel(null, 0);
    return tree;
  }, [foldersData, moveItem]);

  // Folder tree for batch move
  const batchFolderTree = useMemo(() => {
    const folders = foldersData?.folders ?? [];
    const tree: Array<{ id: string; name: string; depth: number }> = [];

    function buildLevel(parentId: string | null, depth: number) {
      const children = folders.filter((f) => f.parentId === parentId);
      for (const child of children) {
        if (selectedIds.has(child.id)) continue;
        tree.push({ id: child.id, name: child.name, depth });
        buildLevel(child.id, depth + 1);
      }
    }

    buildLevel(null, 0);
    return tree;
  }, [foldersData, selectedIds]);

  // ─── Render helpers ────────────────────────────────────────────────

  const renderTags = (item: DriveItem) => {
    if (!item.tags || item.tags.length === 0) return null;
    return (
      <div className="drive-tags">
        {item.tags.map((tag, i) => {
          const { color, label } = parseTag(tag);
          return (
            <Chip key={i} color={color} height={18} onRemove={() => handleRemoveTag(item, i)}>
              {label}
            </Chip>
          );
        })}
      </div>
    );
  };

  const renderImageThumbnail = (item: DriveItem) => {
    if (!isImageFile(item.mimeType) || !item.storagePath) return null;
    return (
      <img
        src={`/api/v1/uploads/${item.storagePath}${getTokenParam()}`}
        alt={item.name}
        className="drive-grid-card-thumbnail"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    );
  };

  return (
    <div className="drive-page">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      {/* ─── Sidebar ─────────────────────────────────────────────── */}
      <div className="drive-sidebar" style={{ width: sidebarWidth }}>
        <div className="drive-sidebar-header">
          <button
            onClick={() => navigate(ROUTES.HOME)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-text-secondary)',
              fontFamily: 'var(--font-family)',
              fontSize: 'var(--font-size-sm)',
              padding: '4px 6px',
              borderRadius: 'var(--radius-sm)',
              transition: 'color var(--transition-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-text-secondary)'; }}
          >
            <ArrowLeft size={16} />
          </button>
          <span className="drive-sidebar-title">Drive</span>
          <div style={{ flex: 1 }} />
        </div>

        <div className="drive-sidebar-actions">
          <div ref={newDropdownRef} style={{ flex: 1, position: 'relative' }}>
            <button
              onClick={() => setNewDropdownOpen((v) => !v)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                height: 32,
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family)',
                cursor: 'pointer',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-bg-primary)'; }}
            >
              <Plus size={14} />
              New
              <ChevronDown size={12} />
            </button>
            {newDropdownOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 50,
                padding: '4px 0',
                minWidth: 180,
              }}>
                <button
                  onClick={() => { setNewDropdownOpen(false); setNewFolderOpen(true); }}
                  className="drive-new-dropdown-item"
                >
                  <FolderPlus size={14} />
                  New folder
                </button>
                <div style={{ height: 1, background: 'var(--color-border-primary)', margin: '4px 0' }} />
                <button
                  onClick={() => {
                    setNewDropdownOpen(false);
                    createLinkedDocument.mutate({ parentId: currentParentId }, {
                      onSuccess: (data) => {
                        navigate(`/docs/${data.resourceId}`);
                      },
                      onError: () => addToast({ type: 'error', message: 'Failed to create document' }),
                    });
                  }}
                  className="drive-new-dropdown-item"
                >
                  <FileText size={14} />
                  New document
                </button>
                <button
                  onClick={() => {
                    setNewDropdownOpen(false);
                    createLinkedDrawing.mutate({ parentId: currentParentId }, {
                      onSuccess: (data) => {
                        navigate(`/draw/${data.resourceId}`);
                      },
                      onError: () => addToast({ type: 'error', message: 'Failed to create drawing' }),
                    });
                  }}
                  className="drive-new-dropdown-item"
                >
                  <Pencil size={14} />
                  New drawing
                </button>
                <button
                  onClick={() => {
                    setNewDropdownOpen(false);
                    createLinkedSpreadsheet.mutate({ parentId: currentParentId }, {
                      onSuccess: (data) => {
                        navigate(`/tables/${data.resourceId}`);
                      },
                      onError: () => addToast({ type: 'error', message: 'Failed to create spreadsheet' }),
                    });
                  }}
                  className="drive-new-dropdown-item"
                >
                  <Table2 size={14} />
                  New spreadsheet
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 32,
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent-primary)',
              color: '#fff',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family)',
              cursor: 'pointer',
              transition: 'background var(--transition-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-accent-primary-hover, #0f6350)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-accent-primary)'; }}
          >
            <Upload size={14} />
            Upload
          </button>
        </div>

        <nav className="drive-sidebar-nav">
          <button
            className={`drive-nav-item ${sidebarView === 'files' && !folderId ? 'active' : ''}`}
            onClick={() => { setSidebarView('files'); setSearchQuery(''); navigate(ROUTES.DRIVE); }}
            onDragOver={(e) => { if (dragItemId) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
            onDrop={handleSidebarRootDrop}
          >
            <HardDrive size={16} style={{ color: '#3b82f6' }} />
            My drive
          </button>
          <button
            className={`drive-nav-item ${sidebarView === 'favourites' ? 'active' : ''}`}
            onClick={() => { setSidebarView('favourites'); setSearchQuery(''); }}
          >
            <Heart size={16} style={{ color: '#ef4444' }} />
            Favourites
          </button>
          <button
            className={`drive-nav-item ${sidebarView === 'recent' ? 'active' : ''}`}
            onClick={() => { setSidebarView('recent'); setSearchQuery(''); }}
          >
            <Clock size={16} style={{ color: '#f59e0b' }} />
            Recent
          </button>
          <button
            className={`drive-nav-item ${sidebarView === 'trash' ? 'active' : ''}`}
            onClick={() => { setSidebarView('trash'); setSearchQuery(''); }}
            onDragOver={(e) => { if (dragItemId) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
            onDrop={handleSidebarTrashDrop}
          >
            <Trash2 size={16} style={{ color: '#78716c' }} />
            Trash
          </button>

          <div className="drive-nav-divider" />
          <div className="drive-nav-section-label">File types</div>
          <button
            className={`drive-nav-item ${sidebarView === 'images' ? 'active' : ''}`}
            onClick={() => { setSidebarView('images'); setSearchQuery(''); }}
          >
            <FileImage size={16} style={{ color: '#e06c9f' }} />
            Images
          </button>
          <button
            className={`drive-nav-item ${sidebarView === 'documents' ? 'active' : ''}`}
            onClick={() => { setSidebarView('documents'); setSearchQuery(''); }}
          >
            <FileText size={16} style={{ color: '#3b82f6' }} />
            Documents
          </button>
          <button
            className={`drive-nav-item ${sidebarView === 'videos' ? 'active' : ''}`}
            onClick={() => { setSidebarView('videos'); setSearchQuery(''); }}
          >
            <FileVideo size={16} style={{ color: '#8b5cf6' }} />
            Videos
          </button>
          <button
            className={`drive-nav-item ${sidebarView === 'audio' ? 'active' : ''}`}
            onClick={() => { setSidebarView('audio'); setSearchQuery(''); }}
          >
            <Music size={16} style={{ color: '#f59e0b' }} />
            Audio
          </button>
        </nav>

        {/* Storage usage */}
        {storageData && (
          <div className="drive-storage">
            <span className="drive-storage-label">{formatBytes(storageData.totalBytes)} used</span>
            <div className="drive-storage-bar">
              <div className="drive-storage-fill" style={{ width: `${Math.min(100, (storageData.totalBytes / (1024 * 1024 * 1024)) * 100)}%` }} />
            </div>
          </div>
        )}

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          style={{
            position: 'absolute',
            top: 0,
            right: -2,
            bottom: 0,
            width: 4,
            cursor: 'col-resize',
            zIndex: 10,
          }}
        />
      </div>

      {/* ─── Main content ────────────────────────────────────────── */}
      <div className="drive-main" style={{ flex: previewItem ? undefined : 1 }}>
        {/* Upload progress bar */}
        {uploadProgress && (
          <div className="drive-upload-progress">
            <div className="drive-upload-progress-info">
              <span>Uploading...</span>
              <span>{Math.round((uploadProgress.loaded / uploadProgress.total) * 100)}%</span>
            </div>
            <div className="drive-upload-progress-bar">
              <div
                className="drive-upload-progress-fill"
                style={{ width: `${Math.round((uploadProgress.loaded / uploadProgress.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Toolbar */}
        <div className="drive-toolbar">
          <div className="drive-toolbar-left">
            {sidebarView === 'files' && !searchQuery.trim() ? (
              <div className="drive-breadcrumbs">
                <button
                  className={`drive-breadcrumb-item ${!folderId ? 'current' : ''}`}
                  onClick={() => { if (folderId) navigate(ROUTES.DRIVE); }}
                >
                  My drive
                </button>
                {breadcrumbs.map((crumb, i) => (
                  <span key={crumb.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ChevronRight size={12} className="drive-breadcrumb-separator" />
                    <button
                      className={`drive-breadcrumb-item ${i === breadcrumbs.length - 1 ? 'current' : ''}`}
                      onClick={() => { if (i < breadcrumbs.length - 1) navigate(`/drive/folder/${crumb.id}`); }}
                    >
                      {crumb.name}
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: 'var(--font-size-md)', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                {viewTitle}
              </span>
            )}
          </div>

          <div className="drive-toolbar-right">
            {/* Type filter dropdown */}
            <div ref={typeDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  height: 32,
                  padding: '0 10px',
                  border: '1px solid var(--color-border-primary)',
                  borderRadius: 'var(--radius-md)',
                  background: typeFilter !== 'all' ? 'color-mix(in srgb, var(--color-accent-primary) 8%, var(--color-bg-primary))' : 'var(--color-bg-primary)',
                  color: typeFilter !== 'all' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-xs)',
                  fontFamily: 'var(--font-family)',
                  cursor: 'pointer',
                }}
              >
                {TYPE_FILTER_OPTIONS.find((o) => o.value === typeFilter)?.label || 'Type'}
                <ChevronDown size={12} />
              </button>
              {typeDropdownOpen && (
                <div className="drive-sort-dropdown" style={{ minWidth: 180 }}>
                  {TYPE_FILTER_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`drive-sort-option ${typeFilter === opt.value ? 'active' : ''}`}
                      onClick={() => { setTypeFilter(opt.value); setTypeDropdownOpen(false); }}
                    >
                      {opt.label}
                      {typeFilter === opt.value && <Check size={12} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Modified filter dropdown */}
            <div ref={modifiedDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setModifiedDropdownOpen(!modifiedDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  height: 32,
                  padding: '0 10px',
                  border: '1px solid var(--color-border-primary)',
                  borderRadius: 'var(--radius-md)',
                  background: modifiedFilter !== 'any' ? 'color-mix(in srgb, var(--color-accent-primary) 8%, var(--color-bg-primary))' : 'var(--color-bg-primary)',
                  color: modifiedFilter !== 'any' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-xs)',
                  fontFamily: 'var(--font-family)',
                  cursor: 'pointer',
                }}
              >
                {getModifiedFilterOptions().find((o) => o.value === modifiedFilter)?.label || 'Modified'}
                <ChevronDown size={12} />
              </button>
              {modifiedDropdownOpen && (
                <div className="drive-sort-dropdown" style={{ minWidth: 180 }}>
                  {getModifiedFilterOptions().map((opt) => (
                    <button
                      key={opt.value}
                      className={`drive-sort-option ${modifiedFilter === opt.value ? 'active' : ''}`}
                      onClick={() => { setModifiedFilter(opt.value); setModifiedDropdownOpen(false); }}
                    >
                      {opt.label}
                      {modifiedFilter === opt.value && <Check size={12} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort dropdown */}
            <div ref={sortDropdownRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  height: 32,
                  padding: '0 10px',
                  border: '1px solid var(--color-border-primary)',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-bg-primary)',
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-xs)',
                  fontFamily: 'var(--font-family)',
                  cursor: 'pointer',
                }}
              >
                {SORT_OPTIONS.find((s) => s.value === sortBy)?.label || 'Sort'}
                <ChevronDown size={12} />
              </button>
              {sortDropdownOpen && (
                <div className="drive-sort-dropdown">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`drive-sort-option ${sortBy === opt.value ? 'active' : ''}`}
                      onClick={() => { setSortBy(opt.value); setSortDropdownOpen(false); }}
                    >
                      {opt.label}
                      {sortBy === opt.value && <Check size={12} />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
              <input
                className="drive-search-input"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* View toggle */}
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
              title={viewMode === 'list' ? 'Grid view' : 'List view'}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-bg-primary)'; }}
            >
              {viewMode === 'list' ? <LayoutGrid size={16} /> : <LayoutList size={16} />}
            </button>

            {/* Settings */}
            <button
              onClick={() => openSettings('drive')}
              title="Drive settings"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg-primary)',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
                transition: 'background var(--transition-fast)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-surface-hover)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--color-bg-primary)'; }}
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className="drive-content"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => { if (!hasSelection) { setSelectedIds(new Set()); } setContextMenu(null); }}
        >
          {/* Drop zone overlay */}
          {isDraggingOver && (
            <div className="drive-dropzone-overlay">
              <div className="drive-dropzone-label">
                <UploadIcon size={32} />
                Drop files to upload
              </div>
            </div>
          )}

          {isLoading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
              Loading...
            </div>
          ) : displayItems.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: 12,
              color: 'var(--color-text-tertiary)',
              padding: 32,
            }}>
              {sidebarView === 'trash' ? (
                <>
                  <Trash2 size={40} strokeWidth={1.2} />
                  <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Trash is empty</span>
                  <span style={{ fontSize: 'var(--font-size-sm)' }}>Deleted files will appear here</span>
                </>
              ) : sidebarView === 'favourites' ? (
                <>
                  <Heart size={40} strokeWidth={1.2} />
                  <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>No favourites</span>
                  <span style={{ fontSize: 'var(--font-size-sm)' }}>Star files and folders to find them here</span>
                </>
              ) : searchQuery.trim() ? (
                <>
                  <Search size={40} strokeWidth={1.2} />
                  <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>No results</span>
                  <span style={{ fontSize: 'var(--font-size-sm)' }}>Try a different search term</span>
                </>
              ) : (
                <>
                  <HardDrive size={40} strokeWidth={1.2} />
                  <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 500, color: 'var(--color-text-secondary)' }}>This folder is empty</span>
                  <span style={{ fontSize: 'var(--font-size-sm)' }}>Upload files or create a folder to get started</span>
                </>
              )}
            </div>
          ) : viewMode === 'list' ? (
            <>
              {/* List header */}
              <div className="drive-list-header">
                <span
                  className="drive-sort-header"
                  onClick={() => setSortBy(sortBy === 'name' ? 'default' : 'name')}
                >
                  Name {sortBy === 'name' && '↑'}
                </span>
                <span
                  className="drive-sort-header"
                  onClick={() => setSortBy(sortBy === 'size' ? 'default' : 'size')}
                >
                  Size {sortBy === 'size' && '↓'}
                </span>
                <span
                  className="drive-sort-header"
                  onClick={() => setSortBy(sortBy === 'date' ? 'default' : 'date')}
                >
                  Modified {sortBy === 'date' && '↓'}
                </span>
              </div>
              {displayItems.map((item) => {
                const Icon = getFileTypeIcon(item.mimeType, item.type, item.linkedResourceType);

                const isRenaming = renameId === item.id;
                const isSelected = selectedIds.has(item.id);
                const isDragTarget = dragOverFolderId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`drive-list-row ${isSelected ? 'selected' : ''} ${isDragTarget ? 'drive-drag-over' : ''} ${driveSettings.compactMode ? 'compact' : ''}`}
                    onClick={(e) => { e.stopPropagation(); handleItemClick(item, e); }}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                    onDoubleClick={() => handleItemDoubleClick(item)}
                    draggable={!isRenaming}
                    onDragStart={(e) => handleItemDragStart(e, item)}
                    onDragEnd={handleItemDragEnd}
                    onDragOver={item.type === 'folder' ? (e) => handleFolderDragOver(e, item.id) : undefined}
                    onDragLeave={item.type === 'folder' ? handleFolderDragLeave : undefined}
                    onDrop={item.type === 'folder' ? (e) => handleFolderDrop(e, item.id) : undefined}
                  >
                    <div className="drive-list-name">
                      <input
                        type="checkbox"
                        className="drive-checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(item.id)) next.delete(item.id);
                            else next.add(item.id);
                            return next;
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {item.icon ? (
                        <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                      ) : (
                        <Icon size={22} />
                      )}
                      {isRenaming ? (
                        <input
                          className="drive-rename-input"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={handleRenameSubmit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSubmit();
                            if (e.key === 'Escape') setRenameId(null);
                          }}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span>{driveSettings.showFileExtensions ? item.name : stripExtension(item.name, item.type)}</span>
                      )}
                      {item.isFavourite && (
                        <Star size={12} fill="var(--color-star, #f59e0b)" color="var(--color-star, #f59e0b)" />
                      )}
                      {renderTags(item)}
                    </div>
                    <span className="drive-list-size">
                      {item.type === 'file' ? formatBytes(item.size) : '—'}
                    </span>
                    <span className="drive-list-modified">
                      {formatRelativeDate(item.updatedAt)}
                    </span>
                  </div>
                );
              })}
            </>
          ) : (
            /* Grid view */
            <div className="drive-grid">
              {displayItems.map((item) => {
                const Icon = getFileTypeIcon(item.mimeType, item.type, item.linkedResourceType);

                const isSelected = selectedIds.has(item.id);
                const isRenaming = renameId === item.id;
                const showThumb = driveSettings.showThumbnails && isImageFile(item.mimeType) && item.storagePath;
                const isDragTarget = dragOverFolderId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`drive-grid-card ${isSelected ? 'selected' : ''} ${isDragTarget ? 'drive-drag-over' : ''}`}
                    onClick={(e) => { e.stopPropagation(); handleItemClick(item, e); }}
                    onDoubleClick={() => handleItemDoubleClick(item)}
                    onContextMenu={(e) => handleContextMenu(e, item)}
                    draggable={!isRenaming}
                    onDragStart={(e) => handleItemDragStart(e, item)}
                    onDragEnd={handleItemDragEnd}
                    onDragOver={item.type === 'folder' ? (e) => handleFolderDragOver(e, item.id) : undefined}
                    onDragLeave={item.type === 'folder' ? handleFolderDragLeave : undefined}
                    onDrop={item.type === 'folder' ? (e) => handleFolderDrop(e, item.id) : undefined}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      className="drive-checkbox drive-grid-checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        });
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="drive-grid-card-icon">
                      {showThumb ? (
                        <img
                          src={`/api/v1/uploads/${item.storagePath}${getTokenParam()}`}
                          alt={item.name}
                          className="drive-grid-card-thumbnail"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : item.type === 'folder' && item.icon ? (
                        <span style={{ fontSize: 42, lineHeight: 1 }}>{item.icon}</span>
                      ) : (
                        <Icon size={42} />
                      )}
                    </div>
                    {isRenaming ? (
                      <input
                        className="drive-rename-input"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={handleRenameSubmit}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRenameSubmit();
                          if (e.key === 'Escape') setRenameId(null);
                        }}
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                        style={{ textAlign: 'center' }}
                      />
                    ) : (
                      <span className="drive-grid-card-name">{driveSettings.showFileExtensions ? item.name : stripExtension(item.name, item.type)}</span>
                    )}
                    <span className="drive-grid-card-meta">
                      {item.type === 'file' ? formatBytes(item.size) : `${formatRelativeDate(item.updatedAt)}`}
                    </span>
                    {renderTags(item)}
                    {item.isFavourite && (
                      <Star size={12} fill="var(--color-star, #f59e0b)" color="var(--color-star, #f59e0b)" style={{ position: 'absolute', top: 8, right: 8 }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Preview panel ─────────────────────────────────────────── */}
      {previewItem && (
        <div className="drive-preview-panel">
          <div className="drive-preview-header">
            <span className="drive-preview-title">{previewItem.name}</span>
            <button
              onClick={() => setPreviewItem(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                background: 'transparent',
                color: 'var(--color-text-secondary)',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>

          <div className="drive-preview-body">
            {isImageFile(previewItem.mimeType) && previewItem.storagePath ? (
              <img
                src={`/api/v1/drive/${previewItem.id}/view${getTokenParam()}`}
                alt={previewItem.name}
                className="drive-preview-image"
              />
            ) : previewItem.mimeType?.includes('pdf') && previewItem.storagePath ? (
              <iframe
                src={`/api/v1/drive/${previewItem.id}/view${getTokenParam()}`}
                className="drive-preview-iframe"
                title={previewItem.name}
              />
            ) : previewItem.mimeType?.startsWith('video/') && previewItem.storagePath ? (
              <video
                src={`/api/v1/drive/${previewItem.id}/view${getTokenParam()}`}
                controls
                className="drive-preview-video"
              />
            ) : previewItem.mimeType?.startsWith('audio/') && previewItem.storagePath ? (
              <div className="drive-preview-audio-wrap">
                <Music size={64} color="var(--color-text-tertiary)" strokeWidth={1.2} />
                <audio
                  src={`/api/v1/drive/${previewItem.id}/view${getTokenParam()}`}
                  controls
                  style={{ width: '100%', marginTop: 16 }}
                />
              </div>
            ) : previewFileId && filePreviewData ? (
              <div className="drive-preview-text-content">
                {getFileExtension(previewItem.name) === 'csv' ? (
                  (() => {
                    const rows = parseCsvToRows(filePreviewData.content);
                    if (rows.length === 0) return <pre className="drive-preview-pre">(empty)</pre>;
                    const header = rows[0];
                    const body = rows.slice(1);
                    return (
                      <div className="drive-preview-table-wrap">
                        <table className="drive-preview-table">
                          <thead>
                            <tr>{header.map((h, i) => <th key={i}>{h}</th>)}</tr>
                          </thead>
                          <tbody>
                            {body.map((row, ri) => (
                              <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
                            ))}
                          </tbody>
                        </table>
                        {filePreviewData.truncated && (
                          <div className="drive-preview-truncated">File truncated — showing first 512 KB</div>
                        )}
                      </div>
                    );
                  })()
                ) : getFileExtension(previewItem.name) === 'md' ? (
                  <>
                    <div
                      className="drive-preview-pre"
                      style={{ whiteSpace: 'normal', fontFamily: 'var(--font-family)', fontSize: 13, lineHeight: 1.6 }}
                      dangerouslySetInnerHTML={{ __html: renderBasicMarkdown(filePreviewData.content) }}
                    />
                    {filePreviewData.truncated && (
                      <div className="drive-preview-truncated">File truncated — showing first 512 KB</div>
                    )}
                  </>
                ) : (
                  <>
                    <pre className="drive-preview-pre">{filePreviewData.content}</pre>
                    {filePreviewData.truncated && (
                      <div className="drive-preview-truncated">File truncated — showing first 512 KB</div>
                    )}
                  </>
                )}
              </div>
            ) : previewFileId && previewLoading ? (
              <div className="drive-preview-icon">
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>Loading preview…</span>
              </div>
            ) : previewItem.linkedResourceType === 'document' && linkedDocData ? (
              <div className="drive-preview-text-content">
                <pre className="drive-preview-pre" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {extractTextFromContent(linkedDocData.content) || '(empty document)'}
                </pre>
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border-secondary)' }}>
                  <button
                    onClick={() => navigate(`/docs/${previewItem.linkedResourceId}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 14px',
                      border: '1px solid var(--color-border-primary)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-surface-primary)',
                      color: 'var(--color-text-primary)',
                      fontSize: 13,
                      cursor: 'pointer',
                      width: '100%',
                      justifyContent: 'center',
                    }}
                  >
                    <ExternalLink size={14} />
                    Open in editor
                  </button>
                </div>
              </div>
            ) : previewItem.linkedResourceType === 'drawing' && linkedDrawingData ? (
              <div className="drive-preview-text-content">
                <DrawingPreviewThumbnail content={linkedDrawingData.content} />
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border-secondary)' }}>
                  <button
                    onClick={() => navigate(`/draw/${previewItem.linkedResourceId}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 14px',
                      border: '1px solid var(--color-border-primary)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-surface-primary)',
                      color: 'var(--color-text-primary)',
                      fontSize: 13,
                      cursor: 'pointer',
                      width: '100%',
                      justifyContent: 'center',
                    }}
                  >
                    <ExternalLink size={14} />
                    Open in editor
                  </button>
                </div>
              </div>
            ) : previewItem.linkedResourceType === 'spreadsheet' && linkedTableData ? (
              <div className="drive-preview-text-content">
                {(() => {
                  const cols = linkedTableData.columns || [];
                  const rows = linkedTableData.rows || [];
                  if (cols.length === 0) return (
                    <div className="drive-preview-icon" style={{ gap: 8, padding: 24 }}>
                      <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>(empty spreadsheet)</span>
                    </div>
                  );
                  const previewRows = rows.slice(0, 10);
                  const previewCols = cols.slice(0, 6);
                  return (
                    <div style={{ padding: 16 }}>
                      <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
                        {cols.length} column{cols.length !== 1 ? 's' : ''}, {rows.length} row{rows.length !== 1 ? 's' : ''}
                      </div>
                      <div className="drive-preview-table-wrap">
                        <table className="drive-preview-table">
                          <thead>
                            <tr>
                              {previewCols.map((col) => <th key={col.id}>{col.name}</th>)}
                              {cols.length > 6 && <th style={{ color: 'var(--color-text-tertiary)' }}>+{cols.length - 6}</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {previewRows.map((row, ri) => (
                              <tr key={ri}>
                                {previewCols.map((col) => (
                                  <td key={col.id}>{row[col.id] != null ? String(row[col.id]) : ''}</td>
                                ))}
                                {cols.length > 6 && <td>…</td>}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {rows.length > 10 && (
                          <div className="drive-preview-truncated">Showing first 10 of {rows.length} rows</div>
                        )}
                      </div>
                    </div>
                  );
                })()}
                <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border-secondary)' }}>
                  <button
                    onClick={() => navigate(`/tables/${previewItem.linkedResourceId}`)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '6px 14px',
                      border: '1px solid var(--color-border-primary)',
                      borderRadius: 'var(--radius-md)',
                      background: 'var(--color-surface-primary)',
                      color: 'var(--color-text-primary)',
                      fontSize: 13,
                      cursor: 'pointer',
                      width: '100%',
                      justifyContent: 'center',
                    }}
                  >
                    <ExternalLink size={14} />
                    Open in editor
                  </button>
                </div>
              </div>
            ) : previewItem.linkedResourceType && previewItem.linkedResourceId ? (
              <div className="drive-preview-icon">
                <span style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>Loading preview…</span>
              </div>
            ) : (
              <div className="drive-preview-icon">
                {(() => {
                  const Icon = getFileTypeIcon(previewItem.mimeType, previewItem.type, previewItem.linkedResourceType);
                  return <Icon size={64} />;
                })()}
              </div>
            )}
          </div>

          <div className="drive-preview-meta">
            <div className="drive-preview-meta-row">
              <span className="drive-preview-meta-label">Size</span>
              <span>{formatBytes(previewItem.size)}</span>
            </div>
            <div className="drive-preview-meta-row">
              <span className="drive-preview-meta-label">Modified</span>
              <span>{formatRelativeDate(previewItem.updatedAt)}</span>
            </div>
            {previewItem.mimeType && (
              <div className="drive-preview-meta-row">
                <span className="drive-preview-meta-label">Type</span>
                <span>{getFriendlyTypeName(previewItem.mimeType, previewItem.name)}</span>
              </div>
            )}
            {previewItem.tags && previewItem.tags.length > 0 && (
              <div className="drive-preview-meta-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                <span className="drive-preview-meta-label">Tags</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {previewItem.tags.map((tag, i) => {
                    const { color, label } = parseTag(tag);
                    return <Chip key={i} color={color} height={20}>{label}</Chip>;
                  })}
                </div>
              </div>
            )}
            {previewItem.type === 'file' && (
              <div style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 8 }}>
                <button
                  onClick={() => setVersionHistoryOpen(!versionHistoryOpen)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                    padding: '4px 0', border: 'none', background: 'transparent',
                    color: 'var(--color-text-secondary)', fontSize: 'var(--font-size-xs)',
                    fontFamily: 'var(--font-family)', cursor: 'pointer',
                  }}
                >
                  <History size={13} />
                  Version history
                  <ChevronDown size={12} style={{ marginLeft: 'auto', transform: versionHistoryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                </button>
                {versionHistoryOpen && versionsData && (
                  <div className="drive-version-list">
                    {versionsData.versions.length === 0 ? (
                      <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', padding: '4px 0' }}>No previous versions</span>
                    ) : (
                      versionsData.versions.map((v) => (
                        <div key={v.id} className="drive-version-row">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 11, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</div>
                            <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
                              {formatRelativeDate(v.createdAt)} · {formatBytes(v.size)}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              onClick={() => {
                                restoreVersion.mutate({ itemId: previewItem.id, versionId: v.id }, {
                                  onSuccess: () => addToast({ type: 'success', message: 'Version restored' }),
                                });
                              }}
                              title="Restore this version"
                              style={{ padding: 2, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}
                            >
                              <RotateCcw size={12} />
                            </button>
                            <a
                              href={`/api/v1/drive/${previewItem.id}/versions/${v.id}/download${getTokenParam()}`}
                              title="Download this version"
                              style={{ padding: 2, color: 'var(--color-text-tertiary)', display: 'flex', alignItems: 'center' }}
                            >
                              <Download size={12} />
                            </a>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Context menu ────────────────────────────────────────── */}
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} onClose={() => setContextMenu(null)} minWidth={180}>
          {sidebarView === 'trash' ? (
            <>
              <ContextMenuItem
                icon={<RotateCcw size={14} />}
                label="Restore"
                onClick={() => handleRestore(contextMenu.item)}
              />
              <ContextMenuSeparator />
              <ContextMenuItem
                icon={<Trash2 size={14} />}
                label="Delete permanently"
                onClick={() => handlePermanentDelete(contextMenu.item)}
                destructive
              />
            </>
          ) : (
            <>
              {contextMenu.item.linkedResourceType && contextMenu.item.linkedResourceId && (
                <ContextMenuItem
                  icon={<ExternalLink size={14} />}
                  label="Open in editor"
                  onClick={() => {
                    const item = contextMenu.item;
                    setContextMenu(null);
                    if (item.linkedResourceType === 'document') navigate(`/docs/${item.linkedResourceId}`);
                    else if (item.linkedResourceType === 'drawing') navigate(`/draw/${item.linkedResourceId}`);
                    else if (item.linkedResourceType === 'spreadsheet') navigate(`/tables/${item.linkedResourceId}`);
                  }}
                />
              )}
              {contextMenu.item.type === 'file' && !contextMenu.item.linkedResourceType && (
                <ContextMenuItem
                  icon={<Download size={14} />}
                  label="Download"
                  onClick={() => handleDownload(contextMenu.item)}
                />
              )}
              {contextMenu.item.type === 'folder' && (
                <ContextMenuItem
                  icon={<FileArchive size={14} />}
                  label="Download as ZIP"
                  onClick={() => handleDownloadZip(contextMenu.item)}
                />
              )}
              <ContextMenuItem
                icon={<Pencil size={14} />}
                label="Rename"
                onClick={() => handleRename(contextMenu.item)}
              />
              {contextMenu.item.type === 'folder' && (
                <ContextMenuItem
                  icon={<span style={{ fontSize: 14, lineHeight: 1 }}>{contextMenu.item.icon || '😀'}</span>}
                  label={contextMenu.item.icon ? 'Change icon' : 'Add icon'}
                  onClick={() => handleSetIcon(contextMenu.item)}
                />
              )}
              <ContextMenuItem
                icon={<Copy size={14} />}
                label="Duplicate"
                onClick={() => handleDuplicate(contextMenu.item)}
              />
              <ContextMenuItem
                icon={<FolderInput size={14} />}
                label="Move to..."
                onClick={() => handleMove(contextMenu.item)}
              />
              <ContextMenuItem
                icon={<Star size={14} />}
                label={contextMenu.item.isFavourite ? 'Remove from favourites' : 'Add to favourites'}
                onClick={() => handleToggleFavourite(contextMenu.item)}
              />
              <ContextMenuItem
                icon={<Tag size={14} />}
                label="Add tag"
                onClick={() => handleAddTag(contextMenu.item)}
              />
              <ContextMenuItem
                icon={<Share2 size={14} />}
                label="Share"
                onClick={() => { setShareModalItem(contextMenu.item); setContextMenu(null); }}
              />
              {contextMenu.item.type === 'file' && (
                <ContextMenuItem
                  icon={<Upload size={14} />}
                  label="Upload new version"
                  onClick={() => {
                    setReplaceTargetId(contextMenu.item.id);
                    setContextMenu(null);
                    setTimeout(() => replaceFileInputRef.current?.click(), 50);
                  }}
                />
              )}
              <ContextMenuSeparator />
              <ContextMenuItem
                icon={<Trash2 size={14} />}
                label="Move to trash"
                onClick={() => handleMoveToTrash(contextMenu.item)}
                destructive
              />
            </>
          )}
        </ContextMenu>
      )}

      {/* ─── New folder modal ────────────────────────────────────── */}
      <Modal open={newFolderOpen} onOpenChange={setNewFolderOpen} width={400} title="New folder">
        <div style={{ padding: 'var(--spacing-xl)' }}>
          <input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateFolder(); }}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-md)',
              fontFamily: 'var(--font-family)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button
              onClick={() => setNewFolderOpen(false)}
              style={{
                height: 34,
                padding: '0 16px',
                background: 'transparent',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-md)',
                fontFamily: 'var(--font-family)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateFolder}
              disabled={!newFolderName.trim()}
              style={{
                height: 34,
                padding: '0 16px',
                background: newFolderName.trim() ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: newFolderName.trim() ? '#fff' : 'var(--color-text-tertiary)',
                fontSize: 'var(--font-size-md)',
                fontWeight: 500,
                fontFamily: 'var(--font-family)',
                cursor: newFolderName.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Create
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Move modal ──────────────────────────────────────────── */}
      <Modal open={moveModalOpen} onOpenChange={setMoveModalOpen} width={400} title="Move to...">
        <div style={{ padding: 'var(--spacing-xl)', maxHeight: 400, overflowY: 'auto' }}>
          <button
            onClick={() => setMoveTargetId(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 10px',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: moveTargetId === null ? 'var(--color-surface-active)' : 'transparent',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <HardDrive size={16} />
            My drive (root)
          </button>

          {folderTree.map((folder) => (
            <button
              key={folder.id}
              onClick={() => setMoveTargetId(folder.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 10px',
                paddingLeft: 10 + folder.depth * 20,
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: moveTargetId === folder.id ? 'var(--color-surface-active)' : 'transparent',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <FolderPlus size={16} color="#64748b" />
              {folder.name}
            </button>
          ))}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, borderTop: '1px solid var(--color-border-secondary)', paddingTop: 16 }}>
            <button
              onClick={() => setMoveModalOpen(false)}
              style={{
                height: 34,
                padding: '0 16px',
                background: 'transparent',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-md)',
                fontFamily: 'var(--font-family)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleMoveSubmit}
              style={{
                height: 34,
                padding: '0 16px',
                background: 'var(--color-accent-primary)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                fontSize: 'var(--font-size-md)',
                fontWeight: 500,
                fontFamily: 'var(--font-family)',
                cursor: 'pointer',
              }}
            >
              Move here
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Batch move modal ─────────────────────────────────────── */}
      <Modal open={batchMoveOpen} onOpenChange={setBatchMoveOpen} width={400} title={`Move ${selectedIds.size} items to...`}>
        <div style={{ padding: 'var(--spacing-xl)', maxHeight: 400, overflowY: 'auto' }}>
          <button
            onClick={() => setBatchMoveTargetId(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 10px',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: batchMoveTargetId === null ? 'var(--color-surface-active)' : 'transparent',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-sm)',
              fontFamily: 'var(--font-family)',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <HardDrive size={16} />
            My drive (root)
          </button>
          {batchFolderTree.map((folder) => (
            <button
              key={folder.id}
              onClick={() => setBatchMoveTargetId(folder.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                width: '100%',
                padding: '8px 10px',
                paddingLeft: 10 + folder.depth * 20,
                border: 'none',
                borderRadius: 'var(--radius-md)',
                background: batchMoveTargetId === folder.id ? 'var(--color-surface-active)' : 'transparent',
                color: 'var(--color-text-primary)',
                fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <FolderPlus size={16} color="#64748b" />
              {folder.name}
            </button>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16, borderTop: '1px solid var(--color-border-secondary)', paddingTop: 16 }}>
            <button
              onClick={() => setBatchMoveOpen(false)}
              style={{
                height: 34,
                padding: '0 16px',
                background: 'transparent',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-md)',
                fontFamily: 'var(--font-family)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleBulkMoveSubmit}
              style={{
                height: 34,
                padding: '0 16px',
                background: 'var(--color-accent-primary)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                fontSize: 'var(--font-size-md)',
                fontWeight: 500,
                fontFamily: 'var(--font-family)',
                cursor: 'pointer',
              }}
            >
              Move here
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Tag modal ────────────────────────────────────────────── */}
      <Modal open={!!tagModalItem} onOpenChange={() => setTagModalItem(null)} width={360} title="Add tag">
        <div style={{ padding: 'var(--spacing-xl)' }}>
          <input
            value={tagLabel}
            onChange={(e) => setTagLabel(e.target.value)}
            placeholder="Tag name"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleTagSubmit(); }}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-bg-primary)',
              color: 'var(--color-text-primary)',
              fontSize: 'var(--font-size-md)',
              fontFamily: 'var(--font-family)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            {TAG_COLORS.map((c) => (
              <button
                key={c.name}
                onClick={() => setTagColor(c.hex)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: tagColor === c.hex ? `2px solid ${c.hex}` : '2px solid transparent',
                  background: c.hex,
                  cursor: 'pointer',
                  outline: tagColor === c.hex ? `2px solid var(--color-bg-primary)` : 'none',
                  outlineOffset: -4,
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button
              onClick={() => setTagModalItem(null)}
              style={{
                height: 34,
                padding: '0 16px',
                background: 'transparent',
                border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-md)',
                fontFamily: 'var(--font-family)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleTagSubmit}
              disabled={!tagLabel.trim()}
              style={{
                height: 34,
                padding: '0 16px',
                background: tagLabel.trim() ? 'var(--color-accent-primary)' : 'var(--color-bg-tertiary)',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: tagLabel.trim() ? '#fff' : 'var(--color-text-tertiary)',
                fontSize: 'var(--font-size-md)',
                fontWeight: 500,
                fontFamily: 'var(--font-family)',
                cursor: tagLabel.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Add
            </button>
          </div>
        </div>
      </Modal>

      {/* ─── Share modal ──────────────────────────────────────────── */}
      <Modal open={!!shareModalItem} onOpenChange={() => setShareModalItem(null)} width={440} title={`Share "${shareModalItem?.name || ''}"`}>
        <div style={{ padding: 'var(--spacing-xl)' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <select
              value={shareExpiry}
              onChange={(e) => setShareExpiry(e.target.value)}
              style={{
                flex: 1, padding: '8px 12px', border: '1px solid var(--color-border-primary)',
                borderRadius: 'var(--radius-md)', background: 'var(--color-bg-primary)',
                color: 'var(--color-text-primary)', fontSize: 'var(--font-size-sm)',
                fontFamily: 'var(--font-family)', outline: 'none',
              }}
            >
              <option value="never">Never expires</option>
              <option value="1">Expires in 1 day</option>
              <option value="7">Expires in 7 days</option>
              <option value="30">Expires in 30 days</option>
            </select>
            <button
              onClick={() => {
                if (!shareModalItem) return;
                const expiresAt = shareExpiry === 'never' ? undefined : new Date(Date.now() + parseInt(shareExpiry) * 86400000).toISOString();
                createShareLink.mutate({ itemId: shareModalItem.id, expiresAt }, {
                  onSuccess: () => addToast({ type: 'success', message: 'Share link created' }),
                });
              }}
              style={{
                height: 34, padding: '0 16px', background: 'var(--color-accent-primary)',
                border: 'none', borderRadius: 'var(--radius-md)', color: '#fff',
                fontSize: 'var(--font-size-sm)', fontWeight: 500, fontFamily: 'var(--font-family)',
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              <Link2 size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              Create link
            </button>
          </div>
          {shareLinksData && shareLinksData.links.length > 0 && (
            <div className="drive-share-links-list">
              {shareLinksData.links.map((link) => {
                const shareUrl = `${window.location.origin}/api/v1/share/${link.shareToken}/download`;
                return (
                  <div key={link.id} className="drive-share-link-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <input
                        readOnly
                        value={shareUrl}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        style={{
                          width: '100%', padding: '4px 8px', border: '1px solid var(--color-border-secondary)',
                          borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-secondary)',
                          color: 'var(--color-text-primary)', fontSize: 11, fontFamily: 'var(--font-family)',
                          outline: 'none',
                        }}
                      />
                      <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
                        Created {formatRelativeDate(link.createdAt)}
                        {link.expiresAt ? ` · Expires ${formatRelativeDate(link.expiresAt)}` : ' · No expiry'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => { navigator.clipboard.writeText(shareUrl); addToast({ type: 'success', message: 'Link copied' }); }}
                        title="Copy link"
                        style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-tertiary)' }}
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        onClick={() => deleteShareLink.mutate(link.id, { onSuccess: () => addToast({ type: 'success', message: 'Link deleted' }) })}
                        title="Delete link"
                        style={{ padding: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-error, #ef4444)' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* ─── Hidden replace file input ─────────────────────────────── */}
      <input
        type="file"
        ref={replaceFileInputRef}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && replaceTargetId) {
            replaceFile.mutate({ itemId: replaceTargetId, file }, {
              onSuccess: () => {
                addToast({ type: 'success', message: 'New version uploaded' });
                setReplaceTargetId(null);
              },
            });
          }
          e.target.value = '';
        }}
      />

      {/* ─── Floating bulk action bar ──────────────────────────────── */}
      {hasSelection && (
        <div className="drive-bulk-bar">
          <span className="drive-bulk-count">{selectedIds.size} selected</span>
          <button className="drive-bulk-btn" onClick={handleSelectAll} title="Select all">
            <Check size={14} /> Select all
          </button>
          <button className="drive-bulk-btn" onClick={handleClearSelection} title="Clear">
            <X size={14} /> Clear
          </button>
          <div style={{ width: 1, height: 20, background: 'var(--color-border-primary)' }} />
          <button className="drive-bulk-btn" onClick={() => { setBatchMoveTargetId(null); setBatchMoveOpen(true); }} title="Move">
            <FolderInput size={14} /> Move
          </button>
          <button className="drive-bulk-btn" onClick={handleBulkFavourite} title="Favourite">
            <Star size={14} /> Favourite
          </button>
          <button className="drive-bulk-btn drive-bulk-btn-destructive" onClick={handleBulkDelete} title="Delete">
            <Trash2 size={14} /> Delete
          </button>
        </div>
      )}

      {/* ─── Confirm dialogs ─────────────────────────────────────── */}
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={() => setConfirmDelete(null)}
        title="Move to trash"
        description={`"${confirmDelete?.name}" will be moved to trash. You can restore it later.`}
        confirmLabel="Move to trash"
        onConfirm={confirmMoveToTrash}
        destructive
      />

      <ConfirmDialog
        open={!!confirmPermanent}
        onOpenChange={() => setConfirmPermanent(null)}
        title="Delete permanently"
        description={`"${confirmPermanent?.name}" will be permanently deleted. This action cannot be undone.`}
        confirmLabel="Delete permanently"
        onConfirm={confirmPermanentDelete}
        destructive
      />

      {iconPickerItem && (
        <Modal open onOpenChange={() => setIconPickerItem(null)} title="Choose icon" width={320}>
          <Modal.Header title="Choose icon" />
          <Modal.Body>
            <EmojiPicker
              inline
              onSelect={handleIconSelect}
              onRemove={iconPickerItem.icon ? handleIconRemove : undefined}
              onClose={() => setIconPickerItem(null)}
            />
          </Modal.Body>
        </Modal>
      )}
    </div>
  );
}
