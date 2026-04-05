import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronRight,
  Download,
  History,
  Printer,
  Settings,
  MessageSquare,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { IconButton } from '../../../components/ui/icon-button';
import { PresenceAvatars } from '../../../components/shared/presence-avatars';
import { VisibilityToggle } from '../../../components/shared/visibility-toggle';
import { htmlToPlainText, htmlToMarkdown, countWords, estimateReadingTime, downloadFile } from '../lib/doc-helpers';

// ─── Top bar with breadcrumbs, saving status, export ────────────────────

interface TopBarProps {
  doc: { id: string; title: string; icon: string | null; content: Record<string, unknown> | null };
  breadcrumbs: { id: string; title: string; icon: string | null }[];
  isSaving: boolean;
  onNavigate: (id: string) => void;
  onShowVersionHistory: () => void;
  onOpenSettings: () => void;
  showComments: boolean;
  onToggleComments: () => void;
  visibility: 'private' | 'team';
  onVisibilityToggle: (v: 'private' | 'team') => void;
  isOwner: boolean;
}

export function TopBar({
  doc,
  breadcrumbs,
  isSaving,
  onNavigate,
  onShowVersionHistory,
  onOpenSettings,
  showComments,
  onToggleComments,
  visibility,
  onVisibilityToggle,
  isOwner,
}: TopBarProps) {
  const { t } = useTranslation();
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const html = (doc.content?._html as string) || '';
  const plainText = htmlToPlainText(html);
  const wordCount = countWords(plainText);
  const readingTime = estimateReadingTime(wordCount);

  useEffect(() => {
    if (!showExport) return;
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExport]);

  const handleExportHTML = () => {
    const fullHtml = [
      '<!DOCTYPE html>',
      '<html>',
      '<head><meta charset="utf-8"><title>' + (doc.title || t('docs.untitled')) + '</title></head>',
      '<body>',
      '<h1>' + (doc.title || t('docs.untitled')) + '</h1>',
      html,
      '</body>',
      '</html>',
    ].join('\n');
    downloadFile(`${doc.title || t('docs.untitled')}.html`, fullHtml, 'text/html');
    setShowExport(false);
  };

  const handleExportMarkdown = () => {
    const md = `# ${doc.title}\n\n${htmlToMarkdown(html)}`;
    downloadFile(`${doc.title || t('docs.untitled')}.md`, md, 'text/markdown');
    setShowExport(false);
  };

  const handleExportText = () => {
    downloadFile(`${doc.title || t('docs.untitled')}.txt`, `${doc.title}\n\n${plainText}`, 'text/plain');
    setShowExport(false);
  };

  const handlePrint = () => {
    const title = doc.title || t('docs.untitled');
    const printHtml = [
      '<!DOCTYPE html>',
      '<html>',
      '<head>',
      '<meta charset="utf-8">',
      `<title>${title}</title>`,
      '<style>',
      'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#1a1a1a;font-size:15px;line-height:1.7;}',
      'h1{font-size:32px;font-weight:700;margin-bottom:24px;}',
      'h2{font-size:22px;font-weight:600;margin-top:32px;}',
      'h3{font-size:18px;font-weight:600;margin-top:24px;}',
      'code{font-family:"SF Mono",monospace;background:#f3f4f6;padding:2px 5px;border-radius:3px;font-size:0.9em;}',
      'pre{background:#f3f4f6;padding:12px 16px;border-radius:6px;overflow-x:auto;}',
      'pre code{background:none;padding:0;}',
      'blockquote{border-left:3px solid #d0d5dd;padding-left:16px;color:#6b7280;margin:12px 0;}',
      'table{border-collapse:collapse;width:100%;margin:12px 0;}',
      'td,th{border:1px solid #d0d5dd;padding:8px 12px;text-align:left;}',
      'th{background:#f9fafb;font-weight:600;}',
      'img{max-width:100%;height:auto;}',
      'hr{border:none;border-top:1px solid #d0d5dd;margin:24px 0;}',
      'ul,ol{padding-left:24px;}',
      '@media print{body{margin:0;padding:20px;}}',
      '</style>',
      '</head>',
      '<body>',
      `<h1>${title}</h1>`,
      html,
      '</body>',
      '</html>',
    ].join('\n');

    const blob = new Blob([printHtml], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    const printWindow = window.open(blobUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
        URL.revokeObjectURL(blobUrl);
      };
    } else {
      URL.revokeObjectURL(blobUrl);
    }
    setShowExport(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 16px',
        borderBottom: '1px solid var(--color-border-primary)',
        background: 'var(--color-bg-primary)',
        minHeight: 36,
        flexShrink: 0,
        fontSize: 12,
      }}
    >
      {/* Breadcrumbs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
        {breadcrumbs.map((crumb) => (
          <div key={crumb.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate(crumb.id)}
              style={{
                color: 'var(--color-text-tertiary)',
                fontSize: 12,
                padding: '2px 4px',
                height: 'auto',
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {crumb.icon && <span style={{ fontSize: 11 }}>{crumb.icon}</span>}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {crumb.title || t('docs.untitled')}
              </span>
            </Button>
            <ChevronRight size={10} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
          </div>
        ))}
        <span
          style={{
            color: 'var(--color-text-secondary)',
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
          }}
        >
          {doc.icon && <span style={{ fontSize: 11 }}>{doc.icon}</span>}
          {doc.title || t('docs.untitled')}
        </span>
      </div>

      {/* Word count & reading time */}
      <span
        style={{
          color: 'var(--color-text-tertiary)',
          fontSize: 11,
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {wordCount > 0 && `${wordCount.toLocaleString()} words \u00b7 ${readingTime}`}
      </span>

      {/* Saving indicator */}
      {isSaving && (
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-text-tertiary)',
            flexShrink: 0,
          }}
        >
          {t('docs.saving')}
        </span>
      )}

      <PresenceAvatars appId="docs" recordId={doc.id} />

      <VisibilityToggle
        visibility={visibility}
        onToggle={onVisibilityToggle}
        disabled={!isOwner}
      />

      {/* Comments toggle button */}
      <IconButton
        icon={<MessageSquare size={14} />}
        label={t('docs.comments')}
        size={26}
        active={showComments}
        onClick={onToggleComments}
      />

      {/* Version history button */}
      <IconButton
        icon={<History size={14} />}
        label={t('docs.versionHistory')}
        size={26}
        onClick={onShowVersionHistory}
      />

      {/* Settings button */}
      <IconButton
        icon={<Settings size={14} />}
        label={t('docs.settingsTitle')}
        size={26}
        onClick={onOpenSettings}
      />

      {/* Export button */}
      <div ref={exportRef} style={{ position: 'relative', flexShrink: 0 }}>
        <IconButton
          icon={<Download size={14} />}
          label={t('docs.export')}
          size={26}
          onClick={() => setShowExport(!showExport)}
        />
        {showExport && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: 4,
              zIndex: 100,
              minWidth: 160,
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-primary)',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              padding: 4,
              fontFamily: 'var(--font-family)',
            }}
          >
            <ExportBtn label="HTML" onClick={handleExportHTML} />
            <ExportBtn label="Markdown" onClick={handleExportMarkdown} />
            <ExportBtn label={t('docs.plainText')} onClick={handleExportText} />
            <div style={{ height: 1, background: 'var(--color-border-primary)', margin: '4px 0' }} />
            <ExportBtn label={t('docs.printPdf')} onClick={handlePrint} icon={<Printer size={13} />} />
          </div>
        )}
      </div>
    </div>
  );
}

function ExportBtn({
  label,
  onClick,
  icon,
}: {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={icon ?? <Download size={13} />}
      onClick={onClick}
      style={{
        width: '100%',
        justifyContent: 'flex-start',
        color: 'var(--color-text-secondary)',
      }}
    >
      {label}
    </Button>
  );
}
