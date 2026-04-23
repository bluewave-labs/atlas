import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  X, Download, ChevronDown, History, Music, ExternalLink,
  RotateCcw, Upload, FolderPlus, Pencil, Trash2, Share2, Link2,
  Activity, MessageSquare, Send, Inbox,
} from 'lucide-react';
import { DataTable, type DataTableColumn } from '../../../components/ui/data-table';
import { IconButton } from '../../../components/ui/icon-button';
import { Button } from '../../../components/ui/button';
import { Chip } from '../../../components/ui/chip';
import { Tooltip } from '../../../components/ui/tooltip';
import { Avatar } from '../../../components/ui/avatar';
import { PresenceAvatars } from '../../../components/shared/presence-avatars';
import { VisibilityToggle } from '../../../components/shared/visibility-toggle';
import { MentionInput } from '../../../components/shared/mention-input';
import { getFileTypeIcon, formatBytes, formatRelativeDate, isImageFile } from '../../../lib/drive-utils';
import {
  getTokenParam, parseTag, isTextPreviewable, getFileExtension, isCodeFile,
  getFriendlyTypeName, renderBasicMarkdown, parseCsvToRows, extractTextFromContent,
} from '../lib/helpers';
import { DrawingPreviewThumbnail } from './drawing-preview-thumbnail';
import { LinkedRecordsSection, type LinkedRecord } from './linked-records-section';
import type { DriveItem } from '@atlas-platform/shared';

interface DrivePreviewPanelProps {
  previewItem: DriveItem;
  previewWidth: number;
  handlePreviewResizeStart: (e: React.MouseEvent) => void;
  setPreviewItem: (item: DriveItem | null) => void;
  filePreviewData: { content: string; truncated: boolean } | undefined;
  previewLoading: boolean;
  linkedDocData: { id: string; title: string; content: Record<string, unknown> | null } | undefined;
  linkedDrawingData: { id: string; title: string; content: Record<string, unknown> | null } | undefined;
  linkedTableData: { id: string; title: string; columns: Array<{ id: string; name: string; type: string }>; rows: Array<Record<string, unknown>> } | undefined;
  updateDriveVisibility: { mutate: (args: { id: string; visibility: 'private' | 'team' }) => void };
  account: { userId: string } | null;
  // Version history
  versionHistoryOpen: boolean;
  setVersionHistoryOpen: (v: boolean) => void;
  versionsData: { versions: Array<{ id: string; name: string; createdAt: string; size: number | null }> } | undefined;
  restoreVersion: { mutate: (args: { itemId: string; versionId: string }, opts?: any) => void };
  addToast: (toast: { type: 'success' | 'error' | 'info' | 'undo'; message: string }) => void;
  // Comments
  commentsOpen: boolean;
  setCommentsOpen: (v: boolean) => void;
  commentsData: Array<{ id: string; userName: string; body: string; createdAt: string }> | undefined;
  commentBody: string;
  setCommentBody: (v: string) => void;
  createFileComment: { mutate: (args: { itemId: string; body: string }, opts?: any) => void };
  deleteFileComment: { mutate: (id: string) => void };
  // Activity
  activityOpen: boolean;
  setActivityOpen: (v: boolean) => void;
  activityData: Array<{ id: string; userName: string; action: string; createdAt: string; metadata: unknown }> | undefined;
}

export function DrivePreviewPanel({
  previewItem,
  previewWidth,
  handlePreviewResizeStart,
  setPreviewItem,
  filePreviewData,
  previewLoading,
  linkedDocData,
  linkedDrawingData,
  linkedTableData,
  updateDriveVisibility,
  account,
  versionHistoryOpen,
  setVersionHistoryOpen,
  versionsData,
  restoreVersion,
  addToast,
  commentsOpen,
  setCommentsOpen,
  commentsData,
  commentBody,
  setCommentBody,
  createFileComment,
  deleteFileComment,
  activityOpen,
  setActivityOpen,
  activityData,
}: DrivePreviewPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const previewFileId = previewItem.type === 'file' && isTextPreviewable(previewItem.mimeType, previewItem.name) ? previewItem.id : undefined;

  // NOTE: dangerouslySetInnerHTML below is used for markdown rendering of user-owned
  // drive file content (same as original code). The renderBasicMarkdown helper escapes
  // HTML entities before applying markdown transforms, providing basic sanitization.

  return (
    <div className="drive-preview-panel" style={{ width: previewWidth }}>
      {/* Resize handle */}
      <div
        onMouseDown={handlePreviewResizeStart}
        style={{
          position: 'absolute',
          top: 0,
          left: -2,
          bottom: 0,
          width: 4,
          cursor: 'col-resize',
          zIndex: 10,
        }}
      />
      <div className="drive-preview-header">
        <span className="drive-preview-title">{previewItem.name}</span>
        {(previewItem as { uploadSource?: { name: string | null; email: string | null; uploadedAt: string } }).uploadSource && (
          <div style={{
            fontSize: 'var(--font-size-xs)',
            color: 'var(--color-text-secondary)',
            padding: 'var(--spacing-xs) var(--spacing-md)',
            background: 'var(--color-bg-secondary)',
            borderRadius: 'var(--radius-sm)',
            marginLeft: 'var(--spacing-xs)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <Inbox size={11} />
            {t('drive.preview.uploadedBy', {
              name: (previewItem as { uploadSource?: { name: string | null } }).uploadSource?.name || t('drive.preview.anonymous'),
              email: (previewItem as { uploadSource?: { email: string | null } }).uploadSource?.email || '',
            })}
          </div>
        )}
        <PresenceAvatars appId="drive" recordId={previewItem?.id} />
        <IconButton
          icon={<X size={16} />}
          label={t('drive.preview.closePreview')}
          size={28}
          onClick={() => setPreviewItem(null)}
        />
      </div>

      <div className="drive-preview-body">
        <LinkedRecordsSection linkedFrom={(previewItem as { linkedFrom?: LinkedRecord[] }).linkedFrom} />
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
                if (rows.length === 0) return <pre className="drive-preview-pre">{t('drive.preview.emptyContent')}</pre>;
                const header = rows[0];
                const body = rows.slice(1, 11); // first 10 rows
                const previewCols = header.slice(0, 6);
                type CsvRow = { id: string } & Record<string, string>;
                const tableRows: CsvRow[] = body.map((row, ri) => {
                  const obj: CsvRow = { id: String(ri) };
                  previewCols.forEach((h, ci) => { obj[h] = row[ci] ?? ''; });
                  return obj;
                });
                const columns: DataTableColumn<CsvRow>[] = previewCols.map((h) => ({
                  key: h,
                  label: h,
                  render: (row) => <span>{row[h]}</span>,
                }));
                return (
                  <div className="drive-preview-table-wrap">
                    <DataTable
                      data={tableRows}
                      columns={columns}
                      storageKey="drive_preview_csv"
                      paginated={false}
                      searchable={false}
                      hideFooter
                    />
                    {filePreviewData.truncated && (
                      <div className="drive-preview-truncated">{t('drive.preview.fileTruncated')}</div>
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
                {isCodeFile(previewItem.name) ? (
                  <div className="drive-preview-code">
                    <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: 'var(--font-mono)', fontSize: 'var(--font-size-xs)', lineHeight: 1.7 }}>
                      <tbody>
                        {filePreviewData.content.split('\n').map((line, i) => (
                          <tr key={i}>
                            <td style={{ padding: '0 var(--spacing-sm)', color: 'var(--color-text-tertiary)', textAlign: 'right', userSelect: 'none', minWidth: 36, opacity: 0.5 }}>{i + 1}</td>
                            <td style={{ padding: '0 var(--spacing-sm)', whiteSpace: 'pre', color: 'var(--color-text-primary)' }}>{line}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <pre className="drive-preview-pre">{filePreviewData.content}</pre>
                )}
                {filePreviewData.truncated && (
                  <div className="drive-preview-truncated">File truncated — showing first 512 KB</div>
                )}
              </>
            )}
          </div>
        ) : previewFileId && previewLoading ? (
          <div className="drive-preview-icon">
            <span style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>{t('drive.preview.loadingPreview')}</span>
          </div>
        ) : previewItem.linkedResourceType === 'document' && linkedDocData ? (
          <div className="drive-preview-text-content">
            <pre className="drive-preview-pre" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {extractTextFromContent(linkedDocData.content) || t('drive.preview.emptyDocument')}
            </pre>
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border-secondary)' }}>
              <Button
                variant="secondary"
                size="sm"
                icon={<ExternalLink size={14} />}
                onClick={() => navigate(`/docs/${previewItem.linkedResourceId}`)}
                style={{ width: '100%' }}
              >
                {t('drive.preview.openInEditor')}
              </Button>
            </div>
          </div>
        ) : previewItem.linkedResourceType === 'drawing' && linkedDrawingData ? (
          <div className="drive-preview-text-content">
            <DrawingPreviewThumbnail content={linkedDrawingData.content} />
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border-secondary)' }}>
              <Button
                variant="secondary"
                size="sm"
                icon={<ExternalLink size={14} />}
                onClick={() => navigate(`/draw/${previewItem.linkedResourceId}`)}
                style={{ width: '100%' }}
              >
                {t('drive.preview.openInEditor')}
              </Button>
            </div>
          </div>
        ) : previewItem.linkedResourceType === 'spreadsheet' && linkedTableData ? (
          <div className="drive-preview-text-content">
            {(() => {
              const cols = linkedTableData.columns || [];
              const allRows = linkedTableData.rows || [];
              if (cols.length === 0) return (
                <div className="drive-preview-icon" style={{ gap: 8, padding: 24 }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)' }}>{t('drive.preview.emptySpreadsheet')}</span>
                </div>
              );
              const previewRows = allRows.slice(0, 10);
              const previewCols = cols.slice(0, 6);
              const extraCols = cols.length > 6;
              type SheetRow = { id: string } & Record<string, string>;
              const tableRows: SheetRow[] = previewRows.map((row, ri) => {
                const obj: SheetRow = { id: String(ri) };
                previewCols.forEach((col) => { obj[col.id] = row[col.id] != null ? String(row[col.id]) : ''; });
                if (extraCols) obj['__extra__'] = '…';
                return obj;
              });
              const sheetColumns: DataTableColumn<SheetRow>[] = [
                ...previewCols.map((col) => ({
                  key: col.id,
                  label: col.name,
                  render: (row: SheetRow) => <span>{row[col.id]}</span>,
                } as DataTableColumn<SheetRow>)),
                ...(extraCols ? [{
                  key: '__extra__',
                  label: `+${cols.length - 6}`,
                  width: 50,
                  render: (row: SheetRow) => <span style={{ color: 'var(--color-text-tertiary)' }}>{row['__extra__']}</span>,
                } as DataTableColumn<SheetRow>] : []),
              ];
              return (
                <div style={{ padding: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>
                    {t('drive.preview.columnsSummary', { columns: cols.length, rows: allRows.length })}
                  </div>
                  <div className="drive-preview-table-wrap">
                    <DataTable
                      data={tableRows}
                      columns={sheetColumns}
                      storageKey="drive_preview_sheet"
                      paginated={false}
                      searchable={false}
                      hideFooter
                    />
                    {allRows.length > 10 && (
                      <div className="drive-preview-truncated">{t('drive.preview.showingRows', { shown: 10, total: allRows.length })}</div>
                    )}
                  </div>
                </div>
              );
            })()}
            <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border-secondary)' }}>
              <Button
                variant="secondary"
                size="sm"
                icon={<ExternalLink size={14} />}
                onClick={() => navigate(`/tables/${previewItem.linkedResourceId}`)}
                style={{ width: '100%' }}
              >
                {t('drive.preview.openInEditor')}
              </Button>
            </div>
          </div>
        ) : previewItem.linkedResourceType && previewItem.linkedResourceId ? (
          <div className="drive-preview-icon">
            <span style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>{t('drive.preview.loadingPreview')}</span>
          </div>
        ) : (
          <div className="drive-preview-icon">
            {(() => {
              const Icon = getFileTypeIcon(previewItem.mimeType, previewItem.type, previewItem.linkedResourceType);
              return <Icon size={64} />;
            })()}
            {previewItem.type === 'file' && !previewItem.storagePath && !previewItem.linkedResourceType && (
              <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12, marginTop: 8 }}>
                {t('drive.preview.noPreview')}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="drive-preview-meta">
        <div className="drive-preview-meta-row">
          <span className="drive-preview-meta-label">{t('drive.preview.size')}</span>
          <span>{formatBytes(previewItem.size)}</span>
        </div>
        <div className="drive-preview-meta-row">
          <span className="drive-preview-meta-label">{t('drive.preview.modified')}</span>
          <span>{formatRelativeDate(previewItem.updatedAt)}</span>
        </div>
        {previewItem.mimeType && (
          <div className="drive-preview-meta-row">
            <span className="drive-preview-meta-label">{t('drive.preview.type')}</span>
            <span>{getFriendlyTypeName(previewItem.mimeType, previewItem.name)}</span>
          </div>
        )}
        {previewItem.tags && previewItem.tags.length > 0 && (
          <div className="drive-preview-meta-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
            <span className="drive-preview-meta-label">{t('drive.preview.tags')}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {previewItem.tags.map((tag, i) => {
                const { color, label } = parseTag(tag);
                return <Chip key={i} color={color} height={20}>{label}</Chip>;
              })}
            </div>
          </div>
        )}
        <div className="drive-preview-meta-row">
          <span className="drive-preview-meta-label">{t('common.visibility')}</span>
          <VisibilityToggle
            visibility={((previewItem as any).visibility as 'private' | 'team') || 'private'}
            onToggle={(v) => updateDriveVisibility.mutate({ id: previewItem.id, visibility: v })}
            disabled={previewItem.userId !== account?.userId}
          />
        </div>
        {previewItem.type === 'file' && (
          <div style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 8 }}>
            <Button
              variant="ghost"
              size="sm"
              icon={<History size={13} />}
              onClick={() => setVersionHistoryOpen(!versionHistoryOpen)}
              style={{ width: '100%', justifyContent: 'flex-start', padding: '4px 0', height: 'auto' }}
            >
              {t('drive.preview.versionHistory')}
              <ChevronDown size={12} style={{ marginLeft: 'auto', transform: versionHistoryOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
            </Button>
            {versionHistoryOpen && versionsData && (
              <div className="drive-version-list">
                {versionsData.versions.length === 0 ? (
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', padding: '4px 0' }}>{t('drive.preview.noPreviousVersions')}</span>
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
                        <IconButton
                          icon={<RotateCcw size={12} />}
                          label={t('drive.preview.restoreVersion')}
                          size={20}
                          tooltip={false}
                          onClick={() => {
                            restoreVersion.mutate({ itemId: previewItem.id, versionId: v.id }, {
                              onSuccess: () => addToast({ type: 'success', message: t('drive.actions.versionRestored') }),
                            });
                          }}
                        />
                        <a
                          href={`/api/v1/drive/${previewItem.id}/versions/${v.id}/download${getTokenParam()}`}
                          title={t('drive.preview.downloadVersion')}
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

        {/* Comments section */}
        <div style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 8 }}>
          <Button
            variant="ghost"
            size="sm"
            icon={<MessageSquare size={13} />}
            onClick={() => setCommentsOpen(!commentsOpen)}
            style={{ width: '100%', justifyContent: 'flex-start', padding: '4px 0', height: 'auto' }}
          >
            {t('drive.comments.title')}
            <ChevronDown size={12} style={{ marginLeft: 'auto', transform: commentsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </Button>
          {commentsOpen && (
            <div style={{ marginTop: 'var(--spacing-xs)' }}>
              {/* Comment input */}
              <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)', alignItems: 'flex-end' }}>
                <MentionInput
                  value={commentBody}
                  onChange={setCommentBody}
                  placeholder={t('drive.comments.placeholder')}
                  onSubmit={() => {
                    if (commentBody.trim() && previewItem) {
                      createFileComment.mutate({ itemId: previewItem.id, body: commentBody.trim() }, {
                        onSuccess: () => setCommentBody(''),
                      });
                    }
                  }}
                  style={{ fontSize: '13px', padding: '4px var(--spacing-sm)' }}
                />
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Send size={12} />}
                  disabled={!commentBody.trim()}
                  onClick={() => {
                    if (commentBody.trim() && previewItem) {
                      createFileComment.mutate({ itemId: previewItem.id, body: commentBody.trim() }, {
                        onSuccess: () => setCommentBody(''),
                      });
                    }
                  }}
                >
                  {t('drive.comments.add')}
                </Button>
              </div>
              {/* Comment list */}
              {commentsData && commentsData.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', maxHeight: 220, overflowY: 'auto', paddingRight: 'var(--spacing-xs)' }}>
                  {commentsData.map((c) => (
                    <div key={c.id} style={{ display: 'flex', gap: 'var(--spacing-sm)', padding: 'var(--spacing-xs) 0', alignItems: 'flex-start' }}>
                      <Avatar name={c.userName} size={22} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                          <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>{c.userName}</span>
                          <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{formatRelativeDate(c.createdAt)}</span>
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-secondary)', marginTop: 2, wordBreak: 'break-word' }}>{c.body}</div>
                      </div>
                      <Tooltip content={t('drive.comments.delete')}>
                        <span>
                          <IconButton
                            icon={<Trash2 size={10} />}
                            label={t('drive.comments.delete')}
                            size={18}
                            tooltip={false}
                            destructive
                            onClick={() => deleteFileComment.mutate(c.id)}
                          />
                        </span>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', padding: 'var(--spacing-xs) 0', display: 'block' }}>{t('drive.comments.empty')}</span>
              )}
            </div>
          )}
        </div>

        {/* Activity section */}
        <div style={{ borderTop: '1px solid var(--color-border-secondary)', paddingTop: 8 }}>
          <Button
            variant="ghost"
            size="sm"
            icon={<Activity size={13} />}
            onClick={() => setActivityOpen(!activityOpen)}
            style={{ width: '100%', justifyContent: 'flex-start', padding: '4px 0', height: 'auto' }}
          >
            {t('drive.activity.title')}
            <ChevronDown size={12} style={{ marginLeft: 'auto', transform: activityOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </Button>
          {activityOpen && (
            <div style={{ marginTop: 'var(--spacing-xs)', maxHeight: 220, overflowY: 'auto' }}>
              {activityData && activityData.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' }}>
                  {activityData.map((a) => {
                    const actionIcon = a.action === 'file.uploaded' ? <Upload size={11} />
                      : a.action === 'folder.created' ? <FolderPlus size={11} />
                      : a.action === 'file.renamed' ? <Pencil size={11} />
                      : a.action === 'file.deleted' ? <Trash2 size={11} />
                      : a.action === 'file.restored' ? <RotateCcw size={11} />
                      : a.action === 'file.shared' ? <Share2 size={11} />
                      : a.action === 'share_link.created' ? <Link2 size={11} />
                      : <Activity size={11} />;
                    return (
                      <div key={a.id} style={{ display: 'flex', gap: 'var(--spacing-sm)', padding: 'var(--spacing-xs) 0', fontSize: 'var(--font-size-xs)', alignItems: 'flex-start' }}>
                        <Avatar name={a.userName} size={20} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 'var(--font-weight-medium)', color: 'var(--color-text-primary)' }}>{a.userName}</span>
                            <span style={{ color: 'var(--color-text-secondary)' }}>
                              {a.action === 'file.uploaded' && t('drive.activity.fileUploaded')}
                              {a.action === 'folder.created' && t('drive.activity.folderCreated')}
                              {a.action === 'file.renamed' && t('drive.activity.fileRenamed')}
                              {a.action === 'file.deleted' && t('drive.activity.fileDeleted')}
                              {a.action === 'file.restored' && t('drive.activity.fileRestored')}
                              {a.action === 'file.shared' && t('drive.activity.fileShared', { name: (a.metadata as Record<string, unknown>)?.sharedWith || '' })}
                              {a.action === 'share_link.created' && t('drive.activity.shareLinkCreated')}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', marginTop: 2 }}>
                            <span style={{ color: 'var(--color-text-tertiary)', display: 'inline-flex', alignItems: 'center' }}>{actionIcon}</span>
                            <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>{formatRelativeDate(a.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', padding: 'var(--spacing-xs) 0', display: 'block' }}>{t('drive.activity.empty')}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
