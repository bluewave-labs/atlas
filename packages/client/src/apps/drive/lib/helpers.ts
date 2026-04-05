import type { TFunction } from 'i18next';
import type { DriveItem } from '@atlasmail/shared';
import type { SortBy, TypeFilter, ModifiedFilter } from './types';

// ─── Constants ───────────────────────────────────────────────────────

export const PREVIEW_WIDTH_KEY = 'atlasmail_drive_preview_width';
export const DEFAULT_PREVIEW_WIDTH = 380;
export const MIN_PREVIEW_WIDTH = 280;
export const MAX_PREVIEW_WIDTH = 600;
export const VIEW_MODE_KEY = 'atlasmail_drive_view_mode';

export function getSortOptions(t: TFunction): { value: SortBy; label: string }[] {
  return [
    { value: 'default', label: t('drive.sort.default') },
    { value: 'name', label: t('drive.sort.name') },
    { value: 'size', label: t('drive.sort.size') },
    { value: 'date', label: t('drive.sort.dateModified') },
    { value: 'type', label: t('drive.sort.type') },
  ];
}

/** @deprecated Use getSortOptions(t) instead */
export const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'name', label: 'Name' },
  { value: 'size', label: 'Size' },
  { value: 'date', label: 'Date modified' },
  { value: 'type', label: 'Type' },
];

export function getTypeFilterOptions(t: TFunction): { value: TypeFilter; label: string }[] {
  return [
    { value: 'all', label: t('drive.typeFilter.anyType') },
    { value: 'folders', label: t('drive.typeFilter.folders') },
    { value: 'documents', label: t('drive.typeFilter.documents') },
    { value: 'word', label: t('drive.typeFilter.word') },
    { value: 'spreadsheets', label: t('drive.typeFilter.spreadsheets') },
    { value: 'excel', label: t('drive.typeFilter.excel') },
    { value: 'presentations', label: t('drive.typeFilter.presentations') },
    { value: 'powerpoint', label: t('drive.typeFilter.powerpoint') },
    { value: 'photos', label: t('drive.typeFilter.photosImages') },
    { value: 'pdfs', label: t('drive.typeFilter.pdfs') },
    { value: 'videos', label: t('drive.typeFilter.videos') },
    { value: 'audio', label: t('drive.typeFilter.audio') },
    { value: 'archives', label: t('drive.typeFilter.archives') },
    { value: 'code', label: t('drive.typeFilter.code') },
    { value: 'text', label: t('drive.typeFilter.textFiles') },
    { value: 'drawings', label: t('drive.typeFilter.drawings') },
  ];
}

/** @deprecated Use getTypeFilterOptions(t) instead */
export const TYPE_FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
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

export const TAG_COLORS = [
  { name: 'red', hex: '#ef4444' },
  { name: 'blue', hex: '#3b82f6' },
  { name: 'green', hex: '#22c55e' },
  { name: 'orange', hex: '#f97316' },
  { name: 'purple', hex: '#8b5cf6' },
  { name: 'gray', hex: '#6b7280' },
];

// ─── Helper functions ────────────────────────────────────────────────

export function getModifiedFilterOptions(t?: TFunction): { value: ModifiedFilter; label: string }[] {
  const now = new Date();
  const thisYear = now.getFullYear();
  if (t) {
    return [
      { value: 'any', label: t('drive.modifiedFilter.anyTime') },
      { value: 'today', label: t('drive.modifiedFilter.today') },
      { value: '7days', label: t('drive.modifiedFilter.last7Days') },
      { value: '30days', label: t('drive.modifiedFilter.last30Days') },
      { value: 'thisYear', label: t('drive.modifiedFilter.thisYear', { year: thisYear }) },
      { value: 'lastYear', label: t('drive.modifiedFilter.lastYear', { year: thisYear - 1 }) },
    ];
  }
  return [
    { value: 'any', label: 'Any time' },
    { value: 'today', label: 'Today' },
    { value: '7days', label: 'Last 7 days' },
    { value: '30days', label: 'Last 30 days' },
    { value: 'thisYear', label: `This year (${thisYear})` },
    { value: 'lastYear', label: `Last year (${thisYear - 1})` },
  ];
}

export function getSavedPreviewWidth(): number {
  try {
    const w = parseInt(localStorage.getItem(PREVIEW_WIDTH_KEY) || '', 10);
    if (w >= MIN_PREVIEW_WIDTH && w <= MAX_PREVIEW_WIDTH) return w;
  } catch { /* ignore */ }
  return DEFAULT_PREVIEW_WIDTH;
}

export function getSavedViewMode(): 'list' | 'grid' {
  try {
    const v = localStorage.getItem(VIEW_MODE_KEY);
    if (v === 'list' || v === 'grid') return v;
  } catch { /* ignore */ }
  return 'list';
}

export function getTokenParam(): string {
  const token = localStorage.getItem('atlasmail_token');
  return token ? `?token=${encodeURIComponent(token)}` : '';
}

export function parseTag(tag: string): { color: string; label: string } {
  const idx = tag.indexOf(':');
  if (idx > 0) return { color: tag.slice(0, idx), label: tag.slice(idx + 1) };
  return { color: '#6b7280', label: tag };
}

export function isTextPreviewable(mimeType: string | null, name: string): boolean {
  if (!mimeType && !name) return false;
  if (mimeType) {
    if (mimeType.startsWith('text/')) return true;
    if (['application/json', 'application/xml', 'application/javascript', 'application/csv', 'application/x-yaml'].some((m) => mimeType.includes(m))) return true;
  }
  const ext = name.split('.').pop()?.toLowerCase();
  return ['csv', 'md', 'json', 'txt', 'xml', 'yaml', 'yml', 'sh', 'js', 'ts', 'html', 'css', 'log', 'ini', 'toml', 'sql'].includes(ext || '');
}

export function getFileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

export function isCodeFile(name: string): boolean {
  const ext = getFileExtension(name);
  return ['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'php', 'sh', 'bash',
    'css', 'html', 'xml', 'json', 'yaml', 'yml', 'toml', 'sql', 'c', 'cpp', 'h',
    'swift', 'kt', 'dart', 'lua', 'r', 'ini', 'env', 'dockerfile'].includes(ext);
}

export function getFriendlyTypeName(mimeType: string | null, name: string): string {
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
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'MS Excel spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'MS PowerPoint presentation';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'MS Word document';
  if (mimeType.startsWith('image/')) return `${mimeType.split('/')[1].toUpperCase()} image`;
  if (mimeType.startsWith('video/')) return `${mimeType.split('/')[1].toUpperCase()} video`;
  if (mimeType.startsWith('audio/')) return `${mimeType.split('/')[1].toUpperCase()} audio`;
  if (mimeType.startsWith('text/')) return 'Text file';
  if (mimeType.includes('zip') || mimeType.includes('archive') || mimeType.includes('compressed')) return 'Archive';
  return 'File';
}

export function matchesTypeFilter(item: DriveItem, filter: TypeFilter): boolean {
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

export function matchesModifiedFilter(item: DriveItem, filter: ModifiedFilter): boolean {
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

/** Extract plain text from TipTap/ProseMirror JSON content */
export function extractTextFromContent(content: Record<string, unknown> | null): string {
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

export function renderBasicMarkdown(md: string): string {
  // Escape HTML first
  let html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Code blocks (```...```) — must come before inline patterns
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_m, _lang, code) =>
    `<pre style="background:var(--color-bg-tertiary);padding:var(--spacing-md);border-radius:var(--radius-md);overflow-x:auto;font-family:var(--font-mono);font-size:var(--font-size-xs);line-height:1.6;margin:var(--spacing-sm) 0;border:1px solid var(--color-border-secondary)"><code>${code.trim()}</code></pre>`
  );

  // Blockquotes
  html = html.replace(/^&gt; (.+)$/gm,
    '<blockquote style="border-left:3px solid var(--color-accent-primary);padding-left:var(--spacing-md);color:var(--color-text-secondary);margin:var(--spacing-sm) 0;font-style:italic">$1</blockquote>'
  );

  // Headings (h1-h4)
  html = html
    .replace(/^#### (.+)$/gm, '<h4 style="margin:var(--spacing-md) 0 var(--spacing-xs);font-size:var(--font-size-sm);font-weight:var(--font-weight-semibold);color:var(--color-text-primary)">$1</h4>')
    .replace(/^### (.+)$/gm, '<h3 style="margin:var(--spacing-md) 0 var(--spacing-xs);font-size:var(--font-size-md);font-weight:var(--font-weight-semibold);color:var(--color-text-primary)">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="margin:var(--spacing-lg) 0 var(--spacing-xs);font-size:var(--font-size-lg);font-weight:var(--font-weight-semibold);color:var(--color-text-primary)">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="margin:var(--spacing-xl) 0 var(--spacing-sm);font-size:var(--font-size-xl);font-weight:var(--font-weight-bold);color:var(--color-text-primary)">$1</h1>');

  // Inline styles
  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del style="color:var(--color-text-tertiary)">$1</del>')
    .replace(/`(.+?)`/g, '<code style="background:var(--color-bg-tertiary);padding:1px 4px;border-radius:var(--radius-sm);font-size:var(--font-size-xs);font-family:var(--font-mono)">$1</code>');

  // Links [text](url)
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener" style="color:var(--color-text-link);text-decoration:underline">$1</a>');

  // Images ![alt](url)
  html = html.replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:var(--radius-md);margin:var(--spacing-sm) 0" />');

  // Checkboxes
  html = html
    .replace(/^- \[x\] (.+)$/gm, '<div style="display:flex;align-items:center;gap:6px;margin:2px 0"><span style="color:var(--color-success)">&#9745;</span><span style="text-decoration:line-through;color:var(--color-text-tertiary)">$1</span></div>')
    .replace(/^- \[ \] (.+)$/gm, '<div style="display:flex;align-items:center;gap:6px;margin:2px 0"><span style="color:var(--color-text-tertiary)">&#9744;</span><span>$1</span></div>');

  // Lists
  html = html
    .replace(/^- (.+)$/gm, '<li style="margin-left:var(--spacing-lg);list-style:disc;margin-bottom:2px">$1</li>')
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:var(--spacing-lg);list-style:decimal;margin-bottom:2px">$1</li>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--color-border-secondary);margin:var(--spacing-md) 0">');

  // Tables (simple: | col | col |)
  html = html.replace(/((?:\|.+\|\n?)+)/g, (table) => {
    const rows = table.trim().split('\n').filter(r => r.trim());
    if (rows.length < 2) return table;
    // Skip separator row (|---|---|)
    const dataRows = rows.filter(r => !/^\|[\s-:|]+\|$/.test(r));
    if (dataRows.length === 0) return table;
    const headerCells = dataRows[0].split('|').filter(c => c.trim());
    const bodyRows = dataRows.slice(1);
    let t = '<table style="width:100%;border-collapse:collapse;margin:var(--spacing-sm) 0;font-size:var(--font-size-sm)">';
    t += '<thead><tr>' + headerCells.map(c => `<th style="text-align:left;padding:var(--spacing-xs) var(--spacing-sm);border-bottom:2px solid var(--color-border-primary);font-weight:var(--font-weight-medium);color:var(--color-text-secondary)">${c.trim()}</th>`).join('') + '</tr></thead>';
    t += '<tbody>';
    for (const row of bodyRows) {
      const cells = row.split('|').filter(c => c.trim());
      t += '<tr>' + cells.map(c => `<td style="padding:var(--spacing-xs) var(--spacing-sm);border-bottom:1px solid var(--color-border-secondary)">${c.trim()}</td>`).join('') + '</tr>';
    }
    t += '</tbody></table>';
    return t;
  });

  // Paragraphs
  html = html.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');

  return html;
}

export function parseCsvToRows(content: string): string[][] {
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

export function stripExtension(name: string, type: string): string {
  if (type !== 'file') return name;
  const lastDot = name.lastIndexOf('.');
  return lastDot > 0 ? name.slice(0, lastDot) : name;
}
