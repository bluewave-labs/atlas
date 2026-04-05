import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Folder, FileText, Image, File, ChevronRight, Search } from 'lucide-react';
import { Modal } from '../../../../components/ui/modal';
import { Button } from '../../../../components/ui/button';
import { Skeleton } from '../../../../components/ui/skeleton';
import { useToastStore } from '../../../../stores/toast-store';
import {
  useGoogleDriveStatus,
  useGoogleDriveFiles,
  useImportFromGoogleDrive,
} from '../../hooks';
import { formatBytes } from '../../../../lib/format';

interface GoogleDriveModalProps {
  open: boolean;
  onClose: () => void;
  targetParentId?: string | null;
}

interface BreadcrumbEntry {
  id: string | undefined;
  name: string;
}

function getFileIcon(mimeType: string, isFolder: boolean) {
  if (isFolder) return <Folder size={16} style={{ color: '#f59e0b', flexShrink: 0 }} />;
  if (mimeType.startsWith('image/')) return <Image size={16} style={{ color: '#e06c9f', flexShrink: 0 }} />;
  if (mimeType.includes('document') || mimeType.includes('text') || mimeType.includes('pdf'))
    return <FileText size={16} style={{ color: '#3b82f6', flexShrink: 0 }} />;
  return <File size={16} style={{ color: '#64748b', flexShrink: 0 }} />;
}


export function GoogleDriveModal({ open, onClose, targetParentId }: GoogleDriveModalProps) {
  const { t } = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([
    { id: undefined, name: t('drive.google.myDrive', 'My Drive') },
  ]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const { data: status, isLoading: statusLoading } = useGoogleDriveStatus();
  const isConnectedAndScoped = !!(status?.connected && status?.driveScoped);
  const { data: files, isLoading: filesLoading } = useGoogleDriveFiles(
    currentFolderId,
    open && isConnectedAndScoped,
  );
  const importMutation = useImportFromGoogleDrive();

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setCurrentFolderId(undefined);
      setBreadcrumbs([{ id: undefined, name: t('drive.google.myDrive', 'My Drive') }]);
      setSelectedIds(new Set());
      setSearchQuery('');
    }
  }, [open, t]);

  const handleNavigateToFolder = useCallback((folderId: string, folderName: string) => {
    setCurrentFolderId(folderId);
    setBreadcrumbs((prev) => [...prev, { id: folderId, name: folderName }]);
    setSelectedIds(new Set());
    setSearchQuery('');
  }, []);

  const handleBreadcrumbClick = useCallback((index: number) => {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setCurrentFolderId(breadcrumbs[index].id);
    setSelectedIds(new Set());
    setSearchQuery('');
  }, [breadcrumbs]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleImport = useCallback(async () => {
    if (selectedIds.size === 0) return;
    try {
      await importMutation.mutateAsync({
        fileIds: Array.from(selectedIds),
        targetParentId: targetParentId ?? null,
      });
      addToast({
        type: 'success',
        message: t('drive.google.importSuccess', 'Files imported successfully'),
      });
      onClose();
    } catch {
      addToast({
        type: 'error',
        message: t('drive.google.importError', 'Failed to import files'),
      });
    }
  }, [selectedIds, targetParentId, importMutation, addToast, t, onClose]);

  const filteredFiles = useMemo(() => {
    if (!files) return [];
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, searchQuery]);

  const handleConnect = useCallback(() => {
    window.open('/api/v1/auth/google', '_blank');
  }, []);

  const isConnected = status?.connected && status?.driveScoped;

  return (
    <Modal
      open={open}
      onOpenChange={(v) => { if (!v) onClose(); }}
      width={560}
      title={t('drive.google.importTitle', 'Import from Google Drive')}
    >
      <Modal.Header title={t('drive.google.importTitle', 'Import from Google Drive')} />
      <Modal.Body>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', minHeight: 320 }}>
          {statusLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)', padding: 'var(--spacing-lg)' }}>
              <Skeleton width="100%" height={20} />
              <Skeleton width="80%" height={16} />
              <Skeleton width="60%" height={16} />
            </div>
          ) : !isConnected ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 'var(--spacing-lg)', padding: 'var(--spacing-2xl)', textAlign: 'center', flex: 1,
            }}>
              <Folder size={40} strokeWidth={1.2} style={{ color: 'var(--color-text-tertiary)' }} />
              <div>
                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 'var(--spacing-xs)' }}>
                  {t('drive.google.notConnected', 'Google Drive not connected')}
                </div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                  {t('drive.google.notConnectedDesc', 'Connect your Google account to browse and import files.')}
                </div>
              </div>
              <Button variant="primary" onClick={handleConnect}>
                {t('drive.google.connectButton', 'Connect Google Drive')}
              </Button>
            </div>
          ) : (
            <>
              {/* Search */}
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)' }} />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('drive.google.searchPlaceholder', 'Search files...')}
                  style={{
                    width: '100%',
                    padding: '7px 12px 7px 30px',
                    border: '1px solid var(--color-border-primary)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--color-bg-tertiary)',
                    color: 'var(--color-text-primary)',
                    fontSize: 'var(--font-size-sm)',
                    fontFamily: 'var(--font-family)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Breadcrumbs */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', fontSize: 'var(--font-size-sm)' }}>
                {breadcrumbs.map((crumb, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {i > 0 && <ChevronRight size={12} style={{ color: 'var(--color-text-tertiary)' }} />}
                    <button
                      onClick={() => handleBreadcrumbClick(i)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                        borderRadius: 'var(--radius-sm)', color: i === breadcrumbs.length - 1 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                        fontWeight: i === breadcrumbs.length - 1 ? 500 : 400, fontSize: 'var(--font-size-sm)',
                        fontFamily: 'var(--font-family)',
                      }}
                    >
                      {crumb.name}
                    </button>
                  </span>
                ))}
              </div>

              {/* File list */}
              <div style={{
                flex: 1, minHeight: 200, maxHeight: 360, overflowY: 'auto',
                border: '1px solid var(--color-border-secondary)', borderRadius: 'var(--radius-md)',
              }}>
                {filesLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)', padding: 'var(--spacing-sm)' }}>
                    {Array.from({ length: 5 }, (_, i) => (
                      <Skeleton key={i} width="100%" height={36} borderRadius={4} />
                    ))}
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    height: 200, color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)',
                  }}>
                    {searchQuery.trim()
                      ? t('drive.google.noResults', 'No files match your search')
                      : t('drive.google.emptyFolder', 'This folder is empty')}
                  </div>
                ) : (
                  filteredFiles.map((file) => {
                    const isSelected = selectedIds.has(file.id);
                    return (
                      <div
                        key={file.id}
                        onClick={() => {
                          if (file.isFolder) {
                            handleNavigateToFolder(file.id, file.name);
                          } else {
                            toggleSelect(file.id);
                          }
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
                          padding: '8px 12px', cursor: 'pointer',
                          background: isSelected ? 'var(--color-surface-selected)' : 'transparent',
                          borderBottom: '1px solid var(--color-border-secondary)',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface-hover)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLDivElement).style.background = isSelected ? 'var(--color-surface-selected)' : 'transparent';
                        }}
                      >
                        {/* Checkbox for files, empty space for folders */}
                        {!file.isFolder ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(file.id)}
                            onClick={(e) => e.stopPropagation()}
                            style={{ flexShrink: 0, cursor: 'pointer', accentColor: 'var(--color-accent-primary)' }}
                          />
                        ) : (
                          <div style={{ width: 16, flexShrink: 0 }} />
                        )}

                        {getFileIcon(file.mimeType, file.isFolder)}

                        <span style={{
                          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          fontSize: 'var(--font-size-sm)', color: 'var(--color-text-primary)',
                        }}>
                          {file.name}
                        </span>

                        {file.isFolder ? (
                          <ChevronRight size={14} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
                        ) : (
                          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
                            {formatBytes(file.size)}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" onClick={onClose}>
            {t('drive.modals.cancel', 'Cancel')}
          </Button>
          {isConnected && (
            <Button
              variant="primary"
              onClick={handleImport}
              disabled={selectedIds.size === 0 || importMutation.isPending}
              style={{
                opacity: selectedIds.size === 0 ? 0.5 : 1,
                cursor: selectedIds.size === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {importMutation.isPending
                ? t('drive.google.importing', 'Importing...')
                : t('drive.google.importButton', { count: selectedIds.size, defaultValue: `Import ${selectedIds.size}` })}
            </Button>
          )}
        </div>
      </Modal.Footer>
    </Modal>
  );
}
